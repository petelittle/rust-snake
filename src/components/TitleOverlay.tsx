import type { GameMode } from '../game/types';

interface TitleOverlayProps {
  mode: GameMode;
  bestScore: number;
  onSelectMode: (mode: GameMode) => void;
  onStart: () => void;
}

const MODE_OPTIONS: { id: GameMode; label: string; detail: string }[] = [
  { id: 'classic', label: 'Classic', detail: 'Solid arena walls · Pure speed curve' },
  { id: 'wrap', label: 'Wrap', detail: 'Seamless portal edges · Endless flow' },
  { id: 'blitz', label: 'Blitz', detail: 'Copper pylons · High initial velocity' },
];

export function TitleOverlay({
  mode,
  bestScore,
  onSelectMode,
  onStart,
}: TitleOverlayProps) {
  const activeMode = MODE_OPTIONS.find((m) => m.id === mode) ?? MODE_OPTIONS[0];

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-between px-6 py-6 pointer-events-none"
      style={{ backgroundColor: 'rgba(9, 12, 17, 0.72)' }}
    >
      <div className="w-full max-w-5xl flex items-center justify-between text-xs text-slate-400">
        <span className="font-mono-tabular tracking-wide text-slate-300">
          Rust · Bevy ECS Architecture
        </span>
        {bestScore > 0 && (
          <span className="font-mono-tabular text-amber-400">
            Best {Math.round(bestScore)}
          </span>
        )}
      </div>

      <div
        className="pointer-events-auto w-full max-w-md rounded-xl border border-slate-700/60 p-7 text-center shadow-2xl"
        style={{ backgroundColor: 'rgba(15, 20, 29, 0.94)' }}
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center">
          <svg
            viewBox="0 0 64 64"
            className="h-16 w-16"
            aria-hidden="true"
          >
            <polygon
              points="32,4 56,18 56,46 32,60 8,46 8,18"
              fill="#111827"
              stroke="#ea580c"
              strokeWidth="2.5"
            />
            <path
              d="M20 40 C20 26, 30 22, 38 22 C44 22, 46 26, 42 31 C38 35, 26 33, 26 42 C26 47, 32 49, 44 46"
              fill="none"
              stroke="#34d399"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
            <circle cx="42" cy="24" r="4.5" fill="#34d399" />
            <circle cx="43.5" cy="23.2" r="1.3" fill="#090d14" />
            <circle cx="20" cy="40" r="2.5" fill="#10b981" />
          </svg>
        </div>

        <h1 className="font-display text-4xl font-bold tracking-tight text-slate-50">
          Vipera Bevy
        </h1>
        <p className="mt-2 text-sm text-slate-300">
          Fixed-step ECS snake simulation with sub-tick 60 Hz interpolation and procedural audio.
        </p>

        <div className="mt-6">
          <div
            role="group"
            aria-label="Game mode"
            className="grid grid-cols-3 gap-1 rounded-lg bg-[#090c11] p-1 border border-slate-800"
          >
            {MODE_OPTIONS.map((opt) => {
              const selected = opt.id === mode;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSelectMode(opt.id);
                  }}
                  className={`min-h-[40px] rounded-md px-3 py-2 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                    selected
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-400">{activeMode.detail}</p>
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onStart();
            }}
            className="min-h-[44px] w-full rounded-lg bg-orange-600 px-5 py-3 text-sm font-semibold text-white whitespace-nowrap shrink-0 transition-colors hover:bg-orange-500 active:bg-orange-700 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
          >
            Start Game
          </button>
          <a
            href="https://techne.livewalk.org/"
            className="flex min-h-[44px] w-full items-center justify-center rounded-lg bg-pink-600 px-5 py-3 text-sm font-semibold text-white whitespace-nowrap shrink-0 transition-colors hover:bg-pink-500 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-400"
          >
            ← Back to techne.livewalk.org
          </a>
        </div>
      </div>

      <p className="text-center text-xs text-slate-400 tracking-wide">
        WASD / Arrows Move · Hold Space Boost · P / Esc Pause · R Restart
      </p>
    </div>
  );
}
