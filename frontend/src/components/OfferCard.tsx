
import { Offer } from '../types';
import { ScoreRing, Chip } from './ui';

interface OfferCardProps {
  offer: Offer;
}

export function OfferCard({ offer }: OfferCardProps) {
  const ov = offer.overlap;
  const matchPct = offer.similarity_pct ?? offer.display_pct ?? 0;
  const coveragePct = ov?.offer_coverage_pct ?? 0;
  return (
    <article className="offer-card">
      <div className="score-block">
        <ScoreRing pct={matchPct} />
        <span className="score-label">Dopasowanie</span>
      </div>
      <div className="offer-body">
        <h3>{offer.job_title}</h3>
        <p className="offer-meta">
          {[offer.lead_sub_category || offer.lead_main_category, offer.region_name]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {offer.position_levels?.length > 0 && (
          <p className="offer-level">{offer.position_levels[0]}</p>
        )}
        {ov && (
          <div className="offer-skills">
            <div className="skill-bar">
              <div
                className="skill-bar-fill skill-bar-fill--coverage"
                style={{ width: `${coveragePct}%` }}
              />
            </div>
            <p className="skill-summary">
              Pokrycie oferty: <strong>{coveragePct}%</strong> — spełniasz{" "}
              <strong>{ov.matched_count}</strong> z{" "}
              <strong>{ov.offer_skill_count}</strong> wymagań
              {ov.profile_skill_count > 0 && (
                <>
                  {" "}
                  (profil: {ov.profile_skill_count} kompetencji)
                </>
              )}
            </p>
            {ov.matched_skills.length > 0 && (
              <div className="chips-row">
                {ov.matched_skills.slice(0, 6).map((s) => (
                  <Chip key={s.id} label={s.name} variant="ok" />
                ))}
              </div>
            )}
            {ov.missing_skills.length > 0 && (
              <details className="gaps">
                <summary>Braki ({ov.missing_skills.length})</summary>
                <div className="chips-row">
                  {ov.missing_skills.slice(0, 10).map((s) => (
                    <Chip key={s.id} label={s.name} variant="miss" />
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
