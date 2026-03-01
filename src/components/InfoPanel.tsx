import { View, Text, StyleSheet } from 'react-native';
export function InfoPanel() {
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>ℹ️ About</Text>
      <Text style={styles.description}>
        Weedoshi Diaries is a decentralized cannabis community app built on Nostr.
      </Text>
      <Text style={styles.subtitle}>Features:</Text>
      <Text style={styles.feature}>• Login with nsec (write) or npub (read-only)</Text>
      <Text style={styles.feature}>• Real-time feed from multiple relays</Text>
      <Text style={styles.feature}>• Filter content by hashtags</Text>
      <Text style={styles.feature}>• Manage relay connections</Text>
      <Text style={styles.copyright}>© 2024 Weedoshi. Built with ❤️ on Nostr.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1f2937',
  },
  description: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 8,
    marginBottom: 6,
  },
  feature: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
    lineHeight: 18,
  },
  copyright: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 12,
    textAlign: 'center',
  },
});