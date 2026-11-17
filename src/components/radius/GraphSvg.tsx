import { TYPE_COLOR, type RadiusEdge, type RadiusResource } from "@/lib/radius-types";

interface Highlight {
  targetId: string;
  hitIds: Set<string>;
  newAccessId: string | null;
}

interface GraphSvgProps {
  resources: RadiusResource[];
  edges: RadiusEdge[];
  highlight?: Highlight;
}

export function GraphSvg({ resources, edges, highlight }: GraphSvgProps) {
  const byId = new Map(resources.map((r) => [r.id, r]));
  const edgesToDraw = edges.slice();
  const newEdge =
    highlight?.newAccessId != null
      ? { from: highlight.targetId, to: highlight.newAccessId }
      : null;
  if (newEdge) edgesToDraw.push(newEdge);

  return (
    <svg className="graph" viewBox="-40 0 980 460" xmlns="http://www.w3.org/2000/svg">
      {edgesToDraw.map((e, i) => {
        const a = byId.get(e.from);
        const b = byId.get(e.to);
        if (!a || !b) return null;
        const isNew = !!newEdge && e.from === newEdge.from && e.to === newEdge.to;
        const isHit = !!highlight && highlight.hitIds.has(e.from) && highlight.hitIds.has(e.to);
        const cls = isNew ? "gedge newedge" : isHit ? "gedge hit" : "gedge";
        return <line key={`${e.from}-${e.to}-${i}`} className={cls} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
      })}
      {resources.map((n) => {
        const isTarget = !!highlight && highlight.targetId === n.id;
        const isHit = !!highlight && highlight.hitIds.has(n.id) && !isTarget;
        const color = highlight
          ? isTarget
            ? "#FF7A45"
            : isHit
              ? n.sensitivity === "high"
                ? "#FF7A45"
                : "#F5C242"
              : "#2A3542"
          : TYPE_COLOR[n.type];
        const r = isTarget ? 11 : highlight ? 7 : 8;
        return (
          <g key={n.id}>
            <circle
              cx={n.x}
              cy={n.y}
              r={r}
              fill={color}
              stroke={highlight ? "none" : "#0B0F14"}
              strokeWidth={1.5}
            />
            <text
              className={`gnode-label ${isTarget || isHit || !highlight ? "hi" : ""}`}
              x={n.x}
              y={n.y - 14}
              textAnchor="middle"
            >
              {n.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
