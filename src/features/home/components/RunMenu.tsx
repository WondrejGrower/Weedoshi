import { Text, TouchableOpacity, View } from 'react-native';

export type RunMenuItem = {
  diaryId: string;
  title: string;
  isPublic: boolean;
  syncStatus: 'local-only' | 'syncing' | 'synced' | 'error';
  itemCount: number;
};

type RunMenuProps = {
  styles: any;
  runs: RunMenuItem[];
  onSelectRun: (run: RunMenuItem) => void;
  onRenameRun: (run: RunMenuItem) => void;
  onDeleteRun: (run: RunMenuItem) => void;
};

export function RunMenu({
  styles,
  runs,
  onSelectRun,
  onRenameRun,
  onDeleteRun,
}: RunMenuProps) {
  if (runs.length === 0) return null;

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
