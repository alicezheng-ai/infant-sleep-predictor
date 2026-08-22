# Case study: one infant, weeks 5–10

Findings from the project that produced this tool. A single infant, roughly 2,000 logged events across 70 days, analyzed in iterative passes with explicit forecasts and audits between them.

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

## What did not hold up

Ten logged errors. The full list is in the model document; these are the instructive ones.

**Three were measurement artifacts read as biology.** A logging-convention change produced an apparent 45% improvement in feeding efficiency. A parent-imposed nap cap produced an apparent fragmentation trend. Both were retracted after the regime register made the dates visible.

**Three were promoted on a single observation.** The compensation mechanism above. A feed-duration threshold set on the noisiest available metric using partial-day data. A "false start" bedtime indicator that turned out to be measuring transfer technique — three of four instances carried explicit notes that the transfer had failed, making it a record of parent handling rather than infant state.

**One was a unit error that inverted a clinical conclusion.** A weight-gain rate reported 16× too low, framed as running from the most recent weigh-in rather than to it. Corrected, the figure was normal-to-good rather than concerning.

**One was a finding that failed a robustness check after shipping.** A sleep-cycle length of 43 minutes, estimated by testing for clustering of bout durations near integer multiples of a candidate cycle. Significant, plausible for the age, and used to build a visualization and a piece of parenting advice. It moved to 34, 43, 55, or 66 minutes depending on which arbitrary window and search range were chosen. The feature was removed from the tool.

**One was an off-by-one in week numbering** that caused the analysis to contradict an accurate observation the parent had made. This is the worst category — not being wrong about the data, but overriding a correct human observation with a mislabeled axis.

---

## What generalizes

Very little of the above transfers to another baby. The specific numbers are one child's.

What does transfer:

1. **Compute the CV of everything before deciding what to model.** The stable/unstable split will differ by child but the ordering — totals stable, architecture noisy — is likely general, because it follows from sleep pressure being regulated while cycle-to-cycle transitions are not.

2. **Register every regime change.** Any project like this will have them, and they will be invisible until you write them down with dates.

3. **Test compensation rather than assuming it.** It is the most intuitive model of infant sleep and it was not present here.

4. **A night that feels alarming is usually inside the child's own range.** This was the single most repeated finding across the whole project, and it is the reason the tool exists.

---

## Note on scope

This is one child, observed by a parent, in a normal home, over ten weeks. There is no control, no blinding, no second observer, and the analyst was also the caregiver making the interventions.

Nothing here is clinical evidence. It is a worked example of applying measurement discipline to a personal dataset, and the most transferable output is the error log.
