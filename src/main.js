import './style.css';
import { CONFIG } from './game/config.js';
import { createLevel, resetLevel } from './game/level.js';
import { createGameState, updateGame, levelProgress, computeScore } from './game/state.js';
import { InputController } from './game/input.js';
import { AudioEngine } from './game/audio.js';
import { loadBest, saveBest } from './game/storage.js';
import { computeStickAxis } from './game/touch.js';

const FIXED_STEP = 1 / 120;
const MAX_FRAME = 0.1;

const el = (id) => document.getElementById(id);

// THREE.WebGLRenderer only ever requests a "webgl2" context (see
// three/src/renderers/WebGLRenderer.js), so a device/browser that only
// exposes WebGL1 will fail inside `new World(...)` even though a generic
// "webgl" or "webgl2 || webgl" probe would report success. Checking for
// webgl2 specifically here avoids promising support the renderer can't use,
// and lets the fallback message be shown immediately instead of after a
// failed World construction.
function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

/** Shows the startup fallback UI and logs *why*, so a blank/failed boot is never silent. */
function showStartupFailure(reason, error) {
  console.error(`[Cloud Kingdom] startup failed (${reason})`, error);
  const banner = el('webgl-error');
  banner.hidden = false;
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

async function boot() {
  if (!webglAvailable()) {
    showStartupFailure('no-webgl2-context');
    return;
  }

  let World;
  try {
    ({ World } = await import('./game/world.js'));
  } catch (error) {
    showStartupFailure('world-module-import', error);
    return;
  }

  const reducedMotion =
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

  const level = createLevel();
  let state = createGameState(level, CONFIG);
  let world;
  try {
    world = new World(el('scene'), level, { reducedMotion });
  } catch (error) {
    showStartupFailure('world-construction', error);
    return;
  }

  const input = new InputController();
  input.attach(window);
  const audio = new AudioEngine();

  const ui = {
    hud: el('hud'),
    coins: el('coin-count'),
    deaths: el('death-count'),
    time: el('time-count'),
    progressBar: el('progress-bar'),
    progressFill: el('progress-fill'),
    title: el('title-screen'),
    pause: el('pause-screen'),
    victory: el('victory-screen'),
    victorySummary: el('victory-summary'),
    victoryBest: el('victory-best'),
    bestRun: el('best-run'),
    toast: el('toast'),
    touch: el('touch-controls'),
    soundToggle: el('sound-toggle')
  };

  const supportsTouch =
    window.matchMedia?.('(pointer: coarse)')?.matches || 'ontouchstart' in window;

  let mode = 'title'; // title | playing | paused | victory
  let toastTimer = 0;

  const best = loadBest();
  if (best) {
    ui.bestRun.hidden = false;
    ui.bestRun.textContent = `Best run: ${best.score} points · ${best.coins} coins · ${formatTime(best.time)}`;
  }

  function showToast(message) {
    ui.toast.textContent = message;
    ui.toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('is-visible'), 1800);
  }

  function refreshHud() {
    ui.coins.textContent = `${state.coinsCollected} / ${level.totalCoins}`;
    ui.deaths.textContent = String(state.deaths);
    ui.time.textContent = formatTime(state.elapsed);
    const progress = Math.round(levelProgress(state) * 100);
    ui.progressFill.style.width = `${progress}%`;
    ui.progressBar.setAttribute('aria-valuenow', String(progress));
  }

  function startRun() {
    resetLevel(level);
    state = createGameState(level, CONFIG);
    refreshHud();
  }

  function setMode(next) {
    mode = next;
    // Keys pressed in a menu must not trigger a jump on the first play frame.
    input.clearEdges();
    ui.title.hidden = next !== 'title';
    ui.pause.hidden = next !== 'paused';
    ui.victory.hidden = next !== 'victory';
    ui.hud.hidden = next === 'title';
    ui.touch.hidden = !supportsTouch || next !== 'playing';
  }

  function handleEvents(events) {
    for (const event of events) {
      switch (event.type) {
        case 'jump':
        case 'doubleJump':
          audio.play(event.type);
          break;
        case 'coin':
          audio.play('coin');
          world.spawnSparkle(event.coin);
          break;
        case 'stomp':
          audio.play('stomp');
          break;
        case 'checkpoint':
          audio.play('checkpoint');
          showToast('Checkpoint saved!');
          break;
        case 'death':
          audio.play('death');
          showToast(
            event.cause === 'fall' ? 'Whoops — back to the last flag!' : 'Ouch! Try again.'
          );
          break;
        case 'victory':
          audio.play('victory');
          finishRun();
          break;
        default:
          break;
      }
    }
  }

  function finishRun() {
    const score = computeScore(state);
    const record = { score, coins: state.coinsCollected, time: Math.round(state.elapsed) };
    const stored = saveBest(record);
    ui.victorySummary.textContent = `${state.coinsCollected} of ${level.totalCoins} sky coins · ${formatTime(state.elapsed)} · ${state.deaths} falls · ${score} points`;
    if (stored) {
      ui.victoryBest.hidden = false;
      ui.victoryBest.textContent =
        stored.score === score ? 'New personal best saved on this device!' : `Personal best: ${stored.score} points`;
    } else {
      ui.victoryBest.hidden = true;
    }
    setMode('victory');
  }

  // --- Touch controls -------------------------------------------------------
  const stick = el('stick');
  const knob = el('stick-knob');
  let stickPointer = null;

  const stickMove = (event) => {
    if (stickPointer !== event.pointerId) return;
    const rect = stick.getBoundingClientRect();
    const { x: clampedX, z: clampedY } = computeStickAxis(rect, event.clientX, event.clientY);
    input.setTouchAxis(clampedX, -clampedY);
    const radius = (rect.width || 0) / 2;
    knob.style.transform = `translate(${clampedX * radius * 0.5}px, ${clampedY * radius * 0.5}px)`;
  };

  const stickEnd = (event) => {
    if (stickPointer !== event.pointerId) return;
    stickPointer = null;
    input.setTouchAxis(0, 0);
    knob.style.transform = '';
  };

  stick.addEventListener('pointerdown', (event) => {
    stickPointer = event.pointerId;
    stick.setPointerCapture(event.pointerId);
    stickMove(event);
  });
  stick.addEventListener('pointermove', stickMove);
  stick.addEventListener('pointerup', stickEnd);
  stick.addEventListener('pointercancel', stickEnd);

  const jumpButton = el('touch-jump');
  jumpButton.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    input.setTouchJump(true);
  });
  const releaseJump = () => input.setTouchJump(false);
  jumpButton.addEventListener('pointerup', releaseJump);
  jumpButton.addEventListener('pointerleave', releaseJump);
  jumpButton.addEventListener('pointercancel', releaseJump);

  // --- UI wiring ------------------------------------------------------------
  function beginGame() {
    audio.start();
    startRun();
    setMode('playing');
  }

  el('start-button').addEventListener('click', beginGame);
  el('play-again-button').addEventListener('click', beginGame);
  el('resume-button').addEventListener('click', () => setMode('playing'));
  el('restart-button').addEventListener('click', beginGame);
  el('pause-button').addEventListener('click', () => togglePause());

  function togglePause() {
    if (mode === 'playing') setMode('paused');
    else if (mode === 'paused') setMode('playing');
  }
  input.onPause = () => {
    if (mode === 'title' || mode === 'victory') return;
    togglePause();
  };
  input.onInteract = () => audio.start();

  ui.soundToggle.addEventListener('click', () => {
    audio.start();
    const enabled = ui.soundToggle.getAttribute('aria-pressed') !== 'true';
    ui.soundToggle.setAttribute('aria-pressed', String(enabled));
    ui.soundToggle.setAttribute('aria-label', enabled ? 'Sound on' : 'Sound off');
    ui.soundToggle.textContent = enabled ? '🔊' : '🔈';
    audio.setEnabled(enabled);
  });

  window.addEventListener('resize', () => world.resize());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && mode === 'playing') setMode('paused');
  });

  // --- Runtime failure / context-loss handling -------------------------------
  // If something goes wrong mid-run (an exception in the update/render path,
  // NaN state, or the GPU dropping the WebGL context) we must not keep
  // silently scheduling frames against a canvas that renders nothing while
  // the touch/HUD overlays stay visible on top of it. `running` gates the
  // rAF loop so it can only ever be scheduled once and never restarts itself
  // after a failure.
  let running = true;

  function haltAfterFailure(reason, error) {
    if (!running) return;
    running = false;
    console.error(`[Cloud Kingdom] halting after runtime failure (${reason})`, error);
    mode = 'paused';
    input.clearEdges();
    input.keys.clear();
    input.jumpHeld = false;
    input.setTouchAxis(0, 0);
    ui.title.hidden = true;
    ui.pause.hidden = true;
    ui.victory.hidden = true;
    ui.hud.hidden = true;
    ui.touch.hidden = true;
    el('runtime-error').hidden = false;
  }

  el('runtime-error-reload').addEventListener('click', () => window.location.reload());

  const canvas = world.renderer.domElement;
  canvas.addEventListener(
    'webglcontextlost',
    (event) => {
      // preventDefault signals the browser we'd like a restore event, but we
      // don't attempt in-place GPU-resource recreation here — pausing and
      // asking for a reload is the safe option for a scene this size.
      event.preventDefault();
      haltAfterFailure('webglcontextlost');
    },
    false
  );
  canvas.addEventListener(
    'webglcontextrestored',
    () => {
      console.warn('[Cloud Kingdom] WebGL context restored; reload to resume playing.');
    },
    false
  );

  // --- Main loop ------------------------------------------------------------
  let last = performance.now();
  let accumulator = 0;

  function frame(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    try {
      if (mode === 'playing') {
        accumulator += dt;
        const sample = input.sample();
        let stepInput = sample;
        while (accumulator >= FIXED_STEP) {
          handleEvents(updateGame(state, stepInput, FIXED_STEP));
          // Jump edges are only consumed by the first sub-step.
          stepInput = { ...stepInput, jumpPressed: false };
          accumulator -= FIXED_STEP;
          if (mode !== 'playing') break;
        }

        const p = state.player.position;
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) {
          throw new Error('Player position became non-finite');
        }

        refreshHud();
      }

      world.update(state, dt);
    } catch (error) {
      haltAfterFailure('frame-exception', error);
      return;
    }

    requestAnimationFrame(frame);
  }

  refreshHud();
  setMode('title');
  world.resize();
  requestAnimationFrame(frame);
}

boot();
