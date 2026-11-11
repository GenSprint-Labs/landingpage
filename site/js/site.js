/* GenSprint Labs — site.js
   Motion e interações da landing. Sem dependências, sem rede: os dois formulários só montam
   uma mensagem e abrem o WhatsApp. Tudo aqui é progressivo: sem JS a página aparece inteira. */
(function () {
  'use strict';

  var WHATSAPP = 'https://wa.me/5511965485574?text=';
  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* Quando o elemento entra na tela, chama fn uma vez. */
  function onceVisible(el, fn, threshold) {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { fn(el); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        fn(entry.target);
      });
    }, { threshold: threshold == null ? 0.25 : threshold, rootMargin: '0px 0px -6% 0px' });
    io.observe(el);
  }

  /* ---------- Entrada do hero ---------- */
  // rAF não roda em aba em segundo plano: o timer garante que o hero nunca fica escondido.
  var markLoaded = function () { root.classList.add('is-loaded'); };
  requestAnimationFrame(function () { requestAnimationFrame(markLoaded); });
  setTimeout(markLoaded, 120);

  /* ---------- Tema ---------- */
  var themeBtn = $('#theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var current = root.getAttribute('data-theme') ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      var next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('gensprint_theme', next); } catch (_) { /* segue sem persistir */ }
    });
  }

  /* ---------- Navegação ---------- */
  var nav = $('#nav');
  var burger = $('#burger');
  function setMenu(open) {
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  }
  if (nav && burger) {
    burger.addEventListener('click', function () { setMenu(!nav.classList.contains('is-open')); });
    $('#menu').addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); burger.focus(); }
    });
  }

  /* ---------- Rolagem: borda da nav e progresso dos passos ---------- */
  var steps = $('#steps');
  var stepItems = steps ? $$('.step', steps) : [];
  var ticking = false;
  function onScroll() {
    ticking = false;
    if (nav) nav.classList.toggle('is-scrolled', window.scrollY > 8);
    if (!steps) return;
    var r = steps.getBoundingClientRect();
    var vh = window.innerHeight;
    // 0 quando o topo da lista chega a 80% da tela; 1 quando o fim passa de 55%.
    var p = (vh * 0.8 - r.top) / (r.height + vh * 0.25);
    p = Math.max(0, Math.min(1, p));
    steps.style.setProperty('--p', p.toFixed(3));
    stepItems.forEach(function (item, i) {
      item.classList.toggle('is-on', p >= i / (stepItems.length - 1) - 0.02);
    });
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ---------- Entrada por rolagem, escalonada entre irmãos ---------- */
  $$('[data-reveal]').forEach(function (el) {
    var siblings = $$(':scope > [data-reveal]', el.parentElement);
    var i = siblings.indexOf(el);
    if (i > 0) el.style.setProperty('--d', Math.min(i, 5) * 90 + 'ms');
    onceVisible(el, function (t) { t.classList.add('is-in'); }, 0.18);
  });

  /* ---------- Antes e depois ---------- */
  var stage = $('.compare__stage');
  var range = $('#compare-range');
  if (stage && range) {
    var touched = false;
    var setPos = function (v) {
      stage.style.setProperty('--pos', v + '%');
      stage.classList.toggle('show-old', v >= 34);
      stage.classList.toggle('show-new', v <= 66);
    };
    range.addEventListener('input', function () { touched = true; setPos(Number(range.value)); });
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
      range.addEventListener(ev, function () { touched = true; }, { passive: true });
    });

    if (reduced) {
      setPos(50);
    } else {
      // A varredura do marca-texto: mostra o site velho, passa por cima e deixa no meio.
      setPos(100);
      range.value = 100;
      var keys = [[0, 100], [900, 100], [2500, 10], [3300, 10], [4500, 46]];
      var ease = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
      var start = null;
      var sweep = function (now) {
        if (touched) return;
        if (start === null) start = now;
        var t = now - start;
        var v = keys[keys.length - 1][1];
        for (var k = 1; k < keys.length; k++) {
          if (t <= keys[k][0]) {
            var a = keys[k - 1], b = keys[k];
            v = a[1] + (b[1] - a[1]) * ease((t - a[0]) / (b[0] - a[0]));
            break;
          }
        }
        setPos(v);
        range.value = Math.round(v);
        if (t < keys[keys.length - 1][0]) requestAnimationFrame(sweep);
      };
      setTimeout(function () { requestAnimationFrame(sweep); }, 700);
    }
  }

  /* ---------- Relatório: notas sobem do "antes" para o "depois" ---------- */
  var report = $('#report');
  if (report) {
    var scores = $$('.score', report);
    if (!reduced) {
      scores.forEach(function (s) {
        s.classList.add('is-before');
        $('i', s).style.setProperty('--v', Number(s.dataset.from) / 100);
        $('.score__now', s).textContent = s.dataset.from;
      });
    } else {
      scores.forEach(function (s) { $('i', s).style.setProperty('--v', Number(s.dataset.to) / 100); });
    }
    onceVisible(report, function () {
      if (reduced) return;
      scores.forEach(function (s, i) {
        setTimeout(function () {
          var from = Number(s.dataset.from), to = Number(s.dataset.to);
          var out = $('.score__now', s);
          s.classList.remove('is-before');
          $('i', s).style.setProperty('--v', to / 100);
          var t0 = null;
          var tick = function (now) {
            if (t0 === null) t0 = now;
            var p = Math.min(1, (now - t0) / 1300);
            out.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }, 500 + i * 260);
      });
    }, 0.4);
  }

  /* ---------- RefactorAI: o log aparece linha a linha ---------- */
  var term = $('#term');
  if (term) {
    var lines = $$('.term__log li', term);
    var verbs = $$('.term__verbs span', term);
    var verbAt = [0, 1, 1, 1, 2, 2]; // qual verbo acende em cada linha
    onceVisible(term, function () {
      lines.forEach(function (li, i) {
        setTimeout(function () {
          li.classList.add('is-on');
          verbs.forEach(function (v, vi) { v.classList.toggle('is-on', vi === verbAt[i]); });
        }, reduced ? 0 : 350 + i * 520);
      });
    }, 0.35);
  }

  /* ---------- AI-Ready: a resposta é digitada ---------- */
  var typed = $('.chat__typed');
  if (typed) {
    var text = typed.getAttribute('data-text') || '';
    var src = $('.chat__src');
    onceVisible($('#chat'), function () {
      if (reduced) { typed.textContent = text; if (src) src.classList.add('is-on'); return; }
      var i = 0;
      typed.classList.add('is-typing');
      var type = function () {
        i += 2;
        typed.textContent = text.slice(0, i);
        if (i < text.length) { setTimeout(type, 28); return; }
        typed.classList.remove('is-typing');
        if (src) src.classList.add('is-on');
      };
      setTimeout(type, 700);
    }, 0.5);
  }

  /* ---------- Formulários: montam a mensagem e abrem o WhatsApp ---------- */
  function cleanUrl(value) {
    var v = String(value || '').trim().replace(/^https?:\/\//i, '').replace(/\s+/g, '');
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(v) ? v : '';
  }
  function openWhatsApp(message) {
    window.open(WHATSAPP + encodeURIComponent(message), '_blank', 'noopener');
  }

  var urlForm = $('#url-form');
  if (urlForm) {
    urlForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = $('#url-input');
      var raw = input.value.trim();
      var url = cleanUrl(raw);
      if (raw && !url) {
        input.setAttribute('aria-invalid', 'true');
        urlForm.classList.remove('is-shake');
        void urlForm.offsetWidth;
        urlForm.classList.add('is-shake');
        input.focus();
        return;
      }
      input.removeAttribute('aria-invalid');
      openWhatsApp(url
        ? 'Olá! Quero um diagnóstico gratuito do meu site: https://' + url
        : 'Olá! Quero um diagnóstico gratuito do meu site.');
    });
  }

  var form = $('#contact-form');
  if (form) {
    var errorBox = $('#form-error');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.website.value) return; // honeypot
      var missing = ['nome', 'descricao'].filter(function (name) {
        var field = form[name];
        var empty = !field.value.trim();
        if (empty) field.setAttribute('aria-invalid', 'true'); else field.removeAttribute('aria-invalid');
        return empty;
      });
      if (missing.length) {
        errorBox.textContent = 'Preencha seu nome e conte em poucas linhas o que você precisa.';
        errorBox.hidden = false;
        form[missing[0]].focus();
        return;
      }
      errorBox.hidden = true;
      var url = cleanUrl(form.url.value);
      var msg = 'Olá! Sou ' + form.nome.value.trim() + '.\n' +
        'Preciso de: ' + form.tipo.value + '\n' +
        (url ? 'Site atual: https://' + url + '\n' : '') +
        '\n' + form.descricao.value.trim();
      openWhatsApp(msg);
    });
  }

  var year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
