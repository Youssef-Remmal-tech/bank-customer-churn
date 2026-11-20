// Score an exported rpart tree. Shared by the report (app.js) and tests/test_dashboard.js.
(function (root) {
  "use strict";
  function nodeMap(nodes) { var m = {}; nodes.forEach(function (n) { m[n.id] = n; }); return m; }
  function goesLeft(nd, row) {
    var v = row[nd.var];
    if (nd.type === "num") return nd.leftIfLess ? +v < nd.cut : +v >= nd.cut;
    var left = Array.isArray(nd.left) ? nd.left : [nd.left];
    return left.indexOf(String(v)) >= 0;
  }
  // Returns the probability of leaving, the leaf reached and the path of node ids.
  function score(nodes, row) {
    if (!nodes._map) Object.defineProperty(nodes, "_map", { value: nodeMap(nodes) });
    var m = nodes._map, id = 1, path = [1];
    while (m[id].var) { id = goesLeft(m[id], row) ? 2 * id : 2 * id + 1; path.push(id); }
    return { p: m[id].p, leaf: m[id], path: path };
  }
  // The tuned tree was trained by caret on dummy columns; build them from a profile.
  // This is the same casting to training levels that fixes the Power BI page.
  function dummies(p) {
    return { CreditScore: +p.CreditScore, Age: +p.Age, Tenure: +p.Tenure, Balance: +p.Balance,
      NumOfProducts: +p.NumOfProducts, EstimatedSalary: +p.EstimatedSalary,
      GeographyFrance: +(p.Geography === "France"), GeographyGermany: +(p.Geography === "Germany"),
      GeographySpain: +(p.Geography === "Spain"), GenderMale: +(p.Gender === "Male"),
      HasCrCard1: +(String(p.HasCrCard) === "1"), IsActiveMember1: +(String(p.IsActiveMember) === "1") };
  }
  var api = { score: score, dummies: dummies, nodeMap: nodeMap };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.ChurnTree = api;
})(this);
