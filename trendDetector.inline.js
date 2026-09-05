// ---------------------------------------------------------------------------
// trendDetector.inline.js — regime-change detection for the card.
//
// Paste this into the existing <script> block in index.html (anywhere above
// guidance()), or load it with a plain <script src> tag before that block.
// Everything lives inside TD, so it collides with nothing already defined —
// index.html already owns hm, clock, med, q and mean.
//
// It takes rec rows in their existing shape: {k, tot, anch, dayTot, wakes,
// onsetM}, minutes throughout. No adapter, no unit conversion at the call site.
//
// WHY THIS EXISTS
// guidance() has an unconditional fallthrough. When a metric leaves its band
// and the signed run is 1, the only sentence available is "probably just one
// night", so a developmental step is narrated as noise on every night it
// continues. A band comparison can only ask whether last night was unusual; it
// has no way to ask whether the distribution moved. This asks that first.
// ---------------------------------------------------------------------------
const TD = (function(){

  const RECENT = 7;
  const PRIOR = 14;
  const MIN_SD_GAP = 1.5;
  const MIN_COUNT = 4;
  const MIN_HISTORY = RECENT + PRIOR;

  // field -> [accessor from a rec row, sd floor in that field's units,
  //           rising label, falling label]
  const METRICS = {
    anch:   [r => r.anch,   30, 'consolidating',  'fragmenting'],
    tot:    [r => r.tot,    21, 'lengthening',    'shortening'],
    dayTot: [r => r.dayTot, 27, 'napping more',   'napping less'],
    wakes:  [r => r.wakes, 0.6, 'waking more',    'waking less'],
    // onsetM is minutes from midnight; an onset after midnight would otherwise
    // read as fourteen hours early rather than a few minutes late.
    onsetM: [r => (r.onsetM < 720 ? r.onsetM + 1440 : r.onsetM), 20,
             'settling later', 'settling earlier'],
  };

  const avg = a => a.reduce((s,v)=>s+v, 0) / a.length;
  const sdev = a => { const m = avg(a); return Math.sqrt(avg(a.map(v => (v-m)*(v-m)))); };
  const mins = m => Math.floor(m/60) + 'h' + String(Math.round(m%60)).padStart(2,'0') + 'm';
  const oclock = m => String(Math.floor(m/60) % 24).padStart(2,'0') + ':' + String(Math.round(m%60)).padStart(2,'0');

  function values(rows, upTo, key){
    const get = METRICS[key][0];
    return rows.slice(0, upTo+1).map(get).filter(Number.isFinite);
  }

  // Two conditions, and both are load-bearing. The sd gap alone fires on one
  // extreme night. The count alone fires on drift with no magnitude.
  function detect(rows, upTo, key){
    const v = values(rows, upTo, key);
    if(v.length < MIN_HISTORY) return null;

    const recent = v.slice(-RECENT), prior = v.slice(-(RECENT+PRIOR), -RECENT);
    const [, floor, rising, falling] = METRICS[key];
    const mu = avg(prior), sd = Math.max(sdev(prior), floor);
    const gap = (avg(recent) - mu) / sd;
    if(Math.abs(gap) < MIN_SD_GAP) return null;

    const up = gap > 0, bound = up ? mu + sd : mu - sd;
    const outside = recent.filter(x => up ? x > bound : x < bound).length;
    if(outside < MIN_COUNT) return null;

    return { metric:key, label: up ? rising : falling, direction: up ? 'up' : 'down',
             sdGap: gap, priorMean: mu, recentMean: avg(recent), outside };
  }

  // How long this has been running, so the card can hold a trend rather than
  // re-announce it nightly.
  function firstFired(rows, upTo, key){
    const now = detect(rows, upTo, key);
    if(!now) return upTo;
    let earliest = upTo;
    for(let i = upTo-1; i >= 0; i--){
      const past = detect(rows, i, key);
      if(!past || past.direction !== now.direction) break;
      earliest = i;
    }
    return earliest;
  }

  function detectAll(rows, upTo){
    const hits = [];
    for(const key of Object.keys(METRICS)){
      const hit = detect(rows, upTo, key);
      if(!hit) continue;
      const since = firstFired(rows, upTo, key);
      hit.since = rows[since].k;
      hit.nightsRunning = upTo - since + 1;
      hits.push(hit);
    }
    return hits.sort((a,b) => Math.abs(b.sdGap) - Math.abs(a.sdGap));
  }

  // Returns {head, body} so the caller can bold the lead the way the rest of
  // the guide block does.
  function narrate(t){
    const run = t.nightsRunning;
    const tail = run > 1 ? `Holding for ${run} nights now.` : 'First night this reads as a trend.';
    let head, body;
    switch(t.metric){
      case 'anch':
        head = t.direction === 'up' ? 'His longest stretch is consolidating.'
                                    : 'His longest stretch is breaking up.';
        body = `It has averaged ${mins(t.recentMean)} over the last ${RECENT} nights against `
             + `${mins(t.priorMean)} for the ${PRIOR} before, with ${t.outside} of ${RECENT} `
             + `nights outside the old range.`;
        break;
      case 'tot':
        head = t.direction === 'up' ? 'He is sleeping longer at night overall.'
                                    : 'Night sleep is trending down.';
        body = `${mins(t.recentMean)} on average over ${RECENT} nights against ${mins(t.priorMean)} before.`;
        break;
      case 'dayTot':
        head = t.direction === 'up' ? 'Day sleep is climbing.' : 'Day sleep is dropping off.';
        body = `${mins(t.recentMean)} a day over the last ${RECENT} against ${mins(t.priorMean)} before, `
             + `${t.outside} of ${RECENT} days outside the old range.`;
        break;
      case 'wakes':
        head = t.direction === 'up' ? 'He is waking more often.' : 'He is waking less often.';
        body = `${t.recentMean.toFixed(1)} wakes a night against ${t.priorMean.toFixed(1)} before.`;
        break;
      default:
        head = t.direction === 'up' ? 'Bedtime is drifting later.' : 'Bedtime is moving earlier.';
        body = `Onset now averages ${oclock(t.recentMean)} against ${oclock(t.priorMean)} before.`;
    }
    return { head, body: `${body} ${tail}` };
  }

  // The whole integration surface: hand it every complete night in order,
  // newest last, and it returns a paragraph or an empty string.
  function paragraph(rows){
    if(!Array.isArray(rows) || rows.length < MIN_HISTORY) return '';
    const hits = detectAll(rows, rows.length - 1);
    if(!hits.length) return '';
    return hits.map(h => {
      const {head, body} = narrate(h);
      return `<p><strong>${head}</strong> ${body}</p>`;
    }).join('');
  }

  return { paragraph, detect, detectAll, narrate, RECENT, PRIOR, MIN_SD_GAP, MIN_COUNT, METRICS };
})();
