import type { RadiusEdge, RadiusResource } from "./radius-types";

const SENS_RANK: Record<RadiusResource["sensitivity"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const COLUMN_X = [90, 320, 560, 800] as const;

export function computeAutoLayout(
  resources: RadiusResource[],
  edges: RadiusEdge[],
): RadiusResource[] {
  if (resources.length === 0) return [];

  const byId = new Map(resources.map((r) => [r.id, r]));
  const outgoingTypes = new Map<string, Set<RadiusResource["type"]>>();

  for (const e of edges) {
    const target = byId.get(e.to);
    if (!target) continue;
    let set = outgoingTypes.get(e.from);
    if (!set) {
      set = new Set();
      outgoingTypes.set(e.from, set);
    }
    set.add(target.type);
  }

  const columns: [RadiusResource[], RadiusResource[], RadiusResource[], RadiusResource[]] = [
    [],
    [],
    [],
    [],
  ];

  for (const r of resources) {
    if (r.type === "database" || r.type === "storage") {
      columns[3].push(r);
    } else if (r.type === "role") {
      columns[2].push(r);
    } else if (r.type === "external") {
      columns[0].push(r);
    } else {
      const out = outgoingTypes.get(r.id);
      const callsInfraDirectly =
        out?.has("role") || out?.has("database") || out?.has("storage") || false;
      columns[callsInfraDirectly ? 1 : 0].push(r);
    }
  }

  const positioned: RadiusResource[] = [];
  const minY = 55;
  const maxY = 405;

  columns.forEach((col, colIdx) => {
    col.sort(
      (a, b) => SENS_RANK[a.sensitivity] - SENS_RANK[b.sensitivity] || a.key.localeCompare(b.key),
    );
    const x = COLUMN_X[colIdx] ?? 450;
    const count = col.length;
    col.forEach((node, idx) => {
      const y =
        count === 1
          ? Math.round((minY + maxY) / 2)
          : Math.round(minY + (idx * (maxY - minY)) / (count - 1));
      positioned.push({
        ...node,
        x,
        y,
      });
    });
  });

  return positioned;
}
