import { MultiSelect } from "../components/ui";
import { SegmentAnalytics, Skill } from "../types";
import { SkillMetricsBar } from "./SkillMetricsBar";
import { SkillWordCloud } from "./SkillWordCloud";
import { SegmentOffersList } from "./SegmentOffersList";
import { SegmentLevelCharts } from "./SegmentLevelCharts";
import { ExploreBackButton } from "./ExploreBackButton";
import { segmentDisplayLabel } from "./pillar";

interface SegmentFilters {
  region_name: string;
  position_level_groups: string[];
}

interface SegmentAnalyticsViewProps {
  data: SegmentAnalytics;
  selectedSkills: Skill[];
  filtersDraft: SegmentFilters;
  filtersApplied: SegmentFilters;
  levelGroups: { id: string; label: string }[];
  regions: string[];
  filtersDirty: boolean;
  onFiltersDraftChange: (filters: SegmentFilters) => void;
  onApplyFilters: () => void;
  onAddSkill: (skill: Skill) => void;
  onRemoveSkill: (skillId: string) => void;
  onBack: () => void;
  onOpenOffer: (offerId: number | string) => void;
}

export function SegmentAnalyticsView({
  data,
  selectedSkills,
  filtersDraft,
  filtersApplied,
  levelGroups,
  regions,
  filtersDirty,
  onFiltersDraftChange,
  onApplyFilters,
  onAddSkill,
  onRemoveSkill,
  onBack,
  onOpenOffer,
}: SegmentAnalyticsViewProps) {
  const fit = data.skill_fit;
  const match = data.match_score;
  const selectedIds = new Set(selectedSkills.map((s) => String(s.id)));
  const displayLabel =
    data.display_label ||
    segmentDisplayLabel(data.lead_main_category, data.lead_sub_category);
  const levelRows = data.level_snapshot || [];

  return (
    <div className="explore-view explore-view--page">
      <div className="explore-nav">
        <ExploreBackButton onClick={onBack} />
      </div>

      <header className="explore-hero explore-hero--center">
        <h1>{displayLabel}</h1>
        <p className="muted explore-meta">
          {data.offer_count.toLocaleString("pl-PL")} ofert po filtrach
          {filtersApplied.region_name ? ` · ${filtersApplied.region_name}` : ""}
        </p>
      </header>

      <section className="explore-card explore-card--cloud explore-card--cloud-center">
        <h3 className="text-center">Chmura kluczowych kompetencji</h3>
        <SkillWordCloud pngBase64={data.skills_wordcloud_png} />
      </section>

      <section className="explore-card explore-card--filters-block">
        <h3>Filtry</h3>
        <div className="filter-row filter-row--segment">
          <label className="field">
            <span className="field-label">Województwo</span>
            <select
              className="input"
              value={filtersDraft.region_name}
              onChange={(e) =>
                onFiltersDraftChange({ ...filtersDraft, region_name: e.target.value })
              }
            >
              <option value="">Cała Polska</option>
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <div>
            <MultiSelect
              label="Poziom stanowiska"
              placeholder="Dowolny poziom"
              options={levelGroups}
              selected={filtersDraft.position_level_groups}
              onChange={(ids) =>
                onFiltersDraftChange({ ...filtersDraft, position_level_groups: ids })
              }
            />
          </div>
          <div className="field field--apply">
            <span className="field-label">&nbsp;</span>
            <button
              type="button"
              className="btn-primary btn-apply-filters"
              onClick={onApplyFilters}
              disabled={!filtersDirty}
            >
              Zastosuj filtry
            </button>
          </div>
        </div>
      </section>

      <section className="explore-card">
        <h3>Stanowiska w segmencie</h3>
        <p className="muted explore-hint">
          Statystyki dla ofert spełniających wybrane filtry regionu i poziomu. Oferty na dole
          listy również respektują te filtry.
        </p>
        <SegmentLevelCharts
          rows={levelRows}
          hourlyToMonthlyHours={data.salary_normalization?.hourly_to_monthly_hours}
        />
      </section>

      <section className="explore-card explore-card--match">
        <h3>Dopasowanie</h3>
        <p className="muted explore-hint">
          Symuluj profil na top 20 kompetencjach segmentu. Średnie dopasowanie liczymy z 20
          najlepiej pasujących ofert (TF-IDF cosine) — czasem % może spaść po dodaniu skilli,
          jeśli nowy skill jest rzadszy w segmencie lub zmienia kierunek wektora profilu.
          Procent przy każdej kompetencji to odsetek ofert w segmencie, które jej wymagają.
        </p>
        <SkillMetricsBar
          matchLabel="śr. dopasowanie w segmencie"
          matchPct={match?.avg_similarity_pct ?? null}
        />
        <div className="match-cols">
          <div className="match-col match-col--ok">
            <h4>Spełniasz</h4>
            {fit.have.length ? (
              <div className="suggestion-chips suggestion-chips--scroll">
                {fit.have.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="suggestion-chip suggestion-chip--ok"
                    onClick={() => onRemoveSkill(s.id)}
                    title={`Wymaga tego ${s.pct_of_segment}% ofert w segmencie`}
                  >
                    ✗ {s.name}
                    <span className="suggestion-chip__pct suggestion-chip__pct--ok">
                      {s.pct_of_segment}%
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted match-empty">Brak — dodaj z „Brakuje”.</p>
            )}
          </div>
          <div className="match-col match-col--miss">
            <h4>Brakuje</h4>
            {fit.missing.length ? (
              <div className="suggestion-chips suggestion-chips--scroll">
                {fit.missing.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="suggestion-chip suggestion-chip--miss"
                    disabled={selectedIds.has(s.id)}
                    onClick={() => onAddSkill({ id: s.id, name: s.name })}
                    title={`Wymaga tego ${s.pct_of_segment}% ofert w segmencie`}
                  >
                    + {s.name}
                    <span className="suggestion-chip__n">{s.pct_of_segment}%</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted match-empty">Masz top kompetencje segmentu.</p>
            )}
          </div>
        </div>
      </section>

      <SegmentOffersList
        title="Najlepiej dopasowane oferty"
        subtitle={`Twój profil skilli w segmencie ${displayLabel}, z uwzględnieniem filtrów regionu i poziomu.`}
        offers={data.sample_offers}
        onSelectOffer={onOpenOffer}
        emptyHint="Dodaj kompetencje w sekcji Dopasowanie, aby zobaczyć ranking ofert."
      />
    </div>
  );
}
