/* trendDetector.js — regime-change detection for the night card.
 *
 * Port of trend_detector.py. Same rule, same constants, same output.
 *
 * The card's fallthrough is unconditional: when nothing crosses a band it has
 * to say something, and "probably just one night" is the only thing left. That
 * means a developmental step gets narrated as noise every night it continues.
 * Call verdict() before the fallthrough and use its text when kind === 'trend'.
 *
 * Input: nights sorted ascending, each
 *   { date: 'YYYY-MM-DD', complete: bool, totalH, longestH, daySleepH,
 *     blocks: int, onsetMin: minutes after 18:00 }
 */

export const RECENT = 7;
export const PRIOR = 14;
export const MIN_SD_GAP = 1.5;
export const MIN_COUNT = 4;
const MIN_HISTORY = RECENT + PRIOR;

// key -> [sd floor in metric units, rising label, falling label]
export const METRICS = {
  longestH:  [0.50, 'consolidating',  'fragmenting'],
  totalH:    [0.35, 'lengthening',    'shortening'],
  daySleepH: [0.45, 'napping more',   'napping less'],
  blocks:    [0.60, 'waking more',    'waking less'],
  onsetMin:  [20.0, 'settling later', 'settling earlier'],
};

const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
const pstdev = a => {
  const m = mean(a);
  return Math.sqrt(mean(a.map(v => (v - m) ** 2)));
};

function history(nights, targetIndex, key) {
  return nights
    .slice(0, targetIndex + 1)
    .filter(n => n.complete && Number.isFinite(n[key]))
    .map(n => n[key]);
}

export function detect(nights, targetIndex, key) {
  const values = history(nights, targetIndex, key);
  if (values.length < MIN_HISTORY) return null;

  const recent = values.slice(-RECENT);
  const prior = values.slice(-(RECENT + PRIOR), -RECENT);
  const [sdFloor, rising, falling] = METRICS[key];

  const mu = mean(prior);
  const sd = Math.max(pstdev(prior), sdFloor);
  const sdGap = (mean(recent) - mu) / sd;
  if (Math.abs(sdGap) < MIN_SD_GAP) return null;

  const up = sdGap > 0;
  const bound = up ? mu + sd : mu - sd;
  const outside = recent.filter(v => (up ? v > bound : v < bound)).length;
  if (outside < MIN_COUNT) return null;

  return {
    metric: key,
    label: up ? rising : falling,
    direction: up ? 'up' : 'down',
    sdGap,
    priorMean: mu,
    recentMean: mean(recent),
    outside,
  };
}

/* Walk back to the first night this trend fired, so the card can say how long
 * it has been running instead of re-announcing it every night. */
export function firstFired(nights, targetIndex, key) {
  const current = detect(nights, targetIndex, key);
  if (!current) return targetIndex;
  let earliest = targetIndex;
  for (let i = targetIndex - 1; i >= 0; i--) {
    if (!nights[i].complete) continue;
    const past = detect(nights, i, key);
    if (!past || past.direction !== current.direction) break;
    earliest = i;
  }
  return earliest;
}

export function detectAll(nights, targetIndex) {
  const hits = [];
  for (const key of Object.keys(METRICS)) {
    const hit = detect(nights, targetIndex, key);
    if (!hit) continue;
    const since = firstFired(nights, targetIndex, key);
    hit.since = nights[since].date;
    hit.nightsRunning =
      Math.round(
        (Date.parse(nights[targetIndex].date) - Date.parse(hit.since)) / 864e5
      ) + 1;
    hits.push(hit);
  }
  hits.sort((a, b) => Math.abs(b.sdGap) - Math.abs(a.sdGap));
  return hits;
}

const hm = h => `${Math.floor(h)}h${String(Math.round((h % 1) * 60)).padStart(2, '0')}m`;
const clock = m => {
  const t = 18 * 60 + m;
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(Math.round(t % 60)).padStart(2, '0')}`;
};

export function narrate(t) {
  const run = t.nightsRunning;
  const tail = run > 1
    ? `Holding for ${run} nights now.`
    : 'First night this reads as a trend.';

  let head, body;
  switch (t.metric) {
    case 'longestH':
      head = t.direction === 'up'
        ? 'His longest stretch is consolidating.'
        : 'His longest stretch is breaking up.';
      body = `It has averaged ${hm(t.recentMean)} over the last ${RECENT} nights against `
           + `${hm(t.priorMean)} for the ${PRIOR} before, with ${t.outside} of ${RECENT} `
           + 'nights outside the old range.';
      break;
    case 'totalH':
      head = t.direction === 'up'
        ? 'He is sleeping longer at night overall.'
        : 'Night sleep is trending down.';
      body = `${hm(t.recentMean)} on average over ${RECENT} nights against ${hm(t.priorMean)} before.`;
      break;
    case 'daySleepH':
      head = t.direction === 'up'
        ? 'Day sleep is climbing.'
        : 'Day sleep is dropping off.';
      body = `${hm(t.recentMean)} a day over the last ${RECENT} against ${hm(t.priorMean)} before, `
           + `${t.outside} of ${RECENT} days outside the old range.`;
      break;
    case 'blocks':
      head = t.direction === 'up' ? 'He is waking more often.' : 'He is waking less often.';
      body = `${t.recentMean.toFixed(1)} blocks a night against ${t.priorMean.toFixed(1)} before.`;
      break;
    default:
      head = t.direction === 'up' ? 'Bedtime is drifting later.' : 'Bedtime is moving earlier.';
      body = `Onset now averages ${clock(t.recentMean)} against ${clock(t.priorMean)} before.`;
  }
  return `${head} ${body} ${tail}`;
}

/* Ranks which metric to lead with when no trend is running.
 * Not by raw variability — the noisiest series is the one where a single day
 * outside its band means least. Rank by how far the value sits from its own
 * band in units of that metric's own spread. */
export function rankByExcursion(nights, targetIndex) {
  const night = nights[targetIndex];
  return Object.keys(METRICS)
    .map(key => {
      const values = history(nights, targetIndex - 1, key);
      if (values.length < 5 || !Number.isFinite(night[key])) return null;
      const window = values.slice(-21);
      const sd = Math.max(pstdev(window), METRICS[key][0]);
      return { metric: key, z: (night[key] - mean(window)) / sd };
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
}

export function verdict(nights, targetIndex) {
  const night = nights[targetIndex];
  if (!night.complete) {
    return { kind: 'incomplete', text: 'Open sleep record with no bounding event. No number reported.' };
  }

  const trends = detectAll(nights, targetIndex);
  if (trends.length) {
    return { kind: 'trend', text: trends.map(narrate).join(' '), trends };
  }

  const ranked = rankByExcursion(nights, targetIndex);
  const lead = ranked[0];
  if (!lead || Math.abs(lead.z) < 1) {
    return { kind: 'in range', text: 'Inside his usual range on everything that matters.' };
  }
  return {
    kind: 'single night',
    text: 'Probably just one night. No trend behind it yet, so worth a second look tomorrow '
        + 'rather than a change tonight.',
    ranked,
  };
}
