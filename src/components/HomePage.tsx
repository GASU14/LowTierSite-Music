import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Play,
  Pause,
  Loader2,
  X,
} from 'lucide-react';
import { Track, DailyMixItem } from '../types';
import {
  searchItunes,
  searchAlbums,
  AlbumResult,
  getDailyMixesCST,
  searchDeezerArtists,
  getPopularChartTracks,
  getNewReleases,
  filterOutLibraryTracks,
  filterOutLibraryAlbums,
  normalizeFuzzy,
  KNOWN_ARTIST_IMAGES,
} from '../services/api';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { MixDisk } from './MixDisk';

interface ArtistRecommendation {
  id: string;
  name: string;
  genre: string;
  image: string;
}

export const HomePage: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    playTrack,
    togglePlay,
    savedTracks,
  } = useAudio();
  const { selectedArtists, playlists, albumHistory, userProfile } = useAuth();
  const { openArtist, openAlbum, openMix } = useNavigation();

  const [searchTerm, setSearchTerm] = useState('');
  const [searchCategory, setSearchCategory] = useState<'all' | 'songs' | 'artists' | 'albums'>('all');

  // Recommendation states
  const [popularTracks, setPopularTracks] = useState<Track[]>([]);
  const [newReleases, setNewReleases] = useState<AlbumResult[]>([]);
  const [recommendedSongs, setRecommendedSongs] = useState<Track[]>([]);
  const [recommendedAlbums, setRecommendedAlbums] = useState<AlbumResult[]>([]);
  const [recommendedArtists, setRecommendedArtists] = useState<ArtistRecommendation[]>([]);
  const [dailyMixes, setDailyMixes] = useState<DailyMixItem[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(true);

  // Search states
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    songs: Track[];
    albums: AlbumResult[];
    artists: ArtistRecommendation[];
  }>({
    songs: [],
    albums: [],
    artists: [],
  });

  // Comprehensive library tracks (saved tracks + all playlist tracks) for filtering
  const allLibraryTracks = useMemo(() => {
    const list: Track[] = [...(savedTracks || [])];
    (playlists || []).forEach((pl) => {
      (pl.tracks || []).forEach((t) => {
        if (t && !list.some((existing) => String(existing.id) === String(t.id))) {
          list.push(t);
        }
      });
    });
    return list;
  }, [savedTracks, playlists]);

  // Comprehensive library artists from user account metadata (followed artists, saved tracks, playlists)
  const userArtists = useMemo(() => {
    const artistSet = new Set<string>();

    // 1. Followed artists
    (selectedArtists || []).forEach((art) => {
      if (art && art.trim()) artistSet.add(art.trim());
    });

    // 2. Saved tracks artists in library
    (savedTracks || []).forEach((tr) => {
      if (tr && tr.artist && tr.artist.trim()) artistSet.add(tr.artist.trim());
    });

    // 3. User playlists artists in library
    (playlists || []).forEach((pl) => {
      (pl.tracks || []).forEach((tr) => {
        if (tr && tr.artist && tr.artist.trim()) artistSet.add(tr.artist.trim());
      });
    });

    const list = Array.from(artistSet);
    return list.length > 0
      ? list
      : ['Drake', 'The Weeknd', 'Kendrick Lamar', 'Travis Scott', 'SZA'];
  }, [selectedArtists, savedTracks, playlists]);

  // Guessed categories & top genres based on user taste & listened artists
  // (e.g., Drake + Morgan Wallen -> Hip-Hop, Country, etc.)
  const userGenres = useMemo(() => {
    const gList = userProfile?.taste?.topGenres || [];
    if (gList.length > 0) return gList;
    const guessed: string[] = [];
    const lowerArts = userArtists.map((a) => a.toLowerCase());
    if (lowerArts.some((a) => ['drake', 'kanye west', 'kendrick lamar', 'travis scott', 'future', '21 savage', 'playboi carti', 'metro boomin', 'gunna', 'lil baby', 'eminem', 'j. cole'].some((k) => a.includes(k)))) {
      guessed.push('Hip-Hop', 'Rap');
    }
    if (lowerArts.some((a) => ['morgan wallen', 'luke combs', 'zach bryan', 'chris stapleton', 'post malone', 'jelly roll', 'kacey musgraves', 'cody johnson', 'bailey zimmerman'].some((k) => a.includes(k)))) {
      guessed.push('Country');
    }
    if (lowerArts.some((a) => ['the weeknd', 'sza', 'frank ocean', 'brent faiyaz', 'steve lacy', 'daniel caesar', 'partynextdoor', 'summer walker'].some((k) => a.includes(k)))) {
      guessed.push('R&B', 'Soul');
    }
    if (lowerArts.some((a) => ['taylor swift', 'billie eilish', 'olivia rodrigo', 'dua lipa', 'sabrina carpenter', 'chappell roan', 'ariana grande', 'charli xcx', 'tate mcrae'].some((k) => a.includes(k)))) {
      guessed.push('Pop');
    }
    if (lowerArts.some((a) => ['tame impala', 'arctic monkeys', 'radiohead', 'the 1975', 'deftones', 'nirvana', 'linkin park'].some((k) => a.includes(k)))) {
      guessed.push('Alternative', 'Rock');
    }
    return guessed.length > 0 ? guessed : ['Hip-Hop', 'Country', 'Pop'];
  }, [userProfile?.taste?.topGenres, userArtists]);

  // Recap: Last listened albums, max 20, derived from album history
  const recapAlbums = useMemo(() => {
    const list = [...(albumHistory || [])];
    if (list.length < 20 && userProfile?.history) {
      const seen = new Set(list.map((a) => `${(a.title || '').toLowerCase()}::${(a.artist || '').toLowerCase()}`));
      for (const tr of userProfile.history) {
        if (tr.album && tr.album.toLowerCase() !== 'single') {
          const key = `${tr.album.toLowerCase()}::${(tr.artist || '').toLowerCase()}`;
          if (!seen.has(key)) {
            seen.add(key);
            list.push({
              id: tr.albumId || `recap-${tr.album.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
              title: tr.album,
              artist: tr.artist,
              artwork: tr.artworkLarge || tr.artworkSmall,
              lastPlayedAt: 0,
            });
            if (list.length >= 20) break;
          }
        }
      }
    }
    return list.slice(0, 20);
  }, [albumHistory, userProfile?.history]);

  // Load recommendations, Daily Mixes, Popular Tracks, and New Releases
  useEffect(() => {
    let isCancelled = false;

    async function loadAllRecommendations() {
      setLoadingRecommendations(true);
      try {
        const seed1 = userArtists[0] || 'Drake';
        const seed2 = userArtists[1] || 'The Weeknd';
        const seed3 = userArtists[2] || 'Kendrick Lamar';

        // 1. Fetch Daily Mixes (Refreshed daily at 12:00 AM CST, curated from library)
        const mixes = await getDailyMixesCST(userArtists);
        if (!isCancelled) {
          setDailyMixes(mixes);
        }

        // 2. Fetch Popular Tracks based on real charts & guessed categories (Drake & Morgan Wallen -> Hip Hop & Country)
        const popular = await getPopularChartTracks(userGenres, userArtists, 30);
        if (!isCancelled) {
          setPopularTracks(filterOutLibraryTracks(popular, allLibraryTracks));
        }

        // 3. Fetch New Releases based on what user listens to
        const releases = await getNewReleases(userArtists, userGenres, 25);
        if (!isCancelled) {
          setNewReleases(filterOutLibraryAlbums(releases, allLibraryTracks));
        }

        // 4. Fetch Recommended Songs (excluding library tracks)
        const [songsSeed1, songsSeed2] = await Promise.all([
          searchItunes(seed1, 16),
          searchItunes(`${seed2} ${seed3}`, 16),
        ]);

        if (isCancelled) return;

        const combinedSongs = [...(songsSeed1 || []), ...(songsSeed2 || [])].filter(
          (track, index, self) => track && index === self.findIndex((t) => t?.id === track.id)
        );
        setRecommendedSongs(filterOutLibraryTracks(combinedSongs, allLibraryTracks));

        // 5. Fetch Recommended Albums (excluding library albums)
        const [albumsSeed1, albumsSeed2] = await Promise.all([
          searchAlbums(seed1, 10),
          searchAlbums(seed2, 10),
        ]);

        if (isCancelled) return;

        const combinedAlbums = [...(albumsSeed1 || []), ...(albumsSeed2 || [])].filter(
          (alb, idx, self) => alb && alb.title && idx === self.findIndex((a) => a?.title?.toLowerCase() === alb.title.toLowerCase())
        );
        setRecommendedAlbums(filterOutLibraryAlbums(combinedAlbums, allLibraryTracks));

        // 6. Generate recommended artists with authentic curated and Deezer images
        const topArtistPool = [
          'Kanye West', 'Frank Ocean', 'Tyler, The Creator', 'Lana Del Rey',
          'Playboi Carti', 'Brent Faiyaz', 'Steve Lacy', '21 Savage',
          'Don Toliver', 'Childish Gambino', 'Tame Impala', 'Metro Boomin',
          'Morgan Wallen', 'Zach Bryan', 'Luke Combs', 'Billie Eilish',
          'Post Malone', 'Bad Bunny', 'Dua Lipa', 'Sabrina Carpenter',
          'Olivia Rodrigo', 'Ariana Grande', 'Drake', 'Travis Scott', 'Kendrick Lamar'
        ];
        const selectedSet = new Set((userArtists || []).map((n) => (n ? n.toLowerCase() : '')));
        const candidates = topArtistPool.filter((n) => n && !selectedSet.has(n.toLowerCase())).slice(0, 8);

        const artistRecs = await Promise.all(
          candidates.map(async (name) => {
            const norm = normalizeFuzzy(name);
            const knownPic = KNOWN_ARTIST_IMAGES[norm];
            if (knownPic) {
              return {
                id: `rec-art-${norm}`,
                name,
                genre: 'Artist',
                image: knownPic,
              };
            }
            try {
              const res = await searchDeezerArtists(name, 1);
              if (res && res.length > 0 && res[0].image) {
                return {
                  id: `rec-art-${res[0].id}`,
                  name: res[0].name || name,
                  genre: 'Artist',
                  image: res[0].image,
                };
              }
            } catch {}
            return {
              id: `rec-art-${norm}`,
              name,
              genre: 'Artist',
              image: 'https://cdn-images.dzcdn.net/images/artist/bb76c2ee3b068726ab4c37b0aabdb57a/500x500-000000-80-0-0.jpg',
            };
          })
        );

        if (!isCancelled) {
          setRecommendedArtists(artistRecs);
        }
      } catch (err) {
        console.error('Error fetching recommendations:', err);
      } finally {
        if (!isCancelled) setLoadingRecommendations(false);
      }
    }

    loadAllRecommendations();

    return () => {
      isCancelled = true;
    };
  }, [userArtists, allLibraryTracks, userGenres]);

  // Handle live search with Fuzzy matching & closest results (e.g., "jayz" -> "JAY-Z", "sza" -> "SZA")
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults({ songs: [], albums: [], artists: [] });
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const query = searchTerm.trim();
        const normQuery = normalizeFuzzy(query);

        // In parallel: search tracks, albums, and artists
        const [songs, albums, deezerArts] = await Promise.all([
          searchItunes(query, 35),
          searchAlbums(query, 30),
          searchDeezerArtists(query, 12).catch(() => []),
        ]);

        // Targeted search for user's followed artists to guarantee hits
        let extraAlbums: AlbumResult[] = [];
        let extraSongs: Track[] = [];
        if (selectedArtists && selectedArtists.length > 0 && query.length >= 3) {
          const targetedAlbums = await Promise.all(
            selectedArtists.slice(0, 4).map((art) => searchAlbums(`${art} ${query}`, 6).catch(() => []))
          );
          extraAlbums = targetedAlbums.flat();

          const targetedSongs = await Promise.all(
            selectedArtists.slice(0, 4).map((art) => searchItunes(`${art} ${query}`, 6).catch(() => []))
          );
          extraSongs = targetedSongs.flat();
        }

        const mergedAlbums = [...extraAlbums, ...albums].filter(
          (alb, idx, self) =>
            alb &&
            alb.title &&
            idx ===
              self.findIndex(
                (a) =>
                  a.id === alb.id ||
                  (a.title.toLowerCase() === alb.title.toLowerCase() &&
                    a.artist.toLowerCase() === alb.artist.toLowerCase())
              )
        );

        const mergedSongs = [...extraSongs, ...songs].filter(
          (track, idx, self) => track && idx === self.findIndex((t) => t.id === track.id)
        );

        // Comprehensive Artist Extraction:
        // Merge artists from Deezer artist search + iTunes songs + iTunes albums so an artist ALWAYS appears!
        const artistMap = new Map<string, ArtistRecommendation>();

        // 1. Artists from Deezer/iTunes artist search
        for (const da of deezerArts) {
          if (!da || !da.name) continue;
          const cleanName = da.name.replace(/JAŸ-Z/gi, 'JAY-Z');
          const normA = normalizeFuzzy(cleanName);
          const img = da.image || KNOWN_ARTIST_IMAGES[normA] || '';
          artistMap.set(normA, {
            id: `search-artist-${da.id}`,
            name: cleanName,
            genre: 'Artist',
            image: img,
          });
        }

        // 2. Artists from matching songs
        for (const s of mergedSongs) {
          if (!s || !s.artist) continue;
          const cleanName = s.artist.replace(/JAŸ-Z/gi, 'JAY-Z');
          const normA = normalizeFuzzy(cleanName);
          if (!artistMap.has(normA)) {
            const img = KNOWN_ARTIST_IMAGES[normA] || s.artworkLarge || s.artworkSmall || '';
            artistMap.set(normA, {
              id: `search-artist-song-${normA}`,
              name: cleanName,
              genre: 'Artist',
              image: img,
            });
          }
        }

        // 3. Artists from matching albums
        for (const a of mergedAlbums) {
          if (!a || !a.artist) continue;
          const cleanName = a.artist.replace(/JAŸ-Z/gi, 'JAY-Z');
          const normA = normalizeFuzzy(cleanName);
          if (!artistMap.has(normA)) {
            const img = KNOWN_ARTIST_IMAGES[normA] || a.artwork || '';
            artistMap.set(normA, {
              id: `search-artist-alb-${normA}`,
              name: cleanName,
              genre: 'Artist',
              image: img,
            });
          }
        }

        // 4. Check known artists map directly for fuzzy query match (e.g. "jayz" -> JAY-Z)
        for (const [kKey, kImg] of Object.entries(KNOWN_ARTIST_IMAGES)) {
          if (kKey === normQuery || kKey.includes(normQuery) || normQuery.includes(kKey)) {
            if (!artistMap.has(kKey)) {
              const displayName = kKey === 'jayz' ? 'JAY-Z' : (kKey === 'sza' ? 'SZA' : kKey.toUpperCase());
              artistMap.set(kKey, {
                id: `search-artist-known-${kKey}`,
                name: displayName,
                genre: 'Artist',
                image: kImg,
              });
            }
          }
        }

        // Fuzzy Priority Scoring Algorithm:
        // Ensures "jayz" ranks "JAY-Z" and his albums/songs at the very top!
        const followedSet = new Set((selectedArtists || []).map((a) => normalizeFuzzy(a)).filter(Boolean));
        const libraryArtistsSet = new Set(userArtists.map((a) => normalizeFuzzy(a)).filter(Boolean));

        const getFuzzyScore = (itemArtist: string, itemTitle?: string) => {
          const normArt = normalizeFuzzy(itemArtist || '');
          const normTitle = normalizeFuzzy(itemTitle || '');

          // Exact fuzzy match (e.g. "jayz" matches "JAY-Z" exactly after normalization)
          if (normArt === normQuery || normTitle === normQuery) {
            return 2000;
          }

          // Artist starts with query or query starts with artist
          if (normArt.startsWith(normQuery) || normQuery.startsWith(normArt)) {
            return 1500;
          }

          // Title starts with query
          if (normTitle.startsWith(normQuery)) {
            return 1200;
          }

          // Artist contains query or query contains artist
          if (normArt.includes(normQuery) || normQuery.includes(normArt)) {
            return 1000;
          }

          // Title contains query
          if (normTitle.includes(normQuery) || normQuery.includes(normTitle)) {
            return 800;
          }

          // Followed artist affinity
          if (followedSet.has(normArt)) return 600;
          if (libraryArtistsSet.has(normArt)) return 400;

          return 100;
        };

        const sortedAlbums = [...mergedAlbums].sort((a, b) => {
          return getFuzzyScore(b.artist, b.title) - getFuzzyScore(a.artist, a.title);
        });

        const sortedSongs = [...mergedSongs].sort((a, b) => {
          return getFuzzyScore(b.artist, b.title) - getFuzzyScore(a.artist, a.title);
        });

        const sortedArtists = Array.from(artistMap.values()).sort((a, b) => {
          return getFuzzyScore(b.name) - getFuzzyScore(a.name);
        });

        setSearchResults({
          songs: sortedSongs,
          albums: sortedAlbums,
          artists: sortedArtists,
        });
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm, selectedArtists, userArtists]);

  const isCurrentPlaying = (trackId: number | string) => {
    return currentTrack?.id === trackId && isPlaying;
  };

  const hasSearch = searchTerm.trim().length > 0;

  // Determine if top result is an album by a followed artist to show Albums first
  const showAlbumsFirst = useMemo(() => {
    if (!hasSearch || searchResults.albums.length === 0) return false;
    const topAlbum = searchResults.albums[0];
    const followedSet = new Set((selectedArtists || []).map((a) => a.toLowerCase().trim()).filter(Boolean));
    const normArt = (topAlbum.artist || '').toLowerCase().trim();
    return followedSet.has(normArt) || Array.from(followedSet).some((f) => normArt.includes(f) || f.includes(normArt));
  }, [hasSearch, searchResults.albums, selectedArtists]);

  return (
    <div className="flex flex-col gap-10 pb-28 select-none animate-in fade-in duration-200">
      {/* Search Header Bar */}
      <div className="flex flex-col gap-4">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            id="home-search-input"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search songs, artists, or albums..."
            className="w-full pl-11 pr-10 py-3 bg-[#121214] rounded-full text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-white transition-all shadow-inner"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter categories if searching */}
        {hasSearch && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {(['all', 'songs', 'artists', 'albums'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setSearchCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium capitalize transition-colors shrink-0 ${
                  searchCategory === cat
                    ? 'bg-white text-black font-semibold'
                    : 'bg-[#18181b] text-zinc-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* SEARCH RESULTS VIEW */}
      {hasSearch ? (
        <div className="flex flex-col gap-10">
          {isSearching ? (
            <div className="flex items-center justify-center py-20 text-zinc-500 gap-3">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Searching...</span>
            </div>
          ) : (
            <>
              {/* If followed artist album matched, show Albums section first! */}
              {showAlbumsFirst && (searchCategory === 'all' || searchCategory === 'albums') && searchResults.albums.length > 0 && (
                <section>
                  <h2 className="text-xl font-bold text-white tracking-tight mb-4">Albums</h2>
                  <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar scroll-smooth">
                    {searchResults.albums.map((album) => (
                      <div
                        key={`search-alb-top-${album.id}`}
                        onClick={() =>
                          openAlbum(album.id, {
                            id: album.id,
                            title: album.title,
                            artist: album.artist,
                            artwork: album.artwork,
                            cover: album.artwork,
                            tracks: [],
                          })
                        }
                        className="w-44 shrink-0 flex flex-col gap-2.5 p-3 rounded-2xl hover:bg-zinc-800/40 transition-colors group cursor-pointer"
                      >
                        <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-zinc-900 shadow-md">
                          <img
                            src={album.artwork}
                            alt={album.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-semibold text-white truncate group-hover:underline">
                            {album.title}
                          </span>
                          <span className="text-xs text-zinc-400 truncate mt-0.5">
                            {album.artist}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Songs Search Results */}
              {(searchCategory === 'all' || searchCategory === 'songs') && searchResults.songs.length > 0 && (
                <section>
                  <h2 className="text-xl font-bold text-white tracking-tight mb-4">Songs</h2>
                  <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar scroll-smooth">
                    {searchResults.songs.map((song) => {
                      const playing = isCurrentPlaying(song.id);
                      return (
                        <div
                          key={`search-song-${song.id}`}
                          onClick={() => playTrack(song, searchResults.songs)}
                          className="w-44 shrink-0 flex flex-col gap-2.5 p-3 rounded-2xl hover:bg-zinc-800/40 transition-colors group cursor-pointer"
                        >
                          <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-zinc-900 shadow-md">
                            <img
                              src={song.artworkLarge || song.artworkSmall}
                              alt={song.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (playing) togglePlay();
                                else playTrack(song, searchResults.songs);
                              }}
                              className={`absolute bottom-2 right-2 w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 ${
                                playing ? 'opacity-100 translate-y-0' : 'opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2'
                              }`}
                            >
                              {playing ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current translate-x-0.5" />}
                            </button>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-semibold text-white truncate group-hover:underline">
                              {song.title}
                            </span>
                            <span className="text-xs text-zinc-400 truncate mt-0.5">
                              {song.artist}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Artists Search Results (No play buttons on artist cards) */}
              {(searchCategory === 'all' || searchCategory === 'artists') && searchResults.artists.length > 0 && (
                <section>
                  <h2 className="text-xl font-bold text-white tracking-tight mb-4">Artists</h2>
                  <div className="flex gap-5 overflow-x-auto pb-4 no-scrollbar scroll-smooth">
                    {searchResults.artists.map((artist) => (
                      <div
                        key={`search-art-${artist.id}`}
                        onClick={() => openArtist(artist.name)}
                        className="w-36 shrink-0 flex flex-col items-center text-center gap-2.5 p-3 rounded-2xl hover:bg-zinc-800/40 transition-colors group cursor-pointer"
                      >
                        <div className="relative w-32 h-32 rounded-full overflow-hidden bg-zinc-900 shadow-md">
                          <img
                            src={artist.image}
                            alt={artist.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                        <div className="flex flex-col items-center w-full min-w-0">
                          <span className="text-sm font-semibold text-white truncate w-full group-hover:underline">
                            {artist.name}
                          </span>
                          <span className="text-xs text-zinc-400 mt-0.5">Artist</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Albums Search Results (if not shown first) */}
              {!showAlbumsFirst && (searchCategory === 'all' || searchCategory === 'albums') && searchResults.albums.length > 0 && (
                <section>
                  <h2 className="text-xl font-bold text-white tracking-tight mb-4">Albums</h2>
                  <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar scroll-smooth">
                    {searchResults.albums.map((album) => (
                      <div
                        key={`search-alb-${album.id}`}
                        onClick={() =>
                          openAlbum(album.id, {
                            id: album.id,
                            title: album.title,
                            artist: album.artist,
                            artwork: album.artwork,
                            cover: album.artwork,
                            tracks: [],
                          })
                        }
                        className="w-44 shrink-0 flex flex-col gap-2.5 p-3 rounded-2xl hover:bg-zinc-800/40 transition-colors group cursor-pointer"
                      >
                        <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-zinc-900 shadow-md">
                          <img
                            src={album.artwork}
                            alt={album.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-semibold text-white truncate group-hover:underline">
                            {album.title}
                          </span>
                          <span className="text-xs text-zinc-400 truncate mt-0.5">
                            {album.artist}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {searchResults.songs.length === 0 && searchResults.albums.length === 0 && searchResults.artists.length === 0 && (
                <div className="text-center py-20 text-zinc-500">
                  <p className="text-sm">No results found for "{searchTerm}"</p>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* STANDARD STREAMING HOME SECTIONS */
        <div className="flex flex-col gap-10">
          {/* SECTION 1: DAILY MIXES (Refreshes daily at 12 CST, opens Mix View) */}
          <section id="daily-mixes-section">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white tracking-tight">Daily Mixes</h2>
            </div>

            <div className="flex gap-5 overflow-x-auto pb-4 no-scrollbar scroll-smooth">
              {dailyMixes.map((mix) => (
                <div
                  key={mix.id}
                  id={`mix-card-${mix.id}`}
                  onClick={() => openMix(mix)}
                  className="w-48 shrink-0 flex flex-col gap-2.5 p-3 rounded-2xl hover:bg-zinc-800/40 transition-colors group cursor-pointer"
                >
                  {/* Daily Mix Vinyl Disk */}
                  <div className="relative aspect-square w-full rounded-2xl overflow-hidden shadow-lg">
                    <MixDisk
                      title={mix.title}
                      mixNumber={mix.id.replace(/[^\d]/g, '') || '1'}
                      gradient={mix.gradient || 'indigo'}
                      size="md"
                    />
                  </div>

                  {/* Clean text below cover */}
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-white truncate group-hover:underline">
                      {mix.title}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* SECTION 2: RECAP (Under Daily Mixes, showing last 20 albums listened to) */}
          {recapAlbums.length > 0 && (
            <section id="recap-section">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-white tracking-tight">Recap</h2>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar scroll-smooth">
                {recapAlbums.map((alb, idx) => (
                  <div
                    key={`recap-${alb.id}-${idx}`}
                    id={`recap-card-${alb.id}`}
                    onClick={() =>
                      openAlbum(alb.id, {
                        id: alb.id,
                        title: alb.title,
                        artist: alb.artist,
                        artwork: alb.artwork,
                        cover: alb.artwork,
                        tracks: [],
                      })
                    }
                    className="w-44 shrink-0 flex flex-col gap-2.5 p-3 rounded-2xl hover:bg-zinc-800/40 transition-colors group cursor-pointer"
                  >
                    <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-zinc-900 shadow-md">
                      <img
                        src={alb.artwork}
                        alt={alb.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-white truncate group-hover:underline">
                        {alb.title}
                      </span>
                      <span className="text-xs text-zinc-400 truncate mt-0.5">
                        {alb.artist}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* SECTION 3: POPULAR TRACKS (Based on real charts & user preferred genres like Drake & Morgan Wallen) */}
          <section id="popular-tracks-section">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white tracking-tight">Popular Tracks</h2>
            </div>

            {loadingRecommendations && popularTracks.length === 0 ? (
              <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="w-44 shrink-0 flex flex-col gap-2.5 p-3">
                    <div className="aspect-square w-full rounded-xl bg-zinc-900 animate-pulse" />
                    <div className="h-4 w-3/4 bg-zinc-900 rounded animate-pulse" />
                    <div className="h-3 w-1/2 bg-zinc-900 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar scroll-smooth">
                {popularTracks.map((song) => {
                  const playing = isCurrentPlaying(song.id);
                  return (
                    <div
                      key={`pop-track-${song.id}`}
                      id={`pop-card-${song.id}`}
                      onClick={() => playTrack(song, popularTracks)}
                      className="w-44 shrink-0 flex flex-col gap-2.5 p-3 rounded-2xl hover:bg-zinc-800/40 transition-colors group cursor-pointer"
                    >
                      <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-zinc-900 shadow-md">
                        <img
                          src={song.artworkLarge || song.artworkSmall}
                          alt={song.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (playing) togglePlay();
                            else playTrack(song, popularTracks);
                          }}
                          className={`absolute bottom-2 right-2 w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 ${
                            playing ? 'opacity-100 translate-y-0' : 'opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2'
                          }`}
                        >
                          {playing ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current translate-x-0.5" />}
                        </button>
                      </div>

                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-white truncate group-hover:underline">
                          {song.title}
                        </span>
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            openArtist(song.artist);
                          }}
                          className="text-xs text-zinc-400 truncate mt-0.5 hover:text-white hover:underline cursor-pointer"
                        >
                          {song.artist}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* SECTION 4: NEW RELEASES (Based on artists/genres you listen to) */}
          <section id="new-releases-section">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white tracking-tight">New Releases</h2>
            </div>

            {loadingRecommendations && newReleases.length === 0 ? (
              <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="w-44 shrink-0 flex flex-col gap-2.5 p-3">
                    <div className="aspect-square w-full rounded-xl bg-zinc-900 animate-pulse" />
                    <div className="h-4 w-3/4 bg-zinc-900 rounded animate-pulse" />
                    <div className="h-3 w-1/2 bg-zinc-900 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar scroll-smooth">
                {newReleases.map((album) => (
                  <div
                    key={`new-rel-${album.id}`}
                    id={`release-card-${album.id}`}
                    onClick={() =>
                      openAlbum(album.id, {
                        id: album.id,
                        title: album.title,
                        artist: album.artist,
                        artwork: album.artwork,
                        artworkLarge: album.artwork,
                        tracks: [],
                      })
                    }
                    className="w-44 shrink-0 flex flex-col gap-2.5 p-3 rounded-2xl hover:bg-zinc-800/40 transition-colors group cursor-pointer"
                  >
                    <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-zinc-900 shadow-md">
                      <img
                        src={album.artwork}
                        alt={album.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-white truncate group-hover:underline">
                        {album.title}
                      </span>
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          openArtist(album.artist);
                        }}
                        className="text-xs text-zinc-400 truncate mt-0.5 hover:text-white hover:underline cursor-pointer"
                      >
                        {album.artist}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* SECTION 5: RECOMMENDED SONGS (Curated songs you don't have in your library) */}
          <section id="recommended-songs-section">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white tracking-tight">Recommended Songs</h2>
            </div>

            {loadingRecommendations && recommendedSongs.length === 0 ? (
              <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="w-44 shrink-0 flex flex-col gap-2.5 p-3">
                    <div className="aspect-square w-full rounded-xl bg-zinc-900 animate-pulse" />
                    <div className="h-4 w-3/4 bg-zinc-900 rounded animate-pulse" />
                    <div className="h-3 w-1/2 bg-zinc-900 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar scroll-smooth">
                {recommendedSongs.map((song) => {
                  const playing = isCurrentPlaying(song.id);
                  return (
                    <div
                      key={`rec-song-${song.id}`}
                      id={`song-card-${song.id}`}
                      onClick={() => playTrack(song, recommendedSongs)}
                      className="w-44 shrink-0 flex flex-col gap-2.5 p-3 rounded-2xl hover:bg-zinc-800/40 transition-colors group cursor-pointer"
                    >
                      <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-zinc-900 shadow-md">
                        <img
                          src={song.artworkLarge || song.artworkSmall}
                          alt={song.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (playing) togglePlay();
                            else playTrack(song, recommendedSongs);
                          }}
                          className={`absolute bottom-2 right-2 w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 ${
                            playing ? 'opacity-100 translate-y-0' : 'opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2'
                          }`}
                        >
                          {playing ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current translate-x-0.5" />}
                        </button>
                      </div>

                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-white truncate group-hover:underline">
                          {song.title}
                        </span>
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            openArtist(song.artist);
                          }}
                          className="text-xs text-zinc-400 truncate mt-0.5 hover:text-white hover:underline cursor-pointer"
                        >
                          {song.artist}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* SECTION 6: RECOMMENDED ALBUMS (Curated albums you don't have in your library) */}
          <section id="recommended-albums-section">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white tracking-tight">Recommended Albums</h2>
            </div>

            {loadingRecommendations && recommendedAlbums.length === 0 ? (
              <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="w-44 shrink-0 flex flex-col gap-2.5 p-3">
                    <div className="aspect-square w-full rounded-xl bg-zinc-900 animate-pulse" />
                    <div className="h-4 w-3/4 bg-zinc-900 rounded animate-pulse" />
                    <div className="h-3 w-1/2 bg-zinc-900 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar scroll-smooth">
                {recommendedAlbums.map((album) => (
                  <div
                    key={`rec-alb-${album.id}`}
                    id={`album-card-${album.id}`}
                    onClick={() =>
                      openAlbum(album.id, {
                        id: album.id,
                        title: album.title,
                        artist: album.artist,
                        artwork: album.artwork,
                        artworkLarge: album.artwork,
                        tracks: [],
                      })
                    }
                    className="w-44 shrink-0 flex flex-col gap-2.5 p-3 rounded-2xl hover:bg-zinc-800/40 transition-colors group cursor-pointer"
                  >
                    <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-zinc-900 shadow-md">
                      <img
                        src={album.artwork}
                        alt={album.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-white truncate group-hover:underline">
                        {album.title}
                      </span>
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          openArtist(album.artist);
                        }}
                        className="text-xs text-zinc-400 truncate mt-0.5 hover:text-white hover:underline cursor-pointer"
                      >
                        {album.artist}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* SECTION 7: RECOMMENDED ARTISTS (Deezer photos) */}
          <section id="recommended-artists-section">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white tracking-tight">Recommended Artists</h2>
            </div>

            {loadingRecommendations && recommendedArtists.length === 0 ? (
              <div className="flex gap-5 overflow-x-auto pb-4 no-scrollbar">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="w-36 shrink-0 flex flex-col items-center gap-2.5 p-3">
                    <div className="w-32 h-32 rounded-full bg-zinc-900 animate-pulse" />
                    <div className="h-4 w-3/4 bg-zinc-900 rounded animate-pulse" />
                    <div className="h-3 w-1/2 bg-zinc-900 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex gap-5 overflow-x-auto pb-4 no-scrollbar scroll-smooth">
                {recommendedArtists.map((artist) => (
                  <div
                    key={`rec-art-${artist.id}`}
                    id={`artist-circle-${artist.id}`}
                    onClick={() => openArtist(artist.name)}
                    className="w-36 shrink-0 flex flex-col items-center text-center gap-2.5 p-3 rounded-2xl hover:bg-zinc-800/40 transition-colors group cursor-pointer"
                  >
                    <div className="relative w-32 h-32 rounded-full overflow-hidden bg-zinc-900 shadow-md">
                      <img
                        src={artist.image}
                        alt={artist.name}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://cdn-images.dzcdn.net/images/artist/bb76c2ee3b068726ab4c37b0aabdb57a/500x500-000000-80-0-0.jpg';
                        }}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>

                    <div className="flex flex-col items-center w-full min-w-0">
                      <span className="text-sm font-semibold text-white truncate w-full group-hover:underline">
                        {artist.name}
                      </span>
                      <span className="text-xs text-zinc-400 mt-0.5">
                        Artist
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
