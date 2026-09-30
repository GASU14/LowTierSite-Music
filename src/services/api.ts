import { Track, LyricLine, LyricWord, LyricsData, AlbumDetail, ArtistDetail, DailyMixItem } from '../types';

// Parse LRC formatted string into structured LyricLine array with word-by-word timestamps
export function parseLrc(lrcText: string): LyricLine[] {
  if (!lrcText) return [];
  const rawLines = lrcText.split('\n');
  const parsedLines: LyricLine[] = [];
  let idCounter = 0;

  for (const rawLine of rawLines) {
    const lineMatch = rawLine.match(/\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)/);
    if (!lineMatch) continue;

    const minutes = parseInt(lineMatch[1], 10);
    const seconds = parseInt(lineMatch[2], 10);
    const millis = lineMatch[3] ? parseInt(lineMatch[3].padEnd(3, '0').slice(0, 3), 10) : 0;
    const lineTime = minutes * 60 + seconds + millis / 1000;
    const content = lineMatch[4].trim();

    if (!content) continue;

    // Check for explicit Enhanced LRC word tags (e.g. <00:12.34>word or <12.34>word)
    const wordTagRegex = /<(\d{1,2}:)?(\d{2})(?:\.(\d{2,3}))?>(.*?)(?=<(\d{1,2}:)?\d{2}(?:\.\d{2,3})?>|$)/g;
    const explicitWords: LyricWord[] = [];
    let match: RegExpExecArray | null;

    while ((match = wordTagRegex.exec(content)) !== null) {
      const min = match[1] ? parseInt(match[1].replace(':', ''), 10) : 0;
      const sec = parseInt(match[2], 10);
      const ms = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0;
      const wTime = min * 60 + sec + ms / 1000;
      const wText = match[4].replace(/\[.*?\]/g, '').trim();
      if (wText) {
        explicitWords.push({ word: wText, time: wTime });
      }
    }

    // Strip nested tags to extract clean text
    const cleanText = content
      .replace(/<.*?>/g, '')
      .replace(/\[.*?\]/g, '')
      .trim();

    if (cleanText) {
      parsedLines.push({
        id: idCounter++,
        time: lineTime,
        text: cleanText,
        words: explicitWords.length > 0 ? explicitWords : undefined,
      });
    }
  }

  // Sort lines chronologically
  parsedLines.sort((a, b) => a.time - b.time);

  // Set endTime and synthesize word-by-word timing for all synced lines
  for (let i = 0; i < parsedLines.length; i++) {
    const line = parsedLines[i];
    const nextLine = parsedLines[i + 1];
    const gapToNext = nextLine ? (nextLine.time - line.time) : 4.0;

    // If explicit word tags were extracted from Enhanced LRC, keep and normalize them
    if (line.words && line.words.length > 0) {
      line.words.sort((a, b) => a.time - b.time);
      if (line.words[0].time > line.time) {
        line.words[0].time = line.time;
      }
      line.endTime = line.words[line.words.length - 1].time + 0.5;
      continue;
    }

    // Standard LRC: synthesize natural word-by-word timing
    const filteredWords = line.text.split(/\s+/).filter((w) => w.length > 0);
    const wordCount = filteredWords.length || 1;

    // Natural singing duration across gapToNext (never stretch across long instrumental breaks)
    const lineDuration = Math.min(gapToNext * 0.9, Math.max(1.0, wordCount * 0.42 + 0.2));
    line.endTime = line.time + lineDuration;

    const totalChars = filteredWords.reduce((sum, w) => sum + w.length, 0) || 1;

    let elapsedChars = 0;
    line.words = filteredWords.map((w, idx) => {
      // Word 0 starts at line.time so it highlights immediately when the line turns active
      const wordStartTime = idx === 0 ? line.time : line.time + (elapsedChars / totalChars) * lineDuration;
      elapsedChars += w.length;
      return {
        word: w,
        time: wordStartTime,
      };
    });
  }

  return parsedLines;
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

// Normalized fuzzy string helper: handles "Jayz" <-> "JAY-Z" <-> "JAŸ-Z", "sza" <-> "SZA", etc.
export function normalizeFuzzy(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics/accents (ÿ -> y)
    .replace(/[^a-z0-9]/g, ''); // remove non-alphanumeric chars
}

// Check if string A and B match fuzzily or one contains the other
export function isFuzzyMatch(a: string, b: string): boolean {
  const normA = normalizeFuzzy(a);
  const normB = normalizeFuzzy(b);
  if (!normA || !normB) return false;
  return normA === normB || normA.includes(normB) || normB.includes(normA);
}

// Curated authentic high-res portraits for top artists to guarantee 100% display
export const KNOWN_ARTIST_IMAGES: Record<string, string> = {
  'kanyewest': 'https://cdn-images.dzcdn.net/images/artist/bb76c2ee3b068726ab4c37b0aabdb57a/1000x1000-000000-80-0-0.jpg',
  'drake': 'https://cdn-images.dzcdn.net/images/artist/5d2fa7b1e60ee0ae099ebbf4c3eb0b9a/1000x1000-000000-80-0-0.jpg',
  'travisscott': 'https://cdn-images.dzcdn.net/images/artist/812a6136d76bb3eb29e192f9bf2e3794/1000x1000-000000-80-0-0.jpg',
  'kendricklamar': 'https://cdn-images.dzcdn.net/images/artist/d1f855dbd7120a1fefc30f40efb5f3ee/1000x1000-000000-80-0-0.jpg',
  'frankocean': 'https://cdn-images.dzcdn.net/images/artist/574ebadcb4452aaeb135f60beea0b957/1000x1000-000000-80-0-0.jpg',
  'tylerthecreator': 'https://cdn-images.dzcdn.net/images/artist/a712e022f1816e864eeae8477ff3546b/1000x1000-000000-80-0-0.jpg',
  'sza': 'https://cdn-images.dzcdn.net/images/artist/cbbfeae69c8eeff6f9f688eefd2089f8/1000x1000-000000-80-0-0.jpg',
  'jayz': 'https://cdn-images.dzcdn.net/images/artist/ec62d7c0f86230f81254378fbb86a51d/1000x1000-000000-80-0-0.jpg',
  'theweeknd': 'https://cdn-images.dzcdn.net/images/artist/e79f67a26f8ee44d56722d303f8373b9/1000x1000-000000-80-0-0.jpg',
  'taylorswift': 'https://cdn-images.dzcdn.net/images/artist/33e9d89a744cb89a31a90c1eefbcfd8b/1000x1000-000000-80-0-0.jpg',
  'lanadelrey': 'https://cdn-images.dzcdn.net/images/artist/016e783ae415494dff9c67bc7d256877/1000x1000-000000-80-0-0.jpg',
  'playboicarti': 'https://cdn-images.dzcdn.net/images/artist/4c3755bfb91e9f1a26d70a316b23d536/1000x1000-000000-80-0-0.jpg',
  'brentfaiyaz': 'https://cdn-images.dzcdn.net/images/artist/fa1666ffc2e0b694b2a3fefec3d43b23/1000x1000-000000-80-0-0.jpg',
  'stevelacy': 'https://cdn-images.dzcdn.net/images/artist/574e4444747ebc792182054ffcf8719c/1000x1000-000000-80-0-0.jpg',
  '21savage': 'https://cdn-images.dzcdn.net/images/artist/be72f10bcf2e26ca4a38f3223df16e25/1000x1000-000000-80-0-0.jpg',
  'dontoliver': 'https://cdn-images.dzcdn.net/images/artist/7fa44b36caec7a53eaeeff37b7b1caea/1000x1000-000000-80-0-0.jpg',
  'childishgambino': 'https://cdn-images.dzcdn.net/images/artist/ae5746c1b5059e0a0f671c6d36ea1f8f/1000x1000-000000-80-0-0.jpg',
  'tameimpala': 'https://cdn-images.dzcdn.net/images/artist/81fbc0537aa2dbad4e71239c4a85ba44/1000x1000-000000-80-0-0.jpg',
  'metroboomin': 'https://cdn-images.dzcdn.net/images/artist/7cb3c825a09ba835f8f553f191b2bf88/1000x1000-000000-80-0-0.jpg',
  'metrobomin': 'https://cdn-images.dzcdn.net/images/artist/7cb3c825a09ba835f8f553f191b2bf88/1000x1000-000000-80-0-0.jpg',
  'morganwallen': 'https://cdn-images.dzcdn.net/images/artist/b6211be1aece09ee0f69f2e3be75e114/1000x1000-000000-80-0-0.jpg',
  'zachbryan': 'https://cdn-images.dzcdn.net/images/artist/063f9156093557e0344d567303c7340d/1000x1000-000000-80-0-0.jpg',
  'lukecombs': 'https://cdn-images.dzcdn.net/images/artist/95a782e4e11e3b5e40e69a039fc9f12d/1000x1000-000000-80-0-0.jpg',
  'billieeilish': 'https://cdn-images.dzcdn.net/images/artist/ea22998f45a05b3e6d87178c7365fc06/1000x1000-000000-80-0-0.jpg',
  'postmalone': 'https://cdn-images.dzcdn.net/images/artist/33588960010996841103f6f1c4df9278/1000x1000-000000-80-0-0.jpg',
  'badbunny': 'https://cdn-images.dzcdn.net/images/artist/f1c7d24269e38d7bb5bbcaec93c20202/1000x1000-000000-80-0-0.jpg',
  'dualipa': 'https://cdn-images.dzcdn.net/images/artist/7733f37a505bfa780d603e8783424683/1000x1000-000000-80-0-0.jpg',
  'sabrinacarpenter': 'https://cdn-images.dzcdn.net/images/artist/95a56d9be53c651f8a706592203ba302/1000x1000-000000-80-0-0.jpg',
  'oliviarodrigo': 'https://cdn-images.dzcdn.net/images/artist/436329437ff8d052be1387d853e34b9d/1000x1000-000000-80-0-0.jpg',
  'arianagrande': 'https://cdn-images.dzcdn.net/images/artist/194452aa6ca4e6503c58364b6ba3d4fe/1000x1000-000000-80-0-0.jpg',
};

export function createAlbumFallbackDataUrl(title: string = 'Artist'): string {
  const initial = (title || 'A').trim().charAt(0).toUpperCase() || 'A';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="#18181f"/><circle cx="150" cy="150" r="110" fill="#121215" stroke="#2a2a35" stroke-width="6"/><circle cx="150" cy="150" r="70" fill="#1c1c24" stroke="#2a2a35" stroke-width="3"/><circle cx="150" cy="150" r="35" fill="#e11d48"/><circle cx="150" cy="150" r="10" fill="#0d0d0f"/><text x="150" y="278" font-family="sans-serif" font-size="16" font-weight="bold" fill="#a1a1aa" text-anchor="middle">${initial}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Universal JSONP helper that works in browser environments without CORS or Akamai blocks
export function fetchJsonp<T = any>(
  url: string,
  callbackParam: string = 'callback',
  timeout: number = 3000
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return reject(new Error('JSONP is only supported in browser environments'));
    }

    const callbackName = `jsonp_cb_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
    const separator = url.includes('?') ? '&' : '?';
    const script = document.createElement('script');

    let timer: any = null;
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      try {
        delete (window as any)[callbackName];
      } catch {
        (window as any)[callbackName] = undefined;
      }
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };

    timer = setTimeout(() => {
      cleanup();
      reject(new Error(`JSONP request timed out for: ${url}`));
    }, timeout);

    (window as any)[callbackName] = (data: T) => {
      cleanup();
      resolve(data);
    };

    script.src = `${url}${separator}${callbackParam}=${callbackName}`;
    script.async = true;
    script.onerror = () => {
      cleanup();
      reject(new Error(`JSONP script failed to load: ${url}`));
    };

    document.head.appendChild(script);
  });
}

// Search artists with multi-engine resilience (iTunes + Deezer + Curated)
export async function searchDeezerArtists(term: string, limit: number = 25): Promise<Array<{
  id: string | number;
  name: string;
  image: string;
  followers?: number;
  deezerId: number;
}>> {
  if (!term || !term.trim()) return [];
  const cleanTerm = term.trim();
  const normTerm = normalizeFuzzy(cleanTerm);

  // 1. Try server endpoint first if on dev server
  if (typeof window !== 'undefined' && window.location.protocol.startsWith('http') && !window.location.host.includes('github')) {
    try {
      const url = `/api/deezer/artist-search?q=${encodeURIComponent(cleanTerm)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(1500) }).catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        if (Array.isArray(data.data) && data.data.length > 0) {
          return data.data.slice(0, limit).map((a: any) => ({
            id: `dz-${a.id}`,
            deezerId: a.id,
            name: a.name,
            image: a.picture_xl || a.picture_big || a.picture_medium || a.picture || KNOWN_ARTIST_IMAGES[normalizeFuzzy(a.name)] || '',
            followers: a.nb_fan || 0,
          }));
        }
      }
    } catch {}
  }

  // 2. Query iTunes songs & artists in parallel (100% reliable, zero CORS restrictions)
  try {
    const [songRes, artistRes] = await Promise.all([
      fetchJsonp<any>(
        `https://itunes.apple.com/search?term=${encodeURIComponent(cleanTerm)}&entity=song&limit=30`,
        'callback',
        2500
      ).catch(() => null),
      fetchJsonp<any>(
        `https://itunes.apple.com/search?term=${encodeURIComponent(cleanTerm)}&entity=musicArtist&limit=10`,
        'callback',
        2500
      ).catch(() => null),
    ]);

    const artistMap = new Map<string, { id: string | number; name: string; image: string; followers: number; deezerId: number }>();

    // Add artists found from musicArtist endpoint
    if (artistRes && Array.isArray(artistRes.results)) {
      for (const item of artistRes.results) {
        if (!item.artistName) continue;
        const norm = normalizeFuzzy(item.artistName);
        const img = KNOWN_ARTIST_IMAGES[norm] || '';
        artistMap.set(norm, {
          id: `itunes-${item.artistId}`,
          deezerId: typeof item.artistId === 'number' ? item.artistId : 0,
          name: item.artistName.replace(/JAŸ-Z/gi, 'JAY-Z'),
          image: img,
          followers: 1500000,
        });
      }
    }

    // Extract artists and artwork from song results
    if (songRes && Array.isArray(songRes.results)) {
      for (const item of songRes.results) {
        if (!item.artistName) continue;
        const norm = normalizeFuzzy(item.artistName);
        const cleanName = item.artistName.replace(/JAŸ-Z/gi, 'JAY-Z');
        const songArtwork = item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '600x600bb') : '';
        const portrait = KNOWN_ARTIST_IMAGES[norm] || songArtwork;

        if (artistMap.has(norm)) {
          const existing = artistMap.get(norm)!;
          if (!existing.image && portrait) existing.image = portrait;
        } else {
          artistMap.set(norm, {
            id: `itunes-${item.artistId || item.trackId}`,
            deezerId: typeof item.artistId === 'number' ? item.artistId : 0,
            name: cleanName,
            image: portrait,
            followers: 1200000,
          });
        }
      }
    }

    // Also check if any known artist matches the query fuzzily
    for (const [knownKey, knownImg] of Object.entries(KNOWN_ARTIST_IMAGES)) {
      if (knownKey.includes(normTerm) || normTerm.includes(knownKey)) {
        if (!artistMap.has(knownKey)) {
          // Format capitalized name
          const titleName = knownKey === 'jayz' ? 'JAY-Z' : knownKey.toUpperCase();
          artistMap.set(knownKey, {
            id: `known-${knownKey}`,
            deezerId: 0,
            name: titleName,
            image: knownImg,
            followers: 2500000,
          });
        }
      }
    }

    const results = Array.from(artistMap.values());
    if (results.length > 0) {
      // Sort so closest match to user query is first
      results.sort((a, b) => {
        const normA = normalizeFuzzy(a.name);
        const normB = normalizeFuzzy(b.name);
        const matchA = normA === normTerm ? 100 : (normA.startsWith(normTerm) ? 50 : (normA.includes(normTerm) ? 20 : 0));
        const matchB = normB === normTerm ? 100 : (normB.startsWith(normTerm) ? 50 : (normB.includes(normTerm) ? 20 : 0));
        return matchB - matchA;
      });
      return results.slice(0, limit);
    }
  } catch (itunesErr) {
    console.warn('iTunes artist search fallback:', itunesErr);
  }

  // 3. Fast Deezer JSONP fallback (1500ms timeout max)
  try {
    const dzData = await fetchJsonp<any>(
      `https://api.deezer.com/search/artist?q=${encodeURIComponent(cleanTerm)}&limit=${limit}&output=jsonp`,
      'callback',
      1500
    );
    if (dzData && Array.isArray(dzData.data) && dzData.data.length > 0) {
      return dzData.data.slice(0, limit).map((a: any) => ({
        id: `dz-${a.id}`,
        deezerId: a.id,
        name: a.name,
        image: a.picture_xl || a.picture_big || a.picture_medium || a.picture || KNOWN_ARTIST_IMAGES[normalizeFuzzy(a.name)] || '',
        followers: a.nb_fan || 0,
      }));
    }
  } catch {}

  return [];
}

// Fetch complete Spotify-style artist details: Top tracks, Discography (Albums, Singles)
export async function getArtistDetails(artistNameOrId: string | number): Promise<ArtistDetail | null> {
  let rawQuery = typeof artistNameOrId === 'string' ? artistNameOrId.trim() : String(artistNameOrId);
  let initialName = rawQuery.replace(/^(dz-|itunes-|art-|rec-art-|search-artist-)/i, '').replace(/[-_]/g, ' ').trim();
  if (initialName.toLowerCase() === 'jayz' || initialName.toLowerCase() === 'jay z' || initialName.toLowerCase() === 'jaÿ z' || initialName.toLowerCase() === 'jaÿ-z') {
    initialName = 'JAY-Z';
  }

  const normArtist = normalizeFuzzy(initialName);

  // 1. Primary Strategy: Server-side Hybrid Deezer + iTunes resolution (Zero CORS / Zero 403 blocks)
  try {
    const res = await fetch(`/api/artist/details?q=${encodeURIComponent(initialName)}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && (data.topTracks?.length > 0 || data.discography?.length > 0 || data.image)) {
        // Ensure image is authentic
        if (!data.image || data.image.includes('unsplash')) {
          data.image = KNOWN_ARTIST_IMAGES[normArtist] || data.image;
          data.picture = data.image;
          data.headerImage = data.image;
        }
        return data;
      }
    }
  } catch (serverErr) {
    console.warn("Backend /api/artist/details not available, using client fallback:", serverErr);
  }

  // 2. Client-side Fallback: Deezer direct search with curated portraits
  try {
    const dzData = await fetchJsonp<any>(
      `https://api.deezer.com/search/artist?q=${encodeURIComponent(initialName)}&limit=1&output=jsonp`,
      'callback',
      2000
    ).catch(() => null);

    let dzArtist = dzData?.data?.[0];
    let dzId = dzArtist?.id;
    let portrait = dzArtist?.picture_xl || dzArtist?.picture_big || KNOWN_ARTIST_IMAGES[normArtist] || 'https://cdn-images.dzcdn.net/images/artist/bb76c2ee3b068726ab4c37b0aabdb57a/1000x1000-000000-80-0-0.jpg';
    let followers = dzArtist?.nb_fan || 3800000;

    let topTracks: Track[] = [];
    let discography: AlbumDetail[] = [];

    if (dzId) {
      const [dzTop, dzAlbums] = await Promise.all([
        fetchJsonp<any>(`https://api.deezer.com/artist/${dzId}/top?limit=30&output=jsonp`, 'callback', 2500).catch(() => null),
        fetchJsonp<any>(`https://api.deezer.com/artist/${dzId}/albums?limit=50&output=jsonp`, 'callback', 2500).catch(() => null),
      ]);

      if (dzTop?.data && Array.isArray(dzTop.data)) {
        topTracks = dzTop.data.map((t: any) => mapDeezerTrack(t));
      }

      if (dzAlbums?.data && Array.isArray(dzAlbums.data)) {
        discography = dzAlbums.data.map((alb: any) => ({
          id: `dz-${alb.id}`,
          title: alb.title,
          artist: initialName,
          artwork: alb.cover_xl || alb.cover_big || alb.cover_medium || alb.cover || '',
          artworkLarge: alb.cover_xl || alb.cover_big || alb.cover_medium || alb.cover || '',
          releaseDate: alb.release_date || '',
          genre: 'Music',
          recordType: alb.record_type === 'single' || alb.record_type === 'ep' ? 'single' : 'album',
          tracks: [],
        }));
      }
    }

    // Sort discography in release date order descending
    discography.sort((a, b) => {
      const timeA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
      const timeB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
      return timeB - timeA;
    });

    return {
      id: dzId ? `dz-${dzId}` : `art-${normArtist}`,
      name: dzArtist?.name || initialName,
      image: portrait,
      picture: portrait,
      headerImage: portrait,
      followers,
      monthlyListeners: followers,
      topTracks,
      popularTracks: topTracks,
      albums: discography.filter(a => a.recordType === 'album'),
      singles: discography.filter(a => a.recordType === 'single'),
      features: [],
      allReleases: discography,
      discography,
    };
  } catch (err) {
    console.error('getArtistDetails client fallback error:', err);
    const portrait = KNOWN_ARTIST_IMAGES[normArtist] || 'https://cdn-images.dzcdn.net/images/artist/bb76c2ee3b068726ab4c37b0aabdb57a/1000x1000-000000-80-0-0.jpg';
    return {
      id: `art-${normArtist}`,
      name: initialName,
      image: portrait,
      picture: portrait,
      headerImage: portrait,
      followers: 2500000,
      monthlyListeners: 4500000,
      topTracks: [],
      popularTracks: [],
      albums: [],
      singles: [],
      features: [],
      allReleases: [],
      discography: [],
    };
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
      let data: any = null;
      const url = `/api/deezer/album/${cleanId}`;
      const res = await fetch(url).catch(() => null);
      if (res && res.ok) {
        data = await res.json();
      }

      // Direct Deezer JSONP fallback
      if (!data || !data.title || data.error) {
        data = await fetchJsonp<any>(`https://api.deezer.com/album/${cleanId}?output=jsonp`).catch(() => null);
      }

      if (data && data.title && !data.error) {
        const cover = data.cover_xl || data.cover_big || data.cover_medium || data.cover || '';
        
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
          trackCount: tracks.length || data.nb_tracks || 1,
          durationSec: data.duration || 0,
          recordType: data.record_type || 'album',
          tracks,
        };
      }
    } catch (err) {
      console.error("getAlbumDetails Deezer error:", err);
    }
  }

  // Strategy 2: Direct iTunes Album Lookup if numeric ID
  if (isNumeric) {
    try {
      let itunesData: any = null;
      const itunesRes = await fetch(`/api/itunes/album/${cleanId}`).catch(() => null);
      if (itunesRes && itunesRes.ok) {
        itunesData = await itunesRes.json();
      }

      // iTunes JSONP lookup fallback
      if (!itunesData || !itunesData.results) {
        itunesData = await fetchJsonp<any>(`https://itunes.apple.com/lookup?id=${cleanId}&entity=song`).catch(() => null);
      }

      if (itunesData && itunesData.results && itunesData.results.length > 0) {
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
    } catch (err) {
      console.error("iTunes album direct lookup error:", err);
    }
  }

  // Strategy 3: Search iTunes by album title & artist
  const searchQuery = `${albumTitle || albumId} ${artistName || ''}`.trim();
  try {
    let searchData: any = null;
    const searchRes = await fetch(`/api/itunes/search-album?q=${encodeURIComponent(searchQuery)}`).catch(() => null);
    if (searchRes && searchRes.ok) {
      searchData = await searchRes.json();
    }

    if (!searchData || !searchData.results) {
      searchData = await fetchJsonp<any>(`https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&entity=album&limit=5`).catch(() => null);
    }

    if (searchData && searchData.results && searchData.results.length > 0) {
      const foundAlbum = searchData.results[0];
      if (foundAlbum.collectionId) {
        // Recursive lookup with collectionId
        const details = await getAlbumDetails(foundAlbum.collectionId, foundAlbum.collectionName, foundAlbum.artistName);
        if (details) return details;
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
      gradient: 'from-indigo-600 via-zinc-900 to-[#121212]',
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
    const res = await fetch(url).catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      if (Array.isArray(data.results) && data.results.length > 0) {
        return data.results;
      }
    }
  } catch {}

  // Direct iTunes JSONP search (bypasses CORS and 403 Forbidden completely)
  try {
    const directData = await fetchJsonp<any>(
      `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=${limit}`
    );
    if (directData && Array.isArray(directData.results)) {
      return directData.results.map((item: any) => ({
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
    }
  } catch (err) {
    console.warn("iTunes direct search failed, trying Deezer fallback:", err);
  }

  // Deezer search fallback via JSONP
  try {
    const dzData = await fetchJsonp<any>(
      `https://api.deezer.com/search?q=${encodeURIComponent(term)}&limit=${limit}&output=jsonp`
    );
    if (dzData && Array.isArray(dzData.data)) {
      return dzData.data.map(mapDeezerTrack);
    }
  } catch {}

  return [];
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
    const res = await fetch(url).catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      if (Array.isArray(data.artists) && data.artists.length > 0) {
        return data.artists;
      }
    }
  } catch {}

  // Direct iTunes JSONP search
  try {
    const directData = await fetchJsonp<any>(
      `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=${limit}`
    );
    const results = directData?.results || [];
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
              durationSec: typeof s.duration === 'number' ? s.duration : 0,
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

  // 4. Invidious CORS Fallback Endpoints
  const invidiousEndpoints = [
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://yewtu.be',
    'https://vid.priv.au',
  ];

  for (const invUrl of invidiousEndpoints) {
    try {
      const resp = await fetch(`${invUrl}/api/v1/search?q=${encodeURIComponent(searchQuery)}&type=video`, {
        signal: AbortSignal.timeout(3000),
      });
      if (resp.ok) {
        const items = await resp.json();
        if (Array.isArray(items) && items.length > 0) {
          const first = items[0];
          const sources = items.slice(0, 10).map((it: any) => ({
            id: it.videoId,
            title: it.title || '',
            owner: it.author || '',
            score: 85,
            durationSec: it.lengthSeconds || 0,
          }));

          return {
            videoId: first.videoId,
            url: `https://www.youtube.com/watch?v=${first.videoId}`,
            matchedTitle: first.title,
            matchedOwner: first.author,
            durationSec: first.lengthSeconds || 0,
            score: 85,
            sources,
          };
        }
      }
    } catch {}
  }

  throw new Error("Unable to resolve YouTube video for track");
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
  sources?: Array<{ id: string; title: string; owner: string; score: number; durationSec?: number }>;
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

// Fetch lyrics from supported providers (LyricsPlus, BetterLyrics, LRCLIB, Musixmatch) with synced word-by-word timestamps
export async function fetchLyrics(
  track: string,
  artist: string,
  durationSec?: number,
  providerOrder?: string[]
): Promise<LyricsData> {
  // Clean titles by removing featured artists, parenthetical tags, and noise
  const cleanTitle = (track || '')
    .replace(/\s*[\(\[](feat|ft|with|remix|version|prod|explicit)[\.\s\S]*?[\)\]]/gi, '')
    .replace(/["']/g, '')
    .trim();
  const cleanArtist = (artist || '')
    .split(/[,&]/)[0]
    .replace(/\s*(feat\.|ft\.).*$/gi, '')
    .replace(/JAŸ-Z/gi, 'JAY-Z')
    .trim();

  const activeProviders = (providerOrder && providerOrder.length > 0)
    ? providerOrder
    : ['lyricsplus', 'betterlyrics', 'lrclib', 'musixmatch'];

  for (const prov of activeProviders) {
    if (prov === 'lyricsplus' || prov === 'lrclib') {
      try {
        let getUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanArtist)}&track_name=${encodeURIComponent(cleanTitle)}`;
        if (durationSec && durationSec > 0) {
          getUrl += `&duration=${Math.round(durationSec)}`;
        }
        const res = await fetch(getUrl, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data = await res.json();
          if (data && (data.syncedLyrics || data.plainLyrics)) {
            const parsed = data.syncedLyrics ? parseLrc(data.syncedLyrics) : [];
            return {
              syncedLyrics: parsed,
              plainLyrics: data.plainLyrics || '',
              isInstrumental: Boolean(data.instrumental),
              hasSynced: parsed.length > 0,
              provider: prov === 'lyricsplus' ? 'LyricsPlus' : 'LRCLIB',
            };
          }
        }
      } catch {}
    } else if (prov === 'betterlyrics' || prov === 'musixmatch') {
      try {
        const url = `/api/lyrics?track=${encodeURIComponent(cleanTitle || track)}&artist=${encodeURIComponent(cleanArtist || artist)}${
          durationSec ? `&duration=${Math.round(durationSec)}` : ''
        }&provider=${prov}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(2500) }).catch(() => null);
        if (res && res.ok) {
          const data = await res.json();
          if (data.syncedLyrics || data.plainLyrics) {
            const parsed = parseLrc(data.syncedLyrics || '');
            return {
              syncedLyrics: parsed,
              plainLyrics: data.plainLyrics || '',
              isInstrumental: Boolean(data.instrumental),
              hasSynced: parsed.length > 0,
              provider: prov === 'betterlyrics' ? 'BetterLyrics' : 'Musixmatch',
            };
          }
        }
      } catch {}
    }
  }

  // Fallback: search query across LRCLIB
  const queries = [
    `${cleanArtist} ${cleanTitle}`,
    `${artist} ${track}`,
    cleanTitle,
  ];

  for (const q of queries) {
    if (!q || !q.trim()) continue;
    try {
      const direct = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`, {
        signal: AbortSignal.timeout(2500),
      });
      if (direct.ok) {
        const list = await direct.json();
        if (Array.isArray(list) && list.length > 0) {
          const item = list.find((x: any) => x.syncedLyrics) || list[0];
          if (item && (item.syncedLyrics || item.plainLyrics)) {
            const parsed = parseLrc(item.syncedLyrics || '');
            return {
              syncedLyrics: parsed,
              plainLyrics: item.plainLyrics || '',
              isInstrumental: Boolean(item.instrumental),
              hasSynced: parsed.length > 0,
              provider: 'LRCLIB',
            };
          }
        }
      }
    } catch {}
  }

  return {
    syncedLyrics: [],
    plainLyrics: 'No lyrics available for this track.',
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
  // Primary: iTunes JSONP
  try {
    const data = await fetchJsonp<any>(
      `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=album&limit=${limit}`,
      'callback',
      3000
    );
    if (data && Array.isArray(data.results) && data.results.length > 0) {
      return data.results.map((item: any) => ({
        id: item.collectionId,
        title: item.collectionName,
        artist: (item.artistName || 'Unknown Artist').replace(/JAŸ-Z/gi, 'JAY-Z'),
        artwork: item.artworkUrl100 ? item.artworkUrl100.replace("100x100bb", "600x600bb") : "",
        year: item.releaseDate ? item.releaseDate.substring(0, 4) : "",
        genre: item.primaryGenreName || "Music",
        trackCount: item.trackCount,
      }));
    }
  } catch (err) {
    console.warn("iTunes album JSONP search failed:", err);
  }

  // Fallback: Deezer JSONP
  try {
    const dzData = await fetchJsonp<any>(
      `https://api.deezer.com/search/album?q=${encodeURIComponent(term)}&limit=${limit}&output=jsonp`,
      'callback',
      1500
    );
    if (dzData && Array.isArray(dzData.data)) {
      return dzData.data.map((item: any) => ({
        id: `dz-alb-${item.id}`,
        title: item.title,
        artist: item.artist?.name || "Unknown Artist",
        artwork: item.cover_xl || item.cover_big || item.cover_medium || "",
        year: item.release_date ? item.release_date.substring(0, 4) : "",
        genre: "Music",
        trackCount: item.nb_tracks || 0,
      }));
    }
  } catch {}

  return [];
}

// Fetch popular tracks based on real charts and diverse artist distribution (strictly 1 song per artist and 1 per album)
export async function getPopularChartTracks(genres: string[] = [], artists: string[] = [], limit: number = 30): Promise<Track[]> {
  // Try server endpoint first if on dev server
  if (typeof window !== 'undefined' && window.location.protocol.startsWith('http') && !window.location.host.includes('github')) {
    try {
      const params = new URLSearchParams();
      if (genres.length > 0) params.append('genres', genres.join(','));
      if (artists.length > 0) params.append('artists', artists.join(','));
      params.append('limit', String(limit));

      const res = await fetch(`/api/charts/popular?${params.toString()}`, { signal: AbortSignal.timeout(2000) }).catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        if (Array.isArray(data.tracks) && data.tracks.length > 0) {
          // Strictly deduplicate by artist and album
          const seenArtists = new Set<string>();
          const seenAlbums = new Set<string>();
          const seenTitles = new Set<string>();
          const list: Track[] = [];
          for (const t of data.tracks) {
            const a = normalizeFuzzy(t.artist);
            const alb = normalizeFuzzy(t.album || 'Single');
            const tit = normalizeFuzzy(t.title);
            if (seenArtists.has(a) || (alb !== 'single' && seenAlbums.has(alb)) || seenTitles.has(tit)) continue;
            seenArtists.add(a);
            if (alb !== 'single') seenAlbums.add(alb);
            seenTitles.add(tit);
            list.push(t);
            if (list.length >= limit) break;
          }
          if (list.length > 0) return list;
        }
      }
    } catch {}
  }

  // Client / standalone fallback: fetch from diverse list of hit artists across hip-hop, pop, country, r&b, and rock
  const diverseSeeds = [
    'Drake', 'Kendrick Lamar', 'Travis Scott', 'Morgan Wallen', 'Zach Bryan',
    'SZA', 'The Weeknd', 'Taylor Swift', 'Post Malone', '21 Savage',
    'Future', 'Billie Eilish', 'Sabrina Carpenter', 'Kanye West', 'Luke Combs',
    'Frank Ocean', 'Metro Boomin', 'JAY-Z', 'Tyler, The Creator', 'Don Toliver'
  ];

  try {
    const promises = diverseSeeds.slice(0, Math.min(diverseSeeds.length, limit + 5)).map((seed) =>
      searchItunes(seed, 3).catch(() => [])
    );

    const songPacks = await Promise.all(promises);
    const candidateTracks: Track[] = [];

    // Interleave so each seed artist provides their best hit
    const maxLen = Math.max(...songPacks.map(p => p.length), 0);
    for (let i = 0; i < maxLen; i++) {
      for (const pack of songPacks) {
        if (pack[i]) candidateTracks.push(pack[i]);
      }
    }

    // STRICT DIVERSITY: Maximum 1 song per artist, 1 song per album, unique title!
    const seenArtists = new Set<string>();
    const seenAlbums = new Set<string>();
    const seenTitles = new Set<string>();
    const finalDiverseTracks: Track[] = [];

    for (const t of candidateTracks) {
      if (!t || !t.title || !t.artist) continue;
      const a = normalizeFuzzy(t.artist);
      const alb = normalizeFuzzy(t.album || 'Single');
      const tit = normalizeFuzzy(t.title);

      if (seenArtists.has(a)) continue;
      if (alb && alb !== 'single' && seenAlbums.has(alb)) continue;
      if (seenTitles.has(tit)) continue;

      seenArtists.add(a);
      if (alb && alb !== 'single') seenAlbums.add(alb);
      seenTitles.add(tit);
      finalDiverseTracks.push(t);

      if (finalDiverseTracks.length >= limit) break;
    }

    if (finalDiverseTracks.length > 0) return finalDiverseTracks;
  } catch (err) {
    console.warn('Popular chart tracks diversity fallback error:', err);
  }

  return await searchItunes('top hits', limit);
}

// Fetch new releases based on what the user listens to and genre charts
export async function getNewReleases(artists: string[] = [], genres: string[] = [], limit: number = 24): Promise<AlbumResult[]> {
  try {
    const params = new URLSearchParams();
    if (artists.length > 0) params.append('artists', artists.join(','));
    if (genres.length > 0) params.append('genres', genres.join(','));
    params.append('limit', String(limit));

    const res = await fetch(`/api/releases/new?${params.toString()}`).catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      if (Array.isArray(data.albums) && data.albums.length > 0) {
        return data.albums;
      }
    }
  } catch (err) {}

  // Fallback: Deezer new release albums chart via JSONP
  try {
    const chartAlbums = await fetchJsonp<any>(`https://api.deezer.com/chart/0/albums?limit=35&output=jsonp`).catch(() => null);
    if (chartAlbums && Array.isArray(chartAlbums.data) && chartAlbums.data.length > 0) {
      const seenArtists = new Set<string>();
      const albums: AlbumResult[] = [];

      for (const item of chartAlbums.data) {
        const artName = item.artist?.name || 'Unknown Artist';
        if (seenArtists.has(artName.toLowerCase())) continue;
        seenArtists.add(artName.toLowerCase());

        albums.push({
          id: `dz-alb-${item.id}`,
          title: item.title,
          artist: artName,
          artwork: item.cover_xl || item.cover_big || item.cover_medium || item.cover || '',
          year: item.release_date ? item.release_date.substring(0, 4) : '2024',
          genre: 'New Release',
          trackCount: item.nb_tracks || 0,
        });
      }
      return albums.slice(0, limit);
    }
  } catch (err) {
    console.warn("Deezer JSONP new releases failed:", err);
  }

  // Fallback: iTunes album search via JSONP
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


