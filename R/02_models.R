# Task 1: four classifiers. Task 2: a cross-validated tuned tree.
# The code follows the original coursework so the published numbers reproduce.

set.seed(SEED)
train_id <- createDataPartition(bank_model$Exited, p = 0.7, list = FALSE)
Train <- bank_model[train_id, ]
Test  <- bank_model[-train_id, ]

# ---- Logistic regression (baseline, also used to choose the reduced tree's inputs)
bank_glm <- bank_model %>% mutate(Exited = as.integer(as.character(Exited)))
TrainG <- bank_glm[train_id, ]
TestG  <- bank_glm[-train_id, ]
glm_fit  <- glm(Exited ~ ., data = TrainG, family = binomial)
glm_prob <- predict(glm_fit, newdata = TestG, type = "response")
glm_pred <- factor(ifelse(glm_prob > 0.5, "1", "0"), levels = c("0", "1"))

coefs <- summary(glm_fit)$coefficients
write.csv(data.frame(term = rownames(coefs), coefs, row.names = NULL),
          file.path(TABLES, "logistic_coefficients.csv"), row.names = FALSE)

# ---- Decision trees: all predictors, and the significant-variable subset
tree_full <- rpart(Exited ~ ., data = Train)
tree_sig  <- rpart(as.formula(paste("Exited ~", paste(SIG_VARS, collapse = " + "))),
                   data = Train)

# ---- kNN with centring, scaling and repeated cross-validation
X <- model.matrix(Exited ~ . - 1, data = bank_model)
knn_df <- data.frame(X, Exited = factor(bank_model$Exited, levels = c("0", "1"),
                                        labels = c("No", "Yes")))
TrainK <- knn_df[train_id, ]
TestK  <- knn_df[-train_id, ]
set.seed(SEED)
knn_fit <- train(
  Exited ~ ., data = TrainK, method = "knn",
  preProcess = c("center", "scale"),
  tuneGrid   = expand.grid(k = c(5, 7, 9, 11, 13, 15, 17)),
  metric     = "Accuracy",
  trControl  = trainControl(method = "repeatedcv", number = 5, repeats = 10)
)
knn_prob <- predict(knn_fit, newdata = TestK, type = "prob")[, "Yes"]

# ---- Task 2: tune the tree's complexity parameter with 5-fold CV on ROC
TrainAI <- Train %>% mutate(Exited = factor(ifelse(Exited == "1", "Yes", "No"),
                                            levels = c("No", "Yes")))
TestAI  <- Test  %>% mutate(Exited = factor(ifelse(Exited == "1", "Yes", "No"),
                                            levels = c("No", "Yes")))
set.seed(SEED)
tuned_fit <- train(
  Exited ~ ., data = TrainAI, method = "rpart", metric = "ROC",
  trControl = trainControl(method = "cv", number = 5, classProbs = TRUE,
                           summaryFunction = twoClassSummary),
  tuneGrid  = expand.grid(cp = seq(0.001, 0.02, by = 0.001))
)
tuned_tree <- tuned_fit$finalModel
tuned_prob <- predict(tuned_fit, newdata = TestAI, type = "prob")[, "Yes"]

# ---- Evaluation on the 30% hold-out
y_test <- as.integer(as.character(Test$Exited))

evaluate <- function(name, prob, pred_class) {
  pred <- as.integer(pred_class)
  tp <- sum(pred == 1 & y_test == 1); fp <- sum(pred == 1 & y_test == 0)
  fn <- sum(pred == 0 & y_test == 1); tn <- sum(pred == 0 & y_test == 0)
  roc_obj <- roc(y_test, prob, levels = c(0, 1), direction = "<", quiet = TRUE)
  data.frame(Model = name,
             Accuracy  = (tp + tn) / length(y_test),
             AUC       = as.numeric(auc(roc_obj)),
             Recall    = tp / (tp + fn),
             Precision = tp / (tp + fp),
             TP = tp, FP = fp, FN = fn, TN = tn)
}

probs <- list(
  "Logistic regression"     = glm_prob,
  "Decision tree (all)"     = predict(tree_full, Test, type = "prob")[, "1"],
  "Decision tree (sig var)" = predict(tree_sig,  Test, type = "prob")[, "1"],
  "kNN (k tuned)"           = knn_prob,
  "Tuned tree (Task 2)"     = tuned_prob
)
classes <- list(
  "Logistic regression"     = glm_pred == "1",
  "Decision tree (all)"     = predict(tree_full, Test, type = "class") == "1",
  "Decision tree (sig var)" = predict(tree_sig,  Test, type = "class") == "1",
  "kNN (k tuned)"           = predict(knn_fit, TestK) == "Yes",
  "Tuned tree (Task 2)"     = predict(tuned_fit, TestAI) == "Yes"
)

results <- do.call(rbind, lapply(names(probs), function(m) evaluate(m, probs[[m]], classes[[m]])))
write.csv(results, file.path(TABLES, "model_comparison.csv"), row.names = FALSE)
print(results[, 1:5], digits = 4)
cat("Best k:", knn_fit$bestTune$k, " Best cp:", tuned_fit$bestTune$cp, "\n")

# Save the two deployed trees for Power BI and the tests.
saveRDS(tree_full,  file.path(MODELS, "task1_tree.rds"))
tuned_slim <- tuned_fit
# Strip training data captured inside the object; none of it is needed for scoring.
tuned_slim$trainingData <- NULL
tuned_slim$control$index <- tuned_slim$control$indexOut <- NULL
tuned_slim$finalModel$call <- NULL
tuned_slim$finalModel$where <- tuned_slim$finalModel$y <- NULL
environment(tuned_slim$finalModel$terms) <- globalenv()
environment(tuned_slim$terms) <- globalenv()
saveRDS(tuned_slim,  file.path(MODELS, "task2_tuned_tree.rds"))  # caret object: handles dummy coding
