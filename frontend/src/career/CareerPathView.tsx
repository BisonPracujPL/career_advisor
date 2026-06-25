import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { CareerTrajectorySummary } from "./CareerCompareCharts";
import {
  CareerProfileModeToggle,
  CareerVirtualBanner,
  CareerProfileMode,
} from "./CareerProfileModeToggle";
import {
  emptyVirtualProfile,
  loadVirtualProfile,
  mergeSkills,
  saveVirtualProfile,
  virtualFromReal,
  VirtualCareerProfile,
} from "./careerVirtualProfile";
import { NextLevelReadinessCard } from "./NextLevelCard";
import {
  CareerComparisonSection,
  CareerTreeCanvas,
  CareerTreePanel,
} from "./CareerRoadmap";
import {
  CareerPathStep,
  CareerTree,
  ExperienceItem,
  SegmentInsight,
  Skill,
  TreeBranchNode,
  TreeNode,
  UserProfile,
  segmentInsightKey,
} from "../types";

interface CareerPathViewProps {
  profileData: UserProfile | null;
  selectedSkills: Skill[];
  onEditProfile: () => void;
  onTakeBranch: (skills: Skill[], step: CareerPathStep) => Promise<void>;
  onResetPath: () => Promise<void>;
}

const LOADING_STEPS = [
  "Analizuję Twój profil…",
  "Szukam segmentów rynku…",
  "Liczenie dopasowania TF-IDF…",
  "Buduję gałęzie rozwoju…",
];

function narrativeBody(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={`b-${i}`}>{part}</strong> : <span key={`t-${i}`}>{part}</span>
  );
}

function collectSegments(tree: CareerTree) {
  const seen = new Set<string>();
  const segments: { lead_main_category: string; lead_sub_category: string }[] = [];
  const add = (main: string, sub: string) => {
    const k = segmentInsightKey(main, sub);
    if (!seen.has(k)) {
      seen.add(k);
      segments.push({ lead_main_category: main, lead_sub_category: sub });
    }
  };
  for (const b of tree.branch_comparison) {
    add(b.lead_main_category, b.lead_sub_category);
  }
  const lastState = tree.levels[tree.levels.length - 1]?.state;
  for (const s of lastState?.top_segments || []) {
    add(s.lead_main_category, s.lead_sub_category);
  }
  if (tree.next_level_readiness) {
    add(
      tree.next_level_readiness.lead_main_category,
      tree.next_level_readiness.lead_sub_category
    );
  }
  return segments;
}

export function CareerPathView({
  profileData,
  selectedSkills,
  onEditProfile,
  onTakeBranch,
  onResetPath,
}: CareerPathViewProps) {
  const [profileMode, setProfileMode] = useState<CareerProfileMode>("real");
  const [virtualProfile, setVirtualProfile] = useState<VirtualCareerProfile>(
    () => loadVirtualProfile() || emptyVirtualProfile()
  );
  const [tree, setTree] = useState<CareerTree | null>(null);
  const [segmentInsights, setSegmentInsights] = useState<Record<string, SegmentInsight>>({});
  const [loading, setLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState(0);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [unlockingId, setUnlockingId] = useState<string | null>(null);
  const [takingBranch, setTakingBranch] = useState(false);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const prevDepthRef = useRef(0);

  const isVirtual = profileMode === "virtual";
  const activeSkills = isVirtual ? virtualProfile.hard_skills : selectedSkills;
  const activeExperience: ExperienceItem[] = isVirtual
    ? virtualProfile.experience
    : profileData?.experience || [];
  const activeCareerPath = isVirtual
    ? virtualProfile.career_path || { steps: [] }
    : profileData?.career_path || {};
  const activeIndustries = isVirtual
    ? virtualProfile.interested_industries || []
    : profileData?.interested_industries || [];

  const skillIds = activeSkills
    .map((s) => String(s.id))
    .filter((id) => id && id !== "undefined");

  const careerPathKey = JSON.stringify(activeCareerPath);
  const skillIdsKey = skillIds.join("|");
  const experienceKey = JSON.stringify(activeExperience);
  const modeKey = profileMode;

  useEffect(() => {
    if (isVirtual) {
      saveVirtualProfile(virtualProfile);
    }
  }, [virtualProfile, isVirtual]);

  const loadInsights = useCallback((data: CareerTree) => {
    const segments = collectSegments(data);
    if (!segments.length) {
      setSegmentInsights({});
      return Promise.resolve();
    }
    setInsightsLoading(true);
    return api
      .getCareerInsights(segments)
      .then((res) => setSegmentInsights(res.insights || {}))
      .catch(() => setSegmentInsights({}))
      .finally(() => setInsightsLoading(false));
  }, []);

  const loadTree = useCallback(
    (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else {
        setLoading(true);
        setLoadingStep(0);
      }
      setError("");
      return api
        .getCareerRoadmap(
          skillIds,
          activeIndustries,
          activeCareerPath,
          activeExperience
        )
        .then((data) => {
          setTree(data);
          if (!isRefresh) {
            const active = data.levels[data.levels.length - 1]?.state;
            setSelectedNode(active || null);
          }
          void loadInsights(data);
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
    [skillIdsKey, careerPathKey, experienceKey, activeIndustries, loadInsights]
  );

  const mountedRef = useRef(false);

  useEffect(() => {
    loadTree(mountedRef.current);
    mountedRef.current = true;
  }, [skillIdsKey, careerPathKey, experienceKey, modeKey, loadTree]);

  useEffect(() => {
    if (!loading) return;
    const id = window.setInterval(() => {
      setLoadingStep((s) => (s + 1) % LOADING_STEPS.length);
    }, 1400);
    return () => window.clearInterval(id);
  }, [loading]);

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

  const handleModeChange = (mode: CareerProfileMode) => {
    if (mode === "virtual" && profileMode === "real") {
      const stored = loadVirtualProfile();
      if (!stored?.hard_skills?.length && selectedSkills.length) {
        setVirtualProfile(virtualFromReal(selectedSkills, profileData));
      } else if (!stored) {
        setVirtualProfile(virtualFromReal(selectedSkills, profileData));
      } else {
        setVirtualProfile(stored);
      }
    }
    setProfileMode(mode);
    prevDepthRef.current = 0;
  };

  const handleCopyFromReal = () => {
    setVirtualProfile(virtualFromReal(selectedSkills, profileData));
  };

  const handleResetVirtual = () => {
    if (
      !window.confirm(
        "Wyczyścić wirtualny profil i ścieżkę? Skille testowe zostaną usunięte."
      )
    ) {
      return;
    }
    setVirtualProfile(emptyVirtualProfile());
  };

  const handleTakeBranch = async (branch: TreeBranchNode) => {
    if (takingBranch) return;

    const branchSkillIds =
      branch.skill_ids?.length ? branch.skill_ids : [branch.skill_id];
    const takenIds = new Set(
      (activeCareerPath.steps || []).flatMap((s) => s.skill_ids || [s.skill_id])
    );
    if (branchSkillIds.some((id) => takenIds.has(id))) return;

    const branchSkills: Skill[] =
      branch.skills?.length
        ? branch.skills
        : [{ id: branch.skill_id, name: branch.skill_name }];

    const isBundle = branch.branch_type === "bundle" || branchSkills.length > 1;
    const step: CareerPathStep = {
      skill_id: branch.skill_id,
      skill_name: branch.skill_name,
      skill_ids: branchSkillIds,
      step_type: isBundle ? "bundle" : "single",
      lead_main_category: branch.lead_main_category,
      lead_sub_category: branch.lead_sub_category,
      match_before: branch.match_before,
      match_after: branch.match_after,
    };

    setTakingBranch(true);
    setUnlockingId(branch.id);
    try {
      if (isVirtual) {
        setVirtualProfile((prev) => ({
          ...prev,
          hard_skills: mergeSkills(prev.hard_skills, branchSkills),
          career_path: {
            ...prev.career_path,
            steps: [...(prev.career_path?.steps || []), step],
          },
        }));
      } else {
        await onTakeBranch(branchSkills, step);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTimeout(() => setUnlockingId(null), 600);
      setTakingBranch(false);
    }
  };

  const handleReset = async () => {
    if (!(activeCareerPath.steps?.length ?? 0)) return;
    const msg = isVirtual
      ? "Zresetować wirtualną ścieżkę na drzewku?"
      : "Zresetować przebytą ścieżkę na drzewku? Skille w profilu zostaną.";
    if (!window.confirm(msg)) return;

    if (isVirtual) {
      setVirtualProfile((prev) => ({
        ...prev,
        career_path: { ...prev.career_path, steps: [] },
      }));
    } else {
      await onResetPath();
    }
  };

  const narrative = tree?.career_narrative;
  const stepsCount = activeCareerPath.steps?.length ?? 0;
  const hasSkills = skillIds.length > 0;
  const emptyProfile = !hasSkills && stepsCount === 0;

  return (
    <div className="career-path-page">
      <header className="career-path-hero panel">
        <div className="career-path-hero__row">
          <div className="career-path-hero__main">
            <div className="career-path-hero__topline">
              <CareerProfileModeToggle mode={profileMode} onChange={handleModeChange} />
            </div>
            <h1 className="career-path-hero__title">
              {narrative?.headline || "Ścieżka kariery"}
            </h1>
            <p className="career-path-hero__sub career-narrative__body">
              {narrative?.body
                ? narrativeBody(narrative.body)
                : isVirtual
                  ? "Profil wirtualny — testuj ścieżki i pakiety skilli bez zmiany prawdziwego profilu."
                  : "Dynamiczne drzewko oparte na TF-IDF — każda gałąź realnie podnosi dopasowanie do segmentu rynku."}
            </p>
            {tree && (
              <CareerTrajectorySummary
                stepsCount={stepsCount}
                totalSkills={tree.total_skills}
                bestMatch={tree.best_segment?.match_pct ?? 0}
                goalLabel={narrative?.goal_label}
              />
            )}
          </div>
          <div className="career-path-hero__actions">
            {(activeCareerPath.steps?.length ?? 0) > 0 && (
              <button type="button" className="btn-secondary" onClick={handleReset}>
                Resetuj ścieżkę
              </button>
            )}
            {!isVirtual && (
              <button type="button" className="btn-secondary" onClick={onEditProfile}>
                Edytuj profil
              </button>
            )}
          </div>
        </div>
      </header>

      {isVirtual && (
        <CareerVirtualBanner
          skillCount={activeSkills.length}
          onCopyFromReal={handleCopyFromReal}
          onResetVirtual={handleResetVirtual}
        />
      )}

      {error && (
        <div className="alert career-path-alert" role="alert">
          {error}
        </div>
      )}

      {loading && !tree && (
        <div className="loading career-path-loading panel">
          <div className="spinner" />
          <p>{LOADING_STEPS[loadingStep]}</p>
          <ul className="career-loading-steps">
            {LOADING_STEPS.map((step, i) => (
              <li
                key={step}
                className={i <= loadingStep ? "career-loading-steps__done" : ""}
              >
                {step}
              </li>
            ))}
          </ul>
        </div>
      )}

      {emptyProfile && !loading && tree && tree.branch_comparison.length === 0 && (
        <div className="career-empty panel">
          <h2>Wyobraź sobie swoją karierę</h2>
          <p>
            {isVirtual
              ? "Wybierz gałąź na mapie albo skopiuj swój profil — zobaczysz różnice między opcjami w tabeli na dole."
              : "Dodaj kompetencje w profilu albo wybierz pierwszą gałąź na mapie."}
          </p>
          {isVirtual ? (
            <button type="button" className="btn-primary" onClick={handleCopyFromReal}>
              Skopiuj z mojego profilu
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={onEditProfile}>
              Uzupełnij profil
            </button>
          )}
        </div>
      )}

      {tree && tree.next_level_readiness && (
        <NextLevelReadinessCard
          readiness={tree.next_level_readiness}
          segmentInsights={segmentInsights}
          insightsLoading={insightsLoading}
        />
      )}

      {tree && (
        <>
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
              segmentInsights={segmentInsights}
              insightsLoading={insightsLoading}
              takingBranch={takingBranch}
              onTakeBranch={handleTakeBranch}
            />
          </div>

          <CareerComparisonSection
            data={tree}
            segmentInsights={segmentInsights}
            insightsLoading={insightsLoading}
            selectedNode={selectedNode}
          />
        </>
      )}
    </div>
  );
}
