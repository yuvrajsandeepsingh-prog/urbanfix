import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Lock, Mail, ShieldCheck, User, UserCheck } from 'lucide-react';
import { Profile } from '../types/urbanfix';
import { signInUser, signUpCitizen, switchDemoSessionRole } from '../lib/dataService';
import { DEMO_CITIZEN_PROFILE } from '../lib/seedData';

interface AuthViewProps {
  isDemoMode: boolean;
  initialMode?: 'signin' | 'signup';
  onAuthSuccess: (profile: Profile) => void;
  onBackToLanding?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({
  isDemoMode,
  initialMode = 'signin',
  onAuthSuccess,
  onBackToLanding
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
    setErrorMsg(null);
    setInfoMsg(null);
  }, [initialMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        const profile = await signInUser(email, password);
        onAuthSuccess(profile);
      } else {
        const { profile, requiresEmailConfirmation } = await signUpCitizen(name, email, password);
        if (requiresEmailConfirmation) {
          setInfoMsg(
            'Account created! Please check your email inbox to confirm your address before signing in.'
          );
          setMode('signin');
        } else {
          onAuthSuccess(profile);
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = (target: 'citizen' | 'admin') => {
    setErrorMsg(null);
    const profile = switchDemoSessionRole(target);
    if (profile) {
      onAuthSuccess(profile);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4.5rem)] flex flex-col justify-center max-w-md mx-auto px-4 py-12">
      {onBackToLanding && (
        <div className="mb-5">
          <button
            type="button"
            onClick={onBackToLanding}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to UrbanFix</span>
          </button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6 shadow-xs">
        {/* Mode Switcher */}
        <div className="space-y-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'signin'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'signup'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign Up
            </button>
          </div>

          <div className="pt-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {mode === 'signin' ? 'Welcome back to UrbanFix' : 'Create your Citizen Account'}
            </h1>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {mode === 'signin'
                ? 'Sign in to report civic issues, track progress, or manage assigned municipal cases.'
                : 'Join your neighborhood in reporting urban problems and tracking verified resolutions.'}
            </p>
          </div>
        </div>

        {/* Role Governance Notice */}
        <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" />
            <span>Verified Citizen Registration</span>
          </div>
          <p className="leading-relaxed">
            Public sign-up creates a protected <strong>Citizen</strong> account so your submitted
            reports remain private to you and authorized municipal officers.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 leading-relaxed">
            {errorMsg}
          </div>
        )}

        {infoMsg && (
          <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <span>{infoMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {mode === 'signup' && (
            <div>
              <label
                htmlFor="auth-full-name"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-full-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Ananya Sharma"
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="auth-email"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="citizen@example.org.in"
                className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Password (minimum 6 characters)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="auth-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
          >
            {loading
              ? 'Authenticating...'
              : mode === 'signin'
              ? 'Sign In'
              : 'Create Citizen Account'}
          </button>
        </form>

        {/* Clean Preview Accounts when running in Demo Mode (zero backend/env jargon exposed) */}
        {isDemoMode && (
          <div className="pt-5 border-t border-slate-200 space-y-3">
            <div className="text-xs font-semibold text-slate-800">
              Interactive Demonstration Accounts
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Explore the citizen reporting experience or municipal officer workspace using the
              labelled demonstration profiles:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('citizen')}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5 text-teal-700" />
                <span>Citizen ({DEMO_CITIZEN_PROFILE.name.split(' ')[0]})</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('admin')}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                <span>Municipal Officer</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
