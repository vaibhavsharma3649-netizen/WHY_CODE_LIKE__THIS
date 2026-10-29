import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { ChevronDown, ExternalLink, Filter, Maximize2, Tag, X } from "lucide-react";
import { graph as loadGraph, shortSha } from "../api";
import { useAuth } from "../auth";
import { useAsync } from "../hooks";
import { kindMeta } from "../nav";
import { layoutGraph, nodeSize } from "../lib/layout";
import { ErrorBlock, KindBadge, LoadingBlock, Pill, SectionLabel } from "../components/ui";

const KINDS = ["repository", "file", "entity", "decision", "finding", "pull_request"] as const;
type FilterKind = (typeof KINDS)[number];

const FILTER_LABEL: Record<FilterKind, string> = {
  repository: "Repository",
  file: "Files",
  entity: "Code entities",
  decision: "Decisions",
  finding: "Findings",
  pull_request: "Pull requests",
};

const EDGE_STYLE: Record<string, string> = {
  CONTAINS: "#c9c5b8",
  DEFINES: "#d5d2c6",
  CALLS: "#8ba99b",
  AFFECTS: "#c59a4a",
  LOCATED_IN: "#c47a72",
  DISCUSSED_IN: "#8195bf",
};

interface WhyData extends Record<string, unknown> {
  kind: string;
  title: string;
  subtitle?: string | null;
  meta: Record<string, unknown>;
}

type WhyFlowNode = Node<WhyData, "why">;

const WhyNode = memo(function WhyNode({ data, selected }: NodeProps<WhyFlowNode>) {
  const meta = kindMeta(data.kind);
  return (
    <div className={`gnode gnode-${meta.tone}${selected ? " is-selected" : ""}`} title={data.title}>
      <Handle type="target" position={Position.Left} className="gnode-handle" isConnectable={false} />
      <span className="gnode-kind">
        <meta.icon size={10} />
        {meta.label}
      </span>
      <strong className="gnode-title">{data.title}</strong>
      {data.subtitle ? <span className="gnode-sub">{data.subtitle}</span> : null}
      <Handle type="source" position={Position.Right} className="gnode-handle" isConnectable={false} />
    </div>
  );
});

const nodeTypes = { why: WhyNode };

export function Graph() {
  const { repoId, repo } = useAuth();
  const state = useAsync(
    () => (repoId ? loadGraph(repoId) : Promise.reject(new Error("No repository selected."))),
    [repoId],
  );
  const [filters, setFilters] = useState<Record<FilterKind, boolean>>({
    repository: true,
    file: true,
    entity: false,
    decision: true,
    finding: true,
    pull_request: true,
  });
  const [showLabels, setShowLabels] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [focusFile, setFocusFile] = useState<string | null>(null);
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<WhyFlowNode>([]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView } = useReactFlow();

  const kindCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const node of state.data?.nodes ?? []) counts[node.kind] = (counts[node.kind] ?? 0) + 1;
    return counts;
  }, [state.data]);

  const fileNodes = useMemo(
    () => (state.data?.nodes ?? []).filter((node) => node.kind === "file"),
    [state.data],
  );

  const entityParent = useMemo(() => {
    const parents = new Map<string, string>();
    for (const edge of state.data?.edges ?? []) {
      if (edge.label === "DEFINES" && edge.target.startsWith("entity:")) {
        parents.set(edge.target, edge.source);
      }
    }
    return parents;
  }, [state.data]);

  const fileScore = useMemo(() => {
    const scores = new Map<string, number>();
    for (const edge of state.data?.edges ?? []) {
      if ((edge.label === "AFFECTS" || edge.label === "LOCATED_IN") && edge.target.startsWith("file:")) {
        scores.set(edge.target, (scores.get(edge.target) ?? 0) + 1);
      }
    }
    return scores;
  }, [state.data]);

  const bestFileId = useMemo(() => {
    const ranked = [...fileNodes].sort(
      (a, b) => (fileScore.get(b.id) ?? 0) - (fileScore.get(a.id) ?? 0),
    );
    return ranked[0]?.id ?? null;
  }, [fileNodes, fileScore]);

  const effectiveFocus =
    focusFile && fileNodes.some((node) => node.id === focusFile) ? focusFile : bestFileId;

  useEffect(() => {
    setFocusFile(null);
  }, [repoId]);

  const buildGraph = useCallback(() => {
    const data = state.data;
    if (!data) return;
    let visible = data.nodes.filter((node) => filters[node.kind as FilterKind] ?? true);
    if (filters.entity && effectiveFocus) {
      const decisions = new Set<string>();
      const findings = new Set<string>();
      for (const edge of data.edges) {
        if (edge.target !== effectiveFocus) continue;
        if (edge.source.startsWith("decision:")) decisions.add(edge.source);
        if (edge.source.startsWith("finding:")) findings.add(edge.source);
      }
      const prs = new Set<string>();
      for (const edge of data.edges) {
        if (decisions.has(edge.source) && edge.target.startsWith("pr:")) prs.add(edge.target);
      }
      visible = data.nodes.filter(
        (node) =>
          (node.kind === "repository" && filters.repository) ||
          node.id === effectiveFocus ||
          entityParent.get(node.id) === effectiveFocus ||
          decisions.has(node.id) ||
          findings.has(node.id) ||
          prs.has(node.id),
      );
    }
    const visibleIds = new Set(visible.map((node) => node.id));
    const nextNodes: WhyFlowNode[] = visible.map((node) => {
      const size = nodeSize(node.kind);
      return {
        id: node.id,
        type: "why",
        position: { x: 0, y: 0 },
        data: { kind: node.kind, title: node.title || node.label, subtitle: node.subtitle, meta: node.meta },
        style: { width: size.width, height: size.height },
      };
    });
    const nextEdges: Edge[] = data.edges
      .filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target))
      .map((edge) => {
        const stroke = EDGE_STYLE[edge.label] ?? "#cfccc0";
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: showLabels ? edge.label.replace(/_/g, " ").toLowerCase() : undefined,
          type: "smoothstep",
          style: { stroke, strokeWidth: edge.label === "CALLS" ? 1.2 : 1.4, strokeDasharray: edge.label === "CALLS" ? "4 4" : undefined },
          markerEnd: { type: MarkerType.ArrowClosed, width: 13, height: 13, color: stroke },
          labelStyle: { fill: "#6b6f76", fontSize: 9, fontFamily: "ui-monospace, monospace" },
          labelBgStyle: { fill: "#f4f3ee", fillOpacity: 0.92 },
          labelBgPadding: [3, 2],
          labelBgBorderRadius: 3,
        };
      });
    setFlowEdges(nextEdges);
    setFlowNodes(layoutGraph(nextNodes, nextEdges, "LR"));
    setSelected((current) => (current && visibleIds.has(current) ? current : null));
    window.setTimeout(() => void fitView({ padding: 0.16, duration: 320 }), 30);
  }, [
    state.data,
    filters,
    showLabels,
    effectiveFocus,
    entityParent,
    setFlowEdges,
    setFlowNodes,
    fitView,
  ]);

  useEffect(() => {
    buildGraph();
  }, [buildGraph]);

  const toggle = (kind: FilterKind) => {
    setFilters((current) => ({ ...current, [kind]: !current[kind] }));
  };

  if (!repoId) return <div className="page"><ErrorBlock message="No repository selected." /></div>;
  if (state.loading) return <div className="page"><LoadingBlock label="Laying out the memory graph…" /></div>;
  if (state.error || !state.data) {
    return (
      <div className="page">
        <ErrorBlock message={state.error ?? "Graph unavailable"} onRetry={state.reload} />
      </div>
    );
  }

  const selectedNode = state.data.nodes.find((node) => node.id === selected) ?? null;
  const selectedMeta = selectedNode ? Object.entries(selectedNode.meta ?? {}) : [];
  const codeDetail = filters.entity && effectiveFocus;
  const focusPath = fileNodes.find((node) => node.id === effectiveFocus)?.meta?.path;

  return (
    <div className="page graph-page">
      <header className="page-head compact">
        <div>
          <p className="eyebrow">Bounded slice, ordered layout</p>
          <h1>Graph explorer</h1>
          <p className="sub">
            Code, history, and scanner signals in one structure. Nodes are capped and laid out with dagre —
            filter to keep the view readable.
          </p>
          <div className="head-meta">
            <span className="sha-chip">{shortSha(repo?.indexed_sha)}</span>
            <span className="meta-dim">
              {flowNodes.length} nodes visible · {flowEdges.length} edges
            </span>
            {state.data.truncated ? <Pill tone="warn">slice truncated</Pill> : null}
          </div>
        </div>
      </header>

      <section className="graph-shell">
        <div className="graph-toolbar">
          <div className="graph-filters">
            <span className="graph-filter-label">
              <Filter size={13} /> Layers
            </span>
            {KINDS.map((kind) => {
              const meta = kindMeta(kind);
              const active = filters[kind];
              return (
                <button
                  key={kind}
                  type="button"
                  className={`filter-chip chip-${meta.tone}${active ? " is-on" : ""}`}
                  onClick={() => toggle(kind)}
                  title={`Toggle ${FILTER_LABEL[kind].toLowerCase()}`}
                >
                  <span className="chip-dot" />
                  {FILTER_LABEL[kind]}
                  <span className="chip-count">{kindCounts[kind] ?? 0}</span>
                </button>
              );
            })}
          </div>
          <div className="graph-actions">
            {codeDetail ? (
              <div className="select-wrap graph-focus">
                <span className="graph-focus-label">Code in</span>
                <select
                  className="select graph-focus-select"
                  value={effectiveFocus ?? ""}
                  onChange={(event) => setFocusFile(event.target.value)}
                  aria-label="Focus a file"
                >
                  {fileNodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {String(node.meta.path ?? node.title)}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} className="select-chevron" />
              </div>
            ) : null}
            <button
              type="button"
              className={`btn btn-ghost btn-sm${showLabels ? " is-on" : ""}`}
              onClick={() => setShowLabels((value) => !value)}
              title="Toggle edge labels"
            >
              <Tag size={13} />
              Labels
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void fitView({ padding: 0.16, duration: 300 })}
            >
              <Maximize2 size={13} />
              Fit
            </button>
          </div>
        </div>

        <div className="graph-canvas">
          {flowNodes.length === 0 ? (
            <div className="graph-empty">
              <Filter size={22} />
              <strong>No layers selected</strong>
              <p>Turn on at least one layer to see the structure.</p>
            </div>
          ) : (
            <ReactFlow
              nodes={flowNodes}
              edges={flowEdges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={(_, node) => {
                setSelected(node.id);
                if (filters.entity && node.id.startsWith("file:")) setFocusFile(node.id);
              }}
              onPaneClick={() => setSelected(null)}
              nodesConnectable={false}
              elementsSelectable
              minZoom={0.15}
              maxZoom={1.6}
              proOptions={{ hideAttribution: true }}
              fitView
              fitViewOptions={{ padding: 0.16 }}
            >
              <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#d7d3c6" />
              <Controls showInteractive={false} position="bottom-left" />
            </ReactFlow>
          )}

          {selectedNode ? (
            <aside className="graph-inspector card">
              <header>
                <KindBadge kind={selectedNode.kind} small />
                <button type="button" className="icon-btn" onClick={() => setSelected(null)} aria-label="Close inspector">
                  <X size={14} />
                </button>
              </header>
              <h3>{selectedNode.title}</h3>
              {selectedNode.subtitle ? <p className="inspector-sub">{selectedNode.subtitle}</p> : null}
              <dl className="inspector-facts">
                {selectedMeta
                  .filter(([key]) => !["url", "source_url"].includes(key))
                  .map(([key, value]) => (
                    <div key={key}>
                      <dt>{key.replace(/_/g, " ")}</dt>
                      <dd title={String(value)}>
                        {typeof value === "string" && value.startsWith("http") ? (
                          <a className="inline-link" href={value} target="_blank" rel="noreferrer">
                            {value.replace(/^https?:\/\//, "").slice(0, 42)}…
                          </a>
                        ) : (
                          String(value ?? "—")
                        )}
                      </dd>
                    </div>
                  ))}
              </dl>
              {typeof selectedNode.meta?.url === "string" ? (
                <a
                  className="btn btn-ghost btn-sm inspector-link"
                  href={selectedNode.meta.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open original <ExternalLink size={13} />
                </a>
              ) : null}
            </aside>
          ) : null}
        </div>

        <footer className="graph-foot">
          <div className="legend">
            {KINDS.map((kind) => {
              const meta = kindMeta(kind);
              return (
                <span key={kind} className={`legend-item legend-${meta.tone}`}>
                  <span className="legend-swatch" />
                  {FILTER_LABEL[kind]}
                </span>
              );
            })}
          </div>
          <span className="graph-note">
            <SectionLabel>Layout</SectionLabel> dagre LR · edge labels off by default · dashed edges are{" "}
            <code>CALLS</code>
          </span>
        </footer>
      </section>
    </div>
  );
}
