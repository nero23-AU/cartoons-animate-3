// Configuração do Cartoons Animate 3 — preencha os campos vazios com os dados das suas contas (veja SETUP.md).
'use strict';

const CONFIG = {
  appName: 'Cartoons Animate 3',
  version: '1.0.0',

  // Supabase (dados de uso, licenças e painel). Painel do Supabase → Project Settings → API.
  supabaseUrl: 'https://xpvfjphipzzdinazycsy.supabase.co',      // ex.: https://abcdxyz.supabase.co
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwdmZqcGhpcHp6ZGluYXp5Y3N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU1Njg5NDUsImV4cCI6MjExMTE0NDk0NX0.WNEDan5wk9rqyImkQ5YeO_cYuyfYYvYrj0XWGd865Hg',  // chave "anon public"

  // Gumroad: link do produto "Remover anúncios" (ex.: https://seunome.gumroad.com/l/xxxx).
  checkoutUrl: 'https://4699974365918.gumroad.com/l/semanuncios',      // ex.: https://seunome.gumroad.com/l/semanuncios
  removeAdsPrice: 'US$ 4,99',

  // Página de política de privacidade (obrigatória para anúncios). Fica na landing page.
  telegramUrl: 'https://t.me/+FSHwICAIk741MDMx',   // grupo do app no Telegram (menu inicial e landing)
  privacyUrl: 'https://vinskapps.online/privacidade.html',       // ex.: https://seunome.github.io/cartoons-animate-3/privacidade.html

  // Anúncios da versão web: '' = sem anúncios, 'adsterra' ou 'adsense' (veja SETUP.md).
  adProvider: 'adsterra',
  adsterra: { banner320: '711aa7acdd4845cb62d748eb93e7b828', banner728: '779afd95b9988136a16c9d280f861138', banner300: '07b4ab53253cd4ee2bd9bcc255ac87dd' },   // "keys" dos banners 320x50, 728x90 e 300x250
  adsense: { client: '', bannerSlot: '' },                       // ca-pub-... e o ID do bloco de anúncio

  // Regras de monetização
  freeSlots: 3,                          // projetos salvos grátis
  interstitialMinGapMs: 10 * 60 * 1000,  // no máximo 1 intersticial a cada 10 minutos
  motionBlurUnlockMs: 2 * 60 * 60 * 1000, // Motion Blur liberado por 2 h após um vídeo premiado
  freeMaxWidth: 1280,                    // grátis: até 720p
  freeMaxFps: 30,
};
