# Wiring the detector into index.html

Four edits. Every `old` string below appears exactly once in the current file.

## 0. Load the detector

Paste the whole of `trendDetector.inline.js` into the existing `<script>` block,
anywhere above `function guidance(...)` — directly under `const BUILD = ...` is
fine. It defines one name, `TD`, and collides with nothing already in the file.

If you'd rather keep it as a separate file, a plain `<script src="trendDetector.inline.js"></script>`
before the inline block works too, including over `file://`, since it isn't a module.
That costs you the single-file property the README claims, which is why pasting is
the better default.

Bump the build string while you're there:

```js
const BUILD = 'trend-detector';
```

## 1. `build()` — return every usable night, not just the trailing 21

`hist` is capped at 21 and has the current night removed, so it cannot support a
7-vs-14 comparison that includes tonight, and `firstFired` can't walk back far
enough to say how long a trend has been running. The vaccine nights stay excluded.

```js
// old
  return {last, hist};

// new
  return {last, hist, all: rec.filter(r=>!EX.includes(r.k))};
```

## 2. `render()` — pass it through

```js
// old
  const {last,hist}=d, num=v=>String(Math.round(v)), pctf=v=>Math.round(v)+'%';

// new
  const {last,hist,all}=d, num=v=>String(Math.round(v)), pctf=v=>Math.round(v)+'%';
```

```js
// old
  + guidance(last, hist, H, F, hm, cv, sizeOK)

// new
  + guidance(last, hist, H, F, hm, cv, sizeOK, all)
```

## 3. `guidance()` — ask about the distribution before judging the night

```js
// old
function guidance(last, hist, H, F, hm, cv, sizeOK){
  const FEED=['feeds','feedMin'];

// new
function guidance(last, hist, H, F, hm, cv, sizeOK, all){
  // A band comparison can only ask whether last night was unusual. This asks
  // whether the distribution moved, which is the question the single-night
  // fallthrough below cannot reach.
  const trendPara = TD.paragraph(all || []);
  const FEED=['feeds','feedMin'];
```

Replace the single-night branch so it demotes itself when a trend is running.
The wording for the no-trend case is unchanged.

```js
// old
    if(f.st.run<=1){
      body=`<p><strong>Probably just one ${U.one}.</strong> ${cap(f.label)} came in ${f.dir} range, after sitting inside it ${U.prior}. A single ${U.one} swings a lot at this age and rarely means much alone. Worth a second look ${U.next} rather than a change ${U.now}.</p>`;
    } else if((cv[f.k]||0.2) > CV_CEILING){

// new
    if(f.st.run<=1 && trendPara){
      body=`<p>${cap(f.label)} also came in ${f.dir} range for a single ${U.one}. Next to the trend above, that on its own rarely means much.</p>`;
    } else if(f.st.run<=1){
      body=`<p><strong>Probably just one ${U.one}.</strong> ${cap(f.label)} came in ${f.dir} range, after sitting inside it ${U.prior}. A single ${U.one} swings a lot at this age and rarely means much alone. Worth a second look ${U.next} rather than a change ${U.now}.</p>`;
    } else if((cv[f.k]||0.2) > CV_CEILING){
```

Then put the trend first. This sits after the flags block and before the regime
notes, so the withheld-measure paragraphs and the pediatrician escalation are
untouched and still ship regardless of what the detector says.

```js
// old
  // Say plainly when a measure has been withheld, so its silence is not read as
  // a clean result.

// new
  body = trendPara + body;

  // Say plainly when a measure has been withheld, so its silence is not read as
  // a clean result.
```

## What it prints

Run against `export_narababy_jujube_20260904.csv`, using the file's own
chain-based night definition rather than a clock window:

> **His longest stretch is consolidating.** It has averaged 6h08m over the last 7
> nights against 4h12m for the 14 before, with 5 of 7 nights outside the old
> range. Holding for 3 nights now.

Backtested over the 52 eligible nights in that export, it fires on 12 (23%) in
three episodes: 07-20 through 07-23, 08-05 through 08-09, and 09-01 onward. It
returns an empty string below 21 nights of history, so nothing changes for a
short file.

## Also worth knowing

`narrate.js` and `driftBlock.patch.js` are not referenced anywhere in
`index.html`. The page has one inline `<script>` and no imports, so the LLM
narration path never runs and the copy on the card comes entirely from
`guidance()` and the inline `driftBlock()`. If you intend to ship the narration
path, `buildFacts()` needs a `consolidating` claim added to its claim list, or
the model will never be licensed to say it.
