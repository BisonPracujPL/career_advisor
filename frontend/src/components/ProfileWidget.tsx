
import { UserProfile } from '../types';

interface ProfileWidgetProps {
  data: UserProfile | null;
  onEdit: () => void;
  isDropdown?: boolean;
}

export function ProfileWidget({ data, onEdit, isDropdown }: ProfileWidgetProps) {
  if (!data) return null;
  return (
    <div className={isDropdown ? "" : "panel"} style={{ margin: isDropdown ? "0" : "1rem 2rem", background: isDropdown ? "transparent" : "var(--surface)", border: isDropdown ? "none" : "1px solid var(--border)", borderRadius: isDropdown ? "0" : "16px", padding: isDropdown ? "0.5rem" : "1.5rem" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0, fontSize: isDropdown ? '1.1rem' : '1.25rem' }}>Twój Profil Kariery</h3>
        <button type="button" className="btn-secondary" style={isDropdown ? { padding: '0.4rem 0.8rem', fontSize: '0.85rem' } : {}} onClick={onEdit}>Edytuj profil</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isDropdown ? 'repeat(4, minmax(180px, 1fr))' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
        <div>
          <h4 style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Doświadczenie</h4>
          {data.experience?.length ? (
            <ul style={{ paddingLeft: '1.2rem', margin: 0, fontSize: '0.9rem' }}>
              {data.experience.map((e, i) => <li key={i}>{e.job_title} ({e.company_name})</li>)}
            </ul>
          ) : <span className="muted" style={{ fontSize: '0.9rem' }}>Brak dodanego doświadczenia</span>}
        </div>
        <div>
          <h4 style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Wykształcenie</h4>
          {data.education?.length ? (
            <ul style={{ paddingLeft: '1.2rem', margin: 0, fontSize: '0.9rem' }}>
              {data.education.map((e, i) => <li key={i}>{e.degree_level} - {e.field_of_study}</li>)}
            </ul>
          ) : <span className="muted" style={{ fontSize: '0.9rem' }}>Brak dodanego wykształcenia</span>}
        </div>
        <div>
          <h4 style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Top Kompetencje</h4>
          {data.hard_skills?.length ? (
            <div className="chips-row">
              {data.hard_skills.slice(0, 5).map((s, i) => <span key={i} className="chip chip-skill" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>{s.name}</span>)}
            </div>
          ) : <span className="muted" style={{ fontSize: '0.9rem' }}>Brak dodanych kompetencji</span>}
        </div>
        <div>
          <h4 style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Języki & Branże</h4>
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>
            <strong>Języki:</strong> {data.languages?.map(l => l.name).join(", ") || "Brak"}
          </p>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            <strong>Branże:</strong> {data.interested_industries?.map(g => 
              typeof g === 'string' ? g : `${g.main} (${g.subs.includes('__ALL__') ? 'Cały obszar' : g.subs.length + ' spec.'})`
            ).join(", ") || "Brak"}
          </p>
        </div>
      </div>
    </div>
  );
}
