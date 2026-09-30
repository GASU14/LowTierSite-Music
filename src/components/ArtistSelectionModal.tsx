import React, { useState, useMemo, useEffect } from 'react';
import { Search, Check, Loader2, Sparkles, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { searchDeezerArtists } from '../services/api';

interface ModalArtist {
  id: string | number;
  name: string;
  genre?: string;
  image: string;
}

const POPULAR_ARTIST_NAMES = [
  'Drake',
  'Travis Scott',
  'Kendrick Lamar',
  'The Weeknd',
  'Taylor Swift',
  'Kanye West',
  'Billie Eilish',
  'Frank Ocean',
  'Tyler, The Creator',
  'SZA',
  'Post Malone',
  'Lana Del Rey',
  'Playboi Carti',
  'Future',
  'Ariana Grande',
  'Eminem',
  'J. Cole',
  'Bruno Mars',
  'Dua Lipa',
  'Beyoncé',
  'A$AP Rocky',
  'Mac Miller',
  'Metro Boomin',
  'Childish Gambino',
  'Arctic Monkeys',
  'Radiohead',
  'Daft Punk',
  'Tame Impala',
  'Brent Faiyaz',
  'Steve Lacy',
  '21 Savage',
  'Don Toliver',
  'Kid Cudi',
  'Lil Uzi Vert',
  'Rihanna',
  'Justin Bieber',
  'Harry Styles',
  'Olivia Rodrigo',
  'Coldplay',
  'Adele',
  'Bad Bunny',
  'ROSALÍA',
  'Doja Cat',
  'Baby Keem',
  'Gunna',
  'Lil Baby',
  'Morgan Wallen',
  'Luke Combs',
  'BTS',
  'BLACKPINK',
  'NewJeans',
  'Linkin Park',
  'Nirvana',
  'Queen',
  'The Beatles',
];

export const ArtistSelectionModal: React.FC = () => {
  const { showArtistSelection, setShowArtistSelection, saveSelectedArtists, selectedArtists } = useAuth();
  const [selected, setSelected] = useState<string[]>(() => {
    return selectedArtists && selectedArtists.length > 0 ? selectedArtists : [];
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [catalogArtists, setCatalogArtists] = useState<ModalArtist[]>(() =>
    POPULAR_ARTIST_NAMES.map((name, i) => ({
      id: `init-${i}`,
      name,
      genre: 'Artist',
      image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80',
    }))
  );
  const [searchResults, setSearchResults] = useState<ModalArtist[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load authentic Deezer pictures for popular artists in progressive batches
  useEffect(() => {
    let isMounted = true;

    async function loadDeezerPictures() {
      const BATCH_SIZE = 8;
      const loadedMap = new Map<string, ModalArtist>();

      for (let i = 0; i < POPULAR_ARTIST_NAMES.length; i += BATCH_SIZE) {
        if (!isMounted) break;
        const chunk = POPULAR_ARTIST_NAMES.slice(i, i + BATCH_SIZE);
        await Promise.all(
          chunk.map(async (name, idx) => {
            try {
              const results = await searchDeezerArtists(name, 1);
              if (results && results.length > 0 && results[0].image) {
                loadedMap.set(name, {
                  id: results[0].id || `dz-${i + idx}`,
                  name: results[0].name || name,
                  genre: 'Artist',
                  image: results[0].image,
                });
                return;
              }
            } catch {}
            loadedMap.set(name, {
              id: `init-${i + idx}`,
              name,
              genre: 'Artist',
              image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80',
            });
          })
        );

        if (isMounted) {
          setCatalogArtists(
            POPULAR_ARTIST_NAMES.map((n, idx) => {
              if (loadedMap.has(n)) return loadedMap.get(n)!;
              return {
                id: `init-${idx}`,
                name: n,
                genre: 'Artist',
                image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80',
              };
            })
          );
        }
      }
    }

    loadDeezerPictures();

    return () => {
      isMounted = false;
    };
  }, []);

  // Debounced search using Deezer API
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearchingOnline(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingOnline(true);
      try {
        const results = await searchDeezerArtists(searchQuery.trim(), 20);
        setSearchResults(
          results.map((r) => ({
            id: r.id,
            name: r.name,
            genre: 'Artist',
            image: r.image,
          }))
        );
      } catch (err) {
        console.error("Failed to query Deezer catalog:", err);
      } finally {
        setIsSearchingOnline(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Combined list to display
  const displayArtists = useMemo(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const localMatches = catalogArtists.filter((a) => a.name.toLowerCase().includes(q));
      const map = new Map<string, ModalArtist>();
      localMatches.forEach((a) => map.set(a.name.toLowerCase(), a));
      searchResults.forEach((a) => {
        if (!map.has(a.name.toLowerCase())) {
          map.set(a.name.toLowerCase(), a);
        }
      });
      return Array.from(map.values());
    }
    return catalogArtists;
  }, [catalogArtists, searchResults, searchQuery]);

  if (!showArtistSelection) {
    return null;
  }

  const toggleArtist = (name: string) => {
    setSelected((prev) => {
      if (prev.includes(name)) {
        return prev.filter((item) => item !== name);
      } else {
        return [...prev, name];
      }
    });
  };

  const handleContinue = async () => {
    if (selected.length < 1) return;
    setIsSaving(true);
    try {
      await saveSelectedArtists(selected);
    } finally {
      setIsSaving(false);
    }
  };

  const isComplete = selected.length >= 1;

  return (
    <div
      id="artist-selection-overlay"
      className="fixed inset-0 z-[110] bg-[#09090b] flex flex-col justify-between select-none animate-in fade-in duration-200"
    >
      {/* Header section without description */}
      <div className="w-full max-w-6xl mx-auto px-6 pt-8 pb-4 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-zinc-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Personalize Your Sound</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Choose 1 or more artists
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <span
              id="artist-selection-count"
              className={`px-4 py-2 rounded-full text-xs font-semibold tracking-wide transition-all ${
                isComplete
                  ? 'bg-white text-black shadow-md'
                  : 'bg-zinc-800/80 text-zinc-300'
              }`}
            >
              {selected.length} selected
            </span>

            {selectedArtists && selectedArtists.length >= 1 && (
              <button
                onClick={() => setShowArtistSelection(false)}
                className="text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-full hover:bg-zinc-800 transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>

        {/* Search bar */}
        <div className="mt-4 relative flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              id="artist-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search artists..."
              className="w-full pl-11 pr-10 py-3.5 bg-[#161619] rounded-2xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 transition-all shadow-inner"
              autoFocus
            />
            {isSearchingOnline && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid of Artists */}
      <div className="w-full max-w-6xl mx-auto px-6 flex-1 overflow-y-auto py-4">
        {displayArtists.length === 0 && !isSearchingOnline ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-zinc-400 mb-2">No artist found matching "{searchQuery}"</p>
            <p className="text-xs text-zinc-500">Try typing another artist name</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
            {displayArtists.map((artist) => {
              const isSelected = selected.includes(artist.name);
              return (
                <div
                  key={artist.id || artist.name}
                  id={`artist-item-${String(artist.id || artist.name).replace(/\s+/g, '-')}`}
                  onClick={() => toggleArtist(artist.name)}
                  className={`group relative flex flex-col items-center p-3 rounded-2xl hover:bg-white/5 transition-all cursor-pointer select-none ${
                    isSelected ? 'text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {/* Circular Avatar */}
                  <div className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden mb-3 bg-zinc-800 shrink-0 shadow-md transition-all ${
                    isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0d0d0f]' : ''
                  }`}>
                    <img
                      src={artist.image || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80'}
                      alt={artist.name}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80';
                      }}
                      className={`w-full h-full object-cover transition-transform duration-300 ${
                        isSelected ? 'scale-105 brightness-110' : 'group-hover:scale-105'
                      }`}
                    />
                    {/* Checkmark or Hover-Remove overlay */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-black/40 group-hover:bg-red-950/70 flex items-center justify-center transition-colors">
                        <div className="w-8 h-8 rounded-full bg-white text-black group-hover:bg-red-500 group-hover:text-white flex items-center justify-center shadow-lg transition-colors">
                          <Check className="w-4 h-4 stroke-[3] group-hover:hidden" />
                          <X className="w-4 h-4 stroke-[3] hidden group-hover:block" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  <div className="text-center w-full min-w-0">
                    <p
                      className={`text-sm font-semibold truncate ${
                        isSelected ? 'text-white' : 'text-zinc-200 group-hover:text-white'
                      }`}
                      title={artist.name}
                    >
                      {artist.name}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer bar */}
      <div className="w-full bg-[#0e0e11] px-6 py-5 shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">
              {isComplete
                ? `Ready to generate your personal mixes (${selected.length} selected)`
                : `Please select at least 1 artist to continue`}
            </span>
          </div>

          <button
            id="artist-selection-continue-btn"
            onClick={handleContinue}
            disabled={!isComplete || isSaving}
            className={`px-8 py-3.5 rounded-2xl text-xs font-semibold tracking-wide transition-all shadow-xl flex items-center gap-2 ${
              isComplete
                ? 'bg-white text-black hover:bg-zinc-200 active:scale-95 cursor-pointer'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Continue</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

