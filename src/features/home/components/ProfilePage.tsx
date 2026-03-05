import { type Href } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { PostMediaRenderer } from '../../../components/PostMediaRenderer';
import { PlantPicker } from '../../../components/PlantPicker';
import { RunMenu } from './RunMenu';
import { getAvatarLabel, getDisplayName } from '../profileHelpers';

export function ProfilePage({ ctx }: { ctx: any }) {
  const {
    styles,
    diaryEditMode,
    isMobile,
    authState,
    profileMetadata,
    setActivePage,
    profilePubkeyText,
    runOptions,
    handleOpenDiaryEditor,
    setError,
    profilePosts,
    growmies,
    nostrSinceLabel,
    handleLogout,
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
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>Use the green Login button to connect Alby, or continue as anon.</Text>
            </View>
          )}

          <View
            style={[
              styles.profileHeaderCard,
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
                <View style={styles.profileMeta}>
                  <View style={styles.profileNameRow}>
                    <Text style={[styles.profileName, isMobile && styles.profileNameMobile]}>
                      {getDisplayName(authState, profileMetadata)}
                    </Text>
                  </View>
                  <Text style={styles.profilePubkey}>{profilePubkeyText}</Text>
                  {profileMetadata?.about ? <Text style={styles.profileBio}>{profileMetadata.about}</Text> : null}
                  <View style={styles.profileStatsRow}>
                    <View style={styles.profileStatPill}>
                      <Text style={styles.profileStatValue}>{runOptions.length}</Text>
                      <Text style={styles.profileStatLabel}>Diaries</Text>
                    </View>
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
                    <View style={styles.profileStatPill}>
                      <Text style={styles.profileStatValue}>{profilePosts.length}</Text>
                      <Text style={styles.profileStatLabel}>Notes</Text>
                    </View>
                    <View style={styles.profileStatPill}>
                      <Text style={styles.profileStatValue}>{growmies.length}</Text>
                      <Text style={styles.profileStatLabel}>Growmies</Text>
                    </View>
                    <View style={styles.profileStatPill}>
                      <Text style={styles.profileStatValue}>{nostrSinceLabel}</Text>
                      <Text style={styles.profileStatLabel}>Nostr since</Text>
                    </View>
                  </View>
                  {authState.isLoggedIn && (
                    <View style={styles.profileQuickActions}>
                      <TouchableOpacity style={styles.buttonSecondary} onPress={handleLogout}>
                        <Text style={styles.buttonText}>Logout to Anonymous</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>

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
                      styles={styles}
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

                    return (
                      <Pressable
                        key={diary.id}
                        style={({ hovered, pressed }) => [
                          styles.diaryTileCard,
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
                          <View style={styles.diaryTileImageFallback}>
                            <Text style={styles.diaryTileImageFallbackText}>No image</Text>
                          </View>
                        )}
                        <View style={styles.diaryTileMeta}>
                          <Text style={styles.diaryTileTitle}>{diary.title || 'Untitled diary'}</Text>
                          <Text style={styles.diaryTileSub}>
                            {(diary.plant || 'Plant n/a')} • {(diary.phase || 'Phase n/a')}
                          </Text>
                          <Text style={styles.diaryTileDate}>
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
            <View style={styles.panel}>
              <View style={styles.feedHeader}>
                <Text style={styles.panelTitle}>All Posts</Text>
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
              <View style={styles.feedFilterCard}>
                <View style={styles.feedFilterHeader}>
                  <Text style={styles.feedFilterTitle}>Profile hashtag filter</Text>
                  <TouchableOpacity
                    style={[styles.filterToggleBtn, !profileHashtagFilterEnabled && styles.filterToggleBtnMuted]}
                    onPress={() => setProfileHashtagFilterEnabled((prev: boolean) => !prev)}
                  >
                    <Text style={styles.filterToggleBtnText}>
                      {profileHashtagFilterEnabled ? 'Filter ON' : 'Filter OFF'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {profileHashtagFilterEnabled ? (
                  <>
                    <View style={styles.hashtagContainer}>
                      {profileHashtags.map((tag: string) => (
                        <View key={tag} style={styles.hashtagBadge}>
                          <Text style={styles.hashtagText}>#{tag}</Text>
                          <TouchableOpacity onPress={() => handleRemoveProfileHashtag(tag)}>
                            <Text style={styles.removeBtn}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                    <View style={styles.inputGroup}>
                      <TextInput
                        style={[styles.input, styles.flexInput]}
                        placeholder="Filter by hashtag"
                        placeholderTextColor="#999"
                        value={newProfileHashtag}
                        onChangeText={setNewProfileHashtag}
                      />
                      <TouchableOpacity style={styles.smallButton} onPress={handleAddProfileHashtag}>
                        <Text style={styles.buttonText}>Add</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <Text style={styles.signerHint}>Show all posts without hashtag filter.</Text>
                )}
              </View>
              {profileLoading && (
                <View style={styles.centerContent}>
                  <ActivityIndicator size="small" color="#059669" />
                  <Text style={styles.loadingText}>Loading profile posts...</Text>
                </View>
              )}
              {!profileLoading && visibleProfilePosts.length === 0 && (
                <Text style={styles.emptyText}>No profile posts found.</Text>
              )}
              {visibleProfilePosts.map((post: any) => (
                <View key={post.id} style={styles.diaryCard}>
                  <Text style={styles.timestamp}>{new Date(post.created_at * 1000).toLocaleString()}</Text>
                  <PostMediaRenderer content={post.content || ''} tags={post.tags} textNumberOfLines={5} />
                  {authState.isLoggedIn && (
                    <TouchableOpacity style={styles.addToDiaryMini} onPress={() => openAddToDiaryModal(post)}>
                      <Text style={styles.addToDiaryMiniText}>Add to Diary</Text>
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
