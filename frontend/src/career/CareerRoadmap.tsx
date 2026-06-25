import { useMemo } from "react";
import { Chip } from "../components/ui";
import {
  CareerTree,
  SegmentKey,
  Skill,
  TreeBranchNode,
  TreeNode,
  TreeStateNode,
} from "../types";

const STATE_SIZE = 80;
const BRANCH_SIZE = 68;
const CANVAS_WIDTH = 960;
const CANVAS_CENTER = CANVAS_WIDTH / 2;
const LEVEL_HEIGHT = 210;
const BRANCH_Y_OFFSET = 96;

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

function curvePath(
  from: { x: number; y: number },
  to: { x: number; y: number }
) {
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
  const side = x >= CANVAS_CENTER ? "right" : "left";

  return (
    <div
      className={`tree-node-wrap tree-node-wrap--${isState ? "state" : "branch"}`}
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
        } ${unlocking ? "tree-node--unlocking" : ""}`}
        style={{ width: size, height: size }}
        onClick={() => onSelect(node)}
      >
        <span className="tree-node__icon">{isState ? <StateIcon /> : <SkillIcon />}</span>
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

interface CareerTreeCanvasProps {
  data: CareerTree;
  selectedNode: TreeNode | null;
  unlockingId?: string | null;
  onSelectNode: (node: TreeNode) => void;
}

export function CareerTreeCanvas({
  data,
  selectedNode,
  unlockingId,
  onSelectNode,
}: CareerTreeCanvasProps) {
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

interface CareerTreePanelProps {
  data: CareerTree;
  selectedNode: TreeNode | null;
  takingBranch?: boolean;
  onTakeBranch: (branch: TreeBranchNode) => void;
  onOpenSegment: (segment: SegmentKey, returnMode?: string) => void;
}

export function CareerTreePanel({
  data,
  selectedNode,
  takingBranch,
  onTakeBranch,
  onOpenSegment,
}: CareerTreePanelProps) {
  const active =
    selectedNode ||
    data.levels[data.levels.length - 1]?.state ||
    null;

  const activeState =
    active?.kind === "state" ? (active as TreeStateNode) : null;
  const activeBranch =
    active?.kind === "branch" ? (active as TreeBranchNode) : null;

  const currentLevel = data.levels[data.levels.length - 1];

  return (
    <aside className="roadmap-sidebar panel">
      <p className="roadmap-sidebar__eyebrow">Dynamiczne drzewko TF-IDF</p>
      <h2 className="roadmap-sidebar__title">{data.title}</h2>
      <p className="roadmap-sidebar__sub">{data.subtitle}</p>

      <div className="roadmap-sidebar__stats">
        <div>
          <span className="roadmap-sidebar__stat-label">Kompetencje</span>
          <strong>{data.total_skills}</strong>
        </div>
        <div>
          <span className="roadmap-sidebar__stat-label">Najlepszy segment</span>
          <strong>{data.best_segment?.match_pct ?? 0}%</strong>
        </div>
      </div>

      <ul className="roadmap-features">
        <li>
          <strong>Twój stan</strong>
          <span>Kliknij węzeł „Twój stan”, aby zobaczyć aktualne kompetencje i dopasowanie.</span>
        </li>
        <li>
          <strong>Gałęzie ze skillami</strong>
          <span>Każda gałąź to konkretny skill — dodanie go podnosi matching do segmentu (TF-IDF).</span>
        </li>
        <li>
          <strong>Rozwój w dół</strong>
          <span>Po wyborze ścieżki drzewo generuje się na nowo z kolejnymi opcjami.</span>
        </li>
      </ul>

      {activeState && (
        <div className="roadmap-detail">
          <h3>{activeState.title}</h3>
          <p>{activeState.subtitle}</p>

          {activeState.skills.length > 0 ? (
            <div className="tree-skill-list">
              <span className="tree-skill-list__label">Twoje kompetencje</span>
              <div className="chips-row">
                {activeState.skills.map((s) => (
                  <Chip key={String(s.id)} label={s.name} variant="ok" />
                ))}
              </div>
            </div>
          ) : (
            <p className="roadmap-detail__hint muted">
              Brak skilli — wybierz pierwszą gałąź, aby zacząć budować profil.
            </p>
          )}

          {activeState.top_segments.length > 0 && (
            <div className="tree-segment-list">
              <span className="tree-skill-list__label">Top segmenty (TF-IDF)</span>
              <ul>
                {activeState.top_segments.map((seg) => (
                  <li key={`${seg.lead_main_category}|${seg.lead_sub_category}`}>
                    <button
                      type="button"
                      className="tree-segment-link"
                      onClick={() =>
                        onOpenSegment(
                          {
                            lead_main_category: seg.lead_main_category,
                            lead_sub_category: seg.lead_sub_category,
                          },
                          "path"
                        )
                      }
                    >
                      {seg.display_label}
                      <span>{seg.match_pct}%</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {activeBranch && activeBranch.status === "available" && (
        <div className="roadmap-detail">
          <h3>+ {activeBranch.skill_name}</h3>
          <p>
            Segment: <strong>{activeBranch.segment_label}</strong>
          </p>
          <p className="tree-match-gain">
            Dopasowanie: {activeBranch.match_before}% →{" "}
            <strong>{activeBranch.match_after}%</strong>
            <span className="tree-match-gain__delta"> (+{activeBranch.match_delta}%)</span>
          </p>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Skill występuje w {activeBranch.pct_of_segment ?? "—"}% ofert tego segmentu.
          </p>
          <button
            type="button"
            className="btn-primary roadmap-detail__cta"
            disabled={takingBranch}
            onClick={() => onTakeBranch(activeBranch)}
          >
            {takingBranch ? "Odblokowuję…" : "Uczę się — dodaj skill i rozwiń drzewo"}
          </button>
          <button
            type="button"
            className="btn-secondary roadmap-detail__cta"
            onClick={() =>
              onOpenSegment(
                {
                  lead_main_category: activeBranch.lead_main_category,
                  lead_sub_category: activeBranch.lead_sub_category,
                },
                "path"
              )
            }
          >
            Zobacz segment rynku
          </button>
        </div>
      )}

      {activeBranch && activeBranch.status === "completed" && (
        <p className="roadmap-detail__hint roadmap-detail__hint--ok">
          Tę ścieżkę już przeszedłeś — skill „{activeBranch.skill_name}” jest w profilu.
        </p>
      )}

      {!selectedNode && currentLevel?.branches.length > 0 && (
        <p className="roadmap-sidebar__footnote muted">
          {currentLevel.branches.length} dostępnych ścieżek — wybierz gałąź ze skilliem.
        </p>
      )}
    </aside>
  );
}

// Keep legacy exports for any stale imports
export { CareerTreeCanvas as CareerRoadmapCanvas, CareerTreePanel as CareerRoadmapPanel };
