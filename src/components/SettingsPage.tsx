import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme, THEME_COLOR_CONFIGS, AppThemeColor } from '../context/ThemeContext';
import {
  User,
  Palette,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Check,
  CheckCircle2,
  Sliders,
} from 'lucide-react';
import { ProfilePage } from './ProfilePage';

export const SettingsPage: React.FC = () => {
  const { user, userProfile } = useAuth();
  const {
    themeColor,
    setThemeColor,
    lyricProviders,
    moveLyricProvider,
    toggleLyricProvider,
  } = useTheme();

  // Accordion state: 'account' | 'playback' | 'appearance' | null
  const [expandedSection, setExpandedSection] = useState<'account' | 'playback' | 'appearance' | null>('playback');
  const [savedMsg, setSavedMsg] = useState('');

  const toggleSection = (section: 'account' | 'playback' | 'appearance') => {
    setExpandedSection((prev) => (prev === section ? null : section));
  };

  const showToast = (msg: string) => {
    setSavedMsg(msg);
    setTimeout(() => setSavedMsg(''), 1800);
  };

  const handleSelectTheme = (color: AppThemeColor) => {
    setThemeColor(color);
    showToast(`Theme updated to ${THEME_COLOR_CONFIGS[color].name}`);
  };

  return (
    <div id="settings-page" className="flex flex-col gap-6 max-w-3xl pb-32 animate-in fade-in duration-200 select-none">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Settings</h2>
      </div>

      {savedMsg && (
        <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-zinc-800 text-white text-xs shadow-lg animate-in fade-in duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{savedMsg}</span>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {/* TAB 1: ACCOUNT */}
        <div
          id="settings-account-section"
          className="rounded-3xl bg-[#141417] shadow-xl overflow-hidden transition-all duration-200"
        >
          <button
            onClick={() => toggleSection('account')}
            className="w-full flex items-center justify-between p-6 text-left hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center font-bold text-sm shrink-0 shadow-md">
                {userProfile?.username ? (
                  userProfile.username.slice(0, 2).toUpperCase()
                ) : (
                  <User className="w-5 h-5 text-black" />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-white truncate">Account</h3>
                <p className="text-xs text-zinc-400 truncate mt-0.5">
                  {user ? `@${userProfile?.username || 'user'} • ${user.email}` : 'Sign in to sync your library across devices'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="w-8 h-8 rounded-full bg-zinc-800/80 flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
                {expandedSection === 'account' ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </div>
          </button>

          {expandedSection === 'account' && (
            <div className="px-6 pb-6 pt-2 border-t border-zinc-800/60 animate-in fade-in slide-in-from-top-2 duration-200">
              <ProfilePage />
            </div>
          )}
        </div>

        {/* TAB 2: PLAYBACK */}
        <div
          id="settings-playback-section"
          className="rounded-3xl bg-[#141417] shadow-xl overflow-hidden transition-all duration-200"
        >
          <button
            onClick={() => toggleSection('playback')}
            className="w-full flex items-center justify-between p-6 text-left hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center text-white shrink-0 shadow-md">
                <Sliders className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-white truncate">Playback</h3>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="w-8 h-8 rounded-full bg-zinc-800/80 flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
                {expandedSection === 'playback' ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </div>
          </button>

          {expandedSection === 'playback' && (
            <div className="px-6 pb-6 pt-4 border-t border-zinc-800/60 flex flex-col gap-6 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Lyric Providers */}
              <div>
                <h4 className="text-sm font-bold text-white mb-2">Lyric Providers</h4>
                <div className="flex flex-col gap-2.5">
                  {lyricProviders.map((prov, index) => (
                    <div
                      key={prov.id}
                      className={`flex items-center justify-between p-3.5 rounded-2xl transition-all ${
                        prov.enabled ? 'bg-zinc-900/90' : 'bg-zinc-900/40 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-7 h-7 rounded-xl bg-zinc-800 text-zinc-300 flex items-center justify-center text-xs font-bold shrink-0">
                          #{index + 1}
                        </div>
                        <span className="text-sm font-bold text-white truncate">{prov.name}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Move Up */}
                        <button
                          disabled={index === 0}
                          onClick={() => moveLyricProvider(index, 'up')}
                          className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                          title="Move up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>

                        {/* Move Down */}
                        <button
                          disabled={index === lyricProviders.length - 1}
                          onClick={() => moveLyricProvider(index, 'down')}
                          className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                          title="Move down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>

                        {/* Toggle On/Off */}
                        <button
                          onClick={() => toggleLyricProvider(prov.id)}
                          className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ml-1 ${
                            prov.enabled ? 'bg-white justify-end' : 'bg-zinc-800 justify-start'
                          }`}
                          title={prov.enabled ? 'Enabled' : 'Disabled'}
                        >
                          <div
                            className={`w-4 h-4 rounded-full transition-colors ${
                              prov.enabled ? 'bg-black' : 'bg-zinc-500'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* TAB 3: APPEARANCE */}
        <div
          id="settings-appearance-section"
          className="rounded-3xl bg-[#141417] shadow-xl overflow-hidden transition-all duration-200"
        >
          <button
            onClick={() => toggleSection('appearance')}
            className="w-full flex items-center justify-between p-6 text-left hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center text-white shrink-0 shadow-md">
                <Palette className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-white truncate">Appearance</h3>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="w-8 h-8 rounded-full bg-zinc-800/80 flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
                {expandedSection === 'appearance' ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </div>
          </button>

          {expandedSection === 'appearance' && (
            <div className="px-6 pb-6 pt-4 border-t border-zinc-800/60 flex flex-col gap-6 animate-in fade-in slide-in-from-top-2 duration-200">
              <div>
                <h4 className="text-sm font-bold text-white mb-2">Theme Color</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(Object.keys(THEME_COLOR_CONFIGS) as AppThemeColor[]).map((col) => {
                    const conf = THEME_COLOR_CONFIGS[col];
                    const isSelected = themeColor === col;
                    return (
                      <button
                        key={col}
                        onClick={() => handleSelectTheme(col)}
                        className={`flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all ${
                          isSelected
                            ? 'bg-zinc-800 ring-2 ring-white shadow-lg scale-[1.02]'
                            : 'bg-zinc-900/80 hover:bg-zinc-800/60'
                        }`}
                      >
                        <div
                          className="w-7 h-7 rounded-xl shrink-0 flex items-center justify-center shadow-md"
                          style={{ backgroundColor: conf.primaryHex }}
                        >
                          {isSelected && (
                            <Check
                              className={`w-4 h-4 stroke-[3] ${
                                col === 'white' || col === 'amber' || col === 'emerald' || col === 'cyan'
                                  ? 'text-black'
                                  : 'text-white'
                              }`}
                            />
                          )}
                        </div>
                        <span className="text-xs font-bold text-white truncate">{conf.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
