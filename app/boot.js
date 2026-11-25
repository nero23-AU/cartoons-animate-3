// Inicialização da página (fora do HTML para a política de segurança proibir scripts embutidos)
'use strict';
I18N.page();
document.getElementById('fs-btn').onclick = async () => { try { await document.documentElement.requestFullscreen(); await screen.orientation.lock('landscape'); } catch (e) { } };
if ('serviceWorker' in navigator && location.protocol === 'https:' && !window.Capacitor) navigator.serviceWorker.register('sw.js');
