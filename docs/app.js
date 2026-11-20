(function () {
  "use strict";
  var C = window.CHURN;
  var COL = {}; C.columns.forEach(function (c, i) { COL[c] = i; });
  var ROWS = C.rows;
  var GEO = C.levels.Geography;            // France, Germany, Spain
  var PAL = ["#118DFF", "#E66C37", "#744EC2", "#D9B300", "#E044A7", "#12239E"];
  var RISK = "#C4314B", SAFE = "#107C10", MUTED = "#605E5C", RULE = "#E1DFDD";
  var SVGNS = "http://www.w3.org/2000/svg";

  // ---------- formatting ----------
  var pct = function (v, d) { return (100 * v).toFixed(d == null ? 1 : d) + "%"; };
  var int = function (v) { return Math.round(v).toLocaleString("en-GB"); };
  var gbp = function (v) {
    if (v >= 1e6) return "£" + (v / 1e6).toFixed(1) + "m";
    if (v >= 1e3) return "£" + Math.round(v / 1e3) + "k";
    return "£" + int(v);
  };
  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, parent, text) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function svg(container, w, h) {
    container.innerHTML = "";
    var s = el("svg", { viewBox: "0 0 " + w + " " + h, role: "img" }, container);
    return s;
  }
  function widthOf(node, fallback) { return Math.max(260, node.clientWidth || fallback || 400); }

  // ---------- filters ----------
  var F = { geo: new Set(), gender: new Set(), active: new Set(), products: new Set(), ageMin: 18, ageMax: 92 };
  var SLICERS = {
    geo:      { opts: GEO.map(function (g, i) { return [i, g]; }), col: "g" },
    gender:   { opts: [[0, "Female"], [1, "Male"]], col: "s" },
    active:   { opts: [[1, "Yes"], [0, "No"]], col: "ac" },
    products: { opts: [[1, "1"], [2, "2"], [3, "3"], [4, "4"]], col: "np" }
  };
  function passes(r) {
    for (var k in SLICERS) {
      if (F[k].size && !F[k].has(r[COL[SLICERS[k].col]])) return false;
    }
    var a = r[COL.a];
    return a >= F.ageMin && a <= F.ageMax;
  }
  function filtered() { return ROWS.filter(passes); }
  function anyFilter() {
    return F.geo.size || F.gender.size || F.active.size || F.products.size || F.ageMin > 18 || F.ageMax < 92;
  }
  function buildSlicers() {
    document.querySelectorAll(".chips").forEach(function (box) {
      var key = box.getAttribute("data-f");
      box.innerHTML = "";
      SLICERS[key].opts.forEach(function (o) {
        var b = document.createElement("button");
        b.type = "button"; b.textContent = o[1];
        b.setAttribute("aria-pressed", F[key].has(o[0]) ? "true" : "false");
        b.addEventListener("click", function () { toggle(key, o[0]); });
        box.appendChild(b);
      });
    });
    $("ageMin").value = F.ageMin; $("ageMax").value = F.ageMax;
  }
  function toggle(key, v, only) {
    if (only) {
      if (F[key].size === 1 && F[key].has(v)) F[key].clear(); else { F[key].clear(); F[key].add(v); }
    } else {
      if (F[key].has(v)) F[key].delete(v); else F[key].add(v);
    }
    refresh();
  }
  function setAge(lo, hi) {
    if (F.ageMin === lo && F.ageMax === hi) { F.ageMin = 18; F.ageMax = 92; }
    else { F.ageMin = lo; F.ageMax = hi; }
    refresh();
  }
  $("clearFilters").addEventListener("click", function () {
    F.geo.clear(); F.gender.clear(); F.active.clear(); F.products.clear(); F.ageMin = 18; F.ageMax = 92; refresh();
  });
  ["ageMin", "ageMax"].forEach(function (id) {
    $(id).addEventListener("change", function () {
      var lo = Math.max(18, Math.min(92, +$("ageMin").value || 18));
      var hi = Math.max(18, Math.min(92, +$("ageMax").value || 92));
      F.ageMin = Math.min(lo, hi); F.ageMax = Math.max(lo, hi); refresh();
    });
  });
  function summaryText() {
    if (!anyFilter()) return "All customers";
    var parts = [];
    for (var k in SLICERS) if (F[k].size) {
      var lab = { geo: "", gender: "", active: "Active: ", products: "Products: " }[k];
      parts.push(lab + SLICERS[k].opts.filter(function (o) { return F[k].has(o[0]); }).map(function (o) { return o[1]; }).join(", "));
    }
    if (F.ageMin > 18 || F.ageMax < 92) parts.push("Age " + F.ageMin + "–" + F.ageMax);
    return "Filtered: " + parts.join(" · ");
  }

  // ---------- aggregation ----------
  function rate(rows) {
    var x = 0; for (var i = 0; i < rows.length; i++) x += rows[i][COL.x];
    return { n: rows.length, left: x, rate: rows.length ? x / rows.length : 0 };
  }
  function groupBy(rows, keyFn, keys) {
    var m = {}; keys.forEach(function (k) { m[k] = []; });
    rows.forEach(function (r) { var k = keyFn(r); if (m[k]) m[k].push(r); });
    return keys.map(function (k) { var s = rate(m[k]); s.key = k; return s; });
  }
  var AGE_BANDS = [[18, 29, "18–29"], [30, 39, "30–39"], [40, 49, "40–49"], [50, 59, "50–59"], [60, 92, "60+"]];
  function ageBand(a) { for (var i = 0; i < AGE_BANDS.length; i++) if (a <= AGE_BANDS[i][1]) return i; return 4; }
  var BAL_BANDS = ["£0", "£1–50k", "£50–100k", "£100–150k", "£150k+"];
  function balBand(b) { return b === 0 ? 0 : b < 50000 ? 1 : b < 100000 ? 2 : b < 150000 ? 3 : 4; }

  // ---------- charts ----------
  function hbar(container, items, opts) {
    var W = widthOf(container), rowH = 34, top = 6, labW = opts.labW || 74, valW = 112;
    top = opts.ref != null ? 24 : 6;
    var H = top + items.length * rowH + 6;
    var s = svg(container, W, H);
    var max = Math.max(opts.max || 0, d3max(items, "rate")) * 1.08 || 1;
    var x = function (v) { return labW + (W - labW - valW) * v / max; };
    items.forEach(function (it, i) {
      var y = top + i * rowH;
      var g = el("g", { class: "bar" + (it.dim ? " dim" : "") }, s);
      el("text", { x: labW - 8, y: y + 19, "text-anchor": "end", "font-size": 13, fill: "#252423" }, g, it.label);
      el("rect", { x: labW, y: y + 5, width: Math.max(1, x(it.rate) - labW), height: 20, fill: it.color || PAL[0], rx: 1 }, g);
      el("text", { x: x(it.rate) + 6, y: y + 19, "font-size": 12.5, fill: "#252423", "font-weight": 600 }, g, pct(it.rate));
      el("text", { x: x(it.rate) + 52, y: y + 19, "font-size": 11.5, fill: MUTED }, g, int(it.n));
      el("title", {}, g, it.label + ": " + pct(it.rate) + " churn, " + int(it.left) + " of " + int(it.n) + " customers");
      if (opts.onClick) { g.addEventListener("click", function () { opts.onClick(it); }); g.setAttribute("tabindex", "0");
        g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); opts.onClick(it); } }); }
      else g.style.cursor = "default";
    });
    if (opts.ref != null) {
      var rx = x(opts.ref);
      el("line", { x1: rx, x2: rx, y1: top, y2: H - 2, stroke: "#252423", "stroke-dasharray": "3 3", "stroke-width": 1 }, s);
      el("line", { x1: W - 150, x2: W - 128, y1: 9, y2: 9, stroke: "#252423", "stroke-dasharray": "3 3" }, s);
      el("text", { x: W, y: 13, "text-anchor": "end", "font-size": 11, fill: MUTED }, s, "all customers " + pct(opts.ref));
    }
  }
  function d3max(items, k) { return items.reduce(function (m, it) { return Math.max(m, it[k]); }, 0); }

  function columns(container, items, opts) {
    var W = widthOf(container), H = opts.h || 230, padL = 8, padB = 40, padT = 34;
    var s = svg(container, W, H);
    var max = Math.max(d3max(items, "rate") * 1.12, opts.ref ? opts.ref * 1.2 : 0) || 1;
    var bw = (W - padL - 8) / items.length;
    var y = function (v) { return H - padB - (H - padB - padT) * v / max; };
    el("line", { x1: padL, x2: W, y1: y(0), y2: y(0), stroke: RULE }, s);
    items.forEach(function (it, i) {
      var cx = padL + bw * i + bw / 2, w = Math.min(54, bw * 0.62);
      var g = el("g", { class: "bar" + (it.dim ? " dim" : "") }, s);
      el("rect", { x: cx - w / 2, y: y(it.rate), width: w, height: Math.max(1, y(0) - y(it.rate)), fill: it.color || PAL[0], rx: 1 }, g);
      el("text", { x: cx, y: y(it.rate) - 6, "text-anchor": "middle", "font-size": 12.5, "font-weight": 600, fill: "#252423" }, g, pct(it.rate, it.rate < 0.1 ? 1 : 0));
      el("text", { x: cx, y: H - padB + 16, "text-anchor": "middle", "font-size": 12.5, fill: "#252423" }, g, it.label);
      el("text", { x: cx, y: H - padB + 31, "text-anchor": "middle", "font-size": 11, fill: MUTED }, g, int(it.n) + " cust.");
      el("title", {}, g, it.label + ": " + pct(it.rate) + " churn (" + int(it.left) + " of " + int(it.n) + ")");
      if (opts.onClick) { g.addEventListener("click", function () { opts.onClick(it); }); g.setAttribute("tabindex", "0");
        g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); opts.onClick(it); } }); }
      else g.style.cursor = "default";
    });
    if (opts.ref != null) {
      el("line", { x1: padL, x2: W, y1: y(opts.ref), y2: y(opts.ref), stroke: "#252423", "stroke-dasharray": "3 3" }, s);
      el("line", { x1: W - 150, x2: W - 128, y1: 9, y2: 9, stroke: "#252423", "stroke-dasharray": "3 3" }, s);
      el("text", { x: W, y: 13, "text-anchor": "end", "font-size": 11, fill: MUTED }, s, "all customers " + pct(opts.ref));
    }
  }

  // series: [{name, color, xs, ys, width, dash}]
  function lines(container, series, opts) {
    var W = widthOf(container), H = opts.h || Math.round(Math.min(340, W * 0.72)), padL = 44, padB = 38, padT = 10, padR = 12;
    var s = svg(container, W, H);
    var xmin = opts.xmin != null ? opts.xmin : 0, xmax = opts.xmax != null ? opts.xmax : 1;
    var ymin = opts.ymin != null ? opts.ymin : 0, ymax = opts.ymax != null ? opts.ymax : 1;
    var X = function (v) { return padL + (W - padL - padR) * (v - xmin) / (xmax - xmin); };
    var Y = function (v) { return H - padB - (H - padB - padT) * (v - ymin) / (ymax - ymin); };
    (opts.yticks || []).forEach(function (t) {
      el("line", { x1: padL, x2: W - padR, y1: Y(t), y2: Y(t), stroke: "#EDEBE9" }, s);
      el("text", { x: padL - 6, y: Y(t) + 4, "text-anchor": "end", "font-size": 11, fill: MUTED }, s, opts.yfmt ? opts.yfmt(t) : t);
    });
    (opts.xticks || []).forEach(function (t) {
      el("text", { x: X(t), y: H - padB + 16, "text-anchor": "middle", "font-size": 11, fill: MUTED }, s, opts.xfmt ? opts.xfmt(t) : t);
    });
    el("line", { x1: padL, x2: W - padR, y1: Y(ymin), y2: Y(ymin), stroke: RULE }, s);
    el("line", { x1: padL, x2: padL, y1: Y(ymin), y2: Y(ymax), stroke: RULE }, s);
    if (opts.xlab) el("text", { x: (padL + W - padR) / 2, y: H - 4, "text-anchor": "middle", "font-size": 11.5, fill: MUTED }, s, opts.xlab);
    if (opts.ylab) el("text", { x: 12, y: (H - padB) / 2, "text-anchor": "middle", "font-size": 11.5, fill: MUTED, transform: "rotate(-90 12 " + (H - padB) / 2 + ")" }, s, opts.ylab);
    if (opts.diag) el("line", { x1: X(0), y1: Y(0), x2: X(1), y2: Y(1), stroke: "#A19F9D", "stroke-dasharray": "4 4" }, s);
    if (opts.vline != null) el("line", { x1: X(opts.vline), x2: X(opts.vline), y1: Y(ymin), y2: Y(ymax), stroke: "#252423", "stroke-dasharray": "3 3" }, s);
    series.forEach(function (se) {
      if (se.hidden) return;
      var d = se.xs.map(function (x, i) { return (i ? "L" : "M") + X(x).toFixed(1) + " " + Y(se.ys[i]).toFixed(1); }).join("");
      el("path", { d: d, fill: "none", stroke: se.color, "stroke-width": se.width || 2, "stroke-dasharray": se.dash || "", "stroke-linejoin": "round" }, s);
      (se.points || []).forEach(function (p) {
        el("circle", { cx: X(p[0]), cy: Y(p[1]), r: p[2] || 4, fill: p[3] || se.color, stroke: "#fff", "stroke-width": 1.5 }, s);
        if (p[4]) el("text", { x: X(p[0]) + 8, y: Y(p[1]) - 8, "font-size": 11.5, fill: "#252423", "font-weight": 600 }, s, p[4]);
      });
    });
    return { X: X, Y: Y, svg: s };
  }

  // ---------- OVERVIEW ----------
  var ALL = rate(ROWS);
  function renderOverview() {
    var rows = filtered(), r = rate(rows);
    $("filterSummary").textContent = summaryText();
    var balLost = 0, active = 0;
    rows.forEach(function (x) { if (x[COL.x]) balLost += x[COL.b]; active += x[COL.ac]; });
    var diff = r.rate - ALL.rate;
    $("kpis").innerHTML = [
      ["Customers", int(r.n), anyFilter() ? pct(r.n / ALL.n, 0) + " of the base" : "retail bank, one snapshot"],
      ["Closed their account", int(r.left), "the target: Exited = 1"],
      ["Churn rate", r.n ? pct(r.rate) : "–", anyFilter() ? (diff >= 0 ? "+" : "") + (100 * diff).toFixed(1) + " pts vs all customers" : "1 in " + Math.round(1 / ALL.rate) + " customers"],
      ["Balance held by leavers", gbp(balLost), r.left ? gbp(balLost / r.left) + " average per leaver" : ""],
      ["Active members", r.n ? pct(active / r.n, 0) : "–", "used the bank recently"]
    ].map(function (k) { return '<div class="kpi"><div class="v">' + k[1] + '</div><div class="l">' + k[0] + '</div><div class="d">' + k[2] + "</div></div>"; }).join("");

    var geo = groupBy(rows, function (x) { return x[COL.g]; }, [0, 1, 2]).map(function (g, i) {
      return { label: GEO[i], rate: g.rate, n: g.n, left: g.left, key: i, dim: F.geo.size && !F.geo.has(i), color: PAL[0] };
    });
    hbar($("cGeo"), geo, { ref: ALL.rate, onClick: function (it) { toggle("geo", it.key, true); } });

    var age = groupBy(rows, function (x) { return ageBand(x[COL.a]); }, [0, 1, 2, 3, 4]).map(function (g, i) {
      var b = AGE_BANDS[i];
      return { label: b[2], rate: g.rate, n: g.n, left: g.left, key: i, color: PAL[0],
               dim: (F.ageMin > 18 || F.ageMax < 92) && !(b[0] >= F.ageMin && b[1] <= F.ageMax) };
    });
    columns($("cAge"), age, { ref: ALL.rate, onClick: function (it) { var b = AGE_BANDS[it.key]; setAge(b[0], b[1]); } });

    var prod = groupBy(rows, function (x) { return x[COL.np]; }, [1, 2, 3, 4]).map(function (g) {
      return { label: g.key + (g.key === 1 ? " product" : " products"), rate: g.rate, n: g.n, left: g.left, key: g.key,
               dim: F.products.size && !F.products.has(g.key), color: g.key >= 3 ? RISK : PAL[0] };
    });
    columns($("cProd"), prod, { ref: ALL.rate, onClick: function (it) { toggle("products", it.key, true); } });

    // matrix
    var cells = [[1, "Active"], [0, "Inactive"]].map(function (a) {
      return [0, 1].map(function (s) {
        return rate(rows.filter(function (x) { return x[COL.ac] === a[0] && x[COL.s] === s; }));
      });
    });
    var maxR = Math.max.apply(null, cells.flat().map(function (c) { return c.rate; })) || 1;
    var shade = function (v) { var t = Math.min(1, v / Math.max(maxR, 0.3)); return "rgba(196,49,75," + (0.08 + 0.72 * t).toFixed(2) + ")"; };
    $("cMatrix").innerHTML = '<table><thead><tr><th></th><th scope="col">Female</th><th scope="col">Male</th></tr></thead><tbody>' +
      ["Active", "Inactive"].map(function (lab, i) {
        return '<tr><th scope="row">' + lab + "</th>" + cells[i].map(function (c) {
          var dark = c.rate / Math.max(maxR, 0.3) > 0.55;
          return '<td style="background:' + shade(c.rate) + ";color:" + (dark ? "#fff" : "#252423") + '">' + (c.n ? pct(c.rate, 0) : "–") + "<small>" + int(c.n) + " customers</small></td>";
        }).join("") + "</tr>";
      }).join("") + "</tbody></table>";

    var bal = groupBy(rows, function (x) { return balBand(x[COL.b]); }, [0, 1, 2, 3, 4]).map(function (g, i) {
      return { label: BAL_BANDS[i], rate: g.rate, n: g.n, left: g.left, key: i, color: PAL[2] };
    });
    columns($("cBal"), bal, { ref: ALL.rate, h: 200 });

    // insights from the filtered rows
    var ins = [];
    var gs = geo.filter(function (g) { return g.n >= 30; }).sort(function (a, b) { return b.rate - a.rate; });
    if (gs.length > 1) ins.push("<b>" + gs[0].label + "</b> loses " + pct(gs[0].rate, 0) + " of customers, against " + pct(gs[gs.length - 1].rate, 0) + " in " + gs[gs.length - 1].label + ".");
    var as = age.filter(function (g) { return g.n >= 30; }).sort(function (a, b) { return b.rate - a.rate; });
    if (as.length) ins.push("Churn peaks at ages <b>" + as[0].label + "</b> (" + pct(as[0].rate, 0) + "), not among the youngest customers.");
    var p34 = rate(rows.filter(function (x) { return x[COL.np] >= 3; })), p2 = rate(rows.filter(function (x) { return x[COL.np] === 2; }));
    if (p34.n >= 20) ins.push("Customers with <b>3 or 4 products</b> leave at " + pct(p34.rate, 0) + ", against " + pct(p2.rate, 0) + " with two: more products is not more loyalty here.");
    var ia = rate(rows.filter(function (x) { return !x[COL.ac]; })), aa = rate(rows.filter(function (x) { return x[COL.ac]; }));
    if (ia.n >= 30 && aa.n >= 30 && aa.rate > 0) ins.push("<b>Inactive</b> customers leave " + (ia.rate / aa.rate).toFixed(1) + "× as often as active ones.");
    $("insights").innerHTML = ins.length ? ins.map(function (t) { return "<li>" + t + "</li>"; }).join("") : "<li>Too few customers in this selection to compare groups.</li>";
  }

  // ---------- SEGMENTS ----------
  var SEG = C.segments.slice().sort(function (a, b) { return a.Cluster - b.Cluster; });
  var zeroSeg = SEG.reduce(function (m, s) { return s.ZeroBalanceShare > m.ZeroBalanceShare ? s : m; }, SEG[0]).Cluster;
  var others = SEG.filter(function (s) { return s.Cluster !== zeroSeg; }).sort(function (a, b) { return b.Tenure - a.Tenure; });
  var SEGNAME = {}, SEGCOL = {}, SEGTXT = {};
  SEGNAME[zeroSeg] = "Zero-balance, multi-product"; SEGCOL[zeroSeg] = SAFE;
  SEGNAME[others[0].Cluster] = "Long-standing savers"; SEGCOL[others[0].Cluster] = PAL[0];
  SEGNAME[others[1].Cluster] = "Newer high-balance"; SEGCOL[others[1].Cluster] = RISK;
  SEG.forEach(function (s) {
    SEGTXT[s.Cluster] = s.Cluster === zeroSeg
      ? pct(s.ZeroBalanceShare, 0) + " hold no balance; " + s.NumOfProducts.toFixed(1) + " products on average."
      : "Average balance " + gbp(s.Balance) + ", " + s.Tenure.toFixed(1) + " years with the bank, " + s.NumOfProducts.toFixed(1) + " products.";
  });

  function renderSegments() {
    var rows = filtered();
    var by = {}; SEG.forEach(function (s) { by[s.Cluster] = []; });
    rows.forEach(function (x) { by[x[COL.k]].push(x); });
    $("segCards").innerHTML = SEG.map(function (s) {
      var r = rate(by[s.Cluster]);
      return '<div class="segcard" style="border-left-color:' + SEGCOL[s.Cluster] + '"><div class="top"><h3>' + SEGNAME[s.Cluster] +
        '</h3><span class="n">Segment ' + s.Cluster + " · " + int(r.n) + ' customers</span></div><div class="rate">' + (r.n ? pct(r.rate) : "–") +
        "<small>churn rate</small></div><p>" + SEGTXT[s.Cluster] + "</p></div>";
    }).join("");

    // profile table (full base, unfiltered: segment definitions)
    var metrics = [["Customers", "Customers", int], ["Churn rate", "ChurnRate", function (v) { return pct(v); }],
      ["Balance", "Balance", gbp], ["Zero balance", "ZeroBalanceShare", function (v) { return pct(v, 0); }],
      ["Tenure (yrs)", "Tenure", function (v) { return v.toFixed(1); }], ["Products", "NumOfProducts", function (v) { return v.toFixed(2); }],
      ["Age", "Age", function (v) { return v.toFixed(1); }], ["In Germany", "GermanyShare", function (v) { return pct(v, 0); }],
      ["Active", "ActiveShare", function (v) { return pct(v, 0); }], ["Credit score", "CreditScore", function (v) { return v.toFixed(0); }],
      ["Salary", "EstimatedSalary", gbp]];
    var overall = {};
    metrics.forEach(function (m) {
      var tot = 0, n = 0; SEG.forEach(function (s) { tot += s[m[1]] * s.Customers; n += s.Customers; });
      overall[m[1]] = m[1] === "Customers" ? n : tot / n;
    });
    $("segTable").innerHTML = '<table class="t"><thead><tr><th>Measure</th>' + SEG.map(function (s) {
      return '<th><span style="color:' + SEGCOL[s.Cluster] + '">●</span> ' + SEGNAME[s.Cluster] + "</th>"; }).join("") + "<th>All</th></tr></thead><tbody>" +
      metrics.map(function (m) {
        return "<tr><td>" + m[0] + "</td>" + SEG.map(function (s) {
          var v = s[m[1]], o = overall[m[1]], rel = o ? (v - o) / o : 0;
          var a = Math.min(0.55, Math.abs(rel) * 0.7);
          var bg = m[1] === "Customers" || Math.abs(rel) < 0.04 ? "transparent" : (rel > 0 ? "rgba(17,141,255," + a + ")" : "rgba(230,108,55," + a + ")");
          return '<td style="background:' + bg + '">' + m[2](v) + "</td>";
        }).join("") + "<td>" + m[2](overall[m[1]]) + "</td></tr>";
      }).join("") + "</tbody></table>";

    // grouped columns: active vs inactive by segment
    var W = widthOf($("cSegActive")), H = 230, padL = 36, padB = 46, padT = 18;
    var s = svg($("cSegActive"), W, H);
    var groups = SEG.map(function (sg) {
      var rs = by[sg.Cluster];
      return { seg: sg, a: rate(rs.filter(function (x) { return x[COL.ac]; })), i: rate(rs.filter(function (x) { return !x[COL.ac]; })) };
    });
    var max = Math.max.apply(null, groups.map(function (g) { return Math.max(g.a.rate, g.i.rate); })) * 1.15 || 1;
    var Y = function (v) { return H - padB - (H - padB - padT) * v / max; };
    var gw = (W - padL) / groups.length;
    el("line", { x1: padL, x2: W, y1: Y(0), y2: Y(0), stroke: RULE }, s);
    groups.forEach(function (g, gi) {
      var cx = padL + gw * gi + gw / 2, bw = Math.min(40, gw * 0.3);
      [[g.a, "Active", "#9BC9F5"], [g.i, "Inactive", SEGCOL[g.seg.Cluster]]].forEach(function (b, bi) {
        var x = cx + (bi ? 3 : -bw - 3);
        el("rect", { x: x, y: Y(b[0].rate), width: bw, height: Math.max(1, Y(0) - Y(b[0].rate)), fill: b[2], rx: 1 }, s);
        el("text", { x: x + bw / 2, y: Y(b[0].rate) - 5, "text-anchor": "middle", "font-size": 12, "font-weight": 600 }, s, b[0].n ? pct(b[0].rate, 0) : "–");
        el("text", { x: x + bw / 2, y: Y(0) + 14, "text-anchor": "middle", "font-size": 10.5, fill: MUTED }, s, b[1]);
      });
      el("text", { x: cx, y: H - 12, "text-anchor": "middle", "font-size": 12, fill: "#252423" }, s, SEGNAME[g.seg.Cluster]);
    });

    lines($("cElbow"), [{ name: "WSS", color: PAL[0], xs: C.elbow.map(function (e) { return e.k; }), ys: C.elbow.map(function (e) { return e.wss / 1000; }),
      points: [[3, C.elbow[2].wss / 1000, 6, RISK, "k = 3 chosen"]] }],
      { xmin: 1, xmax: 10, ymin: 25, ymax: 62, xticks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], yticks: [30, 40, 50, 60], yfmt: function (v) { return v + "k"; }, xlab: "number of clusters (k)", h: 220 });

    var newHigh = groups.filter(function (g) { return g.seg.Cluster === others[1].Cluster; })[0];
    var zero = groups.filter(function (g) { return g.seg.Cluster === zeroSeg; })[0];
    $("segRec").innerHTML = "<p style='margin:0 0 8px'>Put retention budget into <b style='color:" + RISK + "'>Newer high-balance</b> customers first, and into the inactive ones within it: they leave at <b>" +
      (newHigh.i.n ? pct(newHigh.i.rate, 0) : "–") + "</b>, and they hold an average balance of " + gbp(others[1].Balance) + ".</p><p style='margin:0 0 8px'><b>Zero-balance, multi-product</b> customers leave least (" +
      (zero.a.n + zero.i.n ? pct(rate(by[zeroSeg]).rate, 0) : "–") + "). Light-touch contact is enough.</p><p class='foot' style='margin:0'>Segments split mostly on balance and tenure (24.8% of variance explained), so treat them as a planning view, alongside the model scores.</p>";
  }

  // ---------- MODELS ----------
  var MODELS = C.models;
  var MCOL = { "Logistic regression": "#8A94A0", "Decision tree (all)": "#118DFF", "Decision tree (sig var)": "#744EC2", "kNN (k tuned)": "#D9B300", "Tuned tree (Task 2)": "#C4314B" };
  var rocOn = {}; MODELS.forEach(function (m) { rocOn[m.Model] = true; });
  var bestAUC = MODELS.reduce(function (m, x) { return x.AUC > m.AUC ? x : m; }, MODELS[0]).Model;
  function renderModels() {
    $("holdoutSub").textContent = "All metrics on " + int(C.holdout.n) + " hold-out customers the models never saw, " + int(C.holdout.churners) + " of whom left. kNN uses k = " + C.knn_k + "; the tuned tree uses cp = " + C.tuned_cp + ".";
    var cols = [["Accuracy", 0.7, 0.9], ["AUC", 0.65, 0.9], ["Recall", 0, 0.6], ["Precision", 0, 1]];
    $("modelTable").innerHTML = '<table class="t"><thead><tr><th>Model</th>' + cols.map(function (c) { return "<th>" + c[0] + "</th>"; }).join("") +
      "<th>Leavers caught</th></tr></thead><tbody>" + MODELS.map(function (m) {
        return '<tr class="' + (m.Model === bestAUC ? "best" : "") + '"><td><span style="color:' + MCOL[m.Model] + '">●</span> ' + m.Model + "</td>" +
          cols.map(function (c) {
            var w = Math.max(2, 46 * (m[c[0]] - c[1]) / (c[2] - c[1]));
            return '<td><span class="cbar" style="width:' + w.toFixed(0) + 'px"></span>' + m[c[0]].toFixed(3) + "</td>";
          }).join("") + "<td>" + m.TP + " of " + (m.TP + m.FN) + "</td></tr>";
      }).join("") + "</tbody></table>";

    var tt = MODELS.filter(function (m) { return m.Model === "Tuned tree (Task 2)"; })[0], t1 = MODELS.filter(function (m) { return m.Model === "Decision tree (all)"; })[0];
    $("modelTake").innerHTML = "<b>Tuned tree:</b> highest AUC (" + tt.AUC.toFixed(3) + ") and catches <b>" + tt.TP + "</b> of " + (tt.TP + tt.FN) + " leavers at the default cut-off, against " + t1.TP + " for the Task 1 tree. The price is " + (tt.FP - t1.FP) + " more loyal customers flagged. Keep the Task 1 tree when staff need rules they can read; use the tuned tree to rank who to call.";
    var series = C.roc.map(function (r) {
      return { name: r.model, color: MCOL[r.model], xs: r.fpr, ys: r.tpr, width: r.model === "Tuned tree (Task 2)" ? 3.2 : 2, hidden: !rocOn[r.model] };
    });
    var tk = [0, 0.2, 0.4, 0.6, 0.8, 1];
    lines($("cRoc"), series, { diag: true, xticks: tk, yticks: tk.slice(1), xfmt: function (v) { return v.toFixed(1); }, yfmt: function (v) { return v.toFixed(1); },
      xlab: "false positive rate (loyal customers flagged)", ylab: "true positive rate (leavers caught)" });
    $("rocLegend").innerHTML = MODELS.map(function (m) {
      return '<button type="button" aria-pressed="' + rocOn[m.Model] + '" data-m="' + m.Model + '"><i style="background:' + MCOL[m.Model] + '"></i>' + m.Model + " · " + m.AUC.toFixed(3) + "</button>";
    }).join("");
    $("rocLegend").querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () { var k = b.getAttribute("data-m"); rocOn[k] = !rocOn[k]; renderModels(); });
    });

    renderCapture();

    var sel = $("cmModel");
    if (!sel.options.length) {
      MODELS.forEach(function (m) { var o = document.createElement("option"); o.value = m.Model; o.textContent = m.Model; sel.appendChild(o); });
      sel.value = "Tuned tree (Task 2)";
      sel.addEventListener("change", renderCM);
    }
    renderCM();

    drawTree($("tree1"), C.tree1, null);

    var cp = C.cp_curve;
    lines($("cCp"), [{ name: "ROC", color: PAL[0], xs: cp.map(function (r) { return r.cp; }), ys: cp.map(function (r) { return r.ROC; }),
      points: [[C.tuned_cp, cp[0].ROC, 5, RISK, "cp " + C.tuned_cp + " · CV AUC " + cp[0].ROC.toFixed(3)]] }],
      { xmin: 0, xmax: 0.021, ymin: 0.74, ymax: 0.83, xticks: [0.005, 0.01, 0.015, 0.02], yticks: [0.75, 0.78, 0.81], xfmt: function (v) { return v.toFixed(3); },
        yfmt: function (v) { return v.toFixed(2); }, xlab: "complexity parameter (cp)", ylab: "cross-validated AUC", h: 220 });
    $("cpNote").textContent = "Five-fold cross-validation picked the smallest cp on the grid (" + C.tuned_cp + "), giving a deeper tree. Because the best value sits at the edge of the grid, a finer search below " + C.tuned_cp + " is the next step.";
  }
  function renderCapture() {
    var k = +$("capSlider").value; $("capPct").textContent = k + "%";
    var xs = []; for (var i = 1; i <= 100; i++) xs.push(i / 100);
    var cap = C.capture;
    lines($("cCapture"), [
      { name: "Random", color: "#A19F9D", xs: [0, 1], ys: [0, 1], dash: "4 4", width: 1.5 },
      { name: "Logistic", color: MCOL["Logistic regression"], xs: [0].concat(xs), ys: [0].concat(cap.logistic), width: 1.8 },
      { name: "Task 1 tree", color: MCOL["Decision tree (all)"], xs: [0].concat(xs), ys: [0].concat(cap.task1), width: 1.8 },
      { name: "Tuned tree", color: MCOL["Tuned tree (Task 2)"], xs: [0].concat(xs), ys: [0].concat(cap.tuned), width: 3, points: [[k / 100, cap.tuned[k - 1], 5]] }
    ], { vline: k / 100, xticks: [0, 0.2, 0.4, 0.6, 0.8, 1], yticks: [0.25, 0.5, 0.75, 1], xfmt: function (v) { return pct(v, 0); }, yfmt: function (v) { return pct(v, 0); },
         xlab: "share of customers contacted, riskiest first", ylab: "share of leavers reached", h: 230 });
    var reach = cap.tuned[k - 1], t1 = cap.task1[k - 1];
    var contacts = Math.round(C.holdout.n * k / 100), found = reach * C.holdout.churners;
    $("capOut").innerHTML = "<div style='border-color:" + RISK + "'><b>" + pct(reach, 0) + "</b><span>of leavers reached with the tuned tree</span></div>" +
      "<div><b>" + pct(t1, 0) + "</b><span>with the Task 1 tree; " + k + "% at random</span></div>" +
      "<div><b>" + (contacts / found).toFixed(1) + "</b><span>contacts per leaver reached (random: " + (C.holdout.n / C.holdout.churners).toFixed(1) + ")</span></div>";
  }
  $("capSlider").addEventListener("input", renderCapture);
  function renderCM() {
    var m = MODELS.filter(function (x) { return x.Model === $("cmModel").value; })[0];
    var tot = m.TP + m.FP + m.FN + m.TN;
    var cell = function (v, lab, good) {
      var a = 0.12 + 0.6 * v / tot;
      return '<div class="c" style="background:' + (good ? "rgba(16,124,16," + a + ")" : "rgba(196,49,75," + Math.min(0.7, a * 2.2) + ")") + '"><b>' + int(v) + "</b><span>" + lab + "</span></div>";
    };
    $("cmGrid").innerHTML = '<span></span><span class="h">Predicted: stays</span><span class="h">Predicted: leaves</span>' +
      '<span class="r">Stayed</span>' + cell(m.TN, "correctly left alone", true) + cell(m.FP, "incentive wasted", false) +
      '<span class="r">Left</span>' + cell(m.FN, "leaver missed", false) + cell(m.TP, "leaver caught", true);
  }

  // ---------- TREE ----------
  var score = window.ChurnTree.score, nodeMap = window.ChurnTree.nodeMap, dummies = window.ChurnTree.dummies;
  var PRETTY = { IsActiveMember: "Active member", NumOfProducts: "Products", Geography: "Country", Balance: "Balance", Age: "Age" };
  // negate = describe the "no" branch instead of the "yes" branch
  function prettyLabel(nd, negate) {
    var v = PRETTY[nd.var] || nd.var;
    if (nd.type === "cat") {
      var left = Array.isArray(nd.left) ? nd.left : [nd.left];
      var all = nd.var === "IsActiveMember" ? ["0", "1"] : C.levels[nd.var];
      var side = negate ? all.filter(function (l) { return left.indexOf(l) < 0; }) : left;
      if (nd.var === "IsActiveMember") return v + " = " + (side[0] === "1" ? "yes" : "no");
      return v + " = " + side.join(" or ");
    }
    var c = nd.var === "Balance" ? gbp(nd.cut) : (Math.round(nd.cut * 10) / 10);
    var less = negate ? !nd.leftIfLess : nd.leftIfLess;
    return v + (less ? " < " : " ≥ ") + c;
  }
  function drawTree(container, nodes, path) {
    var m = nodeMap(nodes);
    var onPath = {}; (path || []).forEach(function (id) { onPath[id] = true; });
    var leafIx = 0, maxDepth = 0, pos = {};
    (function layout(id, depth) {
      maxDepth = Math.max(maxDepth, depth);
      var nd = m[id];
      if (!nd.var) { pos[id] = { x: leafIx++, d: depth }; return; }
      layout(2 * id, depth + 1); layout(2 * id + 1, depth + 1);
      pos[id] = { x: (pos[2 * id].x + pos[2 * id + 1].x) / 2, d: depth };
    })(1, 0);
    var W = Math.max(760, container.clientWidth || 760), colW = W / leafIx, rowH = 92, bw = Math.min(118, colW - 10), bh = 44, H = (maxDepth + 1) * rowH + 10;
    var s = svg(container, W, H);
    var X = function (id) { return (pos[id].x + 0.5) * (W / leafIx); };
    var Y = function (id) { return 10 + pos[id].d * rowH; };
    var rootN = m[1].n;
    Object.keys(pos).forEach(function (k) {
      var id = +k, nd = m[id];
      if (!nd.var) return;
      [2 * id, 2 * id + 1].forEach(function (c, ci) {
        var hot = onPath[id] && onPath[c];
        var x1 = X(id), y1 = Y(id) + bh + 20, x2 = X(c), y2 = Y(c);
        el("path", { d: "M" + x1 + " " + y1 + " V" + (y1 + 10) + " H" + x2 + " V" + y2, fill: "none", stroke: hot ? "#252423" : "#C8C6C4", "stroke-width": hot ? 2.5 : 1.2 }, s);
        el("text", { x: x2 + (ci ? 6 : -6), y: y1 + 24, "text-anchor": ci ? "start" : "end", "font-size": 10.5, fill: MUTED }, s, ci ? "no" : "yes");
      });
    });
    Object.keys(pos).forEach(function (k) {
      var id = +k, nd = m[id], x = X(id), y = Y(id), risky = nd.p >= 0.5;
      var t = Math.abs(nd.p - 0.5) * 2;
      var fill = risky ? "rgba(196,49,75," + (0.15 + 0.7 * t).toFixed(2) + ")" : "rgba(17,141,255," + (0.12 + 0.55 * t).toFixed(2) + ")";
      var dark = t > 0.55;
      var g = el("g", {}, s);
      el("rect", { x: x - bw / 2, y: y, width: bw, height: bh, rx: 4, fill: fill, stroke: onPath[id] ? "#252423" : "none", "stroke-width": 2.5 }, g);
      el("text", { x: x, y: y + 18, "text-anchor": "middle", "font-size": 15, "font-weight": 600, fill: dark ? "#fff" : "#252423" }, g, pct(nd.p, 0) + " leave");
      el("text", { x: x, y: y + 35, "text-anchor": "middle", "font-size": 11.5, fill: dark ? "#fff" : "#484644" }, g, pct(nd.n / rootN, 0) + " of base");
      el("title", {}, g, int(nd.n) + " training customers, " + pct(nd.p) + " left");
      if (nd.var) el("text", { x: x, y: y + bh + 15, "text-anchor": "middle", "font-size": 12.5, "font-weight": 600, fill: "#252423" }, s, prettyLabel(nd));
    });
  }

  // ---------- PREDICT ----------
  var P = { Gender: "Female", Geography: "Germany", IsActiveMember: "0", HasCrCard: "1" };
  function readForm() {
    P.Age = +$("inAge").value; P.NumOfProducts = +$("inProd").value; P.Tenure = +$("inTen").value;
    P.Balance = +$("inBal").value; P.CreditScore = +$("inCs").value; P.EstimatedSalary = +$("inSal").value;
    $("vAge").textContent = P.Age; $("vProd").textContent = P.NumOfProducts; $("vTen").textContent = P.Tenure;
    $("vBal").textContent = "£" + int(P.Balance); $("vCs").textContent = P.CreditScore; $("vSal").textContent = "£" + int(P.EstimatedSalary);
  }
  function gauge(p) {
    var W = 280, H = 160, cx = 140, cy = 140, r = 110;
    var a = Math.PI * (1 - p), x = cx + r * Math.cos(a), y = cy - r * Math.sin(a);
    var col = p >= 0.5 ? RISK : SAFE;
    return '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + pct(p, 0) + ' probability of leaving">' +
      '<path d="M30 140 A110 110 0 0 1 250 140" fill="none" stroke="#EDEBE9" stroke-width="22"/>' +
      (p > 0.001 ? '<path d="M30 140 A110 110 0 0 1 ' + x.toFixed(1) + " " + y.toFixed(1) + '" fill="none" stroke="' + col + '" stroke-width="22"/>' : "") +
      '<line x1="140" y1="24" x2="140" y2="40" stroke="#252423" stroke-width="2"/><text x="140" y="18" text-anchor="middle" font-size="11" fill="#605E5C">50%</text>' +
      '<text x="140" y="128" text-anchor="middle" font-size="40" font-weight="600" fill="#252423">' + pct(p, 0) + "</text>" +
      '<text x="140" y="152" text-anchor="middle" font-size="12" fill="#605E5C">probability of leaving</text></svg>';
  }
  function resultCard(box, title, sub, res) {
    var risky = res.p >= 0.5;
    box.innerHTML = '<div class="model">' + title + "</div><h2 style='margin:0'>" + sub + "</h2>" +
      '<div class="verdict ' + (risky ? "risk" : "safe") + '">' + (risky ? "Likely to close the account" : "Likely to stay") + "</div>" +
      '<div class="gauge">' + gauge(res.p) + "</div>" +
      '<p class="meta">Ends in a leaf of ' + int(res.leaf.n) + " training customers, " + pct(res.leaf.p, 0) + " of whom left.</p>" + (res.rules || "");
  }
  function renderPredict() {
    readForm();
    var r1 = score(C.tree1, P), r2 = score(C.tree2, dummies(P));
    var m1 = nodeMap(C.tree1);
    r1.rules = '<ol class="rules">' + r1.path.slice(0, -1).map(function (id, i) {
      var nd = m1[id], wentLeft = r1.path[i + 1] === 2 * id, lab = prettyLabel(nd, false);
      return "<li>" + (wentLeft ? lab : prettyLabel(nd, true)) + "</li>"; }).join("") + "</ol>";
    r2.rules = '<p class="meta">' + (r2.path.length - 1) + " splits deep, using " + C.tree2.filter(function (n) { return n.var; }).map(function (n) { return n.var; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).length + " of the customer fields.</p>";
    resultCard($("res1"), "Task 1 · decision tree", "Readable rules, 10 leaves", r1);
    resultCard($("res2"), "Task 2 · tuned tree", "Cross-validated, " + C.tree2.filter(function (n) { return !n.var; }).length + " leaves", r2);
    drawTree($("tree1p"), C.tree1, r1.path);
    // observed churn among similar customers in the data
    var g = GEO.indexOf(P.Geography), ac = +P.IsActiveMember;
    var pick = function (span, useProd) {
      return ROWS.filter(function (x) {
        return x[COL.g] === g && x[COL.ac] === ac && Math.abs(x[COL.a] - P.Age) <= span &&
          (!useProd || (P.NumOfProducts >= 3 ? x[COL.np] >= 3 : x[COL.np] === P.NumOfProducts));
      });
    };
    var sim = pick(5, true), how = "same country, activity and products, age within 5 years";
    if (sim.length < 30) { sim = pick(8, false); how = "same country and activity, age within 8 years"; }
    var sr = rate(sim);
    $("similar").innerHTML = '<div class="big">' + (sr.n ? pct(sr.rate, 0) : "–") + "</div><p>of " + int(sr.n) + " real customers like this one left (" + how + ").</p>" +
      "<p class='foot'>An outside check on the model: what actually happened to similar customers.</p>";
  }
  document.querySelectorAll(".seg-ctl").forEach(function (box) {
    var k = box.getAttribute("data-k");
    box.querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () {
        P[k] = b.getAttribute("data-v");
        box.querySelectorAll("button").forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
        renderPredict();
      });
    });
  });
  ["inAge", "inProd", "inTen", "inBal", "inCs", "inSal"].forEach(function (id) { $(id).addEventListener("input", renderPredict); });

  // ---------- pages ----------
  var current = "overview";
  var RENDER = { overview: renderOverview, segments: renderSegments, models: renderModels, predict: renderPredict };
  function show(page) {
    current = page;
    document.querySelectorAll(".pages button").forEach(function (b) { b.setAttribute("aria-selected", b.getAttribute("data-page") === page ? "true" : "false"); });
    document.querySelectorAll(".page").forEach(function (p) { p.hidden = p.id !== "page-" + page; });
    try { history.replaceState(null, "", "#" + page); } catch (e) {}
    RENDER[page]();
  }
  document.querySelectorAll(".pages button").forEach(function (b) {
    b.addEventListener("click", function () { show(b.getAttribute("data-page")); window.scrollTo(0, 0); });
  });
  function refresh() { buildSlicers(); if (current === "overview" || current === "segments") RENDER[current](); }
  var rt; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { RENDER[current](); }, 150); });

  buildSlicers();
  var start = (location.hash || "").replace("#", "");
  show(RENDER[start] ? start : "overview");
})();
