import { getJson, setJson } from '../persistentStorage';
const RECENT_KEY = 'plants_recent_v1';
const FAVORITES_KEY = 'plants_favorites_v1';
const RECENT_LIMIT = 10;
export async function getPlantFavorites() {
    const value = await getJson(FAVORITES_KEY, []);
    return Array.from(new Set(value.filter(Boolean)));
}
export async function togglePlantFavorite(slug) {
    const current = await getPlantFavorites();
    const next = current.includes(slug)
        ? current.filter((value) => value !== slug)
        : [slug, ...current];
    await setJson(FAVORITES_KEY, next);
    return next;
}
export async function getRecentPlants() {
    const value = await getJson(RECENT_KEY, []);
    return value
        .filter((item) => item && typeof item.slug === 'string' && typeof item.displayName === 'string')
        .sort((a, b) => b.usedAt - a.usedAt)
        .slice(0, RECENT_LIMIT);
}
export async function pushRecentPlant(selection) {
    const current = await getRecentPlants();
    const next = [
        {
            slug: selection.slug,
            displayName: selection.displayName,
            latinName: selection.latinName,
            usedAt: Date.now(),
        },
        ...current.filter((item) => item.slug !== selection.slug),
    ].slice(0, RECENT_LIMIT);
    await setJson(RECENT_KEY, next);
}
