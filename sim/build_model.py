#!/usr/bin/env python3
"""
Build the scan model from REAL text.

`export_data.py` emits a hand-estimated model: good enough to build and rehearse
against, not good enough to report. This replaces every number in it with counts
measured from a corpus, using one procedure that works on any Brahmic script
rather than rules hand-written for Malayalam.

    python3 sim/build_model.py corpus.txt
    python3 sim/build_model.py corpus.txt --out app/data --min-count 3
    cat *.txt | python3 sim/build_model.py -

What it emits (same shape as export_data.py, so the app needs no changes):

    units.json    inventory with classes, derived from Unicode codepoints
    bigrams.json  P(unit | class of previous unit), measured
    legal.json    transitions actually observed above --min-count
    words.json    word frequency list, for prediction
    meta.json     provenance: corpus size, date, settings

Three things it does that matter:

  * Legality is LEARNED, not authored. "After a virama only a consonant may
    follow" is not written down anywhere here — it falls out of the counts.
    That is what lets the same code run on Kannada or Bengali without anyone
    who can read those scripts.

  * A frequency floor separates "never happens" from "happens rarely". Without
    it one typo in a million words would make an illegal transition look legal.

  * It reports what it threw away, so a silently truncated corpus cannot be
    mistaken for a clean one.
"""
import argparse
import json
import pathlib
import sys
import unicodedata
from collections import Counter, defaultdict
from datetime import date

# ── Unicode-derived classes ────────────────────────────────────────────────
# Ranges, not a hand-written list, so the same procedure transfers to other
# Brahmic scripts by changing only the block offset.
MALAYALAM = {
    "V":   [(0x0D05, 0x0D14)],              # independent vowels
    "C":   [(0x0D15, 0x0D3A)],              # consonants
    "S":   [(0x0D3E, 0x0D4C), (0x0D57, 0x0D57)],   # dependent vowel signs
    "VIR": [(0x0D4D, 0x0D4D)],              # virama / chandrakkala
    "ANU": [(0x0D02, 0x0D03)],              # anusvara, visarga
    "CH":  [(0x0D7A, 0x0D7F)],              # chillu letters
    # Digits. Without these an age, a time, a phone number or a quantity cannot
    # be typed at all — a real hole for an AAC device, and one the corpus was
    # silently papering over by dropping them.
    "NUM": [(0x0030, 0x0039),               # 0-9, what Malayalam text mostly uses
            (0x0D66, 0x0D6F)],              # ൦-൯, the Malayalam digits
}
PUNCT = " .,?!\n\t"
SKIP = {0x200C, 0x200D}      # ZWNJ / ZWJ: rendering hints, not units


def class_of(ch):
    cp = ord(ch)
    for cls, ranges in MALAYALAM.items():
        for lo, hi in ranges:
            if lo <= cp <= hi:
                return cls
    if ch in PUNCT:
        return "SP"
    return None


# A dependent mark cannot begin a word. A token that starts with one is a
# fragment -- markup or a line break split it -- not Malayalam.
DEPENDENT = {"S", "VIR", "ANU", "CH"}


def units_of(text):
    """Text -> (unit char, class) stream. Unknown characters are dropped and
    counted, so a corpus in the wrong script is obvious rather than silent.

    Fragment tokens are dropped too, and this matters more than it sounds. In
    Malayalam Wikipedia, SP->CH appears 57 times from split tokens while the
    one genuinely rare transition it resembles, VIR->CH (as in ഗെയ്ൽ, "Gail"),
    appears 3 times. Noise outnumbers signal 19:1, so a frequency floor cannot
    tell them apart -- only a structural rule can."""
    out, dropped, fragments = [], Counter(), 0
    for token in unicodedata.normalize("NFC", text).split():
        units = []
        for ch in token:
            if ord(ch) in SKIP:
                continue
            cls = class_of(ch)
            if cls is None:
                dropped[ch] += 1
                continue
            units.append((ch, cls))
        if not units:
            continue
        if units[0][1] in DEPENDENT:        # a fragment, not a word
            fragments += 1
            continue
        out.extend(units)
        out.append((" ", "SP"))
    return out, dropped, fragments


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("corpus", help="UTF-8 text file, or - for stdin")
    ap.add_argument("--out", default="app/data", help="output directory")
    ap.add_argument("--min-count", type=int, default=3,
                    help="a transition below this is treated as never observed "
                         "(default 3; separates impossible from merely rare)")
    ap.add_argument("--max-words", type=int, default=4000)
    args = ap.parse_args()

    raw = sys.stdin.read() if args.corpus == "-" \
        else pathlib.Path(args.corpus).read_text(encoding="utf-8")

    stream, dropped, fragments = units_of(raw)
    if len(stream) < 1000:
        sys.exit(f"corpus too small: {len(stream)} units. "
                 "Numbers from this would be noise, not measurement.")

    # ── counts ─────────────────────────────────────────────────────────────
    uni = Counter(u for u, _ in stream)
    cls_of = {u: c for u, c in stream}
    trans = defaultdict(Counter)                 # prev class -> next unit
    prev_cls = "SP"
    for u, c in stream:
        trans[prev_cls][u] += 1
        prev_cls = c

    # words, for prediction
    words = Counter()
    for w in "".join(u for u, _ in stream).split(" "):
        w = w.strip()
        if len(w) > 1:
            words[w] += 1

    # ── inventory ──────────────────────────────────────────────────────────
    # Reuse the readable ids from export_data.py (ka, v_aa, s_i, x_vir ...) so
    # the two models are interchangeable and the tests, which name units, keep
    # working. Anything the hand model does not cover falls back to codepoint.
    ids, chars = {}, {}
    known = {}
    try:
        sys.path.insert(0, str(pathlib.Path(__file__).parent))
        import export_data as ed
        known = {ch: uid for uid, ch in
                 [(u["id"], u["char"]) for u in ed.UNITS]}
    except Exception as e:                       # standalone use is still fine
        print(f"note: readable ids unavailable ({e}); using codepoint ids")

    for u in sorted(uni):
        uid = "p_sp" if u == " " else known.get(u) or f"u{ord(u):04X}"
        ids[u] = uid
        chars[uid] = u
    units = [{"id": ids[u], "char": u, "class": cls_of[u]} for u in sorted(uni)]
    units += [{"id": "ctl_undo", "char": "⌫", "class": "CTL"},
              {"id": "ctl_clear", "char": "✕", "class": "CTL"},
              {"id": "ctl_pause", "char": "⏸", "class": "CTL"}]

    CONTROL_MASS = {"ctl_undo": 0.060, "ctl_clear": 0.003}

    legal, bigrams = {}, {}
    for ctx in sorted(trans):
        kept = {u: n for u, n in trans[ctx].items() if n >= args.min_count}
        if not kept:
            continue
        total = sum(kept.values())
        row = {ids[u]: n / total for u, n in kept.items()}
        # scale measured mass down to leave room for the controls
        spare = sum(CONTROL_MASS.values())
        row = {k: v * (1 - spare) for k, v in row.items()}
        row.update(CONTROL_MASS)
        z = sum(row.values())
        bigrams[ctx] = {k: round(v / z, 8) for k, v in row.items()}
        legal[ctx] = sorted(bigrams[ctx])

    for ctx in list(legal):               # controls lead back to a fresh start
        pass
    if "CTL" not in legal and "SP" in legal:
        legal["CTL"], bigrams["CTL"] = legal["SP"], bigrams["SP"]

    grid_order = [u["id"] for u in units]

    out = pathlib.Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    files = {
        "units.json": units,
        "bigrams.json": bigrams,
        "legal.json": legal,
        "gridA.json": {"cols": 10, "order": grid_order},
        "words.json": [w for w, _ in words.most_common(args.max_words)],
        "meta.json": {
            "source": f"measured from {args.corpus}",
            "provisional": False,
            "built": date.today().isoformat(),
            "units_counted": len(stream),
            "distinct_units": len(uni),
            "words_counted": sum(words.values()),
            "min_count": args.min_count,
            "fragments_dropped": fragments,
            "contexts": sorted(legal),
        },
    }
    for name, obj in files.items():
        (out / name).write_text(json.dumps(obj, ensure_ascii=False, indent=1),
                                encoding="utf-8")

    # ── report ─────────────────────────────────────────────────────────────
    print(f"corpus      {len(stream):,} units, {sum(words.values()):,} words")
    print(f"inventory   {len(uni)} distinct units + 3 controls")
    print(f"vocabulary  {len(words):,} distinct words "
          f"({min(len(words), args.max_words):,} kept)")
    print()
    print("legal-set sizes (learned, not authored):")
    full = len(units)
    for ctx in sorted(legal):
        n = len(legal[ctx])
        print(f"  {ctx:4s} {n:3d} of {full}  ({100*n/full:4.0f}%)")
    mean = sum(len(v) for v in legal.values()) / len(legal)
    print(f"  mean {mean:.1f} of {full} ({100*mean/full:.0f}%)")
    print()
    # A small corpus makes legal sets look tight for the wrong reason: most
    # transitions simply never appeared. Saying so is the difference between a
    # measurement and an artefact.
    expected = len(uni) ** 2
    if len(stream) < expected * 20:
        print(f"WARNING: {len(stream):,} units for {len(uni)} distinct units. "
              f"Legal sets are probably tight because transitions were unseen,")
        print(f"  not because they are impossible. Want roughly "
              f"{expected * 20:,}+ units before trusting legality.")
        print()

    if fragments:
        print(f"dropped {fragments:,} fragment tokens beginning with a dependent "
              f"mark (split by markup, not real words)")
        print()

    if dropped:
        shown = ", ".join(f"{c!r}×{n}" for c, n in dropped.most_common(6))
        print(f"dropped {sum(dropped.values()):,} characters outside the script: {shown}")
        if sum(dropped.values()) > len(stream) * 0.2:
            print("  WARNING: over 20% dropped — is this corpus really Malayalam?")
    print(f"\nwrote {len(files)} files to {out}/")
    print("the app needs no changes: same shape as export_data.py")


if __name__ == "__main__":
    main()
