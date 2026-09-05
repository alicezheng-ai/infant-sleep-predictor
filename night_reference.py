"""
Reference night-assembly for Nara Baby CSV exports.
Golden fixture for the "Is this normal for your baby?" card.

Fixes over the shipped version:
  1. Open sleep rows (empty end timestamp) are closed against the next logged
     event of any type and flagged imputed=True, instead of being dropped.
     Validated on 2026-09-03: imputed 02:57, actual 02:55 (2 min error).
  2. Nights with an unresolvable open row are marked incomplete: no headline
     number, no verdict, and excluded from every rolling baseline.
  3. Efficiency is undefined for single-block nights (denominator == numerator
     by construction, which forces 100% and reads as "above range").
  4. Longest block is scored against a short trailing window, not the pooled
     21-night mean, because it re-bases faster than total sleep does.
"""

import csv
import datetime as dt
import statistics as stats
from collections import defaultdict

FMT = "%Y-%m-%d %H:%M:%S"
NIGHT_START_HOUR = 19          # onset at/after this hour opens a night
NIGHT_END_HOUR = 7             # onset before this hour still belongs to prior night
MAX_IMPUTED_BLOCK = dt.timedelta(hours=14)
BASELINE_NIGHTS = 21
RECENT_NIGHTS = 7


def load_events(path):
    events = []
    with open(path, newline="") as fh:
        for row in csv.DictReader(fh):
            start = row["Start Date/time"]
            if not start:
                continue
            events.append({
                "type": row["Type"],
                "start": dt.datetime.strptime(start, FMT),
                "end": (dt.datetime.strptime(row["[Sleep] End Date/time"], FMT)
                        if row["[Sleep] End Date/time"] else None),
            })
    events.sort(key=lambda e: e["start"])
    return events


def close_open_sleeps(events):
    """Bound every open sleep row by the next logged event of any type."""
    blocks = []
    for i, ev in enumerate(events):
        if ev["type"] != "Sleep":
            continue
        if ev["end"]:
            blocks.append({"start": ev["start"], "end": ev["end"], "imputed": False})
            continue
        nxt = next((e["start"] for e in events[i + 1:] if e["start"] > ev["start"]), None)
        if nxt is None or nxt - ev["start"] > MAX_IMPUTED_BLOCK:
            blocks.append({"start": ev["start"], "end": None, "imputed": False})
        else:
            blocks.append({"start": ev["start"], "end": nxt, "imputed": True})
    return blocks


def night_key(start):
    if start.hour >= NIGHT_START_HOUR:
        return start.date()
    if start.hour < NIGHT_END_HOUR:
        return start.date() - dt.timedelta(days=1)
    return None


def assemble_nights(blocks):
    grouped = defaultdict(list)
    for b in blocks:
        key = night_key(b["start"])
        if key:
            grouped[key].append(b)

    nights = {}
    for key, bs in grouped.items():
        bs.sort(key=lambda b: b["start"])
        if any(b["end"] is None for b in bs):
            nights[key] = {"date": key, "complete": False}
            continue
        durations = [(b["end"] - b["start"]).total_seconds() / 3600 for b in bs]
        window = (bs[-1]["end"] - bs[0]["start"]).total_seconds() / 3600
        nights[key] = {
            "date": key,
            "complete": True,
            "imputed": any(b["imputed"] for b in bs),
            "blocks": len(bs),
            "total_h": sum(durations),
            "longest_h": max(durations),
            "onset": bs[0]["start"],
            "wake": bs[-1]["end"],
            "efficiency": None if len(bs) < 2 else sum(durations) / window,
        }
    return nights


def band(values, k=1.0):
    if len(values) < 3:
        return None
    mu, sd = stats.mean(values), stats.pstdev(values)
    return mu - k * sd, mu + k * sd


def evaluate(nights, target):
    night = nights[target]
    if not night["complete"]:
        return {"verdict": "incomplete",
                "detail": "Open sleep record with no bounding event. No number reported."}

    history = [nights[d] for d in sorted(nights) if d < target and nights[d]["complete"]]
    baseline = history[-BASELINE_NIGHTS:]
    recent = history[-RECENT_NIGHTS:]

    total_band = band([n["total_h"] for n in baseline])
    # longest block is scored against the recent window only
    longest_band = band([n["longest_h"] for n in recent])

    def place(value, bounds):
        if bounds is None:
            return "unknown"
        lo, hi = bounds
        return "below" if value < lo else "above" if value > hi else "inside"

    return {
        "verdict": "complete",
        "total_h": night["total_h"],
        "total_band": total_band,
        "total_where": place(night["total_h"], total_band),
        "longest_h": night["longest_h"],
        "longest_band": longest_band,
        "longest_where": place(night["longest_h"], longest_band),
        "longest_trend_min": 60 * (stats.mean([n["longest_h"] for n in recent])
                                   - stats.mean([n["longest_h"] for n in baseline])),
        "imputed": night["imputed"],
    }


def hm(hours):
    return f"{int(hours)}h{round((hours % 1) * 60):02d}m"


if __name__ == "__main__":
    import sys
    path = sys.argv[1]
    nights = assemble_nights(close_open_sleeps(load_events(path)))
    keys = sorted(k for k in nights if nights[k]["complete"])

    print(f"{'night':<12}{'blk':>4}{'total':>8}{'longest':>9}{'eff':>7}  onset  wake   imputed")
    for k in keys[-BASELINE_NIGHTS - 1:]:
        n = nights[k]
        eff = f"{100 * n['efficiency']:.1f}%" if n["efficiency"] else "  n/a"
        print(f"{str(k):<12}{n['blocks']:>4}{hm(n['total_h']):>8}{hm(n['longest_h']):>9}"
              f"{eff:>7}  {n['onset']:%H:%M}  {n['wake']:%H:%M}   {n['imputed']}")

    target = keys[-1]
    r = evaluate(nights, target)
    print(f"\nverdict for {target}")
    print(f"  total    {hm(r['total_h'])}  {r['total_where']}  "
          f"band {hm(r['total_band'][0])}-{hm(r['total_band'][1])}")
    print(f"  longest  {hm(r['longest_h'])}  {r['longest_where']}  "
          f"band {hm(r['longest_band'][0])}-{hm(r['longest_band'][1])}")
    print(f"  longest-block trend vs {BASELINE_NIGHTS}-night pool: "
          f"{r['longest_trend_min']:+.0f} min")
