/* Reports: filter the table that is already in the page. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var q = $('rq'), th = $('rTheme'), kd = $('rKind'), count = $('rCount'), empty = $('rEmpty'), tbl = $('repTbl');
  if (!tbl) return;
  var rows = [].slice.call(tbl.tBodies[0].rows);
  function read() {
    var m = /theme=([^&]+)/.exec(location.hash);
    if (m) { var want = decodeURIComponent(m[1]).toLowerCase(); [].forEach.call(th.options, function (o) { if (o.value && o.value.toLowerCase().indexOf(want) === 0) th.value = o.value; }); }
  }
  function apply() {
    var words = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean), n = 0;
    rows.forEach(function (r) {
      var t = r.cells[0].textContent.toLowerCase();
      var ok = (!th.value || r.dataset.theme === th.value) && (!kd.value || r.dataset.kind === kd.value) && words.every(function (w) { return t.indexOf(w) >= 0; });
      r.hidden = !ok; if (ok) n++;
    });
    count.textContent = n === rows.length ? 'All ' + n + ' shown.' : n + ' of ' + rows.length + ' shown.';
    empty.hidden = n > 0; tbl.hidden = n === 0;
  }
  [q, th, kd].forEach(function (el) { el.addEventListener('input', apply); });
  $('rClear').addEventListener('click', function () { q.value = ''; th.value = ''; kd.value = ''; apply(); q.focus(); });
  read(); apply();
})();
