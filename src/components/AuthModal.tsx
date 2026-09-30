import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, UserPlus, Disc, AlertCircle, Loader2, Sparkles } from 'lucide-react';

export const AuthModal: React.FC = () => {
  const { user, loading, signIn, signUp } = useAuth();
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // If auth state is loading or user is already logged in, do not show auth modal
  if (loading || user) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (authMode === 'signup') {
        if (!username.trim()) throw new Error('Please enter a username');
        if (!email.trim()) throw new Error('Please enter your email address');
        if (password.length < 6) throw new Error('Password must be at least 6 characters');
        await signUp(username.trim(), email.trim(), password);
      } else {
        if (!username.trim()) throw new Error('Please enter your username or email');
        if (!password) throw new Error('Please enter your password');
        await signIn(username.trim(), password);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      let msg = err.message || 'Authentication failed.';
      if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password')) {
        msg = 'Invalid email/username or password.';
      } else if (msg.includes('auth/email-already-in-use')) {
        msg = 'An account with this email already exists. Try signing in instead.';
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="auth-modal-overlay"
      className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 select-none animate-in fade-in duration-300"
    >
      <div
        id="auth-modal-card"
        className="w-full max-w-md bg-[#121215] border border-zinc-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden"
      >
        {/* Subtle Ambient Accent */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-white/5 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-white text-black flex items-center justify-center mb-4 shadow-xl">
            <Disc className="w-8 h-8 animate-spin-slow" />
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
            <span>Welcome to Music</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {authMode === 'signup' ? 'Create Your Account' : 'Welcome Back'}
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs">
            {authMode === 'signup'
              ? 'Sign up to personalize your music, follow artists, and save playlists.'
              : 'Sign in to access your saved music and personalized recommendations.'}
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex p-1 bg-zinc-900/90 rounded-2xl mb-6 shadow-inner border border-zinc-800/50">
          <button
            id="auth-tab-signup"
            type="button"
            onClick={() => {
              setAuthMode('signup');
              setError(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              authMode === 'signup'
                ? 'bg-white text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Sign Up</span>
          </button>
          <button
            id="auth-tab-signin"
            type="button"
            onClick={() => {
              setAuthMode('signin');
              setError(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              authMode === 'signin'
                ? 'bg-white text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In</span>
          </button>
        </div>

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-red-950/50 border border-red-900/40 text-red-300 text-xs shadow-md">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              {authMode === 'signup' ? 'Username' : 'Username or Email'}
            </label>
            <input
              id="auth-input-username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={authMode === 'signup' ? 'e.g. alexmusic' : 'Enter username or email'}
              className="w-full px-4 py-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-white transition-colors"
            />
          </div>

          {authMode === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Email Address
              </label>
              <input
                id="auth-input-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-white transition-colors"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Password
            </label>
            <input
              id="auth-input-password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-white transition-colors"
            />
          </div>

          <button
            id="auth-submit-btn"
            type="submit"
            disabled={submitting}
            className="w-full mt-2 py-3.5 px-4 rounded-2xl bg-white text-black font-bold text-sm hover:bg-zinc-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xl disabled:opacity-50 cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{authMode === 'signup' ? 'Creating Account...' : 'Signing In...'}</span>
              </>
            ) : (
              <span>{authMode === 'signup' ? 'Continue to Choose Artists' : 'Sign In'}</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
