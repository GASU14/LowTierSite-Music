import { Track, LyricLine, LyricsData, AlbumDetail, ArtistDetail, DailyMixItem } from '../types';

// Parse LRC formatted string into structured LyricLine array
export function parseLrc(lrcText: string): LyricLine[] {
  if (!lrcText) return [];
  const lines = lrcText.split('\n');
  const result: LyricLine[] = [];
  let idCounter = 0;

  for (const line of lines) {
    const match = line.match(/\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)/);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const millis = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0;
      const totalSeconds = minutes * 60 + seconds + millis / 1000;
      const text = match[4].trim();

      if (text) {
        result.push({
          id: idCounter++,
          time: totalSeconds,
          text,
        });
      }
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

// Convert Deezer track object to application Track model
export function mapDeezerTrack(d: any): Track {
  const artwork = d.album?.cover_xl || d.album?.cover_big || d.album?.cover_medium || d.album?.cover || '';
  return {
    id: `dz-${d.id}`,
    title: d.title || d.title_short || 'Untitled',
    artist: d.artist?.name || 'Unknown Artist',
    album: d.album?.title || 'Single',
    artworkSmall: d.album?.cover_medium || artwork,
    artworkLarge: d.album?.cover_big || artwork,
    artworkOriginal: artwork,
    durationMs: (d.duration || 180) * 1000,
    previewUrl: d.preview || '',
    releaseDate: d.release_date || '',
    rank: d.rank || 0,
    albumId: d.album?.id,
    artistId: d.artist?.id,
  };
}

// Search Deezer artists for authentic artist pictures & metadata
export async function searchDeezerArtists(term: string, limit: number = 25): Promise<Array<{
  id: string | number;
  name: string;
  image: string;
  followers?: number;
  deezerId: number;
}>> {
  if (!term || !term.trim()) return [];

  try {
    const url = `/api/deezer/artist-search?q=${encodeURIComponent(term.trim())}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.data) && data.data.length > 0) {
        return data.data.slice(0, limit).map((a: any) => ({
          id: `dz-${a.id}`,
          deezerId: a.id,
          name: a.name,
          image: a.picture_xl || a.picture_big || a.picture_medium || a.picture,
          followers: a.nb_fan || 0,
        }));
      }
    }
  } catch (e) {
    console.warn("Deezer search failed, falling back:", e);
  }

  // Fallback: iTunes artist search via server endpoint
  try {
    const itunesArtists = await searchItunesArtists(term, limit);
    if (itunesArtists.length > 0) {
      return itunesArtists.map((a, idx) => ({
        id: a.id || `itunes-art-${idx}`,
        deezerId: typeof a.artistId === 'number' ? a.artistId : 0,
        name: a.name,
        image: a.image,
        followers: 1000000,
      }));
    }
  } catch (fallbackErr) {
    console.warn("iTunes fallback artist search failed:", fallbackErr);
  }

  return [];
}

// Fetch complete Spotify-style artist details: Top tracks, Discography (Albums, Singles, Features)
export async function getArtistDetails(artistNameOrId: string | number): Promise<ArtistDetail | null> {
  try {
    let artistId = typeof artistNameOrId === 'number' ? artistNameOrId : null;
    let initialName = typeof artistNameOrId === 'string' ? artistNameOrId : '';

    // If ID is prefixed or string, search for Deezer artist ID
    if (!artistId || isNaN(Number(artistId))) {
      const searchRes = await searchDeezerArtists(initialName || String(artistNameOrId), 5);
      if (searchRes.length > 0) {
        artistId = searchRes[0].deezerId;
      }
    }

    if (!artistId) {
      // Fallback: build synthetic profile from track search
      const tracks = await searchItunes(initialName, 10);
      if (tracks.length === 0) return null;
      return {
        id: `artist-${initialName.toLowerCase().replace(/\s+/g, '-')}`,
        name: tracks[0].artist,
        image: tracks[0].artworkOriginal || tracks[0].artworkLarge,
        picture: tracks[0].artworkOriginal || tracks[0].artworkLarge,
        headerImage: tracks[0].artworkOriginal,
        followers: 1250000,
        monthlyListeners: 3450000,
        topTracks: tracks,
        popularTracks: tracks,
        albums: [],
        singles: [],
        features: [],
        allReleases: [],
        discography: [],
      };
    }

    // Call Deezer Artist endpoint
    try {
      const url = `/api/deezer/artist/${artistId}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const artistData = data.artist || {};
        const topTracksRaw = data.topTracks || [];
        const albumsRaw = data.albums || [];

        const topTracks: Track[] = topTracksRaw.map(mapDeezerTrack);

        const albums: AlbumDetail[] = [];
        const singles: AlbumDetail[] = [];
        const features: AlbumDetail[] = [];
        const allReleases: AlbumDetail[] = [];

        for (const alb of albumsRaw) {
          const year = alb.release_date ? alb.release_date.substring(0, 4) : '';
          const cover = alb.cover_xl || alb.cover_big || alb.cover_medium || '';
          const recordType = (alb.record_type || 'album').toLowerCase();

          const albumObj: AlbumDetail = {
            id: alb.id,
            title: alb.title,
            artist: artistData.name || initialName,
            artistId: artistId,
            artwork: cover,
            artworkLarge: cover,
            releaseDate: alb.release_date || '',
            year: year || '2024',
            genre: alb.genre_id ? 'Music' : 'Pop',
            trackCount: alb.nb_tracks || 1,
            recordType: recordType,
            tracks: [],
          };

          allReleases.push(albumObj);
          if (recordType === 'single' || recordType === 'ep') {
            singles.push(albumObj);
          } else if (recordType === 'compile' || recordType === 'compilation') {
            features.push(albumObj);
          } else {
            albums.push(albumObj);
          }
        }

        const followers = artistData.nb_fan || 1845000;
        const monthlyListeners = Math.round(followers * 2.8);

        return {
          id: artistId,
          name: artistData.name || initialName,
          image: artistData.picture_xl || artistData.picture_big || artistData.picture_medium || '',
          picture: artistData.picture_xl || artistData.picture_big || artistData.picture_medium || '',
          headerImage: artistData.picture_xl || artistData.picture_big,
          followers,
          monthlyListeners,
          topTracks,
          popularTracks: topTracks,
          albums,
          singles,
          features,
          allReleases,
          discography: allReleases,
        };
      }
    } catch {}

    // Static site fallback: synthesize artist profile directly from iTunes browser search
    try {
      const [tracks, albumsRes] = await Promise.all([
        searchItunes(initialName || String(artistNameOrId), 25),
        searchAlbums(initialName || String(artistNameOrId), 15),
      ]);

      if (tracks.length > 0) {
        const leadTrack = tracks[0];
        const artistName = leadTrack.artist || initialName;
        const mappedAlbums: AlbumDetail[] = albumsRes.map((a) => ({
          id: a.id,
          title: a.title,
          artist: a.artist || artistName,
          artwork: a.artwork,
          artworkLarge: a.artwork,
          year: a.year || '2024',
          genre: a.genre || 'Music',
          trackCount: a.trackCount || 1,
          recordType: 'album',
          tracks: [],
        }));

        return {
          id: `art-${initialName.toLowerCase().replace(/\s+/g, '-')}`,
          name: artistName,
          image: leadTrack.artworkOriginal || leadTrack.artworkLarge,
          picture: leadTrack.artworkOriginal || leadTrack.artworkLarge,
          headerImage: leadTrack.artworkOriginal || leadTrack.artworkLarge,
          followers: 1850000,
          monthlyListeners: 4200000,
          topTracks: tracks,
          popularTracks: tracks,
          albums: mappedAlbums,
          singles: [],
          features: [],
          allReleases: mappedAlbums,
          discography: mappedAlbums,
        };
      }
    } catch (fallbackErr) {
      console.warn("Static fallback for artist details failed:", fallbackErr);
    }

    return null;
  } catch (err) {
    console.error("getArtistDetails error:", err);
    return null;
  }
}

// Fetch complete Spotify-style Album details with full tracklist
export async function getAlbumDetails(
  albumId: string | number,
  albumTitle?: string,
  artistName?: string
): Promise<AlbumDetail | null> {
  const cleanId = String(albumId).replace('dz-', '').replace('itunes-', '');
  const isNumeric = /^\d+$/.test(cleanId);

  // Strategy 1: Deezer API if numeric ID
  if (isNumeric) {
    try {
      const url = `/api/deezer/album/${cleanId}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data && data.title && !data.error) {
          const cover = data.cover_xl || data.cover_big || data.cover_medium || '';
          
          // Sort tracks by disc_number and track_position
          const rawTracks = (data.tracks?.data || []).slice().sort((a: any, b: any) => {
            const discDiff = (a.disk_number || 1) - (b.disk_number || 1);
            if (discDiff !== 0) return discDiff;
            return (a.track_position || 0) - (b.track_position || 0);
          });

          // Deduplicate tracks by id and title
          const seenTitles = new Set<string>();
          const tracks: Track[] = [];

          for (const t of rawTracks) {
            const normalizedTitle = (t.title || t.title_short || '').toLowerCase().trim();
            if (seenTitles.has(normalizedTitle)) continue;
            seenTitles.add(normalizedTitle);

            tracks.push({
              id: `dz-${t.id}`,
              title: t.title || t.title_short,
              artist: t.artist?.name || data.artist?.name || artistName || 'Unknown Artist',
              album: data.title,
              artworkSmall: data.cover_medium || cover,
              artworkLarge: data.cover_big || cover,
              artworkOriginal: cover,
              durationMs: (t.duration || 180) * 1000,
              previewUrl: t.preview || '',
              albumId: data.id,
              artistId: data.artist?.id,
              rank: t.rank || 0,
            });
          }

          return {
            id: data.id,
            title: data.title,
            artist: data.artist?.name || artistName || 'Unknown Artist',
            artistId: data.artist?.id,
            artwork: cover,
            artworkLarge: cover,
            releaseDate: data.release_date || '',
            year: data.release_date ? data.release_date.substring(0, 4) : '2024',
            genre: data.genres?.data?.[0]?.name || 'Music',
            trackCount: tracks.length || data.nb_tracks,
            durationSec: data.duration || 0,
            recordType: data.record_type || 'album',
            tracks,
          };
        }
      }
    } catch (err) {
      console.error("getAlbumDetails Deezer error:", err);
    }
  }

  // Strategy 2: Direct iTunes Album Lookup if numeric ID
  if (isNumeric) {
    try {
      let itunesRes = await fetch(`/api/itunes/album/${cleanId}`).catch(() => null);
      if (!itunesRes || !itunesRes.ok) {
        itunesRes = await fetch(`https://itunes.apple.com/lookup?id=${cleanId}&entity=song`).catch(() => null);
      }
      if (itunesRes && itunesRes.ok) {
        const itunesData = await itunesRes.json();
        if (itunesData.results && itunesData.results.length > 0) {
          const collection = itunesData.results.find((r: any) => r.wrapperType === 'collection') || itunesData.results[0];
          const rawSongResults = itunesData.results.filter((r: any) => r.wrapperType === 'track');
          
          // Sort by discNumber then trackNumber
          rawSongResults.sort((a: any, b: any) => {
            const discDiff = (a.discNumber || 1) - (b.discNumber || 1);
            if (discDiff !== 0) return discDiff;
            return (a.trackNumber || 0) - (b.trackNumber || 0);
          });

          const seenTitles = new Set<string>();
          const tracks: Track[] = [];
          const artworkUrl = collection.artworkUrl100
            ? collection.artworkUrl100.replace('100x100bb', '600x600bb')
            : '';

          for (const s of rawSongResults) {
            const normTitle = (s.trackName || '').toLowerCase().trim();
            if (seenTitles.has(normTitle)) continue;
            seenTitles.add(normTitle);

            tracks.push({
              id: `itunes-${s.trackId}`,
              title: s.trackName,
              artist: s.artistName,
              album: s.collectionName || collection.collectionName,
              artworkSmall: s.artworkUrl60 || s.artworkUrl100 || artworkUrl,
              artworkLarge: s.artworkUrl100 ? s.artworkUrl100.replace('100x100bb', '600x600bb') : artworkUrl,
              artworkOriginal: s.artworkUrl100 ? s.artworkUrl100.replace('100x100bb', '1000x1000bb') : artworkUrl,
              durationMs: s.trackTimeMillis || 180000,
              previewUrl: s.previewUrl || '',
              albumId: s.collectionId || collection.collectionId,
              artistId: s.artistId,
              releaseDate: s.releaseDate || collection.releaseDate,
              genre: s.primaryGenreName || collection.primaryGenreName,
            });
          }

          if (tracks.length > 0) {
            return {
              id: collection.collectionId || albumId,
              title: collection.collectionName || albumTitle || 'Album',
              artist: collection.artistName || artistName || 'Unknown Artist',
              artistId: collection.artistId,
              artwork: artworkUrl,
              artworkLarge: artworkUrl,
              releaseDate: collection.releaseDate || '',
              year: collection.releaseDate ? collection.releaseDate.substring(0, 4) : '2024',
              genre: collection.primaryGenreName || 'Music',
              trackCount: tracks.length,
              tracks,
            };
          }
        }
      }
    } catch (err) {
      console.error("iTunes album direct lookup error:", err);
    }
  }

  // Strategy 3: Search iTunes by album title & artist
  const searchQuery = `${albumTitle || albumId} ${artistName || ''}`.trim();
  try {
    let searchRes = await fetch(`/api/itunes/search-album?q=${encodeURIComponent(searchQuery)}`).catch(() => null);
    if (!searchRes || !searchRes.ok) {
      searchRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&entity=album&limit=5`).catch(() => null);
    }
    if (searchRes && searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.results && searchData.results.length > 0) {
        const foundAlbum = searchData.results[0];
        if (foundAlbum.collectionId) {
          // Recursive lookup with collectionId
          const details = await getAlbumDetails(foundAlbum.collectionId, foundAlbum.collectionName, foundAlbum.artistName);
          if (details) return details;
        }
      }
    }

    // Fallback: general iTunes track search
    const itunesTracks = await searchItunes(searchQuery, 40);
    if (itunesTracks && itunesTracks.length > 0) {
      const targetAlbum = (albumTitle || String(albumId)).toLowerCase();
      const matchingTracks = itunesTracks.filter((t) =>
        t.album.toLowerCase().includes(targetAlbum) || targetAlbum.includes(t.album.toLowerCase())
      );
      const chosen = matchingTracks.length > 0 ? matchingTracks : itunesTracks.slice(0, 15);
      
      const seenTitles = new Set<string>();
      const dedupedTracks: Track[] = [];
      for (const t of chosen) {
        const norm = t.title.toLowerCase().trim();
        if (seenTitles.has(norm)) continue;
        seenTitles.add(norm);
        dedupedTracks.push(t);
      }

      const lead = dedupedTracks[0] || itunesTracks[0];
      return {
        id: lead.albumId || albumId,
        title: albumTitle || lead.album || String(albumId),
        artist: lead.artist || artistName || 'Unknown Artist',
        artistId: lead.artistId,
        artwork: lead.artworkOriginal || lead.artworkLarge || lead.artworkSmall,
        artworkLarge: lead.artworkLarge || lead.artworkSmall,
        releaseDate: lead.releaseDate || '',
        year: lead.releaseDate ? lead.releaseDate.substring(0, 4) : '2024',
        genre: lead.genre || 'Music',
        trackCount: dedupedTracks.length,
        tracks: dedupedTracks,
      };
    }
  } catch (err) {
    console.error("iTunes album search failed:", err);
  }

  return null;
}

// Get current date string in Central Standard Time (America/Chicago)
export function getCSTDateKey(): string {
  try {
    const now = new Date();
    const cstString = now.toLocaleDateString('en-US', { timeZone: 'America/Chicago' });
    // Format: MM/DD/YYYY -> YYYY-MM-DD
    const parts = cstString.split('/');
    if (parts.length === 3) {
      const [m, d, y] = parts;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return now.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

// Daily Mixes that refresh every day at midnight 12:00 AM CST based on user library and taste
export async function getDailyMixesCST(selectedArtists: string[] = []): Promise<DailyMixItem[]> {
  const cstDate = getCSTDateKey();

  // Curated genre affinity clusters
  const clusters = [
    {
      id: 'mix-hiphop',
      title: 'Daily Mix 1',
      genre: 'Hip-Hop / Rap',
      keywords: ['drake', 'travis', 'kendrick', 'future', '21 savage', 'kanye', 'metro', 'gunna', 'baby', 'carti', 'cole', 'rocky', 'uzi'],
      curatedArtists: ['Drake', 'Travis Scott', 'Kendrick Lamar', 'Future', '21 Savage', 'Kanye West'],
      gradient: 'from-amber-600 via-rose-800 to-[#121212]',
    },
    {
      id: 'mix-country',
      title: 'Daily Mix 2',
      genre: 'Country / Americana',
      keywords: ['morgan', 'wallen', 'combs', 'bryan', 'stapleton', 'childers', 'roll', 'zimmerman', 'post malone', 'kacey', 'luke'],
      curatedArtists: ['Morgan Wallen', 'Luke Combs', 'Zach Bryan', 'Chris Stapleton', 'Tyler Childers', 'Jelly Roll'],
      gradient: 'from-amber-700 via-yellow-900 to-[#121212]',
    },
    {
      id: 'mix-pop',
      title: 'Daily Mix 3',
      genre: 'Pop / Modern Hits',
      keywords: ['taylor', 'swift', 'the weeknd', 'billie', 'dua', 'olivia', 'sabrina', 'ariana', 'bruno', 'chappell'],
      curatedArtists: ['The Weeknd', 'Taylor Swift', 'Billie Eilish', 'Dua Lipa', 'Post Malone', 'Sabrina Carpenter'],
      gradient: 'from-indigo-600 via-purple-900 to-[#121212]',
    },
    {
      id: 'mix-rnb',
      title: 'Daily Mix 4',
      genre: 'R&B / Neo-Soul',
      keywords: ['sza', 'frank', 'ocean', 'caesar', 'brent', 'faiyaz', 'lacy', 'giveon', 'walker', 'jhene', 'partynextdoor'],
      curatedArtists: ['SZA', 'Frank Ocean', 'Daniel Caesar', 'Brent Faiyaz', 'Steve Lacy', 'Giveon'],
      gradient: 'from-orange-600 via-red-900 to-[#121212]',
    },
    {
      id: 'mix-rock',
      title: 'Daily Mix 5',
      genre: 'Rock / Alternative / Indie',
      keywords: ['arctic', 'tame', 'neighbourhood', 'elephant', 'deftones', 'nirvana', 'strokes', 'radiohead', 'gorillaz'],
      curatedArtists: ['Arctic Monkeys', 'The Neighbourhood', 'Tame Impala', 'Cage the Elephant', 'Deftones'],
      gradient: 'from-rose-600 via-pink-900 to-[#121212]',
    },
    {
      id: 'mix-latin',
      title: 'Daily Mix 6',
      genre: 'Latin / Global Beats',
      keywords: ['bad bunny', 'rauw', 'feid', 'karol', 'peso', 'balvin', 'rosalia', 'maluma'],
      curatedArtists: ['Bad Bunny', 'Rauw Alejandro', 'Feid', 'Karol G', 'Peso Pluma', 'J Balvin'],
      gradient: 'from-emerald-600 via-teal-900 to-[#121212]',
    },
  ];

  // Distribute user's library artists into the best matching clusters
  const userArtistLower = selectedArtists.map(a => a.toLowerCase());
  const assignedClusters = clusters.map((cluster, idx) => {
    // Find matching user artists for this cluster
    const matchedUser = selectedArtists.filter(art => {
      const artL = art.toLowerCase();
      return cluster.keywords.some(kw => artL.includes(kw)) ||
        cluster.curatedArtists.some(ca => ca.toLowerCase() === artL);
    });

    // Blend user's artists with curated artists they might like
    const combined = [
      ...matchedUser,
      ...cluster.curatedArtists.filter(ca => !matchedUser.some(mu => mu.toLowerCase() === ca.toLowerCase()))
    ].slice(0, 5);

    // Score cluster relevance based on how many user artists match
    const relevance = matchedUser.length;

    return {
      ...cluster,
      title: `Daily Mix ${idx + 1}`,
      primaryArtists: combined,
      relevance,
    };
  });

  // Sort clusters so genres the user actually listens to appear in Daily Mix 1 & 2
  assignedClusters.sort((a, b) => b.relevance - a.relevance);

  // If user has artists not matched in any specific cluster, ensure they are in Mix 1
  if (selectedArtists.length > 0 && assignedClusters[0].relevance === 0) {
    assignedClusters[0].primaryArtists = [
      ...selectedArtists.slice(0, 3),
      ...assignedClusters[0].primaryArtists.slice(0, 2)
    ];
  }

  const mixes: DailyMixItem[] = assignedClusters.map((group, idx) => {
    return {
      id: `${group.id}-${cstDate}`,
      title: `Daily Mix ${idx + 1}`,
      subtitle: `${group.primaryArtists.slice(0, 3).join(', ')}, and more`,
      artists: group.primaryArtists,
      coverArt: `https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80`,
      gradient: group.gradient,
    };
  });

  return mixes;
}

// Fetch tracks for a specific Daily Mix
export async function getMixTracks(mixOrArtists: DailyMixItem | string[] | any): Promise<Track[]> {
  let artists: string[] = [];
  if (Array.isArray(mixOrArtists)) {
    artists = mixOrArtists;
  } else if (mixOrArtists && Array.isArray(mixOrArtists.artists)) {
    artists = mixOrArtists.artists;
  } else if (mixOrArtists && typeof mixOrArtists.title === 'string') {
    artists = [mixOrArtists.title];
  }

  if (artists.length === 0) {
    artists = ['Drake', 'The Weeknd', 'Travis Scott', 'Taylor Swift', 'SZA'];
  }

  const allTracks: Track[] = [];
  const promises = artists.slice(0, 5).map(async (artist) => {
    try {
      const res = await searchItunes(artist, 6);
      return res;
    } catch {
      return [];
    }
  });

  const results = await Promise.all(promises);
  for (const list of results) {
    allTracks.push(...list);
  }

  // Interleave tracks for a natural playlist mix feel
  const mixed: Track[] = [];
  const maxLen = Math.max(...results.map(r => r.length), 0);
  for (let i = 0; i < maxLen; i++) {
    for (const list of results) {
      if (list[i]) mixed.push(list[i]);
    }
  }

  const combined = mixed.length > 0 ? mixed : allTracks;
  const deduplicated = combined.filter(
    (t, idx, self) => t && idx === self.findIndex((x) => x && (x.id === t.id || (x.title.toLowerCase() === t.title.toLowerCase() && x.artist.toLowerCase() === t.artist.toLowerCase())))
  );

  if (deduplicated.length > 0) return deduplicated;

  return await searchItunes('top hits', 20);
}

// Search iTunes tracks with high resolution artwork
export async function searchItunes(term: string, limit: number = 25): Promise<Track[]> {
  try {
    const url = `/api/itunes?term=${encodeURIComponent(term)}&limit=${limit}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.results) && data.results.length > 0) {
        return data.results;
      }
    }
  } catch {}

  try {
    const directUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=${limit}`;
    const directRes = await fetch(directUrl);
    if (!directRes.ok) return [];
    const directData = await directRes.json();
    return (directData.results || []).map((item: any) => ({
      id: item.trackId,
      title: item.trackName,
      artist: item.artistName,
      album: item.collectionName || "Single",
      artworkSmall: item.artworkUrl100,
      artworkLarge: item.artworkUrl100 ? item.artworkUrl100.replace("100x100bb", "600x600bb") : "",
      artworkOriginal: item.artworkUrl100 ? item.artworkUrl100.replace("100x100bb", "1200x1200bb") : "",
      durationMs: item.trackTimeMillis || 180000,
      previewUrl: item.previewUrl || "",
      releaseDate: item.releaseDate || "",
      genre: item.primaryGenreName || "Music",
    }));
  } catch (err) {
    console.error("iTunes direct search failed:", err);
    return [];
  }
}

/**
 * Compare an array of tracks (e.g. from CSV import) with the iTunes API,
 * replacing missing/raw metadata, placeholder images, and titles with official iTunes records.
 */
export async function fixAndEnrichTracksWithItunes(
  tracks: Track[],
  onProgress?: (completed: number, total: number) => void
): Promise<{ enrichedTracks: Track[]; matchCount: number }> {
  if (!tracks || tracks.length === 0) {
    return { enrichedTracks: [], matchCount: 0 };
  }

  let completedCount = 0;
  let matchCount = 0;
  const total = tracks.length;
  const enrichedTracks: Track[] = new Array(total);

  // Process tracks in concurrent batches of 4 to prevent rate limits
  const BATCH_SIZE = 4;
  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = tracks.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (track, indexInBatch) => {
        const globalIdx = i + indexInBatch;
        try {
          const artistPart = track.artist && track.artist !== 'Unknown Artist' ? track.artist : '';
          const query = `${track.title} ${artistPart}`.trim();
          const results = await searchItunes(query, 5);

          if (results && results.length > 0) {
            const normTitle = track.title.toLowerCase().replace(/[^a-z0-9]/g, '');
            const normArtist = artistPart.toLowerCase().replace(/[^a-z0-9]/g, '');

            let bestMatch = results[0];
            for (const item of results) {
              const itemTitle = item.title.toLowerCase().replace(/[^a-z0-9]/g, '');
              const itemArtist = item.artist.toLowerCase().replace(/[^a-z0-9]/g, '');

              if (
                (normTitle && itemTitle.includes(normTitle)) ||
                (normArtist && itemArtist.includes(normArtist))
              ) {
                bestMatch = item;
                break;
              }
            }

            enrichedTracks[globalIdx] = {
              ...track,
              id: bestMatch.id ? String(bestMatch.id) : track.id,
              title: bestMatch.title || track.title,
              artist: bestMatch.artist || track.artist,
              album: bestMatch.album && bestMatch.album !== 'Single' ? bestMatch.album : track.album,
              artworkSmall: bestMatch.artworkSmall || track.artworkSmall,
              artworkLarge: bestMatch.artworkLarge || track.artworkLarge,
              artworkOriginal: bestMatch.artworkOriginal || bestMatch.artworkLarge || track.artworkOriginal,
              durationMs: bestMatch.durationMs || track.durationMs,
              previewUrl: bestMatch.previewUrl || track.previewUrl,
              audioUrl: bestMatch.audioUrl || bestMatch.previewUrl || track.audioUrl,
              isItunesMatched: true,
            };
            matchCount++;
          } else {
            enrichedTracks[globalIdx] = track;
          }
        } catch (err) {
          console.warn(`iTunes match failed for track "${track.title}":`, err);
          enrichedTracks[globalIdx] = track;
        } finally {
          completedCount++;
          if (onProgress) {
            onProgress(completedCount, total);
          }
        }
      })
    );
  }

  return { enrichedTracks, matchCount };
}

export interface ArtistProfile {
  id: string;
  name: string;
  genre: string;
  image: string;
  artistId?: number;
  sampleTrack?: Track;
}

// Search iTunes artist catalog with profiles & artwork
export async function searchItunesArtists(term: string, limit: number = 40): Promise<ArtistProfile[]> {
  try {
    const url = `/api/itunes-artists?term=${encodeURIComponent(term)}&limit=${limit}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.artists) && data.artists.length > 0) {
        return data.artists;
      }
    }
  } catch {}

  try {
    const directUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=${limit}`;
    const directRes = await fetch(directUrl);
    if (!directRes.ok) return [];
    const directData = await directRes.json();
    const results = directData.results || [];
    const map = new Map<string, ArtistProfile>();

    for (const item of results) {
      if (!item.artistName) continue;
      const lower = item.artistName.toLowerCase();
      if (!map.has(lower)) {
        map.set(lower, {
          id: `itunes-${item.artistId || lower.replace(/\s+/g, '-')}`,
          name: item.artistName,
          genre: item.primaryGenreName || "Music",
          image: item.artworkUrl100 ? item.artworkUrl100.replace("100x100bb", "600x600bb") : "",
          artistId: item.artistId,
        });
      }
    }
    return Array.from(map.values());
  } catch (err) {
    console.error("iTunes artist search failed:", err);
    return [];
  }
}

// Client-side fallback for static sites (surge.sh, github.io, netlify, etc.)
async function clientSideResolveYouTube(
  queryOrUrl: string,
  isUrl: boolean = false,
  artist?: string,
  title?: string,
  isVideo: boolean = false
): Promise<{
  videoId: string;
  url: string;
  matchedTitle?: string;
  matchedOwner?: string;
  score?: number;
  durationSec?: number;
  sources?: Array<{ id: string; title: string; owner: string; score: number }>;
}> {
  // 1. Direct YouTube link parsing
  const urlCandidate = isUrl ? queryOrUrl : (queryOrUrl.includes('youtube.com') || queryOrUrl.includes('youtu.be') ? queryOrUrl : '');
  if (urlCandidate) {
    const match = urlCandidate.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    if (match && match[1]) {
      return {
        videoId: match[1],
        url: `https://www.youtube.com/watch?v=${match[1]}`,
        matchedTitle: title || 'YouTube Video',
        matchedOwner: artist || 'YouTube',
        score: 100,
        sources: [{ id: match[1], title: title || 'YouTube Video', owner: artist || 'YouTube', score: 100 }],
      };
    }
  }

  // 2. Build target query
  let searchQuery = '';
  if (artist && title) {
    searchQuery = isVideo ? `${artist} - ${title} official music video` : `${artist} - ${title}`;
  } else {
    searchQuery = isVideo ? `${queryOrUrl} official music video` : queryOrUrl;
  }

  // 3. Query public CORS-enabled search resolvers (Piped instances)
  const pipedEndpoints = [
    'https://api.piped.private.coffee',
    'https://pipedapi.ducks.party',
    'https://piped.mha.fi',
  ];

  for (const baseUrl of pipedEndpoints) {
    try {
      const resp = await fetch(`${baseUrl}/search?q=${encodeURIComponent(searchQuery)}&filter=all`, {
        signal: AbortSignal.timeout(3500),
      });
      if (resp.ok) {
        const data = await resp.json();
        const items = Array.isArray(data.items) ? data.items : [];
        const streams = items.filter((it: any) => it.type === 'stream' || (it.url && it.url.includes('/watch?v=')));

        if (streams.length > 0) {
          const first = streams[0];
          const vidMatch = first.url.match(/v=([\w-]{11})/);
          const videoId = vidMatch ? vidMatch[1] : first.url.replace('/watch?v=', '');

          const sources = streams.slice(0, 10).map((s: any) => {
            const vM = s.url.match(/v=([\w-]{11})/);
            return {
              id: vM ? vM[1] : s.url.replace('/watch?v=', ''),
              title: s.title || '',
              owner: s.uploaderName || s.author || '',
              score: 90,
            };
          });

          return {
            videoId,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            matchedTitle: first.title,
            matchedOwner: first.uploaderName || first.author,
            durationSec: typeof first.duration === 'number' ? first.duration : 0,
            score: 90,
            sources,
          };
        }
      }
    } catch (err) {
      console.warn(`Piped instance ${baseUrl} failed, trying next:`, err);
    }
  }

  throw new Error("Unable to resolve YouTube video for track on static host");
}

// Fetch YouTube audio stream URL and video ID
export async function grabYouTubeAudio(
  queryOrUrl: string,
  isUrl: boolean = false,
  artist?: string,
  title?: string
): Promise<{
  videoId: string;
  url: string;
  matchedTitle?: string;
  matchedOwner?: string;
  score?: number;
  durationSec?: number;
  sources?: Array<{ id: string; title: string; owner: string; score: number }>;
}> {
  // Strategy 1: Call backend proxy if available
  try {
    let endpoint = isUrl
      ? `/api/yt-grab?url=${encodeURIComponent(queryOrUrl)}`
      : `/api/yt-grab?q=${encodeURIComponent(queryOrUrl)}`;

    if (artist) endpoint += `&artist=${encodeURIComponent(artist)}`;
    if (title) endpoint += `&title=${encodeURIComponent(title)}`;

    const res = await fetch(endpoint);
    if (res.ok) {
      const data = await res.json();
      if (data && data.videoId) {
        return {
          videoId: data.videoId,
          url: data.url,
          matchedTitle: data.matchedTitle,
          matchedOwner: data.matchedOwner,
          score: data.score,
          durationSec: data.durationSec,
          sources: data.sources,
        };
      }
    }
  } catch (backendErr) {
    console.warn("Backend /api/yt-grab not reachable, using static client resolver:", backendErr);
  }

  // Strategy 2: Client-side CORS resolver for static sites (Surge, GitHub Pages, etc.)
  return clientSideResolveYouTube(queryOrUrl, isUrl, artist, title, false);
}

// Fetch YouTube official music video
export async function grabYouTubeVideo(
  query: string,
  artist?: string,
  title?: string
): Promise<{ videoId: string; url: string }> {
  try {
    let endpoint = `/api/yt-grab?q=${encodeURIComponent(query)}&type=video`;
    if (artist) endpoint += `&artist=${encodeURIComponent(artist)}`;
    if (title) endpoint += `&title=${encodeURIComponent(title)}`;

    const res = await fetch(endpoint);
    if (res.ok) {
      const data = await res.json();
      if (data && data.videoId) {
        return {
          videoId: data.videoId,
          url: data.url,
        };
      }
    }
  } catch (err) {
    console.warn("Backend /api/yt-grab video not reachable, using static client resolver:", err);
  }

  const res = await clientSideResolveYouTube(query, false, artist, title, true);
  return {
    videoId: res.videoId,
    url: res.url,
  };
}

// Fetch lyrics from LRCLIB with synced timestamps & plain text
export async function fetchLyrics(
  track: string,
  artist: string,
  durationSec?: number
): Promise<LyricsData> {
  try {
    const url = `/api/lyrics?track=${encodeURIComponent(track)}&artist=${encodeURIComponent(artist)}${
      durationSec ? `&duration=${Math.round(durationSec)}` : ''
    }`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.syncedLyrics) {
        const parsed = parseLrc(data.syncedLyrics);
        return {
          syncedLyrics: parsed,
          plainLyrics: data.plainLyrics || "",
          isInstrumental: Boolean(data.instrumental),
          hasSynced: parsed.length > 0,
        };
      }
      if (data.plainLyrics) {
        return {
          syncedLyrics: [],
          plainLyrics: data.plainLyrics,
          isInstrumental: Boolean(data.instrumental),
          hasSynced: false,
        };
      }
    }
  } catch (err) {
    console.error("Failed to fetch lyrics:", err);
  }

  // Fallback: direct LRCLIB search
  try {
    const direct = await fetch(
      `https://lrclib.net/api/search?q=${encodeURIComponent(`${artist} ${track}`)}`
    );
    if (direct.ok) {
      const list = await direct.json();
      if (Array.isArray(list) && list.length > 0) {
        const item = list.find((x) => x.syncedLyrics) || list[0];
        const parsed = parseLrc(item.syncedLyrics || "");
        return {
          syncedLyrics: parsed,
          plainLyrics: item.plainLyrics || "",
          isInstrumental: Boolean(item.instrumental),
          hasSynced: parsed.length > 0,
        };
      }
    }
  } catch (err) {
    console.error("Direct lyrics failed:", err);
  }

  return {
    syncedLyrics: [],
    plainLyrics: "No lyrics available for this track.",
    isInstrumental: false,
    hasSynced: false,
  };
}

export interface AlbumResult {
  id: number | string;
  title: string;
  artist: string;
  artwork: string;
  year?: string;
  genre?: string;
  trackCount?: number;
}

// Search albums from iTunes & Deezer
export async function searchAlbums(term: string, limit: number = 20): Promise<AlbumResult[]> {
  try {
    const directUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=album&limit=${limit}`;
    const res = await fetch(directUrl);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.results) && data.results.length > 0) {
        return data.results.map((item: any) => ({
          id: item.collectionId,
          title: item.collectionName,
          artist: item.artistName,
          artwork: item.artworkUrl100 ? item.artworkUrl100.replace("100x100bb", "600x600bb") : "",
          year: item.releaseDate ? item.releaseDate.substring(0, 4) : "",
          genre: item.primaryGenreName || "Music",
          trackCount: item.trackCount,
        }));
      }
    }
  } catch (err) {
    console.warn("iTunes album search direct failed, trying fallback:", err);
  }

  // Deezer fallback for album search
  try {
    const dzUrl = `https://api.deezer.com/search/album?q=${encodeURIComponent(term)}&limit=${limit}`;
    const dzRes = await fetch(dzUrl);
    if (dzRes.ok) {
      const dzData = await dzRes.json();
      return (dzData.data || []).map((item: any) => ({
        id: `dz-alb-${item.id}`,
        title: item.title,
        artist: item.artist?.name || "Unknown Artist",
        artwork: item.cover_big || item.cover_xl || item.cover_medium || "",
        year: item.release_date ? item.release_date.substring(0, 4) : "",
        genre: "Music",
        trackCount: item.nb_tracks || 0,
      }));
    }
  } catch (dzErr) {
    console.error("Deezer album search fallback failed:", dzErr);
  }

  return [];
}

// Fetch popular tracks based on real charts and guessed user categories (e.g. Hip Hop & Country)
export async function getPopularChartTracks(genres: string[] = [], artists: string[] = [], limit: number = 30): Promise<Track[]> {
  try {
    const params = new URLSearchParams();
    if (genres.length > 0) params.append('genres', genres.join(','));
    if (artists.length > 0) params.append('artists', artists.join(','));
    params.append('limit', String(limit));

    const res = await fetch(`/api/charts/popular?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.tracks) && data.tracks.length > 0) {
        return data.tracks;
      }
    }
  } catch (err) {
    console.error("Failed to fetch popular chart tracks:", err);
  }

  // Fallback for static hosting: search popular tracks in user genres directly via iTunes
  try {
    const searchTerms = genres.length > 0 
      ? genres.slice(0, 3).map(g => `${g} hits`)
      : (artists.length > 0 ? artists.slice(0, 3).map(a => `${a} top songs`) : ['top hits 2024']);

    const songLists = await Promise.all(
      searchTerms.map(t => searchItunes(t, Math.ceil(limit / searchTerms.length)))
    );
    const flattened = songLists.flat();
    if (flattened.length > 0) {
      return flattened.filter((t, i, arr) => t && i === arr.findIndex(x => x.id === t.id)).slice(0, limit);
    }
    return await searchItunes('top hits', limit);
  } catch {
    return [];
  }
}

// Fetch new releases based on what the user listens to and genre charts
export async function getNewReleases(artists: string[] = [], genres: string[] = [], limit: number = 24): Promise<AlbumResult[]> {
  try {
    const params = new URLSearchParams();
    if (artists.length > 0) params.append('artists', artists.join(','));
    if (genres.length > 0) params.append('genres', genres.join(','));
    params.append('limit', String(limit));

    const res = await fetch(`/api/releases/new?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.albums) && data.albums.length > 0) {
        return data.albums;
      }
    }
  } catch (err) {
    console.error("Failed to fetch new releases:", err);
  }

  // Fallback for static hosting: search albums directly via iTunes
  try {
    const query = artists[0] ? `${artists[0]} 2024` : '2024 albums';
    const albums = await searchAlbums(query, limit);
    if (albums.length > 0) return albums;
    return await searchAlbums('hit albums', limit);
  } catch {
    return [];
  }
}

// Helper: Filter out songs that are already in the user's library (saved tracks or playlists)
export function filterOutLibraryTracks(tracks: Track[], libraryTracks: Track[] = []): Track[] {
  if (!libraryTracks || libraryTracks.length === 0) return tracks;

  const libraryKeys = new Set(
    libraryTracks.map(t => `${(t.title || '').toLowerCase().trim()}::${(t.artist || '').toLowerCase().trim()}`)
  );
  const libraryIds = new Set(libraryTracks.map(t => String(t.id)));

  return tracks.filter(t => {
    if (!t) return false;
    if (libraryIds.has(String(t.id))) return false;
    const key = `${(t.title || '').toLowerCase().trim()}::${(t.artist || '').toLowerCase().trim()}`;
    return !libraryKeys.has(key);
  });
}

// Helper: Filter out albums that are already in the user's library
export function filterOutLibraryAlbums(albums: AlbumResult[], libraryTracks: Track[] = []): AlbumResult[] {
  if (!libraryTracks || libraryTracks.length === 0) return albums;

  const libraryAlbumKeys = new Set(
    libraryTracks
      .filter(t => t.album && t.album.toLowerCase() !== 'single')
      .map(t => `${(t.album || '').toLowerCase().trim()}::${(t.artist || '').toLowerCase().trim()}`)
  );

  return albums.filter(a => {
    if (!a) return false;
    const key = `${(a.title || '').toLowerCase().trim()}::${(a.artist || '').toLowerCase().trim()}`;
    return !libraryAlbumKeys.has(key);
  });
}


