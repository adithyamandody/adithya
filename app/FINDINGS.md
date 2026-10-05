# Finding 001 — the hard constraint does not buy scan steps

**Date:** 1 October 2026
**Found by:** `app/test/scan.test.mjs`, characterised by `app/test/constraint_value.mjs`
**Status:** provisional — hand-estimated model, not corpus-measured
**Severity:** changes the headline claim

---

## What happened

The first unit test run compared the three methods on <span lang="ml">നീ സുഖം ആണോ</span>:

| Method | Scan steps | Presses |
|---|---|---|
| A — row–column (what ships) | 115 | 22 |
| C3b — context tree, no legality | 50 | 25 |
| **B — context tree + hard legality** | **50** | **25** |

**B and C3b are identical.** The hard legality constraint — the contribution — bought
nothing at all over the soft context model.

## Why

A Huffman code already assigns a near-zero-probability symbol a very long codeword.
Leaving an illegal unit in the tree therefore costs almost nothing, because the
scanner never reaches it. **Removing it only helps when the model wrongly believes it
is plausible.**

Sweeping the probability mass a soft model leaves on illegal transitions:

| Mass left on illegal units | Soft steps | Hard steps | Gain |
|---|---|---|---|
| 1e-9 … 1e-3 | 50 | 50 | **0.0%** |
| 5e-3 | 52 | 50 | 3.8% |
| 1e-2 | 54 | 50 | 7.4% |
| 2e-2 | 56 | 50 | 10.7% |

The constraint starts paying only once the soft model is **badly estimated**.

## Why this is good news, not bad

It makes the claim sharper and more interesting, and it points at a better experiment.

**A well-estimated language model needs a lot of text.** Malayalam is a low-resource
language — that is the whole premise of the project. So the honest claim becomes:

> The hard constraint matters precisely when there is not enough text to estimate a
> good model — which is the real situation for every Indian language. We measure how
> the benefit scales with training-corpus size.

That is a **better** experiment than the one planned: plot constraint gain against
corpus size, per language. A well-resourced language converges to zero gain; a
low-resource one does not. If the curve behaves, that *is* the scaling law BUILD.md
wanted under Claim 3, and it is tied to something real rather than to script
complexity alone.

## The second effect, which is not about steps at all

Under a soft model, **217 of 217 illegal units remain selectable** across all eight
contexts. Every one is a mis-press that produces impossible Malayalam and costs the
user an undo. Under the hard constraint that number is **zero** — an illegal unit
cannot be reached.

So the constraint is a **correctness and error-cost** claim, not a speed claim. That
connects directly to the simulated-error condition already in BUILD.md §4: re-run
C3b vs C4 at miss probabilities 0.05 and 0.10 with an undo cost, and the constraint
should pay there even when it pays nothing on clean input.

## What changes

1. **Claim 1 is reframed.** Not "C4 beats C3b on presses" flat, but "C4 beats C3b as
   a function of training-corpus size, and under a nonzero mis-press rate."
2. **Add an experiment:** constraint gain vs corpus size, per language. Cheap — it is
   the same pipeline run on subsamples.
3. **Promote the error condition** from a robustness check to a primary result.
4. **Keep reporting the flat comparison** including the 0% case. Pre-registered as
   reportable either way, and this is exactly that.

## Caveat

This model is hand-estimated (`sim/export_data.py`, `meta.json: provisional`). The
mathematics generalises — Huffman handles low-probability symbols efficiently
regardless of where the numbers come from — but the *size* of the effect at realistic
corpus sizes is unknown until phase 3 measures it on real text.

**Finding this on 1 October rather than in November is worth more than the result it
overturned.**

---

# Finding 002 — the constraint does not help under mis-presses either

**Date:** 1 October 2026 · `app/test/error_cost.mjs` · 4000 seeded trials per cell

Finding 001 reframed the claim around error cost. That reframe does not survive
measurement.

| mis-press rate | soft: wrong / illegal per sentence | hard: wrong / illegal |
|---|---|---|
| 0.02 | 1.04 / 0.00 | 1.04 / 0.00 |
| 0.05 | 2.41 / 0.00 | 2.45 / 0.00 |
| 0.10 | 4.14 / **0.01** | 4.14 / **0.00** |
| 0.15 | 5.71 / **0.01** | 5.71 / **0.00** |

The soft model produces **one impossible unit per hundred sentences**. The hard
constraint produces zero. The difference is real but negligible, and wrong-unit
counts are identical to two decimal places.

Same mechanism as finding 001: illegal units sit so deep in the soft tree that a
mis-press almost never lands on one. The property that made the step-count gain
zero makes the error-cost gain zero too.

---

# Finding 003 — where the value actually is, and it is not the constraint

**Date:** 1 October 2026 · `app/test/zero_resource.mjs`

Decomposing the whole gain on <span lang="ml">നീ സുഖം ആണോ</span>:

| What you know | Corpus needed? | Steps |
|---|---|---|
| row–column grid (what ships) | no | **115** |
| uniform binary tree — *no knowledge at all* | no | 68 |
| legality only | **no** | 65 |
| unigram only | yes | 66 |
| legality + unigram | yes | 62 |
| full bigram | yes | 50 |
| bigram + legality (**the proposal**) | yes | **50** |

Read the first two rows carefully. **Nearly the entire win — 115 → 68, about 72%
of everything achievable — comes from using a binary tree at all, with zero
knowledge of Malayalam.** That is Huffman, 1952.

Legality then adds 3 steps (≈5% of the achievable gain). A corpus model adds 18
more. Legality on top of the corpus model adds **nothing**.

## Honest status of the contribution

Three experiments, three negative results, one consistent mechanism: a Huffman
code already gives improbable symbols long codewords, so forbidding them changes
almost nothing. As formulated, **"akshara legality as a hard constraint" is not a
contribution.**

## What survives, and it is not small

- **The akshara tax is real and unmeasured.** 115 → 50 steps is **2.3×**, and
  nobody has published that figure for any Brahmic script. That is an empirical
  contribution and the number a judge will care about.
- **Legality is free.** It needs no corpus — just the grammar of the script,
  which a linguist writes down in an afternoon. For the ~20 Indian languages
  with no usable corpus, "legality only" (65) nearly matches "unigram only" (66)
  while requiring no text at all. That is a **low-resource deployment** claim,
  not an algorithmic one.
- **A negative result, properly demonstrated, is a real result.** "I hypothesised
  that hard constraints would help, built the apparatus, measured it, and they
  do not — and here is the information-theoretic reason" is better science than
  most of what appears at a fair.

## Caveat that could overturn all three findings

Every number here comes from the hand-estimated 75-unit model, where the
scanning unit is a **decomposed** base + sign + virama. BUILD.md's IV4 proposes
the alternative: whole **akshara clusters**, where the inventory runs to
thousands and the legality structure is far sharper. The constraint may bite
much harder there. **Testing IV4 is the highest-value next experiment**, and it
should happen before the claim is rewritten.

---

# Finding 004 — clusters close the last route (IV4)

**Date:** 1 October 2026 · `app/test/cluster_units.mjs`

Finding 003 ended with a caveat: all three results used **decomposed** units, and
whole **akshara clusters** might make legality bite harder. BUILD.md lists this as
IV4. It does the opposite.

| scheme | inventory | selections | steps | presses |
|---|---|---|---|---|
| decomposed, row–column (ships today) | 75 | 11 | **115** | 22 |
| decomposed, bigram tree | 75 | 11 | **50** | 25 |
| decomposed, bigram + legality (the proposal) | 75 | 11 | **50** | 25 |
| cluster, frequency tree | 528 | 7 | 62 | 27 |
| cluster, frequency tree + legality | 528 | 7 | 59 | 29 |

**Mean legal set under clusters: 525 of 528 — 99.3%.** Against 64% for decomposed
units.

## Why the caveat was wrong

A cluster is a **complete syllable**, so nearly every cluster may legally follow
nearly every other. The legality constraint lived in the *internal structure of the
akshara* — after a virama only a consonant may follow, a vowel sign cannot follow a
vowel sign — and clusters put that structure **inside the unit**, where a scanner
never sees it.

Moving to clusters does not strengthen the constraint. It dissolves it.

## A second result, unlooked for and more useful

**Decomposed beats clusters: 50 steps against 62, a 19% difference.** Fewer
selections (7 vs 11) do not pay for a sevenfold larger inventory and the deeper
tree it forces.

That is a concrete, publishable design recommendation for anyone building Malayalam
AAC — *decompose the akshara, do not scan whole clusters* — and no one has published
it either.

## Status after four experiments

The constraint is finished as a contribution. Every route has been tested and closed:
clean input (001), mis-presses (002), zero-resource (003), scanning unit (004).

Three things survive, and they are what the paper should be about:

1. **The akshara tax: 115 → 50 steps, 2.3×.** Real, and unmeasured in the literature.
2. **Decompose, don't cluster: 19%.** A design recommendation with a number on it.
3. **Legality is a free substitute for a corpus you do not have** — 65 steps against
   66 for a unigram model, with no text at all. A low-resource deployment claim.

Plus the negative result itself, with its mechanism: *a Huffman code already assigns
improbable symbols long codewords, so forbidding them changes nothing.* Four
experiments agreeing on one mechanism is a stronger paper than a 5% win would have
been.

**All four findings rest on the hand-estimated model.** Phase 3 must re-run them on
real corpora before anything is claimed in public.

---

# Finding 005 — the scanner typed by itself, and the press count is worse than the baseline

**Date:** 5 October 2026 · reported from the live app · `app/test/session.test.mjs`

## The bug

A user left the app alone and three letters appeared: <span lang="ml">ഷങങ</span>. Reproduced
exactly — walking the all-wait path with **zero presses** emitted
<span lang="ml">ഷങങങങങ</span>.

Mathematically this was correct Huffman scanning: every leaf has a codeword,
including the all-"no" one. As a product it is indefensible. **Idle must not type.**

### The fix, and the fix to the fix

First attempt: refuse to emit on a zero-press path. The tests immediately caught
the cost — the least-wait-reachable **letter of every context became untypeable**.
A letter you cannot type is a worse defect than the one being fixed.

Second attempt: give an explicit `ctl_pause` the smallest probability so Huffman
buries it at the end of the all-wait path. **This does not work** — the all-`lo`
spine does not track the least-likely leaf, and a real letter still landed there
in all eight contexts.

What works is placing it by construction (`graftPause` in `app/scan.js`): walk the
all-wait path, split the leaf it reaches, put pause on the wait side and the
original letter one press away. Verified: all eight contexts end on pause, **zero
letters lost**, one extra step for one rare unit per context.

## The second bug, which is not a bug but was being hidden

| | scan steps | presses |
|---|---|---|
| A — row–column (ships today) | 115 | **22** |
| B — AksharaScan | **50** | **25** |

**B needs more presses than the baseline it replaces** — and presses are the
expensive resource for someone with limited motor control. Fatigue is measured in
presses, not seconds.

Swapping which branch a press takes does **not** fix it: for any leaf,
`presses_swapped = depth − presses`, so relabelling moves effort between symbols
without reducing it. On this sentence it gives exactly 25 either way.

This is intrinsic. **Binary tree scanning trades presses for time:** row–column is
press-cheap and slow, a tree is press-expensive and fast. Two selections per
character versus about half the tree depth.

## What must change on the poster

The headline cannot be "2.3× faster" unqualified. It has to be:

> **2.3× fewer scan steps, at 14% more button presses.**

Which user that helps is an empirical question the project should actually ask —
and it argues for adding presses-per-message as a co-primary metric alongside
steps, rather than a secondary one. For a user who fatigues, row–column may
genuinely be the better system, and the project should be willing to say so.
