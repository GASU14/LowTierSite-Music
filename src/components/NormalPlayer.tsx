import React, { useRef, useEffect, useState } from 'react';
import { useAudio } from '../context/AudioContext';
import { LyricsView } from './LyricsView';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Shuffle,
  Volume2,
  VolumeX,
  Heart,
  Radio,
  Disc,
  Video,
  Maximize2,
  Minimize2,
  ListPlus,
} from 'lucide-react';
import { AddToPlaylistModal } from './AddToPlaylistModal';

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const NormalPlayer: React.FC = () => {
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
    activeVideoId,
    musicVideoId,
    isVideoMode,
    setIsVideoMode,
    switchVideoSource,
    reparentYtPlayer,
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

  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!videoContainerRef.current) return;
    if (!document.fullscreenElement) {
      videoContainerRef.current.requestFullscreen?.().catch(console.error);
    } else {
      document.exitFullscreen?.().catch(console.error);
    }
  };

  // Reparent the live YouTube player into the video container when video mode is active
  useEffect(() => {
    if (isExpandedPlayer && isVideoMode && videoContainerRef.current) {
      reparentYtPlayer(videoContainerRef.current);
    } else {
      reparentYtPlayer(null);
    }
    return () => {
      reparentYtPlayer(null);
    };
  }, [isExpandedPlayer, isVideoMode, activeVideoId, reparentYtPlayer]);

  if (!isExpandedPlayer || !currentTrack) {
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
        id="normal-player-modal"
        className="fixed inset-0 z-[100] bg-[#09090b] flex flex-col p-5 sm:p-8 select-none overflow-y-auto animate-in fade-in duration-200"
      >
        {/* Ambient Blurred Artwork Background */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden bg-[#09090b] -z-10">
          <div
            className="absolute -top-[15%] -left-[15%] w-[130%] h-[130%] opacity-25 blur-[120px] bg-cover bg-center transition-all duration-1000 scale-110"
            style={{ backgroundImage: `url(${currentTrack.artworkLarge || currentTrack.artworkSmall})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#09090b]/70 via-[#09090b]/90 to-[#09090b]" />
        </div>

        {/* Top Bar: Minimize button and Track Info (No borders) */}
        <div className="max-w-6xl w-full mx-auto flex items-center justify-between pb-6 shrink-0 relative z-10">
          <button
            id="minimize-player-btn"
            onClick={() => setIsExpandedPlayer(false)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-zinc-900/90 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors shadow-md"
          >
            <ChevronDown className="w-4 h-4" />
            <span className="text-xs font-semibold">Minimize</span>
          </button>

          {/* Song vs Music Video Mode Switcher */}
          <div className="flex items-center p-1 bg-zinc-900/90 rounded-full shadow-md">
            <button
              id="player-mode-song-btn"
              onClick={() => setIsVideoMode(false)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                !isVideoMode
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Disc className="w-3.5 h-3.5" />
              <span>Audio</span>
            </button>
            <button
              id="player-mode-video-btn"
              onClick={() => setIsVideoMode(true)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                isVideoMode
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>Video</span>
            </button>
          </div>

          {/* Switch to Official Music Video if available */}
          <div className="flex items-center gap-2">
            {isVideoMode && musicVideoId && musicVideoId !== activeVideoId && (
              <button
                id="switch-official-video-btn"
                onClick={() => switchVideoSource(musicVideoId)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-xs text-white font-medium transition-all shadow-md"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Official Video</span>
              </button>
            )}
          </div>
        </div>

        {/* Main Content: Left Column (Cover + Controls), Right Column (Lyrics) */}
        <div className="max-w-6xl w-full mx-auto flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center relative z-10">
          {/* Left Column: Cover / Video & Primary Controls */}
          <div className="flex flex-col items-center max-w-md mx-auto w-full">
            {/* Cover Art OR Live Video (No borders) */}
            {!isVideoMode ? (
              <div
                id="normal-album-art"
                className="w-72 h-72 sm:w-84 sm:h-84 rounded-3xl overflow-hidden shadow-2xl bg-zinc-900 mb-8 shrink-0 group relative"
              >
                <img
                  src={currentTrack.artworkOriginal || currentTrack.artworkLarge}
                  alt={currentTrack.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover select-none"
                />
              </div>
            ) : (
              <div
                id="normal-video-container"
                ref={videoContainerRef}
                className="w-full aspect-video rounded-3xl overflow-hidden shadow-2xl bg-black mb-8 relative flex items-center justify-center shrink-0 group"
              >
                {/* Transparent click overlay to catch video taps & toggle play cleanly without YouTube popups */}
                <div
                  id="video-click-overlay"
                  onClick={togglePlay}
                  className="absolute inset-0 z-[130] cursor-pointer flex items-center justify-center group-hover:bg-black/20 transition-colors"
                >
                  {/* Subtle hover play/pause indicator */}
                  <div className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100 shadow-xl pointer-events-none">
                    {isPlaying ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white ml-0.5" />}
                  </div>
                </div>

                {/* Fullscreen Button */}
                <button
                  id="video-fullscreen-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFullscreen();
                  }}
                  className="absolute top-3 right-3 z-[160] p-2.5 rounded-full bg-black/70 hover:bg-black text-white opacity-80 hover:opacity-100 transition-all hover:scale-105 active:scale-95 shadow-md"
                  title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Video'}
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>

                {!(activeVideoId || musicVideoId) && (
                  <div className="text-center p-4 text-zinc-500 z-10">
                    <Video className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Finding music video...</p>
                  </div>
                )}
              </div>
            )}

            {/* Title, Artist, and Action buttons (No borders) */}
            <div className="w-full flex items-center justify-between mb-6 px-1">
              <div className="min-w-0 pr-4">
                <h2
                  id="normal-player-title"
                  className="text-2xl font-bold text-white tracking-tight truncate mb-1"
                >
                  {currentTrack.title}
                </h2>
                <p
                  id="normal-player-artist"
                  className="text-base text-zinc-400 truncate"
                >
                  {currentTrack.artist}
                  {currentTrack.album && currentTrack.album !== 'Single' && (
                    <span className="text-zinc-600"> • {currentTrack.album}</span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="normal-player-playlist-btn"
                  onClick={() => setShowPlaylistModal(true)}
                  className="p-3 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors shrink-0 shadow-md backdrop-blur-md"
                  title="Add to Playlist"
                >
                  <ListPlus className="w-5 h-5" />
                </button>

                {/* Source Switcher Button */}
                <div className="relative">
                  <button
                    id="normal-player-source-btn"
                    onClick={() => setShowSourceDropdown(!showSourceDropdown)}
                    className="p-3 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors shrink-0 shadow-md backdrop-blur-md flex items-center justify-center w-11 h-11"
                    title="Select Audio/Video Source"
                  >
                    <Radio className="w-5 h-5" />
                  </button>

                  {/* Dropdown Below in Full Player */}
                  {showSourceDropdown && (
                    <div className="absolute right-0 top-full mt-2 w-80 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl z-50 p-2 max-h-72 overflow-y-auto animate-in fade-in duration-150">
                      <div className="px-3 py-2 text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-800 mb-1">
                        Select Source ({trackSources.length})
                      </div>
                      {trackSources.length === 0 ? (
                        <div className="py-4 text-center text-xs text-zinc-500">No alternative sources available</div>
                      ) : (
                        trackSources.map((src) => (
                          <button
                            key={src.id}
                            onClick={() => {
                              switchTrackSource(src.id);
                              setShowSourceDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-colors flex flex-col gap-0.5 ${
                              currentSourceId === src.id
                                ? 'bg-white text-black font-semibold'
                                : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                            }`}
                          >
                            <span className="truncate">{src.title}</span>
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
                  id="normal-player-save-btn"
                  onClick={() => toggleSaveTrack(currentTrack)}
                  className="p-3 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors shrink-0 shadow-md backdrop-blur-md"
                  title={isSaved ? 'Remove from saved' : 'Save track'}
                >
                  <Heart
                    className={`w-5 h-5 ${isSaved ? 'fill-white text-white' : ''}`}
                  />
                </button>
              </div>
            </div>

            {/* Scrubber Timeline */}
            <div className="w-full mb-6">
              <div className="relative flex items-center group py-2 mb-2">
                <div className="w-full h-1.5 group-hover:h-2 bg-zinc-800/80 rounded-full overflow-hidden relative transition-all">
                  <div
                    className="h-full bg-white rounded-full transition-colors"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
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
              <div className="flex justify-between text-xs text-zinc-400 tabular-nums">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Main Controls */}
            <div className="flex items-center justify-center gap-6 mb-6">
              <button
                id="normal-shuffle-btn"
                onClick={toggleShuffle}
                className={`p-2.5 rounded-full transition-colors ${
                  isShuffle ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="Shuffle"
              >
                <Shuffle className="w-5 h-5" />
              </button>

              <button
                id="normal-prev-btn"
                onClick={prevTrack}
                className="p-3 text-zinc-400 hover:text-white transition-colors"
                title="Previous"
              >
                <SkipBack className="w-6 h-6 fill-current" />
              </button>

              <button
                id="normal-play-btn"
                onClick={togglePlay}
                disabled={isGrabbing}
                className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:bg-zinc-200 transition-transform active:scale-95 shadow-2xl disabled:opacity-50"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isGrabbing ? (
                  <Radio className="w-6 h-6 animate-pulse text-zinc-800" />
                ) : isPlaying ? (
                  <Pause className="w-7 h-7 fill-current" />
                ) : (
                  <Play className="w-7 h-7 fill-current translate-x-0.5" />
                )}
              </button>

              <button
                id="normal-next-btn"
                onClick={nextTrack}
                className="p-3 text-zinc-400 hover:text-white transition-colors"
                title="Next"
              >
                <SkipForward className="w-6 h-6 fill-current" />
              </button>

              <button
                id="normal-repeat-btn"
                onClick={toggleRepeat}
                className={`p-2.5 rounded-full relative transition-colors ${
                  repeatMode !== 'off' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="Repeat"
              >
                <Repeat className="w-5 h-5" />
                {repeatMode === 'one' && (
                  <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-white text-black rounded-full px-1">
                    1
                  </span>
                )}
              </button>
            </div>

            {/* Volume Slider */}
            <div className="w-full max-w-xs flex items-center gap-3 px-4 py-2.5 bg-zinc-900/70 backdrop-blur-md rounded-2xl shadow-md">
              <button
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
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>
          </div>

          {/* Right Column: Synced Lyrics View */}
          <div className="h-[460px] lg:h-[540px] w-full">
            <LyricsView className="h-full shadow-2xl" />
          </div>
        </div>
      </div>

      <AddToPlaylistModal
        track={currentTrack}
        isOpen={showPlaylistModal}
        onClose={() => setShowPlaylistModal(false)}
      />
    </>
  );
};
