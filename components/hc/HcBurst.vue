<script setup lang="ts">
/**
 * Ráfaga de estrellitas, corazones y monedas que sale de un punto.
 * Uso: `burstRef.value.fire(x, y)` con coordenadas relativas al contenedor
 * (que tiene que tener `position: relative`).
 */
import { ref } from "vue";

type Kind = "star" | "heart" | "coin";
interface Particle {
  id: number;
  kind: Kind;
  x: number;
  y: number;
  dx: number;
  dy: number;
  rot: number;
  size: number;
  color: string;
  delay: number;
}

const particles = ref<Particle[]>([]);
let seq = 0;

const STAR_COLORS = ["#fae3c5", "#eb5c37", "#62bda6", "#f9b233"];

function fire(x: number, y: number, spreadX = 120, spreadY = 70) {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }
  const batch: Particle[] = [];
  const count = 14;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
    const dist = 0.55 + Math.random() * 0.45;
    const kind: Kind = i % 3 === 0 ? "heart" : i % 3 === 1 ? "star" : "coin";
    batch.push({
      id: ++seq,
      kind,
      x,
      y,
      dx: Math.cos(angle) * spreadX * dist,
      dy: Math.sin(angle) * spreadY * dist,
      rot: (Math.random() - 0.5) * 160,
      size: kind === "star" ? 12 + Math.random() * 8 : 10 + Math.random() * 5,
      color: kind === "heart" ? "#e8443a" : STAR_COLORS[i % STAR_COLORS.length],
      delay: Math.random() * 120,
    });
  }
  particles.value.push(...batch);
  const ids = new Set(batch.map((p) => p.id));
  window.setTimeout(() => {
    particles.value = particles.value.filter((p) => !ids.has(p.id));
  }, 1300);
}

defineExpose({ fire });
</script>

<template>
  <div class="hc-burst" aria-hidden="true">
    <span
      v-for="p in particles"
      :key="p.id"
      :class="['hc-burst__p', `hc-burst__p--${p.kind}`]"
      :style="{
        left: `${p.x}px`,
        top: `${p.y}px`,
        width: `${p.size}px`,
        height: `${p.size}px`,
        color: p.color,
        '--dx': `${p.dx}px`,
        '--dy': `${p.dy}px`,
        '--rot': `${p.rot}deg`,
        animationDelay: `${p.delay}ms`,
      }"
    >
      <svg v-if="p.kind === 'star'" viewBox="0 0 24 24">
        <path d="M12 0c1 7 5 11 12 12-7 1-11 5-12 12-1-7-5-11-12-12 7-1 11-5 12-12Z" fill="currentColor" />
      </svg>
      <svg v-else-if="p.kind === 'heart'" viewBox="0 0 24 22">
        <path
          d="M12 21.5C5 15.8 1 12.1 1 7.4 1 4 3.6 1.5 6.8 1.5c2 0 3.9 1 5.2 2.8 1.3-1.8 3.2-2.8 5.2-2.8C20.4 1.5 23 4 23 7.4c0 4.7-4 8.4-11 14.1Z"
          fill="currentColor"
        />
      </svg>
      <svg v-else viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="11" fill="#f9b233" />
        <circle cx="12" cy="12" r="8" fill="none" stroke="#fcd36a" stroke-width="2" />
        <text x="12" y="16.5" text-anchor="middle" font-size="12" font-weight="800" fill="#eb5c37">$</text>
      </svg>
    </span>
  </div>
</template>

<style scoped>
.hc-burst {
  position: absolute;
  inset: 0;
  z-index: 3;
  overflow: visible;
  pointer-events: none;
}

.hc-burst__p {
  position: absolute;
  margin: -6px 0 0 -6px;
  opacity: 0;
  animation: hc-burst 1.05s cubic-bezier(0.15, 0.7, 0.3, 1) forwards;
}

.hc-burst__p svg {
  display: block;
  width: 100%;
  height: 100%;
}

@keyframes hc-burst {
  0% {
    opacity: 0;
    transform: translate(0, 0) scale(0.2) rotate(0deg);
  }
  15% {
    opacity: 1;
    transform: translate(calc(var(--dx) * 0.35), calc(var(--dy) * 0.35)) scale(1.15) rotate(calc(var(--rot) * 0.3));
  }
  70% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(var(--dx), calc(var(--dy) + 10px)) scale(0.7) rotate(var(--rot));
  }
}
</style>
