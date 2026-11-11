/* GenSprint Labs — theme-init.js
   Aplica o tema salvo antes da primeira pintura (evita flash) e marca que há JS.
   Carregar no <head>, sem defer. Chave: gensprint_theme = "light" | "dark" (ausente = sistema). */
(function () {
  var root = document.documentElement;
  root.classList.add('js');
  try {
    var t = localStorage.getItem('gensprint_theme');
    if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t);
  } catch (_) { /* localStorage indisponível: segue o sistema */ }
})();
