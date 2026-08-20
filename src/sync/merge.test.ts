import { describe, expect, it } from "bun:test";

import type { Plant } from "../garden/types";
import { applyChange, applyChanges, coalesceChange, mergeRecords, resolvePlants } from "./merge";
import type { PlantChange, PlantRecords } from "./types";

const SEED: Plant[] = [
  { id: "rose-1", speciesId: "rose", position: { x: 1, y: 1 }, diameterMeters: 0.9 },
  { id: "hydrangea-1", speciesId: "hydrangea", position: { x: 4, y: 6 }, diameterMeters: 1.1 },
];

const change = (partial: PlantChange): PlantChange => partial;

describe("applyChange", () => {
  it("stempelt nur Felder, die sich wirklich ändern", () => {
    const first = applyChange(undefined, change({ id: "rose-1", fields: { notes: "kränkelt" } }), 100);
    const again = applyChange(first, change({ id: "rose-1", fields: { notes: "kränkelt" } }), 200);
    // Wichtig: erneutes Schicken desselben Werts darf den Zeitstempel nicht
    // anheben, sonst verdrängt ein Retry fremde neuere Änderungen.
    expect(again.fields.notes).toEqual({ value: "kränkelt", at: 100 });
  });

  it("behandelt null als 'Feld leeren'", () => {
    const set = applyChange(undefined, change({ id: "rose-1", fields: { notes: "weg damit" } }), 100);
    const cleared = applyChange(set, change({ id: "rose-1", fields: { notes: null } }), 200);
    expect(cleared.fields.notes).toEqual({ value: null, at: 200 });
    expect(resolvePlants({ "rose-1": cleared }, SEED)[0].notes).toBeUndefined();
  });
});

describe("mergeRecords", () => {
  it("führt gleichzeitige Änderungen an verschiedenen Feldern derselben Pflanze zusammen", () => {
    // Vater verschiebt die Rose, Mutter schreibt gleichzeitig eine Notiz.
    const vater = applyChanges({}, [change({ id: "rose-1", fields: { position: { x: 2, y: 3 } } })], 100);
    const mutter = applyChanges({}, [change({ id: "rose-1", fields: { notes: "blüht zum zweiten Mal" } })], 110);

    const [plant] = resolvePlants(mergeRecords(vater, mutter), SEED);
    expect(plant.position).toEqual({ x: 2, y: 3 });
    expect(plant.notes).toBe("blüht zum zweiten Mal");
  });

  it("lässt beim selben Feld den jüngeren Stand gewinnen", () => {
    const alt = applyChanges({}, [change({ id: "rose-1", fields: { notes: "alt" } })], 100);
    const neu = applyChanges({}, [change({ id: "rose-1", fields: { notes: "neu" } })], 200);
    expect(resolvePlants(mergeRecords(alt, neu), SEED)[0].notes).toBe("neu");
    // Auch in der anderen Richtung -- Merge darf nicht von der Reihenfolge abhängen.
    expect(resolvePlants(mergeRecords(neu, alt), SEED)[0].notes).toBe("neu");
  });

  it("ist kommutativ und assoziativ", () => {
    const a = applyChanges({}, [change({ id: "rose-1", fields: { notes: "a" } })], 100);
    const b = applyChanges({}, [change({ id: "rose-1", fields: { position: { x: 9, y: 9 } } })], 100);
    const c = applyChanges({}, [change({ id: "hydrangea-1", removed: true })], 150);

    const links = mergeRecords(mergeRecords(a, b), c);
    const rechts = mergeRecords(a, mergeRecords(b, c));
    const gedreht = mergeRecords(mergeRecords(c, b), a);

    expect(links).toEqual(rechts);
    expect(links).toEqual(gedreht);
  });

  it("gibt bei gleichem Zeitstempel immer denselben Gewinner", () => {
    const a = applyChanges({}, [change({ id: "rose-1", fields: { notes: "Apfel" } })], 100);
    const b = applyChanges({}, [change({ id: "rose-1", fields: { notes: "Birne" } })], 100);
    expect(mergeRecords(a, b)).toEqual(mergeRecords(b, a));
  });
});

describe("entfernen und hinzufügen", () => {
  it("nimmt entfernte Pflanzen aus der Anzeige", () => {
    const records = applyChanges({}, [change({ id: "rose-1", removed: true })], 100);
    expect(resolvePlants(records, SEED).map((p) => p.id)).toEqual(["hydrangea-1"]);
  });

  it("kann eine entfernte Pflanze zurückholen", () => {
    let records = applyChanges({}, [change({ id: "rose-1", removed: true })], 100);
    records = applyChanges(records, [change({ id: "rose-1", removed: false })], 200);
    expect(resolvePlants(records, SEED).map((p) => p.id)).toContain("rose-1");
  });

  it("zeigt selbst hinzugefügte Pflanzen, die der Plan nicht kennt", () => {
    const records = applyChanges(
      {},
      [change({ id: "neu-1", speciesId: "lavender", fields: { position: { x: 3, y: 7 } } })],
      100,
    );
    const neu = resolvePlants(records, SEED).find((plant) => plant.id === "neu-1");
    expect(neu).toEqual({ id: "neu-1", speciesId: "lavender", position: { x: 3, y: 7 } });
  });

  it("lässt Werte aus dem Plan stehen, die niemand geändert hat", () => {
    // Regression: würden ungesetzte Felder als undefined überschrieben, wäre
    // der Durchmesser aus der Skizze weg.
    const records = applyChanges({}, [change({ id: "rose-1", fields: { notes: "nur Notiz" } })], 100);
    expect(resolvePlants(records, SEED)[0].diameterMeters).toBe(0.9);
  });
});

describe("coalesceChange", () => {
  it("fasst mehrere Änderungen an einer Pflanze zusammen", () => {
    const erst = coalesceChange(undefined, change({ id: "rose-1", fields: { notes: "eins" } }));
    const dann = coalesceChange(erst, change({ id: "rose-1", fields: { position: { x: 5, y: 5 } } }));
    expect(dann).toEqual({
      id: "rose-1",
      fields: { notes: "eins", position: { x: 5, y: 5 } },
    });
  });

  it("behält die Art einer neu angelegten Pflanze über mehrere Änderungen", () => {
    const angelegt = coalesceChange(undefined, change({ id: "neu-1", speciesId: "rose", fields: { position: { x: 1, y: 1 } } }));
    const benannt = coalesceChange(angelegt, change({ id: "neu-1", fields: { name: "Omas Rose" } }));
    expect(benannt.speciesId).toBe("rose");
  });
});

describe("Zusammenspiel über drei Geräte", () => {
  it("bringt alle drei auf denselben Stand", () => {
    // Der Server nimmt die Änderungen in der Reihenfolge an, in der sie
    // ankommen, und stempelt sie selbst.
    let server: PlantRecords = {};
    server = applyChanges(server, [change({ id: "rose-1", fields: { notes: "Handy Vater" } })], 100);
    server = applyChanges(server, [change({ id: "rose-1", fields: { name: "Kletterrose" } })], 110);
    server = applyChanges(server, [change({ id: "hydrangea-1", fields: { plantedAt: "2026-05-14" } })], 120);

    // Jedes Gerät hatte einen älteren Stand und schickt seinen Rest nach.
    const handyMutter = mergeRecords({}, server);
    const pc = mergeRecords(server, {});

    expect(resolvePlants(handyMutter, SEED)).toEqual(resolvePlants(pc, SEED));
    const rose = resolvePlants(pc, SEED)[0];
    expect(rose.notes).toBe("Handy Vater");
    expect(rose.name).toBe("Kletterrose");
  });
});
