# Install the packages the pipeline and tests need.
pkgs <- c("caret", "rpart", "pROC", "dplyr", "jsonlite", "testthat", "e1071")
missing <- setdiff(pkgs, rownames(installed.packages()))
if (length(missing)) install.packages(missing, repos = "https://cloud.r-project.org")
