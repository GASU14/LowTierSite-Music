import React from 'react';
import { useAudio } from '../context/AudioContext';
import { Play, Pause, Trash2, X, Music, Volume2 } from 'lucide-react';
import { Track } from '../types';

interface QueuePanelProps {
  onClose?: () => void;
  className?: string;
  isFloating?: boolean;
}

function formatDuration(seconds?: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '3:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const QueuePanel: React.FC<QueuePanelProps> = ({
  onClose,
  className = '',
  isFloating = false,
}) => {
  const {
    currentTrack,
    queue,
    playTrack,
    isPlaying,
    togglePlay,
    getTrackDuration,
  } = useAudio();

  // Find index of current track in queue
  const currentIndex = currentTrack
    ? queue.findIndex((t) => t.id === currentTrack.id)
    : -1;

  // Next Up tracks are songs in the queue that come after the current track
  const nextUpTracks = currentIndex >= 0
    ? queue.slice(currentIndex + 1)
    : queue.filter((t) => t.id !== currentTrack?.id);

  const handlePlayFromQueue = (track: Track) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
    } else {
      // Play this track while maintaining the existing queue
      playTrack(track, queue);
    }
  };

  return (
    <div
      id="queue-panel"
      className={`flex flex-col bg-[#121216]/95 backdrop-blur-2xl rounded-3xl border border-zinc-800/80 shadow-2xl text-white overflow-hidden select-none animate-in fade-in duration-200 ${
        isFloating
          ? 'fixed right-4 bottom-24 z-50 w-80 sm:w-96 max-h-[580px]'
          : 'w-full h-full'
      } ${className}`}
    >
      {/* Queue Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/70 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-white tracking-tight">Queue</h2>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 no-scrollbar">
        {/* NOW PLAYING SECTION */}
        {currentTrack && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1">
              Now Playing
            </h3>
            <div
              onClick={() => togglePlay()}
              className="flex items-center gap-3 p-2.5 rounded-2xl bg-zinc-800/50 hover:bg-zinc-800/80 transition-all cursor-pointer group"
            >
              <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-zinc-900 shrink-0 shadow-md">
                <img
                  src={currentTrack.artworkSmall || currentTrack.artworkLarge}
                  alt={currentTrack.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-white text-white" />
                  ) : (
                    <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                  )}
                </div>
              </div>

              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-semibold text-white truncate">
                  {currentTrack.title}
                </span>
                <span className="text-xs text-zinc-400 truncate">
                  {currentTrack.artist}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* NEXT UP SECTION (Spotify reference exact format: Next Up) */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1">
            Next Up
          </h3>

          {nextUpTracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center text-zinc-500 gap-2 rounded-2xl bg-zinc-900/30">
              <Music className="w-8 h-8 opacity-40 stroke-1" />
              <p className="text-xs font-medium text-zinc-400">Your queue is empty</p>
              <p className="text-[11px] text-zinc-500">
                Play an album, song, or playlist to fill the queue.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {nextUpTracks.map((track, idx) => {
                const durSec = getTrackDuration(track) / 1000;
                return (
                  <div
                    key={`queue-${track.id}-${idx}`}
                    onClick={() => handlePlayFromQueue(track)}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-800/60 transition-colors cursor-pointer group"
                  >
                    <span className="w-5 text-center text-xs text-zinc-500 group-hover:hidden tabular-nums">
                      {idx + 1}
                    </span>
                    <button
                      className="w-5 hidden group-hover:flex items-center justify-center text-white"
                      title="Play"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                    </button>

                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-900 shrink-0 shadow-sm">
                      <img
                        src={track.artworkSmall || track.artworkLarge}
                        alt={track.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs font-semibold text-white truncate group-hover:underline">
                        {track.title}
                      </span>
                      <span className="text-[11px] text-zinc-400 truncate">
                        {track.artist}
                      </span>
                    </div>

                    <span className="text-[11px] text-zinc-500 tabular-nums shrink-0">
                      {formatDuration(durSec)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
