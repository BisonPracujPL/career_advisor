import { Chip } from "../components/ui";
import {
  NextLevelReadiness,
  SegmentInsight,
  segmentInsightKey,
} from "../types";
import { formatPln, levelLabel, salaryAtLevel } from "./careerSalaryUtils";

export function NextLevelReadinessCard({
  readiness,
  segmentInsights,
  insightsLoading,
}: {
  readiness: NextLevelReadiness | null | undefined;
  segmentInsights: Record<string, SegmentInsight>;
  insightsLoading?: boolean;
}) {
  if (!readiness?.next_level) return null;

  const key = segmentInsightKey(
    readiness.lead_main_category,
    readiness.lead_sub_category
  );
  const insight = segmentInsights[key];
  const nowSalary = salaryAtLevel(insight, readiness.current_level);
  const nextSalary = salaryAtLevel(insight, readiness.next_level);
  const salaryDelta =
    nowSalary != null && nextSalary != null ? nextSalary - nowSalary : null;

  return (
    <section className="career-next-level panel">
      <header className="career-next-level__head">
        <p className="career-next-level__eyebrow">Gotowość na kolejny poziom</p>
        <h2>
          {levelLabel(readiness.current_level)} → {levelLabel(readiness.next_level)}
        </h2>
        <p>
          Segment <strong>{readiness.segment_label}</strong> — nie przewidujemy daty
          awansu, ale pokazujemy jak blisko jesteś ofert{" "}
          {levelLabel(readiness.next_level)} i co możesz zrobić.
        </p>
      </header>

      <div className="career-next-level__grid">
        <div className="career-next-level__metric">
          <span>Dopasowanie teraz</span>
          <strong>{readiness.match_now}%</strong>
        </div>
        <div className="career-next-level__metric">
          <span>Oferty {levelLabel(readiness.next_level)}</span>
          <strong>{readiness.match_target_level}%</strong>
        </div>
        <div className="career-next-level__metric career-next-level__metric--highlight">
          <span>Po pakiecie skilli</span>
          <strong>{readiness.match_after_bundle}%</strong>
          {readiness.bundle_delta > 0 && (
            <em>+{readiness.bundle_delta}%</em>
          )}
        </div>
        {insightsLoading && !insight ? (
          <div className="career-next-level__metric">
            <span>Widełki {levelLabel(readiness.next_level)}</span>
            <strong className="muted">Ładuję…</strong>
          </div>
        ) : (
          <div className="career-next-level__metric">
            <span>Mediana {levelLabel(readiness.next_level)}</span>
            <strong>{formatPln(nextSalary)}</strong>
            {salaryDelta != null && salaryDelta > 0 && (
              <em>+{formatPln(salaryDelta)} vs teraz</em>
            )}
          </div>
        )}
      </div>

      {readiness.missing_skills.length > 0 && (
        <div className="career-next-level__skills">
          <span>Brakuje do pełniejszego profilu {levelLabel(readiness.next_level)}:</span>
          <div className="chips-row">
            {readiness.missing_skills.map((s) => (
              <Chip key={s.id} label={s.name} variant="skill" />
            ))}
          </div>
          <p className="career-next-level__hint muted">
            Wybierz <strong>pakiet kompetencji</strong> na mapie — jeden krok dodaje cały
            zestaw i daje wyraźniejszy wzrost dopasowania niż pojedynczy skill.
          </p>
        </div>
      )}
    </section>
  );
}
