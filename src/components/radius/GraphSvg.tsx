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
    highlight?.newAccessId != null ? { from: highlight.targetId, to: highlight.newAccessId } : null;
  if (newEdge) edgesToDraw.push(newEdge);

  return (
    <svg className="graph" viewBox="-40 0 980 460" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker
          id="arrow-default"
          viewBox="0 0 10 10"
          refX="18"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#242D38" />
        </marker>
        <marker
          id="arrow-hit"
          viewBox="0 0 10 10"
          refX="18"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#FF7A45" />
        </marker>
        <marker
          id="arrow-new"
          viewBox="0 0 10 10"
          refX="18"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#FF5A5A" />
        </marker>
      </defs>
      {edgesToDraw.map((e, i) => {
        const a = byId.get(e.from);
        const b = byId.get(e.to);
        if (!a || !b) return null;
        const isNew = !!newEdge && e.from === newEdge.from && e.to === newEdge.to;
        const isHit =
          !isNew &&
          !!highlight &&
          highlight.hitIds.has(e.from) &&
          highlight.hitIds.has(e.to) &&
          e.from !== highlight.targetId &&
          e.from !== highlight.newAccessId;
        const cls = isNew ? "gedge newedge" : isHit ? "gedge hit" : "gedge";
        const marker = isNew
          ? "url(#arrow-new)"
          : isHit
            ? "url(#arrow-hit)"
            : "url(#arrow-default)";
        return (
          <line
            key={`${e.from}-${e.to}-${i}`}
            className={cls}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            markerEnd={marker}
          />
        );
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
