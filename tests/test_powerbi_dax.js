// Run from the repository root:  node tests/test_powerbi_dax.js
// Parses the two DAX prediction measures from the Power BI semantic model and
// scores all 10,000 customers, checking them against the R models.
const assert = require("assert");
const fs = require("fs");
global.window = {};
require("../docs/data.js");
const { score } = require("../docs/tree.js");
const C = window.CHURN, I = {};
C.columns.forEach((c, i) => (I[c] = i));
const G = C.levels.Geography;

const tmdl = fs.readFileSync("powerbi/BankChurn.SemanticModel/definition/tables/Prediction.tmdl", "utf8");
function compile(name) {
  const m = tmdl.match(new RegExp("measure '" + name + "' = ```([\\s\\S]*?)```"));
  assert.ok(m, "measure not found: " + name);
  let expr = m[1].split("RETURN")[1].replace(/\s+/g, " ");
  expr = expr.replace(/(\w+) IN \{([^}]*)\}/g, "[$2].includes($1)");
  expr = expr.replace(/([^<>!=])=([^=])/g, "$1===$2");
  const args = ["IF", "_CreditScore", "_Geography", "_Gender", "_Age", "_Tenure", "_Balance", "_NumOfProducts",
    "_HasCrCard", "_IsActiveMember", "_EstimatedSalary", "_GeographyGermany", "_GeographySpain", "_GenderMale",
    "_HasCrCard1", "_IsActiveMember1"];
  return new Function(...args, "return " + expr + ";");
}
const IF = (c, a, b) => (c ? a : b);
const task1 = compile("Task 1 Exit Probability"), task2 = compile("Task 2 Exit Probability");

let d1 = 0, d2 = 0;
for (const r of C.rows) {
  const geo = G[r[I.g]], gender = r[I.s] ? "Male" : "Female";
  const v = [IF, r[I.cs], geo, gender, r[I.a], r[I.t], r[I.b], r[I.np], String(r[I.cc]), String(r[I.ac]), r[I.es],
    +(geo === "Germany"), +(geo === "Spain"), +(gender === "Male"), r[I.cc], r[I.ac]];
  const ref1 = score(C.tree1, { Age: r[I.a], NumOfProducts: r[I.np], IsActiveMember: String(r[I.ac]), Geography: geo, Balance: r[I.b] }).p;
  d1 = Math.max(d1, Math.abs(task1(...v) - ref1));
  d2 = Math.max(d2, Math.abs(task2(...v) - r[I.r]));
}
assert.ok(d1 < 1e-12, "Task 1 DAX differs from R by " + d1);
assert.ok(d2 < 1e-4, "Task 2 DAX differs from R by " + d2);   // reference stored to 4 decimals
console.log("ok  Power BI DAX Task 1 tree matches R for " + C.rows.length + " customers (max diff " + d1 + ")");
console.log("ok  Power BI DAX Task 2 tuned tree matches R for " + C.rows.length + " customers (max diff " + d2.toExponential(1) + ")");

assert.ok(/'Scenario Gender'\[Gender\], "Female"/.test(tmdl) && !/VALUE\(_Gender\)/.test(tmdl));
console.log("ok  Gender is a text selector (Female/Male), never a numeric code");
