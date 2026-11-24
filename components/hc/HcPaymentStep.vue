<script setup lang="ts">
/**
 * Paso 3 · Pago: tabs "Tarjeta crédito/débito" / "Transferencia" (débito por
 * CBU), campos de Debi Elements, texto legal y "Confirmar donación".
 * Los medios que se ofrecen salen de la prop `methods` (`?medios=` de la URL)
 * o, si no viene, de `HC_PAYMENT_METHODS`; con uno solo, en vez de tabs se
 * muestra su título.
 *
 * El elemento de Debi y la tokenización viven en `usePaymentElement`, que
 * comparte con el diseño simple (/donar-simple).
 */
import { nextTick } from "vue";
import HcButton from "~/components/hc/HcButton.vue";
import type { DebiPaymentToken } from "~/composables/useDebiClient";
import { usePaymentElement, type HcPaymentMethod } from "~/composables/usePaymentElement";
import { HC_RECEIPTS_EMAIL } from "~/data/hc-donar";

const props = defineProps<{
  uid: string;
  serverError?: string | null;
  busy?: boolean;
  methods?: HcPaymentMethod[];
}>();
const emit = defineEmits<{ confirm: [token: DebiPaymentToken]; back: [] }>();

const METHOD_LABELS: Record<HcPaymentMethod, string> = {
  card: "Tarjeta crédito/débito",
  cbu: "Transferencia",
};

const { methods, method, mountTarget, fieldError, sdkError, ready, tokenizing, selectMethod, tokenize } =
  usePaymentElement(props.methods);

function onKeyTabs(e: KeyboardEvent) {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  if (methods.length < 2) return;
  const i = methods.indexOf(method.value as "card" | "cbu");
  const next = methods[(i + (e.key === "ArrowRight" ? 1 : -1) + methods.length) % methods.length];
  selectMethod(next);
  nextTick(() => document.getElementById(`${(e.currentTarget as HTMLElement).dataset.uid}-pm-${next}`)?.focus());
}

async function confirm() {
  const token = await tokenize();
  if (token) emit("confirm", token);
}
</script>

<template>
  <form class="hc-payment" novalidate @submit.prevent="confirm">
    <h2 class="hc-sr">Método de pago</h2>
    <slot name="summary" />

    <div
      :class="['hc-methods', methods.length < 2 && 'is-single']"
      :role="methods.length > 1 ? 'tablist' : undefined"
      :aria-label="methods.length > 1 ? 'Método de pago' : undefined"
      :style="{ '--n': methods.length, '--i': methods.indexOf(method as 'card' | 'cbu') }"
      :data-uid="uid"
      @keydown="onKeyTabs"
    >
      <component
        :is="methods.length > 1 ? 'button' : 'p'"
        v-for="m in methods"
        :id="`${uid}-pm-${m}`"
        :key="m"
        :type="methods.length > 1 ? 'button' : undefined"
        :role="methods.length > 1 ? 'tab' : undefined"
        class="hc-methods__tab"
        :aria-selected="methods.length > 1 ? method === m : undefined"
        :aria-controls="methods.length > 1 ? `${uid}-pm-panel` : undefined"
        :tabindex="methods.length > 1 ? (method === m ? 0 : -1) : undefined"
        :disabled="methods.length > 1 ? busy : undefined"
        @click="methods.length > 1 && selectMethod(m)"
      >
        <svg v-if="m === 'card'" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="2.5" y="5" width="19" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.8" />
          <path d="M2.5 9.5h19" stroke="currentColor" stroke-width="1.8" />
        </svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M3 9.5 12 4l9 5.5M5 10v7m4-7v7m6-7v7m4-7v7M3 20h18"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        {{ METHOD_LABELS[m] }}
      </component>
      <i class="hc-methods__bar" aria-hidden="true"></i>
    </div>

    <div
      :id="`${uid}-pm-panel`"
      :key="method"
      :role="methods.length > 1 ? 'tabpanel' : undefined"
      :aria-labelledby="`${uid}-pm-${method}`"
      class="hc-payment__panel"
    >
      <p v-if="method === 'cbu'" class="hc-payment__hint">
        Debitamos la donación de tu cuenta bancaria. Ingresá el CBU de una cuenta a tu nombre.
      </p>
      <div ref="mountTarget" :class="['hc-payment__element', (busy || tokenizing) && 'is-busy']"></div>
    </div>

    <p v-if="sdkError" class="hc-alert" role="alert">{{ sdkError }}</p>
    <p v-else-if="fieldError" class="hc-error" role="alert">{{ fieldError }}</p>

    <p class="hc-legal">
      Para donaciones de empresa puedes solicitar el recibo digital indicando la Razón social y CUIT al mail
      <a :href="`mailto:${HC_RECEIPTS_EMAIL}`"><strong>{{ HC_RECEIPTS_EMAIL }}</strong></a
      ><br />
      Las donaciones a Haciendo Camino Asociación Civil son deducibles del Impuesto a las Ganancias según el Art. 81
      de la Ley N° 20.628.
    </p>

    <p v-if="serverError" class="hc-alert" role="alert">{{ serverError }}</p>

    <div class="hc-actions">
      <HcButton variant="outline" :disabled="busy || tokenizing" @click="emit('back')">Volver</HcButton>
      <HcButton type="submit" :loading="tokenizing" :disabled="busy || !!sdkError || !ready">
        Confirmar<span class="hc-payment__long">&nbsp;donación</span>
      </HcButton>
    </div>
  </form>
</template>

<style scoped>
.hc-payment {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.hc-methods {
  position: relative;
  display: grid;
  grid-template-columns: repeat(var(--n, 2), 1fr);
  border-bottom: 4px solid var(--hc-gray);
}
/* Un solo medio: es un título, no una tab. */
.hc-methods.is-single .hc-methods__tab {
  justify-content: flex-start;
  margin: 0;
  padding-inline: 0;
  color: var(--hc-dark);
  cursor: default;
}
.hc-methods.is-single .hc-methods__tab svg {
  color: var(--hc-red);
}

.hc-methods__tab {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 0.25rem;
  background: none;
  border: 0;
  color: var(--hc-muted);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: color 0.3s ease;
}
.hc-methods__tab svg {
  width: 1.375rem;
  height: 1.375rem;
  flex-shrink: 0;
  transition: color 0.3s ease;
}
.hc-methods__tab[aria-selected="true"] {
  color: var(--hc-dark);
}
.hc-methods__tab[aria-selected="true"] svg {
  color: var(--hc-red);
}
.hc-methods__tab:focus-visible {
  outline: 2px solid var(--hc-red);
  outline-offset: 2px;
}

/* Subrayado rojo que se desliza a la tab activa */
.hc-methods__bar {
  position: absolute;
  left: 0;
  bottom: -4px;
  width: calc(100% / var(--n, 2));
  height: 4px;
  background: var(--hc-red);
  transform: translateX(calc(100% * var(--i, 0)));
  transition: transform 0.4s var(--hc-ease);
}

.hc-payment__panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 5.5rem;
  animation: hc-rise 0.4s var(--hc-ease) both;
}

.hc-payment__hint {
  margin: 0;
  font-size: 0.875rem;
}

.hc-payment__element.is-busy {
  pointer-events: none;
  opacity: 0.6;
}

@media (max-width: 480px) {
  .hc-methods__tab {
    font-size: 12px;
    letter-spacing: 0.04em;
  }
  .hc-methods__tab svg {
    display: none;
  }
}
@media (max-width: 375px) {
  .hc-payment__long {
    display: none;
  }
}
</style>
