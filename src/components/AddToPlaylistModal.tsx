import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Track } from '../types';
import { Plus, Check, ListMusic, X } from 'lucide-react';

interface AddToPlaylistModalProps {
  track: Track | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  track,
  isOpen,
  onClose,
}) => {
  const { playlists, createPlaylist, addTrackToPlaylist, removeTrackFromPlaylist } = useAuth();
  const [newTitle, setNewTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  if (!isOpen || !track) return null;

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const pl = await createPlaylist(newTitle.trim());
    await addTrackToPlaylist(pl.id, track);
    setNewTitle('');
    setIsCreating(false);
  };

  const toggleTrackInPlaylist = async (playlistId: string, isIn: boolean) => {
    if (isIn) {
      await removeTrackFromPlaylist(playlistId, track.id);
    } else {
      await addTrackToPlaylist(playlistId, track);
    }
  };

  return (
    <div
      id="add-to-playlist-modal-overlay"
      className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="add-to-playlist-modal"
        className="w-full max-w-md bg-[#121215] rounded-3xl p-6 shadow-2xl space-y-5 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-zinc-800 flex items-center justify-center text-white">
              <ListMusic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Add to Playlist</h3>
              <p className="text-xs text-zinc-400 truncate max-w-[240px]">
                {track.title} • {track.artist}
              </p>
            </div>
          </div>
          <button
            id="close-add-to-playlist-btn"
            onClick={onClose}
            className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Existing Playlists */}
        <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
          {playlists.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-400">
              No playlists created yet. Create one below!
            </div>
          ) : (
            playlists.map((pl) => {
              const isIn = pl.tracks.some((t) => t.id === track.id);
              return (
                <div
                  key={pl.id}
                  id={`playlist-option-${pl.id}`}
                  onClick={() => toggleTrackInPlaylist(pl.id, isIn)}
                  className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all ${
                    isIn ? 'bg-zinc-800/80 text-white' : 'bg-[#18181b]/60 hover:bg-[#202024] text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                      {pl.coverArt ? (
                        <img
                          src={pl.coverArt}
                          alt={pl.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ListMusic className="w-4 h-4 text-zinc-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate text-white">{pl.title}</p>
                      <p className="text-[11px] text-zinc-400 truncate">
                        {pl.tracks.length} track{pl.tracks.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all ${
                      isIn ? 'bg-white text-black font-bold' : 'bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    {isIn ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Plus className="w-3.5 h-3.5" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Create new playlist input / button */}
        {isCreating ? (
          <form onSubmit={handleCreateAndAdd} className="pt-2 space-y-3">
            <input
              type="text"
              id="new-playlist-title-input"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Playlist name..."
              className="w-full px-4 py-2.5 bg-zinc-800/80 rounded-2xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-white"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newTitle.trim()}
                className="px-5 py-2 bg-white text-black text-xs font-semibold rounded-xl hover:bg-zinc-200 transition-colors disabled:opacity-50"
              >
                Create & Add
              </button>
            </div>
          </form>
        ) : (
          <button
            id="open-create-playlist-btn"
            onClick={() => setIsCreating(true)}
            className="w-full py-3 rounded-2xl bg-zinc-800/50 hover:bg-zinc-800 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Playlist</span>
          </button>
        )}
      </div>
    </div>
  );
};
