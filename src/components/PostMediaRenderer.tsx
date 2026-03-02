import type { ComponentProps } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { LinkPreviewCard } from './LinkPreviewCard';
import {
  enhanceMediaWithHead,
  extractMediaFromContent,
  parseMediaFromEventTags,
  stripStandaloneMediaLines,
  type ExtractedMedia,
} from '../lib/mediaExtraction';

interface PostMediaRendererProps {
  content: string;
  tags?: string[][];
  textNumberOfLines?: number;
  imageResizeMode?: 'cover' | 'contain';
  singleImageHeight?: number;
}

interface ViewerState {
  images: string[];
  index: number;
}

export function PostMediaRenderer({
  content,
  tags,
  textNumberOfLines = 6,
  imageResizeMode = 'cover',
  singleImageHeight,
}: PostMediaRendererProps) {
  const { width } = useWindowDimensions();
  const viewerScrollRef = useRef<ScrollView | null>(null);
  const baseMedia = useMemo<ExtractedMedia>(() => {
    const parsedFromText = extractMediaFromContent(content || '');
    const parsedFromTags = parseMediaFromEventTags({ tags });

    const images = Array.from(new Set([...parsedFromTags.images, ...parsedFromText.images])).slice(0, 4);
    const videos = Array.from(new Set([...parsedFromTags.videos, ...parsedFromText.videos])).slice(0, 1);
    const cleanedText = stripStandaloneMediaLines(parsedFromText.cleanedText, [...images, ...videos]);

    return {
      cleanedText,
      images,
      videos,
      links: parsedFromText.links.filter((url) => !images.includes(url) && !videos.includes(url)),
    };
  }, [content, tags]);

  const [media, setMedia] = useState<ExtractedMedia>(baseMedia);
  const [hiddenImages, setHiddenImages] = useState<Set<string>>(new Set());
  const [hideVideo, setHideVideo] = useState(false);
  const [viewer, setViewer] = useState<ViewerState | null>(null);

  useEffect(() => {
    setMedia(baseMedia);
    setHiddenImages(new Set());
    setHideVideo(false);

    let canceled = false;
    const unknownLinks = baseMedia.links.filter((url) => {
      const lower = url.toLowerCase();
      const likelyKnown = /\.(jpg|jpeg|png|webp|gif|avif|mp4|webm|mov)(\?.*)?$/.test(lower);
      return !likelyKnown;
    });

    if (unknownLinks.length === 0) {
      return () => {
        canceled = true;
      };
    }

    (async () => {
      const enhanced = await enhanceMediaWithHead(baseMedia, 1500);
      if (!canceled) {
        setMedia(enhanced);
      }
    })().catch(() => {
      // Ignore media enhancement errors.
    });

    return () => {
      canceled = true;
    };
  }, [baseMedia]);

  const visibleImages = media.images.filter((url) => !hiddenImages.has(url));
  const hasVideo = media.videos.length > 0 && !hideVideo;
  const modalImageWidth = Math.max(280, width - 32);

  const openViewer = (images: string[], index: number) => {
    setViewer({
      images,
      index,
    });
  };

  const closeViewer = () => setViewer(null);

  const goViewer = (direction: -1 | 1) => {
    if (!viewer) return;
    const nextIndex = Math.max(0, Math.min(viewer.images.length - 1, viewer.index + direction));
    setViewer({ ...viewer, index: nextIndex });
    viewerScrollRef.current?.scrollTo({
      x: nextIndex * modalImageWidth,
      animated: true,
    });
  };

  useEffect(() => {
    if (!viewer) return;
    viewerScrollRef.current?.scrollTo({
      x: viewer.index * modalImageWidth,
      animated: false,
    });
  }, [viewer, modalImageWidth]);

  return (
    <View>
      {media.cleanedText ? (
        <Text style={styles.text} numberOfLines={textNumberOfLines}>
          {media.cleanedText}
        </Text>
      ) : null}

      {visibleImages.length > 0 && (
        <View style={styles.imageBlock}>
          {visibleImages.length === 1 ? (
            <View style={styles.singleImageFrame}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => openViewer(visibleImages, 0)}
                style={styles.mediaPressable}
              >
                <Image
                  source={{ uri: visibleImages[0] }}
                  style={[
                    styles.singleImage,
                    imageResizeMode === 'contain' && styles.singleImageContain,
                    typeof singleImageHeight === 'number'
                      ? { height: singleImageHeight, aspectRatio: undefined }
                      : null,
                  ]}
                  resizeMode={imageResizeMode}
                  onError={() => setHiddenImages(new Set([...hiddenImages, visibleImages[0]]))}
                />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.imageGrid}>
              {visibleImages.map((url) => (
                <View key={url} style={styles.gridImageFrame}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => openViewer(visibleImages, visibleImages.indexOf(url))}
                    style={styles.mediaPressable}
                  >
                    <Image
                      source={{ uri: url }}
                      style={styles.gridImage}
                      resizeMode="cover"
                      onError={() => setHiddenImages(new Set([...hiddenImages, url]))}
                    />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {hasVideo && (
        <View style={styles.videoFrame}>
          {Platform.OS === 'web' ? (
            // Web-only native video element for stable browser playback.
            (() => {
              const VideoTag = 'video' as unknown as React.ComponentType<ComponentProps<'video'>>;
              return (
                <VideoTag
                  controls
                  preload="metadata"
                  style={styles.video}
                  src={media.videos[0]}
                  onError={() => setHideVideo(true)}
                />
              );
            })()
          ) : (
            <Text style={styles.videoLinkFallback}>Video preview available on web. Open link below.</Text>
          )}
        </View>
      )}

      {media.links.map((url) => (
        <LinkPreviewCard key={url} preview={{ url }} />
      ))}

      <Modal visible={viewer !== null} transparent animationType="fade" onRequestClose={closeViewer}>
        <View style={styles.viewerOverlay}>
          <TouchableOpacity style={styles.viewerBackdrop} activeOpacity={1} onPress={closeViewer} />
          {viewer && (
            <>
              <ScrollView
                ref={viewerScrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                contentOffset={{ x: viewer.index * modalImageWidth, y: 0 }}
                onMomentumScrollEnd={(evt) => {
                  const nextIndex = Math.round(evt.nativeEvent.contentOffset.x / modalImageWidth);
                  setViewer((prev) => (prev ? { ...prev, index: nextIndex } : prev));
                }}
              >
                {viewer.images.map((url) => (
                  <View key={url} style={[styles.viewerSlide, { width: modalImageWidth }]}>
                    <Image source={{ uri: url }} style={styles.viewerImage} resizeMode="contain" />
                  </View>
                ))}
              </ScrollView>

              {viewer.images.length > 1 && (
                <>
                  <TouchableOpacity
                    style={[styles.viewerNavButton, styles.viewerNavLeft]}
                    onPress={() => goViewer(-1)}
                    disabled={viewer.index <= 0}
                  >
                    <Text style={styles.viewerNavText}>‹</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.viewerNavButton, styles.viewerNavRight]}
                    onPress={() => goViewer(1)}
                    disabled={viewer.index >= viewer.images.length - 1}
                  >
                    <Text style={styles.viewerNavText}>›</Text>
                  </TouchableOpacity>
                  <Text style={styles.viewerCounter}>
                    {viewer.index + 1} / {viewer.images.length}
                  </Text>
                </>
              )}
            </>
          )}
          <TouchableOpacity style={styles.closeButton} onPress={closeViewer}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 13,
    lineHeight: 19,
    color: '#1f2937',
  },
  imageBlock: {
    marginTop: 10,
  },
  singleImageFrame: {
    width: '100%',
    minHeight: 170,
    maxHeight: 420,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
  },
  singleImage: {
    width: '100%',
    height: '100%',
    aspectRatio: 16 / 9,
  },
  singleImageContain: {
    backgroundColor: '#0f172a',
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridImageFrame: {
    width: '48.5%',
    minHeight: 120,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
  },
  gridImage: {
    width: '100%',
    height: '100%',
    aspectRatio: 1,
  },
  videoFrame: {
    marginTop: 10,
    minHeight: 160,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#111827',
    maxHeight: 480,
  },
  video: {
    width: '100%',
    height: '100%',
    maxHeight: 480,
  },
  videoLinkFallback: {
    color: '#e5e7eb',
    fontSize: 12,
    padding: 12,
  },
  mediaPressable: {
    width: '100%',
    height: '100%',
  },
  viewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  viewerSlide: {
    justifyContent: 'center',
    alignItems: 'center',
    height: '85%',
  },
  viewerBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  viewerImage: {
    width: '100%',
    height: '100%',
    maxWidth: 1200,
    maxHeight: 1200,
  },
  viewerNavButton: {
    position: 'absolute',
    top: '46%',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(17,24,39,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerNavLeft: {
    left: 10,
  },
  viewerNavRight: {
    right: 10,
  },
  viewerNavText: {
    color: '#f3f4f6',
    fontSize: 24,
    lineHeight: 26,
  },
  viewerCounter: {
    position: 'absolute',
    bottom: 60,
    color: '#e5e7eb',
    fontSize: 12,
    fontWeight: '600',
  },
  closeButton: {
    position: 'absolute',
    bottom: 14,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  closeButtonText: {
    color: '#f9fafb',
    fontSize: 13,
    fontWeight: '600',
  },
});
