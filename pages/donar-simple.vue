<script setup lang="ts">
/**
 * /donar-simple · Formulario de donaciones de Haciendo Camino, diseño de una
 * sola página y sin animaciones. Es la alternativa a /donar (multistep): usa
 * los mismos estilos de campos (`assets/css/hc.css`), el mismo backend, los
 * mismos parámetros de URL (`campaign`, `montos`, `medios`) y manda los mismos
 * mensajes al sitio que lo embebe. La lógica está en
 * `composables/useHcDonation.ts` y el pago en `composables/usePaymentElement.ts`.
 *
 * Al confirmar, en este orden:
 *   1. se validan todos los campos;
 *   2. se tokeniza el medio de pago con Debi (así un pago inválido no deja
 *      un Contact creado);
 *   3. stage "personal" (crea o busca el Contact), salvo que ya se haya
 *      hecho con estos mismos datos en un intento anterior;
 *   4. stage "finalize" (método de pago + Recurring Donation u Opportunity).
 *
 * Mensajes al sitio que lo embebe: `hc-donar:resize`, `hc-donar:step`
 * (solo "gracias") y `hc-donar:success`.
 */
import { computed, nextTick, reactive, ref, useId } from "vue";
import "~/assets/css/hc.css";
import { useHcDonation } from "~/composables/useHcDonation";
import { usePaymentElement, type HcPaymentMethod } from "~/composables/usePaymentElement";
import { docError, phoneError } from "~/composables/hcValidators";
import { validateEmail } from "~/composables/validators";
import {
  HC_CUSTOM_DESCRIPTION,
  HC_DOCUMENT_TYPES,
  HC_MIN_AMOUNT,
  HC_RECEIPTS_EMAIL,
  formatHcMoney,
  type HcDocumentType,
  type HcFrequency,
} from "~/data/hc-donar";

definePageMeta({ embed: true });

useHead({
  title: "Doná a Haciendo Camino",
  meta: [{ name: "robots", content: "noindex" }],
});

const uid = useId() ?? "hc";
const {
  presets,
  paymentMethods,
  amount,
  personal,
  amountValue,
  errorMessage,
  savePersonalRequest,
  finalizeRequest,
  post,
  notifySuccess,
  root,
} = useHcDonation();
const { methods, method, mountTarget, fieldError, sdkError, ready, tokenizing, selectMethod, tokenize, dispose } =
  usePaymentElement(paymentMethods.value);

const FREQUENCY_OPTIONS: { value: HcFrequency; label: string }[] = [
  { value: "Mensual", label: "Todos los meses" },
  { value: "Única vez", label: "Una sola vez" },
];
const METHOD_LABELS: Record<HcPaymentMethod, string> = { card: "Tarjeta", cbu: "CBU" };

type Key = "amount" | "custom" | "firstName" | "lastName" | "docNumber" | "email" | "phoneCode" | "phone";
const ORDER: Key[] = ["amount", "custom", "firstName", "lastName", "docNumber", "email", "phoneCode", "phone"];
const FIELD_ID: Record<Key, string> = {
  amount: "monto",
  custom: "otro",
  firstName: "firstName",
  lastName: "lastName",
  docNumber: "docNumber",
  email: "email",
  phoneCode: "phoneCode",
  phone: "phone",
};
const errors = reactive<Partial<Record<Key, string>>>({});

const submitting = ref(false);
const done = ref(false);
const serverError = ref<string | null>(null);
const live = ref("");
const thanks = ref<HTMLElement | null>(null);
/** Datos con los que ya se creó el Contact: si no cambian, un reintento no vuelve a llamar a "personal". */
let savedPersonalKey: string | null = null;
let contactSaved = false;

/** El `<select>` de monto trabaja con texto: "" (sin elegir) · "otro" · el monto. */
const choiceModel = computed({
  get: () => (amount.value.choice === null ? "" : String(amount.value.choice)),
  set: (v: string) => {
    amount.value.choice = v === "" ? null : v === "otro" ? "otro" : Number(v);
    delete errors.amount;
    delete errors.custom;
    if (v === "otro") nextTick(() => document.getElementById(`${uid}-otro`)?.focus());
  },
});

function onCustomInput(e: Event) {
  const input = e.target as HTMLInputElement;
  const only = input.value.replace(/\D/g, "").slice(0, 9);
  const formatted = only ? new Intl.NumberFormat("es-AR").format(Number(only)) : "";
  input.value = formatted;
  amount.value.custom = formatted;
  delete errors.custom;
}

function clear(key: Key) {
  delete errors[key];
}

function validate(): boolean {
  for (const k of ORDER) delete errors[k];
  const a = amount.value;
  if (a.choice === null) errors.amount = "Elegí el monto de tu donación.";
  else if (a.choice === "otro") {
    const n = Number(a.custom.replace(/\D/g, ""));
    if (!n) errors.custom = "Ingresá el monto que querés donar.";
    else if (n < HC_MIN_AMOUNT) errors.custom = `El monto mínimo es ${formatHcMoney(HC_MIN_AMOUNT)}.`;
  }
  const d = personal.value;
  if (!d.firstName.trim()) errors.firstName = "Ingresá tu nombre.";
  if (!d.lastName.trim()) errors.lastName = "Ingresá tu apellido.";
  const doc = docError(d.docType, d.docNumber);
  if (doc) errors.docNumber = doc;
  if (!d.email.trim()) errors.email = "Ingresá tu email.";
  else if (!validateEmail(d.email.trim())) errors.email = "Revisá el email, parece incompleto.";
  const ph = phoneError(d.phoneCode, d.phone);
  if (ph.code) errors.phoneCode = ph.code;
  if (ph.phone) errors.phone = ph.phone;

  const first = ORDER.find((k) => errors[k]);
  if (first) {
    live.value = errors[first] ?? "";
    nextTick(() => document.getElementById(`${uid}-${FIELD_ID[first]}`)?.focus());
    return false;
  }
  return true;
}

function invalid(k: Key) {
  return errors[k] ? "true" : undefined;
}
function described(k: Key) {
  return errors[k] ? `${uid}-${FIELD_ID[k]}-err` : undefined;
}

function personalKey(): string {
  const p = personal.value;
  return JSON.stringify([p.firstName, p.lastName, p.email, p.phoneCode, p.phone].map((v) => v.trim().toLowerCase()));
}

async function submit() {
  if (submitting.value || tokenizing.value) return;
  serverError.value = null;
  if (!validate()) return;

  submitting.value = true;
  live.value = "Estamos procesando tu donación…";
  try {
    const token = await tokenize();
    if (!token) return; // el motivo ya lo muestra Debi o `fieldError`

    const key = personalKey();
    if (!contactSaved || key !== savedPersonalKey) {
      await savePersonalRequest();
      contactSaved = true;
      savedPersonalKey = key;
    }
    await finalizeRequest(token);

    dispose();
    done.value = true;
    live.value = "¡Muchas gracias por tu ayuda!";
    post({ type: "hc-donar:step", step: "gracias" });
    notifySuccess();
    nextTick(() => thanks.value?.focus());
  } catch (error) {
    serverError.value = errorMessage(
      error,
      "No pudimos completar tu donación. Revisá los datos e intentá de nuevo.",
    );
  } finally {
    submitting.value = false;
  }
}

function onKeyMethods(e: KeyboardEvent) {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  if (methods.length < 2) return;
  const i = methods.indexOf(method.value as HcPaymentMethod);
  const next = methods[(i + (e.key === "ArrowRight" ? 1 : -1) + methods.length) % methods.length];
  selectMethod(next);
  nextTick(() => document.getElementById(`${uid}-pm-${next}`)?.focus());
}

const docPlaceholder = computed(() => {
  const t: HcDocumentType = personal.value.docType;
  return t === "DNI" ? "Ej. 12345678" : t === "Pasaporte" ? "Ej. AAA123456" : "Ej. 20123456789";
});
</script>

<template>
  <main ref="root" class="hc-donar hc-simple">
    <p class="hc-sr" role="status" aria-live="polite">{{ live }}</p>

    <section v-if="done" ref="thanks" class="hc-simple__thanks" tabindex="-1">
      <h2>¡Muchas gracias por tu ayuda!</h2>
      <p>Registramos tu donación.</p>
    </section>

    <form v-else class="hc-simple__form" novalidate @submit.prevent="submit">
      <div class="hc-field">
        <label class="hc-label" :for="`${uid}-frequency`">¿Con qué frecuencia querés donar?</label>
        <div class="hc-select">
          <select :id="`${uid}-frequency`" v-model="amount.frequency" class="hc-input" :disabled="submitting">
            <option v-for="f in FREQUENCY_OPTIONS" :key="f.value" :value="f.value">{{ f.label }}</option>
          </select>
        </div>
      </div>

      <div class="hc-field">
        <label class="hc-label" :for="`${uid}-monto`">Monto de la donación</label>
        <div class="hc-select">
          <select
            :id="`${uid}-monto`"
            v-model="choiceModel"
            class="hc-input"
            :disabled="submitting"
            :aria-invalid="invalid('amount')"
            :aria-describedby="described('amount')"
          >
            <option value="" disabled>Elegí un monto</option>
            <option v-for="p in presets" :key="p.value" :value="String(p.value)">
              {{ formatHcMoney(p.value) }} — {{ p.description }}
            </option>
            <option value="otro">Otro monto — {{ HC_CUSTOM_DESCRIPTION }}</option>
          </select>
        </div>
        <p v-if="errors.amount" :id="`${uid}-monto-err`" class="hc-error">{{ errors.amount }}</p>
      </div>

      <div v-if="amount.choice === 'otro'" class="hc-field">
        <label class="hc-label" :for="`${uid}-otro`">Ingresá el monto</label>
        <div class="hc-simple__money">
          <span aria-hidden="true">$</span>
          <input
            :id="`${uid}-otro`"
            class="hc-input"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            placeholder="Ej. 15.000"
            :value="amount.custom"
            :disabled="submitting"
            :aria-invalid="invalid('custom')"
            :aria-describedby="described('custom')"
            @input="onCustomInput"
          />
        </div>
        <p v-if="errors.custom" :id="`${uid}-otro-err`" class="hc-error">{{ errors.custom }}</p>
      </div>

      <div class="hc-row">
        <div class="hc-field">
          <label class="hc-label" :for="`${uid}-firstName`">Nombre</label>
          <input
            :id="`${uid}-firstName`"
            v-model="personal.firstName"
            class="hc-input"
            type="text"
            autocomplete="given-name"
            placeholder="Tu nombre"
            :disabled="submitting"
            :aria-invalid="invalid('firstName')"
            :aria-describedby="described('firstName')"
            @input="clear('firstName')"
          />
          <p v-if="errors.firstName" :id="`${uid}-firstName-err`" class="hc-error">{{ errors.firstName }}</p>
        </div>
        <div class="hc-field">
          <label class="hc-label" :for="`${uid}-lastName`">Apellido</label>
          <input
            :id="`${uid}-lastName`"
            v-model="personal.lastName"
            class="hc-input"
            type="text"
            autocomplete="family-name"
            placeholder="Tu apellido"
            :disabled="submitting"
            :aria-invalid="invalid('lastName')"
            :aria-describedby="described('lastName')"
            @input="clear('lastName')"
          />
          <p v-if="errors.lastName" :id="`${uid}-lastName-err`" class="hc-error">{{ errors.lastName }}</p>
        </div>
      </div>

      <div class="hc-row hc-row--narrow-first">
        <div class="hc-field">
          <label class="hc-label" :for="`${uid}-docType`">Tipo de documento</label>
          <div class="hc-select">
            <select :id="`${uid}-docType`" v-model="personal.docType" class="hc-input" :disabled="submitting">
              <option v-for="t in HC_DOCUMENT_TYPES" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
        </div>
        <div class="hc-field">
          <label class="hc-label" :for="`${uid}-docNumber`">Nro. de documento</label>
          <input
            :id="`${uid}-docNumber`"
            v-model="personal.docNumber"
            class="hc-input"
            type="text"
            :inputmode="personal.docType === 'Pasaporte' ? 'text' : 'numeric'"
            autocomplete="off"
            :placeholder="docPlaceholder"
            maxlength="13"
            :disabled="submitting"
            :aria-invalid="invalid('docNumber')"
            :aria-describedby="described('docNumber')"
            @input="clear('docNumber')"
          />
          <p v-if="errors.docNumber" :id="`${uid}-docNumber-err`" class="hc-error">{{ errors.docNumber }}</p>
        </div>
      </div>

      <div class="hc-field">
        <label class="hc-label" :for="`${uid}-email`">Email</label>
        <input
          :id="`${uid}-email`"
          v-model="personal.email"
          class="hc-input"
          type="email"
          autocomplete="email"
          placeholder="nombre@correo.com"
          :disabled="submitting"
          :aria-invalid="invalid('email')"
          :aria-describedby="described('email')"
          @input="clear('email')"
        />
        <p v-if="errors.email" :id="`${uid}-email-err`" class="hc-error">{{ errors.email }}</p>
      </div>

      <div class="hc-row hc-simple__phone">
        <div class="hc-field">
          <label class="hc-label" :for="`${uid}-phoneCode`">Código</label>
          <input
            :id="`${uid}-phoneCode`"
            v-model="personal.phoneCode"
            class="hc-input"
            type="text"
            inputmode="tel"
            autocomplete="tel-country-code"
            placeholder="+54"
            maxlength="5"
            :disabled="submitting"
            :aria-invalid="invalid('phoneCode')"
            :aria-describedby="described('phoneCode')"
            @input="clear('phoneCode')"
          />
          <p v-if="errors.phoneCode" :id="`${uid}-phoneCode-err`" class="hc-error">{{ errors.phoneCode }}</p>
        </div>
        <div class="hc-field">
          <label class="hc-label" :for="`${uid}-phone`">Celular (con código de área)</label>
          <input
            :id="`${uid}-phone`"
            v-model="personal.phone"
            class="hc-input"
            type="tel"
            inputmode="tel"
            autocomplete="tel-national"
            placeholder="11 1234 5678"
            :disabled="submitting"
            :aria-invalid="invalid('phone')"
            :aria-describedby="described('phone')"
            @input="clear('phone')"
          />
          <p v-if="errors.phone" :id="`${uid}-phone-err`" class="hc-error">{{ errors.phone }}</p>
        </div>
      </div>

      <div
        v-if="methods.length > 1"
        class="hc-simple__methods"
        role="tablist"
        aria-label="Método de pago"
        :style="{ '--n': methods.length }"
        @keydown="onKeyMethods"
      >
        <button
          v-for="m in methods"
          :id="`${uid}-pm-${m}`"
          :key="m"
          type="button"
          role="tab"
          class="hc-simple__method"
          :aria-selected="method === m"
          :aria-controls="`${uid}-pm-panel`"
          :tabindex="method === m ? 0 : -1"
          :disabled="submitting"
          @click="selectMethod(m)"
        >
          {{ METHOD_LABELS[m] }}
        </button>
      </div>

      <div :id="`${uid}-pm-panel`" :key="method" class="hc-simple__panel">
        <p v-if="method === 'cbu'" class="hc-simple__hint">
          Debitamos la donación de tu cuenta bancaria. Ingresá el CBU de una cuenta a tu nombre.
        </p>
        <div ref="mountTarget" :class="['hc-simple__element', (submitting || tokenizing) && 'is-busy']"></div>
      </div>

      <p v-if="sdkError" class="hc-alert" role="alert">{{ sdkError }}</p>
      <p v-else-if="fieldError" class="hc-error" role="alert">{{ fieldError }}</p>
      <p v-if="serverError" class="hc-alert" role="alert">{{ serverError }}</p>

      <button type="submit" class="hc-simple__submit" :disabled="submitting || !!sdkError || !ready">
        {{ submitting ? "Procesando…" : "Donar" }}
      </button>

      <div class="hc-simple__legal">
        <p>*Campos obligatorios</p>
        <p>El formulario que contiene esta página es seguro, usa tecnología SSL y encriptación de datos.</p>
        <p>
          <strong>
            Para donaciones de empresa puedes solicitar el recibo digital indicando la Razón social y CUIT al mail
            <a :href="`mailto:${HC_RECEIPTS_EMAIL}`">{{ HC_RECEIPTS_EMAIL }}</a>
          </strong>
        </p>
        <p>
          <strong>
            Las donaciones a Haciendo Camino Asociación Civil son deducibles del Impuesto a las Ganancias según el Art.
            81 de la Ley N° 20.628.
          </strong>
        </p>
      </div>
    </form>
  </main>
</template>

<style scoped>
/* Sin animaciones ni transiciones: este diseño es deliberadamente quieto. */
.hc-simple__form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.hc-simple__form .hc-input,
.hc-simple__form .hc-input[aria-invalid="true"] {
  animation: none;
  transition: none;
}
.hc-simple__form .hc-error,
.hc-simple__form .hc-alert {
  animation: none;
}

/* Las opciones largas del monto se cortan con "…" en vez de saltar de línea. */
.hc-simple__form select.hc-input {
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hc-simple__phone {
  grid-template-columns: 6rem 1fr;
}
@media (max-width: 340px) {
  .hc-simple__phone {
    grid-template-columns: 5rem 1fr;
  }
}

.hc-simple__money {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 0.5rem;
  font-weight: 700;
}

/* ---------- Medios de pago ---------- */
.hc-simple__methods {
  display: grid;
  grid-template-columns: repeat(var(--n, 2), 1fr);
  gap: 1rem;
  margin-top: 0.5rem;
}
.hc-simple__method {
  height: 3rem;
  padding: 0 1rem;
  background: var(--hc-white);
  color: var(--hc-dark);
  border: 1px solid var(--hc-dark);
  border-radius: 0.5rem;
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
}
.hc-simple__method[aria-selected="true"] {
  background: var(--hc-red);
  border-color: var(--hc-red);
  color: var(--hc-white);
}
.hc-simple__method:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgb(188 40 41 / 0.25);
}
.hc-simple__method:disabled {
  opacity: 0.6;
  cursor: default;
}

.hc-simple__panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 5.5rem;
}
.hc-simple__hint {
  margin: 0;
  font-size: 0.875rem;
}
.hc-simple__element.is-busy {
  pointer-events: none;
  opacity: 0.6;
}

/* ---------- Botón ---------- */
.hc-simple__submit {
  align-self: flex-start;
  height: 3rem;
  margin-top: 0.5rem;
  padding: 0 2.25rem;
  background: var(--hc-red);
  color: var(--hc-white);
  border: 0;
  border-radius: 100px;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
}
.hc-simple__submit:hover:not(:disabled) {
  background: #a32122;
}
.hc-simple__submit:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgb(188 40 41 / 0.35);
}
.hc-simple__submit:disabled {
  opacity: 0.6;
  cursor: default;
}

/* ---------- Texto legal ---------- */
.hc-simple__legal {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  font-size: 0.875rem;
  line-height: 1.35;
}
.hc-simple__legal p {
  margin: 0;
}
.hc-simple__legal a {
  color: inherit;
}

/* ---------- Gracias ---------- */
.hc-simple__thanks {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem 1rem;
  text-align: center;
}
.hc-simple__thanks:focus {
  outline: none;
}
.hc-simple__thanks h2 {
  margin: 0;
  color: var(--hc-red);
  font-family: var(--hc-display);
  font-size: 1.75rem;
  font-weight: 800;
  line-height: 1.1;
}
.hc-simple__thanks p {
  margin: 0;
}
</style>
