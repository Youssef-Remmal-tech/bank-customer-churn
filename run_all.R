# Rebuild every table, figure, model file and the dashboard data from the raw CSV.
# Usage (from the repository root):  Rscript run_all.R

source("R/00_setup.R")
source("R/01_prepare.R")
source("R/02_models.R")
source("R/03_segments.R")
source("R/04_export.R")
cat("Done.\n")
