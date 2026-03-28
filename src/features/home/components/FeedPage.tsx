import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { JSX } from 'react';
import type { FilteredEvent } from '../../../lib/eventFilter';
import { perfMonitor } from '../../../lib/perfMonitor';

type FeedPageProps = {
  isMobile: boolean;
  isNight: boolean;
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
  isFetchingMore: boolean;
  visibleFeedEvents: FilteredEvent[];
  relayUrlsCount: number;
  onlyGrowmies: boolean;
  feedSearchQuery: string;
  renderFeedEventCard: (event: FilteredEvent, allowAddToGrowmies: boolean) => JSX.Element;
  onLoadMore: () => void;
};

export function FeedPage({
  isMobile,
  isNight,
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
  isFetchingMore,
  visibleFeedEvents,
  relayUrlsCount,
  onlyGrowmies,
  feedSearchQuery,
  renderFeedEventCard,
  onLoadMore,
}: FeedPageProps) {
  return (
    <View style={localStyles.pageContainer}>
      <View style={[localStyles.pageInner, isMobile && localStyles.pageInnerMobile]}>
        <View style={[localStyles.feedLayout, isMobile ? localStyles.feedLayoutMobile : localStyles.feedLayoutDesktop]}>
          <View style={[localStyles.feedControlColumn, isMobile && localStyles.feedControlColumnMobile]}>
            <View style={[localStyles.panel, localStyles.feedControlPanel, isNight && localStyles.panelNight]}>
              <View style={localStyles.feedHeader}>
                <Text style={[localStyles.panelTitle, isNight && localStyles.panelTitleNight]}>Decentralized Farmers</Text>
                <TouchableOpacity style={localStyles.smallButton} onPress={onRefresh}>
                  <Text style={localStyles.buttonText}>Refresh</Text>
                </TouchableOpacity>
              </View>

              <View style={[localStyles.feedFilterCardCompact, isNight && localStyles.feedFilterCardCompactNight]}>
                <View style={localStyles.feedSearchRow}>
                  <Text style={[localStyles.feedFilterTitle, isNight && localStyles.feedFilterTitleNight]}>Search</Text>
                  <TextInput
                    style={[localStyles.input, localStyles.feedCompactInput, localStyles.flexInput, isNight && localStyles.inputNight]}
                    placeholder="Search posts, hashtags, author..."
                    placeholderTextColor={isNight ? '#9ca3af' : '#999'}
                    value={feedSearchInput}
                    onChangeText={onFeedSearchInputChange}
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                  {feedSearchSuggestions.length > 0 && (
                    <View style={localStyles.searchSuggestionRow}>
                      {feedSearchSuggestions.map((keyword) => (
                        <TouchableOpacity
                          key={keyword}
                          style={[localStyles.searchSuggestionChip, isNight && localStyles.searchSuggestionChipNight]}
                          onPress={() => onSelectFeedSuggestion(keyword)}
                        >
                          <Text style={[localStyles.searchSuggestionText, isNight && localStyles.searchSuggestionTextNight]}>{keyword}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
                <View style={localStyles.feedFilterHeader}>
                  <Text style={[localStyles.feedFilterTitle, isNight && localStyles.feedFilterTitleNight]}>Hashtag filter</Text>
                  <TouchableOpacity
                    style={[
                      localStyles.filterToggleBtn,
                      isNight && localStyles.filterToggleBtnNight,
                      !feedFilterEnabled && localStyles.filterToggleBtnMuted,
                    ]}
                    onPress={onToggleFeedFilter}
                  >
                    <Text style={[localStyles.filterToggleBtnText, isNight && localStyles.filterToggleBtnTextNight]}>
                      {feedFilterEnabled ? 'Filtering ON' : 'Filtering OFF'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {feedFilterEnabled ? (
                  <>
                    <Text style={[localStyles.signerHint, isNight && localStyles.signerHintNight]}>
                      Default load uses #weedstr + #plantstr and includes older notes.
                    </Text>
                    <View style={localStyles.hashtagContainer}>
                      {hashtags.map((tag) => (
                        <View key={tag} style={[localStyles.hashtagBadge, isNight && localStyles.hashtagBadgeNight]}>
                          <Text style={[localStyles.hashtagText, isNight && localStyles.hashtagTextNight]}>#{tag}</Text>
                          <TouchableOpacity onPress={() => onRemoveHashtag(tag)}>
                            <Text style={localStyles.removeBtn}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                    <View style={localStyles.inputGroup}>
                      <TextInput
                        style={[localStyles.input, localStyles.feedCompactInput, localStyles.flexInput, isNight && localStyles.inputNight]}
                        placeholder="Add hashtag"
                        placeholderTextColor={isNight ? '#9ca3af' : '#999'}
                        value={newHashtag}
                        onChangeText={onNewHashtagChange}
                      />
                      <TouchableOpacity style={localStyles.smallButton} onPress={onAddHashtag}>
                        <Text style={localStyles.buttonText}>Add</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={localStyles.buttonSecondary} onPress={onResetDefaultHashtags}>
                      <Text style={localStyles.buttonText}>Reset to #weedstr + #plantstr</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text style={[localStyles.signerHint, isNight && localStyles.signerHintNight]}>
                    Feed runs without hashtag filtering.
                  </Text>
                )}
              </View>
            </View>
          </View>

          <View style={[localStyles.feedContentColumn, isMobile && localStyles.feedContentColumnMobile]}>
            {isLoading && (
              <View style={localStyles.centerContent}>
                <ActivityIndicator size="large" color="#059669" />
                <Text style={[localStyles.loadingText, isNight && localStyles.loadingTextNight]}>Loading feed...</Text>
              </View>
            )}
            {!isLoading && visibleFeedEvents.length === 0 && relayUrlsCount > 0 && (
              <View style={localStyles.centerContent}>
                <Text style={[localStyles.emptyText, isNight && localStyles.emptyTextNight]}>
                  {feedSearchQuery
                    ? 'No matching posts for this search.'
                    : onlyGrowmies
                      ? 'No posts from Growmies yet.'
                      : 'No posts yet.'}
                </Text>
              </View>
            )}
            {visibleFeedEvents.length > 0 && (
              <FlatList
                data={visibleFeedEvents}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => renderFeedEventCard(item, true)}
                showsVerticalScrollIndicator={false}
                initialNumToRender={8}
                maxToRenderPerBatch={8}
                windowSize={7}
                removeClippedSubviews
                contentContainerStyle={localStyles.scrollContent}
                scrollEventThrottle={16}
                onScroll={() => {
                  perfMonitor.recordScrollSample(Date.now());
                }}
                onEndReached={() => {
                  if (!isLoading && !isFetchingMore) {
                    onLoadMore();
                  }
                }}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                  isFetchingMore ? (
                    <View style={localStyles.loadMoreIndicator}>
                      <ActivityIndicator size="small" color="#059669" />
                      <Text style={[localStyles.loadingText, isNight && localStyles.loadingTextNight]}>
                        Loading more...
                      </Text>
                    </View>
                  ) : null
                }
              />
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    paddingTop: 72,
    paddingBottom: 98,
  },
  pageInner: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  pageInnerMobile: {
    paddingHorizontal: 8,
  },
  scrollContent: {
    paddingBottom: 24,
    gap: 10,
  },
  panel: {
    borderWidth: 1,
    borderColor: 'rgba(30,41,59,0.22)',
    borderRadius: 14,
    backgroundColor: 'rgba(248,250,252,0.90)',
    padding: 12,
    marginBottom: 10,
  },
  panelNight: {
    borderColor: 'rgba(71,85,105,0.75)',
    backgroundColor: 'rgba(2,6,23,0.78)',
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  panelTitleNight: {
    color: '#e5e7eb',
  },
  feedLayout: {
    gap: 12,
  },
  feedLayoutDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  feedLayoutMobile: {
    flexDirection: 'column',
  },
  feedControlColumn: {
    width: 340,
    maxWidth: 360,
  },
  feedControlColumnMobile: {
    width: '100%',
    maxWidth: undefined,
  },
  feedControlPanel: {
    marginBottom: 0,
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  smallButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  buttonText: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '700',
  },
  feedFilterCardCompact: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    padding: 10,
    gap: 10,
  },
  feedFilterCardCompactNight: {
    borderColor: '#334155',
    backgroundColor: 'rgba(15,23,42,0.78)',
  },
  feedSearchRow: {
    gap: 8,
  },
  feedFilterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  feedFilterTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f2937',
  },
  feedFilterTitleNight: {
    color: '#e2e8f0',
  },
  filterToggleBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#16a34a',
    backgroundColor: '#dcfce7',
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  filterToggleBtnNight: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(20,83,45,0.5)',
  },
  filterToggleBtnMuted: {
    borderColor: '#94a3b8',
    backgroundColor: '#f1f5f9',
  },
  filterToggleBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  filterToggleBtnTextNight: {
    color: '#bbf7d0',
  },
  searchSuggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  searchSuggestionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f8fafc',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  searchSuggestionChipNight: {
    borderColor: '#475569',
    backgroundColor: '#0f172a',
  },
  searchSuggestionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1f2937',
  },
  searchSuggestionTextNight: {
    color: '#cbd5e1',
  },
  signerHint: {
    fontSize: 11,
    lineHeight: 16,
    color: '#4b5563',
  },
  signerHintNight: {
    color: '#cbd5e1',
  },
  hashtagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  hashtagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 999,
    backgroundColor: '#f8fafc',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  hashtagBadgeNight: {
    borderColor: '#475569',
    backgroundColor: '#0f172a',
  },
  hashtagText: {
    fontSize: 11,
    color: '#14532d',
    fontWeight: '700',
  },
  hashtagTextNight: {
    color: '#bbf7d0',
  },
  removeBtn: {
    fontSize: 12,
    color: '#b91c1c',
    fontWeight: '700',
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    color: '#1f2937',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  inputNight: {
    borderColor: '#475569',
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
  },
  feedCompactInput: {
    minHeight: 38,
  },
  flexInput: {
    flex: 1,
  },
  feedContentColumn: {
    flex: 1,
    minWidth: 0,
  },
  feedContentColumnMobile: {
    width: '100%',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  loadingTextNight: {
    color: '#e2e8f0',
  },
  loadMoreIndicator: {
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
  },
  emptyTextNight: {
    color: '#cbd5e1',
  },
  buttonSecondary: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f8fafc',
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
});
