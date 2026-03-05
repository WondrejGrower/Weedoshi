import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  getPlantBySlug,
  getPlantDisplayFromSlug,
  isCustomPlantSlug,
  plantSelectionFromCatalog,
  plantSelectionFromCustom,
} from '../lib/plants/catalog';
import { getPlantFavorites, getRecentPlants, pushRecentPlant, togglePlantFavorite } from '../lib/plants/prefs';
import { searchPlants } from '../lib/plants/search';
import type { PlantRecentItem, PlantSelection } from '../lib/plants/types';

type PlantPickerProps = {
  valueSlug?: string;
  valueName?: string;
  onChange: (selection: PlantSelection) => void;
};

export function PlantPicker({ valueSlug, valueName, onChange }: PlantPickerProps) {
  const [query, setQuery] = useState(valueName || getPlantDisplayFromSlug(valueSlug, valueName));
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<PlantRecentItem[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(query);
    }, 120);
    return () => clearTimeout(timeout);
  }, [query]);

  const loadPrefs = useCallback(async () => {
    const [favoriteSlugs, recentItems] = await Promise.all([getPlantFavorites(), getRecentPlants()]);
    setFavorites(favoriteSlugs);
    setRecents(recentItems);
  }, []);

  useEffect(() => {
    loadPrefs().catch(() => {
      // best-effort local prefs
    });
  }, [loadPrefs]);

  useEffect(() => {
    setQuery(valueName || getPlantDisplayFromSlug(valueSlug, valueName));
  }, [valueName, valueSlug]);

  const results = useMemo(() => searchPlants(debouncedQuery, 8), [debouncedQuery]);
  const showCustom = debouncedQuery.trim().length > 0 && results.length === 0;

  const favoriteItems = useMemo(
    () => favorites.map((slug) => getPlantBySlug(slug)).filter((item): item is NonNullable<typeof item> => Boolean(item)),
    [favorites]
  );

  const selectedSlug = valueSlug;

  const chooseSelection = useCallback(
    async (selection: PlantSelection) => {
      onChange(selection);
      setQuery(selection.displayName);
      setOpen(false);
      await pushRecentPlant(selection);
      await loadPrefs();
    },
    [loadPrefs, onChange]
  );

  const onPickCatalogSlug = useCallback(
    (slug: string) => {
      const item = getPlantBySlug(slug);
      if (!item) return;
      chooseSelection(plantSelectionFromCatalog(item)).catch(() => {
        // ignore local storage errors
      });
    },
    [chooseSelection]
  );

  const handleCustomSelection = useCallback(() => {
    const text = debouncedQuery.trim();
    if (!text) return;
    chooseSelection(plantSelectionFromCustom(text)).catch(() => {
      // ignore local storage errors
    });
  }, [chooseSelection, debouncedQuery]);

  const handleToggleFavorite = useCallback(
    (slug: string) => {
      togglePlantFavorite(slug)
        .then((next) => setFavorites(next))
        .catch(() => {
          // ignore local storage errors
        });
    },
    []
  );

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search plant"
          placeholderTextColor="#9ca3af"
          autoCorrect={false}
          autoCapitalize="words"
        />
        {selectedSlug && !isCustomPlantSlug(selectedSlug) && (
          <TouchableOpacity
            style={[styles.starButton, favorites.includes(selectedSlug) && styles.starButtonActive]}
            onPress={() => handleToggleFavorite(selectedSlug)}
          >
            <Text style={styles.starText}>{favorites.includes(selectedSlug) ? '★' : '☆'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {open && (
        <View style={styles.dropdown}>
          {recents.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Recent</Text>
              <View style={styles.chips}>
                {recents.slice(0, 10).map((item) => (
                  <Pressable
                    key={`recent-${item.slug}`}
                    style={styles.chip}
                    onPress={() => {
                      if (isCustomPlantSlug(item.slug)) {
                        chooseSelection({
                          slug: item.slug,
                          displayName: item.displayName,
                          latinName: item.latinName,
                          isCustom: true,
                        }).catch(() => {
                          // ignore local storage errors
                        });
                        return;
                      }
                      onPickCatalogSlug(item.slug);
                    }}
                  >
                    <Text style={styles.chipText}>{item.displayName}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {favoriteItems.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Favorites</Text>
              <View style={styles.chips}>
                {favoriteItems.map((item) => (
                  <Pressable key={`favorite-${item.id}`} style={styles.chip} onPress={() => onPickCatalogSlug(item.id)}>
                    <Text style={styles.chipText}>{item.latin}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Results</Text>
            {results.map((result) => (
              <Pressable
                key={result.item.id}
                style={styles.resultItem}
                onPress={() => onPickCatalogSlug(result.item.id)}
              >
                <Text style={styles.resultTitle}>{result.item.latin}</Text>
                <Text style={styles.resultSubtitle}>{result.item.common.join(', ') || 'No common names'}</Text>
              </Pressable>
            ))}

            {showCustom && (
              <Pressable style={[styles.resultItem, styles.customResult]} onPress={handleCustomSelection}>
                <Text style={styles.resultTitle}>Custom...</Text>
                <Text style={styles.resultSubtitle}>{debouncedQuery.trim()}</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#111827',
  },
  starButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  starButtonActive: {
    borderColor: '#f59e0b',
    backgroundColor: '#fffbeb',
  },
  starText: {
    fontSize: 16,
    color: '#92400e',
    fontWeight: '700',
  },
  dropdown: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    backgroundColor: '#fff',
    marginTop: 6,
    padding: 10,
    gap: 10,
  },
  section: {
    gap: 6,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4b5563',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#f9fafb',
  },
  chipText: {
    fontSize: 11,
    color: '#374151',
    fontWeight: '600',
  },
  resultItem: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
    backgroundColor: '#fff',
  },
  customResult: {
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  resultSubtitle: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
});
