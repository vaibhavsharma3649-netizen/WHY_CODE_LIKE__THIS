import dagre from "dagre";
import type { Edge, Node } from "@xyflow/react";

export interface Size {
  width: number;
  height: number;
}

export function nodeSize(kind: string): Size {
  if (kind === "repository") return { width: 224, height: 60 };
  if (kind === "file") return { width: 212, height: 52 };
  if (kind === "decision" || kind === "finding") return { width: 236, height: 60 };
  if (kind === "pull_request") return { width: 236, height: 66 };
  return { width: 204, height: 52 };
}

export function layoutGraph<T extends Node>(nodes: T[], edges: Edge[], direction: "LR" | "TB" = "LR"): T[] {
  if (!nodes.length) return nodes;
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: direction === "LR" ? 12 : 44,
    ranksep: direction === "LR" ? 96 : 74,
    edgesep: 18,
    marginx: 12,
    marginy: 12,
  });
  const sizes = new Map<string, Size>();
  const kinds = new Map<string, string>();
  for (const node of nodes) {
    const kind = String((node.data as { kind?: string })?.kind ?? "entity");
    const size = nodeSize(kind);
    kinds.set(node.id, kind);
    sizes.set(node.id, size);
    if (kind !== "pull_request") {
      g.setNode(node.id, { width: size.width, height: size.height });
    }
  }
  for (const edge of edges) {
    const sourceKind = kinds.get(edge.source);
    const targetKind = kinds.get(edge.target);
    if (sourceKind && targetKind && sourceKind !== "pull_request" && targetKind !== "pull_request") {
      g.setEdge(edge.source, edge.target);
    }
  }
  dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();
  let maxRight = 0;
  for (const node of nodes) {
    if (kinds.get(node.id) === "pull_request") continue;
    const point = g.node(node.id);
    const size = sizes.get(node.id) ?? { width: 200, height: 56 };
    if (!point) continue;
    const position = { x: point.x - size.width / 2, y: point.y - size.height / 2 };
    positions.set(node.id, position);
    maxRight = Math.max(maxRight, position.x + size.width);
  }

  const prNodes = nodes.filter((node) => kinds.get(node.id) === "pull_request");
  if (prNodes.length) {
    const offsetBySource = new Map<string, number>();
    const hasEntities = nodes.some((node) => kinds.get(node.id) === "entity");
    const minY = positions.size ? Math.min(...[...positions.values()].map((p) => p.y)) : 0;
    for (const pr of prNodes) {
      const size = sizes.get(pr.id) ?? { width: 236, height: 66 };
      const incoming = edges.find((edge) => edge.target === pr.id && positions.has(edge.source));
      const anchor = incoming ? positions.get(incoming.source) : undefined;
      const index = incoming ? offsetBySource.get(incoming.source) ?? 0 : 0;
      if (incoming) offsetBySource.set(incoming.source, index + 1);
      if (hasEntities) {
        positions.set(pr.id, {
          x: anchor?.x ?? maxRight - size.width,
          y: minY - size.height - 56 - index * (size.height + 20),
        });
      } else {
        const baseY = anchor ? anchor.y : (positions.size ? Math.max(...[...positions.values()].map((p) => p.y)) : 0);
        positions.set(pr.id, { x: maxRight + 190, y: baseY + index * (size.height + 22) });
      }
    }
  }

  return nodes.map((node) => {
    const position = positions.get(node.id);
    return position ? { ...node, position } : node;
  });
}
