export interface ExtractedMedia {
  cleanedText: string;
  images: string[];
  videos: string[];
  links: string[];
}

export interface ParsedTagMedia {
  images: string[];
  videos: string[];
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
  };
}

function classifyFromMime(url: string, mime?: string): 'image' | 'video' | 'none' {
  if (!mime) return 'none';
  const lowered = mime.toLowerCase();
  if (lowered.startsWith('image/')) return 'image';
  if (lowered.startsWith('video/')) return 'video';

  if (isImageUrl(url)) return 'image';
  if (isVideoUrl(url)) return 'video';
  return 'none';
}

export function parseMediaFromEventTags(event: { tags?: string[][] }): ParsedTagMedia {
  const tags = event.tags || [];
  const images: string[] = [];
  const videos: string[] = [];

  for (const tag of tags) {
    if (!Array.isArray(tag) || tag.length < 2) continue;
    const tagType = tag[0];

    if (tagType === 'url') {
      const url = normalizeUrl(String(tag[1] || ''));
      const mime = typeof tag[2] === 'string' ? tag[2] : undefined;
      const classified = classifyFromMime(url, mime);
      if (classified === 'image') images.push(url);
      if (classified === 'video') videos.push(url);
      continue;
    }

    if (tagType === 'imeta') {
      let url = '';
      let mime = '';
      for (let i = 1; i < tag.length; i++) {
        const part = String(tag[i] || '');
        if (part.startsWith('url ')) {
          url = normalizeUrl(part.slice(4));
        }
        if (part.startsWith('m ')) {
          mime = part.slice(2);
        }
      }
      if (!url) continue;
      const classified = classifyFromMime(url, mime);
      if (classified === 'image') images.push(url);
      if (classified === 'video') videos.push(url);
    }
  }

  return {
    images: unique(images).slice(0, 4),
    videos: unique(videos).slice(0, 1),
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
  };
}
