# NSW Council DA Transparency Dashboard (Assignment 3)

## Project Purpose
This project compares **public-facing DA information transparency** across selected NSW councils.  
The dashboard and outputs are intended for comparative analysis in Assignment 3, not for official council rating.

## Data Scope
- 12 councils
- 20 records per council
- 240 records total

## Raw Data Files
Filenames on disk (do not edit these in the pipeline; they are source inputs):

- `Burwood_Council.csv`
- `Campbelltown_City_Council.csv`
- `city of parramatta.csv`
- `city of sydney.csv`
- `Georges River.csv`
- `inner_west_council.csv`
- `Liverpool_City_Council.csv`
- `North Sydney.csv`
- `Ryde_City_Council.csv`
- `Sutherland Shire.csv`
- `Hunters_Hill.csv`
- `Willoughby_City_Council.csv`

## Standardised Dataset and Single Source of Truth
- Main snapshot: `normalized-records.json` (root)
- Dashboard copy: `frontend/public/normalized-records.json`
- Pipeline now auto-syncs root snapshot to frontend copy after generation.

## Standard Schema
- `council`
- `application_no`
- `address`
- `development_type`
- `description`
- `lodged_date`
- `decision`
- `decision_date`
- `has_progress_info`
- `has_documents`
- `status_clarity_score`
- `document_completeness_score`
- `update_visibility_score`
- `navigation_ease_score`
- `notes`

## Preprocessing Pipeline
- Multi-file loading and schema mapping in `src/data/load` and `src/data/normalize`
- Date standardization to `YYYY-MM-DD`
- Boolean normalization from source values (including `yes` / `no` for booleans)
- Decision harmonization (minimal)
- Audit output generated as `audit-report.json`
- Frontend data sync handled by `src/syncFrontendData.ts`

## Assignment 3 Modelling Approach

### Primary model: Evidence-Based Transparency with Documents (EBT-D, 0–100)
Rule-based composite for **public-facing DA information transparency** (not official council rating; not planning decision quality).

**Top-level weights**

    EBT-D =
      StatusVisibility × 0.25
    + ProgressVisibility × 0.25
    + DocumentVisibility × 0.25
    + BasicInformationCompleteness × 0.15
    + DataQualityReliability × 0.10

- **Status visibility (0–100):** `(status_clarity_score / 2) × 100`; missing/non-numeric treated as 0.
- **Progress visibility (0–100):** `has_progress_info_score × 0.5 + ((update_visibility_score / 2) × 100) × 0.5`;  
  `has_progress_info` true → 100; false / null / unknown → 0 for that half.
- **Document visibility (0–100):**  
  `has_documents_score × 0.5 + ((document_completeness_score / 2) × 100) × 0.5`  
  where `has_documents` true → 100 for `has_documents_score`, else 0; missing/non-numeric completeness → 0 in the normalised half.
- **Basic information completeness (0–100):** `(non-missing required fields / 7) × 100` for  
  `council`, `application_no`, `address`, `development_type`, `description`, `lodged_date`, `decision`.
- **Data quality reliability (0–100):** start at 100; −30 if date anomaly (decision date before lodged date, or only one of lodged/decision dates present); −20 if any required field missing; −30 if any rubric score outside [0, 2]; −30 if duplicate composite key (`council` + `application_no` + `address`); minimum 0.

**`navigation_ease_score`**  
- Retained in the dataset and in the **legacy** weighted transparency index. It is **not** a direct EBT-D pillar.

### Legacy benchmark (reference only): weighted transparency index (0–2 rubric mix)
The dashboard still computes the earlier weighted index (status / documents / updates / navigation) for continuity and sensitivity exports — **not** the Assignment 3 primary headline metric.

#### Legacy sensitivity scenarios (weighted index)
- Equal weight: 0.25 / 0.25 / 0.25 / 0.25
- Document-focused: 0.20 / 0.40 / 0.20 / 0.20
- Navigation-focused: 0.25 / 0.25 / 0.20 / 0.30

### Outputs
- Record-level EBT-D and components appear in `outputs/report_tables/combined_records_with_ass3_metrics.json` (field `evidence_based_transparency_score` holds the EBT-D value; `document_visibility_score` is the document pillar).
- Council-level averages (`avg_evidence_based_transparency_score`, `avg_document_visibility_score`, component averages, etc.) appear in `outputs/report_tables/council_transparency_summary.{csv,json}`.

## Scoring Rubric (0-2)
Status clarity score:
- 0 = No clear application status is visible.
- 1 = Status is present but vague, inconsistent, or requires interpretation.
- 2 = Status is clearly displayed and easy to understand.

Document completeness score:
- 0 = No supporting documents are visible.
- 1 = Documents are partially available, indirect, or difficult to access.
- 2 = Supporting documents are directly visible and accessible.

Update visibility score:
- 0 = No progress or update history is shown.
- 1 = Limited progress information is shown, but stages are incomplete.
- 2 = Clear progress history or workflow stages are visible.

Navigation ease score:
- 0 = DA information is difficult to find or requires many steps.
- 1 = Information is available but requires several clicks or interpretation.
- 2 = Key DA information is easy to locate and understand.

## Assignment 3 Generated Outputs
Run `npm run ass3:outputs` to generate:

### `outputs/report_tables`
- `combined_records_with_ass3_metrics.json`
- `council_transparency_summary.csv`
- `council_transparency_summary.json`
- `portal_source_comparison.csv`
- `portal_source_comparison.json`
- `data_quality_report.csv`
- `data_quality_report.json`
- `executive_summary_metrics.json`

### `outputs/model_outputs`
- `transparency_index_sensitivity_summary.csv`
- `transparency_index_sensitivity_summary.json`
- `transparency_index_explanation.json`

## Dashboard Pages
- Overview
- Council Comparison
- Charts
- Case Explorer

## How to Run
Install dependencies:
```bash
npm install
npm --prefix frontend install
```

Build data pipeline (normalize + audit + frontend sync):
```bash
npm run build:data
```

Generate Assignment 3 outputs:
```bash
npm run ass3:outputs
```

Run dashboard:
```bash
npm run dev:dashboard
```

Build dashboard:
```bash
npm run build:dashboard
```

## Interpretation Limits
- **EBT-D** is a comparative **public-facing DA information transparency** indicator built from checkable fields and simple quality rules.
- It is **not** an official council rating and does **not** assess planning decision quality.
- Portal heterogeneity may influence comparability.

## Deployment / Future Work
- Automate output versioning and report export snapshots
- Add richer missingness and anomaly visuals
- Add lightweight CI checks for data sync and output regeneration
- Extend reproducibility notes for team handover

## Difficulties Encountered (Project Context)
- Cross-council schema variation and naming differences
- Portal heterogeneity in status/progress/document visibility
- Handling date anomalies and preserving source truth without overwriting
- Need for explainable, non-official comparative scoring language

## Submission Package Checklist
- [ ] Raw CSV files (12 councils)
- [ ] `normalized-records.json`
- [ ] `audit-report.json`
- [ ] `outputs/report_tables/*`
- [ ] `outputs/model_outputs/*`
- [ ] Dashboard source in `frontend/`
- [ ] Data pipeline source in `src/`
- [ ] Updated `README.md`
