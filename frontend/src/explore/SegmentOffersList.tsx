import { Offer } from "../types";
import { OfferCard } from "../components/OfferCard";

interface SegmentOffersListProps {
  title: string;
  subtitle?: string;
  offers: Offer[];
  onSelectOffer: (id: string | number) => void;
  emptyHint?: string;
}

export function SegmentOffersList({
  title,
  subtitle,
  offers,
  onSelectOffer,
  emptyHint = "Dodaj kompetencje, aby zobaczyć najlepiej dopasowane oferty w segmencie.",
}: SegmentOffersListProps) {
  return (
    <section className="explore-card explore-card--offers">
      <h3>{title}</h3>
      {subtitle && <p className="muted explore-hint">{subtitle}</p>}
      {!offers.length ? (
        <p className="muted">{emptyHint}</p>
      ) : (
        <div className="offers-grid offers-grid--explore">
          {offers.map((o) => (
            <OfferCard key={o.offer_id} offer={o} onSelect={onSelectOffer} />
          ))}
        </div>
      )}
    </section>
  );
}
