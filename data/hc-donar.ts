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
 * Montos sugeridos, de mayor a menor (los mismos para las dos frecuencias).
 * Color y descripción van con la posición: los valores los puede pisar el
 * sitio de WordPress con `?montos=50000,38000,25000` (opciones ACF, se
 * actualizan cada 4 meses); ver `hcPresets`.
 * `HC_DEFAULT_AMOUNT` es el que arranca elegido (null: ninguno).
 */
export const HC_PRESETS: HcPreset[] = [
  { value: 50000, color: "orange", description: "Ayudás a que más niños/as reciban atención y seguimiento." },
  { value: 38000, color: "blue", description: "Ayudás a sostener el acompañamiento de una familia." },
  { value: 25000, color: "green", description: "Ayudás a llevar nutrición y acompañamiento a un niño/a." },
];

/** Tope de seguridad para los montos que llegan por URL. */
const HC_MAX_PRESET = 10_000_000;

/**
 * Montos sugeridos a partir del parámetro `montos` de la URL
 * ("50000,38000,25000"). Si falta o no es válido (cantidad distinta, no
 * numérico, repetido, menor al mínimo) se usan los de `HC_PRESETS`.
 */
export function hcPresets(param: string | null | undefined): HcPreset[] {
  if (!param) return HC_PRESETS;
  const values = param.split(",").map((v) => Number(v.trim()));
  const valid =
    values.length === HC_PRESETS.length &&
    new Set(values).size === values.length &&
    values.every((v) => Number.isInteger(v) && v >= HC_MIN_AMOUNT && v <= HC_MAX_PRESET);
  return valid ? HC_PRESETS.map((p, i) => ({ ...p, value: values[i] })) : HC_PRESETS;
}

export const HC_DEFAULT_AMOUNT: number | null = null;
export const HC_CUSTOM_DESCRIPTION = "Ayudás a llegar a más familias.";

/** Mínimo de "otro monto" (el del flujo original; falta que HC lo confirme). */
export const HC_MIN_AMOUNT = 2300;

export const HC_DOCUMENT_TYPES = ["DNI", "CUIT", "CUIL", "Pasaporte"] as const;
export type HcDocumentType = (typeof HC_DOCUMENT_TYPES)[number];

/**
 * Vencimiento y código de seguridad de la tarjeta.
 *   - "auto": los pide si la cuenta de Debi los exige (`card.required_fields`).
 *     La cuenta test los exige; si no se mandan, Debi rechaza la tarjeta.
 *   - "hidden" / "optional" / "required": fuerza ese comportamiento.
 * El template de Debi los ocultaba porque el débito recurrente solo usa el número.
 */
export const HC_CARD_EXTRA_FIELDS: "auto" | "hidden" | "optional" | "required" = "auto";

export const HC_RECEIPTS_EMAIL = "recibos@haciendocamino.org.ar";

export function formatHcMoney(value: number): string {
  return `$ ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value)}`;
}
