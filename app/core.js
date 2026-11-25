// Núcleo: modelo de dados (mesmo JSON do app Android), rig, renderização, armazenamento e importador .atp/.ati
'use strict';

const W = 1280, H = 720;
const Shape = { CAPSULE: 0, BOX: 1, CIRCLE: 2, WHEEL: 3, IMAGE: 4 };
const SHAPE_NAMES = ['Cápsula', 'Caixa', 'Círculo', 'Roda'];
const Cat = { CHAR: 'Personagens', VEH: 'Veículos', OBJ: 'Objetos', CUSTOM: 'Itens personalizados' };
const CATS = [Cat.CHAR, Cat.VEH, Cat.OBJ, Cat.CUSTOM];
const DEFAULT_DUR = 200;

const clone = o => JSON.parse(JSON.stringify(o));
const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;

// ---------- cores (ARGB inteiro, como no Android) ----------
function css(c, alphaMul = 1) {
  c = c >>> 0;
  const a = ((c >>> 24) & 255) / 255 * alphaMul, r = (c >>> 16) & 255, g = (c >>> 8) & 255, b = c & 255;
  return `rgba(${r},${g},${b},${a})`;
}
function darker(c, f = 0.55) {
  c = c >>> 0;
  const a = (c >>> 24) & 255, r = ((c >>> 16) & 255) * f, g = ((c >>> 8) & 255) * f, b = (c & 255) * f;
  return ((a << 24) | (r << 16) | (g << 8) | b) >>> 0;
}

// ---------- modelo ----------
function bone(p, a, l, w, c, s = Shape.CAPSULE, z = 0, ox = 0, oy = 0) { return { p, l, a, w, c: c >>> 0, s, z, ox, oy }; }
const restAngles = t => t.bones.map(b => b.a);
const stateCount = b => 1 + (b.alts ? b.alts.length : 0);
function imageFor(b, st) {
  if (st > 0 && b.alts && st <= b.alts.length) { const a = b.alts[st - 1]; return [a.img, a.x, a.y]; }
  return [b.img || null, b.ix || 0, b.iy || 0];
}
function removeBone(t, i) {
  const n = t.bones.length, dead = new Array(n).fill(false); dead[i] = true;
  let ch = true;
  while (ch) { ch = false; for (let k = 0; k < n; k++) if (!dead[k] && t.bones[k].p >= 0 && dead[t.bones[k].p]) { dead[k] = true; ch = true; } }
  const map = []; let m = 0; for (let k = 0; k < n; k++) map[k] = dead[k] ? -1 : m++;
  t.bones = t.bones.filter((_, k) => !dead[k]);
  t.bones.forEach(b => { if (b.p >= 0) b.p = map[b.p]; });
}
function newProject() { return { id: uid(), name: '', bg: 0xFFFFFFFF, next: 1, inst: [], frames: [{ d: DEFAULT_DUR, p: {} }], audio: [] }; }
const totalMs = pr => pr.frames.reduce((s, f) => s + f.d, 0);
const instOf = (pr, id) => pr.inst.find(i => i.id === id);
const poseState = (p, i) => (p.st && i < p.st.length) ? p.st[i] : 0;

// ---------- rig ----------
function computeRig(t, ang) {
  const n = t.bones.length;
  const r = { sx: new Float32Array(n), sy: new Float32Array(n), ex: new Float32Array(n), ey: new Float32Array(n), ab: new Float32Array(n) };
  const done = new Uint8Array(n);
  const solve = i => {
    if (done[i]) return; done[i] = 1;
    const b = t.bones[i];
    let px = 0, py = 0, pa = 0;
    if (b.p >= 0 && b.p < n) { solve(b.p); px = r.ex[b.p]; py = r.ey[b.p]; pa = r.ab[b.p]; }
    const c = Math.cos(pa), s = Math.sin(pa);
    r.sx[i] = px + (b.ox || 0) * c - (b.oy || 0) * s;
    r.sy[i] = py + (b.ox || 0) * s + (b.oy || 0) * c;
    const a = pa + rad(i < ang.length ? ang[i] : b.a);
    r.ab[i] = a;
    r.ex[i] = r.sx[i] + b.l * Math.cos(a);
    r.ey[i] = r.sy[i] + b.l * Math.sin(a);
  };
  for (let i = 0; i < n; i++) solve(i);
  return r;
}
const parentAbs = (t, r, i) => t.bones[i].p >= 0 ? r.ab[t.bones[i].p] : 0;
const parentEnd = (t, r, i) => t.bones[i].p >= 0 ? [r.ex[t.bones[i].p], r.ey[t.bones[i].p]] : [0, 0];

const Xf = {
  toWorld(p, lx, ly) {
    const x = lx * p.s * (p.f ? -1 : 1), y = ly * p.s, a = rad(p.r), c = Math.cos(a), s = Math.sin(a);
    return [p.x + x * c - y * s, p.y + x * s + y * c];
  },
  toLocal(p, wx, wy) {
    const dx = wx - p.x, dy = wy - p.y, a = rad(-p.r), c = Math.cos(a), s = Math.sin(a);
    let x = (dx * c - dy * s) / p.s; const y = (dx * s + dy * c) / p.s;
    if (p.f) x = -x;
    return [x, y];
  },
  apply(ctx, p) { ctx.translate(p.x, p.y); ctx.rotate(rad(p.r)); ctx.scale(p.f ? -p.s : p.s, p.s); },
  distToSeg(px, py, ax, ay, bx, by) {
    const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy;
    let t = l2 === 0 ? 0 : ((px - ax) * vx + (py - ay) * vy) / l2; t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
  },
};

// ---------- banco local (IndexedDB) ----------
const DB = {
  db: null,
  stores: ['items', 'projects', 'images', 'audio'],
  open() {
    return new Promise((res, rej) => {
      const q = indexedDB.open('cartoon-studio', 2);
      q.onupgradeneeded = () => { const d = q.result; DB.stores.forEach(s => d.objectStoreNames.contains(s) || d.createObjectStore(s)); };
      q.onsuccess = () => { DB.db = q.result; res(); };
      q.onerror = () => rej(q.error);
    });
  },
  tx(store, mode, fn) {
    return new Promise((res, rej) => {
      const t = DB.db.transaction(store, mode), s = t.objectStore(store);
      const r = fn(s);
      t.oncomplete = () => res(r && r.result);
      t.onerror = () => rej(t.error);
    });
  },
  put: (store, key, val) => DB.tx(store, 'readwrite', s => s.put(val, key)),
  get: (store, key) => DB.tx(store, 'readonly', s => s.get(key)),
  del: (store, key) => DB.tx(store, 'readwrite', s => s.delete(key)),
  all(store) {
    return new Promise((res, rej) => {
      const out = [], t = DB.db.transaction(store, 'readonly'), c = t.objectStore(store).openCursor();
      c.onsuccess = () => { const cur = c.result; if (cur) { out.push([cur.key, cur.value]); cur.continue(); } else res(out); };
      c.onerror = () => rej(c.error);
    });
  },
};

// ---------- imagens dos ossos ----------
const Images = {
  cache: new Map(), // nome -> HTMLImageElement (ou 'loading' / 'missing')
  onLoad: () => {},
  get(name) {
    const v = Images.cache.get(name);
    if (v instanceof HTMLImageElement) return v;
    if (v) return null;
    Images.cache.set(name, 'loading');
    DB.get('images', name).then(blob => {
      if (!blob) { Images.cache.set(name, 'missing'); console.warn('imagem ausente', name); return; }
      const img = new Image();
      img.onload = () => { Images.cache.set(name, img); Images.onLoad(); };
      img.onerror = () => { Images.cache.set(name, 'missing'); console.warn('imagem inválida', name); };
      img.src = URL.createObjectURL(blob);
    });
    return null;
  },
  /** Salva a imagem; o nome é o hash do conteúdo, então a mesma imagem nunca é guardada duas vezes. */
  async save(blob) {
    const name = (await hashBlob(blob)) + '.png';
    if (!(await DB.get('images', name))) await DB.put('images', name, blob);
    return name;
  },
};

async function hashBlob(blob) {
  const buf = await blob.arrayBuffer();
  if (crypto.subtle) {
    const d = new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
    return [...d.slice(0, 16)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let h1 = 0x811c9dc5, h2 = 0; const u = new Uint8Array(buf); // ambiente sem crypto.subtle (http fora do localhost)
  for (let i = 0; i < u.length; i++) { h1 = Math.imul(h1 ^ u[i], 16777619); h2 = (h2 + u[i] * (i + 1)) | 0; }
  return (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16) + u.length.toString(16);
}
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

// ---------- renderização ----------
const Renderer = {
  shadow: false,
  draw(ctx, t, r, ghost = 0, hl = -1, states = null) {
    const order = t.bones.map((_, i) => i).sort((a, b) => (t.bones[a].z - t.bones[b].z) || (a - b));
    for (const i of order) Renderer.bone(ctx, t.bones[i], r.sx[i], r.sy[i], r.ab[i], ghost, i === hl, states && i < states.length ? states[i] : 0);
  },
  bone(ctx, b, sx, sy, ab, ghost, hl, st) {
    const col = ghost ? css(ghost) : css(b.c);
    const out = ghost ? css(ghost) : hl ? '#00E5FF' : css(darker(b.c));
    const ow = hl ? 4 : 2, l = b.l, w = b.w;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(ab);
    const [imgName, ix, iy] = imageFor(b, st);
    if (imgName) {
      const im = Images.get(imgName);
      if (im) {
        ctx.globalAlpha = Renderer.shadow ? 1 : ghost ? 0.4 : 1;
        if (Renderer.shadow) ctx.filter = 'brightness(0)'; else if (ghost) ctx.filter = 'grayscale(1)';
        ctx.drawImage(im, ix, iy);
        ctx.filter = 'none'; ctx.globalAlpha = 1;
        if (hl) { ctx.strokeStyle = out; ctx.lineWidth = ow; ctx.strokeRect(ix, iy, im.width, im.height); }
      }
    }
    if (b.s === Shape.IMAGE) { ctx.restore(); return; }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    switch (b.s) {
      case Shape.CAPSULE:
        ctx.strokeStyle = out; ctx.lineWidth = w + ow * 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(l, 0); ctx.stroke();
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(l, 0); ctx.stroke();
        break;
      case Shape.BOX:
        ctx.fillStyle = col; rrect(ctx, 0, -w / 2, l, w, 4); ctx.fill();
        if (!ghost) { ctx.strokeStyle = out; ctx.lineWidth = ow; ctx.stroke(); }
        break;
      case Shape.CIRCLE:
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(l / 2, 0, Math.abs(l / 2), 0, 7); ctx.fill();
        if (!ghost) { ctx.strokeStyle = out; ctx.lineWidth = ow; ctx.stroke(); }
        break;
      case Shape.WHEEL:
        ctx.fillStyle = ghost ? col : '#1E1E1E'; ctx.beginPath(); ctx.arc(0, 0, l, 0, 7); ctx.fill();
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, l * 0.6, 0, 7); ctx.fill();
        if (!ghost) {
          ctx.strokeStyle = css(darker(b.c)); ctx.lineWidth = Math.max(2, l * 0.1);
          for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(l * 0.58, 0); ctx.stroke(); ctx.rotate(Math.PI * 2 / 5); }
          ctx.fillStyle = css(darker(b.c, 0.4)); ctx.beginPath(); ctx.arc(0, 0, l * 0.15, 0, 7); ctx.fill();
          if (hl) { ctx.strokeStyle = out; ctx.lineWidth = ow; ctx.beginPath(); ctx.arc(0, 0, l, 0, 7); ctx.stroke(); }
        }
        break;
    }
    ctx.restore();
  },
  bounds(t, r) {
    let l = Infinity, tp = Infinity, rt = -Infinity, bt = -Infinity;
    const add = (x, y, pad) => { l = Math.min(l, x - pad); tp = Math.min(tp, y - pad); rt = Math.max(rt, x + pad); bt = Math.max(bt, y + pad); };
    t.bones.forEach((b, i) => {
      if (b.img) {
        const im = Images.get(b.img);
        const iw = im ? im.width : 0, ih = im ? im.height : 0;
        const c = Math.cos(r.ab[i]), s = Math.sin(r.ab[i]);
        for (const [u, v] of [[b.ix, b.iy], [b.ix + iw, b.iy], [b.ix, b.iy + ih], [b.ix + iw, b.iy + ih]]) add(r.sx[i] + u * c - v * s, r.sy[i] + u * s + v * c, 0);
      }
      if (b.s === Shape.IMAGE) { add(r.sx[i], r.sy[i], 2); add(r.ex[i], r.ey[i], 2); return; }
      if (b.s === Shape.WHEEL) add(r.sx[i], r.sy[i], b.l);
      else if (b.s === Shape.CIRCLE) add((r.sx[i] + r.ex[i]) / 2, (r.sy[i] + r.ey[i]) / 2, b.l / 2);
      else { add(r.sx[i], r.sy[i], b.w / 2); add(r.ex[i], r.ey[i], b.w / 2); }
    });
    if (!isFinite(l)) return { l: -20, t: -20, r: 20, b: 20 };
    return { l, t: tp, r: rt, b: bt };
  },
  drawFit(ctx, t, w, h, pad = 6) {
    const r = computeRig(t, restAngles(t)), bb = Renderer.bounds(t, r);
    const s = Math.min((w - pad * 2) / Math.max(1, bb.r - bb.l), (h - pad * 2) / Math.max(1, bb.b - bb.t));
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.scale(s, s); ctx.translate(-(bb.l + bb.r) / 2, -(bb.t + bb.b) / 2);
    Renderer.draw(ctx, t, r); ctx.restore();
  },
};
function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }

// ---------- itens pré-instalados e modelos base (só ossos e formas) ----------
const Builtins = {
  humanoid(name, cat, top, arm, legs, skin, shoes, hair) {
    return { name, cat, bones: [
      bone(-1, -90, 62, 28, top, 0, 1), bone(0, 0, 38, 38, skin, Shape.CIRCLE, 3),
      bone(0, 185, 40, 14, arm, 0, -1), bone(2, -15, 36, 12, arm, 0, -1), bone(3, 0, 9, 12, skin, 0, -1),
      bone(-1, 95, 48, 18, legs, 0, -2), bone(5, -5, 48, 16, legs, 0, -2), bone(6, -90, 16, 10, shoes, 0, -2),
      bone(-1, 85, 48, 18, legs, 0, 0), bone(8, 5, 48, 16, legs, 0, 0), bone(9, -90, 16, 10, shoes, 0, 0),
      bone(0, 175, 40, 14, arm, 0, 4), bone(11, -20, 36, 12, arm, 0, 4), bone(12, 0, 9, 12, skin, 0, 4),
      bone(1, 200, 28, 14, hair, Shape.CAPSULE, 5, -4, -8),
    ] };
  },
  suv() {
    return { name: 'SUV prata', cat: Cat.VEH, bones: [
      bone(-1, 0, 236, 56, 0xFFC9CCCF, Shape.BOX, 0, -118, -12), bone(0, 0, 156, 46, 0xFFC9CCCF, Shape.BOX, -1, -206, -44),
      bone(1, 0, 128, 30, 0xFF2B3440, Shape.BOX, 1, -146, 4), bone(0, 0, 236, 10, 0xFF2A2A2A, Shape.BOX, 1, -236, 26),
      bone(0, 0, 15, 8, 0xFFFFF2B0, Shape.BOX, 1, -15, -10), bone(0, 0, 27, 0, 0xFF9AA0A6, Shape.WHEEL, 2, -190, 30),
      bone(0, 0, 27, 0, 0xFF9AA0A6, Shape.WHEEL, 2, -46, 30),
    ] };
  },
};
Builtins.items = [
  Builtins.humanoid('Homem de jaqueta', Cat.CHAR, 0xFF6B4226, 0xFF6B4226, 0xFF2E2B2A, 0xFFE0B08A, 0xFF1A1A1A, 0xFF8A6A3A),
  Builtins.humanoid('Boneco palito', Cat.CHAR, 0xFF2B1747, 0xFF2B1747, 0xFF2B1747, 0xFF2B1747, 0xFF2B1747, 0xFF2B1747),
  Builtins.suv(),
  { name: 'Caixa de madeira', cat: Cat.OBJ, bones: [bone(-1, -90, 70, 70, 0xFF9C6B3C, Shape.BOX)] },
  { name: 'Bola', cat: Cat.OBJ, bones: [bone(-1, -90, 44, 44, 0xFFD94A3A, Shape.CIRCLE)] },
];
Builtins.baseModels = [
  Builtins.humanoid('Personagem', Cat.CHAR, 0xFF9E9E9E, 0xFFB0B0B0, 0xFF7A7A7A, 0xFFD0D0D0, 0xFF5A5A5A, 0xFF8A8A8A),
  (() => { const t = Builtins.suv(); t.name = 'Veículo'; t.bones.forEach(b => { if (b.s !== Shape.WHEEL) b.c = 0xFFB8B8B8; }); return t; })(),
  { name: 'Objeto', cat: Cat.OBJ, bones: [bone(-1, -90, 70, 70, 0xFFB0B0B0, Shape.BOX)] },
  { name: 'Vazio', cat: Cat.CUSTOM, bones: [bone(-1, -90, 50, 12, 0xFF9E9E9E)] },
];

// ---------- armazenamento ----------
const Store = {
  items: [], // [{t, time, tags, fav, folder}]
  async loadItems() {
    Store.items = (await DB.all('items')).map(([, v]) => v).sort((a, b) => b.time - a.time);
  },
  /** Salva o item mantendo favorito/pasta/tags que ele já tinha (meta sobrescreve). */
  async saveItem(t, oldName, meta = {}) {
    const prev = Store.items.find(r => r.t.name === (oldName || t.name)) || {};
    if (oldName && oldName !== t.name) await DB.del('items', oldName);
    const rec = { tags: prev.tags || [], fav: !!prev.fav, folder: prev.folder || '', ...meta, t: clone(t), time: Date.now() };
    await DB.put('items', t.name, rec);
    await Store.loadItems();
  },
  async updateMeta(name, meta) {
    const r = Store.items.find(x => x.t.name === name); if (!r) return;
    Object.assign(r, meta); await DB.put('items', name, r); await Store.loadItems();
  },
  async deleteItem(name) { await DB.del('items', name); await Store.loadItems(); },
  folders() { return [...new Set(Store.items.map(r => r.folder).filter(Boolean))].sort((a, b) => a.localeCompare(b)); },
  /** Projetos: chave = id. Auto-save grava sempre o mesmo registro. */
  saveProject: p => DB.put('projects', p.id, { p: clone(p), time: Date.now() }),
  async listProjects() { return (await DB.all('projects')).map(([id, r]) => ({ id, name: r.p.name, time: r.time, p: r.p })).sort((a, b) => b.time - a.time); },
  async loadProject(id) { const r = await DB.get('projects', id); return r && r.p; },
  deleteProject: id => DB.del('projects', id),
};

// ---------- importador Drawing Cartoons 2 (.atp / .ati) ----------
const Importer = {
  /** files: lista de File (vários arquivos ou uma pasta inteira). */
  async importFiles(files, progress = () => {}) {
    const items = [], warnings = [];
    const list = [...files].filter(f => /\.(atp|ati)$/i.test(f.name));
    for (let k = 0; k < list.length; k++) {
      const f = list[k];
      progress(`${k + 1}/${list.length}: ${f.name}`);
      try {
        const r = await Importer.importBuffer(await f.arrayBuffer(), f.name);
        // cada pacote vira uma pasta da biblioteca, com o nome do pacote como etiqueta
        const pack = f.name.replace(/\.(atp|ati)$/i, '').replace(/\.pack$/i, '');
        r.items.forEach(t => { t._meta = f.name.toLowerCase().endsWith('.atp') ? { folder: pack, tags: [pack] } : {}; });
        items.push(...r.items); warnings.push(...r.warnings);
      } catch (e) { console.error(e); warnings.push(`${f.name}: ${e.message}`); }
    }
    for (const t of items) { const m = t._meta; delete t._meta; await Store.saveItem(t, null, m); }
    return { items, warnings, skipped: files.length - list.length };
  },
  async importBuffer(buf, fileName) {
    const zip = await JSZip.loadAsync(buf);
    const items = [], warnings = [];
    if (zip.file('model.xml')) {
      const t = await Importer.parseAti(fileName.replace(/\.[^.]+$/, ''), zip, warnings);
      if (t) items.push(t);
    } else {
      for (const path of Object.keys(zip.files)) {
        if (!/\.ati$/i.test(path) || zip.files[path].dir) continue;
        const name = path.split('/').pop().replace(/\.ati$/i, '');
        try {
          const inner = await JSZip.loadAsync(await zip.file(path).async('arraybuffer'));
          const t = await Importer.parseAti(name, inner, warnings);
          if (t) items.push(t);
        } catch (e) { warnings.push(`${name}: ${e.message}`); }
      }
    }
    return { items, warnings };
  },
  async xml(zip, name) {
    const f = zip.file(name); if (!f) return null;
    return new DOMParser().parseFromString(await f.async('string'), 'application/xml');
  },
  async parseAti(fallback, zip, warnings) {
    const model = await Importer.xml(zip, 'model.xml'); if (!model) return null;
    const unit = model.querySelector('unit');
    const unitName = (unit && unit.getAttribute('name') || fallback).split(':').pop();
    const pts = [...model.querySelectorAll('point')].map(p => ({
      id: p.getAttribute('id'), x: +p.getAttribute('x'), y: +p.getAttribute('y'),
      par: p.getAttribute('base') === 'true' ? null : p.getAttribute('par'),
      fixed: p.getAttribute('fixed') === 'true', attach: p.getAttribute('attachable'),
    }));
    const assets = await Importer.xml(zip, 'assets.xml');
    const edges = assets ? [...assets.querySelectorAll('edgeAsset')].map(e => ({
      start: e.getAttribute('start'), end: e.getAttribute('end'), bm: e.getAttribute('bm') || '',
      dx: +(e.getAttribute('x_offset') || 0), dy: +(e.getAttribute('y_offset') || 0),
      weight: +(e.getAttribute('weight') || 0), state: +(e.getAttribute('state') || 0),
    })) : [];
    let scale = 0.5;
    const meta = zip.file('meta.txt');
    if (meta) try { const j = JSON.parse(await meta.async('string')); if (j.scale) scale = j.scale; } catch (e) { /* opcional */ }

    const byId = new Map(pts.map(p => [p.id, p]));
    const base = pts.find(p => p.par === null); if (!base) return null;
    const bonePts = pts.filter(p => p.par !== null && byId.has(p.par));
    const boneOf = new Map(bonePts.map((p, i) => [p.id, i]));
    const bones = [], abs = [], done = [];
    const build = i => {
      if (done[i]) return; done[i] = true;
      const p = bonePts[i], q = byId.get(p.par), pb = boneOf.has(q.id) ? boneOf.get(q.id) : -1;
      if (pb >= 0) build(pb);
      const pAbs = pb >= 0 ? abs[pb] : 0, dx = p.x - q.x, dy = p.y - q.y, len = Math.hypot(dx, dy);
      abs[i] = len < 0.001 ? pAbs : Math.atan2(dy, dx);
      bones[i] = { p: pb, l: len, a: deg(abs[i] - pAbs), w: 0, c: 0xFF888888, s: Shape.IMAGE, z: 0,
        ox: pb >= 0 ? 0 : q.x - base.x, oy: pb >= 0 ? 0 : q.y - base.y };
      if (p.fixed) bones[i].fx = true;
      if (p.attach === 'master') bones[i].sk = true;
    };
    bonePts.forEach((_, i) => build(i));
    if (!bones.length) return null;

    let skipped = 0, missing = 0;
    const holder = new Map();
    edges.sort((a, b) => (a.state - b.state) || (a.weight - b.weight));
    for (const e of edges) {
      const f = zip.file(e.bm);
      if (!f) { missing++; continue; } // sem bitmap no arquivo: parte vazia/invisível
      const end = byId.get(e.end), bi = boneOf.get(e.end);
      if (!end || bi === undefined || end.par !== e.start) { skipped++; continue; }
      const img = await Images.save(await f.async('blob'));
      const key = e.start + '-' + e.end;
      if (e.state > 0) {
        const tb = holder.get(key) || bones[bi];
        tb.alts = tb.alts || [];
        while (tb.alts.length < e.state - 1) tb.alts.push({ img: tb.img || img, x: tb.ix || 0, y: tb.iy || 0 });
        if (tb.alts.length === e.state - 1) tb.alts.push({ img, x: e.dx, y: e.dy });
        continue;
      }
      let target = bones[bi];
      if (target.img) { target = clone(target); target.fx = true; delete target.img; delete target.alts; bones.push(target); }
      target.img = img; target.ix = e.dx; target.iy = e.dy; target.z = e.weight;
      holder.set(key, target);
    }
    if (skipped) warnings.push(`${unitName}: ${skipped} imagem(ns) em ligação não suportada`);
    console.log(`[import] ${unitName}: ${bones.length} ossos, ${edges.length} imagens, ${missing} sem bitmap`);
    const t = { name: unitName, cat: Cat.CUSTOM, bones, sc: scale };
    if (base.attach === 'slave') t.att = true;
    return t;
  },
};
