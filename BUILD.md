# DECISION: What the Student Builds, Starting Today

**Date: 31 August 2026 · Deadline: IRIS submission 3 October 2026 · Decision is final.**

---

## 1. THE DECISION

**Build AKSHARASCAN — a constraint-aware scan tree for single-switch text entry in Brahmic scripts, measured across five Indian languages plus English, demonstrated as two physical one-button typing boxes.**

This remains the decision. A completeness review found seven high-severity problems, and none of them touch the *choice* — they all attack the *claims and the schedule*, which are repairable in week 0. The decision stands; five things changed and are marked throughout:

1. **A citation was wrong and is corrected.** The document previously attributed "scan-steps-per-character = 1.713 for an optimised English ambiguous keyboard (SAK)" to *MacKenzie & Felzer, ICCHP 2012*. That paper is **"Modeling Text Input for Single-Switch Scanning," single-authored by I. Scott MacKenzie**, and it contains neither the figure 1.713 nor the word "ambiguous." Its reported SPC values run from **2.45 (Wivik: optimised layout + word prediction + row–column) to 7.45**, across 12 keyboards on BNC-1, BNC-2, Brown and Phrases. 1.713 is almost certainly a **KSPC** figure from the separate MacKenzie & Felzer *SAK* paper (ACM TOCHI) — a different metric on a different keyboard class, and therefore useless as a reproduction check for a scan-steps metric on an unambiguous scanner. The reproduction control is now **SPC = 2.45 on Brown**, and 1.713 appears nowhere in this project.
2. **The novelty sentence was too strong and is rewritten,** because a paper already in our own prior-art table falsifies it (Roark et al. 2013 already rebuilds the coding tree per context from a character n-gram model). A new condition **C3b** — a context-conditional flat tree with no legality constraint — is inserted, and **CLAIM 1 is now "C4 beats C3b," not "C4 beats C3."**
3. **The English negative control was tautological and is redefined.** Constraint sets are now **derived by one script-agnostic procedure from the train split** and applied identically to all six languages, including English, with a pre-registered numeric ratio bound.
4. **The 7 September gate is split.** 7 Sep now carries only C0/C1/C2 (Layer 1, no optimal solver). C3 + C3b move to **11 September**.
5. **The budget is restated honestly in two scenarios**, because the verified IRIS fee (₹5,000 + tax) puts the original BOM 50% over the family ceiling.

Here is why it still wins over everything else. Every other candidate has at least one person, courier, vendor, householder, or monsoon cloud on its critical path; this one has none. The primary experiment is a simulation over corpora that are already public, running on a laptop the student already owns, and it produces its first headline number **by 7 September**. Nothing — not a flaked classmate, not first-terminal exams, not a parts delivery, not rain — can take that away. It is the only candidate whose intellectual core is *algorithmic* (optimal decision trees under constraint) rather than a benchmark, an audit, or a calibration study, which is the shape ISEF Systems Software actually awards. It has a named beneficiary group and an assistive framing. And it has the best table demo in the portfolio: two identical boxes, one button each, the judge types the same Malayalam sentence on both and *feels* the result in their own thumb in fifteen seconds. That is a Working Model that genuinely works, not a laptop displaying a chart.

**Why not the incumbent plastic sorter.** It has the best theme and a beautiful demo, but it fails one question a judge asks in the first thirty seconds. The entire contribution rests on the asymmetry "PVC is catastrophic at 100 ppm, HDPE is harmless." PVC is — correctly, for safety — never extruded, so that number is a **citation**, not a measurement. What actually gets measured is HDPE/PP/PS spiking, where the published literature already says the effect is near-zero. So the weights that matter are cited and the weights that are measured don't matter. Add a PID-controlled heated-nozzle rig, ~1,500 hand-labelled images, two unrelated scientific domains, shipped parts, and 33 days including exams. It is retired.

**Why not the runner-up, KozhiSign.** Its one genuinely rare asset is real: in Malayalam a single Unicode string has two legal renderings, so you can vary glyph shape while holding content, length and character identity exactly constant. But the project as written leads with an *unidentifiable* number — attributing part of the 34-point Malayalam-vs-English scene-text gap to orthography, when that gap is also confounded with a 14× training-data difference, and when Telugu and Kannada sit at the same accuracy with no script reform at all. A judge kills it in eight seconds. It stays as the fallback, in amputated form (Section 9).

---

## 2. THE CONTRIBUTION

### The one sentence that has to survive an expert

> **No published scan tree conditions on akshara-internal legality as a hard constraint. Context-conditional trees exist (Roark 2013 rebuilds the code at every character from an n-gram model), and a Malayalam character model already pushes illegal akshara sequences toward long codes — so the honest question is not "does constraint help?" but "how much does a *hard* legality constraint add over a *soft* n-gram model, and does that margin scale with script complexity?" We build the constrained solver, we build the soft-model control that isolates it, and we answer that question on five Brahmic scripts with English as a negative control.**

If the answer turns out to be "hard constraints add nothing over a soft LM in Brahmic scripts," that is a real finding about a billion people's writing systems, it is publishable, and **we must be the ones who report it.**

### What is genuinely new vs the closest prior work

| Closest prior work | What it did | What it did **not** do |
|---|---|---|
| **Higger et al., "Fast Switch Scanning Keyboards: Minimal Expected Query Decision Trees," arXiv:1606.02552** — [arxiv.org/abs/1606.02552](https://arxiv.org/abs/1606.02552) | Solves the optimal scan tree as a Huffman code with unequal integer query costs (extending Golin), dropping the row–column constraint. **This is our baseline, not our contribution.** | Assumes a static, flat symbol inventory: every symbol is legal at every node. Their formulation cannot express a legal-set that changes as the tree descends. **Note in our favour and against us:** they model the user by probability of detection and false alarm — i.e. they model exactly the error behaviour our press-count metric omits, which is why we add the simulated-error condition in Section 4. |
| **Roark et al., "Huffman scanning: using language models within fixed-grid keyboard emulation"** — [pmc.ncbi.nlm.nih.gov/articles/PMC3828203](https://pmc.ncbi.nlm.nih.gov/articles/PMC3828203/) | **Rebuilds the code per context**: a character n-gram assigns probabilities to all next symbols, so "the binary code assigned to each symbol differs depending on what has been entered before." | Did not impose hard legality; did not test a non-alphabetic script family. **This is C3b, and it is the baseline CLAIM 1 must beat.** A hard constraint is a limiting case of a soft LM, and we say so in the paper in those words. |
| **Bhattacharya, Basu & Samanta, TNSRE 2008** (IIT Kharagpur, Sanyog AAC for Indian languages) | Corpus-driven, user-free automatic evaluation of scanning-keyboard designs inside an Indian-language AAC programme. **This is our evaluation methodology and we cite it as such.** | Did not build a constraint-gated tree; no cross-script scaling comparison. ⚠️ **Volume/issue/author order UNCONFIRMED** — the publication page we used did not surface these entries. Pull by DOI in week 0 before this goes on a poster. |
| **"Predictive Text Entry for Agglutinative Languages Using Unsupervised Morphological Segmentation"** — [link.springer.com/chapter/10.1007/978-3-642-28601-8_40](https://link.springer.com/chapter/10.1007/978-3-642-28601-8_40) | Morph-level prediction beating word-level for Finnish and Turkish, in keystrokes per character. | Alphabetic scripts, not switch scanning. Our Malayalam morpheme result is a **replication in a new script family**, and we say so in those words. |
| **MacKenzie, "Modeling Text Input for Single-Switch Scanning," ICCHP 2012 (single-authored)** — [yorku.ca/mack/icchp2012.html](https://www.yorku.ca/mack/icchp2012.html) | Defines scan steps per character (SPC) and reports it for 12 keyboard designs over BNC-1, BNC-2, Brown and Phrases: **from 2.45 (Wivik — optimised layout + word prediction + row–column) to 7.45.** States explicitly that the statistic assumes perfect operator behaviour — no errors, no missed selections. | English only, flat alphabet, no legality constraint, no error model. **We use SPC = 2.45 on Brown solely as a same-metric reproduction check for our own code.** It is never a baseline. |
| **Android Switch Access / iOS Switch Control** — [support.google.com](https://support.google.com/accessibility/android/answer/6122836) | Ship worldwide, free. Scan whatever grid the IME draws, in layout order. | No per-language optimisation, no akshara decomposition, no language model, no handling of the long-press vowel-sign popups and scrollable conjunct strips Malayalam IMEs actually use. **We document this on video.** |
| **Avaz (commercial, India) and Jellow Communicator (IIT Bombay, free)** — [jellow.org](https://jellow.org/jellow-basic.php), [Avaz](https://everyday.avazapp.com/products/avaz-aac-landing-page/) — **VERIFIED 31 Aug 2026 (web):** Jellow announces Malayalam support on its blog and lists external-switch connectivity; Avaz lists six Indian languages incl. Malayalam, switch-scanning support not stated. | Ship Malayalam AAC symbol/keyboard apps; Jellow supports external switches. | Neither publishes a per-language optimised scan tree — scanning is row–column/linear over whatever grid is drawn. **This is good for us:** a real Malayalam AAC ecosystem exists to adopt the trees. Week 0 action stands: install Jellow, screenshot the language list and the switch-access menu, count presses for one koottaksharam; email Avaz support about switch scanning and screenshot the reply. |

**Prior-art search log (new, and itself a credibility slide).** One evening in week 0, run and **log** a real search: ACM DL, IEEE Xplore, Google Scholar, ACL Anthology, plus a forward-citation sweep of Higger 2016 and Roark 2013. Record query strings verbatim — e.g. `('scanning keyboard' OR 'switch scanning') AND (Indic OR Devanagari OR Malayalam OR akshara OR syllabic)` and `('decision tree' AND 'text entry' AND constraint)` — with the date and the count of records screened. Specific gap to close: dynamic/adaptive scanning layouts for Indic scripts from the IIT Kharagpur / IIT Guwahati AAC lineage. The log goes in the paper as an appendix. Six citations chosen after the fact are not a search, and an absolute novelty claim without a logged search is the easiest thing in the room to puncture.

### The exact measurable claims

**Primary metric: switch presses per message (PPM)** and scan steps per message, over a **matched parallel corpus** — the same 1,000 sentences in every language (FLORES-200 / IN22), so content and information content are held constant. Per-character metrics are reported only as a secondary diagnostic, with the caveat stated by us first.

**Domain caveat, stated up front:** FLORES-200 and IN22 are Wikipedia-derived and professionally translated. AAC users compose short conversational utterances, and both the akshara tax and the constraint benefit depend on unit-frequency distributions that differ between translationese encyclopedic prose and everyday speech. So the matched parallel set is the **cross-script control** (it is the right tool for that job), and the **headline PPM is reported on BPCC-H-Daily as well**. We pre-register that **the ranking of schemes, not the magnitude, is the thing that must replicate across domains** (IV3 exists precisely to test this).

**How the constraint is extracted — one procedure, all six languages.** Legal-successor sets are **learned from the train split** over decomposed units: a unit-bigram support test with a stated frequency floor, same code, same floor, same decomposition interface for Malayalam, Kannada, Tamil, Devanagari, Bengali and English. Nobody hand-authors four FSTs for scripts we cannot read. **Malayalam alone is additionally hand-authored and sent to SMC for sign-off**, and the paper says, in these words: *Malayalam is the validated case; the other four scripts are data-derived replication.* Each script gets a one-line table of its **top 10 learned illegal transitions**, so any native-reader judge can spot-check the method in thirty seconds.

**C-conditions (the independent variable):**

- **C0** — linear scan of the full inventory
- **C1** — row–column scan of the *actually shipped* IME grid (established from screen recording, not assumed)
- **C2** — frequency-sorted row–column
- **C3** — **static** flat entropy-optimised scan tree over decomposed akshara units *(Higger-style, context-free)*
- **C3b** — **context-conditional flat scan tree**: tree rebuilt at every step from a unit n-gram LM, **no legality constraint** *(Roark 2013, re-implemented; **this is the baseline the contribution must beat**)*
- **C4** — **constraint-gated scan tree**: the learned legal-successor set supplies the admissible next-unit set at every node ← **THE CONTRIBUTION**
- **C5** — C4 + word-level n-gram prediction *(matched control)*
- **C6** — C4 + morpheme-level prediction via mlmorph *(test)*

**CLAIM 1 (headline, falsifiable).** On the matched parallel corpus, **C4 reduces presses per message relative to C3b** on all five Brahmic scripts. Pre-registered statistics: primary estimand is the **median per-sentence percent reduction**, with a **BCa bootstrap 95% CI on the paired per-sentence differences**; **CLAIM 1 is met only if the CI lower bound exceeds 3%.** Wilcoxon p is reported as secondary, alongside matched-pairs rank-biserial *r*; a minimum-detectable-effect calculation at n = 1,000 goes in the methods paragraph. Bonferroni across the five scripts. (At n = 1,000 a Wilcoxon returns p < 0.001 for effects far under 3%, so "p < 0.001" on its own carries no information about whether the claim is met, and we do not present it as if it does.) Pre-registered prediction: 5–15% over C3b. C4-vs-C3 is also reported, as the *combined* effect of context-conditioning plus constraint.

**English is the negative control, with numbers fixed in advance.** English gets the identical extraction procedure, so it will show *some* non-zero gain (q→u, no "zx"). Pre-registered bounds, written down before anything runs: **(a) mean Brahmic C4-over-C3b gain ≥ 3× the English gain, and (b) TOST equivalence on English with a bound of |gain| < 1%.** If English's gain is large or the ratio falls under 3×, the constraint is not doing the work we claim, and we report that.

**CLAIM 2 (the "akshara tax," honestly stated).** Naive row–column English vs naive row–column Brahmic, same pipeline, same code, same metric, matched sentences: predicted ratio **1.3–1.8×**, not 3×. The residual gap *after* optimisation (C4-English vs C4-Malayalam) is reported separately. A defensible 1.5× beats an indefensible 3× every time.

**CLAIM 3 (scaling law).** Presses per message against script complexity (inventory size, conjunct density, aksharas per word) across six languages — does the tax, and the size of the constraint benefit, scale predictably? Reported with the validated/data-derived split stated on the figure itself.

**CLAIM 4 (Malayalam deep case).** C6 beats matched C5 by ≥5% presses per message, because Malayalam sandhi makes whole-word prediction fail. **mlmorph coverage is measured by us AND cited:** the maintainer's first-release post reports **82% of a 50,000-word test corpus analysed** ([thottingal.in, Nov 2018](https://thottingal.in/blog/2018/11/25/malayalam-morpholoy-analyser-first-release/)); we re-measure on 10,000 held-out tokens on 1 Sep (`pip install mlmorph`, v1.3.0 has no HFST dependency) and report both numbers.

### One honesty commitment, written down now

The original plan compared **1.713** — which we now know is a KSPC figure for an ambiguous keyboard from a different paper — against an unoptimised Malayalam grid and called the difference a script effect. That is comparing two *designs*, two *metrics*, and two *keyboard classes*, not two scripts. **It is deleted, and the number appears nowhere in this project.** Every number here is same-code, same-metric, within-pipeline. Before the SAK paper is cited at all, we pull the actual TOCHI article and confirm the exact figure, the exact metric name, the corpus, and whether it is simulation or user study.

---

## 3. WHAT GETS BUILT

Two identical single-switch typing boxes. Box A runs what ships today (C1). Box B runs AksharaScan (C4/C6). Each has one big button, one press counter, and audible scan feedback. A laptop (or reused school monitor) shows both scan grids side by side **and mirrors both press counters as 200-px digits**, so the number is legible from the back of a Sasthrolsavam aisle. **Everything runs offline, CPU-only, no internet, no GPU.**

**Box A must be the phone if it can be.** The arcade switch goes into a USB/Bluetooth HID adapter driving **real Android Switch Access on a real Malayalam IME**, with the counter counting real presses. Only if that proves flaky do we fall back to our own row–column re-implementation — and if we do, the box is labelled, out loud and on the panel overlay: *"idealised row–column scan — generous to the baseline; the real shipped path is slower, see video."* Section 4 says C1 is measured, not assumed; a re-implemented strawman on the demo table would contradict our own best rule. **No "2–3×" figure is stated anywhere until the 4 Sep audit produces it.**

### Budget — two scenarios, stated honestly

Family ceiling is ₹5,000–10,000. The IRIS fee is **verified: ₹5,000 + taxes per project (≈₹5,900), with an EWS waiver on valid documentation.** So the fee decides the build, and **the waiver answer must come before any part is ordered.**

**Scenario A — waiver granted (fee ₹0). Full BOM, ₹9,080.**

| # | Item | Qty | Unit ₹ | Total ₹ | Supplier |
|---|---|---|---|---|---|
| 1 | 100 mm arcade / accessibility switch (illuminated, screw terminals) | 2 | 420 | 840 | Robu.in |
| 2 | **Raspberry Pi Pico H (pre-soldered headers)** | 2 | 450 | 900 | Robu.in / Robocraze |
| 3 | Micro-USB data cable, 1.5 m | 2 | 120 | 240 | ElectronicsComp |
| 4 | **4-digit display, 1.2″ or larger, headers pre-soldered** (mirrored on laptop at 200 px) | 2 | 350 | 700 | Robocraze |
| 5 | 3.5 mm panel-mount switch jacks (AAC-standard) | 2 | 90 | 180 | Robu.in |
| 6 | Dupont jumper set + screw terminal blocks | 1 set | 250 | 250 | ElectronicsComp |
| 7 | USB-powered 3 W speaker (auditory scanning) | 1 | 650 | 650 | Robocraze |
| 8 | 4-port powered USB hub | 1 | 400 | 400 | ElectronicsComp |
| 9 | MDF/acrylic enclosures + screws, standoffs, feet | 2 | 500 | 1,000 | local signage shop |
| 10 | Printed panel overlays, Malayalam labels, lamination | — | — | 400 | local press |
| 11 | **Raspberry Pi Zero 2 W + 32 GB SD + 5 V PSU** (makes Box B standalone) | 1 | 2,600 | 2,600 | Robu.in |
| 12 | A2 poster prints, record book, binding, spare paper | — | — | 600 | local press |
| 13 | Contingency | — | — | 320 | — |
| | **TOTAL** | | | **₹ 9,080** | |

**Scenario B — waiver refused (fee ₹5,900). Lean BOM, ₹4,480. Real total ₹10,380.**

Drop lines 7, 8 and 11, and drop one Pico — a single Pico H sits in Box B and drives both switches and both displays over a four-wire tether; audio comes from the laptop.

| # | Item | Qty | Unit ₹ | Total ₹ |
|---|---|---|---|---|
| 1 | Arcade / accessibility switch | 2 | 420 | 840 |
| 2 | Raspberry Pi Pico H | 1 | 450 | 450 |
| 3 | Micro-USB data cable | 2 | 120 | 240 |
| 4 | 4-digit display (mirrored large on laptop) | 2 | 160 | 320 |
| 5 | 3.5 mm panel-mount jacks | 2 | 90 | 180 |
| 6 | Dupont + screw terminals | 1 set | 250 | 250 |
| 9 | Enclosures + hardware | 2 | 450 | 900 |
| 10 | Panel overlays, lamination | — | — | 400 |
| 12 | Poster, record book, binding | — | — | 600 |
| 13 | Contingency | — | — | 300 |
| | **BUILD TOTAL** | | | **₹ 4,480** |
| | **+ IRIS fee (₹5,000 + 18%)** | | | **₹ 5,900** |
| | **REAL TOTAL** | | | **₹ 10,380** |

Scenario B sits at the very top of the family ceiling, and the family should see that number before anything is ordered. **⚠️ Line 11 may not be a stretch goal.** If the Sasthrolsavam manual defines a Working Model as standalone, the Pi Zero becomes a requirement — which is a second reason to read the manual (Section 6) before the 5 Sep order.

**Soldering, corrected.** The earlier "no soldering is required" was probably false as specified: the standard Raspberry Pi Pico ships **without** headers (only the Pico H / WH are pre-soldered), and TM1637 modules usually arrive with the headers loose in the bag. Screw terminals do not help if the board has no pins. Line 2 is now the **Pico H**, and the display listing must say *headers pre-soldered* on the product page at order time. With those two substitutions verified on 5 Sep, no soldering is required, and the electronics is one button into one GPIO pin, twice.

**Display size, corrected.** A 0.56″ digit is not readable at 3 m — roughly one inch of digit height per 3 m is the working rule, so 0.56″ reads at about 1.5–1.7 m. The press counter is *the argument* of this demo and judges stand back. Hence a 1.2″-or-larger display in Scenario A, and the 200-px laptop mirror in both scenarios.

**Software (all free):** Python 3.10 venv, `indic-nlp-library` (akshara segmentation), `mlmorph` (Malayalam FST morphology), `pyfoma` or plain Python for the constraint layer, `heapq` for the tree, KenLM or plain-Python n-grams, `scipy`/`numpy`/`matplotlib`, CircuitPython on the Pico. **No model training, no GPU, no Colab dependency.**

**Corpora (all free, all downloadable this week):** FLORES-200 and IN22 (matched parallel), AI4Bharat BPCC-H-Daily (everyday utterances — the headline domain), IndicDialogue (conversational subtitles), Wikipedia (out-of-domain contrast), published AAC core-vocabulary lists.

---

## 4. EXPERIMENTS

### Variables

**Independent variables**
- **IV1 — encoding scheme:** C0, C1, C2, C3, C3b, C4, C5, C6 — eight levels. This is the headline variable.
- **IV2 — script:** Malayalam, Kannada, Tamil, Devanagari/Hindi, Bengali, **English (negative control)**. Six levels.
- **IV3 — corpus domain:** everyday utterances (BPCC-H-Daily), conversational (subtitles), out-of-domain (Wikipedia). Three levels — tests whether the *ranking* of schemes is stable, which is the pre-registered robustness claim.
- **IV4 — scanning unit:** whole akshara cluster vs decomposed base + sign + chillu + virama.
- **IV5 — user error rate (new):** perfect operator, per-press miss probability 0.05, and 0.10, each with a defined undo cost.

**Dependent variables**
- Switch presses per message *(primary)*
- Scan steps per message
- Presses per character *(secondary diagnostic only, with the syllable-vs-phoneme caveat stated by us)*
- % reduction of C4 vs C3b, per script, with BCa bootstrap 95% CI on paired differences
- Round-trip encoding-integrity rate, per language *(see the normaliser control below)*

### Sample sizes

- Matched parallel set: **1,000 sentences × 6 languages = 6,000 paired observations** for the cross-script comparison.
- In-language sets: the binding minimum is **≥1,000,000 characters of held-out text per language**, 80/20 train/held-out split. The earlier "≥200,000 sentences / >1,000,000 characters" pair was internally inconsistent (200k sentences is 10–20M characters) and neither number was verified as available. **On 1 Sep, after download, both are replaced by a table of measured sentence and character counts per language per corpus.** If any language falls short, **all languages are subsampled to the smallest**, so the comparison stays matched, and we say so.
- All scan trees and all language models are built on the **train** split only; every reported number comes from the **held-out** split. This is the answer to "did you fit on the data you're reporting?"
- Statistics: as pre-registered under CLAIM 1 — BCa bootstrap CI on paired per-sentence differences (primary), Wilcoxon signed-rank plus rank-biserial *r* (secondary), Bonferroni across the five scripts, MDE stated at n = 1,000.

### Controls — this is where the project is won

1. **C3b is the strong baseline.** Not the shipped grid (easy, uninteresting), and not a static flat tree (which would confound context-conditioning with legality). We beat a re-implemented Roark-style context-conditional tree on the same corpus with the same code. This is the question the first expert judge asks, and the experiment now answers it.
2. **English is the negative control, extracted identically.** Same procedure, same frequency floor, same code — so its result is evidence, not an identity. Pre-registered: Brahmic gain ≥ 3× English gain, and TOST |English gain| < 1%.
3. **C5 vs C6** is a matched word-level-vs-morpheme-level control on identical trees and identical corpora, isolating the morphology contribution.
4. **SPC reproduction check.** Our re-implementation must reproduce **MacKenzie 2012's SPC = 2.45** (Wivik: optimised layout + word prediction + row–column) on the **Brown** corpus — a real, checkable, same-metric target. Reproducing a published number with your own code is a credibility slide and takes half a day.
5. **C1 is measured, not assumed.** See below.
6. **Simulated user error (new).** Re-run C3b vs C4 at miss probabilities 0.05 and 0.10 with a defined undo cost, and report whether the C4 advantage survives. Presses-per-message rewards deep, lopsided trees, but a missed press deep in a binary tree costs a full backtrack while a missed press in a shallow grid costs one row cycle — so the metric as originally specified flatters our own method. Higger et al. model detection and false-alarm probability explicitly; adding this converts their paper from a baseline we merely beat into a framework we engage with. Costs one day of code and no participants.
7. **Encoding integrity (new).** The normaliser is written **once, script-parameterised**, with a round-trip validation script run per language. The **percentage of sentences that fail to round-trip is a reported row in the results table for all six languages.** Devanagari nukta and reph, Bengali ya-phala and ra-phala, Tamil grantha, and ZWJ/ZWNJ across all four are each their own silent-corruption hazard — the exact failure the risk table rates High for Malayalam. An explicit integrity row turns a hidden risk into a reported control.

### The empirical baseline (first week — worth more than any citation)

"The standard Malayalam grid" is not a fact. Shipped Malayalam IMEs are ~31-key layouts with long-press vowel-sign popups and scrollable conjunct strips, **not** a flat 60-cell akshara grid. Inventing your own strawman baseline is the single most common way an optimisation project dies in judging.

So: **one evening.** Enable Switch Access on the student's own Android phone with a real Malayalam IME. Screen-record the scan. Count the actual presses needed to produce ten target aksharas including one with a vowel sign, one chillu, and one koottaksharam. Two outcomes, both good:

- The shipped path really is a grid scan → you now have **video evidence** of your baseline, and a real press-count figure for the panel.
- Or vowel signs and conjuncts live behind long-press popups that switch scanning reaches badly or not at all → **that is a better, more concrete, more publishable finding than the one you planned**, and it is "I measured what ships" rather than "I simulated what I assumed ships."

The recording goes into the demo loop either way.

### How real experimental data exists by 3 October

| Date | Data that provably exists |
|---|---|
| **2 Sep** | Akshara segmenter + script-parameterised normaliser, unit-tested, round-trip rates measured |
| **4 Sep** | Screen-recording audit of Android Switch Access on Malayalam — video + real press counts |
| **7 Sep** | **HEADLINE #1 EXISTS.** C0/C1/C2 presses-per-message for Malayalam *and* English, matched parallel corpus **and** BPCC-H-Daily, bootstrap CIs, plots. No optimal solver required. |
| **11 Sep** | C3 and C3b built; SPC = 2.45 reproduction check passed or its failure documented |
| **14 Sep** | C4 built; **C3b-vs-C4 paired analysis on Malayalam** |
| **21 Sep** | All five Brahmic scripts + English run; scaling-law figure; error-rate condition run |
| **26 Sep** | C5-vs-C6 morpheme control; robustness across three domains |
| **30 Sep** | Paper, figures, abstract, IRIS submission uploaded (**3 days of slack**) |

This is entirely deterministic computation on a machine he owns. Nothing to ship, nobody to persuade, nothing to consent to, no weather.

### Failure-tolerance: what survives when the hard part fails

Four independent layers. **Each is a complete, reportable result on its own.**

- **Layer 1 (cannot fail — exists 7 Sep).** The measured akshara tax: presses per message, same pipeline, English vs five Brahmic scripts, on matched sentences and on everyday utterances. Requires only correct code.
- **Layer 2 (cannot fail — exists 4 Sep).** The empirical audit of what Android Switch Access actually does with Malayalam conjuncts. Video evidence of a shipped accessibility feature on an akshara script.
- **Layer 3 (the contribution — could underperform).** C4 beats C3b. **If the CI lower bound comes in under 3%, that is a clean, interesting negative result** — "hard legality constraints add little over a soft n-gram model in Brahmic scripts, and here is the entropy calculation showing why." We pre-register that we report it either way, and we would rather be the ones who report it.
- **Layer 4 (bonus).** Morpheme prediction beating word prediction. If mlmorph won't install or measured coverage is too low, the system falls back to C4 and the paper loses one section, not its spine.

**The demo is immune to all of this.** Box A vs Box B is C1 vs C4, and the gap is whatever the 4 Sep audit measures it to be. The judge's thumb still tells the story.

---

## 5. SAFETY & RULES

### Hazards

Essentially none, and this is a competitive advantage. One momentary switch into a 3.3 V GPIO pin, USB-powered, no soldering, no mains wiring, no heat, no chemicals, no animals, no pathogens, no lasers, no lithium beyond a phone charger.

Precautions: hard-cap speaker volume in software before anyone puts on headphones, and sanitise the shared button between users.

### Human participants — READ THIS TWICE

**The submitted project has zero human participants, by design, and this is non-negotiable.**

Three things from the original plan are **cut, permanently**:

1. **The Google Form corpus survey is CUT.** A survey administered to anyone other than the student researcher **is human-participant research** requiring approval *before* collection. Most respondents would be minors, requiring written parental permission obtained before the minor sees the link. A WhatsApp link fails this outright. Approval is **never granted retroactively** — this would surface in November, after all the work, as a disqualification.
2. **The 20-volunteer timed-typing trial is CUT.** Twenty able-bodied 17-year-olds pressing a button at a fixed scan period cannot validate anything the simulator does not already give. Serious rules risk for zero information.
3. **The CP-school case series is CUT.** Minors *plus* a vulnerable population requires a Qualified Scientist, informed consent and assent, full SRC review, and a designated supervisor. Not achievable by 3 October, and attempting it without approval poisons the *entire* submission.

The domain-robustness result the survey was supposed to give comes instead from **three public corpora** — same finding, zero consent forms.

**The demo table rule (new, and written into the Research Plan).** The 3.5 mm jacks exist so a real switch user can plug in their own switch. That is a good accessibility gesture and it stays — but if an actual AAC user, quite possibly a minor and a member of a vulnerable population, uses the device and anyone writes down their press count or reaction, that is unapproved human-participant research on a vulnerable group. So this sentence goes in the Research Plan **and is taped inside both boxes**:

> **No press count, timing, comment or observation from any visitor, judge or user is recorded, photographed or reported. The counter is reset after every visitor.**

The student testing his own boxes is engineering testing of his own apparatus. No data from any other person is collected or reported, at the desk or at the fair.

### What the IRIS SRC will ask, and the answer

⚠️ **These rows follow ISEF convention and are NOT yet verified against IRIS's own submission requirements.** Section 7 moves portal verification to **today**: open a registration account on iris.exstemplar.com, walk the form to the last screen without paying, and screenshot every required field, upload and signature — including whether registration needs a school/teacher account rather than a student one. That one hour converts this whole table from assumption to fact, and it is the cheapest de-risking action available on 31 August.

| Question | Answer, written into the Research Plan |
|---|---|
| Are there human participants? | **No.** No survey, no questionnaire, no trial, no observation of persons — including at the demo table, per the rule above. |
| Vertebrate animals, pathogens, hazardous chemicals, controlled substances? | None. |
| Was the Research Plan approved before experimentation began? | **Yes** — Adult Sponsor signs in week 1, before any code that generates reported data. Signature by 6 September. |
| Is the data less than 12 months old? | **Yes** (verified requirement). The experimental data is simulation output generated by the student's own code in September 2026. Public corpora are *inputs* to the apparatus, not the experimental data. State this distinction in one sentence so the SRC never has to guess. |
| Is this the student's own work? | Yes. Mentors are consulted for validation and named in **Acknowledgements only** — never as co-researchers. Keep the emails. |
| Corpus licensing? | IndicDialogue is OpenSubtitles-derived. **Cite and link; do not redistribute.** Report aggregate statistics only. FLORES-200, IN22 and BPCC are openly licensed for research. |
| Forms needed | *Assumed:* Form 1, Form 1A, Form 1B, Research Plan; no Form 3, no Form 4. **Confirm against the live IRIS portal today.** |
| Team size | **Verified:** individual or a team of exactly two. ⚠️ **Ask IRIS support in writing this week whether a two-student entry can be reduced to one after submission**, and keep the reply — see Section 8. |

### Mentors (zero cost, high value, currently absent)

**Send the emails on 31 August, not 5 September**, with a fallback date and more than two recipients. Volunteer maintainers routinely take two to four weeks or never answer, and Section 10 identifies this as the project's single biggest dependency if the decomposition rubric cannot be self-defended.

1. **Swathanthra Malayalam Computing / the mlmorph maintainers** — validate the hand-authored Malayalam decomposition rubric and legality set. Also ask, separately, whether anyone there can endorse an arXiv submission (Section 6).
2. **The SMC mailing list / Matrix channel** — same ask, broader audience, costs nothing.
3. **A Malayalam teacher at his own school** — free, local, available this week, and entirely sufficient to sign off a one-page rubric.
4. **A special educator at a Kozhikode CP or special school** — one paragraph confirming switch scanning is genuinely used in Malayalam and genuinely slow. **Do not recruit anyone as a participant.**

**Hard fallback: 10 September.** If SMC has not replied, the Malayalam teacher signs off the rubric and is named in Acknowledgements. The rubric is written as a one-page table with worked examples so any reviewer can validate it in ten minutes.

---

## 6. HOW IT MAPS TO EACH COMPETITION

### IRIS National Fair — primary target

**Category: Systems Software** (verified as a real IRIS category; window 1 Aug – 3 Oct 2026, no extensions). Alternate: Embedded Systems — but Systems Software is right, the contribution is an algorithm.

**Framing, in the words to actually use:** *"Optimal scan trees have been solved for flat alphabets, and context-conditional trees exist for English. Indian scripts are not flat: the set of legally-typeable next symbols changes at every step. We ask how much a hard legality constraint adds over a soft n-gram model, measure it on five Brahmic scripts with English as a negative control, and give a working device."*

This hits algorithmic depth and an assistive device with a named beneficiary and measured performance simultaneously. Very few projects sit in both lanes.

**Team:** exactly two — the student plus one classmate. Written split: the student owns the simulator, constraint layer, trees and statistics; partner owns corpus preparation, the two boxes, the bilingual data book, and the poster. **Nothing on the critical path to 7 September depends on the partner.** Administratively: get the IRIS answer on reducing a team of two to one in writing, and **decide by 20 September** — before the abstract locks — whether to submit as an individual and credit the partner in Acknowledgements. That removes the risk entirely at the cost of one pair of hands.

### Kerala School Sasthrolsavam — September sub-district, October district, November state

⚠️ **Entry rules are UNVERIFIED.** "Working Model, group of 2" and the record-book requirement are asserted with no citation to the current KITE manual, and our local winners file records `data_status: not_found` for every year 2022–2026 because results live behind the KITE portal. Whether a box whose logic runs on a laptop counts as a **Working Model** rather than a software entry is exactly the judgement call that disqualifies an entry at the table.

**Action, today:** get the current-year manual from the school SITC or the science club convenor, read the Working Model definition and the record-book requirement **verbatim, and quote them into this plan.** Confirm school-level entry status and deadline. If the manual demands standalone operation, BOM line 11 (Pi Zero) becomes a requirement, not a stretch goal, and the budget scenario changes with it.

**The demo, in thirty seconds:** two identical boxes, one button each. The judge types the same Malayalam sentence on both. The counters tally — on the boxes and mirrored large on the laptop. Box A is what ships on every Android phone today; the ratio is whatever the 4 Sep audit measured, stated as a measurement. The judge feels it in their own thumb. Auditory scanning plays through the speaker so a blind visitor gets the same demo. Then flip to the screen recording of real Switch Access struggling with a koottaksharam.

**Three hard rules for the table:**
1. **CPU-only, fully local, no internet.** KITE venues commonly have no WiFi. Rehearse with WiFi **off**. A laptop that cannot demo scores zero.
2. **The press counter is the argument.** Large digits, verified legible from three metres — hence the display change and the laptop mirror.
3. **The data book runs from 8 Sep** (see below), not written from memory in week 5.

**One bilingual data book, not two.** Sasthrolsavam requires a daily record book in Malayalam; IRIS/ISEF expects a project data book documenting the research. These are two documents, in two languages, with different conventions, both starting week 2, both owned by the person the risk table rates most likely to drift. So: **a single dated book, English technical log in the left column, Malayalam summary in the right.** the student writes the technical column daily as he codes — five minutes. The partner writes the Malayalam column. One artifact satisfies both fairs, and neither can be reconstructed in week 5.

### What else this feeds

- **A publicly citable artifact.** ⚠️ arXiv requires **endorsement** for cs.CL/cs.HC for a first-time author with no institutional affiliation, which a school student in Kozhikode very likely cannot get unassisted. So: **Zenodo is the primary venue** (DOI, no endorsement, no gatekeeping); TechRxiv or OSF Preprints as alternates; **arXiv is a bonus contingent on an endorser**, which is the second thing to ask the SMC mentor for. Alongside it: the code and scan trees on GitHub under an open licence, a short paper offered to a workshop or the SMC/FOSS community, and **an issue opened on the Jellow or Avaz tracker offering the scan trees**. That last one is the artifact judges actually weigh — evidence someone could adopt this.
- **Apple Swift Student Challenge (~Feb 2027).** The scan tree ports to a Swift Playground almost directly.
- **INAIO (~Dec 2026).** The entropy/decision-tree core is directly relevant.
- **NASA Space Apps (14–15 Nov 2026):** separate weekend, unrelated, don't mix them.

---

## 7. WEEK-BY-WEEK PLAN

**Today is 31 August. Weeks 1–2 are deliberately laptop-only, so first-terminal exams cannot destroy them.**

### Week 0 — 31 Aug – 6 Sep: verify rules and money BEFORE spending, de-risk everything cheap

- **31 Aug (today), in this order:**
  1. **EWS fee-waiver eligibility — first, before anything.** Find the exact document required (typically a state income/community certificate), its issuing office, and its turnaround time. **No part is ordered until this is answered**, because Scenario A and Scenario B are different builds.
  2. **Open an IRIS registration account and walk the form to the last screen without paying.** Screenshot every required field, upload and signature. Note whether a school/teacher account is required.
  3. **Get the current Sasthrolsavam manual**; read the Working Model definition and record-book requirement verbatim; confirm school-level entry status and deadline. **This may already have closed.**
  4. **Confirm the exact Kerala HSS first-terminal exam dates.** The plan is unschedulable without them.
  5. **Send all four mentor emails** (Section 5). Fallback date 10 Sep.
  6. **Email IRIS support in writing:** can a two-student entry be reduced to one after submission?
  7. Confirm the partner in writing. Email the Adult Sponsor for a meeting.
- **1 Sep:**
  - **90-minute Python screening exercise, before any plan depends on the answer:** build a Huffman tree from a frequency dict using `heapq`, and verify it against a hand-computed 6-symbol example. If that fails, the constraint layer simplifies to a legal-successor lookup table, C3 uses a plain Huffman baseline, and **the deviation is stated in the paper.** Better to know today than on 11 September.
  - Install `mlmorph` in a **Python 3.10 venv** and **record the exact failure text if it fails** — the "SFST/pybind11 on 3.12/3.13" risk is an assumption, not a documented constraint, so the fallback decision must be evidence-based. Written fallbacks: the `morph.smc.org.in` HTTP API, or a suffix-lexicon segmenter.
  - **Measure mlmorph coverage yourself:** run it over 10,000 held-out Malayalam tokens, report analysed/total. That is a real, cheap, citable number of our own.
  - Download FLORES-200, IN22, BPCC-H-Daily Malayalam subset (correct subset only). **Immediately produce the measured sentence/character count table** and set the binding minimum.
  - **One evening: run and log the prior-art search** (Section 2). Save queries, date, screened count. Pull the two TNSRE 2008 papers by DOI and confirm volume, issue, title and author order.
  - **Verify Avaz and Jellow on-device:** web check done 31 Aug (Jellow: Malayalam + external switches; Avaz: Malayalam, switch scanning unstated). Install Jellow from the Play Store, screenshot the language list and switch-access menu, count presses for one koottaksharam. Email Avaz support asking in writing whether single-switch auto-scanning is supported; screenshot the reply.
- **2–3 Sep:** Unicode normalisation, written **once and script-parameterised** for all six scripts, plus the round-trip validation script. **Budget two full days** — atomic chillu vs ZWJ, ZWNJ, nukta and reph, ya-phala and ra-phala, grantha, and both Malayalam orthographies encodable multiple ways in scraped text. Getting this wrong silently corrupts every number with no error message. Unit tests. Report the per-language round-trip failure rate.
- **4 Sep:** The Switch Access screen recording and press-count audit (Section 4). One evening. **This is the first moment any ratio between Box A and Box B may be stated aloud.**
- **5 Sep:** Adult Sponsor signs Forms 1/1A and the Research Plan. **Order parts — the scenario chosen by the waiver answer**, with header pre-soldering verified on each product page at order time. Confirm shipping cost and delivery time to Kozhikode; parts are needed by 19 Sep.
- **6 Sep:** Akshara segmenter + PPM/SPC simulator written and tested against hand-computed examples.

### Week 1 — 7–13 Sep: two gates, not one

- **7 Sep — GATE 1 (Layer 1; no optimal solver required).** C0/C1/C2 presses per message on Malayalam **and** English, on the matched parallel corpus **and** BPCC-H-Daily, with bootstrap CIs. **Decision rule, fixed in writing now:**
  - Is the naive-English vs naive-Malayalam PPM gap ≥1.3×? **Yes/No.**
  - If the gap is under 1.2×, **drop Claim 2 on the spot** and rebuild the paper around Claims 1, 3 and 4. Those are the better half anyway.
  - If the simulator produces no numbers at all for C0–C2 by 7 Sep → see Section 9, switch.
- **8–10 Sep:** Build C3 (static flat tree) and **C3b (context-conditional flat tree, Roark re-implementation)**.
- **11 Sep — GATE 2.** C3 and C3b running. **Does the English pipeline reproduce MacKenzie 2012's SPC = 2.45 on Brown?** Yes/No. If C3b cannot be built by 11 Sep, fall back to a plain Huffman C3 baseline, state the deviation explicitly in the paper, and continue — this is not a project-switch trigger.
- **12–13 Sep:** Build the C4 constraint-gated tree on the learned legal-successor sets. Start the bilingual data book (from 8 Sep). Parts arrive; partner assembles Box A.

### Week 2 — 14–20 Sep: the contribution

- **14 Sep:** **C3b vs C4 on Malayalam**, BCa bootstrap CI on paired differences. **This is the number the whole project rests on.** C4-vs-C3 reported alongside as the combined effect.
- **15–18 Sep:** Extend to Kannada, Tamil, Devanagari, Bengali — legality sets learned by the same script-agnostic procedure, top-10 illegal-transition tables produced per script. English negative control run with the identical procedure; evaluate the ≥3× ratio bound and the TOST bound. Normalisation round-trip rates recorded per language (the normaliser is already written, which is why four days is enough).
- **19–20 Sep:** Both boxes finished and rehearsed offline. **Sub-district Sasthrolsavam demo is ready.**
- **20 Sep:** **Decide team-of-two vs individual submission**, using the IRIS reply.

### Week 3 — 21–27 Sep: generality, error-robustness, morphology

- **21 Sep:** Scaling-law figure — PPM vs script complexity, six languages, with the Malayalam-validated / four-scripts-data-derived split stated on the figure. **Error-rate condition run** (miss probability 0.05 and 0.10 with undo cost) — does the C4 advantage survive?
- **22–24 Sep:** C5 vs C6 morpheme-vs-word control. Report measured mlmorph coverage.
- **25 Sep:** Domain robustness across three corpora — the pre-registered test is that the *ranking* replicates. All figures final.
- **26 Sep — ONE-PAGE ABSTRACT DUE (internal).** Locked, proofread by the Adult Sponsor, not touched again except for typos.
- **27 Sep:** Research paper first draft complete, including the prior-art search log appendix.

### Week 4 — 28 Sep – 3 Oct: submit early

- **28–29 Sep:** Paper final. Prior-art table on the poster (Higger, Roark, Bhattacharya/Basu/Samanta by confirmed DOI, MacKenzie 2012 with SPC 2.45–7.45, the Finnish/Turkish morph paper, plus the *verified* Avaz and Jellow findings and their screenshots).
- **30 Sep — SUBMIT TO IRIS.** Three days before the hard deadline. **Do not submit on 3 October;** portals fail on deadline day, every year, everywhere.
- **1–3 Oct:** Buffer. If everything is done and the manual requires it, build the Pi Zero standalone upgrade.

### October – November: the fair season

- **Early–mid Oct:** District Sasthrolsavam. Bilingual data book complete. Rehearse the 30-second and 3-minute pitches until automatic.
- **Mid-Oct – Nov:** State Sasthrolsavam. Post to Zenodo, release the code, open the issue on the Jellow/Avaz tracker — a timestamped public artifact is worth citing in the IRIS interview.
- **Nov:** IRIS SRC review and national fair. Prepare for exactly four questions: *"Why isn't your baseline Roark's Huffman scanning?"*, *"What's new versus Higger 2016?"*, *"Why is presses-per-message the right metric when it ignores errors?"*, and *"Did you fit and test on the same data?"* One rehearsed sentence each.
- **Throughout:** board-exam prep resumes as the priority from 4 October. The fairs run on already-finished work.

---

## 8. RISKS AND HONEST ODDS

| Risk | Severity | What we do about it |
|---|---|---|
| **The hard constraint adds little over the soft LM** (C4 barely beats C3b) | Medium | Pre-registered as a reportable negative result with an entropy explanation. Layers 1, 2 and 4 survive intact. The demo is unaffected. This is now an anticipated outcome, not a surprise. |
| **Unicode normalisation done wrong across five scripts** → numbers silently corrupted | **High** | One script-parameterised normaliser, two dedicated days, unit tests, and a per-language round-trip rate **reported as a results row**. The most dangerous silent failure in the project, converted into a published control. |
| **Nobody on the team can validate legality rules for Kannada, Tamil, Devanagari, Bengali** | **High** | No hand-authored FSTs for scripts we cannot read. Legality is learned from train-split unit bigrams by one procedure for all six languages. Malayalam is hand-authored and SMC-validated; the other four are labelled data-derived replication **in the paper, in those words**. Top-10 learned illegal transitions per script are printed so a native-reader judge can spot-check. |
| **Budget exceeds the family ceiling** | **High** | Two explicit scenarios (Section 3). Waiver answer first, order second. Worst case ₹10,380, stated to the family before a rupee is spent. |
| **The 7 Sep gate concentrates every unknown into seven days** | **High** | Split into GATE 1 (7 Sep, C0–C2, no solver) and GATE 2 (11 Sep, C3/C3b). The heapq screening exercise runs 1 Sep, so the hardest code has a known fallback ten days before it is needed. |
| **mlmorph won't install** | Medium | Attempted day 1 in a 3.10 venv with the exact failure text recorded, two written fallbacks. Only Layer 4 depends on it. |
| **Partner drifts, or leaves after submission** | Medium | Nothing on the critical path to 7 Sep depends on them. IRIS asked in writing about reducing a team of two to one; decision locked 20 Sep. Their ownership is boxes, data book, poster, corpus prep — all recoverable. |
| **First-terminal exams eat September** | High probability, low impact | Weeks 0–2 are laptop-only work in 45-minute blocks. ⚠️ **Exam dates are still unknown and must be confirmed today** — the schedule is not verifiable until they are. |
| **A judge who knows the AAC literature** | Medium | Higger, Roark, Bhattacharya, MacKenzie 2012, the Finnish/Turkish paper, Avaz and Jellow **on your own poster**, plus the search-log appendix. And C3b exists specifically so the Roark question has an answer. |
| **Sasthrolsavam rules turn out to exclude us** | Unknown — **check today** | Manual read verbatim today. If a Working Model must be standalone, the Pi Zero becomes a requirement and the budget scenario changes. If the entry has closed, IRIS is unaffected. |

### Honest odds — **subjective priors, internal copy only**

These are my estimates, not base rates. They have no derivation and **none of them goes on anything a judge sees.** Note also that the local IRIS winners data is marked `partial` or `not_found` for every year, and only one of the three named CS grand-award examples (Flikcer, 2022) carries a source URL — three data points, one sourced, is an anecdote, not a pattern, and should be described that way if it is described at all.

- Complete, honest, submitted IRIS entry with real experimental data by 3 October: **~90%.** The number that matters most.
- Layers 1 and 2 existing and defensible: **~95%.**
- Layer 3 (C4 beats C3b by a reportable margin): **~55%** — lowered from 65%, because C3b is a genuinely stronger baseline than C3 and beating it is the real test.
- Shortlisted for the IRIS national fair: **~25–35%.**
- IRIS grand award / ISEF selection: **~5–8%.**
- Sasthrolsavam sub-district → district: **~70%.** State: **~30%.**
- Something publicly citable by December (Zenodo DOI + released code + open scan trees): **~85%**, and this is the outcome most likely to make the work known nationally, independent of any fair result. Do not undervalue it.

---

## 9. RUNNER-UP (FALLBACK)

**KozhiSign, amputated — the font-controlled Malayalam orthography experiment.** Keep only the part that is a real causal contrast: Malayalam is one of very few scripts where a single Unicode string has two legal renderings, so you can vary glyph shape while holding content, length, vocabulary and character identity *exactly* constant. Render ~300 words in 4–6 fonts (traditional-rendering vs reformed-rendering, **verified by a render-and-diff script on day 1 — Anjali Old Lipi, Rachana and Meera are all traditional faces, so the original build plan's font assignment is backwards**) × 5 viewing conditions, run four public recognisers, and report paired McNemar per font pair. Add **Kannada and Telugu as negative controls** — same benchmark accuracy, no orthographic reform, therefore no rendering pair to vary — which pre-empts the objection that kills the project. Deliver the result **at the glyph level**: a ranked failure map of the conjunct clusters that break each recogniser, plus targeted synthetic augmentation that recovers accuracy on exactly those clusters. Delete every mention of the 34-point gap. Field capture of Kozhikode signboards shrinks to ~500 words, used only to show those clusters occur at real-world frequency.

**Trigger condition for switching — now keyed to GATE 1, which is deliberately the easy gate.** **On 7 September, if the simulator has not produced C0–C2 presses-per-message for both English and Malayalam on the matched parallel corpus, switch to KozhiSign that evening.** No debate, no extension. That gate needs no optimal solver, so failing it means the pipeline itself is broken — which is a real signal, not a schedule artifact.

Two supporting triggers, neither of which is a project switch: if C3b cannot be built by **11 September**, fall back to a plain Huffman C3 baseline and state the deviation. If the constraint layer cannot produce a legal-set at every node by **14 September**, drop to the Layer 1+2+4 version of AksharaScan — the paper still stands. And if week-0 normalisation reveals the corpora are too inconsistently encoded to trust, switch immediately, because that defect would poison every number either way.

Note the useful asymmetry: **the week-0 Malayalam Unicode work transfers to KozhiSign completely.** Switching on 7 September costs about three days, not a week.

---

## 10. WHAT WE STILL NEED FROM THE STUDENT

Six facts. Each can change the plan; **items 1–4 must be answered today**, because parts, money and the schedule all hang on them.

1. **EWS fee-waiver eligibility — the exact document required, the issuing office, and the turnaround time.** *This decides which of the two budget scenarios is real, and no part is ordered until it is answered.*

2. **The Kerala HSS first-terminal exam dates, and whether Sasthrolsavam school-level entry is still open — plus the manual's verbatim definition of "Working Model" and its record-book requirement.** *The exam dates determine whether weeks 1–2 need compressing; the manual determines whether the Pi Zero is a stretch goal or a requirement, and whether the Sasthrolsavam arm exists at all.*

3. **What the IRIS portal actually asks for.** *Open an account, walk the form to the last screen without paying, screenshot every field, upload and signature. One hour converts every rules assumption in Section 5 into fact.*

4. **What is his actual Python level — specifically, can he pass the 1 Sep 90-minute exercise (build a Huffman tree with `heapq`, verify against a hand-computed 6-symbol example)?** *The scan-tree construction is the one genuinely non-trivial piece of code. If he cannot, the constraint layer becomes a legal-successor lookup table, C3 becomes plain Huffman, the deviation is stated in the paper, and week 0 gets two extra days on trees. Knowing this on 1 September costs nothing; discovering it on 11 September costs the project.*

5. **Does the student read and write Malayalam fluently — and can he consciously identify akshara components (base consonant, vowel sign, chillu, virama, conjunct) and defend a decomposition rubric to a judge?** *Most fluent readers parse both orthographies without noticing the structure. If the answer is no, the rubric must be signed off by SMC or by his own Malayalam teacher by 10 September — which is why all four mentor emails go out today rather than on the 5th. Note that this dependency now applies to **Malayalam only**: the other four scripts are data-derived by design precisely so that nobody has to defend rules they cannot read.*

6. **Does he have an Android phone he can enable Switch Access on, with a Malayalam IME, and can he screen-record it — and can a USB/Bluetooth HID switch adapter drive it?** *Without the phone, the C1 baseline becomes an assumption, which is the classic way an optimisation project gets dismantled in judging. Without the adapter, Box A falls back to our own re-implementation and must be labelled as an idealised baseline on the panel, out loud, every time.*

Answer these six, and the plan above is executable starting tomorrow morning.