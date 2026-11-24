/**
 * Validaciones del formulario de donaciones de Haciendo Camino.
 * Las usan los dos diseños (/donar y /donar-simple) para que los mensajes y
 * las reglas sean siempre los mismos.
 */
import type { HcDocumentType } from "~/data/hc-donar";
import { validateCuil } from "~/composables/validators";

export function digits(v: string): string {
  return v.replace(/\D/g, "");
}

export function docError(type: HcDocumentType, raw: string): string | undefined {
  const value = type === "Pasaporte" ? raw.replace(/[\s.-]/g, "").toUpperCase() : digits(raw);
  if (!value) return "Ingresá tu número de documento.";
  if (type === "DNI" && !/^\d{7,8}$/.test(value)) return "El DNI tiene que tener 7 u 8 números.";
  if ((type === "CUIT" || type === "CUIL") && !validateCuil(value)) {
    return `El ${type} tiene que tener 11 números, sin guiones.`;
  }
  if (type === "Pasaporte" && !/^[A-Z0-9]{6,13}$/.test(value)) return "Revisá el número de pasaporte.";
  return undefined;
}

export function phoneError(code: string, phone: string): { code?: string; phone?: string } {
  const out: { code?: string; phone?: string } = {};
  if (!/^\+?\d{1,4}$/.test(code.trim())) out.code = "Ej. +54";
  const n = digits(phone);
  const isAr = digits(code) === "54";
  if (!n) out.phone = "Ingresá tu teléfono.";
  else if (isAr && n.length !== 10) out.phone = "Código de área sin 0 y número sin 15 (10 números).";
  else if (!isAr && (n.length < 6 || n.length > 14)) out.phone = "Revisá el número de teléfono.";
  return out;
}
