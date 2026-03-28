import { getPlantCatalog } from './catalog';
function normalize(input) {
    return input
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}
function matchScore(query, target, prefixBase, substringBase) {
    if (!query || !target)
        return -1;
    if (target.startsWith(query)) {
        return prefixBase - target.length;
    }
    const idx = target.indexOf(query);
    if (idx >= 0) {
        return substringBase - idx;
    }
    return -1;
}
export function searchPlants(queryInput, limit = 20) {
    const query = normalize(queryInput);
    if (!query) {
        return getPlantCatalog().items
            .slice()
            .sort((a, b) => a.latin.localeCompare(b.latin))
            .slice(0, limit)
            .map((item) => ({ item, score: 0, source: 'latin' }));
    }
    const results = [];
    for (const item of getPlantCatalog().items) {
        const latin = normalize(item.latin);
        let bestScore = matchScore(query, latin, 3000, 2000);
        let bestSource = 'latin';
        for (const common of item.common || []) {
            const commonNorm = normalize(common);
            const score = matchScore(query, commonNorm, 3000, 2000);
            if (score > bestScore) {
                bestScore = score;
                bestSource = 'common';
            }
        }
        for (const syn of item.syn || []) {
            const synNorm = normalize(syn);
            const score = matchScore(query, synNorm, 1000, 500);
            if (score > bestScore) {
                bestScore = score;
                bestSource = 'syn';
            }
        }
        if (bestScore >= 0) {
            results.push({ item, score: bestScore, source: bestSource });
        }
    }
    results.sort((a, b) => {
        if (b.score !== a.score)
            return b.score - a.score;
        return a.item.latin.localeCompare(b.item.latin);
    });
    return results.slice(0, limit);
}
