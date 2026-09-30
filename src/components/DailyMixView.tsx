import React, { useEffect, useState } from 'react';
import { Clock, Loader2, ArrowLeft, Heart, Radio } from 'lucide-react';
import { useNavigation } from '../context/NavigationContext';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { getMixTracks } from '../services/api';
import { DailyMixItem, Track } from '../types';
import { MixDisk } from './MixDisk';

export const DailyMixView: React.FC = () => {
  const { selectedMix, openArtist, goBack, canGoBack } = useNavigation();
  const { playTrack, currentTrack, isPlaying, toggleFavorite, isFavorite, getTrackDuration, duration } = useAudio();

  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!selectedMix) return;

    let isMounted = true;
    setIsLoading(true);

    getMixTracks(selectedMix)
      .then((data) => {
        if (isMounted) {
          setTracks(data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedMix?.id]);

  if (!selectedMix) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-zinc-500 gap-4">
        <Radio className="w-12 h-12 stroke-1" />
        <p className="text-base">Mix not selected</p>
        {canGoBack && (
          <button
            onClick={goBack}
            className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full text-xs font-semibold"
          >
            Go Back
          </button>
        )}
      </div>
    );
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleTrackClick = (track: Track) => {
    playTrack(track, tracks);
  };

  return (
    <div id="daily-mix-view" className="flex flex-col pb-36 select-none animate-in fade-in duration-200">
      {/* Top back button */}
      {canGoBack && (
        <div className="mb-4">
          <button
            onClick={goBack}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-all shadow-md"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        </div>
      )}

      {/* Spotify-style Mix Header with Vinyl Disk cover */}
      <div className="flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8 p-6 md:p-8 rounded-3xl bg-gradient-to-b from-zinc-800/60 via-[#141417] to-[#121215] shadow-2xl mb-8">
        {/* Vinyl Record Disk Artwork */}
        <div className="w-48 h-48 md:w-56 md:h-56 shrink-0 flex items-center justify-center">
          <MixDisk
            title={selectedMix.title}
            mixNumber={selectedMix.id.replace(/[^\d]/g, '') || '1'}
            gradient={selectedMix.gradient || 'emerald'}
            size="lg"
            isSpinning={isPlaying && tracks.some((t) => t.id === currentTrack?.id)}
          />
        </div>

        {/* Mix Meta */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Daily Mix
            </span>
          </div>

          <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight line-clamp-2 mb-3">
            {selectedMix.title}
          </h1>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs text-zinc-400 font-medium">
            <span className="text-zinc-300 font-semibold">Refreshes every day at 12:00 AM CST</span>
            {tracks.length > 0 && (
              <>
                <span className="text-zinc-600">•</span>
                <span>{tracks.length} songs</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tracks Table */}
      <div className="flex flex-col gap-2">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-4 py-2.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          <div className="col-span-1 text-center">#</div>
          <div className="col-span-7 md:col-span-6">Title</div>
          <div className="hidden md:block md:col-span-3 text-left">Artist</div>
          <div className="col-span-4 md:col-span-2 flex items-center justify-end pr-2">
            <Clock className="w-3.5 h-3.5" />
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-400 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-white" />
            <p className="text-xs">Curating your mix tracks...</p>
          </div>
        ) : tracks.length > 0 ? (
          tracks.map((track, index) => {
            const isCurrent = currentTrack?.id === track.id || currentTrack?.title === track.title;
            const fav = isFavorite(track.id);

            return (
              <div
                key={track.id || `${track.title}-${index}`}
                onClick={() => handleTrackClick(track)}
                className={`group grid grid-cols-12 gap-4 items-center px-4 py-3 rounded-2xl cursor-pointer transition-all duration-150 ${
                  isCurrent
                    ? 'bg-white/10 text-white'
                    : 'hover:bg-zinc-800/60 text-zinc-300'
                }`}
              >
                {/* Number or Equalizer */}
                <div className="col-span-1 flex items-center justify-center text-xs font-medium text-zinc-400 group-hover:text-white">
                  {isCurrent && isPlaying ? (
                    <div className="flex items-end gap-0.5 h-3.5">
                      <span className="w-1 bg-white h-full animate-bounce rounded-full" />
                      <span className="w-1 bg-white h-2/3 animate-bounce delay-75 rounded-full" />
                      <span className="w-1 bg-white h-4/5 animate-bounce delay-150 rounded-full" />
                    </div>
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>

                {/* Cover & Title */}
                <div className="col-span-7 md:col-span-6 flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-zinc-800 shrink-0 shadow-sm">
                    <img
                      src={track.artworkSmall || track.artworkLarge || (track as any).cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=100&q=80'}
                      alt={track.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-semibold truncate ${
                        isCurrent ? 'text-white' : 'text-zinc-100 group-hover:text-white'
                      }`}
                    >
                      {track.title}
                    </p>
                    <p className="text-xs text-zinc-400 truncate md:hidden">
                      {track.artist}
                    </p>
                  </div>
                </div>

                {/* Artist clickable (Left-aligned, pr-4, ample room without clipping) */}
                <div className="hidden md:block md:col-span-3 text-left text-xs text-zinc-400 truncate pr-4">
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      openArtist(track.artist);
                    }}
                    className="hover:text-white hover:underline cursor-pointer truncate block"
                  >
                    {track.artist}
                  </span>
                </div>

                {/* Duration & Heart */}
                <div className="col-span-4 md:col-span-2 flex items-center justify-end gap-3 text-xs text-zinc-400 pr-2 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(track);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-white p-1"
                  >
                    <Heart className={`w-3.5 h-3.5 ${fav ? 'fill-white text-white' : ''}`} />
                  </button>
                  <span className="w-11 text-right tabular-nums">
                    {formatDuration(
                      currentTrack?.id === track.id && duration > 0
                        ? duration
                        : (getTrackDuration(track) / 1000)
                    )}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
            <p className="text-sm">No tracks available</p>
          </div>
        )}
      </div>
    </div>
  );
};

