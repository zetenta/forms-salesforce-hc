<script setup lang="ts">
/**
 * Botón de Haciendo Camino.
 *   - `variant="solid"`: rojo. Al pasar el mouse se llena de verde con un
 *     círculo que crece desde el cursor; al hacer click deja una onda.
 *   - `variant="outline"`: blanco con borde rojo ("Volver").
 * `loading` muestra un spinner y bloquea el botón.
 */
import { ref } from "vue";

const props = withDefaults(
  defineProps<{
    variant?: "solid" | "outline";
    type?: "button" | "submit";
    loading?: boolean;
    disabled?: boolean;
  }>(),
  { variant: "solid", type: "button", loading: false, disabled: false },
);

const el = ref<HTMLButtonElement | null>(null);
const ripples = ref<{ id: number; x: number; y: number }[]>([]);
let rippleId = 0;

function track(e: PointerEvent) {
  const b = el.value;
  if (!b) return;
  const r = b.getBoundingClientRect();
  b.style.setProperty("--hc-x", `${e.clientX - r.left}px`);
  b.style.setProperty("--hc-y", `${e.clientY - r.top}px`);
}

function ripple(e: PointerEvent) {
  if (props.disabled || props.loading) return;
  const b = el.value;
  if (!b) return;
  const r = b.getBoundingClientRect();
  const id = ++rippleId;
  ripples.value.push({ id, x: e.clientX - r.left, y: e.clientY - r.top });
  window.setTimeout(() => {
    ripples.value = ripples.value.filter((p) => p.id !== id);
  }, 650);
}
</script>

<template>
  <button
    ref="el"
    :type="type"
    :class="['hc-btn', `hc-btn--${variant}`, loading && 'is-loading']"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    @pointerenter="track"
    @pointermove="track"
    @pointerdown="ripple"
  >
    <span class="hc-btn__label"><slot /></span>
    <span v-if="loading" class="hc-btn__spinner" aria-hidden="true"></span>
    <span
      v-for="p in ripples"
      :key="p.id"
      class="hc-btn__ripple"
      :style="{ left: `${p.x}px`, top: `${p.y}px` }"
      aria-hidden="true"
    ></span>
  </button>
</template>

<style scoped>
.hc-btn {
  --hc-x: 50%;
  --hc-y: 100%;
  position: relative;
  isolation: isolate;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.6em;
  width: 100%;
  min-height: 3rem;
  padding: 0.75rem 1.5rem;
  border-radius: 100px;
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  transition:
    transform 0.2s var(--hc-ease),
    color 0.3s ease,
    border-color 0.4s ease;
  -webkit-tap-highlight-color: transparent;
}

.hc-btn--solid {
  background: var(--hc-red);
  color: var(--hc-white);
  border: 1px solid transparent;
}

/* Relleno verde que crece desde donde entra el cursor */
.hc-btn--solid::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  background: var(--hc-green);
  clip-path: circle(0% at var(--hc-x) var(--hc-y));
  transition: clip-path 0.55s var(--hc-ease);
  pointer-events: none;
}

.hc-btn--solid:not(:disabled):hover::before,
.hc-btn--solid:focus-visible::before {
  clip-path: circle(150% at var(--hc-x) var(--hc-y));
}

.hc-btn--outline {
  background: var(--hc-white);
  color: var(--hc-red);
  border: 1px solid var(--hc-red);
}
.hc-btn--outline:not(:disabled):hover {
  background: rgb(188 40 41 / 0.06);
}

.hc-btn:not(:disabled):active {
  transform: scale(0.97);
}

.hc-btn:focus-visible {
  outline: 2px solid var(--hc-red);
  outline-offset: 3px;
}

.hc-btn:disabled {
  cursor: progress;
  opacity: 0.85;
}

.hc-btn__label {
  position: relative;
}

.hc-btn__spinner {
  width: 1em;
  height: 1em;
  border: 2px solid currentcolor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: hc-spin 0.7s linear infinite;
}

.hc-btn__ripple {
  position: absolute;
  z-index: -1;
  width: 24px;
  height: 24px;
  margin: -12px 0 0 -12px;
  border-radius: 50%;
  background: rgb(255 255 255 / 0.45);
  transform: scale(0);
  animation: hc-ripple 0.65s ease-out forwards;
  pointer-events: none;
}
.hc-btn--outline .hc-btn__ripple {
  background: rgb(188 40 41 / 0.18);
}

@keyframes hc-ripple {
  to {
    transform: scale(22);
    opacity: 0;
  }
}

@keyframes hc-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
