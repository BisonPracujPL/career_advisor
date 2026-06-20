import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import Auth from "./Auth";
import UserProfileWizard from "./UserProfileWizard";
import { Navbar } from "./components/Navbar";
import { MultiSelect, Collapse, Chip } from "./components/ui";
import { OfferCard } from "./components/OfferCard";
import { ChatAdvisor } from "./components/ChatAdvisor";
import { Filters, Skill, Offer, UserProfile } from "./types";

export default function App() {
  const [mode, setMode] = useState("skills");
  const [filterOpts, setFilterOpts] = useState<any>(null);
  const [pillars, setPillars] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    market_pillar: "",
    lead_main_category: "",
    lead_sub_category: "",
    region_name: "",
    position_level_groups: [],
  });

  const [skillQuery, setSkillQuery] = useState("");
  const [skillHits, setSkillHits] = useState<any[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<Skill[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [mainCat, setMainCat] = useState("");
  const [subCats, setSubCats] = useState<any[]>([]);
  const [subCat, setSubCat] = useState("");
  const [browseSkills, setBrowseSkills] = useState<any[]>([]);

  const [jobQuery, setJobQuery] = useState("");
  const [jobHits, setJobHits] = useState<any[]>([]);
  const [seedOffer, setSeedOffer] = useState<any>(null);

  const [offers, setOffers] = useState<Offer[]>([]);
  const [resultMeta, setResultMeta] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem("auth_token"));
  const [, setShowAuth] = useState(!localStorage.getItem("auth_token"));
  const [hasProfile, setHasProfile] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [showProfileWizard, setShowProfileWizard] = useState(false);

  useEffect(() => {
    if (isLoggedIn) {
      setIsProfileLoading(true);
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
      }).finally(() => {
        setIsProfileLoading(false);
      });
    } else {
      setHasProfile(false);
      setIsProfileLoading(false);
    }
  }, [isLoggedIn, showProfileWizard]);

  useEffect(() => {
    if (!isLoggedIn) return;
    setError("");
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
  }, [isLoggedIn]);

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

  const addSkill = useCallback((skill: Skill) => {
    setSelectedSkills((prev) =>
      prev.some((s) => s.id === skill.id) ? prev : [...prev, skill]
    );
    setSkillQuery("");
    setSkillHits([]);
  }, []);

  const selectPillar = (pillarId: string) => {
    setFilters((f) => ({
      ...f,
      market_pillar: f.market_pillar === pillarId ? "" : pillarId,
      lead_main_category: "",
      lead_sub_category: "",
    }));
  };

  const selectSegment = (seg: any) => {
    setFilters((f) => ({
      ...f,
      lead_main_category: seg.lead_main_category,
      lead_sub_category: seg.lead_sub_category,
    }));
  };

  const apiFilters = useCallback(() => {
    const f: any = {};
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
      setError((e as Error).message);
      setOffers([]);
    } finally {
      setLoading(false);
    }
  };

  const runJobMatch = async (offerId: string | number, seed: any) => {
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
      setError((e as Error).message);
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
    setShowAuth(true);
  };

  const navProps = {
    mode, 
    setMode: (m: string) => {
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
          onComplete={() => {
            setHasProfile(true);
            setShowProfileWizard(false);
          }}
          onCancel={() => setShowProfileWizard(false)}
        />
      </>
    );
  }

  if (!isLoggedIn) {
    return (
      <>
        <Navbar {...navProps} />
        <div className="app" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
          <Auth
            onAuthSuccess={() => {
              setShowAuth(false);
              setIsLoggedIn(true);
            }}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar {...navProps} />

      {mode === "chat" ? (
        <div className="chat-page-outer">
          <ChatAdvisor />
        </div>
      ) : (
        <div className="app">
          {!isProfileLoading && isLoggedIn && !hasProfile && (
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
                  {(filterOpts?.regions || []).map((r: string) => (
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
                    {(filterOpts?.lead_main_categories || []).map((c: string) => (
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
                      {jobHits.map((o: any) => (
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
                {offers.map((o: any) => (
                  <OfferCard key={o.offer_id} offer={o} />
                ))}
              </div>
            </main>
          </div>
        </div>
      )}
    </>
  );
}
