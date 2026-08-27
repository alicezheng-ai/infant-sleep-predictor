// ---------------------------------------------------------------------------
// narrate.js — LLM surface realization over a deterministic fact sheet.
//
// Division of labour:
//   buildFacts()  decides what is true and which claims are licensed. Rules.
//   narrate()     decides how to say it. Model.
//   validate()    rejects any output that introduces a number or a claim the
//                 fact sheet did not license, and falls back to templates.
//
// The model never sees the CSV, never sees a raw series, and never chooses
// what is worth reporting. It receives a closed set of findings and writes
// them out. That keeps the audit trail: every sentence traces to a claim id,
// every number to a field.
// ---------------------------------------------------------------------------

const mean = a => a.reduce((x,y)=>x+y,0)/a.length;
const med  = a => { const s=[...a].sort((x,y)=>x-y), m=s.length>>1;
                    return s.length%2 ? s[m] : (s[m-1]+s[m])/2; };
const hm = m => Math.floor(m/60)+'h'+String(Math.round(m%60)).padStart(2,'0')+'m';

// ---------------------------------------------------------------------------
// 1. Fact sheet
// ---------------------------------------------------------------------------
// Each claim carries: an id, a scope, the fields it may cite, and a template.
// The template is the fallback AND the semantic contract — if the model's
// version does not say the same thing, the template is what ships.

export function buildFacts(hist, last){
  const rec = [...hist.slice(-6), last];
  const old = hist.slice(-20, -6);
  const claims = [];

  const night = {
    date: last.k,
    total_min: Math.round(last.tot),
    total_hm: hm(last.tot),
    longest_min: Math.round(last.anch),
    longest_hm: hm(last.anch),
    wakes: last.wakes,
    efficiency_pct: Math.round(last.eff),
    in_bed_hm: hm(last.window),
  };

  const anchHist = hist.map(r=>r.anch), wakeHist = hist.map(r=>r.wakes);
  const anchMed = med(anchHist), wakeMed = med(wakeHist);
  const pctl = anchHist.filter(v=>v<last.anch).length / anchHist.length;
  night.usual_longest_hm = hm(anchMed);
  night.usual_wakes = wakeMed;
  night.longest_percentile = Math.round(pctl*100);
  night.nights_compared = anchHist.length;

  if(last.anch < anchMed - 25){
    night.longest_deficit_min = Math.round(anchMed - last.anch);
    claims.push({ id:'short_anchor', scope:'night',
      fields:['longest_hm','usual_longest_hm','longest_deficit_min'],
      template:`Last night's longest block was ${night.longest_deficit_min} min shorter than usual (${night.longest_hm} against ${night.usual_longest_hm}). A rising total will not warn you about that, so watch the longest block on its own.` });
  } else if(last.wakes > wakeMed){
    claims.push({ id:'extra_wakes', scope:'night',
      fields:['wakes','usual_wakes','longest_hm'],
      template:`Last night had ${night.wakes} wakes against a usual ${night.usual_wakes}, though the longest block held at ${night.longest_hm}.` });
  } else if(pctl >= 0.80){
    claims.push({ id:'consolidated', scope:'night',
      fields:['longest_hm','longest_percentile','nights_compared'],
      template:`Last night's longest block was ${night.longest_hm} — longer than ${night.longest_percentile}% of the last ${night.nights_compared} nights.` });
  }

  let baseline = null;
  if(old.length >= 7){
    const d = k => mean(rec.map(r=>r[k])) - mean(old.map(r=>r[k]));
    const dTot=d('tot'), dWin=d('window'), dEff=d('eff'), dOn=d('onsetM'), dWake=d('wakeM');
    baseline = {
      recent_nights:7, prior_nights:old.length,
      total_delta_min: Math.round(dTot),
      in_bed_delta_min: Math.round(dWin),
      efficiency_delta_pts: +dEff.toFixed(1),
      bedtime_delta_min: Math.round(dOn),
      morning_wake_delta_min: Math.round(dWake),
      recent_efficiency_pct: Math.round(mean(rec.map(r=>r.eff))),
    };
    if(Math.abs(dTot) >= 20){
      claims.push({ id:'baseline_drift', scope:'baseline',
        fields:['total_delta_min','recent_nights','prior_nights'],
        template:`Night sleep over the last 7 nights runs about ${Math.abs(baseline.total_delta_min)} min ${dTot>0?'longer':'shorter'} than the two weeks before.` });
      if(Math.abs(dEff) < 1.5){
        claims.push({ id:'drift_is_schedule', scope:'baseline',
          fields:['recent_efficiency_pct','in_bed_delta_min','bedtime_delta_min','morning_wake_delta_min'],
          template:`Efficiency held at ${baseline.recent_efficiency_pct}%, so the gain is time in bed rather than better sleep — ${Math.abs(baseline.in_bed_delta_min)} min more in bed.` });
        if(dWake >= 8 && dWake >= Math.abs(dOn))
          claims.push({ id:'morning_end_caveat', scope:'baseline', fields:['morning_wake_delta_min'],
            template:`Most of the gain sits at the morning end, which is the least trustworthy — a baby who wakes quietly makes the recorded wake an upper bound.` });
      } else if(Math.abs(dWin) < 15){
        claims.push({ id:'drift_is_sleep', scope:'baseline',
          fields:['efficiency_delta_pts'],
          template:`Time in bed barely moved and efficiency went ${dEff>0?'up':'down'} ${Math.abs(baseline.efficiency_delta_pts)} points — he is sleeping ${dEff>0?'better':'worse'} in the same window.` });
      }
    }
  }

  return { night, baseline, claims };
}

// ---------------------------------------------------------------------------
// 2. Narration
// ---------------------------------------------------------------------------

const SYSTEM = `You render a fixed set of statistical findings about one baby's sleep into plain prose for that baby's parent.

Rules, in order of priority:
1. Say every licensed claim. Say nothing else. You may not add a finding, an inference, a cause, a reassurance, or advice.
2. Every number you write must appear verbatim in the facts JSON. Do not round, convert, recompute, or combine numbers.
3. A claim with scope "night" describes the single night named in facts.night. A claim with scope "baseline" describes a multi-night average. Never write a baseline finding in single-night grammar, and never write a night finding as a trend.
4. No diagnosis, no sleep-training suggestions, no developmental explanations, no "this is normal" reassurance.
5. Plain declarative prose. Two to four sentences total. No headings, no lists, no emoji, no second-person imperatives.

Return only the prose.`;

export async function narrate(facts, { fetchImpl = fetch, model = 'claude-sonnet-4-6' } = {}){
  if(!facts.claims.length) return '';
  const fallback = facts.claims.map(c => c.template).join(' ');
  try {
    const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ model, max_tokens: 1000, system: SYSTEM, messages:[
        { role:'user', content: JSON.stringify({
            night: facts.night,
            baseline: facts.baseline,
            licensed_claims: facts.claims.map(c => ({ id:c.id, scope:c.scope, cites:c.fields })),
          }, null, 2) }
      ]})
    });
    const data = await res.json();
    const text = data.content.filter(b=>b.type==='text').map(b=>b.text).join('').trim();
    return validate(text, facts) ? text : fallback;
  } catch {
    return fallback;   // offline, rate limited, malformed — ship the templates
  }
}

// ---------------------------------------------------------------------------
// 3. Validation
// ---------------------------------------------------------------------------
// The guard that matters is numeric. A model that invents a finding almost
// always has to invent a number to support it, so an allowlist of every value
// in the fact sheet catches most fabrication without any semantic parsing.

export function validate(text, facts){
  const allowed = new Set();
  const add = v => {
    if(typeof v === 'number'){ allowed.add(String(Math.abs(v))); allowed.add(String(Math.round(Math.abs(v)))); }
    else if(typeof v === 'string') for(const n of v.match(/\d+/g) || []) allowed.add(n);
  };
  for(const src of [facts.night, facts.baseline]) if(src) Object.values(src).forEach(add);
  // percentages and counts the prose may legitimately restate
  ['0','1','2','3','4','5','6','7','8','9','10','14','21'].forEach(n => allowed.add(n));

  for(const n of text.match(/\d+(?:\.\d+)?/g) || [])
    if(!allowed.has(n) && !allowed.has(String(Math.round(parseFloat(n))))) return false;

  // claim coverage: every licensed claim must leave a numeric trace
  for(const c of facts.claims){
    const marks = c.fields.flatMap(f => {
      const v = facts.night[f] ?? facts.baseline?.[f];
      return typeof v === 'string' ? (v.match(/\d+/g) || []) : [String(Math.abs(Math.round(v)))];
    });
    if(marks.length && !marks.some(m => text.includes(m))) return false;
  }

  // banned vocabulary — advice and diagnosis, regardless of what was licensed
  if(/\b(should|try|recommend|normal for babies|sleep train|teething|growth spurt|regression)\b/i.test(text)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// 4. Use
// ---------------------------------------------------------------------------
// Render templates first, then upgrade in place when the call returns, so the
// card is never blocked on the network.
//
//   const facts = buildFacts(hist, last);
//   el.innerHTML = facts.claims.map(c=>c.template).join(' ');
//   narrate(facts).then(t => { if(t) el.textContent = t; });
//
// Cache by night key — the fact sheet only changes when a new night closes.

const cache = new Map();
export async function narrateCached(facts){
  const key = JSON.stringify([facts.night.date, facts.claims.map(c=>c.id)]);
  if(!cache.has(key)) cache.set(key, await narrate(facts));
  return cache.get(key);
}
