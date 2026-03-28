import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { JSX } from 'react';
import type { FilteredEvent } from '../../../lib/eventFilter';

type GrowmiesPageProps = {
  isMobile: boolean;
  isNight: boolean;
  onRefresh: () => void;
  growmiesCount: number;
  growmiesFeedEvents: FilteredEvent[];
  isLoading: boolean;
  renderFeedEventCard: (event: FilteredEvent, allowAddToGrowmies: boolean) => JSX.Element;
};

export function GrowmiesPage({
  isMobile,
  isNight,
  onRefresh,
  growmiesCount,
  growmiesFeedEvents,
  isLoading,
  renderFeedEventCard,
}: GrowmiesPageProps) {
  const header = (
    <View>
      <View style={[localStyles.panel, isNight && localStyles.panelNight]}>
        <View style={localStyles.feedHeader}>
          <Text style={[localStyles.panelTitle, isNight && localStyles.panelTitleNight]}>Growmies Feed</Text>
          <TouchableOpacity style={localStyles.smallButton} onPress={onRefresh}>
            <Text style={localStyles.buttonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
        <Text style={[localStyles.statusText, isNight && localStyles.statusTextNight]}>
          Posts only from authors in your Growmies list.
        </Text>
        {growmiesCount === 0 && (
          <Text style={[localStyles.emptyText, isNight && localStyles.emptyTextNight]}>
            No Growmies added yet. Add people from Feed and they will appear here.
          </Text>
        )}
      </View>

      {growmiesCount > 0 && !isLoading && growmiesFeedEvents.length === 0 && (
        <View style={localStyles.centerContent}>
          <Text style={[localStyles.emptyText, isNight && localStyles.emptyTextNight]}>No posts from your Growmies yet.</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={localStyles.pageContainer}>
      <View style={[localStyles.pageInner, isMobile && localStyles.pageInnerMobile]}>
        <FlatList
          data={growmiesFeedEvents}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderFeedEventCard(item, false)}
          ListHeaderComponent={header}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
          contentContainerStyle={localStyles.scrollContent}
        />
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
  statusText: {
    fontSize: 12,
    lineHeight: 17,
    color: '#475569',
  },
  statusTextNight: {
    color: '#cbd5e1',
  },
  emptyText: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
  },
  emptyTextNight: {
    color: '#cbd5e1',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
});
