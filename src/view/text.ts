import type { SkFont } from "@shopify/react-native-skia";

/**
 * Textbreite in den Einheiten der Schrift. Bewusst ueber die Glyphenbreiten
 * statt `font.measureText`, weil letzteres auf React Native Web nicht
 * implementiert ist.
 */
export const textWidth = (font: SkFont, text: string): number =>
  font.getGlyphWidths(font.getGlyphIDs(text)).reduce((total, width) => total + width, 0);
