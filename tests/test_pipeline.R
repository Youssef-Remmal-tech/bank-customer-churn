# Run from the repository root:  Rscript tests/test_pipeline.R
# Requires outputs/ from `Rscript run_all.R`.

suppressPackageStartupMessages({ library(testthat); library(rpart); library(caret) })
source("R/predict_customer.R")

task1 <- readRDS("outputs/models/task1_tree.rds")
task2 <- readRDS("outputs/models/task2_tuned_tree.rds")
cleaned <- read.csv("outputs/tables/bank_cleaned.csv")
results <- read.csv("outputs/tables/model_comparison.csv")
sample_customers <- cleaned[seq(1, nrow(cleaned), by = 7), setdiff(names(cleaned), "Exited")]

test_that("the bug is real: raw numeric Gender cannot be scored", {
  bad <- sample_customers[1:5, ]
  bad$Gender <- ifelse(bad$Gender == "Male", 1, 0)
  bad$Geography <- factor(bad$Geography, levels = TRAINING_LEVELS$Geography)
  bad$HasCrCard <- factor(bad$HasCrCard, levels = c("0", "1"))
  bad$IsActiveMember <- factor(bad$IsActiveMember, levels = c("0", "1"))
  expect_error(suppressWarnings(predict(task1, bad, type = "prob")))
})

test_that("Gender 0/1 gives the same prediction as Female/Male for both trees", {
  as_text <- sample_customers
  as_code <- sample_customers
  as_code$Gender <- ifelse(as_code$Gender == "Male", 1, 0)
  as_code$HasCrCard <- as.numeric(as_code$HasCrCard)
  as_code$IsActiveMember <- as.numeric(as_code$IsActiveMember)
  for (m in list(task1, task2)) {
    expect_equal(predict_churn(m, as_code), predict_churn(m, as_text))
  }
})

test_that("both genders produce valid predictions (the reported failure)", {
  for (g in c(0, 1)) {
    d <- sample_customers; d$Gender <- g
    for (m in list(task1, task2)) {
      p <- predict_churn(m, d)
      expect_false(anyNA(p))
      expect_true(all(p >= 0 & p <= 1))
    }
  }
})

test_that("Gender actually changes some tuned-tree predictions", {
  f <- sample_customers; f$Gender <- 0
  m <- sample_customers; m$Gender <- 1
  expect_gt(sum(predict_churn(task2, f) != predict_churn(task2, m)), 0)
})

test_that("unknown categories fail loudly instead of predicting silently", {
  d <- sample_customers[1, ]; d$Geography <- "Italy"
  expect_error(predict_churn(task1, d), "outside the training levels")
})

test_that("published results reproduce the coursework report", {
  get <- function(model, col) results[results$Model == model, col]
  expect_equal(round(get("Decision tree (all)", "Accuracy"), 4), 0.8626)
  expect_equal(round(get("Decision tree (all)", "AUC"), 4), 0.7558)
  expect_equal(round(get("Tuned tree (Task 2)", "AUC"), 4), 0.8393)
  expect_equal(round(get("Tuned tree (Task 2)", "Recall"), 4), 0.4910)
  expect_equal(round(get("kNN (k tuned)", "AUC"), 4), 0.8212)
  expect_equal(round(get("Logistic regression", "Accuracy"), 4), 0.8216)
})

test_that("segments match the report", {
  seg <- read.csv("outputs/tables/segments.csv")
  expect_equal(seg$Customers, c(3196, 3559, 3245))
  expect_equal(round(seg$ChurnRate, 3), c(0.232, 0.144, 0.242))
})

cat("All tests passed.\n")
