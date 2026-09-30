import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { fetchLyrics } from '../services/api';
import { LyricsData, LyricLine, LyricWord } from '../types';
import { Mic, Disc, Loader2, Sparkles } from 'lucide-react';

interface LyricsViewProps {
  className?: string;
}

export const LyricsView: React.FC<LyricsViewProps> = ({ className = '' }) => {
  const { currentTrack, currentTime, duration, seek } = useAudio();
  const { userProfile, updateLyricsOffset } = useAuth();
  const { lyricProviders } = useTheme();

  const [lyricsData, setLyricsData] = useState<LyricsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const [isEditingOffset, setIsEditingOffset] = useState(false);
  const [tempOffsetInput, setTempOffsetInput] = useState('');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const scrollTimeoutRef = useRef<number | null>(null);

  // Get active provider IDs array in order
  const providerOrder = React.useMemo(() => {
    return lyricProviders.filter((p) => p.enabled).map((p) => p.id);
  }, [lyricProviders]);

  // Get lyrics offset for current track (starts at 0)
  const currentLyricsOffset = React.useMemo(() => {
    if (!currentTrack) return 0;
    if (userProfile?.lyricsOffsets && userProfile.lyricsOffsets[String(currentTrack.id)] !== undefined) {
      return userProfile.lyricsOffsets[String(currentTrack.id)];
    }
    try {
      const stored = localStorage.getItem('ytify_lyrics_offsets');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed[String(currentTrack.id)] !== undefined) {
          return parsed[String(currentTrack.id)];
        }
      }
    } catch {}
    return 0;
  }, [userProfile?.lyricsOffsets, currentTrack?.id]);

  const handleOffsetChange = (newOffset: number) => {
    if (!currentTrack) return;
    const clamped = Math.round(newOffset * 100) / 100;
    updateLyricsOffset(currentTrack.id, clamped);
  };

  const submitOffsetInput = () => {
    const num = parseFloat(tempOffsetInput);
    if (!isNaN(num)) {
      handleOffsetChange(num);
    }
    setIsEditingOffset(false);
  };

  // Fetch lyrics whenever current track or provider preference changes
  useEffect(() => {
    if (!currentTrack) {
      setLyricsData(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setUserHasScrolled(false);
    setIsFocused(true);

    fetchLyrics(currentTrack.title, currentTrack.artist, duration, providerOrder)
      .then((data) => {
        if (isMounted) {
          setLyricsData(data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [currentTrack?.id, providerOrder]);

  const adjustedTime = currentTime + currentLyricsOffset;

  // Find currently active lyric line index based on adjustedTime
  const currentLineIndex = React.useMemo(() => {
    if (!lyricsData || !lyricsData.hasSynced || lyricsData.syncedLyrics.length === 0) {
      return -1;
    }
    const lines = lyricsData.syncedLyrics;
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (adjustedTime >= lines[i].time - 0.15) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }, [lyricsData, adjustedTime]);

  // Smoothly scroll to active line inside container
  const scrollToActive = useCallback((behavior: ScrollBehavior = 'smooth', targetIdx?: number) => {
    if (!containerRef.current || !lyricsData?.syncedLyrics) return;

    const idx = targetIdx !== undefined ? targetIdx : currentLineIndex;
    if (idx < 0) {
      containerRef.current.scrollTo({ top: 0, behavior });
      setUserHasScrolled(false);
      return;
    }

    const targetLine = lyricsData.syncedLyrics[idx];
    if (!targetLine) return;

    const element = document.getElementById(`lyric-line-${targetLine.id}`);
    if (element && containerRef.current) {
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();

      const relativeTop = elementRect.top - containerRect.top + container.scrollTop;
      const targetScrollTop = relativeTop - container.clientHeight / 2 + elementRect.height / 2;

      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior,
      });
      setUserHasScrolled(false);
    }
  }, [currentLineIndex, lyricsData?.syncedLyrics]);

  // Auto-scroll on active line change if not manually scrolled
  useEffect(() => {
    if (!userHasScrolled && currentLineIndex >= 0) {
      scrollToActive('smooth', currentLineIndex);
    }
  }, [currentLineIndex, userHasScrolled, scrollToActive]);

  // Detect user manual scroll
  const handleUserScroll = () => {
    setUserHasScrolled(true);
    setIsFocused(false);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = window.setTimeout(() => {
      setUserHasScrolled(false);
    }, 10000);
  };

  if (!currentTrack) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 text-zinc-500 ${className}`}>
        <Disc className="w-8 h-8 mb-3 stroke-1" />
        <p className="text-sm">No track playing</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-[#121215]/90 backdrop-blur-xl rounded-3xl p-6 select-none shadow-2xl ${className}`}>
      {/* Header with Title, Provider Badge and Sync Offset */}
      <div className="flex items-center justify-between pb-4 mb-2 shrink-0 border-b border-zinc-800/50">
        <div className="flex items-center gap-2">
          <Mic className="w-4 h-4 text-white" />
          <span className="text-sm font-bold tracking-wider text-white">
            Lyrics
          </span>
          {lyricsData?.provider && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
              {lyricsData.provider}
            </span>
          )}
        </div>

        {/* Sync Controls: [-] [ Middle Click-to-Type Offset ] [+] and Sync Button */}
        {lyricsData?.hasSynced && (
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-zinc-800/90 rounded-full text-xs font-semibold overflow-hidden shadow-md">
              <button
                onClick={() => handleOffsetChange(currentLyricsOffset - 0.5)}
                className="px-2.5 py-1.5 hover:bg-zinc-700 text-zinc-300 transition-colors"
                title="Decrease sync timing by 0.5s (Standard)"
              >
                -
              </button>

              {isEditingOffset ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitOffsetInput();
                  }}
                  className="flex items-center px-1"
                >
                  <input
                    type="text"
                    autoFocus
                    value={tempOffsetInput}
                    onChange={(e) => setTempOffsetInput(e.target.value)}
                    onBlur={submitOffsetInput}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setIsEditingOffset(false);
                    }}
                    className="w-14 px-1 py-0.5 bg-zinc-950 text-white font-mono text-[11px] font-bold rounded focus:outline-none focus:ring-1 focus:ring-white text-center"
                    placeholder="0.00"
                  />
                </form>
              ) : (
                <button
                  onClick={() => {
                    setTempOffsetInput(String(Number(currentLyricsOffset.toFixed(2))));
                    setIsEditingOffset(true);
                  }}
                  className="px-2 text-white font-mono min-w-[38px] text-center text-[11px] hover:text-zinc-300 transition-colors py-1.5"
                  title="Click to type precise sync offset"
                >
                  {currentLyricsOffset > 0
                    ? `+${Number(currentLyricsOffset.toFixed(2))}`
                    : `${Number(currentLyricsOffset.toFixed(2))}`}s
                </button>
              )}

              <button
                onClick={() => handleOffsetChange(currentLyricsOffset + 0.5)}
                className="px-2.5 py-1.5 hover:bg-zinc-700 text-zinc-300 transition-colors"
                title="Increase sync timing by 0.5s (Standard)"
              >
                +
              </button>
            </div>

            <button
              id="sync-lyrics-btn"
              onClick={() => {
                setIsFocused(true);
                setUserHasScrolled(false);
                scrollToActive('smooth', currentLineIndex);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-md active:scale-95 ${
                userHasScrolled
                  ? 'bg-white text-black'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
              }`}
              title="Sync lyrics to current time"
            >
              Sync
            </button>
          </div>
        )}
      </div>

      {/* Lyrics Content Container (Apple Music Word-by-Word Karaoke UI) */}
      <div
        ref={containerRef}
        onWheel={handleUserScroll}
        onTouchMove={handleUserScroll}
        className="relative flex-1 overflow-y-auto pr-2 py-4 space-y-5 scroll-smooth no-scrollbar"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-zinc-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-white" />
            <span className="text-xs font-medium">Fetching real-time lyrics...</span>
          </div>
        ) : lyricsData?.isInstrumental ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-400 gap-2">
            <Sparkles className="w-6 h-6 text-zinc-500" />
            <p className="text-sm font-semibold">Instrumental Track</p>
          </div>
        ) : lyricsData?.hasSynced ? (
          lyricsData.syncedLyrics.map((line, index) => {
            const isActive = index === currentLineIndex;
            const isPast = index < currentLineIndex;

            return (
              <div
                key={line.id}
                ref={isActive ? activeLineRef : null}
                id={`lyric-line-${line.id}`}
                onClick={() => {
                  seek(line.time);
                  scrollToActive('smooth');
                }}
                className={`cursor-pointer transition-colors duration-200 py-1 px-2 rounded-xl ${
                  isActive
                    ? 'opacity-100'
                    : isPast
                    ? 'opacity-40 hover:opacity-80'
                    : 'opacity-30 hover:opacity-80'
                }`}
              >
                {line.words && line.words.length > 0 ? (
                  /* Clean Normal Word-by-Word Highlighting (No Glow, No Extra Spacing) */
                  <p className="leading-snug text-xl sm:text-2xl font-bold tracking-normal">
                    {line.words.map((w, wIdx) => {
                      const wordActive = adjustedTime >= w.time - 0.05;
                      return (
                        <span
                          key={wIdx}
                          className={`transition-colors duration-150 ${
                            isActive
                              ? wordActive
                                ? 'text-white'
                                : 'text-white/30'
                              : 'text-zinc-400'
                          }`}
                        >
                          {w.word}{wIdx < line.words!.length - 1 ? ' ' : ''}
                        </span>
                      );
                    })}
                  </p>
                ) : (
                  /* Clean Standard Line Highlighting */
                  <p
                    className={`leading-snug text-xl sm:text-2xl font-bold transition-colors duration-200 ${
                      isActive ? 'text-white' : 'text-zinc-400'
                    }`}
                  >
                    {line.text}
                  </p>
                )}
              </div>
            );
          })
        ) : lyricsData?.plainLyrics ? (
          <div className="text-zinc-200 leading-relaxed text-base sm:text-lg font-medium whitespace-pre-line py-2 px-2">
            {lyricsData.plainLyrics}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-500 gap-2">
            <Mic className="w-8 h-8 opacity-40" />
            <p className="text-sm font-medium">No lyrics found for this track</p>
          </div>
        )}
      </div>
    </div>
  );
};
