import React, { useEffect, useState } from 'react';
import { Clock, Music, Loader2, ArrowLeft, Heart, Play, Shuffle } from 'lucide-react';
import { useNavigation } from '../context/NavigationContext';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { getAlbumDetails } from '../services/api';
import { AlbumDetail, Track } from '../types';

export const AlbumView: React.FC = () => {
  const { selectedAlbumId, selectedAlbumData, openArtist, goBack, canGoBack } = useNavigation();
  const { playTrack, currentTrack, isPlaying, toggleFavorite, isFavorite, getTrackDuration, duration } = useAudio();
  
  const [album, setAlbum] = useState<AlbumDetail | null>(selectedAlbumData);
  const [isLoading, setIsLoading] = useState<boolean>(!selectedAlbumData);

  useEffect(() => {
    if (!selectedAlbumId && !selectedAlbumData) return;

    let isMounted = true;
    if (!selectedAlbumData || (!selectedAlbumData.tracks || selectedAlbumData.tracks.length === 0)) {
      setIsLoading(true);
      getAlbumDetails(
        selectedAlbumId || selectedAlbumData?.id || '',
        selectedAlbumData?.title,
        selectedAlbumData?.artist
      )
        .then((data) => {
          if (isMounted && data) {
            setAlbum(data);
            setIsLoading(false);
          } else if (isMounted && selectedAlbumData) {
            setAlbum(selectedAlbumData);
            setIsLoading(false);
          } else if (isMounted) {
            setIsLoading(false);
          }
        })
        .catch(() => {
          if (isMounted) setIsLoading(false);
        });
    } else {
      setAlbum(selectedAlbumData);
      setIsLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [selectedAlbumId, selectedAlbumData]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-zinc-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
        <p className="text-sm">Loading album...</p>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-zinc-500 gap-4">
        <Music className="w-12 h-12 stroke-1" />
        <p className="text-base">Album not found</p>
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
    playTrack(track, album.tracks || [track]);
  };

  return (
    <div id="album-view" className="flex flex-col pb-36 select-none animate-in fade-in duration-200">
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

      {/* Spotify-style Album Header (No Border) */}
      <div className="flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8 mb-8 pt-2">
        {/* Cover Artwork */}
        <div className="w-48 h-48 md:w-56 md:h-56 rounded-2xl overflow-hidden shadow-2xl bg-zinc-800 shrink-0">
          <img
            src={album.artwork || album.artworkLarge || (album as any).cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=500&q=80'}
            alt={album.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Album Meta */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left min-w-0 flex-1">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
            Album
          </span>
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight line-clamp-2 mb-2">
            {album.title}
          </h1>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs sm:text-sm text-zinc-300 font-medium mb-5">
            <button
              onClick={() => openArtist(album.artist)}
              className="font-bold text-white hover:underline transition-all"
            >
              {album.artist}
            </button>
            {album.releaseDate && (
              <>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-400">{new Date(album.releaseDate).getFullYear() || album.releaseDate}</span>
              </>
            )}
            {album.tracks && (
              <>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-400">{album.tracks.length} songs</span>
              </>
            )}
          </div>

          {/* Play & Shuffle Buttons */}
          <div className="flex items-center gap-3">
            <button
              id="album-play-btn"
              onClick={() => {
                if (album.tracks && album.tracks.length > 0) {
                  playTrack(album.tracks[0], album.tracks);
                }
              }}
              disabled={!album.tracks || album.tracks.length === 0}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black hover:bg-zinc-200 text-xs font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Play</span>
            </button>
            <button
              id="album-shuffle-btn"
              onClick={() => {
                if (album.tracks && album.tracks.length > 0) {
                  const shuffled = [...album.tracks].sort(() => Math.random() - 0.5);
                  playTrack(shuffled[0], shuffled);
                }
              }}
              disabled={!album.tracks || album.tracks.length === 0}
              className="flex items-center gap-2 px-5 py-3 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50"
            >
              <Shuffle className="w-4 h-4" />
              <span>Shuffle</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tracks Table / List */}
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

        {/* Tracks Rows */}
        {album.tracks && album.tracks.length > 0 ? (
          album.tracks.map((track, index) => {
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
                {/* Index / Equalizer */}
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

                {/* Title */}
                <div className="col-span-7 md:col-span-6 min-w-0 pr-2">
                  <p
                    className={`text-sm font-semibold truncate ${
                      isCurrent ? 'text-white' : 'text-zinc-100 group-hover:text-white'
                    }`}
                  >
                    {track.title}
                  </p>
                  <p className="text-xs text-zinc-400 truncate md:hidden mt-0.5">
                    {track.artist}
                  </p>
                </div>

                {/* Artist Name (Directly under Artist header, left-aligned) */}
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

                {/* Heart + Duration (Directly under Clock header, right-aligned) */}
                <div className="col-span-4 md:col-span-2 flex items-center justify-end gap-3 text-xs text-zinc-400 pr-2 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(track);
                    }}
                    className="p-1 text-zinc-400 hover:text-white transition-colors"
                  >
                    <Heart className={`w-4 h-4 ${fav ? 'fill-white text-white' : ''}`} />
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
            <p className="text-sm">No track list available for this album</p>
          </div>
        )}
      </div>
    </div>
  );
};
