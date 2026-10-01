// ct-motion-code / engine / motion.js
// Matematica de mola em forma fechada pra window.seek(t): tudo funcao pura
// de t, sem estado mutavel entre chamadas, sem Math.random (rng com semente).
// Script classico (sem import/export) pra funcionar direto via file:// no
// Playwright sem esbarrar em CORS de modulo ES.
(function (global) {
  "use strict";

  // mulberry32: PRNG deterministico. Usar SEMPRE no lugar de Math.random
  // dentro de draw() (ruido, jitter, variacao de particula etc). Mesma
  // semente = mesmo video sempre (requisito de determinismo do render).
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function rng() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp01(x) {
    return x < 0 ? 0 : x > 1 ? 1 : x;
  }
  function lerp(a, b, x) {
    return a + (b - a) * x;
  }
  function easeInOutCubic(x) {
    x = clamp01(x);
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  // Presets de mola: stiffness (rigidez) / damping (amortecimento).
  // fast = UI/bordas, standard = cards/camera, heavy = tipo grande/logo,
  // playful = mascote (overshoot visivel).
  const PRESETS = {
    fast: { stiffness: 320, damping: 24 },
    standard: { stiffness: 170, damping: 26 },
    heavy: { stiffness: 90, damping: 20 },
    playful: { stiffness: 220, damping: 12 },
  };

  // springStep(dt, stiffness, damping): fracao (0..~1, pode passar de 1 com
  // overshoot) de uma mudanca de alvo em degrau que ja resolveu apos dt
  // segundos. dt <= 0 -> 0 (a mudanca ainda nao aconteceu nesse instante t).
  // E a resposta ao degrau de um oscilador amortecido em forma FECHADA: nao
  // integra passo a passo, entao seek(t) fica puro (calculavel em qualquer
  // ordem, qualquer instante, sem depender do frame anterior).
  function springStep(dt, stiffness, damping) {
    if (stiffness == null) stiffness = PRESETS.standard.stiffness;
    if (damping == null) damping = PRESETS.standard.damping;
    if (dt <= 0) return 0;
    const mass = 1;
    const omega0 = Math.sqrt(stiffness / mass);
    const zeta = damping / (2 * Math.sqrt(stiffness * mass));
    if (zeta < 1) {
      const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
      const env = Math.exp(-zeta * omega0 * dt);
      return 1 - env * (Math.cos(omegaD * dt) + ((zeta * omega0) / omegaD) * Math.sin(omegaD * dt));
    }
    // criticamente amortecido / superamortecido: sem overshoot
    const env = Math.exp(-omega0 * dt);
    return 1 - env * (1 + omega0 * dt);
  }

  // track(t, keyframes, preset): valor de uma propriedade no instante t como
  // SOMA de uma mola por MUDANCA de alvo (nunca reinicia a mola anterior:
  // se o alvo muda nas batidas 0, 1.2 e 2.0, ha 2 molas somadas, cada uma
  // resolvendo a partir do seu proprio instante de disparo).
  // keyframes = [{t, value}, ...] ordenado por t crescente; keyframes[0] e
  // o estado inicial (o t dele so importa pra nao disparar mola nenhuma).
  function track(t, keyframes, preset) {
    preset = preset || PRESETS.standard;
    if (!keyframes || !keyframes.length) return 0;
    let value = keyframes[0].value;
    for (let i = 1; i < keyframes.length; i++) {
      const prev = keyframes[i - 1];
      const step = keyframes[i];
      const delta = step.value - prev.value;
      const dt = t - step.t;
      value += delta * springStep(dt, preset.stiffness, preset.damping);
    }
    return value;
  }

  // stretchIndicator: indicador (aba, barra de progresso, pill de selecao)
  // cuja borda que SAI (leading) e a que CHEGA (trailing) usam molas
  // DIFERENTES. A borda de chegada normalmente e mais lenta, entao o
  // indicador estica visivelmente antes de assentar no tamanho final.
  // keyframes = [{t, start, end}, ...] (posicoes das duas bordas ao longo
  // do tempo).
  function stretchIndicator(t, keyframes, leading, trailing) {
    leading = leading || PRESETS.fast;
    trailing = trailing || PRESETS.standard;
    const startKF = keyframes.map(function (k) {
      return { t: k.t, value: k.start };
    });
    const endKF = keyframes.map(function (k) {
      return { t: k.t, value: k.end };
    });
    return {
      start: track(t, startKF, leading),
      end: track(t, endKF, trailing),
    };
  }

  // swapAlpha(t, swapAt, dur): crossfade entre um elemento que sai (outAlpha)
  // e um que entra (inAlpha), centrado em swapAt, com easing (nao linear).
  // Uso tipico: trocar um numero, um icone ou um card por outro sem corte.
  function swapAlpha(t, swapAt, dur) {
    dur = dur || 0.25;
    const half = dur / 2;
    const x = clamp01((t - (swapAt - half)) / dur);
    const eased = easeInOutCubic(x);
    return { outAlpha: 1 - eased, inAlpha: eased };
  }

  // loopT(t, loopDur): dobra t pra dentro de [0, loopDur), pra cenas que
  // tocam em loop dentro de uma composicao maior. A garantia de que o
  // ULTIMO quadro bate com o PRIMEIRO e responsabilidade de quem desenha a
  // cena (ex: usar o mesmo keyframe final = inicial), loopT so faz o wrap.
  function loopT(t, loopDur) {
    const m = t % loopDur;
    return m < 0 ? m + loopDur : m;
  }

  global.Motion = {
    mulberry32: mulberry32,
    clamp01: clamp01,
    lerp: lerp,
    easeInOutCubic: easeInOutCubic,
    PRESETS: PRESETS,
    springStep: springStep,
    track: track,
    stretchIndicator: stretchIndicator,
    swapAlpha: swapAlpha,
    loopT: loopT,
  };
})(window);
