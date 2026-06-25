import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { CareerTreeCanvas, CareerTreePanel } from "./CareerRoadmap";
import {
  CareerPathStep,
  CareerTree,
  SegmentKey,
  Skill,
  TreeBranchNode,
  TreeNode,
  UserProfile,
} from "../types";

interface CareerPathViewProps {
  profileData: UserProfile | null;
  selectedSkills: Skill[];
  onEditProfile: () => void;
  onTakeBranch: (skill: Skill, step: CareerPathStep) => Promise<void>;
  onResetPath: () => Promise<void>;
  onOpenSegment: (segment: SegmentKey, returnMode?: string) => void;
}

export function CareerPathView({
  profileData,
  selectedSkills,
  onEditProfile,
  onTakeBranch,
  onResetPath,
  onOpenSegment,
}: CareerPathViewProps) {
  const [tree, setTree] = useState<CareerTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [unlockingId, setUnlockingId] = useState<string | null>(null);
  const [takingBranch, setTakingBranch] = useState(false);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const prevDepthRef = useRef(0);

  const skillIds = selectedSkills
    .map((s) => String(s.id))
    .filter((id) => id && id !== "undefined");

  const careerPath = profileData?.career_path || {};
  const careerPathKey = JSON.stringify(careerPath);
  const skillIdsKey = skillIds.join("|");

  const loadTree = useCallback(
    (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");
      return api
        .getCareerRoadmap(
          skillIds,
          profileData?.interested_industries || [],
          careerPath
        )
        .then((data) => {
          setTree(data);
          if (!isRefresh) {
            const active = data.levels[data.levels.length - 1]?.state;
            setSelectedNode(active || null);
          }
        })
        .catch((e) => {
          setError((e as Error).message);
          if (!isRefresh) setTree(null);
        })
        .finally(() => {
          setLoading(false);
          setRefreshing(false);
        });
    },
    [skillIdsKey, careerPathKey, profileData?.interested_industries]
  );

  const mountedRef = useRef(false);

  useEffect(() => {
    loadTree(mountedRef.current);
    mountedRef.current = true;
  }, [skillIdsKey, careerPathKey, profileData?.interested_industries, loadTree]);

  useEffect(() => {
    if (!tree || !canvasWrapRef.current) return;
    const depth = tree.depth;
    if (depth <= prevDepthRef.current) {
      prevDepthRef.current = depth;
      return;
    }
    prevDepthRef.current = depth;
    const el = canvasWrapRef.current;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
  }, [tree?.depth]);

  const handleTakeBranch = async (branch: TreeBranchNode) => {
    if (takingBranch) return;
    if (careerPath.steps?.some((s) => s.skill_id === branch.skill_id)) return;

    setTakingBranch(true);
    setUnlockingId(branch.id);
    try {
      await onTakeBranch(
        { id: branch.skill_id, name: branch.skill_name },
        {
          skill_id: branch.skill_id,
          skill_name: branch.skill_name,
          lead_main_category: branch.lead_main_category,
          lead_sub_category: branch.lead_sub_category,
          match_before: branch.match_before,
          match_after: branch.match_after,
        }
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTimeout(() => setUnlockingId(null), 600);
      setTakingBranch(false);
    }
  };

  const handleReset = async () => {
    if (!careerPath.steps?.length) return;
    if (!window.confirm("Zresetować przebytą ścieżkę na drzewku? Skille w profilu zostaną.")) {
      return;
    }
    await onResetPath();
  };

  return (
    <div className="career-path-page">
      <header className="career-path-hero panel">
        <div className="career-path-hero__row">
          <div>
            <h1 className="career-path-hero__title">Ścieżka kariery</h1>
            <p className="career-path-hero__sub">
              Dynamiczne drzewko oparte na TF-IDF — każda gałąź to skill, który realnie
              podnosi Twoje dopasowanie do segmentu rynku pracy.
            </p>
          </div>
          <div className="career-path-hero__actions">
            {(careerPath.steps?.length ?? 0) > 0 && (
              <button type="button" className="btn-secondary" onClick={handleReset}>
                Resetuj ścieżkę
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={onEditProfile}>
              Edytuj profil
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="alert career-path-alert" role="alert">
          {error}
        </div>
      )}

      {loading && !tree && (
        <div className="loading career-path-loading">
          <div className="spinner" />
          <p>Generuję gałęzie na podstawie rynku…</p>
        </div>
      )}

      {tree && (
        <div className="roadmap-layout roadmap-layout--wide">
          <div className="roadmap-canvas-wrap panel" ref={canvasWrapRef}>
            {refreshing && (
              <div className="tree-refresh-overlay" aria-live="polite">
                <div className="spinner spinner--sm" />
                <span>Przeliczam gałęzie…</span>
              </div>
            )}
            <CareerTreeCanvas
              data={tree}
              selectedNode={selectedNode}
              unlockingId={unlockingId}
              onSelectNode={setSelectedNode}
            />
          </div>
          <CareerTreePanel
            data={tree}
            selectedNode={selectedNode}
            takingBranch={takingBranch}
            onTakeBranch={handleTakeBranch}
            onOpenSegment={onOpenSegment}
          />
        </div>
      )}
    </div>
  );
}
