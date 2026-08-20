/**
 * Im Browser liefert der Bildauswähler eine `blob:`- oder `data:`-Adresse.
 * Beide lassen sich mit fetch lesen.
 */
export const readPhotoBytes = async (uri: string): Promise<Uint8Array> =>
  new Uint8Array(await (await fetch(uri)).arrayBuffer());
