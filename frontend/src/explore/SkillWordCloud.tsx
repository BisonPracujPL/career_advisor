interface SkillWordCloudProps {
  pngBase64?: string | null;
}

export function SkillWordCloud({ pngBase64 }: SkillWordCloudProps) {
  if (!pngBase64) {
    return <p className="muted">Brak danych do chmury kompetencji.</p>;
  }
  return (
    <div className="skill-wordcloud-wrap">
      <img
        src={`data:image/png;base64,${pngBase64}`}
        alt="Chmura kluczowych kompetencji w segmencie"
        className="skill-wordcloud-img"
      />
    </div>
  );
}
