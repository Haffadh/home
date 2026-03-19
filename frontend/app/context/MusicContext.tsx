"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as player from "../../lib/music/musicPlayer";
import type { Track } from "../../lib/music/musicPlayer";

type MusicContextValue = {
  isPlaying: boolean;
  currentTrack: Track | null;
  volume: number;
  play: (track: Track) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  toggle: () => void;
  setVolume: (v: number) => void;
  /** Legacy compat */
  start: () => void;
};

const MusicContext = createContext<MusicContextValue | null>(null);

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [volume, setVolumeState] = useState(0.5);

  // Sync state from player
  useEffect(() => {
    player.setOnStateChange(() => {
      setIsPlaying(player.isPlaying());
      setCurrentTrack(player.getCurrentTrack());
      setVolumeState(player.getVolume());
    });
    return () => player.setOnStateChange(null);
  }, []);

  const play = useCallback((track: Track) => { player.playTrack(track); }, []);
  const pause = useCallback(() => { player.pausePlayback(); }, []);
  const resume = useCallback(() => { player.resumePlayback(); }, []);
  const stop = useCallback(() => { player.stopPlayback(); }, []);
  const toggle = useCallback(() => { player.togglePlayback(); }, []);
  const setVolume = useCallback((v: number) => { player.setVolume(v); setVolumeState(v); }, []);

  // Scene integration: listen for music_mode events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.event !== "music_mode") return;
      const mode = detail?.mode;
      if (mode === "stop" || mode === "off") player.stopPlayback();
      else if (mode === "on") player.resumePlayback();
    };
    window.addEventListener("realtime", handler);
    return () => window.removeEventListener("realtime", handler);
  }, []);

  return (
    <MusicContext.Provider value={{ isPlaying, currentTrack, volume, play, pause, resume, stop, toggle, setVolume, start: resume }}>
      {children}
    </MusicContext.Provider>
  );
}

export function useMusic() {
  return useContext(MusicContext);
}
