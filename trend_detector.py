"""
Trend detector for the "Is this normal for your baby?" card.

Sits on top of night_reference.assemble_nights(). The shipped card compares one
night against a pooled band and, when nothing crosses it, falls through to
"probably just one night". That fallthrough is unconditional, so a regime change
can never surface. This module runs first and, when a trend is active, replaces
the single-night verdict with a statement about the trend.

Detection rule per metric:
    - trailing RECENT nights vs the PRIOR nights before them
    - fire when |mean gap| >= MIN_SD_GAP * sd(prior)  AND
      at least MIN_COUNT of the recent nights fall outside the prior band
    - sd floored at SD_FLOOR[metric] so a freakishly stable stretch cannot
      make a trivial shift look enormous
    - incomplete nights excluded from both windows

Both conditions matter. The sd gap alone fires on a single extreme night; the
count alone fires on a slow drift with no magnitude.
"""

import datetime as dt
import statistics as stats

import night_reference as nr

RECENT = 7
PRIOR = 14
MIN_SD_GAP = 1.5
MIN_COUNT = 4
MIN_HISTORY = RECENT + PRIOR

# metric -> (accessor, unit, sd floor in metric units, rising label, falling label)
METRICS = {
    "longest_h": (lambda n: n["longest_h"], "h", 0.50,
                  "consolidating", "fragmenting"),
    "total_h": (lambda n: n["total_h"], "h", 0.35,
                "lengthening", "shortening"),
    "blocks": (lambda n: float(n["blocks"]), "blocks", 0.60,
               "waking more", "waking less"),
    "onset_min": (lambda n: (n["onset"] - n["onset"].replace(
        hour=18, minute=0, second=0)).total_seconds() / 60, "min", 20.0,
        "settling later", "settling earlier"),
}


def series(nights, target, metric):
    keys = [d for d in sorted(nights) if d <= target and nights[d]["complete"]]
    values = [METRICS[metric][0](nights[d]) for d in keys]
    return keys, values


def detect(nights, target, metric):
    keys, values = series(nights, target, metric)
    if len(values) < MIN_HISTORY:
        return None

    recent = values[-RECENT:]
    prior = values[-(RECENT + PRIOR):-RECENT]
    _, unit, sd_floor, rising, falling = METRICS[metric]

    mu = stats.mean(prior)
    sd = max(stats.pstdev(prior), sd_floor)
    gap = (stats.mean(recent) - mu) / sd
    if abs(gap) < MIN_SD_GAP:
        return None

    bound = mu + sd if gap > 0 else mu - sd
    outside = sum(1 for v in recent if (v > bound if gap > 0 else v < bound))
    if outside < MIN_COUNT:
        return None

    return {
        "metric": metric,
        "label": rising if gap > 0 else falling,
        "direction": "up" if gap > 0 else "down",
        "sd_gap": gap,
        "prior_mean": mu,
        "recent_mean": stats.mean(recent),
        "prior_bound": bound,
        "outside": outside,
        "unit": unit,
    }


def first_fired(nights, target, metric):
    """Walk back to the first night this trend fired, so the card can say how
    long it has been running instead of re-announcing it nightly."""
    keys = [d for d in sorted(nights) if d <= target and nights[d]["complete"]]
    current = detect(nights, target, metric)
    if not current:
        return None
    earliest = target
    for d in reversed(keys[:-1]):
        past = detect(nights, d, metric)
        if not past or past["direction"] != current["direction"]:
            break
        earliest = d
    return earliest


def detect_all(nights, target):
    found = []
    for metric in METRICS:
        hit = detect(nights, target, metric)
        if hit:
            hit["since"] = first_fired(nights, target, metric)
            hit["nights_running"] = (target - hit["since"]).days + 1
            found.append(hit)
    found.sort(key=lambda h: -abs(h["sd_gap"]))
    return found


def fmt(value, unit):
    if unit == "h":
        return nr.hm(value)
    if unit == "min":
        base = dt.datetime(2000, 1, 1, 18, 0) + dt.timedelta(minutes=value)
        return base.strftime("%H:%M")
    return f"{value:.1f}"


def narrate(trend, nights, target):
    m, unit = trend["metric"], trend["unit"]
    prior, recent = fmt(trend["prior_mean"], unit), fmt(trend["recent_mean"], unit)
    run = trend["nights_running"]
    tail = (f"Holding for {run} nights now." if run > 1 else "First night this reads as a trend.")

    if m == "longest_h":
        head = ("His longest stretch is consolidating." if trend["direction"] == "up"
                else "His longest stretch is breaking up.")
        body = (f"It has averaged {recent} over the last {RECENT} nights against "
                f"{prior} for the {PRIOR} before, with {trend['outside']} of {RECENT} "
                f"nights outside the old range.")
    elif m == "total_h":
        head = ("He is sleeping longer at night overall." if trend["direction"] == "up"
                else "Night sleep is trending down.")
        body = f"{recent} on average over {RECENT} nights against {prior} before."
    elif m == "blocks":
        head = ("He is waking more often." if trend["direction"] == "up"
                else "He is waking less often.")
        body = (f"{trend['recent_mean']:.1f} blocks a night against "
                f"{trend['prior_mean']:.1f} before.")
    else:
        head = ("Bedtime is drifting later." if trend["direction"] == "up"
                else "Bedtime is moving earlier.")
        body = f"Onset now averages {recent} against {prior} before."

    return f"{head} {body} {tail}"


def verdict(nights, target):
    """Trend first; single-night framing only when nothing is running."""
    night = nights[target]
    if not night["complete"]:
        return "incomplete", "Open sleep record with no bounding event. No number reported."

    trends = detect_all(nights, target)
    if trends:
        lead = narrate(trends[0], nights, target)
        rest = [narrate(t, nights, target) for t in trends[1:]]
        return "trend", " ".join([lead] + rest)

    base = nr.evaluate(nights, target)
    if base["total_where"] == "inside" and base["longest_where"] == "inside":
        return "in range", "Inside his usual range on both total and longest block."
    return "single night", ("Outside range on "
                            + ", ".join(k for k, v in
                                        (("total", base["total_where"]),
                                         ("longest block", base["longest_where"]))
                                        if v != "inside")
                            + ". No trend behind it yet, so worth a second look tomorrow "
                              "rather than a change tonight.")


if __name__ == "__main__":
    import sys
    path = sys.argv[1]
    nights = nr.assemble_nights(nr.close_open_sleeps(nr.load_events(path)))
    keys = [d for d in sorted(nights) if nights[d]["complete"]]

    if "--backtest" in sys.argv:
        print("firing history (every night with enough history):\n")
        for d in keys[MIN_HISTORY:]:
            kind, text = verdict(nights, d)
            if kind == "trend":
                print(f"{d}  {text}")
        print("\nfiring rate:")
        fires = sum(1 for d in keys[MIN_HISTORY:] if verdict(nights, d)[0] == "trend")
        n = len(keys) - MIN_HISTORY
        print(f"  {fires} of {n} nights ({100 * fires / n:.0f}%)")
    else:
        target = keys[-1]
        kind, text = verdict(nights, target)
        print(f"night of {target} -> {kind}\n{text}")
