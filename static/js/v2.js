/* =========================================================
   DeltaDirect v2 — scroll walkthrough
   Every [data-play] block plays its animation when it scrolls
   into view, and rewinds once it is back below the viewport so
   it plays again on the way down. Nothing is pinned or scrubbed.
   ========================================================= */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canAnimate = !reduce && 'IntersectionObserver' in window;

  /* ---------- Count-up numbers ---------- */
  function fmt(v, decimals) { return v.toFixed(decimals); }

  function runCounters(block) {
    var els = block.querySelectorAll('[data-count]:not([data-p0])');
    Array.prototype.forEach.call(els, function (el) {
      var to = parseFloat(el.dataset.count);
      var from = parseFloat(el.dataset.from || '0');
      var decimals = (el.dataset.count.split('.')[1] || '').length;
      var holder = el.closest('[data-a]');
      var delay = 300;
      if (el.dataset.delay) {
        delay = parseFloat(el.dataset.delay);
      } else if (holder) {
        var i = parseFloat(getComputedStyle(holder).getPropertyValue('--i')) || 0;
        delay += i * 110;
      }
      var dur = 1300, t0 = null;
      cancelAnimationFrame(el._raf || 0);
      el.textContent = fmt(from, decimals);
      function step(ts) {
        if (t0 === null) t0 = ts + delay;
        var p = (ts - t0) / dur;
        if (p < 0) { el._raf = requestAnimationFrame(step); return; }
        if (p > 1) p = 1;
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(from + (to - from) * eased, decimals);
        if (p < 1) el._raf = requestAnimationFrame(step);
      }
      el._raf = requestAnimationFrame(step);
    });
  }

  function resetCounters(block) {
    var els = block.querySelectorAll('[data-count]:not([data-p0])');
    Array.prototype.forEach.call(els, function (el) {
      cancelAnimationFrame(el._raf || 0);
      var decimals = (el.dataset.count.split('.')[1] || '').length;
      el.textContent = fmt(parseFloat(el.dataset.from || '0'), decimals);
    });
  }

  /* ---------- Play blocks on scroll ---------- */
  if (canAnimate) {
    root.classList.add('anim');
    var blocks = Array.prototype.slice.call(document.querySelectorAll('[data-play]'));

    // Play once the block's top edge has risen past the lower fifth of the viewport.
    var playObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && !e.target.classList.contains('in')) {
          e.target.classList.add('in');
          runCounters(e.target);
        }
      });
    }, { rootMargin: '0px 0px -18% 0px', threshold: 0.01 });

    blocks.forEach(function (b) { playObserver.observe(b); });

    // Rewind a block once it has dropped fully below the viewport, so it
    // plays again the next time the reader scrolls down to it.
    var rewinding = false;
    var rewind = function () {
      rewinding = false;
      var vh = window.innerHeight;
      blocks.forEach(function (b) {
        var r = b.getBoundingClientRect();
        if (b.classList.contains('in') && r.top > vh) {
          b.classList.remove('in');
          resetCounters(b);
        } else if (!b.classList.contains('in') && r.bottom < 0) {
          // jumped past it (nav link, End key): show it finished when scrolling back up
          b.classList.add('in');
        }
      });
    };
    window.addEventListener('scroll', function () {
      if (!rewinding) { rewinding = true; requestAnimationFrame(rewind); }
    }, { passive: true });
  }

  /* ---------- Scroll-linked blocks ----------
     Every [data-flow] block gets a progress --p (0..1) as it rises through
     the viewport: 0 when its top edge is at `start` of the viewport height,
     1 after it has travelled `travel` of it. data-flow="start,travel".
     Nothing is pinned, so the page keeps moving at reading speed.        */
  if (canAnimate) {
    var flows = Array.prototype.map.call(document.querySelectorAll('[data-flow]'), function (el) {
      var cfg = (el.dataset.flow || '').split(',');
      return {
        el: el,
        start: parseFloat(cfg[0]) || 0.88,
        travel: parseFloat(cfg[1]) || 0.36,
        counts: Array.prototype.map.call(el.querySelectorAll('[data-count][data-p0]'), function (c) {
          return {
            el: c,
            from: parseFloat(c.dataset.from), to: parseFloat(c.dataset.count),
            p0: parseFloat(c.dataset.p0), p1: parseFloat(c.dataset.p1),
            decimals: (c.dataset.count.split('.')[1] || '').length
          };
        }),
        p: -1, target: 0
      };
    });

    var readFlow = function (f, vh) {
      var r = (vh * f.start - f.el.getBoundingClientRect().top) / (vh * f.travel);
      f.target = r < 0 ? 0 : r > 1 ? 1 : r;
    };

    var applyFlow = function (f) {
      f.el.style.setProperty('--p', f.p.toFixed(4));
      f.counts.forEach(function (c) {
        var t = (f.p - c.p0) / (c.p1 - c.p0);
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        var text = (c.from + (c.to - c.from) * t).toFixed(c.decimals);
        if (c.el.textContent !== text) c.el.textContent = text;
      });
    };

    var flowing = false, lastFlowTs = 0;
    var flowTick = function (ts) {
      var dt = lastFlowTs ? Math.min(0.1, (ts - lastFlowTs) / 1000) : 0.016;
      lastFlowTs = ts;
      var k = 1 - Math.pow(0.0004, dt);   // ease toward the scroll position
      var vh = window.innerHeight, moving = false;
      flows.forEach(function (f) {
        readFlow(f, vh);
        var d = f.target - f.p;
        if (d === 0) return;
        if (Math.abs(d) < 0.001) f.p = f.target;
        else { f.p += d * k; moving = true; }
        applyFlow(f);
      });
      if (moving) requestAnimationFrame(flowTick);
      else { flowing = false; lastFlowTs = 0; }
    };
    var kickFlow = function () {
      if (!flowing) { flowing = true; requestAnimationFrame(flowTick); }
    };

    flows.forEach(function (f) { readFlow(f, window.innerHeight); f.p = f.target; applyFlow(f); });
    window.addEventListener('scroll', kickFlow, { passive: true });
    window.addEventListener('resize', kickFlow);
    window.addEventListener('load', kickFlow);
  }

  /* ---------- Top progress bar ---------- */
  var progress = document.getElementById('scrollProgress');
  var ticking = false;
  function updateProgress() {
    ticking = false;
    if (!progress) return;
    var max = root.scrollHeight - window.innerHeight;
    progress.style.width = (max > 0 ? Math.min(100, window.pageYOffset / max * 100) : 0) + '%';
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(updateProgress); }
  }, { passive: true });
  updateProgress();

  /* ---------- Nav: highlight the scene in view ---------- */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('#navLinks a[href^="#"]'));
  var navList = document.getElementById('navLinks');
  var targets = navLinks.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });

  function setActive(id) {
    navLinks.forEach(function (a) {
      var on = a.getAttribute('href') === '#' + id;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      // keep the active link visible when the nav scrolls sideways on phones
      if (on && navList && navList.scrollWidth > navList.clientWidth) {
        navList.scrollTo({ left: a.offsetLeft - navList.offsetLeft - 16, behavior: 'smooth' });
      }
    });
  }

  if ('IntersectionObserver' in window) {
    var current = '';
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && e.target.id !== current) {
          current = e.target.id;
          setActive(current);
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    targets.forEach(function (t) { if (t) navObserver.observe(t); });
  }

  /* ---------- Copy BibTeX ---------- */
  var copyBtn = document.getElementById('copyBibtex');
  var bib = document.getElementById('bibtex');
  if (copyBtn && bib) {
    var selectBib = function () {
      var range = document.createRange();
      range.selectNodeContents(bib);
      var sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(range);
    };
    copyBtn.addEventListener('click', function () {
      var done = function () {
        copyBtn.classList.add('copied');
        copyBtn.innerHTML = '<i class="fas fa-check"></i><span>Copied</span>';
        setTimeout(function () {
          copyBtn.classList.remove('copied');
          copyBtn.innerHTML = '<i class="far fa-copy"></i><span>Copy</span>';
        }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(bib.textContent.trim()).then(done, selectBib);
      } else {
        selectBib();
      }
    });
  }
})();
