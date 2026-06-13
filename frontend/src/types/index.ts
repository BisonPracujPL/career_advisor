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
  display_pct?: number;
}

export interface Filters {
  market_pillar: string;
  lead_main_category: string;
  lead_sub_category: string;
  region_name: string;
  position_level_groups: string[];
}
