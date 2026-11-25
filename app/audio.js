// Áudio: clipes na linha do tempo (lip-sync / SFX), forma de onda e reprodução sincronizada.
'use strict';

const AudioEngine = {
  ctx: null, buffers: new Map(), peaks: new Map(), playing: [], loading: new Map(),
  ac() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); return this.ctx; },

  /** Guarda o arquivo de áudio e devolve um clipe para o projeto. */
  async addFile(file, startMs) {
    const blob = new Blob([await file.arrayBuffer()], { type: file.type || 'audio/mpeg' });
    const aid = (await hashBlob(blob)) + '.aud';
    if (!(await DB.get('audio', aid))) await DB.put('audio', aid, blob);
    const buf = await this.buffer(aid);
    if (!buf) throw new Error('formato de áudio não suportado');
    return { id: uid(), aid, name: file.name.replace(/\.[^.]+$/, ''), start: Math.max(0, Math.round(startMs)), dur: Math.round(buf.duration * 1000), gain: 1 };
  },
  buffer(aid) {
    if (this.buffers.has(aid)) return Promise.resolve(this.buffers.get(aid));
    if (this.loading.has(aid)) return this.loading.get(aid);
    const pr = (async () => {
      const blob = await DB.get('audio', aid);
      if (!blob) return null;
      try {
        const buf = await this.ac().decodeAudioData(await blob.arrayBuffer());
        this.buffers.set(aid, buf); this.peaks.set(aid, this.makePeaks(buf)); Images.onLoad();
        return buf;
      } catch (e) { console.warn('áudio inválido', aid, e); return null; }
    })();
    this.loading.set(aid, pr);
    return pr;
  },
  /** Pico de volume a cada 10 ms (para desenhar a forma de onda). */
  makePeaks(buf) {
    const data = buf.getChannelData(0), step = Math.max(1, Math.floor(buf.sampleRate / 100));
    const out = new Float32Array(Math.ceil(data.length / step));
    for (let i = 0; i < out.length; i++) {
      let m = 0; const e = Math.min(data.length, (i + 1) * step);
      for (let k = i * step; k < e; k++) { const v = Math.abs(data[k]); if (v > m) m = v; }
      out[i] = m;
    }
    return out;
  },
  peak(aid, ms) { const p = this.peaks.get(aid); if (!p) { this.buffer(aid); return 0; } const i = Math.floor(ms / 10); return i >= 0 && i < p.length ? p[i] : 0; },

  /** Toca os clipes a partir de fromMs (até toMs, se informado). */
  async play(project, fromMs, toMs = Infinity) {
    this.stop();
    const ac = this.ac(); if (ac.state === 'suspended') await ac.resume();
    const now = ac.currentTime + 0.02;
    for (const c of project.audio || []) {
      const buf = await this.buffer(c.aid); if (!buf) continue;
      const cEnd = c.start + buf.duration * 1000;
      if (cEnd <= fromMs || c.start >= toMs) continue;
      const src = ac.createBufferSource(); src.buffer = buf;
      const g = ac.createGain(); g.gain.value = c.gain ?? 1;
      src.connect(g).connect(this.dest || ac.destination);
      const when = now + Math.max(0, c.start - fromMs) / 1000;
      const offset = Math.max(0, fromMs - c.start) / 1000;
      const len = (Math.min(cEnd, toMs) - Math.max(c.start, fromMs)) / 1000;
      src.start(when, offset, len);
      this.playing.push(src);
    }
  },
  stop() { this.playing.forEach(s => { try { s.stop(); } catch (e) { /* já parou */ } }); this.playing = []; },
};
