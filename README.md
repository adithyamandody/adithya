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

## Status

- [x] Project selected and specified
- [x] App architecture decided
- [ ] Simulator → real press-count numbers
- [ ] PWA scanning engine
- [ ] ESP32 switch firmware
- [ ] Pen plotter
