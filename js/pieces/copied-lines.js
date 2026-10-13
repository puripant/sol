Sol.register({
  id: 'copied-lines',
  title: 'Copied Lines',
  meta: 'Sol LeWitt',
  instruction:
    'From the top of a 48-inch (122 cm) square, draw a not straight horizontal line. ' +
    'The line is black. The second line is drawn beneath the first line, as close as ' +
    'possible, imitating the first line. The next line is drawn beneath the second line. ' +
    'Continue copying, until the bottom of the square is reached.',
  width: 800,
  height: 800,
  params: [
    { id: 'wobble', label: 'First line: not-straightness', min: 2, max: 150, value: 45 },
    { id: 'error', label: 'Copying error', min: 0, max: 3, step: 0.05, value: 0.8 },
    { id: 'gap', label: 'Closeness (line spacing)', min: 2.5, max: 16, step: 0.5, value: 5 },
    { id: 'weight', label: 'Line weight', min: 0.5, max: 3, step: 0.1, value: 1.2 },
  ],

  generate(rng, { wobble, error, gap, weight }) {
    const S = this.width, N = 400;   // N sample points per line
    const minGap = weight + 0.8;     // "as close as possible" without touching

    // The first, not straight, line — hung from the top of the square.
    const a = Sol.noise(rng, N, 3), b = Sol.noise(rng, N, 8), c = Sol.noise(rng, N, 21);
    let line = new Float32Array(N);
    let top = Infinity;
    for (let i = 0; i < N; i++) {
      line[i] = wobble * (a[i] + 0.4 * b[i] + 0.12 * c[i]);
      top = Math.min(top, line[i]);
    }
    for (let i = 0; i < N; i++) line[i] += gap - top;

    // Each following line imitates the one above it, imperfectly.
    const lines = [line];
    while (lines.length < 5000) {
      const slow = Sol.noise(rng, N, 5), fast = Sol.noise(rng, N, 24);
      const next = new Float32Array(N);
      let highest = Infinity;
      for (let i = 0; i < N; i++) {
        const slip = error * (slow[i] + 0.5 * fast[i]);
        next[i] = line[i] + Math.max(minGap, gap + slip);
        highest = Math.min(highest, next[i]);
      }
      if (highest > S) break;   // the bottom of the square is reached
      lines.push(next);
      line = next;
    }

    const strokes = lines.map(ys => {
      const s = new Float32Array(N * 2);
      for (let i = 0; i < N; i++) { s[2 * i] = (i / (N - 1)) * S; s[2 * i + 1] = ys[i]; }
      return s;
    });
    return { strokes, weight };
  },
});
