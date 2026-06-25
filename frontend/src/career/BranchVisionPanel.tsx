import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../api";
import { SegmentInsight, TreeBranchNode, UserProfile } from "../types";

const visionCache = new Map<string, string>();

function visionCacheKey(branchId: string, profileKey: string) {
  return `${branchId}|${profileKey}`;
}

function profileKeyFrom(profile: UserProfile) {
  const skills = (profile.hard_skills || []).map((s) => String(s.id)).join(",");
  const steps = JSON.stringify(profile.career_path?.steps || []);
  return `${skills}::${steps}`;
}

export function BranchVisionPanel({
  branch,
  profileForVision,
  insight,
}: {
  branch: TreeBranchNode;
  profileForVision: UserProfile;
  insight?: SegmentInsight;
}) {
  const cacheKey = visionCacheKey(branch.id, profileKeyFrom(profileForVision));
  const [content, setContent] = useState(() => visionCache.get(cacheKey) || "");
  const [loading, setLoading] = useState(!content);
  const [error, setError] = useState("");

  const loadVision = useCallback(
    async (force = false) => {
      if (!force && visionCache.has(cacheKey)) {
        setContent(visionCache.get(cacheKey)!);
        setLoading(false);
        setError("");
        return;
      }

      setLoading(true);
      setError("");

      try {
        const res = await api.getCareerBranchVision({
          branch: branch as unknown as Record<string, unknown>,
          profile_override: profileForVision as unknown as Record<string, unknown>,
          segment_insight: insight as unknown as Record<string, unknown> | undefined,
        });
        if (res.error && !res.content) {
          throw new Error(res.error);
        }
        const text = res.content || "";
        visionCache.set(cacheKey, text);
        setContent(text);
      } catch (e) {
        setError((e as Error).message || "Nie udało się wygenerować wizji.");
        setContent("");
      } finally {
        setLoading(false);
      }
    },
    [branch, profileForVision, insight, cacheKey]
  );

  useEffect(() => {
    void loadVision();
  }, [loadVision]);

  return (
    <div className="branch-vision-panel" aria-live="polite">
      <div className="branch-vision-panel__head">
        <div className="branch-vision-panel__title-wrap">
          <span className="branch-vision-panel__badge" aria-hidden>
            ✦
          </span>
          <div>
            <h4 className="branch-vision-panel__title">Wizja tej ścieżki</h4>
            <p className="branch-vision-panel__sub">
              Kursy i obraz kariery — generowane na żądanie dla tej gałęzi
            </p>
          </div>
        </div>
        <button
          type="button"
          className="branch-vision-panel__refresh"
          disabled={loading}
          onClick={() => void loadVision(true)}
          title="Wygeneruj ponownie"
        >
          {loading ? "…" : "↻"}
        </button>
      </div>

      {loading && (
        <div className="branch-vision-panel__loading">
          <div className="spinner spinner--sm" />
          <span>Generuję wizję i linki do kursów…</span>
        </div>
      )}

      {error && !loading && (
        <p className="branch-vision-panel__error">{error}</p>
      )}

      {content && !loading && (
        <div className="branch-vision-panel__body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      )}

      <p className="branch-vision-panel__footnote muted">
        Osobne od zakładki Doradca AI — krótka odpowiedź pod tę gałąź.
      </p>
    </div>
  );
}
