// ---------------------------------------------------------------------------
// driftBlock — corrected.
//
// Two defects in the previous version:
//
//   1. It received `hist`, which is rec.slice(0,-1) — the current night is
//      removed before it ever arrives. So hist.slice(-7) was the seven nights
//      ENDING THE NIGHT BEFORE the one on the card, and every figure in the
//      paragraph described a week the reader was not looking at.
//
//   2. The fragmentation sentence read dAnch and dWakes, which are 7-vs-14
//      window means, and rendered them as a statement about one night ("the
//      night got more broken"). On 2026-08-26 that printed "45 min shorter"
//      over a night whose longest block was the 4th longest in 25 nights.
//
// The fix: `rec` now ends at the current night, and anything phrased as a
// claim about one night is computed from that night against the 21-night
// distribution — never from a window mean.
//
// CALL SITE, in render():   ${driftBlock(hist, last)}
// ---------------------------------------------------------------------------

// Below this, a shorter-anchor claim is inside the measure's own night-to-night
// swing. anch has a CV near 0.24, so it needs a wide gate.
const ANCH_MIN_GAP = 25;
// A night at or above this percentile of the trailing distribution gets the
// positive sentence instead of silence.
const CONSOLIDATED_PCTL = 0.80;

function driftBlock(hist, last){
  if(!last) throw new Error('driftBlock(hist, last): the current night is required');

  const rec = [...hist.slice(-6), last];   // 7 nights, INCLUDING tonight
  const old = hist.slice(-20, -6);          // the 14 before that
  if(old.length < 7 || rec.length < 7) return '';

  const mean = a => a.reduce((x,y)=>x+y,0)/a.length;
  const d = k => mean(rec.map(r=>r[k])) - mean(old.map(r=>r[k]));

  // ---- baseline scope: window means only -------------------------------
  const dTot=d('tot'), dWin=d('window'), dEff=d('eff'), dOn=d('onsetM'), dWake=d('wakeM');
  let drift = '';
  if(Math.abs(dTot) >= 20){
    const n = Math.abs(Math.round(dTot)), dir = dTot>0 ? 'longer' : 'shorter';
    let why;
    if(Math.abs(dEff) < 1.5){
      const ends=[];
      if(Math.abs(dOn)>=8) ends.push(`bedtime moved ${Math.abs(Math.round(dOn))} min ${dOn<0?'earlier':'later'}`);
      if(Math.abs(dWake)>=8) ends.push(`the recorded morning wake moved ${Math.abs(Math.round(dWake))} min ${dWake>0?'later':'earlier'}`);
      why = `<b>This is time in bed, not sleep.</b> Efficiency held at ${Math.round(mean(rec.map(r=>r.eff)))}%, so he is in bed ${Math.abs(Math.round(dWin))} min ${dWin>0?'longer':'shorter'}`
          + (ends.length ? `: ${ends.join(', and ')}.` : '.');
      if(dWake>=8 && dWake>=Math.abs(dOn))
        why += ` Most of the gain sits at the morning end, which is the end you can trust least — if he ever wakes quietly and plays before you notice, the recorded wake is only an upper bound.`;
    } else if(Math.abs(dWin) < 15){
      why = `<b>This one is real.</b> Time in bed barely moved, and efficiency went ${dEff>0?'up':'down'} ${Math.abs(dEff).toFixed(1)} points — he is sleeping ${dEff>0?'better':'worse'} in the same window.`;
    } else {
      why = `Time in bed moved ${Math.abs(Math.round(dWin))} min ${dWin>0?'longer':'shorter'} and efficiency moved ${dEff>0?'up':'down'} ${Math.abs(dEff).toFixed(1)} points, so it is part scheduling and part sleep.`;
    }
    drift = `His baseline is moving: night sleep over the last 7 nights runs about ${n} min ${dir} than the two weeks before. ${why}`;
  }

  // ---- night scope: tonight vs the 21-night distribution ----------------
  // Nothing in this block may read d(), rec or old.
  const anchHist = hist.map(r=>r.anch), wakeHist = hist.map(r=>r.wakes);
  const anchMed = med(anchHist), wakeMed = med(wakeHist);
  const pctl = anchHist.filter(v => v < last.anch).length / anchHist.length;
  const shortAnchor = last.anch < anchMed - ANCH_MIN_GAP;
  const extraWakes  = last.wakes > wakeMed;

  let arch = '';
  if(shortAnchor){
    arch = ` Last night's longest block was ${Math.round(anchMed-last.anch)} min shorter than usual (${hm(last.anch)} against ${hm(anchMed)})`
         + (extraWakes ? `, with more wakes than usual.` : `.`)
         + ` A rising total will not warn you about that, so watch the longest block on its own.`;
  } else if(extraWakes){
    // more wakes but the anchor held — the old code collapsed this into the
    // shorter-anchor sentence and reported a negative anchor delta anyway.
    arch = ` Last night had ${last.wakes} wakes against a usual ${wakeMed}, though the longest block held at ${hm(last.anch)}.`;
  } else if(pctl >= CONSOLIDATED_PCTL){
    arch = ` Last night's longest block was ${hm(last.anch)} — longer than ${Math.round(pctl*100)}% of the last ${anchHist.length} nights.`;
  }

  if(!drift && !arch) return '';
  return `<div class="drift">${drift}${arch} The range below blends both, so it lags a little behind where he is now.</div>`;
}
