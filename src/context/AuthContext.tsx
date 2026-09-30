import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile, Track, UserSettings, Playlist, AlbumHistoryItem } from '../types';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (usernameOrEmail: string, password: string) => Promise<void>;
  signUp: (username: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUserSettings: (settings: Partial<UserSettings>) => Promise<void>;
  updateLyricsOffset: (trackId: string | number, offset: number) => Promise<void>;
  updateTrackSourceSelection: (trackId: string | number, videoId: string) => Promise<void>;
  recordListen: (track: Track) => Promise<void>;
  recordAlbumListen: (album: { id?: string | number; title: string; artist: string; artwork: string }) => Promise<void>;
  albumHistory: AlbumHistoryItem[];
  syncSavedTracksToCloud: (tracks: Track[]) => Promise<void>;
  playlists: Playlist[];
  createPlaylist: (title: string, description?: string, coverArt?: string, initialTracks?: Track[]) => Promise<Playlist>;
  updatePlaylist: (playlistId: string, updates: { title?: string; description?: string; coverArt?: string; tracks?: Track[] }) => Promise<void>;
  deletePlaylist: (playlistId: string) => Promise<void>;
  addTrackToPlaylist: (playlistId: string, track: Track) => Promise<void>;
  removeTrackFromPlaylist: (playlistId: string, trackId: number | string) => Promise<void>;
  showArtistSelection: boolean;
  setShowArtistSelection: (show: boolean) => void;
  openArtistSelection: () => void;
  saveSelectedArtists: (artists: string[]) => Promise<void>;
  toggleFollowArtist: (artistName: string) => Promise<void>;
  isFollowingArtist: (artistName: string) => boolean;
  selectedArtists: string[];
}

const AuthContext = createContext<AuthContextType | null>(null);

const DEFAULT_SETTINGS: UserSettings = {
  preferVideo: false,
  ambientLighting: true,
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showArtistSelection, setShowArtistSelection] = useState(false);
  const [guestArtists, setGuestArtists] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('ytify_selected_artists');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Playlists state (initialized from localStorage or Firebase profile)
  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    try {
      const stored = localStorage.getItem('ytify_playlists');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Album History state (max 20 albums)
  const [albumHistory, setAlbumHistory] = useState<AlbumHistoryItem[]>(() => {
    try {
      const stored = localStorage.getItem('ytify_album_history');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Listen to Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setUserProfile(null);
        setLoading(false);
        return;
      }

      // Realtime listener for user profile doc
      const userRef = doc(db, 'users', currentUser.uid);
      const unsubProfile = onSnapshot(
        userRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            setUserProfile(data);
            if (data.playlists && Array.isArray(data.playlists)) {
              setPlaylists(data.playlists);
              try {
                localStorage.setItem('ytify_playlists', JSON.stringify(data.playlists));
              } catch {}
            }
            if (data.albumHistory && Array.isArray(data.albumHistory)) {
              setAlbumHistory(data.albumHistory);
              try {
                localStorage.setItem('ytify_album_history', JSON.stringify(data.albumHistory));
              } catch {}
            }
            const hasArtists = data.selectedArtists && Array.isArray(data.selectedArtists) && data.selectedArtists.length >= 1;
            if (!hasArtists) {
              setShowArtistSelection(true);
            } else {
              setShowArtistSelection(false);
            }
          } else {
            const initialProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              username: currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'User'),
              savedTracks: [],
              playlists: [],
              history: [],
              selectedArtists: [],
              hasCompletedArtistSelection: false,
              taste: {
                topArtists: [],
                topGenres: [],
                totalListens: 0,
              },
              settings: DEFAULT_SETTINGS,
              createdAt: Date.now(),
            };
            setDoc(userRef, initialProfile, { merge: true }).catch(console.error);
            setUserProfile(initialProfile);
            setShowArtistSelection(true);
          }
          setLoading(false);
        },
        (error) => {
          console.warn("Firestore profile snapshot error:", error);
          setLoading(false);
        }
      );

      return () => unsubProfile();
    });

    return () => unsubscribe();
  }, []);

  const openArtistSelection = () => setShowArtistSelection(true);

  const saveSelectedArtists = async (artists: string[]) => {
    try {
      localStorage.setItem('ytify_selected_artists', JSON.stringify(artists));
      setGuestArtists(artists);

      if (user) {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          selectedArtists: artists,
          hasCompletedArtistSelection: true,
          'taste.topArtists': artists,
        });
        setUserProfile((prev) =>
          prev
            ? {
                ...prev,
                selectedArtists: artists,
                hasCompletedArtistSelection: true,
                taste: {
                  ...prev.taste,
                  topArtists: artists,
                },
              }
            : null
        );
      }
    } catch (err) {
      console.error('Failed to save selected artists:', err);
    } finally {
      setShowArtistSelection(false);
    }
  };

  const selectedArtists = userProfile?.selectedArtists && userProfile.selectedArtists.length > 0
    ? userProfile.selectedArtists
    : guestArtists;

  const toggleFollowArtist = async (artistName: string) => {
    if (!artistName) return;
    const current = selectedArtists || [];
    const isFollowing = current.some((a) => a.toLowerCase() === artistName.toLowerCase());
    const updated = isFollowing
      ? current.filter((a) => a.toLowerCase() !== artistName.toLowerCase())
      : [...current, artistName];

    await saveSelectedArtists(updated);
  };

  const isFollowingArtist = (artistName: string) => {
    if (!artistName) return false;
    return (selectedArtists || []).some((a) => a.toLowerCase() === artistName.toLowerCase());
  };

  useEffect(() => {
    if (!loading && !user) {
      setShowArtistSelection(false);
    }
  }, [loading, user]);

  // Sync playlists helper
  const syncPlaylists = async (newList: Playlist[]) => {
    setPlaylists(newList);
    try {
      localStorage.setItem('ytify_playlists', JSON.stringify(newList));
    } catch {}

    if (user) {
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { playlists: newList });
      } catch (err) {
        console.warn("Failed to sync playlists to Firebase:", err);
      }
    }
  };

  const createPlaylist = async (title: string, description: string = '', coverArt?: string, initialTracks?: Track[]) => {
    const newPlaylist: Playlist = {
      id: `pl-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      title: title.trim() || 'My Playlist',
      description: description.trim(),
      createdAt: Date.now(),
      tracks: initialTracks || [],
      coverArt: coverArt?.trim() || undefined,
    };
    const updated = [newPlaylist, ...playlists];
    await syncPlaylists(updated);
    return newPlaylist;
  };

  const updatePlaylist = async (
    playlistId: string,
    updates: { title?: string; description?: string; coverArt?: string; tracks?: Track[] }
  ) => {
    const updated = playlists.map((p) => {
      if (p.id === playlistId) {
        return {
          ...p,
          ...(updates.title !== undefined ? { title: updates.title.trim() || p.title } : {}),
          ...(updates.description !== undefined ? { description: updates.description.trim() } : {}),
          ...(updates.coverArt !== undefined ? { coverArt: updates.coverArt } : {}),
          ...(updates.tracks !== undefined ? { tracks: updates.tracks } : {}),
        };
      }
      return p;
    });
    await syncPlaylists(updated);
  };

  const deletePlaylist = async (playlistId: string) => {
    const updated = playlists.filter((p) => p.id !== playlistId);
    await syncPlaylists(updated);
  };

  const addTrackToPlaylist = async (playlistId: string, track: Track) => {
    const updated = playlists.map((p) => {
      if (p.id === playlistId) {
        if (p.tracks.some((t) => t.id === track.id)) return p;
        const newTracks = [...p.tracks, track];
        return {
          ...p,
          tracks: newTracks,
          coverArt: p.coverArt || track.artworkLarge || track.artworkSmall,
        };
      }
      return p;
    });
    await syncPlaylists(updated);
  };

  const removeTrackFromPlaylist = async (playlistId: string, trackId: number | string) => {
    const updated = playlists.map((p) => {
      if (p.id === playlistId) {
        const newTracks = p.tracks.filter((t) => t.id !== trackId);
        return {
          ...p,
          tracks: newTracks,
          coverArt: newTracks.length > 0 ? (newTracks[0].artworkLarge || newTracks[0].artworkSmall) : undefined,
        };
      }
      return p;
    });
    await syncPlaylists(updated);
  };

  // Sign Up with Username, Email, and Password
  const signUp = async (username: string, email: string, password: string) => {
    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanUsername || cleanUsername.length < 3) {
      throw new Error('Username must be at least 3 characters.');
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
      throw new Error('Username can only contain letters, numbers, underscores, and hyphens.');
    }

    const usernameDocRef = doc(db, 'usernames', cleanUsername.toLowerCase());
    const usernameSnap = await getDoc(usernameDocRef);
    if (usernameSnap.exists()) {
      throw new Error('Username is already taken. Please choose another one.');
    }

    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    await updateProfile(cred.user, { displayName: cleanUsername });

    await setDoc(usernameDocRef, {
      uid: cred.user.uid,
      email: cleanEmail,
      createdAt: Date.now(),
    });

    const initialProfile: UserProfile = {
      uid: cred.user.uid,
      email: cleanEmail,
      username: cleanUsername,
      savedTracks: [],
      playlists,
      history: [],
      selectedArtists: [],
      hasCompletedArtistSelection: false,
      taste: {
        topArtists: [],
        topGenres: [],
        totalListens: 0,
      },
      settings: DEFAULT_SETTINGS,
      createdAt: Date.now(),
    };

    await setDoc(doc(db, 'users', cred.user.uid), initialProfile);
    setUserProfile(initialProfile);
    setShowArtistSelection(true);
  };

  // Sign In with Username or Email and Password
  const signIn = async (usernameOrEmail: string, password: string) => {
    const identifier = usernameOrEmail.trim();
    let emailToUse = identifier;

    if (!identifier.includes('@')) {
      const usernameDocRef = doc(db, 'usernames', identifier.toLowerCase());
      const usernameSnap = await getDoc(usernameDocRef);
      if (!usernameSnap.exists()) {
        throw new Error('No account found with this username.');
      }
      emailToUse = usernameSnap.data().email;
    }

    const cred = await signInWithEmailAndPassword(auth, emailToUse, password);
    const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
    if (userDoc.exists()) {
      const data = userDoc.data() as UserProfile;
      setUserProfile(data);
      if (data.playlists) {
        setPlaylists(data.playlists);
      }
      if (!data.hasCompletedArtistSelection || !data.selectedArtists || data.selectedArtists.length < 5) {
        setShowArtistSelection(true);
      }
    } else {
      setShowArtistSelection(true);
    }
  };

  const signOut = async () => {
    await fbSignOut(auth);
    setUserProfile(null);
  };

  const updateUserSettings = async (newSettings: Partial<UserSettings>) => {
    const current = userProfile?.settings || DEFAULT_SETTINGS;
    const updated = { ...current, ...newSettings };

    try {
      localStorage.setItem('ytify_settings', JSON.stringify(updated));
    } catch {}

    if (user) {
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { settings: updated });
      } catch (e) {
        console.warn("Failed to update settings in Firestore:", e);
      }
    }
    setUserProfile((prev) => (prev ? { ...prev, settings: updated } : null));
  };

  const updateLyricsOffset = async (trackId: string | number, offset: number) => {
    const currentOffsets = userProfile?.lyricsOffsets || (() => {
      try {
        const stored = localStorage.getItem('ytify_lyrics_offsets');
        return stored ? JSON.parse(stored) : {};
      } catch {
        return {};
      }
    })();

    const updated = { ...currentOffsets, [String(trackId)]: offset };

    try {
      localStorage.setItem('ytify_lyrics_offsets', JSON.stringify(updated));
    } catch {}

    if (user) {
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { lyricsOffsets: updated });
      } catch (e) {
        console.warn("Failed to update lyrics offset in Firestore:", e);
      }
    }
    setUserProfile((prev) => (prev ? { ...prev, lyricsOffsets: updated } : null));
  };

  const updateTrackSourceSelection = async (trackId: string | number, videoId: string) => {
    const currentSelections = userProfile?.trackSourceSelections || (() => {
      try {
        const stored = localStorage.getItem('ytify_track_source_selections');
        return stored ? JSON.parse(stored) : {};
      } catch {
        return {};
      }
    })();

    const updated = { ...currentSelections, [String(trackId)]: videoId };

    try {
      localStorage.setItem('ytify_track_source_selections', JSON.stringify(updated));
    } catch {}

    if (user) {
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { trackSourceSelections: updated });
      } catch (e) {
        console.warn("Failed to update track source selection in Firestore:", e);
      }
    }
    setUserProfile((prev) => (prev ? { ...prev, trackSourceSelections: updated } : null));
  };

  const recordAlbumListen = async (album: { id?: string | number; title: string; artist: string; artwork: string }) => {
    if (!album || !album.title) return;
    const cleanTitle = album.title.trim();
    if (!cleanTitle || cleanTitle.toLowerCase() === 'single') return;

    const newItem: AlbumHistoryItem = {
      id: album.id || `alb-${cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      title: cleanTitle,
      artist: (album.artist || 'Unknown Artist').trim(),
      artwork: album.artwork || '',
      lastPlayedAt: Date.now(),
    };

    setAlbumHistory((prev) => {
      const filtered = prev.filter(
        (a) => !(a.title.toLowerCase() === newItem.title.toLowerCase() && a.artist.toLowerCase() === newItem.artist.toLowerCase())
      );
      const updated = [newItem, ...filtered].slice(0, 20);
      try {
        localStorage.setItem('ytify_album_history', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (user) {
      try {
        const userRef = doc(db, 'users', user.uid);
        const currentList = userProfile?.albumHistory || [];
        const filtered = currentList.filter(
          (a) => !(a.title.toLowerCase() === newItem.title.toLowerCase() && a.artist.toLowerCase() === newItem.artist.toLowerCase())
        );
        const updated = [newItem, ...filtered].slice(0, 20);
        await updateDoc(userRef, { albumHistory: updated });
      } catch (err) {
        console.warn("Failed to update album history in Firebase:", err);
      }
    }
  };

  const recordListen = async (track: Track) => {
    // Record album into albumHistory if track belongs to an album
    if (track.album && track.album.trim() && track.album.toLowerCase() !== 'single') {
      recordAlbumListen({
        id: track.albumId,
        title: track.album,
        artist: track.artist,
        artwork: track.artworkLarge || track.artworkSmall,
      });
    }

    if (!user || !userProfile) return;

    try {
      const currentTaste = userProfile.taste || { topArtists: [], topGenres: [], totalListens: 0 };
      const newHistory = [track, ...(userProfile.history || []).filter((t) => t.id !== track.id)].slice(0, 50);

      const artistCounts: Record<string, number> = {};
      newHistory.forEach((t) => {
        if (t.artist) {
          artistCounts[t.artist] = (artistCounts[t.artist] || 0) + 1;
        }
      });
      const topArtists = Object.keys(artistCounts)
        .sort((a, b) => artistCounts[b] - artistCounts[a])
        .slice(0, 8);

      const genreCounts: Record<string, number> = {};
      newHistory.forEach((t) => {
        if (t.genre) {
          genreCounts[t.genre] = (genreCounts[t.genre] || 0) + 1;
        }
      });
      const topGenres = Object.keys(genreCounts)
        .sort((a, b) => genreCounts[b] - genreCounts[a])
        .slice(0, 5);

      const updatedTaste = {
        topArtists,
        topGenres,
        totalListens: (currentTaste.totalListens || 0) + 1,
        lastUpdated: Date.now(),
      };

      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        history: newHistory,
        taste: updatedTaste,
      });
    } catch (err) {
      console.warn("Failed to update listen metadata in Firebase:", err);
    }
  };

  const syncSavedTracksToCloud = async (tracks: Track[]) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { savedTracks: tracks });
    } catch (err) {
      console.warn("Failed to sync saved tracks to Firebase:", err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        signIn,
        signUp,
        signOut,
        updateUserSettings,
        updateLyricsOffset,
        updateTrackSourceSelection,
        recordListen,
        recordAlbumListen,
        albumHistory,
        syncSavedTracksToCloud,
        playlists,
        createPlaylist,
        updatePlaylist,
        deletePlaylist,
        addTrackToPlaylist,
        removeTrackFromPlaylist,
        showArtistSelection,
        setShowArtistSelection,
        openArtistSelection,
        saveSelectedArtists,
        toggleFollowArtist,
        isFollowingArtist,
        selectedArtists,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
