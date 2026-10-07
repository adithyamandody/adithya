# AksharaScan

**A constraint-aware scan tree for single-switch text entry in Brahmic scripts.**

People with severe motor disabilities type with one button. A highlight scans through the
symbols; they press when it reaches the one they want. For English this has been optimised
for decades. For Malayalam it has not — so a Malayalam speaker presses far more times to
say the same thing.

This project builds a scan tree that knows the rules of the script. After each symbol it
offers **only what can legally come next**, ordered so the likely ones arrive first. It then
measures how many presses that saves, across five Brahmic scripts with English as a
negative control.

---

## The contribution

> Context-conditional scan trees already exist (Roark 2013 rebuilds the code at every
> character from an n-gram model). What has not been done is treating **akshara legality as
> a hard constraint** — and nobody has measured whether that hard constraint buys anything
> over a soft language model, or whether the benefit grows with script complexity.

A negative result is still a finding, and is pre-registered as reportable either way.

## Targets

| Fair | Category | When |
|---|---|---|
| IRIS National Fair → Regeneron ISEF | Systems Software | submission 3 Oct 2026; ISEF May 2027 |
| Kerala School Sasthrolsavam | Working Model (HSS) | district Oct, state Nov 2026 |

## Repository

```
.
├── BUILD.md              full technical spec: experiments, controls, statistics, safety
├── DECISION.md           how this project was chosen out of 16 candidates
├── IDEAS_LEDGER.csv      all 16 ideas with critic kill-reasons and judge scores
├── competitions.csv      41 competitions surveyed
├── winners/              verified winner data, 41 events, 2022–2026
├── estimate.py           first-pass press-count model (seed for the simulator)
├── aksharascan.html      the proposal, source for the PDF
├── AksharaScan.pdf       7-page proposal
├── GUIDE.html            presenter's guide, source for the PDF
├── AksharaScan-Guide.pdf 15-page presenter's guide — plain-words explanation and judge Q&A
└── app/
    ├── PLAN.md           app build plan — decided, not an options paper
    ├── index.html        the PWA
    ├── data/             units, bigrams, legality sets, baseline grid
    ├── firmware/         ESP32 switch (BLE HID) and plotter bridge
    └── server/           Malayalam shaping → G-code → pen plotter
```

## The demo

Two one-button boxes. Box A scans the way Android Switch Access does today. Box B runs
AksharaScan. A judge types the same Malayalam sentence on both and watches the press
counters diverge — they feel the difference in their own thumb.

Then the composed sentence is spoken aloud, and a repurposed 3D printer writes it on paper.

## Attribution

The scan model is measured from Malayalam Wikipedia (CC BY-SA 4.0) and the
plotter bundles Noto Sans Malayalam (SIL OFL 1.1). Full detail, including what
that means for the derived data files, in [NOTICE.md](NOTICE.md).

## Status

| | |
|---|---|
| **App** | Web and Android. [Try it](https://aksharascan-adithyamandodys-projects.vercel.app) · [APK](https://github.com/adithyamandody/adithya/releases/latest) |
| **Setup** | [SETUP.md](SETUP.md) — forty minutes from a blank tablet to a working switch |
| **Model** | Measured from 113,324 units of real Malayalam, not hand-estimated |
| **Scanning** | Three layers (Malayalam, 123, ABC), all reachable by switch alone |
| **Prediction** | Word completion and next-word, learned from use |
| **Speech** | Device voice offline — native Android TTS in the APK, Web Speech in the browser; five cloud providers, cached so they work offline after one fetch |
| **Switch** | Two-switch ESP32 over Bluetooth HID; hold or chord for a third command |
| **Reminders** | Medicine schedule, spoken aloud, answered with the switches. Offline |
| **Reader** | Open a PDF and hear it a sentence at a time; switch controls the pace. Offline |
| **Chat** | Ask an AI and hear the reply. The one feature that needs internet |
| **Plotter** | Malayalam → G-code with real HarfBuzz shaping |
| **Tests** | 131, run with `npm test` |

### What the experiments found

Eight experiments in, **the project's original hypothesis is disproved**: a hard
akshara-legality constraint buys **0.0%**, across hand-estimated and
corpus-measured models, at legal-set sizes from 32% to 63%, on clean input and
under mis-presses, with decomposed units and with whole clusters.

A Huffman code already gives improbable symbols long codewords, so forbidding
them changes nothing.

What survives is in [app/FINDINGS.md](app/FINDINGS.md):

- **The akshara tax: 2.3×** — never measured for any Brahmic script
- **Decompose, don't cluster: 19%** — a design recommendation with a number on it
- **Legality is free** — it needs no corpus, so it is worth having where no corpus
  exists, even though it adds nothing where one does
- The negative result itself, with its information-theoretic reason

Ranked by effect, every large win here belongs to someone else: prediction 57%,
using a binary tree at all 41%, a context model 26%, the proposed constraint ~0%.
