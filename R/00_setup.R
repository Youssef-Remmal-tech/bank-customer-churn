# Shared settings for every script in the pipeline.
# Run the whole project from the repository root with:  Rscript run_all.R

suppressPackageStartupMessages({
  library(dplyr)
  library(caret)
  library(rpart)
  library(pROC)
  library(jsonlite)
})

SEED      <- 123
RAW_FILE  <- "data/raw/BangorBank_Customers.csv"
RAW_SHA   <- "3996cd1fa372e0db0cd9c0ebac35bbd4e8e3c65fb942bb010c826e7b1eeef0a0"
TABLES    <- "outputs/tables"
FIGURES   <- "outputs/figures"
MODELS    <- "outputs/models"
DASH_DATA <- "docs/data.js"

for (d in c(TABLES, FIGURES, MODELS)) dir.create(d, showWarnings = FALSE, recursive = TRUE)

# Predictors chosen in Task 1 for the reduced tree: those significant (p < 0.05)
# in the full logistic regression.
SIG_VARS <- c("Geography", "Gender", "Age", "Tenure", "Balance", "IsActiveMember")
