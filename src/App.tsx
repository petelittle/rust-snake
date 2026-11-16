import { useCallback, useEffect, useRef, useState } from 'react';
import { BevySourceModal } from './components/BevySourceModal';
import { GameHud } from './components/GameHud';
import { StatusModal } from './components/StatusModal';
import { TitleOverlay } from './components/TitleOverlay';
import { soundEngine } from './game/audio';
import { ArenaRenderer, type BoardMetrics } from './game/renderer';
import {
  advanceWorld,
  createWorld,
  pushTurnInput,
  toHudSnapshot,
} from './game/rules';
import type { Direction, GameMode, GameWorld, HudSnapshot } from './game/types';

const BEST_SCORE_STORAGE_KEY = 'vipera_bevy_best_score';

function readStoredBest(): number {
  try {
    const raw = window.localStorage.getItem(BEST_SCORE_STORAGE_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function writeStoredBest(score: number): void {
  try {
    window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(Math.round(score)));
  } catch {
    // Ignore storage restriction in private/iframe contexts
  }
}

function toBodyDatasetState(phase: GameWorld['phase']): string {
  if (phase === 'dying') return 'playing';
  if (phase === 'victory') return 'gameover';
  return phase;
}

export default function App() {
  const initialAutostart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const initialWorld = createWorld(
    'classic',
    initialAutostart ? 'playing' : 'title',
    typeof window !== 'undefined' ? readStoredBest() : 0
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<GameWorld>(initialWorld);
  const rendererRef = useRef<ArenaRenderer>(new ArenaRenderer());
  const metricsRef = useRef<BoardMetrics | null>(null);
  const sourceOpenRef = useRef(false);
  const touchOriginRef = useRef<{ x: number; y: number } | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(() => toHudSnapshot(initialWorld));
  const [muted, setMuted] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);

  sourceOpenRef.current = sourceOpen;

  const syncHudFromWorld = useCallback(() => {
    const w = worldRef.current;
    document.body.dataset.state = toBodyDatasetState(w.phase);
    const snap = toHudSnapshot(w);
    setHud((prev) => {
      if (
        prev.phase === snap.phase &&
        prev.mode === snap.mode &&
        prev.score === snap.score &&
        prev.bestScore === snap.bestScore &&
        prev.length === snap.length &&
        prev.applesEaten === snap.applesEaten &&
        prev.combo === snap.combo &&
        prev.peakCombo === snap.peakCombo &&
        Math.abs(prev.comboRatio - snap.comboRatio) < 0.04 &&
        prev.crashReason === snap.crashReason
      ) {
        return prev;
      }
      return snap;
    });
  }, []);

  const startGame = useCallback(
    (overrideMode?: GameMode) => {
      const targetMode = overrideMode ?? worldRef.current.mode;
      const best = Math.max(worldRef.current.bestScore, readStoredBest());
      const fresh = createWorld(targetMode, 'playing', best);
      fresh.boostActive = false;
      worldRef.current = fresh;
      rendererRef.current.clearEffects();
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      syncHudFromWorld();
    },
    [syncHudFromWorld]
  );

  const selectMode = useCallback(
    (nextMode: GameMode) => {
      const best = Math.max(worldRef.current.bestScore, readStoredBest());
      worldRef.current = createWorld(nextMode, 'title', best);
      rendererRef.current.clearEffects();
      syncHudFromWorld();
    },
    [syncHudFromWorld]
  );

  const togglePause = useCallback(() => {
    const w = worldRef.current;
    if (w.phase === 'playing') {
      w.phase = 'paused';
      w.boostActive = false;
      syncHudFromWorld();
    } else if (w.phase === 'paused') {
      w.phase = 'playing';
      w.boostActive = false;
      syncHudFromWorld();
    }
  }, [syncHudFromWorld]);

  const returnToTitle = useCallback(() => {
    const mode = worldRef.current.mode;
    const best = Math.max(worldRef.current.bestScore, readStoredBest());
    worldRef.current = createWorld(mode, 'title', best);
    rendererRef.current.clearEffects();
    syncHudFromWorld();
  }, [syncHudFromWorld]);

  const toggleMute = useCallback(() => {
    const nextMuted = soundEngine.toggleMute();
    setMuted(nextMuted);
  }, []);

  const handleSteer = useCallback((dir: Direction) => {
    const w = worldRef.current;
    if (w.phase !== 'playing') return;
    if (pushTurnInput(w, dir)) {
      soundEngine.playTurn();
    }
  }, []);

  // Main 60fps simulation & canvas render loop (mounted once)
  useEffect(() => {
    document.body.dataset.state = toBodyDatasetState(worldRef.current.phase);

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let viewportW = container.clientWidth || window.innerWidth;
    let viewportH = container.clientHeight || window.innerHeight;

    const applyCanvasSize = (w: number, h: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      viewportW = Math.max(1, w);
      viewportH = Math.max(1, h);
      canvas.width = Math.floor(viewportW * dpr);
      canvas.height = Math.floor(viewportH * dpr);
      canvas.style.width = `${viewportW}px`;
      canvas.style.height = `${viewportH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    applyCanvasSize(viewportW, viewportH);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        applyCanvasSize(entry.contentRect.width, entry.contentRect.height);
      }
    });
    resizeObserver.observe(container);

    let rafId = 0;
    let lastTime = performance.now();
    let hudThrottleAcc = 0;
    let lastRenderedPhase = '';
    let lastRenderedSize = '';

    const frame = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0), 0.05);

      const world = worldRef.current;
      const prevPhase = world.phase;
      const prevScore = world.score;
      const prevLength = world.segments.length;
      const prevCombo = world.combo;

      const isActiveSim = world.phase === 'playing' || world.phase === 'title' || world.phase === 'dying';
      const events = sourceOpenRef.current || !isActiveSim ? [] : advanceWorld(world, dt);

      if (events.length > 0) {
        const metrics =
          metricsRef.current ??
          rendererRef.current.computeBoardMetrics(
            viewportW,
            viewportH,
            world.width,
            world.height
          );
        rendererRef.current.emitEvents(events, metrics);
        for (const ev of events) {
          if (ev.type === 'eat') {
            soundEngine.playEat(ev.combo ?? 1);
            writeStoredBest(world.bestScore);
          } else if (ev.type === 'bonus') {
            soundEngine.playBonus();
            writeStoredBest(world.bestScore);
          } else if (ev.type === 'crash') {
            soundEngine.playCrash();
            writeStoredBest(world.bestScore);
          } else if (ev.type === 'victory') {
            soundEngine.playBonus();
            writeStoredBest(world.bestScore);
          }
        }
      }

      const effectsBefore = rendererRef.current.hasActiveEffects();
      if (effectsBefore) {
        rendererRef.current.updateEffects(dt);
      }

      const sizeKey = `${viewportW}x${viewportH}:${world.mode}`;
      const needsRender =
        isActiveSim ||
        effectsBefore ||
        lastRenderedPhase !== world.phase ||
        lastRenderedSize !== sizeKey;

      if (needsRender) {
        metricsRef.current = rendererRef.current.render(ctx, viewportW, viewportH, world);
        lastRenderedPhase = world.phase;
        lastRenderedSize = sizeKey;
      }

      hudThrottleAcc += dt;
      const discreteChanged =
        world.phase !== prevPhase ||
        world.score !== prevScore ||
        world.segments.length !== prevLength ||
        world.combo !== prevCombo;

      if (discreteChanged || (world.comboRemainingSec > 0 && hudThrottleAcc >= 0.08)) {
        hudThrottleAcc = 0;
        syncHudFromWorld();
      }

      rafId = window.requestAnimationFrame(frame);
    };

    rafId = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, [syncHudFromWorld]);

  // Unified keyboard & focus-loss input hygiene
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (sourceOpenRef.current) {
        if (e.key === 'Escape') {
          setSourceOpen(false);
        }
        return;
      }

      const w = worldRef.current;
      const key = e.key;

      if (key === 'm' || key === 'M') {
        e.preventDefault();
        toggleMute();
        return;
      }

      if (w.phase === 'title') {
        if (key === 'Enter' || key === ' ') {
          e.preventDefault();
          startGame();
        }
        return;
      }

      if (w.phase === 'gameover' || w.phase === 'victory') {
        if (key === 'Enter' || key === 'r' || key === 'R') {
          e.preventDefault();
          startGame();
        }
        return;
      }

      if (key === 'Escape' || key === 'p' || key === 'P') {
        e.preventDefault();
        togglePause();
        return;
      }

      if (key === 'r' || key === 'R') {
        e.preventDefault();
        startGame();
        return;
      }

      if (w.phase !== 'playing') return;

      if (key === ' ' || key === 'Shift') {
        e.preventDefault();
        w.boostActive = true;
        return;
      }

      let dir: Direction | null = null;
      if (key === 'ArrowUp' || key === 'w' || key === 'W') dir = 'up';
      else if (key === 'ArrowDown' || key === 's' || key === 'S') dir = 'down';
      else if (key === 'ArrowLeft' || key === 'a' || key === 'A') dir = 'left';
      else if (key === 'ArrowRight' || key === 'd' || key === 'D') dir = 'right';

      if (dir) {
        e.preventDefault();
        handleSteer(dir);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Shift') {
        worldRef.current.boostActive = false;
      }
    };

    const clearHeldInputs = () => {
      worldRef.current.boostActive = false;
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        clearHeldInputs();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearHeldInputs);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearHeldInputs);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [handleSteer, startGame, toggleMute, togglePause]);

  return (
    <main className="relative h-full w-full overflow-hidden bg-[#090c11] select-none">
      <div
        ref={containerRef}
        className="h-full w-full"
        onTouchStart={(e) => {
          const touch = e.touches[0];
          if (touch) {
            touchOriginRef.current = { x: touch.clientX, y: touch.clientY };
          }
        }}
        onTouchEnd={(e) => {
          const start = touchOriginRef.current;
          const touch = e.changedTouches[0];
          touchOriginRef.current = null;
          if (!start || !touch) return;
          const dx = touch.clientX - start.x;
          const dy = touch.clientY - start.y;
          if (Math.hypot(dx, dy) < 22) return;
          if (Math.abs(dx) > Math.abs(dy)) {
            handleSteer(dx > 0 ? 'right' : 'left');
          } else {
            handleSteer(dy > 0 ? 'down' : 'up');
          }
        }}
      >
        <canvas
          ref={canvasRef}
          data-testid="game-canvas"
          className="block h-full w-full"
        />
      </div>

      {hud.phase === 'title' && (
        <TitleOverlay
          mode={hud.mode}
          bestScore={hud.bestScore}
          onSelectMode={selectMode}
          onStart={() => startGame()}
          onOpenSource={() => setSourceOpen(true)}
        />
      )}

      <GameHud
        hud={hud}
        muted={muted}
        onToggleMute={toggleMute}
        onTogglePause={togglePause}
        onRestart={() => startGame()}
        onTouchSteer={handleSteer}
      />

      <StatusModal
        hud={hud}
        onResume={togglePause}
        onRestart={() => startGame()}
        onReturnTitle={returnToTitle}
        onOpenSource={() => setSourceOpen(true)}
      />

      <BevySourceModal
        open={sourceOpen}
        onClose={() => setSourceOpen(false)}
      />
    </main>
  );
}
