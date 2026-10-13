Sol.register({
  id: 'ten-thousand-lines',
  title: 'Ten Thousand Lines',
  meta: 'Sol LeWitt, 1970 · ink on paper',
  source: { label: 'MoMA', url: 'https://www.moma.org/collection/works/147073' },
  reading:
    'No written instruction: the title is the instruction. Read here as ten thousand ' +
    'short, nearly straight lines, drawn at random positions and in random directions, ' +
    'free to cross, all kept within the rectangle.',
  width: 800,
  height: 590,
  params: [
    { id: 'count', label: 'Number of lines', min: 500, max: 20000, step: 500, value: 10000 },
    { id: 'length', label: 'Line length', min: 8, max: 200, value: 30 },
    { id: 'weight', label: 'Line weight', min: 0.3, max: 3, step: 0.1, value: 1.1 },
  ],

  generate(rng, { count, length, weight }) {
    const W = this.width, H = this.height, m = weight;
    const inside = (x, y) => x >= m && x <= W - m && y >= m && y <= H - m;
    const strokes = [];
    while (strokes.length < count) {
      const x = rng() * W, y = rng() * H;
      const angle = rng() * Math.PI * 2;
      const len = length * (0.7 + 0.6 * rng());
      const dx = Math.cos(angle), dy = Math.sin(angle);
      if (!inside(x, y) || !inside(x + dx * len, y + dy * len)) continue;

      // A hand never draws quite straight: bow the line very slightly.
      const bow = (rng() - 0.5) * 0.12 * len, n = 4;
      const s = new Float32Array((n + 1) * 2);
      for (let i = 0; i <= n; i++) {
        const t = i / n, off = bow * 4 * t * (1 - t);
        s[2 * i] = x + dx * len * t - dy * off;
        s[2 * i + 1] = y + dy * len * t + dx * off;
      }
      strokes.push(s);
    }
    return { strokes, weight };
  },
});
