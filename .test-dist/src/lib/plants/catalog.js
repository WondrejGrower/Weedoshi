import { plantCatalogData } from './catalogData';
const catalog = plantCatalogData;
function asciiFold(input) {
    return input
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}
export function normalizePlantSlug(input) {
    const folded = asciiFold(input).trim();
    if (!folded)
        return '';
    return folded
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
export function encodeCustomPlantSlug(text) {
    const normalized = text.trim().toLowerCase();
    return `custom:${encodeURIComponent(normalized)}`;
}
export function decodeCustomPlantSlug(slug) {
    if (!slug.startsWith('custom:'))
        return null;
    const encoded = slug.slice('custom:'.length);
    if (!encoded)
        return null;
    try {
        return decodeURIComponent(encoded);
    }
    catch {
        return null;
    }
}
export function isCustomPlantSlug(slug) {
    return Boolean(slug && slug.startsWith('custom:'));
}
export function getPlantCatalog() {
    return catalog;
}
export function getPlantBySlug(slug) {
    return catalog.items.find((item) => item.id === slug);
}
export function getPlantPrimaryLabel(item) {
    return item.latin;
}
export function plantSelectionFromCatalog(item) {
    return {
        slug: item.id,
        displayName: item.latin,
        latinName: item.latin,
        isCustom: false,
    };
}
export function plantSelectionFromCustom(text) {
    const trimmed = text.trim();
    return {
        slug: encodeCustomPlantSlug(trimmed),
        displayName: trimmed,
        latinName: undefined,
        isCustom: true,
    };
}
export function getPlantDisplayFromSlug(slug, fallback) {
    if (!slug)
        return fallback || 'Plant not set';
    const custom = decodeCustomPlantSlug(slug);
    if (custom)
        return fallback?.trim() || custom;
    const item = getPlantBySlug(slug);
    if (!item)
        return fallback || slug;
    return fallback?.trim() || item.latin;
}
export function normalizePlantDTagSlug(slugOrText) {
    if (isCustomPlantSlug(slugOrText)) {
        const decoded = decodeCustomPlantSlug(slugOrText) || slugOrText;
        return normalizePlantSlug(decoded);
    }
    return normalizePlantSlug(slugOrText);
}
