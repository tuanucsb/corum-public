/* Companies: filter and sort the table that is already in the page. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var q = $('coQ'), kd = $('coK'), rd = $('coR'), count = $('coCount'), empty = $('coEmpty'), tbl = $('coTbl');
  if (!tbl) return;
  var body = tbl.tBodies[0], rows = [].slice.call(body.rows);
  rows.forEach(function (r) { r._s = (r.cells[0].textContent + ' ' + r.cells[1].textContent + ' ' + r.cells[2].textContent).toLowerCase(); r._t = r.cells[0].textContent.toLowerCase(); });
  var m = /[?&]q=([^&]*)/.exec(location.search);
  if (m) q.value = decodeURIComponent(m[1].replace(/\+/g, ' '));

  function apply() {
    var words = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean), n = 0;
    rows.forEach(function (r) {
      var ok = (!kd.value || r.dataset.k === kd.value) && (!rd.value || r.dataset.r === rd.value) && words.every(function (w) { return r._s.indexOf(w) >= 0; });
      r.hidden = !ok; if (ok) n++;
    });
    count.textContent = n === rows.length ? 'All ' + n.toLocaleString('en-US') + ' shown, largest first.' : n.toLocaleString('en-US') + ' of ' + rows.length.toLocaleString('en-US') + ' shown.';
    empty.hidden = n > 0; tbl.hidden = n === 0;
  }
  var keys = {
    t: function (r) { return r._t; }, n: function (r) { return r.cells[1].textContent.toLowerCase(); }, i: function (r) { return r.cells[2].textContent.toLowerCase(); },
    r: function (r) { return r.cells[3].textContent.toLowerCase(); }, c: function (r) { return +r.dataset.c; }, d: function (r) { return r.dataset.d; }
  };
  [].forEach.call(tbl.tHead.querySelectorAll('button[data-sort]'), function (b) {
    b.addEventListener('click', function () {
      var k = b.dataset.sort, down = b.getAttribute('aria-sort') === 'ascending' || (!b.hasAttribute('aria-sort') && (k === 'c' || k === 'd'));
      [].forEach.call(tbl.tHead.querySelectorAll('button[aria-sort]'), function (o) { o.removeAttribute('aria-sort'); });
      b.setAttribute('aria-sort', down ? 'descending' : 'ascending');
      var f = keys[k], sign = down ? -1 : 1;
      rows.sort(function (a, c) { var x = f(a), y = f(c); return x < y ? -sign : x > y ? sign : 0; });
      var frag = document.createDocumentFragment();
      rows.forEach(function (r) { frag.appendChild(r); });
      body.appendChild(frag);
    });
  });
  [q, kd, rd].forEach(function (el) { el.addEventListener('input', apply); });
  $('coClear').addEventListener('click', function () { q.value = ''; kd.value = ''; rd.value = ''; apply(); q.focus(); });
  apply();
})();
