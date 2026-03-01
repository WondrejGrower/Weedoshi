import { ExpoRoot } from 'expo-router';

// Explicit Expo Router root entry for environments where App.tsx is used as app entry.
const ctx = require.context('./app');

export default function App() {
  return <ExpoRoot context={ctx} />;
}
