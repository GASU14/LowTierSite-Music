import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ViewType, AlbumDetail, ArtistDetail, DailyMixItem } from '../types';

interface NavigationContextType {
  currentView: ViewType;
  setView: (view: ViewType) => void;
  selectedArtistName: string | null;
  selectedArtistId: string | number | null;
  selectedAlbumId: string | number | null;
  selectedAlbumData: AlbumDetail | null;
  selectedMix: DailyMixItem | null;
  openArtist: (artistName: string, artistId?: string | number) => void;
  openAlbum: (albumId: string | number, albumData?: AlbumDetail) => void;
  openMix: (mix: DailyMixItem) => void;
  goBack: () => void;
  canGoBack: boolean;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [history, setHistory] = useState<Array<{
    view: ViewType;
    artistName?: string | null;
    artistId?: string | number | null;
    albumId?: string | number | null;
    albumData?: AlbumDetail | null;
    mix?: DailyMixItem | null;
  }>>([{ view: 'home' }]);

  const [selectedArtistName, setSelectedArtistName] = useState<string | null>(null);
  const [selectedArtistId, setSelectedArtistId] = useState<string | number | null>(null);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | number | null>(null);
  const [selectedAlbumData, setSelectedAlbumData] = useState<AlbumDetail | null>(null);
  const [selectedMix, setSelectedMix] = useState<DailyMixItem | null>(null);

  const pushState = (newView: ViewType, data: {
    artistName?: string | null;
    artistId?: string | number | null;
    albumId?: string | number | null;
    albumData?: AlbumDetail | null;
    mix?: DailyMixItem | null;
  }) => {
    setCurrentView(newView);
    setSelectedArtistName(data.artistName ?? null);
    setSelectedArtistId(data.artistId ?? null);
    setSelectedAlbumId(data.albumId ?? null);
    setSelectedAlbumData(data.albumData ?? null);
    setSelectedMix(data.mix ?? null);
    setHistory((prev) => [...prev, { view: newView, ...data }]);
  };

  const setView = (view: ViewType) => {
    pushState(view, {});
  };

  const openArtist = (artistName: string, artistId?: string | number) => {
    pushState('artist', {
      artistName,
      artistId: artistId ?? null,
    });
  };

  const openAlbum = (albumId: string | number, albumData?: AlbumDetail) => {
    pushState('album', {
      albumId,
      albumData: albumData ?? null,
    });
  };

  const openMix = (mix: DailyMixItem) => {
    pushState('mix', {
      mix,
    });
  };

  const goBack = () => {
    if (history.length > 1) {
      const newHistory = [...history];
      newHistory.pop(); // remove current
      const prev = newHistory[newHistory.length - 1];
      setHistory(newHistory);
      setCurrentView(prev.view);
      setSelectedArtistName(prev.artistName ?? null);
      setSelectedArtistId(prev.artistId ?? null);
      setSelectedAlbumId(prev.albumId ?? null);
      setSelectedAlbumData(prev.albumData ?? null);
      setSelectedMix(prev.mix ?? null);
    } else {
      setCurrentView('home');
    }
  };

  return (
    <NavigationContext.Provider
      value={{
        currentView,
        setView,
        selectedArtistName,
        selectedArtistId,
        selectedAlbumId,
        selectedAlbumData,
        selectedMix,
        openArtist,
        openAlbum,
        openMix,
        goBack,
        canGoBack: history.length > 1,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
}
