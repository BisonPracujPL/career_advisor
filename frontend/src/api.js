const API = import.meta.env.VITE_API_URL || "";

async function request(path, options = {}) {
  let res;
  const token = localStorage.getItem("auth_token");
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) {
    headers["Authorization"] = `Token ${token}`;
  }

  try {
    res = await fetch(`${API}${path}`, {
      headers,
      ...options,
    });
  } catch {
    throw new Error(
      "Brak połączenia z API. Uruchom stack: docker compose up (backend :8000, frontend :5173)."
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.detail;
    throw new Error(
      typeof detail === "string" ? detail : `Błąd serwera (${res.status})`
    );
  }
  return data;
}

export const api = {
  login: (username, password) =>
    request("/api/v1/auth/login/", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  register: (username, password) =>
    request("/api/v1/auth/register/", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  getProfile: () => request("/api/v1/profile/"),
  saveProfile: (data) =>
    request("/api/v1/profile/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  marketPillars: () => request("/api/v1/market/pillars/"),
  pillarSegments: (pillarId) =>
    request(`/api/v1/market/pillars/${encodeURIComponent(pillarId)}/segments/`),
  filterOptions: () => request("/api/v1/filters/options/"),
  searchSkills: (q) =>
    request(`/api/v1/skills/search/?q=${encodeURIComponent(q)}&limit=20`),
  recommendSkills: (skills) =>
    request("/api/v1/skills/recommend/", {
      method: "POST",
      body: JSON.stringify({ skills }),
    }),
  categories: () => request("/api/v1/skills/categories/"),
  subcategories: (code) =>
    request(
      `/api/v1/skills/categories/${encodeURIComponent(code)}/subcategories/`
    ),
  offerCategories: () => request("/api/v1/offers/categories/"),
  offerSubcategories: (name) =>
    request(
      `/api/v1/offers/categories/${encodeURIComponent(name)}/subcategories/`
    ),
  browseSkills: (mainCode, subCode) => {
    const p = new URLSearchParams({ limit: "40" });
    if (mainCode) p.set("main_category_code", mainCode);
    if (subCode) p.set("subcategory_code", subCode);
    return request(`/api/v1/skills/browse/?${p}`);
  },
  searchOffers: (q) =>
    request(`/api/v1/offers/search/?q=${encodeURIComponent(q)}&limit=12`),
  matchBySkills: (body) =>
    request("/api/v1/match/by-skills/", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  matchSimilar: (offerId, filters, limit = 20) => {
    const p = new URLSearchParams({ offer_id: String(offerId), limit: String(limit) });
    if (filters.region_name) p.set("region_name", filters.region_name);
    if (filters.market_pillar) p.set("market_pillar", filters.market_pillar);
    if (filters.lead_main_category)
      p.set("lead_main_category", filters.lead_main_category);
    if (filters.lead_sub_category)
      p.set("lead_sub_category", filters.lead_sub_category);
    (filters.position_level_groups || []).forEach((g) =>
      p.append("position_level_groups", g)
    );
    return request(`/api/v1/match/similar/?${p}`);
  },
};
