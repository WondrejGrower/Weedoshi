import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type RunMenuItem = {
  diaryId: string;
  title: string;
  isPublic: boolean;
  syncStatus: 'local-only' | 'syncing' | 'synced' | 'error';
  itemCount: number;
};

type RunMenuProps = {
  runs: RunMenuItem[];
  onSelectRun: (run: RunMenuItem) => void;
  onRenameRun: (run: RunMenuItem) => void;
  onDeleteRun: (run: RunMenuItem) => void;
};

export function RunMenu({
  runs,
  onSelectRun,
  onRenameRun,
  onDeleteRun,
}: RunMenuProps) {
  if (runs.length === 0) return null;

  const styles = localStyles;

  return (
    <View style={styles.runMenu}>
      {runs.map((run) => (
        <View key={run.diaryId} style={styles.runMenuItem}>
          <TouchableOpacity style={styles.runMenuSelectBtn} onPress={() => onSelectRun(run)}>
            <Text style={styles.runMenuText}>
              {run.title} • {run.syncStatus} • {run.itemCount} items
            </Text>
          </TouchableOpacity>
          <View style={styles.runMenuActions}>
            <TouchableOpacity style={styles.runActionButton} onPress={() => onRenameRun(run)}>
              <Text style={styles.runActionButtonText}>Rename</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.runActionButton, styles.runActionButtonDanger]}
              onPress={() => onDeleteRun(run)}
            >
              <Text style={[styles.runActionButtonText, styles.runActionButtonDangerText]}>
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

const localStyles = StyleSheet.create({
  runMenu: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dacdb3',
    borderRadius: 8,
    marginTop: 8,
    overflow: 'hidden',
  },
  runMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  runMenuSelectBtn: {
    flex: 1,
  },
  runMenuText: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '600',
  },
  runMenuActions: {
    flexDirection: 'row',
    gap: 8,
  },
  runActionButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
  },
  runActionButtonText: {
    fontSize: 12,
    color: '#4b5563',
    fontWeight: '700',
  },
  runActionButtonDanger: {
    borderColor: '#fee2e2',
    backgroundColor: '#fef2f2',
  },
  runActionButtonDangerText: {
    color: '#ef4444',
  },
});
