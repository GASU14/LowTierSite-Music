import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AudioProvider } from './context/AudioContext';
import { NavigationProvider, useNavigation } from './context/NavigationContext';
import { Sidebar } from './components/Sidebar';
import { HomePage } from './components/HomePage';
import { LibraryPage } from './components/LibraryPage';
import { AlbumsPage } from './components/AlbumsPage';
import { ProfilePage } from './components/ProfilePage';
import { SettingsPage } from './components/SettingsPage';
import { ArtistView } from './components/ArtistView';
import { AlbumView } from './components/AlbumView';
import { DailyMixView } from './components/DailyMixView';
import { MiniPlayer } from './components/MiniPlayer';
import { NormalPlayer } from './components/NormalPlayer';
import { ArtistSelectionModal } from './components/ArtistSelectionModal';
import { AuthModal } from './components/AuthModal';
import { Home, Library, Settings } from 'lucide-react';

function AppContent() {
  const { currentView, setView } = useNavigation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#09090b] text-[#f4f4f5]">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex h-full">
        <Sidebar
          currentView={currentView}
          onViewChange={setView}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed((prev) => !prev)}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Scrollable Main View */}
        <main className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 max-w-7xl w-full mx-auto">
          {currentView === 'home' && <HomePage />}
          {currentView === 'library' && <LibraryPage />}
          {currentView === 'albums' && <AlbumsPage />}
          {currentView === 'profile' && <ProfilePage />}
          {currentView === 'settings' && <SettingsPage />}
          {currentView === 'artist' && <ArtistView />}
          {currentView === 'album' && <AlbumView />}
          {currentView === 'mix' && <DailyMixView />}
        </main>

        {/* Bottom Mini Player */}
        <MiniPlayer />

        {/* Normal Player with video/ambient blend */}
        <NormalPlayer />

        {/* Artist Selection Modal */}
        <ArtistSelectionModal />

        {/* Mandatory Auth Modal (Sign Up / Sign In First) */}
        <AuthModal />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AudioProvider>
          <NavigationProvider>
            <AppContent />
          </NavigationProvider>
        </AudioProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
