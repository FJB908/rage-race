// src/physics/particlePool.js
export class ParticlePool {
  constructor(max = 2000) {
    this.pool = new Array(max).fill(null);
    this.next = 0;
  }

  acquire(x, y, vx, vy, life, decay, color, size) {
    const idx = this.next;
    this.pool[idx] = { x, y, vx, vy, life, decay, color, size };
    this.next = (idx + 1) % this.pool.length;
  }

  update(dt) {
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= p.decay * dt;
      if (p.life <= 0) this.pool[i] = null;
    }
  }

  draw(ctx) {
    for (const p of this.pool) {
      if (!p) continue;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
  }
}
