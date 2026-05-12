// teachable.js — Teachable Machine pose detection + stretching UI
//
// Requires in HTML before this script:
//   <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.3.1/dist/tf.min.js"></script>
//   <script src="https://cdn.jsdelivr.net/npm/@teachablemachine/pose@0.8/dist/teachablemachine-pose.min.js"></script>

const TM_URL   = 'https://teachablemachine.withgoogle.com/models/iVzPSFfzb/';
const HOLD_SEC = 15;
const MIN_CONF = 0.80;

const EXERCISES = [
  { pose: 'Cuello-der', label: 'Estiramiento 1 de 4', instruction: 'Inclina el cuello hacia la derecha' },
  { pose: 'Cuello-izq', label: 'Estiramiento 2 de 4', instruction: 'Inclina el cuello hacia la izquierda' },
  { pose: 'brazo-der',  label: 'Estiramiento 3 de 4', instruction: 'Estira el brazo derecho hacia afuera' },
  { pose: 'brazo-izq',  label: 'Estiramiento 4 de 4', instruction: 'Estira el brazo izquierdo hacia afuera' },
];

// ── State ─────────────────────────────────────────────────
let tmModel;
let videoEl, inferCanvas, inferCtx; // cámara nativa
let step      = 0;
let tmState   = 'loading';
let holdStart = null;
let predicting = false;
let ui = {};

// ── Init ──────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  buildUI();
  loadModel();
});

async function loadModel() {
  try {
    setStatus('Cargando modelo…');
    tmModel = await tmPose.load(TM_URL + 'model.json', TM_URL + 'metadata.json');

    setStatus('Activando cámara…');
    await startCamera();

    setExercise(0);
    tmState = 'ready';
    setStatus('Prepárate y adopta la posición');
    requestAnimationFrame(predictionLoop);

  } catch (e) {
    tmState = 'error';
    setStatus('No se pudo acceder a la cámara o al modelo 😕');
    console.error(e);
  }
}

// ── Cámara nativa con getUserMedia ────────────────────────
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: 200, height: 150 },
    audio: false,
  });

  // Video visible en el panel
  videoEl = document.createElement('video');
  videoEl.srcObject   = stream;
  videoEl.autoplay    = true;
  videoEl.playsInline = true;
  videoEl.muted       = true;
  Object.assign(videoEl.style, {
    width:     '100%',
    height:    '100%',
    objectFit: 'cover',
    display:   'block',
    borderRadius: '10px',
  });
  ui.webcamWrap.appendChild(videoEl);

  // Canvas offscreen solo para inferencia de TM (no se muestra)
  inferCanvas        = document.createElement('canvas');
  inferCanvas.width  = 200;
  inferCanvas.height = 150;
  inferCtx           = inferCanvas.getContext('2d');

  // Espera a que el video esté listo
  await new Promise(resolve => { videoEl.onloadeddata = resolve; });
}

// ── Loop de predicción ────────────────────────────────────
async function predictionLoop() {               // ← renombrado
  if (tmState === 'done' || tmState === 'error') return;

  if (!predicting && videoEl && videoEl.readyState >= 2) {
    predicting = true;
    try {
      inferCtx.drawImage(videoEl, 0, 0, 200, 150);
      const { posenetOutput } = await tmModel.estimatePose(inferCanvas);
      const preds             = await tmModel.predict(posenetOutput);

      const target = EXERCISES[step].pose;
      const hit    = preds.find(p => p.className === target);
      const conf   = hit ? hit.probability : 0;

      if (conf >= MIN_CONF) {
        if (tmState === 'ready') {
          tmState   = 'holding';
          holdStart = Date.now();
          setStatus('¡Perfecto! Mantén la posición');
        }
        const elapsed = (Date.now() - holdStart) / 1000;
        updateTimer(elapsed);
        if (elapsed >= HOLD_SEC) nextExercise();
      } else {
        if (tmState === 'holding') {
          tmState   = 'ready';
          holdStart = null;
          updateTimer(0);
          setStatus('Perdiste la posición — vuelve a intentarlo');
        }
      }
    } catch(e) {
      console.error('Error en predicción:', e);
    } finally {
      predicting = false;
    }
  }

  requestAnimationFrame(predictionLoop);        // ← renombrado
}

function nextExercise() {
  step++;
  holdStart = null;
  updateTimer(0);

  if (step >= EXERCISES.length) {
    tmState = 'done';
    ui.label.textContent       = '¡COMPLETADO! 🎉';
    ui.instruction.textContent = 'Hiciste todos los estiramientos';
    setStatus('Tu cuerpo te lo agradece 🌿');
    updateTimer(HOLD_SEC);
    // Detiene la cámara
    if (videoEl && videoEl.srcObject) {
      videoEl.srcObject.getTracks().forEach(t => t.stop());
    }
  } else {
    tmState = 'ready';
    setExercise(step);
    setStatus('Prepárate y adopta la posición');
  }
}

// ── UI helpers ────────────────────────────────────────────
function setExercise(i) {
  ui.label.textContent       = EXERCISES[i].label.toUpperCase();
  ui.instruction.textContent = EXERCISES[i].instruction;
}

function setStatus(msg) {
  ui.status.textContent = msg;
}

function updateTimer(elapsed) {
  const secs = Math.min(Math.floor(elapsed), HOLD_SEC);
  const pct  = secs / HOLD_SEC;
  const C    = 2 * Math.PI * 40;

  ui.timerText.textContent = secs;
  ui.ring.setAttribute('stroke-dashoffset', C * (1 - pct));

  const from = [181, 211, 255];
  const to   = [177, 182, 157];
  const r = Math.round(from[0] + (to[0] - from[0]) * pct);
  const g = Math.round(from[1] + (to[1] - from[1]) * pct);
  const b = Math.round(from[2] + (to[2] - from[2]) * pct);
  const col = `rgb(${r},${g},${b})`;

  ui.ring.setAttribute('stroke', col);
  ui.timerText.style.color = col;
}

// ── Build UI panel ────────────────────────────────────────
function buildUI() {
  const panel = el('div', {
    position:        'fixed',
    top:             '50%',
    left:            '50%',
    transform:       'translate(-50%, -50%)',
    zIndex:          '999',
    width:           'min(500px, 88vw)',
    padding:         '2.2rem 2.5rem 2rem',
    background:      'rgba(255,255,255,0.10)',
    backdropFilter:  'blur(18px)',
    webkitBackdropFilter: 'blur(18px)',
    borderRadius:    '22px',
    border:          '1px solid rgba(181,211,255,0.22)',
    boxShadow:       '0 10px 48px rgba(0,0,0,0.28)',
    color:           '#fff',
    fontFamily:      'system-ui, sans-serif',
    display:         'flex',
    flexDirection:   'column',
    alignItems:      'center',
    gap:             '0.9rem',
    textAlign:       'center',
    boxSizing:       'border-box',
  });

  const label = el('p', {
    margin: '0', fontSize: '0.7rem',
    letterSpacing: '0.14em',
    color: 'rgba(181,211,255,0.75)',
  });
  label.textContent = 'CARGANDO';

  const instruction = el('h2', {
    margin: '0', fontSize: '1.35rem',
    fontWeight: '700', lineHeight: '1.4',
  });
  instruction.textContent = 'Preparando…';

  const status = el('p', {
    margin: '0', fontSize: '0.88rem',
    color: 'rgba(255,255,255,0.60)',
  });

  const divider = el('div', {
    width: '100%', height: '1px',
    background: 'rgba(255,255,255,0.15)',
  });

  const row = el('div', {
    display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: '2rem', width: '100%',
  });

  // Timer ring
  const R = 40;
  const C = 2 * Math.PI * R;
  const timerWrap = el('div', { position: 'relative', width: '96px', height: '96px', flexShrink: '0' });

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 96 96');
  Object.assign(svg.style, { width: '96px', height: '96px', transform: 'rotate(-90deg)', display: 'block' });

  const track = svgCircle(48, 48, R, 'rgba(255,255,255,0.12)', 7);
  const ring  = svgCircle(48, 48, R, '#B5D3FF', 7);
  ring.setAttribute('stroke-linecap',    'round');
  ring.setAttribute('stroke-dasharray',   C);
  ring.setAttribute('stroke-dashoffset',  C);
  svg.append(track, ring);

  const timerText = el('div', {
    position: 'absolute', inset: '0',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '1.8rem', fontWeight: '700', color: '#B5D3FF',
  });
  timerText.textContent = '0';
  timerWrap.append(svg, timerText);

  // Webcam wrapper — el video se inserta aquí
  const webcamWrap = el('div', {
    borderRadius: '10px',
    overflow:     'hidden',
    width:        '200px',
    height:       '150px',
    border:       '1px solid rgba(181,211,255,0.25)',
    background:   'rgba(0,0,0,0.3)',
    flexShrink:   '0',
  });

  row.append(timerWrap, webcamWrap);
  panel.append(label, instruction, status, divider, row);
  document.body.appendChild(panel);

  ui = { label, instruction, status, ring, timerText, webcamWrap };
}

function el(tag, styles = {}) {
  const node = document.createElement(tag);
  Object.assign(node.style, styles);
  return node;
}

function svgCircle(cx, cy, r, stroke, strokeWidth) {
  const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  c.setAttribute('cx', cx); c.setAttribute('cy', cy);
  c.setAttribute('r', r);   c.setAttribute('fill', 'none');
  c.setAttribute('stroke', stroke);
  c.setAttribute('stroke-width', strokeWidth);
  return c;
}