import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

interface HashtagPanelProps {
  hashtags: string[];
  onHashtagsChange: (hashtags: string[]) => void;
}

export function HashtagPanel({ hashtags, onHashtagsChange }: HashtagPanelProps) {
  const [newHashtag, setNewHashtag] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAddHashtag = () => {
    setError(null);
    try {
      if (!newHashtag.trim()) {
        setError('Hashtag cannot be empty');
        return;
      }
      const tag = newHashtag.trim().toLowerCase().replace(/^#+/, '');
      if (!hashtags.includes(tag)) {
        onHashtagsChange([...hashtags, tag]);
        setNewHashtag('');
      } else {
        setError('Hashtag already added');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add hashtag');
    }
  };

  const handleRemoveHashtag = (tag: string) => {
    onHashtagsChange(hashtags.filter((h) => h !== tag));
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>#️⃣ Hashtags</Text>

      <View style={styles.hashtagContainer}>
        {hashtags.map((tag) => (
          <View key={tag} style={styles.hashtagBadge}>
            <Text style={styles.hashtagText}>#{tag}</Text>
            <TouchableOpacity onPress={() => handleRemoveHashtag(tag)}>
              <Text style={styles.removeText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.inputGroup}>
        <TextInput
          style={styles.input}
          placeholder="Add hashtag"
          placeholderTextColor="#999"
          value={newHashtag}
          onChangeText={setNewHashtag}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddHashtag}>
          <Text style={styles.buttonText}>Add</Text>
        </TouchableOpacity>
      </View>
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
    marginBottom: 12,
    color: '#1f2937',
  },
  hashtagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  hashtagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  hashtagText: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '500',
  },
  removeText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: 'bold',
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    color: '#991b1b',
    fontSize: 13,
  },
  inputGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1f2937',
  },
  addButton: {
    backgroundColor: '#059669',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});