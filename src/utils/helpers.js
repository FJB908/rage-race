import { ParticlePool } from '../physics/particlePool.js';

// src/utils/helpers.js
// Basic utility functions used across the game


// src/utils/helpers.js
// Small helper utilities used across the game.

export function rnd(min, max) {
  return min + Math.random() * (max - min);
}

export function easeOutBack(x) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

export function ring(x, y, color, max, flat) {
  // Simple shockwave helper
  if (!window.shockwaves) window.shockwaves = [];
  window.shockwaves.push({x, y, r:4, max, life:1, color, flat:!!flat});
}

export function burst(x, y, color, size, life) {
  // Use ParticlePool for efficient reuse
  if (!window.particlePool) window.particlePool = new ParticlePool(2000);
  const k = size / 12;
  for (let i=0;i<5;i++){
    const angle = Math.random()*Math.PI*2;
    const speed = rnd(120,240)*k;
    window.particlePool.acquire(x, y, Math.cos(angle)*speed, Math.sin(angle)*speed, life, rnd(1.5,2), color, size);
  }
}
window.burst = burst;


export function floatText(x, y, txt, color) {
  // Placeholder for floating text; actual implementation would use canvas rendering.
  console.log(`floatText: (${x.toFixed(1)},${y.toFixed(1)}) ${txt} ${color}`);
}

export let camShake = 0;

export function shake(v) {
  camShake = Math.max(camShake, v);
}

export const particlePool = new ParticlePool(2000);

window.particlePool = particlePool;

window.rnd = rnd;
window.easeOutBack = easeOutBack;
window.ring = ring;
window.floatText = floatText;
window.shake = shake;

