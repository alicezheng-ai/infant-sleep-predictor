# Infant Sleep Predictor

A tool that answers one question about your baby's sleep: **is this normal for them?**

Tracker apps answer a different question. They tell you what changed since yesterday — "daytime sleep ↓46m," "longest sleep ↑3h10m" — which makes ordinary night-to-night variation look like a trend. Most of those arrows are noise. Infant sleep swings enormously from one night to the next, and a red arrow on a perfectly normal night is a bad thing to hand a sleep-deprived parent at 3am.

This tool builds a normal range out of **your own child's history** and shows you where last night landed inside it. No population averages, no age brackets, no comparison to other babies. Your baby's range is computed from your baby.

I built it because I couldn't stop computing, and it turned out that most nights the answer was that nothing was wrong. [Why I built this →](#why-i-built-this)

**[Open the tool →](https://YOUR-USERNAME.github.io/infant-sleep-predictor/)**

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

My pediatrician's advice was to focus on feeding and diapers and to treat sleep as largely outside a parent's control. He's right about what's measurable and what warrants a call, and he's right that babies aren't trying to fit the AAP curve — they sleep in wildly different patterns from one day to the next and almost all of it is normal. I still don't think that makes sleep not worth attention. What parents can control is the environment: whether the room is dark, whether the transfer works, whether the day ran on assisted naps or independent ones. You can't make a baby sleep. You can build the conditions where enough sleep is possible, and then find out whether it worked.

The other reason is that I couldn't stop computing. Postpartum anxiety had me running the same arithmetic every night — how far is he from fourteen hours, was that nap an anomaly, was last night actually bad or did it only feel bad because I was awake for it. Knowing I was overthinking never slowed it down. I was always afraid I'd miss something.

What I needed was to follow him and watch the broad trend, which is good advice I could not follow by willpower. So I built the trend instead. Watching it now takes one upload rather than a night of arithmetic, and the comparison is my own son rather than a curve he was never going to fit.

That is the design goal. Not more insight. Fewer false alarms.

## How the model got built

Over about two weeks the model went through six versions and roughly twenty nights of forecasts. Each version made explicit predictions about the coming night — how long the first block would run, how many wakes, what the total would be — and the next morning's data settled them. Being wrong in writing is what moved it forward; the audit table is in [docs/CASE-STUDY.md](docs/CASE-STUDY.md) and it is not flattering.

Ten errors are logged. Three were changes in my own logging or handling that I read as changes in my son. Three were rules I promoted after a single striking night. One was a unit mistake that made a normal weight gain look concerning. One was an off-by-one in week numbering that made the analysis contradict something I had correctly observed myself. And one was a feature already shipped in this tool — a sleep-cycle estimate that looked significant until the analysis window moved and the number slid from 34 to 66 minutes. It was deleted.

The thing that survived all of it is small and turned out to be the useful part: **night sleep total barely moves, and everything inside the night moves a lot.** Parents feel the architecture, because that's what wakes us. We almost never see the volume, which is the part that holds steady. A week that feels like chaos can have near-constant totals.

That finding is the tool.

## License

MIT. See [LICENSE](LICENSE).
