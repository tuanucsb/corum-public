/* The influence map: one SVG drawn from the snapshot, a details panel, and a list that holds the same nodes.
   Two layouts come with the data: a compact one, and a wide one that leaves room for each industry's companies and
   funds. Switching a layer on moves the map to the wide one. */
(function () {
  var C = window.C;
  if (!C || !C.D.nodes.length) return;
  var D = C.D, M = C.M, byId = C.byId, mem = C.mem, esc = C.esc, fmt = C.fmt;
  var $ = function (id) { return document.getElementById(id); };
  var NS = 'http://www.w3.org/2000/svg';
  var svg = $('map'), vp = $('vp'), gE = $('gEdges'), gN = $('gNodes'), gG = $('gGroups'), panel = $('panel');
  var q = $('q'), qres = $('qres'), selShock = $('shock'), selTier = $('tier'), tbl = $('nodeTbl');
  var gM = null, gML = null;                       /* members and their membership lines, made when first shown */
  var st = { sel: null, from: null, co: null, shock: '', tier: '', sign: '', minw: 0, hidden: {}, cursor: -1, open: {},
    links: true, lco: false, letf: false };
  var view = { x: 0, y: 0, w: D.canvas[0], h: D.canvas[1] };
  var narrow = function () { return window.matchMedia('(max-width: 1099px)').matches; };
  var wide = function () { return st.lco || st.letf; };
  var dim = function () { return wide() && D.canvas2 ? D.canvas2 : D.canvas; };
  var px = function (n) { return wide() && n.X != null ? n.X : n.x; };
  var py = function (n) { return wide() && n.Y != null ? n.Y : n.y; };

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function short(s) { return s.length > 26 ? s.slice(0, 24) + '…' : s; }
  function nr(n) { return n.r || (n.kind === 'driver' ? 8.5 : 6); }
  var ns = 1;                                      /* how much nodes are drawn up when the map is zoomed far out */

  /* ---------- draw once ---------- */
  var rings = {};
  Object.keys(D.centres).forEach(function (g) {
    rings[g] = { c: el('circle', { 'class': 'gring gc-' + g }, gG), t: el('text', { 'class': 'gl' }, gG) };
    rings[g].t.textContent = C.group(g);
  });
  D.edges.forEach(function (e) { if (byId[e.s] && byId[e.t]) e.el = el('line', {}, gE); });
  var rank = {};
  D.nodes.forEach(function (n) { (rank[n.g] = rank[n.g] || []).push(n); });
  Object.keys(rank).forEach(function (g) {
    rank[g].sort(function (a, b) { return (b.inn.length + b.out.length) - (a.inn.length + a.out.length); });
    rank[g].slice(0, g === 'TECH' || g === 'HEALTHCARE' ? 4 : g === 'MACRO' ? 7 : 2).forEach(function (n) { n.lab = true; });
  });
  D.nodes.forEach(function (n) {
    var r = nr(n);
    var g = el('g', { 'data-id': n.id, tabindex: '-1', role: 'button', 'aria-label': n.label }, gN);
    var sc = el('g', { 'class': 'sc' }, g);
    if (n.kind === 'driver') el('rect', { 'class': 's', x: -r, y: -r, width: 2 * r, height: 2 * r, transform: 'rotate(45)' }, sc);
    else el('circle', { 'class': 's', r: r }, sc);
    n.tx = el('text', { dy: '1.15em' }, g);
    n.tx.textContent = short(n.label);
    el('title', {}, g).textContent = n.label;
    n.el = g;
  });
  $('stageMsg').hidden = true;

  /* put everything where the current layout says */
  function place() {
    var cs = wide() && D.centres2 ? D.centres2 : D.centres, w = wide();
    Object.keys(rings).forEach(function (g) {
      var c = cs[g];
      rings[g].c.setAttribute('cx', c.x); rings[g].c.setAttribute('cy', c.y); rings[g].c.setAttribute('r', c.r);
      rings[g].t.setAttribute('x', c.x); rings[g].t.setAttribute('y', c.y - c.r); rings[g].t.setAttribute('dy', '-0.55em');
    });
    D.nodes.forEach(function (n) {
      n.el.setAttribute('transform', 'translate(' + px(n) + ',' + py(n) + ')');
      /* with names around it, an industry's label sits above its ring of names; alone, just under the node */
      var above = w && n.kind !== 'driver';
      n.tx.setAttribute('y', above ? -(n.f || nr(n) + 10) : (nr(n) + (n.kind === 'driver' ? 3 : 0)) * ns);
      n.tx.setAttribute('dy', above ? '-0.3em' : '1.15em');
    });
    D.edges.forEach(function (e) {
      if (!e.el) return;
      var a = byId[e.s], b = byId[e.t];
      e.el.setAttribute('x1', px(a)); e.el.setAttribute('y1', py(a)); e.el.setAttribute('x2', px(b)); e.el.setAttribute('y2', py(b));
    });
    if (gM) M.list.forEach(function (m) {
      var n = byId[m.p];
      if (m.el && n) m.el.setAttribute('transform', 'translate(' + (n.X + m.dx).toFixed(1) + ',' + (n.Y + m.dy).toFixed(1) + ')');
    });
    svg.classList.toggle('wide', w);
  }
  function buildMembers() {
    if (gM || !M.list.length) return;
    gML = el('g', { id: 'gMemLines' }, vp);
    gM = el('g', { id: 'gMembers' }, vp);
    vp.appendChild(gN);                                         /* industries stay on top of their names */
    M.list.forEach(function (m) {
      var n = byId[m.p];
      if (!n) return;
      var g = el('g', { 'data-t': m.t }, gM);
      var sc = el('g', { 'class': 'sc' }, g);
      if (m.k) el('rect', { 'class': 's', x: -m.r, y: -m.r, width: 2 * m.r, height: 2 * m.r, rx: 0.8 }, sc);
      else el('circle', { 'class': 's', r: m.r }, sc);
      el('text', { y: m.r, dy: '1.1em' }, g).textContent = m.t;
      el('title', {}, g).textContent = m.t + ' · ' + m.name;
      m.el = g;
    });
  }

  /* ---------- pan and zoom ---------- */
  function applyView() {
    svg.setAttribute('viewBox', [view.x, view.y, view.w, view.h].join(' '));
    /* s = screen pixels per map unit. Type and line weights are set in screen pixels through --u, so a label is the
       same size at any zoom; what changes with zoom is how many labels are shown. */
    var r = svg.getBoundingClientRect();
    var s = r.width ? Math.min(r.width / view.w, r.height / view.h) : 0.5;
    svg.style.setProperty('--u', (1 / s).toFixed(4));
    /* far out, a node would shrink to a speck: draw it up so it stays about as large as on the compact map */
    var want = Math.max(1, Math.min(2.4, 0.52 / s));
    svg.style.setProperty('--ms', Math.max(1, Math.min(1.8, 0.4 / s)).toFixed(3));
    if (Math.abs(want - ns) > 0.04 || (want === 1 && ns !== 1)) {
      ns = want;
      svg.style.setProperty('--ns', ns.toFixed(3));
      D.nodes.forEach(function (n) { if (n.tx.getAttribute('dy') === '1.15em') n.tx.setAttribute('y', (nr(n) + (n.kind === 'driver' ? 3 : 0)) * ns); });
    }
    svg.classList.toggle('z1', s > (wide() ? 0.45 : 0.7));
    svg.classList.toggle('z2', s > (wide() ? 0.85 : 1.2));
    svg.classList.toggle('z3', s > 2.2);
  }
  function pt(ev) {
    var p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY;
    var m = svg.getScreenCTM();
    return m ? p.matrixTransform(m.inverse()) : { x: dim()[0] / 2, y: dim()[1] / 2 };
  }
  function zoom(f, cx, cy) {
    var W = dim()[0], H = dim()[1];
    var nw = Math.max(W / 40, Math.min(W * 1.1, view.w * f)), k = nw / view.w;
    if (cx == null) { cx = view.x + view.w / 2; cy = view.y + view.h / 2; }
    view.x = cx - (cx - view.x) * k; view.y = cy - (cy - view.y) * k; view.w = nw; view.h = nw * H / W;
    applyView();
  }
  function fit() {
    var W = dim()[0], H = dim()[1], pad = H * 0.055;          /* room for the legend along the bottom */
    view = { x: -pad * W / H / 2, y: 0, w: W + pad * W / H, h: H + pad }; applyView();
  }
  function focusOn(x, y, span) {
    var W = dim()[0], H = dim()[1], w = Math.min(W, Math.max(span, W / 40));
    view = { x: x - w / 2, y: y - (w * H / W) / 2, w: w, h: w * H / W };
    applyView();
  }
  function centreOn(n) {
    if (wide()) { focusOn(px(n), py(n), Math.max(420, (n.f || 30) * 9)); return; }
    if (view.w > dim()[0] * 0.99) return;
    view.x = px(n) - view.w / 2; view.y = py(n) - view.h / 2; applyView();
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
    var ly = (st.lco ? ['companies'] : []).concat(st.letf ? ['funds'] : []);
    if (ly.length) parts.push('layers=' + ly.join(','));
    var h = parts.length ? '#' + parts.join('&') : location.pathname + location.search;
    try { history.replaceState(null, '', h); } catch (x) { /* a file: page cannot rewrite its address */ }
  }
  function readHash() {
    var raw = location.hash.replace(/^#/, '');
    var next = { sel: null, from: null, co: null, shock: '', bad: null, lco: false, letf: false };
    raw.split('&').filter(Boolean).forEach(function (part) {
      var p = decodeURIComponent(part);
      if (p.indexOf('shock=') === 0) { if (C.scen[p.slice(6)]) next.shock = p.slice(6); }
      else if (p.indexOf('layers=') === 0) { next.lco = /compan/.test(p); next.letf = /fund|etf/.test(p); }
      else if (p.indexOf('co=') === 0) { var t = p.slice(3).toUpperCase(); if (mem[t]) next.co = t; else next.bad = p.slice(3); }
      else if (p.indexOf('>') > 0) { var ab = p.split('>'); if (byId[ab[0]] && byId[ab[1]]) { next.from = ab[0]; next.sel = ab[1]; } else next.bad = p; }
      else if (byId[p]) next.sel = p;
      else next.bad = p;
    });
    if (next.co) { if (mem[next.co].k) next.letf = true; else next.lco = true; }
    st.sel = next.sel; st.from = next.from; st.co = next.co; st.shock = next.shock; st.bad = next.bad; st.cursor = -1;
    selShock.value = st.shock;
    setLayers(next.lco, next.letf, true);
  }
  function setLayers(co, etf, quiet) {
    var was = wide();
    st.lco = !!co && M.list.length > 0; st.letf = !!etf && M.list.length > 0;
    $('lyCo').checked = st.lco; $('lyEtf').checked = st.letf;
    if (wide()) buildMembers();
    svg.classList.toggle('lco', st.lco); svg.classList.toggle('letf', st.letf);
    if (was !== wide() || !svg.getAttribute('viewBox')) { place(); fit(); }
    if (!quiet) update();
  }
  function select(id, from) {
    st.sel = id; st.from = from || null; st.co = null; st.cursor = -1; st.bad = null; st.open = {};
    update();
    if (id && byId[id]) centreOn(byId[id]);
    if (id && narrow()) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function selectCo(t) {
    var m = mem[t];
    if (!m) return;
    st.co = t; st.sel = null; st.from = null; st.bad = null; st.open = {};
    setLayers(st.lco || !m.k, st.letf || !!m.k, true);
    update();
    var n = byId[m.p];
    if (n) focusOn(n.X + m.dx, n.Y + m.dy, 520);
    if (narrow()) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- what is lit ---------- */
  function shown(e) {
    return st.links && !st.hidden[byId[e.s].g] && !st.hidden[byId[e.t].g] && (!st.tier || e.tier === st.tier) &&
      (!st.sign || (st.sign === 'pos' ? e.w > 0 : e.w < 0)) && Math.abs(e.w) >= st.minw;
  }
  function update() {
    var s = st.shock ? C.scen[st.shock] : null, lit = {}, top = 0.0001, nShown = 0;
    var cm = st.co ? mem[st.co] : null;
    if (cm) cm.in.forEach(function (x) { lit[x[0]] = 1; });
    if (st.sel) lit[st.sel] = 1;
    if (s) Object.keys(s.imp).forEach(function (i) { top = Math.max(top, Math.abs(s.imp[i])); });
    D.edges.forEach(function (e) {
      if (!e.el) return;
      var vis = shown(e), on = vis && !!st.sel && (e.s === st.sel || e.t === st.sel);
      if (vis) nShown++;
      if (on) { lit[e.s] = 1; lit[e.t] = 1; }
      e.el.setAttribute('class', 'e ' + e.tier + (e.w < 0 ? ' neg' : ' pos') + (vis ? '' : ' hide') + (on ? ' on' : '') +
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
    if (gM) {
      var imp = s ? (M.imp[st.shock] || {}) : null, mtop = 0.0001, mine = {};
      if (imp) Object.keys(imp).forEach(function (t) { mtop = Math.max(mtop, Math.abs(imp[t])); });
      if (st.sel) (C.nodeCos[st.sel] || []).forEach(function (t) { mine[t] = 1; });
      while (gML.firstChild) gML.removeChild(gML.firstChild);
      M.list.forEach(function (m) {
        if (!m.el) return;
        var n = byId[m.p], c = 'm ' + (m.k ? 'etf' : 'co') + ' gc-' + n.g;
        if (st.hidden[n.g]) c += ' hide';
        if (mine[m.t] || m.t === st.co) c += ' on';
        if (m.t === st.co) c += ' me';
        if (imp) {
          var v = imp[m.t];
          if (v > 0) c += ' up'; else if (v < 0) c += ' dn';
          m.el.style.setProperty('--a', v ? (0.3 + 0.7 * Math.sqrt(Math.abs(v) / mtop)).toFixed(2) : '1');
        }
        m.el.setAttribute('class', c);
        /* a line from a name to each industry it sits in: for the chosen name, and for names an industry shares */
        var draw = m.t === st.co ? m.in.map(function (x) { return x[0]; }) : (mine[m.t] && m.p !== st.sel ? [st.sel] : []);
        if ((m.k ? st.letf : st.lco) || m.t === st.co) draw.forEach(function (id) {
          var o = byId[id];
          if (o) el('line', { 'class': 'ml', x1: n.X + m.dx, y1: n.Y + m.dy, x2: o.X, y2: o.Y }, gML);
        });
      });
    }
    svg.classList.toggle('sel', !!(st.sel || st.co));
    svg.classList.toggle('shock', !!s);
    var allHidden = D.nodes.every(function (n) { return st.hidden[n.g]; });
    $('stageMsg').hidden = !allHidden;
    if (allHidden) $('stageMsg').textContent = 'All groups are hidden. Use "Show all" above.';
    $('linkCount').textContent = nShown.toLocaleString() + ' of ' + D.edges.length.toLocaleString() + ' links shown';
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
  function memberPanel(m, s) {
    var h = "<p class='kicker'><span class='mono'>" + esc(m.t) + "</span> · " + (m.k ? 'fund' : 'company') + (m.idx && m.idx.length ? ' · in the ' + esc(m.idx.join(' and the ')) : '') + "</p><h2>" + esc(m.name) + "</h2>";
    if (m.cap) h += "<p class='why'>Market value about " + C.cap(m.cap) + ".</p>";
    if (s) {
      var v = (M.imp[st.shock] || {})[m.t];
      h += "<div class='under'><span>Under “" + esc(s.name) + "”</span>";
      if (v) {
        h += "<b class='big tnum " + (v < 0 ? 'neg-t' : 'pos-t') + "'>" + fmt(v) + " σ</b><span>" + m.in.filter(function (x) { return x[2] != null && s.imp[x[0]]; }).map(function (x) {
          return esc(C.label(x[0])) + ' moves ' + fmt(s.imp[x[0]]) + ' × β ' + fmt(x[2]);
        }).join('; ') + '</span>';
        /* the betas are fitted together over overlapping industries, so they can offset each other. When the name's
           number points the other way from its main industry, say so next to the number. */
        var main = s.imp[m.p];
        if (main && (main > 0) !== (v > 0)) h += "<span class='warn'>Opposite in sign to the industry where its share is largest, " + esc(C.label(m.p)) + ' (' + fmt(main) +
          "). A name’s βs are fitted together and can offset each other, so this is the least reliable number on the map.</span>";
        else h += "<span class='note'>A name’s βs are fitted together and can offset each other. Read the industries’ moves first.</span>";
      } else h += "<b class='big'>Not reached</b>";
      h += '</div>';
    }
    h += '<h3>Sits in (' + m.in.length + ")</h3><ul class='lnk'>" + m.in.map(function (x) {
      var bits = [];
      if (x[1] != null) bits.push((100 * x[1]).toFixed(x[1] < 0.1 ? 1 : 0) + '% of its tracked market value');
      if (x[2] != null) bits.push('β ' + fmt(x[2]));
      return "<li><div class='memrow'><span class='who'><button type='button' data-go='" + esc(x[0]) + "'>" + esc(C.label(x[0])) + "</button></span><span class='rs'>" +
        (bits.join(' · ') || 'listed by the map, share not measured') + '</span></div></li>';
    }).join('') + "</ul><p class='why small'>β is the measured sensitivity of its weekly returns to that industry’s price series, over about three years. A share compares only within one industry.</p>";
    if (m.a) h += "<p class='cta'><a class='btn sm' href='t/" + esc(m.t.replace(/[^A-Za-z0-9.\-]/g, '_')) + ".html'>Its page: fundamentals, trend and peers →</a></p>";
    return h;
  }
  function drawPanel() {
    var s = st.shock ? C.scen[st.shock] : null, h = '';
    var back = "<a class='backmap' href='#stage'>↑ Back to the map</a>";
    if (st.bad) {
      h = "<h2>Nothing called “" + esc(st.bad) + "”</h2><p class='why'>Try the Find box above, or start from one of these.</p>" + starts();
    } else if (st.co && mem[st.co]) {
      h = back + memberPanel(mem[st.co], s);
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
      var filtered = st.tier || st.sign || st.minw > 0 || !st.links;
      h += '<h3>Moved by ' + (n.inn.length ? '(' + n.inn.length + ')' : '') + '</h3>' + (inn || "<p class='why'>" + (n.inn.length ? 'No links match the filters.' : 'Nothing on the map moves this. It is a starting point.') + '</p>');
      h += '<h3>Moves ' + (n.out.length ? '(' + n.out.length + ')' : '') + '</h3>' + (out || "<p class='why'>" + (n.out.length ? 'No links match the filters.' : 'This moves nothing downstream on the map.') + '</p>');
      if (filtered && (n.inn.length || n.out.length) && !inn && !out) h += "<button type='button' class='more' data-all='1'>Show all links</button>";
      if (n.etfs && n.etfs.length) h += "<h3>Funds that track it</h3><p class='tags'>" + n.etfs.map(function (t) {
        return mem[t] ? "<button type='button' class='tag' data-co='" + esc(t) + "'>" + esc(t) + '</button>' : "<span class='tag'>" + esc(t) + '</span>';
      }).join('') + '</p>';
      var cos = (C.nodeCos[n.id] || []).filter(function (t) { return !mem[t].k; });
      if (cos.length) {
        var capc = st.open.cos ? cos.length : 24;
        h += '<h3>Companies in it (' + cos.length + ")</h3><p class='tags'>" + cos.slice(0, capc).map(function (t) {
          return "<button type='button' class='tag' data-co='" + esc(t) + "' title='" + esc(mem[t].name) + "'>" + esc(t) + '</button>';
        }).join('') + '</p>';
        if (cos.length > capc) h += "<button type='button' class='more' data-open='cos'>Show all " + cos.length + '</button>';
        if (!st.lco) h += "<button type='button' class='more' data-layer='co'>Show companies on the map</button>";
      }
    } else if (s) {
      h = "<p class='kicker'>Shock · starts at " + esc(C.label(s.node)) + "</p><h2>" + esc(s.name) + "</h2><p class='why'>" + esc(s.story) + "</p><h3>Biggest movers</h3>" + movers(s) +
        "<p class='why small'>Scores are relative (σ). They rank exposure; they are not forecasts of returns.</p>";
    } else {
      h = "<h2>Select a node, or pick a shock</h2><p class='why'>Diamonds are the " + D.nodes.filter(function (n) { return n.kind === 'driver'; }).length +
        " macro drivers. Circles are industries, sized by the market value of the companies tracked in them. A line is a link; its style shows how sure we are of it.</p>" +
        (M.list.length ? "<p class='why'>Switch on <b>Companies</b> or <b>Funds</b> above to see the names around each industry.</p>" : '') +
        "<h3>Good places to start</h3>" + starts();
    }
    panel.innerHTML = h;
  }
  panel.addEventListener('click', function (ev) {
    var b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.go) { ev.preventDefault(); select(b.dataset.go); }
    else if (b.dataset.co) selectCo(b.dataset.co);
    else if (b.dataset.layer) setLayers(true, st.letf);
    else if (b.dataset.open) { st.open[b.dataset.open] = 1; drawPanel(); }
    else if (b.dataset.all) { st.tier = ''; st.sign = ''; st.minw = 0; st.links = true; syncFilters(); update(); }
  });

  /* ---------- controls ---------- */
  vp.addEventListener('click', function (ev) {
    if (moved > 4) return;
    var g = ev.target.closest('#gNodes > g'), m = ev.target.closest('#gMembers > g');
    if (g) { ev.stopPropagation(); select(g.dataset.id === st.sel ? null : g.dataset.id); }
    else if (m) { ev.stopPropagation(); if (m.dataset.t === st.co) { st.co = null; update(); } else selectCo(m.dataset.t); }
  });
  svg.addEventListener('click', function (ev) {
    if (moved <= 4 && !ev.target.closest('#gNodes > g, #gMembers > g') && (st.sel || st.co)) { st.co = null; select(null); }
  });
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
  var signBtns = [].slice.call(document.querySelectorAll('[data-sign]'));
  function syncFilters() {
    selTier.value = st.tier; $('minw').value = st.minw; $('minwOut').textContent = st.minw.toFixed(2); $('lyLinks').checked = st.links;
    signBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.sign === st.sign)); });
  }
  selShock.addEventListener('change', function () { st.shock = selShock.value; update(); });
  selTier.addEventListener('change', function () { st.tier = selTier.value; update(); });
  signBtns.forEach(function (b) { b.addEventListener('click', function () { st.sign = b.dataset.sign; syncFilters(); update(); }); });
  $('minw').addEventListener('input', function () { st.minw = parseFloat(this.value) || 0; $('minwOut').textContent = st.minw.toFixed(2); update(); });
  $('lyLinks').addEventListener('change', function () { st.links = this.checked; update(); });
  $('lyCo').addEventListener('change', function () { setLayers(this.checked, st.letf); });
  $('lyEtf').addEventListener('change', function () { setLayers(st.lco, this.checked); });
  if (!M.list.length) { $('lyCo').disabled = true; $('lyEtf').disabled = true; }
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
    M.list.forEach(function (m) {
      var tk = m.t.toLowerCase(), nm = m.name.toLowerCase(), r = tk === s ? 0 : tk.indexOf(s) === 0 ? 1 : nm.indexOf(s) >= 0 ? 2 : 9;
      if (r < 9) cos.push({ k: 'c', id: m.t, t: m.t + (m.name !== m.t ? ' · ' + m.name : ''), sub: (m.k ? 'fund · ' : '') + (m.in.length === 1 ? C.label(m.in[0][0]) : m.in.length + ' industries'), r: r });
    });
    cos.sort(function (a, b) { return a.r - b.r || a.id.length - b.id.length; });
    var exact = cos.length && cos[0].r === 0;
    hits = (exact ? cos.slice(0, 1) : []).concat(hits.slice(0, 8), cos.slice(exact ? 1 : 0, 7));
    qres.innerHTML = hits.length ? hits.map(function (x, i) {
      return "<button type='button' role='option' data-i='" + i + "'><span>" + esc(x.t) + "</span><small>" + esc(x.sub) + "</small></button>";
    }).join('') : "<p class='none'>No node or ticker matches “" + esc(raw) + "”.</p>";
    qres.hidden = false;
  }
  function take(i) {
    var x = hits[i];
    if (!x) return;
    qres.hidden = true; q.value = '';
    if (x.k === 'n') select(x.id); else selectCo(x.id);
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
  /* the canvas takes what is left of the window under the controls, so the whole map is in view without scrolling */
  function sizeStage() {
    var st0 = $('stage');
    if (!st0 || !st0.offsetParent) return;
    var top = st0.getBoundingClientRect().top + window.scrollY;
    document.documentElement.style.setProperty('--map-top', Math.round(top + 16) + 'px');
    applyView();
  }
  window.addEventListener('resize', sizeStage);
  function focusSelection() {
    if (st.co && mem[st.co]) { var m = mem[st.co], n = byId[m.p]; focusOn(n.X + m.dx, n.Y + m.dy, 520); }
    else if (st.sel) centreOn(byId[st.sel]);
  }
  window.addEventListener('hashchange', function () { readHash(); update(); if (st.sel || st.co) focusSelection(); else fit(); });
  setView(window.matchMedia('(max-width: 759px)').matches ? 'list' : 'map');
  if (window.matchMedia('(max-width: 759px)').matches) $('mapFilters').open = false;   /* on a phone the list comes first */
  $('mapFilters').addEventListener('toggle', sizeStage);
  readHash();
  syncFilters();
  update();
  sizeStage();
  focusSelection();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(sizeStage);
})();
