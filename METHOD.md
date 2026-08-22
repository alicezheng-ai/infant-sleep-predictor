# Method

How to build a model of one infant's sleep from tracker exports without fooling yourself.

Most of this document exists because of specific mistakes. The rules below are not principles derived in advance — each one is scar tissue from a conclusion that had to be retracted.

---

## 1. The core problem: the instrument keeps changing

An infant sleep log is not a recording of a baby. It is a recording of a baby *and* the parent watching, the caregiver on duty that afternoon, whether the nap happened in a crib or a car seat, and how the app's timer is being used that week.

When any of those change, every metric downstream steps. Read that step as biology and you will confidently describe a developmental trend that is actually a change in your own behavior.

Three of the ten errors in the case study are exactly this. It is the dominant failure mode and nothing else comes close.

**The fix is a regime register.** Maintain a numbered list of every point where the measurement changed, with dates:

```
R2 — Contact-nap protocol. 2026-08-03 → 08-07. Parent capped day naps at 45-60 min.
     Effect: nap durations truncated. CLOSED by withdrawal — median returned to
     baseline when the protocol lifted.

R3 — Feed timer convention changed. 2026-08-06 → present. Timer now stops when
     swallowing ceases, not at unlatch. Effect: step function in all feed durations.
     Do not compare across this date.
```

Before computing any statistic, check which regimes its window spans. A metric that crosses a regime boundary is not one metric.

This applies to the tool too. Its feed-metric ranges are built from a shorter window than its sleep ranges, because logging habits drift and feed durations are the most sensitive to it.

## 2. Forecast the low-variance quantities

Compute the coefficient of variation for everything before deciding what to predict. In the case study:

| Quantity | CV |
|---|---|
| Night sleep total | 6.3% |
| 24h sleep total | 6.8% |
| Longest night block | 16.5% |
| Longest post-anchor block | 18.8% |
| Day sleep total | 21.2% |

Predicting the anchor was hopeless and predicting the total was easy, and no amount of cleverness changes that ordering. Ten forecasts of night architecture produced three hits; the misses were not fixable with better reasoning.

Above roughly 15% CV, give a wide interval or decline to predict. Saying "I can't forecast this" is a result.

## 3. Check autocorrelation before calling something a trend

If tonight carries no information about tomorrow night, then a run of good nights is not momentum and a run of bad ones is not decline.

For the case study's anchor length, lag-1 autocorrelation was +0.26, and the standard deviation of the night-to-night *change* (61 min) exceeded the standard deviation of the series itself (51 min). That is noise around a stable attractor, not a trajectory. It also means more data will not improve prediction, because there is no hidden state to recover.

This is worth doing early. It tells you whether the thing you are modeling is forecastable at all.

## 4. Audit every prediction in writing, before making new ones

Keep a table: what was predicted, what interval, what happened, verdict. Do it before issuing the next forecast.

Without this, a model drifts into confirmation — you remember the hits. The case study's audit table is uncomfortable reading and that is the point. It also surfaces a failure mode raw accuracy hides: several predictions were mis-*centered* rather than merely wrong, because a quantity was derived through a budget identity instead of modeled directly.

## 5. n=1 is a hypothesis, not a rule

Three retracted claims were promoted on a single observation. The pattern is always the same: something striking happens, an explanation suggests itself, and it becomes a rule before anything tests it.

The specific case worth naming is a proposed conservation mechanism — a short nap day "buying" a longer night. It was promoted to the model's primary actionable result on the strength of one rebound. Tested across 25 night-day pairs: night → next-day nap sleep r=0.10 (p=0.63), prior-day naps → night r=0.27 (p=0.20). Neither direction significant.

The invariant survived. The mechanism did not. Night sleep is stable because it is low-variance, not because it compensates for anything — and that distinction changes the advice completely.

## 6. Never threshold on a high-variance metric

One retracted rule was "if the first morning feed runs under 4 minutes, feeding becomes the primary concern." Per-session feed duration had the highest CV of any feed metric (23.5%). The threshold was guaranteed to fire on noise.

Worse, it was set using partial-day data that showed a false low total. The day closed inside its normal range.

Before writing a decision rule, check the CV of the quantity it triggers on, and confirm the day is complete.

## 7. State the interval, and check the units

The worst error in the log was not about the baby at all. A weight-gain rate was computed correctly in lb/day, written as oz/day, and reported as running *from* the most recent measurement rather than *to* it. The result understated growth 16-fold and inverted the conclusion from normal to concerning.

It survived because it was stated in a form nobody could check. "0.69 oz/day since [date]" contains no interval and no raw values.

**Every derived rate carries explicit endpoints and is verified against the raw numbers.** Never express a rate as running from the latest measurement — that is extrapolation past your data.

## 8. Check whether a finding survives an arbitrary choice

The last error, and the one that killed a shipped feature.

A sleep-cycle length of 43 minutes was estimated by testing whether bout durations cluster near integer multiples of a candidate cycle (Rayleigh test on the phase of `duration mod C`). It was statistically significant, matched the published range for the age, and was used to build a visualization and a piece of parenting advice.

Then the window moved:

| Data window | Best-fit cycle |
|---|---|
| All data | 55.3 min |
| From Jul 1 | 55.3 min |
| From Jul 15 | 43.0 min |
| From Aug 1 | 34.0 min |

Widening the search range from 34–62 to 34–66 minutes moved it to 65.8. The estimate was an artifact of two arbitrary choices, and the significance test could not detect that because it only asked whether the fit was better than chance *given* those choices.

**Before a finding becomes a feature, vary every arbitrary parameter and confirm it holds.** Statistical significance does not survive this check on its own.

## 9. Missing data is not absent events

A logged final wake time is an upper bound. Once a baby can wake quietly and self-entertain, the parent notices later than it happened, and this gets worse as the child gets more capable.

Same for unlogged naps in a car seat or in a grandparent's arms. A day-sleep total from a log is a floor, not a measurement, and comparing a well-observed day to a poorly-observed one produces a phantom decline.

## 10. Operating rules, condensed

1. Update the model document; don't rebuild it.
2. Audit prior predictions explicitly before issuing new ones.
3. Separate observation from hypothesis. Label confidence on everything.
4. A rule promoted on n=1 is a hypothesis.
5. Missing data ≠ absent event.
6. Prefer the child's own history over age-based averages.
7. Never analyze a partial day as if it were complete.
8. Every derived rate carries explicit interval endpoints and verified units.
9. Forecast low-CV quantities; decline above ~15%.
10. Vary the arbitrary parameters before trusting a result.

---

## On tone, for anyone building something similar

A model of your own child's sleep is not a neutral object. It gets read at 3am by someone exhausted, and it will be believed more than it deserves.

That is an argument for stating uncertainty plainly, for retracting loudly when something breaks, and for preferring "this is normal for your baby" over any claim about what a baby should be doing. The most useful output of this entire project was not a prediction. It was the repeated finding that a night which felt alarming was, measured against the child's own history, completely ordinary.
