export interface Track {
  id: number | string;
  title: string;
  artist: string;
  album: string;
  artworkSmall: string;
  artworkLarge: string;
  artworkOriginal: string;
  durationMs: number;
  previewUrl?: string;
  releaseDate?: string;
  genre?: string;
  youtubeId?: string;
  youtubeUrl?: string;
  albumId?: number | string;
  artistId?: number | string;
  rank?: number;
  isItunesMatched?: boolean;
  audioUrl?: string;
}

export interface LyricWord {
  word: string;
  time: number; // in seconds
  durationSec?: number;
}

export interface LyricLine {
  id: number;
  time: number; // in seconds
  endTime?: number; // in seconds
  text: string;
  words?: LyricWord[];
}

export interface LyricsData {
  syncedLyrics: LyricLine[];
  plainLyrics: string;
  isInstrumental: boolean;
  hasSynced: boolean;
  provider?: string;
}

export type ViewType = 'home' | 'library' | 'albums' | 'artist' | 'album' | 'mix' | 'profile' | 'settings';

export interface AlbumDetail {
  id: number | string;
  title: string;
  artist: string;
  artistId?: number | string;
  artwork: string;
  artworkLarge?: string;
  cover?: string;
  releaseDate?: string;
  year?: string;
  genre?: string;
  trackCount?: number;
  durationSec?: number;
  recordType?: 'album' | 'single' | 'ep' | 'compile' | string;
  tracks: Track[];
}

export interface ArtistDetail {
  id: string | number;
  name: string;
  image: string;
  picture?: string;
  headerImage?: string;
  genre?: string;
  followers?: number;
  monthlyListeners?: number;
  topTracks: Track[];
  popularTracks?: Track[];
  albums: AlbumDetail[];
  singles: AlbumDetail[];
  features: AlbumDetail[];
  allReleases: AlbumDetail[];
  discography?: AlbumDetail[];
}

export interface DailyMixItem {
  id: string;
  title: string;
  subtitle: string;
  artists: string[];
  coverArt: string;
  gradient: string;
  tracks?: Track[];
}

export interface Playlist {
  id: string;
  title: string;
  description?: string;
  createdAt: number;
  tracks: Track[];
  coverArt?: string;
}

export interface UserSettings {
  preferVideo: boolean;
  ambientLighting: boolean;
  lyricSyncStep?: number;
}

export interface UserTasteProfile {
  topArtists: string[];
  topGenres: string[];
  totalListens: number;
  lastUpdated?: number;
}

export interface AlbumHistoryItem {
  id: string | number;
  title: string;
  artist: string;
  artwork: string;
  lastPlayedAt: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  savedTracks: Track[];
  playlists?: Playlist[];
  history: Track[];
  albumHistory?: AlbumHistoryItem[];
  taste: UserTasteProfile;
  selectedArtists?: string[];
  hasCompletedArtistSelection?: boolean;
  settings: UserSettings;
  themeColor?: string;
  lyricProviders?: any[];
  lyricSyncStep?: number;
  lyricsOffsets?: Record<string, number>;
  trackSources?: Record<string, Array<{ id: string; title: string; owner: string; durationSec?: number }>>;
  trackSourceSelections?: Record<string, string>;
  createdAt?: number;
}

