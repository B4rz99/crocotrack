import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const generateId = (): string => crypto.randomUUID();

export const nowISO = (): string => new Date().toISOString();

export const todayIsoDate = new Date().toISOString().slice(0, 10);

export const formatDateDisplay = (dateStr: string): string => {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
};
