/**
 * Configuración del formulario de donaciones de Haciendo Camino (/donar).
 * Montos, textos y opciones que HC puede pedir cambiar están todos acá.
 */

/** Valores que viajan al backend: no cambiarlos (ver HC.md, sección 4). */
export type HcFrequency = "Mensual" | "Única vez";

export const HC_FREQUENCIES: { value: HcFrequency; label: string; short: string; summary: string }[] = [
  { value: "Mensual", label: "Donación mensual", short: "Mensual", summary: "Donación mensual" },
  { value: "Única vez", label: "Donación única", short: "Única", summary: "Donación única" },
];

export type HcAmountColor = "green" | "blue" | "orange";

export interface HcPreset {
  value: number;
  color: HcAmountColor;
  description: string;
}

/**
 * Montos sugeridos por frecuencia. Hoy son los mismos para las dos (falta que
 * HC confirme si cambian). `HC_DEFAULT_AMOUNT` es el que arranca elegido.
 */
const PRESETS: HcPreset[] = [
  { value: 10000, color: "green", description: "Ayudás a llevar nutrición y acompañamiento a un niño/a." },
  { value: 38000, color: "blue", description: "Ayudás a sostener el acompañamiento de una familia." },
  { value: 50000, color: "orange", description: "Ayudás a que más niños/as reciban atención y seguimiento." },
];

export const HC_PRESETS: Record<HcFrequency, HcPreset[]> = {
  Mensual: PRESETS,
  "Única vez": PRESETS,
};

export const HC_DEFAULT_AMOUNT = 38000;
export const HC_CUSTOM_DESCRIPTION = "Ayudás a llegar a más familias.";

/** Mínimo de "otro monto" (el del flujo original; falta que HC lo confirme). */
export const HC_MIN_AMOUNT = 2300;

export const HC_DOCUMENT_TYPES = ["DNI", "CUIT", "CUIL", "Pasaporte"] as const;
export type HcDocumentType = (typeof HC_DOCUMENT_TYPES)[number];

/**
 * Vencimiento y código de seguridad de la tarjeta. Debi cobra el débito
 * recurrente solo con el número, por eso el template los oculta. El diseño los
 * muestra: definir con Debi y, si van, pasar a "optional" o "required".
 */
export const HC_CARD_EXTRA_FIELDS: "hidden" | "optional" | "required" = "hidden";

export const HC_RECEIPTS_EMAIL = "recibos@haciendocamino.org.ar";

export function formatHcMoney(value: number): string {
  return `$ ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value)}`;
}
