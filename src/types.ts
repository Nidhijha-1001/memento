export type View = "home" | "archive" | "studio" | "companion" | "timeline" | "about";

export interface Memory {
  id: number;
  title: string;
  memory_date: string;
  description: string;
  people: string;
  category: string;
  tags: string[];
  collection: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemoryInput {
  title: string;
  memory_date: string;
  description: string;
  people: string;
  category: string;
  tags: string[];
  collection: string;
}

export interface AIResult {
  text: string;
  model: string;
  sources: number[];
  generated: boolean;
}

export interface AIStatus {
  available: boolean;
  model: string;
  models: string[];
  model_installed: boolean;
  endpoint: string;
}
