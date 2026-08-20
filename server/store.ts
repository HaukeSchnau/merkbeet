import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { applyChanges, mergeRecords } from "../src/sync/merge";
import type { GardenSnapshot, PlantChange, PlantRecord, PlantRecords } from "../src/sync/types";

/**
 * Der Gartenstand in SQLite: eine Zeile pro Pflanze plus eine Revision, die
 * bei jeder angenommenen Änderung hochzählt. Die Clients fragen mit ihrer
 * bekannten Revision an und übertragen nichts, wenn sich nichts geändert hat.
 */
export class GardenStore {
  private readonly db: Database;

  constructor(stateDir: string) {
    mkdirSync(stateDir, { recursive: true });
    this.db = new Database(join(stateDir, "merkbeet.sqlite"), { create: true });
    // WAL, damit gleichzeitige Leser einen Schreiber nicht blockieren.
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS records (
        id  TEXT PRIMARY KEY,
        doc TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  private revision(): number {
    const row = this.db.query<{ value: string }, []>("SELECT value FROM meta WHERE key = 'revision'").get();
    return row ? Number(row.value) : 0;
  }

  private records(): PlantRecords {
    const rows = this.db.query<{ id: string; doc: string }, []>("SELECT id, doc FROM records").all();
    const records: PlantRecords = {};
    for (const row of rows) records[row.id] = JSON.parse(row.doc) as PlantRecord;
    return records;
  }

  snapshot(): GardenSnapshot {
    return { revision: this.revision(), records: this.records() };
  }

  /**
   * Trägt die Änderungen eines Geräts ein und gibt den neuen Gesamtstand
   * zurück. Der Zeitstempel kommt hier aus der Serveruhr -- eine einzige Uhr
   * für alle Geräte ist der Grund, warum der Merge verlässlich ist.
   *
   * Lesen, Zusammenführen und Schreiben laufen in einer Transaktion, damit
   * zwei gleichzeitig sendende Handys sich nicht überschreiben.
   */
  push(changes: PlantChange[]): GardenSnapshot {
    if (changes.length === 0) return this.snapshot();

    const write = this.db.transaction((at: number) => {
      const touched = new Set(changes.map((change) => change.id));
      const current: PlantRecords = {};
      const select = this.db.query<{ doc: string }, [string]>("SELECT doc FROM records WHERE id = ?");
      for (const id of touched) {
        const row = select.get(id);
        if (row) current[id] = JSON.parse(row.doc) as PlantRecord;
      }

      const updated = applyChanges(current, changes, at);
      const upsert = this.db.query<never, [string, string]>(
        "INSERT INTO records (id, doc) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET doc = excluded.doc",
      );
      for (const [id, record] of Object.entries(updated)) upsert.run(id, JSON.stringify(record));

      const next = this.revision() + 1;
      this.db
        .query<never, [string]>(
          "INSERT INTO meta (key, value) VALUES ('revision', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        )
        .run(String(next));
    });

    write(Date.now());
    return this.snapshot();
  }

  /** Nur für Tests und die Migration bestehender Geräte. */
  seed(records: PlantRecords): void {
    const merged = mergeRecords(this.records(), records);
    const write = this.db.transaction(() => {
      const upsert = this.db.query<never, [string, string]>(
        "INSERT INTO records (id, doc) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET doc = excluded.doc",
      );
      for (const [id, record] of Object.entries(merged)) upsert.run(id, JSON.stringify(record));
    });
    write();
  }

  close(): void {
    this.db.close();
  }
}
