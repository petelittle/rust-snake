import type { GameWorld, GridPos, StepEvent } from './types';

interface PooledParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface PooledShockwave {
  active: boolean;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  maxRadius: number;
  color: string;
}

interface PooledPopup {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  color: string;
}

export interface BoardMetrics {
  originX: number;
  originY: number;
  cellSize: number;
  boardWidth: number;
  boardHeight: number;
}

const PARTICLE_POOL_SIZE = 128;
const SHOCKWAVE_POOL_SIZE = 12;
const POPUP_POOL_SIZE = 16;

export class ArenaRenderer {
  private particles: PooledParticle[] = Array.from({ length: PARTICLE_POOL_SIZE }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 0.4,
    size: 4,
    color: '#34d399',
  }));
  private particleCursor = 0;

  private shockwaves: PooledShockwave[] = Array.from({ length: SHOCKWAVE_POOL_SIZE }, () => ({
    active: false,
    x: 0,
    y: 0,
    life: 0,
    maxLife: 0.45,
    maxRadius: 48,
    color: '#34d399',
  }));
  private shockwaveCursor = 0;

  private popups: PooledPopup[] = Array.from({ length: POPUP_POOL_SIZE }, () => ({
    active: false,
    x: 0,
    y: 0,
    vy: -42,
    life: 0,
    maxLife: 0.75,
    text: '',
    color: '#34d399',
  }));
  private popupCursor = 0;

  private trauma = 0;
  private interpSegments: { x: number; y: number }[] = [];
  private backdropCanvas: HTMLCanvasElement | null = null;
  private backdropKey = '';

  public computeBoardMetrics(
    viewportW: number,
    viewportH: number,
    gridW: number,
    gridH: number
  ): BoardMetrics {
    const isNarrow = viewportW < 640;
    const topSafe = isNarrow ? 64 : 74;
    const bottomSafe = isNarrow ? 156 : 32;
    const sideSafe = isNarrow ? 14 : 36;

    const availW = Math.max(240, viewportW - sideSafe * 2);
    const availH = Math.max(200, viewportH - topSafe - bottomSafe);
    const cellSize = Math.floor(Math.min(availW / gridW, availH / gridH));
    const boardWidth = cellSize * gridW;
    const boardHeight = cellSize * gridH;
    const originX = Math.floor((viewportW - boardWidth) * 0.5);
    const originY = Math.floor(topSafe + (availH - boardHeight) * 0.5);

    return { originX, originY, cellSize, boardWidth, boardHeight };
  }

  public emitEvents(events: StepEvent[], metrics: BoardMetrics): void {
    for (const ev of events) {
      const cx = metrics.originX + (ev.pos.x + 0.5) * metrics.cellSize;
      const cy = metrics.originY + (ev.pos.y + 0.5) * metrics.cellSize;

      if (ev.type === 'eat') {
        this.spawnBurst(cx, cy, 14, '#34d399', 150);
        this.spawnShockwave(cx, cy, metrics.cellSize * 2.1, '#34d399');
        if (ev.points) {
          const suffix = ev.combo && ev.combo > 1 ? ` x${ev.combo}` : '';
          this.spawnPopup(cx, cy - 8, `+${ev.points}${suffix}`, '#6ee7b7');
        }
      } else if (ev.type === 'bonus') {
        this.spawnBurst(cx, cy, 22, '#fbbf24', 210);
        this.spawnShockwave(cx, cy, metrics.cellSize * 3.0, '#fbbf24');
        this.trauma = Math.min(1, this.trauma + 0.28);
        if (ev.points) {
          this.spawnPopup(cx, cy - 10, `+${ev.points} BONUS`, '#fde68a');
        }
      } else if (ev.type === 'crash') {
        this.spawnBurst(cx, cy, 28, '#f97316', 240);
        this.spawnShockwave(cx, cy, metrics.cellSize * 3.4, '#ef4444');
        this.trauma = 1.0;
      } else if (ev.type === 'victory') {
        this.spawnBurst(cx, cy, 32, '#fbbf24', 260);
        this.spawnShockwave(cx, cy, metrics.cellSize * 4.0, '#34d399');
      }
    }
  }

  public clearEffects(): void {
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) this.particles[i].active = false;
    for (let i = 0; i < SHOCKWAVE_POOL_SIZE; i++) this.shockwaves[i].active = false;
    for (let i = 0; i < POPUP_POOL_SIZE; i++) this.popups[i].active = false;
    this.trauma = 0;
  }

  private spawnBurst(x: number, y: number, count: number, color: string, maxSpeed: number): void {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % PARTICLE_POOL_SIZE;
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45;
      const speed = maxSpeed * (0.35 + Math.random() * 0.65);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0;
      p.maxLife = 0.28 + Math.random() * 0.22;
      p.size = 2.5 + Math.random() * 3.5;
      p.color = color;
    }
  }

  private spawnShockwave(x: number, y: number, maxRadius: number, color: string): void {
    const sw = this.shockwaves[this.shockwaveCursor];
    this.shockwaveCursor = (this.shockwaveCursor + 1) % SHOCKWAVE_POOL_SIZE;
    sw.active = true;
    sw.x = x;
    sw.y = y;
    sw.life = 0;
    sw.maxLife = 0.38;
    sw.maxRadius = maxRadius;
    sw.color = color;
  }

  private spawnPopup(x: number, y: number, text: string, color: string): void {
    const pop = this.popups[this.popupCursor];
    this.popupCursor = (this.popupCursor + 1) % POPUP_POOL_SIZE;
    pop.active = true;
    pop.x = x;
    pop.y = y;
    pop.vy = -44;
    pop.life = 0;
    pop.maxLife = 0.72;
    pop.text = text;
    pop.color = color;
  }

  public updateEffects(dt: number): void {
    const clamped = Math.min(dt, 0.05);
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life += clamped;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }
      p.x += p.vx * clamped;
      p.y += p.vy * clamped;
      p.vx *= 0.91;
      p.vy *= 0.91;
    }

    for (let i = 0; i < SHOCKWAVE_POOL_SIZE; i++) {
      const sw = this.shockwaves[i];
      if (!sw.active) continue;
      sw.life += clamped;
      if (sw.life >= sw.maxLife) {
        sw.active = false;
      }
    }

    for (let i = 0; i < POPUP_POOL_SIZE; i++) {
      const pop = this.popups[i];
      if (!pop.active) continue;
      pop.life += clamped;
      if (pop.life >= pop.maxLife) {
        pop.active = false;
        continue;
      }
      pop.y += pop.vy * clamped;
      pop.vy *= 0.95;
    }

    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - clamped * 2.5);
    }
  }

  public hasActiveEffects(): boolean {
    if (this.trauma > 0.001) return true;
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      if (this.particles[i].active) return true;
    }
    for (let i = 0; i < SHOCKWAVE_POOL_SIZE; i++) {
      if (this.shockwaves[i].active) return true;
    }
    for (let i = 0; i < POPUP_POOL_SIZE; i++) {
      if (this.popups[i].active) return true;
    }
    return false;
  }

  private ensureBackdrop(
    viewportW: number,
    viewportH: number,
    world: GameWorld,
    m: BoardMetrics
  ): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;
    const key = `${viewportW}x${viewportH}:${world.width}x${world.height}:${world.mode}`;
    if (this.backdropCanvas && this.backdropKey === key) {
      return this.backdropCanvas;
    }

    if (!this.backdropCanvas) {
      this.backdropCanvas = document.createElement('canvas');
    }
    this.backdropCanvas.width = Math.max(1, Math.floor(viewportW));
    this.backdropCanvas.height = Math.max(1, Math.floor(viewportH));
    const bctx = this.backdropCanvas.getContext('2d', { alpha: false });
    if (!bctx) return null;

    const bgGrad = bctx.createRadialGradient(
      viewportW * 0.5,
      viewportH * 0.45,
      40,
      viewportW * 0.5,
      viewportH * 0.5,
      Math.max(viewportW, viewportH) * 0.75
    );
    bgGrad.addColorStop(0, '#121822');
    bgGrad.addColorStop(1, '#090c11');
    bctx.fillStyle = bgGrad;
    bctx.fillRect(0, 0, viewportW, viewportH);

    // Outer frame bevel
    const pad = 4;
    bctx.fillStyle = '#0d1118';
    bctx.fillRect(m.originX - pad, m.originY - pad, m.boardWidth + pad * 2, m.boardHeight + pad * 2);

    // Arena floor base
    bctx.fillStyle = '#0e131b';
    bctx.fillRect(m.originX, m.originY, m.boardWidth, m.boardHeight);

    // Subtle checkerboard pattern (drawn once on resize/mode change)
    bctx.fillStyle = 'rgba(255, 255, 255, 0.022)';
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        if ((x + y) % 2 === 0) {
          bctx.fillRect(
            m.originX + x * m.cellSize + 1,
            m.originY + y * m.cellSize + 1,
            m.cellSize - 2,
            m.cellSize - 2
          );
        }
      }
    }

    // Precision engineering crosshair ticks every 4 cells
    bctx.strokeStyle = 'rgba(148, 163, 184, 0.11)';
    bctx.lineWidth = 1;
    bctx.beginPath();
    for (let y = 4; y < world.height; y += 4) {
      for (let x = 4; x < world.width; x += 4) {
        const px = m.originX + x * m.cellSize;
        const py = m.originY + y * m.cellSize;
        bctx.moveTo(px - 3, py);
        bctx.lineTo(px + 3, py);
        bctx.moveTo(px, py - 3);
        bctx.lineTo(px, py + 3);
      }
    }
    bctx.stroke();

    this.backdropKey = key;
    return this.backdropCanvas;
  }

  public render(
    ctx: CanvasRenderingContext2D,
    viewportW: number,
    viewportH: number,
    world: GameWorld
  ): BoardMetrics {
    const metrics = this.computeBoardMetrics(viewportW, viewportH, world.width, world.height);
    const cached = this.ensureBackdrop(viewportW, viewportH, world, metrics);
    if (cached) {
      ctx.drawImage(cached, 0, 0, viewportW, viewportH);
    } else {
      ctx.fillStyle = '#090c11';
      ctx.fillRect(0, 0, viewportW, viewportH);
    }

    // Camera shake offset (trauma^2)
    ctx.save();
    if (this.trauma > 0.001) {
      const mag = this.trauma * this.trauma * 10;
      const sx = (Math.random() * 2 - 1) * mag;
      const sy = (Math.random() * 2 - 1) * mag;
      ctx.translate(sx, sy);
    }

    this.drawArenaBorder(ctx, metrics, world);
    this.drawObstacles(ctx, metrics, world.obstacles);
    this.drawFood(ctx, metrics, world);
    this.drawBonusOrb(ctx, metrics, world);
    this.drawSnake(ctx, metrics, world);
    this.drawEffects(ctx);

    ctx.restore();
    return metrics;
  }

  private drawArenaBorder(
    ctx: CanvasRenderingContext2D,
    m: BoardMetrics,
    world: GameWorld
  ): void {
    // Arena boundary line: forged copper for solid walls, dashed verdigris for wrap mode
    ctx.save();
    if (world.mode === 'wrap') {
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.55)';
      ctx.setLineDash([8, 6]);
    } else {
      ctx.strokeStyle = world.phase === 'dying' ? '#ef4444' : 'rgba(234, 88, 12, 0.65)';
    }
    ctx.lineWidth = 2;
    ctx.strokeRect(m.originX - 1, m.originY - 1, m.boardWidth + 2, m.boardHeight + 2);
    ctx.restore();
  }

  private drawObstacles(
    ctx: CanvasRenderingContext2D,
    m: BoardMetrics,
    obstacles: GridPos[]
  ): void {
    for (const obs of obstacles) {
      const cx = m.originX + (obs.x + 0.5) * m.cellSize;
      const cy = m.originY + (obs.y + 0.5) * m.cellSize;
      const r = m.cellSize * 0.4;

      // Outer chamfered copper block
      ctx.fillStyle = '#7c2d12';
      ctx.beginPath();
      ctx.roundRect(cx - r, cy - r, r * 2, r * 2, m.cellSize * 0.16);
      ctx.fill();

      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Inner dark iron core
      const ir = r * 0.48;
      ctx.fillStyle = '#1e1b18';
      ctx.beginPath();
      ctx.roundRect(cx - ir, cy - ir, ir * 2, ir * 2, m.cellSize * 0.08);
      ctx.fill();

      ctx.fillStyle = '#fb923c';
      ctx.beginPath();
      ctx.arc(cx, cy, m.cellSize * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawFood(ctx: CanvasRenderingContext2D, m: BoardMetrics, world: GameWorld): void {
    const cx = m.originX + (world.food.x + 0.5) * m.cellSize;
    const cy = m.originY + (world.food.y + 0.5) * m.cellSize;
    const pulse = 1 + Math.sin(world.elapsedSec * 5.2) * 0.1;
    const baseR = m.cellSize * 0.31 * pulse;

    // Soft bloom halo (zero-allocation layered arcs)
    ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
    ctx.beginPath();
    ctx.arc(cx, cy, m.cellSize * 0.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(52, 211, 153, 0.22)';
    ctx.beginPath();
    ctx.arc(cx, cy, m.cellSize * 0.56, 0, Math.PI * 2);
    ctx.fill();

    // Outer verdigris ring
    ctx.strokeStyle = 'rgba(110, 231, 183, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, baseR * 1.28, 0, Math.PI * 2);
    ctx.stroke();

    // Faceted energy orb core
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
    ctx.fill();

    // Specular inner diamond
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(world.elapsedSec * 1.8);
    const d = baseR * 0.56;
    ctx.fillStyle = '#a7f3d0';
    ctx.beginPath();
    ctx.moveTo(0, -d);
    ctx.lineTo(d, 0);
    ctx.lineTo(0, d);
    ctx.lineTo(-d, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawBonusOrb(ctx: CanvasRenderingContext2D, m: BoardMetrics, world: GameWorld): void {
    const orb = world.bonusOrb;
    if (!orb) return;

    const cx = m.originX + (orb.pos.x + 0.5) * m.cellSize;
    const cy = m.originY + (orb.pos.y + 0.5) * m.cellSize;
    const ratio = Math.max(0, orb.remainingSec / orb.durationSec);
    const pulse = 1 + Math.sin(world.elapsedSec * 8.5) * 0.12;
    const r = m.cellSize * 0.33 * pulse;

    ctx.fillStyle = 'rgba(245, 158, 11, 0.14)';
    ctx.beginPath();
    ctx.arc(cx, cy, m.cellSize * 0.95, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(251, 191, 36, 0.26)';
    ctx.beginPath();
    ctx.arc(cx, cy, m.cellSize * 0.62, 0, Math.PI * 2);
    ctx.fill();

    // Remaining time countdown ring
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(
      cx,
      cy,
      m.cellSize * 0.45,
      -Math.PI * 0.5,
      -Math.PI * 0.5 + Math.PI * 2 * ratio
    );
    ctx.stroke();

    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.arc(cx - r * 0.22, cy - r * 0.22, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawSnake(ctx: CanvasRenderingContext2D, m: BoardMetrics, world: GameWorld): void {
    const len = world.segments.length;
    if (len === 0) return;

    // Keep reusable array sized to segment count (zero GC churn)
    while (this.interpSegments.length < len) {
      this.interpSegments.push({ x: 0, y: 0 });
    }

    const alpha =
      world.phase === 'playing' || world.phase === 'title'
        ? Math.min(1, Math.max(0, world.stepAccumulatorSec / world.stepIntervalSec))
        : 1;

    for (let i = 0; i < len; i++) {
      const cur = world.segments[i];
      const prev = world.prevSegments[i] ?? cur;
      const dx = Math.abs(cur.x - prev.x);
      const dy = Math.abs(cur.y - prev.y);
      const gx = dx > 1 ? cur.x : prev.x + (cur.x - prev.x) * alpha;
      const gy = dy > 1 ? cur.y : prev.y + (cur.y - prev.y) * alpha;

      this.interpSegments[i].x = m.originX + (gx + 0.5) * m.cellSize;
      this.interpSegments[i].y = m.originY + (gy + 0.5) * m.cellSize;
    }

    const dyingFlash =
      world.phase === 'dying' && Math.floor(world.dyingTimerSec * 22) % 2 === 0;

    // Draw articulated spine connectors first (skip wrap jumps)
    for (let i = len - 1; i >= 1; i--) {
      const a = this.interpSegments[i];
      const b = this.interpSegments[i - 1];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      if (dist > m.cellSize * 2.2) continue;

      const t = i / Math.max(1, len - 1);
      const radius = m.cellSize * (0.41 - t * 0.16);
      ctx.strokeStyle = dyingFlash
        ? '#fca5a5'
        : world.boostActive && world.phase === 'playing'
          ? '#fb923c'
          : i % 2 === 0
            ? '#059669'
            : '#047857';
      ctx.lineWidth = radius * 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // Draw segment plates from tail to neck
    for (let i = len - 1; i >= 1; i--) {
      const p = this.interpSegments[i];
      const t = i / Math.max(1, len - 1);
      const radius = m.cellSize * (0.41 - t * 0.16);

      ctx.fillStyle = dyingFlash
        ? '#ef4444'
        : i % 2 === 0
          ? '#10b981'
          : '#0d9488';
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Subtle dorsal copper/jade scale highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.beginPath();
      ctx.arc(p.x - radius * 0.2, p.y - radius * 0.2, radius * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw directional head
    const head = this.interpSegments[0];
    const headR = m.cellSize * 0.45;
    let angle = 0;
    if (world.direction === 'down') angle = Math.PI * 0.5;
    else if (world.direction === 'left') angle = Math.PI;
    else if (world.direction === 'up') angle = -Math.PI * 0.5;

    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate(angle);

    // Subtle animated forked tongue
    const tonguePhase = Math.sin(world.elapsedSec * 7.0);
    if (tonguePhase > 0.35 && world.phase !== 'dying') {
      const ext = (tonguePhase - 0.35) * m.cellSize * 0.55;
      ctx.strokeStyle = '#fb7185';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(headR * 0.85, 0);
      ctx.lineTo(headR * 0.85 + ext, 0);
      ctx.lineTo(headR * 0.85 + ext + 4, -3);
      ctx.moveTo(headR * 0.85 + ext, 0);
      ctx.lineTo(headR * 0.85 + ext + 4, 3);
      ctx.stroke();
    }

    // Head boost aura
    if (world.boostActive && world.phase === 'playing') {
      ctx.fillStyle = 'rgba(249, 115, 22, 0.24)';
      ctx.beginPath();
      ctx.arc(0, 0, headR * 1.45, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sculpted serpent head silhouette
    ctx.fillStyle = dyingFlash ? '#ffffff' : '#34d399';
    ctx.beginPath();
    ctx.roundRect(-headR * 0.9, -headR * 0.92, headR * 1.95, headR * 1.84, headR * 0.65);
    ctx.fill();

    // Eyes
    const eyeX = headR * 0.36;
    const eyeY = headR * 0.44;
    const eyeR = Math.max(2.2, headR * 0.23);
    ctx.fillStyle = '#090d14';
    ctx.beginPath();
    ctx.arc(eyeX, -eyeY, eyeR, 0, Math.PI * 2);
    ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ecfdf5';
    ctx.beginPath();
    ctx.arc(eyeX + eyeR * 0.28, -eyeY - eyeR * 0.2, eyeR * 0.38, 0, Math.PI * 2);
    ctx.arc(eyeX + eyeR * 0.28, eyeY - eyeR * 0.2, eyeR * 0.38, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawEffects(ctx: CanvasRenderingContext2D): void {
    // Shockwave rings
    for (let i = 0; i < SHOCKWAVE_POOL_SIZE; i++) {
      const sw = this.shockwaves[i];
      if (!sw.active) continue;
      const t = sw.life / sw.maxLife;
      const radius = sw.maxRadius * (0.25 + 0.75 * (1 - Math.pow(1 - t, 3)));
      ctx.save();
      ctx.globalAlpha = (1 - t) * 0.65;
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = 2.5 * (1 - t);
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Pooled particles
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      const remaining = 1 - p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = remaining;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * remaining, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Floating score popups
    ctx.save();
    ctx.font = '700 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < POPUP_POOL_SIZE; i++) {
      const pop = this.popups[i];
      if (!pop.active) continue;
      const remaining = 1 - pop.life / pop.maxLife;
      ctx.globalAlpha = Math.min(1, remaining * 1.4);
      ctx.fillStyle = '#090c11';
      ctx.fillText(pop.text, pop.x + 1, pop.y + 1);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
    }
    ctx.restore();
  }
}
