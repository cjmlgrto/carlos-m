/* =========================================================================
   Carlos Melegrito — ASCII reveal
   A grid of random monospace characters that "cycle" in place and dissolve,
   leaving the message behind in shuffled-but-ordered positions on each load.
   ========================================================================= */

(() => {
  "use strict";

  /* ---- The message ---------------------------------------------------------
     Each block is a group of one or more lines that stay together.
     Blocks are laid out top-to-bottom in this order (the reading hierarchy),
     but each one lands in a random spot within its horizontal band. */
  const BLOCKS = [
    { lines: ["CARLOS MELEGRITO"], anchor: true },      // the name — pinned top-left
    { lines: ["IS A HUMAN INTERFACE DESIGNER", "AT APPLE"] },
    { lines: ["MAKING SOFTWARE"] },
    { lines: ["FOR PEOPLE"] },
    { lines: ["WHO MAKE SOFTWARE"] },
  ];

  /* Characters the noise field cycles through. */
  const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>[]{}()/\\|=+*#%&$@?!;:.-_";

  /* Timing (milliseconds). */
  const NOISE_CLEAR_MAX = 1800;  // latest a noise char fades away
  const GROUP_START = 450;       // when the first group begins resolving
  const GROUP_STAGGER = 520;     // gap between each group's reveal
  const LINE_STAGGER = 240;      // extra delay for each line within a group
  const PER_CHAR = 16;           // left-to-right sweep across a line
  const CHAR_JITTER = 170;       // random wobble so letters don't lock in lockstep
  const FLICKER_INTERVAL = 45;   // how often cycling chars change

  /* Font size scales with the viewport (mobile-first). */
  const FS_MIN = 15;             // never smaller than this (readable on phones)
  const FS_MAX = 22;             // never larger than this on big screens
  const FS_VW = 0.014;           // growth rate relative to viewport width
  const MOBILE_MAX = 640;        // viewport width (px) considered "mobile"
  const MOBILE_SCALE = 1.5;      // bump text up this much on mobile
  const BORDER_X = 2;            // non-animating character columns at the left/right edges
  const BORDER_Y = 1;            // non-animating character rows at the top/bottom edges

  const grid = document.getElementById("grid");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let cells = [];       // flat array of { el, target, reveal }
  let rafId = null;
  let cols = 0, rows = 0;

  const rand = Math.random;
  const randChar = () => CHARSET[(rand() * CHARSET.length) | 0];
  const randInt = (min, max) => (max <= min ? min : min + ((rand() * (max - min + 1)) | 0));

  /* ---- Measure one monospace character, as a ratio of font size ----------
     Measured at a fixed 100px so we can derive metrics for any size. */
  function charRatios() {
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:absolute;visibility:hidden;white-space:pre;" +
      "font-family:var(--font);line-height:var(--line-height);font-size:100px;";
    probe.textContent = "M".repeat(50);
    document.body.appendChild(probe);
    const rect = probe.getBoundingClientRect();
    const ratio = { w: rect.width / 50 / 100, h: rect.height / 100 };
    document.body.removeChild(probe);
    return ratio;
  }

  /* ---- Decide where each letter goes -------------------------------------
     Returns a Map keyed by cell index -> { ch, reveal }, where reveal is the
     time (ms) at which that letter locks in. Groups resolve one after another;
     within a group each line sweeps left-to-right. */
  function placeText() {
    const targets = new Map();
    const marginCols = Math.max(BORDER_X, Math.round(cols * 0.05));
    const marginRows = Math.max(BORDER_Y, Math.round(rows * 0.08));
    const usableRows = Math.max(BLOCKS.length, rows - marginRows * 2);
    const bandHeight = usableRows / BLOCKS.length;

    const aligns = ["left", "center", "right"];

    BLOCKS.forEach((block, i) => {
      const h = block.lines.length;
      const blockWidth = Math.max(...block.lines.map((l) => l.length));
      const groupStart = GROUP_START + i * GROUP_STAGGER;

      // Vertical: keep reading order by giving each block its own band.
      const bandStart = marginRows + i * bandHeight;
      const slack = Math.max(0, bandHeight - h);
      let rowStart = Math.floor(bandStart + rand() * slack);
      rowStart = Math.min(Math.max(rowStart, marginRows), rows - h - marginRows);

      // Horizontal: the name anchors top-left; everything else roams.
      let colStart, align;
      if (block.anchor) {
        colStart = marginCols;
        align = "left";
        rowStart = marginRows + randInt(0, 1); // hug the top
      } else {
        const minCol = marginCols;
        const maxCol = cols - marginCols - blockWidth;
        colStart = randInt(minCol, Math.max(minCol, maxCol));
        align = aligns[(rand() * aligns.length) | 0];
      }

      block.lines.forEach((line, li) => {
        const r = rowStart + li;
        if (r < 0 || r >= rows) return;
        // Align shorter lines within the block's width.
        let pad = 0;
        if (align === "right") pad = blockWidth - line.length;
        else if (align === "center") pad = Math.floor((blockWidth - line.length) / 2);

        for (let k = 0; k < line.length; k++) {
          const ch = line[k];
          if (ch === " ") continue; // spaces stay blank -> word grouping shows through
          const c = colStart + pad + k;
          if (c < 0 || c >= cols) continue;
          const reveal =
            groupStart + li * LINE_STAGGER + k * PER_CHAR + rand() * CHAR_JITTER;
          targets.set(r * cols + c, { ch, reveal });
        }
      });
    });

    return targets;
  }

  /* ---- Build the DOM grid of character cells ------------------------------ */
  function buildGrid() {
    const ratio = charRatios();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Longest line that must fit on screen without truncation.
    let longest = 0;
    for (const b of BLOCKS)
      for (const l of b.lines) if (l.length > longest) longest = l.length;

    // Mobile-first: start readable, grow with the viewport, then bump up on
    // mobile — but always cap the size so the longest line fits across the
    // viewport inside the left/right border columns.
    const isMobile = vw <= MOBILE_MAX;
    let fs = Math.min(FS_MAX, Math.max(FS_MIN, vw * FS_VW));
    if (isMobile) fs *= MOBILE_SCALE;
    const fitCap = vw / ((longest + BORDER_X * 2) * ratio.w);
    fs = Math.max(8, Math.min(fs, fitCap));
    grid.style.fontSize = fs + "px";

    const cw = fs * ratio.w;
    const ch = fs * ratio.h;
    cols = Math.max(1, Math.floor(vw / cw));
    rows = Math.max(1, Math.floor(vh / ch));

    let html = "";
    for (let r = 0; r < rows; r++) {
      html += '<div class="row">';
      html += '<span class="cell"> </span>'.repeat(cols);
      html += "</div>";
    }
    grid.innerHTML = html;

    const targets = placeText();
    cells = new Array(rows * cols);

    const rowEls = grid.children;
    for (let r = 0; r < rows; r++) {
      const spanEls = rowEls[r].children;
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        // Reserve non-animating border columns/rows around the edges (wider on
        // the sides): they never animate and stay blank, so content never
        // bleeds into the viewport edges.
        const border =
          r < BORDER_Y || r >= rows - BORDER_Y || c < BORDER_X || c >= cols - BORDER_X;
        const target = border ? null : targets.get(idx);
        cells[idx] = {
          el: spanEls[c],
          border,
          target: target ? target.ch : null,
          reveal: target ? target.reveal : rand() * NOISE_CLEAR_MAX,
        };
      }
    }
  }

  /* ---- Animate the dissolve ---------------------------------------------- */
  function animate() {
    if (rafId) cancelAnimationFrame(rafId);

    if (reduceMotion) {
      // No motion: just render the final state.
      for (const cell of cells) {
        if (cell.border) continue;
        if (cell.target) {
          cell.el.textContent = cell.target;
          cell.el.classList.add("on");
        } else {
          cell.el.textContent = " ";
        }
      }
      return;
    }

    // Seed the noise field (border cells stay blank).
    for (const cell of cells) if (!cell.border) cell.el.textContent = randChar();

    const active = cells.filter((cell) => !cell.border);
    const start = performance.now();
    let lastFlicker = start;

    function frame(now) {
      const t = now - start;
      const doFlicker = now - lastFlicker >= FLICKER_INTERVAL;

      let i = 0;
      while (i < active.length) {
        const cell = active[i];
        if (t >= cell.reveal) {
          if (cell.target) {
            cell.el.textContent = cell.target;
            cell.el.classList.add("on");
          } else {
            cell.el.textContent = " ";
          }
          // Settled — remove via swap-with-last (order doesn't matter).
          active[i] = active[active.length - 1];
          active.pop();
        } else {
          if (doFlicker) cell.el.textContent = randChar();
          i++;
        }
      }

      if (doFlicker) lastFlicker = now;
      if (active.length) rafId = requestAnimationFrame(frame);
      else rafId = null;
    }

    rafId = requestAnimationFrame(frame);
  }

  function run() {
    buildGrid();
    animate();
  }

  /* ---- Rebuild on resize (also reshuffles positions) ---------------------- */
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(run, 250);
  });

  run();
})();
