/* =========================================================
   DeltaDirect — academic project page script
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initScrollProgress();
  initActiveNav();
  initRevealOnScroll();
  initOodDemo();
  initBars();
  initMagnitudeDemo();
  initCopyBibtex();
});

/* ---------- Scroll progress ---------- */
function initScrollProgress() {
  const bar = document.getElementById('scrollProgress');
  if (!bar) return;
  const onScroll = () => {
    const h = document.documentElement;
    const max = h.scrollHeight - h.clientHeight;
    const pct = max > 0 ? (h.scrollTop / max) * 100 : 0;
    bar.style.width = pct + '%';
  };
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ---------- Active section in nav ---------- */
function initActiveNav() {
  const links = Array.from(document.querySelectorAll('.nav-links a'));
  const sections = links
    .map(a => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const id = '#' + e.target.id;
        links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === id));
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(s => obs.observe(s));
}

/* ---------- Reveal on scroll ---------- */
function initRevealOnScroll() {
  const items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    items.forEach(el => el.classList.add('visible'));
    return;
  }
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  items.forEach(el => obs.observe(el));
}

/* ---------- Demo: synthetic ball animation + direction picker + accuracy bars ---------- */
function initOodDemo() {
  const vdemo = document.querySelector('.vdemo');
  if (!vdemo) return;

  const ball  = document.getElementById('vdemoBall');
  const trail = document.getElementById('vdemoTrail');
  const gtEl  = document.getElementById('vdemoGT');
  const bars  = document.getElementById('vdemoBars');
  const pills = vdemo.querySelectorAll('.dir-pill');
  if (!ball) return;

  // direction → (start/end in arena %, label)
  const dirMap = {
    right: { from: [12, 50], to: [88, 50], label: 'Rightward' },
    left:  { from: [88, 50], to: [12, 50], label: 'Leftward'  },
    up:    { from: [50, 88], to: [50, 12], label: 'Upward'    },
    down:  { from: [50, 12], to: [50, 88], label: 'Downward'  },
  };

  let raf = null;

  function animateBall(dir) {
    cancelAnimationFrame(raf);
    const { from, to } = dirMap[dir];
    trail.setAttribute('d', `M ${from[0]} ${from[1]} L ${to[0]} ${to[1]}`);
    const duration = 3500;
    const t0 = performance.now();
    const tick = (now) => {
      const t = ((now - t0) % duration) / duration;
      const x = from[0] + (to[0] - from[0]) * t;
      const y = from[1] + (to[1] - from[1]) * t;
      ball.style.left = x + '%';
      ball.style.top  = y + '%';
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  function setDirection(dir) {
    if (!dirMap[dir]) return;
    pills.forEach(p => p.classList.toggle('active', p.dataset.dir === dir));
    gtEl.textContent = dirMap[dir].label;
    animateBall(dir);
  }

  pills.forEach(p => p.addEventListener('click', () => setDirection(p.dataset.dir)));

  // initial direction
  setDirection('right');

  // ---- reveal button ----
  const revealBtn   = document.getElementById('vdemoReveal');
  const barsBlock   = document.getElementById('vdemoBarsBlock');
  const fillEls = bars ? bars.querySelectorAll('.fill-color, .fill-dir') : [];
  const valEls  = bars ? bars.querySelectorAll('.vdemo-val[data-v]')     : [];

  // ensure initial hidden state (bars at 0 width, values as em-dash)
  fillEls.forEach(f => { f.style.width = '0%'; });
  valEls.forEach(v => { v.textContent = '—'; });

  function setRevealed(on) {
    if (!revealBtn || !barsBlock) return;
    barsBlock.dataset.revealed = on ? 'true' : 'false';
    barsBlock.setAttribute('aria-hidden', on ? 'false' : 'true');
    revealBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
    revealBtn.classList.toggle('is-active', !!on);
    revealBtn.querySelector('.vdemo-reveal-text').textContent = on
      ? 'Hide performance'
      : 'See how Video-LLMs perform';
    revealBtn.querySelector('.vdemo-reveal-hint').textContent = on
      ? 'click to hide'
      : 'click to reveal';
    revealBtn.querySelector('.vdemo-reveal-icon').innerHTML = on
      ? '<i class="fas fa-eye-slash"></i>'
      : '<i class="fas fa-play"></i>';

    if (on) {
      // animate bars from 0 -> data-w, fill in the values
      requestAnimationFrame(() => {
        fillEls.forEach(f => { f.style.width = (f.dataset.w || 0) + '%'; });
      });
      valEls.forEach(v => { v.textContent = v.dataset.v; });
    } else {
      fillEls.forEach(f => { f.style.width = '0%'; });
      valEls.forEach(v => { v.textContent = '—'; });
    }
  }

  if (revealBtn) {
    revealBtn.addEventListener('click', () => {
      const isOn = barsBlock.dataset.revealed === 'true';
      setRevealed(!isOn);
    });
  }
}

/* ---------- Magnitude-knob causal demo (Ch3) ---------- */
/* Auto-plays once when scrolled into view. Knob and outcome bar animate
   in lockstep — visually arguing causality. Replay button re-triggers. */
function initMagnitudeDemo() {
  const wrap = document.getElementById('magDemo');
  const row  = document.getElementById('magReveal');
  const knob = document.getElementById('knobFill');
  const add  = document.getElementById('magAdd');
  const val  = document.getElementById('magVal');
  const replay = document.getElementById('magReplay');
  if (!wrap || !row || !knob || !add || !val) return;

  const BASE = 60.5;
  const LIFT = 15.5;
  const TARGET = BASE + LIFT; // 76.0
  const DUR = 1600;

  let played = false;
  let raf = null;

  function reset() {
    cancelAnimationFrame(raf);
    knob.style.width = '0%';
    add.style.width = '0%';
    row.style.setProperty('--add-w', '0%');
    row.dataset.on = 'false';
    val.textContent = BASE.toFixed(1);
  }

  function play() {
    cancelAnimationFrame(raf);
    row.dataset.on = 'true';
    const t0 = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - t0) / DUR);
      // ease-in-out cubic
      const eased = t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const factor = eased;             // 0 → 1
      knob.style.width = (factor * 100) + '%';
      const addW = factor * LIFT;
      add.style.width = addW + '%';
      row.style.setProperty('--add-w', addW + '%');
      val.textContent = (BASE + factor * LIFT).toFixed(1);
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
  }

  reset();

  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting && !played) {
          played = true;
          // slight delay so reader's eye lands on the bars first
          setTimeout(play, 350);
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.35 });
    obs.observe(wrap);
  } else {
    play();
  }

  if (replay) {
    replay.addEventListener('click', () => {
      reset();
      requestAnimationFrame(() => play());
    });
  }
}

/* ---------- Bar chart: full Table 1, two avg axes (Syn / Real) ---------- */
function initBars() {
  const chart = document.getElementById('bars');
  if (!chart) return;

  // Every row of Table 1. (syn, real) = (MoDirect-SynBench Avg, MoDirect-RealBench Avg).
  // kind drives the row color: chance / closed / baseline / related / tuned / ours.
  const models = [
    { name: 'Random chance',                              syn: 25.0, real: 40.0, kind: 'chance' },
    { name: 'GPT-4o',                                     syn: 43.3, real: 45.9, kind: 'closed' },
    { name: 'Gemini 2.5 Flash',                           syn: 53.5, real: 38.3, kind: 'closed' },
    { name: 'Video-LLaVA-7B',                             syn: 27.2, real: 37.8 },
    { name: 'VideoChat2-HD-7B',                           syn: 24.6, real: 41.4 },
    { name: 'LLaMA-VID-7B',                               syn: 25.2, real: 40.8 },
    { name: 'LLaVA-NeXT-Video-7B',                        syn: 25.2, real: 41.4 },
    { name: 'LLaVA-OneVision-7B',                         syn: 27.7, real: 43.1 },
    { name: 'Qwen2.5-VL-7B',                              syn: 34.7, real: 40.7 },
    { name: 'Qwen3-VL-4B',                                syn: 49.7, real: 52.7 },
    { name: 'InternVL-2.5-4B',                            syn: 31.4, real: 47.6 },
    { name: 'VideoLLaMA3-7B',                             syn: 50.3, real: 42.9 },
    { name: 'LLaVA-Video-7B',                             syn: 25.9, real: 43.1 },
    { name: 'LLaVA-Video-7B w/ FlashVID',                 syn: 24.9, real: 41.5, kind: 'related' },
    { name: 'LLaVA-Video-7B w/ MoDirect-Inst',            syn: 78.9, real: 58.1, kind: 'tuned' },
    { name: 'LLaVA-Video-7B w/ DeltaDirect',              syn: 85.4, real: 65.0, kind: 'ours' },
  ];

  function render(domain) {
    const key = domain === 'Syn' ? 'syn' : 'real';
    // ascending — chance pinned at top, best result at the bottom
    const sorted = [...models].sort((a, b) => {
      if (a.kind === 'chance') return -1;
      if (b.kind === 'chance') return 1;
      return a[key] - b[key];
    });

    chart.innerHTML = '';
    sorted.forEach(m => {
      const cls = ['bar-row'];
      if (m.kind === 'ours')     cls.push('ours');
      else if (m.kind === 'tuned')   cls.push('tuned');
      else if (m.kind === 'closed')  cls.push('closed');
      else if (m.kind === 'related') cls.push('related');
      else if (m.kind === 'chance')  cls.push('bar-chance');

      const value = m[key];
      const el = document.createElement('div');
      el.className = cls.join(' ');
      el.innerHTML = `
        <div class="bar-label">${m.name}</div>
        <div class="bar-track"><div class="bar-fill" data-w="${value}"></div></div>
        <div class="bar-value">${value.toFixed(1)}</div>
      `;
      chart.appendChild(el);
    });
    requestAnimationFrame(() => {
      chart.querySelectorAll('.bar-fill').forEach(f => { f.style.width = f.dataset.w + '%'; });
    });
  }

  document.querySelectorAll('.bar-tab').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.bar-tab').forEach(x => x.classList.toggle('active', x === t));
      render(t.dataset.domain);
    });
  });
  render('Syn');
}

/* ---------- Copy BibTeX ---------- */
function initCopyBibtex() {
  const btn = document.getElementById('copyBibtex');
  const pre = document.getElementById('bibtex');
  if (!btn || !pre) return;
  btn.addEventListener('click', async () => {
    const text = pre.textContent.trim();
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (err) {}
      document.body.removeChild(ta);
    }
    btn.classList.add('copied');
    btn.innerHTML = '<i class="fas fa-check"></i><span>Copied</span>';
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = '<i class="far fa-copy"></i><span>Copy</span>';
    }, 1600);
  });
}
