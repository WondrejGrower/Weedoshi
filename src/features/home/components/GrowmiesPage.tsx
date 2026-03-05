import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { ReactNode } from 'react';
import type { FilteredEvent } from '../../../lib/eventFilter';

type GrowmiesPageProps = {
  styles: any;
  isMobile: boolean;
  onRefresh: () => void;
  growmiesCount: number;
  growmiesFeedEvents: FilteredEvent[];
  isLoading: boolean;
  renderFeedEventCard: (event: FilteredEvent, allowAddToGrowmies: boolean) => ReactNode;
};

export function GrowmiesPage({
  styles,
  isMobile,
  onRefresh,
  growmiesCount,
  growmiesFeedEvents,
  isLoading,
  renderFeedEventCard,
}: GrowmiesPageProps) {
  return (
    <ScrollView style={styles.pageContainer} showsVerticalScrollIndicator={false}>
      <View style={[styles.pageInner, isMobile && styles.pageInnerMobile]}>
        <View style={styles.panel}>
          <View style={styles.feedHeader}>
            <Text style={styles.panelTitle}>Growmies Feed</Text>
            <TouchableOpacity style={styles.smallButton} onPress={onRefresh}>
              <Text style={styles.buttonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.statusText}>Posts only from authors in your Growmies list.</Text>
          {growmiesCount === 0 && (
            <Text style={styles.emptyText}>No Growmies added yet. Add people from Feed and they will appear here.</Text>
          )}
        </View>

        {growmiesFeedEvents.map((event) => renderFeedEventCard(event, false))}

        {growmiesCount > 0 && !isLoading && growmiesFeedEvents.length === 0 && (
          <View style={styles.centerContent}>
            <Text style={styles.emptyText}>No posts from your Growmies yet.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
