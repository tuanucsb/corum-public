/* Home: the shock figure. The first shock is already drawn in the page; this redraws on a choice. */
(function () {
  var C = window.C;
  if (!C || !C.D.scen.length) return;
  var $ = function (id) { return document.getElementById(id); };
  var neg = $('barsNeg'), pos = $('barsPos'), story = $('scStory'), path = $('scPath'), toMap = $('scMap'), sel = $('scenSel');
  var btns = [].slice.call(document.querySelectorAll('.scen-b'));
  var cur = C.D.scen[0].id, pick = null, N = 8;

  function sides(s) {
    var ids = Object.keys(s.imp).sort(function (a, b) { return s.imp[a] - s.imp[b]; });
    var lo = ids.slice(0, N).filter(function (i) { return s.imp[i] < 0; });
    var hi = ids.slice(-N).reverse().filter(function (i) { return s.imp[i] > 0; });
    return [lo, hi];
  }
  function rows(ids, s, top) {
    if (!ids.length) return "<li class='none'>Nothing on this side for this shock.</li>";
    return ids.map(function (i) {
      var v = s.imp[i];
      return "<li><button type='button' class='brow' data-id='" + C.esc(i) + "' aria-pressed='" + (i === pick) + "'><span class='nm'>" +
        C.esc(C.label(i)) + "</span><span class='bar'><i style='width:" + (100 * Math.abs(v) / top).toFixed(1) + "%'></i></span><span class='val tnum'>" +
        C.fmt(v) + "</span></button></li>";
    }).join('');
  }
  function drawPath() {
    var s = C.scen[cur];
    if (!pick) { path.innerHTML = ''; return; }
    var ps = s.paths[pick] || [], v = s.imp[pick];
    var h = "<h3>How it gets to " + C.esc(C.label(pick)) + " <span class='tnum " + (v < 0 ? 'neg-t' : 'pos-t') + "'>" + C.fmt(v) + "</span></h3>";
    if (ps.length) {
      h += '<ul>' + ps.map(function (p) {
        return "<li>through <b>" + C.esc(p[0]) + "</b>, a link of <span class='sgn tnum " + (p[1] < 0 ? 'neg-t' : 'pos-t') + "'>" + C.fmt(p[1]) + "</span>, " + C.steps(p[2]) + "</li>";
      }).join('') + '</ul>';
    } else {
      h += "<p>The path is not recorded for this node.</p>";
    }
    h += "<p><a href='map.html#" + encodeURIComponent(pick) + "&shock=" + encodeURIComponent(cur) + "'>See " + C.esc(C.label(pick)) + " on the map →</a></p>";
    path.innerHTML = h;
  }
  function draw() {
    var s = C.scen[cur], sd = sides(s), all = sd[0].concat(sd[1]);
    var top = Math.max.apply(null, all.map(function (i) { return Math.abs(s.imp[i]); }).concat([0.0001]));
    if (all.indexOf(pick) < 0) pick = sd[0][0] || sd[1][0] || null;
    neg.innerHTML = rows(sd[0], s, top);
    pos.innerHTML = rows(sd[1], s, top);
    story.textContent = s.story || (all.length ? '' : 'This shock moves nothing in the map.');
    toMap.href = 'map.html#shock=' + encodeURIComponent(cur);
    btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.s === cur)); });
    if (sel) sel.value = cur;
    drawPath();
  }
  function choose(id) { if (C.scen[id]) { cur = id; pick = null; draw(); } }
  btns.forEach(function (b) { b.addEventListener('click', function () { choose(b.dataset.s); }); });
  if (sel) sel.addEventListener('change', function () { choose(sel.value); });
  [neg, pos].forEach(function (ol) {
    ol.addEventListener('click', function (e) {
      var b = e.target.closest('.brow');
      if (!b || !b.dataset.id) return;
      pick = b.dataset.id;
      [].forEach.call(document.querySelectorAll('.brow'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      drawPath();
    });
  });
  draw();
})();
