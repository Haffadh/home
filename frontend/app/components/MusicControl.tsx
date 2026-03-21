"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMusic } from "../context/MusicContext";
import { parseTrackUrl, extractYouTubeId } from "../../lib/music/musicPlayer";
import { getApiBase } from "../../lib/api";

type SearchResult = {
  videoId: string;
  title: string;
  channel: string;
  duration: string;
  thumbnail: string;
};

export default function MusicControl() {
  const music = useMusic();
  const [showPanel, setShowPanel] = useState(false);
  const [input, setInput] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!music) return null;
  const { isPlaying, currentTrack, volume, toggle, stop, play, setVolume } = music;

  function isUrl(s: string) {
    return /^https?:\/\//.test(s) || extractYouTubeId(s) !== null;
  }

  function handleSubmit() {
    const val = input.trim();
    if (!val) return;
    if (isUrl(val)) {
      play(parseTrackUrl(val));
      setInput("");
      setResults([]);
      setShowPanel(false);
    }
    // If not a URL, search is triggered by debounce
  }

  function playResult(r: SearchResult) {
    const url = `https://www.youtube.com/watch?v=${r.videoId}`;
    play(parseTrackUrl(url, r.title));
    setInput("");
    setResults([]);
    setShowPanel(false);
  }

  // Debounced search
  function handleInputChange(val: string) {
    setInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = val.trim();
    if (!trimmed || isUrl(trimmed)) { setResults([]); return; }
    if (trimmed.length < 2) return;
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = (await getApiBase(`/api/music/search?q=${encodeURIComponent(trimmed)}`)) as { ok?: boolean; results?: SearchResult[] };
        setResults(data?.results ?? []);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 500);
  }

  return (
    <div className="relative">
      {/* Header button */}
      <button
        type="button"
        onClick={() => setShowPanel((v) => !v)}
        className={`w-14 h-14 rounded-2xl flex items-center justify-center transition border ${
          isPlaying
            ? "bg-violet-500/15 border-violet-400/20 text-violet-300"
            : "bg-[#0f172a]/70 border-white/10 text-white/60 hover:text-white/80"
        }`}
        title={currentTrack ? currentTrack.title : "Music"}
      >
        <span className="text-2xl">{isPlaying ? "♫" : "♪"}</span>
      </button>

      {/* Dropdown */}
      {showPanel && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setShowPanel(false); setResults([]); }} />
          <div
            className="absolute right-0 top-full mt-2 z-50 w-80 max-h-[70vh] flex flex-col rounded-2xl p-4 animate-modal-in"
            style={{
              background: "rgba(18, 24, 38, 0.95)",
              backdropFilter: "blur(24px)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 20px 40px -12px rgba(0,0,0,0.5)",
            }}
          >
            {/* Now playing + controls */}
            {currentTrack && (
              <div className="mb-3 shrink-0">
                <p className="text-[0.625rem] text-white/40 uppercase tracking-wider mb-1">Now Playing</p>
                <p className="text-[0.8125rem] text-white/90 font-medium truncate">{currentTrack.title}</p>
                <div className="flex items-center gap-3 mt-2">
                  <button type="button" onClick={toggle}
                    className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/90 hover:bg-white/20 transition text-sm">
                    {isPlaying ? "⏸" : "▶"}
                  </button>
                  <button type="button" onClick={stop}
                    className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/50 hover:bg-white/20 transition text-xs">
                    ⏹
                  </button>
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-[0.5rem] text-white/30">🔈</span>
                    <input type="range" min={0} max={1} step={0.05} value={volume}
                      onChange={(e) => setVolume(Number(e.target.value))}
                      className="flex-1 h-1 accent-violet-400 cursor-pointer" />
                  </div>
                </div>
              </div>
            )}

            {/* Search / URL input */}
            <div className={`shrink-0 ${currentTrack ? "border-t border-white/[0.06] pt-3" : ""}`}>
              <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="flex gap-1.5">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="Search song or paste URL…"
                  autoFocus
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-[0.8125rem] text-white/90 placeholder:text-white/25 outline-none focus:border-white/20"
                />
                {input.trim() && isUrl(input.trim()) && (
                  <button type="submit"
                    className="rounded-lg bg-violet-600/50 hover:bg-violet-500/50 px-3 py-2 text-[0.75rem] font-medium text-white transition">
                    Play
                  </button>
                )}
              </form>
            </div>

            {/* Search results */}
            {(searching || results.length > 0) && (
              <div className="mt-2 flex-1 min-h-0 overflow-y-auto">
                {searching && results.length === 0 && (
                  <p className="text-[0.75rem] text-white/40 text-center py-3">Searching…</p>
                )}
                {results.map((r) => (
                  <button key={r.videoId} type="button" onClick={() => playResult(r)}
                    className="w-full flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-white/[0.06] transition text-left">
                    {r.thumbnail && (
                      <img src={r.thumbnail} alt="" className="w-12 h-9 rounded-lg object-cover shrink-0 bg-white/5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[0.8125rem] text-white/90 truncate">{r.title}</p>
                      <p className="text-[0.625rem] text-white/40 truncate">{r.channel}{r.duration ? ` · ${r.duration}` : ""}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Quick picks — shown when no search */}
            {!searching && results.length === 0 && !input.trim() && (
              <div className="border-t border-white/[0.06] pt-3 mt-3 shrink-0">
                <p className="text-[0.625rem] text-white/40 uppercase tracking-wider mb-1.5">Quick Picks</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { title: "Lo-fi Beats", url: "https://www.youtube.com/watch?v=jfKfPfyJRdk" },
                    { title: "Rain Sounds", url: "https://www.youtube.com/watch?v=yIQd2Ya0Ziw" },
                    { title: "Quran", url: "https://www.youtube.com/watch?v=WpMTDBvJMJI" },
                    { title: "Jazz", url: "https://www.youtube.com/watch?v=neV3EPgvZ3g" },
                  ].map((pick) => (
                    <button key={pick.title} type="button"
                      onClick={() => { play(parseTrackUrl(pick.url, pick.title)); setShowPanel(false); }}
                      className="rounded-lg bg-white/5 border border-white/[0.06] px-2.5 py-2 text-[0.75rem] text-white/70 hover:bg-white/10 hover:text-white/90 transition text-left truncate">
                      {pick.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
