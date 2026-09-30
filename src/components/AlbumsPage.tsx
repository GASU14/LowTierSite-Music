import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useNavigation } from '../context/NavigationContext';
import { Track } from '../types';
import { searchItunes } from '../services/api';

interface AlbumGroup {
  album: string;
  artist: string;
  artwork: string;
  tracks: Track[];
}

export const AlbumsPage: React.FC = () => {
  const { openAlbum } = useNavigation();
  const [albums, setAlbums] = useState<AlbumGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchAlbums = async () => {
      setIsLoading(true);
      try {
        const results = await searchItunes('album', 40);
        const map = new Map<string, AlbumGroup>();

        for (const t of results) {
          const key = `${t.album}-${t.artist}`;
          if (!map.has(key)) {
            map.set(key, {
              album: t.album,
              artist: t.artist,
              artwork: t.artworkLarge || t.artworkSmall,
              tracks: [t],
            });
          } else {
            map.get(key)!.tracks.push(t);
          }
        }

        setAlbums(Array.from(map.values()));
      } catch (err) {
        console.error("Failed to fetch albums:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAlbums();
  }, []);

  return (
    <div id="albums-page" className="flex flex-col gap-6 pb-28 select-none animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white tracking-tight">Albums</h2>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
          <span className="text-xs">Loading albums...</span>
        </div>
      ) : (
        /* Albums Grid (No play buttons on cards) */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {albums.map((albumItem, idx) => (
            <div
              key={`${albumItem.album}-${idx}`}
              onClick={() =>
                openAlbum(albumItem.album, {
                  id: albumItem.album,
                  title: albumItem.album,
                  artist: albumItem.artist,
                  artwork: albumItem.artwork,
                  artworkLarge: albumItem.artwork,
                  tracks: albumItem.tracks,
                })
              }
              className="group flex flex-col gap-3 p-3.5 rounded-3xl bg-[#141417] hover:bg-[#1a1a1e] transition-all cursor-pointer shadow-lg"
            >
              <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-zinc-800 shadow-md">
                <img
                  src={albumItem.artwork}
                  alt={albumItem.album}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>

              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-white truncate group-hover:underline">
                  {albumItem.album}
                </span>
                <span className="text-xs text-zinc-400 truncate mt-0.5">
                  {albumItem.artist}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
