import { OfferDetail, SegmentKey, Skill } from "../types";
import { OfferMatchPanel } from "./OfferMatchPanel";
import { SegmentOffersList } from "./SegmentOffersList";
import { ExploreBackButton } from "./ExploreBackButton";
import { SegmentAnalysisButton } from "./SegmentAnalysisButton";
import { segmentDisplayLabel } from "./pillar";

interface OfferDetailViewProps {
  detail: OfferDetail;
  selectedSkills: Skill[];
  onAddSkill: (skill: Skill) => void;
  onRemoveSkill: (skillId: string) => void;
  onBack: () => void;
  onOpenSegment: (segment: SegmentKey) => void;
  onOpenOffer: (offerId: number | string) => void;
}

function formatSalary(block: OfferDetail["salary_uop"]) {
  if (!block) return null;
  const from = block.from?.toLocaleString("pl-PL");
  const to = block.to?.toLocaleString("pl-PL") ?? from;
  return `${from} – ${to} ${block.currency} (${block.duration || "brutto"})`;
}

function TextBlock({ title, text }: { title: string; text: string }) {
  if (!text.trim()) return null;
  return (
    <article className="prose-block">
      <h4>{title}</h4>
      <p>{text}</p>
    </article>
  );
}

export function OfferDetailView({
  detail,
  selectedSkills,
  onAddSkill,
  onRemoveSkill,
  onBack,
  onOpenSegment,
  onOpenOffer,
}: OfferDetailViewProps) {
  const ov = detail.overlap;
  const uop = formatSalary(detail.salary_uop);
  const b2b = formatSalary(detail.salary_b2b);
  const selectedIds = new Set(selectedSkills.map((s) => String(s.id)));
  const segmentLabel =
    detail.segment_display_label ||
    segmentDisplayLabel(detail.lead_main_category, detail.lead_sub_category);

  const probTotal = detail.skills.reduce((sum, s) => sum + (s.probability ?? 0), 0);
  const skillWeightPct = (probability?: number) => {
    if (probability == null || probability <= 0 || probTotal <= 0) return null;
    return Math.max(1, Math.round((probability / probTotal) * 100));
  };

  const have = detail.skills
    .filter((s) => selectedIds.has(String(s.id)))
    .map((s) => ({
      id: String(s.id),
      name: s.name,
      weightPct: skillWeightPct(s.probability),
    }));
  const missing = detail.skills
    .filter((s) => !selectedIds.has(String(s.id)))
    .map((s) => ({
      id: String(s.id),
      name: s.name,
      weightPct: skillWeightPct(s.probability),
    }));

  return (
    <div className="explore-view explore-view--page">
      <div className="explore-nav">
        <ExploreBackButton label="Wróć do wyników" onClick={onBack} />
      </div>

      <header className="explore-hero explore-hero--with-cta">
        <p className="explore-breadcrumb">{segmentLabel}</p>
        <h1>{detail.job_title}</h1>
        <p className="muted explore-meta">{detail.region_name || "Polska"}</p>
        {detail.segment.lead_sub_category && (
          <SegmentAnalysisButton
            label={`Analiza segmentu: ${segmentLabel}`}
            onClick={() => onOpenSegment(detail.segment)}
          />
        )}
      </header>

      <section className="explore-card">
        <h3>Szczegóły</h3>
        <dl className="detail-dl detail-dl--wide">
          <div>
            <dt>Region</dt>
            <dd>{detail.region_name || "—"}</dd>
          </div>
          <div>
            <dt>Tryb pracy</dt>
            <dd>{detail.work_modes.join(", ") || "—"}</dd>
          </div>
          <div>
            <dt>Grafik</dt>
            <dd>{detail.work_schedules.join(", ") || "—"}</dd>
          </div>
          <div>
            <dt>Poziom</dt>
            <dd>{detail.position_levels.join(", ") || "—"}</dd>
          </div>
          <div>
            <dt>Umowa</dt>
            <dd>{detail.type_of_contract.join(", ") || "—"}</dd>
          </div>
          <div>
            <dt>Zdalnie</dt>
            <dd>
              {detail.is_remote_work === true
                ? "Tak"
                : detail.is_remote_work === false
                  ? "Nie"
                  : "—"}
            </dd>
          </div>
        </dl>
        <h4 className="explore-subhead">Wynagrodzenie</h4>
        {uop && (
          <p className="salbox">
            UoP: <strong>{uop}</strong>
          </p>
        )}
        {b2b && (
          <p className="salbox">
            B2B: <strong>{b2b}</strong>
          </p>
        )}
        {!uop && !b2b && <p className="muted">Brak widełek w danych.</p>}
      </section>

      <OfferMatchPanel
        matchPct={detail.similarity_pct ?? ov?.cosine_estimate_pct ?? null}
        coveragePct={ov?.offer_coverage_pct ?? null}
        have={have}
        missing={missing}
        onAdd={(s) => onAddSkill({ id: s.id, name: s.name })}
        onRemove={onRemoveSkill}
      />

      <section className="explore-card explore-card--prose">
        <h3>Pełna treść oferty</h3>
        <TextBlock title="Wymagania" text={detail.requirements_expected} />
        <TextBlock title="Wymagania opcjonalne" text={detail.requirements_optional} />
        <TextBlock title="Obowiązki" text={detail.responsibilities} />
        <TextBlock title="Technologie" text={detail.technologies_expected} />
        {!detail.requirements_expected &&
          !detail.requirements_optional &&
          !detail.responsibilities &&
          !detail.technologies_expected && (
            <p className="muted">Brak opisu tekstowego w danych.</p>
          )}
      </section>

      {detail.similar_offers && detail.similar_offers.length > 0 && (
        <SegmentOffersList
          title="Podobne stanowiska w segmencie"
          subtitle="Lista wg podobieństwa profilu tej oferty; karty posortowane wg dopasowania Twojego profilu skilli."
          offers={detail.similar_offers}
          onSelectOffer={onOpenOffer}
        />
      )}
    </div>
  );
}
