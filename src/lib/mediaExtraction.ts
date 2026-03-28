export interface ExtractedMedia {
  cleanedText: string;
  images: string[];
  videos: string[];
  links: string[];
  metadata: MediaMetadata[];
}

export interface MediaMetadata {
  url: string;
  type: 'image' | 'video';
  mime?: string;
  sha256?: string;
  dim?: string;
  size?: number;
  alt?: string;
  fallback?: string[];
}

export interface ParsedTagMedia {
  images: string[];
  videos: string[];
  metadata: MediaMetadata[];
}

export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov'];
const URL_REGEX = /https?:\/\/\S+/gi;

function normalizeUrl(raw: string): string {
  return raw.trim().replace(/[)\].,"']+$/g, '');
}

function extFromUrl(url: string): string {
  const withoutQuery = url.split('?')[0].split('#')[0];
  const parts = withoutQuery.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function isImageUrl(url: string): boolean {
  return IMAGE_EXTENSIONS.includes(extFromUrl(url));
}

function isVideoUrl(url: string): boolean {
  return VIDEO_EXTENSIONS.includes(extFromUrl(url));
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export function stripStandaloneMediaLines(content: string, mediaUrls: string[]): string {
  if (!content) return '';
  if (mediaUrls.length === 0) return content.trim();

  const mediaSet = new Set(mediaUrls.map((url) => normalizeUrl(url)));
  const lines = content.split('\n');
  const cleaned = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    const match = trimmed.match(URL_REGEX);
    if (!match || match.length !== 1) return true;
    const normalized = normalizeUrl(match[0]);
    return !(normalized === trimmed && mediaSet.has(normalized));
  });

  return cleaned.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function extractMediaFromContent(content: string): ExtractedMedia {
  const matches = content.match(URL_REGEX) || [];
  const urls = unique(matches.map(normalizeUrl));

  const images: string[] = [];
  const videos: string[] = [];
  const links: string[] = [];

  for (const url of urls) {
    if (isImageUrl(url)) {
      images.push(url);
      continue;
    }
    if (isVideoUrl(url)) {
      videos.push(url);
      continue;
    }
    links.push(url);
  }

  const limitedImages = images.slice(0, 4);
  const limitedVideos = videos.slice(0, 1);
  const cleanedText = stripStandaloneMediaLines(content, [...limitedImages, ...limitedVideos]);

  return {
    cleanedText,
    images: limitedImages,
    videos: limitedVideos,
    links,
    metadata: [],
  };
}

function classifyFromMime(url: string, mime?: string): 'image' | 'video' | 'none' {
  const mimeLower = (mime || '').toLowerCase();
  if (mimeLower.startsWith('image/')) return 'image';
  if (mimeLower.startsWith('video/')) return 'video';

  const ext = extFromUrl(url);
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  return 'none';
}

export function parseMediaFromEventTags(event: { tags?: string[][] }): ParsedTagMedia {
  const tags = event.tags || [];
  const images: string[] = [];
  const videos: string[] = [];
  const metadata: MediaMetadata[] = [];

  for (const tag of tags) {
    if (!Array.isArray(tag) || tag.length < 2) continue;
    const tagType = tag[0];

    // NIP-94: File Metadata (Alternative to kind:1, uses tags for meta)
    if (tagType === 'url') {
      const url = normalizeUrl(String(tag[1] || ''));
      const mime = typeof tag[2] === 'string' ? tag[2] : undefined;
      const classified = classifyFromMime(url, mime);
      if (classified === 'none') continue;

      const meta: MediaMetadata = { url, type: classified, mime };
      const sha256 = tags.find((t) => t[0] === 'x')?.[1];
      if (sha256) meta.sha256 = sha256;
      const size = tags.find((t) => t[0] === 'size')?.[1];
      if (size) meta.size = parseInt(size, 10);
      const dim = tags.find((t) => t[0] === 'dim')?.[1];
      if (dim) meta.dim = dim;
      const alt = tags.find((t) => t[0] === 'alt')?.[1];
      if (alt) meta.alt = alt;

      if (classified === 'image') images.push(url);
      if (classified === 'video') videos.push(url);
      metadata.push(meta);
      continue;
    }

    // NIP-92: imeta (Inline Metadata for any kind)
    if (tagType === 'imeta') {
      const meta: Partial<MediaMetadata> = {};
      for (let i = 1; i < tag.length; i++) {
        const part = String(tag[i] || '');
        if (part.startsWith('url ')) meta.url = normalizeUrl(part.slice(4));
        else if (part.startsWith('m ')) meta.mime = part.slice(2);
        else if (part.startsWith('x ')) meta.sha256 = part.slice(2);
        else if (part.startsWith('dim ')) meta.dim = part.slice(4);
        else if (part.startsWith('size ')) meta.size = parseInt(part.slice(5), 10);
        else if (part.startsWith('alt ')) meta.alt = part.slice(4);
        else if (part.startsWith('fallback ')) {
          if (!meta.fallback) meta.fallback = [];
          meta.fallback.push(normalizeUrl(part.slice(9)));
        }
      }

      if (meta.url) {
        const classified = classifyFromMime(meta.url, meta.mime);
        if (classified !== 'none') {
          const finalMeta: MediaMetadata = {
            url: meta.url,
            type: classified,
            ...meta,
          };
          if (classified === 'image') images.push(meta.url);
          if (classified === 'video') videos.push(meta.url);
          metadata.push(finalMeta);
        }
      }
    }
  }

  return {
    images: unique(images).slice(0, 4),
    videos: unique(videos).slice(0, 1),
    metadata: metadata.slice(0, 8),
  };
}

async function headContentType(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method: 'HEAD', signal: controller.signal });
    const contentType = response.headers.get('content-type');
    return contentType;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function shouldProbeWithHead(url: string): boolean {
  // On web, probing third-party origins triggers noisy CORS errors in console.
  if (typeof window !== 'undefined' && typeof window.location !== 'undefined') {
    try {
      const parsed = new URL(url);
      return parsed.origin === window.location.origin;
    } catch {
      return false;
    }
  }
  return true;
}

export async function enhanceMediaWithHead(
  initial: ExtractedMedia,
  timeoutMs: number = 1500
): Promise<ExtractedMedia> {
  if (initial.links.length === 0) {
    return initial;
  }

  const nextImages = [...initial.images];
  const nextVideos = [...initial.videos];
  const stillLinks: string[] = [];

  await Promise.all(
    initial.links.map(async (url) => {
      if (!shouldProbeWithHead(url)) {
        stillLinks.push(url);
        return;
      }
      const type = await headContentType(url, timeoutMs);
      const lowered = (type || '').toLowerCase();
      if (lowered.includes('image/') && nextImages.length < 4) {
        nextImages.push(url);
        return;
      }
      if (lowered.includes('video/') && nextVideos.length < 1) {
        nextVideos.push(url);
        return;
      }
      stillLinks.push(url);
    })
  );

  const cleanedText = stripStandaloneMediaLines(initial.cleanedText, [...nextImages, ...nextVideos]);

  return {
    cleanedText,
    images: unique(nextImages).slice(0, 4),
    videos: unique(nextVideos).slice(0, 1),
    links: unique(stillLinks),
    metadata: initial.metadata,
  };
}
