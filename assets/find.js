/* The find box on every page: a company, a fund, an industry or a report. Without this script the box is a plain
   form that opens the Companies list filtered to what was typed. */
(function () {
  var S = window.CORUM_S;
  if (!S) return;
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var file = function (t) { return t.replace(/[^A-Za-z0-9.\-]/g, '_') + '.html'; };

  function search(q, up) {
    var lo = q.toLowerCase(), out = [], n;
    var co = [], ind = [], rep = [];
    S.c.forEach(function (c) {
      var t = c[0].toLowerCase(), nm = c[1].toLowerCase();
      var rank = t === lo ? 0 : t.indexOf(lo) === 0 ? 1 : nm.indexOf(lo) === 0 ? 2 : (lo.length > 1 && nm.indexOf(lo) > 0) ? 3 : -1;
      if (rank >= 0) co.push([rank, c]);
    });
    co.sort(function (a, b) { return a[0] - b[0]; });          /* the index is already largest first, and sort is stable */
    co.slice(0, 6).forEach(function (x) {
      var c = x[1];
      out.push({ href: c[3] ? up + 't/' + file(c[0]) : up + 'map.html#co=' + encodeURIComponent(c[0]), kind: c[2] ? 'Fund' : 'Company',
        html: "<span class='mono'>" + esc(c[0]) + '</span> ' + esc(c[1]) + (c[3] ? '' : " <i>on the map only</i>") });
    });
    if (lo.length > 1) {
      S.n.forEach(function (x) { if (x[1].toLowerCase().indexOf(lo) >= 0) ind.push(x); });
      ind.sort(function (a, b) { return a[1].toLowerCase().indexOf(lo) - b[1].toLowerCase().indexOf(lo) || a[1].length - b[1].length; });
      ind.slice(0, 4).forEach(function (x) { out.push({ href: up + 'map.html#' + encodeURIComponent(x[0]), kind: 'Industry', html: esc(x[1]) }); });
    }
    if (lo.length > 2) {
      S.r.forEach(function (x) { if (x[1].toLowerCase().indexOf(lo) >= 0) rep.push(x); });
      rep.slice(0, 3).forEach(function (x) { out.push({ href: up + 'r/' + x[0] + '.html', kind: 'Report', html: esc(x[1]) }); });
    }
    n = co.length;
    return { rows: out, more: n > 6 ? n : 0 };
  }

  [].forEach.call(document.querySelectorAll('form.find'), function (form, k) {
    var input = form.querySelector('input'), box = form.querySelector('.find-out'), up = form.getAttribute('data-up') || '', cur = -1, rows = [];
    var id = 'findOut' + k;
    box.id = id; box.setAttribute('role', 'listbox');
    input.setAttribute('role', 'combobox'); input.setAttribute('aria-controls', id); input.setAttribute('aria-expanded', 'false'); input.setAttribute('aria-autocomplete', 'list');

    function close() { box.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); cur = -1; }
    function mark() {
      [].forEach.call(box.querySelectorAll('a'), function (a, i) { a.setAttribute('aria-selected', String(i === cur)); });
      if (cur >= 0) input.setAttribute('aria-activedescendant', id + '-' + cur); else input.removeAttribute('aria-activedescendant');
    }
    function draw() {
      var q = input.value.trim();
      if (!q) { close(); return; }
      var res = search(q, up);
      rows = res.rows; cur = -1;
      var h = rows.map(function (r, i) {
        return "<a role='option' id='" + id + '-' + i + "' href='" + esc(r.href) + "'><span class='fk'>" + r.kind + '</span><span>' + r.html + '</span></a>';
      }).join('');
      if (!rows.length) h = "<p class='none'>Nothing by that name. Try a ticker, a company name or an industry.</p>";
      else if (res.more) h += "<a class='all' href='" + up + 'companies.html?q=' + encodeURIComponent(q) + "'>All " + res.more + ' matching companies and funds →</a>';
      box.innerHTML = h; box.hidden = false; input.setAttribute('aria-expanded', 'true');
    }
    input.addEventListener('input', draw);
    input.addEventListener('focus', function () { if (input.value.trim()) draw(); });
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { close(); return; }
      if (box.hidden || !rows.length) return;
      if (ev.key === 'ArrowDown') { cur = Math.min(cur + 1, rows.length - 1); mark(); ev.preventDefault(); }
      else if (ev.key === 'ArrowUp') { cur = Math.max(cur - 1, -1); mark(); ev.preventDefault(); }
    });
    form.addEventListener('submit', function (ev) {
      var q = input.value.trim();
      if (!q) { ev.preventDefault(); return; }
      if (box.hidden) draw();
      var pick = rows[cur >= 0 ? cur : 0];
      if (pick) { ev.preventDefault(); location.href = pick.href; }           /* nothing matched: the form opens the Companies list */
    });
    document.addEventListener('click', function (ev) { if (!form.contains(ev.target)) close(); });
  });
})();
