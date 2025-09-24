const field = document.getElementById('field');
const svg = document.getElementById('field-overlay');
const playerForm = document.getElementById('player-form');
const equipmentButtons = document.getElementById('equipment-buttons');
const actionButtons = document.getElementById('action-buttons');
const animateButton = document.getElementById('animate-button');
const clearLinesButton = document.getElementById('clear-lines');
const resetFieldButton = document.getElementById('reset-field');

const ACTION_META = {
  run: { className: 'action-run', color: '#ffffff', duration: 1200 },
  dribble: { className: 'action-dribble', color: '#ffd166', duration: 1500 },
  pass: { className: 'action-pass', color: '#38bdf8', duration: 900 },
  shoot: { className: 'action-shoot', color: '#ef4444', duration: 800 },
};

const EQUIPMENT_META = {
  cone: { label: 'Cone', emoji: '🟠', scale: 0.95 },
  marker: { label: 'Marker', emoji: '⭕', scale: 0.85 },
  'small-goal': { label: 'Small goal', emoji: '🥅', scale: 1.05 },
  'big-goal': { label: 'Big goal', emoji: '🥅', scale: 1.2 },
};

let activeAction = 'run';
let isDrawing = false;
let currentLine = null;
let currentLineMeta = null;
const lines = [];

setupSvgMarkers();
observeFieldSize();

playerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const label = document.getElementById('player-label').value.trim();
  const shape = document.getElementById('player-shape').value;
  const color = document.getElementById('player-color').value;
  const role = document.getElementById('player-role').value;

  const player = document.createElement('div');
  player.classList.add('drill-item', `shape-${shape}`);
  player.style.setProperty('--item-color', color);

  const text = document.createElement('span');
  text.textContent = label || defaultLabelForRole(role) || 'P';
  player.appendChild(text);

  if (role) {
    const badge = document.createElement('span');
    badge.textContent = role;
    badge.className = 'badge';
    player.appendChild(badge);
  }

  placeOnField(player);
  makeDraggable(player);
  playerForm.reset();
  document.getElementById('player-color').value = color;
});

equipmentButtons.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-type]');
  if (!button) return;

  const type = button.dataset.type;
  const meta = EQUIPMENT_META[type];
  if (!meta) return;

  const equipment = document.createElement('div');
  equipment.classList.add('drill-item', 'equipment');
  equipment.dataset.type = type;
  equipment.style.setProperty('--scale', meta.scale || 1);
  equipment.setAttribute('aria-label', meta.label);

  const icon = document.createElement('span');
  icon.textContent = meta.emoji;
  equipment.appendChild(icon);

  placeOnField(equipment);
  makeDraggable(equipment);
});

actionButtons.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const action = button.dataset.action;
  activeAction = action;

  actionButtons.querySelectorAll('button').forEach((btn) => {
    btn.classList.toggle('active', btn === button);
  });
});

field.addEventListener('pointerdown', (event) => {
  if (activeAction === 'none') return;
  if (event.target.closest('.drill-item')) return;

  const { x, y } = getRelativePoint(event);
  const line = createSvgLine(x, y, x, y);
  const meta = ACTION_META[activeAction];
  if (!meta) {
    isDrawing = false;
    return;
  }
  isDrawing = true;
  line.classList.add(meta.className);
  line.dataset.action = activeAction;

  svg.appendChild(line);
  currentLine = line;
  currentLineMeta = { action: activeAction, start: { x, y } };

  event.preventDefault();
});

field.addEventListener('pointermove', (event) => {
  if (!isDrawing || !currentLine) return;
  const { x, y } = getRelativePoint(event);
  currentLine.setAttribute('x2', x);
  currentLine.setAttribute('y2', y);
});

const finishLine = () => {
  if (!isDrawing || !currentLine) return;

  const x1 = parseFloat(currentLine.getAttribute('x1'));
  const y1 = parseFloat(currentLine.getAttribute('y1'));
  const x2 = parseFloat(currentLine.getAttribute('x2'));
  const y2 = parseFloat(currentLine.getAttribute('y2'));
  const distance = Math.hypot(x2 - x1, y2 - y1);

  if (distance < 12) {
    currentLine.remove();
  } else {
    const stored = {
      element: currentLine,
      action: currentLineMeta.action,
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
    };
    lines.push(stored);
  }

  currentLine = null;
  currentLineMeta = null;
  isDrawing = false;
};

field.addEventListener('pointerup', finishLine);
field.addEventListener('pointerleave', finishLine);
field.addEventListener('pointercancel', finishLine);

animateButton.addEventListener('click', async () => {
  if (!lines.length) return;
  animateButton.disabled = true;
  await playLinesSequentially(lines);
  animateButton.disabled = false;
});

clearLinesButton.addEventListener('click', () => {
  lines.splice(0, lines.length);
  svg.querySelectorAll('line').forEach((line) => line.remove());
});

resetFieldButton.addEventListener('click', () => {
  lines.splice(0, lines.length);
  svg.querySelectorAll('*').forEach((node) => node.remove());
  setupSvgMarkers();
  field.querySelectorAll('.drill-item').forEach((item) => item.remove());
});

function placeOnField(element) {
  const rect = field.getBoundingClientRect();
  const x = rect.width / 2;
  const y = rect.height / 2;
  element.style.left = `${x}px`;
  element.style.top = `${y}px`;
  field.appendChild(element);
}

function makeDraggable(element) {
  element.addEventListener('pointerdown', (event) => {
    if (activeAction !== 'none') return;
    event.preventDefault();
    element.setPointerCapture(event.pointerId);

    const rect = field.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const initialX = parseFloat(element.style.left) || rect.width / 2;
    const initialY = parseFloat(element.style.top) || rect.height / 2;

    const move = (ev) => {
      const deltaX = ev.clientX - startX;
      const deltaY = ev.clientY - startY;
      let nextX = initialX + deltaX;
      let nextY = initialY + deltaY;
      nextX = clamp(nextX, 0, rect.width);
      nextY = clamp(nextY, 0, rect.height);
      element.style.left = `${nextX}px`;
      element.style.top = `${nextY}px`;
    };

    const up = (ev) => {
      element.releasePointerCapture(ev.pointerId);
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', up);
      element.removeEventListener('pointercancel', up);
    };

    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', up);
    element.addEventListener('pointercancel', up);
  });
}

function createSvgLine(x1, y1, x2, y2) {
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', x1);
  line.setAttribute('y1', y1);
  line.setAttribute('x2', x2);
  line.setAttribute('y2', y2);
  line.setAttribute('stroke-linecap', 'round');
  return line;
}

function getRelativePoint(event) {
  const rect = field.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function defaultLabelForRole(role) {
  if (role === 'GK') return 'GK';
  if (role === 'Coach') return 'C';
  return '';
}

async function playLinesSequentially(items) {
  for (const item of items) {
    await animateLine(item);
  }
}

function animateLine(lineMeta) {
  return new Promise((resolve) => {
    const meta = ACTION_META[lineMeta.action];
    const { element } = lineMeta;
    const length = element.getTotalLength();
    const startTime = performance.now();
    const duration = meta.duration;
    element.classList.add('is-animating');

    const dot = document.createElement('div');
    dot.className = `line-dot ${lineMeta.action}`;
    field.appendChild(dot);

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const point = element.getPointAtLength(length * progress);
      dot.style.left = `${point.x}px`;
      dot.style.top = `${point.y}px`;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        dot.remove();
        element.classList.remove('is-animating');
        resolve();
      }
    };

    requestAnimationFrame(step);
  });
}

function setupSvgMarkers() {
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const markers = [
    { id: 'arrow-run', color: '#ffffff' },
    { id: 'arrow-dribble', color: '#ffd166' },
    { id: 'arrow-pass', color: '#38bdf8' },
    { id: 'arrow-shoot', color: '#ef4444' },
  ];

  markers.forEach(({ id, color }) => {
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', id);
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '10');
    marker.setAttribute('refX', '7');
    marker.setAttribute('refY', '5');
    marker.setAttribute('orient', 'auto');
    marker.setAttribute('markerUnits', 'strokeWidth');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    path.setAttribute('fill', color);
    marker.appendChild(path);
    defs.appendChild(marker);
  });

  svg.appendChild(defs);
}

function observeFieldSize() {
  const resize = () => {
    const rect = field.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
    svg.setAttribute('width', rect.width);
    svg.setAttribute('height', rect.height);
  };

  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(field);
}
