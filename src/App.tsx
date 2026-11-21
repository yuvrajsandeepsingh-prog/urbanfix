import React, { useCallback, useEffect, useState } from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';
import {
  AdminUpdateComplaintInput,
  Complaint,
  ComplaintCategory,
  CreateComplaintInput,
  Profile,
  PublicMapIssue,
  StatusHistoryEntry
} from './types/urbanfix';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import {
  adminUpdateComplaintCategory,
  adminUpdateComplaintStatus,
  createCitizenComplaint,
  fetchComplaintsForUser,
  getCurrentProfile,
  resetDemoDataset,
  signOutUser,
  switchDemoSessionRole
} from './lib/dataService';
import { loadPriorityWeights, PriorityWeights } from './lib/priorityEngine';
import { LandingView } from './components/LandingView';
import { AuthView } from './components/AuthView';
import { CitizenDashboard } from './components/CitizenDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { AboutProjectView } from './components/AboutProjectView';
import { ComplaintDetailModal } from './components/ComplaintDetailModal';

type ActiveRoute = 'landing' | 'citizen' | 'admin' | 'about' | 'auth';

export function App() {
  const [route, setRoute] = useState<ActiveRoute>('landing');
  const [authInitialMode, setAuthInitialMode] = useState<'signin' | 'signup'>('signin');
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [nearbyMapIssues, setNearbyMapIssues] = useState<PublicMapIssue[]>([]);
  const [historyByComplaintId, setHistoryByComplaintId] = useState<
    Record<string, StatusHistoryEntry[]>
  >({});
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [preselectedCategory, setPreselectedCategory] = useState<ComplaintCategory | null>(null);
  const [isScrolled, setIsScrolled] = useState<boolean>(false);

  // Modal state for complaint inspection
  const [inspectedComplaint, setInspectedComplaint] = useState<Complaint | null>(null);
  const [inspectedHistory, setInspectedHistory] = useState<StatusHistoryEntry[]>([]);
  const [priorityWeights, setPriorityWeights] = useState<PriorityWeights>(() =>
    loadPriorityWeights()
  );

  const isDemoMode = !isSupabaseConfigured;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 32);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const refreshData = useCallback(async (profileToUse: Profile | null) => {
    setLoadingData(true);
    try {
      const {
        complaints: userComplaints,
        historyByComplaintId: historyMap,
        nearbyMapIssues: mapIssues
      } = await fetchComplaintsForUser(profileToUse);
      setComplaints(userComplaints);
      setNearbyMapIssues(mapIssues);
      setHistoryByComplaintId(historyMap);
    } catch {
      // Preserve current state on transient error
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    getCurrentProfile().then((prof) => {
      if (!mounted) return;
      setCurrentUser(prof);
      refreshData(prof);
    });

    if (isSupabaseConfigured && supabase) {
      const {
        data: { subscription }
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!session) {
          setCurrentUser(null);
          refreshData(null);
        } else {
          getCurrentProfile().then((prof) => {
            setCurrentUser(prof);
            refreshData(prof);
          });
        }
      });
      return () => subscription.unsubscribe();
    }

    return () => {
      mounted = false;
    };
  }, [refreshData]);

  const navigateTo = (nextRoute: ActiveRoute) => {
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const openSignIn = () => {
    if (currentUser) {
      navigateTo(currentUser.role === 'admin' ? 'admin' : 'citizen');
      return;
    }
    setAuthInitialMode('signin');
    navigateTo('auth');
  };

  const openSignUp = () => {
    if (currentUser) {
      navigateTo(currentUser.role === 'admin' ? 'admin' : 'citizen');
      return;
    }
    setAuthInitialMode('signup');
    navigateTo('auth');
  };

  const handleAuthSuccess = async (profile: Profile) => {
    setCurrentUser(profile);
    await refreshData(profile);
    navigateTo(profile.role === 'admin' ? 'admin' : 'citizen');
  };

  const handleSignOut = async () => {
    await signOutUser();
    setCurrentUser(null);
    await refreshData(null);
    navigateTo('landing');
  };

  const handleCreateComplaint = async (input: CreateComplaintInput): Promise<Complaint> => {
    if (!currentUser) {
      throw new Error('Please sign in to submit a complaint.');
    }
    const created = await createCitizenComplaint(currentUser, input);
    await refreshData(currentUser);
    return created;
  };

  const handleAdminUpdate = async (input: AdminUpdateComplaintInput): Promise<void> => {
    if (!currentUser || currentUser.role !== 'admin') {
      throw new Error('Only municipal administrators can perform this action.');
    }
    const updated = await adminUpdateComplaintStatus(currentUser, input);
    await refreshData(currentUser);
    setInspectedComplaint(updated);

    const freshData = await fetchComplaintsForUser(currentUser);
    setInspectedHistory(freshData.historyByComplaintId[updated.id] || []);
  };

  const handleAdminCategoryUpdate = async (input: {
    complaintId: string;
    newCategory: ComplaintCategory;
    rationaleNote?: string;
  }): Promise<void> => {
    if (!currentUser || currentUser.role !== 'admin') {
      throw new Error('Only municipal administrators can reclassify complaint categories.');
    }
    const updated = await adminUpdateComplaintCategory(currentUser, input);
    await refreshData(currentUser);
    setInspectedComplaint(updated);

    const freshData = await fetchComplaintsForUser(currentUser);
    setInspectedHistory(freshData.historyByComplaintId[updated.id] || []);
  };

  const handleResetDemo = async () => {
    resetDemoDataset();
    await refreshData(currentUser);
  };

  const handleSwitchDemoRole = async (target: 'citizen' | 'admin') => {
    const nextProf = switchDemoSessionRole(target);
    setCurrentUser(nextProf);
    await refreshData(nextProf);
    navigateTo(target === 'admin' ? 'admin' : 'citizen');
  };

  const isLandingRoute = route === 'landing';
  const isCitizenWorkspace = route === 'citizen' && Boolean(currentUser);
  const isAdminWorkspace = route === 'admin' && currentUser?.role === 'admin';
  const isSidebarWorkspace = isCitizenWorkspace || isAdminWorkspace;

  return (
    <div
      className={`min-h-screen flex flex-col ${
        isSidebarWorkspace ? 'bg-[#F4F3EF] text-[#25272B]' : 'bg-[#F8FAFC] text-[#0F172A]'
      }`}
    >
      {/* =====================================================================
          HEADER
          - Public Landing Page: Minimal floating header with ONLY UrbanFix wordmark
            on the left and Sign In / Sign Up actions at the top-right.
          - Citizen & Admin Workspaces: Use their dedicated Graphite sidebar shells.
          - Other Authenticated/Auth Routes: Clean role-based workspace header.
      ===================================================================== */}
      {isSidebarWorkspace ? null : isLandingRoute ? (
        <header
          className={`fixed top-0 left-0 right-0 z-40 px-6 sm:px-10 lg:px-16 h-16 flex items-center justify-between gap-8 transition-all duration-300 ${
            isScrolled
              ? 'bg-[#07101E]/85 backdrop-blur-md border-b border-white/10'
              : 'bg-transparent border-b border-transparent'
          }`}
        >
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            UrbanFix
          </a>

          <div className="flex items-center gap-3 sm:gap-5 shrink-0">
            {currentUser ? (
              <>
                <button
                  type="button"
                  onClick={() => navigateTo(currentUser.role === 'admin' ? 'admin' : 'citizen')}
                  className="text-xs sm:text-sm font-medium text-slate-200 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Open Workspace
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="px-4 py-2 text-xs font-semibold text-slate-950 bg-teal-400 hover:bg-teal-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={openSignIn}
                  className="text-xs sm:text-sm font-medium text-slate-200 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={openSignUp}
                  className="px-4 py-2 text-xs font-semibold text-slate-950 bg-teal-400 hover:bg-teal-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Sign Up
                </button>
              </>
            )}
          </div>
        </header>
      ) : (
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#home"
            onClick={(e) => {
              e.preventDefault();
              navigateTo('landing');
            }}
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            UrbanFix
          </a>

          {currentUser ? (
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
              {currentUser.role === 'admin' ? (
                <>
                  <a
                    href="#admin-console"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateTo('admin');
                    }}
                    className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                      route === 'admin'
                        ? 'text-teal-700 font-semibold underline underline-offset-8'
                        : ''
                    }`}
                  >
                    Admin Console
                  </a>
                  <a
                    href="#about-project"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateTo('about');
                    }}
                    className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                      route === 'about'
                        ? 'text-teal-700 font-semibold underline underline-offset-8'
                        : ''
                    }`}
                  >
                    About Project
                  </a>
                </>
              ) : (
                <span className="text-sm font-semibold text-slate-800">
                  Citizen Portal
                </span>
              )}
            </nav>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3 shrink-0">
            {currentUser ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-600" />
                <span>Sign Out ({currentUser.name.split(' ')[0]})</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={openSignIn}
                  className={`text-xs font-semibold px-3 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    authInitialMode === 'signin'
                      ? 'text-teal-700'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={openSignUp}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Sign Up
                </button>
              </>
            )}
          </div>
        </header>
      )}

      {/* MAIN VIEWPORT */}
      <div className="flex-1">
        {route === 'landing' && (
          <LandingView
            onGetStarted={openSignUp}
            onSignIn={openSignIn}
            onInspectComplaint={(complaint, history) => {
              setInspectedComplaint(complaint);
              setInspectedHistory(history);
            }}
          />
        )}

        {route === 'auth' && (
          <AuthView
            isDemoMode={isDemoMode}
            initialMode={authInitialMode}
            onAuthSuccess={handleAuthSuccess}
            onBackToLanding={() => navigateTo('landing')}
          />
        )}

        {route === 'citizen' &&
          (currentUser ? (
            <CitizenDashboard
              currentUser={currentUser}
              complaints={complaints}
              nearbyMapIssues={nearbyMapIssues}
              historyByComplaintId={historyByComplaintId}
              loading={loadingData}
              isDemoMode={isDemoMode}
              preselectedCategory={preselectedCategory}
              onClearPreselectedCategory={() => setPreselectedCategory(null)}
              onCreateComplaint={handleCreateComplaint}
              onSelectComplaint={(complaint, history) => {
                setInspectedComplaint(complaint);
                setInspectedHistory(history);
              }}
              onSignOut={handleSignOut}
              onNavigateLanding={() => navigateTo('landing')}
            />
          ) : (
            <AuthView
              isDemoMode={isDemoMode}
              initialMode="signin"
              onAuthSuccess={handleAuthSuccess}
              onBackToLanding={() => navigateTo('landing')}
            />
          ))}

        {route === 'admin' &&
          (currentUser?.role === 'admin' ? (
            <AdminDashboard
              currentUser={currentUser}
              complaints={complaints}
              historyByComplaintId={historyByComplaintId}
              loading={loadingData}
              isDemoMode={isDemoMode}
              onSelectComplaint={(complaint, history) => {
                setInspectedComplaint(complaint);
                setInspectedHistory(history);
              }}
              onResetDemoData={handleResetDemo}
              onSignOut={handleSignOut}
              onNavigateLanding={() => navigateTo('landing')}
              onNavigateAbout={() => navigateTo('about')}
              priorityWeights={priorityWeights}
              onChangePriorityWeights={setPriorityWeights}
            />
          ) : (
            <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-4">
                <ShieldCheck className="w-10 h-10 text-teal-700 mx-auto" />
                <h2 className="text-lg font-bold text-slate-900">
                  Administrator Authorization Required
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  The Municipal Administrator Console is restricted to authorized municipal officer
                  accounts. Citizens can access their own private complaints from the Citizen
                  Portal.
                </p>
                {isDemoMode ? (
                  <button
                    type="button"
                    onClick={() => handleSwitchDemoRole('admin')}
                    className="px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  >
                    Enter Demo Municipal Officer Console
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={openSignIn}
                    className="px-4 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer"
                  >
                    Sign In with Officer Account
                  </button>
                )}
              </div>
            </div>
          ))}

        {route === 'about' && (
          <AboutProjectView
            onOpenSetupGuide={() => navigateTo('citizen')}
            onStartCitizenDemo={() => handleSwitchDemoRole('citizen')}
            onStartAdminDemo={() => handleSwitchDemoRole('admin')}
          />
        )}
      </div>

      {/* Footer for Non-Landing & Non-Sidebar Views */}
      {!isLandingRoute && !isSidebarWorkspace && (
        <footer className="bg-white border-t border-slate-200 py-6 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-slate-500">
            <div className="space-y-0.5">
              <div className="font-display font-bold text-slate-900">UrbanFix</div>
              <p>
                {route === 'citizen' || currentUser?.role === 'citizen'
                  ? 'Neighborhood Civic Service & Issue Tracking Portal.'
                  : 'Civic Service Complaint Management Platform.'}
              </p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <button
                type="button"
                onClick={() => navigateTo('landing')}
                className="hover:text-slate-900 transition-colors cursor-pointer"
              >
                Home
              </button>
              {currentUser?.role === 'admin' && route !== 'citizen' && (
                <>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => navigateTo('about')}
                    className="hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    About Project
                  </button>
                </>
              )}
            </div>
          </div>
        </footer>
      )}

      {/* Complaint Inspection Modal */}
      <ComplaintDetailModal
        complaint={inspectedComplaint}
        history={inspectedHistory}
        currentUser={currentUser}
        isDemoMode={isDemoMode}
        onClose={() => setInspectedComplaint(null)}
        onAdminUpdate={currentUser?.role === 'admin' ? handleAdminUpdate : undefined}
        allComplaints={currentUser?.role === 'admin' ? complaints : undefined}
        priorityWeights={priorityWeights}
        onAdminCategoryUpdate={
          currentUser?.role === 'admin' ? handleAdminCategoryUpdate : undefined
        }
        onSelectRelatedComplaint={
          currentUser?.role === 'admin'
            ? (relComplaint) => {
                setInspectedComplaint(relComplaint);
                setInspectedHistory(historyByComplaintId[relComplaint.id] || []);
              }
            : undefined
        }
      />
    </div>
  );
}

export default App;
