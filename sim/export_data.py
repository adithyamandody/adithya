#!/usr/bin/env python3
"""
Export the Malayalam unit inventory, context model, legality sets and the
baseline grid to app/data/*.json for the PWA to consume.

IMPORTANT — these frequencies and transitions are HAND-ESTIMATED from the
structure of the script. They exist so the app can be built and rehearsed
before the corpus work lands. Phase 3 of BUILD.md replaces them with values
measured from real text, and every number reported anywhere must come from
that measured version, not this one.

    python3 sim/export_data.py
"""
import json
import pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent / "app" / "data"

# ----------------------------------------------------------------------------
# Inventory.  id -> (char, class)
# classes: V vowel · C consonant · S vowel-sign · VIR virama · ANU anusvara
#          CH chillu · SP space/punct · CTL control
# ----------------------------------------------------------------------------
VOWELS = [
    ("v_a", "അ"), ("v_aa", "ആ"), ("v_i", "ഇ"), ("v_ii", "ഈ"),
    ("v_u", "ഉ"), ("v_uu", "ഊ"), ("v_ri", "ഋ"), ("v_e", "എ"),
    ("v_ee", "ഏ"), ("v_ai", "ഐ"), ("v_o", "ഒ"), ("v_oo", "ഓ"), ("v_au", "ഔ"),
]
CONSONANTS = [
    ("ka", "ക"), ("kha", "ഖ"), ("ga", "ഗ"), ("gha", "ഘ"), ("nga", "ങ"),
    ("cha", "ച"), ("chha", "ഛ"), ("ja", "ജ"), ("jha", "ഝ"), ("nja", "ഞ"),
    ("tta", "ട"), ("ttha", "ഠ"), ("dda", "ഡ"), ("ddha", "ഢ"), ("nna", "ണ"),
    ("ta", "ത"), ("tha", "ഥ"), ("da", "ദ"), ("dha", "ധ"), ("na", "ന"),
    ("pa", "പ"), ("pha", "ഫ"), ("ba", "ബ"), ("bha", "ഭ"), ("ma", "മ"),
    ("ya", "യ"), ("ra", "ര"), ("la", "ല"), ("va", "വ"), ("sha", "ശ"),
    ("ssa", "ഷ"), ("sa", "സ"), ("ha", "ഹ"), ("lla", "ള"), ("zha", "ഴ"),
    ("rra", "റ"),
]
SIGNS = [
    ("s_aa", "ാ"), ("s_i", "ി"), ("s_ii", "ീ"), ("s_u", "ു"), ("s_uu", "ൂ"),
    ("s_ri", "ൃ"), ("s_e", "െ"), ("s_ee", "േ"), ("s_ai", "ൈ"),
    ("s_o", "ൊ"), ("s_oo", "ോ"), ("s_au", "ൗ"),
]
CHILLU = [("c_nn", "ൺ"), ("c_n", "ൻ"), ("c_r", "ർ"), ("c_l", "ൽ"), ("c_ll", "ൾ")]
MARKS = [("x_vir", "്"), ("x_anu", "ം"), ("x_vis", "ഃ")]
PUNCT = [("p_sp", " "), ("p_dot", "."), ("p_com", ","), ("p_q", "?")]
# Digits. Without them an age, a time, a phone number or a quantity cannot be
# typed at all. Kept in step with build_model.py, which learns their real
# frequencies from the corpus.
DIGITS = [(f"d_{i}", str(i)) for i in range(10)]
# Latin letters, for the English layer.
LATIN = ([(f"L_{c}", c) for c in "abcdefghijklmnopqrstuvwxyz"]
         + [(f"U_{c.upper()}", c.upper()) for c in "abcdefghijklmnopqrstuvwxyz"])
CONTROL = [("ctl_undo", "⌫"), ("ctl_clear", "✕"), ("ctl_pause", "⏸"),
           ("ctl_123", "123"), ("ctl_eng", "ABC"), ("ctl_ml", "\u21e6"),
           ("ctl_done", "DONE")]

CLASS_OF = {}
UNITS = []
for ids, cls in (
    (VOWELS, "V"), (CONSONANTS, "C"), (SIGNS, "S"), (CHILLU, "CH"),
    (PUNCT, "SP"), (DIGITS, "NUM"), (LATIN, "LAT"), (CONTROL, "CTL"),
):
    for uid, ch in ids:
        CLASS_OF[uid] = cls
        UNITS.append({"id": uid, "char": ch, "class": cls})
for uid, ch in MARKS:
    cls = "VIR" if uid == "x_vir" else "ANU"
    CLASS_OF[uid] = cls
    UNITS.append({"id": uid, "char": ch, "class": cls})

# ----------------------------------------------------------------------------
# Unigram frequency — a Zipf-ish ranking, most frequent first.
# ----------------------------------------------------------------------------
RANK = """p_sp x_vir s_aa s_i ka na s_u ta ra x_anu la ya ma va s_e sa tta lla
pa nna s_ii s_ee cha da nga s_oo c_n c_r v_a v_i v_e nja bha sha ha ga c_l ssa
zha rra v_u dda ba dha ja s_uu v_aa tha kha v_oo c_ll p_dot c_nn gha chha jha
ttha ddha pha s_ai s_o s_ri v_ee v_ai v_o v_au v_ii v_uu v_ri s_au x_vis
p_com p_q d_1 d_2 d_0 d_3 d_5 d_4 d_9 d_6 d_8 d_7
L_e L_t L_a L_o L_i L_n L_s L_r L_h L_l L_d L_c L_u L_m L_f L_p L_g L_w L_y L_b
L_v L_k L_x L_j L_q L_z
U_T U_A U_S U_I U_M U_C U_B U_P U_H U_D U_R U_E U_N U_L U_W U_G U_F U_O U_K U_J
U_V U_U U_Y U_Q U_X U_Z
ctl_undo ctl_clear ctl_pause ctl_123 ctl_eng ctl_ml ctl_done""".split()

assert set(RANK) == set(CLASS_OF), (
    f"inventory/rank mismatch: {set(CLASS_OF) ^ set(RANK)}"
)

UNIGRAM = {u: 1.0 / (i + 2) ** 1.05 for i, u in enumerate(RANK)}
_z = sum(UNIGRAM.values())
UNIGRAM = {u: p / _z for u, p in UNIGRAM.items()}

# Control units get a small fixed mass — they must stay reachable but shallow
# enough to be usable, and must not distort the comparison.
# Undo is NOT rare. Real switch users mis-press at 5-15%, so correcting is one
# of the most frequent operations there is — more frequent than most letters.
# At the old 0.012 it cost 6 steps against 4 for a letter, i.e. fixing a mistake
# cost more than making one. Clear goes the other way: it is destructive and
# rare, so it should sit DEEP where it cannot be hit by accident.
UNIGRAM["ctl_undo"] = 0.060
UNIGRAM["ctl_clear"] = 0.003
# ctl_pause must be the STRICTLY least likely unit in every context, so Huffman
# places it at the end of the all-wait path. That path is what a user walks by
# doing nothing, so it must land on an explicit "pause" rather than stealing a
# real letter. Without this, the least-likely letter of each context becomes
# untypeable — which the session tests catch.
# ctl_pause is NOT typeable and is excluded from the legality sets below. The
# scanner grafts it onto the all-wait path at runtime, because probability alone
# cannot place it there — the all-lo spine does not track the least-likely leaf.
UNIGRAM["ctl_123"] = 1e-7
UNIGRAM["ctl_eng"] = 1e-7
UNIGRAM["ctl_ml"] = 1e-7
UNIGRAM["ctl_done"] = 1e-7      # injected by the app, not scanned for
UNIGRAM["ctl_abc"] = 1e-7
UNIGRAM["ctl_pause"] = 1e-7
_z = sum(UNIGRAM.values())
UNIGRAM = {u: p / _z for u, p in UNIGRAM.items()}

# ----------------------------------------------------------------------------
# Class transition model: P(next class | previous class).
# A zero here means the transition is ILLEGAL — this table is the constraint.
# ----------------------------------------------------------------------------
#
# A class absent from a row is ILLEGAL after that class, not merely unlikely.
# Those omissions ARE the constraint, so each one is justified here:
#
#   after SP   no vowel-sign / virama / anusvara / chillu — nothing to attach to
#   after C    no independent vowel — a vowel mid-word is written as a sign
#   after S    no second vowel-sign, no virama — one nucleus per syllable
#   after VIR  consonant only (that is what a virama is for), or end of word
#   after V    no vowel-sign (vowels do not take signs), no virama, no chillu
#   after ANU  syllable is closed — consonant or space only
#   after CH   syllable is closed — consonant or space only
#
TRANSITIONS = {
    "SP":  {"C": .62, "V": .20, "NUM": .06, "LAT": .08, "CTL": .04},
    "C":   {"S": .44, "C": .22, "VIR": .16, "SP": .08, "ANU": .04,
            "CH": .02, "CTL": .04},
    "NUM": {"NUM": .55, "SP": .40, "CTL": .05},
    "LAT": {"LAT": .74, "SP": .21, "CTL": .05},
    "S":   {"C": .54, "SP": .33, "ANU": .05, "CH": .04, "CTL": .04},
    "VIR": {"C": .93, "SP": .03, "CTL": .04},
    "V":   {"C": .84, "SP": .09, "ANU": .03, "CTL": .04},
    "ANU": {"SP": .68, "C": .28, "CTL": .04},
    "CH":  {"SP": .54, "C": .42, "CTL": .04},
    # After a control key the app recomputes the real context from the text;
    # this row is only a fallback for an empty buffer, so it mirrors SP.
    "CTL": {"C": .62, "V": .20, "NUM": .06, "LAT": .08, "CTL": .04},
}

CONTEXTS = list(TRANSITIONS)


def conditional(prev_class):
    """P(unit | previous class), over legal units only."""
    out = {}
    for cls, pc in TRANSITIONS[prev_class].items():
        members = [u for u in CLASS_OF if CLASS_OF[u] == cls]
        mass = sum(UNIGRAM[u] for u in members)
        for u in members:
            out[u] = pc * UNIGRAM[u] / mass
    z = sum(out.values())
    return {u: p / z for u, p in out.items()}


# ----------------------------------------------------------------------------
# Baseline grid (Mode A) — Unicode order, the layout a naive IME presents.
# 10 columns, as the shipped Malayalam keyboards roughly are.
# ----------------------------------------------------------------------------
GRID_COLS = 10
GRID_ORDER = (
    [u for u, _ in VOWELS] + [u for u, _ in CONSONANTS] + [u for u, _ in SIGNS]
    + [u for u, _ in MARKS] + [u for u, _ in CHILLU] + [u for u, _ in PUNCT]
    + [u for u, _ in CONTROL if u not in ("ctl_pause", "ctl_123", "ctl_eng", "ctl_ml", "ctl_done")]
)


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    legal = {c: sorted(u for u in conditional(c) if u not in ("ctl_pause", "ctl_123", "ctl_eng", "ctl_ml", "ctl_done"))
             for c in CONTEXTS}
    bigrams = {c: {u: round(p, 8) for u, p in conditional(c).items()
                   if u not in ("ctl_pause", "ctl_123", "ctl_eng", "ctl_ml", "ctl_done")}
               for c in CONTEXTS}

    files = {
        "units.json": UNITS,
        "bigrams.json": bigrams,
        "legal.json": legal,
        "gridA.json": {"cols": GRID_COLS, "order": GRID_ORDER},
        "meta.json": {
            "source": "hand-estimated (sim/export_data.py)",
            "provisional": True,
            "note": ("Replace with corpus-measured values before reporting any "
                     "number. See BUILD.md phase 3."),
            "units": len(UNITS),
            "contexts": CONTEXTS,
        },
    }
    for name, obj in files.items():
        (OUT / name).write_text(
            json.dumps(obj, ensure_ascii=False, indent=1), encoding="utf-8"
        )
        print(f"  {name:14s} {(OUT / name).stat().st_size:>7,} bytes")

    print(f"\n{len(UNITS)} units, {len(CONTEXTS)} contexts")
    print("legal-set sizes:",
          ", ".join(f"{c}={len(legal[c])}" for c in CONTEXTS))
    full = len(UNITS)
    avg = sum(len(legal[c]) for c in CONTEXTS) / len(CONTEXTS)
    print(f"mean legal set {avg:.1f} of {full} units "
          f"({100 * avg / full:.0f}%) — this reduction is the contribution")


if __name__ == "__main__":
    main()
