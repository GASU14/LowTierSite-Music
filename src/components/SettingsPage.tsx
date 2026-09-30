import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAudio } from '../context/AudioContext';
import {
  User,
  Video,
  Trash2,
  CheckCircle2,
  Users,
  ChevronRight,
  Sliders,
} from 'lucide-react';
import { ProfilePage } from './ProfilePage';

export const SettingsPage: React.FC = () => {
  const { user, userProfile, updateUserSettings, openArtistSelection, selectedArtists } = useAuth();
  const { isVideoMode, setIsVideoMode } = useAudio();
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const preferVideo = userProfile?.settings?.preferVideo ?? isVideoMode;
  const ambientLighting = userProfile?.settings?.ambientLighting ?? true;

  const handleToggleVideo = async () => {
    const newVal = !preferVideo;
    setIsVideoMode(newVal);
    await updateUserSettings({ preferVideo: newVal });
    setSavedMsg('Settings saved');
    setTimeout(() => setSavedMsg(''), 1500);
  };

  const handleToggleAmbient = async () => {
    const newVal = !ambientLighting;
    await updateUserSettings({ ambientLighting: newVal });
    setSavedMsg('Settings saved');
    setTimeout(() => setSavedMsg(''), 1500);
  };

  const handleClearHistory = () => {
    if (confirm('Clear playback history?')) {
      localStorage.removeItem('music_history');
      window.location.reload();
    }
  };

  return (
    <div id="settings-page" className="flex flex-col gap-6 max-w-2xl pb-28 animate-in fade-in duration-200 select-none">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Settings</h2>
      </div>

      {savedMsg && (
        <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-zinc-800 text-white text-xs shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{savedMsg}</span>
        </div>
      )}

      {/* Account Section (No borders) */}
      <div className="flex flex-col gap-4 p-6 rounded-3xl bg-[#141417] shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center font-bold text-sm shrink-0 shadow-md">
              {userProfile?.username ? userProfile.username.slice(0, 2).toUpperCase() : <User className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white truncate">
                {userProfile?.username ? `@${userProfile.username}` : 'Not Signed In'}
              </h3>
              <p className="text-xs text-zinc-400 truncate">
                {user ? user.email : 'Sign in or create an account'}
              </p>
            </div>
          </div>

          <button
            id="open-account-settings-btn"
            onClick={() => setShowAccountModal(!showAccountModal)}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-2xl text-xs font-semibold text-white transition-colors shadow-md"
          >
            {user ? (showAccountModal ? 'Hide Details' : 'Account Details') : 'Sign In'}
          </button>
        </div>

        {showAccountModal && (
          <div className="mt-4 pt-2">
            <ProfilePage />
          </div>
        )}
      </div>

      {/* Playback Preferences (No borders) */}
      <div className="flex flex-col gap-4 p-6 rounded-3xl bg-[#141417] shadow-xl">
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          <Sliders className="w-4 h-4 text-zinc-400" />
          <span>Playback & Audio</span>
        </h4>

        <div className="space-y-4 text-xs">
          {/* Video mode */}
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-semibold text-white">Music Video Mode</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                Play video streams in the player automatically when available
              </p>
            </div>
            <button
              id="toggle-prefer-video-btn"
              onClick={handleToggleVideo}
              className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                preferVideo ? 'bg-white justify-end' : 'bg-zinc-800 justify-start'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full transition-colors ${
                  preferVideo ? 'bg-black' : 'bg-zinc-500'
                }`}
              />
            </button>
          </div>

          {/* Ambient Glow */}
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-semibold text-white">Ambient Glow</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                Subtle lighting adapting to album artwork in player
              </p>
            </div>
            <button
              id="toggle-ambient-lighting-btn"
              onClick={handleToggleAmbient}
              className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                ambientLighting ? 'bg-white justify-end' : 'bg-zinc-800 justify-start'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full transition-colors ${
                  ambientLighting ? 'bg-black' : 'bg-zinc-500'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Storage & Data (No borders) */}
      <div className="flex flex-col gap-4 p-6 rounded-3xl bg-[#141417] shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Playback History</p>
            <p className="text-xs text-zinc-400 mt-0.5">Clear local session listening history</p>
          </div>
          <button
            onClick={handleClearHistory}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 hover:text-white transition-colors shadow-md"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        </div>
      </div>
    </div>
  );
};
