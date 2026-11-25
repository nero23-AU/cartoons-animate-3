// Editor de desenho do criador de itens: camadas, pincel com estabilizador, borracha, balde, recorte (laço) e importação de imagem.
'use strict';

class PaintEditor {
  /**
   * t: item, bi: osso. O documento fica no espaço do osso (x ao longo do osso, origem no início dele),
   * então o desenho sai já encaixado no esqueleto, por cima do modelo base.
   */
  constructor(t, bi, { onSave, startTool = 'brush', importFirst = false }) {
    this.t = t; this.bi = bi; this.onSave = onSave;
    const b = t.bones[bi];
    const len = Math.max(b.l, 20), pad = Math.max(80, len * 0.6);
    let doc = b.doc ? { ...b.doc } : { x: Math.round(-pad), y: Math.round(-Math.max(120, len * 0.7)), w: 0, h: 0 };
    if (!b.doc) { doc.w = Math.round(len + pad * 2); doc.h = Math.round(Math.max(240, len * 1.4)); }
    const k = Math.min(1, 1400 / Math.max(doc.w, doc.h)); // limite de tamanho
    doc.w = Math.round(doc.w * k); doc.h = Math.round(doc.h * k); doc.k = k;
    this.doc = doc;
    this.layers = []; this.active = 0; this.history = []; this.redoStack = [];
    this.tool = startTool; this.color = '#212121'; this.size = 12; this.stab = 0.5; this.tol = 40;
    this.pointers = new Map();
    this.buildUI();
    this.load(b).then(() => { this.fit(); this.render(); this.refreshLayers(); if (importFirst) this.importImage(); });
  }
  newLayer(name) {
    const c = document.createElement('canvas'); c.width = this.doc.w; c.height = this.doc.h;
    return { c, ctx: c.getContext('2d', { willReadFrequently: true }), name, vis: true };
  }
  async imgOf(name) {
    const blob = await DB.get('images', name); if (!blob) return null;
    return createImageBitmap(blob);
  }
  async load(b) {
    const d = this.doc;
    if (b.layers && b.layers.length) {
      for (const L of b.layers) {
        const ly = this.newLayer(L.name); ly.vis = L.vis !== false;
        const im = await this.imgOf(L.img); if (im) ly.ctx.drawImage(im, 0, 0, d.w, d.h);
        this.layers.push(ly);
      }
    } else {
      const ly = this.newLayer('Camada 1');
      if (b.img) { const im = await this.imgOf(b.img); if (im) ly.ctx.drawImage(im, (b.ix - d.x) * d.k, (b.iy - d.y) * d.k, im.width * d.k, im.height * d.k); }
      this.layers.push(ly);
    }
  }
  // ----- interface -----
  buildUI() {
    const toolBtn = (id, g, l) => { const e = tool(g, l, '#fff', () => { this.tool = id; this.lasso = null; this.refreshTools(); }); e.dataset.tool = id; return e; };
    this.toolsEl = h('div', { cls: 'panel col scroll', style: { width: '88px' } },
      toolBtn('brush', '🖌', 'PINCEL'), toolBtn('eraser', '🧽', 'BORRACHA'), toolBtn('fill', '🪣', 'BALDE'),
      toolBtn('lasso', '✂', 'RECORTE'), toolBtn('move', '✥', 'MOVER\nCAMADA'),
      tool('🖼', 'IMPORTAR\nIMAGEM', 'var(--cyan)', () => this.importImage()));
    this.color_ = h('input', { type: 'color', value: this.color, oninput: e => { this.color = e.target.value; }, style: { width: '100%', height: '36px', border: 'none' } });
    const slider = (label, min, max, step, val, set) => {
      const out = h('span', {}, String(val));
      return h('div', { style: { padding: '6px 8px', fontSize: '12px' } }, label, ' ', out,
        h('input', { type: 'range', min, max, step, value: val, style: { width: '100%' }, oninput: e => { set(+e.target.value); out.textContent = e.target.value; } }));
    };
    this.layersEl = h('div', { cls: 'scroll', style: { flex: '1' } });
    const side = h('div', { cls: 'col', style: { width: '170px', background: 'var(--bar)', flex: 'none' } },
      h('div', { style: { padding: '6px 8px 0', fontSize: '12px' } }, 'Cor'), h('div', { style: { padding: '0 8px' } }, this.color_),
      slider('Tamanho', 1, 120, 1, this.size, v => this.size = v),
      slider('Estabilizador', 0, 0.95, 0.05, this.stab, v => this.stab = v),
      slider('Tolerância balde', 0, 120, 5, this.tol, v => this.tol = v),
      h('div', { cls: 'row', style: { padding: '4px 8px', gap: '4px', fontSize: '12px', alignItems: 'center' } }, 'CAMADAS',
        h('span', { style: { flex: 1 } }),
        h('span', { cls: 'btn', style: { background: 'var(--green)', padding: '2px 8px' }, onclick: () => this.addLayer() }, '+')),
      this.layersEl,
      h('div', { cls: 'btn', style: { background: 'var(--green)', height: '44px', margin: '6px' }, onclick: () => this.save() }, '✔ CONCLUIR'),
      h('div', { cls: 'btn', style: { background: '#555', height: '36px', margin: '0 6px 6px' }, onclick: () => this.close() }, 'Cancelar'));
    const left = h('div', { cls: 'bar col scroll' },
      tool('↶', 'DESFAZER', 'var(--cyan)', () => this.undo()), tool('↷', 'REFAZER', 'var(--cyan)', () => this.redo()),
      tool('⟲', 'ENQUADRAR', '#fff', () => { this.fit(); this.render(); }));
    this.view = new Surface((ctx, w, hh) => this.draw(ctx, w, hh));
    this.view.onResize = () => { if (!this.vs) this.fit(); };
    const el = this.view.el; el.style.flex = '1'; el.style.minWidth = '0';
    el.addEventListener('pointerdown', e => this.down(e));
    el.addEventListener('pointermove', e => this.move(e));
    el.addEventListener('pointerup', e => this.up(e));
    el.addEventListener('pointercancel', e => this.up(e));
    el.addEventListener('wheel', e => { e.preventDefault(); const [mx, my] = this.loc(e); this.zoomAt(mx, my, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
    this.root = h('div', { style: { position: 'fixed', inset: '0', display: 'flex', background: 'var(--bg)', zIndex: 5 } }, left, this.toolsEl, el, side);
    document.body.append(this.root);
    this.refreshTools();
  }
  refreshTools() { this.toolsEl.querySelectorAll('[data-tool]').forEach(e => e.classList.toggle('on', e.dataset.tool === this.tool)); this.render(); }
  refreshLayers() {
    this.layersEl.replaceChildren(...this.layers.map((L, i) => i).reverse().map(i => {
      const L = this.layers[i];
      return h('div', { cls: 'row', style: { alignItems: 'center', padding: '6px 8px', gap: '6px', background: i === this.active ? 'var(--active)' : 'transparent', cursor: 'pointer' },
        onclick: () => { this.active = i; this.refreshLayers(); } },
        h('span', { onclick: e => { e.stopPropagation(); L.vis = !L.vis; this.refreshLayers(); this.render(); } }, L.vis ? '👁' : '◌'),
        h('span', { style: { flex: 1, fontSize: '13px' } }, L.name),
        h('span', { onclick: e => { e.stopPropagation(); this.moveLayer(i, 1); } }, '▲'),
        h('span', { onclick: e => { e.stopPropagation(); this.moveLayer(i, -1); } }, '▼'),
        h('span', { style: { color: 'var(--red)' }, onclick: e => { e.stopPropagation(); this.deleteLayer(i); } }, '✕'));
    }));
  }
  addLayer() { this.snapshotAll(); this.layers.splice(this.active + 1, 0, this.newLayer('Camada ' + (this.layers.length + 1))); this.active++; this.refreshLayers(); }
  deleteLayer(i) {
    if (this.layers.length <= 1) return toast('A peça precisa de pelo menos 1 camada');
    this.snapshotAll(); this.layers.splice(i, 1); this.active = Math.min(this.active, this.layers.length - 1); this.refreshLayers(); this.render();
  }
  moveLayer(i, d) {
    const j = i + d; if (j < 0 || j >= this.layers.length) return;
    this.snapshotAll(); [this.layers[i], this.layers[j]] = [this.layers[j], this.layers[i]];
    if (this.active === i) this.active = j; else if (this.active === j) this.active = i;
    this.refreshLayers(); this.render();
  }
  // ----- desfazer: guarda o estado das camadas -----
  state() { return { active: this.active, layers: this.layers.map(L => ({ name: L.name, vis: L.vis, data: L.ctx.getImageData(0, 0, this.doc.w, this.doc.h) })) }; }
  apply(s) {
    this.layers = s.layers.map(o => { const L = this.newLayer(o.name); L.vis = o.vis; L.ctx.putImageData(o.data, 0, 0); return L; });
    this.active = Math.min(s.active, this.layers.length - 1); this.refreshLayers(); this.render();
  }
  snapshotAll() { this.history.push(this.state()); if (this.history.length > 25) this.history.shift(); this.redoStack = []; }
  undo() { if (!this.history.length) return toast('Nada para desfazer'); this.redoStack.push(this.state()); this.apply(this.history.pop()); }
  redo() { if (!this.redoStack.length) return toast('Nada para refazer'); this.history.push(this.state()); this.apply(this.redoStack.pop()); }

  // ----- vista -----
  fit() {
    const w = this.view.w || 600, hh = this.view.h || 400;
    this.vs = Math.min(w / this.doc.w, hh / this.doc.h) * 0.9;
    this.vx = (w - this.doc.w * this.vs) / 2; this.vy = (hh - this.doc.h * this.vs) / 2;
  }
  render() { this.view.invalidate(); }
  zoomAt(mx, my, k) {
    const fx = (mx - this.vx) / this.vs, fy = (my - this.vy) / this.vs;
    this.vs = Math.max(0.05, Math.min(40, this.vs * k)); this.vx = mx - fx * this.vs; this.vy = my - fy * this.vs; this.render();
  }
  draw(ctx, w, hh) {
    ctx.fillStyle = '#3A3B47'; ctx.fillRect(0, 0, w, hh);
    const d = this.doc;
    ctx.save(); ctx.translate(this.vx, this.vy); ctx.scale(this.vs, this.vs);
    // fundo xadrez = transparente
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, d.w, d.h); ctx.fillStyle = '#EDEDED';
    const cell = 16 / this.vs * 1;
    for (let y = 0, r = 0; y < d.h; y += cell, r++) for (let x = r % 2 ? cell : 0; x < d.w; x += cell * 2) ctx.fillRect(x, y, Math.min(cell, d.w - x), Math.min(cell, d.h - y));
    // modelo base por baixo (o item inteiro, no espaço deste osso), bem claro
    ctx.save();
    ctx.scale(d.k, d.k); ctx.translate(-d.x, -d.y);
    const r = computeRig(this.t, restAngles(this.t));
    ctx.rotate(-r.ab[this.bi]); ctx.translate(-r.sx[this.bi], -r.sy[this.bi]);
    ctx.globalAlpha = 0.25;
    const others = { ...this.t, bones: this.t.bones.map((b, i) => i === this.bi ? { ...b, img: null, alts: null, s: Shape.IMAGE } : b) };
    Renderer.draw(ctx, others, r);
    ctx.globalAlpha = 1;
    ctx.restore();
    for (const L of this.layers) if (L.vis) ctx.drawImage(L.c, 0, 0);
    // linha do osso
    ctx.save(); ctx.scale(d.k, d.k); ctx.translate(-d.x, -d.y);
    ctx.strokeStyle = '#29B6F6'; ctx.lineWidth = 2 / this.vs / d.k; ctx.setLineDash([6 / this.vs, 4 / this.vs]);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(this.t.bones[this.bi].l, 0); ctx.stroke();
    ctx.restore();
    if (this.lasso && this.lasso.length > 1) {
      ctx.strokeStyle = '#E53935'; ctx.lineWidth = 2 / this.vs; ctx.setLineDash([5 / this.vs, 4 / this.vs]);
      ctx.beginPath(); this.lasso.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
    ctx.strokeStyle = '#29B6F6'; ctx.lineWidth = 1; ctx.strokeRect(this.vx, this.vy, d.w * this.vs, d.h * this.vs);
  }
  // ----- toque -----
  loc(e) { const r = this.view.el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  docPt([mx, my]) { return [(mx - this.vx) / this.vs, (my - this.vy) / this.vs]; }
  down(e) {
    this.view.el.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, this.loc(e));
    if (this.pointers.size === 2) { // pinça: cancela o traço e dá zoom
      if (this.stroking) { this.apply(this.history.pop()); this.stroking = false; }
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d: Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1])), vs: this.vs, fx: ((a[0] + b[0]) / 2 - this.vx) / this.vs, fy: ((a[1] + b[1]) / 2 - this.vy) / this.vs };
      return;
    }
    if (this.pointers.size > 1) return;
    const p = this.docPt(this.loc(e)), L = this.layers[this.active];
    if (!L.vis) return toast('A camada ativa está oculta');
    if (this.tool === 'fill') { this.snapshotAll(); this.flood(L, Math.floor(p[0]), Math.floor(p[1])); this.render(); return; }
    this.snapshotAll(); this.stroking = true;
    if (this.tool === 'lasso') { this.lasso = [p]; return; }
    if (this.tool === 'move') { this.moveStart = p; this.moveImg = L.ctx.getImageData(0, 0, this.doc.w, this.doc.h); return; }
    this.sp = p; this.last = p; this.dab(L, p, p);
  }
  move(e) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, this.loc(e));
    if (this.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()], P = this.pinch;
      this.vs = Math.max(0.05, Math.min(40, P.vs * Math.hypot(a[0] - b[0], a[1] - b[1]) / P.d));
      this.vx = (a[0] + b[0]) / 2 - P.fx * this.vs; this.vy = (a[1] + b[1]) / 2 - P.fy * this.vs; this.render(); return;
    }
    if (!this.stroking) return;
    const p = this.docPt(this.loc(e)), L = this.layers[this.active];
    if (this.tool === 'lasso') { this.lasso.push(p); this.render(); return; }
    if (this.tool === 'move') {
      L.ctx.clearRect(0, 0, this.doc.w, this.doc.h);
      L.ctx.putImageData(this.moveImg, Math.round(p[0] - this.moveStart[0]), Math.round(p[1] - this.moveStart[1]));
      this.render(); return;
    }
    // estabilizador: o pincel segue o dedo com atraso, suavizando tremidas
    const s = this.stab, np = [this.sp[0] + (p[0] - this.sp[0]) * (1 - s), this.sp[1] + (p[1] - this.sp[1]) * (1 - s)];
    this.dab(L, this.sp, np); this.sp = np; this.render();
  }
  up(e) {
    this.pointers.delete(e.pointerId);
    if (this.pinch) { if (!this.pointers.size) this.pinch = null; return; }
    if (!this.stroking) return;
    this.stroking = false;
    const L = this.layers[this.active];
    if (this.tool === 'lasso' && this.lasso.length > 2) this.cut(L);
    this.lasso = null; this.render();
  }
  dab(L, a, b) {
    const c = L.ctx;
    c.save();
    c.globalCompositeOperation = this.tool === 'eraser' ? 'destination-out' : 'source-over';
    c.strokeStyle = this.color; c.lineWidth = this.size; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0] + 0.01, b[1]); c.stroke();
    c.restore();
  }
  /** Recorte: mantém só o que está dentro do laço na camada ativa. */
  cut(L) {
    const c = L.ctx;
    c.save(); c.globalCompositeOperation = 'destination-in';
    c.beginPath(); this.lasso.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill();
    c.restore();
    toast('Recortado: ficou só a área marcada');
  }
  flood(L, x0, y0) {
    const { w, h: hh } = this.doc; if (x0 < 0 || y0 < 0 || x0 >= w || y0 >= hh) return;
    const img = L.ctx.getImageData(0, 0, w, hh), d = img.data, i0 = (y0 * w + x0) * 4;
    const t = [d[i0], d[i0 + 1], d[i0 + 2], d[i0 + 3]];
    const col = parseInt(this.color.slice(1), 16), nc = [(col >> 16) & 255, (col >> 8) & 255, col & 255, 255];
    if (t.every((v, k) => v === nc[k])) return;
    const tol = this.tol, seen = new Uint8Array(w * hh), stack = [x0 + y0 * w];
    const match = j => { const k = j * 4; return Math.abs(d[k] - t[0]) + Math.abs(d[k + 1] - t[1]) + Math.abs(d[k + 2] - t[2]) + Math.abs(d[k + 3] - t[3]) <= tol; };
    while (stack.length) {
      const j = stack.pop(); if (seen[j]) continue; seen[j] = 1;
      if (!match(j)) continue;
      const k = j * 4; d[k] = nc[0]; d[k + 1] = nc[1]; d[k + 2] = nc[2]; d[k + 3] = 255;
      const x = j % w, y = (j / w) | 0;
      if (x > 0) stack.push(j - 1); if (x < w - 1) stack.push(j + 1); if (y > 0) stack.push(j - w); if (y < hh - 1) stack.push(j + w);
    }
    L.ctx.putImageData(img, 0, 0);
  }
  async importImage() {
    const [file] = await pickFiles({ accept: 'image/*' }); if (!file) return;
    const im = await createImageBitmap(file);
    this.snapshotAll();
    const L = this.newLayer(file.name.replace(/\.[^.]+$/, '').slice(0, 18));
    const k = Math.min(1, this.doc.w * 0.9 / im.width, this.doc.h * 0.9 / im.height);
    L.ctx.drawImage(im, (this.doc.w - im.width * k) / 2, (this.doc.h - im.height * k) / 2, im.width * k, im.height * k);
    this.layers.splice(this.active + 1, 0, L); this.active++;
    this.tool = 'lasso'; this.refreshTools(); this.refreshLayers();
    toast('Imagem importada. Use RECORTE para separar a parte, MOVER para posicionar.');
  }
  close() { this.root.remove(); }
  async save() {
    const d = this.doc;
    const flat = document.createElement('canvas'); flat.width = d.w; flat.height = d.h;
    const fc = flat.getContext('2d', { willReadFrequently: true });
    for (const L of this.layers) if (L.vis) fc.drawImage(L.c, 0, 0);
    // corta as bordas vazias
    const px = fc.getImageData(0, 0, d.w, d.h).data;
    let x0 = d.w, y0 = d.h, x1 = -1, y1 = -1;
    for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) if (px[(y * d.w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const toBlob = c => new Promise(r => c.toBlob(r, 'image/png'));
    const layers = [];
    for (const L of this.layers) layers.push({ img: await Images.save(await toBlob(L.c)), name: L.name, vis: L.vis });
    let res = { layers, doc: { x: d.x, y: d.y, w: Math.round(d.w / d.k), h: Math.round(d.h / d.k) }, img: null };
    if (x1 >= 0) {
      const cw = x1 - x0 + 1, ch = y1 - y0 + 1, out = document.createElement('canvas');
      out.width = Math.round(cw / d.k); out.height = Math.round(ch / d.k);
      out.getContext('2d').drawImage(flat, x0, y0, cw, ch, 0, 0, out.width, out.height);
      res.img = await Images.save(await toBlob(out)); res.ix = d.x + x0 / d.k; res.iy = d.y + y0 / d.k;
    }
    this.close();
    this.onSave(res);
  }
}
