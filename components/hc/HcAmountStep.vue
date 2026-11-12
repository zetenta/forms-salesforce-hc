<script setup lang="ts">
/**
 * Paso 1 · Monto: tabs Mensual / Única, montos sugeridos con descripción,
 * "otro monto" y botón "Donar".
 */
import { computed, nextTick, ref } from "vue";
import HcBurst from "~/components/hc/HcBurst.vue";
import HcButton from "~/components/hc/HcButton.vue";
import {
  HC_CUSTOM_DESCRIPTION,
  HC_FREQUENCIES,
  HC_MIN_AMOUNT,
  HC_PRESETS,
  formatHcMoney,
  type HcFrequency,
} from "~/data/hc-donar";

export interface HcAmountData {
  frequency: HcFrequency;
  choice: number | "otro";
  custom: string;
}

const props = defineProps<{ modelValue: HcAmountData; uid: string }>();
const emit = defineEmits<{
  "update:modelValue": [value: HcAmountData];
  next: [];
}>();

const presets = computed(() => HC_PRESETS[props.modelValue.frequency]);
const customError = ref<string | null>(null);
const customInput = ref<HTMLInputElement | null>(null);
const amountsEl = ref<HTMLElement | null>(null);
const burst = ref<InstanceType<typeof HcBurst> | null>(null);

function update(patch: Partial<HcAmountData>) {
  emit("update:modelValue", { ...props.modelValue, ...patch });
}

function setFrequency(value: HcFrequency) {
  if (value === props.modelValue.frequency) return;
  update({ frequency: value });
}

function choose(choice: number | "otro", event?: Event) {
  const changed = choice !== props.modelValue.choice;
  update({ choice });
  customError.value = null;
  if (choice === "otro") {
    nextTick(() => customInput.value?.focus());
  }
  const row = (event?.target as HTMLElement | undefined)?.closest(".hc-amount__row");
  if (changed && row) celebrate(row as HTMLElement);
}

function celebrate(row: HTMLElement) {
  const pill = row.querySelector(".hc-amount__pill") as HTMLElement | null;
  const host = amountsEl.value;
  if (!pill || !host) return;
  const p = pill.getBoundingClientRect();
  const h = host.getBoundingClientRect();
  burst.value?.fire(p.left - h.left + p.width / 2, p.top - h.top + p.height / 2, p.width * 0.75, 70);
}

function onCustomInput(e: Event) {
  const digits = (e.target as HTMLInputElement).value.replace(/\D/g, "").slice(0, 9);
  const formatted = digits ? new Intl.NumberFormat("es-AR").format(Number(digits)) : "";
  (e.target as HTMLInputElement).value = formatted;
  update({ custom: formatted });
  customError.value = null;
}

/** Monto elegido como número, o null si "otro monto" está vacío. */
const amount = computed<number | null>(() => {
  if (props.modelValue.choice !== "otro") return props.modelValue.choice;
  const n = Number(props.modelValue.custom.replace(/\D/g, ""));
  return n > 0 ? n : null;
});

function submit() {
  if (props.modelValue.choice === "otro") {
    if (!amount.value) {
      customError.value = "Ingresá el monto que querés donar.";
    } else if (amount.value < HC_MIN_AMOUNT) {
      customError.value = `El monto mínimo es ${formatHcMoney(HC_MIN_AMOUNT)}.`;
    }
    if (customError.value) {
      customInput.value?.focus();
      return;
    }
  }
  emit("next");
}

function onKeyTabs(e: KeyboardEvent) {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const i = HC_FREQUENCIES.findIndex((f) => f.value === props.modelValue.frequency);
  const next = HC_FREQUENCIES[(i + (e.key === "ArrowRight" ? 1 : -1) + HC_FREQUENCIES.length) % HC_FREQUENCIES.length];
  setFrequency(next.value);
  nextTick(() => {
    (document.getElementById(`${props.uid}-freq-${next.value}`) as HTMLElement | null)?.focus();
  });
}
</script>

<template>
  <form class="hc-amount" novalidate @submit.prevent="submit">
    <h2 class="hc-sr">Elegí tu donación</h2>

    <div
      class="hc-freq"
      role="tablist"
      aria-label="Frecuencia de la donación"
      :data-active="modelValue.frequency === 'Mensual' ? 0 : 1"
      @keydown="onKeyTabs"
    >
      <button
        v-for="f in HC_FREQUENCIES"
        :id="`${uid}-freq-${f.value}`"
        :key="f.value"
        type="button"
        role="tab"
        class="hc-freq__tab"
        :aria-selected="modelValue.frequency === f.value"
        :tabindex="modelValue.frequency === f.value ? 0 : -1"
        @click="setFrequency(f.value)"
      >
        <span class="hc-freq__long">{{ f.label }}</span>
        <span class="hc-freq__short">{{ f.short }}</span>
      </button>
      <i class="hc-freq__thumb" aria-hidden="true"></i>
    </div>

    <fieldset ref="amountsEl" class="hc-amounts">
      <legend class="hc-sr">Monto de la donación</legend>

      <label
        v-for="p in presets"
        :key="p.value"
        :class="['hc-amount__row', `hc-amount__row--${p.color}`]"
      >
        <input
          type="radio"
          :name="`${uid}-monto`"
          :value="p.value"
          :checked="modelValue.choice === p.value"
          class="hc-sr"
          @change="choose(p.value, $event)"
        />
        <span class="hc-amount__pill">
          <Transition name="hc-heart">
            <svg v-if="modelValue.choice === p.value" class="hc-amount__heart" viewBox="0 0 24 22" aria-hidden="true">
              <path
                d="M12 21.5C5 15.8 1 12.1 1 7.4 1 4 3.6 1.5 6.8 1.5c2 0 3.9 1 5.2 2.8 1.3-1.8 3.2-2.8 5.2-2.8C20.4 1.5 23 4 23 7.4c0 4.7-4 8.4-11 14.1Z"
                fill="currentColor"
              />
            </svg>
          </Transition>
          {{ formatHcMoney(p.value) }}
        </span>
        <span class="hc-amount__desc">{{ p.description }}</span>
      </label>

      <label class="hc-amount__row hc-amount__row--sand">
        <input
          type="radio"
          :name="`${uid}-monto`"
          value="otro"
          :checked="modelValue.choice === 'otro'"
          class="hc-sr"
          @change="choose('otro', $event)"
        />
        <span class="hc-amount__pill">
          <Transition name="hc-heart">
            <svg v-if="modelValue.choice === 'otro'" class="hc-amount__heart" viewBox="0 0 24 22" aria-hidden="true">
              <path
                d="M12 21.5C5 15.8 1 12.1 1 7.4 1 4 3.6 1.5 6.8 1.5c2 0 3.9 1 5.2 2.8 1.3-1.8 3.2-2.8 5.2-2.8C20.4 1.5 23 4 23 7.4c0 4.7-4 8.4-11 14.1Z"
                fill="currentColor"
              />
            </svg>
          </Transition>
          otro monto
        </span>
        <span class="hc-amount__desc">{{ HC_CUSTOM_DESCRIPTION }}</span>
      </label>

      <Transition name="hc-expand">
        <div v-if="modelValue.choice === 'otro'" class="hc-amount__custom hc-field">
          <label class="hc-label" :for="`${uid}-otro`">Ingresá el monto</label>
          <div class="hc-amount__money">
            <span aria-hidden="true">$</span>
            <input
              :id="`${uid}-otro`"
              ref="customInput"
              class="hc-input"
              type="text"
              inputmode="numeric"
              autocomplete="off"
              placeholder="Ej. 15.000"
              :value="modelValue.custom"
              :aria-invalid="customError ? 'true' : undefined"
              :aria-describedby="customError ? `${uid}-otro-err` : undefined"
              @input="onCustomInput"
            />
          </div>
          <p v-if="customError" :id="`${uid}-otro-err`" class="hc-error">{{ customError }}</p>
        </div>
      </Transition>

      <HcBurst ref="burst" />
    </fieldset>

    <div class="hc-actions hc-actions--single">
      <HcButton type="submit">Donar</HcButton>
    </div>
  </form>
</template>

<style scoped>
.hc-amount {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* ---------- Tabs de frecuencia ---------- */
.hc-freq {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 0.25rem;
  background: var(--hc-gray);
  border-radius: 100px;
  isolation: isolate;
}

.hc-freq__tab {
  position: relative;
  z-index: 1;
  padding: 0.8rem 1rem;
  background: none;
  border: 0;
  border-radius: 100px;
  color: var(--hc-dark);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
  transition: color 0.3s ease;
}
.hc-freq__tab[aria-selected="true"] {
  color: var(--hc-white);
}
.hc-freq__tab:focus-visible {
  outline: 2px solid var(--hc-red);
  outline-offset: 2px;
}

.hc-freq__short {
  display: none;
}

.hc-freq__thumb {
  position: absolute;
  z-index: 0;
  top: 0.25rem;
  bottom: 0.25rem;
  left: 0.25rem;
  width: calc(50% - 0.25rem);
  background: var(--hc-red);
  border-radius: 100px;
  transition: transform 0.4s var(--hc-ease);
}
.hc-freq[data-active="1"] .hc-freq__thumb {
  transform: translateX(100%);
}

/* ---------- Montos ---------- */
.hc-amounts {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
  margin: 0;
  padding: 0.5rem 0 0;
  border: 0;
}

.hc-amount__row {
  --pill: var(--hc-green);
  --pill-shadow: #3f9a83;
  --tint: rgb(98 189 166 / 0.12);
  --ink: #3f9a83;
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 15rem) 1fr;
  align-items: center;
  gap: 1.25rem;
  padding: 0.375rem 0.5rem 0.8rem;
  border: 2px solid transparent;
  border-radius: 1rem;
  cursor: pointer;
  transition:
    background-color 0.3s ease,
    border-color 0.3s ease;
}
.hc-amount__row--blue {
  --pill: var(--hc-blue);
  --pill-shadow: #2a7cb5;
  --tint: #edf5fb;
  --ink: var(--hc-blue);
}
.hc-amount__row--orange {
  --pill: var(--hc-orange);
  --pill-shadow: #c43c18;
  --tint: rgb(235 92 55 / 0.1);
  --ink: #d14a26;
}
.hc-amount__row--sand {
  --pill: var(--hc-sand);
  --pill-shadow: #e9bf86;
  --tint: rgb(250 227 197 / 0.45);
  --ink: #b07a33;
}

.hc-amount__row:hover,
.hc-amount__row:has(input:checked) {
  background: var(--tint);
}
.hc-amount__row:has(input:focus-visible) {
  outline: 2px solid var(--hc-red);
  outline-offset: 2px;
}

.hc-amount__pill {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 0.8rem 0.75rem;
  background: var(--pill);
  color: var(--hc-dark);
  border-radius: 0.875rem;
  box-shadow: 0 5px 0 var(--pill-shadow);
  font-family: var(--hc-display);
  font-size: 1.375rem;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
  transition:
    transform 0.25s var(--hc-ease),
    box-shadow 0.25s var(--hc-ease);
}
.hc-amount__row--blue .hc-amount__pill {
  color: var(--hc-white);
}
.hc-amount__row:hover .hc-amount__pill {
  transform: translateY(-2px);
  box-shadow: 0 7px 0 var(--pill-shadow);
}
/* Seleccionado: el botón "se hunde" */
.hc-amount__row:has(input:checked) .hc-amount__pill {
  transform: translateY(3px);
  box-shadow: 0 2px 0 var(--pill-shadow);
  animation: hc-press 0.4s var(--hc-ease);
}

.hc-amount__heart {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
  color: #e8443a;
  filter: drop-shadow(0 1px 0 rgb(0 0 0 / 0.15));
}

.hc-amount__desc {
  font-size: 0.9375rem;
  line-height: 1.25;
  transition: color 0.3s ease;
}
.hc-amount__row:hover .hc-amount__desc,
.hc-amount__row:has(input:checked) .hc-amount__desc {
  color: var(--ink);
}
.hc-amount__row:has(input:checked) .hc-amount__desc {
  font-weight: 700;
}

/* Otro monto */
.hc-amount__custom {
  padding: 0.5rem 0.5rem 0.25rem;
}
.hc-amount__money {
  position: relative;
}
.hc-amount__money > span {
  position: absolute;
  top: 50%;
  left: 1rem;
  transform: translateY(-50%);
  font-weight: 700;
}
.hc-amount__money .hc-input {
  padding-left: 2rem;
}

/* ---------- Transiciones ---------- */
.hc-heart-enter-active {
  animation: hc-heart-pop 0.5s var(--hc-ease);
}
.hc-heart-leave-active {
  transition:
    opacity 0.15s ease,
    width 0.2s ease,
    margin 0.2s ease;
}
.hc-heart-leave-to {
  opacity: 0;
  width: 0;
  margin-right: -0.6rem;
}

.hc-expand-enter-active {
  animation: hc-rise 0.35s var(--hc-ease) both;
}
.hc-expand-leave-active {
  transition: opacity 0.15s ease;
}
.hc-expand-leave-to {
  opacity: 0;
}

@keyframes hc-press {
  0% {
    transform: translateY(-3px) scale(1.04);
  }
}

@keyframes hc-heart-pop {
  0% {
    transform: scale(0) rotate(-25deg);
  }
  60% {
    transform: scale(1.35) rotate(8deg);
  }
  100% {
    transform: scale(1) rotate(0);
  }
}

/* ---------- Mobile ---------- */
@media (max-width: 480px) {
  .hc-freq__tab {
    padding: 0.7rem 0.5rem;
  }
  .hc-freq__long {
    display: none;
  }
  .hc-freq__short {
    display: inline;
  }
  .hc-amounts {
    gap: 0.75rem;
    padding-top: 0.25rem;
  }
  .hc-amount__row {
    grid-template-columns: minmax(0, 8.5rem) 1fr;
    gap: 1rem;
    padding: 0.75rem 0.75rem 1rem;
    border-color: #e6e6e6;
  }
  .hc-amount__row:has(input:checked) {
    border-color: var(--ink);
  }
  .hc-amount__pill {
    padding: 0.7rem 0.5rem;
    font-size: 1.125rem;
    gap: 0.4rem;
  }
  .hc-amount__heart {
    width: 1rem;
    height: 1rem;
  }
  .hc-amount__desc {
    font-size: 0.875rem;
  }
}
</style>
