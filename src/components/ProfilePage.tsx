import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAudio } from '../context/AudioContext';
import {
  User,
  LogIn,
  UserPlus,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const {
    user,
    userProfile,
    signIn,
    signUp,
    signOut,
    loading: authLoading,
    openArtistSelection,
    selectedArtists,
  } = useAuth();
  const { savedTracks, history } = useAudio();

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      if (authMode === 'signup') {
        if (!username.trim()) throw new Error('Please choose a username');
        if (!email.trim()) throw new Error('Please enter your email');
        if (password.length < 6) throw new Error('Password must be at least 6 characters');
        await signUp(username.trim(), email.trim(), password);
        setSuccess('Account created.');
      } else {
        if (!username.trim()) throw new Error('Please enter your username or email');
        if (!password) throw new Error('Please enter your password');
        await signIn(username.trim(), password);
        setSuccess('Signed in.');
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setSuccess('Signed out.');
      setTimeout(() => setSuccess(null), 2500);
    } catch (err: any) {
      setError(err.message || 'Failed to sign out');
    }
  };

  return (
    <div id="profile-page" className="flex flex-col gap-6 max-w-xl pb-28 animate-in fade-in duration-200 select-none">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Account</h2>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-950/40 text-red-300 text-xs shadow-md">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-zinc-800 text-white text-xs shadow-md">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />
          <span>{success}</span>
        </div>
      )}

      {!user ? (
        /* Sign In / Sign Up Form (No borders) */
        <div className="flex flex-col gap-6 p-6 sm:p-8 rounded-3xl bg-[#141417] shadow-xl">
          {/* Mode Switcher */}
          <div className="flex p-1 bg-zinc-800/80 rounded-2xl shadow-inner">
            <button
              id="tab-signin"
              onClick={() => {
                setAuthMode('signin');
                setError(null);
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                authMode === 'signin'
                  ? 'bg-white text-black shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              id="tab-signup"
              onClick={() => {
                setAuthMode('signup');
                setError(null);
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                authMode === 'signup'
                  ? 'bg-white text-black shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">
                {authMode === 'signup' ? 'Username' : 'Username or Email'}
              </label>
              <input
                type="text"
                required
                placeholder={authMode === 'signup' ? 'username' : 'username or email'}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-800/90 rounded-2xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-white transition-colors"
              />
            </div>

            {authMode === 'signup' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-300">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800/90 rounded-2xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-white transition-colors"
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-800/90 rounded-2xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-white transition-colors"
              />
              {authMode === 'signup' && (
                <span className="text-[11px] text-zinc-500">Minimum 6 characters</span>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || authLoading}
              className="mt-2 w-full py-3.5 bg-white text-black font-bold text-xs rounded-2xl hover:bg-zinc-200 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading...</span>
                </>
              ) : authMode === 'signup' ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Create Account</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>
        </div>
      ) : (
        /* Authenticated Profile View (No borders) */
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between p-6 rounded-3xl bg-[#141417] shadow-xl">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center font-bold text-lg shadow-md">
                {userProfile?.username ? userProfile.username.slice(0, 2).toUpperCase() : 'YT'}
              </div>
              <div className="flex flex-col">
                <h3 className="text-base font-bold text-white tracking-tight">
                  @{userProfile?.username || (user.email ? user.email.split('@')[0] : 'Account')}
                </h3>
                <p className="text-xs text-zinc-400">{user.email}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors shadow-md"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>

          {/* Stats */}
          <div className="p-6 rounded-3xl bg-[#141417] shadow-xl flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-zinc-800/80 shadow-sm">
                <p className="text-[11px] font-medium text-zinc-400">Plays</p>
                <p className="text-lg font-bold text-white mt-1">
                  {userProfile?.taste?.totalListens || history.length}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-zinc-800/80 shadow-sm">
                <p className="text-[11px] font-medium text-zinc-400">Saved</p>
                <p className="text-lg font-bold text-white mt-1">
                  {userProfile?.savedTracks?.length ?? savedTracks.length}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-zinc-800/80 shadow-sm">
                <p className="text-[11px] font-medium text-zinc-400">Artists</p>
                <p className="text-lg font-bold text-white mt-1">
                  {selectedArtists?.length || 0}
                </p>
              </div>
            </div>

            {/* Selected Artists */}
            <div className="pt-2 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-zinc-200">Selected Artists</p>
                <p className="text-[11px] text-zinc-400">
                  {selectedArtists?.length ? `${selectedArtists.length} chosen` : 'None selected'}
                </p>
              </div>
              <button
                onClick={openArtistSelection}
                className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white rounded-xl transition-colors shadow-md"
              >
                Change
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
