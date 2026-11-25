// Interface: telas iguais ao app Android (início, editor com timeline, itens, construtor)
'use strict';

// ---------- utilidades de interface ----------
function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'cls') e.className = v;
    else if (k === 'placeholder' || k === 'title') e[k] = T(v);
    else e[k] = v;
  }
  for (const c of kids.flat()) if (c != null) e.append(c instanceof Node ? c : document.createTextNode(typeof c === 'string' ? T(c) : c));
  return e;
}
const $app = () => document.getElementById('app');
function tool(glyph, label, color, onclick) {
  return h('div', { cls: 'tool', style: { color }, onclick }, h('div', { cls: 'g' }, glyph), label ? h('div', { cls: 'l' }, label) : null);
}
function toast(msg, ms = 2400) { const t = h('div', { cls: 'toast' }, msg); document.body.append(t); setTimeout(() => t.remove(), ms); }
function modal(title, body, buttons = [['OK', null]]) {
  const bg = h('div', { cls: 'modal-bg' });
  const close = () => bg.remove();
  bg.addEventListener('pointerdown', e => { if (e.target === bg) close(); });
  const acts = h('div', { cls: 'acts' }, buttons.map(([l, f]) => h('button', { onclick: () => { close(); f && f(); } }, l)));
  bg.append(h('div', { cls: 'modal' }, title ? h('h3', {}, title) : null, body, buttons.length ? acts : null));
  document.getElementById('modal-root').append(bg);
  return close;
}
function choose(title, options, onPick) {
  let close;
  const body = h('div', {}, options.map((o, i) => h('div', { cls: 'opt', onclick: () => { close(); onPick(i); } }, o)));
  close = modal(title, body, [['Cancelar', null]]);
}
function askText(title, initial, ok, hint) {
  const inp = h('input', { type: 'text', value: initial });
  const done = () => { const v = inp.value.trim(); if (v || hint === 'allowEmpty') ok(v); };
  const close = modal(title, h('div', {}, inp, hint && hint !== 'allowEmpty' ? h('div', { style: { fontSize: '12px', color: '#777', marginTop: '6px' } }, hint) : null), [['Cancelar', null], ['OK', done]]);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { close(); done(); } });
  setTimeout(() => { inp.focus(); inp.select(); }, 30);
}
const PALETTE = [0xFFFFFFFF, 0xFFBDBDBD, 0xFF757575, 0xFF212121, 0xFFE0B08A, 0xFFA0704A, 0xFF6B4226, 0xFF3B2414,
  0xFFE53935, 0xFFFF9800, 0xFFFFEB3B, 0xFF7CC223, 0xFF2E7D32, 0xFF29B6F6, 0xFF1E3A8A, 0xFF8E24AA];
function pickColor(title, onPick) {
  let close;
  const g = h('div', { cls: 'swatches' }, PALETTE.map(c => h('div', { style: { background: css(c) }, onclick: () => { close(); onPick(c); } })));
  close = modal(title, g, [['Cancelar', null]]);
}
function pickFiles({ accept = '', multiple = false, folder = false }) {
  return new Promise(res => {
    const i = h('input', { type: 'file', accept, multiple });
    if (folder) i.webkitdirectory = true;
    i.onchange = () => res([...i.files]);
    i.click();
  });
}
const dpr = () => window.devicePixelRatio || 1;
const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Canvas que se ajusta ao tamanho do elemento e chama draw(ctx, w, h) em pixels CSS. */
class Surface {
  constructor(draw) {
    this.draw = draw; this.el = h('canvas'); this.ctx = this.el.getContext('2d'); this.w = 0; this.h = 0;
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(this.el);
    Surface.all.add(this);
  }
  resize() {
    const r = this.el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const changed = r.width !== this.w || r.height !== this.h;
    this.w = r.width; this.h = r.height;
    this.el.width = Math.round(r.width * dpr()); this.el.height = Math.round(r.height * dpr());
    if (changed && this.onResize) this.onResize();
    this.invalidate();
  }
  invalidate() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      if (!this.el.isConnected) { Surface.all.delete(this); this.ro.disconnect(); return; }
      this.ctx.setTransform(dpr(), 0, 0, dpr(), 0, 0);
      this.draw(this.ctx, this.w, this.h);
    });
  }
}
Surface.all = new Set();
Images.onLoad = () => Surface.all.forEach(s => s.invalidate());

function thumb(t, w, h2, bg = '#fff') {
  const s = new Surface((ctx, cw, ch) => { ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch); Renderer.drawFit(ctx, t, cw, ch); });
  s.el.style.width = w + 'px'; s.el.style.height = h2 + 'px';
  return s.el;
}
function projectThumb(p, w, h2) {
  const s = new Surface((ctx, cw, ch) => {
    const k = Math.min(cw / W, ch / H);
    ctx.fillStyle = '#23232B'; ctx.fillRect(0, 0, cw, ch);
    ctx.save(); ctx.translate((cw - W * k) / 2, (ch - H * k) / 2); ctx.scale(k, k);
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    const f = clone(p.frames[0]); Scene.resolve(p, f);
    Scene.drawBg(ctx, p); Scene.drawFrame(ctx, p, f);
    ctx.restore();
  });
  s.el.style.width = w + 'px'; s.el.style.height = h2 + 'px';
  return s.el;
}

// ---------- tela inicial: projetos salvos automaticamente ----------
async function showHome() {
  if (Editor.current) Editor.current.dispose();
  Monet.setBanner(true); Analytics.screenView('home');
  const projects = await Store.listProjects();
  const grid = h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '14px', padding: '14px', alignContent: 'flex-start' } });
  projects.forEach((r, idx) => {
    if (idx === 2) { const ad = Monet.nativeCard('home_projects', 200, 150); if (ad) grid.append(ad); } // card discreto, como um projeto
    const d = new Date(r.time);
    grid.append(h('div', { style: { width: '200px', cursor: 'pointer' }, onclick: () => { Analytics.track('project_open', { frames: r.p.frames.length }); new Editor(r.p); } },
      projectThumb(r.p, 200, 112),
      h('div', { cls: 'row', style: { alignItems: 'center' } },
        h('div', { style: { flex: 1, padding: '6px 0', fontSize: '14px' } }, r.name || 'Sem nome',
          h('div', { style: { color: '#aaa', fontSize: '12px' } }, `${r.p.frames.length} quadros · ${d.toLocaleDateString(I18N.locale)} ${d.toLocaleTimeString(I18N.locale, { hour: '2-digit', minute: '2-digit' })}`)),
        h('div', { cls: 'dots', style: { padding: '0 6px', fontSize: '22px' }, onclick: e => { e.stopPropagation(); projMenu(r); } }, '⋮'))));
  });
  if (projects.length && projects.length < 3) { const ad = Monet.nativeCard('home_projects', 200, 150); if (ad) grid.append(ad); }
  if (!projects.length) grid.append(h('div', { style: { color: 'var(--grey)', padding: '30px', fontSize: '16px' } },
    'Nenhuma animação ainda. Toque em NOVO CARTOON — tudo é salvo automaticamente.'));
  const projMenu = r => choose(r.name, ['Abrir', 'Renomear', 'Duplicar', 'Excluir'], async i => {
    if (i === 0) new Editor(r.p);
    if (i === 1) askText('Nome', r.name, async n => { r.p.name = n; await Store.saveProject(r.p); showHome(); });
    if (i === 2) { const c = clone(r.p); c.id = uid(); c.name = r.name + ' (cópia)'; await Store.saveProject(c); showHome(); }
    if (i === 3) modal(`Excluir "${r.name}"?`, h('div', {}, 'Isso não pode ser desfeito.'), [['Cancelar', null], ['Excluir', async () => { await Store.deleteProject(r.id); Cloud.remove(r.id); showHome(); }]]);
  });
  const big = (g, l, c, f) => h('div', { cls: 'tool', style: { color: c, padding: '14px 4px' }, onclick: f },
    h('div', { style: { width: '64px', height: '64px', borderRadius: '16px', background: c, color: '#fff', fontSize: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, g),
    h('div', { cls: 'l', style: { marginTop: '6px' } }, l));
  window.onBackupRestored = () => showHome();
  $app().replaceChildren(
    h('div', { cls: 'col', style: { flex: '1', minWidth: 0 } },
      h('div', { style: { padding: '14px 16px 0', fontSize: '18px', fontWeight: 'bold' } }, 'Minhas animações',
        h('span', { style: { fontSize: '12px', color: '#9a9aa4', fontWeight: 'normal', marginLeft: '10px' } },
          Monet.slots() === Infinity ? '' : `${projects.length} de ${Monet.slots()} espaços usados`), I18N.picker()),
      h('div', { cls: 'scroll', style: { flex: 1 } }, grid)),
    h('div', { cls: 'col scroll', style: { width: '130px', background: 'var(--bar)' } },
      big('🎬', 'NOVO\nCARTOON', 'var(--green)', async () => {
        if (projects.length >= Monet.slots()) { Analytics.track('slot_limit_hit', { used: projects.length }); if (!(await Monet.addSlot())) return; }
        const p = newProject(); p.name = 'Animação ' + (projects.length + 1); Analytics.track('project_new'); new Editor(p);
      }),
      big('🧩', 'CONSTRUTOR\nDE ITENS', 'var(--cyan)', () => showItems()),
      big('💾', 'BACKUP', 'var(--orange)', () => showBackup()),
      big('🧹', 'ARMAZE-\nNAMENTO', 'var(--grey)', () => showStorage()),
      Auth.enabled() ? big(Auth.user() ? '☁' : '👤', 'CONTA', '#3D8FC7', () => showAccount()) : null,
      Monet.adsRemoved() ? null : big('⭐', 'SEM\nANÚNCIOS', 'var(--purple)', () => Monet.storeMenu())));
}

// ---------- biblioteca: busca, favoritos, pastas e etiquetas ----------
const Library = {
  /** Lista filtrada. folder: '' = todas, '★' = favoritos, nome de pasta, categoria embutida. */
  query(text, folder) {
    const all = [...Builtins.items.map(t => ({ t, builtin: true, tags: [], fav: false, folder: t.cat })), ...Store.items];
    const words = norm(text).split(/\s+/).filter(Boolean);
    return all.filter(r => {
      if (folder === '★' && !r.fav) return false;
      if (folder && folder !== '★' && (r.folder || Cat.CUSTOM) !== folder) return false;
      const hay = norm([r.t.name, r.folder, ...(r.tags || [])].join(' '));
      return words.every(w => hay.includes(w.replace(/^#/, '')));
    });
  },
  folders() {
    const counts = new Map();
    const add = f => counts.set(f, (counts.get(f) || 0) + 1);
    Builtins.items.forEach(t => add(t.cat));
    Store.items.forEach(r => add(r.folder || Cat.CUSTOM));
    const fav = Store.items.filter(r => r.fav).length;
    return [['★', `★ Favoritos`, fav], ...[...counts].map(([k, n]) => [k, k, n])];
  },
  /** Menu de organização de um item do usuário. */
  organize(r, done) {
    choose(r.t.name, [r.fav ? '☆ Tirar dos favoritos' : '★ Favoritar', '📁 Mover para pasta…', '🏷 Etiquetas…'], i => {
      if (i === 0) Store.updateMeta(r.t.name, { fav: !r.fav }).then(done);
      if (i === 1) {
        const opts = ['＋ Nova pasta…', '(sem pasta)', ...Store.folders()];
        choose('Mover para pasta', opts, j => {
          if (j === 0) askText('Nome da nova pasta', '', n => Store.updateMeta(r.t.name, { folder: n }).then(done));
          else Store.updateMeta(r.t.name, { folder: j === 1 ? '' : opts[j] }).then(done);
        });
      }
      if (i === 2) askText('Etiquetas (separadas por vírgula)', (r.tags || []).join(', '),
        v => Store.updateMeta(r.t.name, { tags: v.split(',').map(s => s.trim()).filter(Boolean) }).then(done), 'allowEmpty');
    });
  },
};
function searchBox(value, oninput, light) {
  return h('input', { type: 'search', placeholder: '🔍 Buscar nome, pasta ou #etiqueta', value,
    style: { width: '100%', fontSize: '15px', padding: '9px 10px', border: 'none', borderRadius: '8px', background: light ? '#fff' : '#333', color: light ? '#222' : '#fff' },
    oninput: e => oninput(e.target.value) });
}

// ---------- tela de itens ----------
function showItems(back = showHome) {
  Monet.setBanner(true); Analytics.screenView('items');
  let text = '', folder = '';
  const list = h('div', { cls: 'scroll', style: { flex: '1' } });
  const chips = h('div', { cls: 'row', style: { gap: '6px', flexWrap: 'wrap', padding: '8px 0' } });
  const fill = () => {
    chips.replaceChildren(...[['', 'Todos', null], ...Library.folders()].map(([k, l, n]) => h('div', { cls: 'btn', style: {
      padding: '5px 10px', fontSize: '13px', fontWeight: 'normal', background: folder === k ? 'var(--active)' : '#3a3a44' }, onclick: () => { folder = k; fill(); } },
      n == null ? l : `${l} (${n})`)));
    list.replaceChildren();
    const rows = Library.query(text, folder).filter(r => !r.builtin);
    if (!rows.length) list.append(h('div', { style: { color: 'var(--grey)', fontSize: '16px', padding: '30px 10px' } },
      Store.items.length ? 'Nada encontrado.' : 'Nenhum item criado ainda. Toque em NOVO e escolha um modelo base, ou IMPORTAR.'));
    rows.forEach((r, idx) => {
      if (idx === 3) { const ad = Monet.nativeCard('library', 360, 80); if (ad) list.append(ad); }
      const t = r.t;
      list.append(h('div', { cls: 'item-row', onclick: () => openBuilder(clone(t), false, () => showItems(back)) },
        thumb(t, 80, 80),
        h('div', { cls: 'nm' }, (r.fav ? '★ ' : '') + t.name,
          h('small', {}, [r.folder ? '📁 ' + r.folder : '', (r.tags || []).map(x => '#' + x).join(' '), new Date(r.time).toLocaleDateString(I18N.locale)].filter(Boolean).join('  ·  '))),
        h('div', { cls: 'dots', onclick: e => { e.stopPropagation(); itemMenu(r); } }, '⋮')));
    });
  };
  const itemMenu = r => choose(r.t.name, ['Editar', 'Organizar (favorito, pasta, etiquetas)', 'Duplicar', 'Excluir'], async i => {
    if (i === 0) openBuilder(clone(r.t), false, () => showItems(back));
    if (i === 1) Library.organize(r, fill);
    if (i === 2) { const c = clone(r.t); c.name = r.t.name + '_copia'; await Store.saveItem(c, null, { folder: r.folder, tags: r.tags }); fill(); }
    if (i === 3) modal(`Excluir "${r.t.name}"?`, h('div'), [['Cancelar', null], ['Excluir', async () => { await Store.deleteItem(r.t.name); fill(); }]]);
  });
  const doImport = async f => {
    const files = await pickFiles({ accept: '.atp,.ati', multiple: true, folder: f });
    if (!files.length) return;
    await runImport(files); fill();
  };
  const openNew = m => { const t = clone(m); t.name = ''; openBuilder(t, true, () => showItems(back)); };
  const side = h('div', { cls: 'side col scroll' },
    h('div', { cls: 'btn', style: { background: 'var(--green)', width: '130px', height: '80px', margin: '10px 10px 6px', fontSize: '20px' }, onclick: () =>
      choose('Modelo base', Builtins.baseModels.map(m => m.name), i => openNew(Builtins.baseModels[i])) }, '＋\nNOVO'),
    h('div', { cls: 'btn', style: { background: 'var(--blue)', width: '130px', height: '54px', margin: '4px 10px', fontSize: '14px' }, onclick: () => doImport(false) }, '⇩ IMPORTAR\narquivos .atp/.ati'),
    NativeAds() ? null : h('div', { cls: 'btn', style: { background: 'var(--blue)', width: '130px', height: '54px', margin: '4px 10px 8px', fontSize: '14px' }, onclick: () => doImport(true) }, '📁 IMPORTAR\npasta inteira'),
    h('div', { style: { color: 'var(--grey)', fontSize: '15px' } }, 'Modelos'),
    Builtins.baseModels.map(m => { const c = thumb(m, 120, 70, '#23232B'); c.style.marginTop = '6px'; c.style.cursor = 'pointer'; c.onclick = () => openNew(m); return c; }));
  $app().replaceChildren(
    h('div', { cls: 'col', style: { width: '92px', background: 'var(--bar)', flex: 'none' } }, tool('‹', 'VOLTAR', '#fff', back)),
    h('div', { cls: 'col items-list' }, searchBox('', v => { text = v; fill(); }), chips, list), side);
  fill();
}

async function runImport(files) {
  const status = h('div', {}, 'Importando…');
  const close = modal('Importar', status, []);
  const r = await Importer.importFiles(files, s => { status.textContent = 'Importando ' + s; });
  close(); Analytics.track('item_import', { files: files.length, items: r.items.length, warnings: r.warnings.length });
  let msg = r.items.length ? `Importados ${r.items.length} item(ns):\n` + r.items.map(t => '• ' + t.name).join('\n') : 'Nenhum item encontrado.';
  if (r.skipped) msg += `\n\n${r.skipped} arquivo(s) ignorado(s) (não são .atp/.ati).`;
  if (r.warnings.length) msg += '\n\nAvisos:\n' + r.warnings.join('\n');
  modal('Importar', h('div', { style: { whiteSpace: 'pre-line', maxHeight: '60vh', overflow: 'auto' } }, msg));
  return r;
}

// ---------- editor de animação ----------
class Editor {
  constructor(project) {
    if (Editor.current) Editor.current.dispose();
    this.project = project; project.audio = project.audio || []; if (!project.id) project.id = uid();
    this.frame = 0; this.undoStack = []; this.redoStack = []; this.undoBytes = 0;
    this.clipboard = null; this.panelKind = ''; this.insertFolder = null; this.insertText = '';
    this.stage = new Stage(this); this.timeline = new Timeline(this);
    Monet.setBanner(false); Analytics.screenView('editor');
    this.buildUI();
    Editor.current = this;
    this.onHide = () => this.saveNow();
    document.addEventListener('visibilitychange', this.onHide); window.addEventListener('pagehide', this.onHide);
    this.keyFn = e => this.onKey(e); window.addEventListener('keydown', this.keyFn, true);
    (project.audio || []).forEach(c => AudioEngine.buffer(c.aid));
    this.saveNow();
  }
  /** Atalhos de teclado (computador). */
  onKey(e) {
    if (Editor.current !== this || document.querySelector('#modal-root .modal-bg') || document.querySelector('.paint-root')) return;
    const t = e.target, tag = (t.tagName || '').toLowerCase();
    if (tag === 'textarea' || t.isContentEditable || (tag === 'input' && !/^(range|checkbox|radio|button|color)$/.test(t.type))) return;
    if (tag === 'button' || tag === 'input') t.blur(); // um botão com foco não "rouba" Espaço/Enter
    const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    let hit = true;
    if (mod && k === 'z' && !e.shiftKey) this.undo();
    else if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) this.redo();
    else if (mod && k === 's') { this.saveNow(); toast('Salvo ✓'); }
    else if (mod && k === 'c') { this.clipboard = clone(this.project.frames[this.frame]); toast('Quadro copiado'); }
    else if (mod && k === 'v') this.pasteFrame(true);
    else if (mod) hit = false;
    else if (k === ' ') this.togglePlay();
    else if (k === 'arrowright' || k === '.') this.selectFrame(Math.min(this.frame + 1, this.project.frames.length - 1));
    else if (k === 'arrowleft' || k === ',') this.selectFrame(Math.max(this.frame - 1, 0));
    else if (k === 'home') this.selectFrame(0);
    else if (k === 'end') this.selectFrame(this.project.frames.length - 1);
    else if (k === 'n' || k === 'enter') this.addFrame();
    else if (k === 'delete' || k === 'backspace') { if (this.stage.selected >= 0) this.removeSelected(); else this.deleteFrame(); }
    else if (k === 'escape') { this.closePanel(); this.stage.selected = -1; this.refresh(); }
    else if (k === 'i') { this.insertFolder = null; this.togglePanel('insert'); }
    else if (k === 's' && this.timeline.selClip) this.splitClip(this.timeline.selClip);
    else hit = false;
    if (hit) e.preventDefault();
  }
  dispose() {
    window.removeEventListener('keydown', this.keyFn, true);
    this.saveNow(); AudioEngine.stop();
    document.removeEventListener('visibilitychange', this.onHide); window.removeEventListener('pagehide', this.onHide);
    if (Editor.current === this) Editor.current = null;
  }
  buildUI() {
    this.barBtns = {};
    const bar = h('div', { cls: 'bar col scroll' });
    const add = (k, el) => { this.barBtns[k] = el; bar.append(el); };
    add('menu', tool('☰', '', '#fff', () => this.togglePanel('menu')));
    add('play', this.playBtn = tool('▶', 'JOGAR', 'var(--orange)', () => this.togglePlay()));
    add('insert', tool('✚', 'INSERIR', 'var(--green)', () => { this.insertFolder = null; this.togglePanel('insert'); }));
    add('unit', tool('🔧', 'EDITAR\nUNIDADE', 'var(--teal)', () => this.togglePanel('unit')));
    add('frame', tool('⧉', 'EDITAR\nQUADRO', 'var(--blue)', () => this.togglePanel('frame')));
    add('undo', tool('↶', 'DESFAZER', 'var(--cyan)', () => this.undo()));
    add('redo', tool('↷', 'REFAZER', 'var(--cyan)', () => this.redo()));
    this.panel = h('div', { cls: 'panel col scroll', style: { display: 'none' } });
    this.saveLabel = h('div', { style: { position: 'absolute', right: '8px', top: '6px', fontSize: '11px', color: '#9a9aa4', pointerEvents: 'none' } });
    const stageWrap = h('div', { style: { flex: '1', minHeight: '0', position: 'relative', display: 'flex' } }, this.stage.s.el, this.saveLabel);
    this.stage.s.el.style.flex = '1';
    const right = h('div', { cls: 'col', style: { flex: '1', minWidth: '0' } }, stageWrap, this.timeline.s.el);
    this.timeline.s.el.style.height = '112px'; this.timeline.s.el.style.flex = 'none';
    $app().replaceChildren(bar, this.panel, right);
    this.updateUndoButtons();
  }
  // ----- desfazer / refazer (com limite de memória para projetos longos) -----
  /**
   * Guarda o estado para desfazer. frameOnly = só o quadro atual mudou (posar, mover, girar):
   * guarda só esse quadro, então projetos longos continuam leves e com muitos passos de desfazer.
   */
  beforeChange(frameOnly = false) {
    const s = frameOnly ? { i: this.frame, s: JSON.stringify(this.project.frames[this.frame]), inst: this.instSig() } : { s: JSON.stringify(this.project) };
    this.undoStack.push(s); this.undoBytes += s.s.length;
    while (this.undoStack.length > 1 && (this.undoStack.length > 200 || this.undoBytes > 60e6)) this.undoBytes -= this.undoStack.shift().s.length;
    this.redoStack = [];
    this.updateUndoButtons();
  }
  instSig() { return this.project.inst.map(i => i.id).join(','); }
  /** Troca o snapshot pelo estado atual equivalente e aplica o snapshot. */
  swap(snap) {
    if (snap.i !== undefined && snap.i < this.project.frames.length && snap.inst === this.instSig()) {
      const cur = { i: snap.i, s: JSON.stringify(this.project.frames[snap.i]), inst: snap.inst };
      this.project.frames[snap.i] = JSON.parse(snap.s); this.frame = snap.i;
      this.timeline.multi.clear(); this.refresh(); this.scheduleSave();
      return cur;
    }
    const cur = { s: JSON.stringify(this.project) };
    this.restore(snap.s);
    return cur;
  }
  changed() { this.refresh(); this.scheduleSave(); }
  refresh() {
    this.frame = Math.max(0, Math.min(this.frame, this.project.frames.length - 1));
    this.stage.s.invalidate(); this.timeline.s.invalidate(); this.updateUndoButtons();
  }
  restore(json) {
    this.project = JSON.parse(json);
    if (!instOf(this.project, this.stage.selected)) this.stage.selected = -1;
    this.timeline.multi.clear(); this.timeline.selClip = null;
    this.refresh(); this.scheduleSave();
  }
  undo() {
    if (!this.undoStack.length) return toast('Nada para desfazer');
    const s = this.undoStack.pop(); this.undoBytes -= s.s.length;
    this.redoStack.push(this.swap(s));
  }
  redo() {
    if (!this.redoStack.length) return toast('Nada para refazer');
    const cur = this.swap(this.redoStack.pop()); this.undoStack.push(cur); this.undoBytes += cur.s.length;
  }
  updateUndoButtons() {
    if (!this.barBtns) return;
    this.barBtns.undo.classList.toggle('off', !this.undoStack.length);
    this.barBtns.redo.classList.toggle('off', !this.redoStack.length);
  }
  // ----- auto-save -----
  scheduleSave() {
    clearTimeout(this.saveT);
    if (this.saveLabel) this.saveLabel.textContent = 'salvando…';
    this.saveT = setTimeout(() => this.saveNow(), 1200);
  }
  saveNow() {
    clearTimeout(this.saveT);
    const t0 = performance.now();
    return Store.saveProject(this.project).then(() => {
      if (this.saveLabel) this.saveLabel.textContent = T('salvo automaticamente ✓');
      Cloud.queue(this.project);
      this.lastSaveMs = performance.now() - t0;
    }).catch(e => { console.error(e); toast('Falha ao salvar: ' + e.message); });
  }
  // ----- quadros -----
  selectFrame(i, listen = true) {
    this.frame = i; this.timeline.ensureVisible(i); this.refresh();
    // toca o áudio deste quadro (ajuda no lip-sync)
    if (listen && this.project.audio.length && !this.stage.playing) {
      const s = Scene.frameStart(this.project, i); AudioEngine.play(this.project, s, s + this.project.frames[i].d);
    }
  }
  onPlayTime(t, fi) { this.timeline.playT = t; if (this.timeline.playFrame !== fi) this.timeline.playFrame = fi; this.timeline.s.invalidate(); }
  togglePlay() {
    const [g, l] = this.playBtn.children;
    if (this.stage.playing) {
      this.stage.stop(); AudioEngine.stop(); this.timeline.playFrame = -1; this.timeline.playT = -1;
      g.textContent = '▶'; l.textContent = 'JOGAR';
    } else {
      this.closePanel(); this.stage.play(); g.textContent = '■'; l.textContent = 'PARAR';
    }
    this.refresh();
  }
  addFrame() { this.beforeChange(); this.project.frames.splice(this.frame + 1, 0, clone(this.project.frames[this.frame])); this.selectFrame(this.frame + 1, false); this.changed(); }
  deleteFrame() {
    if (this.project.frames.length <= 1) return toast('A animação precisa de pelo menos 1 quadro');
    this.beforeChange(); this.project.frames.splice(this.frame, 1); this.selectFrame(Math.min(this.frame, this.project.frames.length - 1), false); this.changed();
  }
  pasteFrame(asNew) {
    if (!this.clipboard) return toast('Copie um quadro primeiro');
    this.beforeChange();
    if (asNew) { this.project.frames.splice(this.frame + 1, 0, clone(this.clipboard)); this.selectFrame(this.frame + 1, false); }
    else this.project.frames[this.frame] = clone(this.clipboard);
    this.changed();
  }
  /** Fundo: cor sólida ou imagem da galeria / dos arquivos do computador. */
  backgroundMenu() {
    const p = this.project, opts = ['🎨 Cor sólida', '🖼 Imagem da galeria ou do computador…'];
    if (p.bgImg) opts.push('↔ Ajuste da imagem: ' + ({ cover: 'preencher', contain: 'inteira', stretch: 'esticar' }[p.bgFit || 'cover']), '✖ Remover imagem de fundo');
    choose('Plano de fundo', opts, async i => {
      if (i === 0) return pickColor('Cor do fundo', c => { this.beforeChange(); p.bg = c; this.changed(); });
      if (i === 1) {
        const [f] = await pickFiles({ accept: 'image/*' }); if (!f) return;
        try {
          const blob = await fitImageBlob(f, 2560);
          const name = await Images.save(blob);
          this.beforeChange(); p.bgImg = name; p.bgFit = p.bgFit || 'cover'; this.changed();
          Analytics.track('bg_image'); toast('Imagem de fundo aplicada');
        } catch (e) { toast('Não consegui abrir essa imagem'); }
      }
      if (i === 2) { const order = ['cover', 'contain', 'stretch']; this.beforeChange(); p.bgFit = order[(order.indexOf(p.bgFit || 'cover') + 1) % 3]; this.changed(); }
      if (i === 3) { this.beforeChange(); delete p.bgImg; this.changed(); }
    });
  }
  /** Efeito de transição entre este quadro e o próximo (como em editores de vídeo). */
  frameEffect() {
    const f = this.project.frames[this.frame];
    if (this.frame === this.project.frames.length - 1) return toast('O efeito vai na transição para o próximo quadro: selecione um quadro que tenha um seguinte');
    const cur = f.fx && f.fx.mb || 0;
    const val = h('span', {}, Math.round(cur * 100) + '%');
    const range = h('input', { type: 'range', min: 0, max: 100, value: Math.round((cur || 0.6) * 100), style: { width: '100%' }, oninput: e => val.textContent = e.target.value + '%' });
    val.textContent = range.value + '%';
    modal(`Transição ${this.frame + 1} → ${this.frame + 2}`, h('div', { style: { width: '320px' } },
      h('b', {}, 'Motion Blur', Monet.motionBlurUnlocked() ? '' : ' 🔒'), h('div', { style: { fontSize: '13px', color: '#666', margin: '4px 0 10px' } }, 'Desfoque de movimento rápido nesta transição (ótimo para golpes e lutas).'),
      h('div', {}, 'Intensidade ', val), range), [
      ['Remover', () => { this.beforeChange(); delete f.fx; this.changed(); toast('Efeito removido'); }],
      ['Cancelar', null],
      ['Aplicar', async () => {
        if (!(await Monet.unlockMotionBlur())) return;
        this.beforeChange(); f.fx = { mb: +range.value / 100 }; this.changed(); Analytics.track('effect_apply', { effect: 'motion_blur' }); toast('Motion Blur aplicado na transição');
      }],
    ]);
  }
  // ----- unidades -----
  insert(t) {
    this.beforeChange();
    const inst = { id: this.project.next++, t: clone(t) };
    this.project.inst.push(inst);
    const s = t.sc > 0 ? t.sc : t.cat === Cat.VEH ? 1.2 : 1.6;
    const pose = { x: W / 2, y: H * 0.62, s, r: 0, f: false, a: restAngles(t) };
    for (let i = this.frame; i < this.project.frames.length; i++) this.project.frames[i].p[inst.id] = clone(pose);
    this.stage.selected = inst.id;
    Analytics.track('item_insert', { builtin: Builtins.items.includes(t), cat: t.cat });
    this.closePanel(); this.changed();
  }
  withSelected(fn) {
    const inst = instOf(this.project, this.stage.selected);
    if (!inst || !this.project.frames[this.frame].p[inst.id]) { toast('Toque num item no palco para selecioná-lo'); return false; }
    this.beforeChange(); fn(inst); this.changed(); return true;
  }
  cycleImage() {
    const inst = instOf(this.project, this.stage.selected);
    if (!inst) return toast('Toque num item no palco para selecioná-lo');
    const bones = inst.t.bones;
    let bi = this.stage.lastBone;
    if (!(bi >= 0 && bi < bones.length && bones[bi].alts && bones[bi].alts.length)) bi = bones.findIndex(b => b.alts && b.alts.length);
    if (bi < 0) return toast('Este item não tem imagens alternativas');
    this.withSelected(it => {
      const p = this.project.frames[this.frame].p[it.id];
      p.st = p.st || []; while (p.st.length < bones.length) p.st.push(0);
      p.st[bi] = (p.st[bi] + 1) % stateCount(bones[bi]);
    });
  }
  /** IK: trava/destrava a ponta do último osso tocado (ex.: pé no chão). */
  togglePin() {
    const inst = instOf(this.project, this.stage.selected), bi = this.stage.lastBone;
    if (!inst || this.stage.lastInst !== inst.id || bi < 0) return toast('Toque no ponto laranja da ponta que quer travar (ex.: o pé) e depois em TRAVAR PONTA');
    this.withSelected(it => {
      for (let k = this.frame; k < this.project.frames.length; k++) {
        const p = this.project.frames[k].p[it.id]; if (!p) continue;
        p.pins = p.pins || {};
        if (k === this.frame && p.pins[bi]) { // destravar
          for (let j = this.frame; j < this.project.frames.length; j++) { const q = this.project.frames[j].p[it.id]; if (q && q.pins) delete q.pins[bi]; }
          toast('Ponta destravada'); return;
        }
        p.pins[bi] = Scene.pinWorld(this.project, this.project.frames[k], it.id, bi);
      }
      toast('Ponta travada: ela fica no lugar quando o corpo se mexe'); Analytics.track('ik_pin');
    });
  }
  removeSelected() {
    this.withSelected(inst => {
      for (let i = this.frame; i < this.project.frames.length; i++) delete this.project.frames[i].p[inst.id];
      if (!this.project.frames.some(f => f.p[inst.id])) this.project.inst = this.project.inst.filter(i => i !== inst);
      this.stage.selected = -1;
    });
  }
  // ----- áudio -----
  async addAudio() {
    const files = await pickFiles({ accept: 'audio/*', multiple: true }); if (!files.length) return;
    let start = Scene.frameStart(this.project, this.frame), n = 0;
    for (const f of files) {
      try {
        const c = await AudioEngine.addFile(f, start);
        if (!n) this.beforeChange();
        this.project.audio.push(c); start += c.dur; n++;
      } catch (e) { toast(`${f.name}: ${e.message}`); }
    }
    if (n) { this.changed(); Analytics.track('audio_add', { n }); toast(`${n} áudio(s) adicionado(s) a partir do quadro ${this.frame + 1}. Arraste o clipe para ajustar.`); }
  }
  /** Divide o bloco de áudio em dois no começo do quadro atual (ou no cursor de reprodução). */
  splitClip(c) {
    c = c || this.timeline.selClip; if (!c) return toast('Toque num bloco de áudio para selecioná-lo');
    const t = Scene.frameStart(this.project, this.frame), rate = c.rate || 1;
    if (t <= c.start + 20 || t >= c.start + c.dur - 20) return toast('Selecione um quadro que fique no meio deste áudio para cortar ali');
    this.beforeChange();
    const a = t - c.start;
    const b = { ...c, id: uid(), start: t, dur: c.dur - a, off: (c.off || 0) + a * rate };
    c.dur = a;
    this.project.audio.splice(this.project.audio.indexOf(c) + 1, 0, b);
    this.timeline.selClip = b; this.changed(); toast('Áudio cortado em 2 blocos');
  }
  clipSpeed(c) {
    const pct = v => Math.round(100 / v) + '%';
    const val = h('span', {}, pct(c.rate || 1));
    const r = h('input', { type: 'range', min: 25, max: 400, value: Math.round(100 / (c.rate || 1)), style: { width: '100%' }, oninput: e => val.textContent = e.target.value + '%' });
    modal('Esticar áudio', h('div', { style: { width: '300px' } }, h('div', { style: { fontSize: '13px', color: '#666', marginBottom: '6px' } }, 'Tamanho do bloco: mais de 100% deixa o áudio mais lento e longo; menos deixa mais rápido e curto.'), val, r),
      [['Cancelar', null], ['100%', () => { this.beforeChange(); this.setRate(c, 1); this.changed(); }], ['OK', () => { this.beforeChange(); this.setRate(c, 100 / +r.value); this.changed(); }]]);
  }
  setRate(c, rate) { const src = c.dur * (c.rate || 1); c.rate = Math.max(0.25, Math.min(4, rate)); c.dur = Math.round(src / c.rate / 10) * 10; }
  clipMenu(c) {
    choose(c.name, ['Volume…', 'Começar no quadro atual', 'Remover áudio', '✂ Cortar no quadro atual (dividir em 2 blocos)', '↔ Velocidade / esticar…'], i => {
      if (i === 3) return this.splitClip(c);
      if (i === 4) return this.clipSpeed(c);
      if (i === 0) {
        const val = h('span', {}, Math.round((c.gain ?? 1) * 100) + '%');
        const r = h('input', { type: 'range', min: 0, max: 200, value: Math.round((c.gain ?? 1) * 100), style: { width: '100%' }, oninput: e => val.textContent = e.target.value + '%' });
        modal('Volume', h('div', { style: { width: '280px' } }, val, r), [['Cancelar', null], ['OK', () => { this.beforeChange(); c.gain = +r.value / 100; this.changed(); }]]);
      }
      if (i === 1) { this.beforeChange(); c.start = Scene.frameStart(this.project, this.frame); this.changed(); }
      if (i === 2) { this.beforeChange(); this.project.audio = this.project.audio.filter(x => x !== c); this.timeline.selClip = null; this.changed(); }
    });
  }
  // ----- painéis -----
  closePanel() { this.panelKind = ''; this.panel.style.display = 'none'; this.highlightBar(); }
  highlightBar() { for (const [k, v] of Object.entries(this.barBtns)) v.classList.toggle('on', k === this.panelKind); }
  togglePanel(kind, keep) {
    if (this.stage.playing) this.togglePlay();
    if (this.panelKind === kind && kind !== 'insert' && !keep) return this.closePanel();
    this.panelKind = kind;
    const p = this.panel; p.replaceChildren();
    p.style.display = 'flex';
    p.style.width = (kind === 'menu' || kind === 'insert') ? '240px' : '110px';
    p.style.background = kind === 'insert' ? 'var(--cream)' : 'var(--panel)';
    const pr = () => this.project, fr = () => this.project.frames[this.frame];
    if (kind === 'frame') p.append(
      tool('＋', 'ADICIONAR', '#fff', () => this.addFrame()),
      tool('🗑', 'APAGAR', 'var(--red)', () => this.deleteFrame()),
      tool('❐', 'COPIAR', '#fff', () => { this.clipboard = clone(fr()); toast('Quadro copiado'); }),
      tool('📋', 'COLAR', '#fff', () => this.pasteFrame(false)),
      tool('▤＋', 'COLAR\nNOVO', '#fff', () => this.pasteFrame(true)),
      tool('💨', 'EFEITO\n(BLUR)', 'var(--purple)', () => this.frameEffect()));
    if (kind === 'unit') {
      const sel = instOf(pr(), this.stage.selected);
      p.append(
        tool('⇋', 'ESPELHAR', '#fff', () => this.withSelected(it => { const q = fr().p[it.id]; q.f = !q.f; })),
        tool('🖼', 'TROCAR\nIMAGEM', '#fff', () => this.cycleImage()),
        tool('📌', 'TRAVAR\nPONTA (IK)', 'var(--red)', () => this.togglePin()),
        tool('◐', sel && sel.shadow ? 'SOMBRA\n(LIGADA)' : 'SOMBRA', '#fff', () => { if (this.withSelected(it => { it.shadow = !it.shadow; })) this.togglePanel('unit', true); }),
        tool('◑', 'MESCLAGEM', '#fff', () => {
          if (!instOf(pr(), this.stage.selected)) return toast('Toque num item no palco para selecioná-lo');
          choose('Modo de mesclagem', Scene.BLENDS.map(([, l]) => l), i => this.withSelected(it => { it.blend = Scene.BLENDS[i][0] === 'source-over' ? undefined : Scene.BLENDS[i][0]; }));
        }),
        tool('▲', 'FRENTE', '#fff', () => this.withSelected(it => { pr().inst = pr().inst.filter(x => x !== it); pr().inst.push(it); })),
        tool('▼', 'TRÁS', '#fff', () => this.withSelected(it => { pr().inst = pr().inst.filter(x => x !== it); pr().inst.unshift(it); })),
        tool('🗑', 'REMOVER', 'var(--red)', () => this.removeSelected()));
    }
    if (kind === 'menu') {
      const item = (g, l, f) => p.append(h('div', { cls: 'menu-item', onclick: f }, `${g}   ${T(l)}`));
      item('✏', 'RENOMEAR PROJETO', () => askText('Nome do projeto', this.project.name || '', n => { this.project.name = n; this.saveNow(); toast('Renomeado'); }));
      item('🎞', 'EXPORTAR', () => { this.saveNow(); Analytics.track('export_open'); Exporter.open(this.project); });
      item('🎵', 'ADICIONAR ÁUDIO', () => this.addAudio());
      item('🖼', 'PLANO DE FUNDO', () => this.backgroundMenu());
      item('🧩', 'CRIAR ITENS', () => { this.saveNow(); const ed = this; showItems(() => { ed.buildUI(); Editor.current = ed; ed.refresh(); }); });
      item('✖', 'SAIR', () => this.saveNow().then(async () => { await showHome(); Monet.interstitial('exit_project'); }));
      p.append(h('div', { style: { color: '#9a9aa4', fontSize: '12px', padding: '10px 18px' } }, 'Tudo é salvo automaticamente.'));
      if (matchMedia('(pointer: fine)').matches) p.append(h('div', { style: { color: '#9a9aa4', fontSize: '12px', padding: '0 18px 12px', lineHeight: '1.7' } },
        h('b', {}, 'Atalhos do teclado'), h('br'), 'Espaço: jogar/parar · ← →: quadro anterior/próximo', h('br'), 'N ou Enter: novo quadro · Delete: apagar item ou quadro', h('br'), 'Ctrl+Z / Ctrl+Y: desfazer/refazer · Ctrl+C / Ctrl+V: copiar/colar quadro', h('br'), 'I: inserir · S: cortar o áudio selecionado · Esc: fechar painel', h('br'), 'Áudio: arraste as pontas para cortar · clique duplo para esticar · Roda do mouse: zoom'));
    }
    if (kind === 'insert') this.buildInsert();
    this.highlightBar();
  }
  buildInsert() {
    const p = this.panel, folder = this.insertFolder;
    const list = h('div', {});
    const fillList = () => {
      list.replaceChildren();
      if (folder == null && !this.insertText) {
        for (const [k, l, n] of Library.folders()) list.append(h('div', { cls: 'folder', onclick: () => { this.insertFolder = k; this.togglePanel('insert'); } }, `${k === '★' ? '' : '📁  '}${T(l)}  (${n})`));
        return;
      }
      const rows = Library.query(this.insertText, folder || '');
      if (!rows.length) list.append(h('div', { style: { color: 'var(--folder)', padding: '14px' } }, 'Nada encontrado.'));
      for (const r of rows) list.append(h('div', { cls: 'lib-row', onclick: () => this.insert(r.t) },
        thumb(r.t, 56, 56), h('div', { style: { flex: 1 } }, (r.fav ? '★ ' : '') + r.t.name,
          (r.tags || []).length ? h('div', { style: { fontSize: '11px', opacity: 0.7 } }, r.tags.map(x => '#' + x).join(' ')) : null),
        r.builtin ? null : h('div', { style: { padding: '0 6px', fontSize: '20px' }, onclick: e => { e.stopPropagation(); Library.organize(r, fillList); } }, r.fav ? '★' : '☆')));
    };
    p.append(h('div', { cls: 'lib-head', onclick: () => { if (folder == null) this.closePanel(); else { this.insertFolder = null; this.togglePanel('insert'); } } },
      folder == null ? '⌃  Voltar' : '‹  ' + (folder === '★' ? 'Favoritos' : folder)),
      h('div', { style: { padding: '6px' } }, searchBox(this.insertText, v => { this.insertText = v; fillList(); }, true)), list);
    fillList();
  }
}

// ---------- palco ----------
class Stage {
  constructor(ed) {
    this.ed = ed; this.selected = -1; this.playing = false; this.lastBone = -1; this.lastInst = -1;
    this.sc = 1; this.offX = 0; this.offY = 0; this.baseSc = 1; this.zoom = 1;
    this.mode = 'none'; this.pointers = new Map();
    this.s = new Surface((ctx, w, hh) => this.draw(ctx, w, hh));
    this.s.onResize = () => this.fit();
    const el = this.s.el;
    el.addEventListener('pointerdown', e => this.down(e));
    el.addEventListener('pointermove', e => this.move(e));
    el.addEventListener('pointerup', e => this.up(e));
    el.addEventListener('pointercancel', e => this.up(e));
    el.addEventListener('wheel', e => this.wheel(e), { passive: false });
  }
  get project() { return this.ed.project; }
  get frame() { return this.project.frames[this.ed.frame]; }
  fit() {
    this.baseSc = Math.min(this.s.w / W, this.s.h / H) * 0.97; this.zoom = 1; this.sc = this.baseSc;
    this.offX = (this.s.w - W * this.sc) / 2; this.offY = (this.s.h - H * this.sc) / 2;
  }
  handleR() { return 22 / this.sc; }
  play() {
    this.playing = true; this.selected = -1;
    this.playStart = performance.now(); this.lastT = -1;
    this.s.invalidate();
  }
  stop() { this.playing = false; this.s.invalidate(); }

  draw(ctx, w, hh) {
    const t0 = performance.now();
    ctx.fillStyle = '#3A3B47'; ctx.fillRect(0, 0, w, hh);
    ctx.save(); ctx.translate(this.offX, this.offY); ctx.scale(this.sc, this.sc);
    if (this.playing) { ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip(); } // só a reprodução corta no enquadramento
    if (this.playing) {
      const total = Math.max(1, totalMs(this.project)), t = (performance.now() - this.playStart) % total;
      if (t < this.lastT || this.lastT < 0) AudioEngine.play(this.project, t); // começo ou volta do loop
      this.lastT = t;
      const fi = Scene.renderTime(ctx, this.project, t);
      this.ed.onPlayTime(t, fi);
    } else {
      Scene.drawBg(ctx, this.project);
      const fi = this.ed.frame, f = this.frame;
      if (fi > 0) { const prev = this.project.frames[fi - 1]; Scene.resolve(this.project, prev); Scene.drawFrame(ctx, this.project, prev, 0x55A0A0A0); }
      Scene.resolve(this.project, f);
      Scene.drawFrame(ctx, this.project, f);
      // fora do enquadramento: o item continua visível e editável, só fica escurecido (não sai no vídeo)
      const big = 1e5;
      ctx.fillStyle = 'rgba(58,59,71,0.6)'; ctx.beginPath();
      ctx.rect(-big, -big, big * 2 + W, big * 2 + H); ctx.rect(0, 0, W, H); ctx.fill('evenodd');
      this.drawJoints(ctx, f); this.drawHandles(ctx, f);
    }
    ctx.restore();
    ctx.strokeStyle = '#29B6F6'; ctx.lineWidth = 2; ctx.strokeRect(this.offX, this.offY, W * this.sc, H * this.sc);
    this.lastDrawMs = performance.now() - t0;
    if (this.playing) this.s.invalidate();
  }
  draggable(b) { return !b.fx && b.l > 0.5; }
  drawJoints(ctx, f) {
    const rr = 5 / this.sc;
    for (const inst of this.project.inst) {
      const p = f.p[inst.id]; if (!p) continue;
      const t = inst.t, r = computeRig(t, p.a);
      ctx.fillStyle = '#FF9800';
      t.bones.forEach((b, i) => { if (!this.draggable(b)) return; const [x, y] = Xf.toWorld(p, r.ex[i], r.ey[i]); dot(ctx, x, y, rr); });
      ctx.fillStyle = '#7CC223';
      t.bones.forEach((b, i) => { if (!b.sk) return; const [x, y] = Xf.toWorld(p, r.ex[i], r.ey[i]); dot(ctx, x, y, rr * 1.3); });
      if (p.pins) for (const [bi, [px, py]] of Object.entries(p.pins)) { // pontas travadas (IK)
        ctx.fillStyle = '#E53935'; ctx.fillRect(px - rr * 1.4, py - rr * 1.4, rr * 2.8, rr * 2.8);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 / this.sc; ctx.strokeRect(px - rr * 1.4, py - rr * 1.4, rr * 2.8, rr * 2.8);
      }
      ctx.fillStyle = inst.id === this.selected ? '#29B6F6' : (p.at ?? -1) >= 0 ? '#7CC223' : '#E65100';
      dot(ctx, p.x, p.y, rr * 1.6);
    }
  }
  worldBounds(inst, p) {
    const r = computeRig(inst.t, p.a), b = Renderer.bounds(inst.t, r);
    let l = Infinity, t = Infinity, rt = -Infinity, bt = -Infinity;
    for (const [lx, ly] of [[b.l, b.t], [b.r, b.t], [b.l, b.b], [b.r, b.b]]) {
      const [x, y] = Xf.toWorld(p, lx, ly); l = Math.min(l, x); t = Math.min(t, y); rt = Math.max(rt, x); bt = Math.max(bt, y);
    }
    return { l, t, r: rt, b: bt };
  }
  handles(inst, p) {
    const b = this.worldBounds(inst, p), g = this.handleR() * 1.5;
    return { rx: b.l - g, ry: b.t - g, sx: b.r + g, sy: b.t - g, mx: (b.l + b.r) / 2, my: b.b + g };
  }
  drawHandles(ctx, f) {
    const inst = instOf(this.project, this.selected); if (!inst) return;
    const p = f.p[inst.id]; if (!p) return;
    const hd = this.handles(inst, p), r = this.handleR();
    const circle = (x, y, col, g) => {
      ctx.fillStyle = col; dot(ctx, x, y, r);
      ctx.fillStyle = '#fff'; ctx.font = `${r * 1.1}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(g, x, y + r * 0.05);
    };
    circle(hd.rx, hd.ry, '#7CC223', '⟳'); circle(hd.sx, hd.sy, '#FF9800', '⤢'); circle(hd.mx, hd.my, '#29B6F6', '✥');
  }
  tryAttach(id) {
    const inst = instOf(this.project, id); if (!inst || !inst.t.att) return;
    const f = this.frame, p = f.p[id]; if (!p) return;
    let best = 26 / this.sc, host = -1, bone = -1;
    for (const o of this.project.inst) {
      if (o.id === id) continue;
      const op = f.p[o.id]; if (!op) continue;
      let ch = op, bad = false, g = 0;
      while ((ch.at ?? -1) >= 0 && g++ < 8) { if (ch.at === id) { bad = true; break; } ch = f.p[ch.at]; if (!ch) break; }
      if (bad) continue;
      const r = computeRig(o.t, op.a);
      o.t.bones.forEach((b, i) => {
        if (!b.sk) return;
        const [wx, wy] = Xf.toWorld(op, r.ex[i], r.ey[i]), d = Math.hypot(p.x - wx, p.y - wy);
        if (d < best) { best = d; host = o.id; bone = i; }
      });
    }
    if (host < 0) return;
    const last = this.ed.undoStack[this.ed.undoStack.length - 1];
    if (last && last.i !== undefined) { // prender afeta os quadros seguintes: o desfazer precisa do projeto todo
      const fr = JSON.parse(last.s), full = clone(this.project); full.frames[last.i] = fr;
      const s = JSON.stringify(full); this.ed.undoBytes += s.length - last.s.length;
      this.ed.undoStack[this.ed.undoStack.length - 1] = { s };
    }
    const rot = p.r;
    for (let k = this.ed.frame; k < this.project.frames.length; k++) {
      const fk = this.project.frames[k], fp = fk.p[id];
      if (!fp || !fk.p[host]) continue;
      fp.at = host; fp.ab = bone;
      const s = Scene.socketWorld(this.project, fk, host, bone); if (!s) continue;
      fp.f = s.f; fp.r = rot; fp.rl = Scene.relFor(fp, s);
    }
    Scene.resolve(this.project, f);
    toast('Item preso');
  }
  // ----- toque / mouse -----
  toStage(e) { const r = this.s.el.getBoundingClientRect(); return [(e.clientX - r.left - this.offX) / this.sc, (e.clientY - r.top - this.offY) / this.sc]; }
  local(e) { const r = this.s.el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  down(e) {
    this.s.el.setPointerCapture(e.pointerId); this.ptrs.set(e.pointerId, this.lx(e));
    this.pointers.set(e.pointerId, this.local(e));
    if (this.playing) return;
    if (this.pointers.size === 2) { if (this.mode !== 'none' && this.mode !== 'pan') this.ed.changed(); this.startPinch(); return; }
    if (this.pointers.size > 2) return;
    const [x, y] = this.toStage(e), f = this.frame;
    Scene.resolve(this.project, f);
    this.mode = 'none'; this.sx0 = x; this.sy0 = y;
    if (!this.pickHandle(f, x, y) && !this.pickJoint(f, x, y) && !this.pickBody(f, x, y)) {
      this.selected = -1; this.mode = 'pan'; [this.panX, this.panY] = this.local(e);
      this.s.invalidate(); return;
    }
    if (this.mode !== 'none') {
      this.ed.beforeChange(true);
      if (this.mode === 'move') { const p = f.p[this.dragInst]; if (p) p.at = -1; }
      this.startPose = clone(f.p[this.dragInst]);
    }
    if (this.ed.panelKind === 'unit') this.ed.togglePanel('unit', true);
    this.s.invalidate();
  }
  startPinch() {
    const [a, b] = [...this.pointers.values()];
    this.mode = 'pinch';
    this.pinchDist = Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1])); this.pinchZoom = this.zoom;
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    this.pfx = (mx - this.offX) / this.sc; this.pfy = (my - this.offY) / this.sc;
  }
  move(e) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, this.local(e));
    if (this.playing) return;
    if (this.mode === 'pinch') {
      if (this.pointers.size < 2) return;
      const [a, b] = [...this.pointers.values()];
      this.zoom = Math.max(0.3, Math.min(8, this.pinchZoom * Math.hypot(a[0] - b[0], a[1] - b[1]) / this.pinchDist));
      this.sc = this.baseSc * this.zoom;
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      this.offX = mx - this.pfx * this.sc; this.offY = my - this.pfy * this.sc;
      this.s.invalidate(); return;
    }
    if (this.mode === 'pan') {
      const [lx, ly] = this.local(e); this.offX += lx - this.panX; this.offY += ly - this.panY; this.panX = lx; this.panY = ly;
      this.s.invalidate(); return;
    }
    const [x, y] = this.toStage(e), f = this.frame, p = f.p[this.dragInst], s0 = this.startPose;
    if (!p || !s0) return;
    Scene.resolve(this.project, f);
    let skip = -1;
    if (this.mode === 'move') { p.x = s0.x + x - this.sx0; p.y = s0.y + y - this.sy0; }
    else if (this.mode === 'rotate') {
      p.r = s0.r + deg(Math.atan2(y - s0.y, x - s0.x) - this.startAng);
      if ((p.at ?? -1) >= 0) { const s = Scene.socketWorld(this.project, f, p.at, p.ab); if (s) p.rl = Scene.relFor(p, s); }
    } else if (this.mode === 'scale') p.s = Math.max(0.05, Math.min(8, s0.s * Math.hypot(x - s0.x, y - s0.y) / this.startDist));
    else if (this.mode === 'bone') {
      const t = instOf(this.project, this.dragInst).t, r = computeRig(t, p.a), [lx, ly] = Xf.toLocal(p, x, y);
      p.a[this.dragBone] = deg(Math.atan2(ly - r.sy[this.dragBone], lx - r.sx[this.dragBone]) - parentAbs(t, r, this.dragBone));
      if (p.pins && p.pins[this.dragBone]) { p.pins[this.dragBone] = Scene.pinWorld(this.project, f, this.dragInst, this.dragBone); skip = this.dragBone; }
    }
    // IK: pontas travadas ficam no lugar
    Scene.solveIK(this.project, f, this.dragInst, skip);
    Scene.resolve(this.project, f);
    this.s.invalidate();
  }
  up(e) {
    this.pointers.delete(e.pointerId);
    if (this.mode === 'pinch') { if (this.pointers.size === 0) this.mode = 'none'; return; }
    if (this.mode === 'pan') { this.mode = 'none'; return; }
    if (this.mode === 'move') this.tryAttach(this.dragInst);
    if (this.mode !== 'none') this.ed.changed();
    this.mode = 'none';
  }
  wheel(e) {
    e.preventDefault();
    const [mx, my] = this.local(e), fx = (mx - this.offX) / this.sc, fy = (my - this.offY) / this.sc;
    this.zoom = Math.max(0.3, Math.min(8, this.zoom * Math.exp(-e.deltaY * 0.0015)));
    this.sc = this.baseSc * this.zoom; this.offX = mx - fx * this.sc; this.offY = my - fy * this.sc;
    this.s.invalidate();
  }
  pickHandle(f, x, y) {
    const inst = instOf(this.project, this.selected); if (!inst) return false;
    const p = f.p[inst.id]; if (!p) return false;
    const hd = this.handles(inst, p), r = this.handleR() * 1.2;
    this.dragInst = inst.id;
    if (Math.hypot(x - hd.rx, y - hd.ry) < r) { this.mode = 'rotate'; this.startAng = Math.atan2(y - p.y, x - p.x); }
    else if (Math.hypot(x - hd.sx, y - hd.sy) < r) { this.mode = 'scale'; this.startDist = Math.max(1, Math.hypot(x - p.x, y - p.y)); }
    else if (Math.hypot(x - hd.mx, y - hd.my) < r) this.mode = 'move';
    return this.mode !== 'none';
  }
  pickJoint(f, x, y) {
    let best = 18 / this.sc, found = false;
    for (const inst of [...this.project.inst].reverse()) {
      const p = f.p[inst.id]; if (!p) continue;
      const t = inst.t, r = computeRig(t, p.a);
      const dr = Math.hypot(x - p.x, y - p.y);
      if (dr < best) { best = dr; found = true; this.mode = 'move'; this.dragInst = inst.id; }
      t.bones.forEach((b, i) => {
        if (!this.draggable(b)) return;
        const [wx, wy] = Xf.toWorld(p, r.ex[i], r.ey[i]), d = Math.hypot(x - wx, y - wy);
        if (d < best) { best = d; found = true; this.mode = 'bone'; this.dragInst = inst.id; this.dragBone = i; this.lastBone = i; this.lastInst = inst.id; }
      });
    }
    if (found) this.selected = this.dragInst;
    return found;
  }
  pickBody(f, x, y) {
    for (const inst of [...this.project.inst].reverse()) {
      const p = f.p[inst.id]; if (!p) continue;
      const b = this.worldBounds(inst, p);
      if (x >= b.l && x <= b.r && y >= b.t && y <= b.b) { this.selected = inst.id; return true; }
    }
    return false;
  }
}
function dot(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

// ---------- timeline: quadros (largura = tempo) + faixa de áudio ----------
class Timeline {
  constructor(ed) {
    this.ed = ed; this.scroll = 0; this.playFrame = -1; this.playT = -1; this.multi = new Set(); this.mode = 'none'; this.selClip = null;
    this.base = 38; this.perMs = 0.12; this.gap = 4; this.frameH = 64;
    this.s = new Surface((ctx, w, hh) => this.draw(ctx, w, hh));
    const el = this.s.el;
    el.addEventListener('pointerdown', e => this.down(e));
    el.addEventListener('pointermove', e => this.move(e));
    el.addEventListener('pointerup', e => this.up(e, false));
    el.addEventListener('pointercancel', e => this.up(e, true));
    this.ptrs = new Map(); this.stretchClip = null;
    // computador: clique duplo num bloco de áudio liga/desliga o modo ESTICAR (as pontas mudam a velocidade)
    el.addEventListener('dblclick', e => {
      const [x, y] = this.lx(e); if (y <= this.frameH) return;
      const c = this.clipAt(x); if (!c) return;
      this.stretchClip = this.stretchClip === c ? null : c; this.selClip = c; this.s.invalidate();
      toast(this.stretchClip ? 'Modo ESTICAR: arraste uma ponta do áudio para deixá-lo mais rápido ou mais lento' : 'Modo esticar desligado: as pontas voltam a cortar o áudio');
    });
    el.addEventListener('wheel', e => { e.preventDefault(); this.scroll += e.deltaY + e.deltaX; this.clamp(); this.s.invalidate(); }, { passive: false });
  }
  get fr() { return this.ed.project.frames; }
  width(d) { return this.base + d * this.perMs; }
  cellLeft(i) { let x = this.gap - this.scroll; for (let k = 0; k < i; k++) x += this.width(this.fr[k].d) + this.gap; return x; }
  cellAt(x) { for (let i = 0; i < this.fr.length; i++) { const l = this.cellLeft(i); if (x >= l && x <= l + this.width(this.fr[i].d)) return i; } return -1; }
  contentWidth() { return this.cellLeft(this.fr.length) + this.scroll + this.base; }
  clamp() { this.scroll = Math.max(0, Math.min(this.scroll, Math.max(0, this.contentWidth() - this.s.w))); }
  /** Tempo (ms) → posição x, seguindo os blocos (cada bloco ocupa o tempo daquele quadro). */
  timeToX(t) {
    let acc = 0, x = this.gap - this.scroll;
    for (const f of this.fr) { const w = this.width(f.d); if (t <= acc + f.d) return x + (t - acc) / f.d * w; acc += f.d; x += w + this.gap; }
    return x + (t - acc) * (this.base / DEFAULT_DUR);
  }
  xToTime(x) {
    let acc = 0, cx = this.gap - this.scroll;
    for (const f of this.fr) { const w = this.width(f.d); if (x <= cx + w + this.gap) return acc + Math.max(0, Math.min(1, (x - cx) / w)) * f.d; acc += f.d; cx += w + this.gap; }
    return acc + (x - cx) / (this.base / DEFAULT_DUR);
  }
  ensureVisible(i) {
    const l = this.cellLeft(i) + this.scroll, r = l + this.width(this.fr[i].d);
    if (l - this.scroll < 0) this.scroll = l - this.gap;
    if (r - this.scroll > this.s.w) this.scroll = r - this.s.w + this.base + this.gap;
    this.clamp(); this.s.invalidate();
  }
  draw(ctx, w, hh) {
    ctx.fillStyle = '#23232B'; ctx.fillRect(0, 0, w, hh);
    const fr = this.fr, top = 8, bot = this.frameH - 6;
    for (const i of [...this.multi]) if (i >= fr.length) this.multi.delete(i);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    let x = this.gap - this.scroll;
    fr.forEach((f, i) => {
      const cw = this.width(f.d);
      if (x + cw > 0 && x < w) {
        const marked = this.multi.has(i), sel = this.multi.size ? marked : i === this.ed.frame;
        ctx.fillStyle = i === this.playFrame ? '#FF9800' : marked ? '#8E24AA' : sel ? '#3D8FC7' : '#44444F';
        rrect(ctx, x, top, cw, bot - top, 6); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif'; ctx.fillText(String(i + 1), x + cw / 2, top + 21);
        ctx.font = '11px sans-serif'; ctx.fillText((f.d / 1000).toFixed(2).replace('.', ',') + 's', x + cw / 2, bot - 7);
        if (sel && !this.ed.stage.playing) { rrect(ctx, x + cw - 7, top + 10, 4, bot - top - 20, 2); ctx.fill(); }
        if (f.fx && f.fx.mb && i < fr.length - 1) { // marcador de transição (motion blur), como no editor de vídeo
          ctx.fillStyle = '#B388FF'; rrect(ctx, x + cw - 6, top - 6, this.gap + 12, 12, 3); ctx.fill();
          ctx.fillStyle = '#23232B'; ctx.font = 'bold 9px sans-serif'; ctx.fillText('MB', x + cw + this.gap / 2, top + 3);
        }
      }
      x += cw + this.gap;
    });
    ctx.fillStyle = '#7CC223'; rrect(ctx, x, top, this.base, bot - top, 6); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '26px sans-serif'; ctx.fillText('+', x + this.base / 2, (top + bot) / 2 + 9);
    // faixa de áudio
    const at = this.frameH, ab = hh - 4, mid = (at + ab) / 2;
    ctx.fillStyle = '#1b1b21'; ctx.fillRect(0, at, w, ab - at);
    const audio = this.ed.project.audio || [];
    if (!audio.length) { ctx.fillStyle = '#55555f'; ctx.textAlign = 'left'; ctx.font = '12px sans-serif'; ctx.fillText(T('🎵 Áudio: ☰ → ADICIONAR ÁUDIO'), 10, mid + 4); }
    for (const c of audio) {
      const x0 = this.timeToX(c.start), x1 = this.timeToX(c.start + c.dur);
      if (x1 < 0 || x0 > w) continue;
      const sel = c === this.selClip, str = c === this.stretchClip;
      ctx.fillStyle = sel ? '#1E88E5' : '#26607f'; rrect(ctx, x0, at + 2, Math.max(4, x1 - x0), ab - at - 4, 4); ctx.fill();
      if (sel) { // alças nas pontas: arraste para cortar (ou esticar, no modo esticar)
        ctx.fillStyle = str ? '#FF9800' : '#BBDEFB';
        rrect(ctx, x0, at + 2, 6, ab - at - 4, 3); ctx.fill(); rrect(ctx, Math.max(x0, x1 - 6), at + 2, 6, ab - at - 4, 3); ctx.fill();
      }
      ctx.strokeStyle = sel ? '#BBDEFB' : '#6fc3ee'; ctx.lineWidth = 1; ctx.beginPath();
      for (let px = Math.max(0, Math.floor(x0)); px < Math.min(w, x1); px += 2) {
        const amp = AudioEngine.clipPeak(c, this.xToTime(px)) * (c.gain ?? 1) * (ab - at - 8) / 2;
        ctx.moveTo(px, mid - amp); ctx.lineTo(px, mid + amp);
      }
      ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.font = '11px sans-serif';
      const rt = (c.rate || 1) !== 1 ? '  ' + T('(velocidade ' + Math.round(c.rate * 100) + '%)') : '';
      ctx.fillText((str ? '↔ ' : '') + c.name + rt, Math.max(x0 + 8, 4), at + 13);
    }
    // cursor de reprodução atravessando quadros e áudio
    if (this.playT >= 0) { const px = this.timeToX(this.playT); ctx.fillStyle = '#FF5252'; ctx.fillRect(px - 1, 0, 2, hh); }
    ctx.textAlign = 'right'; ctx.font = '10px sans-serif'; ctx.fillStyle = '#8A8A92';
    const info = this.multi.size ? `${this.multi.size} selecionados · arraste para mudar o tempo · segure para sair   ` : '';
    ctx.fillText((info ? T(info.trim()) + '   ' : '') + T('total ' + (totalMs(this.ed.project) / 1000).toFixed(2).replace('.', ',') + 's'), w - 6, 9);
  }
  lx(e) { const r = this.s.el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  clipAt(x) { for (const c of [...(this.ed.project.audio || [])].reverse()) if (x >= this.timeToX(c.start) && x <= this.timeToX(c.start + c.dur)) return c; return null; }
  down(e) {
    this.s.el.setPointerCapture(e.pointerId);
    if (this.ed.stage.playing) return;
    const [x, y] = this.lx(e);
    this.downX = x; this.lastX = x; this.moved = false; this.longFired = false; this.mode = 'scroll';
    clearTimeout(this.lp);
    if (y > this.frameH) { // faixa de áudio
      // dois dedos no áudio selecionado: pinça estica/encolhe (muda a velocidade)
      if (this.ptrs.size === 2 && this.selClip) {
        const [a, b] = [...this.ptrs.values()];
        this.mode = 'pinch'; this.pinch0 = Math.max(10, Math.abs(a[0] - b[0])); this.pinchScale = 1;
        this.snap(this.selClip); this.ed.beforeChange(); this.moved = true;
        return;
      }
      let c = this.clipAt(x);
      if (!c && this.selClip) { const sx0 = this.timeToX(this.selClip.start), sx1 = this.timeToX(this.selClip.start + this.selClip.dur); if (x > sx0 - 14 && x < sx1 + 14) c = this.selClip; }
      if (c !== this.stretchClip) this.stretchClip = null;
      this.selClip = c; this.s.invalidate();
      if (c) {
        const x0 = this.timeToX(c.start), x1 = this.timeToX(c.start + c.dur), edge = Math.max(8, Math.min(14, (x1 - x0) / 3));
        const str = c === this.stretchClip;
        this.mode = Math.abs(x - x0) <= edge ? (str ? 'stretchL' : 'trimL') : Math.abs(x - x1) <= edge ? (str ? 'stretchR' : 'trimR') : 'clip';
        this.clipStart = c.start; this.snap(c);
        if (this.mode === 'clip') this.lp = setTimeout(() => { this.longFired = true; this.ed.clipMenu(c); }, 500);
      }
      return;
    }
    const hit = this.cellAt(x);
    if (this.multi.size && hit >= 0 && this.multi.has(hit)) { this.mode = 'multi'; this.multiStart = this.fr.map(f => f.d); }
    else if (!this.multi.size) {
      const r = this.cellLeft(this.ed.frame) + this.width(this.fr[this.ed.frame].d);
      if (Math.abs(x - r) < 16) { this.mode = 'resize'; this.startDur = this.fr[this.ed.frame].d; this.ed.beforeChange(); }
    }
    if (this.mode !== 'resize' && hit >= 0) this.lp = setTimeout(() => {
      this.longFired = true;
      if (!this.multi.size) { this.multi.add(hit); this.ed.selectFrame(hit, false); } else this.multi.clear();
      if (navigator.vibrate) navigator.vibrate(30);
      this.s.invalidate();
    }, 450);
  }
  /** Guarda o estado do clipe no começo do gesto. */
  snap(c) { this.c0 = { start: c.start, dur: c.dur, off: c.off || 0, rate: c.rate || 1 }; }
  /** Edição do bloco de áudio: cortar as pontas, esticar (velocidade) e pinça. */
  clipEdit(x) {
    const c = this.selClip, o = this.c0; if (!c || !o) return;
    const src = AudioEngine.srcMs(c.aid) ?? (o.off + o.dur * o.rate);
    const dt = this.xToTime(x) - this.xToTime(this.downX), end0 = o.start + o.dur, MIN = 50;
    const q = v => Math.round(v / 10) * 10;
    if (this.mode === 'trimL') {
      const ns = Math.max(o.start - o.off / o.rate, 0, Math.min(end0 - MIN, q(o.start + dt)));
      c.start = ns; c.off = Math.max(0, o.off + (ns - o.start) * o.rate); c.dur = end0 - ns;
    } else if (this.mode === 'trimR') {
      const maxEnd = o.start + (src - o.off) / o.rate;
      c.dur = Math.max(MIN, Math.min(maxEnd, q(end0 + dt)) - o.start);
    } else {
      let nd = this.mode === 'stretchR' ? o.dur + dt : this.mode === 'stretchL' ? o.dur - dt : o.dur * this.pinchScale;
      const rate = Math.max(0.25, Math.min(4, o.rate * o.dur / Math.max(MIN, nd)));
      nd = q(o.dur * o.rate / rate);
      c.rate = Math.round(rate * 1000) / 1000; c.dur = nd;
      c.start = this.mode === 'stretchL' ? Math.max(0, end0 - nd) : o.start;
    }
    this.s.invalidate();
  }
  move(e) {
    if (this.ptrs.has(e.pointerId)) this.ptrs.set(e.pointerId, this.lx(e));
    if (this.mode === 'none' || this.ed.stage.playing) return;
    const [x] = this.lx(e);
    if (this.mode === 'pinch') {
      if (this.ptrs.size < 2) return;
      const [a, b] = [...this.ptrs.values()]; this.pinchScale = Math.max(10, Math.abs(a[0] - b[0])) / this.pinch0;
      return this.clipEdit(x);
    }
    if (Math.abs(x - this.downX) > 6) {
      if (!this.moved) { clearTimeout(this.lp); if ((this.mode === 'multi' || this.mode === 'clip' || /^(trim|stretch)/.test(this.mode)) && !this.longFired) this.ed.beforeChange(); }
      this.moved = true;
    }
    if (/^(trim|stretch)/.test(this.mode)) { if (this.moved) this.clipEdit(x); this.lastX = x; return; }
    const step = 40;
    if (this.mode === 'resize') {
      const d = this.startDur + (x - this.downX) / this.perMs;
      this.fr[this.ed.frame].d = Math.max(40, Math.min(4000, Math.round(d / step) * step)); this.s.invalidate();
    } else if (this.mode === 'multi' && this.moved && !this.longFired) {
      const delta = Math.round((x - this.downX) / this.perMs / Math.max(1, this.multi.size) / step) * step;
      for (const i of this.multi) if (i < this.fr.length) this.fr[i].d = Math.max(40, Math.min(4000, this.multiStart[i] + delta));
      this.s.invalidate();
    } else if (this.mode === 'clip' && this.moved && !this.longFired) {
      // move o clipe: o ponto sob o dedo acompanha o tempo da timeline (passo de 10 ms)
      const dt = this.xToTime(x) - this.xToTime(this.downX);
      this.selClip.start = Math.max(0, Math.round((this.clipStart + dt) / 10) * 10); this.s.invalidate();
    } else if (this.mode === 'scroll') { this.scroll -= x - this.lastX; this.clamp(); this.s.invalidate(); }
    this.lastX = x;
  }
  up(e, cancel) {
    this.ptrs.delete(e.pointerId);
    clearTimeout(this.lp);
    if (this.mode === 'pinch') { if (this.ptrs.size === 0) { this.mode = 'none'; this.ed.changed(); } return; }
    if (this.ed.stage.playing) { if (!cancel) this.ed.togglePlay(); return; }
    if (this.mode === 'none') return;
    if (this.longFired) { /* nada */ }
    else if (this.mode === 'resize' || (this.mode === 'multi' && this.moved) || ((this.mode === 'clip' || /^(trim|stretch)/.test(this.mode)) && this.moved)) this.ed.changed();
    else if (!this.moved && !cancel && !/^(clip|trim|stretch)/.test(this.mode)) this.tap(this.lx(e)[0]);
    this.mode = 'none';
  }
  tap(x) {
    if (this.multi.size) { const c = this.cellAt(x); if (c >= 0) { this.multi.has(c) ? this.multi.delete(c) : this.multi.add(c); } this.s.invalidate(); return; }
    const c = this.cellAt(x);
    if (c >= 0) return this.ed.selectFrame(c);
    const l = this.cellLeft(this.fr.length);
    if (x >= l && x <= l + this.base) { this.ed.selectFrame(this.fr.length - 1, false); this.ed.addFrame(); }
  }
}

// ---------- construtor de itens ----------
function openBuilder(t, isNew, back) { new Builder(t, isNew, back); }

class Builder {
  constructor(t, isNew, back) {
    this.t = t; this.originalName = isNew ? '' : t.name; this.back = back;
    Monet.setBanner(false); Analytics.screenView('builder');
    this.sel = -1; this.undoStack = []; this.redoStack = [];
    this.mode = 0; this.pointers = new Map();
    this.view = new Surface((ctx, w, hh) => this.draw(ctx, w, hh));
    this.view.onResize = () => this.fit();
    const el = this.view.el;
    el.style.flex = '1'; el.style.minWidth = '0';
    el.addEventListener('pointerdown', e => this.down(e));
    el.addEventListener('pointermove', e => this.move(e));
    el.addEventListener('pointerup', e => this.up(e));
    el.addEventListener('pointercancel', e => this.up(e));
    el.addEventListener('wheel', e => { e.preventDefault(); this.zoomAt(this.loc(e), Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
    const tabs = h('div', { cls: 'bar col scroll' },
      tool('☰', '', '#fff', () => this.menu()),
      h('div', { cls: 'tabbtn on' }, 'OSSOS'),
      h('div', { cls: 'tabbtn', onclick: () => this.paint(false) }, 'DESENHAR'),
      h('div', { cls: 'tabbtn', onclick: () => this.paint(true) }, 'EDITAR'),
      this.undoBtn = tool('↶', 'DESFAZER', 'var(--cyan)', () => this.undo()),
      this.redoBtn = tool('↷', 'REFAZER', 'var(--cyan)', () => this.redo()));
    const tools = h('div', { cls: 'panel col scroll', style: { width: '84px' } },
      tool('✚', 'NOVO', 'var(--green)', () => this.newBone()),
      tool('⚙', 'PROPR.', '#fff', () => this.props()),
      tool('🗑', 'EXCLUIR', 'var(--red)', () => this.deleteBone()),
      tool('▼', 'BAIXO', '#fff', () => this.z(-1)),
      tool('▲', 'CIMA', '#fff', () => this.z(1)));
    this.boneList = h('div', { cls: 'scroll', style: { flex: '1' } });
    const side = h('div', { cls: 'bone-list col' },
      h('div', { cls: 'btn', style: { background: 'var(--cyan)', height: '72px', margin: '6px', fontSize: '16px' }, onclick: () => this.newBone() }, '✚ NOVO\nOSSO'),
      this.boneList);
    $app().replaceChildren(tabs, tools, el, side);
    this.refresh();
  }
  /** DESENHAR: pincel/borracha/balde com camadas. EDITAR: importar imagem e recortar a parte. */
  paint(importFirst) {
    if (this.sel < 0) return toast('Selecione o osso (peça) que vai desenhar ou recortar');
    const bi = this.sel;
    Analytics.track('paint_open', { mode: importFirst ? 'cut' : 'draw' });
    new PaintEditor(this.t, bi, { importFirst, startTool: importFirst ? 'lasso' : 'brush', onSave: res => {
      this.beforeChange();
      const b = this.t.bones[bi];
      b.layers = res.layers; b.doc = res.doc;
      if (res.img) { b.img = res.img; b.ix = res.ix; b.iy = res.iy; b.s = Shape.IMAGE; }
      else { delete b.img; if (b.s === Shape.IMAGE) b.s = Shape.CAPSULE; }
      this.refresh(); toast('Desenho aplicado à peça');
    } });
  }
  fit() {
    const r = computeRig(this.t, restAngles(this.t)), bb = Renderer.bounds(this.t, r);
    const span = Math.max(420, (bb.r - bb.l) * 1.15, (bb.b - bb.t) * 1.15);
    this.sc = Math.min(this.view.w, this.view.h) / span;
    const big = span > 420;
    this.cx = this.view.w / 2 - (big ? (bb.l + bb.r) / 2 * this.sc : 0);
    this.cy = this.view.h / 2 - (big ? (bb.t + bb.b) / 2 * this.sc : 0);
  }
  beforeChange() { this.undoStack.push(JSON.stringify(this.t)); if (this.undoStack.length > 80) this.undoStack.shift(); this.redoStack = []; this.updBtns(); }
  restore(json) { const o = JSON.parse(json); Object.keys(this.t).forEach(k => delete this.t[k]); Object.assign(this.t, o); if (this.sel >= this.t.bones.length) this.sel = -1; this.refresh(); }
  undo() { if (!this.undoStack.length) return toast('Nada para desfazer'); this.redoStack.push(JSON.stringify(this.t)); this.restore(this.undoStack.pop()); }
  redo() { if (!this.redoStack.length) return toast('Nada para refazer'); this.undoStack.push(JSON.stringify(this.t)); this.restore(this.redoStack.pop()); }
  updBtns() { this.undoBtn.classList.toggle('off', !this.undoStack.length); this.redoBtn.classList.toggle('off', !this.redoStack.length); }
  refresh() {
    this.view.invalidate(); this.updBtns();
    this.boneList.replaceChildren(...this.t.bones.map((b, i) => {
      const one = { name: '', cat: '', bones: [Object.assign(clone(b), { p: -1, a: 0, ox: 0, oy: 0 })] };
      const c = thumb(one, 108, 56, i === this.sel ? '#B3E5FC' : '#fff');
      c.style.width = '100%'; c.onclick = () => { this.sel = i; this.refresh(); };
      return c;
    }));
  }
  newBone() {
    this.beforeChange();
    const c = this.sel >= 0 ? this.t.bones[this.sel].c : 0xFF9E9E9E;
    const z = Math.max(0, ...this.t.bones.map(b => b.z)) + 1;
    this.t.bones.push(bone(this.sel, this.sel >= 0 ? 0 : -90, 40, 12, c, Shape.CAPSULE, z));
    this.sel = this.t.bones.length - 1; this.refresh();
  }
  deleteBone() {
    if (this.sel < 0) return toast('Selecione um osso');
    if (this.t.bones.length <= 1) return toast('O item precisa de pelo menos 1 osso');
    this.beforeChange(); removeBone(this.t, this.sel); this.sel = -1; this.refresh();
  }
  z(d) { if (this.sel < 0) return toast('Selecione um osso'); this.beforeChange(); this.t.bones[this.sel].z += d; this.refresh(); }
  props() {
    if (this.sel < 0) return toast('Selecione um osso');
    const b = this.t.bones[this.sel];
    this.beforeChange();
    const colorBtn = h('button', { cls: 'mbtn', style: { background: css(b.c) }, onclick: () => pickColor('Cor do osso', c => { b.c = c; colorBtn.style.background = css(c); this.refresh(); }) }, 'Cor');
    const width = h('input', { type: 'range', min: 0, max: 120, value: b.w, style: { width: '100%' }, oninput: () => { b.w = +width.value; this.refresh(); } });
    const shapes = h('div', {}, SHAPE_NAMES.map((n, i) => h('label', { style: { marginRight: '10px' } },
      h('input', { type: 'radio', name: 'shape', checked: b.s === i, onchange: () => { b.s = i; this.refresh(); } }), n)));
    const sock = h('label', { style: { display: 'block', marginTop: '10px' } },
      h('input', { type: 'checkbox', checked: !!b.sk, onchange: e => { b.sk = e.target.checked; if (b.sk) delete b.fx; this.refresh(); } }),
      ' Ponto de encaixe (segura itens, ex.: mão)');
    const imgs = h('div', { style: { marginTop: '10px' } });
    const fillImgs = () => {
      imgs.replaceChildren(h('div', {}, `Imagens do osso: ${b.img ? stateCount(b) : 0}`));
      imgs.append(h('button', { cls: 'mbtn', onclick: () => this.pickImage(b, false, fillImgs) }, b.img ? 'Trocar imagem principal (arquivo)' : 'Escolher imagem (arquivo)'));
      if (b.img) imgs.append(h('button', { cls: 'mbtn', onclick: () => this.pickImage(b, true, fillImgs) }, '＋ Imagem alternativa'));
      if (b.img) imgs.append(h('button', { cls: 'mbtn', style: { background: 'var(--red)' }, onclick: () => {
        delete b.img; delete b.alts; delete b.layers; delete b.doc; if (b.s === Shape.IMAGE) b.s = Shape.CAPSULE; this.refresh(); fillImgs(); } }, 'Remover imagens'));
    };
    fillImgs();
    modal('Propriedades do osso', h('div', { style: { width: '360px' } }, colorBtn, h('div', { style: { marginTop: '12px' } }, 'Espessura'), width,
      h('div', { style: { marginTop: '8px' } }, 'Forma'), shapes, sock, imgs));
  }
  async pickImage(b, alt, done) {
    const [file] = await pickFiles({ accept: 'image/*' });
    if (!file) return;
    const src = await createImageBitmap(file);
    const w = Math.max(b.l, 40), k = Math.min(w / src.width, 1024 / src.height);
    const cw = Math.max(1, Math.round(src.width * k)), ch = Math.max(1, Math.round(src.height * k));
    const c = h('canvas', { width: cw, height: ch }); c.getContext('2d').drawImage(src, 0, 0, cw, ch);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const name = await Images.save(blob);
    this.beforeChange();
    if (alt && b.img) { b.alts = b.alts || []; b.alts.push({ img: name, x: 0, y: -ch / 2 }); }
    else { b.img = name; b.ix = 0; b.iy = -ch / 2; b.s = Shape.IMAGE; delete b.layers; delete b.doc; }
    this.refresh(); done && done();
    toast(alt ? 'Imagem alternativa adicionada' : 'Imagem adicionada ao osso');
  }
  menu() {
    choose('Menu', ['💾 Salvar item', (this.t.att ? '☑' : '☐') + ' Pode ser preso no corpo', '✖ Sair'], i => {
      if (i === 0) this.save();
      if (i === 1) { this.t.att = !this.t.att; toast(this.t.att ? 'A raiz do item se prende em pontos de encaixe' : 'O item não se prende mais'); }
      if (i === 2) modal('Sair do construtor?', h('div'), [['Cancelar', null], ['Sair', () => this.back()]]);
    });
  }
  save() {
    askText('Nome do item', this.t.name, async n => {
      this.t.name = n; await Store.saveItem(this.t, this.originalName); this.originalName = n; toast('Item salvo: ' + n);
      Analytics.track('item_save', { bones: this.t.bones.length, images: this.t.bones.filter(b => b.img).length });
    });
  }
  draw(ctx, w, hh) {
    const cell = 16; ctx.fillStyle = '#FAFAFA'; ctx.fillRect(0, 0, w, hh); ctx.fillStyle = '#EDEDED';
    for (let y = 0, row = 0; y < hh; y += cell, row++) for (let x = row % 2 ? cell : 0; x < w; x += cell * 2) ctx.fillRect(x, y, cell, cell);
    const t = this.t, r = computeRig(t, restAngles(t));
    ctx.save(); ctx.translate(this.cx, this.cy); ctx.scale(this.sc, this.sc);
    Renderer.draw(ctx, t, r, 0, this.sel);
    const rr = 6 / this.sc;
    ctx.strokeStyle = '#29B6F688'; ctx.lineWidth = 1.5 / this.sc;
    t.bones.forEach((_, i) => { ctx.beginPath(); ctx.moveTo(r.sx[i], r.sy[i]); ctx.lineTo(r.ex[i], r.ey[i]); ctx.stroke(); });
    ctx.fillStyle = '#FF9800'; t.bones.forEach((_, i) => dot(ctx, r.ex[i], r.ey[i], rr));
    ctx.fillStyle = '#7CC223'; t.bones.forEach((b, i) => { if (b.sk) dot(ctx, r.ex[i], r.ey[i], rr * 1.4); });
    if (this.sel >= 0 && this.sel < t.bones.length) { ctx.fillStyle = '#3D8FC7'; dot(ctx, r.sx[this.sel], r.sy[this.sel], rr * 1.3); }
    ctx.restore();
  }
  loc(e) { const r = this.view.el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  zoomAt([mx, my], k) {
    const fx = (mx - this.cx) / this.sc, fy = (my - this.cy) / this.sc;
    this.sc = Math.max(0.05, Math.min(40, this.sc * k)); this.cx = mx - fx * this.sc; this.cy = my - fy * this.sc; this.view.invalidate();
  }
  down(e) {
    this.view.el.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, this.loc(e));
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.mode = 3; this.pd = Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1])); this.psc = this.sc;
      this.pfx = ((a[0] + b[0]) / 2 - this.cx) / this.sc; this.pfy = ((a[1] + b[1]) / 2 - this.cy) / this.sc; return;
    }
    const [mx, my] = this.loc(e), x = (mx - this.cx) / this.sc, y = (my - this.cy) / this.sc;
    const t = this.t, r = computeRig(t, restAngles(t)), tol = 20 / this.sc;
    this.mode = 0;
    if (this.sel >= 0 && Math.hypot(x - r.sx[this.sel], y - r.sy[this.sel]) < tol) { this.mode = 2; this.bone = this.sel; }
    else { let best = tol; t.bones.forEach((_, i) => { const d = Math.hypot(x - r.ex[i], y - r.ey[i]); if (d < best) { best = d; this.bone = i; this.mode = 1; } }); }
    if (this.mode === 0) {
      let best = Infinity, hit = -1;
      t.bones.forEach((b, i) => { const d = Xf.distToSeg(x, y, r.sx[i], r.sy[i], r.ex[i], r.ey[i]) - b.w / 2; if (d < best && d < tol) { best = d; hit = i; } });
      this.sel = hit;
      if (hit < 0) { this.mode = 4; this.panX = mx; this.panY = my; }
    } else { this.sel = this.bone; this.beforeChange(); }
    this.refresh();
  }
  move(e) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, this.loc(e));
    if (this.mode === 3 && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      this.sc = Math.max(0.05, Math.min(40, this.psc * Math.hypot(a[0] - b[0], a[1] - b[1]) / this.pd));
      this.cx = (a[0] + b[0]) / 2 - this.pfx * this.sc; this.cy = (a[1] + b[1]) / 2 - this.pfy * this.sc; this.view.invalidate(); return;
    }
    const [mx, my] = this.loc(e);
    if (this.mode === 4) { this.cx += mx - this.panX; this.cy += my - this.panY; this.panX = mx; this.panY = my; this.view.invalidate(); return; }
    if (this.mode !== 1 && this.mode !== 2) return;
    const x = (mx - this.cx) / this.sc, y = (my - this.cy) / this.sc;
    const t = this.t, r = computeRig(t, restAngles(t)), b = t.bones[this.bone], pa = parentAbs(t, r, this.bone);
    if (this.mode === 1) {
      const dx = x - r.sx[this.bone], dy = y - r.sy[this.bone];
      b.l = Math.max(4, Math.hypot(dx, dy)); b.a = deg(Math.atan2(dy, dx) - pa);
    } else {
      const [px, py] = parentEnd(t, r, this.bone), dx = x - px, dy = y - py, c = Math.cos(-pa), s = Math.sin(-pa);
      b.ox = dx * c - dy * s; b.oy = dx * s + dy * c;
    }
    this.view.invalidate();
  }
  up(e) {
    this.pointers.delete(e.pointerId);
    if (this.mode === 3 && this.pointers.size) return;
    if (this.mode === 1 || this.mode === 2) this.refresh();
    this.mode = 0;
  }
}

// ---------- início ----------
(async () => {
  await DB.open();
  await Store.loadItems();
  await Monet.init(); Analytics.start(); Monet.refreshLicense(); initCloud();
  await showHome();
  const imp = new URLSearchParams(location.search).get('import'); // depuração: ?import=arquivo.atp
  if (imp) {
    const buf = await (await fetch(imp)).arrayBuffer();
    await runImport([new File([buf], imp.split('/').pop())]);
    showItems();
  }
})();
