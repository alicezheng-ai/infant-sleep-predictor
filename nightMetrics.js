/**
 * nightMetrics.js — night-level sleep metrics + narrative generation.
 *
 * Fixes three defects in the previous version:
 *   1. Window-level statistics were rendered in single-night grammar
 *      ("the night got more broken" was describing a 7-night rolling mean).
 *   2. Different metrics resolved different windows — the longest-block
 *      comparison excluded the current night while the total-sleep
 *      comparison included it, which inverted the sign on consolidated nights.
 *   3. Efficiency was reported from the baseline window while the header
 *      reported the single night, so the card contradicted itself.
 *
 * The structural fix is that every claim is tagged with a scope, and a claim
 * may only read from the comparison object matching its scope.
 */

const NIGHT_START_HOUR = 19; // a block starting at/after this belongs to that date's night
const NIGHT_END_HOUR = 7; // a block starting before this belongs to the previous date's night

const METRICS = ['totalMin', 'longestMin', 'wakes', 'inBedMin', 'efficiencyPct', 'bedtimeMin', 'wakeClockMin'];

const SCOPE = Object.freeze({ NIGHT: 'night', BASELINE: 'baseline' });

/* ------------------------------------------------------------------ */
/* Ingest                                                              */
/* ------------------------------------------------------------------ */

/**
 * Adapt Nara Baby CSV rows to {start, end} Date pairs.
 * Durations are recomputed from the timestamps rather than trusting
 * the exported [Sleep] Duration (Seconds) column, which can disagree.
 */
export function fromNaraRows(rows) {
  return rows
    .filter((r) => r.Type === 'Sleep' && r['[Sleep] End Date/time'])
    .map((r) => ({
      start: new Date(r['Start Date/time'].replace(' ', 'T')),
      end: new Date(r['[Sleep] End Date/time'].replace(' ', 'T')),
    }))
    .filter((b) => b.end > b.start)
    .sort((a, b) => a.start - b.start);
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nightKeyFor(start) {
  const h = start.getHours();
  if (h >= NIGHT_START_HOUR) return dateKey(start);
  if (h < NIGHT_END_HOUR) return dateKey(new Date(start.getTime() - 86400000));
  return null; // daytime nap
}

/* ------------------------------------------------------------------ */
/* Night-level metrics                                                 */
/* ------------------------------------------------------------------ */

export function buildNights(blocks) {
  const byNight = new Map();
  for (const b of blocks) {
    const key = nightKeyFor(b.start);
    if (!key) continue;
    if (!byNight.has(key)) byNight.set(key, []);
    byNight.get(key).push(b);
  }

  return [...byNight.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([night, bs]) => {
      bs.sort((a, b) => a.start - b.start);
      const durs = bs.map((b) => (b.end - b.start) / 60000);
      const firstOnset = bs[0].start;
      const finalWake = bs[bs.length - 1].end;
      const totalMin = durs.reduce((a, c) => a + c, 0);
      const inBedMin = (finalWake - firstOnset) / 60000;
      return {
        night,
        blocks: bs.length,
        wakes: bs.length - 1, // intra-night wakes, not counting the morning wake
        totalMin,
        longestMin: Math.max(...durs),
        inBedMin,
        efficiencyPct: (totalMin / inBedMin) * 100,
        bedtimeMin: firstOnset.getHours() * 60 + firstOnset.getMinutes(),
        wakeClockMin: finalWake.getHours() * 60 + finalWake.getMinutes(),
        firstOnset,
        finalWake,
      };
    });
}

/* ------------------------------------------------------------------ */
/* Comparisons — one window resolver, all metrics                      */
/* ------------------------------------------------------------------ */

const mean = (xs) => xs.reduce((a, c) => a + c, 0) / xs.length;

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Baseline comparison: trailing `recentN` nights (INCLUDING the current
 * night) against the `priorN` nights immediately before that span.
 *
 * Every metric is computed from the same two slices. Do not add a metric
 * that resolves its own window — that is the defect this replaces.
 */
export function baselineCompare(nights, { index = nights.length - 1, recentN = 7, priorN = 14 } = {}) {
  const recentEnd = index + 1; // inclusive of the current night, always
  const recentStart = recentEnd - recentN;
  const priorEnd = recentStart;
  const priorStart = priorEnd - priorN;
  if (priorStart < 0) return null; // insufficient history: emit no baseline claims

  const recent = nights.slice(recentStart, recentEnd);
  const prior = nights.slice(priorStart, priorEnd);

  const out = { scope: SCOPE.BASELINE, recentN, priorN, nightsCompared: recentN + priorN };
  for (const m of METRICS) {
    const r = mean(recent.map((n) => n[m]));
    const p = mean(prior.map((n) => n[m]));
    out[m] = { recent: r, prior: p, delta: r - p };
  }
  return out;
}

/**
 * Single-night comparison: tonight against the previous night, and against
 * the distribution of the trailing `lookback` nights (excluding tonight).
 * This is the only object a night-scoped claim may read.
 */
export function nightCompare(nights, { index = nights.length - 1, lookback = 21 } = {}) {
  const tonight = nights[index];
  const prev = index > 0 ? nights[index - 1] : null;
  const history = nights.slice(Math.max(0, index - lookback), index);
  if (!history.length) return null;

  const out = { scope: SCOPE.NIGHT, night: tonight.night, lookback: history.length };
  for (const m of METRICS) {
    const hist = history.map((n) => n[m]);
    const sorted = [...hist].sort((a, b) => a - b);
    out[m] = {
      value: tonight[m],
      vsPrevNight: prev ? tonight[m] - prev[m] : null,
      baselineMedian: median(hist),
      p25: sorted[Math.floor(sorted.length * 0.25)],
      p75: sorted[Math.floor(sorted.length * 0.75)],
      percentile: hist.filter((v) => v < tonight[m]).length / hist.length,
    };
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Claims                                                              */
/* ------------------------------------------------------------------ */

function claim(scope, source, text) {
  if (source.scope !== scope) {
    throw new Error(`scope violation: ${scope}-scoped claim built from ${source.scope} data — "${text}"`);
  }
  return { scope, text };
}

const hm = (min) => {
  const s = Math.round(Math.abs(min));
  return s >= 60 ? `${Math.floor(s / 60)}h${String(s % 60).padStart(2, '0')}m` : `${s} min`;
};

/**
 * Fragmentation claim. Reads single-night data only.
 *
 * Hard guard: never assert the night was more broken when the longest block
 * is at or above the trailing median. Under the old code this sentence fired
 * on a near-record consolidated night because it was reading a rolling mean
 * dragged down by the four fragmented nights before it.
 */
export function fragmentationClaim(nc) {
  const { longestMin, wakes } = nc;
  const longestBelowNormal = longestMin.value < longestMin.baselineMedian;
  const moreWakes = wakes.vsPrevNight !== null && wakes.vsPrevNight > 0 && wakes.value > wakes.baselineMedian;

  if (!longestBelowNormal && !moreWakes) return null; // nothing to report
  if (!longestBelowNormal) {
    return claim(
      SCOPE.NIGHT,
      nc,
      `More wakes than usual (${wakes.value} vs a typical ${wakes.baselineMedian}), though the longest block held at ${hm(longestMin.value)}.`
    );
  }
  const parts = [`The longest block was ${hm(longestMin.baselineMedian - longestMin.value)} shorter than his recent median`];
  if (moreWakes) parts.push(`and there were more wakes (${wakes.value} vs ${wakes.baselineMedian})`);
  return claim(SCOPE.NIGHT, nc, `${parts.join(' ')}.`);
}

/** Positive counterpart, so a record night is not narrated as a neutral one. */
export function consolidationClaim(nc) {
  const { longestMin } = nc;
  if (longestMin.percentile < 0.8) return null;
  const vsPrev = longestMin.vsPrevNight;
  const tail = vsPrev !== null && vsPrev > 20 ? `, ${hm(vsPrev)} longer than the night before` : '';
  return claim(
    SCOPE.NIGHT,
    nc,
    `His longest stretch was ${hm(longestMin.value)}${tail} — top ${Math.round((1 - longestMin.percentile) * 100)}% of the last ${nc.lookback} nights.`
  );
}

/** Efficiency. Reports the single night, then the baseline direction separately. */
export function efficiencyClaim(nc, bc) {
  const e = nc.efficiencyPct;
  const night = claim(
    SCOPE.NIGHT,
    nc,
    `Efficiency was ${e.value.toFixed(0)}% (typical ${e.baselineMedian.toFixed(0)}%) — the share of time between first sleep and morning wake that he was actually asleep.`
  );
  if (!bc) return [night];

  const d = bc.efficiencyPct.delta;
  if (Math.abs(d) < 1) return [night];
  const dir = d > 0 ? 'up' : 'down';
  return [
    night,
    claim(
      SCOPE.BASELINE,
      bc,
      `Across the last ${bc.recentN} nights efficiency is ${dir} ${Math.abs(d).toFixed(1)} points on the ${bc.priorN} before, so the extra sleep is not just extra time in bed.`
    ),
  ];
}

/** Baseline drift. Reads window data only. */
export function baselineDriftClaim(bc) {
  if (!bc) return null;
  const t = bc.totalMin.delta;
  if (Math.abs(t) < 10) return null;
  const bed = bc.bedtimeMin.delta;
  const wake = bc.wakeClockMin.delta;
  const dir = t > 0 ? 'longer' : 'shorter';
  return claim(
    SCOPE.BASELINE,
    bc,
    `His baseline is moving: night sleep over the last ${bc.recentN} nights runs about ${hm(t)} ${dir} than the ${bc.priorN} before, with bedtime ${hm(bed)} ${bed < 0 ? 'earlier' : 'later'} and the recorded morning wake ${hm(wake)} ${wake > 0 ? 'later' : 'earlier'}.`
  );
}

export function buildNarrative(nights, opts = {}) {
  const nc = nightCompare(nights, opts);
  const bc = baselineCompare(nights, opts);
  if (!nc) return [];
  return [
    baselineDriftClaim(bc),
    ...efficiencyClaim(nc, bc),
    consolidationClaim(nc),
    fragmentationClaim(nc),
  ].filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* Regression fixture — the night that broke the old version           */
/* ------------------------------------------------------------------ */

export function selfTest(nights) {
  const i = nights.findIndex((n) => n.night === '2026-08-26');
  if (i < 0) throw new Error('fixture night 2026-08-26 not present');
  const n = nights[i];
  const nc = nightCompare(nights, { index: i });

  const checks = [
    [Math.round(n.totalMin) === 612, `total ${Math.round(n.totalMin)} !== 612`],
    [Math.round(n.longestMin) === 337, `longest ${Math.round(n.longestMin)} !== 337`],
    [n.wakes === 2, `wakes ${n.wakes} !== 2`],
    [Math.round(n.efficiencyPct) === 97, `efficiency ${Math.round(n.efficiencyPct)} !== 97`],
    [nc.longestMin.vsPrevNight > 130, `longest vs prev night ${nc.longestMin.vsPrevNight} should be strongly positive`],
    [fragmentationClaim(nc) === null, 'fragmentation claim must not fire on a near-record consolidated night'],
    [consolidationClaim(nc) !== null, 'consolidation claim should fire'],
  ];
  const failures = checks.filter(([ok]) => !ok).map(([, msg]) => msg);
  if (failures.length) throw new Error(`selfTest failed:\n  ${failures.join('\n  ')}`);
  return true;
}
