import { Filters, SegmentInsight } from "./types";

const API = import.meta.env.VITE_API_URL || "";

async function request(path: string, options: RequestInit = {}) {
  let res: Response;
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(options.headers as Record<string, string> || {}) };
  if (token) {
    headers["Authorization"] = `Token ${token}`;
  }

  try {
    res = await fetch(`${API}${path}`, {
      ...options,
      headers,
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
  login: (username: string, password: string): Promise<any> =>
    request("/api/v1/auth/login/", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  register: (username: string, password: string): Promise<any> =>
    request("/api/v1/auth/register/", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  getProfile: (): Promise<any> => request("/api/v1/profile/"),
  saveProfile: (data: any): Promise<any> =>
    request("/api/v1/profile/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  marketPillars: (): Promise<any> => request("/api/v1/market/pillars/"),
  pillarSegments: (pillarId: string): Promise<any> =>
    request(`/api/v1/market/pillars/${encodeURIComponent(pillarId)}/segments/`),
  filterOptions: (): Promise<any> => request("/api/v1/filters/options/"),
  searchSkills: (q: string): Promise<any> =>
    request(`/api/v1/skills/search/?q=${encodeURIComponent(q)}&limit=20`),
  recommendSkills: (skills: string[]): Promise<any> =>
    request("/api/v1/skills/recommend/", {
      method: "POST",
      body: JSON.stringify({ skills }),
    }),
  categories: (): Promise<any> => request("/api/v1/skills/categories/"),
  subcategories: (code: string): Promise<any> =>
    request(
      `/api/v1/skills/categories/${encodeURIComponent(code)}/subcategories/`
    ),
  offerCategories: (): Promise<any> => request("/api/v1/offers/categories/"),
  offerSubcategories: (name: string): Promise<any> =>
    request(
      `/api/v1/offers/categories/${encodeURIComponent(name)}/subcategories/`
    ),
  browseSkills: (mainCode: string, subCode: string): Promise<any> => {
    const p = new URLSearchParams({ limit: "40" });
    if (mainCode) p.set("main_category_code", mainCode);
    if (subCode) p.set("subcategory_code", subCode);
    return request(`/api/v1/skills/browse/?${p}`);
  },
  searchOffers: (q: string): Promise<any> =>
    request(`/api/v1/offers/search/?q=${encodeURIComponent(q)}&limit=12`),
  matchBySkills: (body: any): Promise<any> =>
    request("/api/v1/match/by-skills/", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  matchSimilar: (offerId: string | number, filters: Partial<Filters>, limit = 20): Promise<any> => {
    const p = new URLSearchParams({ offer_id: String(offerId), limit: String(limit) });
    if (filters.region_name) p.set("region_name", filters.region_name);
    if (filters.market_pillar) p.set("market_pillar", filters.market_pillar);
    if (filters.lead_main_category)
      p.set("lead_main_category", filters.lead_main_category);
    if (filters.lead_sub_category)
      p.set("lead_sub_category", filters.lead_sub_category);
    (filters.position_level_groups || []).forEach((g: string) =>
      p.append("position_level_groups", g)
    );
    return request(`/api/v1/match/similar/?${p}`);
  },
  getOfferDetail: (offerId: string | number, skillIds: string[] = []): Promise<any> =>
    request(`/api/v1/offers/${offerId}/`, {
      method: "POST",
      body: JSON.stringify({ skill_ids: skillIds }),
    }),
  getSegmentAnalytics: (
    leadMain: string,
    leadSub: string,
    skillIds: string[] = [],
    filters: Partial<Pick<Filters, "region_name" | "position_level_groups">> = {}
  ): Promise<any> =>
    request("/api/v1/market/segments/analytics/", {
      method: "POST",
      body: JSON.stringify({
        lead_main_category: leadMain,
        lead_sub_category: leadSub,
        skill_ids: skillIds,
        region_name: filters.region_name || "",
        position_level_groups: filters.position_level_groups || [],
      }),
    }),
  rankCareerSegments: (
    skillIds: string[],
    interestedIndustries: unknown[] = [],
    limit = 15
  ): Promise<any> =>
    request("/api/v1/market/segments/rank/", {
      method: "POST",
      body: JSON.stringify({
        skill_ids: skillIds,
        interested_industries: interestedIndustries,
        limit,
      }),
    }),
  getCareerRoadmap: (
    skillIds: string[],
    interestedIndustries: unknown[] = [],
    careerPath: Record<string, unknown> = {},
    experience: unknown[] = []
  ): Promise<any> =>
    request("/api/v1/market/career-roadmap/", {
      method: "POST",
      body: JSON.stringify({
        skill_ids: skillIds,
        interested_industries: interestedIndustries,
        career_path: careerPath,
        experience,
      }),
    }),
  getCareerInsights: (
    segments: { lead_main_category: string; lead_sub_category: string }[]
  ): Promise<{ insights: Record<string, SegmentInsight> }> =>
    request("/api/v1/market/career-roadmap/insights/", {
      method: "POST",
      body: JSON.stringify({ segments }),
    }),
};
