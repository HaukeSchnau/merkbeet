import { file } from "bun";

/** Einstellungen kommen aus der Umgebung, damit das Nix-Modul sie setzen kann. */
export type ServerConfig = {
  /** Adresse, auf der gelauscht wird; hinter Caddy ist das localhost. */
  hostname: string;
  port: number;
  /** Verzeichnis für Datenbank und Fotos. */
  stateDir: string;
  /** Der exportierte Web-Client; wird unter / ausgeliefert. */
  webDir: string;
  /** Gemeinsamer Zugangscode für die Familie. */
  passcode: string;
};

const required = (name: string, value: string | undefined): string => {
  if (!value) throw new Error(`${name} fehlt`);
  return value;
};

/**
 * Der Code wird bevorzugt aus einer Datei gelesen, damit er als sops-Secret
 * nie in der Prozessumgebung oder im Nix-Store landet.
 */
const readPasscode = async (): Promise<string> => {
  const path = process.env.MERKBEET_PASSCODE_FILE;
  if (path) {
    const contents = (await file(path).text()).trim();
    if (!contents) throw new Error(`${path} ist leer`);
    return contents;
  }
  return required("MERKBEET_PASSCODE oder MERKBEET_PASSCODE_FILE", process.env.MERKBEET_PASSCODE);
};

export const loadConfig = async (): Promise<ServerConfig> => ({
  hostname: process.env.MERKBEET_HOST ?? "127.0.0.1",
  port: Number(process.env.MERKBEET_PORT ?? 8787),
  // Reihenfolge mit Bedacht: eine ausdrücklich gesetzte Variable gewinnt gegen
  // systemds STATE_DIRECTORY. Andernfalls schreibt ein Testlauf in das
  // Zustandsverzeichnis des Dienstes, unter dem er gerade zufällig läuft.
  stateDir: process.env.MERKBEET_STATE_DIR ?? process.env.STATE_DIRECTORY ?? ".state",
  webDir: process.env.MERKBEET_WEB_DIR ?? "dist",
  passcode: await readPasscode(),
});
