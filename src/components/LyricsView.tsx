import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { fetchLyrics } from '../services/api';
import { LyricsData } from '../types';
import { Mic, Disc, Loader2 } from 'lucide-react';

interface LyricsViewProps {
  className?: string;
}

export const LyricsView: React.FC<LyricsViewProps> = ({ className = '' }) => {
  const { currentTrack, currentTime, duration, seek } = useAudio();
  const { userProfile, updateLyricsOffset } = useAuth();
  const [lyricsData, setLyricsData] = useState<LyricsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const scrollTimeoutRef = useRef<number | null>(null);

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
    const clamped = Math.round(newOffset * 10) / 10;
    updateLyricsOffset(currentTrack.id, clamped);
  };

  // Fetch lyrics whenever current track changes
  useEffect(() => {
    if (!currentTrack) {
      setLyricsData(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setUserHasScrolled(false);
    setIsFocused(false);

    fetchLyrics(currentTrack.title, currentTrack.artist, duration)
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
  }, [currentTrack?.id]);

  // Find currently active lyric line index based on currentTime + offset
  const currentLineIndex = React.useMemo(() => {
    if (!lyricsData || !lyricsData.hasSynced || lyricsData.syncedLyrics.length === 0) {
      return -1;
    }
    const lines = lyricsData.syncedLyrics;
    const adjustedTime = currentTime + currentLyricsOffset;
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (adjustedTime >= lines[i].time - 0.2) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }, [lyricsData, currentTime, currentLyricsOffset]);

  // Smoothly scroll to active line inside container matching exact adjusted time
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

  // Auto-scroll on active line change ONLY if isFocused is true
  useEffect(() => {
    if (isFocused && !userHasScrolled && currentLineIndex >= 0) {
      scrollToActive('smooth', currentLineIndex);
    }
  }, [currentLineIndex, isFocused, userHasScrolled, scrollToActive]);

  // Detect user manual scroll
  const handleUserScroll = () => {
    setUserHasScrolled(true);
    setIsFocused(false);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = window.setTimeout(() => {
      setUserHasScrolled(false);
    }, 12000);
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
    <div className={`flex flex-col h-full bg-[#121215] rounded-3xl p-6 select-none ${className}`}>
      {/* Header with Title and Sync Button */}
      <div className="flex items-center justify-between pb-3 mb-3 shrink-0">
        <div>
          <span className="text-sm font-bold tracking-wider uppercase text-zinc-300">
            Lyrics
          </span>
        </div>

        {/* Sync Button and Lyrics Timing Offset Control */}
        {lyricsData?.hasSynced && (
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-zinc-800 rounded-full text-xs font-semibold overflow-hidden shadow-md">
              <button
                onClick={() => handleOffsetChange(currentLyricsOffset - 0.5)}
                className="px-2.5 py-1.5 hover:bg-zinc-700 text-zinc-300 transition-colors"
                title="Decrease lyrics sync timing by 0.5s"
              >
                -
              </button>
              <span className="px-2 text-white font-mono min-w-[36px] text-center">
                {currentLyricsOffset > 0 ? `+${currentLyricsOffset.toFixed(1)}` : currentLyricsOffset.toFixed(1)}s
              </span>
              <button
                onClick={() => handleOffsetChange(currentLyricsOffset + 0.5)}
                className="px-2.5 py-1.5 hover:bg-zinc-700 text-zinc-300 transition-colors"
                title="Increase lyrics sync timing by 0.5s"
              >
                +
              </button>
            </div>

            <button
              id="sync-lyrics-btn"
              onClick={() => {
                setIsFocused(true);
                setUserHasScrolled(false);
                const adjustedTime = currentTime + currentLyricsOffset;
                let targetIdx = -1;
                if (lyricsData?.syncedLyrics) {
                  for (let i = 0; i < lyricsData.syncedLyrics.length; i++) {
                    if (adjustedTime >= lyricsData.syncedLyrics[i].time - 0.2) {
                      targetIdx = i;
                    } else {
                      break;
                    }
                  }
                }
                scrollToActive('smooth', targetIdx);
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

      {/* Lyrics Content Container */}
      <div
        ref={containerRef}
        onWheel={handleUserScroll}
        onTouchMove={handleUserScroll}
        className="relative flex-1 overflow-y-auto pr-2 space-y-3.5 scroll-smooth"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-zinc-400 gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
            <span className="text-xs">Loading lyrics...</span>
          </div>
        ) : lyricsData?.isInstrumental ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-400">
            <p className="text-sm">Instrumental Track</p>
          </div>
        ) : lyricsData?.hasSynced ? (
          lyricsData.syncedLyrics.map((line, index) => {
            const isActive = index === currentLineIndex;
            const isPast = index < currentLineIndex;

            let styleClasses = 'text-zinc-500';
            if (isActive) {
              styleClasses = 'text-white text-lg sm:text-xl font-bold';
            } else if (isPast) {
              styleClasses = 'text-zinc-400 text-sm sm:text-base font-medium';
            } else {
              styleClasses = 'text-zinc-600 text-sm sm:text-base font-normal';
            }

            return (
              <div
                key={line.id}
                ref={isActive ? activeLineRef : null}
                id={`lyric-line-${line.id}`}
                onClick={() => {
                  seek(line.time);
                  scrollToActive('smooth');
                }}
                className={`cursor-pointer transition-colors duration-150 py-1.5 px-3 rounded-lg hover:text-white ${styleClasses}`}
              >
                {line.text}
              </div>
            );
          })
        ) : lyricsData?.plainLyrics ? (
          <div className="text-zinc-300 leading-relaxed text-sm whitespace-pre-line py-2">
            {lyricsData.plainLyrics}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-500">
            <p className="text-sm">No lyrics found for this track</p>
          </div>
        )}
      </div>
    </div>
  );
};
