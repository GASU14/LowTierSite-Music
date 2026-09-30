import React, { useEffect, useState } from 'react';
import { Play, Pause, Clock, Loader2, ArrowLeft, Heart, Disc3, UserPlus, UserCheck, Shuffle } from 'lucide-react';
import { useNavigation } from '../context/NavigationContext';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getArtistDetails, createAlbumFallbackDataUrl } from '../services/api';
import { ArtistDetail, Track, AlbumDetail } from '../types';

type DiscographyFilter = 'all' | 'albums' | 'singles';

export const ArtistView: React.FC = () => {
  const { selectedArtistName, selectedArtistId, openAlbum, goBack, canGoBack } = useNavigation();
  const { playTrack, currentTrack, isPlaying, togglePlay, toggleFavorite, isFavorite, getTrackDuration, duration } = useAudio();
  const { toggleFollowArtist, isFollowingArtist } = useAuth();
  const { themeConfig } = useTheme();

  const [artistData, setArtistData] = useState<ArtistDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<DiscographyFilter>('all');
  const [showAllTracks, setShowAllTracks] = useState<boolean>(false);

  useEffect(() => {
    if (!selectedArtistName && !selectedArtistId) return;

    let isMounted = true;
    setIsLoading(true);
    setShowAllTracks(false);

    getArtistDetails(selectedArtistId || selectedArtistName || '')
      .then((data) => {
        if (isMounted) {
          setArtistData(data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedArtistName, selectedArtistId]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-zinc-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
        <p className="text-sm">Loading artist profile...</p>
      </div>
    );
  }

  if (!artistData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-zinc-500 gap-4">
        <Disc3 className="w-12 h-12 stroke-1" />
        <p className="text-base">Artist not found</p>
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

  const displayName = selectedArtistName || artistData.name;
  const popularTracks = artistData.popularTracks || artistData.topTracks || [];
  const discography = artistData.discography || artistData.allReleases || artistData.albums || [];
  const albumCoverFallback = popularTracks[0]?.artworkOriginal || popularTracks[0]?.artworkLarge || discography[0]?.artworkLarge || discography[0]?.artwork || createAlbumFallbackDataUrl(displayName);
  const artistAvatar = artistData.picture || artistData.image || artistData.headerImage || albumCoverFallback;

  const isCurrentArtistPlaying =
    currentTrack?.artist?.toLowerCase() === displayName.toLowerCase() && isPlaying;

  const handlePlayArtist = () => {
    if (isCurrentArtistPlaying) {
      togglePlay();
    } else if (popularTracks.length > 0) {
      playTrack(popularTracks[0], popularTracks);
    }
  };

  const handleTrackClick = (track: Track) => {
    playTrack(track, popularTracks);
  };

  // Discography sorted by release date: latest at top, oldest at bottom (features removed)
  const sortedDiscography = [...discography]
    .filter((item) => item.recordType !== 'feature')
    .sort((a, b) => {
      const timeA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
      const timeB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
      return timeB - timeA;
    });

  const filteredAlbums = sortedDiscography.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'albums') return item.recordType === 'album' || !item.recordType;
    if (filter === 'singles') return item.recordType === 'single' || item.recordType === 'ep';
    return true;
  });

  const displayedTracks = showAllTracks
    ? popularTracks
    : popularTracks.slice(0, 5);

  return (
    <div id="artist-view" className="flex flex-col pb-36 select-none animate-in fade-in duration-200">
      {/* Back button */}
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

      {/* Spotify-style Artist Hero Header */}
      <div className="relative rounded-3xl overflow-hidden mb-8 bg-gradient-to-b from-zinc-700/50 via-[#141417] to-[#101012] shadow-2xl p-6 md:p-10 flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8">
        {/* Profile Image */}
        <div className="relative w-40 h-40 md:w-52 md:h-52 rounded-full overflow-hidden shadow-2xl bg-zinc-800 shrink-0 select-none">
          <img
            src={artistAvatar}
            alt={displayName}
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = albumCoverFallback;
            }}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Artist Meta */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Verified Artist
            </span>
          </div>

          <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight line-clamp-2 mb-4">
            {displayName}
          </h1>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
            {/* 1:1 Square Play Button */}
            <button
              id="artist-play-btn"
              onClick={handlePlayArtist}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl hover:opacity-90 active:scale-95 transition-all cursor-pointer shrink-0 ${themeConfig.bgAccent} ${themeConfig.buttonText}`}
              style={{ backgroundColor: themeConfig.primaryHex }}
              title={isCurrentArtistPlaying ? 'Pause' : 'Play'}
            >
              {isCurrentArtistPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current translate-x-0.5" />
              )}
            </button>

            {/* 1:1 Square Shuffle Button */}
            <button
              id="artist-shuffle-btn"
              onClick={() => {
                if (popularTracks.length > 0) {
                  const shuffled = [...popularTracks].sort(() => Math.random() - 0.5);
                  playTrack(shuffled[0], shuffled);
                }
              }}
              disabled={popularTracks.length === 0}
              className="w-12 h-12 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center shadow-md active:scale-95 transition-all cursor-pointer shrink-0 disabled:opacity-50"
              title="Shuffle"
            >
              <Shuffle className="w-5 h-5" />
            </button>

            {/* Follow / Following Button */}
            <button
              onClick={() => toggleFollowArtist(displayName)}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold transition-all shadow-lg cursor-pointer active:scale-95 ${
                isFollowingArtist(displayName)
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'
                  : 'bg-white hover:bg-zinc-200 text-black'
              }`}
            >
              {isFollowingArtist(displayName) ? (
                <>
                  <UserCheck className="w-4 h-4 text-white" />
                  <span>Following</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Follow</span>
                </>
              )}
            </button>

            {artistData.monthlyListeners && (
              <span className="text-xs sm:text-sm text-zinc-300 font-medium ml-1">
                {artistData.monthlyListeners.toLocaleString()} monthly listeners
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Popular Tracks Section */}
      <div className="mb-12">
        <h2 className="text-xl font-bold text-white tracking-tight mb-4">Popular</h2>

        <div className="flex flex-col gap-1">
          {displayedTracks.map((track, index) => {
            const isCurrent = currentTrack?.id === track.id || currentTrack?.title === track.title;
            const fav = isFavorite(track.id);

            return (
              <div
                key={track.id || `${track.title}-${index}`}
                onClick={() => handleTrackClick(track)}
                className={`group flex items-center justify-between px-3.5 py-2.5 rounded-2xl cursor-pointer transition-all duration-150 ${
                  isCurrent
                    ? 'bg-white/10 text-white'
                    : 'hover:bg-zinc-800/60 text-zinc-300'
                }`}
              >
                {/* Left: Index + Artwork + Title */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-3">
                  <div className="w-6 flex items-center justify-center text-xs font-medium text-zinc-400 group-hover:text-white shrink-0">
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

                  <div className="w-11 h-11 rounded-xl overflow-hidden bg-zinc-800 shrink-0 shadow-sm">
                    <img
                      src={track.artworkSmall || track.artworkLarge || track.artworkOriginal || (track as any).cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=100&q=80'}
                      alt={track.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-semibold truncate ${
                        isCurrent ? 'text-white' : 'text-zinc-100 group-hover:text-white'
                      }`}
                    >
                      {track.title}
                    </p>
                    <p className="text-xs text-zinc-400 truncate mt-0.5">
                      {track.artist}
                    </p>
                  </div>
                </div>

                {/* Center: Album Name (Desktop Only) */}
                <div className="hidden md:block w-48 lg:w-64 min-w-0 px-4 text-xs text-zinc-400 truncate text-left">
                  {track.album && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        openAlbum(track.albumId || track.album || '', {
                          id: track.albumId || track.album || '',
                          title: track.album || '',
                          artist: track.artist,
                          artwork: track.artworkOriginal || track.artworkLarge || track.artworkSmall,
                          artworkLarge: track.artworkLarge || track.artworkSmall,
                          tracks: [track],
                        });
                      }}
                      className="hover:text-white hover:underline cursor-pointer truncate block"
                    >
                      {track.album}
                    </span>
                  )}
                </div>

                {/* Right: Heart + Duration */}
                <div className="flex items-center gap-3 shrink-0 text-xs text-zinc-400 pr-1">
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
          })}

          {popularTracks.length > 5 && (
            <button
              onClick={() => setShowAllTracks(!showAllTracks)}
              className="self-start text-xs font-bold text-zinc-400 hover:text-white px-4 py-2 mt-2 transition-colors"
            >
              {showAllTracks ? 'Show less' : 'See more'}
            </button>
          )}
        </div>
      </div>

      {/* Discography Section */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-white tracking-tight">Discography</h2>

          {/* Discography Filter Pills (All, Albums, Singles) - Features removed */}
          <div className="flex items-center gap-1.5 p-1 bg-zinc-900/80 rounded-2xl w-fit">
            {(['all', 'albums', 'singles'] as DiscographyFilter[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                  filter === tab
                    ? 'bg-zinc-800 text-white shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {tab === 'singles' ? 'Singles & EPs' : tab}
              </button>
            ))}
          </div>
        </div>

        {/* Discography Grid - In release date order (latest top, oldest bottom) */}
        {filteredAlbums.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filteredAlbums.map((item) => (
              <div
                key={item.id}
                onClick={() => openAlbum(item.id, item)}
                className="group flex flex-col cursor-pointer select-none"
              >
                {/* Clean Album Artwork */}
                <div className="relative aspect-square w-full rounded-2xl overflow-hidden mb-3 bg-zinc-800 shadow-lg group-hover:scale-[1.03] transition-transform duration-200">
                  <img
                    src={item.artwork || item.artworkLarge || (item as any).cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=500&q=80'}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Album Title & Year */}
                <div className="min-w-0 px-0.5">
                  <p className="text-sm font-bold text-white truncate group-hover:underline">
                    {item.title}
                  </p>
                  <p className="text-xs text-zinc-400 truncate mt-0.5 font-medium">
                    {item.releaseDate ? new Date(item.releaseDate).getFullYear() || item.releaseDate : ''}
                    {item.recordType ? ` • ${item.recordType.toUpperCase()}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
            <p className="text-sm">No releases found under this filter</p>
          </div>
        )}
      </div>
    </div>
  );
};
