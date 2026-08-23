# Understand Infant Sleep

A tool that answers one question about your baby's sleep: **is this normal for them?**

Tracker apps answer a different question. They tell you what changed since yesterday — "daytime sleep ↓46m," "longest sleep ↑3h10m" — which makes ordinary night-to-night variation look like a trend. Most of those arrows are noise. Infant sleep swings enormously from one night to the next, and a red arrow on a perfectly normal night is a bad thing to hand a sleep-deprived parent at 3am.

This tool builds a normal range out of **your own child's history** and shows you where last night landed inside it. No population averages, no age brackets, no comparison to other babies. Your baby's range is computed from your baby.

**Solving infant sleep is not predicting what a baby will do. It is managing what parents should know and expect.** That distinction is the whole point of this repo. [More on it below.](#the-mental-model)

**[Open the tool →](https://alicezheng-ai.github.io/understand-infant-sleep/)**

Everything runs in your browser. Nothing is uploaded, nothing is stored, and no server sees your data.

---

## How to use it

Export a CSV from whichever tracker you use, load it, and you get eight bars:

| | |
|---|---|
| Night sleep total | Usually the steadiest number |
| Longest block | The one that feels biggest and varies most |
| Night wakes | Times they surfaced after the longest block |
| Day sleep total | Depends heavily on assisted vs. independent naps |
| Naps | Count |
| Feeds | Sessions, not volume |
| Nursing minutes | Whatever your feed timer measures |
| Wet diapers | The most useful intake proxy between weigh-ins |

The band is the middle 80% of the last 21 nights. The thin line is the median. The dot is the most recent night. Blue means inside the range; warm colors mean outside it.

A screen that's mostly blue is a normal night, readable at a glance without parsing a single number.

It needs at least five complete nights to show anything, and ten before the ranges mean much. Below ten it labels itself as provisional.

## CSV format

Any export with these columns works:

```
Type, Start Date/time, [Sleep] End Date/time, [Sleep] Duration (Seconds),
[Breastfeed] Left Duration (Seconds), [Breastfeed] Right Duration (Seconds),
[Bottle Feed] ..., [Diaper] Type
```

Rows are matched on `Type` values of `Sleep`, `Breastfeed`, `Bottle Feed`, and `Diaper`. Everything else is ignored. Adapting to another schema means editing the column lookup in `build()`.

## How things are counted

A **night** is every sleep starting between 18:00 and 08:00, grouped under the date it began the evening on. **Day sleep** is every sleep starting between 06:00 and 18:00. The **anchor** is the longest single block of a night.

Your tracker uses different boundaries and its totals will not match these. Neither is wrong — they answer different questions. The definitions are printed at the bottom of the tool for exactly this reason: when the two disagree, that's the first place to look.


## Why there's no age or sex input

You never type in a birthday, and that's deliberate.

**The comparison never leaves your own data.** The tool builds its range from the last 21 nights in the file you load. A six-week-old's last 21 nights already *are* six-week-old data. Age is baked into the comparison, not missing from it. It would only need to be an input if the tool looked something up in an external table — and it never does.

**Age matters for how fast the baseline moves, not for what the baseline is.** Three weeks is real development at this age, so "inside the usual range" can quietly mean "inside the range from two weeks ago." That's a genuine problem, and the tool handles it by measuring drift directly: if the last 7 nights' median has moved 20+ minutes from the prior 14, it says so. Measuring the movement beats inferring it from age — two babies the same age going through different weeks will drift differently, and the data knows which is which.

**The window is short on purpose.** Twenty-one nights is long enough for a stable range and short enough that it tracks a moving child. Every upload recomputes it. The range is never older than the data.

Sex is a different question with a shorter answer: the sex-specific charts people are thinking of are growth charts. Differences in infant sleep architecture are small and not well established, so an input for it would change nothing in the output. An input that doesn't change an output is worse than no input, because it implies the tool knows something it doesn't.

**Where age would matter is exactly where this tool doesn't go** — telling you whether your baby's range is *healthy*. That requires population norms, and it belongs with your pediatrician.


## The mental model

**Solving infant sleep is not predicting what a baby will do. It is managing what parents should know and expect.**

I started this project trying to forecast my son's nights, and I got reasonably good at the statistics before noticing the forecasts were useless. Not merely inaccurate — inert. Ask what I would have done differently last night knowing his longest stretch would run 5.7 hours instead of 3.6. Nothing. Same feed, same bath, same transfer at fifteen minutes. The prediction had no lever attached to it.

That is the real disqualification, and it matters more than the hit rate. A weather forecast that was wrong as often as mine would still earn its keep, because "70% chance of rain" attaches to an umbrella. There is no umbrella here. Nothing about tonight's number changes what a parent does tonight.

The one forecast that ever paid off was the vaccination night, and it worked precisely because it wasn't about my son's endogenous variation. It was about an intervention I scheduled myself, with a known effect and three actions attached: clear the next day, expect the long stretch to collapse, and don't count those nights as trend data. Prediction earns its place when it concerns your own inputs. It doesn't when it concerns a baby's ordinary night-to-night noise.

Meanwhile the questions that actually changed my behavior were all backward-looking and interpretive:

- Is a short nap day a real drop, or did I just switch from contact naps to independent ones and start measuring a different thing?
- Was last week genuinely worse, or did I misremember which week was which?
- Is this weight gain concerning, or did I make an arithmetic error?
- Is the variance in *how much* he sleeps, or only in *when he wakes me*?

Every one had an answer. Every answer changed what I did or stopped doing. Not one required knowing anything about the coming night.

The last of those turned out to be the load-bearing finding. Over twenty nights my son's total night sleep varied by about 6%, while his longest single block varied by 17% and his day sleep by 21%. The volume was nearly constant; the architecture churned. And architecture is the part a parent feels, because it is the part that wakes you. So a week that feels like chaos can contain almost identical totals — the exhaustion is real, the alarm is not, and no amount of prediction would have told me that. A baseline did, in about four seconds.

That is what this tool tries to be. Not a forecast. A way to know what to expect and to tell signal from noise at 3am, so the computing has somewhere useful to go.

## What to expect from infant sleep

Most of the distress around infant sleep comes from expecting the wrong thing. A few facts that would have saved me weeks:

**The normal range is enormous.** A [meta-analysis of 34 studies](https://www.sciencedirect.com/science/article/abs/pii/S1087079210000936) puts average infant sleep at 12.8 hours per 24, with a normal range of **9.7 to 15.9 hours**. That band is six hours wide. The [AASM and AAP recommend](https://publications.aap.org/aapnews/news/6630/AAP-endorses-new-recommendations-on-sleep-times) 12–16 hours per 24 for infants 4–12 months. When you compute how far your baby is from "14 hours" every night, you are measuring distance from the midpoint of a very wide distribution, and the answer means much less than it feels like it does.

**They wake often because of how infant sleep is built, not because something is wrong.** An infant sleep cycle runs roughly 50 minutes against an adult's 90–110, and babies spend about half their sleep in active (REM) sleep rather than the quarter adults do. Shorter cycles and lighter sleep mean more frequent surfacing. This is normal architecture, not a defect, and it's why a 45-minute nap is a complete unit of sleep rather than a failed long one.

**Everyone wakes at night — the skill being learned is resettling.** Healthy children surface several times a night and often return to sleep without ever registering it. The developmental milestone is not "stops waking," it's "can get back down alone." Until that skill arrives, you are the mechanism, and there is nothing wrong with either of you.

**Consolidation arrives on its own schedule, and later than the internet implies.** The [largest changes happen in the first four months](https://pubmed.ncbi.nlm.nih.gov/20974775/); about half of infants can manage an 8-hour stretch by 3 months and most by 6. But [25–50% of 6-to-12-month-olds](https://onlinelibrary.wiley.com/doi/10.1002/pdi3.76) still wake in ways their parents find disruptive. A baby who isn't sleeping through at 4 months is not behind.

**A bad night usually has a boring explanation.** Vaccinations within the past week measurably shorten night sleep. So do illness, teething, travel, a new person doing bedtime, and a nap that ran late. When something changes, look at the week rather than the night.

**Averages describe populations, not your baby.** Your child has their own range, and it sits somewhere inside the wide normal band without necessarily sitting near the middle of it. That is the entire premise of this tool: the useful comparison is your baby last month, not a reference curve they were never going to trace.

## What this is not

This is a descriptive tool. It tells you what is usual for one child. It cannot tell you whether that is healthy, and it does not know anything about your child beyond the file you load.

Growth, feeding adequacy, and anything that worries you belong with your pediatrician. A number outside the range means "unusual for your baby," not "wrong."

---

## The model

The tool came out of a longer project: building a predictive model of one infant's sleep from tracker exports, making explicit forecasts, and auditing them against what actually happened.

That process produced more useful method than results, mostly because so much of it was wrong. Ten errors are logged; three were measurement artifacts read as biology, three were conclusions promoted on a single night, and one was a feature that shipped in this tool before a robustness check killed it.

- **[docs/METHOD.md](docs/METHOD.md)** — how the model is built and maintained: regime registers, error logs, prediction audits, and the rules that came out of getting things wrong
- **[docs/CASE-STUDY.md](docs/CASE-STUDY.md)** — the n=1 findings, what generalizes, and what doesn't

The single most useful finding, and the one this tool is built on: **night sleep total is far more stable than anything inside the night.** Across 20 nights, total varied with a CV of 6.3% while the longest block varied at 16.5% and day sleep at 21.2%. Parents feel the architecture — when they were woken — and almost never see the volume, which is the part that holds steady. Showing the stable quantity against its own range is most of what this tool does.


---

## Why I built this

Infant sleep can be described mathematically. It cannot be solved mathematically, and no amount of description does the work.

What the math can do is set expectations — tell you what your baby's nights actually look like, how much they vary, and whether last night was unusual or just Tuesday. What it cannot do is any of the work. The hard part is a person picking up a baby at 2am and settling them, over and over, because the baby cannot yet do it alone. No model shortens that. It gets shorter when the baby develops the skill, on a timeline you don't control.

So this tool is not going to fix anyone's sleep, and I'd distrust anything that claimed otherwise. What it can realistically do is two things. It reads the signal out of data that would otherwise just generate anxiety — most of what a tracker shows you is noise, and without a baseline you cannot tell which numbers deserve attention. And it gives an anxious parent something better to do with the computing than compute. That was the actual problem I was solving. My pediatrician's advice was to watch the broad trend, which was correct and which I could not follow by willpower. So I built the trend.

Most nights, the answer is that nothing is wrong. Being able to see that quickly is worth more than any prediction.

## How the model got built

Over about two weeks the model went through six versions and roughly twenty nights of forecasts. Each version made explicit predictions about the coming night — how long the first block would run, how many wakes, what the total would be — and the next morning's data settled them. Being wrong in writing is what moved it forward; the audit table is in [docs/CASE-STUDY.md](docs/CASE-STUDY.md) and it is not flattering.

Ten errors are logged. Three were changes in my own logging or handling that I read as changes in my son. Three were rules I promoted after a single striking night. One was a unit mistake that made a normal weight gain look concerning. One was an off-by-one in week numbering that made the analysis contradict something I had correctly observed myself. And one was a feature already shipped in this tool — a sleep-cycle estimate that looked significant until the analysis window moved and the number slid from 34 to 66 minutes. It was deleted.

The thing that survived all of it is small and turned out to be the useful part: **night sleep total barely moves, and everything inside the night moves a lot.** Parents feel the architecture, because that's what wakes us. We almost never see the volume, which is the part that holds steady. A week that feels like chaos can have near-constant totals.

That finding is the tool.

## License

MIT. See [LICENSE](LICENSE).
