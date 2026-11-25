// Tutorial visual: passo a passo de todas as funções (português e inglês; outros idiomas usam o inglês).
'use strict';

const TUT_ART = {
  // ilustrações simples em SVG (cores do tema)
  pose: `<svg viewBox="0 0 220 120"><rect x="1" y="1" width="218" height="118" rx="10" fill="#fff"/>
    <g stroke-linecap="round" fill="none"><line x1="110" y1="70" x2="110" y2="38" stroke="#6B4226" stroke-width="12"/><line x1="110" y1="70" x2="98" y2="104" stroke="#2E2B2A" stroke-width="9"/><line x1="110" y1="70" x2="124" y2="104" stroke="#2E2B2A" stroke-width="9"/><line x1="110" y1="44" x2="136" y2="30" stroke="#6B4226" stroke-width="7"/></g>
    <circle cx="110" cy="26" r="11" fill="#E0B08A"/><g fill="#FF9F43"><circle cx="136" cy="30" r="5"/><circle cx="98" cy="104" r="5"/><circle cx="124" cy="104" r="5"/></g>
    <circle cx="72" cy="20" r="11" fill="#7CC223"/><text x="72" y="24" font-size="12" text-anchor="middle" fill="#fff">⟳</text>
    <circle cx="150" cy="20" r="11" fill="#FF9F43"/><text x="150" y="24" font-size="12" text-anchor="middle" fill="#fff">⤢</text>
    <circle cx="110" cy="114" r="0"/><circle cx="160" cy="96" r="11" fill="#38BDF8"/><text x="160" y="100" font-size="12" text-anchor="middle" fill="#fff">✥</text>
    <path d="M150 40 q14 -6 22 4" stroke="#9B6BFF" stroke-width="2" fill="none" stroke-dasharray="3 3"/></svg>`,
  timeline: `<svg viewBox="0 0 220 120"><rect x="1" y="1" width="218" height="118" rx="10" fill="#12141C"/>
    <g font-family="sans-serif" font-size="10" text-anchor="middle"><rect x="10" y="16" width="44" height="40" rx="7" fill="#1F2330"/><text x="32" y="32" fill="#fff" font-weight="700">1</text><text x="32" y="48" fill="#A4A9B8">0,20s</text>
    <rect x="58" y="16" width="70" height="40" rx="7" fill="#4C8DFF"/><text x="93" y="32" fill="#fff" font-weight="700">2</text><text x="93" y="48" fill="#fff">0,48s</text><rect x="122" y="24" width="3" height="24" rx="1" fill="#fff"/>
    <rect x="132" y="16" width="36" height="40" rx="7" fill="none" stroke="#7CC223" stroke-dasharray="3 2"/><text x="150" y="41" fill="#7CC223" font-size="18">+</text></g>
    <rect x="10" y="70" width="150" height="34" rx="6" fill="#2F6FD6"/><path d="M14 87 q6 -12 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0" stroke="#BBDEFB" fill="none"/>
    <text x="178" y="92" font-size="18">✂</text><path d="M128 60 l8 0 l-4 6 z" fill="#fff"/></svg>`,
  camera: `<svg viewBox="0 0 220 120"><rect x="1" y="1" width="218" height="118" rx="10" fill="#fff"/>
    <rect x="70" y="30" width="96" height="54" fill="rgba(76,141,255,.12)" stroke="#4C8DFF" stroke-width="3"/><circle cx="166" cy="84" r="8" fill="#4C8DFF"/><text x="166" y="88" font-size="10" text-anchor="middle" fill="#fff">⤡</text>
    <text x="80" y="44" font-size="11">🎥</text><circle cx="118" cy="58" r="7" fill="#E0B08A"/><line x1="118" y1="65" x2="118" y2="80" stroke="#6B4226" stroke-width="6" stroke-linecap="round"/></svg>`,
  player: `<svg viewBox="0 0 220 120"><rect x="1" y="1" width="218" height="118" rx="10" fill="#05060A"/><rect x="20" y="12" width="180" height="70" rx="6" fill="#fff"/>
    <circle cx="36" cy="100" r="11" fill="#FF9F43"/><text x="36" y="104" font-size="11" text-anchor="middle">⏸</text><rect x="56" y="98" width="110" height="4" rx="2" fill="#282D3C"/><rect x="56" y="98" width="52" height="4" rx="2" fill="#FF9F43"/><circle cx="108" cy="100" r="6" fill="#FF9F43"/>
    <text x="196" y="104" font-size="9" text-anchor="end" fill="#A4A9B8">1,2s / 2,4s</text></svg>`,
};

const TUTORIAL = {
  pt: [
    { ic: '👋', t: 'Bem-vindo ao Cartoons Animate 3', b: ['Crie animações 2D com bonecos articulados, no PC (mouse e teclado) ou no celular (toque, com a tela deitada).', 'Tudo é salvo sozinho no seu aparelho. Use as setas abaixo para ver cada parte do app.'] },
    { ic: '🎬', t: '1. Criar uma animação', b: ['Na tela inicial toque em NOVO CARTOON.', 'Toque no ⋯ de um projeto para abrir, renomear, duplicar ou excluir.', 'No editor, o botão vermelho SAIR (canto de cima) volta para o menu.'] },
    { ic: '✚', t: '2. Inserir personagens e objetos', b: ['Toque em INSERIR e escolha uma pasta, ou busque pelo nome (maiúsculas e acentos não importam).', 'No ⋮ de cada item: copiar, recortar, colar em outra pasta, mover, favoritar ou excluir.'] },
    { art: 'pose', t: '3. Posar o personagem', b: ['Arraste os pontos laranja para dobrar braços, pernas e cabeça.', 'Alças: verde ⟳ gira, laranja ⤢ muda o tamanho, azul ✥ move o personagem inteiro.', 'Arraste uma área vazia para mover a visão; pinça (ou roda do mouse) dá zoom.'] },
    { art: 'timeline', t: '4. Quadros e tempo', b: ['Cada bloco da timeline é um quadro (pose). Toque no + verde para criar o próximo: ele copia o atual, aí é só mudar a pose.', 'Arraste a borda direita do bloco para mudar o tempo da pose. O movimento entre poses é suavizado sozinho.', 'Segure um bloco para selecionar vários e mudar o tempo de todos juntos.'] },
    { ic: '⧉', t: '5. Editar quadro e unidade', b: ['EDITAR QUADRO: adicionar, copiar, colar, apagar quadros e o efeito Motion Blur na transição.', 'EDITAR UNIDADE (item selecionado): espelhar, frente/trás, trocar imagem, sombra, mesclagem e TRAVAR PONTA (IK: o pé fica no chão enquanto o corpo mexe).'] },
    { art: 'camera', t: '6. Câmera e enquadramento', b: ['Toque no 🎥 no canto do palco. Aparece o quadro azul: arraste para mover e puxe a alça do canto para dar zoom in ou zoom out.', 'Cada quadro guarda a sua câmera e o movimento entre quadros é suave: ótimo para aproximar no golpe.', '“Palco inteiro” volta a câmera ao normal.'] },
    { ic: '🎵', t: '7. Áudio em blocos', b: ['☰ → ADICIONAR ÁUDIO. O áudio aparece embaixo dos quadros: arraste para encaixar.', 'Arraste as pontas para cortar o começo/fim. Com a tesoura ✂ ligada, toque no ponto exato para dividir o bloco.', 'Esticar (mais rápido/lento): pinça com dois dedos, ou clique duplo no PC e arraste a ponta.', 'A barra embaixo da timeline rola do começo ao fim.'] },
    { ic: '🖼', t: '8. Plano de fundo', b: ['☰ → PLANO DE FUNDO: cor sólida ou imagem da galeria/computador.', 'A imagem vale do quadro atual em diante (quadros novos copiam). Ao remover, escolha: só deste quadro, deste em diante ou todos.'] },
    { art: 'player', t: '9. Assistir (JOGAR)', b: ['JOGAR abre o player: ⏯ pausa e continua, a barra leva a qualquer momento, 🔁 repete.', 'No PC: Espaço pausa, ← → andam, Esc fecha.'] },
    { ic: '🎞', t: '10. Exportar', b: ['☰ → EXPORTAR: vídeo MP4 (galeria, WhatsApp, CapCut), PNG com fundo transparente ou WebM.', 'Grátis até 720p; 1080p, 60 fps, transparência e sem marca d’água liberam com um vídeo curto ou com a compra Sem anúncios.'] },
    { ic: '🧩', t: '11. Criar seus próprios itens', b: ['CONSTRUTOR DE ITENS: comece de um modelo base, crie ossos e desenhe cada peça com pincel, borracha, balde, camadas e recorte.', 'IMPORTAR abre packs .atp/.ati com ossos e imagens.'] },
    { ic: '☁', t: '12. Conta, backup e idiomas', b: ['CONTA: entre com e-mail e senha para salvar na nuvem e abrir em outro aparelho.', 'BACKUP salva tudo num arquivo. As bandeiras trocam o idioma.', 'SEM ANÚNCIOS: pagamento único que remove os anúncios e libera tudo.'] },
    { ic: '⌨', t: '13. Atalhos no PC', b: ['Espaço: jogar · ← →: quadros · N: novo quadro · Delete: apagar', 'Ctrl+Z / Ctrl+Y: desfazer/refazer · Ctrl+C / Ctrl+V: copiar/colar quadro', 'I: inserir · S: cortar o áudio selecionado · Esc: fechar painel'] },
  ],
  en: [
    { ic: '👋', t: 'Welcome to Cartoons Animate 3', b: ['Create 2D animations with jointed puppets, on PC (mouse and keyboard) or phone (touch, screen sideways).', 'Everything saves automatically on your device. Use the arrows below to see each part of the app.'] },
    { ic: '🎬', t: '1. Create an animation', b: ['On the home screen tap NEW CARTOON.', 'Tap ⋯ on a project to open, rename, duplicate or delete it.', 'In the editor, the red EXIT button (top corner) takes you back to the menu.'] },
    { ic: '✚', t: '2. Insert characters and objects', b: ['Tap INSERT and choose a folder, or search by name (case and accents don’t matter).', 'Each item’s ⋮ menu: copy, cut, paste into another folder, move, favorite or delete.'] },
    { art: 'pose', t: '3. Pose your character', b: ['Drag the orange points to bend arms, legs and head.', 'Handles: green ⟳ rotates, orange ⤢ resizes, blue ✥ moves the whole character.', 'Drag an empty area to move the view; pinch (or mouse wheel) zooms.'] },
    { art: 'timeline', t: '4. Frames and timing', b: ['Each timeline block is a frame (pose). Tap the green + to create the next one: it copies the current one, then change the pose.', 'Drag a block’s right edge to change how long the pose lasts. Motion between poses is smoothed automatically.', 'Hold a block to select several and change their timing together.'] },
    { ic: '⧉', t: '5. Edit frame and unit', b: ['EDIT FRAME: add, copy, paste, delete frames and the Motion Blur transition effect.', 'EDIT UNIT (selected item): flip, front/back, swap image, shadow, blend and PIN END (IK: the foot stays on the ground while the body moves).'] },
    { art: 'camera', t: '6. Camera and framing', b: ['Tap 🎥 in the stage corner. A blue frame appears: drag to move it and pull the corner handle to zoom in or out.', 'Each frame keeps its own camera and the move between frames is smooth: great for zooming in on a hit.', '“Whole stage” resets the camera.'] },
    { ic: '🎵', t: '7. Audio blocks', b: ['☰ → ADD AUDIO. The audio appears under the frames: drag it into place.', 'Drag the ends to trim. With the scissors ✂ on, tap the exact spot to split the block.', 'Stretch (faster/slower): pinch with two fingers, or double-click on PC and drag an end.', 'The bar under the timeline scrolls from start to end.'] },
    { ic: '🖼', t: '8. Background', b: ['☰ → BACKGROUND: solid color or an image from gallery/computer.', 'The image applies from the current frame on (new frames copy it). When removing, choose: this frame, from here on, or all frames.'] },
    { art: 'player', t: '9. Watch (PLAY)', b: ['PLAY opens the player: ⏯ pauses and resumes, the bar jumps anywhere, 🔁 loops.', 'On PC: Space pauses, ← → step, Esc closes.'] },
    { ic: '🎞', t: '10. Export', b: ['☰ → EXPORT: MP4 video (gallery, WhatsApp, CapCut), PNG with transparent background, or WebM.', 'Free up to 720p; 1080p, 60 fps, transparency and no watermark unlock with a short video or the No ads purchase.'] },
    { ic: '🧩', t: '11. Make your own items', b: ['ITEM BUILDER: start from a base model, create bones and draw each part with brush, eraser, bucket, layers and cut-out.', 'IMPORT opens .atp/.ati packs with bones and images.'] },
    { ic: '☁', t: '12. Account, backup and languages', b: ['ACCOUNT: sign in with email and password to save to the cloud and open on another device.', 'BACKUP saves everything to a file. The flags switch language.', 'NO ADS: one-time payment that removes ads and unlocks everything.'] },
    { ic: '⌨', t: '13. PC shortcuts', b: ['Space: play · ← →: frames · N: new frame · Delete: delete', 'Ctrl+Z / Ctrl+Y: undo/redo · Ctrl+C / Ctrl+V: copy/paste frame', 'I: insert · S: cut selected audio · Esc: close panel'] },
  ],
};

function showTutorial(start = 0) {
  const steps = I18N.lang === 'pt' ? TUTORIAL.pt : TUTORIAL.en;
  let i = start;
  const art = h('div', { cls: 'tut-art' }), title = h('h3', { cls: 'tut-title' }), body = h('ul', { cls: 'tut-body' });
  const dots = h('div', { cls: 'tut-dots' }), prev = h('button', { cls: 'mbtn tut-nav' }), next = h('button', { cls: 'mbtn tut-nav' });
  const show = () => {
    const s = steps[i];
    // as ilustrações são SVG fixos deste arquivo (sem conteúdo do usuário)
    if (s.art) art.innerHTML = TUT_ART[s.art]; else art.textContent = s.ic;
    art.classList.toggle('emoji', !s.art);
    title.textContent = s.t;
    body.replaceChildren(...s.b.map(x => { const li = document.createElement('li'); li.textContent = x; return li; }));
    dots.replaceChildren(...steps.map((_, k) => h('span', { cls: k === i ? 'on' : '', onclick: () => { i = k; show(); } })));
    prev.style.visibility = i ? 'visible' : 'hidden'; prev.textContent = '‹ ' + T('Voltar');
    next.textContent = i < steps.length - 1 ? T('Próximo') + ' ›' : T('Começar!') + ' ✓';
  };
  let close;
  prev.onclick = () => { i = Math.max(0, i - 1); show(); };
  next.onclick = () => { if (i < steps.length - 1) { i++; show(); } else close(); };
  close = modal('📖 Tutorial', h('div', { cls: 'tut' }, art, title, body, h('div', { cls: 'tut-foot' }, prev, dots, next)), [['Fechar', null]]);
  show(); Analytics.track('tutorial_open'); LS.set('tutorialSeen', true);
}
