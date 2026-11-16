import type { HudSnapshot } from '../game/types';

interface StatusModalProps {
  hud: HudSnapshot;
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
  onOpenSource: () => void;
}

export function StatusModal({
  hud,
  onResume,
  onRestart,
  onReturnTitle,
  onOpenSource,
}: StatusModalProps) {
  if (hud.phase !== 'paused' && hud.phase !== 'gameover' && hud.phase !== 'victory') {
    return null;
  }

  const isPaused = hud.phase === 'paused';
  const isVictory = hud.phase === 'victory';

  const titleText = isPaused
    ? 'Simulation Paused'
    : isVictory
      ? 'Arena Cleared'
      : 'Run Ended';

  const subtitleText = isPaused
    ? 'Take a breath. Your current snake state and combo are preserved.'
    : isVictory
      ? 'Every playable cell in the arena has been mastered.'
      : hud.crashReason === 'wall'
        ? 'Collided with the outer copper boundary.'
        : hud.crashReason === 'obstacle'
          ? 'Struck a forged Blitz pylon.'
          : 'Collided with your own serpent tail.';

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(9, 12, 17, 0.78)' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="status-modal-title"
        className="w-full max-w-md rounded-xl border border-slate-700/70 p-6 shadow-2xl"
        style={{ backgroundColor: 'rgba(15, 20, 29, 0.96)' }}
      >
        <h2
          id="status-modal-title"
          className="font-display text-2xl font-bold text-slate-50"
        >
          {titleText}
        </h2>
        <p className="mt-1.5 text-sm text-slate-300">{subtitleText}</p>

        <div className="mt-5 grid grid-cols-3 gap-3 rounded-lg border border-slate-800 bg-[#0a0e14] p-3.5">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400">Score</div>
            <div className="font-mono-tabular mt-0.5 text-xl font-bold text-slate-50">
              {Math.round(hud.score)}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400">Best</div>
            <div className="font-mono-tabular mt-0.5 text-xl font-bold text-amber-400">
              {Math.round(hud.bestScore)}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400">Peak Combo</div>
            <div className="font-mono-tabular mt-0.5 text-xl font-bold text-emerald-400">
              {Math.round(hud.peakCombo)}x
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2.5">
          {isPaused ? (
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onResume();
              }}
              className="min-h-[44px] w-full rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white whitespace-nowrap shrink-0 transition-colors hover:bg-emerald-500 cursor-pointer"
            >
              Resume Game
            </button>
          ) : (
            <button
              type="button"
              data-start="true"
              onClick={(e) => {
                e.currentTarget.blur();
                onRestart();
              }}
              className="min-h-[44px] w-full rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white whitespace-nowrap shrink-0 transition-colors hover:bg-orange-500 cursor-pointer"
            >
              Try Again
            </button>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onRestart();
              }}
              className="min-h-[42px] rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-200 whitespace-nowrap shrink-0 transition-colors hover:bg-slate-800 hover:text-white cursor-pointer"
            >
              Restart Run
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onReturnTitle();
              }}
              className="min-h-[42px] rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-200 whitespace-nowrap shrink-0 transition-colors hover:bg-slate-800 hover:text-white cursor-pointer"
            >
              Title Screen
            </button>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenSource();
            }}
            className="min-h-[40px] w-full rounded-lg border border-slate-800 bg-transparent px-4 py-2 text-xs font-medium text-slate-300 whitespace-nowrap shrink-0 transition-colors hover:bg-slate-800/60 hover:text-white cursor-pointer"
          >
            View Rust + Bevy Source
          </button>
        </div>
      </div>
    </div>
  );
}
