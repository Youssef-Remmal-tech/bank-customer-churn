# Figures, tables and the data file that drives the live dashboard (docs/).

# ---- One ROC chart for every model (all curves on the same axes)
png(file.path(FIGURES, "roc_all_models.png"), width = 1600, height = 1300, res = 200)
cols <- c("#8a94a0", "#3987e5", "#9c6ade", "#e8a23b", "#d6457a")
names(cols) <- names(probs)
par(mar = c(4.5, 4.5, 3, 1), las = 1, family = "sans")
plot(NA, xlim = c(0, 1), ylim = c(0, 1), xaxs = "i", yaxs = "i", asp = 1,
     xlab = "False positive rate (loyal customers flagged)",
     ylab = "True positive rate (leavers caught)",
     main = sprintf("ROC on the hold-out set (%s customers)", format(length(y_test), big.mark = ",")))
abline(h = seq(0, 1, 0.2), v = seq(0, 1, 0.2), col = "grey92")
abline(0, 1, col = "grey70", lty = 2)
for (m in names(probs)) {
  r <- roc(y_test, probs[[m]], levels = c(0, 1), direction = "<", quiet = TRUE)
  lines(1 - r$specificities, r$sensitivities, col = cols[[m]],
        lwd = if (m == "Tuned tree (Task 2)") 3.2 else 2)
}
legend("bottomright", bty = "n", lwd = 2.5, col = cols, cex = 0.9,
       legend = sprintf("%s   AUC %.3f", results$Model, results$AUC))
invisible(dev.off())

# ---- Export an rpart tree as plain nodes, so the browser can score it exactly
export_tree <- function(fit) {
  ff <- fit$frame
  is_leaf <- ff$var == "<leaf>"
  split_row <- cumsum(c(1, ff$ncompete + ff$nsurrogate + !is_leaf))
  node_ids <- as.integer(rownames(ff))
  ylev <- attr(fit, "ylevels")
  nodes <- lapply(seq_len(nrow(ff)), function(i) {
    out <- list(id = node_ids[i], n = ff$n[i],
                p = unname(ff$yval2[i, 1 + length(ylev) + 2]))  # P(second class)
    if (!is_leaf[i]) {
      s <- fit$splits[split_row[i], , drop = FALSE]
      v <- as.character(ff$var[i])
      out$var <- v
      if (abs(s[1, "ncat"]) == 1) {
        out$type <- "num"
        out$cut  <- unname(s[1, "index"])
        out$leftIfLess <- s[1, "ncat"] == -1
        out$label <- sprintf("%s %s %s", v, if (out$leftIfLess) "<" else ">=",
                             format(signif(out$cut, 5), big.mark = ","))
      } else {
        dirs <- fit$csplit[s[1, "index"], seq_len(s[1, "ncat"])]
        lv <- attr(fit, "xlevels")[[v]]
        out$type <- "cat"
        out$left <- lv[dirs == 1]
        out$label <- sprintf("%s = %s", v, paste(out$left, collapse = ", "))
      }
    }
    out
  })
  nodes
}

# Score a data frame with the exported nodes, the same way docs/app.js does.
score_exported <- function(nodes, df) {
  by_id <- setNames(nodes, sapply(nodes, `[[`, "id"))
  apply_one <- function(row) {
    id <- 1L
    repeat {
      nd <- by_id[[as.character(id)]]
      if (is.null(nd$var)) return(nd$p)
      x <- row[[nd$var]]
      go_left <- if (nd$type == "num") {
        if (nd$leftIfLess) as.numeric(x) < nd$cut else as.numeric(x) >= nd$cut
      } else as.character(x) %in% nd$left
      id <- if (go_left) 2L * id else 2L * id + 1L
    }
  }
  vapply(seq_len(nrow(df)), function(i) apply_one(df[i, , drop = FALSE]), numeric(1))
}

tree1_nodes <- export_tree(tree_full)
tree2_nodes <- export_tree(tuned_tree)

# Check the exported trees reproduce R's own predictions on every test customer.
TestDummy <- as.data.frame(model.matrix(~ . - 1, data = select(Test, -Exited)))
stopifnot(
  max(abs(score_exported(tree1_nodes, Test) - probs[["Decision tree (all)"]])) < 1e-9,
  max(abs(score_exported(tree2_nodes, TestDummy) - probs[["Tuned tree (Task 2)"]])) < 1e-9
)

# ---- ROC points (thinned) and capture curve for the dashboard
roc_points <- lapply(names(probs), function(m) {
  r <- roc(y_test, probs[[m]], levels = c(0, 1), direction = "<", quiet = TRUE)
  fpr <- 1 - r$specificities; tpr <- r$sensitivities
  o <- order(fpr, tpr); fpr <- fpr[o]; tpr <- tpr[o]
  keep <- unique(round(seq(1, length(fpr), length.out = min(length(fpr), 120))))
  list(model = m, fpr = round(fpr[keep], 4), tpr = round(tpr[keep], 4))
})

capture <- function(p) {
  o <- order(-p)
  hits <- cumsum(y_test[o])
  shares <- seq(0.01, 1, by = 0.01)
  round(sapply(shares, function(s) hits[ceiling(s * length(p))] / sum(y_test)), 4)
}
capture_curves <- list(
  tuned    = capture(probs[["Tuned tree (Task 2)"]]),
  task1    = capture(probs[["Decision tree (all)"]]),
  logistic = capture(probs[["Logistic regression"]])
)

# ---- Customer-level rows for the report pages (no names or IDs)
test_flag <- seq_len(nrow(bank)) %in% setdiff(seq_len(nrow(bank)), train_id)
tuned_all <- predict(tuned_fit, newdata = bank_model %>%
                       mutate(Exited = factor(ifelse(Exited == "1", "Yes", "No"),
                                              levels = c("No", "Yes"))),
                     type = "prob")[, "Yes"]
customers <- bank %>%
  transmute(g = match(Geography, LEVELS$Geography) - 1L,
            s = as.integer(Gender == "Male"),
            a = Age, t = Tenure, b = round(Balance), np = NumOfProducts,
            cc = HasCrCard, ac = IsActiveMember, cs = CreditScore, es = round(EstimatedSalary),
            x = Exited, k = km$cluster,
            ho = as.integer(test_flag),
            r = round(tuned_all, 4))

dash <- list(
  generated = format(Sys.Date()),
  n = nrow(bank),
  levels = LEVELS,
  columns = names(customers),
  rows = unname(as.list(as.data.frame(t(customers)))),
  models = results,
  roc = roc_points,
  capture = capture_curves,
  holdout = list(n = length(y_test), churners = sum(y_test)),
  knn_k = knn_fit$bestTune$k,
  tuned_cp = tuned_fit$bestTune$cp,
  cp_curve = tuned_fit$results[, c("cp", "ROC")],
  segments = segments,
  elbow = data.frame(k = 1:10, wss = round(wss)),
  logistic = data.frame(term = rownames(coefs), estimate = coefs[, 1],
                        p = coefs[, 4], row.names = NULL),
  tree1 = tree1_nodes,
  tree2 = tree2_nodes
)
writeLines(paste0("window.CHURN = ", toJSON(dash, auto_unbox = TRUE, digits = NA,
                                             dataframe = "rows"), ";"), DASH_DATA)
cat(sprintf("Dashboard data written: %s (%.0f KB)\n", DASH_DATA, file.size(DASH_DATA) / 1024))
