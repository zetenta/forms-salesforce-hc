<script setup lang="ts">
/** Resumen del monto que se muestra arriba de los pasos Datos y Pago. */
import { computed } from "vue";
import { HC_FREQUENCIES, formatHcMoney, type HcFrequency } from "~/data/hc-donar";

const props = defineProps<{ amount: number; frequency: HcFrequency; disabled?: boolean }>();
defineEmits<{ edit: [] }>();

const label = computed(
  () => HC_FREQUENCIES.find((f) => f.value === props.frequency)?.summary ?? props.frequency,
);
</script>

<template>
  <div class="hc-summary">
    <span class="hc-summary__coin" aria-hidden="true">$</span>
    <strong class="hc-summary__amount">{{ formatHcMoney(amount) }}</strong>
    <span class="hc-summary__type">{{ label }}</span>
    <button type="button" class="hc-summary__edit" :disabled="disabled" @click="$emit('edit')">
      Editar monto
    </button>
  </div>
</template>

<style scoped>
.hc-summary {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 1rem 0.5rem 0.5rem;
  background: var(--hc-gray);
  border-radius: 100px;
  font-size: 0.875rem;
}

.hc-summary__coin {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  background: var(--hc-coin);
  box-shadow: inset 0 0 0 3px #fcd36a;
  color: var(--hc-orange);
  font-size: 0.9375rem;
  font-weight: 800;
  line-height: 1;
}

.hc-summary__amount {
  font-size: 1.0625rem;
  font-weight: 700;
  white-space: nowrap;
}

.hc-summary__type {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.hc-summary__edit {
  margin-left: auto;
  padding: 0;
  white-space: nowrap;
  background: none;
  border: 0;
  color: var(--hc-red);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}
.hc-summary__edit:hover {
  text-decoration-thickness: 2px;
}
.hc-summary__edit:focus-visible {
  outline: 2px solid var(--hc-red);
  outline-offset: 3px;
}
.hc-summary__edit:disabled {
  opacity: 0.5;
  cursor: default;
}

@media (max-width: 480px) {
  .hc-summary {
    gap: 0.35rem;
    padding-right: 0.75rem;
    font-size: 0.8125rem;
  }
}
@media (max-width: 400px) {
  .hc-summary__type {
    font-size: 10px;
    letter-spacing: 0.06em;
  }
}
</style>
