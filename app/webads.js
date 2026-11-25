// Anúncios da versão web: Adsterra (agora) ou Google AdSense + H5 Games Ads (depois que o domínio for aprovado).
// Escolha em CONFIG.adProvider: '' (sem anúncios), 'adsterra' ou 'adsense'. ?testads=1 na URL mostra anúncios simulados.
'use strict';

const WebAds = {
  provider() {
    if (/[?&]testads=1/.test(location.search)) return 'test';
    const p = CONFIG.adProvider || '';
    if (p === 'adsterra' && CONFIG.adsterra && (CONFIG.adsterra.banner320 || CONFIG.adsterra.banner300)) return p;
    if (p === 'adsense' && CONFIG.adsense && CONFIG.adsense.client) return p;
    return '';
  },
  enabled() { return !!this.provider(); },
  wide() { return innerWidth >= 900; },

  // ---------- Adsterra: cada bloco roda num iframe próprio (o script deles usa variável global) ----------
  adsterraFrame(key, w, hh) {
    const f = h('iframe', { cls: 'ad-frame', width: w, height: hh, scrolling: 'no', frameborder: '0', title: 'Anúncio' });
    // Sem sandbox: isolado, o script do Adsterra não tem cookies/armazenamento e não mostra anúncio.
    // Para isolar de novo, hospede o ad.html num domínio separado (ex.: ads.seudominio.com) e use esse endereço aqui.
    f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    f.src = `ad.html?k=${encodeURIComponent(key)}&w=${w}&h=${hh}`;
    return f;
  },

  // ---------- AdSense ----------
  adsenseLoaded: false,
  loadAdsense() {
    if (this.adsenseLoaded) return; this.adsenseLoaded = true;
    const s = document.createElement('script');
    s.async = true; s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(CONFIG.adsense.client);
    // H5 Games Ads (intersticial e premiado no navegador)
    s.setAttribute('data-ad-frequency-hint', '120s');
    document.head.append(s);
    window.adsbygoogle = window.adsbygoogle || [];
    window.adBreak = window.adConfig = function (o) { window.adsbygoogle.push(o); };
    window.adConfig({ preloadAdBreaks: 'on', sound: 'on' });
  },
  adsenseUnit(w, hh) {
    this.loadAdsense();
    const ins = h('ins', { cls: 'adsbygoogle', style: { display: 'inline-block', width: w + 'px', height: hh + 'px' } });
    ins.setAttribute('data-ad-client', CONFIG.adsense.client);
    ins.setAttribute('data-ad-slot', CONFIG.adsense.bannerSlot || '');
    setTimeout(() => { try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { } }, 50);
    return ins;
  },

  /** Um bloco de anúncio do tamanho pedido (ou null). */
  unit(w, hh) {
    const p = this.provider(), a = CONFIG.adsterra || {};
    if (p === 'adsterra') {
      if (w >= 728 && a.banner728) return this.adsterraFrame(a.banner728, 728, 90);
      if (hh >= 250 && a.banner300) return this.adsterraFrame(a.banner300, 300, 250);
      if (a.banner320) return this.adsterraFrame(a.banner320, 320, 50);
      return a.banner300 ? this.adsterraFrame(a.banner300, 300, 250) : null;
    }
    if (p === 'adsense') return this.adsenseUnit(w, hh);
    if (p === 'test') return h('div', { cls: 'ad-test', style: { width: w + 'px', height: hh + 'px' } }, `ANÚNCIO DE TESTE ${w}×${hh}`);
    return null;
  },

  // ---------- banner fixo embaixo (só nos menus) ----------
  banner(on) {
    let el = document.getElementById('web-banner');
    if (!on) { if (el) el.remove(); document.body.classList.remove('has-banner', 'banner-wide'); return; }
    if (el) return;
    const wide = this.wide() && (this.provider() !== 'adsterra' || (CONFIG.adsterra || {}).banner728);
    const u = this.unit(wide ? 728 : 320, wide ? 90 : 50);
    if (!u) return;
    el = h('div', { id: 'web-banner', cls: wide ? 'wide' : '' }, u);
    document.body.append(el); document.body.classList.add('has-banner');
    document.body.classList.toggle('banner-wide', !!wide);
  },

  /** Card discreto na lista de projetos / biblioteca. */
  card(placement, w, hh) {
    const u = this.unit(hh >= 120 ? 300 : 320, hh >= 120 ? 250 : 50);
    if (!u) return null;
    return h('div', { cls: 'native-ad web', style: { width: w + 'px', height: hh + 'px' } }, h('div', { cls: 'ad-tag' }, 'Anúncio'), u);
  },

  // ---------- telas cheias: intersticial e premiado ----------
  /** Tela com um anúncio grande e contagem; premiado só libera se o usuário esperar até o fim. */
  overlay(kind, seconds) {
    return new Promise(res => {
      const u = this.unit(300, 250);
      if (!u) return res(kind !== 'rewarded');
      let left = seconds, done = false;
      const count = h('div', { cls: 'ad-count' }, kind === 'rewarded' ? `A recompensa libera em ${left}s` : `Pode fechar em ${left}s`);
      const close = h('button', { cls: 'mbtn', style: { background: '#555', display: kind === 'rewarded' ? 'block' : 'none' } }, kind === 'rewarded' ? 'Desistir (sem recompensa)' : 'Fechar ✕');
      const bg = h('div', { cls: 'modal-bg ad-overlay' },
        h('div', { cls: 'ad-box' }, h('div', { cls: 'ad-tag' }, 'Anúncio'), u, count, close));
      const finish = ok => { if (done) return; done = true; clearInterval(t); bg.remove(); res(ok); };
      close.onclick = () => finish(kind !== 'rewarded');
      const t = setInterval(() => {
        left--;
        if (left > 0) { count.textContent = kind === 'rewarded' ? `A recompensa libera em ${left}s` : `Pode fechar em ${left}s`; return; }
        clearInterval(t);
        if (kind === 'rewarded') {
          count.textContent = 'Recompensa liberada ✓';
          close.textContent = 'Continuar ✓'; close.style.background = 'var(--green)'; close.onclick = () => finish(true);
        } else { count.textContent = ''; close.style.display = 'block'; }
      }, 1000);
      document.getElementById('modal-root').append(bg);
    });
  },

  async rewarded(reason) {
    const p = this.provider();
    if (p === 'adsense') {
      this.loadAdsense();
      return new Promise(res => {
        let given = false, settled = false;
        const end = ok => { if (!settled) { settled = true; res(ok); } };
        window.adBreak({
          type: 'reward', name: reason,
          beforeReward: show => show(),
          adViewed: () => { given = true; },
          adDismissed: () => { given = false; },
          adBreakDone: info => {
            if (info && info.breakStatus && info.breakStatus !== 'viewed' && info.breakStatus !== 'dismissed') {
              // sem anúncio disponível no momento: não pune o usuário
              return end(true);
            }
            end(given);
          },
        });
        setTimeout(() => end(true), 15000); // nunca deixa o usuário preso
      });
    }
    return this.overlay('rewarded', 15);
  },

  async interstitial(placement) {
    if (this.provider() === 'adsense') {
      this.loadAdsense();
      return new Promise(res => { window.adBreak({ type: 'next', name: placement, adBreakDone: () => res() }); setTimeout(res, 8000); });
    }
    await this.overlay('interstitial', 5);
  },
};
