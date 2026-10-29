// Raymarch SDF Playground — main.js
'use strict';

const MAX_SHAPES = 24;
const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl2', { antialias: false, powerPreference: 'high-performance' });
if (!gl) {
  document.body.innerHTML = '<p style="padding:2em">WebGL2 is not available in this browser.</p>';
  throw new Error('no webgl2');
}

async function loadShaderSource(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('failed to load ' + url + ': ' + res.status);
  return res.text();
}

function compile(type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) || 'shader compile error');
  }
  return sh;
}

// ---------- state ----------
const SHAPES = [
  { type: 0, pos: [0, 1.0, 0], size: [0.9, 0.9, 0.9], color: '#e07040', blend: 0.55 },
  { type: 0, pos: [0.8, 1.1, 0.3], size: [0.7, 0.7, 0.7], color: '#e07040', blend: 0.55 },
  { type: 0, pos: [-0.7, 0.8, 0.2], size: [0.6, 0.6, 0.6], color: '#e07040', blend: 0.4 },
];
let camYaw = 0.6, camPitch = 0.35, camDist = 6.5, camTarget = [0, 1.0, 0];

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function packShapes(bufA, bufB, bufC) {
  for (let i = 0; i < MAX_SHAPES; i++) {
    if (i < SHAPES.length) {
      const s = SHAPES[i];
      bufA[i * 4] = s.pos[0]; bufA[i * 4 + 1] = s.pos[1]; bufA[i * 4 + 2] = s.pos[2]; bufA[i * 4 + 3] = s.type;
      const size = s.size;
      bufB[i * 4] = size[0]; bufB[i * 4 + 1] = size[1]; bufB[i * 4 + 2] = size[2]; bufB[i * 4 + 3] = 0;
      const c = hexToRgb(s.color);
      bufC[i * 4] = c[0]; bufC[i * 4 + 1] = c[1]; bufC[i * 4 + 2] = c[2]; bufC[i * 4 + 3] = s.blend;
    }
  }
}

const bufA = new Float32Array(MAX_SHAPES * 4);
const bufB = new Float32Array(MAX_SHAPES * 4);
const bufC = new Float32Array(MAX_SHAPES * 4);
packShapes(bufA, bufB, bufC);

// ---------- camera orbit controls ----------
let dragging = false, panning = false, lastX = 0, lastY = 0;
canvas.addEventListener('mousedown', e => {
  dragging = true; panning = (e.button === 2); lastX = e.clientX; lastY = e.clientY;
});
window.addEventListener('mouseup', () => { dragging = false; panning = false; });
window.addEventListener('mousemove', e => {
  if (!dragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  if (panning) {
    const fw = [Math.sin(camYaw), 0, Math.cos(camYaw)];
    const rt = [fw[2], 0, -fw[0]];
    const k = camDist * 0.0015;
    camTarget[0] -= dx * rt[0] * k - dy * 0 * k;
    camTarget[2] -= dx * rt[2] * k;
    camTarget[1] += dy * k;
    camTarget[1] = Math.max(0, camTarget[1]);
  } else {
    camYaw -= dx * 0.008;
    camPitch = Math.min(1.4, Math.max(-0.1, camPitch + dy * 0.008));
  }
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  camDist = Math.min(20, Math.max(1.5, camDist * (e.deltaY > 0 ? 1.1 : 0.9)));
}, { passive: false });
// touch
let tLast = null;
canvas.addEventListener('touchstart', e => { tLast = [e.touches[0].clientX, e.touches[0].clientY]; }, { passive: true });
canvas.addEventListener('touchmove', e => {
  if (!tLast) return;
  const t = e.touches[0];
  camYaw -= (t.clientX - tLast[0]) * 0.008;
  camPitch = Math.min(1.4, Math.max(-0.1, camPitch + (t.clientY - tLast[1]) * 0.008));
  tLast = [t.clientX, t.clientY];
}, { passive: true });

// ---------- UI ----------
const shapesEl = document.getElementById('shapes');
const TYPE_NAMES = ['Sphere', 'Box', 'Torus', 'Capsule'];

function rebuildUI() {
  shapesEl.innerHTML = '';
  SHAPES.forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'shape';
    const row1 = document.createElement('div'); row1.className = 'row';
    const sel = document.createElement('select');
    TYPE_NAMES.forEach((n, ti) => {
      const o = document.createElement('option'); o.value = ti; o.textContent = n;
      if (ti === s.type) o.selected = true; sel.appendChild(o);
    });
    sel.onchange = () => {
      s.type = +sel.value;
      if (s.type === 0) s.size = [0.8, 0.8, 0.8];
      if (s.type === 1) s.size = [0.7, 0.7, 0.7];
      if (s.type === 2) s.size = [0.8, 0.3, 0];
      if (s.type === 3) s.size = [0.9, 0.3, 0];
      packShapes(bufA, bufB, bufC);
    };
    row1.appendChild(sel);
    const del = document.createElement('button'); del.className = 'del'; del.textContent = '✕';
    del.onclick = () => { SHAPES.splice(i, 1); rebuildUI(); packShapes(bufA, bufB, bufC); };
    row1.appendChild(del);

    const sliders = [
      ['X', s.pos[0], -4, 4, 0.05, v => s.pos[0] = v],
      ['Y', s.pos[1], 0, 5, 0.05, v => s.pos[1] = v],
      ['Z', s.pos[2], -4, 4, 0.05, v => s.pos[2] = v],
      ['Size', s.size[0], 0.05, 1.6, 0.01, v => s.size[0] = v],
      ['Blend', s.blend, 0, 1.0, 0.01, v => s.blend = v],
    ];
    div.appendChild(row1);
    sliders.forEach(([label, val, min, max, step, set]) => {
      const row = document.createElement('div'); row.className = 'row';
      const lab = document.createElement('label'); lab.textContent = label;
      const inp = document.createElement('input');
      inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = val;
      const valEl = document.createElement('span'); valEl.className = 'val'; valEl.textContent = (+val).toFixed(2);
      inp.oninput = () => { set(+inp.value); valEl.textContent = (+inp.value).toFixed(2); packShapes(bufA, bufB, bufC); };
      row.appendChild(lab); row.appendChild(inp); row.appendChild(valEl);
      div.appendChild(row);
    });
    const rowC = document.createElement('div'); rowC.className = 'row';
    const labC = document.createElement('label'); labC.textContent = 'Color';
    const col = document.createElement('input'); col.type = 'color'; col.value = s.color;
    col.oninput = () => { s.color = col.value; packShapes(bufA, bufB, bufC); };
    rowC.appendChild(labC); rowC.appendChild(col);
    div.appendChild(rowC);
    shapesEl.appendChild(div);
  });
}
rebuildUI();

document.getElementById('add').onclick = () => {
  if (SHAPES.length >= MAX_SHAPES) return;
  const a = Math.random() * Math.PI * 2;
  SHAPES.push({
    type: 0, pos: [Math.cos(a) * 1.2, 0.9 + Math.random(), Math.sin(a) * 1.2],
    size: [0.6, 0.6, 0.6], color: randColor(), blend: 0.3 + Math.random() * 0.5,
  });
  rebuildUI(); packShapes(bufA, bufB, bufC);
};
function randColor() {
  const h = Math.random() * 360;
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = 0.65 - 0.35 * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return '#' + f(0) + f(8) + f(4);
}

document.getElementById('randomize').onclick = () => {
  SHAPES.length = 0;
  const n = 4 + Math.floor(Math.random() * 5);
  const hue = randColor();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.8;
    const r = 0.4 + Math.random() * 1.2;
    const t = Math.random() < 0.75 ? 0 : Math.floor(Math.random() * 4);
    const sz = 0.4 + Math.random() * 0.8;
    SHAPES.push({
      type: t,
      pos: [Math.cos(a) * r, 0.5 + Math.random() * 1.6, Math.sin(a) * r],
      size: t === 2 ? [sz, 0.15 + Math.random() * 0.3, 0] : [sz, sz, sz],
      color: Math.random() < 0.6 ? hue : randColor(),
      blend: 0.15 + Math.random() * 0.6,
    });
  }
  rebuildUI(); packShapes(bufA, bufB, bufC);
};

const PRESETS = {
  preset1: [ // Blob
    { type: 0, pos: [0, 1.2, 0], size: [1.0, 1, 1], color: '#5b8cff', blend: 0.7 },
    { type: 0, pos: [0.9, 1.6, 0.2], size: [0.8, 1, 1], color: '#5b8cff', blend: 0.7 },
    { type: 0, pos: [-0.8, 0.9, 0.4], size: [0.7, 1, 1], color: '#5b8cff', blend: 0.5 },
    { type: 3, pos: [0, 0.6, -0.6], size: [0.7, 0.25, 0], color: '#3d63b8', blend: 0.4 },
  ],
  preset2: [ // Sculpt
    { type: 1, pos: [0, 0.8, 0], size: [0.8, 0.8, 0.8], color: '#d8a24a', blend: 0 },
    { type: 0, pos: [0.6, 1.4, 0.6], size: [0.7, 1, 1], color: '#d8a24a', blend: 0.45 },
    { type: 2, pos: [0, 1.9, 0], size: [1.1, 0.12, 0], color: '#b8763a', blend: 0.3 },
    { type: 3, pos: [-0.8, 0.9, 0.5], size: [0.85, 0.2, 0], color: '#e0c060', blend: 0.5 },
  ],
  preset3: [ // Tower
    { type: 1, pos: [0, 0.6, 0], size: [0.9, 0.6, 0.9], color: '#7a4a5b', blend: 0 },
    { type: 1, pos: [0, 1.5, 0], size: [0.65, 0.5, 0.65], color: '#8f5568', blend: 0.25 },
    { type: 2, pos: [0, 2.3, 0], size: [0.75, 0.2, 0], color: '#c98aa0', blend: 0.3 },
    { type: 0, pos: [0, 2.9, 0], size: [0.3, 1, 1], color: '#e8b8cc', blend: 0.5 },
    { type: 3, pos: [0.8, 0.9, 0.5], size: [0.8, 0.15, 0], color: '#7a4a5b', blend: 0.4 },
  ],
};
for (const [id, preset] of Object.entries(PRESETS)) {
  document.getElementById(id).onclick = () => {
    SHAPES.length = 0;
    preset.forEach(s => SHAPES.push(JSON.parse(JSON.stringify(s))));
    rebuildUI(); packShapes(bufA, bufB, bufC);
  };
}

document.getElementById('export').onclick = () => {
  const lines = SHAPES.map(s => {
    const c = hexToRgb(s.color).map(v => v.toFixed(2)).join(', ');
    return `  { type: ${s.type}, pos: [${s.pos.map(v => v.toFixed(2))}], size: [${s.size.map(v => v.toFixed(2))}], color: vec3(${c}), blend: ${s.blend.toFixed(2)} },`;
  });
  const text = `// Raymarch SDF Playground export\nconst shapes = [\n${lines.join('\n')}\n];\n`;
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sdf-scene.js';
  a.click();
  URL.revokeObjectURL(a.href);
};

const toggleBtn = document.getElementById('toggle');
toggleBtn.onclick = () => {
  const ui = document.getElementById('ui');
  ui.classList.toggle('hidden');
  toggleBtn.classList.toggle('closed');
  toggleBtn.textContent = ui.classList.contains('hidden') ? '◂ Panel' : 'Panel ▸';
};
if (window.innerWidth < 640) toggleBtn.click();

// ---------- GL setup ----------
const vsSrc = document.getElementById('vs').textContent;
let prog;
try {
  const fragSrc = await loadShaderSource('shader.frag');
  prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(prog) || 'link error');
  }
} catch (err) {
  const pre = document.createElement('pre');
  pre.style.cssText = 'padding:2em;color:#e08098;white-space:pre-wrap';
  pre.textContent = 'Shader error:\n' + err.message;
  document.body.appendChild(pre);
  throw err;
}
gl.useProgram(prog);

const vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
const aPos = gl.getAttribLocation(prog, 'aPos');
gl.enableVertexAttribArray(aPos);
gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

const U = {
  res: gl.getUniformLocation(prog, 'uRes'),
  time: gl.getUniformLocation(prog, 'uTime'),
  camPos: gl.getUniformLocation(prog, 'uCamPos'),
  camTarget: gl.getUniformLocation(prog, 'uCamTarget'),
  count: gl.getUniformLocation(prog, 'uShapeCount'),
  A: gl.getUniformLocation(prog, 'uShapeA'),
  B: gl.getUniformLocation(prog, 'uShapeB'),
  C: gl.getUniformLocation(prog, 'uShapeC'),
};

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

const t0 = performance.now();
function frame() {
  const t = (performance.now() - t0) / 1000;
  const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
  const camPos = [
    camTarget[0] + camDist * cp * Math.sin(camYaw),
    camTarget[1] + camDist * sp + 0.3,
    camTarget[2] + camDist * cp * Math.cos(camYaw),
  ];
  gl.uniform2f(U.res, canvas.width, canvas.height);
  gl.uniform1f(U.time, t);
  gl.uniform3fv(U.camPos, camPos);
  gl.uniform3fv(U.camTarget, camTarget);
  gl.uniform1i(U.count, SHAPES.length);
  gl.uniform4fv(U.A, bufA);
  gl.uniform4fv(U.B, bufB);
  gl.uniform4fv(U.C, bufC);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  requestAnimationFrame(frame);
}
frame();
console.log('Raymarch SDF Playground running:', SHAPES.length, 'shapes');
