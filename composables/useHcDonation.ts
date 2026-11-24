/**
 * Lógica compartida de los formularios de donación de Haciendo Camino.
 * La usan los dos diseños, que solo cambian lo visual:
 *   - /donar         → multistep con animaciones (pages/donar.vue)
 *   - /donar-simple  → una sola página, sin animaciones (pages/donar-simple.vue)
 *
 * Acá vive todo lo que NO es visual: parámetros de la URL (`campaign`,
 * `montos`, `medios`), estado del monto y de los datos, las dos llamadas al
 * backend (`personal` y `finalize`) y los mensajes al sitio que embebe
 * (`window.parent.postMessage`).
 *
 * Mensajes al sitio que lo embebe (los mismos en los dos diseños):
 *   { type: "hc-donar:resize", height }        alto del contenido
 *   { type: "hc-donar:step", step }            "monto" | "datos" | "pago" | "gracias"
 *   { type: "hc-donar:success", amount, frequency }
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import type { HcAmountData } from "~/components/hc/HcAmountStep.vue";
import type { HcPersonalData } from "~/components/hc/HcPersonalStep.vue";
import type { DebiPaymentToken } from "~/composables/useDebiClient";
import { HC_DEFAULT_AMOUNT, hcPaymentMethods, hcPresets } from "~/data/hc-donar";

/** Los dos diseños le pegan al mismo endpoint. */
export const HC_ENDPOINT = "/api/flow/alta-donante-alternativo";

type ApiResponse<T = unknown> = { error: boolean; message?: string; data?: T };

function firstQuery(q: unknown): string {
  return Array.isArray(q) ? String(q[0] ?? "") : String(q ?? "");
}

export function useHcDonation() {
  const route = useRoute();

  const campaign = computed(() => firstQuery(route.query.campaign).trim());
  /** Montos sugeridos: los manda WordPress (opciones ACF) en `?montos=`. */
  const presets = computed(() => hcPresets(firstQuery(route.query.montos) || null));
  /** Medios de pago: WordPress los manda en `?medios=` (por defecto, `HC_PAYMENT_METHODS`). */
  const paymentMethods = computed(() => hcPaymentMethods(firstQuery(route.query.medios) || null));

  const amount = ref<HcAmountData>({ frequency: "Mensual", choice: HC_DEFAULT_AMOUNT, custom: "" });
  const personal = ref<HcPersonalData>({
    firstName: "",
    lastName: "",
    docType: "DNI",
    docNumber: "",
    email: "",
    phoneCode: "+54",
    phone: "",
  });
  const contactId = ref<string | null>(null);

  const amountValue = computed(() => {
    const a = amount.value;
    if (a.choice === null) return 0;
    if (a.choice !== "otro") return a.choice;
    return Number(a.custom.replace(/\D/g, "")) || 0;
  });

  function normalizedDocument(): string {
    const { docType, docNumber } = personal.value;
    return docType === "Pasaporte"
      ? docNumber.replace(/[\s.-]/g, "").toUpperCase()
      : docNumber.replace(/\D/g, "");
  }

  function errorMessage(error: unknown, fallback: string): string {
    const data = (error as { data?: { message?: string } })?.data;
    if (data?.message) return data.message;
    if (error instanceof Error && error.message && !/^\[?(POST|GET)\b|fetch failed/i.test(error.message)) {
      return error.message;
    }
    return fallback;
  }

  /** stage "personal": crea o busca el Contact. Lanza un Error con el mensaje para mostrar. */
  async function savePersonalRequest(): Promise<void> {
    const p = personal.value;
    const res = await $fetch<ApiResponse<{ contactId: string }>>(HC_ENDPOINT, {
      method: "POST",
      body: {
        stage: "personal",
        personal: {
          firstName: p.firstName.trim(),
          lastName: p.lastName.trim(),
          email: p.email.trim().toLowerCase(),
          phone: `+${p.phoneCode.replace(/\D/g, "")} ${p.phone.replace(/\D/g, "")}`,
        },
        phoneFixed: null,
        campaign: campaign.value || null,
      },
    });
    if (res.error || !res.data?.contactId) {
      throw new Error(res.message ?? "No pudimos guardar tus datos. Intentá de nuevo.");
    }
    contactId.value = res.data.contactId;
  }

  /** stage "finalize": método de pago + Recurring Donation u Opportunity. */
  async function finalizeRequest(token: DebiPaymentToken): Promise<void> {
    if (!contactId.value) {
      throw new Error("Se perdió la referencia a tus datos. Volvé a intentarlo.");
    }
    const res = await $fetch<ApiResponse>(HC_ENDPOINT, {
      method: "POST",
      body: {
        stage: "finalize",
        contactId: contactId.value,
        amount: amountValue.value,
        frequency: amount.value.frequency,
        paymentMethodToken: token,
        dni: normalizedDocument(),
        campaign: campaign.value || null,
      },
    });
    if (res.error) throw new Error(res.message ?? "No pudimos completar tu donación.");
  }

  // ---------- Comunicación con el sitio que embebe ----------
  function post(message: Record<string, unknown>) {
    if (typeof window === "undefined" || window.parent === window) return;
    window.parent.postMessage(message, "*");
  }

  function notifySuccess() {
    post({ type: "hc-donar:success", amount: amountValue.value, frequency: amount.value.frequency });
  }

  /** Poné `ref="root"` en el contenedor principal para que se informe su alto. */
  const root = ref<HTMLElement | null>(null);
  let observer: ResizeObserver | null = null;
  let lastHeight = 0;
  function reportHeight() {
    const h = Math.ceil(root.value?.getBoundingClientRect().height ?? 0);
    if (h && h !== lastHeight) {
      lastHeight = h;
      post({ type: "hc-donar:resize", height: h });
    }
  }
  onMounted(() => {
    if (root.value && "ResizeObserver" in window) {
      observer = new ResizeObserver(reportHeight);
      observer.observe(root.value);
    }
    nextTick(reportHeight);
  });
  onBeforeUnmount(() => observer?.disconnect());

  return {
    campaign,
    presets,
    paymentMethods,
    amount,
    personal,
    contactId,
    amountValue,
    normalizedDocument,
    errorMessage,
    savePersonalRequest,
    finalizeRequest,
    post,
    notifySuccess,
    root,
  };
}
