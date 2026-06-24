"use client";

import { useMemo } from "react";
import { Film } from "lucide-react";

type VideoEmbedProps = {
  url: string;
  title?: string;
};

type VideoSource =
  | { type: "youtube"; embedUrl: string }
  | { type: "vimeo"; embedUrl: string }
  | { type: "direct"; url: string }
  | { type: "unknown" };

function extractYouTubeId(url: string): string | null {
  // youtube.com/watch?v=ID
  const match =
    url.match(
      /(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    ) ??
    // youtu.be/ID
    url.match(/(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/) ??
    // youtube.com/embed/ID
    url.match(
      /(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    ) ??
    // youtube.com/shorts/ID
    url.match(
      /(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    );
  return match ? match[1] : null;
}

function extractVimeoId(url: string): string | null {
  // vimeo.com/ID or player.vimeo.com/video/ID
  const match = url.match(
    /(?:https?:\/\/)?(?:www\.|player\.)?vimeo\.com\/(?:video\/)?(\d+)/,
  );
  return match ? match[1] : null;
}

function parseVideoUrl(url: string): VideoSource {
  if (!url) return { type: "unknown" };

  const trimmedUrl = url.trim();

  // YouTube: youtube.com{,/shorts,/embed}/ID or youtube.com/watch?v=ID
  const youtubeId = extractYouTubeId(trimmedUrl);
  if (youtubeId) {
    return {
      type: "youtube",
      embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0`,
    };
  }

  // Vimeo: vimeo.com/ID or player.vimeo.com/video/ID
  const vimeoId = extractVimeoId(trimmedUrl);
  if (vimeoId) {
    return {
      type: "vimeo",
      embedUrl: `https://player.vimeo.com/video/${vimeoId}`,
    };
  }

  // Direct video file (.mp4, .webm, .ogg)
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(trimmedUrl)) {
    return { type: "direct", url: trimmedUrl };
  }

  // If it looks like any http/https URL but not a video file, treat as unknown
  return { type: "unknown" };
}

export function isEmbeddableVideoUrl(url: string): boolean {
  const parsed = parseVideoUrl(url);
  return parsed.type !== "unknown";
}

export function isYouTubeOrVimeoUrl(url: string): boolean {
  const parsed = parseVideoUrl(url);
  return parsed.type === "youtube" || parsed.type === "vimeo";
}

export default function VideoEmbed({ url, title }: VideoEmbedProps) {
  const source = useMemo(() => parseVideoUrl(url), [url]);

  if (source.type === "unknown") {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl bg-slate-100 py-12 text-slate-400">
        <Film className="mb-3 h-10 w-10" />
        <p className="text-sm">Không thể xác định nguồn video.</p>
      </div>
    );
  }

  if (source.type === "direct") {
    return (
      <video
        controls
        className="w-full rounded-3xl bg-slate-900"
        src={source.url}
      >
        Trình duyệt của bạn không hỗ trợ thẻ video.
      </video>
    );
  }

  return (
    <div className="relative w-full overflow-hidden rounded-3xl bg-slate-900" style={{ paddingBottom: "56.25%" }}>
      <iframe
        src={source.embedUrl}
        title={title ?? "Video nhúng"}
        className="absolute left-0 top-0 h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
