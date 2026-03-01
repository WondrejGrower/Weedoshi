import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { LinkPreview } from '../lib/mediaExtraction';

interface LinkPreviewCardProps {
  preview: LinkPreview;
}

export function LinkPreviewCard({ preview }: LinkPreviewCardProps) {
  const handleOpen = async () => {
    try {
      await Linking.openURL(preview.url);
    } catch {
      // no-op
    }
  };

  return (
    <TouchableOpacity onPress={handleOpen} style={styles.card} activeOpacity={0.8}>
      <View>
        <Text style={styles.url} numberOfLines={1}>
          {preview.url}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  url: {
    fontSize: 12,
    color: '#0f766e',
    textDecorationLine: 'underline',
  },
});
