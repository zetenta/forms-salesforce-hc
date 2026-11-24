<script setup lang="ts">
/**
 * /donar · Formulario de donaciones de Haciendo Camino (diseño multistep,
 * con animaciones). Hay un segundo diseño, de una sola página y sin
 * animaciones, en /donar-simple; los dos comparten la lógica
 * (`composables/useHcDonation.ts`) y el elemento de pago
 * (`composables/usePaymentElement.ts`).
 *
 * Se muestra dentro de un iframe en el sitio de WordPress (bloque Portada).
 * Usa el mismo backend que `alta-donante-alternativo`
 * (`server/api/flow/alta-donante-alternativo.post.ts`), en dos etapas:
 *   - al pasar de Datos a Pago → stage "personal" (crea o busca el Contact);
 *   - al confirmar → stage "finalize" (método de pago + Recurring Donation
 *     u Opportunity).
 *
 * Mensajes al sitio que lo embebe (`window.parent.postMessage`):
 *   { type: "hc-donar:resize", height }        alto del contenido
 *   { type: "hc-donar:step", step }            "monto" | "datos" | "pago" | "gracias"
 *   { type: "hc-donar:success", amount, frequency }
 *
 * Configuración (montos, textos, documento, etc.): `data/hc-donar.ts`.
 * Parámetros de la URL: `campaign` (Id de campaña), `montos`
 * ("50000,38000,25000") y `medios` ("card" o "card,cbu"); los cargan en
 * WordPress.
 */
import { ref, useId } from "vue";
import "~/assets/css/hc.css";
import HcAmountStep from "~/components/hc/HcAmountStep.vue";
import HcPersonalStep from "~/components/hc/HcPersonalStep.vue";
import HcPaymentStep from "~/components/hc/HcPaymentStep.vue";
import HcSummary from "~/components/hc/HcSummary.vue";
import HcFinale from "~/components/hc/HcFinale.vue";
import type { DebiPaymentToken } from "~/composables/useDebiClient";
import { useHcDonation } from "~/composables/useHcDonation";

definePageMeta({ embed: true });

useHead({
  title: "Doná a Haciendo Camino",
  meta: [{ name: "robots", content: "noindex" }],
});

const STEPS = ["monto", "datos", "pago"] as const;
type Step = (typeof STEPS)[number] | "gracias";

const uid = useId() ?? "hc";
const {
  presets,
  paymentMethods,
  amount,
  personal,
  amountValue,
  contactId,
  errorMessage,
  savePersonalRequest,
  finalizeRequest,
  post,
  notifySuccess,
  root,
} = useHcDonation();

const step = ref<Step>("monto");
const direction = ref<"fwd" | "back">("fwd");
const sliding = ref(false);

const savingPersonal = ref(false);
const personalError = ref<string | null>(null);
const paymentError = ref<string | null>(null);
/** null: sin enviar · "loading": esperando a Salesforce · "success": listo */
const finale = ref<null | "loading" | "success">(null);
const finaleHeight = ref<number | null>(null);

const live = ref("");

function go(next: Step) {
  const from = STEPS.indexOf(step.value as (typeof STEPS)[number]);
  const to = STEPS.indexOf(next as (typeof STEPS)[number]);
  direction.value = to >= from ? "fwd" : "back";
  step.value = next;
  post({ type: "hc-donar:step", step: next });
  const labels: Record<Step, string> = {
    monto: "Paso 1 de 3: elegí tu donación",
    datos: "Paso 2 de 3: tus datos",
    pago: "Paso 3 de 3: método de pago",
    gracias: "¡Muchas gracias por tu ayuda!",
  };
  live.value = labels[next];
}

async function savePersonal() {
  personalError.value = null;
  savingPersonal.value = true;
  try {
    await savePersonalRequest();
    go("pago");
  } catch (error) {
    personalError.value = errorMessage(error, "No pudimos guardar tus datos. Revisá tu conexión e intentá de nuevo.");
  } finally {
    savingPersonal.value = false;
  }
}

async function finalize(token: DebiPaymentToken) {
  paymentError.value = null;
  if (!contactId.value) {
    paymentError.value = "Se perdió la referencia a tus datos. Volvé al paso anterior y continuá de nuevo.";
    return;
  }
  finaleHeight.value = root.value?.querySelector(".hc-stage")?.getBoundingClientRect().height ?? null;
  finale.value = "loading";
  live.value = "Estamos procesando tu donación…";
  try {
    await finalizeRequest(token);
    finale.value = "success";
    step.value = "gracias";
    live.value = "¡Muchas gracias por tu ayuda!";
    post({ type: "hc-donar:step", step: "gracias" });
    notifySuccess();
  } catch (error) {
    finale.value = null;
    paymentError.value = errorMessage(
      error,
      "No pudimos completar tu donación. Revisá los datos de pago e intentá de nuevo.",
    );
  }
}
</script>

<template>
  <main ref="root" class="hc-donar">
    <p class="hc-sr" role="status" aria-live="polite">{{ live }}</p>

    <div
      :class="['hc-stage', sliding && 'is-sliding']"
      :style="finale === 'success' && finaleHeight ? { minHeight: `max(24rem, ${finaleHeight}px)` } : undefined"
    >
      <Transition
        :name="finale === 'success' ? 'hc-instant' : `hc-slide-${direction}`"
        @before-leave="sliding = true"
        @after-enter="sliding = false"
        @enter-cancelled="sliding = false"
      >
        <HcAmountStep v-if="step === 'monto'" key="monto" v-model="amount" :uid="uid" :presets="presets" @next="go('datos')" />

        <HcPersonalStep
          v-else-if="step === 'datos'"
          key="datos"
          v-model="personal"
          :uid="uid"
          :loading="savingPersonal"
          :server-error="personalError"
          @back="go('monto')"
          @next="savePersonal"
        >
          <template #summary>
            <HcSummary
              :amount="amountValue"
              :frequency="amount.frequency"
              :disabled="savingPersonal"
              @edit="go('monto')"
            />
          </template>
        </HcPersonalStep>

        <HcPaymentStep
          v-else-if="step === 'pago'"
          key="pago"
          :uid="uid"
          :methods="paymentMethods"
          :busy="finale === 'loading'"
          :server-error="paymentError"
          @back="go('datos')"
          @confirm="finalize"
        >
          <template #summary>
            <HcSummary
              :amount="amountValue"
              :frequency="amount.frequency"
              :disabled="finale === 'loading'"
              @edit="go('monto')"
            />
          </template>
        </HcPaymentStep>
      </Transition>

      <HcFinale
        v-if="finale"
        :phase="finale"
        :class="['hc-stage__finale', finale === 'loading' && 'is-overlay']"
        :style="finale === 'success' && finaleHeight ? { minHeight: `max(24rem, ${finaleHeight}px)` } : undefined"
      />
    </div>
  </main>
</template>

<style scoped>
.hc-stage {
  position: relative;
}
.hc-stage.is-sliding {
  overflow-x: clip;
  overflow-clip-margin: 6px;
}

/* Mientras se procesa, el loader tapa el paso de pago (que sigue montado
   para no perder los datos de la tarjeta si hay que reintentar). */
.hc-stage__finale.is-overlay {
  position: absolute;
  inset: -6px;
  z-index: 10;
  min-height: 0;
  border-radius: 0;
  animation: hc-fade 0.25s ease both;
}

/* ---------- Cambio de paso: sale a un lado y entra del otro ---------- */
.hc-slide-fwd-enter-active,
.hc-slide-fwd-leave-active,
.hc-slide-back-enter-active,
.hc-slide-back-leave-active {
  transition:
    transform 0.45s var(--hc-ease),
    opacity 0.45s ease;
}
.hc-slide-fwd-leave-active,
.hc-slide-back-leave-active {
  position: absolute;
  inset: 0 0 auto;
}
.hc-slide-fwd-enter-from,
.hc-slide-back-leave-to {
  transform: translateX(105%);
  opacity: 0.4;
}
.hc-slide-fwd-leave-to,
.hc-slide-back-enter-from {
  transform: translateX(-105%);
  opacity: 0.4;
}

@keyframes hc-fade {
  from {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hc-slide-fwd-enter-from,
  .hc-slide-back-leave-to,
  .hc-slide-fwd-leave-to,
  .hc-slide-back-enter-from {
    transform: none;
    opacity: 0;
  }
}
</style>
