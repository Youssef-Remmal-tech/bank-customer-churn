# Power BI report

A five-page Power BI report for the churn project, saved as a **Power BI Project (PBIP)**. A PBIP stores the report and the semantic model as readable text files, so every visual, measure and data step can be reviewed and version-controlled, unlike a single binary `.pbix`.

**Open it:** download the repository, then open [`BankChurn.pbip`](BankChurn.pbip) in a current version of Power BI Desktop (Windows). The data is embedded in the model, so there are no file paths to fix and R is not needed. On first open, let Power BI load the import tables. To get a single `.pbix` file, use File → Save As.

## Pages

| Page | What it shows |
|---|---|
| **Overview** | KPI cards, exit rate by country, gender, age band and activity, with slicers for each |
| **Model Performance** | Held-out metrics for both trees, the two ROC curves on one chart, confusion matrices, and the cp tuning curve |
| **Tree Visualisations** | The Task 1 decision tree and the Task 2 tuned tree |
| **Interactive Prediction** | Choose a customer profile with 10 slicers and see the exit probability and predicted class from both trees side by side |
| **Data & Validation** | Data-quality checks, the split, and the tests that prove the prediction page scores exactly like R |

The report has 55 visuals, all with alternative text, on a 1280 × 720 canvas.

## The Gender fix, done properly

**The original problem.** The first version of this report scored customers with R script visuals. The trees were trained with `Gender` as a factor (Female = level 1, Male = level 2), but Power BI sent the slicer value as a number (0 or 1). Only the value that happened to match a level code gave a valid prediction, so the page worked for one gender only. `IsActiveMember` and `HasCrCard` carried the same hidden risk.

**The fix in this report.** Scoring no longer runs through R. Both trees are rebuilt as native DAX measures (`Prediction[Task 1 Exit Probability]` and `Prediction[Task 2 Exit Probability]`) using the exact split values from the saved R models:

- **Gender and Country are text slicers** (Female/Male, France/Germany/Spain), so there is no numeric code to misread.
- **The Task 2 measure converts those choices** into the one-hot columns caret used in training (`GenderMale`, `GeographyGermany`, `GeographySpain`).
- **No R at runtime** means the report also works in the Power BI Service, where R visuals are restricted.

**Proof.** Both DAX measures were checked against the R models on all 10,000 customers: 20,000 comparisons, 0 mismatches. This repository verifies the same thing independently. It parses the DAX from [`Prediction.tmdl`](BankChurn.SemanticModel/definition/tables/Prediction.tmdl) and scores every customer, and the Task 1 measure matches R exactly. See [`validation/`](validation):

| File | What it checks |
|---|---|
| `tree_translation_validation.csv` | R model vs DAX measure, 10,000 customers per tree |
| `metric_reconciliation.csv` | The report's metrics match the R hold-out results |
| `prediction_validation_cases.csv` | 12 reference profiles covering both genders, all three countries and both activity states |

## If you need R visuals instead

[`prediction_visual.R`](prediction_visual.R) is the corrected R visual script for anyone who wants to keep scoring in R. Every categorical input is cast back to the training levels before `predict()`:

```r
gender <- as.character(customer$Gender)
gender[gender == "0"] <- "Female"
gender[gender == "1"] <- "Male"
customer$Gender         <- factor(gender, levels = c("Female", "Male"))
customer$Geography      <- factor(customer$Geography, levels = c("France", "Germany", "Spain"))
customer$HasCrCard      <- factor(as.character(as.integer(customer$HasCrCard)), levels = c("0", "1"))
customer$IsActiveMember <- factor(as.character(as.integer(customer$IsActiveMember)), levels = c("0", "1"))
```

Set `MODEL_FILE` to `outputs/models/task1_tree.rds` or `task2_tuned_tree.rds` (created by `Rscript run_all.R`). The same logic is the `predict_churn()` function in [`../R/predict_customer.R`](../R/predict_customer.R), covered by `tests/test_pipeline.R`.

## Structure

```
powerbi/
├── BankChurn.pbip                 open this in Power BI Desktop
├── BankChurn.Report/              pages, visuals, theme and tree images (PBIR)
├── BankChurn.SemanticModel/       tables, DAX measures and embedded data (TMDL)
│   └── definition/tables/Prediction.tmdl   the two tree measures
├── validation/                    R vs DAX and metric reconciliation
└── prediction_visual.R            corrected R visual, for R-based scoring
```
