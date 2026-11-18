/* The influence map: one SVG drawn from the snapshot, a details panel, and a list that holds the same nodes. */
(function () {
  var C = window.C;
  if (!C || !C.D.nodes.length) return;
  var D = C.D, byId = C.byId, esc = C.esc, fmt = C.fmt;
  var $ = function (id) { return document.getElementById(id); };
  var NS = 'http://www.w3.org/2000/svg';
  var svg = $('map'), gE = $('gEdges'), gN = $('gNodes'), gG = $('gGroups'), panel = $('panel'), stage = $('stage');
  var q = $('q'), qres = $('qres'), selShock = $('shock'), selTier = $('tier'), tbl = $('nodeTbl');
  var W = D.canvas[0], H = D.canvas[1];
  var view = { x: 0, y: 0, w: W, h: H };
  var st = { sel: null, from: null, co: null, shock: '', tier: '', hidden: {}, cursor: -1, open: {} };
  var narrow = function () { return window.matchMedia('(max-width: 1099px)').matches; };

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function rad(n) { return n.kind === 'driver' ? 8.5 : Math.max(4.5, Math.min(13, 4 + Math.sqrt(n.cap || 0) / 7)); }
  function short(s) { return s.length > 24 ? s.slice(0, 22) + '…' : s; }

  /* ---------- draw once ---------- */
  Object.keys(D.centres).forEach(function (g) {
    var c = D.centres[g];
    el('circle', { 'class': 'gring gc-' + g, cx: c.x, cy: c.y, r: c.r }, gG);
    var t = el('text', { 'class': 'gl', x: c.x, y: c.y - c.r - 9 }, gG);
    t.textContent = C.group(g);
  });
  D.edges.forEach(function (e) {
    var a = byId[e.s], b = byId[e.t];
    if (!a || !b) return;
    e.el = el('line', { 'class': 'e ' + e.tier + (e.w < 0 ? ' neg' : ' pos'), x1: a.x, y1: a.y, x2: b.x, y2: b.y }, gE);
  });
  var rank = {};
  D.nodes.forEach(function (n) { (rank[n.g] = rank[n.g] || []).push(n); });
  Object.keys(rank).forEach(function (g) {
    rank[g].sort(function (a, b) { return (b.inn.length + b.out.length) - (a.inn.length + a.out.length); });
    rank[g].slice(0, g === 'TECH' || g === 'HEALTHCARE' ? 4 : 2).forEach(function (n) { n.lab = true; });
  });
  D.nodes.forEach(function (n) {
    var r = rad(n);
    var g = el('g', { 'class': 'n ' + n.kind + ' gc-' + n.g + (n.lab ? ' lab' : ''), transform: 'translate(' + n.x + ',' + n.y + ')', 'data-id': n.id, tabindex: '-1', role: 'button', 'aria-label': n.label }, gN);
    if (n.kind === 'driver') el('rect', { 'class': 's', x: -r, y: -r, width: 2 * r, height: 2 * r, transform: 'rotate(45)' }, g);
    else el('circle', { 'class': 's', r: r }, g);
    var t = el('text', { y: r + (n.kind === 'driver' ? 17 : 13) }, g);
    t.textContent = short(n.label);
    el('title', {}, g).textContent = n.label;
    n.el = g;
  });
  $('stageMsg').hidden = true;

  /* ---------- pan and zoom ---------- */
  function applyView() {
    svg.setAttribute('viewBox', [view.x, view.y, view.w, view.h].join(' '));
    svg.classList.toggle('z2', W / view.w > 1.75);
  }
  function pt(ev) {
    var p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY;
    var m = svg.getScreenCTM();
    return m ? p.matrixTransform(m.inverse()) : { x: W / 2, y: H / 2 };
  }
  function zoom(f, cx, cy) {
    var nw = Math.max(W / 14, Math.min(W * 1.1, view.w * f)), k = nw / view.w;
    if (cx == null) { cx = view.x + view.w / 2; cy = view.y + view.h / 2; }
    view.x = cx - (cx - view.x) * k; view.y = cy - (cy - view.y) * k; view.w = nw; view.h = nw * H / W;
    applyView();
  }
  function fit() { view = { x: 0, y: 0, w: W, h: H }; applyView(); }
  function centreOn(n) {
    if (view.w > W * 0.99) return;
    view.x = n.x - view.w / 2; view.y = n.y - view.h / 2; applyView();
  }
  svg.addEventListener('wheel', function (ev) {
    ev.preventDefault();
    var p = pt(ev); zoom(ev.deltaY > 0 ? 1.14 : 1 / 1.14, p.x, p.y);
  }, { passive: false });
  var ptrs = {}, drag = null, moved = 0, pinch = 0;
  svg.addEventListener('pointerdown', function (ev) {
    ptrs[ev.pointerId] = ev;
    var ids = Object.keys(ptrs);
    if (ids.length === 1) { drag = { cx: ev.clientX, cy: ev.clientY, x: view.x, y: view.y }; moved = 0; }
    if (ids.length === 2) { pinch = Math.hypot(ptrs[ids[0]].clientX - ptrs[ids[1]].clientX, ptrs[ids[0]].clientY - ptrs[ids[1]].clientY); drag = null; }
  });
  svg.addEventListener('pointermove', function (ev) {
    if (!ptrs[ev.pointerId]) return;
    ptrs[ev.pointerId] = ev;
    var ids = Object.keys(ptrs);
    if (ids.length === 2 && pinch) {
      var d = Math.hypot(ptrs[ids[0]].clientX - ptrs[ids[1]].clientX, ptrs[ids[0]].clientY - ptrs[ids[1]].clientY);
      if (d > 0) { zoom(pinch / d); pinch = d; }
      return;
    }
    if (!drag) return;
    var r = svg.getBoundingClientRect(), k = Math.max(view.w / r.width, view.h / r.height);
    var dx = ev.clientX - drag.cx, dy = ev.clientY - drag.cy;
    moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
    if (moved > 4) { svg.classList.add('drag'); view.x = drag.x - dx * k; view.y = drag.y - dy * k; applyView(); }
  });
  function up(ev) { delete ptrs[ev.pointerId]; drag = null; pinch = 0; svg.classList.remove('drag'); }
  svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up); svg.addEventListener('pointerleave', up);
  $('zIn').addEventListener('click', function () { zoom(1 / 1.35); });
  $('zOut').addEventListener('click', function () { zoom(1.35); });
  $('zFit').addEventListener('click', fit);

  /* ---------- state and address ---------- */
  function writeHash() {
    var parts = [];
    if (st.co) parts.push('co=' + encodeURIComponent(st.co));
    else if (st.sel && st.from) parts.push(encodeURIComponent(st.from) + '>' + encodeURIComponent(st.sel));
    else if (st.sel) parts.push(encodeURIComponent(st.sel));
    if (st.shock) parts.push('shock=' + encodeURIComponent(st.shock));
    var h = parts.length ? '#' + parts.join('&') : location.pathname + location.search;
    try { history.replaceState(null, '', h); } catch (x) { /* a file: page cannot rewrite its address */ }
  }
  function readHash() {
    var raw = location.hash.replace(/^#/, '');
    var next = { sel: null, from: null, co: null, shock: '', bad: null };
    raw.split('&').filter(Boolean).forEach(function (part) {
      var p = decodeURIComponent(part);
      if (p.indexOf('shock=') === 0) { if (C.scen[p.slice(6)]) next.shock = p.slice(6); }
      else if (p.indexOf('co=') === 0) { var t = p.slice(3).toUpperCase(); if (D.co[t]) next.co = t; else next.bad = p.slice(3); }
      else if (p.indexOf('>') > 0) { var ab = p.split('>'); if (byId[ab[0]] && byId[ab[1]]) { next.from = ab[0]; next.sel = ab[1]; } else next.bad = p; }
      else if (byId[p]) next.sel = p;
      else next.bad = p;
    });
    st.sel = next.sel; st.from = next.from; st.co = next.co; st.shock = next.shock; st.bad = next.bad; st.cursor = -1;
    selShock.value = st.shock;
  }
  function select(id, from) {
    st.sel = id; st.from = from || null; st.co = null; st.cursor = -1; st.bad = null; st.open = {};
    update();
    if (id && byId[id]) centreOn(byId[id]);
    if (id && narrow()) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- what is lit ---------- */
  function shown(e) {
    return !st.hidden[byId[e.s].g] && !st.hidden[byId[e.t].g] && (!st.tier || e.tier === st.tier);
  }
  function update() {
    var s = st.shock ? C.scen[st.shock] : null, lit = {}, top = 0.0001;
    if (st.co) D.co[st.co][1].forEach(function (id) { lit[id] = 1; });
    if (st.sel) lit[st.sel] = 1;
    if (s) Object.keys(s.imp).forEach(function (i) { top = Math.max(top, Math.abs(s.imp[i])); });
    D.edges.forEach(function (e) {
      if (!e.el) return;
      var on = !!st.sel && (e.s === st.sel || e.t === st.sel) && shown(e);
      if (on) { lit[e.s] = 1; lit[e.t] = 1; }
      e.el.setAttribute('class', 'e ' + e.tier + (e.w < 0 ? ' neg' : ' pos') + (shown(e) ? '' : ' hide') + (on ? ' on' : '') +
        (on && st.from && e.s === st.from && e.t === st.sel ? ' pick' : ''));
    });
    D.nodes.forEach(function (n) {
      var c = 'n ' + n.kind + ' gc-' + n.g + (n.lab ? ' lab' : '');
      if (st.hidden[n.g]) c += ' hide';
      if (lit[n.id]) c += ' on';
      if (n.id === st.sel) c += ' me';
      if (s) {
        var v = s.imp[n.id];
        if (n.id === s.node) c += ' src';
        else if (v > 0) c += ' up';
        else if (v < 0) c += ' dn';
        n.el.style.setProperty('--a', v ? (0.25 + 0.75 * Math.sqrt(Math.abs(v) / top)).toFixed(2) : '1');
      }
      n.el.setAttribute('class', c);
    });
    svg.classList.toggle('sel', !!(st.sel || st.co));
    svg.classList.toggle('shock', !!s);
    var allHidden = D.nodes.every(function (n) { return st.hidden[n.g]; });
    $('stageMsg').hidden = !allHidden;
    if (allHidden) $('stageMsg').textContent = 'All groups are hidden. Use "Show all" above.';
    [].forEach.call(tbl.tBodies[0].rows, function (r) {
      var v = s ? s.imp[r.dataset.id] : null;
      r.cells[4].textContent = s && r.dataset.id === s.node ? 'the shock' : (v ? fmt(v) : '');
      r.cells[4].className = 'tnum imp ' + (v > 0 ? 'pos-t' : v < 0 ? 'neg-t' : '');
      r.classList.toggle('me', r.dataset.id === st.sel);
      r.hidden = !!st.hidden[byId[r.dataset.id].g];
    });
    drawPanel();
    writeHash();
  }

  /* ---------- the panel ---------- */
  function tier(e) { return "<span class='tier " + e.tier + "'><i></i>" + C.TIER[e.tier] + "</span>"; }
  function evidence(e) {
    var rows = [];
    if (e.m) rows.push(['How the number was set', e.m]);
    if (e.fit) rows.push(['Measured value', fmt(e.fit[0], 3) + (e.fit[1] != null ? ', 95% interval ' + fmt(e.fit[1], 3) + ' to ' + fmt(e.fit[2], 3) : '')]);
    if (e.smp) rows.push(['Sample', e.smp]);
    if (e.cite) rows.push(['Source', e.cite]);
    if (e.cav) rows.push(['Caveat', e.cav]);
    if (e.lag) rows.push(['Timing', 'Acts with a lag of ' + e.lag + (e.lag === 1 ? ' period' : ' periods')]);
    if (!rows.length) rows.push(['How the number was set', 'No study sets this number and it has not been measured.']);
    return '<dl>' + rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>';
  }
  function links(list, side, key) {
    var vis = list.filter(shown), cap = st.open[key] ? vis.length : 10;
    if (!vis.length) return '';
    var h = "<ul class='lnk'>" + vis.slice(0, cap).map(function (e) {
      var other = side === 'in' ? e.s : e.t, open = side === 'in' && st.from === e.s;
      return "<li><details" + (open ? ' open' : '') + "><summary><span class='who'><button type='button' data-go='" + esc(other) + "'>" + esc(C.label(other)) +
        "</button></span><span class='w tnum " + (e.w < 0 ? 'neg-t' : 'pos-t') + "'>" + fmt(e.w) + "</span><span class='rs'>" + tier(e) + ' · ' + esc(e.why) +
        "</span></summary><div class='ev'>" + evidence(e) + "</div></details></li>";
    }).join('') + '</ul>';
    if (vis.length > cap) h += "<button type='button' class='more' data-open='" + key + "'>Show all " + vis.length + "</button>";
    return h;
  }
  function starts() {
    var top = D.nodes.slice().sort(function (a, b) { return (b.inn.length + b.out.length) - (a.inn.length + a.out.length); }).slice(0, 5);
    return "<ul class='starts'>" + top.map(function (n) {
      return "<li><button type='button' data-go='" + esc(n.id) + "'><span>" + esc(n.label) + "</span><span class='v tnum'>" + (n.inn.length + n.out.length) + " links</span></button></li>";
    }).join('') + '</ul>';
  }
  function movers(s) {
    var ids = Object.keys(s.imp).sort(function (a, b) { return Math.abs(s.imp[b]) - Math.abs(s.imp[a]); }).slice(0, 10);
    if (!ids.length) return '<p>This shock moves nothing in the map.</p>';
    return "<ul class='starts'>" + ids.map(function (i) {
      return "<li><button type='button' data-go='" + esc(i) + "'><span>" + esc(C.label(i)) + "</span><span class='v tnum " + (s.imp[i] < 0 ? 'neg-t' : 'pos-t') + "'>" + fmt(s.imp[i]) + "</span></button></li>";
    }).join('') + '</ul>';
  }
  function drawPanel() {
    var s = st.shock ? C.scen[st.shock] : null, h = '';
    var back = "<a class='backmap' href='#stage'>↑ Back to the map</a>";
    if (st.bad) {
      h = "<h2>No node called “" + esc(st.bad) + "”</h2><p class='why'>Try the Find box above, or start from one of these.</p>" + starts();
    } else if (st.co) {
      var c = D.co[st.co];
      h = back + "<p class='kicker'><span class='mono'>" + esc(st.co) + "</span></p><h2>" + esc(c[0]) + "</h2><p class='why'>On the map it sits in " +
        (c[1].length === 1 ? 'one industry' : c[1].length + ' industries') + ". Each is lit.</p><ul class='starts'>" + c[1].map(function (id) {
          return "<li><button type='button' data-go='" + esc(id) + "'><span>" + esc(C.label(id)) + "</span><span class='v'>" + esc(C.group(byId[id].g)) + "</span></button></li>";
        }).join('') + '</ul>';
    } else if (st.sel) {
      var n = byId[st.sel];
      h = back + "<p class='kicker'><i class='gdot gc-" + n.g + "'></i>" + esc(C.group(n.g)) + ' · ' + (n.kind === 'driver' ? 'driver' : 'industry') + ' · moved by ' + n.inn.length + ', moves ' + n.out.length + "</p><h2>" + esc(n.label) + "</h2>";
      if (n.why) h += "<p class='why'>" + esc(n.why) + "</p>";
      if (s) {
        var v = s.imp[n.id];
        h += "<div class='under'><span>Under “" + esc(s.name) + "”</span>";
        if (n.id === s.node) h += "<b class='big'>The shock starts here</b>";
        else if (v) {
          h += "<b class='big tnum " + (v < 0 ? 'neg-t' : 'pos-t') + "'>" + fmt(v) + " σ</b>";
          var ps = s.paths[n.id];
          if (ps && ps.length) h += '<span>' + ps.map(function (p) { return 'through ' + esc(p[0]) + ' (link ' + fmt(p[1]) + ', ' + C.steps(p[2]) + ')'; }).join('; ') + '</span>';
        } else h += "<b class='big'>Not reached</b>";
        h += '</div>';
      }
      var inn = links(n.inn, 'in', 'in'), out = links(n.out, 'out', 'out');
      h += '<h3>Moved by ' + (n.inn.length ? '(' + n.inn.length + ')' : '') + '</h3>' + (inn || "<p class='why'>" + (n.inn.length ? 'No links match this filter.' : 'Nothing on the map moves this. It is a starting point.') + '</p>');
      h += '<h3>Moves ' + (n.out.length ? '(' + n.out.length + ')' : '') + '</h3>' + (out || "<p class='why'>" + (n.out.length ? 'No links match this filter.' : 'This moves nothing downstream on the map.') + '</p>');
      if (st.tier && (n.inn.length || n.out.length) && !inn && !out) h += "<button type='button' class='more' data-all='1'>Show all links</button>";
      if (n.etfs && n.etfs.length) h += "<h3>Funds that track it</h3><p class='tags'>" + n.etfs.map(function (t) { return "<span class='tag'>" + esc(t) + '</span>'; }).join('') + '</p>';
      var cos = C.nodeCos[n.id] || [];
      if (cos.length) {
        var capc = st.open.cos ? cos.length : 18;
        h += '<h3>Companies in it (' + cos.length + ")</h3><p class='tags'>" + cos.slice(0, capc).map(function (t) { return "<span class='tag' title='" + esc(D.co[t][0]) + "'>" + esc(t) + '</span>'; }).join('') + '</p>';
        if (cos.length > capc) h += "<button type='button' class='more' data-open='cos'>Show all " + cos.length + '</button>';
      }
    } else if (s) {
      h = "<p class='kicker'>Shock · starts at " + esc(C.label(s.node)) + "</p><h2>" + esc(s.name) + "</h2><p class='why'>" + esc(s.story) + "</p><h3>Biggest movers</h3>" + movers(s) +
        "<p class='why'>Scores are relative (σ). They rank exposure; they are not forecasts of returns.</p>";
    } else {
      h = "<h2>Select a node, or pick a shock</h2><p class='why'>Diamonds are the " + D.nodes.filter(function (n) { return n.kind === 'driver'; }).length +
        " macro drivers. Circles are industries, sized by the market value of the companies tracked in them. A line is a link; its style shows how sure we are of it.</p><h3>Good places to start</h3>" + starts();
    }
    panel.innerHTML = h;
  }
  panel.addEventListener('click', function (ev) {
    var b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.go) { ev.preventDefault(); select(b.dataset.go, st.sel && byId[st.sel] && byId[b.dataset.go].out.some(function (e) { return e.t === st.sel; }) ? null : null); }
    else if (b.dataset.open) { st.open[b.dataset.open] = 1; drawPanel(); }
    else if (b.dataset.all) { st.tier = ''; selTier.value = ''; update(); }
  });

  /* ---------- controls ---------- */
  gN.addEventListener('click', function (ev) {
    if (moved > 4) return;
    var g = ev.target.closest('.n');
    if (g) select(g.dataset.id === st.sel ? null : g.dataset.id);
  });
  svg.addEventListener('click', function (ev) { if (moved <= 4 && !ev.target.closest('.n') && (st.sel || st.co)) { st.co = null; select(null); } });
  svg.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') { st.co = null; select(null); return; }
    if (!st.sel) return;
    var n = byId[st.sel], nb = n.inn.filter(shown).map(function (e) { return e.s; }).concat(n.out.filter(shown).map(function (e) { return e.t; }));
    if (!nb.length) return;
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown' || ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      var step = (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') ? 1 : -1;
      st.cursor = (st.cursor + step + nb.length) % nb.length;
      D.nodes.forEach(function (x) { x.el.classList.toggle('cur', x.id === nb[st.cursor]); });
      svg.setAttribute('aria-label', 'Neighbour: ' + C.label(nb[st.cursor]) + '. Press Enter to select it.');
    } else if (ev.key === 'Enter' && st.cursor >= 0) { ev.preventDefault(); select(nb[st.cursor]); }
  });
  selShock.addEventListener('change', function () { st.shock = selShock.value; update(); });
  selTier.addEventListener('change', function () { st.tier = selTier.value; update(); });
  [].forEach.call(document.querySelectorAll('.chip[data-g]'), function (b) {
    b.addEventListener('click', function () {
      var on = b.getAttribute('aria-pressed') === 'true';
      b.setAttribute('aria-pressed', String(!on));
      if (on) st.hidden[b.dataset.g] = 1; else delete st.hidden[b.dataset.g];
      update();
    });
  });
  $('gAll').addEventListener('click', function () {
    st.hidden = {};
    [].forEach.call(document.querySelectorAll('.chip[data-g]'), function (b) { b.setAttribute('aria-pressed', 'true'); });
    update();
  });
  function setView(v) {
    document.body.classList.toggle('mapv', v === 'map');
    $('vMap').setAttribute('aria-pressed', String(v === 'map'));
    $('vList').setAttribute('aria-pressed', String(v !== 'map'));
  }
  $('vMap').addEventListener('click', function () { setView('map'); });
  $('vList').addEventListener('click', function () { setView('list'); });

  /* ---------- find ---------- */
  var hits = [], hi = -1;
  function search() {
    var raw = q.value.trim(), s = raw.toLowerCase();
    hits = []; hi = -1;
    if (!s) { qres.hidden = true; return; }
    D.nodes.forEach(function (n) { if (n.label.toLowerCase().indexOf(s) >= 0) hits.push({ k: 'n', id: n.id, t: n.label, sub: C.group(n.g), r: n.label.toLowerCase().indexOf(s) }); });
    hits.sort(function (a, b) { return a.r - b.r || a.t.length - b.t.length; });
    var cos = [];
    Object.keys(D.co).forEach(function (t) {
      var nm = D.co[t][0].toLowerCase(), r = t.toLowerCase() === s ? 0 : t.toLowerCase().indexOf(s) === 0 ? 1 : nm.indexOf(s) >= 0 ? 2 : 9;
      if (r < 9) cos.push({ k: 'c', id: t, t: t + ' · ' + D.co[t][0], sub: D.co[t][1].length === 1 ? C.label(D.co[t][1][0]) : D.co[t][1].length + ' industries', r: r });
    });
    cos.sort(function (a, b) { return a.r - b.r || a.id.length - b.id.length; });
    hits = (cos.length && cos[0].r === 0 ? cos.slice(0, 1) : []).concat(hits.slice(0, 8), cos.slice(cos.length && cos[0].r === 0 ? 1 : 0, 7));
    qres.innerHTML = hits.length ? hits.map(function (x, i) {
      return "<button type='button' role='option' data-i='" + i + "'><span>" + esc(x.t) + "</span><small>" + esc(x.sub) + "</small></button>";
    }).join('') : "<p class='none'>No node or ticker matches “" + esc(raw) + "”.</p>";
    qres.hidden = false;
  }
  function take(i) {
    var x = hits[i];
    if (!x) return;
    qres.hidden = true; q.value = '';
    if (x.k === 'n') select(x.id);
    else { st.co = x.id; st.sel = null; st.from = null; st.bad = null; update(); if (narrow()) panel.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }
  q.addEventListener('input', search);
  q.addEventListener('keydown', function (ev) {
    var opts = qres.querySelectorAll('button');
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      if (!opts.length) return;
      hi = (hi + (ev.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length;
      [].forEach.call(opts, function (o, i) { o.setAttribute('aria-selected', String(i === hi)); if (i === hi) o.scrollIntoView({ block: 'nearest' }); });
    } else if (ev.key === 'Enter') { ev.preventDefault(); take(hi >= 0 ? hi : 0); }
    else if (ev.key === 'Escape') { qres.hidden = true; }
  });
  qres.addEventListener('click', function (ev) { var b = ev.target.closest('button'); if (b) take(+b.dataset.i); });
  document.addEventListener('click', function (ev) { if (!ev.target.closest('.fld')) qres.hidden = true; });

  /* ---------- the list ---------- */
  var sortKey = null, sortDir = 1;
  tbl.tHead.addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-k]');
    if (!b) return;
    var k = b.dataset.k, col = { label: 0, g: 1, nin: 2, nout: 3, imp: 4 }[k];
    sortDir = sortKey === k ? -sortDir : (col >= 2 ? -1 : 1); sortKey = k;
    var rows = [].slice.call(tbl.tBodies[0].rows);
    var val = function (r) { var t = r.cells[col].textContent.replace('−', '-'); return col >= 2 ? (parseFloat(t) || 0) : t.toLowerCase(); };
    rows.sort(function (a, b2) { var x = val(a), y = val(b2); return (x < y ? -1 : x > y ? 1 : 0) * sortDir; });
    rows.forEach(function (r) { tbl.tBodies[0].appendChild(r); });
    [].forEach.call(tbl.tHead.querySelectorAll('button'), function (x) { x.removeAttribute('aria-sort'); });
    b.setAttribute('aria-sort', sortDir > 0 ? 'ascending' : 'descending');
  });
  tbl.tBodies[0].addEventListener('click', function (ev) {
    var a = ev.target.closest('a');
    if (a) { ev.preventDefault(); select(a.getAttribute('href').slice(1)); }
  });

  /* ---------- start ---------- */
  window.addEventListener('hashchange', function () { readHash(); update(); if (st.sel) centreOn(byId[st.sel]); });
  setView(window.matchMedia('(max-width: 759px)').matches ? 'list' : 'map');
  applyView();
  readHash();
  update();
})();
