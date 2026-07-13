import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Skill } from "../types";

export function SkillsProfileEditor({ data, onChange }: { data: Skill[], onChange: (d: Skill[]) => void }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<any[]>([]);

  // Browsing states
  const [viewMode, setViewMode] = useState('search');
  const [categories, setCategories] = useState<any[]>([]);
  const [mainCode, setMainCode] = useState("");
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [subCode, setSubCode] = useState("");
  const [browseHits, setBrowseHits] = useState<any[]>([]);
  const [recommendedSkills, setRecommendedSkills] = useState<any[]>([]);

  // Collapse states for selected skills
  const [expandedMainCats, setExpandedMainCats] = useState<Record<string, boolean>>({});
  const [expandedSubCats, setExpandedSubCats] = useState<Record<string, boolean>>({});

  const toggleMainCat = (cat: string) => setExpandedMainCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  const toggleSubCat = (sub: string) => setExpandedSubCats(prev => ({ ...prev, [sub]: !prev[sub] }));

  // Fetch categories on mount
  useEffect(() => {
    api.categories().then(d => setCategories(d.categories || [])).catch(() => { });
  }, []);

  // Fetch subcategories when mainCode changes
  useEffect(() => {
    if (mainCode) {
      setSubCode("");
      setBrowseHits([]);
      api.subcategories(mainCode).then(d => setSubcategories(d.subcategories || [])).catch(() => { });
    } else {
      setSubcategories([]);
      setBrowseHits([]);
    }
  }, [mainCode]);

  // Fetch browse skills when subCode changes
  useEffect(() => {
    if (subCode) {
      api.browseSkills(mainCode, subCode).then(d => setBrowseHits(d.results || [])).catch(() => { });
    } else {
      setBrowseHits([]);
    }
  }, [subCode, mainCode]);

  const fetchRecommendations = () => {
    const currentNames = data.map(s => s.name);
    api.recommendSkills(currentNames).then(d => setRecommendedSkills(d.results || [])).catch(() => { });
  };

  useEffect(() => {
    fetchRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      api.searchSkills(query)
        .then((d) => setHits(d.results || []))
        .catch(() => setHits([]));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const addSkill = (skillObj: any) => {
    if (!data.find((s) => s.name === skillObj.name)) {
      onChange([...data, {
        id: skillObj.id,
        name: skillObj.name,
        main_category: skillObj.main_category || "Inne",
        subcategory: skillObj.subcategory || "Ogólne"
      }]);
    }
    setQuery("");
    setHits([]);
  };

  const removeSkill = (name: string) => {
    onChange(data.filter((s) => s.name !== name));
  };

  const removeSubCategory = (mainCat: string, subCat: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(data.filter(s => !((s.main_category || "Inne") === mainCat && (s.subcategory || "Ogólne") === subCat)));
  };

  const groupedSkills = useMemo(() => {
    const groups: Record<string, Record<string, Skill[]>> = {};
    data.forEach(skill => {
      const main = skill.main_category || "Inne";
      const sub = skill.subcategory || "Ogólne";
      if (!groups[main]) groups[main] = {};
      if (!groups[main][sub]) groups[main][sub] = [];
      groups[main][sub].push(skill);
    });
    return groups;
  }, [data]);

  return (
    <>
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <button
            type="button"
            className={`chip ${viewMode === 'search' ? 'chip-skill' : ''}`}
            onClick={() => setViewMode('search')}
            style={{ padding: "0.5rem 1.25rem", border: viewMode === 'search' ? "1px solid var(--accent)" : "1px solid var(--border)", background: viewMode === 'search' ? "var(--accent-soft)" : "transparent", color: viewMode === 'search' ? "var(--accent)" : "var(--muted)", fontWeight: 600, borderRadius: "10px", cursor: "pointer", transition: "all 0.15s ease" }}
          >
            Wyszukaj
          </button>
          <button
            type="button"
            className={`chip ${viewMode === 'browse' ? 'chip-skill' : ''}`}
            onClick={() => setViewMode('browse')}
            style={{ padding: "0.5rem 1.25rem", border: viewMode === 'browse' ? "1px solid var(--accent)" : "1px solid var(--border)", background: viewMode === 'browse' ? "var(--accent-soft)" : "transparent", color: viewMode === 'browse' ? "var(--accent)" : "var(--muted)", fontWeight: 600, borderRadius: "10px", cursor: "pointer", transition: "all 0.15s ease" }}
          >
            Z katalogu
          </button>
          <button
            type="button"
            className={`chip ${viewMode === 'recommend' ? 'chip-skill' : ''}`}
            onClick={() => setViewMode('recommend')}
            style={{ padding: "0.5rem 1.25rem", border: viewMode === 'recommend' ? "1px solid var(--accent)" : "1px solid var(--border)", background: viewMode === 'recommend' ? "var(--accent-soft)" : "transparent", color: viewMode === 'recommend' ? "var(--accent)" : "var(--muted)", fontWeight: 600, borderRadius: "10px", cursor: "pointer", transition: "all 0.15s ease" }}
          >
            Polecane dla Ciebie
          </button>
        </div>

        {viewMode === 'search' && (
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="field-label">Wyszukaj i dodaj kompetencje</span>
            <input
              type="search"
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="np. Python, SQL, Project Management..."
              style={{ fontSize: '1.1rem', padding: '0.75rem 1rem' }}
            />
          </label>
        )}

        {viewMode === 'browse' && (
          <div style={{ display: "flex", gap: "1rem", flexDirection: "column", padding: "1rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px" }}>
            <div style={{ display: "flex", gap: "1rem" }}>
              <label className="field" style={{ flex: 1, marginBottom: 0 }}>
                <span className="field-label" style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.02em" }}>Kategoria główna</span>
                <select className="input" style={{ cursor: "pointer" }} value={mainCode} onChange={e => setMainCode(e.target.value)}>
                  <option value="">Wybierz kategorię...</option>
                  {categories.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </label>
              {mainCode && (
                <label className="field" style={{ flex: 1, marginBottom: 0 }}>
                  <span className="field-label" style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.02em" }}>Podkategoria</span>
                  <select className="input" style={{ cursor: "pointer" }} value={subCode} onChange={e => setSubCode(e.target.value)}>
                    <option value="">Wybierz podkategorię...</option>
                    {subcategories.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
                  </select>
                </label>
              )}
            </div>

            {browseHits.length > 0 && (
              <div style={{ marginTop: "0.5rem" }}>
                <h5 style={{ fontSize: "0.9rem", color: "var(--text)", margin: "0 0 0.75rem", fontWeight: 600 }}>Dostępne kompetencje</h5>
                <div className="profile-chips" style={{ gap: "0.5rem", maxHeight: "250px", overflowY: "auto", paddingRight: "0.5rem" }}>
                  {browseHits.map(s => {
                    const isSelected = data.some(existing => existing.name === s.name);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className={`chip ${isSelected ? 'chip-skill' : ''}`}
                        onClick={() => isSelected ? removeSkill(s.name) : addSkill(s)}
                        style={{
                          padding: "0.4rem 0.8rem",
                          border: isSelected ? "1px solid var(--accent)" : "1px solid var(--border)",
                          background: isSelected ? "var(--accent-soft)" : "#fff",
                          color: isSelected ? "var(--accent)" : "var(--text)",
                          cursor: "pointer",
                          fontWeight: isSelected ? 600 : 500,
                          transition: "all 0.15s ease"
                        }}
                      >
                        {s.name} {isSelected && <span style={{ marginLeft: "0.25rem" }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {viewMode === 'recommend' && recommendedSkills.length > 0 && (
          <div style={{ padding: "1.25rem", background: "var(--surface)", border: "1px solid var(--accent-glow)", borderRadius: "12px", boxShadow: "0 2px 12px rgba(26,95,214,0.03)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.1rem" }}>✨</span>
                <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--accent)" }}>Specjalnie dla Ciebie</h4>
              </div>
              <button
                type="button"
                className="btn-text"
                onClick={fetchRecommendations}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                Pokaż inne
              </button>
            </div>
            <div className="profile-chips" style={{ gap: "0.6rem", display: "flex", flexWrap: "wrap" }}>
              {recommendedSkills.slice(0, 6).map(s => {
                const isSelected = data.some(existing => existing.name === s.name);
                return (
                  <button
                    key={`rec-${s.id}`}
                    type="button"
                    className={`chip ${isSelected ? 'chip-skill' : 'chip-recommend'}`}
                    onClick={() => isSelected ? removeSkill(s.name) : addSkill(s)}
                    title={isSelected ? "Usuń" : "Dodaj"}
                    style={{
                      padding: "0.4rem 0.8rem",
                      border: isSelected ? "1px solid var(--accent)" : undefined,
                      transition: "all 0.15s ease",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem"
                    }}
                  >
                    {!isSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>}
                    {s.name}
                    {isSelected && <span style={{ marginLeft: "0.1rem" }}>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === 'recommend' && recommendedSkills.length === 0 && (
          <div style={{ padding: "2rem 1.5rem", background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: "12px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ background: "var(--accent-soft)", width: "48px", height: "48px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", marginBottom: "0.25rem" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            </div>
            <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 600, color: "var(--text)" }}>Brak rekomendacji</h4>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--muted)", maxWidth: "320px", lineHeight: "1.5" }}>Dodaj pierwsze kompetencje, abyśmy mogli lepiej dopasować i zaproponować kolejne umiejętności do Twojego profilu.</p>
          </div>
        )}

        {viewMode === 'search' && hits.length > 0 && (
          <ul
            className="suggest"
            style={{ maxHeight: "360px", marginTop: "0.5rem", overflowY: "auto" }}
          >
            {hits.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => addSkill(s)}>
                  {s.name} <span className="suggest-sub">{s.main_category}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {data.length > 0 && (
        <div style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
          <h4 style={{ margin: "0 0 1.5rem 0", color: "var(--text)", fontSize: "1.2rem", fontWeight: 700 }}>Twoje kompetencje</h4>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {Object.keys(groupedSkills).sort().map(mainCat => {
              const mainCatCount = Object.values(groupedSkills[mainCat]).flat().length;
              const isMainExpanded = expandedMainCats[mainCat];

              return (
                <div key={mainCat} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", boxShadow: "0 2px 8px rgba(15,28,52,0.02)", overflow: "hidden" }}>
                  <button
                    type="button"
                    onClick={() => toggleMainCat(mainCat)}
                    style={{ width: "100%", padding: "1rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", background: isMainExpanded ? "#f8fafc" : "transparent", border: "none", borderBottom: isMainExpanded ? "1px solid var(--border)" : "none", cursor: "pointer", textAlign: "left", transition: "all 0.15s ease" }}
                  >
                    <span style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text)" }}>{mainCat}</span>
                    <span style={{ background: "var(--accent-soft)", color: "var(--accent)", padding: "0.2rem 0.6rem", borderRadius: "8px", fontSize: "0.85rem", fontWeight: 700 }}>
                      {mainCatCount} {mainCatCount === 1 ? 'kompetencja' : (mainCatCount % 10 >= 2 && mainCatCount % 10 <= 4 && (mainCatCount % 100 < 10 || mainCatCount % 100 >= 20)) ? 'kompetencje' : 'kompetencji'}
                    </span>
                  </button>

                  {isMainExpanded && (
                    <div style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {Object.keys(groupedSkills[mainCat]).sort().map(subCat => {
                        const subCatCount = groupedSkills[mainCat][subCat].length;
                        const subKey = `${mainCat}-${subCat}`;
                        const isSubExpanded = expandedSubCats[subKey];

                        return (
                          <div key={subCat} style={{ border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden" }}>
                            <button
                              type="button"
                              onClick={() => toggleSubCat(subKey)}
                              style={{ width: "100%", padding: "0.75rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center", background: isSubExpanded ? "#f8fafc" : "transparent", border: "none", borderBottom: isSubExpanded ? "1px solid var(--border)" : "none", cursor: "pointer", textAlign: "left", transition: "all 0.15s ease" }}
                            >
                              <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text)" }}>{subCat}</span>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <span style={{ color: "var(--muted)", fontSize: "0.85rem", fontWeight: 700 }}>
                                  {subCatCount} {subCatCount === 1 ? 'kompetencja' : (subCatCount % 10 >= 2 && subCatCount % 10 <= 4 && (subCatCount % 100 < 10 || subCatCount % 100 >= 20)) ? 'kompetencje' : 'kompetencji'}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => removeSubCategory(mainCat, subCat, e)}
                                  style={{ background: "var(--error-soft)", border: "none", color: "var(--error)", borderRadius: "6px", width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s ease", padding: 0 }}
                                  title="Usuń podkategorię"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                </button>
                              </div>
                            </button>

                            {isSubExpanded && (
                              <div className="profile-chips" style={{ gap: "0.5rem", padding: "1rem" }}>
                                {groupedSkills[mainCat][subCat].sort((a, b) => a.name.localeCompare(b.name)).map(skill => (
                                  <div
                                    key={skill.name}
                                    className="chip"
                                    style={{
                                      background: "#fff",
                                      border: "1px solid var(--border)",
                                      padding: "0.4rem 0.6rem 0.4rem 0.8rem",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "0.6rem",
                                      transition: "all 0.15s ease"
                                    }}
                                  >
                                    <span style={{ fontWeight: 600, color: "var(--text)" }}>{skill.name}</span>
                                    <button
                                      type="button"
                                      className="chip-x"
                                      onClick={(e) => { e.stopPropagation(); removeSkill(skill.name); }}
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  );
}
