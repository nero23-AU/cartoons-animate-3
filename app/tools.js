// Ferramentas: backup/restauração, limpeza de armazenamento e exportação (PNG / vídeo, com fundo transparente).
'use strict';

function download(blob, name) {
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
const fmtMB = b => (b / 1048576).toFixed(b < 10485760 ? 2 : 1).replace('.', ',') + ' MB';

// ---------- backup ----------
const Backup = {
  /** Gera um .zip com todos os itens, projetos, imagens e áudios. */
  async create(progress = () => {}) {
    const zip = new JSZip(), manifest = { app: 'cartoon-studio', version: 1, created: Date.now(), items: [], projects: [], images: [], audio: [] };
    for (const [k, v] of await DB.all('items')) manifest.items.push([k, v]);
    for (const [k, v] of await DB.all('projects')) manifest.projects.push([k, v]);
    for (const [k, v] of await DB.all('images')) { zip.file('images/' + k, v); manifest.images.push(k); }
    for (const [k, v] of await DB.all('audio')) { zip.file('audio/' + k, v); manifest.audio.push(k); }
    zip.file('manifest.json', JSON.stringify(manifest));
    return zip.generateAsync({ type: 'blob', compression: 'STORE' }, m => progress(Math.round(m.percent) + '%'));
  },
  /**
   * Restaura um backup. Primeiro lê e confere tudo; só grava depois que o arquivo inteiro estiver OK,
   * então um arquivo corrompido não estraga os dados atuais. Itens/projetos com o mesmo nome são substituídos.
   */
  async restore(file, progress = () => {}) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const mf = zip.file('manifest.json');
    if (!mf) throw new Error('não é um backup do Cartoon Studio');
    const m = JSON.parse(await mf.async('string'));
    if (m.app !== 'cartoon-studio') throw new Error('não é um backup do Cartoon Studio');
    const blobs = { images: [], audio: [] };
    for (const kind of ['images', 'audio']) for (const k of m[kind]) {
      const f = zip.file(kind + '/' + k); if (!f) throw new Error('backup incompleto: falta ' + k);
      blobs[kind].push([k, await f.async('blob')]);
      progress(`lendo ${kind === 'images' ? 'imagens' : 'áudios'}…`);
    }
    // conferência: toda imagem referenciada precisa existir no backup ou no aparelho
    const have = new Set([...m.images, ...(await DB.all('images')).map(([k]) => k)]);
    const missing = [...Storage.referencedImages(m.items.map(([, v]) => v), m.projects.map(([, v]) => v))].filter(k => !have.has(k));
    progress('gravando…');
    await new Promise((res, rej) => {
      const t = DB.db.transaction(DB.stores, 'readwrite');
      for (const [k, v] of blobs.images) t.objectStore('images').put(v, k);
      for (const [k, v] of blobs.audio) t.objectStore('audio').put(v, k);
      for (const [k, v] of m.items) t.objectStore('items').put(v, k);
      for (const [k, v] of m.projects) t.objectStore('projects').put(v, k);
      t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
    Images.cache.clear();
    await Store.loadItems();
    return { items: m.items.length, projects: m.projects.length, images: m.images.length, audio: m.audio.length, missing: missing.length };
  },
};

// ---------- armazenamento ----------
const Storage = {
  imgsOfTemplate(t, out) {
    for (const b of t.bones || []) {
      if (b.img) out.add(b.img);
      (b.alts || []).forEach(a => out.add(a.img));
      (b.layers || []).forEach(l => out.add(l.img));
    }
  },
  referencedImages(itemRecs, projRecs) {
    const out = new Set();
    itemRecs.forEach(r => Storage.imgsOfTemplate(r.t, out));
    projRecs.forEach(r => { r.p.inst.forEach(i => Storage.imgsOfTemplate(i.t, out)); if (r.p.bgImg) out.add(r.p.bgImg); r.p.frames.forEach(f => { if (f.bgImg) out.add(f.bgImg); }); });
    return out;
  },
  async report() {
    const items = await DB.all('items'), projects = await DB.all('projects'), images = await DB.all('images'), audio = await DB.all('audio');
    const size = v => v instanceof Blob ? v.size : JSON.stringify(v).length;
    const sum = l => l.reduce((s, [, v]) => s + size(v), 0);
    const refImg = Storage.referencedImages(items.map(([, v]) => v), projects.map(([, v]) => v));
    const refAud = new Set(); projects.forEach(([, r]) => (r.p.audio || []).forEach(c => refAud.add(c.aid)));
    const orphanImg = images.filter(([k]) => !refImg.has(k)), orphanAud = audio.filter(([k]) => !refAud.has(k));
    const emptyProj = projects.filter(([, r]) => !r.p.inst.length && !(r.p.audio || []).length);
    let quota = null; try { quota = navigator.storage && await navigator.storage.estimate(); } catch (e) { /* opcional */ }
    return {
      items: [items.length, sum(items)], projects: [projects.length, sum(projects)], images: [images.length, sum(images)], audio: [audio.length, sum(audio)],
      orphanImg, orphanAud, emptyProj, junk: sum(orphanImg) + sum(orphanAud) + sum(emptyProj), quota,
    };
  },
  async clean(rep) {
    const t = DB.db.transaction(['images', 'audio', 'projects'], 'readwrite');
    rep.orphanImg.forEach(([k]) => t.objectStore('images').delete(k));
    rep.orphanAud.forEach(([k]) => t.objectStore('audio').delete(k));
    rep.emptyProj.forEach(([k]) => t.objectStore('projects').delete(k));
    await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
    Images.cache.clear();
  },
};

function showStorage() {
  const body = h('div', { style: { width: '380px', whiteSpace: 'pre-line' } }, 'Calculando…');
  modal('Armazenamento', body, [['Fechar', null]]);
  Storage.report().then(rep => {
    const line = (l, [n, s]) => h('div', { cls: 'row', style: { justifyContent: 'space-between', padding: '4px 0' } }, h('span', {}, `${T(l)} (${n})`), h('b', {}, fmtMB(s)));
    const junkN = rep.orphanImg.length + rep.orphanAud.length + rep.emptyProj.length;
    body.replaceChildren(
      line('Projetos', rep.projects), line('Itens', rep.items), line('Imagens', rep.images), line('Áudios', rep.audio),
      rep.quota ? h('div', { style: { color: '#777', fontSize: '13px', marginTop: '6px' } }, `Usado no navegador: ${fmtMB(rep.quota.usage)} de ${fmtMB(rep.quota.quota)} disponíveis`) : null,
      h('hr'),
      h('div', {}, junkN
        ? `Arquivos inúteis: ${rep.orphanImg.length} imagem(ns) e ${rep.orphanAud.length} áudio(s) que nenhum item/projeto usa, ${rep.emptyProj.length} projeto(s) vazio(s).`
        : 'Nenhum arquivo inútil encontrado.'),
      junkN ? h('button', { cls: 'mbtn', style: { background: 'var(--red)' }, onclick: async e => {
        e.target.disabled = true; e.target.textContent = 'Limpando…';
        await Storage.clean(rep); toast('Liberado ' + fmtMB(rep.junk)); showStorage();
        document.querySelectorAll('.modal-bg')[0]?.remove();
      } }, `🧹 Limpar arquivos inúteis (${fmtMB(rep.junk)})`) : null,
      h('div', { style: { color: '#777', fontSize: '12px', marginTop: '8px' } }, 'Imagens iguais nunca são guardadas duas vezes (cada imagem é salva pelo conteúdo).'),
    );
  });
}

function showBackup() {
  const status = h('div', { style: { minHeight: '20px', color: '#555', marginTop: '6px' } });
  const close = modal('Backup', h('div', { style: { width: '360px' } },
    h('div', {}, 'Salve um arquivo com todos os seus projetos, itens, imagens e áudios. Use-o para restaurar depois de reinstalar o app ou para levar tudo para outro celular.'),
    h('button', { cls: 'mbtn', onclick: async () => {
      status.textContent = 'Criando backup…';
      const blob = await Backup.create(p => status.textContent = 'Criando backup… ' + p); Analytics.track('backup_create', { mb: +(blob.size / 1048576).toFixed(1) });
      const d = new Date(), name = `cartoon-studio-backup-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.zip`;
      download(blob, name); status.textContent = `Backup salvo (${fmtMB(blob.size)}): ${name}`;
    } }, '💾 Criar backup'),
    h('button', { cls: 'mbtn', style: { background: 'var(--green)' }, onclick: async () => {
      const [file] = await pickFiles({ accept: '.zip' }); if (!file) return;
      status.textContent = 'Restaurando…';
      try {
        const r = await Backup.restore(file, p => status.textContent = 'Restaurando… ' + p);
        status.textContent = `Restaurado: ${r.projects} projeto(s), ${r.items} item(ns), ${r.images} imagem(ns), ${r.audio} áudio(s).` + (r.missing ? ` Atenção: ${r.missing} imagem(ns) não estavam no backup.` : '');
        if (window.onBackupRestored) window.onBackupRestored();
      } catch (e) { status.textContent = 'Falha: ' + e.message + '. Nada foi alterado.'; }
    } }, '⤴ Restaurar backup'),
    status), [['Fechar', null]]);
  return close;
}

// ---------- salvar o arquivo exportado: onde o usuário quiser, galeria ou download ----------
/** No app Android: grava o arquivo em partes e usa o plugin nativo (galeria, "salvar em…", compartilhar). */
async function saveFileNative(n, blob, name) {
  const mime = blob.type || 'application/octet-stream', step = 512 * 1024;
  const wait = modal('Preparando arquivo…', h('div', {}, name), []);
  try {
    for (let o = 0; o < blob.size || o === 0; o += step) {
      const b64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1] || ''); fr.readAsDataURL(blob.slice(o, o + step)); });
      await n.fileWrite({ name, data: b64, append: o > 0 });
      if (blob.size === 0) break;
    }
  } finally { wait(); }
  const act = async (f, okMsg) => { try { const r = await f(); close(); if (okMsg) toast(okMsg(r)); } catch (e) { if (String(e.message) !== 'cancelled') toast('Não foi possível: ' + e.message); } };
  const close = modal('Exportação pronta', h('div', { style: { width: '340px' } },
    h('div', { style: { marginBottom: '8px' } }, `${name} · ${fmtMB(blob.size)}`),
    h('button', { cls: 'mbtn', style: { background: 'var(--green)' }, onclick: () => act(() => n.fileToGallery({ name, mime }), r => 'Salvo em ' + r.folder) }, mime.startsWith('video/') ? '🖼 Salvar na galeria' : '⬇ Salvar em Downloads'),
    h('button', { cls: 'mbtn', onclick: () => act(() => n.fileSaveAs({ name, mime }), () => 'Arquivo salvo') }, '📁 Salvar em… (escolher pasta)'),
    h('button', { cls: 'mbtn', style: { background: '#555' }, onclick: () => act(() => n.fileShare({ name, mime })) }, '📤 Compartilhar (WhatsApp, Drive, CapCut…)')),
    [['Fechar', null]]);
}

function saveFile(blob, name) {
  const nat = typeof NativeAds === 'function' && NativeAds();
  if (nat) { saveFile.last = { blob, name, native: true }; return saveFileNative(nat, blob, name); }
  const file = new File([blob], name, { type: blob.type });
  const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  const btns = [];
  if (window.showSaveFilePicker) btns.push(h('button', { cls: 'mbtn', onclick: async () => {
    try {
      const ext = name.split('.').pop();
      const hnd = await showSaveFilePicker({ suggestedName: name, types: [{ description: ext.toUpperCase(), accept: { [blob.type || 'application/octet-stream']: ['.' + ext] } }] });
      const w = await hnd.createWritable(); await w.write(blob); await w.close();
      close(); toast('Salvo: ' + hnd.name);
    } catch (e) { if (e.name !== 'AbortError') toast('Não foi possível salvar: ' + e.message); }
  } }, '📁 Salvar em… (escolher pasta)'));
  if (canShare) btns.push(h('button', { cls: 'mbtn', style: { background: 'var(--green)' }, onclick: async () => {
    try { await navigator.share({ files: [file], title: name }); close(); } catch (e) { if (e.name !== 'AbortError') toast('Não foi possível compartilhar: ' + e.message); }
  } }, '📤 Galeria / compartilhar (Fotos, Drive, WhatsApp…)'));
  btns.push(h('button', { cls: 'mbtn', style: { background: '#555' }, onclick: () => { download(blob, name); close(); toast('Baixado: ' + name); } }, '⬇ Baixar (pasta Downloads)'));
  const close = modal('Exportação pronta', h('div', { style: { width: '340px' } },
    h('div', { style: { marginBottom: '8px' } }, `${name} · ${fmtMB(blob.size)}`), ...btns), [['Fechar', null]]);
  saveFile.last = { blob, name, canShare, picker: !!window.showSaveFilePicker };
}

// ---------- exportação ----------
const Exporter = {
  /**
   * MP4 (H.264 + AAC/Opus) codificado quadro a quadro com WebCodecs: não depende de tempo real,
   * não pula quadros e não trava a tela.
   */
  async mp4(project, o, canvas, frameAt, n, cancelled, progress) {
    if (!window.VideoEncoder) throw new Error('este navegador não codifica MP4 (precisa de WebCodecs); use a sequência PNG');
    const w = canvas.width & ~1, hh = canvas.height & ~1;
    if (w !== canvas.width || hh !== canvas.height) { canvas.width = w; canvas.height = hh; }
    const bitrate = Math.round(w * hh * o.fps * 0.12);
    let vcfg = null;
    for (const codec of ['avc1.640033', 'avc1.640028', 'avc1.4d0028', 'avc1.42001f']) {
      const c = { codec, width: w, height: hh, bitrate, framerate: o.fps, avc: { format: 'avc' } };
      try { if ((await VideoEncoder.isConfigSupported(c)).supported) { vcfg = c; break; } } catch (e) { /* tenta o próximo */ }
    }
    if (!vcfg) throw new Error(`este aparelho não codifica H.264 em ${w}×${hh}; tente uma resolução menor`);
    // áudio: mistura todos os clipes offline (sem depender de tocar em tempo real)
    let mix = null, acfg = null, acodec = null;
    const clips = o.audio ? (project.audio || []) : [];
    if (clips.length && window.AudioEncoder) {
      const sr = 48000, len = Math.ceil(totalMs(project) / 1000 * sr);
      const off = new OfflineAudioContext(2, Math.max(1, len), sr);
      for (const c of clips) {
        const buf = await AudioEngine.buffer(c.aid); if (!buf) continue;
        AudioEngine.schedule(off, off.destination, c, buf, 0);
      }
      for (const [codec, mux] of [['mp4a.40.2', 'aac'], ['opus', 'opus']]) {
        const c = { codec, sampleRate: sr, numberOfChannels: 2, bitrate: 160000 };
        try { if ((await AudioEncoder.isConfigSupported(c)).supported) { acfg = c; acodec = mux; break; } } catch (e) { /* próximo */ }
      }
      if (acfg) { progress(0, 'Mixando áudio…'); mix = await off.startRendering(); }
    }
    const muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(), fastStart: 'in-memory',
      video: { codec: 'avc', width: w, height: hh, frameRate: o.fps },
      audio: mix ? { codec: acodec, numberOfChannels: 2, sampleRate: mix.sampleRate } : undefined,
    });
    let err = null;
    const venc = new VideoEncoder({ output: (ch, meta) => muxer.addVideoChunk(ch, meta), error: e => { err = e; } });
    venc.configure(vcfg);
    for (let i = 0; i < n; i++) {
      if (cancelled()) { venc.close(); return null; }
      if (err) throw err;
      frameAt(i);
      const fr = new VideoFrame(canvas, { timestamp: Math.round(i * 1e6 / o.fps), duration: Math.round(1e6 / o.fps) });
      venc.encode(fr, { keyFrame: i % (o.fps * 2) === 0 }); fr.close();
      progress(i / n * 0.9, `Codificando quadro ${i + 1} de ${n}`);
      // evita encher a memória, mas sem esperar para sempre: alguns codificadores só liberam com mais quadros
      for (let k = 0; venc.encodeQueueSize > 12 && k < 40; k++) await new Promise(r => setTimeout(r, 5));
      if (i % 3 === 0) await new Promise(r => setTimeout(r, 0));
    }
    await venc.flush(); venc.close();
    if (err) throw err;
    if (mix) {
      progress(0.92, 'Codificando áudio…');
      const aenc = new AudioEncoder({ output: (ch, meta) => muxer.addAudioChunk(ch, meta), error: e => { err = e; } });
      aenc.configure(acfg);
      const L = mix.getChannelData(0), R = mix.getChannelData(1), step = 4800;
      for (let k = 0; k < L.length; k += step) {
        const m = Math.min(step, L.length - k), data = new Float32Array(m * 2);
        data.set(L.subarray(k, k + m), 0); data.set(R.subarray(k, k + m), m);
        const ad = new AudioData({ format: 'f32-planar', sampleRate: mix.sampleRate, numberOfFrames: m, numberOfChannels: 2, timestamp: Math.round(k / mix.sampleRate * 1e6), data });
        aenc.encode(ad); ad.close();
      }
      await aenc.flush(); aenc.close();
      if (err) throw err;
    }
    progress(0.98, 'Finalizando…');
    muxer.finalize();
    return new Blob([muxer.target.buffer], { type: 'video/mp4' });
  },
  RES: [['640×360', 640], ['854×480', 854], ['1280×720 (HD)', 1280], ['1920×1080 (Full HD)', 1920], ['2560×1440 (2K)', 2560]],
  open(project) {
    const sel = (opts, v) => h('select', { style: { width: '100%', fontSize: '15px', padding: '6px' } }, opts.map(([l, val]) => h('option', { value: val, selected: val == v }, l)));
    const fmt = sel([['Vídeo MP4 (galeria, WhatsApp, CapCut…)', 'mp4'], ['Sequência PNG (.zip, com transparência)', 'png'], ['Vídeo WebM', 'webm']], 'mp4');
    const res = sel(Exporter.RES, 1280);
    const fps = sel([['12', 12], ['15', 15], ['24', 24], ['25', 25], ['30', 30], ['60', 60]], 24);
    const transp = h('input', { type: 'checkbox' });
    const noWm = h('input', { type: 'checkbox', checked: Monet.adsRemoved() });
    const withAudio = h('input', { type: 'checkbox', checked: true });
    const lab = (t, e) => h('div', { style: { marginTop: '10px' } }, h('div', { style: { fontSize: '13px', color: '#666' } }, t), e);
    const info = h('div', { style: { fontSize: '12px', color: '#777', marginTop: '8px' } });
    const upd = () => {
      const n = Math.max(1, Math.ceil(totalMs(project) / 1000 * fps.value));
      info.textContent = `${n} quadros de saída · ${(totalMs(project) / 1000).toFixed(2)} s` +
        (fmt.value === 'mp4' && transp.checked ? ' · MP4 não guarda transparência: o fundo sai com a cor do projeto (para transparência use PNG)' : '') +
        (fmt.value === 'webm' ? ' · o vídeo é gravado em tempo real' + (transp.checked ? ' · transparência no vídeo depende do navegador (VP9 com alfa); para garantir use PNG' : '') : '');
    };
    const lockInfo = h('div', { style: { fontSize: '12px', color: 'var(--purple)', marginTop: '6px' } });
    const updLock = () => {
      const o = { width: +res.value, fps: +fps.value, transparent: transp.checked, noWatermark: noWm.checked };
      lockInfo.textContent = Monet.needsReward(o) ? "🔒 Acima de 720p/30fps, fundo transparente ou sem marca d'água: assista a 1 vídeo para liberar nesta exportação." : '';
    };
    [fmt, fps, transp, res, noWm].forEach(e => e.addEventListener('change', () => { upd(); updLock(); })); upd(); updLock();
    modal('Exportar', h('div', { style: { width: '340px' } },
      lab('Formato', fmt), lab('Resolução', res), lab('FPS', fps),
      h('label', { style: { display: 'block', marginTop: '10px' } }, transp, ' Fundo transparente (canal alfa)'),
      h('label', { style: { display: 'block', marginTop: '6px' } }, noWm, " Sem marca d'água"),
      h('label', { style: { display: 'block', marginTop: '6px' } }, withAudio, ' Incluir áudio (só no vídeo)'), info, lockInfo),
      [['Cancelar', null], ['Exportar', async () => {
        const o = { fmt: fmt.value, width: +res.value, fps: +fps.value, transparent: transp.checked, audio: withAudio.checked, noWatermark: noWm.checked };
        if (Monet.needsReward(o)) {
          const ok = await Monet.offer('Exportação em alta qualidade', "Assista a um vídeo curto para exportar este vídeo em " + (o.width > 1280 ? (o.width === 1920 ? '1080p' : '2K') : '720p') + "/" + o.fps + "fps" + (o.transparent ? ', com fundo transparente' : '') + (o.noWatermark ? " e sem marca d'água" : '') + '.', 'export_hq');
          if (!ok) return;
          Analytics.track('unlock', { type: 'export_hq' });
        }
        Exporter.run(project, o);
      }]]);
  },
  async run(project, o) {
    const scale = o.width / W, cw = o.width, ch = Math.round(H * scale);
    const canvas = h('canvas', { width: cw, height: ch }), ctx = canvas.getContext('2d');
    const n = Math.max(1, Math.ceil(totalMs(project) / 1000 * o.fps));
    let cancel = false;
    const bar = h('div', { style: { height: '8px', background: 'var(--green)', width: '0%', transition: 'width .1s' } });
    const txt = h('div', { style: { marginTop: '8px' } }, 'Preparando…');
    const close = modal('Exportando', h('div', { style: { width: '320px' } }, h('div', { style: { background: '#eee', borderRadius: '4px', overflow: 'hidden' } }, bar), txt), [['Cancelar', () => { cancel = true; }]]);
    const watermark = !o.noWatermark && !Monet.adsRemoved();
    const t0 = performance.now();
    Analytics.track('export_start', { fmt: o.fmt, width: o.width, fps: o.fps, alpha: !!o.transparent, frames: n, watermark });
    const frameAt = i => {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cw, ch); ctx.setTransform(scale, 0, 0, scale, 0, 0);
      Scene.renderTime(ctx, project, Math.min(totalMs(project) - 0.001, i * 1000 / o.fps), { transparent: o.transparent && o.fmt !== 'mp4', samples: 12 });
      if (watermark) { // marca d'água discreta no canto
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const fs = Math.max(11, Math.round(ch * 0.028));
        ctx.font = `bold ${fs}px sans-serif`; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillText(CONFIG.appName, cw - fs * 0.6 + 1, ch - fs * 0.5 + 1);
        ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillText(CONFIG.appName, cw - fs * 0.6, ch - fs * 0.5);
      }
    };
    const finished = (blob, name) => {
      Analytics.track('export_done', { fmt: o.fmt, width: o.width, fps: o.fps, secs: Math.round((performance.now() - t0) / 1000), mb: +(blob.size / 1048576).toFixed(1) });
      saveFile(blob, name);
      // intersticial só depois de terminar, com o arquivo pronto na tela (pausa natural)
      setTimeout(() => Monet.interstitial('after_export'), 600);
    };
    const yieldUI = () => new Promise(r => setTimeout(r, 0));
    const base = (project.name || 'animacao').replace(/[^\wÀ-ÿ -]/g, '_');
    try {
      if (o.fmt === 'mp4') {
        const blob = await Exporter.mp4(project, o, canvas, frameAt, n, () => cancel, (k, msg) => { bar.style.width = (k * 100) + '%'; txt.textContent = msg; });
        if (cancel || !blob) return;
        close(); return finished(blob, `${base}_${canvas.width}x${canvas.height}_${o.fps}fps.mp4`);
      }
      if (o.fmt === 'png') {
        const zip = new JSZip();
        for (let i = 0; i < n && !cancel; i++) {
          frameAt(i);
          zip.file(`${base}_${String(i).padStart(5, '0')}.png`, await new Promise(r => canvas.toBlob(r, 'image/png')));
          bar.style.width = (i / n * 90) + '%'; txt.textContent = `Quadro ${i + 1} de ${n}`;
          if (i % 2 === 0) await yieldUI(); // não trava a tela
        }
        if (cancel) return;
        txt.textContent = 'Compactando…';
        const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' }, m => { bar.style.width = (90 + m.percent / 10) + '%'; });
        close(); return finished(blob, `${base}_png_${o.fps}fps.zip`);
      } else {
        const types = o.transparent ? ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'] : ['video/webm;codecs=vp9', 'video/webm'];
        const mime = types.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
        if (!mime) throw new Error('este navegador não grava vídeo; use a sequência PNG');
        const stream = canvas.captureStream(0), track = stream.getVideoTracks()[0];
        if (o.audio && (project.audio || []).length) {
          const ac = AudioEngine.ac(); const dest = ac.createMediaStreamDestination();
          AudioEngine.dest = dest; dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
        }
        const chunks = [], rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: Math.round(cw * ch * o.fps * 0.15) });
        rec.ondataavailable = e => e.data.size && chunks.push(e.data);
        const done = new Promise(r => rec.onstop = r);
        rec.start();
        if (AudioEngine.dest) await AudioEngine.play(project, 0);
        const t0 = performance.now();
        for (let i = 0; i < n && !cancel; i++) {
          frameAt(i); track.requestFrame && track.requestFrame();
          bar.style.width = (i / n * 100) + '%'; txt.textContent = `Gravando quadro ${i + 1} de ${n}`;
          const wait = t0 + (i + 1) * 1000 / o.fps - performance.now();
          await new Promise(r => setTimeout(r, Math.max(0, wait)));
        }
        rec.stop(); await done; AudioEngine.stop(); AudioEngine.dest = null;
        if (cancel) return;
        close(); return finished(new Blob(chunks, { type: 'video/webm' }), `${base}_${cw}x${ch}_${o.fps}fps.webm`);
      }
      close(); toast('Exportação concluída');
    } catch (e) {
      console.error(e); AudioEngine.dest = null; close(); Analytics.track('export_fail', { fmt: o.fmt, error: String(e.message).slice(0, 120) }); modal('Exportar', h('div', {}, 'Falha: ' + e.message));
    }
  },
};
