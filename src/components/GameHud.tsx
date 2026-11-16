import type { Direction, HudSnapshot } from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  muted: boolean;
  onToggleMute: () => void;
  onTogglePause: () => void;
  onRestart: () => void;
  onTouchSteer: (dir: Direction) => void;
}

export function GameHud({
  hud,
  muted,
  onToggleMute,
  onTogglePause,
  onRestart,
  onTouchSteer,
}: GameHudProps) {
  const showPlayHud =
    hud.phase === 'playing' || hud.phase === 'paused' || hud.phase === 'dying';

  if (!showPlayHud) return null;

  return (
    <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-5">
      {/* Top Perimeter Clusters */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left Readouts */}
        <div
          className="flex items-center gap-4 sm:gap-6 rounded-lg border border-slate-700/60 px-3.5 py-2 shadow-lg"
          style={{ backgroundColor: 'rgba(13, 18, 26, 0.88)' }}
        >
          <div className="flex flex-col">
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
              Score
            </span>
            <span
              data-testid="hud-score"
              className="font-mono-tabular text-xl sm:text-2xl font-bold leading-none text-slate-50"
            >
              {Math.round(hud.score)}
            </span>
          </div>

          <div className="h-7 w-px bg-slate-700/70" aria-hidden="true" />

          <div className="flex flex-col">
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
              Best
            </span>
            <span
              data-testid="hud-best"
              className="font-mono-tabular text-xl sm:text-2xl font-bold leading-none text-amber-400"
            >
              {Math.round(hud.bestScore)}
            </span>
          </div>

          <div className="h-7 w-px bg-slate-700/70" aria-hidden="true" />

          <div className="flex flex-col">
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
              Length
            </span>
            <span
              data-testid="hud-length"
              className="font-mono-tabular text-xl sm:text-2xl font-bold leading-none text-emerald-400"
            >
              {Math.round(hud.length)}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-3">
            <div className="h-7 w-px bg-slate-700/70" aria-hidden="true" />
            <div className="flex flex-col min-w-[54px]">
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Combo
              </span>
              <span
                data-testid="hud-combo"
                className={`font-mono-tabular text-xl font-bold leading-none ${
                  hud.combo > 1 ? 'text-orange-400' : 'text-slate-300'
                }`}
              >
                {Math.round(hud.combo)}x
              </span>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-sm bg-slate-800">
                <div
                  className="h-full bg-orange-500 transition-transform duration-75 origin-left"
                  style={{ transform: `scaleX(${Math.max(0, Math.min(1, hud.comboRatio))})` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Top-Right Utility Controls */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            tabIndex={-1}
            aria-label={muted ? 'Unmute audio (M)' : 'Mute audio (M)'}
            title="Mute [M]"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700/70 text-slate-200 transition-colors hover:bg-slate-800 hover:text-white cursor-pointer"
            style={{ backgroundColor: 'rgba(13, 18, 26, 0.88)' }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" fillOpacity="0.2" />
              {muted ? (
                <>
                  <line x1="22" y1="9" x2="16" y2="15" />
                  <line x1="16" y1="9" x2="22" y2="15" />
                </>
              ) : (
                <>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </>
              )}
            </svg>
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label={hud.phase === 'paused' ? 'Resume game (P)' : 'Pause game (P)'}
            title="Pause [P]"
            onClick={(e) => {
              e.currentTarget.blur();
              onTogglePause();
            }}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700/70 text-slate-200 transition-colors hover:bg-slate-800 hover:text-white cursor-pointer"
            style={{ backgroundColor: 'rgba(13, 18, 26, 0.88)' }}
          >
            {hud.phase === 'paused' ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <polygon points="7 5 19 12 7 19 7 5" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            )}
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="Restart game (R)"
            title="Restart [R]"
            onClick={(e) => {
              e.currentTarget.blur();
              onRestart();
            }}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700/70 text-slate-200 transition-colors hover:bg-slate-800 hover:text-white cursor-pointer"
            style={{ backgroundColor: 'rgba(13, 18, 26, 0.88)' }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <polyline points="3 3 3 8 8 8" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Touch D-Pad (hidden on desktop) */}
      <div className="sm:hidden pointer-events-auto mx-auto mb-1 grid grid-cols-3 gap-1.5 w-40">
        <div />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Move up"
          onClick={(e) => {
            e.currentTarget.blur();
            onTouchSteer('up');
          }}
          className="flex h-11 items-center justify-center rounded-lg border border-slate-700 text-slate-100 active:bg-emerald-600"
          style={{ backgroundColor: 'rgba(15, 20, 29, 0.9)' }}
        >
          ▲
        </button>
        <div />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Move left"
          onClick={(e) => {
            e.currentTarget.blur();
            onTouchSteer('left');
          }}
          className="flex h-11 items-center justify-center rounded-lg border border-slate-700 text-slate-100 active:bg-emerald-600"
          style={{ backgroundColor: 'rgba(15, 20, 29, 0.9)' }}
        >
          ◀
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label="Move down"
          onClick={(e) => {
            e.currentTarget.blur();
            onTouchSteer('down');
          }}
          className="flex h-11 items-center justify-center rounded-lg border border-slate-700 text-slate-100 active:bg-emerald-600"
          style={{ backgroundColor: 'rgba(15, 20, 29, 0.9)' }}
        >
          ▼
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label="Move right"
          onClick={(e) => {
            e.currentTarget.blur();
            onTouchSteer('right');
          }}
          className="flex h-11 items-center justify-center rounded-lg border border-slate-700 text-slate-100 active:bg-emerald-600"
          style={{ backgroundColor: 'rgba(15, 20, 29, 0.9)' }}
        >
          ▶
        </button>
      </div>
    </div>
  );
}
