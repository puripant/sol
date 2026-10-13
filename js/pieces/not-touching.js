// Two pieces share one way of drawing: pick a free spot at random, then let a
// wandering line grow from it, steering away from anything it would touch,
// until it is long enough or boxed in. Repeat until no free spot can be found.
(() => {
  function growLines(rng, { width, height, inside, clearance, length, wiggle }) {
    const c = clearance, c2 = c * c;
    const step = c / 4;
    const maxTurn = 0.42;                    // radians per step; keeps a line from curling into itself
    const ownSkip = Math.ceil(2.5 * c / step); // most recent points of a line can't collide with it
    const minLen = length * 0.2;

    // Spatial hash of every point drawn so far.
    const cols = Math.ceil(width / c) + 1, rows = Math.ceil(height / c) + 1;
    const grid = Array.from({ length: cols * rows }, () => []);
    const px = [], py = [], pLine = [], pArc = [];

    function free(x, y, line, arc) {
      if (!inside(x, y)) return false;
      const gx = Math.floor(x / c), gy = Math.floor(y / c);
      for (let j = Math.max(0, gy - 1); j <= Math.min(rows - 1, gy + 1); j++) {
        for (let i = Math.max(0, gx - 1); i <= Math.min(cols - 1, gx + 1); i++) {
          for (const k of grid[j * cols + i]) {
            if (pLine[k] === line && arc - pArc[k] < ownSkip) continue;
            const dx = px[k] - x, dy = py[k] - y;
            if (dx * dx + dy * dy < c2) return false;
          }
        }
      }
      return true;
    }
    function add(x, y, line, arc) {
      const cell = grid[Math.floor(y / c) * cols + Math.floor(x / c)];
      cell.push(px.length);
      px.push(x); py.push(y); pLine.push(line); pArc.push(arc);
      return cell;
    }

    const strokes = [];
    const patience = 4000;   // consecutive failed starts before calling the drawing full
    for (let fails = 0; fails < patience && strokes.length < 30000;) {
      let x = rng() * width, y = rng() * height;
      const id = strokes.length;
      if (!free(x, y, id, 0)) { fails++; continue; }

      const target = minLen + rng() * (length - minLen);
      // The line keeps a general course and sways around it, like a hand that
      // means to go somewhere but won't draw straight.
      let course = rng() * Math.PI * 2, heading = course, turn = 0;
      const pts = [x, y], cells = [add(x, y, id, 0)];
      while ((pts.length / 2 - 1) * step < target) {
        turn = turn * 0.85 + (rng() - 0.5) * wiggle - 0.15 * (heading - course);
        const side = rng() < 0.5 ? 1 : -1;
        let moved = false;
        for (const dodge of [0, 0.5 * side, -0.5 * side, side, -side]) {
          const a = heading + Math.max(-maxTurn, Math.min(maxTurn, turn + dodge * maxTurn));
          const nx = x + Math.cos(a) * step, ny = y + Math.sin(a) * step;
          if (!free(nx, ny, id, pts.length / 2)) continue;
          cells.push(add(nx, ny, id, pts.length / 2));
          pts.push(nx, ny);
          x = nx; y = ny; heading = a;
          if (dodge) { course = a; turn = 0; }   // pushed aside: carry on along the neighbour
          moved = true;
          break;
        }
        if (!moved) break;
      }

      if ((pts.length / 2 - 1) * step >= minLen) {
        strokes.push(Float32Array.from(pts));
        fails = 0;
      } else {
        // Too short to count as a line: erase it.
        for (const cell of cells) cell.pop();
        px.length = py.length = pLine.length = pArc.length = px.length - cells.length;
        fails++;
      }
    }
    return strokes;
  }

  Sol.register({
    id: 'not-long-not-straight-not-touching',
    title: 'Lines, Not Long, Not-Straight & Not Touching',
    meta: 'Sol LeWitt, 1971 · etching',
    source: { label: 'MoMA', url: 'https://www.moma.org/collection/works/70119' },
    reading:
      'No written instruction: the title is the instruction. Each line starts at a ' +
      'random free spot and wanders, bending away from its neighbours, until it is ' +
      'long enough or has nowhere left to go. Lines are added until the square is full.',
    width: 800,
    height: 800,
    params: [
      { id: 'length', label: 'Not long (maximum length)', min: 20, max: 400, value: 170 },
      { id: 'wiggle', label: 'Not-straightness', min: 0, max: 1, step: 0.02, value: 0.5 },
      { id: 'clearance', label: 'Not touching (clearance)', min: 4, max: 30, step: 0.5, value: 7 },
      { id: 'weight', label: 'Line weight', min: 0.3, max: 3, step: 0.1, value: 0.9 },
    ],
    generate(rng, p) {
      const S = this.width, m = p.weight;
      const inside = (x, y) => x >= m && x <= S - m && y >= m && y <= S - m;
      return { strokes: growLines(rng, { ...p, width: S, height: S, inside }), weight: p.weight };
    },
  });

  Sol.register({
    id: 'not-long-not-heavy-not-touching-circle',
    title: 'Lines, Not Long, Not Heavy, Not Touching, Drawn at Random (Circle)',
    meta: 'Sol LeWitt, 1970 · lithograph',
    source: { label: 'MoMA', url: 'https://www.moma.org/collection/works/65196' },
    reading:
      'No written instruction: the title is the instruction. The same wandering lines, ' +
      'but shorter, lighter and far more numerous, started at random spots and packed ' +
      'until a circle is full.',
    width: 800,
    height: 800,
    params: [
      { id: 'length', label: 'Not long (maximum length)', min: 8, max: 200, value: 40 },
      { id: 'wiggle', label: 'Not-straightness', min: 0, max: 1, step: 0.02, value: 0.5 },
      { id: 'clearance', label: 'Not touching (clearance)', min: 2.5, max: 30, step: 0.5, value: 3.5 },
      { id: 'weight', label: 'Not heavy (line weight)', min: 0.3, max: 3, step: 0.1, value: 0.5 },
    ],
    generate(rng, p) {
      const S = this.width, r = S / 2 - 12;
      const inside = (x, y) => (x - S / 2) ** 2 + (y - S / 2) ** 2 <= r * r;
      return { strokes: growLines(rng, { ...p, width: S, height: S, inside }), weight: p.weight };
    },
  });
})();
