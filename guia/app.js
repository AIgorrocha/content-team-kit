document.documentElement.classList.add('js');

// botões copiar: copiam o texto do <code> vizinho
function copiar(texto) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(texto);
  return new Promise(function (ok, erro) {
    var t = document.createElement('textarea');
    t.value = texto; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    try { document.execCommand('copy') ? ok() : erro(); } catch (e) { erro(e); }
    document.body.removeChild(t);
  });
}
document.querySelectorAll('.copy').forEach(function (b) {
  b.addEventListener('click', function () {
    var alvo = b.parentElement.querySelector('code');
    copiar(alvo.innerText.trim()).then(function () {
      b.textContent = 'Copiado'; b.classList.add('ok');
    }, function () { b.textContent = 'Selecione e copie'; });
    setTimeout(function () { b.textContent = 'Copiar'; b.classList.remove('ok'); }, 2000);
  });
});

// abas (Windows, Mac, Codex)
document.querySelectorAll('.tabs').forEach(function (g) {
  var abas = g.querySelectorAll('[role=tab]');
  function abrir(a) {
    abas.forEach(function (x) {
      var on = x === a;
      x.setAttribute('aria-selected', on);
      x.tabIndex = on ? 0 : -1;
      document.getElementById(x.getAttribute('aria-controls')).hidden = !on;
    });
  }
  abas.forEach(function (a, i) {
    a.addEventListener('click', function () { abrir(a); });
    a.addEventListener('keydown', function (e) {
      var j = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : -1;
      if (j < 0) return;
      var n = abas[(j + abas.length) % abas.length]; abrir(n); n.focus();
    });
  });
  var h = location.hash.replace('#', '');
  var alvo = Array.prototype.find.call(abas, function (x) { return x.getAttribute('aria-controls') === h; });
  abrir(alvo || abas[0]);
});

// marca no índice lateral onde você está
var links = document.querySelectorAll('.side a');
if ('IntersectionObserver' in window && links.length) {
  var mapa = {};
  links.forEach(function (a) { mapa[a.getAttribute('href').slice(1)] = a; });
  var obs = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) {
        links.forEach(function (a) { a.removeAttribute('aria-current'); });
        mapa[e.target.id].setAttribute('aria-current', 'true');
      }
    });
  }, { rootMargin: '-20% 0px -70% 0px' });
  document.querySelectorAll('main section[id]').forEach(function (s) { if (mapa[s.id]) obs.observe(s); });
}

// fecha o menu do celular ao escolher uma seção
document.querySelectorAll('.mnav a').forEach(function (a) {
  a.addEventListener('click', function () { a.closest('details').open = false; });
});
