import React from 'react';
import {
  BookOpen,
  CheckCircle2,
  Code2,
  Database,
  Layers,
  Lock,
  ShieldCheck,
  Target,
  Users
} from 'lucide-react';

interface AboutProjectViewProps {
  onOpenSetupGuide: () => void;
  onStartCitizenDemo: () => void;
  onStartAdminDemo: () => void;
}

export const AboutProjectView: React.FC<AboutProjectViewProps> = ({
  onOpenSetupGuide,
  onStartCitizenDemo,
  onStartAdminDemo
}) => {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-teal-700">
          <BookOpen className="w-4 h-4" />
          <span>Individual College Software Engineering Project Documentation</span>
          <span aria-hidden="true">·</span>
          <span>Academic Demonstration System</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          UrbanFix: Civic Service Complaint Management Platform
        </h1>

        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
          <div className="text-xs font-semibold text-slate-700">Project Problem Statement</div>
          <p className="text-sm sm:text-base font-medium text-slate-900 italic">
            "To observe service-related challenges in urban areas and demonstrate a very basic
            system for enhancement."
          </p>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed">
          <strong>Academic Disclaimer:</strong> UrbanFix is an educational software engineering
          prototype built for academic evaluation and college viva demonstration. It uses realistic
          fictional Indian ward and locality examples and is not affiliated with any actual
          municipal corporation or government authority.
        </p>
      </div>

      {/* Problem Analysis & Project Objectives */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Target className="w-4 h-4 text-teal-700 shrink-0" />
            <span>01. Observed Urban Service Challenges</span>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Rapidly growing urban neighborhoods frequently experience localized civic maintenance
            gaps—such as waterlogged potholes, leaking distribution valves, secondary garbage bin
            overflow, dark streetlights, and silted stormwater drains. Traditional paper or phone
            reporting lacks reference tracking, clear departmental ownership, and status
            transparency.
          </p>
          <ul className="space-y-1.5 text-xs text-slate-600 pt-1">
            <li>· Lack of unique tracking identifiers for citizen follow-up</li>
            <li>· Ambiguous routing between roads, water, electrical, and waste wings</li>
            <li>· No automated visibility into overdue complaints exceeding 72 hours</li>
          </ul>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Layers className="w-4 h-4 text-teal-700 shrink-0" />
            <span>02. Proposed System Enhancement</span>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            UrbanFix introduces a structured digital workflow connecting citizens and municipal
            administrators around a relational PostgreSQL schema with Row-Level Security (RLS) and
            an immutable status audit log.
          </p>
          <ul className="space-y-1.5 text-xs text-slate-600 pt-1">
            <li>· Structured intake with ward locality, landmark, and optional photo evidence</li>
            <li>
              · Human-readable reference generation (<code className="font-mono">UF-2026-XXXX</code>)
            </li>
            <li>
              · Nodal officer console with department assignment, SLA overdue alerts, and live
              analytics
            </li>
          </ul>
        </div>
      </div>

      {/* Database & Security Architecture */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-teal-700" />
              <span>System Workflow & Data Isolation Design</span>
            </h2>
            <p className="text-xs text-slate-500">
              Structured around citizen profiles, tracked complaints, and chronological status history
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/60 space-y-2">
            <div className="font-mono font-bold text-slate-900">1. public.profiles</div>
            <p className="text-slate-600 leading-relaxed">
              Stores <code className="font-mono">id</code> (FK to <code className="font-mono">auth.users</code>),{' '}
              <code className="font-mono">name</code>, <code className="font-mono">email</code>,{' '}
              <code className="font-mono">role</code> (<code className="font-mono">'citizen'</code>{' '}
              | <code className="font-mono">'admin'</code>), and{' '}
              <code className="font-mono">created_at</code>. A <code className="font-mono">SECURITY DEFINER</code>{' '}
              trigger forces all public sign-ups to <code className="font-mono">role = 'citizen'</code>.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/60 space-y-2">
            <div className="font-mono font-bold text-slate-900">2. public.complaints</div>
            <p className="text-slate-600 leading-relaxed">
              Stores <code className="font-mono">id</code>, unique{' '}
              <code className="font-mono">reference_number</code>,{' '}
              <code className="font-mono">owner_user_id</code>,{' '}
              <code className="font-mono">category</code>, <code className="font-mono">title</code>,{' '}
              <code className="font-mono">description</code>,{' '}
              <code className="font-mono">locality</code>,{' '}
              <code className="font-mono">landmark</code>,{' '}
              <code className="font-mono">image_path</code>,{' '}
              <code className="font-mono">department</code>, and{' '}
              <code className="font-mono">status</code>.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/60 space-y-2">
            <div className="font-mono font-bold text-slate-900">3. public.status_history</div>
            <p className="text-slate-600 leading-relaxed">
              Immutable audit log recording <code className="font-mono">complaint_id</code>,{' '}
              <code className="font-mono">previous_status</code>,{' '}
              <code className="font-mono">new_status</code>,{' '}
              <code className="font-mono">actor_id</code>, official note, and{' '}
              <code className="font-mono">timestamp</code>. Ordinary users cannot forge history
              entries.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="flex items-start gap-2.5 text-xs text-slate-600">
            <Lock className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
            <span>
              <strong>Citizen Data Isolation:</strong> RLS ensures authenticated citizens can only
              query and view complaints where <code className="font-mono">owner_user_id = auth.uid()</code>.
            </span>
          </div>
          <div className="flex items-start gap-2.5 text-xs text-slate-600">
            <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
            <span>
              <strong>Privileged Admin Mutations:</strong> Status transitions and department
              assignments execute through <code className="font-mono">admin_update_complaint()</code>,
              verifying <code className="font-mono">public.is_admin()</code>.
            </span>
          </div>
        </div>
      </div>

      {/* Technology Stack & Benefits */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Code2 className="w-4 h-4 text-teal-700" />
            <span>Technology Stack</span>
          </h2>
          <div className="space-y-2.5 text-xs text-slate-600">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="font-semibold text-slate-800">Frontend UI</span>
              <span>React 19 + TypeScript + Vite</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="font-semibold text-slate-800">Styling & Layout</span>
              <span>Tailwind CSS + Responsive Data Grids</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="font-semibold text-slate-800">Backend & Auth</span>
              <span>Supabase PostgreSQL + Supabase Auth</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="font-semibold text-slate-800">Evidence Storage</span>
              <span>Supabase Private Storage Bucket (complaint-images)</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-700" />
            <span>Interactive College Viva Walkthrough</span>
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            During your project presentation, you can demonstrate both the Citizen workflow and the
            Municipal Administrator workflow in seconds:
          </p>
          <div className="space-y-2 text-xs text-slate-700">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-700 shrink-0" />
              <span>1. Log a new complaint as Citizen & copy its UF-2026-XXXX reference</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-700 shrink-0" />
              <span>2. Switch to Admin Console, assign a department, and update status</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-700 shrink-0" />
              <span>3. Verify the updated status timeline & live Analytics charts</span>
            </div>
          </div>
          <div className="pt-2 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onStartCitizenDemo}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer"
            >
              Launch Citizen Portal
            </button>
            <button
              type="button"
              onClick={onStartAdminDemo}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Launch Admin Console
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
