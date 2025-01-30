import path from "npm:path";
import { SupportedContentType } from "../types.ts";

const mediaExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".ico",
  ".svg",
  ".mp4",
  ".webm",
  ".ogg",
  ".mp3",
  ".wav",
]);

export function isMediaFile(url: string): boolean {
  const extension = path.extname(url).toLowerCase();
  return mediaExtensions.has(extension);
}

export function getContentType(url: string): SupportedContentType {
  if (isMediaFile(url)) {
    return "media";
  }

  const extension = path.extname(url).toLowerCase();
  switch (extension) {
    case ".html":
      return "html";
    case ".css":
      return "css";
    case ".js":
      return "js";
    default:
      return "html"; // Default to HTML if no extension
  }
}

export function getMimeType(url: string): string {
  const extension = path.extname(url).toLowerCase();
  switch (extension) {
    // Images
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".ico":
      return "image/x-icon";
    case ".svg":
      return "image/svg+xml";
    // Videos
    case ".mp4":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".ogg":
      return "video/ogg";
    // Audio
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    // Web content
    case ".html":
      return "text/html";
    case ".css":
      return "text/css";
    case ".js":
      return "application/javascript";
    default:
      return "text/html";
  }
}
