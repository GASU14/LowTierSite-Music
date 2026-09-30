import React, { useState, useRef, useEffect } from 'react';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { searchDeezerArtists, fixAndEnrichTracksWithItunes } from '../services/api';
import {
  Play,
  Heart,
  Clock,
  ListMusic,
  Trash2,
  Plus,
  ArrowLeft,
  Shuffle,
  ListPlus,
  Pencil,
  Image as ImageIcon,
  Upload,
  X,
  Users,
  UserCheck,
  Sparkles,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { Track, Playlist } from '../types';
import { AddToPlaylistModal } from './AddToPlaylistModal';
import { optimizePlaylistImage } from '../utils/imageOptimizer';

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const FollowedArtistCard: React.FC<{ artistName: string }> = ({ artistName }) => {
  const { toggleFollowArtist } = useAuth();
  const { openArtist } = useNavigation();
  const [image, setImage] = useState<string>('https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80');

  useEffect(() => {
    let active = true;
    searchDeezerArtists(artistName, 1).then((res) => {
      if (active && res && res.length > 0 && res[0].image) {
        setImage(res[0].image);
      }
    }).catch(() => {});
    return () => { active = false; };
  }, [artistName]);

  return (
    <div
      onClick={() => openArtist(artistName)}
      className="group relative flex flex-col items-center p-3 rounded-2xl hover:bg-white/5 transition-all cursor-pointer select-none"
    >
      {/* Circular Avatar without border */}
      <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden mb-3 bg-zinc-800 shrink-0 shadow-lg">
        <img
          src={image}
          alt={artistName}
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80';
          }}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {/* Quick Unfollow hover overlay */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFollowArtist(artistName);
          }}
          className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity duration-200"
          title="Click to unfollow"
        >
          <X className="w-6 h-6 text-red-400 mb-1" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-200">Unfollow</span>
        </button>
      </div>

      <p className="text-sm font-bold text-white text-center truncate w-full group-hover:underline">
        {artistName}
      </p>
      <p className="text-xs text-zinc-400 text-center mt-0.5 font-medium">Artist</p>
    </div>
  );
};

export const LibraryPage: React.FC = () => {
  const {
    savedTracks,
    history,
    queue,
    currentTrack,
    isPlaying,
    playTrack,
    togglePlay,
    toggleSaveTrack,
  } = useAudio();

  const {
    user,
    playlists,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    removeTrackFromPlaylist,
    selectedArtists,
    toggleFollowArtist,
    openArtistSelection,
  } = useAuth();
  const { openArtist } = useNavigation();

  const [activeTab, setActiveTab] = useState<'saved' | 'playlists' | 'artists' | 'queue' | 'history'>('saved');
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);

  // Modals state
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [isEditingPlaylist, setIsEditingPlaylist] = useState(false);
  const [playlistTitleInput, setPlaylistTitleInput] = useState('');
  const [playlistImageInput, setPlaylistImageInput] = useState<string | null>(null);
  const [isOptimizingImage, setIsOptimizingImage] = useState(false);
  const [trackForPlaylistModal, setTrackForPlaylistModal] = useState<Track | null>(null);

  const [creationMode, setCreationMode] = useState<'empty' | 'csv'>('empty');
  const [csvText, setCsvText] = useState('');
  const [parsedTracks, setParsedTracks] = useState<Track[]>([]);

  // iTunes Fix / Sync State
  const [isFixingItunes, setIsFixingItunes] = useState(false);
  const [itunesProgress, setItunesProgress] = useState<{ completed: number; total: number } | null>(null);
  const [itunesSuccessMsg, setItunesSuccessMsg] = useState<string | null>(null);

  const [isFixingModalTracks, setIsFixingModalTracks] = useState(false);
  const [itunesModalProgress, setItunesModalProgress] = useState<{ completed: number; total: number } | null>(null);
  const [itunesModalMsg, setItunesModalMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);
  const csvFileInputRef = useRef<HTMLInputElement | null>(null);

  // Keep selected playlist synced with latest auth state
  const currentActivePlaylist = selectedPlaylist
    ? playlists.find((p) => p.id === selectedPlaylist.id) || null
    : null;

  const parseCsvTracks = (csvText: string): Track[] => {
    const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const tracks: Track[] = [];
    if (lines.length === 0) return tracks;

    // Helper to split CSV row respecting quotes
    const parseCsvRow = (row: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < row.length; i++) {
        const char = row[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if ((char === ',' || char === '\t' || char === ';') && !inQuotes) {
          result.push(current.trim().replace(/^["']|["']$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      return result;
    };

    const headerParts = parseCsvRow(lines[0]).map(h => h.toLowerCase());
    let titleIdx = -1;
    let artistIdx = -1;
    let albumIdx = -1;
    let startIndex = 0;

    // Detect header columns for Spotify, Apple Music, Tidal, etc.
    headerParts.forEach((h, idx) => {
      if (h.includes('track name') || h.includes('song name') || h.includes('title') || h === 'name') {
        if (titleIdx === -1) titleIdx = idx;
      }
      if (h.includes('artist name') || h.includes('artist(s)') || h.includes('artist') || h.includes('performer')) {
        if (artistIdx === -1) artistIdx = idx;
      }
      if (h.includes('album name') || h.includes('album')) {
        if (albumIdx === -1) albumIdx = idx;
      }
    });

    if (titleIdx !== -1 || artistIdx !== -1) {
      startIndex = 1; // Has header row
    } else {
      // Fallback defaults if no header recognized
      titleIdx = 0;
      artistIdx = 1;
      startIndex = 0;
    }

    for (let i = startIndex; i < lines.length; i++) {
      const parts = parseCsvRow(lines[i]);
      if (parts.length === 0 || (parts.length === 1 && !parts[0])) continue;

      let title = '';
      let artist = '';
      let album = 'CSV Import';

      if (titleIdx !== -1 && parts[titleIdx]) {
        title = parts[titleIdx];
      }
      if (artistIdx !== -1 && parts[artistIdx]) {
        artist = parts[artistIdx];
      }
      if (albumIdx !== -1 && parts[albumIdx]) {
        album = parts[albumIdx];
      }

      // If only 1 column or title missing, try splitting by dash or tab
      if (!title && parts.length > 0) {
        title = parts[0];
      }
      if (!artist && parts.length > 1) {
        artist = parts[1];
      } else if (!artist && title.includes(' - ')) {
        const splitDash = title.split(' - ');
        artist = splitDash[0].trim();
        title = splitDash.slice(1).join(' - ').trim();
      }

      if (title) {
        tracks.push({
          id: `csv-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
          title,
          artist: artist || 'Unknown Artist',
          album: album || 'CSV Import',
          artworkSmall: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&q=80',
          artworkLarge: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80',
          artworkOriginal: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80',
          durationMs: 180000,
        });
      }
    }
    return tracks;
  };

  const handleCsvFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string || '';
      setCsvText(text);
      const tracks = parseCsvTracks(text);
      setParsedTracks(tracks);
      if (!playlistTitleInput.trim() && file.name) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setPlaylistTitleInput(nameWithoutExt);
      }
    };
    reader.readAsText(file);
  };

  const handleImageUpload = async (file: File, isEdit = false) => {
    try {
      setIsOptimizingImage(true);
      const optimized = await optimizePlaylistImage(file);
      setPlaylistImageInput(optimized);
    } catch (err) {
      console.error('Failed to optimize playlist image:', err);
    } finally {
      setIsOptimizingImage(false);
    }
  };

  const handleOpenCreateModal = () => {
    setPlaylistTitleInput('');
    setPlaylistImageInput(null);
    setCsvText('');
    setParsedTracks([]);
    setCreationMode('empty');
    setIsCreatingPlaylist(true);
  };

  const handleOpenEditModal = (pl: Playlist) => {
    setPlaylistTitleInput(pl.title);
    setPlaylistImageInput(pl.coverArt || null);
    setIsEditingPlaylist(true);
  };

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistTitleInput.trim()) return;
    let initialTracks = creationMode === 'csv' ? parsedTracks : [];

    // Automatically enrich CSV tracks with iTunes if creating from CSV
    if (creationMode === 'csv' && initialTracks.length > 0) {
      try {
        const { enrichedTracks } = await fixAndEnrichTracksWithItunes(initialTracks);
        if (enrichedTracks.length > 0) {
          initialTracks = enrichedTracks;
          if (!playlistImageInput) {
            const topCover = enrichedTracks.find((t) => t.artworkLarge || t.artworkOriginal);
            if (topCover) {
              setPlaylistImageInput(topCover.artworkLarge || topCover.artworkOriginal);
            }
          }
        }
      } catch (err) {
        console.warn('Auto iTunes enrichment on create failed:', err);
      }
    }

    const pl = await createPlaylist(playlistTitleInput.trim(), '', playlistImageInput || undefined, initialTracks);
    setPlaylistTitleInput('');
    setPlaylistImageInput(null);
    setCsvText('');
    setParsedTracks([]);
    setItunesModalMsg(null);
    setCreationMode('empty');
    setIsCreatingPlaylist(false);
    setSelectedPlaylist(pl);
  };

  const handleFixModalTracksWithItunes = async () => {
    if (parsedTracks.length === 0) return;
    setIsFixingModalTracks(true);
    setItunesModalMsg(null);
    setItunesModalProgress({ completed: 0, total: parsedTracks.length });

    try {
      const { enrichedTracks, matchCount } = await fixAndEnrichTracksWithItunes(
        parsedTracks,
        (completed, total) => setItunesModalProgress({ completed, total })
      );
      setParsedTracks(enrichedTracks);
      if (!playlistImageInput) {
        const topCover = enrichedTracks.find((t) => t.artworkLarge || t.artworkOriginal);
        if (topCover) {
          setPlaylistImageInput(topCover.artworkLarge || topCover.artworkOriginal);
        }
      }
      setItunesModalMsg(`✓ Enriched ${matchCount} of ${enrichedTracks.length} tracks with iTunes titles & high-res artwork`);
    } catch (err) {
      console.error('Failed to fix modal tracks with iTunes:', err);
    } finally {
      setIsFixingModalTracks(false);
      setItunesModalProgress(null);
    }
  };

  const handleFixPlaylistWithItunes = async () => {
    if (!currentActivePlaylist || currentActivePlaylist.tracks.length === 0) return;
    setIsFixingItunes(true);
    setItunesSuccessMsg(null);
    setItunesProgress({ completed: 0, total: currentActivePlaylist.tracks.length });

    try {
      const { enrichedTracks, matchCount } = await fixAndEnrichTracksWithItunes(
        currentActivePlaylist.tracks,
        (completed, total) => setItunesProgress({ completed, total })
      );

      let updatedCover = currentActivePlaylist.coverArt;
      if (!updatedCover || updatedCover.includes('unsplash')) {
        const topCover = enrichedTracks.find((t) => t.artworkLarge || t.artworkOriginal);
        if (topCover) {
          updatedCover = topCover.artworkLarge || topCover.artworkOriginal;
        }
      }

      await updatePlaylist(currentActivePlaylist.id, {
        tracks: enrichedTracks,
        coverArt: updatedCover,
      });

      setItunesSuccessMsg(`Successfully matched & fixed ${matchCount} of ${enrichedTracks.length} tracks using iTunes API!`);
      setTimeout(() => setItunesSuccessMsg(null), 6000);
    } catch (err) {
      console.error('Failed to fix playlist with iTunes:', err);
    } finally {
      setIsFixingItunes(false);
      setItunesProgress(null);
    }
  };

  const handleUpdatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentActivePlaylist || !playlistTitleInput.trim()) return;
    await updatePlaylist(currentActivePlaylist.id, {
      title: playlistTitleInput.trim(),
      coverArt: playlistImageInput || undefined,
    });
    setIsEditingPlaylist(false);
  };

  const getList = (): Track[] => {
    if (activeTab === 'saved') return savedTracks;
    if (activeTab === 'queue') return queue;
    return history;
  };

  const currentList = getList();

  const handleTrackClick = (track: Track, listToUse: Track[]) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
    } else {
      playTrack(track, listToUse);
    }
  };

  // Calculate total playlist duration
  const totalPlaylistDurationMs = (currentActivePlaylist?.tracks || []).reduce(
    (acc, t) => acc + (t.durationMs || 180000),
    0
  );

  return (
    <div id="library-page" className="flex flex-col gap-6 pb-28 select-none">
      {/* Header & Navigation Tabs */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white tracking-tight">Your Library</h2>
          {activeTab === 'playlists' && !currentActivePlaylist && (
            <button
              id="create-playlist-btn"
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white text-black hover:bg-zinc-200 text-xs font-bold transition-all shadow-md active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Playlist</span>
            </button>
          )}
        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            id="tab-saved-tracks"
            onClick={() => {
              setSelectedPlaylist(null);
              setActiveTab('saved');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-semibold transition-all ${
              activeTab === 'saved' && !currentActivePlaylist
                ? 'bg-white text-black shadow-md'
                : 'bg-[#141417] text-zinc-400 hover:text-white'
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            <span>Saved ({savedTracks.length})</span>
          </button>

          <button
            id="tab-playlists"
            onClick={() => {
              setSelectedPlaylist(null);
              setActiveTab('playlists');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-semibold transition-all ${
              activeTab === 'playlists' && !currentActivePlaylist
                ? 'bg-white text-black shadow-md'
                : 'bg-[#141417] text-zinc-400 hover:text-white'
            }`}
          >
            <ListMusic className="w-3.5 h-3.5" />
            <span>Playlists ({playlists.length})</span>
          </button>

          <button
            id="tab-artists"
            onClick={() => {
              setSelectedPlaylist(null);
              setActiveTab('artists');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-semibold transition-all ${
              activeTab === 'artists' && !currentActivePlaylist
                ? 'bg-white text-black shadow-md'
                : 'bg-[#141417] text-zinc-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Artists ({selectedArtists.length})</span>
          </button>

          <button
            id="tab-queue"
            onClick={() => {
              setSelectedPlaylist(null);
              setActiveTab('queue');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-semibold transition-all ${
              activeTab === 'queue' && !currentActivePlaylist
                ? 'bg-white text-black shadow-md'
                : 'bg-[#141417] text-zinc-400 hover:text-white'
            }`}
          >
            <ListMusic className="w-3.5 h-3.5" />
            <span>Queue ({queue.length})</span>
          </button>

          <button
            id="tab-history"
            onClick={() => {
              setSelectedPlaylist(null);
              setActiveTab('history');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-semibold transition-all ${
              activeTab === 'history' && !currentActivePlaylist
                ? 'bg-white text-black shadow-md'
                : 'bg-[#141417] text-zinc-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>History ({history.length})</span>
          </button>
        </div>
      </div>

      {/* Playlist Detail View - Identical Look & Feel to AlbumView */}
      {currentActivePlaylist ? (
        <div className="flex flex-col gap-6 animate-in fade-in duration-200">
          {/* Back button */}
          <button
            id="back-to-playlists-btn"
            onClick={() => setSelectedPlaylist(null)}
            className="flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white py-2 px-3.5 rounded-2xl bg-zinc-900/60 hover:bg-zinc-800 transition-colors w-fit shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Playlists</span>
          </button>

          {/* Hero Header matching AlbumView */}
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8 p-6 md:p-8 rounded-3xl bg-gradient-to-b from-zinc-800/60 via-[#141417] to-[#121215] shadow-2xl">
            {/* Artwork with Edit Cover hover effect */}
            <div
              onClick={() => handleOpenEditModal(currentActivePlaylist)}
              className="relative w-48 h-48 md:w-56 md:h-56 rounded-2xl overflow-hidden shadow-2xl bg-zinc-800 shrink-0 group cursor-pointer"
              title="Click to change cover art"
            >
              {currentActivePlaylist.coverArt ? (
                <img
                  src={currentActivePlaylist.coverArt}
                  alt={currentActivePlaylist.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-800 text-zinc-600 gap-2">
                  <ListMusic className="w-16 h-16" />
                </div>
              )}

              {/* Hover Change Cover overlay */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 text-white transition-opacity duration-200">
                <Pencil className="w-6 h-6" />
                <span className="text-xs font-bold">Edit Cover</span>
              </div>
            </div>

            {/* Metadata & Actions */}
            <div className="flex flex-col items-center md:items-start text-center md:text-left flex-1 min-w-0">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Playlist
              </span>
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight line-clamp-2 mb-3">
                {currentActivePlaylist.title}
              </h1>

              {/* Sub-line */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs text-zinc-300 font-medium mb-6">
                <span className="text-white font-bold">{user?.displayName || 'You'}</span>
                <span>•</span>
                <span>{currentActivePlaylist.tracks.length} tracks</span>
                {totalPlaylistDurationMs > 0 && (
                  <>
                    <span>•</span>
                    <span>{formatDuration(totalPlaylistDurationMs)}</span>
                  </>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                {currentActivePlaylist.tracks.length > 0 && (
                  <>
                    <button
                      id="play-playlist-btn"
                      onClick={() =>
                        playTrack(currentActivePlaylist.tracks[0], currentActivePlaylist.tracks)
                      }
                      className="px-7 py-3 bg-white text-black font-bold rounded-2xl hover:bg-zinc-200 transition-all flex items-center gap-2 shadow-xl active:scale-95 text-xs sm:text-sm"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Play</span>
                    </button>

                    <button
                      id="shuffle-playlist-btn"
                      onClick={() => {
                        const shuffled = [...currentActivePlaylist.tracks].sort(
                          () => Math.random() - 0.5
                        );
                        playTrack(shuffled[0], shuffled);
                      }}
                      className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl transition-all flex items-center gap-2 text-xs font-semibold shadow-md active:scale-95"
                    >
                      <Shuffle className="w-4 h-4" />
                      <span>Shuffle</span>
                    </button>

                    {/* iTunes API Fix & Match Button */}
                    <button
                      id="fix-itunes-playlist-btn"
                      onClick={handleFixPlaylistWithItunes}
                      disabled={isFixingItunes}
                      className="px-4 py-3 bg-white text-black font-bold hover:bg-zinc-200 rounded-2xl transition-all flex items-center gap-2 text-xs shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                      title="Compare imported tracks with iTunes API and fix titles, artwork, album names, and sample audio"
                    >
                      {isFixingItunes ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Matching iTunes ({itunesProgress?.completed || 0}/{itunesProgress?.total || currentActivePlaylist.tracks.length})...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-black" />
                          <span>Fix / Match with iTunes</span>
                        </>
                      )}
                    </button>
                  </>
                )}

                <button
                  id="edit-playlist-header-btn"
                  onClick={() => handleOpenEditModal(currentActivePlaylist)}
                  className="px-4 py-3 bg-zinc-800/80 hover:bg-zinc-700 text-white rounded-2xl transition-all flex items-center gap-2 text-xs font-semibold shadow-md active:scale-95"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Playlist</span>
                </button>

                <button
                  id="delete-playlist-header-btn"
                  onClick={() => {
                    deletePlaylist(currentActivePlaylist.id);
                    setSelectedPlaylist(null);
                  }}
                  className="px-4 py-3 bg-zinc-900/60 hover:bg-red-950/60 text-zinc-400 hover:text-red-300 rounded-2xl transition-all flex items-center gap-2 text-xs font-semibold shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>

              {itunesSuccessMsg && (
                <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-2xl bg-zinc-800 text-white text-xs shadow-md animate-in fade-in duration-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{itunesSuccessMsg}</span>
                </div>
              )}
            </div>
          </div>

          {/* Tracks Table / List */}
          <div className="flex flex-col gap-2">
            {/* Table Header */}
            <div className="flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-3">
                <div className="w-6 text-center shrink-0">#</div>
                <div className="flex-1">Title</div>
              </div>
              <div className="hidden md:block w-48 lg:w-64 min-w-0 px-4 text-left">Artist / Album</div>
              <div className="flex items-center gap-3 shrink-0 pr-1">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Tracks Rows */}
            {currentActivePlaylist.tracks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-zinc-500 gap-2">
                <p className="text-sm">This playlist is currently empty.</p>
                <p className="text-xs text-zinc-600">
                  Click the "+ Add to Playlist" button on any song to add tracks here.
                </p>
              </div>
            ) : (
              currentActivePlaylist.tracks.map((track, index) => {
                const isCurrent =
                  currentTrack?.id === track.id || currentTrack?.title === track.title;
                const isSaved = savedTracks.some((t) => t.id === track.id);

                return (
                  <div
                    key={`${track.id}-${index}`}
                    onClick={() => handleTrackClick(track, currentActivePlaylist.tracks)}
                    className={`group flex items-center justify-between px-4 py-3 rounded-2xl cursor-pointer transition-all duration-150 ${
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
                        <p className="text-xs text-zinc-400 truncate mt-0.5 md:hidden">
                          {track.artist}
                        </p>
                      </div>
                    </div>

                    {/* Center: Artist / Album */}
                    <div className="hidden md:block w-48 lg:w-64 min-w-0 px-4 text-xs text-zinc-400 truncate text-left">
                      <span className="truncate block hover:text-white">
                        {track.artist} {track.album ? `• ${track.album}` : ''}
                      </span>
                    </div>

                    {/* Right: Remove + Heart + Duration */}
                    <div className="flex items-center gap-2 shrink-0 text-xs text-zinc-400 pr-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTrackFromPlaylist(currentActivePlaylist.id, track.id);
                        }}
                        className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                        title="Remove from playlist"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSaveTrack(track);
                        }}
                        className="p-1 text-zinc-400 hover:text-white transition-colors"
                      >
                        <Heart
                          className={`w-4 h-4 ${isSaved ? 'fill-white text-white' : ''}`}
                        />
                      </button>

                      <span className="w-11 text-right tabular-nums">
                        {formatDuration(
                          track.durationMs ? track.durationMs : (track as any).duration * 1000 || 180000
                        )}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : activeTab === 'playlists' ? (
        /* Playlists Grid - Clean visual cards without borders */
        <div>
          {playlists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-3">
              <ListMusic className="w-10 h-10 stroke-1 opacity-50" />
              <p className="text-sm">No playlists created yet.</p>
              <button
                onClick={handleOpenCreateModal}
                className="px-5 py-2.5 bg-white text-black text-xs font-bold rounded-2xl hover:bg-zinc-200 transition-colors shadow-lg"
              >
                Create First Playlist
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {playlists.map((pl) => (
                <div
                  key={pl.id}
                  id={`playlist-card-${pl.id}`}
                  onClick={() => setSelectedPlaylist(pl)}
                  className="group flex flex-col cursor-pointer select-none"
                >
                  <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-zinc-800 mb-3 shadow-lg group-hover:scale-[1.03] transition-transform duration-200 flex items-center justify-center">
                    {pl.coverArt ? (
                      <img
                        src={pl.coverArt}
                        alt={pl.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ListMusic className="w-12 h-12 text-zinc-600" />
                    )}
                    <div className="absolute right-3 bottom-3 w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all">
                      <Play className="w-4 h-4 fill-current translate-x-0.5" />
                    </div>
                  </div>

                  <div className="min-w-0 px-0.5">
                    <p className="text-sm font-bold text-white truncate group-hover:underline">
                      {pl.title}
                    </p>
                    <p className="text-xs text-zinc-400 mt-0.5 font-medium">
                      {pl.tracks.length} track{pl.tracks.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : activeTab === 'artists' ? (
        /* Artists Grid - Clean followed artist circles without borders */
        <div>
          {selectedArtists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-3">
              <Users className="w-10 h-10 stroke-1 opacity-50" />
              <p className="text-sm">No artists followed yet.</p>
              <button
                onClick={openArtistSelection}
                className="px-5 py-2.5 bg-white text-black text-xs font-bold rounded-2xl hover:bg-zinc-200 transition-colors shadow-lg cursor-pointer"
              >
                Follow Artists
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-6">
                <p className="text-xs text-zinc-400 font-medium">
                  Hover over an artist to unfollow, or click to view profile.
                </p>
                <button
                  onClick={openArtistSelection}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Artists</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {selectedArtists.map((artistName) => (
                  <FollowedArtistCard key={artistName} artistName={artistName} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Saved, Queue, History track lists */
        <div>
          {currentList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-2">
              <p className="text-sm">
                {activeTab === 'saved'
                  ? 'No saved tracks yet. Click the heart icon on any song to add it here.'
                  : activeTab === 'queue'
                  ? 'Queue is empty. Add songs to play next.'
                  : 'No playback history yet.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {currentList.map((track, idx) => {
                const isCurrent =
                  currentTrack?.id === track.id || currentTrack?.title === track.title;
                const isSaved = savedTracks.some((t) => t.id === track.id);

                return (
                  <div
                    key={`${track.id}-${idx}`}
                    id={`library-track-${track.id}`}
                    onClick={() => handleTrackClick(track, currentList)}
                    className={`group flex items-center justify-between px-4 py-2.5 rounded-2xl cursor-pointer transition-all duration-150 select-none ${
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
                          <span>{idx + 1}</span>
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
                        <p className="text-xs text-zinc-400 truncate mt-0.5 md:hidden">
                          {track.artist}
                        </p>
                      </div>
                    </div>

                    {/* Center: Artist / Album */}
                    <div className="hidden md:block w-48 lg:w-64 min-w-0 px-4 text-xs text-zinc-400 truncate text-left">
                      <span className="truncate block hover:text-white">
                        {track.artist} {track.album ? `• ${track.album}` : ''}
                      </span>
                    </div>

                    {/* Right: Actions + Duration */}
                    <div className="flex items-center gap-2 shrink-0 text-xs text-zinc-400 pr-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTrackForPlaylistModal(track);
                        }}
                        className="p-1 text-zinc-400 hover:text-white transition-colors"
                        title="Add to Playlist"
                      >
                        <ListPlus className="w-4 h-4" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSaveTrack(track);
                        }}
                        className="p-1 text-zinc-400 hover:text-white transition-colors"
                      >
                        {activeTab === 'saved' ? (
                          <Trash2 className="w-4 h-4 hover:text-red-400" />
                        ) : (
                          <Heart
                            className={`w-4 h-4 ${isSaved ? 'fill-white text-white' : ''}`}
                          />
                        )}
                      </button>

                      <span className="w-11 text-right tabular-nums">
                        {formatDuration(track.durationMs || 180000)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CREATE PLAYLIST MODAL */}
      {isCreatingPlaylist && (
        <div
          className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsCreatingPlaylist(false)}
        >
          <form
            onSubmit={handleCreatePlaylist}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#121215] rounded-3xl p-6 shadow-2xl space-y-5 select-none"
          >
            <div className="flex items-center justify-between pb-1">
              <h3 className="text-base font-bold text-white">Create New Playlist</h3>
              <button
                type="button"
                onClick={() => setIsCreatingPlaylist(false)}
                className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cover Art Upload Area (Auto 400x400 optimized) */}
            <div className="flex flex-col items-center gap-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative w-36 h-36 rounded-2xl bg-zinc-900 border-2 border-dashed border-zinc-700 hover:border-white overflow-hidden flex flex-col items-center justify-center cursor-pointer group transition-all"
              >
                {playlistImageInput ? (
                  <>
                    <img
                      src={playlistImageInput}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold transition-opacity">
                      Change Image
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-zinc-400 group-hover:text-white transition-colors p-3 text-center">
                    <Upload className="w-6 h-6" />
                    <span className="text-xs font-semibold">
                      {isOptimizingImage ? 'Optimizing...' : 'Upload Cover (400x400)'}
                    </span>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                }}
              />

              {playlistImageInput && (
                <button
                  type="button"
                  onClick={() => setPlaylistImageInput(null)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove picture
                </button>
              )}
            </div>

            {/* Creation Mode Tabs: Empty vs CSV */}
            <div className="flex items-center p-1 bg-zinc-900 rounded-2xl">
              <button
                type="button"
                onClick={() => setCreationMode('empty')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                  creationMode === 'empty'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Empty Playlist
              </button>
              <button
                type="button"
                onClick={() => setCreationMode('csv')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                  creationMode === 'csv'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                CSV Import
              </button>
            </div>

            {creationMode === 'csv' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-400">Upload CSV or Paste Data</label>
                  <button
                    type="button"
                    onClick={() => csvFileInputRef.current?.click()}
                    className="text-xs text-white underline hover:text-zinc-300"
                  >
                    Select CSV File
                  </button>
                  <input
                    ref={csvFileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleCsvFileSelect(file);
                    }}
                  />
                </div>
                <textarea
                  value={csvText}
                  onChange={(e) => {
                    const text = e.target.value;
                    setCsvText(text);
                    setParsedTracks(parseCsvTracks(text));
                  }}
                  placeholder="Paste CSV here (e.g. Title, Artist)..."
                  className="w-full h-24 px-4 py-3 bg-zinc-800/80 rounded-2xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white resize-none font-mono"
                />
                {parsedTracks.length > 0 && (
                  <div className="flex flex-col gap-2 pt-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-emerald-400 font-medium">
                        ✓ Found {parsedTracks.length} tracks from CSV
                      </p>
                      <button
                        type="button"
                        onClick={handleFixModalTracksWithItunes}
                        disabled={isFixingModalTracks}
                        className="px-3 py-1.5 bg-white text-black text-[11px] font-bold rounded-xl hover:bg-zinc-200 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                      >
                        {isFixingModalTracks ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Matching ({itunesModalProgress?.completed || 0}/{itunesModalProgress?.total || parsedTracks.length})...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3 text-black" />
                            <span>Auto-Fix with iTunes API</span>
                          </>
                        )}
                      </button>
                    </div>

                    {itunesModalMsg && (
                      <p className="text-[11px] text-zinc-300 bg-zinc-800/80 p-2.5 rounded-xl border border-zinc-700/50">
                        {itunesModalMsg}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Title Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400">Playlist Title</label>
              <input
                type="text"
                id="create-playlist-title-input"
                value={playlistTitleInput}
                onChange={(e) => setPlaylistTitleInput(e.target.value)}
                placeholder="e.g. Late Night Drives, Gym Bangers..."
                className="w-full px-4 py-3 bg-zinc-800/80 rounded-2xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreatingPlaylist(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!playlistTitleInput.trim() || isOptimizingImage}
                className="px-6 py-2.5 bg-white text-black text-xs font-bold rounded-2xl hover:bg-zinc-200 transition-colors disabled:opacity-50"
              >
                Create Playlist
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EDIT PLAYLIST MODAL */}
      {isEditingPlaylist && currentActivePlaylist && (
        <div
          className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsEditingPlaylist(false)}
        >
          <form
            onSubmit={handleUpdatePlaylist}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#121215] rounded-3xl p-6 shadow-2xl space-y-5 select-none"
          >
            <div className="flex items-center justify-between pb-1">
              <h3 className="text-base font-bold text-white">Edit Playlist Details</h3>
              <button
                type="button"
                onClick={() => setIsEditingPlaylist(false)}
                className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cover Art Upload Area */}
            <div className="flex flex-col items-center gap-3">
              <div
                onClick={() => editFileInputRef.current?.click()}
                className="relative w-36 h-36 rounded-2xl bg-zinc-900 border-2 border-dashed border-zinc-700 hover:border-white overflow-hidden flex flex-col items-center justify-center cursor-pointer group transition-all shadow-md"
              >
                {playlistImageInput ? (
                  <>
                    <img
                      src={playlistImageInput}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold transition-opacity">
                      Change Image
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-zinc-400 group-hover:text-white transition-colors p-3 text-center">
                    <Upload className="w-6 h-6" />
                    <span className="text-xs font-semibold">
                      {isOptimizingImage ? 'Optimizing...' : 'Upload Cover (400x400)'}
                    </span>
                  </div>
                )}
              </div>

              <input
                ref={editFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file, true);
                }}
              />

              {playlistImageInput && (
                <button
                  type="button"
                  onClick={() => setPlaylistImageInput(null)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove picture
                </button>
              )}
            </div>

            {/* Title Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400">Playlist Title</label>
              <input
                type="text"
                id="edit-playlist-title-input"
                value={playlistTitleInput}
                onChange={(e) => setPlaylistTitleInput(e.target.value)}
                placeholder="Playlist name..."
                className="w-full px-4 py-3 bg-zinc-800/80 rounded-2xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditingPlaylist(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!playlistTitleInput.trim() || isOptimizingImage}
                className="px-6 py-2.5 bg-white text-black text-xs font-bold rounded-2xl hover:bg-zinc-200 transition-colors disabled:opacity-50"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add To Playlist Modal */}
      <AddToPlaylistModal
        track={trackForPlaylistModal}
        isOpen={Boolean(trackForPlaylistModal)}
        onClose={() => setTrackForPlaylistModal(null)}
      />
    </div>
  );
};
