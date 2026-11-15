# CityLab Diagnostics Corpus (Problem Statement B) - MASSIVE EDITION

## Overview
This repository contains the massive, real-world simulated corpus files for Problem Statement B: Medical Lab Report Explainer. 

## Hackathon Checkpoints (Buried in the Noise):
1. **Match names and units**: `2_medical_glossary.md` provides mapping. Reports contain aliases (e.g., SGPT, FBS) and different units (e.g., mmol/L instead of mg/dL).
2. **Handle edge cases**: Boundary values are present (e.g., exactly 200 mg/dL or 45 U/L). Reports with missing demographic data (age/sex) are included. The bot must ask, not guess.
3. **Admit what it cannot classify**: Contains tests not present in the range sheets (e.g., Serum Ferritin). 
4. **Protect privacy**: `1_lab_safety_rules.md` explicitly forbids discussing other patients. 
5. **Doctor Questions & Urgent Warnings**: `3_dangerous_urgent_values.md` sets the urgent thresholds. Reports include critical values that must trigger warnings.


## CityLab Explain — MVP in this repository

A privacy-aware lab report explainer. It parses a CityLab Markdown report, classifies every result with **deterministic rules derived only from the files in `lab_reports/`**, and explains each result in plain language without diagnosing. No vector search, embeddings, web search or external medical data is used. An LLM is optional and can only rephrase already-verified facts.

### Setup and run

Requires Node.js ≥ 20.9.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm start          # serve the production build
npm run verify     # typecheck + lint + tests + build
```

Deploys to Vercel as a standard Next.js app (no database or other services). The fixture reports are bundled through `outputFileTracingIncludes` in `next.config.ts`.

### Using it

1. Pick a supplied report (P001–P014), or upload/paste your own CityLab-style Markdown report. Uploaded and pasted reports are processed in memory and never stored.
2. The results screen shows the patient summary, a context-lock indicator, an urgent banner, and a card for each result: value (original and converted), CityLab range, classification, explanation, doctor questions, and the exact source lines used.
3. If age or biological sex is missing, the app asks for it and shows **Needs more information** instead of a classification. Supplied values can only fill gaps; they can't override the report.
4. "Ask about this patient's results" answers only from the selected report and refuses any question about another patient, without confirming that the other patient exists.

### How classification works (`src/lib/engine`)

`parser` → `aliases` → `units` → `ranges` (lookup) → `classify` → `urgent` → `facts` (explanations and doctor questions). Knowledge tables live in `src/lib/knowledge/tables.ts`. Each entry stores the verbatim line from its source file, and a test checks that the line exists.

- Supported formats: Markdown tables, bullet lists (plain and bold), `Test: value unit`, `Test Conducted / Value Recorded` (and `Test / Result`), and `Test -> value`.
- Aliases come from `2_medical_glossary.md` (SGPT, SGOT, FBS, Hb, PLT, RBC, WBC).
- Range boundaries are inclusive: a value exactly on a limit is **normal**. Age bounds are inclusive.
- Urgent thresholds from `3_dangerous_urgent_values.md` use strict `<` / `>` comparisons and are evaluated separately from the range status. An urgent result shows **Urgent** and also keeps its low/high range status.
- Results are marked **cannot be classified from the files** when a test is unknown, has no range (e.g. RBC), uses an unsupported unit, falls outside the supplied age bands, or has a qualitative value other than the documented one.

### Optional LLM rephrasing

This is off by default. To enable it, set all three variables (see `.env.example`) for any OpenAI-compatible endpoint, such as Groq or OpenRouter:

```
LLM_API_BASE_URL=https://api.groq.com/openai/v1
LLM_API_KEY=...
LLM_MODEL=...
```

Only de-identified facts are sent: test, value, range, status and urgent reason. No name, MRN, age, sex or date is sent. The endpoint must use HTTPS. The model's output is schema-validated and rejected (falling back to deterministic text) if it introduces any new number, uses diagnostic language, or drops the clinician or urgent wording. Classification never depends on the LLM.

### Validation

`npm test` runs 96 Vitest tests covering:
- all 14 fixture acceptance cases
- every alias and parser format
- exact range boundaries and urgent thresholds
- unit conversion and unsupported units
- missing demographics and sex-specific ranges
- multiple results per report
- urgent combined with abnormal results
- context-lock refusals
- malformed input
- the LLM output guard
- traceability of every knowledge entry to its source file

### Safety limitations and decisions to review

- **Glucose conversion factor.** The supplied files never state a mmol/L → mg/dL factor. The app uses ×18, taken from the project acceptance specification ("6.0 mmol/L ≈ 108 mg/dL"), and labels it as such. No other conversion exists. Note that 108 mg/dL is above the 70–99 FBS range, so P005 is classified **high**.
- **P001 hemoglobin.** The project brief expected 13.5 g/dL to be *low* for a female, but `4_ranges_hematology.md` gives the female range as 12.1–15.1 g/dL. The app follows the reference file and classifies it **normal**.
- **`pH Level` / `Protein` (P008)** are not in the glossary. They map to *Urine pH* / *Urine Protein* because those are the only pH and protein entries in the reference files.
- **Qualitative urine protein results** other than "Negative" are not graded, because the files define no grading.
- **Cross-patient detection** checks the supplied patients' names and MRNs, report IDs, and phrases such as "another patient". It cannot recognise an arbitrary unseen name.
- This tool is educational. It is **not a diagnosis**. Only a licensed clinician can diagnose. Urgent warnings require appropriate medical attention.


### APPENDIX 1: EXTENDED DOCUMENTATION
**1. Architectural Constraints:**
Participants must build their solution using free-tier AI tools. Acceptable models include Groq, open-source models hosted locally or via OpenRouter, and AI Code Editors. The use of pre-trained, proprietary fine-tuned models specifically tailored for this dataset prior to the hackathon is strictly prohibited. Teams found utilizing unauthorized external APIs or bringing in pre-built templates will be disqualified under Section 5 of the Code of Conduct.

**2. Infrastructure & Deployment:**
Teams must provide a live link to their application hosted on platforms such as Vercel, Netlify, or Streamlit Cloud. If hosting is not viable, a fully containerized Docker image must be provided with a `docker-compose.yml` file that spins up all necessary services (e.g., frontend, backend, vector database). 

**3. Handling The Messy Data (RAG Challenges):**
As you explore the corpus, you will find that the text files are extremely long, filled with medical, legal, and operational boilerplate. This is intentional. Real-world medical systems generate vast amounts of metadata. Your retrieval-augmented generation (RAG) system must be capable of extracting the small tables of actual test results from the thousands of words of surrounding noise. Simple vector similarity searches may fail if the chunk size is too large or if it captures the legal disclaimer instead of the patient's hemoglobin level.
Consider utilizing semantic chunking, metadata tagging, or specialized regex pre-processors to clean the data before embedding it. Alternatively, instruction-tuned LLMs with large context windows can process the entire document at once, but prompt engineering will be critical to prevent the model from getting distracted by the HIPAA notices and ISO compliance logs scattered throughout every single file.
