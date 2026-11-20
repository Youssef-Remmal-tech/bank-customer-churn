# Task 3: k-means segmentation on the six numeric fields, standardised.

cluster_df <- bank %>%
  select(CreditScore, Age, Tenure, Balance, NumOfProducts, EstimatedSalary)
cluster_scaled <- scale(cluster_df)

# Elbow curve: within-cluster sum of squares for k = 1..10
set.seed(SEED)
wss <- suppressWarnings(sapply(1:10, function(k) kmeans(cluster_scaled, centers = k, nstart = 10, iter.max = 50)$tot.withinss))
write.csv(data.frame(k = 1:10, wss = wss), file.path(TABLES, "elbow.csv"), row.names = FALSE)

set.seed(SEED)
km <- kmeans(cluster_scaled, centers = 3, nstart = 25)

segments <- bank %>%
  mutate(Cluster = km$cluster) %>%
  group_by(Cluster) %>%
  summarise(Customers = n(),
            ChurnRate = mean(Exited),
            ZeroBalanceShare = mean(Balance == 0),   # before Balance is summarised
            ActiveShare = mean(IsActiveMember),
            GermanyShare = mean(Geography == "Germany"),
            CreditScore = mean(CreditScore), Age = mean(Age), Tenure = mean(Tenure),
            Balance = mean(Balance), NumOfProducts = mean(NumOfProducts),
            EstimatedSalary = mean(EstimatedSalary),
            .groups = "drop")
write.csv(segments, file.path(TABLES, "segments.csv"), row.names = FALSE)
print(as.data.frame(segments), digits = 4)
cat(sprintf("Between-cluster share of variance: %.1f%%\n", 100 * km$betweenss / km$totss))
