// ── Palette ──────────────────────────────────────────────
const PALE_BLUE = '#B5D3FF';
const MID_BLUE  = '#6C92CB';
const SAGE      = '#a6c1e2';
const OLIVE     = '#305066';

let time = 0;
let orbs  = [];
let bgGfx; // off-screen gradient (redrawn only on resize)

// ── Setup ────────────────────────────────────────────────
function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.style('position', 'fixed');
  canvas.style('top', '0');
  canvas.style('left', '0');
  canvas.style('z-index', '0');

  buildBackground();
}

// Pre-render the static gradient background
function buildBackground() {
  bgGfx = createGraphics(width, height);
  bgGfx.noStroke();
  for (let y = 0; y <= height; y++) {
    let pct = y / height;
    let c = lerpColor(color(PALE_BLUE), color(SAGE), pow(pct, 0.75));
    bgGfx.stroke(c);
    bgGfx.line(0, y, width, y);
  }
}

// ── Draw loop ────────────────────────────────────────────
function draw() {
  // 1. Gradient sky
  image(bgGfx, 0, 0);

  // 2. Wave layers – back → front
  //    wave(baseY, amplitude, freq, alpha, color, phase)
  drawWave(height * 0.48, 40, 0.0022, 0.32, SAGE,     time * 0.30 + 0.0);
  drawWave(height * 0.56, 52, 0.0030, 0.40, MID_BLUE, time * 0.46 + 1.3);
  drawWave(height * 0.63, 60, 0.0034, 0.45, OLIVE,    time * 0.38 + 2.7);
  drawWave(height * 0.71, 50, 0.0040, 0.55, MID_BLUE, time * 0.58 + 3.9);
  drawWave(height * 0.78, 56, 0.0028, 0.65, SAGE,     time * 0.44 + 5.1);
  drawWave(height * 0.86, 44, 0.0024, 0.75, OLIVE,    time * 0.34 + 6.4);
  drawWave(height * 0.93, 36, 0.0032, 0.85, MID_BLUE, time * 0.52 + 7.8);


  time += 0.007;
}

// ── Wave helper ──────────────────────────────────────────
function drawWave(baseY, amp, freq, alpha, col, phase) {
  let c = color(col);
  c.setAlpha(alpha * 255);
  fill(c);
  noStroke();

  beginShape();
  vertex(-2, height + 2);

  for (let x = 0; x <= width + 2; x += 3) {
    let y = baseY
      + sin(x * freq         + phase)              * amp
      + sin(x * freq * 0.52  + phase * 0.73 + 1.1) * amp * 0.42
      + sin(x * freq * 1.75  + phase * 1.28 + 2.3) * amp * 0.16;
    vertex(x, y);
  }

  vertex(width + 2, height + 2);
  endShape(CLOSE);
}

// ── Resize ───────────────────────────────────────────────
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  buildBackground();
}