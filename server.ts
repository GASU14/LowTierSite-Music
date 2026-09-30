import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Global CORS enabling for Google Sites and external embeds
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // API 1: Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // API 2: Deezer Artist Search & Details (For high-quality artist photos & metadata)
  app.get("/api/deezer/artist-search", async (req, res) => {
    try {
      const q = (req.query.q as string || "").trim();
      if (!q) return res.json({ data: [] });

      const resp = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(q)}&limit=25`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
      });
      if (!resp.ok) throw new Error(`Deezer returned ${resp.status}`);
      const data = await resp.json();
      return res.json(data);
    } catch (err: any) {
      console.error("Deezer artist search error:", err);
      return res.status(500).json({ error: err.message, data: [] });
    }
  });

  // API 3: Deezer Artist Profile, Top Tracks & Discography
  app.get("/api/deezer/artist/:id", async (req, res) => {
    try {
      const artistId = req.params.id;
      const [artistResp, topResp, albumsResp] = await Promise.all([
        fetch(`https://api.deezer.com/artist/${artistId}`, {
          headers: { "User-Agent": "Mozilla/5.0" }
        }),
        fetch(`https://api.deezer.com/artist/${artistId}/top?limit=30`, {
          headers: { "User-Agent": "Mozilla/5.0" }
        }),
        fetch(`https://api.deezer.com/artist/${artistId}/albums?limit=50`, {
          headers: { "User-Agent": "Mozilla/5.0" }
        })
      ]);

      const artist = artistResp.ok ? await artistResp.json() : null;
      const topTracks = topResp.ok ? await topResp.json() : { data: [] };
      const albums = albumsResp.ok ? await albumsResp.json() : { data: [] };

      return res.json({
        artist,
        topTracks: topTracks.data || [],
        albums: albums.data || []
      });
    } catch (err: any) {
      console.error("Deezer artist details error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // API 3b: Comprehensive Artist Details Endpoint (Deezer + iTunes hybrid with caching)
  const artistDetailsCache = new Map<string, { data: any; timestamp: number }>();

  app.get("/api/artist/details", async (req, res) => {
    try {
      const q = (req.query.q as string || "").trim();
      if (!q) return res.status(400).json({ error: "Query 'q' is required" });

      const cacheKey = q.toLowerCase();
      const cached = artistDetailsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 3600000) {
        return res.json(cached.data);
      }

      // Step 1: Find Deezer Artist ID
      let deezerId: number | null = /^\d+$/.test(q) ? Number(q) : null;
      let artistName = q;

      if (!deezerId) {
        const searchResp = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(q)}&limit=5`, {
          headers: { "User-Agent": "Mozilla/5.0" }
        }).catch(() => null);

        if (searchResp && searchResp.ok) {
          const searchData = await searchResp.json();
          if (Array.isArray(searchData.data) && searchData.data.length > 0) {
            const match = searchData.data.find((a: any) => a.name.toLowerCase() === q.toLowerCase()) || searchData.data[0];
            deezerId = match.id;
            artistName = match.name;
          }
        }
      }

      let artistInfo: any = null;
      let topTracks: any[] = [];
      let albums: any[] = [];

      if (deezerId) {
        const [artistResp, topResp, albumsResp] = await Promise.all([
          fetch(`https://api.deezer.com/artist/${deezerId}`, { headers: { "User-Agent": "Mozilla/5.0" } }).catch(() => null),
          fetch(`https://api.deezer.com/artist/${deezerId}/top?limit=40`, { headers: { "User-Agent": "Mozilla/5.0" } }).catch(() => null),
          fetch(`https://api.deezer.com/artist/${deezerId}/albums?limit=100`, { headers: { "User-Agent": "Mozilla/5.0" } }).catch(() => null),
        ]);

        if (artistResp && artistResp.ok) artistInfo = await artistResp.json();
        if (topResp && topResp.ok) {
          const tData = await topResp.json();
          topTracks = Array.isArray(tData.data) ? tData.data : [];
        }
        if (albumsResp && albumsResp.ok) {
          const aData = await albumsResp.json();
          albums = Array.isArray(aData.data) ? aData.data : [];
        }
      }

      // Also query iTunes on backend as supplemental data
      let itunesAlbums: any[] = [];
      let itunesSongs: any[] = [];
      try {
        const [itAlbResp, itSongResp] = await Promise.all([
          fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(artistName)}&entity=album&limit=40`, { headers: ITUNES_HEADERS }).catch(() => null),
          fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(artistName)}&entity=song&limit=40`, { headers: ITUNES_HEADERS }).catch(() => null),
        ]);
        if (itAlbResp && itAlbResp.ok) {
          const itAlbData = await itAlbResp.json();
          if (Array.isArray(itAlbData.results)) itunesAlbums = itAlbData.results;
        }
        if (itSongResp && itSongResp.ok) {
          const itSongData = await itSongResp.json();
          if (Array.isArray(itSongData.results)) itunesSongs = itSongData.results;
        }
      } catch {}

      // Format authentic portrait
      const picture = artistInfo?.picture_xl || artistInfo?.picture_big || artistInfo?.picture_medium || artistInfo?.picture || "";
      const fans = artistInfo?.nb_fan || 3500000;

      // Format Top Tracks
      const mappedTopTracks: any[] = [];
      const seenTrackTitles = new Set<string>();

      for (const t of topTracks) {
        if (!t.title) continue;
        const normT = t.title.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (seenTrackTitles.has(normT)) continue;
        seenTrackTitles.add(normT);

        const artwork = t.album?.cover_xl || t.album?.cover_big || t.album?.cover_medium || t.album?.cover || "";
        mappedTopTracks.push({
          id: `dz-${t.id}`,
          title: t.title || t.title_short || 'Untitled',
          artist: t.artist?.name || artistName,
          album: t.album?.title || 'Single',
          artworkSmall: t.album?.cover_medium || artwork,
          artworkLarge: t.album?.cover_big || artwork,
          artworkOriginal: artwork,
          durationMs: (t.duration || 180) * 1000,
          previewUrl: t.preview || '',
          rank: t.rank || 0,
          albumId: t.album?.id,
          artistId: t.artist?.id || deezerId,
        });
      }

      // If Deezer top tracks was small, supplement from iTunes songs
      for (const s of itunesSongs) {
        if (!s.trackName) continue;
        const normT = s.trackName.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (seenTrackTitles.has(normT)) continue;
        seenTrackTitles.add(normT);

        const artwork = s.artworkUrl100 ? s.artworkUrl100.replace('100x100bb', '600x600bb') : '';
        mappedTopTracks.push({
          id: `itunes-${s.trackId}`,
          title: s.trackName,
          artist: s.artistName || artistName,
          album: s.collectionName || 'Single',
          artworkSmall: s.artworkUrl60 || s.artworkUrl100 || artwork,
          artworkLarge: artwork,
          artworkOriginal: s.artworkUrl100 ? s.artworkUrl100.replace('100x100bb', '1200x1200bb') : artwork,
          durationMs: s.trackTimeMillis || 180000,
          previewUrl: s.previewUrl || '',
          albumId: s.collectionId,
          artistId: s.artistId,
        });
      }

      // Format Discography (Albums, Singles - exclude features)
      const mappedAlbums: any[] = [];
      const seenAlbumTitles = new Set<string>();

      // Add Deezer albums
      for (const alb of albums) {
        if (!alb.title) continue;
        const normA = alb.title.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (seenAlbumTitles.has(normA)) continue;
        seenAlbumTitles.add(normA);

        const cover = alb.cover_xl || alb.cover_big || alb.cover_medium || alb.cover || "";
        const isSingle = alb.record_type === 'single' || alb.record_type === 'ep';

        mappedAlbums.push({
          id: `dz-${alb.id}`,
          title: alb.title,
          artist: artistName,
          artwork: cover,
          artworkLarge: cover,
          releaseDate: alb.release_date || '',
          genre: 'Music',
          recordType: isSingle ? 'single' : 'album',
          tracks: [],
        });
      }

      // Supplement from iTunes albums
      for (const alb of itunesAlbums) {
        if (!alb.collectionName) continue;
        const normA = alb.collectionName.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (seenAlbumTitles.has(normA)) continue;
        seenAlbumTitles.add(normA);

        const cover = alb.artworkUrl100 ? alb.artworkUrl100.replace('100x100bb', '600x600bb') : '';
        const trackCount = alb.trackCount || 1;
        const isSingle = trackCount <= 3 || alb.collectionName.toLowerCase().includes('single') || alb.collectionName.toLowerCase().includes(' - ep');

        mappedAlbums.push({
          id: `itunes-${alb.collectionId}`,
          title: alb.collectionName,
          artist: alb.artistName || artistName,
          artwork: cover,
          artworkLarge: cover,
          releaseDate: alb.releaseDate || '',
          genre: alb.primaryGenreName || 'Music',
          trackCount,
          recordType: isSingle ? 'single' : 'album',
          tracks: [],
        });
      }

      // Sort discography in release date order descending (latest top, oldest bottom)
      mappedAlbums.sort((a, b) => {
        const timeA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
        const timeB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
        return timeB - timeA;
      });

      const result = {
        id: deezerId ? `dz-${deezerId}` : `art-${q.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        name: artistInfo?.name || artistName,
        image: picture,
        picture: picture,
        headerImage: picture,
        followers: fans,
        monthlyListeners: fans,
        topTracks: mappedTopTracks,
        popularTracks: mappedTopTracks,
        albums: mappedAlbums.filter(a => a.recordType === 'album'),
        singles: mappedAlbums.filter(a => a.recordType === 'single'),
        features: [],
        allReleases: mappedAlbums,
        discography: mappedAlbums,
      };

      artistDetailsCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return res.json(result);
    } catch (err: any) {
      console.error("Artist details endpoint error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // API 4: Deezer Album Details & Tracks
  app.get("/api/deezer/album/:id", async (req, res) => {
    try {
      const albumId = req.params.id;
      const resp = await fetch(`https://api.deezer.com/album/${albumId}`, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      if (!resp.ok) throw new Error(`Deezer album error ${resp.status}`);
      const album = await resp.json();
      return res.json(album);
    } catch (err: any) {
      console.error("Deezer album error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // API 5: Deezer General Search (Tracks, Albums, Artists)
  app.get("/api/deezer/search", async (req, res) => {
    try {
      const q = (req.query.q as string || "").trim();
      const limit = req.query.limit || 30;
      if (!q) return res.json({ data: [] });

      const resp = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=${limit}`, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      if (!resp.ok) throw new Error(`Deezer search error ${resp.status}`);
      const data = await resp.json();
      return res.json(data);
    } catch (err: any) {
      console.error("Deezer search error:", err);
      return res.status(500).json({ error: err.message, data: [] });
    }
  });

  // ITunes User-Agent header to prevent 403 Forbidden errors from Akamai/Apple CDN
  const ITUNES_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
  };

  // API 5b: iTunes Album Lookup by Collection ID
  app.get("/api/itunes/album/:id", async (req, res) => {
    try {
      const albumId = req.params.id;
      const resp = await fetch(`https://itunes.apple.com/lookup?id=${albumId}&entity=song`, {
        headers: ITUNES_HEADERS,
      });
      if (!resp.ok) {
        console.warn(`iTunes album lookup returned status ${resp.status}`);
        return res.json({ results: [] });
      }
      const data = await resp.json();
      return res.json(data);
    } catch (err: any) {
      console.error("iTunes album lookup error:", err);
      return res.json({ error: err.message, results: [] });
    }
  });

  // API 5c: iTunes Album Search by term
  app.get("/api/itunes/search-album", async (req, res) => {
    try {
      const q = (req.query.q as string || "").trim();
      if (!q) return res.json({ results: [] });
      const resp = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=album&limit=5`, {
        headers: ITUNES_HEADERS,
      });
      if (!resp.ok) {
        console.warn(`iTunes album search returned status ${resp.status}`);
        return res.json({ results: [] });
      }
      const data = await resp.json();
      return res.json(data);
    } catch (err: any) {
      console.error("iTunes album search error:", err);
      return res.json({ error: err.message, results: [] });
    }
  });

  // API 6: YouTube Audio Grabber with multi-engine fallback and relevance scoring
  app.get("/api/yt-grab", async (req, res) => {
    try {
      const q = (req.query.q as string || "").trim();
      const artistParam = (req.query.artist as string || "").trim();
      const titleParam = (req.query.title as string || "").trim();
      const directUrl = (req.query.url as string || "").trim();

      if (directUrl) {
        const match = directUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
        if (match && match[1]) {
          const videoId = match[1];
          return res.json({
            videoId,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            title: "YouTube Audio"
          });
        }
      }

      if (!q && (!artistParam || !titleParam)) {
        return res.status(400).json({ error: "Query parameter 'q' or 'artist' + 'title' is required" });
      }

      const searchType = (req.query.type as string || "audio").toLowerCase();
      
      // Determine precise artist and title keywords
      let targetArtist = artistParam;
      let targetTitle = titleParam;
      if (!targetArtist && q.includes(" - ")) {
        const parts = q.split(" - ");
        targetArtist = parts[0].trim();
        targetTitle = parts.slice(1).join(" - ").trim();
      } else if (!targetArtist) {
        targetArtist = q;
        targetTitle = q;
      }

      const searchQuery = searchType === "video" 
        ? `${targetArtist} - ${targetTitle} official music video`
        : `${targetArtist} - ${targetTitle}`;

      const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
      const artistWords = norm(targetArtist).split(" ").filter(w => w.length > 1);
      const titleWords = norm(targetTitle).split(" ").filter(w => w.length > 1);

      const parseDurationSec = (str?: string): number => {
        if (!str) return 0;
        const parts = str.trim().split(":").map(p => Number(p));
        if (parts.some(p => isNaN(p))) return 0;
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        return 0;
      };

      type ScoredItem = { id: string; title: string; owner: string; score: number; durationSec?: number };
      let candidates: ScoredItem[] = [];

      // Strategy 1: YouTube Search HTML Scrape & ytInitialData parse
      try {
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
        const response = await fetch(searchUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
        });

        if (response.ok) {
          const html = await response.text();
          const ytInitialDataMatch = html.match(/var ytInitialData = ({.*?});<\/script>/s) || html.match(/window\["ytInitialData"\] = ({.*?});<\/script>/s);
          if (ytInitialDataMatch && ytInitialDataMatch[1]) {
            try {
              const data = JSON.parse(ytInitialDataMatch[1]);
              const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
              if (Array.isArray(contents)) {
                for (const section of contents) {
                  const itemSection = section?.itemSectionRenderer?.contents;
                  if (Array.isArray(itemSection)) {
                    for (const item of itemSection) {
                      const vr = item?.videoRenderer;
                      if (vr && vr.videoId) {
                        const itemTitle = vr.title?.runs?.[0]?.text || vr.title?.simpleText || "";
                        const owner = vr.ownerText?.runs?.[0]?.text || "";
                        const lengthText = vr.lengthText?.simpleText || vr.lengthText?.runs?.[0]?.text || "";
                        const durationSec = parseDurationSec(lengthText);
                        candidates.push({ id: vr.videoId, title: itemTitle, owner, score: 0, durationSec });
                      }
                    }
                  }
                }
              }
            } catch {}
          }
        }
      } catch (scrapeErr) {
        console.warn("YouTube direct scrape failed, trying invidious fallback:", scrapeErr);
      }

      // Strategy 2: Invidious Fallback Instances
      if (candidates.length === 0) {
        const invidiousInstances = [
          "https://inv.nadeko.net",
          "https://invidious.nerdvpn.de",
          "https://yewtu.be",
          "https://vid.priv.au"
        ];

        for (const instance of invidiousInstances) {
          try {
            const invUrl = `${instance}/api/v1/search?q=${encodeURIComponent(searchQuery)}&type=video`;
            const invResp = await fetch(invUrl, { signal: AbortSignal.timeout(3500) });
            if (invResp.ok) {
              const items = await invResp.json();
              if (Array.isArray(items) && items.length > 0) {
                for (const it of items) {
                  if (it.videoId) {
                    candidates.push({
                      id: it.videoId,
                      title: it.title || "",
                      owner: it.author || "",
                      score: 0,
                      durationSec: it.lengthSeconds || 0
                    });
                  }
                }
                if (candidates.length > 0) break;
              }
            }
          } catch {}
        }
      }

      // Strategy 3: Piped API Fallback Instances
      if (candidates.length === 0) {
        const pipedInstances = [
          "https://api.piped.private.coffee",
          "https://pipedapi.ducks.party",
          "https://piped.mha.fi",
          "https://pipedapi.kavin.rocks",
          "https://piped.video"
        ];
        for (const instance of pipedInstances) {
          try {
            const pUrl = `${instance}/search?q=${encodeURIComponent(searchQuery)}&filter=all`;
            const pResp = await fetch(pUrl, { signal: AbortSignal.timeout(3000) });
            if (pResp.ok) {
              const pData = await pResp.json();
              const items = Array.isArray(pData.items) ? pData.items : [];
              for (const it of items) {
                if (it.type === 'stream' || (it.url && it.url.includes('/watch?v='))) {
                  const vM = it.url ? it.url.match(/v=([\w-]{11})/) : null;
                  const vid = vM ? vM[1] : (it.url ? it.url.replace('/watch?v=', '') : '');
                  if (vid && vid.length === 11) {
                    candidates.push({
                      id: vid,
                      title: it.title || "",
                      owner: it.uploaderName || it.author || "",
                      score: 0,
                      durationSec: typeof it.duration === 'number' ? it.duration : 0,
                    });
                  }
                }
              }
              if (candidates.length > 0) break;
            }
          } catch {}
        }
      }

      if (candidates.length === 0) {
        return res.status(404).json({ error: "No YouTube video found for query", query: q });
      }

      // Score and rank candidates against target artist & song title with resilient artist matching
      const scored = candidates.map((item) => {
        const resTitle = norm(item.title);
        const resOwner = norm(item.owner);
        let score = 0;

        // Flexible artist matching: check if any/all main artist tokens appear
        const artistMatchesOwner = artistWords.filter((w) => resOwner.includes(w)).length;
        const artistMatchesTitle = artistWords.filter((w) => resTitle.includes(w)).length;

        if (artistMatchesOwner > 0 || artistMatchesTitle > 0) {
          score += (artistMatchesOwner / (artistWords.length || 1)) * 100;
          score += (artistMatchesTitle / (artistWords.length || 1)) * 70;
        } else {
          score -= 50;
        }

        // Check song title matching
        const titleMatches = titleWords.filter((w) => resTitle.includes(w)).length;
        score += (titleMatches / (titleWords.length || 1)) * 60;

        // Boost official audio / topic / vevo / album version for audio search
        if (searchType === "audio") {
          if (resOwner.includes("topic") || resOwner.includes("vevo")) score += 40;
          if (resTitle.includes("album version") || resTitle.includes("album edition")) score += 40;
          if (resTitle.includes("official audio") || resTitle.includes("audio")) score += 30;
        } else {
          if (resTitle.includes("official music video") || resTitle.includes("official video")) score += 40;
        }

        // Penalize unwanted fan covers, 10 hour loops, sped up, live (unless requested)
        if (!norm(targetTitle).includes("cover") && (resTitle.includes("cover") || resOwner.includes("cover"))) score -= 150;
        if (!norm(targetTitle).includes("live") && resTitle.includes("live")) score -= 60;
        if (resTitle.includes("1 hour") || resTitle.includes("10 hours") || resTitle.includes("loop")) score -= 100;
        if (!norm(targetTitle).includes("sped up") && resTitle.includes("sped up")) score -= 80;
        if (!norm(targetTitle).includes("slowed") && resTitle.includes("slowed")) score -= 80;

        return { ...item, score };
      }).sort((a, b) => b.score - a.score);

      const best = scored[0];
      const videoId = best.id;
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

      return res.json({
        videoId,
        url: videoUrl,
        query: q,
        matchedTitle: best.title,
        matchedOwner: best.owner,
        durationSec: best.durationSec || 0,
        score: best.score,
        alternativeIds: scored.slice(1, 5).map((s) => s.id),
        sources: scored.slice(0, 10).map((s) => ({
          id: s.id,
          title: s.title,
          owner: s.owner,
          score: s.score,
          durationSec: s.durationSec || 0,
        }))
      });
    } catch (err: any) {
      console.error("YouTube grabber error:", err);
      return res.status(500).json({ error: err.message || "Failed to grab YouTube audio URL" });
    }
  });

  // API 7: Synced & Plain Lyrics from LRCLIB
  app.get("/api/lyrics", async (req, res) => {
    try {
      const track = (req.query.track as string || "").trim();
      const artist = (req.query.artist as string || "").trim();
      const duration = req.query.duration ? Number(req.query.duration) : undefined;

      if (!track) {
        return res.status(400).json({ error: "Track name is required" });
      }

      const cleanTrack = track
        .replace(/\s*\(feat\..*?\)/i, "")
        .replace(/\s*\[feat\..*?\]/i, "")
        .replace(/\s*-\s*Single/i, "")
        .replace(/\s*\(.*?Version\)/i, "")
        .trim();

      // Attempt 1: exact lookup with get
      let lrclibUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTrack)}&artist_name=${encodeURIComponent(artist)}`;
      if (duration) {
        lrclibUrl += `&duration=${Math.round(duration)}`;
      }

      let lyricResp = await fetch(lrclibUrl, {
        headers: { "User-Agent": "MusicApp/1.0 (https://github.com)" }
      });

      if (lyricResp.ok) {
        const data = await lyricResp.json();
        return res.json({
          id: data.id,
          trackName: data.trackName,
          artistName: data.artistName,
          plainLyrics: data.plainLyrics || "",
          syncedLyrics: data.syncedLyrics || "",
          instrumental: Boolean(data.instrumental),
          found: true
        });
      }

      // Attempt 2: fuzzy search with query
      const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(`${artist} ${cleanTrack}`)}`;
      const searchResp = await fetch(searchUrl, {
        headers: { "User-Agent": "MusicApp/1.0 (https://github.com)" }
      });

      if (searchResp.ok) {
        const results = await searchResp.json();
        if (Array.isArray(results) && results.length > 0) {
          const withSynced = results.find((r: any) => r.syncedLyrics) || results[0];
          return res.json({
            id: withSynced.id,
            trackName: withSynced.trackName,
            artistName: withSynced.artistName,
            plainLyrics: withSynced.plainLyrics || "",
            syncedLyrics: withSynced.syncedLyrics || "",
            instrumental: Boolean(withSynced.instrumental),
            found: true
          });
        }
      }

      return res.json({
        found: false,
        plainLyrics: "",
        syncedLyrics: "",
        instrumental: false
      });
    } catch (err: any) {
      console.error("Lyrics error:", err);
      return res.status(500).json({ error: err.message || "Failed to fetch lyrics" });
    }
  });

  // API 8: iTunes Search Proxy with Deezer Fallback
  app.get("/api/itunes", async (req, res) => {
    const term = (req.query.term as string || "top hits").trim();
    const limit = Number(req.query.limit) || 30;

    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=${limit}`;
      const response = await fetch(url, { headers: ITUNES_HEADERS });
      
      if (response.ok) {
        const data = await response.json();
        const results = (data.results || []).map((item: any) => ({
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
          genre: item.primaryGenreName || "Music"
        }));

        return res.json({ results });
      } else {
        console.warn(`iTunes search status ${response.status}, falling back to Deezer`);
      }
    } catch (err: any) {
      console.warn("iTunes search error, trying Deezer fallback:", err?.message || err);
    }

    // Deezer Fallback
    try {
      const dzResp = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(term)}&limit=${limit}`, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      if (dzResp.ok) {
        const dzData = await dzResp.json();
        const results = (dzData.data || []).map((item: any) => ({
          id: `dz-${item.id}`,
          title: item.title,
          artist: item.artist?.name || "Unknown Artist",
          album: item.album?.title || "Single",
          artworkSmall: item.album?.cover_medium || "",
          artworkLarge: item.album?.cover_big || item.album?.cover_xl || "",
          artworkOriginal: item.album?.cover_xl || item.album?.cover_big || "",
          durationMs: (item.duration || 180) * 1000,
          previewUrl: item.preview || "",
          releaseDate: "",
          genre: "Music"
        }));
        return res.json({ results });
      }
    } catch (dzErr: any) {
      console.error("Deezer search fallback failed:", dzErr?.message || dzErr);
    }

    return res.json({ results: [] });
  });

  // API 9: iTunes Artist Catalog & Profiles
  app.get("/api/itunes-artists", async (req, res) => {
    const term = (req.query.term as string || "top").trim();
    const limit = Number(req.query.limit) || 40;

    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=${limit}`;
      const response = await fetch(url, { headers: ITUNES_HEADERS });

      if (response.ok) {
        const data = await response.json();
        const results = data.results || [];

        const artistMap = new Map<string, any>();
        for (const item of results) {
          const artistName = item.artistName;
          if (!artistName) continue;
          const lower = artistName.toLowerCase();
          if (!artistMap.has(lower)) {
            artistMap.set(lower, {
              id: `itunes-${item.artistId || lower.replace(/\s+/g, '-')}`,
              name: artistName,
              genre: item.primaryGenreName || "Music",
              image: item.artworkUrl100 ? item.artworkUrl100.replace("100x100bb", "600x600bb") : "",
              artistId: item.artistId,
            });
          }
        }

        return res.json({ artists: Array.from(artistMap.values()) });
      } else {
        console.warn(`iTunes artist search status ${response.status}, falling back to Deezer`);
      }
    } catch (err: any) {
      console.warn("iTunes artist search error, trying Deezer fallback:", err?.message || err);
    }

    // Deezer Fallback
    try {
      const dzResp = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(term)}&limit=${limit}`, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      if (dzResp.ok) {
        const dzData = await dzResp.json();
        const artists = (dzData.data || []).map((a: any) => ({
          id: `dz-art-${a.id}`,
          name: a.name,
          genre: "Music",
          image: a.picture_big || a.picture_medium || "",
          artistId: a.id,
        }));
        return res.json({ artists });
      }
    } catch (dzErr: any) {
      console.error("Deezer artist search fallback failed:", dzErr?.message || dzErr);
    }

    return res.json({ artists: [] });
  });

  // API 10: Real Chart Popular Tracks based on Guessed Categories (e.g. Hip-Hop & Country)
  app.get("/api/charts/popular", async (req, res) => {
    try {
      const genresParam = (req.query.genres as string || "").toLowerCase();
      const artistsParam = (req.query.artists as string || "").toLowerCase();
      const limit = Number(req.query.limit) || 30;

      // Map genre and artist keywords to Deezer genre IDs
      const genreMap: Record<string, number> = {
        hiphop: 116,
        rap: 116,
        "hip-hop": 116,
        country: 84,
        pop: 132,
        rnb: 165,
        "r&b": 165,
        soul: 165,
        rock: 152,
        dance: 113,
        electronic: 113,
        edm: 113,
        latin: 197,
        reggaeton: 197,
        alternative: 85,
        indie: 85
      };

      // Known artist to genre heuristic
      const artistGenreMap: Record<string, number> = {
        drake: 116,
        "travis scott": 116,
        "kendrick lamar": 116,
        future: 116,
        "21 savage": 116,
        kanye: 116,
        "kanye west": 116,
        "lil baby": 116,
        "morgan wallen": 84,
        "luke combs": 84,
        "zach bryan": 84,
        "chris stapleton": 84,
        "taylor swift": 132,
        "the weeknd": 165,
        sza: 165,
        "frank ocean": 165,
        "billie eilish": 132,
        "dua lipa": 132,
        "bad bunny": 197,
        "arctic monkeys": 152
      };

      const targetGenreIds = new Set<number>();

      // Check genre words
      for (const [key, gId] of Object.entries(genreMap)) {
        if (genresParam.includes(key)) {
          targetGenreIds.add(gId);
        }
      }

      // Check artist words
      for (const [art, gId] of Object.entries(artistGenreMap)) {
        if (artistsParam.includes(art)) {
          targetGenreIds.add(gId);
        }
      }

      // Default to general chart + hiphop + country if none detected
      if (targetGenreIds.size === 0) {
        targetGenreIds.add(0); // All
        targetGenreIds.add(116); // Hip Hop
        targetGenreIds.add(84); // Country
      }

      const genreIdList = Array.from(targetGenreIds).slice(0, 3);
      const chartPromises = genreIdList.map(async (gId) => {
        try {
          const resp = await fetch(`https://api.deezer.com/chart/${gId}/tracks?limit=25`, {
            headers: { "User-Agent": "Mozilla/5.0" }
          });
          if (!resp.ok) return [];
          const data = await resp.json();
          return (data.data || []).map((t: any) => ({
            id: `dz-${t.id}`,
            title: t.title,
            artist: t.artist?.name || "Unknown Artist",
            album: t.album?.title || "Single",
            artworkSmall: t.album?.cover_medium || "",
            artworkLarge: t.album?.cover_big || t.album?.cover_xl || "",
            artworkOriginal: t.album?.cover_xl || t.album?.cover_big || "",
            durationMs: (t.duration || 180) * 1000,
            previewUrl: t.preview || "",
            genre: gId === 116 ? "Hip-Hop" : gId === 84 ? "Country" : gId === 132 ? "Pop" : gId === 165 ? "R&B" : "Top Hits",
            rank: t.position || t.rank || 0,
          }));
        } catch {
          return [];
        }
      });

      const chartResults = await Promise.all(chartPromises);

      // Interleave results from each category so hip-hop and country tracks alternate nicely
      const interleaved: any[] = [];
      const maxTracks = Math.max(...chartResults.map(r => r.length), 0);
      for (let i = 0; i < maxTracks; i++) {
        for (const list of chartResults) {
          if (list[i]) interleaved.push(list[i]);
        }
      }

      // Deduplicate by title + artist
      const seen = new Set<string>();
      const deduped = interleaved.filter((t) => {
        const key = `${t.title.toLowerCase()}::${t.artist.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, limit);

      return res.json({ tracks: deduped });
    } catch (err: any) {
      console.error("Popular chart tracks error:", err);
      return res.json({ tracks: [] });
    }
  });

  // API 11: Real New Releases based on taste & genre charts
  app.get("/api/releases/new", async (req, res) => {
    try {
      const genresParam = (req.query.genres as string || "").toLowerCase();
      const artistsParam = (req.query.artists as string || "").toLowerCase();
      const limit = Number(req.query.limit) || 24;

      const genreMap: Record<string, number> = {
        hiphop: 116,
        rap: 116,
        country: 84,
        pop: 132,
        rnb: 165,
        soul: 165,
        rock: 152,
        latin: 197
      };

      const targetGenreIds = new Set<number>();
      for (const [key, gId] of Object.entries(genreMap)) {
        if (genresParam.includes(key)) targetGenreIds.add(gId);
      }
      if (artistsParam.includes("drake") || artistsParam.includes("kanye") || artistsParam.includes("travis")) targetGenreIds.add(116);
      if (artistsParam.includes("morgan wallen") || artistsParam.includes("luke combs") || artistsParam.includes("zach bryan")) targetGenreIds.add(84);

      if (targetGenreIds.size === 0) {
        targetGenreIds.add(0);
        targetGenreIds.add(116);
        targetGenreIds.add(84);
      }

      const albumPromises = Array.from(targetGenreIds).slice(0, 3).map(async (gId) => {
        try {
          const resp = await fetch(`https://api.deezer.com/chart/${gId}/albums?limit=15`, {
            headers: { "User-Agent": "Mozilla/5.0" }
          });
          if (!resp.ok) return [];
          const data = await resp.json();
          return (data.data || []).map((a: any) => ({
            id: `dz-alb-${a.id}`,
            title: a.title,
            artist: a.artist?.name || "Unknown Artist",
            artwork: a.cover_big || a.cover_xl || a.cover_medium || "",
            artworkLarge: a.cover_xl || a.cover_big || "",
            year: a.release_date ? a.release_date.substring(0, 4) : new Date().getFullYear().toString(),
            genre: gId === 116 ? "Hip-Hop" : gId === 84 ? "Country" : "New Release",
            trackCount: a.nb_tracks || 0
          }));
        } catch {
          return [];
        }
      });

      const albumResults = await Promise.all(albumPromises);
      const interleaved: any[] = [];
      const maxLen = Math.max(...albumResults.map(r => r.length), 0);
      for (let i = 0; i < maxLen; i++) {
        for (const list of albumResults) {
          if (list[i]) interleaved.push(list[i]);
        }
      }

      const seen = new Set<string>();
      const deduped = interleaved.filter((a) => {
        const key = `${a.title.toLowerCase()}::${a.artist.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, limit);

      return res.json({ albums: deduped });
    } catch (err: any) {
      console.error("New releases error:", err);
      return res.json({ albums: [] });
    }
  });

  // Standalone HTML bundle route with explicit CORS headers
  app.get("/standalone.html", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Content-Type", "text/html; charset=UTF-8");
    res.sendFile(path.join(process.cwd(), "standalone.html"));
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
