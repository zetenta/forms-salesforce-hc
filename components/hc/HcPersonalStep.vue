<script setup lang="ts">
/**
 * Paso 2 · Datos: nombre, apellido, documento, email y teléfono.
 * Nombre y apellido van separados porque Salesforce los exige así.
 * El padre hace el envío a Salesforce (stage "personal") al recibir `next`.
 */
import { nextTick, reactive } from "vue";
import HcButton from "~/components/hc/HcButton.vue";
import { HC_DOCUMENT_TYPES, type HcDocumentType } from "~/data/hc-donar";
import { validateCuil, validateEmail } from "~/composables/validators";

export interface HcPersonalData {
  firstName: string;
  lastName: string;
  docType: HcDocumentType;
  docNumber: string;
  email: string;
  phoneCode: string;
  phone: string;
}

const props = defineProps<{
  modelValue: HcPersonalData;
  uid: string;
  loading?: boolean;
  serverError?: string | null;
}>();
const emit = defineEmits<{
  "update:modelValue": [value: HcPersonalData];
  next: [];
  back: [];
}>();

type Key = "firstName" | "lastName" | "docNumber" | "email" | "phoneCode" | "phone";
const errors = reactive<Partial<Record<Key, string>>>({});
const ORDER: Key[] = ["firstName", "lastName", "docNumber", "email", "phoneCode", "phone"];

function set<K extends keyof HcPersonalData>(key: K, value: HcPersonalData[K]) {
  emit("update:modelValue", { ...props.modelValue, [key]: value });
  if (key in errors) delete errors[key as Key];
}

function digits(v: string) {
  return v.replace(/\D/g, "");
}

function docError(type: HcDocumentType, raw: string): string | undefined {
  const value = type === "Pasaporte" ? raw.replace(/[\s.-]/g, "").toUpperCase() : digits(raw);
  if (!value) return "Ingresá tu número de documento.";
  if (type === "DNI" && !/^\d{7,8}$/.test(value)) return "El DNI tiene que tener 7 u 8 números.";
  if ((type === "CUIT" || type === "CUIL") && !validateCuil(value)) {
    return `El ${type} tiene que tener 11 números, sin guiones.`;
  }
  if (type === "Pasaporte" && !/^[A-Z0-9]{6,13}$/.test(value)) return "Revisá el número de pasaporte.";
  return undefined;
}

function phoneError(code: string, phone: string): { code?: string; phone?: string } {
  const out: { code?: string; phone?: string } = {};
  if (!/^\+?\d{1,4}$/.test(code.trim())) out.code = "Ej. +54";
  const n = digits(phone);
  const isAr = digits(code) === "54";
  if (!n) out.phone = "Ingresá tu teléfono.";
  else if (isAr && n.length !== 10) out.phone = "Código de área sin 0 y número sin 15 (10 números).";
  else if (!isAr && (n.length < 6 || n.length > 14)) out.phone = "Revisá el número de teléfono.";
  return out;
}

function validate(): boolean {
  for (const k of ORDER) delete errors[k];
  const d = props.modelValue;
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
    nextTick(() => document.getElementById(`${props.uid}-${first}`)?.focus());
    return false;
  }
  return true;
}

function submit() {
  if (props.loading) return;
  if (validate()) emit("next");
}

function invalid(k: Key) {
  return errors[k] ? "true" : undefined;
}
function described(k: Key) {
  return errors[k] ? `${props.uid}-${k}-err` : undefined;
}
</script>

<template>
  <form class="hc-personal" novalidate @submit.prevent="submit">
    <h2 class="hc-sr">Tus datos</h2>
    <slot name="summary" />

    <div class="hc-row">
      <div class="hc-field">
        <label class="hc-label" :for="`${uid}-firstName`">Nombre</label>
        <input
          :id="`${uid}-firstName`"
          class="hc-input"
          type="text"
          autocomplete="given-name"
          placeholder="Tu nombre"
          :value="modelValue.firstName"
          :disabled="loading"
          :aria-invalid="invalid('firstName')"
          :aria-describedby="described('firstName')"
          @input="set('firstName', ($event.target as HTMLInputElement).value)"
        />
        <p v-if="errors.firstName" :id="`${uid}-firstName-err`" class="hc-error">{{ errors.firstName }}</p>
      </div>
      <div class="hc-field">
        <label class="hc-label" :for="`${uid}-lastName`">Apellido</label>
        <input
          :id="`${uid}-lastName`"
          class="hc-input"
          type="text"
          autocomplete="family-name"
          placeholder="Tu apellido"
          :value="modelValue.lastName"
          :disabled="loading"
          :aria-invalid="invalid('lastName')"
          :aria-describedby="described('lastName')"
          @input="set('lastName', ($event.target as HTMLInputElement).value)"
        />
        <p v-if="errors.lastName" :id="`${uid}-lastName-err`" class="hc-error">{{ errors.lastName }}</p>
      </div>
    </div>

    <div class="hc-row hc-row--narrow-first">
      <div class="hc-field">
        <label class="hc-label" :for="`${uid}-docType`">Tipo de documento</label>
        <div class="hc-select">
          <select
            :id="`${uid}-docType`"
            class="hc-input"
            :value="modelValue.docType"
            :disabled="loading"
            @change="set('docType', ($event.target as HTMLSelectElement).value as HcDocumentType)"
          >
            <option v-for="t in HC_DOCUMENT_TYPES" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
      </div>
      <div class="hc-field">
        <label class="hc-label" :for="`${uid}-docNumber`">Número de documento</label>
        <input
          :id="`${uid}-docNumber`"
          class="hc-input"
          type="text"
          :inputmode="modelValue.docType === 'Pasaporte' ? 'text' : 'numeric'"
          autocomplete="off"
          :placeholder="modelValue.docType === 'DNI' ? 'Ej. 12345678' : modelValue.docType === 'Pasaporte' ? 'Ej. AAA123456' : 'Ej. 20123456789'"
          maxlength="13"
          :value="modelValue.docNumber"
          :disabled="loading"
          :aria-invalid="invalid('docNumber')"
          :aria-describedby="described('docNumber')"
          @input="set('docNumber', ($event.target as HTMLInputElement).value)"
        />
        <p v-if="errors.docNumber" :id="`${uid}-docNumber-err`" class="hc-error">{{ errors.docNumber }}</p>
      </div>
    </div>

    <div class="hc-field">
      <label class="hc-label" :for="`${uid}-email`">Email</label>
      <input
        :id="`${uid}-email`"
        class="hc-input"
        type="email"
        autocomplete="email"
        placeholder="nombre@correo.com"
        :value="modelValue.email"
        :disabled="loading"
        :aria-invalid="invalid('email')"
        :aria-describedby="described('email')"
        @input="set('email', ($event.target as HTMLInputElement).value)"
      />
      <p v-if="errors.email" :id="`${uid}-email-err`" class="hc-error">{{ errors.email }}</p>
    </div>

    <div class="hc-row hc-row--phone">
      <div class="hc-field">
        <label class="hc-label" :for="`${uid}-phoneCode`">Código</label>
        <input
          :id="`${uid}-phoneCode`"
          class="hc-input"
          type="text"
          inputmode="tel"
          autocomplete="tel-country-code"
          placeholder="+54"
          maxlength="5"
          :value="modelValue.phoneCode"
          :disabled="loading"
          :aria-invalid="invalid('phoneCode')"
          :aria-describedby="described('phoneCode')"
          @input="set('phoneCode', ($event.target as HTMLInputElement).value)"
        />
        <p v-if="errors.phoneCode" :id="`${uid}-phoneCode-err`" class="hc-error">{{ errors.phoneCode }}</p>
      </div>
      <div class="hc-field">
        <label class="hc-label" :for="`${uid}-phone`">Teléfono</label>
        <input
          :id="`${uid}-phone`"
          class="hc-input"
          type="tel"
          inputmode="tel"
          autocomplete="tel-national"
          placeholder="11 1234 5678"
          :value="modelValue.phone"
          :disabled="loading"
          :aria-invalid="invalid('phone')"
          :aria-describedby="described('phone')"
          @input="set('phone', ($event.target as HTMLInputElement).value)"
        />
        <p v-if="errors.phone" :id="`${uid}-phone-err`" class="hc-error">{{ errors.phone }}</p>
      </div>
    </div>

    <p v-if="serverError" class="hc-alert" role="alert">{{ serverError }}</p>

    <div class="hc-actions">
      <HcButton variant="outline" :disabled="loading" @click="emit('back')">Volver</HcButton>
      <HcButton type="submit" :loading="loading">Siguiente</HcButton>
    </div>
  </form>
</template>

<style scoped>
.hc-personal {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.hc-row--phone {
  grid-template-columns: 6rem 1fr;
}
@media (max-width: 340px) {
  .hc-row--phone {
    grid-template-columns: 5rem 1fr;
  }
}
</style>
