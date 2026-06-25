import { useMemo } from "react";
import { Chip } from "../components/ui";
import { CareerOptionMatrix } from "./CareerOptionMatrix";
import {
  CareerTree,
  SegmentInsight,
  Skill,
  TreeBranchNode,
  TreeNode,
  TreeSegmentSummary,
  TreeStateNode,
  segmentInsightKey,
} from "../types";

const STATE_SIZE = 80;
const BRANCH_SIZE = 68;
const CANVAS_WIDTH = 960;
const CANVAS_CENTER = CANVAS_WIDTH / 2;
const LEVEL_HEIGHT = 210;
const BRANCH_Y_OFFSET = 96;

function formatPln(n: number | null | undefined) {
  if (n == null) return "—";
  return `${Math.round(n).toLocaleString("pl-PL")} zł`;
}

function MatchMeter({
  before,
  after,
  delta,
}: {
  before: number;
  after: number;
  delta?: number;
}) {
  const gain = delta ?? Math.max(0, after - before);
  return (
    <div className="tree-match-meter">
      <div className="tree-match-meter__head">
        <span>Wzrost dopasowania TF-IDF</span>
        <strong className="tree-match-meter__delta">+{gain}%</strong>
      </div>
      <div className="tree-match-meter__track" aria-hidden>
        <div className="tree-match-meter__before" style={{ width: `${Math.min(before, 100)}%` }} />
        <div
          className="tree-match-meter__gain"
          style={{
            left: `${Math.min(before, 100)}%`,
            width: `${Math.min(gain, 100 - before)}%`,
          }}
        />
      </div>
      <div className="tree-match-meter__labels">
        <span>Teraz: {before}%</span>
        <span>Po skillu: <strong>{after}%</strong></span>
      </div>
    </div>
  );
}

function SalaryLevels({ insight }: { insight?: SegmentInsight }) {
  if (!insight) return null;
  const levels = [
    { key: "junior" as const, title: "Junior" },
    { key: "mid" as const, title: "Mid" },
    { key: "senior" as const, title: "Senior" },
  ];

  return (
    <div className="tree-salary-grid">
      {levels.map(({ key, title }) => {
        const row = insight.salary_by_level?.[key];
        return (
          <div key={key} className={`tree-salary-card ${row ? "" : "tree-salary-card--empty"}`}>
            <span className="tree-salary-card__level">{title}</span>
            <strong className="tree-salary-card__amount">
              {row ? formatPln(row.median) : "—"}
            </strong>
            <span className="tree-salary-card__meta">
              {row ? `${row.offers} ofert` : "brak danych"}
            </span>
            <span className="tree-salary-card__period">UoP / mies.</span>
          </div>
        );
      })}
    </div>
  );
}

function SegmentInsightBlock({
  label,
  matchPct,
  insight,
}: {
  label: string;
  matchPct?: number;
  insight?: SegmentInsight;
}) {
  if (!insight) return null;
  return (
    <div className="tree-insight-block">
      <div className="tree-insight-block__head">
        <div>
          {label ? <h4>{label}</h4> : null}
          <p>
            {insight.offer_count.toLocaleString("pl-PL")} ofert w segmencie
            {matchPct != null ? ` · dopasowanie ${matchPct}%` : ""}
          </p>
        </div>
        {insight.median_salary_uop != null && (
          <div className="tree-insight-block__median">
            <span>Mediana</span>
            <strong>{formatPln(insight.median_salary_uop)}</strong>
          </div>
        )}
      </div>
      <SalaryLevels insight={insight} />
    </div>
  );
}

interface LayoutItem {
  id: string;
  x: number;
  y: number;
  node: TreeNode;
  levelIndex: number;
  size: number;
}

interface LayoutEdge {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  status: string;
}

function layoutTree(tree: CareerTree) {
  const items: LayoutItem[] = [];
  const edges: LayoutEdge[] = [];

  tree.levels.forEach((level, li) => {
    const stateY = 52 + li * LEVEL_HEIGHT;
    items.push({
      id: level.state.id,
      x: CANVAS_CENTER,
      y: stateY,
      node: level.state,
      levelIndex: li,
      size: STATE_SIZE,
    });

    const branches = level.branches;
    const n = branches.length;
    const spread = n <= 1 ? 0 : Math.min(220, 840 / Math.max(n - 1, 1));
    const startX = CANVAS_CENTER - ((n - 1) * spread) / 2;

    branches.forEach((branch, bi) => {
      const bx = n === 1 ? CANVAS_CENTER : startX + bi * spread;
      const by = stateY + BRANCH_Y_OFFSET;
      items.push({
        id: branch.id,
        x: bx,
        y: by,
        node: branch,
        levelIndex: li,
        size: BRANCH_SIZE,
      });

      edges.push({
        id: `e-${level.state.id}-${branch.id}`,
        from: { x: CANVAS_CENTER, y: stateY + STATE_SIZE / 2 },
        to: { x: bx, y: by - BRANCH_SIZE / 2 },
        status: branch.status,
      });

      if (level.chosen_branch_id === branch.id && li + 1 < tree.levels.length) {
        const nextY = 52 + (li + 1) * LEVEL_HEIGHT;
        edges.push({
          id: `e-${branch.id}-next`,
          from: { x: bx, y: by + BRANCH_SIZE / 2 },
          to: { x: CANVAS_CENTER, y: nextY - STATE_SIZE / 2 },
          status: "completed",
        });
      }
    });
  });

  const height = tree.levels.length * LEVEL_HEIGHT + 100;
  return { items, edges, height, width: CANVAS_WIDTH };
}

function curvePath(from: { x: number; y: number }, to: { x: number; y: number }) {
  const midY = (from.y + to.y) / 2;
  return `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;
}

function StateIcon() {
  return (
    <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden>
      <path
        fill="currentColor"
        d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9v-1a6 6 0 0 1 12 0v1H4zm10.5-6.5a3.5 3.5 0 0 1 3.5 3.5V20h-7v-1.5a5.5 5.5 0 0 1 5.5-5.5z"
      />
    </svg>
  );
}

function SkillIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2l3 6 6 .9-4.5 4.4 1 6.1L12 17l-5.5 2.4 1-6.1L3 8.9 9 8l3-6z"
      />
    </svg>
  );
}

function BundleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden>
      <path
        fill="currentColor"
        d="M4 8h16v2H4V8zm0 5h10v2H4v-2zm0 5h14v2H4v-2z"
      />
    </svg>
  );
}

function CheckBadge() {
  return (
    <svg className="tree-node__badge tree-node__badge--ok" viewBox="0 0 24 24" width="18" height="18">
      <path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
    </svg>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  return <span className="tree-node__delta">+{delta}%</span>;
}

interface TreeNodeViewProps {
  item: LayoutItem;
  selected: boolean;
  unlocking: boolean;
  onSelect: (node: TreeNode) => void;
}

function TreeNodeView({ item, selected, unlocking, onSelect }: TreeNodeViewProps) {
  const { node, x, y, size } = item;
  const isState = node.kind === "state";
  const isBranch = node.kind === "branch";
  const branch = isBranch ? (node as TreeBranchNode) : null;
  const isBundle = branch?.branch_type === "bundle";
  const side = x >= CANVAS_CENTER ? "right" : "left";

  return (
    <div
      className={`tree-node-wrap tree-node-wrap--${isState ? "state" : "branch"} ${
        isBundle ? "tree-node-wrap--bundle" : ""
      }`}
      style={{
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
      }}
    >
      <button
        type="button"
        className={`tree-node tree-node--${node.status} tree-node--${node.kind} ${
          selected ? "tree-node--selected" : ""
        } ${unlocking ? "tree-node--unlocking" : ""} ${isBundle ? "tree-node--bundle" : ""}`}
        style={{ width: size, height: size }}
        onClick={() => onSelect(node)}
      >
        <span className="tree-node__icon">
          {isState ? <StateIcon /> : isBundle ? <BundleIcon /> : <SkillIcon />}
        </span>
        {node.status === "completed" && <CheckBadge />}
        {isBranch && node.status === "available" && (
          <DeltaBadge delta={(node as TreeBranchNode).match_delta} />
        )}
      </button>
      <div
        className={`tree-node-label tree-node-label--${isState ? "state" : "branch"} tree-node-label--${side}`}
      >
        <strong>{node.title}</strong>
        <span>{node.subtitle}</span>
        {isBranch && (
          <em className="tree-node-label__gain">
            {(node as TreeBranchNode).match_before}% → {(node as TreeBranchNode).match_after}%
          </em>
        )}
      </div>
    </div>
  );
}

export function CareerTreeCanvas({
  data,
  selectedNode,
  unlockingId,
  onSelectNode,
}: {
  data: CareerTree;
  selectedNode: TreeNode | null;
  unlockingId?: string | null;
  onSelectNode: (node: TreeNode) => void;
}) {
  const layout = useMemo(() => layoutTree(data), [data]);

  return (
    <div className="tree-canvas" style={{ height: layout.height, width: layout.width }}>
      <svg className="tree-path-svg" width={layout.width} height={layout.height} aria-hidden>
        {layout.edges.map((edge) => (
          <path
            key={edge.id}
            className={`tree-path-line tree-path-line--${edge.status}`}
            d={curvePath(edge.from, edge.to)}
          />
        ))}
      </svg>

      {layout.items.map((item) => (
        <TreeNodeView
          key={item.id}
          item={item}
          selected={selectedNode?.id === item.id}
          unlocking={unlockingId === item.id}
          onSelect={onSelectNode}
        />
      ))}

      {data.levels.length > 1 && (
        <div className="tree-level-hint" style={{ top: layout.height - 36 }}>
          Przewiń w dół — drzewo rośnie z każdą wybraną kompetencją
        </div>
      )}
    </div>
  );
}

function BranchDetail({
  branch,
  insight,
  insightsLoading,
  takingBranch,
  onTakeBranch,
}: {
  branch: TreeBranchNode;
  insight?: SegmentInsight;
  insightsLoading?: boolean;
  takingBranch?: boolean;
  onTakeBranch: (branch: TreeBranchNode) => void;
}) {
  const isBundle = branch.branch_type === "bundle" || (branch.skills?.length ?? 0) > 1;

  return (
    <div className="tree-node-detail">
      <p className="tree-node-detail__eyebrow">
        {isBundle ? "Pakiet kompetencji" : "Gałąź rozwoju"}
      </p>
      <h3 className="tree-node-detail__title">{branch.title}</h3>
      <p className="tree-node-detail__segment">{branch.segment_label}</p>

      {isBundle && branch.skills && branch.skills.length > 0 && (
        <div className="tree-skill-list">
          <span className="tree-skill-list__label">Skille w pakiecie</span>
          <div className="chips-row">
            {branch.skills.map((s) => (
              <Chip key={String(s.id)} label={s.name} variant="ok" />
            ))}
          </div>
        </div>
      )}

      <MatchMeter
        before={branch.match_before}
        after={branch.match_after}
        delta={branch.match_delta}
      />

      {!isBundle && (
        <p className="tree-node-detail__skill-meta">
          Skill występuje w <strong>{branch.pct_of_segment ?? "—"}%</strong> ofert tego segmentu.
        </p>
      )}

      {isBundle && (
        <p className="tree-node-detail__skill-meta">
          Pakiet dodaje <strong>{branch.skills?.length ?? 3} kompetencje</strong> naraz — TF-IDF
          rośnie wyraźniej niż po pojedynczym skillu.
        </p>
      )}

      {insightsLoading && !insight && (
        <p className="muted tree-insight-loading">Ładuję wynagrodzenia…</p>
      )}

      <SegmentInsightBlock
        label="Wynagrodzenia w segmencie"
        matchPct={branch.match_after}
        insight={insight ?? branch.segment_insight}
      />


      {branch.status === "available" && (
        <button
          type="button"
          className="btn-primary roadmap-detail__cta"
          disabled={takingBranch}
          onClick={() => onTakeBranch(branch)}
        >
          {takingBranch
            ? "Odblokowuję…"
            : isBundle
              ? "Uczę się — dodaj pakiet i rozwiń drzewo"
              : "Uczę się — dodaj skill i rozwiń drzewo"}
        </button>
      )}

      {branch.status === "completed" && (
        <p className="roadmap-detail__hint roadmap-detail__hint--ok">
          Ten krok masz już za sobą.
        </p>
      )}
    </div>
  );
}

function StateDetail({
  state,
  segmentInsights,
  insightsLoading,
}: {
  state: TreeStateNode;
  segmentInsights: Record<string, SegmentInsight>;
  insightsLoading?: boolean;
}) {
  return (
    <div className="tree-node-detail">
      <p className="tree-node-detail__eyebrow">Twój aktualny stan</p>
      <h3 className="tree-node-detail__title">{state.title}</h3>
      <p className="tree-node-detail__segment">{state.subtitle}</p>

      {state.skills.length > 0 ? (
        <div className="tree-skill-list">
          <span className="tree-skill-list__label">Twoje kompetencje</span>
          <div className="chips-row">
            {state.skills.map((s: Skill) => (
              <Chip key={String(s.id)} label={s.name} variant="ok" />
            ))}
          </div>
        </div>
      ) : (
        <p className="roadmap-detail__hint muted">
          Wybierz gałąź ze skilliem, aby zacząć budować profil.
        </p>
      )}

      {insightsLoading && state.top_segments.length > 0 && (
        <p className="muted tree-insight-loading">Ładuję wynagrodzenia segmentów…</p>
      )}

      {state.top_segments.length > 0 && (
        <div className="tree-segment-stack">
          <span className="tree-skill-list__label">Twoje najlepsze segmenty</span>
          {state.top_segments.map((seg: TreeSegmentSummary) => {
            const key = segmentInsightKey(seg.lead_main_category, seg.lead_sub_category);
            const insight = segmentInsights[key] ?? seg.segment_insight;
            return (
              <div key={key} className="tree-segment-card">
                <div className="tree-segment-card__head">
                  <strong>{seg.display_label}</strong>
                  <span className="tree-segment-card__match">{seg.match_pct}%</span>
                </div>
                <SegmentInsightBlock label="" insight={insight} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CareerComparisonSection({
  data,
  segmentInsights,
  insightsLoading,
  selectedNode,
}: {
  data: CareerTree;
  segmentInsights: Record<string, SegmentInsight>;
  insightsLoading?: boolean;
  selectedNode: TreeNode | null;
}) {
  const branches = data.branch_comparison;
  if (!branches.length) return null;

  const selectedNodeKey =
    selectedNode?.kind === "branch"
      ? segmentInsightKey(
          (selectedNode as TreeBranchNode).lead_main_category,
          (selectedNode as TreeBranchNode).lead_sub_category
        )
      : null;

  return (
    <CareerOptionMatrix
      branches={branches}
      insights={segmentInsights}
      loading={insightsLoading}
      selectedNodeKey={selectedNodeKey}
    />
  );
}

export function CareerTreePanel({
  data,
  selectedNode,
  segmentInsights,
  insightsLoading,
  takingBranch,
  onTakeBranch,
}: {
  data: CareerTree;
  selectedNode: TreeNode | null;
  segmentInsights: Record<string, SegmentInsight>;
  insightsLoading?: boolean;
  takingBranch?: boolean;
  onTakeBranch: (branch: TreeBranchNode) => void;
}) {
  const active =
    selectedNode || data.levels[data.levels.length - 1]?.state || null;

  const activeState = active?.kind === "state" ? (active as TreeStateNode) : null;
  const activeBranch = active?.kind === "branch" ? (active as TreeBranchNode) : null;

  const branchInsight = activeBranch
    ? segmentInsights[
        segmentInsightKey(activeBranch.lead_main_category, activeBranch.lead_sub_category)
      ]
    : undefined;

  return (
    <aside className="roadmap-sidebar panel tree-inspector">
      <p className="roadmap-sidebar__eyebrow">Szczegóły kroku</p>
      <h2 className="roadmap-sidebar__title">Kliknij klocek na mapie</h2>
      <p className="roadmap-sidebar__sub">
        Zobacz wzrost dopasowania i mediany wynagrodzeń Junior / Mid / Senior — bez
        przechodzenia na inne strony.
      </p>

      {!selectedNode && (
        <p className="roadmap-sidebar__footnote muted">
          {data.levels[data.levels.length - 1]?.branches.length ?? 0} dostępnych ścieżek
        </p>
      )}

      {activeState && (
        <StateDetail
          state={activeState}
          segmentInsights={segmentInsights}
          insightsLoading={insightsLoading}
        />
      )}
      {activeBranch && (
        <BranchDetail
          branch={activeBranch}
          insight={branchInsight}
          insightsLoading={insightsLoading}
          takingBranch={takingBranch}
          onTakeBranch={onTakeBranch}
        />
      )}
    </aside>
  );
}

export { CareerTreeCanvas as CareerRoadmapCanvas, CareerTreePanel as CareerRoadmapPanel };
