# Score new customers with a saved tree, whatever form the inputs arrive in.
#
# Why this exists: in the original Power BI report the trees were trained with
# Gender as a factor (Female = level 1, Male = level 2), but the prediction
# page passed Gender as a number (0/1). Only the value that happened to line up
# with a level code produced a sensible answer. Casting every categorical input
# to the exact factor levels used in training removes the problem, and the same
# risk for IsActiveMember and HasCrCard (also 0/1 in Power BI).

TRAINING_LEVELS <- list(
  Geography      = c("France", "Germany", "Spain"),
  Gender         = c("Female", "Male"),
  HasCrCard      = c("0", "1"),
  IsActiveMember = c("0", "1")
)

as_training_factor <- function(x, var) {
  lv <- TRAINING_LEVELS[[var]]
  if (var == "Gender") {
    x <- as.character(x)
    x <- ifelse(x %in% c("0", "F", "f", "female"), "Female",
         ifelse(x %in% c("1", "M", "m", "male"),   "Male", x))
  }
  if (var %in% c("HasCrCard", "IsActiveMember")) {
    x <- as.character(as.integer(as.logical(as.numeric(as.character(x)))))
  }
  f <- factor(as.character(x), levels = lv)
  if (anyNA(f)) {
    stop(sprintf("%s has a value outside the training levels (%s): %s",
                 var, paste(lv, collapse = ", "),
                 paste(unique(x[is.na(f)]), collapse = ", ")))
  }
  f
}

prepare_new_customers <- function(df) {
  for (v in intersect(names(TRAINING_LEVELS), names(df))) {
    df[[v]] <- as_training_factor(df[[v]], v)
  }
  num <- c("CreditScore", "Age", "Tenure", "Balance", "NumOfProducts", "EstimatedSalary")
  for (v in intersect(num, names(df))) df[[v]] <- as.numeric(df[[v]])
  df
}

# model: an rpart tree (Task 1) or a caret train object (Task 2).
# Returns the probability that each customer closes their account.
predict_churn <- function(model, newdata) {
  newdata <- prepare_new_customers(newdata)
  p <- predict(model, newdata = newdata, type = "prob")
  if ("Yes" %in% colnames(p)) p[, "Yes"] else p[, "1"]
}
