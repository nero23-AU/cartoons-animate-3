// Conta (e-mail + senha) e nuvem: salva as animações no Supabase e confere a compra "Sem anúncios" pelo e-mail da conta.
// Senhas: quem guarda e faz o hash (bcrypt) é o Supabase Auth; o app nunca guarda a senha.
'use strict';

const Auth = {
  KEY: 'ca3.session',
  session: null, // { access_token, refresh_token, expires_at (s), user: { id, email } }
  base() { return CONFIG.supabaseUrl + '/auth/v1'; },
  enabled() { return !!(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey); },
  MAX_AGE: 30 * 864e5, // depois de 30 dias a pessoa precisa entrar de novo
  load() {
    try { this.session = JSON.parse(localStorage.getItem(this.KEY)); } catch (e) { this.session = null; }
    if (this.session && !(Date.now() - (this.session.login_at || 0) < this.MAX_AGE)) this.store(null);
  },
  store(s) {
    const login_at = (this.session && this.session.user && s && s.user && this.session.user.id === s.user.id && this.session.login_at) || Date.now();
    this.session = s ? { login_at, access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600), user: { id: s.user.id, email: s.user.email } } : null;
    try { s ? localStorage.setItem(this.KEY, JSON.stringify(this.session)) : localStorage.removeItem(this.KEY); } catch (e) { }
  },
  user() { return this.session && this.session.user; },
  async call(path, body, token) {
    const r = await fetch(this.base() + path, { method: 'POST', headers: { apikey: CONFIG.supabaseAnonKey, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body || {}) });
    let j = {}; try { j = await r.json(); } catch (e) { }
    if (!r.ok) { const err = new Error(j.msg || j.error_description || j.message || ('erro ' + r.status)); err.status = r.status; err.code = j.error_code || j.code; throw err; }
    return j;
  },
  validEmail: e => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(e) && e.length <= 254,
  check(email, pass) {
    if (!this.validEmail(email)) throw new Error('Digite um e-mail válido.');
    if (pass !== undefined && (pass.length < 8 || pass.length > 72)) throw new Error('A senha precisa de pelo menos 8 caracteres.');
  },
  async signIn(email, pass) {
    this.check(email, pass);
    try { this.store(await this.call('/token?grant_type=password', { email, password: pass })); }
    catch (e) { throw new Error(e.status === 429 ? 'Muitas tentativas. Espere um pouco e tente de novo.' : e.status === 400 ? 'E-mail ou senha incorretos.' : e.message); }
    Analytics.track('auth_login');
  },
  async signUp(email, pass) {
    this.check(email, pass);
    try { await this.call('/signup', { email, password: pass, options: { emailRedirectTo: this.appUrl() } }); }
    catch (e) { throw new Error(e.status === 429 ? 'Muitas tentativas. Espere um pouco e tente de novo.' : e.message); }
    Analytics.track('auth_signup');
  },
  async recover(email) {
    this.check(email);
    try { await fetch(this.base() + '/recover?redirect_to=' + encodeURIComponent(this.appUrl()), { method: 'POST', headers: { apikey: CONFIG.supabaseAnonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }); }
    catch (e) { /* responde igual, sem revelar se o e-mail existe */ }
  },
  async signOut() {
    const s = this.session; this.store(null);
    if (s) try { await this.call('/logout', {}, s.access_token); } catch (e) { /* sessão já expirou */ }
  },
  appUrl() { return location.origin + location.pathname; },
  /** Token válido (renova sozinho quando faltar menos de 1 min). */
  async token() {
    if (!this.session) return null;
    if (this.session.expires_at - 60 > Date.now() / 1000) return this.session.access_token;
    try { this.store(await this.call('/token?grant_type=refresh_token', { refresh_token: this.session.refresh_token })); return this.session.access_token; }
    catch (e) { if (e.status >= 400 && e.status < 500) this.store(null); return null; } // sessão expirada: precisa entrar de novo
  },
  /** Volta do link do e-mail (confirmação ou troca de senha): o token vem no endereço (#access_token=…). */
  async fromUrl() {
    if (!location.hash.includes('access_token=')) return null;
    const q = new URLSearchParams(location.hash.slice(1));
    history.replaceState(null, '', location.pathname + location.search); // tira o token da barra de endereço
    const at = q.get('access_token'), rt = q.get('refresh_token'), type = q.get('type');
    if (!at || !rt) return null;
    const r = await fetch(this.base() + '/user', { headers: { apikey: CONFIG.supabaseAnonKey, Authorization: 'Bearer ' + at } });
    if (!r.ok) return null;
    const user = await r.json();
    this.store({ access_token: at, refresh_token: rt, expires_in: +q.get('expires_in') || 3600, user });
    return type;
  },
  async setPassword(pass) {
    if (pass.length < 8 || pass.length > 72) throw new Error('A senha precisa de pelo menos 8 caracteres.');
    const t = await this.token(); if (!t) throw new Error('Sem conexão com o servidor.');
    const r = await fetch(this.base() + '/user', { method: 'PUT', headers: { apikey: CONFIG.supabaseAnonKey, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pass }) });
    if (!r.ok) throw new Error('Falha: ' + r.status);
  },
};

const Cloud = {
  BUCKET: 'user-files', MAX_PROJECT: 8e6, MAX_FILE: 25e6,
  auto() { return LS.get('cloudAuto', true); },
  async req(path, opt = {}) {
    const t = await Auth.token(); if (!t) throw new Error('Sem conexão com o servidor.');
    const r = await fetch(CONFIG.supabaseUrl + path, { ...opt, headers: { apikey: CONFIG.supabaseAnonKey, Authorization: 'Bearer ' + t, ...(opt.headers || {}) } });
    if (!r.ok && r.status !== 409) { const e = new Error('servidor ' + r.status); e.status = r.status; throw e; }
    return r;
  },
  /** Arquivos (imagens e áudios) que o projeto usa. */
  files(p) {
    const img = new Set(), aud = new Set();
    p.inst.forEach(i => Storage.imgsOfTemplate(i.t, img));
    if (p.bgImg) img.add(p.bgImg);
    p.frames.forEach(f => { if (f.bgImg) img.add(f.bgImg); });
    (p.audio || []).forEach(c => aud.add(c.aid));
    return [...[...img].map(k => ['images', k]), ...[...aud].map(k => ['audio', k])];
  },
  safeName: k => /^[A-Za-z0-9._-]{4,80}$/.test(k),
  async upload(p) {
    const uid = Auth.user().id, done = new Set(LS.get('cloudFiles.' + uid, []));
    for (const [store, k] of this.files(p)) {
      if (done.has(k) || !this.safeName(k)) continue;
      const blob = await DB.get(store, k); if (!blob || blob.size > this.MAX_FILE) continue;
      await this.req(`/storage/v1/object/${this.BUCKET}/${uid}/${k}`, { method: 'POST', headers: { 'Content-Type': blob.type || 'application/octet-stream', 'x-upsert': 'false' }, body: blob });
      done.add(k); LS.set('cloudFiles.' + uid, [...done]);
    }
    const data = JSON.stringify(p);
    if (data.length > this.MAX_PROJECT) throw new Error('projeto grande demais para a nuvem');
    await this.req('/rest/v1/cloud_projects?on_conflict=user_id,id', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ id: p.id, name: String(p.name || '').slice(0, 120), data: p, updated_at: new Date(LS.get('ptime.' + p.id, Date.now())).toISOString() }),
    });
  },
  async download(row) {
    const uid = Auth.user().id, p = row.data;
    if (!p || !Array.isArray(p.frames) || !Array.isArray(p.inst)) return false;
    for (const [store, k] of this.files(p)) {
      if (!this.safeName(k) || await DB.get(store, k)) continue;
      const r = await this.req(`/storage/v1/object/authenticated/${this.BUCKET}/${uid}/${k}`);
      if (r.ok) await DB.put(store, k, await r.blob());
    }
    p.id = row.id;
    await DB.put('projects', p.id, { p, time: Date.parse(row.updated_at) || Date.now() });
    return true;
  },
  /** Envia o que mudou aqui e baixa o que é mais novo na nuvem. */
  async sync() {
    if (!Auth.user()) return { up: 0, down: 0 };
    const r = await this.req('/rest/v1/cloud_projects?select=id,updated_at');
    const remote = new Map((await r.json()).map(x => [x.id, Date.parse(x.updated_at)]));
    const local = await DB.all('projects');
    let up = 0, down = 0;
    for (const [id, rec] of local) {
      const rt = remote.get(id);
      if (rt === undefined || rec.time > rt + 1000) { LS.set('ptime.' + id, rec.time); await this.upload(rec.p); up++; }
    }
    const lt = new Map(local.map(([id, rec]) => [id, rec.time]));
    const want = [...remote].filter(([id, t]) => !lt.has(id) || t > lt.get(id) + 1000).map(([id]) => id);
    for (let i = 0; i < want.length; i += 20) {
      const ids = want.slice(i, i + 20).map(x => encodeURIComponent(x)).join(',');
      const rows = await (await this.req(`/rest/v1/cloud_projects?select=id,data,updated_at&id=in.(${ids})`)).json();
      for (const row of rows) if (await this.download(row)) down++;
    }
    LS.set('lastSync', Date.now());
    return { up, down };
  },
  /** Depois de salvar no editor: envia este projeto (com espera, para não enviar a cada toque). */
  queue(p) {
    if (!Auth.user() || !this.auto()) return;
    clearTimeout(this.qt);
    this.qt = setTimeout(async () => {
      try { const rec = await DB.get('projects', p.id); LS.set('ptime.' + p.id, rec ? rec.time : Date.now()); await this.upload(p); if (Editor.current && Editor.current.saveLabel) Editor.current.saveLabel.textContent = T('Salvo na nuvem ☁'); }
      catch (e) { console.warn('nuvem', e.message); }
    }, 6000);
  },
  async remove(id) {
    if (!Auth.user()) return;
    try { await this.req('/rest/v1/cloud_projects?id=eq.' + encodeURIComponent(id), { method: 'DELETE' }); } catch (e) { console.warn('nuvem', e.message); }
  },
  /** Compra "Sem anúncios" feita no Gumroad com o e-mail desta conta. */
  async checkPurchase(silent) {
    if (!Auth.user()) return false;
    try {
      const r = await this.req('/rest/v1/rpc/my_license', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const ok = (await r.json()) === true;
      if (ok && !Monet.adsRemoved()) { LS.set('license', { at: Date.now(), via: 'account' }); Monet.applyBanner(); toast('Sua compra "Sem anúncios" foi encontrada e liberada ✓', 4000); Analytics.track('purchase_account'); }
      else if (!ok && !silent) toast('Nenhuma compra encontrada para este e-mail.');
      return ok;
    } catch (e) { if (!silent) toast('Sem conexão com o servidor.'); return false; }
  },
};

/** Tela da conta: entrar / criar conta / nuvem / compra. */
function showAccount() {
  if (!Auth.enabled()) return;
  const u = Auth.user();
  if (!u) {
    const email = h('input', { type: 'email', placeholder: 'e-mail', autocomplete: 'email', maxLength: 254 });
    const pass = h('input', { type: 'password', placeholder: 'senha (mínimo 8 caracteres)', autocomplete: 'current-password', maxLength: 72, style: { marginTop: '8px' } });
    const msg = h('div', { style: { fontSize: '13px', color: '#c62828', minHeight: '18px', marginTop: '6px' } });
    const busy = async fn => { msg.textContent = ''; try { await fn(); } catch (e) { msg.textContent = T(e.message); } };
    let close;
    const go = () => busy(async () => { await Auth.signIn(email.value.trim(), pass.value); close(); afterLogin(); });
    pass.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    close = modal('Conta', h('div', { style: { width: '320px' } },
      h('div', { style: { fontSize: '13px', color: '#666', marginBottom: '10px' } }, 'Entre para salvar suas animações na nuvem e liberar a versão sem anúncios comprada com este e-mail.'),
      email, pass, msg,
      h('button', { cls: 'mbtn', style: { background: 'var(--green)' }, onclick: go }, 'Entrar'),
      h('button', { cls: 'mbtn', style: { background: '#3D8FC7' }, onclick: () => busy(async () => { await Auth.signUp(email.value.trim(), pass.value); msg.style.color = '#2e7d32'; msg.textContent = T('Conta criada! Confirme pelo link enviado ao seu e-mail e depois entre.'); }) }, 'Criar conta'),
      h('div', { style: { textAlign: 'center', marginTop: '8px' } }, h('a', { href: '#', style: { fontSize: '13px' }, onclick: e => { e.preventDefault(); busy(async () => { await Auth.recover(email.value.trim()); msg.style.color = '#2e7d32'; msg.textContent = T('Enviamos um link para redefinir a senha.'); }); } }, 'Esqueci a senha'))),
      [['Fechar', null]]);
    setTimeout(() => email.focus(), 50);
    return;
  }
  const status = h('div', { style: { fontSize: '13px', color: '#666', minHeight: '18px', margin: '6px 0' } });
  const autoBox = h('input', { type: 'checkbox', checked: Cloud.auto(), onchange: e => LS.set('cloudAuto', e.target.checked) });
  const run = async () => {
    status.textContent = T('Sincronizando…');
    try { const r = await Cloud.sync(); status.textContent = T(`Nuvem: ${r.up} projeto(s) enviados, ${r.down} baixados.`); if (r.down) showHome(); }
    catch (e) { status.textContent = T('Falha: ' + e.message); }
  };
  modal('Conta', h('div', { style: { width: '320px' } },
    h('div', {}, `Conectado como ${u.email}`), status,
    h('button', { cls: 'mbtn', style: { background: '#3D8FC7' }, onclick: run }, '☁ Enviar para a nuvem agora'),
    h('label', { style: { display: 'flex', gap: '8px', alignItems: 'center', fontSize: '14px', margin: '8px 0' } }, autoBox, 'Sincronizar automaticamente'),
    Monet.adsRemoved() ? null : h('button', { cls: 'mbtn', style: { background: 'var(--purple)' }, onclick: () => Cloud.checkPurchase(false) }, 'Verificar minha compra'),
    h('button', { cls: 'mbtn', style: { background: '#555' }, onclick: async () => { await Auth.signOut(); showHome(); } }, 'Sair da conta')),
    [['Fechar', null]]);
}

async function afterLogin() {
  Cloud.checkPurchase(true);
  try { const r = await Cloud.sync(); if (r.down || r.up) toast(T(`Nuvem: ${r.up} projeto(s) enviados, ${r.down} baixados.`), 3500); } catch (e) { console.warn('nuvem', e.message); }
  if (!Editor.current) showHome();
}

/** Na abertura: sessão salva, volta de link de e-mail e sincronização. */
async function initCloud() {
  if (!Auth.enabled()) return;
  Auth.load();
  let type = null;
  try { type = await Auth.fromUrl(); } catch (e) { }
  if (type === 'recovery') {
    const pass = h('input', { type: 'password', placeholder: 'senha (mínimo 8 caracteres)', autocomplete: 'new-password', maxLength: 72 });
    const msg = h('div', { style: { fontSize: '13px', color: '#c62828', minHeight: '18px' } });
    modal('Nova senha', h('div', { style: { width: '300px' } }, pass, msg),
      [['OK', async () => { try { await Auth.setPassword(pass.value); toast('Senha alterada ✓'); } catch (e) { toast(T(e.message), 4000); } }]]);
  }
  if (Auth.user() && await Auth.token()) afterLogin();
}
