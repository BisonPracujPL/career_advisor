import { SkillMetricsBar } from "./SkillMetricsBar";

export interface MatchSkill {
  id: string;
  name: string;
  /** Udział kompetencji w profilu wymagań oferty (0–100). */
  weightPct?: number | null;
}

interface OfferMatchPanelProps {
  matchPct?: number | null;
  coveragePct?: number | null;
  have: MatchSkill[];
  missing: MatchSkill[];
  onAdd: (skill: MatchSkill) => void;
  onRemove: (skillId: string) => void;
}

function SkillChip({
  skill,
  variant,
  action,
  onClick,
}: {
  skill: MatchSkill;
  variant: "ok" | "miss";
  action: string;
  onClick: () => void;
}) {
  const pctClass =
    variant === "ok" ? "suggestion-chip__pct suggestion-chip__pct--ok" : "suggestion-chip__n";
  return (
    <button
      type="button"
      className={`suggestion-chip suggestion-chip--${variant}`}
      onClick={onClick}
      title={
        skill.weightPct != null
          ? `Udział w wymaganiach oferty: ${skill.weightPct}%`
          : undefined
      }
    >
      {action} {skill.name}
      {skill.weightPct != null && skill.weightPct > 0 && (
        <span className={pctClass}>{skill.weightPct}%</span>
      )}
    </button>
  );
}

export function OfferMatchPanel({
  matchPct,
  coveragePct,
  have,
  missing,
  onAdd,
  onRemove,
}: OfferMatchPanelProps) {
  return (
    <section className="explore-card explore-card--match">
      <h3>Dopasowanie</h3>
      <p className="muted explore-hint">
        Kliknij kompetencje z tej oferty — dodaj z „Brakuje” lub usuń z „Spełniasz”. Procent przy
        skillu to udział w profilu wymagań oferty (znormalizowany).
      </p>
      <SkillMetricsBar
        matchLabel="dopasowanie do oferty"
        matchPct={matchPct}
        coveragePct={coveragePct}
      />
      <div className="match-cols">
        <div className="match-col match-col--ok">
          <h4>Spełniasz</h4>
          {have.length ? (
            <div className="suggestion-chips">
              {have.map((s) => (
                <SkillChip
                  key={s.id}
                  skill={s}
                  variant="ok"
                  action="✗"
                  onClick={() => onRemove(s.id)}
                />
              ))}
            </div>
          ) : (
            <p className="muted match-empty">Dodaj kompetencje z listy „Brakuje”.</p>
          )}
        </div>
        <div className="match-col match-col--miss">
          <h4>Brakuje</h4>
          {missing.length ? (
            <div className="suggestion-chips">
              {missing.map((s) => (
                <SkillChip
                  key={s.id}
                  skill={s}
                  variant="miss"
                  action="+"
                  onClick={() => onAdd(s)}
                />
              ))}
            </div>
          ) : (
            <p className="muted match-empty">Masz wszystkie kompetencje z tej oferty.</p>
          )}
        </div>
      </div>
    </section>
  );
}
