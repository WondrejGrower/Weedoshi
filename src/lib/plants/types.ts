export interface PlantCatalogItem {
  id: string;
  latin: string;
  common: string[];
  syn: string[];
}

export interface PlantCatalog {
  version: number;
  items: PlantCatalogItem[];
}

export interface PlantSelection {
  slug: string;
  displayName: string;
  latinName?: string;
  isCustom: boolean;
}

export interface PlantRecentItem {
  slug: string;
  displayName: string;
  latinName?: string;
  usedAt: number;
}

export interface WikiArticle {
  id: string;
  pubkey: string;
  createdAt: number;
  content: string;
  dTag: string;
  relayUrl?: string;
  tags: string[][];
  aPointer: string;
}

export interface WikiSelectionResult {
  bestArticle: WikiArticle | null;
  alternatives: WikiArticle[];
}

export interface WikiCuratorPreferences {
  preferredAuthors: Set<string>;
  preferredRelays: Set<string>;
}
