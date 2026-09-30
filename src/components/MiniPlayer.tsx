import React, { useState } from 'react';
import { useAudio } from '../context/AudioContext';
import { useTheme } from '../context/ThemeContext';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Shuffle,
  Volume2,
  VolumeX,
  Maximize2,
  Heart,
  Radio,
  ListPlus,
  ListMusic,
} from 'lucide-react';
import { AddToPlaylistModal } from './AddToPlaylistModal';
import { QueuePanel } from './QueuePanel';

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const MiniPlayer: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    repeatMode,
    isShuffle,
    isGrabbing,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    nextTrack,
    prevTrack,
    toggleRepeat,
    toggleShuffle,
    isExpandedPlayer,
    setIsExpandedPlayer,
    savedTracks,
    toggleSaveTrack,
    trackSources,
    currentSourceId,
    switchTrackSource,
  } = useAudio();

  const { themeConfig } = useTheme();

  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [showQueue, setShowQueue] = useState(false);

  if (!currentTrack || isExpandedPlayer) {
    return null;
  }

  const isSaved = savedTracks.some((t) => t.id === currentTrack.id);
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    seek(val);
  };

  return (
    <>
      <div
        id="mini-player"
        className="fixed bottom-0 left-0 right-0 z-40 px-4 py-3 bg-[#0c0c0f]/95 backdrop-blur-xl shadow-2xl select-none"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Left: Album artwork (click to expand normal player) & track info */}
          <div className="flex items-center gap-3 min-w-0 w-1/4">
            <div
              id="mini-album-art-container"
              onClick={() => setIsExpandedPlayer(true)}
              className="group relative w-12 h-12 shrink-0 rounded-2xl overflow-hidden cursor-pointer bg-zinc-800 shadow-md transition-transform duration-200 active:scale-95"
              title="Click album art to open full player"
            >
              <img
                src={currentTrack.artworkLarge || currentTrack.artworkSmall}
                alt={currentTrack.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-opacity duration-200 group-hover:opacity-75"
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                <Maximize2 className="w-4 h-4 text-white" />
              </div>
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span
                  id="mini-track-title"
                  onClick={() => setIsExpandedPlayer(true)}
                  className="text-sm font-semibold text-white truncate cursor-pointer hover:underline"
                >
                  {currentTrack.title}
                </span>
              </div>
              <span id="mini-track-artist" className="text-xs text-zinc-400 truncate">
                {currentTrack.artist}
              </span>
            </div>

            <button
              id="mini-save-track-btn"
              onClick={() => toggleSaveTrack(currentTrack)}
              className="p-1.5 text-zinc-400 hover:text-white transition-colors shrink-0"
              title={isSaved ? 'Remove from saved' : 'Save track'}
            >
              <Heart
                className={`w-4 h-4 ${isSaved ? 'fill-white text-white' : ''}`}
              />
            </button>

            {/* Source Button in Mini Player */}
            <div className="relative">
              <button
                id="mini-source-btn"
                onClick={() => setShowSourceDropdown(!showSourceDropdown)}
                className="p-1.5 text-zinc-400 hover:text-white transition-colors shrink-0 flex items-center justify-center w-8 h-8 rounded-xl bg-zinc-900/80 hover:bg-zinc-800"
                title="Select Audio/Video Source"
              >
                <Radio className="w-4 h-4" />
              </button>

              {/* Dropdown Above in Mini Player */}
              {showSourceDropdown && (
                <div className="absolute left-0 bottom-full mb-2 w-72 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl z-50 p-2 max-h-64 overflow-y-auto animate-in fade-in duration-150">
                  <div className="px-3 py-2 text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-800 mb-1">
                    Select Source ({trackSources.length})
                  </div>
                  {trackSources.length === 0 ? (
                    <div className="py-3 text-center text-xs text-zinc-500">No alternative sources</div>
                  ) : (
                    trackSources.map((src) => (
                      <button
                        key={src.id}
                        onClick={() => {
                          switchTrackSource(src.id);
                          setShowSourceDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors flex flex-col gap-0.5 ${
                          currentSourceId === src.id
                            ? 'bg-white text-black font-semibold'
                            : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate flex-1">{src.title}</span>
                          {src.durationSec && src.durationSec > 0 && (
                            <span className={`text-[10px] shrink-0 ${currentSourceId === src.id ? 'text-zinc-800 font-bold' : 'text-zinc-400'}`}>
                              {formatTime(src.durationSec)}
                            </span>
                          )}
                        </div>
                        <span className={`text-[10px] ${currentSourceId === src.id ? 'text-zinc-700' : 'text-zinc-500'}`}>
                          {src.owner}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <button
              id="mini-add-to-playlist-btn"
              onClick={() => setShowPlaylistModal(true)}
              className="p-1.5 text-zinc-400 hover:text-white transition-colors shrink-0"
              title="Add to Playlist"
            >
              <ListPlus className="w-4 h-4" />
            </button>
          </div>

          {/* Center: Controls & Scrubber */}
          <div className="flex flex-col items-center gap-1.5 w-2/4 max-w-xl">
            <div className="flex items-center gap-4">
              <button
                id="mini-shuffle-btn"
                onClick={toggleShuffle}
                className={`p-1.5 rounded-full transition-colors ${
                  isShuffle ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="Shuffle"
              >
                <Shuffle className="w-3.5 h-3.5" />
              </button>

              <button
                id="mini-prev-btn"
                onClick={prevTrack}
                className="p-1.5 text-zinc-400 hover:text-white transition-colors"
                title="Previous"
              >
                <SkipBack className="w-4 h-4 fill-current" />
              </button>

              <button
                id="mini-play-toggle-btn"
                onClick={togglePlay}
                disabled={isGrabbing}
                className={`w-10 h-10 rounded-full flex items-center justify-center hover:opacity-90 transition-transform active:scale-95 shadow-md disabled:opacity-50 ${themeConfig.bgAccent} ${themeConfig.buttonText}`}
                style={{ backgroundColor: themeConfig.primaryHex }}
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isGrabbing ? (
                  <Radio className="w-4 h-4 animate-pulse" />
                ) : isPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current translate-x-0.5" />
                )}
              </button>

              <button
                id="mini-next-btn"
                onClick={nextTrack}
                className="p-1.5 text-zinc-400 hover:text-white transition-colors"
                title="Next"
              >
                <SkipForward className="w-4 h-4 fill-current" />
              </button>

              <button
                id="mini-repeat-btn"
                onClick={toggleRepeat}
                className={`p-1.5 rounded-full relative transition-colors ${
                  repeatMode !== 'off' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="Repeat"
              >
                <Repeat className="w-3.5 h-3.5" />
                {repeatMode === 'one' && (
                  <span className="absolute -top-1 -right-1 text-[8px] font-bold bg-white text-black rounded-full px-1">
                    1
                  </span>
                )}
              </button>
            </div>

            {/* Timeline Bar */}
            <div className="w-full flex items-center gap-2 text-[11px] text-zinc-400">
              <span className="tabular-nums w-9 text-right">{formatTime(currentTime)}</span>
              <div className="relative flex-1 flex items-center group py-2">
                <div className="w-full h-1 group-hover:h-1.5 bg-zinc-800 rounded-full overflow-hidden relative transition-all">
                  <div
                    className="h-full rounded-full transition-all theme-bg-accent"
                    style={{ width: `${progressPercent}%`, backgroundColor: themeConfig.primaryHex }}
                  />
                </div>
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{ left: `${progressPercent}%` }}
                />
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  step={0.5}
                  value={currentTime}
                  onChange={handleSeekChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
              <span className="tabular-nums w-9">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right: Queue button, Volume & Expand */}
          <div className="flex items-center justify-end gap-3 w-1/4">
            {/* Queue button next to volume on the left of it */}
            <button
              id="mini-queue-btn"
              onClick={() => setShowQueue(!showQueue)}
              className={`p-1.5 transition-colors rounded-xl ${
                showQueue ? 'text-white bg-zinc-800' : 'text-zinc-400 hover:text-white'
              }`}
              title="Queue"
            >
              <ListMusic className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 group">
              <button
                id="mini-volume-toggle-btn"
                onClick={toggleMute}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-18 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>

            <button
              id="open-normal-player-btn"
              onClick={() => setIsExpandedPlayer(true)}
              className="p-1.5 text-zinc-400 hover:text-white transition-colors"
              title="Open Player"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Floating Queue Popup */}
      {showQueue && (
        <QueuePanel isFloating onClose={() => setShowQueue(false)} />
      )}

      <AddToPlaylistModal
        track={currentTrack}
        isOpen={showPlaylistModal}
        onClose={() => setShowPlaylistModal(false)}
      />
    </>
  );
};
