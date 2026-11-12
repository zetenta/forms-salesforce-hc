<script setup lang="ts">
/**
 * Paso 3 · Pago: tabs "Tarjeta crédito/débito" / "Transferencia" (débito por
 * CBU), campos de Debi Elements, texto legal y "Confirmar donación".
 *
 * Los campos los dibuja el SDK de Debi en este mismo documento; el estilo va
 * por `appearance` (variables + rules), nunca tocando sus clases. Cada tab
 * monta un elemento con un solo método (`allowedTypes: [type]`) para que las
 * tabs sean las del diseño y no las del SDK.
 */
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import HcButton from "~/components/hc/HcButton.vue";
import {
  useDebiClient,
  type DebiClient,
  type DebiElement,
  type DebiElementState,
  type DebiPaymentMethodType,
  type DebiPaymentToken,
} from "~/composables/useDebiClient";
import { HC_CARD_EXTRA_FIELDS, HC_RECEIPTS_EMAIL } from "~/data/hc-donar";

defineProps<{ uid: string; serverError?: string | null; busy?: boolean }>();
const emit = defineEmits<{ confirm: [token: DebiPaymentToken]; back: [] }>();

const method = ref<DebiPaymentMethodType>("card");
const mountTarget = ref<HTMLDivElement | null>(null);
const fieldError = ref<string | null>(null);
const sdkError = ref<string | null>(null);
const ready = ref(false);
const tokenizing = ref(false);

let debi: DebiClient | null = null;
let element: DebiElement | null = null;
let elementState: DebiElementState | null = null;

const FONT = '"Source Sans 3", ui-sans-serif, system-ui, sans-serif';

const appearance = {
  theme: "debi",
  variables: {
    primary: "#bc2829",
    primaryForeground: "#ffffff",
    background: "#ffffff",
    foreground: "#303030",
    muted: "#ededed",
    mutedForeground: "#8c8c8c",
    border: "#303030",
    borderHover: "#bc2829",
    borderFocus: "#bc2829",
    borderInvalid: "#bc2829",
    focusBoxShadow: "0 0 0 3px rgb(188 40 41 / 0.25)",
    placeholderColor: "#8c8c8c",
    labelColor: "#303030",
    labelFontWeight: "700",
    error: "#bc2829",
    success: "#62bda6",
    fontFamily: FONT,
    fontSize: "16px",
    borderRadius: "8px",
    spacing: "8px",
    inputPaddingY: "12px",
    inputPaddingX: "16px",
  },
  layout: { type: "tabs", inputs: "spaced", labels: "above" },
  rules: {
    ".Label": {
      textTransform: "uppercase",
      letterSpacing: "0.1em",
      fontSize: "0.75rem",
    },
    ".Input": {
      caretColor: "#f9b233",
    },
    ".Error": {
      fontSize: "0.8125rem",
      fontWeight: "600",
    },
  },
};

const CARD_TEXT = {
  numberLabel: "Número de tarjeta",
  numberPlaceholder: "xxxx xxxx xxxx xxxx",
  expirationLabel: "Vencimiento",
  expirationPlaceholder: "MM/AA",
  securityCodeLabel: "Código de seguridad",
  securityCodePlaceholder: "Ej. 123",
  supportedNetworksPrefix: "Aceptamos",
};

const CBU_TEXT = {
  numberLabel: "Número de CBU",
  numberPlaceholder: "Ingresá los 22 números de tu CBU",
};

function mount() {
  if (!debi || !mountTarget.value) return;
  element?.unmount();
  element = null;
  elementState = null;
  fieldError.value = null;
  ready.value = false;

  const elements = debi.elements({ appearance, locale: "es-AR" });
  element = elements.create("payment-method", {
    allowedTypes: [method.value],
    defaultType: method.value,
    strict: true,
    methods: {
      card: {
        ...(HC_CARD_EXTRA_FIELDS === "auto"
          ? {}
          : { expiration: HC_CARD_EXTRA_FIELDS, securityCode: HC_CARD_EXTRA_FIELDS }),
        text: CARD_TEXT,
      },
      cbu: { text: CBU_TEXT },
    },
  });
  element.on("change", (state: DebiElementState) => {
    elementState = state;
    fieldError.value = state.error?.message ?? null;
  });
  element.on("ready", () => {
    ready.value = true;
  });
  element.mount(mountTarget.value);
  // Algunos builds del SDK no emiten "ready": no bloquear el botón por eso.
  window.setTimeout(() => (ready.value = true), 1500);
}

onMounted(() => {
  try {
    debi = useDebiClient();
    mount();
  } catch (error) {
    sdkError.value =
      "No pudimos cargar el formulario de pago. Recargá la página o probá en unos minutos.";
    console.error("[donar] Debi SDK", error);
  }
});

onBeforeUnmount(() => {
  element?.unmount();
  element = null;
  debi = null;
});

function selectMethod(type: DebiPaymentMethodType) {
  if (type === method.value) return;
  method.value = type;
  nextTick(mount);
}

function onKeyTabs(e: KeyboardEvent) {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const next = method.value === "card" ? "cbu" : "card";
  selectMethod(next);
  nextTick(() => document.getElementById(`${(e.currentTarget as HTMLElement).dataset.uid}-pm-${next}`)?.focus());
}

/** Los errores de red del SDK llegan en inglés ("Failed to fetch"). */
function friendly(message?: string): string {
  if (!message || /failed to fetch|network|load failed|status \d+|request failed/i.test(message)) {
    return "No pudimos validar los datos de pago. Revisá tu conexión e intentá de nuevo.";
  }
  return message;
}

async function confirm() {
  if (!element || !debi || tokenizing.value) return;
  fieldError.value = null;
  if (!elementState || elementState.empty) {
    fieldError.value =
      method.value === "card" ? "Ingresá el número de tu tarjeta." : "Ingresá el número de tu CBU.";
    element.focus();
    return;
  }
  tokenizing.value = true;
  try {
    const { token, error } = await debi.confirmPaymentMethod(element);
    if (error || !token) {
      // Los errores de validación ya los muestra Debi debajo del campo; acá
      // solo los de red o desconocidos, para no repetir el mensaje.
      const message = friendly(error?.message);
      fieldError.value = message === error?.message ? null : message;
      element.focus();
      return;
    }
    emit("confirm", token);
  } catch (error) {
    fieldError.value = friendly(error instanceof Error ? error.message : undefined);
  } finally {
    tokenizing.value = false;
  }
}
</script>

<template>
  <form class="hc-payment" novalidate @submit.prevent="confirm">
    <h2 class="hc-sr">Método de pago</h2>
    <slot name="summary" />

    <div class="hc-methods" role="tablist" aria-label="Método de pago" :data-uid="uid" @keydown="onKeyTabs">
      <button
        :id="`${uid}-pm-card`"
        type="button"
        role="tab"
        class="hc-methods__tab"
        :aria-selected="method === 'card'"
        :aria-controls="`${uid}-pm-panel`"
        :tabindex="method === 'card' ? 0 : -1"
        :disabled="busy"
        @click="selectMethod('card')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="2.5" y="5" width="19" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.8" />
          <path d="M2.5 9.5h19" stroke="currentColor" stroke-width="1.8" />
        </svg>
        Tarjeta crédito/débito
      </button>
      <button
        :id="`${uid}-pm-cbu`"
        type="button"
        role="tab"
        class="hc-methods__tab"
        :aria-selected="method === 'cbu'"
        :aria-controls="`${uid}-pm-panel`"
        :tabindex="method === 'cbu' ? 0 : -1"
        :disabled="busy"
        @click="selectMethod('cbu')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M3 9.5 12 4l9 5.5M5 10v7m4-7v7m6-7v7m4-7v7M3 20h18"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        Transferencia
      </button>
      <i class="hc-methods__bar" :data-active="method" aria-hidden="true"></i>
    </div>

    <div
      :id="`${uid}-pm-panel`"
      :key="method"
      role="tabpanel"
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
  grid-template-columns: 1fr 1fr;
  border-bottom: 4px solid var(--hc-gray);
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
  width: 50%;
  height: 4px;
  background: var(--hc-red);
  transition: transform 0.4s var(--hc-ease);
}
.hc-methods__bar[data-active="cbu"] {
  transform: translateX(100%);
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
