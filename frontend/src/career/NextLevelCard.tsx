import { Chip } from "../components/ui";
import {
  NextLevelReadiness,
  SegmentInsight,
  segmentInsightKey,
} from "../types";
import {
  CAREER_LEVEL_THRESHOLDS_TEXT,
  formatExperienceDuration,
} from "../profileSkills";
import { formatPln, levelLabel, salaryAtLevel } from "./careerSalaryUtils";

export function NextLevelReadinessCard({
  readiness,
  segmentInsights,
  insightsLoading,
  experienceMonths,
}: {
  readiness: NextLevelReadiness | null | undefined;
  segmentInsights: Record<string, SegmentInsight>;
  insightsLoading?: boolean;
  experienceMonths?: number;
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
        <p className="career-next-level__level-source muted">
          Poziom startowy: <strong>{levelLabel(readiness.current_level)}</strong>
          {experienceMonths != null && experienceMonths > 0 ? (
            <> — na podstawie {formatExperienceDuration(experienceMonths)} doświadcia z profilu</>
          ) : (
            <> — brak doświadczenia w profilu, domyślnie Junior</>
          )}
          . Progi: {CAREER_LEVEL_THRESHOLDS_TEXT}.
        </p>
      </header>

      <div className="career-next-level__grid">
        <div className="career-next-level__metric">
          <span>Segment — wszystkie poziomy</span>
          <strong>{readiness.match_now}%</strong>
          <em className="career-next-level__metric-note">bez filtra Junior/Mid/Senior</em>
        </div>
        <div className="career-next-level__metric">
          <span>Teraz — oferty {levelLabel(readiness.next_level)}</span>
          <strong>{readiness.match_target_level}%</strong>
          <em className="career-next-level__metric-note">Twój obecny profil skilli</em>
        </div>
        <div className="career-next-level__metric career-next-level__metric--highlight">
          <span>Po pakiecie — oferty {levelLabel(readiness.next_level)}</span>
          <strong>{readiness.match_after_bundle}%</strong>
          {readiness.bundle_delta > 0 ? (
            <em>+{readiness.bundle_delta}% vs teraz ({levelLabel(readiness.next_level)})</em>
          ) : readiness.match_after_bundle < readiness.match_target_level ? (
            <em className="career-next-level__metric-note">
              pakiet nie podniósł dopasowania na tym poziomie
            </em>
          ) : null}
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
