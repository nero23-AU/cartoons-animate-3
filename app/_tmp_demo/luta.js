// Projeto "Demo Viking vs Gigante v06": 0–13 s (gancho + corrida/choque + sequência de golpes).
// Roda no console da página do app (localhost:8765). Salva o projeto e baixa o MP4.
window.__run = (async () => {
  const all = [...Store.items.values()];
  const tpl = n => { const x = all.find(x => (x.t || x).name === n); return clone(x.t || x); };
  const G = tpl('Guerreiro Bjorn'), A = tpl('Gigante Ragnvald'), AX = tpl('Machado Viking'), SH = tpl('Escudo Viking'), PO = tpl('Poeira'), BR = tpl('Brilho azul');
  const img = async n => Images.save(await (await fetch('/_tmp_demo/' + n)).blob());
  const BG = await img('floresta.png'), BGL = await img('floresta-laranja.png'), FIM = await img('tela-final.png');
  const pr = newProject(); pr.name = 'Demo Viking vs Gigante v06'; pr.bg = 0xFF1E2A1E; pr.bgImg = BG;
  const add = (t, o = {}) => { const id = pr.next++; pr.inst.push(Object.assign({ id, t }, o)); return id; };
  const sh = add(SH), g = add(G), a = add(A), ax = add(AX), po = add(PO), br = add(BR, { blend: 'lighter' }), br2 = add(BR, { blend: 'lighter' });
  const GY = 487, AY = 440;
  const pose = (t, x, y, d = {}, st = {}) => { const ang = restAngles(t).slice(); for (const k in d) ang[k] += d[k]; const s = t.bones.map(() => 0); for (const k in st) s[k] = st[k]; return { x, y, s: t.sc, r: 0, f: false, a: ang, st: s }; };
  const GS = { neutro: 1, bravo: 2, grito: 3, dor: 4, sorriso: 5, susto: 6 };
  const AS = { neutro: 1, bravo: 2, rosna: 3, ruge: 4, dor: 5, bravo2: 6, sorriso: 7, susto: 8 };
  const M = (...o) => Object.assign({}, ...o);
  // Guerreiro: 0 tronco 1 cabeça | 3,4 perna trás | 6,7 perna frente | 9,10 braço trás (escudo) | 12,13 braço frente (machado)
  // Gigante:   0 tronco 1 cabeça | 3,4,5 perna trás | 7,8,9 perna frente | 11,12,13 braço trás | 15,16,17 braço frente
  const guarda = { 0: 6, 3: 22, 4: 8, 6: -28, 7: 26, 9: -20, 10: -70, 12: -75, 13: -50 };
  const gig = d => M({ 3: -18, 4: 10, 7: 22, 8: -14 }, d);
  const solto = (t, x, y, s) => ({ x, y, s, r: 0, f: false, a: restAngles(t) });
  const naMao = (host, bone, s) => ({ x: 0, y: 0, s, r: 0, f: false, a: restAngles(BR), at: host, ab: bone, rl: 0 });
  const cam = (cx, cy, w) => { w = Math.min(1280, w); const hh = w * 9 / 16; return { x: Math.max(0, Math.min(1280 - w, cx - w / 2)), y: Math.max(0, Math.min(720 - hh, cy - hh / 2)), w }; };
  // efeitos ficam "guardados" encolhidos num lugar fixo, para nunca atravessarem a tela
  let poGuard = solto(PO, 690, 650, 0.001), brGuard = naMao(a, 17, 0.001), br2Guard = naMao(g, 13, 0.001);
  const F = (d, pg, pa, c, o = {}) => {
    const f = { d, p: { [g]: pg, [a]: pa }, cam: c };
    const maoAng = computeRig(G, pg.a).ab[13] * 180 / Math.PI;
    const rl = o.axAng !== undefined ? o.axAng - maoAng : (o.axRl ?? -60 - maoAng);
    f.p[ax] = { x: 0, y: 0, s: AX.sc, r: 0, f: false, a: restAngles(AX), at: g, ab: 13, rl };
    f.p[sh] = { x: 0, y: 0, s: o.shS ?? SH.sc, r: 0, f: false, a: restAngles(SH), at: g, ab: 10, rl: o.shRl ?? -20 };
    f.p[po] = o.po || poGuard; f.p[br] = o.br || brGuard; f.p[br2] = o.br2 || br2Guard;
    if (o.mb) f.fx = { mb: o.mb };
    if (o.bg) f.bgImg = o.bg;
    return f;
  };
  const fr = [];
  // ======== 0–5 s: gancho ========
  const impactoA = gig({ 0: -42, 1: 10, 15: 62, 16: -8, 3: -40, 4: 50, 7: 45, 8: -60 });
  const IX = 690, IY = 650;
  fr.push(F(300, pose(G, 400, GY, guarda, { 1: GS.bravo }), pose(A, 860, AY, gig({ 0: 4, 15: 165, 16: 20 }), { 1: AS.ruge }), cam(830, 300, 520), { br: naMao(a, 17, 0.35) }));
  fr.push(F(140, pose(G, 400, GY, guarda, { 1: GS.bravo }), pose(A, 850, AY + 8, gig({ 0: -18, 1: -6, 15: 120, 16: 10 }), { 1: AS.ruge }), cam(800, 370, 700), { mb: 1, br: naMao(a, 17, 0.5) }));
  fr.push(F(80, pose(G, 400, GY, guarda, { 1: GS.susto }), pose(A, 830, AY + 40, impactoA, { 1: AS.ruge }), cam(760, 430, 900), { po: solto(PO, IX, IY, 0.25), br: solto(BR, IX, IY - 20, 1.2) }));
  fr.push(F(80, pose(G, 330, GY - 40, { 0: -24, 1: -12, 3: 35, 4: 30, 6: 10, 7: 40, 9: -110, 10: -20, 12: -130, 13: -30 }, { 1: GS.dor }), pose(A, 830, AY + 40, impactoA, { 1: AS.ruge }), cam(735, 380, 1000), { mb: 0.8, po: solto(PO, IX + 10, IY - 8, 0.5), br: solto(BR, IX, IY - 30, 1.0) }));
  fr.push(F(80, pose(G, 270, GY - 20, { 0: -18, 1: -8, 3: 30, 4: 20, 6: 0, 7: 35, 9: -90, 10: -30, 12: -110, 13: -40 }, { 1: GS.dor }), pose(A, 830, AY + 36, impactoA, { 1: AS.rosna }), cam(640, 430, 1040), { po: solto(PO, IX + 20, IY - 14, 0.62), br: solto(BR, IX, IY - 30, 0.5) }));
  fr.push(F(160, pose(G, 240, GY - 5, { 0: -10, 1: -6, 3: 30, 4: 24, 6: -20, 7: 40, 9: -70, 10: -40, 12: -90, 13: -40 }, { 1: GS.dor }), pose(A, 835, AY + 30, gig({ 0: -32, 15: 55, 16: 0 }), { 1: AS.rosna }), cam(675, 395, 1100), { po: solto(PO, IX + 30, IY - 18, 0.66), br: solto(BR, IX, IY - 30, 0.15) }));
  fr.push(F(320, pose(G, 230, GY + 4, { 0: 4, 3: 30, 4: 25, 6: -40, 7: 45, 9: -30, 10: -70, 12: -60, 13: -40 }, { 1: GS.grito }), pose(A, 840, AY + 20, gig({ 0: -20, 15: 40, 16: 20 }), { 1: AS.rosna }), cam(640, 380, 1280), { po: solto(PO, IX + 40, IY - 20, 0.001) }));
  poGuard = solto(PO, IX + 40, IY - 20, 0.001);
  fr.push(F(700, pose(G, 300, GY, guarda, { 1: GS.bravo }), pose(A, 900, AY, gig({ 15: 30, 16: 40, 11: 15, 12: 30 }), { 1: AS.bravo }), cam(620, 400, 1280)));
  fr.push(F(500, pose(G, 310, GY, M(guarda, { 12: -150, 13: -30 }), { 1: GS.grito }), pose(A, 900, AY, gig({ 15: 30, 16: 40, 11: 15, 12: 30 }), { 1: AS.bravo2 }), cam(600, 420, 1150), { axAng: -130 }));
  fr.push(F(500, pose(G, 310, GY, M(guarda, { 12: -40, 13: -80 }), { 1: GS.bravo }), pose(A, 900, AY, gig({ 0: -6, 15: 40, 16: 60, 11: 25, 12: 40 }), { 1: AS.rosna }), cam(600, 420, 1080), { axAng: 30 }));
  fr.push(F(900, pose(G, 315, GY, guarda, { 1: GS.bravo }), pose(A, 890, AY + 6, gig({ 0: -12, 1: -6, 15: 50, 16: 70, 11: 30, 12: 50 }), { 1: AS.rosna }), cam(610, 420, 1000)));
  fr.push(F(1240, pose(G, 320, GY, guarda, { 1: GS.bravo }), pose(A, 885, AY + 6, gig({ 0: -14, 1: -8, 15: 55, 16: 75, 11: 32, 12: 52 }), { 1: AS.ruge }), cam(610, 420, 960), { br: naMao(a, 17, 0.3) }));

  // ======== 5–9 s: corrida e primeiro choque ========
  const corre1 = { 0: 22, 1: -10, 3: 50, 4: 40, 6: -60, 7: 20, 9: -60, 10: -50, 12: -20, 13: -60 };
  const corre2 = { 0: 22, 1: -10, 3: -40, 4: 60, 6: 30, 7: 50, 9: -20, 10: -70, 12: -70, 13: -40 };
  const gpasso1 = gig({ 0: -10, 3: 20, 4: 10, 7: -30, 8: 20, 15: 40, 16: 60, 11: 20, 12: 40 });
  const gpasso2 = gig({ 0: -10, 3: -30, 4: 30, 7: 20, 8: -10, 15: 40, 16: 60, 11: 20, 12: 40 });
  fr.push(F(220, pose(G, 360, GY - 6, corre1, { 1: GS.grito }), pose(A, 870, AY, gpasso1, { 1: AS.ruge }), cam(620, 410, 1150), { mb: 0.6 }));
  fr.push(F(220, pose(G, 430, GY - 14, corre2, { 1: GS.grito }), pose(A, 850, AY - 4, gpasso2, { 1: AS.ruge }), cam(640, 410, 1080), { mb: 0.6 }));
  fr.push(F(220, pose(G, 500, GY - 6, corre1, { 1: GS.grito }), pose(A, 830, AY, gpasso1, { 1: AS.ruge }), cam(660, 410, 1000), { mb: 0.6 }));
  fr.push(F(220, pose(G, 540, GY - 30, M(corre2, { 12: -170, 13: -40 }), { 1: GS.grito }), pose(A, 845, AY - 4, gig({ 0: -6, 15: 130, 16: 70, 11: 20, 12: 40 }), { 1: AS.bravo }), cam(680, 400, 900), { mb: 0.8, axAng: -150 }));
  // golpe de cima para baixo, gigante defende com o antebraço
  fr.push(F(120, pose(G, 560, GY - 40, { 0: 30, 1: -6, 3: 40, 4: 30, 6: -50, 7: 40, 9: -40, 10: -60, 12: -60, 13: -30 }, { 1: GS.grito }), pose(A, 840, AY, gig({ 0: -4, 15: 140, 16: 80, 11: 20, 12: 40 }), { 1: AS.rosna }), cam(700, 330, 700), { mb: 1, axAng: -20 }));
  // choque: faísca azul no ponto do encontro + tremor
  fr.push(F(80, pose(G, 570, GY - 34, { 0: 26, 1: -6, 3: 40, 4: 30, 6: -50, 7: 40, 9: -40, 10: -60, 12: -60, 13: -30 }, { 1: GS.grito }), pose(A, 845, AY + 6, gig({ 0: 4, 1: 8, 15: 135, 16: 85, 11: 20, 12: 40 }), { 1: AS.rosna }), cam(715, 320, 640), { axAng: -25, br2: naMao(g, 13, 0.6) }));
  fr.push(F(80, pose(G, 568, GY - 34, { 0: 26, 1: -6, 3: 40, 4: 30, 6: -50, 7: 40, 9: -40, 10: -60, 12: -60, 13: -30 }, { 1: GS.grito }), pose(A, 848, AY + 6, gig({ 0: 4, 1: 8, 15: 135, 16: 85, 11: 20, 12: 40 }), { 1: AS.rosna }), cam(690, 340, 660), { axAng: -25, br2: naMao(g, 13, 0.4) }));
  // forçam um contra o outro
  fr.push(F(900, pose(G, 572, GY - 20, { 0: 30, 1: -4, 3: 50, 4: 20, 6: -30, 7: 40, 9: -40, 10: -60, 12: -65, 13: -30 }, { 1: GS.bravo }), pose(A, 842, AY + 2, gig({ 0: -8, 1: -4, 15: 130, 16: 90, 11: 20, 12: 40, 3: -30, 4: 20 }), { 1: AS.bravo2 }), cam(705, 340, 760), { axAng: -30, br2: naMao(g, 13, 0.001) }));
  // gigante empurra, guerreiro recua
  fr.push(F(400, pose(G, 470, GY - 6, M(guarda, { 0: -6, 1: -6 }), { 1: GS.susto }), pose(A, 790, AY, gig({ 0: -24, 15: 70, 16: 10, 11: 40, 12: 20 }), { 1: AS.sorriso }), cam(640, 400, 1000), { mb: 0.6 }));
  fr.push(F(380, pose(G, 460, GY, guarda, { 1: GS.bravo }), pose(A, 790, AY, gig({ 0: -10, 15: 40, 16: 60, 11: 25, 12: 45 }), { 1: AS.sorriso }), cam(630, 410, 1040)));

  // ======== 9–13 s: sequência rápida de golpes (motion blur + zoom a cada golpe) ========
  const golpes = [
    // [d, pose G, expr G, pose A, expr A, cam, mb, ângulo do machado, faísca]
    [220, { 0: 20, 12: -160, 13: -20, 6: -40, 7: 30, 3: 30 }, GS.grito, gig({ 0: -8, 15: 120, 16: 80 }), AS.bravo, cam(650, 380, 820), 1, -150, 0],
    [110, { 0: 34, 12: 10, 13: 0, 6: -50, 7: 40, 3: 40 }, GS.grito, gig({ 0: 6, 1: 14, 15: 110, 16: 90 }), AS.dor, cam(690, 360, 700), 1, 10, 0.5],
    [220, M(guarda, { 9: -90, 10: -20 }), GS.bravo, gig({ 0: -30, 15: -10, 16: 0, 3: -30, 4: 20, 7: 30 }), AS.ruge, cam(620, 400, 900), 1, -70, 0],
    [110, M(guarda, { 0: -10, 9: -100, 10: -10 }), GS.dor, gig({ 0: -40, 15: -40, 16: 10, 3: -40, 4: 30, 7: 40 }), AS.ruge, cam(600, 380, 680), 1, -70, 0.4],
    [240, { 0: -20, 6: -100, 7: -20, 3: 10, 4: 0, 9: -40, 10: -60, 12: -90, 13: -40 }, GS.grito, gig({ 0: -10, 15: 40, 16: 60 }), AS.bravo2, cam(640, 420, 880), 1, -70, 0],
    [110, { 0: -24, 6: -110, 7: -10, 3: 10, 4: 0, 9: -40, 10: -60, 12: -90, 13: -40 }, GS.grito, gig({ 0: 16, 1: 16, 15: 70, 16: 30, 11: 40, 12: 20 }), AS.dor, cam(680, 400, 700), 1, -60, 0.5],
    [240, { 0: 26, 12: -150, 13: -60, 6: -40, 7: 30, 3: 30 }, GS.grito, gig({ 0: 12, 1: 10, 15: 60, 16: 40, 11: 50, 12: 30 }), AS.dor, cam(660, 390, 840), 1, -160, 0],
    [110, { 0: 36, 12: 30, 13: 10, 6: -50, 7: 40, 3: 40 }, GS.grito, gig({ 0: 22, 1: 18, 15: 30, 16: 20, 11: 60, 12: 20, 3: 10, 7: 30 }), AS.dor, cam(700, 370, 680), 1, 25, 0.6],
    [500, guarda, GS.sorriso, gig({ 0: 8, 1: 6, 15: 40, 16: 60, 11: 30, 12: 50 }), AS.rosna, cam(650, 410, 1000), 0, -60, 0],
  ];
  let gx = 470, axx = 820;
  const rodada = (lista, esc = 1) => { for (const [d, pg, eg, pa, ea, c, mb, axAng, fa] of lista) {
    if (fa) axx += 12; // cada golpe que acerta empurra o gigante
    fr.push(F(Math.round(d * esc), pose(G, gx, GY - (pg[6] < -90 ? 10 : 0), pg, { 1: eg }), pose(A, axx, AY, pa, { 1: ea }), c, { mb, axAng, br2: fa ? naMao(g, 13, fa) : naMao(g, 13, 0.001) }));
    gx += 8;
  } };
  rodada(golpes.slice(0, -1), 1.1);
  rodada(golpes.slice(0, -1), 1.1);
  const resto = 13000 - fr.reduce((s, f) => s + f.d, 0);
  fr.push(F(Math.max(300, resto), pose(G, gx, GY, guarda, { 1: GS.sorriso }), pose(A, axx, AY, gig({ 0: 8, 1: 6, 15: 40, 16: 60, 11: 30, 12: 50 }), { 1: AS.rosna }), cam(650, 410, 1000), { axAng: -60 }));

  // ======== 13–17 s: o gigante agarra e arremessa ========
  const R = (p, r, dy = 0) => Object.assign(p, { r, y: p.y + dy });
  const X0 = 600, A0 = 900;
  fr.push(F(300, pose(G, X0, GY, M(guarda, { 12: -150, 13: -40 }), { 1: GS.grito }), pose(A, A0 - 40, AY, gig({ 0: -20, 15: 80, 16: 20, 11: 60, 12: 10 }), { 1: AS.ruge }), cam(740, 400, 900), { mb: 0.6, axAng: -150 }));
  fr.push(F(200, pose(G, X0 + 10, GY, M(guarda, { 12: -110, 13: -20 }), { 1: GS.susto }), pose(A, A0 - 60, AY + 6, gig({ 0: -30, 15: 92, 16: 0, 11: 70, 12: 10 }), { 1: AS.sorriso }), cam(740, 380, 760), { axAng: -120 }));
  fr.push(F(300, R(pose(G, X0 + 60, GY - 150, { 0: 0, 3: 30, 4: 30, 6: 20, 7: 30, 12: -170, 13: 0, 9: -40, 10: -60 }, { 1: GS.susto }), -20), pose(A, A0 - 60, AY - 4, gig({ 0: -4, 1: -10, 15: 150, 16: 10, 11: 40, 12: 30 }), { 1: AS.ruge }), cam(760, 300, 900), { mb: 0.5, axAng: -90 }));
  fr.push(F(220, R(pose(G, X0 - 80, GY - 260, { 3: 50, 4: 40, 6: -30, 7: 60, 12: -120, 13: -30, 9: -120, 10: -20 }, { 1: GS.dor }), -160), pose(A, A0 - 50, AY + 10, gig({ 0: -40, 15: 40, 16: -10, 11: 60, 12: 0 }), { 1: AS.ruge }), cam(600, 330, 1150), { mb: 1, axAng: 40 }));
  fr.push(F(220, R(pose(G, 320, GY - 120, { 3: 60, 4: 50, 6: -40, 7: 70, 12: -100, 13: -40, 9: -100, 10: -30 }, { 1: GS.dor }), -300), pose(A, A0 - 50, AY + 6, gig({ 0: -24, 15: 30, 16: 20 }), { 1: AS.sorriso }), cam(520, 380, 1150), { mb: 1, axAng: 160 }));
  fr.push(F(160, R(pose(G, 250, GY + 60, { 0: 40, 3: 80, 4: 90, 6: 60, 7: 100, 12: -60, 13: -60, 9: -60, 10: -60 }, { 1: GS.dor }), -360), pose(A, A0 - 50, AY, gig({ 0: -14, 15: 30, 16: 40 }), { 1: AS.sorriso }), cam(470, 440, 1000), { mb: 0.6, axAng: 10, po: solto(PO, 260, 640, 0.35) }));
  fr.push(F(300, pose(G, 230, GY + 40, { 0: 30, 3: 70, 4: 80, 6: -10, 7: 90, 12: -60, 13: -40, 9: -40, 10: -60 }, { 1: GS.bravo }), pose(A, A0 - 50, AY, gig({ 0: -10, 15: 30, 16: 50 }), { 1: AS.sorriso }), cam(470, 430, 1000), { axAng: -40, po: solto(PO, 270, 640, 0.001) }));
  poGuard = solto(PO, 270, 640, 0.001);
  fr.push(F(500, pose(G, 260, GY, guarda, { 1: GS.bravo }), pose(A, A0 - 50, AY, gig({ 0: -10, 15: 30, 16: 50, 11: 20, 12: 40 }), { 1: AS.rosna }), cam(580, 410, 1200), { axAng: -60 }));
  fr.push(F(2080, pose(G, 270, GY, M(guarda, { 0: 2 }), { 1: GS.bravo }), pose(A, A0 - 60, AY, gig({ 0: -8, 15: 35, 16: 55, 11: 25, 12: 45 }), { 1: AS.bravo }), cam(590, 410, 1180), { axAng: -55 }));

  // ======== 17–21 s: soco carregado com brilho azul contra o escudo ========
  const carrega = s => naMao(a, 17, s);
  const escudoFrente = { 0: 10, 3: 30, 4: 10, 6: -30, 7: 30, 9: -100, 10: -10, 12: -60, 13: -60 };
  fr.push(F(600, pose(G, 290, GY, escudoFrente, { 1: GS.bravo }), pose(A, 800, AY, gig({ 0: 10, 1: -4, 15: -60, 16: 80, 11: 30, 12: 40 }), { 1: AS.ruge }), cam(800, 300, 640), { br: carrega(0.25), axAng: -50 }));
  fr.push(F(900, pose(G, 295, GY, escudoFrente, { 1: GS.susto }), pose(A, 790, AY, gig({ 0: 14, 1: -6, 15: -80, 16: 90, 11: 30, 12: 40 }), { 1: AS.ruge }), cam(780, 300, 560), { br: carrega(0.7), axAng: -50 }));
  fr.push(F(700, pose(G, 300, GY, escudoFrente, { 1: GS.bravo }), pose(A, 760, AY + 4, gig({ 0: 6, 15: -60, 16: 100, 11: 30, 12: 40, 3: -30, 4: 20 }), { 1: AS.ruge }), cam(560, 400, 1000), { br: carrega(0.9), axAng: -50 }));
  fr.push(F(160, pose(G, 300, GY, escudoFrente, { 1: GS.grito }), pose(A, 560, AY + 10, gig({ 0: -30, 15: 92, 16: 0, 3: -40, 4: 30, 7: 40, 8: -30 }), { 1: AS.ruge }), cam(440, 390, 820), { mb: 1, br: carrega(1.0), axAng: -50 }));
  fr.push(F(90, pose(G, 270, GY - 10, M(escudoFrente, { 0: -14 }), { 1: GS.dor }), pose(A, 545, AY + 10, gig({ 0: -32, 15: 92, 16: 0, 3: -40, 4: 30, 7: 40, 8: -30 }), { 1: AS.ruge }), cam(420, 370, 700), { br: solto(BR, 360, 360, 1.6), br2: naMao(g, 10, 0.8), axAng: -40 }));
  fr.push(F(90, pose(G, 230, GY - 20, M(escudoFrente, { 0: -24, 9: -140, 10: 0 }), { 1: GS.dor }), pose(A, 545, AY + 10, gig({ 0: -32, 15: 92, 16: 0, 3: -40, 4: 30, 7: 40, 8: -30 }), { 1: AS.sorriso }), cam(400, 390, 760), { shS: 0.001, br: solto(BR, 360, 360, 0.8), br2: naMao(g, 10, 0.001), po: solto(PO, 330, 380, 0.4), axAng: -20 }));
  fr.push(F(400, pose(G, 200, GY, M(guarda, { 0: -10, 9: -60, 10: -30 }), { 1: GS.susto }), pose(A, 560, AY, gig({ 0: -10, 15: 40, 16: 40, 11: 30, 12: 40 }), { 1: AS.sorriso }), cam(420, 400, 1000), { shS: 0.001, br: solto(BR, 360, 360, 0.001), po: solto(PO, 330, 380, 0.001), axAng: -60 }));
  poGuard = solto(PO, 330, 380, 0.001); brGuard = solto(BR, 360, 360, 0.001);
  fr.push(F(1060, pose(G, 205, GY, M(guarda, { 9: -40, 10: -60 }), { 1: GS.grito }), pose(A, 570, AY, gig({ 0: -6, 15: 30, 16: 50, 11: 20, 12: 40 }), { 1: AS.sorriso }), cam(420, 410, 1060), { shS: 0.001, axAng: -60 }));

  // ======== 21–25 s: golpe final (floresta fica laranja, câmera lenta) ========
  const sem = { shS: 0.001 };
  fr.push(F(300, pose(G, 230, GY + 20, { 0: 20, 3: 70, 4: 80, 6: -70, 7: 90, 12: -170, 13: -20, 9: -60, 10: -40 }, { 1: GS.grito }), pose(A, 580, AY, gig({ 0: -10, 15: 40, 16: 50 }), { 1: AS.susto }), cam(420, 400, 900), M(sem, { axAng: -150 })));
  fr.push(F(500, R(pose(G, 360, GY - 230, { 0: -10, 3: 60, 4: 60, 6: -60, 7: 80, 12: -200, 13: -20, 9: -120, 10: -20 }, { 1: GS.grito }), -15), pose(A, 590, AY, gig({ 0: 6, 1: -16, 15: 120, 16: 60 }), { 1: AS.susto }), cam(480, 300, 800), M(sem, { mb: 0.5, axAng: -170, bg: BGL })));
  fr.push(F(700, R(pose(G, 430, GY - 260, { 0: -14, 3: 60, 4: 60, 6: -60, 7: 80, 12: -210, 13: -10, 9: -120, 10: -20 }, { 1: GS.grito }), -10), pose(A, 595, AY, gig({ 0: 8, 1: -18, 15: 125, 16: 60 }), { 1: AS.susto }), cam(500, 280, 620), M(sem, { axAng: -175, bg: BGL, br2: naMao(g, 13, 0.4) })));
  fr.push(F(140, R(pose(G, 500, GY - 120, { 0: 30, 3: 40, 4: 30, 6: -40, 7: 50, 12: -40, 13: -20, 9: -60, 10: -40 }, { 1: GS.grito }), 10), pose(A, 600, AY + 10, gig({ 0: 10, 1: 10, 15: 120, 16: 60 }), { 1: AS.dor }), cam(560, 320, 700), M(sem, { mb: 1, axAng: 30, bg: BGL, br2: naMao(g, 13, 0.6) })));
  fr.push(F(100, R(pose(G, 505, GY - 100, { 0: 34, 3: 40, 4: 30, 6: -40, 7: 50, 12: -20, 13: -10, 9: -60, 10: -40 }, { 1: GS.grito }), 12), pose(A, 615, AY + 30, gig({ 0: 26, 1: 26, 15: 80, 16: 20, 3: 20, 7: 40 }), { 1: AS.dor }), cam(600, 330, 560), M(sem, { axAng: 50, bg: BGL, br: solto(BR, 600, 260, 2.2), br2: naMao(g, 13, 1.0) })));
  fr.push(F(100, R(pose(G, 505, GY - 100, { 0: 34, 3: 40, 4: 30, 6: -40, 7: 50, 12: -20, 13: -10, 9: -60, 10: -40 }, { 1: GS.grito }), 12), pose(A, 625, AY + 34, gig({ 0: 30, 1: 30, 15: 70, 16: 20, 3: 20, 7: 40 }), { 1: AS.dor }), cam(570, 350, 600), M(sem, { axAng: 50, bg: BGL, br: solto(BR, 600, 260, 1.6), br2: naMao(g, 13, 0.5) })));
  fr.push(F(1660, pose(G, 470, GY, M(guarda, { 0: 20, 12: -30, 13: -20 }), { 1: GS.grito }), pose(A, 660, AY + 40, gig({ 0: 40, 1: 30, 15: 40, 16: 20, 11: 60, 12: 20, 3: 30, 7: 50 }), { 1: AS.dor }), cam(580, 380, 900), M(sem, { axAng: 10, bg: BGL, br: solto(BR, 600, 260, 0.001), br2: naMao(g, 13, 0.001) })));
  brGuard = solto(BR, 600, 260, 0.001);

  // ======== 25–27,5 s: o gigante cai ========
  fr.push(F(500, pose(G, 460, GY, M(guarda, { 0: 10 }), { 1: GS.bravo }), R(pose(A, 720, AY + 40, gig({ 0: 30, 1: 30, 15: -20, 16: 10, 11: 120, 12: 10 }), { 1: AS.dor }), 30), cam(620, 400, 1000), M(sem, { mb: 0.6, axAng: -40, bg: BGL })));
  fr.push(F(400, pose(G, 460, GY, guarda, { 1: GS.bravo }), R(pose(A, 820, 600, gig({ 0: 10, 1: 20, 15: -60, 16: 0, 11: 140, 12: 0, 3: -30, 7: -40 }), { 1: AS.dor }), 85), cam(640, 420, 1100), M(sem, { mb: 0.8, axAng: -50, bg: BGL, po: solto(PO, 860, 640, 0.6) })));
  fr.push(F(1600, pose(G, 455, GY, M(guarda, { 0: 4, 9: -10, 10: -40 }), { 1: GS.sorriso }), R(pose(A, 822, 604, gig({ 0: 10, 1: 22, 15: -60, 16: 0, 11: 140, 12: 0, 3: -30, 7: -40 }), { 1: AS.dor }), 88), cam(600, 410, 1150), M(sem, { axAng: -60, bg: BGL, po: solto(PO, 880, 630, 0.001) })));

  // ======== 27,5–30 s: tela final ========
  const fora = t => Object.assign(pose(t, -3000, 0), { s: 0.001 });
  fr.push(F(30000 - fr.reduce((t, f) => t + f.d, 0), fora(G), fora(A), cam(640, 360, 1280), M(sem, { bg: FIM })));
  pr.frames = fr;
  await Store.saveProject(pr); window.__demo = pr;
  const fps = 30, w = 1280, h = 720, cv = document.createElement('canvas'); cv.width = w; cv.height = h; const ctx = cv.getContext('2d');
  const n = Math.round(totalMs(pr) / 1000 * fps);
  for (let i = 0; i < n; i += 5) Scene.renderTime(ctx, pr, i * 1000 / fps); await new Promise(r => setTimeout(r, 800));
  const blob = await Exporter.mp4(pr, { fps, audio: false }, cv, i => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h); Scene.renderTime(ctx, pr, i * 1000 / fps); }, n, () => false, () => {});
  const el = document.createElement('a'); el.href = URL.createObjectURL(blob); el.download = 'luta_v06.mp4'; document.body.appendChild(el); el.click();
  return JSON.stringify({ quadros: fr.length, n, ms: totalMs(pr), size: blob.size });
})()
