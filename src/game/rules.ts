import type { Direction, GameMode, GamePhase, GameWorld, GridPos, HudSnapshot, StepEvent } from './types';

export const GRID_WIDTH = 24;
export const GRID_HEIGHT = 18;
export const BASE_STEP_CLASSIC = 0.135;
export const BASE_STEP_BLITZ = 0.108;
export const MIN_STEP_SEC = 0.055;
export const COMBO_WINDOW_SEC = 4.2;
export const DYING_BEAT_SEC = 0.48;

export const BLITZ_OBSTACLES: GridPos[] = [
  { x: 5, y: 4 },
  { x: 18, y: 4 },
  { x: 5, y: 13 },
  { x: 18, y: 13 },
  { x: 12, y: 3 },
  { x: 12, y: 14 },
];

export function oppositeDirection(dir: Direction): Direction {
  switch (dir) {
    case 'up':
      return 'down';
    case 'down':
      return 'up';
    case 'left':
      return 'right';
    case 'right':
      return 'left';
  }
}

export function directionDelta(dir: Direction): GridPos {
  switch (dir) {
    case 'up':
      return { x: 0, y: -1 };
    case 'down':
      return { x: 0, y: 1 };
    case 'left':
      return { x: -1, y: 0 };
    case 'right':
      return { x: 1, y: 0 };
  }
}

export function posEquals(a: GridPos, b: GridPos): boolean {
  return a.x === b.x && a.y === b.y;
}

export function wrapCoord(val: number, max: number): number {
  return ((val % max) + max) % max;
}

export function pushTurnInput(world: GameWorld, dir: Direction): boolean {
  const refDir =
    world.inputQueue.length > 0
      ? world.inputQueue[world.inputQueue.length - 1]
      : world.direction;
  if (dir === refDir || dir === oppositeDirection(refDir)) {
    return false;
  }
  if (world.inputQueue.length >= 2) {
    return false;
  }
  world.inputQueue.push(dir);
  return true;
}

export function findFreeCell(
  width: number,
  height: number,
  occupied: GridPos[],
  obstacles: GridPos[],
  rng: () => number = Math.random
): GridPos | null {
  const free: GridPos[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const blocked =
        occupied.some((p) => p.x === x && p.y === y) ||
        obstacles.some((p) => p.x === x && p.y === y);
      if (!blocked) {
        free.push({ x, y });
      }
    }
  }
  if (free.length === 0) return null;
  const idx = Math.floor(rng() * free.length) % free.length;
  return free[idx];
}

export function createWorld(
  mode: GameMode,
  phase: GamePhase,
  bestScore = 0,
  rng: () => number = Math.random
): GameWorld {
  const startY = Math.floor(GRID_HEIGHT / 2);
  const startX = 4;
  const segments: GridPos[] = [
    { x: startX, y: startY },
    { x: startX - 1, y: startY },
    { x: startX - 2, y: startY },
    { x: startX - 3, y: startY },
  ];
  const obstacles = mode === 'blitz' ? BLITZ_OBSTACLES.map((p) => ({ ...p })) : [];
  const baseStepSec = mode === 'blitz' ? BASE_STEP_BLITZ : BASE_STEP_CLASSIC;
  const food = findFreeCell(GRID_WIDTH, GRID_HEIGHT, segments, obstacles, rng) ?? {
    x: 15,
    y: startY,
  };

  return {
    mode,
    phase,
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
    segments,
    prevSegments: segments.map((s) => ({ ...s })),
    direction: 'right',
    inputQueue: [],
    food,
    bonusOrb: null,
    obstacles,
    score: 0,
    bestScore,
    applesEaten: 0,
    combo: 1,
    peakCombo: 1,
    comboRemainingSec: 0,
    comboWindowSec: COMBO_WINDOW_SEC,
    stepIntervalSec: baseStepSec,
    baseStepSec,
    minStepSec: MIN_STEP_SEC,
    stepAccumulatorSec: 0,
    boostActive: false,
    elapsedSec: 0,
    hitstopSec: 0,
    dyingTimerSec: 0,
    pendingGrow: 0,
    crashReason: null,
  };
}

export function computeStepInterval(
  baseStepSec: number,
  minStepSec: number,
  applesEaten: number
): number {
  return Math.max(minStepSec, baseStepSec - applesEaten * 0.0022);
}

export function stepSnake(
  world: GameWorld,
  rng: () => number = Math.random
): StepEvent[] {
  const events: StepEvent[] = [];

  if (world.inputQueue.length > 0) {
    const nextDir = world.inputQueue.shift()!;
    if (nextDir !== oppositeDirection(world.direction)) {
      world.direction = nextDir;
    }
  }

  const head = world.segments[0];
  const delta = directionDelta(world.direction);
  let nextHead: GridPos = { x: head.x + delta.x, y: head.y + delta.y };

  if (world.mode === 'wrap') {
    nextHead = {
      x: wrapCoord(nextHead.x, world.width),
      y: wrapCoord(nextHead.y, world.height),
    };
  } else if (
    nextHead.x < 0 ||
    nextHead.x >= world.width ||
    nextHead.y < 0 ||
    nextHead.y >= world.height
  ) {
    world.crashReason = 'wall';
    world.phase = 'dying';
    world.dyingTimerSec = DYING_BEAT_SEC;
    world.hitstopSec = 0.065;
    events.push({ type: 'crash', pos: head });
    return events;
  }

  if (world.obstacles.some((o) => posEquals(o, nextHead))) {
    world.crashReason = 'obstacle';
    world.phase = 'dying';
    world.dyingTimerSec = DYING_BEAT_SEC;
    world.hitstopSec = 0.065;
    events.push({ type: 'crash', pos: head });
    return events;
  }

  const willEatFood = posEquals(nextHead, world.food);
  const willEatBonus = world.bonusOrb !== null && posEquals(nextHead, world.bonusOrb.pos);
  const bodyCheckLimit =
    willEatFood || willEatBonus || world.pendingGrow > 0
      ? world.segments.length
      : world.segments.length - 1;

  for (let i = 0; i < bodyCheckLimit; i++) {
    if (posEquals(world.segments[i], nextHead)) {
      world.crashReason = 'self';
      world.phase = 'dying';
      world.dyingTimerSec = DYING_BEAT_SEC;
      world.hitstopSec = 0.065;
      events.push({ type: 'crash', pos: head });
      return events;
    }
  }

  // Snapshot previous positions for 60fps sub-tick visual interpolation
  world.prevSegments = world.segments.map((s) => ({ ...s }));

  const oldTail = world.segments[world.segments.length - 1];
  const newSegments: GridPos[] = [nextHead];
  for (let i = 0; i < world.segments.length - 1; i++) {
    newSegments.push(world.segments[i]);
  }

  if (willEatFood || willEatBonus || world.pendingGrow > 0) {
    newSegments.push(oldTail);
    world.prevSegments.push({ ...oldTail });
    if (world.pendingGrow > 0) {
      world.pendingGrow -= 1;
    }
  }

  world.segments = newSegments;

  if (willEatFood) {
    world.applesEaten += 1;
    world.combo = world.comboRemainingSec > 0 ? Math.min(8, world.combo + 1) : 1;
    world.peakCombo = Math.max(world.peakCombo, world.combo);
    world.comboRemainingSec = world.comboWindowSec;

    const points = 10 * world.combo;
    world.score += points;
    if (world.phase === 'playing') {
      world.bestScore = Math.max(world.bestScore, world.score);
    }
    world.stepIntervalSec = computeStepInterval(
      world.baseStepSec,
      world.minStepSec,
      world.applesEaten
    );

    events.push({ type: 'eat', pos: nextHead, points, combo: world.combo });

    const totalPlayable = world.width * world.height - world.obstacles.length;
    if (world.segments.length >= totalPlayable) {
      world.crashReason = 'victory';
      world.phase = 'victory';
      events.push({ type: 'victory', pos: nextHead });
      return events;
    }

    const nextFood = findFreeCell(
      world.width,
      world.height,
      world.segments,
      world.obstacles,
      rng
    );
    if (nextFood) {
      world.food = nextFood;
    }

    // Spawn a timed golden bonus orb every 5 apples if none is active
    if (world.applesEaten % 5 === 0 && world.bonusOrb === null) {
      const occupiedWithFood = [...world.segments, world.food];
      const orbPos = findFreeCell(
        world.width,
        world.height,
        occupiedWithFood,
        world.obstacles,
        rng
      );
      if (orbPos) {
        world.bonusOrb = {
          pos: orbPos,
          remainingSec: 7.0,
          durationSec: 7.0,
        };
      }
    }
  }

  if (willEatBonus && world.bonusOrb) {
    const bonusPoints = 50 * world.combo;
    world.score += bonusPoints;
    if (world.phase === 'playing') {
      world.bestScore = Math.max(world.bestScore, world.score);
    }
    world.comboRemainingSec = world.comboWindowSec;
    events.push({
      type: 'bonus',
      pos: nextHead,
      points: bonusPoints,
      combo: world.combo,
    });
    world.bonusOrb = null;
  }

  return events;
}

export function advanceWorld(
  world: GameWorld,
  rawDt: number,
  rng: () => number = Math.random
): StepEvent[] {
  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  const events: StepEvent[] = [];

  if (world.phase === 'paused' || world.phase === 'gameover' || world.phase === 'victory') {
    return events;
  }

  if (world.hitstopSec > 0) {
    world.hitstopSec = Math.max(0, world.hitstopSec - dt);
    return events;
  }

  if (world.phase === 'dying') {
    world.dyingTimerSec -= dt;
    if (world.dyingTimerSec <= 0) {
      world.dyingTimerSec = 0;
      world.phase = 'gameover';
    }
    return events;
  }

  world.elapsedSec += dt;

  if (world.comboRemainingSec > 0) {
    world.comboRemainingSec = Math.max(0, world.comboRemainingSec - dt);
    if (world.comboRemainingSec === 0) {
      world.combo = 1;
    }
  }

  if (world.bonusOrb) {
    world.bonusOrb.remainingSec -= dt;
    if (world.bonusOrb.remainingSec <= 0) {
      world.bonusOrb = null;
    }
  }

  const speedScale = world.boostActive && world.phase === 'playing' ? 1.85 : 1.0;
  world.stepAccumulatorSec += dt * speedScale;

  let safetySteps = 0;
  while (
    world.stepAccumulatorSec >= world.stepIntervalSec &&
    (world.phase === 'playing' || world.phase === 'title') &&
    safetySteps < 3
  ) {
    world.stepAccumulatorSec -= world.stepIntervalSec;
    safetySteps += 1;

    if (world.phase === 'title') {
      const aiDir = pickDemoDirection(world);
      if (aiDir !== world.direction) {
        world.inputQueue = [aiDir];
      }
      const stepEvents = stepSnake(world, rng);
      for (const ev of stepEvents) {
        if (ev.type === 'crash') {
          // Seamlessly respawn demo serpent on title backdrop
          const fresh = createWorld(world.mode, 'title', world.bestScore, rng);
          Object.assign(world, fresh);
          return events;
        }
      }
    } else {
      const stepEvents = stepSnake(world, rng);
      events.push(...stepEvents);
      if (world.phase !== 'playing') {
        break;
      }
    }
  }

  return events;
}

export function pickDemoDirection(world: GameWorld): Direction {
  const head = world.segments[0];
  const candidates: Direction[] = (['up', 'down', 'left', 'right'] as Direction[]).filter(
    (d) => d !== oppositeDirection(world.direction)
  );

  const safe = candidates.filter((d) => {
    const delta = directionDelta(d);
    let nx = head.x + delta.x;
    let ny = head.y + delta.y;
    if (world.mode === 'wrap') {
      nx = wrapCoord(nx, world.width);
      ny = wrapCoord(ny, world.height);
    } else if (nx < 0 || nx >= world.width || ny < 0 || ny >= world.height) {
      return false;
    }
    if (world.obstacles.some((o) => o.x === nx && o.y === ny)) return false;
    return !world.segments.slice(0, -1).some((s) => s.x === nx && s.y === ny);
  });

  if (safe.length === 0) return world.direction;

  // Prefer direction moving closer to food while keeping current direction on ties
  let bestDir = safe[0];
  let bestDist = Infinity;
  for (const d of safe) {
    const delta = directionDelta(d);
    const nx = head.x + delta.x;
    const ny = head.y + delta.y;
    const dist =
      Math.abs(nx - world.food.x) +
      Math.abs(ny - world.food.y) +
      (d === world.direction ? -0.1 : 0);
    if (dist < bestDist) {
      bestDist = dist;
      bestDir = d;
    }
  }
  return bestDir;
}

export function toHudSnapshot(world: GameWorld): HudSnapshot {
  const speedMultiplier = Number((world.baseStepSec / world.stepIntervalSec).toFixed(1));
  return {
    phase: world.phase,
    mode: world.mode,
    score: world.score,
    bestScore: world.bestScore,
    length: world.segments.length,
    applesEaten: world.applesEaten,
    combo: world.combo,
    peakCombo: world.peakCombo,
    comboRatio:
      world.comboWindowSec > 0 ? world.comboRemainingSec / world.comboWindowSec : 0,
    speedMultiplier,
    crashReason: world.crashReason,
  };
}
