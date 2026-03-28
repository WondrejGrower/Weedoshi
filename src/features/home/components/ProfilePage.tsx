import { type Href } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { PostMediaRenderer } from '../../../components/PostMediaRenderer';
import { PlantPicker } from '../../../components/PlantPicker';
import { RunMenu } from './RunMenu';
import { getAvatarLabel, getDiaryPhaseDisplay, getDisplayName } from '../profileHelpers';
export function ProfilePage({ ctx }: { ctx: any }) {
  const {
    isNight,
    diaryEditMode,

    isMobile,
    authState,
    profileMetadata,
    setActivePage,
    profilePubkeyText,
    profileNpub,
    npubCopied,
    runOptions,
    handleOpenDiaryEditor,
    handleCopyNpub,
    setError,
    setLoginPromptMenuOpen,
    setLoginPromptDismissed,
    LOGIN_PROMPT_DISMISSED_KEY,
    setJson,
    profilePosts,
    growmies,
    nostrSinceLabel,
    handleCancelEdit,
    setRunMenuOpen,
    selectedRunTitle,
    diaryIdInput,
    runMenuOpen,
    diaryTitleInput,
    setDiaryTitleInput,
    persistDiaryDetails,
    diaryPlantSlug,
    diaryPlantInput,
    handlePlantSelection,
    handleOpenPlantDetails,
    setDiaryMoreOpen,
    diaryMoreOpen,
    diaryCultivarInput,
    setDiaryCultivarInput,
    diaryBreederInput,
    setDiaryBreederInput,
    diaryPlantWikiAPointer,
    setDiaryPlantWikiAPointer,
    diaryPhaseInput,
    setDiaryPhaseInput,
    PHASE_TEMPLATE_OPTIONS,
    diaryDraft,
    diaryStore,
    selectedRunSyncStatus,
    handleSelectRun,
    handleRenameRun,
    handleDeleteRun,
    profileTab,
    hoveredProfileTab,
    setHoveredProfileTab,
    setProfileTab,
    diaryLoading,
    profileDiaries,
    handleCreateDiary,
    router,
    getDiaryCoverForCard,
    getDiaryTileResizeMode,
    setDiaryTileAspectById,
    loadAuthorPosts,
    profileHashtagFilterEnabled,
    setProfileHashtagFilterEnabled,
    profileHashtags,
    handleRemoveProfileHashtag,
    newProfileHashtag,
    setNewProfileHashtag,
    handleAddProfileHashtag,
    profileLoading,
    visibleProfilePosts,
    openAddToDiaryModal,
    handlePublishDiaryChanges,
    diaryPublishing,
    isReadOnlyBlocked,
    readOnlyBlockHint,
  } = ctx;

  const styles = localStyles;

  return (
    <View style={styles.pageContainer}>
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={diaryEditMode ? styles.scrollWithStickyPadding : undefined}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.pageInner, isMobile && styles.pageInnerMobile]}>
          <View style={[styles.brandPlaqueInline, isMobile && styles.brandPlaqueInlineMobile]}>
            <Image
              source={require('../../../../assets/WeedoshiBanner.png')}
              style={styles.brandPlaqueImage}
              resizeMode="cover"
            />
          </View>
          {!authState.isLoggedIn && (
            <View style={[styles.infoBox, isNight && styles.infoBoxNight]}>
              <Text style={[styles.infoText, isNight && styles.infoTextNight]}>
                Use the green Login button to connect Alby, or continue as anon.
              </Text>
              <TouchableOpacity
                style={styles.button}
                onPress={() => {
                  setLoginPromptDismissed(false);
                  Promise.resolve(setJson(LOGIN_PROMPT_DISMISSED_KEY, false)).catch(() => {
                    // best-effort persistence only
                  });
                  setLoginPromptMenuOpen(true);
                }}
              >
                <Text style={styles.buttonText}>Login</Text>
              </TouchableOpacity>
            </View>
          )}

          <View
            style={[
              styles.profileHeaderCard,
              isNight && styles.profileHeaderCardNight,
              isMobile && styles.profileHeaderCardMobile,
              diaryEditMode && styles.profileHeaderCardEditing,
            ]}
          >
            <View style={[styles.profileBannerWrap, isMobile && styles.profileBannerWrapMobile]}>
              {profileMetadata?.banner ? (
                <Image source={{ uri: profileMetadata.banner }} style={styles.profileBannerImage} resizeMode="cover" />
              ) : (
                <Image source={require('../../../../assets/WeedoshiBanner.png')} style={styles.profileBannerImage} resizeMode="cover" />
              )}
              <View pointerEvents="none" style={styles.profileBannerOverlayTop} />
              <View pointerEvents="none" style={styles.profileBannerOverlayBottom} />
            </View>

            <View style={[styles.profileHeaderContent, isMobile && styles.profileHeaderContentMobile]}>
              <View style={[styles.profileHeaderRow, isMobile && styles.profileHeaderRowMobile]}>
                <View style={[styles.profileMeta, isNight && styles.profileMetaNight]}>
                  <View style={[styles.profileMetaContentRow, isMobile && styles.profileMetaContentRowMobile]}>
                    <View style={styles.profileMetaLead}>
                      <View style={styles.profileNameRow}>
                        <Text style={[styles.profileName, isNight && styles.profileNameNight, isMobile && styles.profileNameMobile]}>
                          {getDisplayName(authState, profileMetadata)}
                        </Text>
                      </View>
                      <Text style={[styles.profilePubkey, isNight && styles.profilePubkeyNight]}>{profilePubkeyText}</Text>
                      {authState.isLoggedIn && profileNpub ? (
                        <View style={styles.profileIdentityActionsRow}>
                          <TouchableOpacity style={styles.profileCopyNpubButton} onPress={handleCopyNpub}>
                            <Text style={styles.profileCopyNpubButtonText}>{npubCopied ? 'Copied' : 'Copy npub'}</Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                      <View style={styles.profileAvatarSpot}>
                        <TouchableOpacity
                          style={[styles.avatarCircle, isMobile && styles.avatarCircleMobile]}
                          onPress={() => setActivePage('profile')}
                          accessibilityRole="button"
                          accessibilityLabel="Profile"
                        >
                          {profileMetadata?.picture ? (
                            <Image
                              source={{ uri: profileMetadata.picture }}
                              style={[styles.avatarImage, isMobile && styles.avatarImageMobile]}
                              resizeMode="cover"
                            />
                          ) : (
                            <Text style={styles.avatarLabel}>{getAvatarLabel(authState, profileMetadata)}</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>

                    {profileMetadata?.about ? (
                      <View style={[styles.profileBioAside, isNight && styles.profileBioAsideNight, isMobile && styles.profileBioAsideMobile]}>
                        <Text style={[styles.profileBio, isNight && styles.profileBioNight]}>{profileMetadata.about}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.profileStatsRow}>
                    <View style={[styles.profileStatPill, isNight && styles.profileStatPillNight]}>
                      <Text style={[styles.profileStatValue, isNight && styles.profileStatValueNight]}>{runOptions.length}</Text>
                      <Text style={[styles.profileStatLabel, isNight && styles.profileStatLabelNight]}>Diaries</Text>
                    </View>
                    <View style={[styles.profileStatPill, isNight && styles.profileStatPillNight]}>
                      <Text style={[styles.profileStatValue, isNight && styles.profileStatValueNight]}>{profilePosts.length}</Text>
                      <Text style={[styles.profileStatLabel, isNight && styles.profileStatLabelNight]}>Notes</Text>
                    </View>
                    <View style={[styles.profileStatPill, isNight && styles.profileStatPillNight]}>
                      <Text style={[styles.profileStatValue, isNight && styles.profileStatValueNight]}>{growmies.length}</Text>
                      <Text style={[styles.profileStatLabel, isNight && styles.profileStatLabelNight]}>Growmies</Text>
                    </View>
                    <View style={[styles.profileStatPill, isNight && styles.profileStatPillNight]}>
                      <Text style={[styles.profileStatValue, isNight && styles.profileStatValueNight]}>{nostrSinceLabel}</Text>
                      <Text style={[styles.profileStatLabel, isNight && styles.profileStatLabelNight]}>Nostr since</Text>
                    </View>
                  </View>
                </View>
              </View>
              {authState.isLoggedIn && (
                <View style={styles.profileLooseActionRow}>
                  <TouchableOpacity
                    style={[
                      styles.profileStatActionPill,
                      authState.isReadOnly && styles.profileStatActionPillDisabled,
                    ]}
                    onPress={() => {
                      handleOpenDiaryEditor().catch((err: unknown) => {
                        setError(err instanceof Error ? err.message : 'Failed to open diary editor');
                      });
                    }}
                    disabled={authState.isReadOnly}
                  >
                    <Text style={styles.profileStatActionText}>Add diary</Text>
                  </TouchableOpacity>
                </View>
              )}

              {diaryEditMode && (
                <View style={styles.diaryHeaderActions}>
                  <TouchableOpacity style={styles.ghostButton} onPress={handleCancelEdit}>
                    <Text style={styles.ghostButtonText}>Close editor</Text>
                  </TouchableOpacity>
                </View>
              )}
              {diaryEditMode && (
                <>
                  <View style={styles.runSelectorRow}>
                    <TouchableOpacity style={styles.runSelectorButton} onPress={() => setRunMenuOpen((prev: boolean) => !prev)}>
                      <Text style={styles.runSelectorText}>
                        {selectedRunTitle} ({runOptions.find((run: any) => run.diaryId === diaryIdInput)?.itemCount ?? 0})
                      </Text>
                      <Text style={styles.runSelectorChevron}>{runMenuOpen ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.diaryDetailsWrap}>
                    <View style={styles.diaryDetailField}>
                      <Text style={styles.diaryDetailLabel}>Diary name</Text>
                      <TextInput
                        style={styles.diaryDetailInput}
                        value={diaryTitleInput}
                        onChangeText={setDiaryTitleInput}
                        onBlur={() => {
                          persistDiaryDetails().catch(() => {
                            // error handled in callback
                          });
                        }}
                        placeholder="My Plant Journal"
                        placeholderTextColor="#9ca3af"
                      />
                    </View>
                    <View style={styles.diaryDetailRow}>
                      <View style={[styles.diaryDetailField, styles.diaryDetailFieldHalf]}>
                        <Text style={styles.diaryDetailLabel}>Plant</Text>
                        <View style={styles.plantPickerLayer}>
                          <PlantPicker
                            valueSlug={diaryPlantSlug}
                            valueName={diaryPlantInput}
                            onChange={(selection) => {
                              handlePlantSelection(selection);
                              persistDiaryDetails().catch(() => {
                                // error handled in callback
                              });
                            }}
                          />
                        </View>
                        <View style={styles.plantActionsRow}>
                          <TouchableOpacity style={styles.smallButton} onPress={handleOpenPlantDetails}>
                            <Text style={styles.buttonText}>Plant details</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.buttonSecondary}
                            onPress={() => setDiaryMoreOpen((prev: boolean) => !prev)}
                          >
                            <Text style={styles.buttonText}>{diaryMoreOpen ? 'Less' : 'More'}</Text>
                          </TouchableOpacity>
                        </View>
                        {diaryMoreOpen && (
                          <View style={styles.plantMoreWrap}>
                            <Text style={styles.diaryDetailLabel}>Cultivar / Strain</Text>
                            <TextInput
                              style={styles.diaryDetailInput}
                              value={diaryCultivarInput}
                              onChangeText={setDiaryCultivarInput}
                              onBlur={() => persistDiaryDetails().catch(() => {})}
                              placeholder="Optional cultivar/strain"
                              placeholderTextColor="#9ca3af"
                            />
                            <Text style={styles.diaryDetailLabel}>Breeder</Text>
                            <TextInput
                              style={styles.diaryDetailInput}
                              value={diaryBreederInput}
                              onChangeText={setDiaryBreederInput}
                              onBlur={() => persistDiaryDetails().catch(() => {})}
                              placeholder="Optional breeder"
                              placeholderTextColor="#9ca3af"
                            />
                            <Text style={styles.diaryDetailLabel}>Wiki article pointer (a)</Text>
                            <TextInput
                              style={styles.diaryDetailInput}
                              value={diaryPlantWikiAPointer}
                              onChangeText={setDiaryPlantWikiAPointer}
                              onBlur={() => persistDiaryDetails().catch(() => {})}
                              placeholder="30818:<pubkey>:<d-tag>"
                              placeholderTextColor="#9ca3af"
                            />
                          </View>
                        )}
                      </View>
                      <View style={[styles.diaryDetailField, styles.diaryDetailFieldHalf]}>
                        <Text style={styles.diaryDetailLabel}>Phase</Text>
                        <TextInput
                          style={styles.diaryDetailInput}
                          value={diaryPhaseInput}
                          onChangeText={setDiaryPhaseInput}
                          onBlur={() => persistDiaryDetails().catch(() => {})}
                          placeholder="e.g. Seedling / Vegetation Week 3"
                          placeholderTextColor="#9ca3af"
                        />
                        <View style={styles.phaseTemplatesRow}>
                          {PHASE_TEMPLATE_OPTIONS.map((template: string) => (
                            <TouchableOpacity
                              key={template}
                              style={[
                                styles.phaseTemplateChip,
                                diaryPhaseInput.trim().toLowerCase().startsWith(template.toLowerCase()) &&
                                  styles.phaseTemplateChipActive,
                              ]}
                              onPress={() => {
                                setDiaryPhaseInput(template);
                                if (!diaryDraft) return;
                                diaryStore
                                  .updateDiaryDetails(diaryDraft.diaryId, { phase: template })
                                  .catch((err: unknown) =>
                                    setError(err instanceof Error ? err.message : 'Failed to save diary phase')
                                  );
                              }}
                            >
                              <Text
                                style={[
                                  styles.phaseTemplateChipText,
                                  diaryPhaseInput.trim().toLowerCase().startsWith(template.toLowerCase()) &&
                                    styles.phaseTemplateChipTextActive,
                                ]}
                              >
                                {template}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    </View>
                  </View>
                  <View style={styles.syncBadgeRow}>
                    <Text style={styles.syncBadgeText}>Sync: {selectedRunSyncStatus}</Text>
                  </View>
                  {runMenuOpen && runOptions.length > 0 && (
                    <RunMenu
                      runs={runOptions}
                      onSelectRun={handleSelectRun}
                      onRenameRun={(run) => {
                        handleRenameRun(run).catch(() => {});
                      }}
                      onDeleteRun={handleDeleteRun}
                    />
                  )}
                </>
              )}
              <View style={styles.profileTabs}>
                <Pressable
                  style={[
                    styles.profileTab,
                    hoveredProfileTab === 'diary' && styles.profileTabHover,
                    profileTab === 'diary' && styles.profileTabActive,
                  ]}
                  onPress={() => setProfileTab('diary')}
                  onHoverIn={() => setHoveredProfileTab('diary')}
                  onHoverOut={() => setHoveredProfileTab((prev: any) => (prev === 'diary' ? null : prev))}
                >
                  <Text style={[styles.profileTabText, profileTab === 'diary' && styles.profileTabTextActive]}>Diary</Text>
                  <View
                    style={[
                      styles.profileTabUnderline,
                      profileTab === 'diary' && styles.profileTabUnderlineActive,
                    ]}
                  />
                </Pressable>
                <Pressable
                  style={[
                    styles.profileTab,
                    hoveredProfileTab === 'all' && styles.profileTabHover,
                    profileTab === 'all' && styles.profileTabActive,
                  ]}
                  onPress={() => setProfileTab('all')}
                  onHoverIn={() => setHoveredProfileTab('all')}
                  onHoverOut={() => setHoveredProfileTab((prev: any) => (prev === 'all' ? null : prev))}
                >
                  <Text style={[styles.profileTabText, profileTab === 'all' && styles.profileTabTextActive]}>All Posts</Text>
                  <View
                    style={[
                      styles.profileTabUnderline,
                      profileTab === 'all' && styles.profileTabUnderlineActive,
                    ]}
                  />
                </Pressable>
              </View>
            </View>
          </View>

          {profileTab === 'diary' ? (
            <View>
              {diaryLoading && (
                <View style={styles.centerContent}>
                  <ActivityIndicator size="small" color="#059669" />
                  <Text style={styles.loadingText}>Loading diary...</Text>
                </View>
              )}

              {!diaryLoading && profileDiaries.length === 0 && (
                <View style={styles.emptyDiaryState}>
                  <Text style={styles.emptyDiaryTitle}>Start your grow diary</Text>
                  <Text style={styles.emptyDiarySubtitle}>
                    Pick posts from your feed and organize them by week.
                  </Text>
                  <TouchableOpacity
                    style={styles.button}
                    onPress={() => {
                      handleCreateDiary().catch((err: unknown) => {
                        setError(err instanceof Error ? err.message : 'Failed to create diary');
                      });
                    }}
                    disabled={!authState.isLoggedIn || authState.isReadOnly}
                  >
                    <Text style={styles.buttonText}>Create diary</Text>
                  </TouchableOpacity>
                </View>
              )}

              {profileDiaries.length > 0 && (
                <View style={styles.diaryTilesGrid}>
                  {profileDiaries.map((diary: any) => {
                    const imageUri = getDiaryCoverForCard(diary);
                    const updatedAtTs = diary.updatedAt || diary.createdAt;
                    const phaseDisplay = getDiaryPhaseDisplay(diary);

                    return (
                      <Pressable
                        key={diary.id}
                      style={({ hovered, pressed }) => [
                        styles.diaryTileCard,
                        isNight && styles.diaryTileCardNight,
                        !isMobile && styles.diaryTileCardDesktop,
                        isMobile && styles.diaryTileCardMobile,
                        (hovered || pressed) && styles.diaryTileCardHover,
                        ]}
                        onPress={() => {
                          router.push(`/diary/${encodeURIComponent(diary.id)}` as Href);
                        }}
                      >
                        {imageUri ? (
                          <View style={styles.diaryTileImageWrap}>
                            <Image
                              source={{ uri: imageUri }}
                              style={styles.diaryTileImage}
                              resizeMode={getDiaryTileResizeMode(diary.id)}
                              onLoad={(evt) => {
                                const source = evt.nativeEvent?.source;
                                if (!source?.width || !source?.height) return;
                                const aspect = source.width / source.height;
                                setDiaryTileAspectById((prev: any) => {
                                  if (prev[diary.id] === aspect) return prev;
                                  return { ...prev, [diary.id]: aspect };
                                });
                              }}
                            />
                            <View pointerEvents="none" style={styles.diaryTileImageShade} />
                            {diary.coverImage ? (
                              <View style={styles.diaryTileCoverBadge}>
                                <Text style={styles.diaryTileCoverBadgeText}>Cover</Text>
                              </View>
                            ) : null}
                          </View>
                        ) : (
                          <View style={[styles.diaryTileImageFallback, isNight && styles.diaryTileImageFallbackNight]}>
                            <Text style={[styles.diaryTileImageFallbackText, isNight && styles.diaryTileImageFallbackTextNight]}>No image</Text>
                          </View>
                        )}
                        <View style={[styles.diaryTileMeta, isNight && styles.diaryTileMetaNight]}>
                          <Text style={[styles.diaryTileTitle, isNight && styles.diaryTileTitleNight]}>{diary.title || 'Untitled diary'}</Text>
                          <Text style={[styles.diaryTileSub, isNight && styles.diaryTileSubNight]}>
                            {(diary.plant || 'Plant n/a')} • {(phaseDisplay || 'Phase n/a')}
                          </Text>
                          <Text style={[styles.diaryTileDate, isNight && styles.diaryTileDateNight]}>
                            {diary.items.length} entries • {new Date(updatedAtTs * 1000).toLocaleDateString()}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          ) : (
            <View style={[styles.panel, isNight && styles.panelNight]}>
              <View style={styles.feedHeader}>
                <Text style={[styles.panelTitle, isNight && styles.panelTitleNight]}>All Posts</Text>
                <TouchableOpacity
                  style={styles.smallButton}
                  onPress={() => {
                    loadAuthorPosts().catch((err: unknown) => {
                      setError(err instanceof Error ? err.message : 'Failed to load profile posts');
                    });
                  }}
                >
                  <Text style={styles.buttonText}>Reload</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.feedFilterCard, isNight && styles.feedFilterCardCompactNight]}>
                <View style={styles.feedFilterHeader}>
                  <Text style={[styles.feedFilterTitle, isNight && styles.feedFilterTitleNight]}>Profile hashtag filter</Text>
                  <TouchableOpacity
                    style={[
                      styles.filterToggleBtn,
                      isNight && styles.filterToggleBtnNight,
                      !profileHashtagFilterEnabled && styles.filterToggleBtnMuted,
                    ]}
                    onPress={() => setProfileHashtagFilterEnabled((prev: boolean) => !prev)}
                  >
                    <Text style={[styles.filterToggleBtnText, isNight && styles.filterToggleBtnTextNight]}>
                      {profileHashtagFilterEnabled ? 'Filter ON' : 'Filter OFF'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {profileHashtagFilterEnabled ? (
                  <>
                    <View style={styles.hashtagContainer}>
                      {profileHashtags.map((tag: string) => (
                        <View key={tag} style={[styles.hashtagBadge, isNight && styles.hashtagBadgeNight]}>
                          <Text style={[styles.hashtagText, isNight && styles.hashtagTextNight]}>#{tag}</Text>
                          <TouchableOpacity onPress={() => handleRemoveProfileHashtag(tag)}>
                            <Text style={styles.removeBtn}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                    <View style={styles.inputGroup}>
                      <TextInput
                        style={[styles.input, styles.flexInput, isNight && styles.inputNight]}
                        placeholder="Filter by hashtag"
                        placeholderTextColor={isNight ? '#9ca3af' : '#999'}
                        value={newProfileHashtag}
                        onChangeText={setNewProfileHashtag}
                      />
                      <TouchableOpacity style={styles.smallButton} onPress={handleAddProfileHashtag}>
                        <Text style={styles.buttonText}>Add</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <Text style={[styles.signerHint, isNight && styles.signerHintNight]}>Show all posts without hashtag filter.</Text>
                )}
              </View>
              {profileLoading && (
                <View style={styles.centerContent}>
                  <ActivityIndicator size="small" color="#059669" />
                  <Text style={[styles.loadingText, isNight && styles.loadingTextNight]}>Loading profile posts...</Text>
                </View>
              )}
              {!profileLoading && visibleProfilePosts.length === 0 && (
                <Text style={[styles.emptyText, isNight && styles.emptyTextNight]}>No profile posts found.</Text>
              )}
              {visibleProfilePosts.map((post: any) => (
                <View key={post.id} style={[styles.diaryCard, isNight && styles.feedItemNight]}>
                  <Text style={[styles.timestamp, isNight && styles.timestampNight]}>{new Date(post.created_at * 1000).toLocaleString()}</Text>
                  <PostMediaRenderer content={post.content || ''} tags={post.tags} textNumberOfLines={5} isNight={isNight} />
                  {authState.isLoggedIn && (
                    <TouchableOpacity
                      style={[styles.addToDiaryMini, isNight && styles.addToDiaryMiniNight]}
                      onPress={() => openAddToDiaryModal(post)}
                    >
                      <Text style={[styles.addToDiaryMiniText, isNight && styles.addToDiaryMiniTextNight]}>Add to Diary</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {diaryEditMode && (
        <View style={styles.stickyBar}>
          <View style={[styles.stickyBarInner, isMobile && styles.stickyBarInnerMobile]}>
            <TouchableOpacity style={styles.stickySecondary} onPress={handleCancelEdit}>
              <Text style={styles.stickySecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.stickyPrimary}
              onPress={handlePublishDiaryChanges}
              disabled={diaryPublishing || isReadOnlyBlocked}
            >
              <Text style={styles.buttonText}>
                {isReadOnlyBlocked ? 'Publish blocked (read-only)' : diaryPublishing ? 'Publishing...' : 'Publish changes'}
              </Text>
            </TouchableOpacity>
          </View>
          {readOnlyBlockHint && <Text style={styles.readOnlyGuardHint}>{readOnlyBlockHint}</Text>}
        </View>
      )}
    </View>
  );
}

const localStyles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    paddingTop: 72,
    paddingBottom: 98,
  },
  scrollContent: {
    flex: 1,
  },
  scrollWithStickyPadding: {
    paddingBottom: 110,
  },
  pageInner: {
    width: '100%',
    maxWidth: 1000,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingBottom: 40,
  },
  pageInnerMobile: {
    paddingHorizontal: 10,
  },
  brandPlaqueInline: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2d7c0',
  },
  brandPlaqueInlineMobile: {
    borderRadius: 12,
  },
  brandPlaqueImage: {
    width: '100%',
    height: 120,
  },
  infoBox: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoBoxNight: {
    backgroundColor: 'rgba(251,191,36,0.1)',
    borderColor: 'rgba(251,191,36,0.2)',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#92400e',
    fontWeight: '600',
  },
  infoTextNight: {
    color: '#fbbf24',
  },
  button: {
    borderRadius: 8,
    backgroundColor: '#059669',
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  profileHeaderCard: {
    borderWidth: 1,
    borderColor: '#e1d1ae',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#fffdf8',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },
  profileHeaderCardNight: {
    borderColor: 'rgba(71,85,105,0.85)',
    backgroundColor: 'rgba(15,23,42,0.84)',
  },
  profileHeaderCardMobile: {
    borderRadius: 16,
  },
  profileHeaderCardEditing: {
    borderColor: '#059669',
    borderWidth: 2,
  },
  profileBannerWrap: {
    width: '100%',
    height: 140,
    position: 'relative',
    backgroundColor: '#d9e8d6',
  },
  profileBannerWrapMobile: {
    height: 100,
  },
  profileBannerImage: {
    width: '100%',
    height: '100%',
  },
  profileBannerOverlayTop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  profileBannerOverlayBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  profileHeaderContent: {
    marginTop: -40,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  profileHeaderContentMobile: {
    marginTop: -30,
    paddingHorizontal: 12,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  profileHeaderRowMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  profileMeta: {
    flex: 1,
    width: '100%',
  },
  profileMetaNight: {},
  profileMetaContentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  profileMetaContentRowMobile: {
    flexDirection: 'column',
    gap: 12,
  },
  profileMetaLead: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 240,
    maxWidth: 300,
    minWidth: 0,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  profileName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1b4d2f',
  },
  profileNameNight: {
    color: '#f8fafc',
  },
  profileNameMobile: {
    fontSize: 20,
  },
  profilePubkey: {
    marginTop: 4,
    fontSize: 12,
    color: '#7a6742',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  profilePubkeyNight: {
    color: '#cbd5e1',
  },
  profileIdentityActionsRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileCopyNpubButton: {
    borderWidth: 1,
    borderColor: '#bcdcbf',
    borderRadius: 999,
    backgroundColor: '#ecfdf3',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  profileCopyNpubButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  profileAvatarSpot: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 110,
  },
  avatarCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 4,
    borderColor: '#fffdf8',
    backgroundColor: '#f3f4f6',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  avatarCircleMobile: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarImageMobile: {
    width: '100%',
    height: '100%',
  },
  avatarLabel: {
    fontSize: 24,
    fontWeight: '700',
    color: '#059669',
  },
  profileBioAside: {
    flex: 1,
    minWidth: 0,
    borderLeftWidth: 1,
    borderLeftColor: '#e7d9bb',
    paddingLeft: 12,
    paddingTop: 8,
  },
  profileBioAsideNight: {
    borderLeftColor: '#475569',
  },
  profileBioAsideMobile: {
    borderLeftWidth: 0,
    paddingLeft: 0,
    paddingTop: 0,
  },
  profileBio: {
    fontSize: 14,
    lineHeight: 22,
    color: '#374151',
    fontWeight: '500',
  },
  profileBioNight: {
    color: '#e2e8f0',
  },
  profileStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    gap: 10,
  },
  profileStatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#e2d7c0',
    borderRadius: 999,
    backgroundColor: '#fbf7ee',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  profileStatPillNight: {
    borderColor: '#475569',
    backgroundColor: '#111827',
  },
  profileStatValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#166534',
  },
  profileStatValueNight: {
    color: '#86efac',
  },
  profileStatLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7a6742',
  },
  profileStatLabelNight: {
    color: '#94a3b8',
  },
  profileLooseActionRow: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  profileStatActionPill: {
    borderRadius: 999,
    backgroundColor: '#059669',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  profileStatActionPillDisabled: {
    backgroundColor: '#9ca3af',
  },
  profileStatActionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  diaryHeaderActions: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  ghostButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  ghostButtonText: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '600',
  },
  runSelectorRow: {
    marginTop: 12,
  },
  runSelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dacdb3',
    borderRadius: 8,
    padding: 12,
  },
  runSelectorText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
  },
  runSelectorChevron: {
    fontSize: 12,
    color: '#6b7280',
  },
  diaryDetailsWrap: {
    marginTop: 12,
    gap: 12,
  },
  diaryDetailField: {
    gap: 6,
  },
  diaryDetailLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4b5563',
    marginLeft: 2,
  },
  diaryDetailInput: {
    borderWidth: 1,
    borderColor: '#dacdb3',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#fff',
    color: '#1f2937',
  },
  diaryDetailRow: {
    flexDirection: 'row',
    gap: 12,
  },
  diaryDetailFieldHalf: {
    flex: 1,
  },
  plantPickerLayer: {
    zIndex: 10,
  },
  plantActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  smallButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  buttonSecondary: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  plantMoreWrap: {
    marginTop: 8,
    gap: 8,
    padding: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  phaseTemplatesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  phaseTemplateChip: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#fff',
  },
  phaseTemplateChipActive: {
    borderColor: '#059669',
    backgroundColor: '#ecfdf5',
  },
  phaseTemplateChipText: {
    fontSize: 11,
    color: '#4b5563',
    fontWeight: '600',
  },
  phaseTemplateChipTextActive: {
    color: '#059669',
  },
  syncBadgeRow: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
  syncBadgeText: {
    fontSize: 11,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  profileTabs: {
    flexDirection: 'row',
    marginTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  profileTab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'relative',
  },
  profileTabHover: {
    backgroundColor: '#f9fafb',
  },
  profileTabActive: {},
  profileTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  profileTabTextActive: {
    color: '#166534',
  },
  profileTabUnderline: {
    position: 'absolute',
    bottom: -1,
    left: 16,
    right: 16,
    height: 3,
    backgroundColor: 'transparent',
  },
  profileTabUnderlineActive: {
    backgroundColor: '#059669',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#6b7280',
  },
  loadingTextNight: {
    color: '#cbd5e1',
  },
  emptyDiaryState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: '#fffdf8',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2d7c0',
    gap: 12,
  },
  emptyDiaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1b4d2f',
  },
  emptyDiarySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  diaryTilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  diaryTileCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2d7c0',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  diaryTileCardNight: {
    borderColor: '#475569',
    backgroundColor: '#111827',
  },
  diaryTileCardDesktop: {
    width: '48.5%',
  },
  diaryTileCardMobile: {
    width: '100%',
  },
  diaryTileCardHover: {
    borderColor: '#059669',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  diaryTileImageWrap: {
    width: '100%',
    height: 140,
    position: 'relative',
    backgroundColor: '#f3f4f6',
  },
  diaryTileImage: {
    width: '100%',
    height: '100%',
  },
  diaryTileImageShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  diaryTileCoverBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#059669',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  diaryTileCoverBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  diaryTileImageFallback: {
    width: '100%',
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  diaryTileImageFallbackNight: {
    backgroundColor: '#1f2937',
  },
  diaryTileImageFallbackText: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
  },
  diaryTileImageFallbackTextNight: {
    color: '#6b7280',
  },
  diaryTileMeta: {
    padding: 12,
    gap: 4,
  },
  diaryTileMetaNight: {},
  diaryTileTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
  },
  diaryTileTitleNight: {
    color: '#f8fafc',
  },
  diaryTileSub: {
    fontSize: 12,
    color: '#6b7280',
  },
  diaryTileSubNight: {
    color: '#cbd5e1',
  },
  diaryTileDate: {
    fontSize: 11,
    color: '#9ca3af',
  },
  diaryTileDateNight: {
    color: '#6b7280',
  },
  panel: {
    backgroundColor: '#fffdf8',
    borderWidth: 1,
    borderColor: '#e1d1ae',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  panelNight: {
    backgroundColor: 'rgba(15,23,42,0.84)',
    borderColor: 'rgba(71,85,105,0.85)',
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  panelTitleNight: {
    color: '#f8fafc',
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  feedFilterCard: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    padding: 12,
    marginBottom: 16,
    gap: 12,
  },
  feedFilterCardCompactNight: {
    borderColor: '#334155',
    backgroundColor: 'rgba(15,23,42,0.6)',
  },
  feedFilterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  feedFilterTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4b5563',
  },
  feedFilterTitleNight: {
    color: '#cbd5e1',
  },
  filterToggleBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#059669',
    backgroundColor: '#ecfdf5',
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  filterToggleBtnNight: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16,185,129,0.1)',
  },
  filterToggleBtnMuted: {
    borderColor: '#d1d5db',
    backgroundColor: '#f3f4f6',
  },
  filterToggleBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  filterToggleBtnTextNight: {
    color: '#34d399',
  },
  hashtagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hashtagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  hashtagBadgeNight: {
    backgroundColor: '#1f2937',
    borderColor: '#475569',
  },
  hashtagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
  },
  hashtagTextNight: {
    color: '#86efac',
  },
  removeBtn: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '700',
  },
  inputGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#dacdb3',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  flexInput: {
    flex: 1,
  },
  inputNight: {
    borderColor: '#475569',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
  },
  signerHint: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  signerHintNight: {
    color: '#9ca3af',
  },
  diaryCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2d7c0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    gap: 10,
  },
  feedItemNight: {
    backgroundColor: 'rgba(15,23,42,0.6)',
    borderColor: '#475569',
  },
  timestamp: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '600',
  },
  timestampNight: {
    color: '#6b7280',
  },
  addToDiaryMini: {
    alignSelf: 'flex-start',
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#b9dcbf',
    borderRadius: 999,
    backgroundColor: '#ecfdf3',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  addToDiaryMiniNight: {
    borderColor: '#475569',
    backgroundColor: '#0f172a',
  },
  addToDiaryMiniText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  addToDiaryMiniTextNight: {
    color: '#86efac',
  },
  emptyText: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginVertical: 20,
  },
  emptyTextNight: {
    color: '#9ca3af',
  },
  stickyBar: {
    position: 'absolute',
    bottom: 98,
    left: 14,
    right: 14,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#059669',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    gap: 8,
  },
  stickyBarInner: {
    flexDirection: 'row',
    gap: 12,
  },
  stickyBarInnerMobile: {},
  stickySecondary: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  stickySecondaryText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  stickyPrimary: {
    flex: 2,
    borderRadius: 8,
    backgroundColor: '#059669',
    paddingVertical: 12,
    alignItems: 'center',
  },
  readOnlyGuardHint: {
    fontSize: 11,
    color: '#ef4444',
    textAlign: 'center',
    fontWeight: '600',
  },
});
