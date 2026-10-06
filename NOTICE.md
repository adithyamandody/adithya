# Third-party material

This repository bundles work by other people. Their licences apply to those
files regardless of what licence this project chooses for its own code.

---

## Malayalam Wikipedia text — `sim/corpus_ml.txt`

113,324 units of running Malayalam, used to measure the scan model: unit
frequencies, the legality sets, and the 4,000-word prediction vocabulary in
`app/data/words.json`.

- **Source:** [ml.wikipedia.org](https://ml.wikipedia.org), fetched 5 October 2026
  via the MediaWiki API (`action=query&prop=extracts`), ~450 random articles
- **Licence:** [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- **Attribution:** Wikipedia contributors
- **Share-alike:** derivatives of this text carry the same licence. That covers
  `app/data/words.json`, which is a word list extracted directly from it, and
  the frequency tables in `app/data/bigrams.json`.

The code that processes it (`sim/build_model.py`) is this project's own work and
is not a derivative of the text.

---

## Noto Sans Malayalam — `app/server/fonts/NotoSansMalayalam.ttf`

Used by the plotter to shape Malayalam into pen paths. Its OpenType tables are
what turn ക + ് + യ into the single conjunct ക്യ.

- **Source:** [github.com/googlefonts/noto-fonts](https://github.com/googlefonts/noto-fonts)
- **Licence:** [SIL Open Font License 1.1](https://openfontlicense.org/)
- **Copyright:** Google LLC and the Noto project authors

The OFL permits bundling and redistribution. It does **not** permit selling the
font on its own, and any modified version must be renamed.

---

## Libraries

Not vendored — installed from their own sources, each under its own licence.

| | Used for | Licence |
|---|---|---|
| [HarfBuzz](https://harfbuzz.github.io/) (`uharfbuzz`) | Malayalam text shaping | MIT |
| [fontTools](https://github.com/fonttools/fonttools) | Glyph outlines | MIT |
| [Pillow](https://python-pillow.org/) | The plot preview | MIT-CMU |
| [pySerial](https://github.com/pyserial/pyserial) | Streaming G-code | BSD-3-Clause |
| [Flask](https://flask.palletsprojects.com/) | The plotter server | BSD-3-Clause |
| [Capacitor](https://capacitorjs.com/) | The Android wrapper | MIT |

---

## Services

Reached at runtime with the user's own API key; nothing from them is
redistributed here. Each has its own terms.

Google Cloud Text-to-Speech · ElevenLabs · Deepgram · Grok (xAI) · Groq

---

## Prior work this project measures itself against

Cited rather than used, but the comparison is the point of the project and the
citations belong somewhere permanent.

- **Higger et al. (2016)**, *Fast Switch Scanning Keyboards: Minimal Expected
  Query Decision Trees* — [arXiv:1606.02552](https://arxiv.org/abs/1606.02552).
  The optimal scan tree for a flat alphabet. This project's baseline, not its
  contribution.
- **Roark et al. (2013)**, *Huffman scanning: using language models within
  fixed-grid keyboard emulation* —
  [PMC3828203](https://pmc.ncbi.nlm.nih.gov/articles/PMC3828203/).
  Context-conditional scan trees. The baseline the project's own hypothesis
  failed to beat; see `app/FINDINGS.md`.
- **MacKenzie (2012)**, *Modeling Text Input for Single-Switch Scanning*, ICCHP.
  Defines scan steps per character.

---

## Licence for this project's own code

**Not yet chosen.** Without one, default copyright applies and nobody may reuse
it — which works against the stated aim of the scan trees being adopted by an
existing Malayalam AAC app. Worth deciding before this is shared widely.

Note the interaction: the measured data files are CC BY-SA by inheritance from
Wikipedia, whatever licence the code carries.
