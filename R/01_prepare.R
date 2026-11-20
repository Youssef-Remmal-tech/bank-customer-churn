# Load the raw file, verify it, and build the modelling dataset.

verify_checksum <- function(path, expected) {
  actual <- tryCatch(
    trimws(strsplit(system2("sha256sum", path, stdout = TRUE), " ")[[1]][1]),
    error = function(e) NA_character_
  )
  if (!is.na(actual) && actual != expected) {
    stop("Checksum mismatch for ", path, ": the raw file has changed.")
  }
  invisible(actual)
}

verify_checksum(RAW_FILE, RAW_SHA)
bank <- read.csv(RAW_FILE)

stopifnot(
  nrow(bank) == 10000,
  sum(is.na(bank)) == 0,          # no missing values
  !anyDuplicated(bank$CustomerId), # one row per customer
  all(bank$Age <= 100),
  all(bank$CreditScore >= 300 & bank$CreditScore <= 850)
)

# Identifiers carry no predictive value; categorical fields become factors.
# Factor levels are set explicitly so that training and scoring always agree
# (the root cause of the Power BI prediction bug, see powerbi/README.md).
LEVELS <- list(
  Geography      = c("France", "Germany", "Spain"),
  Gender         = c("Female", "Male"),
  HasCrCard      = c("0", "1"),
  IsActiveMember = c("0", "1")
)

bank_model <- bank %>%
  select(-RowNumber, -CustomerId, -Surname) %>%
  mutate(
    Geography      = factor(Geography,      levels = LEVELS$Geography),
    Gender         = factor(Gender,         levels = LEVELS$Gender),
    HasCrCard      = factor(HasCrCard,      levels = LEVELS$HasCrCard),
    IsActiveMember = factor(IsActiveMember, levels = LEVELS$IsActiveMember),
    Exited         = factor(Exited,         levels = c("0", "1"))
  )

write.csv(bank_model, file.path(TABLES, "bank_cleaned.csv"), row.names = FALSE)
cat(sprintf("Prepared %d customers, churn rate %.1f%%\n",
            nrow(bank_model), 100 * mean(bank_model$Exited == "1")))
