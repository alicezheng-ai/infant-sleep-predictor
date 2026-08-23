// normality.js — band construction, streak detection, and metric selection.
//
// Fixes three defects:
//   B1  streak counter tested |outside band| while the window counter tested
//       "below band", and the rendered direction came from tonight only.
//       Effect: an above-band night (Aug 21, 5h44m) was reported as part of a
//       "below range" run.
//   B2  band = mean ± 1sd flags ~32% of nights by construction; a 2-night
//       streak then fires ~10% of nights on a stable baseline.
//   B3  "longest block moves least" was hardcoded. It is the noisiest sleep
//       quantity in this dataset (CV 19.6% vs 6.3% for night total).

const MIN_BASELINE_NIGHTS = 14;
const STREAK_MIN = 3;          // was 2
const CV_NARRATIVE_CEILING = 0.12;  // above this, describe but never claim a pattern

// ---------------------------------------------------------------- band

// Percentile band. Robust to the vaccine/illness outliers that inflate sd at
// both tails (Aug 14 = 3h02m, Aug 15 = 5h48m) and pull the mean±1sd edges in.
function percentile(sorted, p) {
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

function buildBand(values) {
  if (values.length < MIN_BASELINE_NIGHTS) return null;   // no band, no verdict
  const s = [...values].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const sd = Math.sqrt(s.reduce((a, v) => a + (v - mean) ** 2, 0) / (s.length - 1));
  return { lo: percentile(s, 0.10), hi: percentile(s, 0.90), mean, sd, cv: sd / mean, n: s.length };
}

// ------------------------------------------------------- one predicate

// -1 below band, 0 inside, +1 above. Every downstream count uses this and
// nothing else. This is the fix for B1.
function classify(value, band) {
  if (!band) return 0;
  if (value < band.lo) return -1;
  if (value > band.hi) return 1;
  return 0;
}

// Consecutive nights ending tonight that share tonight's direction.
// A sign flip terminates the run — it does not extend it.
function signedStreak(series, band) {
  const dir = classify(series[series.length - 1], band);
  if (dir === 0) return { dir: 0, length: 0 };
  let n = 0;
  for (let i = series.length - 1; i >= 0; i--) {
    if (classify(series[i], band) !== dir) break;
    n++;
  }
  return { dir, length: n };
}

// Same direction, counted over the trailing window.
function countInWindow(series, band, dir, windowSize = 7) {
  return series.slice(-windowSize).filter(v => classify(v, band) === dir).length;
}

// ------------------------------------------------- baseline eligibility

// D6: vaccine and illness nights are excluded from the baseline and never
// generate a verdict of their own. A night is eligible only if it is complete:
// an anchor onset after 19:00 and a logged final wake must both be present.
function eligible(night) {
  return night.complete && !night.excluded;
}

// --------------------------------------------------- metric selection

// B3: rank by measured CV, lowest first. Never hardcode.
function pickHeadlineMetric(metrics) {
  return metrics
    .filter(m => m.band)
    .sort((a, b) => a.band.cv - b.band.cv)[0];
}

// ------------------------------------------------------------ verdict

function verdict(metric, series) {
  const band = metric.band;
  const tonight = series[series.length - 1];
  const { dir, length } = signedStreak(series, band);

  if (dir === 0) return { level: "normal", dir: 0, streak: 0 };

  const word = dir < 0 ? "below" : "above";
  const inWindow = countInWindow(series, band, dir);

  // A high-CV metric can report its value and direction but must not assert a
  // pattern or offer a causal menu. This is the gate that would have silenced
  // the Aug 22 card: longest block, CV 0.196.
  if (band.cv > CV_NARRATIVE_CEILING) {
    return {
      level: "noted",
      dir, streak: length, inWindow, word, tonight,
      copy: `${fmt(tonight)} is ${word} the usual range. This measure varies `
          + `${Math.round(band.cv * 100)}% night to night, so a single reading `
          + `carries little information.`
    };
  }

  if (length < STREAK_MIN) {
    return {
      level: "noted", dir, streak: length, inWindow, word, tonight,
      copy: `${fmt(tonight)} is ${word} the usual range. One night.`
    };
  }

  return {
    level: "pattern", dir, streak: length, inWindow, word, tonight,
    copy: `${length} nights running ${word} the usual range (${inWindow} of the `
        + `last 7). Worth thinking about what changed around when it started: `
        + `illness, teeth, a new routine, a different person doing naps, travel.`
  };
}

function fmt(min) {
  return `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, "0")}m`;
}

export { buildBand, classify, signedStreak, countInWindow, eligible,
         pickHeadlineMetric, verdict, fmt };
