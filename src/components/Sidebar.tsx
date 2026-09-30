import React, { useState } from 'react';
import { Home, Library, Settings, Link as LinkIcon, PanelLeftClose, PanelLeftOpen, User } from 'lucide-react';
import { ViewType } from '../types';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onViewChange,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const { playDirectUrl, isGrabbing } = useAudio();
  const { user, userProfile } = useAuth();
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    await playDirectUrl(urlInput.trim());
    setUrlInput('');
    setShowUrlInput(false);
  };

  const navItems = [
    { id: 'home' as ViewType, label: 'Home', icon: Home },
    { id: 'library' as ViewType, label: 'Library', icon: Library },
    { id: 'settings' as ViewType, label: 'Settings', icon: Settings },
  ];

  return (
    <aside
      id="main-sidebar"
      className={`${
        isCollapsed ? 'w-20 px-3' : 'w-64 px-5'
      } shrink-0 flex flex-col justify-between py-6 bg-[#0e0e11] select-none transition-all duration-200 ease-in-out`}
    >
      {/* Top Section */}
      <div className="flex flex-col gap-6">
        {/* Brand Header */}
        <div id="brand-header" className="flex items-center justify-between px-2 py-1">
          {!isCollapsed && (
            <span className="text-xl font-black tracking-tight text-white select-none">
              YTIFY
            </span>
          )}

          {onToggleCollapse && (
            <button
              id="sidebar-collapse-btn"
              onClick={onToggleCollapse}
              className={`p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors ${
                isCollapsed ? 'mx-auto' : ''
              }`}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* Navigation Menu (No borders) */}
        <nav id="nav-menu" className="flex flex-col gap-1.5" aria-label="Main Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                id={`nav-item-${item.id}`}
                onClick={() => onViewChange(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`flex items-center ${
                  isCollapsed ? 'justify-center px-0 py-3' : 'gap-3.5 px-4 py-3'
                } rounded-2xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-white text-black shadow-md'
                    : 'text-zinc-400 hover:text-white hover:bg-[#18181c]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section (No divider border) */}
      <div className="flex flex-col gap-3 pt-4">
        {/* Quick User Badge */}
        {!isCollapsed && (
          <button
            onClick={() => onViewChange('settings')}
            className="flex items-center gap-3 p-2.5 rounded-2xl bg-[#151518] hover:bg-[#1e1e24] transition-colors text-left shadow-sm"
          >
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300 shrink-0 font-bold text-xs uppercase">
              {userProfile?.username ? userProfile.username.slice(0, 2) : <User className="w-4 h-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">
                {userProfile?.username ? `@${userProfile.username}` : (user ? 'Account' : 'Sign In')}
              </p>
              <p className="text-[10px] text-zinc-400 truncate">
                {userProfile?.taste?.totalListens
                  ? `${userProfile.taste.totalListens} plays`
                  : 'Settings & Profile'}
              </p>
            </div>
          </button>
        )}

        {/* Direct YouTube URL Grabber */}
        {!isCollapsed && (
          <div id="sidebar-yt-grabber">
            {!showUrlInput ? (
              <button
                id="open-yt-grabber-btn"
                onClick={() => setShowUrlInput(true)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-[#18181c] transition-colors"
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>Play YouTube URL</span>
              </button>
            ) : (
              <form onSubmit={handleUrlSubmit} className="flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="Paste YouTube Link..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#16161a] rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
                  autoFocus
                />
                <div className="flex gap-1.5">
                  <button
                    type="submit"
                    disabled={isGrabbing}
                    className="flex-1 py-1.5 bg-white text-black text-xs font-bold rounded-xl hover:bg-zinc-200 transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {isGrabbing ? 'Loading...' : 'Play'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowUrlInput(false)}
                    className="px-2.5 py-1.5 text-xs text-zinc-400 hover:text-white rounded-xl bg-zinc-800"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
