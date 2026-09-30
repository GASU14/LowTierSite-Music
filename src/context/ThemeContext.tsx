import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';

export type AppThemeColor = 'white' | 'violet' | 'indigo' | 'rose' | 'amber' | 'emerald' | 'cyan' | 'red';

export interface LyricProviderConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export const THEME_COLOR_CONFIGS: Record<
  AppThemeColor,
  {
    name: string;
    primaryHex: string;
    rgb: string;
    bgAccent: string;
    textAccent: string;
    borderAccent: string;
    buttonText: string;
    gradient: string;
  }
> = {
  white: {
    name: 'White',
    primaryHex: '#ffffff',
    rgb: '255, 255, 255',
    bgAccent: 'bg-white',
    textAccent: 'text-white',
    borderAccent: 'border-white',
    buttonText: 'text-black',
    gradient: 'from-zinc-100 to-zinc-400',
  },
  violet: {
    name: 'Violet',
    primaryHex: '#8b5cf6',
    rgb: '139, 92, 246',
    bgAccent: 'bg-violet-600',
    textAccent: 'text-violet-400',
    borderAccent: 'border-violet-500',
    buttonText: 'text-white',
    gradient: 'from-violet-500 to-purple-700',
  },
  indigo: {
    name: 'Indigo',
    primaryHex: '#6366f1',
    rgb: '99, 102, 241',
    bgAccent: 'bg-indigo-600',
    textAccent: 'text-indigo-400',
    borderAccent: 'border-indigo-500',
    buttonText: 'text-white',
    gradient: 'from-indigo-500 to-blue-700',
  },
  rose: {
    name: 'Rose',
    primaryHex: '#f43f5e',
    rgb: '244, 63, 94',
    bgAccent: 'bg-rose-600',
    textAccent: 'text-rose-400',
    borderAccent: 'border-rose-500',
    buttonText: 'text-white',
    gradient: 'from-rose-500 to-pink-700',
  },
  amber: {
    name: 'Amber',
    primaryHex: '#f59e0b',
    rgb: '245, 158, 11',
    bgAccent: 'bg-amber-500',
    textAccent: 'text-amber-400',
    borderAccent: 'border-amber-500',
    buttonText: 'text-black',
    gradient: 'from-amber-400 to-orange-600',
  },
  emerald: {
    name: 'Emerald',
    primaryHex: '#10b981',
    rgb: '16, 185, 129',
    bgAccent: 'bg-emerald-600',
    textAccent: 'text-emerald-400',
    borderAccent: 'border-emerald-500',
    buttonText: 'text-black',
    gradient: 'from-emerald-400 to-teal-700',
  },
  cyan: {
    name: 'Cyan',
    primaryHex: '#06b6d4',
    rgb: '6, 182, 212',
    bgAccent: 'bg-cyan-500',
    textAccent: 'text-cyan-400',
    borderAccent: 'border-cyan-500',
    buttonText: 'text-black',
    gradient: 'from-cyan-400 to-blue-600',
  },
  red: {
    name: 'Red',
    primaryHex: '#ef4444',
    rgb: '239, 68, 68',
    bgAccent: 'bg-red-600',
    textAccent: 'text-red-400',
    borderAccent: 'border-red-500',
    buttonText: 'text-white',
    gradient: 'from-red-500 to-rose-700',
  },
};

export const DEFAULT_LYRIC_PROVIDERS: LyricProviderConfig[] = [
  {
    id: 'lyricsplus',
    name: 'LyricsPlus',
    description: 'Synced karaoke verses and crowd-validated timestamps',
    enabled: true,
  },
  {
    id: 'betterlyrics',
    name: 'BetterLyrics',
    description: 'Enhanced word-by-word synchronizations and translations',
    enabled: true,
  },
  {
    id: 'lrclib',
    name: 'LRCLIB',
    description: 'Direct high-precision community synchronized LRC lyrics',
    enabled: true,
  },
  {
    id: 'musixmatch',
    name: 'Musixmatch',
    description: 'Global catalogue of synchronized audio tracks and verses',
    enabled: true,
  },
];

interface ThemeContextType {
  themeColor: AppThemeColor;
  setThemeColor: (color: AppThemeColor) => void;
  themeConfig: typeof THEME_COLOR_CONFIGS[AppThemeColor];
  lyricProviders: LyricProviderConfig[];
  setLyricProviders: (providers: LyricProviderConfig[]) => void;
  moveLyricProvider: (index: number, direction: 'up' | 'down') => void;
  toggleLyricProvider: (id: string) => void;
  lyricSyncStep: number;
  setLyricSyncStep: (step: number) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userProfile } = useAuth();

  const [themeColor, setThemeColorState] = useState<AppThemeColor>(() => {
    try {
      const stored = localStorage.getItem('app_theme_color');
      if (stored && (stored === 'zinc' || stored === 'white')) return 'white';
      if (stored && stored in THEME_COLOR_CONFIGS) {
        return stored as AppThemeColor;
      }
    } catch {}
    return 'white';
  });

  const [lyricProviders, setLyricProvidersState] = useState<LyricProviderConfig[]>(() => {
    try {
      const stored = localStorage.getItem('app_lyric_providers_v2');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (
          Array.isArray(parsed) &&
          parsed.length > 0 &&
          parsed.every((p) => ['lyricsplus', 'betterlyrics', 'lrclib', 'musixmatch'].includes(p.id))
        ) {
          return parsed;
        }
      }
    } catch {}
    return DEFAULT_LYRIC_PROVIDERS;
  });

  const [lyricSyncStep, setLyricSyncStepState] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('app_lyric_sync_step');
      if (stored) {
        const parsed = parseFloat(stored);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    } catch {}
    return 0.5;
  });

  const applyThemeToDOM = (col: AppThemeColor) => {
    try {
      const config = THEME_COLOR_CONFIGS[col] || THEME_COLOR_CONFIGS.white;
      document.documentElement.style.setProperty('--theme-accent', config.primaryHex);
      document.documentElement.style.setProperty('--theme-accent-rgb', config.rgb);
      document.documentElement.setAttribute('data-theme', col);
    } catch {}
  };

  // Sync settings updates to Firestore user account
  const syncToCloud = async (updates: Record<string, any>) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, updates);
    } catch (err) {
      console.warn("Could not sync setting to account cloud:", err);
    }
  };

  // Synchronize state when userProfile changes
  useEffect(() => {
    if (userProfile) {
      if (userProfile.themeColor && userProfile.themeColor in THEME_COLOR_CONFIGS && userProfile.themeColor !== themeColor) {
        const col = userProfile.themeColor as AppThemeColor;
        setThemeColorState(col);
        applyThemeToDOM(col);
      }
      if (userProfile.lyricProviders && Array.isArray(userProfile.lyricProviders) && userProfile.lyricProviders.length > 0) {
        setLyricProvidersState(userProfile.lyricProviders);
      }
      if (typeof userProfile.lyricSyncStep === 'number' && userProfile.lyricSyncStep > 0 && userProfile.lyricSyncStep !== lyricSyncStep) {
        setLyricSyncStepState(userProfile.lyricSyncStep);
      }
    }
  }, [userProfile?.themeColor, userProfile?.lyricProviders, userProfile?.lyricSyncStep]);

  const setThemeColor = (color: AppThemeColor) => {
    setThemeColorState(color);
    try {
      localStorage.setItem('app_theme_color', color);
      applyThemeToDOM(color);
    } catch {}
    syncToCloud({ themeColor: color });
  };

  useEffect(() => {
    applyThemeToDOM(themeColor);
  }, [themeColor]);

  const setLyricProviders = (providers: LyricProviderConfig[]) => {
    setLyricProvidersState(providers);
    try {
      localStorage.setItem('app_lyric_providers_v2', JSON.stringify(providers));
    } catch {}
    syncToCloud({ lyricProviders: providers });
  };

  const setLyricSyncStep = (step: number) => {
    const validStep = Math.max(0.01, Math.min(10, Math.round(step * 100) / 100));
    setLyricSyncStepState(validStep);
    try {
      localStorage.setItem('app_lyric_sync_step', String(validStep));
    } catch {}
    syncToCloud({ lyricSyncStep: validStep });
  };

  const moveLyricProvider = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === lyricProviders.length - 1) return;

    const newIdx = direction === 'up' ? index - 1 : index + 1;
    const updated = [...lyricProviders];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIdx, 0, moved);
    setLyricProviders(updated);
  };

  const toggleLyricProvider = (id: string) => {
    const updated = lyricProviders.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p));
    setLyricProviders(updated);
  };

  return (
    <ThemeContext.Provider
      value={{
        themeColor,
        setThemeColor,
        themeConfig: THEME_COLOR_CONFIGS[themeColor] || THEME_COLOR_CONFIGS.white,
        lyricProviders,
        setLyricProviders,
        moveLyricProvider,
        toggleLyricProvider,
        lyricSyncStep,
        setLyricSyncStep,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
