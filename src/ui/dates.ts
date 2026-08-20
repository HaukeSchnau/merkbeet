/** Datumshilfen fuer die deutsche Eingabe; gespeichert wird immer ISO (YYYY-MM-DD). */

const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const GERMAN_PATTERN = /^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{2}|\d{4})$/;

export const todayIso = (): string => new Date().toISOString().slice(0, 10);

export const formatGermanDate = (iso: string | undefined): string => {
  if (!iso || !ISO_PATTERN.test(iso)) return "";
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
};

/** Nimmt "14.5.26", "14.05.2026" und aehnliches; gibt undefined bei Unsinn. */
export const parseGermanDate = (input: string): string | undefined => {
  const match = GERMAN_PATTERN.exec(input.trim());
  if (!match) return undefined;
  const [, day, month, yearPart] = match;
  const year = yearPart.length === 2 ? `20${yearPart}` : yearPart;
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? undefined : iso;
};
