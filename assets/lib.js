/* CORUM public board: shared data helpers. The data is a snapshot written by the build; nothing here calls a server. */
(function () {
  var D = window.CORUM || { nodes: [], edges: [], scen: [], co: {}, cov: {}, groups: {}, centres: {}, canvas: [1760, 1180] };
  var byId = {}, scen = {}, nodeCos = {};
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
  Object.keys(D.co).forEach(function (t) {
    D.co[t][1].forEach(function (id) { (nodeCos[id] = nodeCos[id] || []).push(t); });
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
    D: D, byId: byId, scen: scen, nodeCos: nodeCos, esc: esc, fmt: fmt,
    TIER: { measured: 'Measured', cited: 'Cited', judgment: 'Judgement', contradicted: 'Contradicted' },
    label: function (id) { return byId[id] ? byId[id].label : id; },
    group: function (g) { return D.groups[g] || g; },
    steps: function (n) { return n === 1 ? 'one step from the shock' : n + ' steps from the shock'; }
  };
})();
