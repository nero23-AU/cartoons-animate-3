// Monetização: anúncios (web: webads.js; Android: plugin "Ads"), licença "Remover anúncios" e dados de uso.
'use strict';

const LS = {
  get(k, d) { try { const v = localStorage.getItem('ca3.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('ca3.' + k, JSON.stringify(v)); } catch (e) { /* armazenamento indisponível */ } },
};
const installId = (() => { let id = LS.get('install'); if (!id) { id = uid(); LS.set('install', id); LS.set('installedAt', Date.now()); } return id; })();

// ---------- ponte com o plugin nativo ----------
const NativeAds = () => window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() ? window.Capacitor.Plugins.Ads : null;


const Monet = {
  noAdsBuild: false,
  /** No Android: descobre se o APK tem as chaves de anúncio configuradas. */
  async init() {
    const n = NativeAds();
    if (n) { try { const s = await n.status(); this.noAdsBuild = !s.configured; } catch (e) { this.noAdsBuild = true; } }
    else this.noAdsBuild = !WebAds.enabled();
    if (n && !this.noAdsBuild && !this.adsRemoved()) (async () => { // não trava a abertura do app
      let consent = LS.get('adConsent', null);
      if (consent === null) consent = await this.askConsent();
      try { await n.init({ consent }); } catch (e) { /* sem anúncios nesta sessão */ }
      for (const ms of [2500, 6000, 12000]) setTimeout(() => this.applyBanner(), ms); // o banner só carrega depois que o SDK inicia
    })();
    this.applyBanner();
  },
  /** LGPD/GDPR: pergunta uma vez se os anúncios podem ser personalizados. */
  askConsent() {
    return new Promise(res => {
      const done = v => { LS.set('adConsent', v); Analytics.track('ad_consent', { consent: v }); res(v); };
      modal('Anúncios e privacidade', h('div', { style: { width: '330px' } },
        'O app é gratuito graças a anúncios da Unity Ads. Podemos mostrar anúncios personalizados com base no identificador de publicidade do aparelho? Se não, os anúncios continuam, mas sem personalização. ',
        h('a', { href: CONFIG.privacyUrl, target: '_blank' }, 'Política de privacidade')),
        [['Não personalizar', () => done(false)], ['Permitir', () => done(true)]]);
      // tocar fora da caixa conta como "não personalizar"
      const bg = document.querySelector('#modal-root .modal-bg:last-child');
      if (bg) bg.addEventListener('pointerdown', e => { if (e.target === bg) done(false); });
    });
  },
  // ----- licença "Remover anúncios" -----
  adsRemoved() { return !!LS.get('license'); },
  async refreshLicense() {
    if (!CONFIG.supabaseUrl) return this.adsRemoved();
    try {
      const r = await Backend.rpc('check_license', { p_install: installId });
      if (r === true && !this.adsRemoved()) { LS.set('license', { at: Date.now() }); Analytics.track('purchase_ok'); this.applyBanner(); toast('Compra confirmada! Anúncios removidos e recompensas liberadas ✓'); }
    } catch (e) { /* sem internet: mantém o estado salvo */ }
    return this.adsRemoved();
  },
  buyRemoveAds() {
    Analytics.track('purchase_click');
    if (!CONFIG.checkoutUrl) return modal('Remover anúncios', h('div', {}, 'O link de pagamento ainda não foi configurado (CONFIG.checkoutUrl).'));
    const url = CONFIG.checkoutUrl + (CONFIG.checkoutUrl.includes('?') ? '&' : '?') + 'install_id=' + encodeURIComponent(installId) + '&wanted=true';
    window.open(url, '_blank');
    modal('Remover anúncios', h('div', { style: { width: '320px' } },
      'Conclua o pagamento na página que abriu. Quando terminar, volte aqui e toque em "Já paguei".'),
      [['Depois', null], ['Já paguei', async () => { if (!(await this.refreshLicense())) toast('Pagamento ainda não confirmado. Tente de novo em alguns segundos.'); }]]);
  },
  /** Para quem trocou de celular: e-mail + número do pedido do recibo. */
  restorePurchase() {
    const email = h('input', { type: 'text', placeholder: 'e-mail usado na compra' });
    const order = h('input', { type: 'text', placeholder: 'número do pedido (no recibo)', style: { marginTop: '8px' } });
    modal('Restaurar compra', h('div', { style: { width: '320px' } }, email, order), [['Cancelar', null], ['Restaurar', async () => {
      try {
        const ok = await Backend.rpc('claim_license', { p_email: email.value.trim(), p_order: order.value.trim(), p_install: installId });
        if (ok) { LS.set('license', { at: Date.now() }); this.applyBanner(); toast('Compra restaurada ✓'); Analytics.track('purchase_restore'); }
        else toast('Compra não encontrada. Confira o e-mail e o número do pedido.');
      } catch (e) { toast('Sem conexão com o servidor.'); }
    }]]);
  },
  storeMenu() {
    if (this.adsRemoved()) return modal(CONFIG.appName, h('div', {}, 'Você já tem a versão sem anúncios. Obrigado! ❤'));
    modal('Remover anúncios', h('div', { style: { width: '330px' } },
      h('div', {}, `Pagamento único de ${CONFIG.removeAdsPrice} (sem assinatura):`),
      h('ul', { style: { paddingLeft: '18px' } }, h('li', {}, 'sem nenhum anúncio'), h('li', {}, 'exportação 1080p/60fps, transparente e sem marca d\'água sempre'),
        h('li', {}, 'Motion Blur sempre liberado'), h('li', {}, 'projetos salvos ilimitados')),
      h('button', { cls: 'mbtn', style: { background: 'var(--green)' }, onclick: () => this.buyRemoveAds() }, `Comprar por ${CONFIG.removeAdsPrice}`),
      h('button', { cls: 'mbtn', style: { background: '#555' }, onclick: () => this.restorePurchase() }, 'Já comprei em outro celular')), [['Fechar', null]]);
  },

  // ----- vídeo premiado (o usuário escolhe assistir) -----
  async rewarded(reason) {
    if (this.adsRemoved()) return true; // comprou: recompensa liberada direto
    if (this.noAdsBuild) return true;   // APK montado sem chaves de anúncio: libera sem vídeo
    Analytics.track('ad_request', { type: 'rewarded', placement: reason });
    let ok = false;
    const n = NativeAds();
    try { ok = n ? (await n.showRewarded({ placement: reason })).rewarded : await WebAds.rewarded(reason); }
    catch (e) { Analytics.track('ad_fail', { type: 'rewarded', placement: reason, error: String(e.message || e) }); let d = String(e.message || e); try { const s = await n.status(); d += ' | init:' + s.initCalled; } catch (x) {} toast('Nenhum vídeo disponível agora. Tente de novo em instantes. [' + d + ']', 9000); return false; }
    Analytics.track(ok ? 'ad_reward' : 'ad_skip', { type: 'rewarded', placement: reason });
    return ok;
  },
  /** Pergunta antes: o vídeo só passa se o usuário quiser. */
  offer(title, text, reason) {
    return new Promise(res => {
      modal(title, h('div', { style: { width: '320px' } }, text,
        this.adsRemoved() ? null : h('div', { style: { fontSize: '12px', color: '#777', marginTop: '8px' } }, 'Ou remova os anúncios para liberar tudo sempre.')),
        [['Agora não', () => res(false)], ...(this.adsRemoved() ? [] : [['Remover anúncios', () => { this.storeMenu(); res(false); }]]),
          [this.adsRemoved() ? 'Liberar' : '▶ Assistir vídeo', async () => res(await this.rewarded(reason))]]);
    });
  },

  // ----- intersticial só em pausas naturais, no máximo 1 a cada 10 min -----
  async interstitial(placement) {
    if (this.adsRemoved() || this.noAdsBuild) return;
    const last = LS.get('lastInterstitial', 0);
    if (Date.now() - last < CONFIG.interstitialMinGapMs) return;
    if (Date.now() - LS.get('installedAt', Date.now()) < 3 * 60 * 1000) return; // não incomoda nos primeiros minutos
    LS.set('lastInterstitial', Date.now());
    Analytics.track('ad_request', { type: 'interstitial', placement });
    try { const n = NativeAds(); if (n) await n.showInterstitial({ placement }); else await WebAds.interstitial(placement); Analytics.track('ad_show', { type: 'interstitial', placement }); }
    catch (e) { Analytics.track('ad_fail', { type: 'interstitial', placement }); }
  },

  // ----- banner: só na tela inicial e na lista de itens, nunca no editor -----
  bannerWanted: false,
  setBanner(on) { this.bannerWanted = on; this.applyBanner(); },
  applyBanner() {
    const on = this.bannerWanted && !this.adsRemoved() && !this.noAdsBuild;
    const n = NativeAds();
    if (n) { (on ? n.showBanner() : n.hideBanner()).catch(() => {}); document.body.classList.toggle('has-banner', on); return; }
    WebAds.banner(on);
  },

  // ----- anúncio nativo: card discreto na lista de projetos / biblioteca -----
  nativeCard(placement, w, hh) {
    if (this.adsRemoved() || this.noAdsBuild) return null;
    if (NativeAds()) return null; // a Unity Ads não tem anúncio nativo
    const card = WebAds.card(placement, w, hh);
    if (!card) return null;
    Analytics.track('ad_request', { type: 'native', placement });
    return card;
  },

  // ----- recursos liberados por vídeo premiado -----
  motionBlurUnlocked() { return this.adsRemoved() || LS.get('mbUntil', 0) > Date.now(); },
  async unlockMotionBlur() {
    if (this.motionBlurUnlocked()) return true;
    const ok = await this.offer('Motion Blur', 'Assista a um vídeo curto para usar o Motion Blur por 2 horas.', 'motion_blur');
    if (ok) { LS.set('mbUntil', Date.now() + CONFIG.motionBlurUnlockMs); Analytics.track('unlock', { type: 'motion_blur' }); toast('Motion Blur liberado por 2 horas'); }
    return ok;
  },
  slots() { return this.adsRemoved() ? Infinity : CONFIG.freeSlots + LS.get('extraSlots', 0); },
  async addSlot() {
    const ok = await this.offer('Espaços de projeto', `Você usou todos os ${this.slots()} espaços de projeto. Assista a um vídeo para ganhar +1 espaço (ou apague um projeto antigo).`, 'save_slot');
    if (ok) { LS.set('extraSlots', LS.get('extraSlots', 0) + 1); Analytics.track('unlock', { type: 'save_slot' }); toast('+1 espaço de projeto'); }
    return ok;
  },
  /** Opções de exportação acima do grátis: 1 vídeo libera tudo para AQUELA exportação. */
  needsReward(o) { return !this.adsRemoved() && (o.width > CONFIG.freeMaxWidth || o.fps > CONFIG.freeMaxFps || o.transparent || o.noWatermark); },
};

// ---------- servidor (Supabase REST) ----------
const Backend = {
  headers() { return { apikey: CONFIG.supabaseAnonKey, Authorization: 'Bearer ' + CONFIG.supabaseAnonKey, 'Content-Type': 'application/json' }; },
  async rpc(fn, args) {
    const r = await fetch(`${CONFIG.supabaseUrl}/rest/v1/rpc/${fn}`, { method: 'POST', headers: this.headers(), body: JSON.stringify(args) });
    if (!r.ok) throw new Error('servidor ' + r.status);
    return r.json();
  },
};

// ---------- dados de uso (anônimos: sem nome, e-mail ou conteúdo dos projetos) ----------
const Analytics = {
  queue: LS.get('evq', []), session: uid(), sessionStart: Date.now(), screen: '',
  track(name, props = {}) {
    this.queue.push({ install_id: installId, session_id: this.session, name, props, ts: new Date().toISOString() });
    if (this.queue.length > 500) this.queue.splice(0, this.queue.length - 500);
    LS.set('evq', this.queue);
    if (this.queue.length >= 20) this.flush();
  },
  screenView(s) { if (s !== this.screen) { this.screen = s; this.track('screen_view', { screen: s }); } },
  async flush(keepalive = false) {
    if (!CONFIG.supabaseUrl || !this.queue.length || this.flushing) return;
    this.flushing = true;
    const batch = this.queue.slice(0, 100);
    try {
      const r = await fetch(`${CONFIG.supabaseUrl}/rest/v1/events`, { method: 'POST', keepalive, headers: { ...Backend.headers(), Prefer: 'return=minimal' }, body: JSON.stringify(batch) });
      if (r.ok) { this.queue.splice(0, batch.length); LS.set('evq', this.queue); }
    } catch (e) { /* sem internet: tenta depois */ }
    this.flushing = false;
  },
  async registerInstall() {
    if (!CONFIG.supabaseUrl || LS.get('installSent')) return;
    const n = navigator;
    const body = { id: installId, created_at: new Date(LS.get('installedAt', Date.now())).toISOString(), version: CONFIG.version,
      platform: NativeAds() ? 'android' : 'web', locale: n.language, device: (n.userAgentData && n.userAgentData.platform) || n.platform || '',
      screen: `${screen.width}x${screen.height}` };
    try {
      const r = await fetch(`${CONFIG.supabaseUrl}/rest/v1/installs`, { method: 'POST', headers: { ...Backend.headers(), Prefer: 'return=minimal' }, body: JSON.stringify(body) });
      if (r.ok || r.status === 409) LS.set('installSent', true);
    } catch (e) { /* tenta na próxima abertura */ }
  },
  start() {
    this.track('session_start', { version: CONFIG.version, ads_removed: Monet.adsRemoved(), day: Math.floor((Date.now() - LS.get('installedAt', Date.now())) / 864e5) });
    this.registerInstall(); this.flush();
    setInterval(() => this.flush(), 30000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') { this.track('session_end', { secs: Math.round((Date.now() - this.sessionStart) / 1000), screen: this.screen }); this.flush(true); }
      else { this.session = uid(); this.sessionStart = Date.now(); this.track('session_start', { version: CONFIG.version, resume: true }); Monet.refreshLicense(); }
    });
  },
};
