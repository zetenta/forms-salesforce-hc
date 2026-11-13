<script setup lang="ts">
/**
 * Cierre del formulario.
 *   - `phase="loading"`: "Estamos procesando tu donación…" con un corazón que
 *     se dibuja y cambia de color en cada vuelta.
 *   - `phase="success"`: el corazón se rellena, crece hasta cubrir todo y
 *     queda la pantalla de gracias (corazón blanco, título y huellas).
 */
import { nextTick, ref, watch } from "vue";
import HcFeet from "~/components/hc/HcFeet.vue";

const props = defineProps<{ phase: "loading" | "success" }>();

const HEART =
  "M50 90C20 64 2 46 2 26 2 12 13 4 26 4c11 0 20 6 24 15 4-9 13-15 24-15 13 0 24 8 24 22 0 20-18 38-48 64Z";

const title = ref<HTMLElement | null>(null);

watch(
  () => props.phase,
  (p) => {
    if (p === "success") nextTick(() => window.setTimeout(() => title.value?.focus(), 1200));
  },
  { immediate: true },
);
</script>

<template>
  <section :class="['hc-finale', `is-${phase}`]">
    <!-- Corazón del loader: se dibuja en loop y, al terminar, se rellena y crece -->
    <div class="hc-finale__stage" aria-hidden="true">
      <svg class="hc-finale__loader" viewBox="-4 -4 108 100">
        <path class="hc-finale__fill" :d="HEART" />
        <path class="hc-finale__stroke" :d="HEART" pathLength="100" />
      </svg>
    </div>

    <p v-if="phase === 'loading'" class="hc-finale__wait" role="status">Estamos procesando tu donación…</p>

    <template v-else>
      <div class="hc-thanks" aria-hidden="true">
        <svg class="hc-thanks__shadow" viewBox="0 0 100 92"><path :d="HEART" /></svg>
        <svg class="hc-thanks__heart" viewBox="0 0 100 92"><path :d="HEART" /></svg>
      </div>
      <h2 ref="title" class="hc-thanks__title" tabindex="-1">
        <span class="hc-thanks__line hc-thanks__line--1">¡Muchas gracias</span>
        <span class="hc-thanks__line hc-thanks__line--2">por tu ayuda!</span>
      </h2>
      <HcFeet class="hc-thanks__feet" />
    </template>
  </section>
</template>

<style scoped>
.hc-finale {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 26rem;
  overflow: hidden;
  isolation: isolate;
  border-radius: 1.5rem;
  background: var(--hc-white);
}

/* ---------- Loader ---------- */
.hc-finale__stage {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  z-index: 0;
  pointer-events: none;
}

.hc-finale__loader {
  width: 3.25rem;
  height: 3.25rem;
  overflow: visible;
  transform: translateY(-1.75rem);
}

.hc-finale__stroke {
  fill: none;
  stroke: var(--hc-green);
  stroke-width: 6;
  stroke-linecap: round;
  stroke-dasharray: 34 66;
  /* Una vuelta dura 1.1s; el color cambia al empezar cada vuelta (4 colores). */
  animation:
    hc-trace 1.1s linear infinite,
    hc-colors 4.4s step-end infinite;
}

.hc-finale__fill {
  fill: var(--hc-green);
  opacity: 0;
}

.hc-finale__wait {
  position: relative;
  margin: 3.25rem 0 0;
  padding: 0 1rem;
  color: var(--hc-green);
  text-align: center;
  font-family: var(--hc-display);
  font-size: 1.25rem;
  font-weight: 700;
  animation: hc-rise 0.4s var(--hc-ease) both;
}

/* ---------- Éxito: el corazón se rellena y crece hasta cubrir ---------- */
.is-success {
  animation: hc-bg 0.01s linear 0.85s both;
}
.is-success .hc-finale__stroke {
  stroke: var(--hc-green);
  transition: stroke 0.2s ease;
  animation: hc-trace-close 0.3s ease-out forwards;
}
.is-success .hc-finale__fill {
  animation: hc-fade-in 0.25s ease-out 0.15s forwards;
}
.is-success .hc-finale__loader {
  animation: hc-grow 0.75s cubic-bezier(0.6, 0, 0.4, 1) 0.3s forwards;
}

.hc-thanks {
  position: absolute;
  inset: 1.25rem 1rem 0.5rem;
  z-index: 1;
  display: grid;
  place-items: center;
}
.hc-thanks svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}
.hc-thanks__shadow path {
  fill: #4fa48f;
}
.hc-thanks__heart path {
  fill: var(--hc-white);
}
.hc-thanks__shadow {
  transform: translate(2.5%, 2%) scale(0);
  animation: hc-heart-in 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.15) 0.7s forwards;
}
.hc-thanks__heart {
  transform: scale(0);
  animation: hc-heart-in-white 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.1) 0.85s forwards;
}

.hc-thanks__title {
  position: relative;
  z-index: 2;
  margin: -2.5rem 0 0;
  font-family: var(--hc-display);
  font-size: clamp(1.75rem, 7vw, 2.75rem);
  font-weight: 800;
  line-height: 1.05;
  text-align: center;
  letter-spacing: -0.01em;
  outline: none;
}
.hc-thanks__line {
  display: block;
  clip-path: inset(-10% 100% -10% 0);
  animation: hc-write 0.7s steps(18, end) forwards;
}
.hc-thanks__line--1 {
  color: var(--hc-blue);
  animation-delay: 1.35s;
}
.hc-thanks__line--2 {
  color: var(--hc-orange);
  animation-delay: 2s;
  animation-timing-function: steps(13, end);
}

.hc-thanks__feet {
  position: absolute;
  z-index: 2;
  bottom: 0.75rem;
  left: 50%;
  width: 4.75rem;
  margin-left: -2.6rem;
}
.hc-thanks__feet :deep(path) {
  fill: var(--hc-red);
}
.hc-thanks__feet :deep(.hc-feet__foot) {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: 50% 100%;
  animation: hc-step 0.4s var(--hc-ease) forwards;
}
.hc-thanks__feet :deep(.hc-feet__foot--a) {
  animation-delay: 2.5s;
}
.hc-thanks__feet :deep(.hc-feet__foot--b) {
  animation-delay: 2.85s;
}

@keyframes hc-trace {
  from {
    stroke-dashoffset: 100;
  }
  to {
    stroke-dashoffset: 0;
  }
}
@keyframes hc-colors {
  0% {
    stroke: var(--hc-green);
  }
  25% {
    stroke: var(--hc-blue);
  }
  50% {
    stroke: var(--hc-orange);
  }
  75% {
    stroke: var(--hc-red);
  }
}
@keyframes hc-trace-close {
  to {
    stroke-dasharray: 100 0;
  }
}
@keyframes hc-fade-in {
  to {
    opacity: 1;
  }
}
@keyframes hc-grow {
  0% {
    transform: translateY(-1.75rem) scale(1);
  }
  25% {
    transform: translateY(-1.75rem) scale(0.85);
  }
  100% {
    transform: translateY(0) scale(22);
  }
}
@keyframes hc-bg {
  to {
    background: var(--hc-green);
  }
}
@keyframes hc-heart-in {
  to {
    transform: translate(2.5%, 2%) scale(1);
  }
}
@keyframes hc-heart-in-white {
  to {
    transform: scale(1);
  }
}
@keyframes hc-write {
  to {
    clip-path: inset(-10% -5% -10% 0);
  }
}
@keyframes hc-step {
  0% {
    opacity: 0;
    transform: translateY(8px) scale(0.6);
  }
  60% {
    opacity: 1;
    transform: translateY(-3px) scale(1.08);
  }
  100% {
    opacity: 1;
    transform: none;
  }
}

@media (max-width: 480px) {
  .hc-finale {
    min-height: 22rem;
  }
  .hc-thanks__feet {
    width: 3.75rem;
    margin-left: -2rem;
  }
}
</style>
