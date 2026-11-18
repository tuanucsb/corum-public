/* CORUM public board: shared data helpers. The data is a snapshot written by the build; nothing here calls a server. */
(function () {
  var D = window.CORUM || { nodes: [], edges: [], scen: [], cov: {}, groups: {}, centres: {}, canvas: [1760, 1180] };
  var M = window.CORUM_M || { list: [], imp: {} };
  var byId = {}, scen = {}, nodeCos = {}, mem = {};
  D.nodes.forEach(function (n) { byId[n.id] = n; n.inn = []; n.out = []; });
  D.edges.forEach(function (e, i) {
    e.i = i;
    if (byId[e.s]) byId[e.s].out.push(e);
    if (byId[e.t]) byId[e.t].inn.push(e);
  });
  D.nodes.forEach(function (n) {
    var big = function (a, b) { return Math.abs(b.w) - Math.abs(a.w); };
    n.inn.sort(big); n.out.sort(big);
  });
  D.scen.forEach(function (s) { scen[s.id] = s; });
  /* companies and funds: on the map page only. nodeCos lists, for an industry, every name that sits in it */
  M.list.forEach(function (m) {
    mem[m.t] = m;
    m.in.forEach(function (x) { if (byId[x[0]]) (nodeCos[x[0]] = nodeCos[x[0]] || []).push(m.t); });
  });
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(v, d) {
    if (v == null || isNaN(v)) return '';
    var a = Math.abs(v).toFixed(d == null ? 2 : d);
    return (v > 0 ? '+' : v < 0 ? '−' : '') + a;
  }
  window.C = {
    D: D, M: M, byId: byId, scen: scen, nodeCos: nodeCos, mem: mem, esc: esc, fmt: fmt,
    cap: function (bn) { return bn == null ? '' : bn >= 1000 ? '$' + (bn / 1000).toFixed(2) + ' trillion' : bn >= 1 ? '$' + bn.toFixed(bn >= 100 ? 0 : 1) + ' billion' : '$' + Math.round(bn * 1000) + ' million'; },
    TIER: { measured: 'Measured', cited: 'Cited', judgment: 'Judgement', contradicted: 'Contradicted' },
    label: function (id) { return byId[id] ? byId[id].label : id; },
    group: function (g) { return D.groups[g] || g; },
    steps: function (n) { return n === 1 ? 'one step from the shock' : n + ' steps from the shock'; }
  };
})();
