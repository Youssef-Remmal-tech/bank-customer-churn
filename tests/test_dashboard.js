// Run from the repository root:  node tests/test_dashboard.js
// Checks that the browser report scores the tuned tree exactly as R does,
// for all 10,000 customers, and that Gender is handled for both values.
const assert = require("assert");
global.window = {};
require("../docs/data.js");
const { score, dummies } = require("../docs/tree.js");
const C = window.CHURN, I = {};
C.columns.forEach((c, i) => (I[c] = i));
const G = C.levels.Geography;

let maxDiff = 0;
for (const r of C.rows) {
  const profile = { CreditScore: r[I.cs], Age: r[I.a], Tenure: r[I.t], Balance: r[I.b], NumOfProducts: r[I.np],
    EstimatedSalary: r[I.es], Geography: G[r[I.g]], Gender: r[I.s] ? "Male" : "Female",
    HasCrCard: r[I.cc], IsActiveMember: r[I.ac] };
  maxDiff = Math.max(maxDiff, Math.abs(score(C.tree2, dummies(profile)).p - r[I.r]));
}
assert.ok(maxDiff < 1e-4, "browser and R disagree by " + maxDiff);
console.log("ok  tuned tree: browser matches R for " + C.rows.length + " customers (max diff " + maxDiff.toExponential(1) + ")");

const base = { CreditScore: 640, Age: 52, Tenure: 3, Balance: 110000, NumOfProducts: 1, EstimatedSalary: 95000,
  Geography: "Germany", HasCrCard: "1", IsActiveMember: "0" };
for (const g of ["Female", "Male"]) {
  const p1 = score(C.tree1, Object.assign({}, base, { Gender: g })).p;
  const p2 = score(C.tree2, dummies(Object.assign({}, base, { Gender: g }))).p;
  assert.ok(p1 >= 0 && p1 <= 1 && p2 >= 0 && p2 <= 1);
}
console.log("ok  both genders score with both trees");

const leaves = C.tree1.filter((n) => !n.var).length;
assert.strictEqual(leaves, 10);
console.log("ok  Task 1 tree has " + leaves + " readable leaves");
