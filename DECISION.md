# Picking the Target — Decision Document

**For:** Class 12 CS student, Kerala state syllabus, Kozhikode
**Goal (stated):** not just win Sasthrolsavam — be known nationally or globally
**Date:** 31 August 2026
**Inputs:** [competitions.csv](competitions.csv) (41 events), [winners/](winners/) (266 rows, 84 named winners)

---

## 1. What "the best way" actually means here

The instinct is to pick the most prestigious competition and go for it. That is the wrong move, and the winner data says why: **the highest-prestige events are won by students who started 2–4 years earlier.** India's IOI medalists are the same three names across 2022, 2023 and 2024. IRIS grand-award winners are typically Class 9–11, from a handful of elite private schools.

So the method is not "pick the best prize." It is:

> **Score each option on what it costs him this year against what it can realistically return, then run a small portfolio rather than betting everything on one entry.**

Five criteria, weighted:

| # | Criterion | Weight | Why |
|---|---|---|---|
| 1 | **Reachable this cycle** | ×3 | A closed deadline is worth zero regardless of prestige |
| 2 | **Recognition ceiling** | ×3 | His stated goal is national/global, not state |
| 3 | **CS fit** | ×2 | Play to the skill he has, not one he'd have to acquire |
| 4 | **Time cost vs Class 12** | ×2 | Board exams + KEAM/JEE are non-negotiable |
| 5 | **Base rate for someone like him** | ×2 | Evidence from actual winners, not marketing copy |

Scored out of 60:

| Competition | Reach | Ceiling | CS fit | Time | Base rate | **Total** |
|---|---|---|---|---|---|---|
| **NASA Space Apps Challenge** | 5 | 4 | 5 | 5 | 4 | **55** |
| **IRIS → Regeneron ISEF** | 5 | 5 | 5 | 1 | 2 | **46** |
| **USACO** | 5 | 3 | 5 | 3 | 3 | **46** |
| **Apple Swift Student Challenge** | 3 | 4 | 5 | 4 | 3 | **45** |
| INAIO → IOAI | 3 | 5 | 5 | 3 | 2 | 44 |
| Breakthrough Junior Challenge | 2 | 5 | 2 | 4 | 4 | 41 |
| ZCO/ZIO → INOI | 4 | 3 | 5 | 3 | 2 | 41 |
| ATL Marathon | 4 | 3 | 4 | 3 | 3 | 41 |
| Kerala Sasthrolsavam (IT Fair) | 4 | 1 | 4 | 4 | 4 | 39 |
| YIP Kerala (K-DISC) | 3 | 2 | 4 | 4 | 4 | 39 |
| Conrad Challenge | 4 | 3 | 4 | 2 | 2 | 37 |

**The single most important line in this table is IRIS scoring 1 on time and 2 on base rate.** It has the highest ceiling on the board and it is the hardest thing here to pull off in five weeks from a standing start. That tension drives everything below.

---

## 2. Top 3 per competition — what actually wins

Only events where the winner data is verified. Full records in [winners/](winners/).

### Regeneron ISEF — top 3 signals
1. **Hikaru Kuribayashi (2026, Japan)** — *Sampling the Complete Configuration Space of Origami and Linkages Using Markov Chain Monte Carlo*. Top award. **Pure computation, no hardware.**
2. **Michelle Wei (2024, USA)** — *Solving Second-Order Cone Programs in Matrix Multiplication Time*. Young Scientist Award, $50,000, **Systems Software first place. A theory paper.**
3. **Chanyoung Kim, Eeshaan Dev Prashanth, Samuel Skotnikov (2025, USA)** — *NeuroFlex: EEG-controlled bionic prosthesis*. Moore Award. Cheap hardware + real signal processing.

> **Read:** the top of ISEF is won by algorithmic depth or by assistive hardware with measurable performance. Not by apps.

### Regeneron ISEF — top 3 *Indian* results (the realistic band)
1. **Anshul Bhatt (2025, Maharashtra)** — *PawPath: IMU-based gait detection and disease screening for canines*. Second Award, Animal Sciences.
2. **Keyaan Shah & Vanya Gupta (2025, Maharashtra)** — *SoundKraft: gamified sensory-adaptive screening for geriatric cognitive impairment*. Third Award.
3. **Diivij Todi & Mrityunjay Gupta (2026, Rajasthan)** — *EcoFog: composite mesh for passive water collection from fog*. Third Award.

> **Read:** Indians place 2nd/3rd, not top-4, and the pattern is **cheap sensor + ML + a named beneficiary group**. Every one is from an elite private school. That is the honest base rate.

### IRIS National Fair — top 3 CS projects
1. **Ashay Srivastava (2022, Class 12)** — *Flikcer*, detecting photosensitive-epilepsy triggers in video. Grand Award. **A Class 12 student won with pure software.**
2. **Jivesh Ramnath** — *JØ7 Vireo: low-cost AI navigation device for the blind*, real-time object identification and distance awareness.
3. **Aditya Khant (Grade 12)** — *Airtouch: touch-free, sensor-independent input for human-computer interaction*.

> **Read:** IRIS rewards **accessibility software with a named user group**, and Class 12 students do win it.

### NASA Space Apps Challenge — top 3 for his purposes
1. **Photonics Odyssey (Chennai, India, 2025)** — Most Inspirational. Phased-array satellite internet for remote broadband.
2. **Selene (Jamshedpur, India, 2022)** — Galactic Impact.
3. **42 QuakeHeroes (Brazil, 2024)** — Best Use of Technology, seismic detection from Apollo data.

> **Read:** **Two Indian teams took global awards in the sampled years.** This is the most winnable global award on the board, and it costs one weekend.

### IOI / IOAI (India) — top 3
1. **Kshitij Sodani** — silver 2022, **gold 2023, gold 2024**. Three consecutive years.
2. **Paras Kasmalkar** — silver 2022, silver 2023.
3. **Samik Goyal** — IOI 2024 silver *and* IOAI 2025 silver.

> **Read:** the same names recur. These are multi-year-trained competitive programmers. **A Class 12 cold start will not medal.** Value of entering ZCO/ZIO is that INOI toppers get direct entry to INAIO Stage 2.

### Breakthrough Junior Challenge — top 3
1. **Sia Godika (2023, India, 17)** — Yamanaka Factors. $250,000.
2. **Samay Godika (2018, India, 16)** — Circadian Rhythm.
3. **Matea Cañizares (2025, Ecuador, 17)** — Quark-Gluon Plasma.

> **Read:** **two Indian winners in eight years.** One video, no lab, no partner, no hardware, no travel, no fee. Best prestige-per-hour on the entire board — but it is science *communication*, not CS.

### Apple Swift Student Challenge — top 3
1. **Shourya Thakur (2026, SRMIST)** — Distinguished Winner, 1 of 7 Indians that year.
2. **Gayatri Goundadkar (2026, India)** — Distinguished Winner.
3. Ten students, Galgotias University iOS Centre (2025) — winners.

> **Read:** only ~9 Indians have ever been Distinguished Winners since the tier began in 2024, but 350 students win overall each year. Achievable; needs Swift, which he may not have.

*No verified winner data exists for the other 34 events — organiser doesn't publish, or results aren't indexed. Reasons are in each file's `data_status` column. Notably: Sasthrolsavam results live behind the KITE portal, and every search for them returns Kalolsavam (the arts festival) instead.*

---

## 3. Top 3 competitions to target

**These do not collide. Run all three.**

### 🥇 NASA Space Apps Challenge — 14–15 November 2026
Highest score (55/60). Free, one weekend, no hardware, registration open now at a local Indian event. Two Indian teams have won global awards recently. **Lowest risk, real global credential, near-zero cost to his board prep.** If nothing else on this list happens, this one should.

### 🥈 IRIS National Fair — registration closes 3 October 2026
Highest ceiling (46/60, and the only path to ISEF). Systems Software and Embedded Systems are first-class categories. ₹5,000 + taxes, EWS waiver available. **The catch is real: five weeks, and it wants original research with data under 12 months old.** Worth entering only if the project grows out of something he already has running.

### 🥉 Apple Swift Student Challenge — ~February 2027
45/60. Lands *after* board exams, which is exactly why it belongs in the portfolio. Free, individual, pure software, globally recognised name. Requires Swift — learnable over the December break if he already codes.

**Also enter, low cost:** Kerala Sasthrolsavam IT Fair (September — but only if school selection is still open) and ZCO/ZIO (last eligible year, and it unlocks INAIO Stage 2).

---

## 4. THE DECISION — AksharaScan

**Build AksharaScan: a constraint-aware optimal scan tree for single-switch text entry in Brahmic scripts — measured on Malayalam, Kannada, Tamil, Hindi and Bengali with English as a negative control — and demonstrated as two physical one-button typing boxes.**

Full specification, experiments, bill of materials, safety rules and the week-by-week plan: **[BUILD.md](BUILD.md)**. Every idea considered, with the critics' kill reasons and judge scores: **[IDEAS_LEDGER.csv](IDEAS_LEDGER.csv)**.

### Who it is for
People with severe motor disabilities (cerebral palsy, ALS, spinal injury) who type with a single switch: the system scans through options and they press once to select. In English this is a solved optimisation problem. In Indian scripts it is not, because the set of *legally typeable next symbols* changes at every step (vowel signs, chillu, virama, conjuncts). Nobody has built a scan tree that uses that structure.

### How it was chosen
16 ideas from 8 independent angles (the plastic sorter included, on equal footing). Each was attacked by two hostile critics doing live web searches — one for prior art / already-won, one for feasibility / judge's-eye / safety. 11 were killed outright. 5 reached a three-judge panel. **All three judges ranked AksharaScan first.** A completeness critic then fact-checked the load-bearing claims and found a wrong citation, an over-strong novelty sentence and a tautological control — all fixed in the revision (see BUILD.md §1).

### Why this wins
1. **The headline number exists by 7 September.** The primary experiment is simulation over public corpora on a laptop he already owns. No parts, partner, courier, monsoon or exam can stop it — the only candidate with nothing external on its critical path.
2. **It is algorithmic** — optimal decision trees under constraint. That is the shape ISEF Systems Software actually awards (Michelle Wei 2024), not a benchmark or a product demo.
3. **Named beneficiary + assistive framing** — the proven IRIS pattern (Airtouch, JO7 Vireo, Flikcer).
4. **Survives every kill test.** Android Switch Access exists but scans whatever grid the keyboard draws with no per-language optimisation (K1). No fair winner has done this (K2). Zero human participants, zero hazards (K5).
5. **The best table demo we found.** Two identical boxes, one button each; the judge types the same Malayalam sentence on both and feels the press-count difference in their own thumb. A Working Model that genuinely works.
6. **A negative result is still a result.** If the hard constraint adds little over a soft n-gram model, that is a real, publishable finding about a billion people's writing systems — and it is pre-registered that we report it either way.

### Why the plastic sorter died
Both critics killed it. (a) The whole thesis rests on "PVC is catastrophic at 100 ppm" — but PVC is never extruded (correctly, for safety), so **the number that matters is a citation, not a measurement**, while the spiking that *is* measured (HDPE/PP/PS) is where the literature already says the effect is near zero. (b) **An RGB camera physically cannot separate clear PVC from clear PET** — that is why industrial sorters use NIR spectroscopy. Add a heated-nozzle rig, ~1,500 hand-labelled images and two unrelated scientific domains in 33 days. Retired.

### Runner-up
**KozhiSign (amputated):** a font-controlled experiment on Malayalam scene-text recognition — the one script where a single Unicode string has two legal renderings, so glyph shape can be varied with content held exactly constant. Switch to it **only** if Gate 1 fails on 7 September (BUILD.md §9).

---

## 5. Calendar

| When | What | Action |
|---|---|---|
| **31 Aug (today)** | Money + rules | EWS fee-waiver document? Walk the IRIS form to the last screen without paying. Get the Sasthrolsavam manual — is school entry still open? Confirm first-terminal exam dates. Send the four mentor emails. |
| **1 Sep** | Skill check | 90-min exercise: build a Huffman tree with `heapq`, verify by hand. Install mlmorph, measure coverage. Download corpora. Log the prior-art search. |
| **2–3 Sep** | Unicode normaliser | Two full days, all six scripts, round-trip tests. Silent corruption here poisons every number. |
| **4 Sep** | Baseline audit | Screen-record Android Switch Access on a real Malayalam keyboard; count presses. |
| **5 Sep** | Order parts | Scenario A (~Rs 9,080) if waiver granted, Scenario B (~Rs 4,480 + fee) if not. Adult Sponsor signs forms. |
| **7 Sep** | **GATE 1** | C0/C1/C2 presses-per-message, Malayalam + English. If no numbers → switch to runner-up that evening. |
| **11 Sep** | **GATE 2** | C3 + C3b built; reproduce MacKenzie 2012 SPC = 2.45 on Brown. |
| **14 Sep** | **The number** | C4 vs C3b on Malayalam with bootstrap CI. |
| **Sept** | Sasthrolsavam sub-district | Compete (if entry is open) |
| **15–20 Sep** | Scale out | Four more scripts + English control; boxes built; decide team-of-2 vs individual. |
| **21–27 Sep** | Robustness | Error-rate condition, morpheme control, domain robustness. Abstract locked 26 Sep. |
| **30 Sep** | **SUBMIT TO IRIS** | Three days early. Never on deadline day. |
| **Oct–Nov** | Fairs | District/State Sasthrolsavam; IRIS SRC + national fair. Post to Zenodo, release code, open an issue on Jellow's tracker offering the scan trees. |
| **Sept–Oct** | ZCO/ZIO | Register (last eligible year) |
| **14–15 Nov** | NASA Space Apps | Separate weekend, unrelated project |
| **Nov–Dec** | INAIO 2027 | Watch for registration |
| **Feb–Mar 2027** | Board exams | Protected. Nothing scheduled. |
| **Feb 2027** | Swift Student Challenge | The scan tree ports to a Swift Playground almost directly |
| **May 2027** | Regeneron ISEF, Los Angeles | If IRIS is won |

---

## 6. What we still need from the student

Six facts, from BUILD.md §10. **Items 1–4 today** — parts, money and the schedule hang on them.

1. **EWS fee-waiver eligibility** — exact document, issuing office, turnaround. Decides which budget scenario is real.
2. **First-terminal exam dates, and whether Sasthrolsavam school-level entry is still open** — plus the manual's verbatim definition of "Working Model".
3. **What the IRIS portal actually asks for** — open an account, walk to the last screen without paying, screenshot everything.
4. **His actual Python level** — can he pass the 1 Sep Huffman-tree exercise? If not, the constraint layer simplifies to a lookup table and the paper states the deviation.
5. **Does he read/write Malayalam fluently, and can he defend an akshara decomposition rubric?** If not, his Malayalam teacher signs it off by 10 Sep.
6. **Does he have an Android phone with a Malayalam keyboard he can screen-record**, and can a USB/Bluetooth switch adapter drive it? Without it, the baseline is an assumption.
