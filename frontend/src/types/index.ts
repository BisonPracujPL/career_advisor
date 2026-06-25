export interface Skill {
  id?: string | number;
  name: string;
  main_category?: string;
  subcategory?: string;
}

export interface ExperienceItem {
  job_title: string;
  company_name: string;
  duration_months: number;
}

export interface EducationItem {
  university_name: string;
  field_of_study: string;
  degree_level: string;
}

export interface LanguageItem {
  name: string;
  proficiency_level: string;
}

export type IndustryItem = string | { main: string; subs: string[] };

export interface UserProfile {
  experience: ExperienceItem[];
  education: EducationItem[];
  hard_skills: Skill[];
  languages: LanguageItem[];
  interested_industries: IndustryItem[];
}

export interface Offer {
  offer_id: string | number;
  job_title: string;
  lead_main_category: string;
  lead_sub_category: string;
  region_name: string;
  position_levels: string[];
  overlap?: {
    offer_coverage_pct: number;
    matched_count: number;
    offer_skill_count: number;
    profile_skill_count: number;
    matched_skills: Skill[];
    missing_skills: Skill[];
  };
  similarity_pct?: number;
  role_similarity_pct?: number;
  display_pct?: number;
}

export interface Filters {
  market_pillar: string;
  lead_main_category: string;
  lead_sub_category: string;
  region_name: string;
  position_level_groups: string[];
}

export interface SegmentKey {
  lead_main_category: string;
  lead_sub_category: string;
}

export interface OfferSkill {
  id: string;
  name: string;
  probability?: number;
}

export interface OfferDetail {
  offer_id: number;
  job_title: string;
  lead_main_category: string;
  lead_sub_category: string;
  pillar_label?: string;
  segment_display_label?: string;
  region_name: string;
  country_name: string;
  work_modes: string[];
  work_schedules: string[];
  position_levels: string[];
  type_of_contract: string[];
  keywords: string[];
  is_remote_work: boolean | null;
  salary_uop: SalaryBlock | null;
  salary_b2b: SalaryBlock | null;
  requirements_expected: string;
  requirements_optional: string;
  responsibilities: string;
  technologies_expected: string;
  skills: OfferSkill[];
  overlap?: Offer["overlap"];
  similarity_pct?: number | null;
  similar_offers?: Offer[];
  segment_offers?: Offer[];
  segment: SegmentKey;
}

export interface SalaryBlock {
  from: number | null;
  to: number | null;
  currency: string;
  duration: string;
  kind: string;
}

export interface SegmentSkillStat {
  id: string;
  name: string;
  offer_count: number;
  pct_of_segment: number;
}

export interface SegmentAnalytics {
  lead_main_category: string;
  lead_sub_category: string;
  pillar_label?: string;
  display_label?: string;
  label: string;
  offer_count: number;
  top_skills: SegmentSkillStat[];
  skills_wordcloud_png?: string | null;
  level_snapshot?: {
    level_id?: string;
    level: string;
    offer_count: number;
    pct?: number;
    median_salary: number | null;
    salary_n: number;
  }[];
  seniority_distribution: { level: string; count: number; pct: number }[];
  salary_by_level: { level: string; n: number; median: number; p25: number; p75: number }[];
  salary_uop_monthly: { n: number; median: number; p25: number; p75: number } | null;
  salary_b2b_monthly: { n: number; median: number; p25: number; p75: number } | null;
  skill_fit: {
    have: SegmentSkillStat[];
    missing: SegmentSkillStat[];
    coverage_pct: number;
  };
  match_score: {
    matching_offers: number;
    avg_similarity_pct: number;
    avg_coverage_pct: number;
  } | null;
  filters_applied?: { region_name?: string; position_level_groups?: string[] };
  sample_offers: Offer[];
}

export type ExploreView = "results" | "offer" | "segment";
