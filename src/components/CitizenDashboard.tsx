import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  ClipboardList,
  Clock,
  Crosshair,
  Droplets,
  FilePlus2,
  FolderOpen,
  Globe,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Map as MapIcon,
  MapPin,
  Menu,
  RotateCcw,
  Search,
  Trash2,
  Waves,
  Wrench,
  X
} from 'lucide-react';
import {
  CATEGORIES,
  CIVIC_AREAS,
  Complaint,
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
  CreateComplaintInput,
  Profile,
  PublicMapIssue,
  StatusHistoryEntry
} from '../types/urbanfix';
import { isComplaintOverdue } from '../lib/dataService';
import { MapTileStyle, NearbyIssuesMap } from './NearbyIssuesMap';

type CitizenSection = 'overview' | 'report' | 'map' | 'complaints';
type PersonalStatusFilter = 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'RESOLVED';

interface CitizenDashboardProps {
  currentUser: Profile;
  complaints: Complaint[];
  nearbyMapIssues: PublicMapIssue[];
  historyByComplaintId: Record<string, StatusHistoryEntry[]>;
  loading: boolean;
  isDemoMode: boolean;
  preselectedCategory?: ComplaintCategory | null;
  onClearPreselectedCategory?: () => void;
  onCreateComplaint: (input: CreateComplaintInput) => Promise<Complaint>;
  onSelectComplaint: (complaint: Complaint, history: StatusHistoryEntry[]) => void;
  onSignOut: () => void;
  onNavigateLanding: () => void;
}

const LOCALITY_PREF_KEY = 'urbanfix_mumbai_area_pref_v2';

const CATEGORY_ICON_MAP: Record<ComplaintCategory, React.FC<{ className?: string }>> = {
  Roads: Wrench,
  'Waste Management': Trash2,
  Drainage: Waves,
  'Water Supply': Droplets,
  Streetlights: Lightbulb
};

export const CitizenDashboard: React.FC<CitizenDashboardProps> = ({
  currentUser,
  complaints,
  nearbyMapIssues,
  historyByComplaintId,
  loading,
  isDemoMode,
  preselectedCategory,
  onClearPreselectedCategory,
  onCreateComplaint,
  onSelectComplaint,
  onSignOut,
  onNavigateLanding
}) => {
  const [activeSection, setActiveSection] = useState<CitizenSection>(
    preselectedCategory ? 'report' : 'overview'
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Manual locality selection ('ALL' or a Mumbai CivicAreaOption.id — never auto-requests GPS)
  const [selectedMapAreaId, setSelectedMapAreaId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(LOCALITY_PREF_KEY);
      if (saved && (saved === 'ALL' || CIVIC_AREAS.some((a) => a.id === saved))) {
        return saved;
      }
    } catch {
      // Ignore storage access issues
    }
    return 'ALL';
  });

  const [highlightedMapIssueId, setHighlightedMapIssueId] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<MapTileStyle>('street');

  const handleSelectMapArea = (areaId: string) => {
    setSelectedMapAreaId(areaId);
    try {
      localStorage.setItem(LOCALITY_PREF_KEY, areaId);
    } catch {
      // Ignore storage errors
    }
  };

  const handleInspectOwnIssueFromMap = (issueId: string) => {
    const matched = complaints.find((c) => c.id === issueId);
    if (matched) {
      onSelectComplaint(matched, historyByComplaintId[matched.id] || []);
    }
  };

  const selectedSidebarArea = useMemo(
    () => CIVIC_AREAS.find((a) => a.id === selectedMapAreaId) || null,
    [selectedMapAreaId]
  );

  const activeLocalityMarkerCount = useMemo(() => {
    if (!selectedSidebarArea) return nearbyMapIssues.length;
    return nearbyMapIssues.filter(
      (issue) =>
        issue.area_name.toLowerCase() === selectedSidebarArea.name.toLowerCase() ||
        issue.locality.toLowerCase().includes(selectedSidebarArea.name.toLowerCase())
    ).length;
  }, [nearbyMapIssues, selectedSidebarArea]);

  // Report an Issue form state
  const [category, setCategory] = useState<ComplaintCategory>(preselectedCategory || 'Roads');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [formAreaId, setFormAreaId] = useState<string>(CIVIC_AREAS[0].id);
  const [locality, setLocality] = useState<string>(CIVIC_AREAS[0].fullLocality);
  const [landmark, setLandmark] = useState('');
  const [priority, setPriority] = useState<ComplaintPriority>('Medium');
  const [consentedCoords, setConsentedCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [locatingConsent, setLocatingConsent] = useState(false);
  const [locationHint, setLocationHint] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [createdComplaint, setCreatedComplaint] = useState<Complaint | null>(null);

  // My Complaints personal filter state
  const [personalSearch, setPersonalSearch] = useState('');
  const [personalStatusFilter, setPersonalStatusFilter] = useState<PersonalStatusFilter>('ALL');
  const [personalCategoryFilter, setPersonalCategoryFilter] = useState<'ALL' | ComplaintCategory>(
    'ALL'
  );

  useEffect(() => {
    if (preselectedCategory) {
      setCategory(preselectedCategory);
      setActiveSection('report');
      onClearPreselectedCategory?.();
    }
  }, [preselectedCategory, onClearPreselectedCategory]);

  // Personal Complaints Statistics (derived strictly from current citizen's complaints)
  const personalStats = useMemo(() => {
    const total = complaints.length;
    const pending = complaints.filter(
      (c) => c.status === 'Submitted' || c.status === 'Reopened'
    ).length;
    const inProgress = complaints.filter((c) => c.status === 'In Progress').length;
    const resolved = complaints.filter((c) => c.status === 'Resolved').length;
    return { total, pending, inProgress, resolved };
  }, [complaints]);

  // Filtered personal complaints for "My Complaints"
  const filteredPersonalComplaints = useMemo(() => {
    return complaints.filter((c) => {
      if (
        personalStatusFilter === 'PENDING' &&
        c.status !== 'Submitted' &&
        c.status !== 'Reopened'
      ) {
        return false;
      }
      if (personalStatusFilter === 'IN_PROGRESS' && c.status !== 'In Progress') {
        return false;
      }
      if (personalStatusFilter === 'RESOLVED' && c.status !== 'Resolved') {
        return false;
      }
      if (personalCategoryFilter !== 'ALL' && c.category !== personalCategoryFilter) {
        return false;
      }
      if (personalSearch.trim()) {
        const q = personalSearch.trim().toLowerCase();
        const match =
          c.reference_number.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.locality.toLowerCase().includes(q) ||
          c.landmark.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [complaints, personalStatusFilter, personalCategoryFilter, personalSearch]);

  const switchSection = (section: CitizenSection) => {
    setActiveSection(section);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openReportWithCategory = (cat: ComplaintCategory) => {
    setCategory(cat);
    setCreatedComplaint(null);
    setFormError(null);
    setFieldErrors({});
    switchSection('report');
  };

  const handleFormAreaChange = (nextAreaId: string) => {
    setFormAreaId(nextAreaId);
    const matched = CIVIC_AREAS.find((a) => a.id === nextAreaId);
    if (matched) {
      setLocality(matched.fullLocality);
    }
  };

  // Strictly opt-in browser location capture — never triggered automatically
  const handleOptInBrowserLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocationHint('Browser geolocation is unavailable on this device. Your selected locality will be used.');
      return;
    }
    setLocatingConsent(true);
    setLocationHint(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setConsentedCoords({
          lat: Number(pos.coords.latitude.toFixed(5)),
          lng: Number(pos.coords.longitude.toFixed(5))
        });
        setLocatingConsent(false);
        setLocationHint('Coordinates attached with your permission for this session.');
      },
      () => {
        setLocatingConsent(false);
        setLocationHint(
          'Location permission was declined or unavailable. You can still submit using the Mumbai locality and landmark fields.'
        );
      },
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 60000 }
    );
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setImageFile(null);
      setImagePreview(null);
      return;
    }
    if (!file.type.startsWith('image/')) {
      setFormError('Please choose a valid image file (JPG, PNG, or WebP).');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setFormError('Attached photo must be under 4 MB.');
      return;
    }
    setFormError(null);
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(typeof reader.result === 'string' ? reader.result : null);
    };
    reader.readAsDataURL(file);
  };

  const validateReportForm = (): boolean => {
    const errors: Record<string, string> = {};
    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();
    const trimmedLoc = locality.trim();
    const trimmedLandmark = landmark.trim();

    if (trimmedTitle.length < 5) {
      errors.title = 'Enter a descriptive title of at least 5 characters.';
    } else if (trimmedTitle.length > 140) {
      errors.title = 'Keep the title under 140 characters.';
    }

    if (trimmedDesc.length < 15) {
      errors.description = 'Provide at least 15 characters describing the issue clearly.';
    }

    if (trimmedLoc.length < 3) {
      errors.locality = 'Enter the street or locality name.';
    }

    if (trimmedLandmark.length < 3) {
      errors.landmark = 'Provide a recognizable nearby landmark to assist field crews.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current || submitting) return;

    setFormError(null);
    setCreatedComplaint(null);

    if (!validateReportForm()) {
      return;
    }

    submitLockRef.current = true;
    setSubmitting(true);

    const chosenArea = CIVIC_AREAS.find((a) => a.id === formAreaId) || CIVIC_AREAS[0];

    try {
      const created = await onCreateComplaint({
        category,
        title: title.trim(),
        description: description.trim(),
        locality: locality.trim(),
        landmark: landmark.trim(),
        priority,
        areaName: chosenArea.name,
        consentedLat: consentedCoords?.lat ?? null,
        consentedLng: consentedCoords?.lng ?? null,
        imageFile,
        imagePreviewDataUrl: imagePreview
      });

      setCreatedComplaint(created);
      setHighlightedMapIssueId(created.id);
      setTitle('');
      setDescription('');
      setLandmark('');
      setPriority('Medium');
      setConsentedCoords(null);
      setLocationHint(null);
      setImageFile(null);
      setImagePreview(null);
      setFieldErrors({});
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Unable to submit your complaint right now.'
      );
    } finally {
      setSubmitting(false);
      submitLockRef.current = false;
    }
  };

  const renderStatusBadge = (status: ComplaintStatus) => {
    switch (status) {
      case 'Resolved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-[#ECF8F2] text-[#1D6F4A] border border-[#C6E9D8] whitespace-nowrap shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Resolved</span>
          </span>
        );
      case 'In Progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-[#EEF2FD] text-[#2F52C4] border border-[#CFD9FA] whitespace-nowrap shrink-0">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>In Progress</span>
          </span>
        );
      case 'Reopened':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-[#FEF0F0] text-[#B93838] border border-[#FAD2D2] whitespace-nowrap shrink-0">
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span>Reopened</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-[#FDF5EA] text-[#9A5B13] border border-[#F5DEC0] whitespace-nowrap shrink-0">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>Pending</span>
          </span>
        );
    }
  };

  const renderProgressSteps = (status: ComplaintStatus) => {
    const activeIndex = status === 'Resolved' ? 3 : status === 'In Progress' ? 2 : 1;
    const isReopened = status === 'Reopened';

    const steps = [
      { idx: 1, label: isReopened ? 'Reopened (Pending)' : 'Submitted' },
      { idx: 2, label: 'In Progress' },
      { idx: 3, label: 'Resolved' }
    ];

    return (
      <div className="grid grid-cols-3 gap-2.5">
        {steps.map((step) => {
          const reached = step.idx <= activeIndex;
          const barTone = !reached
            ? 'bg-[#E3E4E0]'
            : isReopened && step.idx === 1
            ? 'bg-[#F05B5B]'
            : status === 'Resolved'
            ? 'bg-[#2E9E6B]'
            : step.idx === 1 && status === 'Submitted'
            ? 'bg-[#E89A3C]'
            : 'bg-[#4169E1]';

          return (
            <div key={step.idx} className="space-y-1.5">
              <div className={`h-1.5 rounded-full transition-colors ${barTone}`} />
              <div
                className={`text-xs font-medium ${
                  reached ? 'text-[#25272B]' : 'text-[#70757D]'
                }`}
              >
                {step.label}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const navItems: {
    id: CitizenSection;
    label: string;
    icon: React.FC<{ className?: string }>;
    count?: number;
  }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'report', label: 'Report an Issue', icon: FilePlus2 },
    { id: 'map', label: 'Explore Issue Map', icon: MapIcon, count: nearbyMapIssues.length },
    { id: 'complaints', label: 'My Complaints', icon: ClipboardList, count: complaints.length }
  ];

  const userInitials = useMemo(() => {
    const parts = currentUser.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return currentUser.name.slice(0, 2).toUpperCase();
  }, [currentUser.name]);

  const firstName = currentUser.name.trim().split(/\s+/)[0] || currentUser.name;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F4F3EF] text-[#25272B]">
      {/* =====================================================================
          MOBILE TOP BAR (< lg) — Compact Graphite Bar within 15% Sticky Cap
      ===================================================================== */}
      <div className="lg:hidden sticky top-0 z-30 h-14 bg-[#202329] text-white px-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open navigation menu"
            className="p-2 -ml-2 text-white/85 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-display text-base font-bold tracking-tight whitespace-nowrap">
            UrbanFix
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            setCreatedComplaint(null);
            switchSection('report');
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#4169E1] hover:bg-[#3358CC] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <FilePlus2 className="w-3.5 h-3.5" />
          <span>Report Issue</span>
        </button>
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-black/55 backdrop-blur-[1px]"
          aria-hidden="true"
        />
      )}

      {/* =====================================================================
          GRAPHITE BLACK SIDEBAR (#202329)
      ===================================================================== */}
      <aside
        aria-label="Citizen Portal Navigation"
        className={`fixed lg:sticky top-0 left-0 z-50 lg:z-20 h-screen w-[272px] shrink-0 bg-[#202329] text-white flex flex-col justify-between border-r border-[#2E323B] transition-transform duration-200 ease-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-5 space-y-7 overflow-y-auto">
          {/* Brand Header */}
          <div className="flex items-center justify-between gap-2 px-2">
            <button
              type="button"
              onClick={() => switchSection('overview')}
              className="text-left group cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8EFF]"
            >
              <div className="font-display text-xl font-bold tracking-tight text-white">
                UrbanFix
              </div>
              <div className="text-xs text-[#AEB4C0] mt-0.5">Citizen Service Workspace</div>
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation menu"
              className="lg:hidden p-1.5 text-[#AEB4C0] hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Primary Action in Sidebar */}
          <div className="px-1">
            <button
              type="button"
              onClick={() => {
                setCreatedComplaint(null);
                switchSection('report');
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white bg-[#4169E1] hover:bg-[#3358CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#82A0FF] transition-colors cursor-pointer whitespace-nowrap shadow-xs"
            >
              <FilePlus2 className="w-4 h-4 shrink-0" />
              <span>Report an Issue</span>
            </button>
          </div>

          {/* Focused Civic Service Navigation (No "About Project") */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => switchSection(item.id)}
                  className={`w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8EFF] ${
                    isActive
                      ? 'bg-[#2C313A] text-white font-semibold'
                      : 'text-[#C4C9D4] hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="inline-flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-[#7DA0FF]' : 'text-[#9DA3B0]'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>

                  {typeof item.count === 'number' && (
                    <span
                      className={`text-xs font-mono tabular-nums px-2 py-0.5 rounded-md ${
                        isActive
                          ? 'bg-[#4169E1] text-white'
                          : 'bg-white/10 text-[#C4C9D4]'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Manual Map Locality Focus */}
          <div className="pt-5 border-t border-white/10 px-2 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="sidebar-mumbai-locality"
                className="block text-xs font-medium text-[#C4C9D4]"
              >
                Map Locality Focus
              </label>
              {selectedMapAreaId !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => handleSelectMapArea('ALL')}
                  className="text-xs font-semibold text-[#82A0FF] hover:text-white cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
            <select
              id="sidebar-mumbai-locality"
              value={selectedMapAreaId}
              onChange={(e) => handleSelectMapArea(e.target.value)}
              className="w-full px-3 py-2.5 text-xs font-medium bg-[#2A2E36] text-white border border-white/12 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6B8EFF] cursor-pointer"
            >
              <option value="ALL">Greater Mumbai (All Wards)</option>
              {CIVIC_AREAS.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name} ({area.ward})
                </option>
              ))}
            </select>
            <div className="text-[11px] font-mono tabular-nums text-[#AEB4C0]">
              {selectedSidebarArea
                ? `Showing ${activeLocalityMarkerCount} of ${nearbyMapIssues.length} map markers`
                : `Showing all ${nearbyMapIssues.length} map markers`}
            </div>
          </div>
        </div>

        {/* Bottom Account & Sign Out Panel */}
        <div className="p-4 border-t border-white/10 bg-[#1B1E23] space-y-3">
          <div className="flex items-center gap-3 px-1">
            <div className="w-9 h-9 rounded-full bg-[#4169E1] text-white font-display text-xs font-bold flex items-center justify-center shrink-0">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white truncate">{currentUser.name}</div>
              <div className="text-xs text-[#AEB4C0] truncate">
                {isDemoMode ? 'Citizen · Demo Mode' : currentUser.email}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={onNavigateLanding}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-[#D5D9E2] bg-white/6 hover:bg-white/12 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8EFF] transition-colors cursor-pointer whitespace-nowrap"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Public Site</span>
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-[#FCA5A5] bg-white/6 hover:bg-[#F05B5B]/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F05B5B] transition-colors cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* =====================================================================
          MAIN SPACIOUS WARM GRAY WORKSPACE (#F4F3EF)
      ===================================================================== */}
      <main className="flex-1 min-w-0">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10 py-7 lg:py-9 space-y-8">
          {/* Submission Confirmation Banner */}
          {createdComplaint && (
            <div className="bg-white border border-[#2E9E6B]/40 rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xs">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-bold text-[#1D6F4A]">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span>
                    Complaint Submitted · Reference{' '}
                    <span className="font-mono tabular-nums">
                      {createdComplaint.reference_number}
                    </span>
                  </span>
                </div>
                <p className="text-sm text-[#25272B] leading-relaxed">
                  <strong>"{createdComplaint.title}"</strong> in{' '}
                  <strong>{createdComplaint.locality}</strong> has been logged with status{' '}
                  <strong>Submitted (Pending)</strong> and synced with your personal complaint list
                  and issue map.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setHighlightedMapIssueId(createdComplaint.id);
                    switchSection('map');
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#4169E1] hover:bg-[#3358CC] transition-colors cursor-pointer whitespace-nowrap"
                >
                  Locate on Issue Map
                </button>
                <button
                  type="button"
                  onClick={() => switchSection('complaints')}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#25272B] bg-[#F4F3EF] hover:bg-[#E7E6E1] border border-[#E3E4E0] transition-colors cursor-pointer whitespace-nowrap"
                >
                  Open My Complaints
                </button>
                <button
                  type="button"
                  onClick={() => setCreatedComplaint(null)}
                  aria-label="Dismiss confirmation"
                  className="p-2 text-[#70757D] hover:text-[#25272B] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* =================================================================
              PAGE 1: OVERVIEW
          ================================================================= */}
          {activeSection === 'overview' && (
            <div className="space-y-8">
              {/* Welcome Heading & Prominent Primary Action */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#555B64]">
                    <span>Citizen Overview</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {isDemoMode
                        ? 'Demo Mode (Sample Mumbai Dataset Active)'
                        : 'Authenticated Citizen Session'}
                    </span>
                  </div>
                  <h1 className="font-display text-2xl sm:text-3xl lg:text-[34px] font-bold text-[#1F2227] tracking-tight balance-text">
                    Welcome back, {firstName}
                  </h1>
                  <p className="text-sm sm:text-base text-[#4A5058] max-w-2xl leading-relaxed">
                    Report civic infrastructure problems in your locality, follow municipal repair
                    updates on your submissions, and explore public issue reports across Mumbai.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => switchSection('map')}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-[#1F2227] bg-white hover:bg-[#FAF9F6] border border-[#DCDDD8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <MapIcon className="w-4 h-4 text-[#4169E1]" />
                    <span>Explore Issue Map</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreatedComplaint(null);
                      switchSection('report');
                    }}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white bg-[#4169E1] hover:bg-[#3358CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] focus-visible:ring-offset-1 transition-colors cursor-pointer whitespace-nowrap shadow-xs"
                  >
                    <FilePlus2 className="w-4 h-4" />
                    <span>Report an Issue</span>
                  </button>
                </div>
              </div>

              {/* Personal Citizen Summary Statistics */}
              {loading ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className="h-28 bg-white border border-[#DCDDD8] rounded-2xl animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-[#DCDDD8] rounded-2xl p-5 sm:p-6 space-y-1.5 shadow-2xs">
                    <div className="text-sm font-semibold text-[#4A5058]">My Total Reports</div>
                    <div className="text-3xl font-bold font-mono tabular-nums text-[#1F2227]">
                      {personalStats.total}
                    </div>
                    <div className="text-xs text-[#555B64]">Submitted under your account</div>
                  </div>

                  <div className="bg-white border border-[#DCDDD8] rounded-2xl p-5 sm:p-6 space-y-1.5 shadow-2xs">
                    <div className="text-sm font-semibold text-[#4A5058]">Pending</div>
                    <div className="text-3xl font-bold font-mono tabular-nums text-[#C9731A]">
                      {personalStats.pending}
                    </div>
                    <div className="text-xs text-[#555B64]">Awaiting assignment or reopened</div>
                  </div>

                  <div className="bg-white border border-[#DCDDD8] rounded-2xl p-5 sm:p-6 space-y-1.5 shadow-2xs">
                    <div className="text-sm font-semibold text-[#4A5058]">In Progress</div>
                    <div className="text-3xl font-bold font-mono tabular-nums text-[#3358CC]">
                      {personalStats.inProgress}
                    </div>
                    <div className="text-xs text-[#555B64]">Active municipal work orders</div>
                  </div>

                  <div className="bg-white border border-[#DCDDD8] rounded-2xl p-5 sm:p-6 space-y-1.5 shadow-2xs">
                    <div className="text-sm font-semibold text-[#4A5058]">Resolved</div>
                    <div className="text-3xl font-bold font-mono tabular-nums text-[#228557]">
                      {personalStats.resolved}
                    </div>
                    <div className="text-xs text-[#555B64]">Completed & verified</div>
                  </div>
                </div>
              )}

              {/* Quick Category Launchers */}
              <section className="space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-[#1F2227]">
                    Quick Report by Civic Category
                  </h2>
                  <span className="text-xs font-medium text-[#555B64]">
                    Select a category to start
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                  {CATEGORIES.map((cat) => {
                    const Icon = CATEGORY_ICON_MAP[cat.id];
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => openReportWithCategory(cat.id)}
                        className="group text-left bg-white border border-[#DCDDD8] hover:border-[#4169E1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4 transition-colors cursor-pointer shadow-2xs"
                      >
                        <div className="space-y-3">
                          <div className="w-10 h-10 rounded-xl bg-[#F4F3EF] group-hover:bg-[#EEF2FD] text-[#1F2227] group-hover:text-[#4169E1] flex items-center justify-center transition-colors">
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="space-y-1">
                            <h3 className="text-sm sm:text-base font-bold text-[#1F2227] leading-snug">
                              {cat.citizenLabel}
                            </h3>
                            <p className="text-xs text-[#555B64] line-clamp-2 leading-relaxed">
                              {cat.examples}
                            </p>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#3358CC]">
                          <span>File report</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Recent Personal Complaints Preview */}
              <section className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-[#1F2227]">
                      Recent Personal Complaints
                    </h2>
                    <p className="text-sm text-[#555B64]">
                      Latest submissions belonging strictly to your account.
                    </p>
                  </div>
                  {complaints.length > 0 && (
                    <button
                      type="button"
                      onClick={() => switchSection('complaints')}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#4169E1] hover:text-[#3358CC] cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <span>View all ({complaints.length})</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map((n) => (
                      <div
                        key={n}
                        className="h-44 bg-white border border-[#E3E4E0] rounded-2xl animate-pulse"
                      />
                    ))}
                  </div>
                ) : complaints.length === 0 ? (
                  <div className="bg-white border border-[#E3E4E0] rounded-2xl p-8 sm:p-10 text-center space-y-3">
                    <FolderOpen className="w-8 h-8 text-[#70757D] mx-auto" />
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-[#25272B]">
                        You Have Not Filed Any Complaints Yet
                      </h3>
                      <p className="text-sm text-[#70757D] max-w-md mx-auto">
                        Submit your first civic report to receive a unique tracking ID and monitor
                        departmental repair updates here.
                      </p>
                    </div>
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => switchSection('report')}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#4169E1] hover:bg-[#3358CC] transition-colors cursor-pointer"
                      >
                        <FilePlus2 className="w-4 h-4" />
                        <span>Submit First Complaint</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {complaints.slice(0, 3).map((complaint) => {
                      const history = historyByComplaintId[complaint.id] || [];
                      const catObj = CATEGORIES.find((c) => c.id === complaint.category);
                      return (
                        <article
                          key={complaint.id}
                          onClick={() => onSelectComplaint(complaint, history)}
                          className="bg-white border border-[#E3E4E0] hover:border-[#4169E1] rounded-2xl p-5 flex flex-col justify-between gap-4 transition-colors cursor-pointer"
                        >
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs font-semibold text-[#70757D] tabular-nums">
                                {complaint.reference_number}
                              </span>
                              {renderStatusBadge(complaint.status)}
                            </div>

                            <div className="space-y-1">
                              <div className="text-xs font-medium text-[#70757D]">
                                {catObj?.citizenLabel || complaint.category}
                              </div>
                              <h3 className="text-base font-bold text-[#25272B] line-clamp-2 leading-snug">
                                {complaint.title}
                              </h3>
                            </div>

                            <div className="text-xs text-[#70757D] flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-[#4169E1] shrink-0" />
                              <span className="truncate">{complaint.locality}</span>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-[#E3E4E0] flex items-center justify-between text-xs text-[#70757D]">
                            <span className="tabular-nums">
                              {new Date(complaint.created_at).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </span>
                            <span className="font-semibold text-[#4169E1]">Inspect details →</span>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Interactive Street Map Preview */}
              <section className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-[#1F2227]">
                      Reported Issues Map Preview
                    </h2>
                    <p className="text-sm text-[#555B64]">
                      Real OpenStreetMap street imagery across Mumbai wards with Street and Dark
                      styles.
                    </p>
                  </div>
                </div>

                <NearbyIssuesMap
                  issues={nearbyMapIssues}
                  selectedAreaId={selectedMapAreaId}
                  onSelectAreaId={handleSelectMapArea}
                  isDemoMode={isDemoMode}
                  loading={loading}
                  compactPreview
                  highlightedIssueId={highlightedMapIssueId}
                  mapStyle={mapStyle}
                  onChangeMapStyle={setMapStyle}
                  onExploreFullMap={(focusedIssueId) => {
                    if (focusedIssueId) {
                      setHighlightedMapIssueId(focusedIssueId);
                    }
                    switchSection('map');
                  }}
                  onInspectOwnIssue={handleInspectOwnIssueFromMap}
                />
              </section>
            </div>
          )}

          {/* =================================================================
              PAGE 2: REPORT AN ISSUE
          ================================================================= */}
          {activeSection === 'report' && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="space-y-2">
                <div className="text-xs font-medium text-[#70757D]">New Civic Service Request</div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#25272B] tracking-tight">
                  Report an Urban Infrastructure Issue
                </h1>
                <p className="text-sm sm:text-base text-[#70757D] leading-relaxed">
                  Select a civic service category, describe the issue clearly, and specify the
                  street locality and landmark so municipal crews can locate and verify it.
                </p>
              </div>

              <div className="bg-white border border-[#E3E4E0] rounded-2xl p-6 sm:p-8 space-y-6">
                {formError && (
                  <div className="p-4 rounded-xl bg-[#FEF0F0] border border-[#FAD2D2] flex items-start gap-3 text-sm text-[#992828]">
                    <AlertCircle className="w-5 h-5 text-[#F05B5B] shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                <form onSubmit={handleReportSubmit} className="space-y-6" noValidate>
                  {/* 1. Issue Category */}
                  <div className="space-y-2.5">
                    <label className="block text-sm font-bold text-[#25272B]">
                      1. Issue Category <span className="text-[#F05B5B]">*</span>
                    </label>
                    <p className="text-xs text-[#70757D]">
                      Choose the category that best matches the issue for automatic departmental
                      routing.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                      {CATEGORIES.map((cat) => {
                        const Icon = CATEGORY_ICON_MAP[cat.id];
                        const selected = category === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setCategory(cat.id)}
                            className={`p-4 rounded-xl border text-left transition-colors flex items-start gap-3 cursor-pointer ${
                              selected
                                ? 'bg-[#4169E1] text-white border-[#4169E1]'
                                : 'bg-[#FAF9F6] text-[#25272B] border-[#E3E4E0] hover:bg-white hover:border-[#C5C7C0]'
                            }`}
                          >
                            <Icon
                              className={`w-5 h-5 shrink-0 mt-0.5 ${
                                selected ? 'text-white' : 'text-[#4169E1]'
                              }`}
                            />
                            <div>
                              <div className="text-sm font-semibold leading-snug">
                                {cat.citizenLabel}
                              </div>
                              <div
                                className={`text-xs mt-1 ${
                                  selected ? 'text-white/80' : 'text-[#70757D]'
                                }`}
                              >
                                Target SLA: {cat.slaHours} hrs
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Complaint Title */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="report-title-input"
                        className="block text-sm font-bold text-[#25272B]"
                      >
                        2. Complaint Title <span className="text-[#F05B5B]">*</span>
                      </label>
                      <span className="text-xs text-[#70757D] font-mono tabular-nums">
                        {title.trim().length}/140
                      </span>
                    </div>
                    <input
                      id="report-title-input"
                      type="text"
                      required
                      maxLength={140}
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        if (fieldErrors.title) {
                          setFieldErrors((prev) => ({ ...prev, title: '' }));
                        }
                      }}
                      placeholder="e.g., Deep waterlogged pothole near Linking Road bus bay"
                      className={`w-full px-4 py-3 text-sm sm:text-base text-[#25272B] bg-[#FAF9F6] border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4169E1] ${
                        fieldErrors.title ? 'border-[#F05B5B]' : 'border-[#E3E4E0]'
                      }`}
                    />
                    {fieldErrors.title && (
                      <p className="text-xs font-medium text-[#C93B3B]">{fieldErrors.title}</p>
                    )}
                  </div>

                  {/* 3. Detailed Description */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="report-description-input"
                        className="block text-sm font-bold text-[#25272B]"
                      >
                        3. Detailed Description <span className="text-[#F05B5B]">*</span>
                      </label>
                      <span className="text-xs text-[#70757D] font-mono tabular-nums">
                        {description.trim().length} chars (min 15)
                      </span>
                    </div>
                    <textarea
                      id="report-description-input"
                      rows={4}
                      required
                      value={description}
                      onChange={(e) => {
                        setDescription(e.target.value);
                        if (fieldErrors.description) {
                          setFieldErrors((prev) => ({ ...prev, description: '' }));
                        }
                      }}
                      placeholder="Describe the severity, approximate size, duration, and any safety risk to pedestrians or commuters..."
                      className={`w-full px-4 py-3 text-sm sm:text-base text-[#25272B] bg-[#FAF9F6] border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4169E1] ${
                        fieldErrors.description ? 'border-[#F05B5B]' : 'border-[#E3E4E0]'
                      }`}
                    />
                    {fieldErrors.description && (
                      <p className="text-xs font-medium text-[#C93B3B]">
                        {fieldErrors.description}
                      </p>
                    )}
                  </div>

                  {/* 4. Area / Locality & Landmark */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label
                        htmlFor="report-area-select"
                        className="block text-sm font-bold text-[#25272B]"
                      >
                        4. Municipal Area / Ward <span className="text-[#F05B5B]">*</span>
                      </label>
                      <select
                        id="report-area-select"
                        value={formAreaId}
                        onChange={(e) => handleFormAreaChange(e.target.value)}
                        className="w-full px-4 py-3 text-sm sm:text-base text-[#25272B] bg-[#FAF9F6] border border-[#E3E4E0] rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4169E1] cursor-pointer"
                      >
                        {CIVIC_AREAS.map((area) => (
                          <option key={area.id} value={area.id}>
                            {area.name} ({area.ward})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="report-locality-input"
                        className="block text-sm font-bold text-[#25272B]"
                      >
                        Street / Locality <span className="text-[#F05B5B]">*</span>
                      </label>
                      <input
                        id="report-locality-input"
                        type="text"
                        required
                        value={locality}
                        onChange={(e) => {
                          setLocality(e.target.value);
                          if (fieldErrors.locality) {
                            setFieldErrors((prev) => ({ ...prev, locality: '' }));
                          }
                        }}
                        placeholder="e.g., Linking Road, Bandra West, H/W Ward"
                        className={`w-full px-4 py-3 text-sm sm:text-base text-[#25272B] bg-[#FAF9F6] border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4169E1] ${
                          fieldErrors.locality ? 'border-[#F05B5B]' : 'border-[#E3E4E0]'
                        }`}
                      />
                      {fieldErrors.locality && (
                        <p className="text-xs font-medium text-[#C93B3B]">{fieldErrors.locality}</p>
                      )}
                    </div>
                  </div>

                  {/* 5. Landmark & Urgency/Priority */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label
                        htmlFor="report-landmark-input"
                        className="block text-sm font-bold text-[#25272B]"
                      >
                        5. Specific Nearby Landmark <span className="text-[#F05B5B]">*</span>
                      </label>
                      <input
                        id="report-landmark-input"
                        type="text"
                        required
                        value={landmark}
                        onChange={(e) => {
                          setLandmark(e.target.value);
                          if (fieldErrors.landmark) {
                            setFieldErrors((prev) => ({ ...prev, landmark: '' }));
                          }
                        }}
                        placeholder="e.g., Opposite National College Bus Stop"
                        className={`w-full px-4 py-3 text-sm sm:text-base text-[#25272B] bg-[#FAF9F6] border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4169E1] ${
                          fieldErrors.landmark ? 'border-[#F05B5B]' : 'border-[#E3E4E0]'
                        }`}
                      />
                      {fieldErrors.landmark && (
                        <p className="text-xs font-medium text-[#C93B3B]">{fieldErrors.landmark}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <span className="block text-sm font-bold text-[#25272B]">
                        6. Severity / Priority
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        {(['Low', 'Medium', 'High'] as ComplaintPriority[]).map((level) => {
                          const active = priority === level;
                          const activeStyle =
                            level === 'High'
                              ? 'bg-[#F05B5B] text-white border-[#F05B5B]'
                              : level === 'Medium'
                              ? 'bg-[#E89A3C] text-white border-[#E89A3C]'
                              : 'bg-[#202329] text-white border-[#202329]';
                          return (
                            <button
                              key={level}
                              type="button"
                              onClick={() => setPriority(level)}
                              className={`py-3 px-3 rounded-xl text-sm font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                                active
                                  ? activeStyle
                                  : 'bg-[#FAF9F6] text-[#25272B] border-[#E3E4E0] hover:bg-white'
                              }`}
                            >
                              {level}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* 7. Optional Opt-in Map Coordinates */}
                  <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E3E4E0] space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="text-sm font-bold text-[#25272B]">
                          7. Optional Pin Coordinates (Opt-In Only)
                        </div>
                        <p className="text-xs text-[#70757D]">
                          Location is never accessed automatically. Share coordinates only if you
                          are currently at the issue spot.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {consentedCoords ? (
                          <button
                            type="button"
                            onClick={() => {
                              setConsentedCoords(null);
                              setLocationHint(null);
                            }}
                            className="px-3.5 py-2 rounded-lg text-xs font-semibold text-[#25272B] bg-white border border-[#E3E4E0] hover:bg-[#F4F3EF] cursor-pointer whitespace-nowrap"
                          >
                            Clear Coordinates
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={locatingConsent}
                            onClick={handleOptInBrowserLocation}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-[#4169E1] bg-white border border-[#CFD9FA] hover:bg-[#EEF2FD] disabled:opacity-60 cursor-pointer whitespace-nowrap"
                          >
                            <Crosshair className="w-3.5 h-3.5" />
                            <span>
                              {locatingConsent ? 'Locating...' : 'Use Current Location'}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>

                    {consentedCoords && (
                      <div className="text-xs font-mono tabular-nums text-[#1D6F4A]">
                        Attached coordinates: {consentedCoords.lat}, {consentedCoords.lng}
                      </div>
                    )}
                    {locationHint && <p className="text-xs text-[#70757D]">{locationHint}</p>}
                  </div>

                  {/* 8. Optional Photo Upload */}
                  <div className="space-y-2">
                    <span className="block text-sm font-bold text-[#25272B]">
                      8. Optional Photograph
                    </span>
                    <p className="text-xs text-[#70757D]">
                      Attach a clear street photograph if available (JPG, PNG, or WebP up to 4 MB).
                    </p>

                    {!imagePreview ? (
                      <label className="mt-1 flex flex-col sm:flex-row items-center justify-center gap-2.5 px-4 py-6 border-2 border-dashed border-[#D5D7D0] rounded-xl text-sm text-[#70757D] bg-[#FAF9F6] hover:bg-white hover:border-[#4169E1] cursor-pointer transition-colors">
                        <Camera className="w-5 h-5 text-[#4169E1]" />
                        <span>Click to select an image file</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                      </label>
                    ) : (
                      <div className="inline-flex flex-col gap-2.5 border border-[#E3E4E0] rounded-xl bg-[#FAF9F6] p-3">
                        <img
                          src={imagePreview}
                          alt="Selected complaint photograph preview"
                          referrerPolicy="no-referrer"
                          className="h-40 w-auto object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setImageFile(null);
                            setImagePreview(null);
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#C93B3B] hover:underline cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Remove attached photo</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Form Actions */}
                  <div className="pt-5 border-t border-[#E3E4E0] flex flex-wrap items-center justify-end gap-3">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => switchSection('overview')}
                      className="px-5 py-3 rounded-xl text-sm font-semibold text-[#25272B] bg-[#F4F3EF] hover:bg-[#E7E6E1] transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-6 py-3 rounded-xl text-sm font-semibold text-white bg-[#4169E1] hover:bg-[#3358CC] disabled:opacity-55 transition-colors cursor-pointer whitespace-nowrap shadow-xs"
                    >
                      {submitting ? 'Submitting Complaint...' : 'Submit Official Complaint'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* =================================================================
              PAGE 3: EXPLORE ISSUE MAP
          ================================================================= */}
          {activeSection === 'map' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-[#555B64]">
                    Geographic Civic Explorer
                  </div>
                  <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#1F2227] tracking-tight">
                    Explore Reported Issues Across Mumbai
                  </h1>
                  <p className="text-sm sm:text-base text-[#4A5058] max-w-2xl">
                    Switch between OpenStreetMap Street View and Dark View, filter by service
                    category or Mumbai locality, and synchronize map markers with the issue list.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCreatedComplaint(null);
                    switchSection('report');
                  }}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white bg-[#4169E1] hover:bg-[#3358CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] focus-visible:ring-offset-1 transition-colors cursor-pointer whitespace-nowrap self-start md:self-auto"
                >
                  <FilePlus2 className="w-4 h-4" />
                  <span>Report an Issue</span>
                </button>
              </div>

              <NearbyIssuesMap
                issues={nearbyMapIssues}
                selectedAreaId={selectedMapAreaId}
                onSelectAreaId={handleSelectMapArea}
                isDemoMode={isDemoMode}
                loading={loading}
                highlightedIssueId={highlightedMapIssueId}
                mapStyle={mapStyle}
                onChangeMapStyle={setMapStyle}
                onInspectOwnIssue={handleInspectOwnIssueFromMap}
              />
            </div>
          )}

          {/* =================================================================
              PAGE 4: MY COMPLAINTS (STRICTLY CURRENT USER'S OWN RECORDS)
          ================================================================= */}
          {activeSection === 'complaints' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-[#70757D]">
                    Personal Citizen Records · {currentUser.name}
                  </div>
                  <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#25272B] tracking-tight">
                    My Submitted Complaints
                  </h1>
                  <p className="text-sm sm:text-base text-[#70757D]">
                    Only complaints submitted by your account are displayed here.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCreatedComplaint(null);
                    switchSection('report');
                  }}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white bg-[#4169E1] hover:bg-[#3358CC] transition-colors cursor-pointer whitespace-nowrap self-start sm:self-auto"
                >
                  <FilePlus2 className="w-4 h-4" />
                  <span>Report New Issue</span>
                </button>
              </div>

              {/* Personal Search & Filters */}
              <div className="bg-white border border-[#E3E4E0] rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-lg">
                    <Search className="w-4 h-4 text-[#70757D] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={personalSearch}
                      onChange={(e) => setPersonalSearch(e.target.value)}
                      placeholder="Search your complaints by ID, title, locality, or landmark..."
                      aria-label="Search personal complaints"
                      className="w-full pl-10 pr-9 py-2.5 text-sm text-[#25272B] bg-[#F4F3EF]/70 border border-[#E3E4E0] rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4169E1]"
                    />
                    {personalSearch && (
                      <button
                        type="button"
                        onClick={() => setPersonalSearch('')}
                        aria-label="Clear search"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#70757D] hover:text-[#25272B] cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5">
                    <label
                      htmlFor="personal-category-select"
                      className="text-sm font-medium text-[#70757D]"
                    >
                      Category:
                    </label>
                    <select
                      id="personal-category-select"
                      value={personalCategoryFilter}
                      onChange={(e) =>
                        setPersonalCategoryFilter(e.target.value as 'ALL' | ComplaintCategory)
                      }
                      className="px-3.5 py-2.5 text-sm font-medium text-[#25272B] bg-[#F4F3EF]/70 border border-[#E3E4E0] rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4169E1] cursor-pointer"
                    >
                      <option value="ALL">All Categories</option>
                      {CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.citizenLabel}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Status Filter Segmented Controls */}
                <div className="pt-3 border-t border-[#E3E4E0]/80 flex items-center gap-2 overflow-x-auto">
                  {(
                    [
                      { id: 'ALL', label: `All (${personalStats.total})` },
                      { id: 'PENDING', label: `Pending (${personalStats.pending})` },
                      { id: 'IN_PROGRESS', label: `In Progress (${personalStats.inProgress})` },
                      { id: 'RESOLVED', label: `Resolved (${personalStats.resolved})` }
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setPersonalStatusFilter(item.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        personalStatusFilter === item.id
                          ? 'bg-[#202329] text-white'
                          : 'bg-[#F4F3EF] text-[#25272B] hover:bg-[#E7E6E1]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Personal Complaint Cards */}
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="h-44 bg-white border border-[#E3E4E0] rounded-2xl animate-pulse"
                    />
                  ))}
                </div>
              ) : filteredPersonalComplaints.length === 0 ? (
                <div className="bg-white border border-[#E3E4E0] rounded-2xl p-12 text-center space-y-3">
                  <FolderOpen className="w-9 h-9 text-[#70757D] mx-auto" />
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-[#25272B]">
                      {complaints.length === 0
                        ? 'No Personal Complaints Submitted Yet'
                        : 'No Personal Complaints Match Your Filters'}
                    </h3>
                    <p className="text-sm text-[#70757D] max-w-md mx-auto">
                      {complaints.length === 0
                        ? 'Any civic issue you submit under this account will appear here with its status timeline and departmental updates.'
                        : 'Clear your active search text or status filter to view all of your submitted complaints.'}
                    </p>
                  </div>
                  <div className="pt-2">
                    {complaints.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => switchSection('report')}
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#4169E1] hover:bg-[#3358CC] transition-colors cursor-pointer"
                      >
                        Submit Your First Complaint
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setPersonalSearch('');
                          setPersonalStatusFilter('ALL');
                          setPersonalCategoryFilter('ALL');
                        }}
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold text-[#25272B] bg-[#F4F3EF] hover:bg-[#E7E6E1] transition-colors cursor-pointer"
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredPersonalComplaints.map((complaint) => {
                    const history = historyByComplaintId[complaint.id] || [];
                    const latestHistory = history[history.length - 1];
                    const { overdue, daysElapsed } = isComplaintOverdue(complaint);
                    const catObj = CATEGORIES.find((c) => c.id === complaint.category);

                    return (
                      <article
                        key={complaint.id}
                        className="bg-white border border-[#E3E4E0] hover:border-[#C9CBC5] rounded-2xl p-6 space-y-5 transition-colors"
                      >
                        {/* Top Metadata */}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-[#70757D]">
                            <span className="font-mono font-bold text-sm text-[#25272B] tabular-nums">
                              {complaint.reference_number}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-[#25272B]">
                              {catObj?.citizenLabel || complaint.category}
                            </span>
                            {complaint.priority && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span
                                  className={
                                    complaint.priority === 'High'
                                      ? 'font-semibold text-[#C93B3B]'
                                      : 'text-[#70757D]'
                                  }
                                >
                                  {complaint.priority} Priority
                                </span>
                              </>
                            )}
                            {overdue && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="inline-flex items-center gap-1 font-semibold text-[#C93B3B]">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span>Open {daysElapsed}d</span>
                                </span>
                              </>
                            )}
                            {complaint.is_demo_record && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>Demo Data</span>
                              </>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-xs text-[#70757D] tabular-nums">
                              {new Date(complaint.created_at).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </span>
                            {renderStatusBadge(complaint.status)}
                          </div>
                        </div>

                        {/* Title & Description */}
                        <div className="space-y-1.5">
                          <h2 className="text-lg font-bold text-[#25272B] leading-snug">
                            {complaint.title}
                          </h2>
                          <p className="text-sm sm:text-base text-[#70757D] leading-relaxed">
                            {complaint.description}
                          </p>
                        </div>

                        {/* Locality & Department */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div className="flex items-start gap-2 text-[#25272B]">
                            <MapPin className="w-4 h-4 text-[#4169E1] shrink-0 mt-0.5" />
                            <div>
                              <span className="font-medium">{complaint.locality}</span>
                              <span className="text-[#70757D]"> · {complaint.landmark}</span>
                            </div>
                          </div>
                          <div className="sm:text-right text-[#70757D]">
                            Department:{' '}
                            <strong className="font-semibold text-[#25272B]">
                              {complaint.department}
                            </strong>
                          </div>
                        </div>

                        {/* Lifecycle Progress */}
                        <div className="pt-3 border-t border-[#E3E4E0]">
                          {renderProgressSteps(complaint.status)}
                        </div>

                        {/* Footer Actions */}
                        <div className="pt-3 border-t border-[#E3E4E0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="text-xs sm:text-sm text-[#70757D]">
                            {latestHistory ? (
                              <span>
                                <strong className="font-semibold text-[#25272B]">
                                  Latest remark:
                                </strong>{' '}
                                {latestHistory.note || `Status updated to ${latestHistory.new_status}`}
                              </span>
                            ) : (
                              <span>Submitted and awaiting municipal assignment.</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setHighlightedMapIssueId(complaint.id);
                                handleSelectMapArea('ALL');
                                switchSection('map');
                              }}
                              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#25272B] bg-[#F4F3EF] hover:bg-[#E7E6E1] transition-colors cursor-pointer whitespace-nowrap"
                            >
                              Locate on Map
                            </button>
                            <button
                              type="button"
                              onClick={() => onSelectComplaint(complaint, history)}
                              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#4169E1] hover:bg-[#3358CC] transition-colors cursor-pointer whitespace-nowrap"
                            >
                              Inspect Timeline →
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
