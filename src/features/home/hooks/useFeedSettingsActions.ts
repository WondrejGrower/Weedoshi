import { useCallback } from 'react';
import { DEFAULT_HASHTAGS } from '../constants';
import { relayManager } from '../../../lib/relayManager';

type UseFeedSettingsActionsParams = {
  newRelay: string;
  setNewRelay: (value: string) => void;
  setRelayUrls: (value: string[]) => void;
  newHashtag: string;
  setNewHashtag: (value: string) => void;
  hashtags: string[];
  setHashtags: (value: string[]) => void;
  setFeedFilterEnabled: (value: boolean) => void;
  newProfileHashtag: string;
  profileHashtags: string[];
  setProfileHashtags: (value: string[] | ((prev: string[]) => string[])) => void;
  setNewProfileHashtag: (value: string) => void;
  setError: (value: string | null) => void;
  refreshFeed: () => void;
};

export function useFeedSettingsActions({
  newRelay,
  setNewRelay,
  setRelayUrls,
  newHashtag,
  setNewHashtag,
  hashtags,
  setHashtags,
  setFeedFilterEnabled,
  newProfileHashtag,
  profileHashtags,
  setProfileHashtags,
  setNewProfileHashtag,
  setError,
  refreshFeed,
}: UseFeedSettingsActionsParams) {
  const handleToggleRelay = useCallback(
    (url: string) => {
      const enabled = relayManager.getEnabledUrls().includes(url);
      if (enabled) {
        relayManager.disableRelay(url);
      } else {
        relayManager.enableRelay(url);
      }
      setRelayUrls(relayManager.getEnabledUrls());
    },
    [setRelayUrls]
  );

  const handleAddRelay = useCallback(() => {
    try {
      if (!newRelay.trim()) throw new Error('Relay URL cannot be empty');
      if (!newRelay.startsWith('wss://')) throw new Error('Relay URL must start with wss://');
      relayManager.addRelay(newRelay.trim());
      setRelayUrls(relayManager.getEnabledUrls());
      setNewRelay('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add relay');
    }
  }, [newRelay, setError, setNewRelay, setRelayUrls]);

  const handleRemoveRelay = useCallback(
    (url: string) => {
      relayManager.removeRelay(url);
      setRelayUrls(relayManager.getEnabledUrls());
    },
    [setRelayUrls]
  );

  const handleAddHashtag = useCallback(() => {
    try {
      if (!newHashtag.trim()) throw new Error('Hashtag cannot be empty');
      const tag = newHashtag.trim().toLowerCase().replace(/^#+/, '');
      if (!hashtags.includes(tag)) {
        setHashtags([...hashtags, tag]);
      }
      setNewHashtag('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add hashtag');
    }
  }, [hashtags, newHashtag, setError, setHashtags, setNewHashtag]);

  const handleRemoveHashtag = useCallback(
    (tag: string) => {
      setHashtags(hashtags.filter((h) => h !== tag));
    },
    [hashtags, setHashtags]
  );

  const handleResetDefaultHashtags = useCallback(() => {
    setHashtags(DEFAULT_HASHTAGS);
    setFeedFilterEnabled(true);
  }, [setFeedFilterEnabled, setHashtags]);

  const handleAddProfileHashtag = useCallback(() => {
    const tag = newProfileHashtag.trim().toLowerCase().replace(/^#+/, '');
    if (!tag) return;
    if (!profileHashtags.includes(tag)) {
      setProfileHashtags((prev) => [...prev, tag]);
    }
    setNewProfileHashtag('');
  }, [newProfileHashtag, profileHashtags, setNewProfileHashtag, setProfileHashtags]);

  const handleRemoveProfileHashtag = useCallback(
    (tag: string) => {
      setProfileHashtags((prev) => prev.filter((item) => item !== tag));
    },
    [setProfileHashtags]
  );

  const handleRefresh = useCallback(() => {
    setError(null);
    refreshFeed();
  }, [refreshFeed, setError]);

  return {
    handleToggleRelay,
    handleAddRelay,
    handleRemoveRelay,
    handleAddHashtag,
    handleRemoveHashtag,
    handleResetDefaultHashtags,
    handleAddProfileHashtag,
    handleRemoveProfileHashtag,
    handleRefresh,
  };
}
