// Shared machinery: every piece only has to turn (random numbers, parameters)
// into a list of strokes. Drawing, animation, controls and export live here.
//
// A piece is registered as
//   { id, title, meta, instruction, reading, source, width, height,
//     params: [{ id, label, min, max, step, value }],
//     generate(rng, p) -> { strokes, weight } }
// where each stroke is a flat Float32Array [x0, y0, x1, y1, ...].
const Sol = (() => {
  const PAPER = '#fdfcf8', INK = '#111';
  const pieces = [];
  const $ = id => document.getElementById(id);

  let piece, canvas, ctx;
  let seed = newSeed();
  let strokes = [], weight = 1, totalLength = 0;
  let raf = 0;

  function newSeed() { return (Math.random() * 2 ** 32) >>> 0; }

  function mulberry32(a) {
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Smooth 1D noise in [-1, 1]: n samples interpolated across `cells` random knots.
  function noise(rng, n, cells) {
    const knots = Array.from({ length: cells + 2 }, () => rng() * 2 - 1);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = (i / (n - 1)) * cells;
      const j = Math.floor(t), f = t - j;
      const s = f * f * (3 - 2 * f);
      out[i] = knots[j] * (1 - s) + knots[j + 1] * s;
    }
    return out;
  }

  function values() {
    const p = {};
    for (const def of piece.params) p[def.id] = +$('p-' + def.id).value;
    return p;
  }

  function generate() {
    ({ strokes, weight } = piece.generate(mulberry32(seed), values()));
    totalLength = 0;
    for (const s of strokes)
      for (let i = 2; i < s.length; i += 2) totalLength += Math.hypot(s[i] - s[i - 2], s[i + 1] - s[i - 1]);
  }

  function setupCanvas() {
    const dpr = Math.max(2, window.devicePixelRatio || 1);
    canvas.width = piece.width * dpr;
    canvas.height = piece.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, piece.width, piece.height);
    ctx.strokeStyle = INK;
    ctx.lineWidth = weight;
    ctx.lineJoin = ctx.lineCap = 'round';
  }

  function draw() {
    cancelAnimationFrame(raf);
    setupCanvas();
    if (!$('animate').checked) {
      for (let i = 0; i < strokes.length; i += 500) {
        ctx.beginPath();
        for (const s of strokes.slice(i, i + 500)) {
          ctx.moveTo(s[0], s[1]);
          for (let k = 2; k < s.length; k += 2) ctx.lineTo(s[k], s[k + 1]);
        }
        ctx.stroke();
      }
      status(strokes.length);
      return;
    }

    // Draw stroke by stroke, a segment at a time, at a pace that finishes the
    // whole piece in `duration` seconds whatever its total length.
    const start = performance.now();
    let si = 0, k = 2, drawn = 0;
    const step = now => {
      const duration = 120 / 2 ** (+$('speed').value - 1);
      const target = totalLength * Math.min(1, (now - start) / 1000 / duration);
      ctx.beginPath();
      while (si < strokes.length && drawn <= target) {
        const s = strokes[si];
        ctx.moveTo(s[k - 2], s[k - 1]);
        for (; k < s.length && drawn <= target; k += 2) {
          ctx.lineTo(s[k], s[k + 1]);
          drawn += Math.hypot(s[k] - s[k - 2], s[k + 1] - s[k - 1]);
        }
        if (k >= s.length) { si++; k = 2; }
      }
      ctx.stroke();
      status(Math.min(si + 1, strokes.length));
      if (si < strokes.length) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  function status(n) {
    $('status').textContent = `Line ${n.toLocaleString()} of ${strokes.length.toLocaleString()} · seed ${seed}`;
  }

  function showValues() {
    for (const def of piece.params) $('p-' + def.id + '-out').textContent = $('p-' + def.id).value;
    $('speedOut').textContent = $('speed').value;
  }

  function refresh() { showValues(); generate(); draw(); }

  function show(next) {
    piece = next;
    for (const a of $('nav').children) a.classList.toggle('current', a.hash === '#' + piece.id);
    document.title = `${piece.title} — Sol`;
    $('title').textContent = piece.title;
    $('meta').textContent = piece.meta || '';
    if (piece.source) {
      const a = document.createElement('a');
      a.href = piece.source.url; a.target = '_blank'; a.rel = 'noopener';
      a.textContent = piece.source.label;
      $('meta').append(' · ', a);
    }
    $('instruction').textContent = piece.instruction || '';
    $('reading').textContent = piece.reading || '';
    canvas.style.aspectRatio = `${piece.width} / ${piece.height}`;

    $('params').textContent = '';
    for (const def of piece.params) {
      const label = document.createElement('label');
      const out = document.createElement('span');
      out.id = `p-${def.id}-out`;
      const input = document.createElement('input');
      Object.assign(input, { type: 'range', id: 'p-' + def.id, min: def.min, max: def.max, step: def.step || 1 });
      input.value = def.current ?? def.value;
      input.addEventListener('input', () => { def.current = input.value; refresh(); });
      label.append(def.label + ' ', out, input);
      $('params').append(label);
    }
    refresh();
  }

  function route() {
    show(pieces.find(p => '#' + p.id === location.hash) || pieces[0]);
  }

  function toSVG() {
    const { width: w, height: h } = piece;
    const paths = strokes.map(s => {
      let d = `M${s[0].toFixed(2)} ${s[1].toFixed(2)}`;
      for (let k = 2; k < s.length; k += 2) d += `L${s[k].toFixed(2)} ${s[k + 1].toFixed(2)}`;
      return `<path d="${d}"/>`;
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
      `<rect width="${w}" height="${h}" fill="${PAPER}"/>` +
      `<g fill="none" stroke="${INK}" stroke-width="${weight}" stroke-linecap="round" stroke-linejoin="round">` +
      paths.join('') + `</g></svg>`;
  }

  function download(blob, ext) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${piece.id}-${seed}.${ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function start() {
    canvas = $('canvas');
    ctx = canvas.getContext('2d');
    for (const p of pieces) {
      const a = document.createElement('a');
      a.href = '#' + p.id;
      a.textContent = p.title;
      $('nav').append(a);
    }
    $('speed').addEventListener('input', showValues);
    $('animate').addEventListener('change', draw);
    $('redraw').addEventListener('click', draw);
    $('new').addEventListener('click', () => { seed = newSeed(); refresh(); });
    $('png').addEventListener('click', () => {
      // Finish the drawing first so the export is never half-drawn.
      const animating = $('animate').checked;
      $('animate').checked = false; draw(); $('animate').checked = animating;
      canvas.toBlob(blob => download(blob, 'png'));
    });
    $('svg').addEventListener('click', () => download(new Blob([toSVG()], { type: 'image/svg+xml' }), 'svg'));
    window.addEventListener('hashchange', route);
    route();
  }

  return { register: p => pieces.push(p), start, noise };
})();
