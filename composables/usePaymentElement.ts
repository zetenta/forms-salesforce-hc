/**
 * Elemento de pago de Debi (tarjeta / CBU) para el formulario de Haciendo
 * Camino. Lo comparten los dos diseños: el paso 3 del multistep
 * (`HcPaymentStep`) y la página única (`/donar-simple`).
 *
 * Los campos los dibuja el SDK de Debi en este mismo documento; el estilo va
 * por `appearance` (variables + rules), nunca tocando sus clases. Cada medio
 * monta un elemento con un solo método (`allowedTypes: [type]`) para que las
 * tabs sean las del diseño y no las del SDK.
 *
 * Uso: llamar en el `<script setup>`, poner `ref="mountTarget"` en el div
 * donde van los campos y, al confirmar, `await tokenize()`.
 */
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import {
  useDebiClient,
  type DebiClient,
  type DebiElement,
  type DebiElementState,
  type DebiPaymentMethodType,
  type DebiPaymentToken,
} from "~/composables/useDebiClient";
import { HC_CARD_EXTRA_FIELDS, HC_PAYMENT_METHODS } from "~/data/hc-donar";

export type HcPaymentMethod = "card" | "cbu";

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

/** Los errores de red del SDK llegan en inglés ("Failed to fetch"). */
function friendly(message?: string): string {
  if (!message || /failed to fetch|network|load failed|status \d+|request failed/i.test(message)) {
    return "No pudimos validar los datos de pago. Revisá tu conexión e intentá de nuevo.";
  }
  return message;
}

/**
 * El SDK de Debi se carga con un `<script defer>` (nuxt.config.ts) y puede no
 * estar listo cuando el componente se monta. En el multistep no pasa porque el
 * paso de pago se monta tarde; en /donar-simple el pago está en la primera
 * pantalla, así que se espera a `window.Debi` (hasta `timeoutMs`).
 */
function waitForDebi(timeoutMs = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Debi) return resolve();
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (window.Debi) {
        window.clearInterval(timer);
        resolve();
      } else if (Date.now() - started > timeoutMs) {
        window.clearInterval(timer);
        reject(new Error("No se cargó el SDK de Debi"));
      }
    }, 100);
  });
}

/**
 * @param requested medios a ofrecer, en orden (de `?medios=` o de
 *   `HC_PAYMENT_METHODS`). Si viene vacío se usa `HC_PAYMENT_METHODS`, y si
 *   también está vacío, solo tarjeta.
 */
export function usePaymentElement(requested?: HcPaymentMethod[]) {
  const methods: HcPaymentMethod[] = requested?.length
    ? requested
    : HC_PAYMENT_METHODS.length
      ? HC_PAYMENT_METHODS
      : ["card"];
  const method = ref<DebiPaymentMethodType>(methods[0]);
  const mountTarget = ref<HTMLDivElement | null>(null);
  const fieldError = ref<string | null>(null);
  const sdkError = ref<string | null>(null);
  const ready = ref(false);
  const tokenizing = ref(false);

  let debi: DebiClient | null = null;
  let element: DebiElement | null = null;
  let elementState: DebiElementState | null = null;

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

  onMounted(async () => {
    try {
      await waitForDebi();
      debi = useDebiClient();
      mount();
    } catch (error) {
      sdkError.value =
        "No pudimos cargar el formulario de pago. Recargá la página o probá en unos minutos.";
      console.error("[donar] Debi SDK", error);
    }
  });

  function dispose() {
    element?.unmount();
    element = null;
  }
  onBeforeUnmount(() => {
    dispose();
    debi = null;
  });

  function selectMethod(type: DebiPaymentMethodType) {
    if (type === method.value) return;
    method.value = type;
    nextTick(mount);
  }

  /**
   * Valida y tokeniza el medio de pago. Devuelve el token, o `null` si algo
   * falló (el mensaje queda en `fieldError` o lo muestra Debi bajo el campo).
   */
  async function tokenize(): Promise<DebiPaymentToken | null> {
    if (!element || !debi || tokenizing.value) return null;
    fieldError.value = null;
    if (!elementState || elementState.empty) {
      fieldError.value =
        method.value === "card" ? "Ingresá el número de tu tarjeta." : "Ingresá el número de tu CBU.";
      element.focus();
      return null;
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
        return null;
      }
      return token;
    } catch (error) {
      fieldError.value = friendly(error instanceof Error ? error.message : undefined);
      return null;
    } finally {
      tokenizing.value = false;
    }
  }

  return { methods, method, mountTarget, fieldError, sdkError, ready, tokenizing, selectMethod, tokenize, dispose };
}
