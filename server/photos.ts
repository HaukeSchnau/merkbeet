import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Fotos liegen als Dateien neben der Datenbank. Der Dateiname ist 16 Byte
 * Zufall: die URL ist damit selbst der Schlüssel, weshalb der Abruf ohne
 * Zugangscode auskommt. Das ist nötig, weil `<img>` im Browser keine eigenen
 * Kopfzeilen mitschicken kann.
 */

const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

export const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

/** Pfad, wie er im synchronisierten `photoUri` steht. */
export const PHOTO_PATH_PREFIX = "/api/photos/";

export class PhotoStore {
  private readonly dir: string;

  constructor(stateDir: string) {
    this.dir = join(stateDir, "photos");
    mkdirSync(this.dir, { recursive: true });
  }

  async save(bytes: ArrayBuffer, contentType: string | null): Promise<string | null> {
    const extension = contentType ? TYPES[contentType.split(";")[0].trim()] : undefined;
    if (!extension) return null;
    const name = `${randomBytes(16).toString("hex")}.${extension}`;
    await Bun.write(join(this.dir, name), bytes);
    return `${PHOTO_PATH_PREFIX}${name}`;
  }

  /** `null`, wenn der Name nicht stimmt oder die Datei fehlt. */
  find(name: string) {
    if (!/^[a-f0-9]{32}\.(jpg|png|webp|heic)$/.test(name)) return null;
    const handle = Bun.file(join(this.dir, name));
    return handle;
  }
}
