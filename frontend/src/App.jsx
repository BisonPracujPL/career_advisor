import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import Auth from "./Auth.jsx";
import UserProfileWizard from "./UserProfileWizard.jsx";

const MODES = [
  { id: "skills", label: "Profil kompetencji", icon: "◆" },
  { id: "job", label: "Podobne stanowisko", icon: "◇" },
];

function ScoreRing({ pct }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="score-ring" title={`Dopasowanie ${pct}%`}>
      <svg width="52" height="52" viewBox="0 0 52 52">
        <circle className="ring-bg" cx="26" cy="26" r={r} />
        <circle
          className="ring-fg"
          cx="26"
          cy="26"
          r={r}
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="score-num">{pct}%</span>
    </div>
  );
}

function MultiSelect({ label, placeholder, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const toggle = (id) => {
    onChange(
      selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
    );
  };

  const summary =
    selected.length === 0
      ? placeholder
      : options
          .filter((o) => selected.includes(o.id))
          .map((o) => o.label)
          .join(", ");

  return (
    <div className="field multi-select" ref={ref}>
      <span className="field-label">{label}</span>
      <button
        type="button"
        className={`multi-trigger ${open ? "open" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={selected.length ? "" : "placeholder"}>{summary}</span>
        <span className="chevron">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="multi-panel">
          {selected.length > 0 && (
            <button
              type="button"
              className="multi-clear"
              onClick={() => onChange([])}
            >
              Wyczyść wybór
            </button>
          )}
          {options.map((o) => (
            <label key={o.id} className="multi-option">
              <input
                type="checkbox"
                checked={selected.includes(o.id)}
                onChange={() => toggle(o.id)}
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function Collapse({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`collapse ${open ? "open" : ""}`}>
      <button type="button" className="collapse-head" onClick={() => setOpen((v) => !v)}>
        <span>{title}</span>
        <span className="chevron">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="collapse-body">{children}</div>}
    </section>
  );
}

function Chip({ label, onRemove, variant = "skill" }) {
  return (
    <span className={`chip chip-${variant}`}>
      {label}
      {onRemove && (
        <button type="button" className="chip-x" onClick={onRemove} aria-label="Usuń">
          ×
        </button>
      )}
    </span>
  );
}

function OfferCard({ offer }) {
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

function ProfileWidget({ data, onEdit, isDropdown }) {
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

function Navbar({ mode, setMode, isLoggedIn, setShowAuth, handleLogout, onProfileClick, hasProfile, profileData }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  return (
    <nav className="global-nav">
      <div className="global-nav-content">
        <div className="global-nav-left">
          <a href="#" className="global-nav-brand" onClick={(e) => { e.preventDefault(); setMode("skills"); }}>
            career advisor
          </a>
          <div className="global-nav-links">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`global-nav-link ${mode === m.id ? "active" : ""}`}
                onClick={() => setMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        
        <div className="global-nav-right">
          {!isLoggedIn ? (
            <button type="button" className="nav-user-btn" onClick={() => setShowAuth(true)}>
              <span className="nav-user-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              </span>
              Zaloguj się
            </button>
          ) : (
            <div className="nav-user-dropdown" ref={menuRef}>
              <button type="button" className="nav-user-btn" onClick={() => setMenuOpen(!menuOpen)}>
                <span className="nav-user-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </span>
                Moje konto <span style={{fontSize: '0.8em', marginLeft: '0.2rem'}}>{menuOpen ? '▲' : '▼'}</span>
              </button>
              
              {menuOpen && (
                <div className="nav-dropdown-menu">
                  <button type="button" className="nav-dropdown-item" onClick={() => { setMenuOpen(false); onProfileClick(); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    Mój profil
                  </button>
                  <hr style={{ margin: "0.25rem 0", border: "none", borderTop: "1px solid var(--border)" }} />
                  <button type="button" className="nav-dropdown-item" onClick={() => { setMenuOpen(false); handleLogout(); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    Wyloguj się
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  const [mode, setMode] = useState("skills");
  const [filterOpts, setFilterOpts] = useState(null);
  const [pillars, setPillars] = useState([]);
  const [segments, setSegments] = useState([]);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [filters, setFilters] = useState({
    market_pillar: "",
    lead_main_category: "",
    lead_sub_category: "",
    region_name: "",
    position_level_groups: [],
  });

  const [skillQuery, setSkillQuery] = useState("");
  const [skillHits, setSkillHits] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [categories, setCategories] = useState([]);
  const [mainCat, setMainCat] = useState("");
  const [subCats, setSubCats] = useState([]);
  const [subCat, setSubCat] = useState("");
  const [browseSkills, setBrowseSkills] = useState([]);

  const [jobQuery, setJobQuery] = useState("");
  const [jobHits, setJobHits] = useState([]);
  const [seedOffer, setSeedOffer] = useState(null);

  const [offers, setOffers] = useState([]);
  const [resultMeta, setResultMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem("auth_token"));
  const [showAuth, setShowAuth] = useState(!localStorage.getItem("auth_token"));
  const [hasProfile, setHasProfile] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [showProfileWizard, setShowProfileWizard] = useState(false);

  useEffect(() => {
    if (isLoggedIn) {
      api.getProfile().then((d) => {
        const hasData = !!d.profile_data && Object.keys(d.profile_data).length > 0;
        setHasProfile(hasData);
        if (hasData) {
          setProfileData(d.profile_data);
        }
      }).catch(() => {
        setIsLoggedIn(false);
        localStorage.removeItem("auth_token");
        setShowAuth(true);
      });
    }
  }, [isLoggedIn, showProfileWizard]);

  useEffect(() => {
    api
      .filterOptions()
      .then(setFilterOpts)
      .catch((e) => setError(e.message));
    api
      .marketPillars()
      .then((d) => setPillars(d.pillars || []))
      .catch(() => {});
    api
      .categories()
      .then((d) => setCategories(d.categories))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!filters.market_pillar) {
      setSegments([]);
      return;
    }
    setSegmentsLoading(true);
    api
      .pillarSegments(filters.market_pillar)
      .then((d) => setSegments(d.segments || []))
      .catch(() => setSegments([]))
      .finally(() => setSegmentsLoading(false));
  }, [filters.market_pillar]);

  useEffect(() => {
    if (!mainCat) {
      setSubCats([]);
      setSubCat("");
      return;
    }
    api.subcategories(mainCat).then((d) => setSubCats(d.subcategories));
    setSubCat("");
  }, [mainCat]);

  useEffect(() => {
    if (!mainCat && !subCat) {
      setBrowseSkills([]);
      return;
    }
    api.browseSkills(mainCat, subCat).then((d) => setBrowseSkills(d.results));
  }, [mainCat, subCat]);

  useEffect(() => {
    if (skillQuery.length < 2) {
      setSkillHits([]);
      return;
    }
    const t = setTimeout(() => {
      api
        .searchSkills(skillQuery)
        .then((d) => setSkillHits(d.results))
        .catch(() => setSkillHits([]));
    }, 280);
    return () => clearTimeout(t);
  }, [skillQuery]);

  useEffect(() => {
    if (jobQuery.length < 2) {
      setJobHits([]);
      return;
    }
    const t = setTimeout(() => {
      api
        .searchOffers(jobQuery)
        .then((d) => setJobHits(d.results))
        .catch(() => setJobHits([]));
    }, 280);
    return () => clearTimeout(t);
  }, [jobQuery]);

  const addSkill = useCallback((skill) => {
    setSelectedSkills((prev) =>
      prev.some((s) => s.id === skill.id) ? prev : [...prev, skill]
    );
    setSkillQuery("");
    setSkillHits([]);
  }, []);

  const selectPillar = (pillarId) => {
    setFilters((f) => ({
      ...f,
      market_pillar: f.market_pillar === pillarId ? "" : pillarId,
      lead_main_category: "",
      lead_sub_category: "",
    }));
  };

  const selectSegment = (seg) => {
    setFilters((f) => ({
      ...f,
      lead_main_category: seg.lead_main_category,
      lead_sub_category: seg.lead_sub_category,
    }));
  };

  const apiFilters = useCallback(() => {
    const f = {};
    if (filters.market_pillar) f.market_pillar = filters.market_pillar;
    if (filters.lead_main_category) f.lead_main_category = filters.lead_main_category;
    if (filters.lead_sub_category) f.lead_sub_category = filters.lead_sub_category;
    if (filters.region_name) f.region_name = filters.region_name;
    if (filters.position_level_groups.length)
      f.position_level_groups = filters.position_level_groups;
    return f;
  }, [filters]);

  const activePillar = pillars.find((p) => p.id === filters.market_pillar);
  const selectedSegmentLabel = segments.find(
    (s) =>
      s.lead_main_category === filters.lead_main_category &&
      s.lead_sub_category === filters.lead_sub_category
  )?.label;

  const runSkillMatch = async () => {
    if (selectedSkills.length === 0) {
      setError("Dodaj co najmniej jedną kompetencję do profilu.");
      return;
    }
    setError("");
    setLoading(true);
    setResultMeta(null);
    try {
      const data = await api.matchBySkills({
        skill_ids: selectedSkills.map((s) => s.id),
        filters: apiFilters(),
        limit: 24,
        min_similarity: 0,
      });
      setOffers(data.offers || []);
      setResultMeta({ count: data.count, mode: "skills" });
      if (!data.offers?.length) {
        setError(
          "Brak ofert dla tego profilu. Usuń filtry poziomu kariery lub dodaj więcej kompetencji."
        );
      } else {
        setError("");
      }
    } catch (e) {
      setError(e.message);
      setOffers([]);
    } finally {
      setLoading(false);
    }
  };

  const runJobMatch = async (offerId, seed) => {
    setError("");
    setLoading(true);
    setResultMeta(null);
    try {
      const data = await api.matchSimilar(offerId, apiFilters(), 24);
      setSeedOffer(data.seed || seed);
      setOffers(data.offers || []);
      setResultMeta({ count: data.count, mode: "job", seed: data.seed });
      if (!data.offers?.length) {
        setError("Brak podobnych ofert — spróbuj poluzować filtry.");
      } else {
        setError("");
      }
    } catch (e) {
      setError(e.message);
      setOffers([]);
    } finally {
      setLoading(false);
    }
  };

  const levelGroups = filterOpts?.position_level_groups || [];

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    setIsLoggedIn(false);
    setHasProfile(false);
    setShowProfileWizard(false);
  };

  const navProps = {
    mode, 
    setMode: (m) => {
      setMode(m);
      setOffers([]);
      setError("");
      setResultMeta(null);
      setShowProfileWizard(false);
    },
    isLoggedIn,
    setShowAuth,
    handleLogout,
    onProfileClick: () => setShowProfileWizard(true),
    hasProfile,
    profileData
  };

  if (showProfileWizard) {
    return (
      <>
        <Navbar {...navProps} />
        <UserProfileWizard
          onComplete={(data) => {
            setHasProfile(true);
            setShowProfileWizard(false);
          }}
          onCancel={() => setShowProfileWizard(false)}
        />
      </>
    );
  }

  return (
    <>
      <Navbar {...navProps} />
      <div className="app">

      {showAuth && (
        <Auth
          onAuthSuccess={() => {
            setShowAuth(false);
            setIsLoggedIn(true);
          }}
        />
      )}

      {isLoggedIn && !hasProfile && (
        <div className="alert" style={{ margin: "1rem 2rem", cursor: "pointer" }} onClick={() => setShowProfileWizard(true)}>
          Wypełnij formularz profilowy, abyśmy mogli polecić Ci lepsze oferty pracy. <strong>Kliknij tutaj.</strong>
        </div>
      )}



      <section className="market-hero panel">
        <h2 className="market-hero__title">Wybierz obszar rynku</h2>
        <p className="market-hero__sub">
          Wybierz obszar, potem zawęź do podkategorii z bazy ofert.
        </p>
        <div className="pillar-grid">
          {pillars.map((p) => (
            <button
              key={p.id}
              type="button"
              className={
                filters.market_pillar === p.id ? "pillar-card active" : "pillar-card"
              }
              onClick={() => selectPillar(p.id)}
            >
              <span className="pillar-card__label">{p.label}</span>
              <span className="pillar-card__desc">{p.description}</span>
              <span className="pillar-card__count">
                {p.offer_count.toLocaleString("pl-PL")} ofert
              </span>
            </button>
          ))}
        </div>

        <div className="filter-row">
          <label className="field">
            <span className="field-label">Województwo</span>
            <select
              className="input"
              value={filters.region_name}
              onChange={(e) =>
                setFilters((f) => ({ ...f, region_name: e.target.value }))
              }
            >
              <option value="">Cała Polska</option>
              {(filterOpts?.regions || []).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <div className="field">
            <MultiSelect
              label="Poziom stanowiska"
              placeholder="Dowolny poziom"
              options={levelGroups}
              selected={filters.position_level_groups}
              onChange={(ids) =>
                setFilters((f) => ({ ...f, position_level_groups: ids }))
              }
            />
          </div>
        </div>

        {filters.market_pillar && (
          <div className="segments-block">
            <div className="segments-head">
              <span>
                Podkategorie w: <strong>{activePillar?.label}</strong>
                {selectedSegmentLabel && (
                  <>
                    {" "}
                    → <em>{selectedSegmentLabel}</em>
                  </>
                )}
              </span>
              <button
                type="button"
                className="link-btn"
                onClick={() =>
                  setFilters((f) => ({
                    ...f,
                    lead_main_category: "",
                    lead_sub_category: "",
                  }))
                }
              >
                Wszystkie w obszarze
              </button>
            </div>
            {segmentsLoading ? (
              <p className="muted">Ładuję podkategorie…</p>
            ) : (
              <div className="segment-chips">
                {segments.map((seg) => {
                  const active =
                    seg.lead_main_category === filters.lead_main_category &&
                    seg.lead_sub_category === filters.lead_sub_category;
                  return (
                    <button
                      key={`${seg.lead_main_category}|${seg.lead_sub_category}`}
                      type="button"
                      className={active ? "segment-chip active" : "segment-chip"}
                      onClick={() => selectSegment(seg)}
                      title={seg.group_label}
                    >
                      {seg.label}
                      <span className="segment-chip__n">{seg.offer_count}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      <div className="workspace">
        <aside className="panel panel-side">
          <Collapse title="Branża — pełna lista z bazy" defaultOpen={false}>
            <label className="field">
              <span className="field-label">Konkretna branża (lead_main)</span>
              <select
                className="input"
                value={filters.lead_main_category}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    lead_main_category: e.target.value,
                    lead_sub_category: "",
                  }))
                }
              >
                <option value="">— z podkategorii powyżej lub wszystkie —</option>
                {(filterOpts?.lead_main_categories || []).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </Collapse>

          {mode === "skills" && (
            <Collapse title="Twój profil kompetencji" defaultOpen>
              <label className="field">
                <span className="field-label">Szukaj kompetencji</span>
                <input
                  type="search"
                  className="input"
                  placeholder="np. Python, SQL, Power BI…"
                  value={skillQuery}
                  onChange={(e) => setSkillQuery(e.target.value)}
                />
              </label>
              {skillHits.length > 0 && (
                <ul className="suggest">
                  {skillHits.map((s) => (
                    <li key={s.id}>
                      <button type="button" onClick={() => addSkill(s)}>
                        <span className="suggest-title">{s.name}</span>
                        <span className="suggest-sub">
                          {s.subcategory || s.main_category}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <Collapse title="Przeglądaj katalog LightCast" defaultOpen={false}>
                <select
                  className="input"
                  value={mainCat}
                  onChange={(e) => setMainCat(e.target.value)}
                >
                  <option value="">Obszar zawodowy…</option>
                  {categories.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {subCats.length > 0 && (
                  <select
                    className="input"
                    value={subCat}
                    onChange={(e) => setSubCat(e.target.value)}
                  >
                    <option value="">Specjalizacja…</option>
                    {subCats.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
                {browseSkills.length > 0 && (
                  <ul className="browse">
                    {browseSkills.slice(0, 12).map((s) => (
                      <li key={s.id}>
                        <button type="button" onClick={() => addSkill(s)}>
                          + {s.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Collapse>

              {selectedSkills.length > 0 && (
                <div className="profile-chips">
                  {selectedSkills.map((s) => (
                    <Chip
                      key={s.id}
                      label={s.name}
                      onRemove={() =>
                        setSelectedSkills((p) => p.filter((x) => x.id !== s.id))
                      }
                    />
                  ))}
                </div>
              )}

              <button
                type="button"
                className="btn-primary"
                disabled={loading || selectedSkills.length === 0}
                onClick={runSkillMatch}
              >
                {loading ? "Szukam dopasowań…" : "Dopasuj oferty pracy"}
              </button>
            </Collapse>
          )}

          {mode === "job" && (
            <Collapse title="Wzorzec stanowiska" defaultOpen>
              <label className="field">
                <span className="field-label">Tytuł oferty</span>
                <input
                  type="search"
                  className="input"
                  placeholder="np. Analityk danych, .NET Developer…"
                  value={jobQuery}
                  onChange={(e) => setJobQuery(e.target.value)}
                />
              </label>
              {jobHits.length > 0 && (
                <ul className="suggest">
                  {jobHits.map((o) => (
                    <li key={o.offer_id}>
                      <button
                        type="button"
                        onClick={() => runJobMatch(o.offer_id, o)}
                      >
                        <span className="suggest-title">{o.job_title}</span>
                        <span className="suggest-sub">
                          {o.lead_main_category} · {o.skill_count} kompetencji
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {seedOffer && (
                <div className="seed-badge">
                  Wzorzec: <strong>{seedOffer.job_title}</strong>
                </div>
              )}
            </Collapse>
          )}
        </aside>

        <main className="panel panel-main">
          <div className="results-head">
            <div>
              <h2>Rekomendowane oferty</h2>
              {resultMeta?.count > 0 && mode === "skills" && (
                <p className="results-sub muted">
                  Posortowane wg cosine na wektorach TF-IDF (rzadsze skille ważą
                  więcej). Pierścień = dopasowanie, pasek = pokrycie wymagań oferty.
                </p>
              )}
            </div>
            {resultMeta?.count > 0 && (
              <span className="badge-count">{resultMeta.count} wyników</span>
            )}
          </div>

          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}

          {loading && (
            <div className="loading">
              <div className="spinner" />
              <p>Przeszukuję bazę ofert…</p>
            </div>
          )}

          {!loading && offers.length === 0 && !error && (
            <div className="empty">
              <div className="empty-icon">◎</div>
              <h3>Zacznij od profilu lub wzorca</h3>
              <p>
                {mode === "skills"
                  ? "Wybierz kompetencje i kliknij „Dopasuj oferty pracy”."
                  : "Wyszukaj tytuł stanowiska i wybierz ofertę z listy."}
              </p>
            </div>
          )}

          <div className="offers-grid">
            {offers.map((o) => (
              <OfferCard key={o.offer_id} offer={o} />
            ))}
          </div>
        </main>
      </div>
    </div>
    </>
  );
}
