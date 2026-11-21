import React, { useState } from 'react';
import { Check, Copy, Database, KeyRound, ShieldAlert, Terminal, X } from 'lucide-react';
import {
  isSupabaseConfigured,
  SUPABASE_SQL_SCHEMA,
  supabaseConfigDiagnostics
} from '../lib/supabase';

interface SupabaseSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseSetupModal: React.FC<SupabaseSetupModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback if clipboard blocked
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="supabase-setup-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-lg">
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-teal-700 shrink-0" />
            <h2 id="supabase-setup-title" className="text-base font-semibold text-slate-900">
              Supabase PostgreSQL, Auth & Row-Level Security Setup Guide
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors"
            aria-label="Close setup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* Connection Status Summary */}
          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-slate-900">
                Current Runtime Connection Status:
              </span>
              <span
                className={`text-xs font-medium ${
                  isSupabaseConfigured ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {isSupabaseConfigured
                  ? 'Connected to Live Supabase Backend'
                  : 'Running in Interactive Demo Mode (Missing Environment Credentials)'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 font-mono">
              <span>
                VITE_SUPABASE_URL: {supabaseConfigDiagnostics.hasUrl ? 'Configured' : 'Missing'}
              </span>
              <span>·</span>
              <span>
                VITE_SUPABASE_PUBLISHABLE_KEY:{' '}
                {supabaseConfigDiagnostics.hasPublishableKey ? 'Configured' : 'Missing'}
              </span>
            </div>
          </div>

          {/* 3-Step Instructions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border border-slate-200 space-y-1.5">
              <div className="text-xs font-semibold text-teal-700">01. Create Supabase Project</div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Open your Supabase Dashboard, create a project, and navigate to{' '}
                <strong>Project Settings → API</strong> to copy your Project URL and Publishable{' '}
                (<code className="font-mono">anon</code>) key.
              </p>
            </div>

            <div className="p-4 rounded-lg border border-slate-200 space-y-1.5">
              <div className="text-xs font-semibold text-teal-700">
                02. Configure Environment Variables
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Add <code className="font-mono">VITE_SUPABASE_URL</code> and{' '}
                <code className="font-mono">VITE_SUPABASE_PUBLISHABLE_KEY</code> to your{' '}
                <code className="font-mono">.env</code> file. Never expose{' '}
                <code className="font-mono">service_role</code> keys in client code.
              </p>
            </div>

            <div className="p-4 rounded-lg border border-slate-200 space-y-1.5">
              <div className="text-xs font-semibold text-teal-700">
                03. Run SQL Schema & Promote Admin
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Paste the SQL script below into the Supabase <strong>SQL Editor</strong>. Public
                sign-ups always default to <code className="font-mono">role = 'citizen'</code>.
                Promote an admin in SQL via{' '}
                <code className="font-mono">
                  UPDATE profiles SET role='admin' WHERE email='...'
                </code>
                .
              </p>
            </div>
          </div>

          {/* Security Highlights */}
          <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
              <ShieldAlert className="w-4 h-4 text-teal-700" />
              <span>Enforced Database Security Architecture</span>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 list-disc list-inside">
              <li>
                <strong>Anti-Privilege Escalation:</strong> Auth trigger forces{' '}
                <code className="font-mono">role = 'citizen'</code> on all public registrations.
              </li>
              <li>
                <strong>Citizen Privacy (RLS):</strong> Citizens can only <code className="font-mono">SELECT</code>{' '}
                and <code className="font-mono">INSERT</code> their own complaints.
              </li>
              <li>
                <strong>Unforgeable Audit Trail:</strong> <code className="font-mono">status_history</code>{' '}
                is written exclusively via <code className="font-mono">SECURITY DEFINER</code> triggers/RPC.
              </li>
              <li>
                <strong>Private Evidence Storage:</strong> Bucket{' '}
                <code className="font-mono">complaint-images</code> restricts folder access to the
                owner UID or verified admins.
              </li>
            </ul>
          </div>

          {/* Complete SQL Script */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                <Terminal className="w-4 h-4 text-teal-700" />
                <span>Complete PostgreSQL Schema, Triggers & RLS Script</span>
              </div>
              <button
                type="button"
                onClick={handleCopySql}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied SQL Script</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy SQL Schema</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto max-h-72 leading-relaxed">
              {SUPABASE_SQL_SCHEMA}
            </pre>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-teal-700" />
            <span>Zero secrets exposed in browser bundle</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-900 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
