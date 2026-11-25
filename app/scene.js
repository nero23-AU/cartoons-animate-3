// Cena: itens presos, IK (ponta travada), interpolação por tempo, sombras, mesclagem e motion blur.
// Usado pelo palco, pela reprodução e pela exportação (mesmo resultado nos três).
'use strict';

const Scene = {
  BLENDS: [['source-over', 'Normal'], ['lighter', 'Add (Adicionar)'], ['multiply', 'Multiply (Multiplicar)'], ['screen', 'Screen (Tela)']],

  // ----- itens presos (encaixe) -----
  socketWorld(project, f, att, ab) {
    const pp = f.p[att], inst = instOf(project, att);
    if (!pp || !inst || ab < 0 || ab >= inst.t.bones.length) return null;
    const r = computeRig(inst.t, pp.a);
    const [ex, ey] = Xf.toWorld(pp, r.ex[ab], r.ey[ab]);
    const [dx, dy] = Xf.toWorld(pp, r.ex[ab] + Math.cos(r.ab[ab]), r.ey[ab] + Math.sin(r.ab[ab]));
    return { x: ex, y: ey, a: deg(Math.atan2(dy - ey, dx - ex)), f: pp.f };
  },
  resolve(project, f) {
    const seen = new Set();
    const one = (id, depth) => {
      const p = f.p[id];
      if (!p || (p.at ?? -1) < 0 || depth > 6 || seen.has(id)) return;
      seen.add(id); one(p.at, depth + 1);
      const s = Scene.socketWorld(project, f, p.at, p.ab); if (!s) return;
      p.x = s.x; p.y = s.y; p.f = s.f; p.r = p.f ? s.a - (p.rl || 0) - 180 : s.a + (p.rl || 0);
    };
    Object.keys(f.p).forEach(id => one(+id, 0));
  },
  relFor(p, s) { return p.f ? s.a - p.r - 180 : p.r - s.a; },

  // ----- IK: pontas travadas (p.pins = {osso: [x, y]} em coordenadas do palco) -----
  /** Ajusta os ossos acima de cada ponta travada (até 3 níveis) para ela continuar no lugar. */
  solveIK(project, f, id, skipBone = -1) {
    const p = f.p[id], inst = instOf(project, id);
    if (!p || !p.pins || !inst) return;
    const t = inst.t;
    for (const [k, target] of Object.entries(p.pins)) {
      const bi = +k; if (bi === skipBone || bi >= t.bones.length) continue;
      const [tx, ty] = Xf.toLocal(p, target[0], target[1]);
      const chain = []; let j = bi;
      while (j >= 0 && chain.length < 3) { if (!t.bones[j].fx || j === bi) chain.push(j); j = t.bones[j].p; }
      for (let it = 0; it < 12; it++) {
        for (const c of chain) {
          const r = computeRig(t, p.a);
          const ex = r.ex[bi], ey = r.ey[bi], sx = r.sx[c], sy = r.sy[c];
          let d = Math.atan2(ty - sy, tx - sx) - Math.atan2(ey - sy, ex - sx);
          while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
          p.a[c] += deg(d);
        }
        const r = computeRig(t, p.a);
        if (Math.hypot(r.ex[bi] - tx, r.ey[bi] - ty) < 0.5) break;
      }
    }
  },
  pinWorld(project, f, id, bi) {
    const p = f.p[id], inst = instOf(project, id);
    const r = computeRig(inst.t, p.a);
    return Xf.toWorld(p, r.ex[bi], r.ey[bi]);
  },

  // ----- tempo -----
  frameAt(project, t) {
    let acc = 0; const fr = project.frames;
    for (let i = 0; i < fr.length; i++) { acc += fr[i].d; if (t < acc) return i; }
    return fr.length - 1;
  },
  frameStart(project, i) { let s = 0; for (let k = 0; k < i; k++) s += project.frames[k].d; return s; },
  /** Quadro interpolado (suave) no tempo t, já com itens presos resolvidos. */
  frameAtTime(project, t) {
    const fr = project.frames, fi = Scene.frameAt(project, t), a = fr[fi];
    let out;
    if (fi === fr.length - 1) out = clone(a);
    else {
      const b = fr[fi + 1], u = Math.max(0, Math.min(1, (t - Scene.frameStart(project, fi)) / a.d)), k = u * u * (3 - 2 * u);
      const lerp = (x, y) => x + (y - x) * k;
      const lerpAng = (x, y) => { let d = (y - x) % 360; if (d > 180) d -= 360; if (d < -180) d += 360; return x + d * k; };
      out = { d: a.d, p: {} };
      for (const [id, pa] of Object.entries(a.p)) {
        const pb = b.p[id];
        if (!pb || pb.a.length !== pa.a.length || pb.f !== pa.f) { out.p[id] = clone(pa); continue; }
        const same = (pa.at ?? -1) === (pb.at ?? -1) && pa.ab === pb.ab;
        out.p[id] = { x: lerp(pa.x, pb.x), y: lerp(pa.y, pb.y), s: lerp(pa.s, pb.s), r: lerpAng(pa.r, pb.r), f: pa.f,
          a: pa.a.map((v, i) => lerpAng(v, pb.a[i])), at: pa.at, ab: pa.ab, rl: same ? lerpAng(pa.rl || 0, pb.rl || 0) : pa.rl, st: pa.st };
      }
    }
    Scene.resolve(project, out);
    return { fi, frame: out };
  },

  // ----- desenho de um quadro (com sombra e mesclagem) -----
  drawFrame(ctx, project, f, ghost = 0) {
    for (const inst of project.inst) {
      const p = f.p[inst.id]; if (!p) continue;
      const r = computeRig(inst.t, p.a);
      if (inst.shadow && !ghost) Scene.drawShadow(ctx, inst, p, r);
      ctx.save();
      if (inst.blend && !ghost) ctx.globalCompositeOperation = inst.blend;
      Xf.apply(ctx, p); Renderer.draw(ctx, inst.t, r, ghost, -1, p.st);
      ctx.restore();
    }
  },
  /** Sombra projetada no chão (base do item), acompanha a pose a cada quadro. */
  drawShadow(ctx, inst, p, r) {
    const b = Renderer.bounds(inst.t, r);
    let ground = -Infinity;
    for (const [lx, ly] of [[b.l, b.t], [b.r, b.t], [b.l, b.b], [b.r, b.b]]) ground = Math.max(ground, Xf.toWorld(p, lx, ly)[1]);
    const skew = -0.7, squash = 0.32;
    ctx.save();
    ctx.transform(1, 0, skew, -squash, -skew * ground, ground * (1 + squash));
    ctx.globalAlpha = 0.3;
    ctx.filter = 'blur(3px)';
    Xf.apply(ctx, p);
    Renderer.shadow = true;
    Renderer.draw(ctx, inst.t, r, 0xFF000000, -1, p.st);
    Renderer.shadow = false;
    ctx.restore();
  },

  /**
   * Desenha a cena no tempo t (em coordenadas do palco 1280x720).
   * Motion blur: se o quadro tiver fx.mb (0..1), a transição até o próximo é desenhada com
   * várias amostras de tempo sobrepostas, como um efeito de transição de editor de vídeo.
   */
  renderTime(ctx, project, t, { transparent = false, samples = 6 } = {}) {
    if (!transparent) { ctx.fillStyle = css(project.bg); ctx.fillRect(0, 0, W, H); }
    const fi = Scene.frameAt(project, t), fx = project.frames[fi].fx;
    if (!fx || !fx.mb || fi === project.frames.length - 1) {
      const { frame } = Scene.frameAtTime(project, t);
      Scene.drawFrame(ctx, project, frame);
      return fi;
    }
    const start = Scene.frameStart(project, fi), dur = project.frames[fi].d;
    const win = dur * Math.min(1, fx.mb) * 0.6; // janela de tempo do borrão
    const acc = Scene._buf(ctx.canvas.width, ctx.canvas.height, 'acc'), tmp = Scene._buf(ctx.canvas.width, ctx.canvas.height, 'tmp');
    const a = acc.getContext('2d'), m = tmp.getContext('2d');
    a.setTransform(1, 0, 0, 1, 0, 0); a.clearRect(0, 0, acc.width, acc.height);
    const tf = ctx.getTransform();
    for (let k = 0; k < samples; k++) {
      const ts = Math.max(start, t - win * (k / Math.max(1, samples - 1)));
      m.setTransform(1, 0, 0, 1, 0, 0); m.clearRect(0, 0, tmp.width, tmp.height); m.setTransform(tf);
      Scene.drawFrame(m, project, Scene.frameAtTime(project, ts).frame);
      a.globalAlpha = 1 / (k + 1); a.drawImage(tmp, 0, 0);
    }
    a.globalAlpha = 1;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(acc, 0, 0); ctx.restore();
    return fi;
  },
  _bufs: {},
  _buf(w, h, k) {
    let c = Scene._bufs[k];
    if (!c) c = Scene._bufs[k] = document.createElement('canvas');
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return c;
  },
};
