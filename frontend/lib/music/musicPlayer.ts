/**
 * Music player: supports direct audio URLs and YouTube embeds.
 * YouTube uses iframe API. Direct URLs use HTML5 Audio.
 */

export type TrackSource = "audio" | "youtube";

export type Track = {
  title: string;
  url: string;
  source: TrackSource;
  /** YouTube video ID (extracted from url) */
  videoId?: string;
};

// ─── State ───
let currentTrack: Track | null = null;
let audio: HTMLAudioElement | null = null;
let volume = 0.5;
let playing = false;
let onStateChange: (() => void) | null = null;

// ─── YouTube iframe state ───
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ytPlayer: any = null;
let ytReady = false;
const ytContainerId = "yt-music-player";
let ytApiLoaded = false;

declare global {
  interface Window { YT?: { Player: new (id: string, opts: Record<string, unknown>) => any }; onYouTubeIframeAPIReady?: () => void; }
}

function notifyChange() { onStateChange?.(); }

/** Register a callback for state changes (used by MusicContext) */
export function setOnStateChange(fn: (() => void) | null) { onStateChange = fn; }

/** Extract YouTube video ID from various URL formats */
export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/** Determine track source from URL */
export function parseTrackUrl(url: string, title?: string): Track {
  const videoId = extractYouTubeId(url);
  if (videoId) {
    return { title: title || "YouTube", url, source: "youtube", videoId };
  }
  return { title: title || url.split("/").pop()?.split("?")[0] || "Audio", url, source: "audio" };
}

// ─── YouTube API ───
function loadYouTubeApi(): Promise<void> {
  if (ytApiLoaded || (typeof window !== "undefined" && window.YT)) {
    ytApiLoaded = true;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve();
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const first = document.getElementsByTagName("script")[0];
    first?.parentNode?.insertBefore(tag, first);
    window.onYouTubeIframeAPIReady = () => { ytApiLoaded = true; resolve(); };
  });
}

function createYtPlayer(videoId: string) {
  if (typeof window === "undefined" || !window.YT) return;
  // Ensure container exists
  let container = document.getElementById(ytContainerId);
  if (!container) {
    container = document.createElement("div");
    container.id = ytContainerId;
    container.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;overflow:hidden;";
    document.body.appendChild(container);
  }
  if (ytPlayer) { try { ytPlayer.destroy(); } catch {} }
  ytReady = false;
  ytPlayer = new window.YT.Player(ytContainerId, {
    height: "1",
    width: "1",
    videoId,
    playerVars: { autoplay: 1, controls: 0, loop: 0 },
    events: {
      onReady: () => {
        ytReady = true;
        if (ytPlayer) {
          ytPlayer.setVolume(Math.round(volume * 100));
          ytPlayer.playVideo();
        }
        playing = true;
        notifyChange();
      },
      onStateChange: (event: { data: number }) => {
        if (event.data === 0) { // ENDED
          playing = false;
          notifyChange();
        }
      },
    },
  });
}

// ─── Audio element ───
function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    audio.volume = volume;
    audio.addEventListener("ended", () => { playing = false; notifyChange(); });
    audio.addEventListener("error", () => { playing = false; notifyChange(); });
  }
  return audio;
}

// ─── Public API ───

export function getVolume() { return volume; }
export function getCurrentTrack() { return currentTrack; }
export function isPlaying() { return playing; }

export function setVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  if (audio) audio.volume = volume;
  if (ytPlayer && ytReady) ytPlayer.setVolume(Math.round(volume * 100));
  notifyChange();
}

export async function playTrack(track: Track) {
  // Stop current
  stopPlayback();
  currentTrack = track;

  if (track.source === "youtube" && track.videoId) {
    await loadYouTubeApi();
    createYtPlayer(track.videoId);
  } else {
    const el = getAudio();
    el.src = track.url;
    el.volume = volume;
    el.loop = false;
    try { await el.play(); playing = true; } catch { playing = false; }
  }
  notifyChange();
}

export function pausePlayback() {
  if (currentTrack?.source === "youtube" && ytPlayer && ytReady) {
    ytPlayer.pauseVideo();
  } else if (audio) {
    audio.pause();
  }
  playing = false;
  notifyChange();
}

export function resumePlayback() {
  if (currentTrack?.source === "youtube" && ytPlayer && ytReady) {
    ytPlayer.playVideo();
    playing = true;
  } else if (audio && audio.src) {
    audio.play().catch(() => {});
    playing = true;
  }
  notifyChange();
}

export function stopPlayback() {
  if (ytPlayer) { try { ytPlayer.stopVideo(); ytPlayer.destroy(); } catch {} ytPlayer = null; ytReady = false; }
  if (audio) { audio.pause(); audio.currentTime = 0; audio.src = ""; }
  playing = false;
  currentTrack = null;
  notifyChange();
}

export function togglePlayback() {
  if (playing) pausePlayback();
  else resumePlayback();
}

// Legacy compat
export const startMusic = resumePlayback;
export const stopMusic = stopPlayback;
export const toggleMusic = togglePlayback;
export const isMusicPlaying = isPlaying;
