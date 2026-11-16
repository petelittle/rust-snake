export type GameMode = 'classic' | 'wrap' | 'blitz';

export type GamePhase = 'title' | 'playing' | 'paused' | 'dying' | 'gameover' | 'victory';

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface GridPos {
  x: number;
  y: number;
}

export interface BonusOrb {
  pos: GridPos;
  remainingSec: number;
  durationSec: number;
}

export interface StepEvent {
  type: 'eat' | 'bonus' | 'crash' | 'victory';
  pos: GridPos;
  points?: number;
  combo?: number;
}

export interface GameWorld {
  mode: GameMode;
  phase: GamePhase;
  width: number;
  height: number;
  segments: GridPos[];
  prevSegments: GridPos[];
  direction: Direction;
  inputQueue: Direction[];
  food: GridPos;
  bonusOrb: BonusOrb | null;
  obstacles: GridPos[];
  score: number;
  bestScore: number;
  applesEaten: number;
  combo: number;
  peakCombo: number;
  comboRemainingSec: number;
  comboWindowSec: number;
  stepIntervalSec: number;
  baseStepSec: number;
  minStepSec: number;
  stepAccumulatorSec: number;
  boostActive: boolean;
  elapsedSec: number;
  hitstopSec: number;
  dyingTimerSec: number;
  pendingGrow: number;
  crashReason: 'wall' | 'self' | 'obstacle' | 'victory' | null;
}

export interface HudSnapshot {
  phase: GamePhase;
  mode: GameMode;
  score: number;
  bestScore: number;
  length: number;
  applesEaten: number;
  combo: number;
  peakCombo: number;
  comboRatio: number;
  speedMultiplier: number;
  crashReason: GameWorld['crashReason'];
}
