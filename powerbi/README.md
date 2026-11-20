# Power BI prediction page: the Gender fix

## The problem

The report's Prediction page uses two R script visuals, one for the Task 1 decision tree and one for the Task 2 tuned tree. Each scores the customer profile chosen with parameters and slicers. In review, both visuals worked for `Gender = 1` but not for `Gender = 0`.

## The cause

The trees were trained in R with `Gender` as a **factor**. R stores factor levels as integer codes that start at 1:

| Label | Code inside the model |
|---|---|
| Female | 1 |
| Male | 2 |

Power BI passes slicer values to an R visual as **numbers**, so Gender arrived as 0 or 1. Only the value that happened to line up with a code the model knew gave a usable answer. Recent versions of R refuse the input outright:

```
variable 'Gender' was fitted with type "factor" but type "numeric" was supplied
```

`IsActiveMember` and `HasCrCard` were also factors in training (levels "0" and "1") and carry the same risk when passed as numbers.

## The fix

Cast every categorical input back to the exact training levels before calling `predict()`:

```r
gender <- as.character(customer$Gender)
gender[gender == "0"] <- "Female"   # 0 = Female, 1 = Male
gender[gender == "1"] <- "Male"
customer$Gender         <- factor(gender, levels = c("Female", "Male"))
customer$Geography      <- factor(customer$Geography, levels = c("France", "Germany", "Spain"))
customer$HasCrCard      <- factor(as.character(as.integer(customer$HasCrCard)), levels = c("0", "1"))
customer$IsActiveMember <- factor(as.character(as.integer(customer$IsActiveMember)), levels = c("0", "1"))
if (anyNA(customer)) stop("An input is outside the values the model was trained on.")
```

The complete visual script is [`prediction_visual.R`](prediction_visual.R). To use it:

1. Run `Rscript run_all.R` once to create `outputs/models/task1_tree.rds` and `task2_tuned_tree.rds`.
2. In Power BI, open each R script visual on the Prediction page and paste in the script.
3. Set `MODEL_FILE` to the full path of the Task 1 or Task 2 model file.
4. If your parameter fields have different names, edit the `customer <- data.frame(...)` block.

The same logic is available as a function, `predict_churn()`, in [`../R/predict_customer.R`](../R/predict_customer.R). It also accepts "Female"/"Male" text and stops with a clear message if a value was never seen in training.

## How it is tested

`tests/test_pipeline.R` covers four cases:

- **The bug is real:** numeric Gender passed to the raw model fails.
- **0/1 and Female/Male give identical predictions** for both trees, on more than 1,400 customers.
- **Both genders return valid probabilities** for both trees.
- **Gender changes some tuned-tree predictions,** so the check above is not passing by accident.

The visual script was also run with a simulated Power BI `dataset` for Gender = 0 and Gender = 1, and both produced a prediction.
