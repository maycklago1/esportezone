export const APP_NAME = "QuadraLivre";

export const SPORTS = [
  { id: "futsal", label: "Futsal" },
  { id: "society", label: "Society" },
  { id: "tenis", label: "Tênis" },
  { id: "beach", label: "Beach tennis" },
  { id: "volei", label: "Vôlei" },
  { id: "basquete", label: "Basquete" },
  { id: "padel", label: "Padel" },
  { id: "futevolei", label: "Futevôlei" },
] as const;

export const SURFACES = [
  { id: "sintetica", label: "Sintética" },
  { id: "grama", label: "Grama sintética" },
  { id: "saibro", label: "Saibro" },
  { id: "cimento", label: "Cimento" },
  { id: "areia", label: "Areia" },
  { id: "madeira", label: "Madeira" },
] as const;

export const WEEKDAYS = [
  { id: 1, short: "Seg" },
  { id: 2, short: "Ter" },
  { id: 3, short: "Qua" },
  { id: 4, short: "Qui" },
  { id: 5, short: "Sex" },
  { id: 6, short: "Sáb" },
  { id: 0, short: "Dom" },
] as const;

const SPORT_SET = new Set<string>(SPORTS.map((sport) => sport.id));
const SURFACE_SET = new Set<string>(SURFACES.map((surface) => surface.id));

export function isSport(value: string): boolean {
  return SPORT_SET.has(value);
}

export function isSurface(value: string): boolean {
  return SURFACE_SET.has(value);
}

export function sportLabel(id: string): string {
  return SPORTS.find((sport) => sport.id === id)?.label ?? id;
}

export function surfaceLabel(id: string): string {
  return SURFACES.find((surface) => surface.id === id)?.label ?? id;
}

export function roleLabel(role: string): string {
  if (role === "owner") return "Dono de quadra";
  if (role === "admin") return "Administração";
  return "Jogador";
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    awaiting_payment: "Aguardando pagamento",
    confirmed: "Confirmado",
    cancelled: "Cancelado",
    draft: "Em aberto",
    pending: "Em análise",
    paid: "Pago",
    validated: "Validado",
    rejected: "Recusado",
    refunded: "Estornado",
    active: "Ativa",
    paused: "Pausada",
    suspended: "Suspensa",
    player: "Jogador",
    owner: "Dono",
    admin: "Admin",
    private: "Fechada",
    open: "Jogo aberto",
    held: "Retido",
    free: "Livre",
    past: "Passado",
    busy: "Ocupado",
  };
  return labels[status] ?? status;
}

export function statusTone(status: string): "neutral" | "pine" | "warn" | "danger" {
  if (["confirmed", "paid", "validated", "active", "free"].includes(status)) return "pine";
  if (["pending", "awaiting_payment", "draft", "paused", "held"].includes(status)) return "warn";
  if (["rejected", "cancelled", "refunded", "suspended"].includes(status)) return "danger";
  return "neutral";
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatFee(bps: number): string {
  const value = bps / 100;
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`;
}

export function payoutCents(priceCents: number, feeBps: number): number {
  return Math.round((priceCents * (10000 - feeBps)) / 10000);
}

export function accountCode(userId: string): string {
  let hash = 2166136261;
  for (let i = 0; i < userId.length; i += 1) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `QL-${(hash >>> 0).toString(16).toUpperCase().padStart(8, "0").slice(0, 6)}`;
}

export function parseReais(input: string): number | null {
  const normalized = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  if (!Number.isFinite(cents) || cents <= 0) return null;
  return cents;
}

export function reaisInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function nowSP(date = new Date()): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = pick("hour") === "24" ? "00" : pick("hour");
  return {
    date: `${pick("year")}-${pick("month")}-${pick("day")}`,
    minutes: Number(hour) * 60 + Number(pick("minute")),
  };
}

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days));
  return date.toISOString().slice(0, 10);
}

export function upcomingDates(count = 10, from = nowSP().date): string[] {
  return Array.from({ length: count }, (_, index) => addDays(from, index));
}

export function weekdayIndex(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)).getUTCDay();
}

export function timeToMinutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

export function minutesToTime(total: number): string {
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function addMinutes(value: string, delta: number): string {
  return minutesToTime(timeToMinutes(value) + delta);
}

export function parseWeekdays(value: string): number[] {
  return value
    .split(",")
    .map((part) => Number(part))
    .filter((day) => day >= 0 && day <= 6);
}

export function weekdayOpen(weekdays: string, date: string): boolean {
  return parseWeekdays(weekdays).includes(weekdayIndex(date));
}

export function buildStarts(openFrom: string, openUntil: string): { start: string; end: string }[] {
  const open = timeToMinutes(openFrom);
  const close = timeToMinutes(openUntil);
  const slots: { start: string; end: string }[] = [];
  for (let cursor = open; cursor + 60 <= close; cursor += 60) {
    const start = minutesToTime(cursor);
    slots.push({ start, end: addMinutes(start, 60) });
  }
  return slots;
}

export function formatDay(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

export function formatChip(iso: string): { day: string; week: string } {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  const week = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" })
    .format(date)
    .replace(".", "");
  return { day: String(day ?? 0).padStart(2, "0"), week };
}

export function slotEnded(date: string, end: string, now = nowSP()): boolean {
  if (date < now.date) return true;
  if (date > now.date) return false;
  return timeToMinutes(end) <= now.minutes;
}

export function pixDemoCode(reference: string, amountCents: number): string {
  const amount = (amountCents / 100).toFixed(2);
  return `00020126BR.GOV.BCB.PIX.DEMO${reference}52040000530398654${amount}5802BR5922QUADRALIVRE6009SAOPAULO`;
}

export function luhnOk(num: string): boolean {
  const digits = num.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alternate = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = digits.charCodeAt(index) - 48;
    if (alternate) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

export function greeting(name: string, date = new Date()): string {
  const hour = Math.floor(nowSP(date).minutes / 60);
  const hello = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  return name ? `${hello}, ${name}` : hello;
}

export function openHourOptions(): string[] {
  return Array.from({ length: 17 }, (_, index) => minutesToTime((6 + index) * 60));
}

export function closeHourOptions(): { value: string; label: string }[] {
  const hours = Array.from({ length: 17 }, (_, index) => {
    const value = minutesToTime((7 + index) * 60);
    return { value, label: value };
  });
  hours.push({ value: "24:00", label: "00:00" });
  return hours;
}
