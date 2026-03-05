import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { ReactNode } from 'react';
import type { FilteredEvent } from '../../../lib/eventFilter';

type FeedPageProps = {
  isMobile: boolean;
  styles: any;
  onRefresh: () => void;
  feedSearchInput: string;
  onFeedSearchInputChange: (value: string) => void;
  feedSearchSuggestions: string[];
  onSelectFeedSuggestion: (value: string) => void;
  feedFilterEnabled: boolean;
  onToggleFeedFilter: () => void;
  hashtags: string[];
  onRemoveHashtag: (tag: string) => void;
  newHashtag: string;
  onNewHashtagChange: (value: string) => void;
  onAddHashtag: () => void;
  onResetDefaultHashtags: () => void;
  isLoading: boolean;
  visibleFeedEvents: FilteredEvent[];
  relayUrlsCount: number;
  onlyGrowmies: boolean;
  feedSearchQuery: string;
  renderFeedEventCard: (event: FilteredEvent, allowAddToGrowmies: boolean) => ReactNode;
};

export function FeedPage({
  isMobile,
  styles,
  onRefresh,
  feedSearchInput,
  onFeedSearchInputChange,
  feedSearchSuggestions,
  onSelectFeedSuggestion,
  feedFilterEnabled,
  onToggleFeedFilter,
  hashtags,
  onRemoveHashtag,
  newHashtag,
  onNewHashtagChange,
  onAddHashtag,
  onResetDefaultHashtags,
  isLoading,
  visibleFeedEvents,
  relayUrlsCount,
  onlyGrowmies,
  feedSearchQuery,
  renderFeedEventCard,
}: FeedPageProps) {
  return (
    <View style={styles.pageContainer}>
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.pageInner, isMobile && styles.pageInnerMobile]}>
          <View style={styles.panel}>
            <View style={styles.feedHeader}>
              <Text style={styles.panelTitle}>Decentralized Farmers</Text>
              <TouchableOpacity style={styles.smallButton} onPress={onRefresh}>
                <Text style={styles.buttonText}>Refresh</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.feedFilterCard}>
              <View style={styles.feedSearchRow}>
                <Text style={styles.feedFilterTitle}>Search</Text>
                <TextInput
                  style={[styles.input, styles.flexInput]}
                  placeholder="Search posts, hashtags, author..."
                  placeholderTextColor="#999"
                  value={feedSearchInput}
                  onChangeText={onFeedSearchInputChange}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {feedSearchSuggestions.length > 0 && (
                  <View style={styles.searchSuggestionRow}>
                    {feedSearchSuggestions.map((keyword) => (
                      <TouchableOpacity
                        key={keyword}
                        style={styles.searchSuggestionChip}
                        onPress={() => onSelectFeedSuggestion(keyword)}
                      >
                        <Text style={styles.searchSuggestionText}>{keyword}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              <View style={styles.feedFilterHeader}>
                <Text style={styles.feedFilterTitle}>Hashtag filter</Text>
                <TouchableOpacity
                  style={[styles.filterToggleBtn, !feedFilterEnabled && styles.filterToggleBtnMuted]}
                  onPress={onToggleFeedFilter}
                >
                  <Text style={styles.filterToggleBtnText}>
                    {feedFilterEnabled ? 'Filtering ON' : 'Filtering OFF'}
                  </Text>
                </TouchableOpacity>
              </View>
              {feedFilterEnabled ? (
                <>
                  <Text style={styles.signerHint}>
                    Default load uses #weedstr + #plantstr and includes older notes.
                  </Text>
                  <View style={styles.hashtagContainer}>
                    {hashtags.map((tag) => (
                      <View key={tag} style={styles.hashtagBadge}>
                        <Text style={styles.hashtagText}>#{tag}</Text>
                        <TouchableOpacity onPress={() => onRemoveHashtag(tag)}>
                          <Text style={styles.removeBtn}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                  <View style={styles.inputGroup}>
                    <TextInput
                      style={[styles.input, styles.flexInput]}
                      placeholder="Add hashtag"
                      placeholderTextColor="#999"
                      value={newHashtag}
                      onChangeText={onNewHashtagChange}
                    />
                    <TouchableOpacity style={styles.smallButton} onPress={onAddHashtag}>
                      <Text style={styles.buttonText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity style={styles.buttonSecondary} onPress={onResetDefaultHashtags}>
                    <Text style={styles.buttonText}>Reset to #weedstr + #plantstr</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={styles.signerHint}>Feed runs without hashtag filtering.</Text>
              )}
            </View>
          </View>

          {isLoading && (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color="#059669" />
              <Text style={styles.loadingText}>Loading feed...</Text>
            </View>
          )}

          {!isLoading && visibleFeedEvents.length === 0 && relayUrlsCount > 0 && (
            <View style={styles.centerContent}>
              <Text style={styles.emptyText}>
                {feedSearchQuery
                  ? 'No matching posts for this search.'
                  : onlyGrowmies
                    ? 'No posts from Growmies yet.'
                    : 'No posts yet.'}
              </Text>
            </View>
          )}

          {visibleFeedEvents.map((event) => renderFeedEventCard(event, true))}
        </View>
      </ScrollView>
    </View>
  );
}
