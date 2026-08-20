/**
 * Native bringt Skia im Build mit -- hier ist nichts zu laden.
 * Die Web-Variante liegt in `skiaLoader.web.ts`; Metro waehlt sie automatisch.
 */
export const loadSkia = async (): Promise<void> => {};
