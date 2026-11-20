# Power BI R visual: churn prediction for one customer profile (Prediction page).
#
# Paste this into each R script visual on the Prediction page. Change MODEL_FILE
# to point at the Task 1 tree or the Task 2 tuned tree.
#
# THE FIX: Power BI hands slicer and parameter values to R as numbers. The
# trees were trained with Gender, IsActiveMember and HasCrCard as factors, so
# every categorical input is converted back to the exact training levels before
# predict() is called. Previously only Gender = 1 gave a valid prediction.

MODEL_FILE <- "C:/path/to/bank-customer-churn/outputs/models/task1_tree.rds"
# MODEL_FILE <- "C:/path/to/bank-customer-churn/outputs/models/task2_tuned_tree.rds"

suppressPackageStartupMessages({ library(rpart); library(caret) })
model <- readRDS(MODEL_FILE)

# 'dataset' is created by Power BI from the fields added to the visual.
# Map your field names on the right if they differ.
first <- function(col) dataset[[col]][1]
customer <- data.frame(
  CreditScore     = as.numeric(first("CreditScore Value")),
  Age             = as.numeric(first("Age Value")),
  Tenure          = as.numeric(first("Tenure Value")),
  Balance         = as.numeric(first("Balance Value")),
  NumOfProducts   = as.numeric(first("NumOfProducts Value")),
  EstimatedSalary = as.numeric(first("EstimatedSalary Value")),
  Geography       = as.character(first("Geography")),
  Gender          = first("Gender"),          # 0/1 or "Female"/"Male"
  HasCrCard       = first("HasCrCard"),       # 0/1
  IsActiveMember  = first("IsActiveMember")   # 0/1
)

# --- Cast categorical inputs to the training factor levels -----------------
gender <- as.character(customer$Gender)
gender[gender == "0"] <- "Female"   # 0 = Female, 1 = Male in bank_cleaned.csv
gender[gender == "1"] <- "Male"
customer$Gender         <- factor(gender, levels = c("Female", "Male"))
customer$Geography      <- factor(customer$Geography, levels = c("France", "Germany", "Spain"))
customer$HasCrCard      <- factor(as.character(as.integer(customer$HasCrCard)), levels = c("0", "1"))
customer$IsActiveMember <- factor(as.character(as.integer(customer$IsActiveMember)), levels = c("0", "1"))
if (anyNA(customer)) stop("An input is outside the values the model was trained on.")

# --- Predict ----------------------------------------------------------------
p <- predict(model, newdata = customer, type = "prob")
prob <- if ("Yes" %in% colnames(p)) p[1, "Yes"] else p[1, "1"]
label <- if (prob >= 0.5) "Likely to close account" else "Likely to stay"

# --- Draw a simple card -----------------------------------------------------
par(mar = c(0, 0, 0, 0), bg = "white")
plot.new()
text(0.5, 0.78, label, cex = 1.6, font = 2, col = if (prob >= 0.5) "#B42318" else "#1A7F5A")
text(0.5, 0.52, sprintf("%.0f%%", 100 * prob), cex = 4, font = 2, col = "#101828")
text(0.5, 0.30, "probability of closing the account", cex = 1.1, col = "#475467")
rect(0.15, 0.12, 0.85, 0.17, col = "#EAECF0", border = NA)
rect(0.15, 0.12, 0.15 + 0.70 * prob, 0.17, col = if (prob >= 0.5) "#D92D20" else "#12B76A", border = NA)
