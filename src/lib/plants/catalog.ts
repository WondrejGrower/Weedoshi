import type { PlantCatalog, PlantCatalogItem, PlantSelection } from './types';
import { plantCatalogData } from './catalogData';

const catalog = plantCatalogData as PlantCatalog;

function asciiFold(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function normalizePlantSlug(input: string): string {
  const folded = asciiFold(input).trim();
  if (!folded) return '';
  return folded
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function encodeCustomPlantSlug(text: string): string {
  const normalized = text.trim().toLowerCase();
  return `custom:${encodeURIComponent(normalized)}`;
}

export function decodeCustomPlantSlug(slug: string): string | null {
  if (!slug.startsWith('custom:')) return null;
  const encoded = slug.slice('custom:'.length);
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

export function isCustomPlantSlug(slug: string | undefined | null): boolean {
  return Boolean(slug && slug.startsWith('custom:'));
}

export function getPlantCatalog(): PlantCatalog {
  return catalog;
}

export function getPlantBySlug(slug: string): PlantCatalogItem | undefined {
  return catalog.items.find((item) => item.id === slug);
}

export function getPlantPrimaryLabel(item: PlantCatalogItem): string {
  return item.latin;
}

export function plantSelectionFromCatalog(item: PlantCatalogItem): PlantSelection {
  return {
    slug: item.id,
    displayName: item.latin,
    latinName: item.latin,
    isCustom: false,
  };
}

export function plantSelectionFromCustom(text: string): PlantSelection {
  const trimmed = text.trim();
  return {
    slug: encodeCustomPlantSlug(trimmed),
    displayName: trimmed,
    latinName: undefined,
    isCustom: true,
  };
}

export function getPlantDisplayFromSlug(slug: string | undefined, fallback?: string): string {
  if (!slug) return fallback || 'Plant not set';
  const custom = decodeCustomPlantSlug(slug);
  if (custom) return fallback?.trim() || custom;
  const item = getPlantBySlug(slug);
  if (!item) return fallback || slug;
  return fallback?.trim() || item.latin;
}

export function normalizePlantDTagSlug(slugOrText: string): string {
  if (isCustomPlantSlug(slugOrText)) {
    const decoded = decodeCustomPlantSlug(slugOrText) || slugOrText;
    return normalizePlantSlug(decoded);
  }
  return normalizePlantSlug(slugOrText);
}
