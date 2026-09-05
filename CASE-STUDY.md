# Case study: one infant, weeks 5–12

Findings from the project that produced this tool. A single infant, roughly 2,500 logged events across 84 days, analyzed in iterative passes with explicit forecasts and audits between them. The original passes covered weeks 5–10; weeks 11–12 were added later and are reported separately at the end, because they function as an out-of-sample check on everything above them.

Everything here is n=1. Identifying details have been removed. Read the numbers as an illustration of method, not as norms — the whole argument of this project is that population norms are the wrong comparison for an individual baby.

---

## What held up

### Night sleep total is the tightest invariant

Across 20 non-vaccine nights:

| Quantity | Mean | SD | CV |
|---|---|---|---|
| Night sleep total | 9.3 h | 35 min | **6.3%** |
| 24h sleep total | 13.8 h | 56 min | 6.8% |
| Longest night block | 4.4 h | 44 min | 16.5% |
| Longest post-anchor block | 2.9 h | 33 min | 18.8% |
| Day sleep total | 4.6 h | 59 min | 21.2% |

Night volume is more stable than the 24-hour figure. The internal structure — when he woke, how many blocks, how long the first one ran — churned freely underneath a nearly constant total.

This has a direct consequence for how parents experience sleep. You feel the architecture, because that is what wakes you. You never see the volume unless you add it up. So a week that feels wildly inconsistent can have near-constant totals, and the felt chaos is real but is not about how much the baby slept.

One illustrative week: longest blocks of 348, 209, 288, 236, 276, 216 minutes (CV 20.1%) against night totals of 629, 588, 542, 568, 573, 596 (CV 5.1%).

### There is no day/night compensation

The intuitive model — a short nap day is repaid at night, a long night is repaid with shorter naps — did not survive testing. Across 25 night-day pairs:

- night total → next-day nap sleep: **r = 0.10, p = 0.63**
- prior-day nap sleep → night total: **r = 0.27, p = 0.20**

Neither direction significant, and the second runs weakly *opposite* to the compensation prediction.

The practical advice is unchanged from what a compensation model would give — don't chase the deficit — but the reasoning matters. There is no debt being repaid. The night is stable on its own.

### Vaccination response is measurable and worth baselining

The 2-month vaccinations produced a clearly identifiable disruption: the longest block collapsed from a ~4.5h baseline to 182 minutes across 7 fragments, with fever peaking at 101.2°F about 34 hours post-injection, resolving without medication.

This is the most legitimately predictive finding in the project. It was forecast in advance and confirmed, and it gives a personal baseline for the next round. Those days should be excluded from every trend calculation.

### Assisted naps and independent naps are different measurements

When naps were taken via contact, stroller, or carrier, they ran 60+ minutes. On the first day of consistently transferring to a bassinet, every nap came in at 25–46 minutes and the daily total dropped by about an hour.

The baby did not sleep less that day in any meaningful sense. Contact naps bridge transitions the infant cannot yet bridge alone, so their duration measures the caregiver's intervention as much as the child's sleep. Pooling the two produces a phantom decline.

This is the regime problem in its clearest form, and it caught the analysis twice in opposite directions.

---

## The error log

Eleven errors are logged. This is the list, and it is the most transferable output of the project.

**Measurement artifacts read as biology (4)**

1. A logging-convention change produced an apparent 45% improvement in feeding efficiency. Retracted once the regime register made the dates visible.
2. A parent-imposed nap cap produced an apparent fragmentation trend. Same mechanism, same fix.
3. A "false start" bedtime indicator that turned out to be measuring transfer technique — three of four instances carried explicit notes that the transfer had failed, making it a record of parent handling rather than infant state.
4. An unclosed sleep row was dropped rather than bounded, reporting a 9h40m night as 3h22m and inverting the direction of a trend. Detailed below, because it is the only one caught after shipping into the tool's own output.

**Promoted on a single observation (3)**

5. The compensation mechanism — assumed, then tested, then abandoned.
6. A feed-duration threshold set on the noisiest available metric using partial-day data.
7. A bedtime rule promoted after one striking night and unsupported by the following week.

**Arithmetic and indexing (2)**

8. A weight-gain rate reported 16× too low, framed as running from the most recent weigh-in rather than to it. Corrected, the figure was normal-to-good rather than concerning. This is the one that inverted a clinical conclusion.
9. An off-by-one in week numbering that caused the analysis to contradict an accurate observation the parent had made. This is the worst category — not being wrong about the data, but overriding a correct human observation with a mislabeled axis.

**Failed a robustness check after shipping (1)**

10. A sleep-cycle length of 43 minutes, estimated by testing for clustering of bout durations near integer multiples of a candidate cycle. Significant, plausible for the age, and used to build a visualization and a piece of parenting advice. It moved to 34, 43, 55, or 66 minutes depending on which arbitrary window and search range were chosen. The feature was removed from the tool.

<!-- TODO: eleventh entry — write up the remaining logged error from the model
     document so this list is complete. Counts in README.md assume eleven. -->

### Error 4 in detail: an unclosed sleep row invented a downward trend

The tracker wrote a sleep row with a start time and no end time, because the timer was never stopped. The parser drops rows without an end timestamp, so the night collapsed to the single closed block that followed and was reported as 3h22m against a usual range of 8h42m–10h12m. When the row was later closed in the app it read 6h18m. The real night was 9h40m across two blocks with one 13-minute wake — comfortably inside range on every metric.

Every downstream claim inherited the defect, and one of them inverted:

- Efficiency computed to 100%, because a night reduced to one block contains no intervening wake time and the denominator equals the numerator by construction. That 100% read as above range and produced a verdict of "probably just one night." The tool was reassuring the parent on the strength of an arithmetic impossibility.
- The drift check came out at −47 minutes with the broken night included and +6 minutes with it bounded. There was no downward trend. The rule in force required only that the trailing median move 20 minutes, which one corrupted night clears without help.
- The direction was backwards, not merely the magnitude. The longest block over those 7 nights averaged 6h08m against 4h05m for the 14 before, with 5 of 7 nights outside the old band and a gap of 2.05 standard deviations. He was consolidating. The tool reported deterioration on the night it should have named the consolidation.

Two of the tells were printed on the card. A 3h22m night with 100% efficiency and a single block is not a sleep pattern, it is a parsing outcome, and an in-bed window matching the sleep total exactly should read as a structural impossibility rather than an unusually good night. Only 2 of 2,474 rows in the export carry this defect, which is why it went unnoticed for weeks and why it landed on the most recent night — the one the card is about.

Rules that came out of it: an open row is a data state and gets closed against the next logged event of any type, flagged as imputed; where no bounding event exists inside a plausible ceiling the night is marked incomplete and excluded from every rolling baseline; efficiency is undefined for a single-block night; and a near-constant metric never leads the verdict, because efficiency sits between 93% and 98% on almost every night here and has close to no discriminative power.

---

## Weeks 11–12: an out-of-sample check

The findings above were fixed before these nights were recorded, which makes them a genuine test rather than a re-fit.

**The stability finding replicates and the gap widens.** Over the most recent 21 nights, night sleep total ran a CV of 4.9% against 29.6% for the longest block and 19.0% for day sleep. Both the ordering and the magnitude of the split held. The longest-block figure is inflated relative to the original 16.5% for a reason worth stating rather than smoothing: a regime change sits inside the window. Variance measured across a boundary is not noise, and reading it as noise is how the original nap-cap error happened.

**The regime change is the consolidation.** The longest block moved from a 4h05m mean over one fortnight to 6h08m over the following week, with 5 of 7 nights outside the prior band and a gap of 2.05 standard deviations. This is the first developmental step in the project detected prospectively by a rule rather than noticed in hindsight. The rule needed five nights to name it, and publishing that latency matters more than the detection: the trend was visible to a parent before it was visible to the detector, and loosening the threshold to catch it earlier triples the false-positive rate without recovering any of those nights.

**A near-miss worth logging as method.** Re-testing the compensation question on the full 84 days produced r = −0.37 between night total and next-day nap sleep, which looks like evidence for compensation running in the opposite direction and would have been a publishable-sounding reversal. It is developmental drift. Across successive fortnights, day sleep fell from 5.78h to 4.36h while night sleep rose from 7.61h to 9.43h, so any long-span correlation between them is dominated by age. Restricted to a 21-night window the correlation is −0.09, and on first differences it is +0.07. The original finding stands: there is no compensation. The trap is that widening the window looks like strengthening the analysis, and here it manufactured a result.

---

## What generalizes

Very little of the above transfers to another baby. The specific numbers are one child's.

What does transfer:

1. **Compute the CV of everything before deciding what to model.** The stable/unstable split will differ by child but the ordering — totals stable, architecture noisy — is likely general, because it follows from sleep pressure being regulated while cycle-to-cycle transitions are not.

2. **Register every regime change.** Any project like this will have them, and they will be invisible until you write them down with dates.

3. **Test compensation rather than assuming it.** It is the most intuitive model of infant sleep and it was not present here.

4. **Put a completeness check upstream of every statistic.** Four of the eleven errors are the same shape — the data changed, the child didn't, and nothing in the pipeline could tell those apart. The failure is never bad statistics. It is a clean number computed over a record that was already wrong.

5. **Widening the window is not the same as strengthening the analysis.** Over a developing subject, a longer span imports drift, and drift is indistinguishable from mechanism unless you difference it out or hold the window fixed.

6. **A night that feels alarming is usually inside the child's own range.** This was the single most repeated finding across the whole project, and it is the reason the tool exists.

---

## Note on scope

This is one child, observed by a parent, in a normal home, over twelve weeks. There is no control, no blinding, no second observer, and the analyst was also the caregiver making the interventions.

Nothing here is clinical evidence. It is a worked example of applying measurement discipline to a personal dataset, and the most transferable output is the error log.
