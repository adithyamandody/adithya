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
