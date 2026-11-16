import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceWorld,
  createWorld,
  pushTurnInput,
  stepSnake,
  BLITZ_OBSTACLES,
} from './rules';

test('initial snake spawns on open runway facing right and survives idle ticks', () => {
  const world = createWorld('classic', 'playing', 0, () => 0.5);
  assert.equal(world.direction, 'right');
  assert.equal(world.segments.length, 4);
  const events = advanceWorld(world, 0.04);
  assert.equal(events.length, 0);
  assert.equal(world.phase, 'playing');

  // Survives 1.5 seconds with zero input
  for (let i = 0; i < 35; i++) {
    advanceWorld(world, 0.045, () => 0.5);
  }
  assert.equal(world.phase, 'playing');
  assert.ok(world.segments[0].x > 4);
});

test('title demo mode does not inflate bestScore when demo eats food', () => {
  const world = createWorld('classic', 'title', 40, () => 0.5);
  const head = world.segments[0];
  world.food = { x: head.x + 1, y: head.y };
  world.score = 100;
  stepSnake(world, () => 0.5);
  assert.equal(world.bestScore, 40);
});

test('input queue prevents 180-degree self-reversal and buffers 2 turns cleanly', () => {
  const world = createWorld('classic', 'playing', 0, () => 0.5);
  assert.equal(pushTurnInput(world, 'left'), false);
  assert.equal(pushTurnInput(world, 'up'), true);
  assert.equal(pushTurnInput(world, 'left'), true);
  // Queue full at 2 items
  assert.equal(pushTurnInput(world, 'down'), false);
  assert.deepEqual(world.inputQueue, ['up', 'left']);

  stepSnake(world, () => 0.5);
  assert.equal(world.direction, 'up');
  stepSnake(world, () => 0.5);
  assert.equal(world.direction, 'left');
});

test('eating food grows snake, increments score with combo, and spawns new food', () => {
  const world = createWorld('classic', 'playing', 0, () => 0.25);
  const head = world.segments[0];
  world.food = { x: head.x + 1, y: head.y };

  const events = stepSnake(world, () => 0.25);
  assert.equal(events[0]?.type, 'eat');
  assert.equal(world.segments.length, 5);
  assert.equal(world.applesEaten, 1);
  assert.equal(world.score, 10);
  assert.equal(world.combo, 1);

  // Eat second apple immediately within combo window -> combo increases to 2x
  const nextHead = world.segments[0];
  world.food = { x: nextHead.x + 1, y: nextHead.y };
  const events2 = stepSnake(world, () => 0.35);
  assert.equal(events2[0]?.type, 'eat');
  assert.equal(world.combo, 2);
  assert.equal(world.score, 30);
});

test('classic mode triggers dying beat then gameover on wall collision', () => {
  const world = createWorld('classic', 'playing', 0, () => 0.5);
  world.segments = [
    { x: world.width - 1, y: 9 },
    { x: world.width - 2, y: 9 },
    { x: world.width - 3, y: 9 },
    { x: world.width - 4, y: 9 },
  ];
  world.direction = 'right';

  const events = stepSnake(world, () => 0.5);
  assert.equal(events[0]?.type, 'crash');
  assert.equal(world.crashReason, 'wall');
  assert.equal(world.phase, 'dying');

  // After hitstop + dying beat, transitions cleanly to gameover
  for (let i = 0; i < 15; i++) {
    advanceWorld(world, 0.05);
  }
  assert.equal(world.phase, 'gameover');
});

test('wrap mode wraps across arena boundaries seamlessly', () => {
  const world = createWorld('wrap', 'playing', 0, () => 0.5);
  world.segments = [
    { x: world.width - 1, y: 9 },
    { x: world.width - 2, y: 9 },
    { x: world.width - 3, y: 9 },
    { x: world.width - 4, y: 9 },
  ];
  world.direction = 'right';
  world.food = { x: 2, y: 2 };

  const events = stepSnake(world, () => 0.5);
  assert.equal(events.length, 0);
  assert.equal(world.phase, 'playing');
  assert.equal(world.segments[0].x, 0);
});

test('blitz mode includes obstacles and detects obstacle collision', () => {
  const world = createWorld('blitz', 'playing', 0, () => 0.5);
  assert.equal(world.obstacles.length, BLITZ_OBSTACLES.length);
  const pylon = world.obstacles[0];
  world.segments = [
    { x: pylon.x - 1, y: pylon.y },
    { x: pylon.x - 2, y: pylon.y },
    { x: pylon.x - 3, y: pylon.y },
  ];
  world.direction = 'right';

  const events = stepSnake(world, () => 0.5);
  assert.equal(events[0]?.type, 'crash');
  assert.equal(world.crashReason, 'obstacle');
  assert.equal(world.phase, 'dying');
});
