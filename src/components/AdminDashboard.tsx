import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Droplets,
  FileSpreadsheet,
  Filter,
  Flame,
  Globe,
  History,
  Info,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  LogOut,
  Map as MapIcon,
  MapPin,
  Menu,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Waves,
  Wrench,
  X
} from 'lucide-react';
import {
  AdminUpdateComplaintInput,
  CATEGORIES,
  CIVIC_AREAS,
  Complaint,
  ComplaintCategory,
  ComplaintStatus,
  DEPARTMENTS,
  MunicipalDepartment,
  Profile,
  StatusHistoryEntry
} from '../types/urbanfix';
import {
  ComputedPriorityLevel,
  evaluateComplaintPriority,
  loadPriorityWeights,
  PriorityEvaluation,
  PriorityWeights,
  resetPriorityWeights,
  savePriorityWeights
} from '../lib/priorityEngine';
import {
  AdminDailyOperationsBrief,
  buildDeterministicDailyBrief,
  checkAdminAiServerStatus,
  requestDailyOperationsBrief
} from '../lib/adminAiService';
import {
  AdminAuditActionType,
  buildUnifiedAdminAuditFeed,
  loadLocalAdminOpsAudit,
  recordLocalAdminOpsAudit
} from '../lib/adminAuditService';
import {
  PriorityBreakdownPanel,
  PriorityLevelBadge,
  PriorityWeightsModal
} from './PriorityBreakdownPanel';
import { AdminHotspotsMap } from './AdminHotspotsMap';

export type AdminSectionId =
  | 'overview'
  | 'all-complaints'
  | 'priority-queue'
  | 'dept-roads'
  | 'dept-waste'
  | 'dept-drainage'
  | 'dept-water'
  | 'dept-lights'
  | 'map-hotspots'
  | 'analytics'
  | 'audit-log';

interface AdminDashboardProps {
  currentUser: Profile;
  complaints: Complaint[];
  historyByComplaintId: Record<string, StatusHistoryEntry[]>;
  loading: boolean;
  isDemoMode: boolean;
  onSelectComplaint: (complaint: Complaint, history: StatusHistoryEntry[]) => void;
  onQuickAdminUpdate?: (input: AdminUpdateComplaintInput) => Promise<void>;
  onResetDemoData: () => Promise<void>;
  onSignOut?: () => Promise<void>;
  onNavigateLanding?: () => void;
  onNavigateAbout?: () => void;
  priorityWeights?: PriorityWeights;
  onChangePriorityWeights?: (next: PriorityWeights) => void;
}

type DateRangeFilter = 'ALL' | '24H' | '7D' | '30D';
type SortMode = 'HIGHEST_PRIORITY' | 'OLDEST_UNRESOLVED' | 'NEWEST' | 'LONGEST_WAITING';

interface CategoryOpsConfig {
  sectionId: AdminSectionId;
  category: ComplaintCategory;
  navLabel: string;
  title: string;
  department: MunicipalDepartment;
  slaHours: number;
  icon: React.FC<{ className?: string }>;
  accentHex: string;
  operationalFocus: string;
  quickFilters: {
    id: string;
    label: string;
    predicate: (c: Complaint, ev: PriorityEvaluation) => boolean;
  }[];
}

const CATEGORY_OPS_CONFIGS: CategoryOpsConfig[] = [
  {
    sectionId: 'dept-roads',
    category: 'Roads',
    navLabel: 'Potholes & Road Damage',
    title: 'Potholes & Road Infrastructure Operations',
    department: 'Public Works & Roads Dept',
    slaHours: 72,
    icon: Wrench,
    accentHex: '#E89A3C',
    operationalFocus:
      'Monitors carriageway potholes, sunken utility trenches, broken footpaths, and verified proximity to schools, hospitals, and signalized junctions.',
    quickFilters: [
      { id: 'ALL', label: 'All Road Reports', predicate: () => true },
      {
        id: 'PROXIMITY',
        label: 'Near School / Hospital / Signal (≤550m)',
        predicate: (_c, ev) =>
          Boolean(ev.nearestLandmark && ev.nearestLandmark.distanceMeters <= 550)
      },
      {
        id: 'ARTERIAL',
        label: 'Arterial / Bus Corridor',
        predicate: (c) =>
          /\b(sv road|linking road|jvlr|senapati bapat|ambedkar|veer savarkar|sion-trombay|flyover|bus|junction|signal)\b/i.test(
            `${c.title} ${c.description} ${c.locality} ${c.landmark}`
          )
      },
      {
        id: 'HAZARD',
        label: 'Deep Crater / Swerve Hazard',
        predicate: (c) =>
          /\b(crater|deep|exposed steel|sunken|trench|swerve|two-wheeler|skid)\b/i.test(
            `${c.title} ${c.description}`
          )
      },
      {
        id: 'OVERDUE',
        label: 'Past 72h SLA',
        predicate: (_c, ev) => ev.isOverdueSla
      }
    ]
  },
  {
    sectionId: 'dept-waste',
    category: 'Waste Management',
    navLabel: 'Garbage & Waste',
    title: 'Solid Waste & Sanitation Operations',
    department: 'Solid Waste Management Cell',
    slaHours: 24,
    icon: Trash2,
    accentHex: '#F05B5B',
    operationalFocus:
      'Tracks overflowing ward compactor bins, missed daily collection routes, roadside debris, and reports exceeding the strict 24-hour sanitation SLA.',
    quickFilters: [
      { id: 'ALL', label: 'All Waste Reports', predicate: () => true },
      {
        id: 'OVERDUE_24H',
        label: 'Past 24h Sanitation SLA',
        predicate: (_c, ev) => ev.isOverdueSla
      },
      {
        id: 'SEVERE_OVERFLOW',
        label: 'Severe Overflow / Hygiene Risk',
        predicate: (c) =>
          /\b(overflow|uncollected|foul|rotting|organic|stray|market|spill)\b/i.test(
            `${c.title} ${c.description}`
          )
      },
      {
        id: 'CORROBORATED',
        label: 'Nearby Related Reports',
        predicate: (_c, ev) => ev.relatedReports.length > 0
      },
      {
        id: 'SENSITIVE_ZONE',
        label: 'Near School / Hospital (≤550m)',
        predicate: (_c, ev) =>
          Boolean(
            ev.nearestLandmark &&
              ev.nearestLandmark.distanceMeters <= 550 &&
              (ev.nearestLandmark.landmark.type === 'school' ||
                ev.nearestLandmark.landmark.type === 'hospital')
          )
      }
    ]
  },
  {
    sectionId: 'dept-drainage',
    category: 'Drainage',
    navLabel: 'Sewage & Drainage',
    title: 'Stormwater & Sewage Network Operations',
    department: 'Stormwater & Drainage Division',
    slaHours: 48,
    icon: Waves,
    accentHex: '#7C5CFA',
    operationalFocus:
      'Prioritizes raw sewage backflow, missing/snapped chamber slabs, monsoon culvert blockages, and public health exposure near hospitals and schools.',
    quickFilters: [
      { id: 'ALL', label: 'All Drainage Reports', predicate: () => true },
      {
        id: 'SEWAGE_HEALTH',
        label: 'Sewage Backflow / Overflow',
        predicate: (c) =>
          /\b(sewage|wastewater|backflow|surcharged|effluent|foul)\b/i.test(
            `${c.title} ${c.description}`
          )
      },
      {
        id: 'CHAMBER_HAZARD',
        label: 'Open / Damaged Manhole or Grate',
        predicate: (c) =>
          /\b(manhole|cover|slab|grate|snapped|open|chamber)\b/i.test(
            `${c.title} ${c.description}`
          )
      },
      {
        id: 'FLOODING',
        label: 'Waterlogging / Choked Culvert',
        predicate: (c) =>
          /\b(waterlog|flood|submerged|culvert|choked|silt|stagnant)\b/i.test(
            `${c.title} ${c.description}`
          )
      },
      {
        id: 'OVERDUE',
        label: 'Past 48h SLA',
        predicate: (_c, ev) => ev.isOverdueSla
      }
    ]
  },
  {
    sectionId: 'dept-water',
    category: 'Water Supply',
    navLabel: 'Water Management',
    title: 'Municipal Water Supply & Pipeline Operations',
    department: 'Municipal Water Board',
    slaHours: 48,
    icon: Droplets,
    accentHex: '#4169E1',
    operationalFocus:
      'Monitors treated-water trunk main bursts, sluice valve leaks, supply pressure drops, and possible turbidity/contamination indicators reported by citizens.',
    quickFilters: [
      { id: 'ALL', label: 'All Water Reports', predicate: () => true },
      {
        id: 'ACTIVE_LEAK',
        label: 'Active Main / Valve Leak',
        predicate: (c) =>
          /\b(leak|gushing|burst|main|sluice|valve|riser|collar)\b/i.test(
            `${c.title} ${c.description}`
          )
      },
      {
        id: 'QUALITY_RISK',
        label: 'Turbid / Contamination Text Signal',
        predicate: (c) =>
          /\b(turbid|discolored|brownish|foul|contaminat|odor|muddy)\b/i.test(
            `${c.title} ${c.description}`
          )
      },
      {
        id: 'PRESSURE_LOSS',
        label: 'Low Pressure / Supply Disruption',
        predicate: (c) =>
          /\b(low pressure|no water|interruption|shortage|dry|drop)\b/i.test(
            `${c.title} ${c.description}`
          )
      },
      {
        id: 'OVERDUE',
        label: 'Past 48h SLA',
        predicate: (_c, ev) => ev.isOverdueSla
      }
    ]
  },
  {
    sectionId: 'dept-lights',
    category: 'Streetlights',
    navLabel: 'Streetlight Management',
    title: 'Electrical & Streetlight Corridor Operations',
    department: 'Electrical & Streetlight Wing',
    slaHours: 48,
    icon: Lightbulb,
    accentHex: '#2E9E6B',
    operationalFocus:
      'Tracks multi-pole unlit stretches, dark pedestrian crossings and bus bays, exposed pole junction boxes, and photocell timer faults.',
    quickFilters: [
      { id: 'ALL', label: 'All Streetlight Reports', predicate: () => true },
      {
        id: 'DARK_STRETCH',
        label: 'Multi-Pole Dark Stretch',
        predicate: (c) =>
          /\b(consecutive|stretch|poles|entire|pitch dark|completely dark|unlit)\b/i.test(
            `${c.title} ${c.description}`
          )
      },
      {
        id: 'ELECTRICAL_SAFETY',
        label: 'Exposed Box / Electrical Hazard',
        predicate: (c) =>
          /\b(exposed|junction box|wire|cable|spark|leaning|damaged pole|door missing)\b/i.test(
            `${c.title} ${c.description}`
          )
      },
      {
        id: 'JUNCTION_TRANSIT',
        label: 'Signal / Crossing / Transit Stop',
        predicate: (c, ev) =>
          Boolean(ev.nearestLandmark && ev.nearestLandmark.distanceMeters <= 450) ||
          /\b(crossing|bus|station|metro|signal|junction|promenade)\b/i.test(
            `${c.title} ${c.description} ${c.landmark}`
          )
      },
      {
        id: 'OVERDUE',
        label: 'Past 48h SLA',
        predicate: (_c, ev) => ev.isOverdueSla
      }
    ]
  }
];

function formatDurationCompact(hours: number): string {
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const rem = hours % 24;
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
}

function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function renderStatusPill(status: ComplaintStatus) {
  switch (status) {
    case 'Resolved':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0] whitespace-nowrap shrink-0">
          <CheckCircle2 className="w-3 h-3 shrink-0" />
          <span>Resolved</span>
        </span>
      );
    case 'In Progress':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#EEF2FF] text-[#2B50C7] border border-[#C7D2FE] whitespace-nowrap shrink-0">
          <Clock className="w-3 h-3 shrink-0" />
          <span>In Progress</span>
        </span>
      );
    case 'Reopened':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA] whitespace-nowrap shrink-0">
          <RotateCcw className="w-3 h-3 shrink-0" />
          <span>Reopened</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#FFF7ED] text-[#B45309] border border-[#FED7AA] whitespace-nowrap shrink-0">
          <Clock className="w-3 h-3 shrink-0" />
          <span>Submitted</span>
        </span>
      );
  }
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  complaints,
  historyByComplaintId,
  loading,
  isDemoMode,
  onSelectComplaint,
  onResetDemoData,
  onSignOut,
  onNavigateLanding,
  onNavigateAbout,
  priorityWeights: controlledWeights,
  onChangePriorityWeights
}) => {
  const [activeSection, setActiveSection] = useState<AdminSectionId>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Priority Engine State
  const [internalWeights, setInternalWeights] = useState<PriorityWeights>(() =>
    loadPriorityWeights()
  );
  const weights = controlledWeights ?? internalWeights;
  const [weightsModalOpen, setWeightsModalOpen] = useState<boolean>(false);
  const [recalcTimestampMs, setRecalcTimestampMs] = useState<number>(() => Date.now());

  // Local Audit State
  const [localOpsAuditVersion, setLocalOpsAuditVersion] = useState<number>(0);

  // AI Server & Daily Brief State
  const [aiServerAvailable, setAiServerAvailable] = useState<boolean | null>(null);
  const [dailyBrief, setDailyBrief] = useState<AdminDailyOperationsBrief | null>(null);
  const [loadingBrief, setLoadingBrief] = useState<boolean>(false);

  // Demo Reset Confirmation
  const [confirmingReset, setConfirmingReset] = useState<boolean>(false);
  const [resettingDemo, setResettingDemo] = useState<boolean>(false);

  // Central Complaints Table State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | ComplaintCategory>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNRESOLVED' | ComplaintStatus>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | ComputedPriorityLevel>('ALL');
  const [deptFilter, setDeptFilter] = useState<'ALL' | MunicipalDepartment>('ALL');
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>('ALL');
  const [sortMode, setSortMode] = useState<SortMode>('HIGHEST_PRIORITY');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const PAGE_SIZE = 15;

  // Priority Queue Filter Tab
  const [priorityQueueTab, setPriorityQueueTab] = useState<
    'ALL_UNRESOLVED' | 'CRITICAL' | 'HIGH' | 'OVERDUE_SLA' | 'UNASSIGNED' | 'CORROBORATED'
  >('ALL_UNRESOLVED');

  // Category Department View Sub-Filter
  const [deptSubFilter, setDeptSubFilter] = useState<string>('ALL');
  const [deptSearch, setDeptSearch] = useState<string>('');
  const [deptStatusFilter, setDeptStatusFilter] = useState<'ALL' | 'UNRESOLVED' | ComplaintStatus>(
    'ALL'
  );

  // Audit Log Filters
  const [auditActionFilter, setAuditActionFilter] = useState<'ALL' | AdminAuditActionType>('ALL');
  const [auditSearch, setAuditSearch] = useState<string>('');

  // Check Server-Side Gemini AI Availability once on mount
  useEffect(() => {
    let active = true;
    checkAdminAiServerStatus().then((status) => {
      if (active) setAiServerAvailable(status.available);
    });
    return () => {
      active = false;
    };
  }, []);

  // Reset sub-filters when switching department wing
  useEffect(() => {
    setDeptSubFilter('ALL');
    setDeptSearch('');
    setDeptStatusFilter('ALL');
  }, [activeSection]);

  // Reset pagination when table filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchQuery,
    categoryFilter,
    statusFilter,
    priorityFilter,
    deptFilter,
    dateRangeFilter,
    sortMode
  ]);

  // ---------------------------------------------------------------------------
  // Compute Smart Priority Evaluations for ALL Complaints (Single Unified Pass)
  // ---------------------------------------------------------------------------
  const evaluationsById = useMemo(() => {
    const map: Record<string, PriorityEvaluation> = {};
    for (const c of complaints) {
      map[c.id] = evaluateComplaintPriority(c, complaints, weights, recalcTimestampMs);
    }
    return map;
  }, [complaints, weights, recalcTimestampMs]);

  // Keep deterministic Daily Brief synchronized immediately; preserve Gemini brief if already fetched for same count
  useEffect(() => {
    setDailyBrief((prev) => {
      if (prev && prev.source === 'gemini') return prev;
      return buildDeterministicDailyBrief(complaints, evaluationsById, isDemoMode);
    });
  }, [complaints, evaluationsById, isDemoMode]);

  const handleGenerateGeminiBrief = async (forceRefresh = false) => {
    setLoadingBrief(true);
    try {
      const nextBrief = await requestDailyOperationsBrief(
        complaints,
        evaluationsById,
        isDemoMode,
        { forceRefresh }
      );
      setDailyBrief(nextBrief);
    } finally {
      setLoadingBrief(false);
    }
  };

  const handleSaveWeights = (nextWeights: PriorityWeights) => {
    savePriorityWeights(nextWeights);
    setInternalWeights(nextWeights);
    onChangePriorityWeights?.(nextWeights);
    setRecalcTimestampMs(Date.now());
    recordLocalAdminOpsAudit({
      actionType: 'priority_weights_updated',
      actionLabel: 'Priority Weights Adjusted',
      actorName: currentUser.name,
      note: `Updated heuristic weights (Severity ${nextWeights.severity}, Proximity ${nextWeights.publicLocationProximity}, Corridor ${nextWeights.trafficAndAreaImpact}, Waiting ${nextWeights.timeWaiting}, Corroboration ${nextWeights.corroboratingReports}, Safety ${nextWeights.safetyRisk}).`
    });
    setLocalOpsAuditVersion((v) => v + 1);
  };

  const handleResetDefaultWeights = () => {
    const defaults = resetPriorityWeights();
    setInternalWeights(defaults);
    onChangePriorityWeights?.(defaults);
    setRecalcTimestampMs(Date.now());
    recordLocalAdminOpsAudit({
      actionType: 'priority_weights_updated',
      actionLabel: 'Priority Weights Reset',
      actorName: currentUser.name,
      note: 'Restored default 100-point heuristic priority weights.'
    });
    setLocalOpsAuditVersion((v) => v + 1);
  };

  const handleExplicitRecalculate = () => {
    setRecalcTimestampMs(Date.now());
    recordLocalAdminOpsAudit({
      actionType: 'priority_recalculated',
      actionLabel: 'Queue Scores Recalculated',
      actorName: currentUser.name,
      note: `Recalculated priority scores across ${complaints.length} complaints against current SLA elapsed time.`
    });
    setLocalOpsAuditVersion((v) => v + 1);
  };

  const handleConfirmResetDemo = async () => {
    setResettingDemo(true);
    try {
      await onResetDemoData();
      recordLocalAdminOpsAudit({
        actionType: 'demo_dataset_reset',
        actionLabel: 'Demo Dataset Restored',
        actorName: currentUser.name,
        note: 'Restored initial 90-complaint Mumbai civic demonstration dataset.'
      });
      setLocalOpsAuditVersion((v) => v + 1);
      setConfirmingReset(false);
    } finally {
      setResettingDemo(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Derived Operational Metrics (100% Real Computations — Zero Hardcoded Numbers)
  // ---------------------------------------------------------------------------
  const metrics = useMemo(() => {
    const nowMs = recalcTimestampMs;
    const total = complaints.length;
    const submitted = complaints.filter((c) => c.status === 'Submitted').length;
    const inProgress = complaints.filter((c) => c.status === 'In Progress').length;
    const resolvedList = complaints.filter((c) => c.status === 'Resolved');
    const resolved = resolvedList.length;
    const reopened = complaints.filter((c) => c.status === 'Reopened').length;
    const unresolvedList = complaints.filter((c) => c.status !== 'Resolved');

    const criticalUnresolved = unresolvedList.filter(
      (c) => evaluationsById[c.id]?.level === 'Critical'
    ).length;
    const highUnresolved = unresolvedList.filter(
      (c) => evaluationsById[c.id]?.level === 'High'
    ).length;
    const mediumUnresolved = unresolvedList.filter(
      (c) => evaluationsById[c.id]?.level === 'Medium'
    ).length;
    const lowUnresolved = unresolvedList.filter(
      (c) => evaluationsById[c.id]?.level === 'Low'
    ).length;

    const overdueSla = unresolvedList.filter((c) => evaluationsById[c.id]?.isOverdueSla).length;
    const unassignedActive = unresolvedList.filter((c) => c.department === 'Unassigned').length;

    // Average Resolution Time strictly from resolved records with valid updated_at >= created_at
    const validResolutionHours = resolvedList
      .map((c) => {
        const start = new Date(c.created_at).getTime();
        const end = new Date(c.updated_at).getTime();
        if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
        return (end - start) / (1000 * 3600);
      })
      .filter((h): h is number => h !== null && h >= 0);

    const avgResolutionHours =
      validResolutionHours.length > 0
        ? Math.round(
            validResolutionHours.reduce((sum, h) => sum + h, 0) / validResolutionHours.length
          )
        : null;

    const received24h = complaints.filter(
      (c) => nowMs - new Date(c.created_at).getTime() <= 24 * 3600 * 1000
    ).length;
    const received7d = complaints.filter(
      (c) => nowMs - new Date(c.created_at).getTime() <= 7 * 24 * 3600 * 1000
    ).length;

    const resolutionRatePct = total > 0 ? Math.round((resolved / total) * 100) : 0;

    return {
      total,
      submitted,
      inProgress,
      resolved,
      reopened,
      unresolvedCount: unresolvedList.length,
      criticalUnresolved,
      highUnresolved,
      mediumUnresolved,
      lowUnresolved,
      overdueSla,
      unassignedActive,
      avgResolutionHours,
      resolvedSampleCount: validResolutionHours.length,
      received24h,
      received7d,
      resolutionRatePct
    };
  }, [complaints, evaluationsById, recalcTimestampMs]);

  // 14-Bucket Date Trend Derived Strictly from Recorded created_at Timestamps
  const intakeTrendBuckets = useMemo(() => {
    if (complaints.length === 0) return [];
    const timestamps = complaints
      .map((c) => new Date(c.created_at).getTime())
      .filter((t) => Number.isFinite(t));
    const latestMs = Math.max(...timestamps, Date.now());
    const dayMs = 24 * 3600 * 1000;
    const anchorDayStart = new Date(latestMs);
    anchorDayStart.setHours(0, 0, 0, 0);

    const buckets: {
      dateKey: string;
      shortLabel: string;
      totalLogged: number;
      resolvedCount: number;
    }[] = [];

    for (let i = 13; i >= 0; i--) {
      const start = anchorDayStart.getTime() - i * dayMs;
      const end = start + dayMs;
      const d = new Date(start);
      const shortLabel = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      const inBucket = complaints.filter((c) => {
        const t = new Date(c.created_at).getTime();
        return t >= start && t < end;
      });
      buckets.push({
        dateKey: d.toISOString().slice(0, 10),
        shortLabel,
        totalLogged: inBucket.length,
        resolvedCount: inBucket.filter((c) => c.status === 'Resolved').length
      });
    }
    return buckets;
  }, [complaints]);

  // Category Workload Breakdown
  const categoryStats = useMemo(() => {
    return CATEGORY_OPS_CONFIGS.map((cfg) => {
      const items = complaints.filter((c) => c.category === cfg.category);
      const active = items.filter((c) => c.status !== 'Resolved');
      const resolved = items.filter((c) => c.status === 'Resolved');
      const overdue = active.filter((c) => evaluationsById[c.id]?.isOverdueSla);
      const criticalOrHigh = active.filter((c) => {
        const lvl = evaluationsById[c.id]?.level;
        return lvl === 'Critical' || lvl === 'High';
      });

      const resHours = resolved
        .map((c) => (new Date(c.updated_at).getTime() - new Date(c.created_at).getTime()) / 3600000)
        .filter((h) => Number.isFinite(h) && h >= 0);

      const avgResHours =
        resHours.length > 0
          ? Math.round(resHours.reduce((a, b) => a + b, 0) / resHours.length)
          : null;

      const avgScore =
        active.length > 0
          ? Math.round(
              active.reduce((s, c) => s + (evaluationsById[c.id]?.score ?? 0), 0) / active.length
            )
          : 0;

      return {
        ...cfg,
        total: items.length,
        activeCount: active.length,
        submittedCount: items.filter((c) => c.status === 'Submitted').length,
        inProgressCount: items.filter((c) => c.status === 'In Progress').length,
        reopenedCount: items.filter((c) => c.status === 'Reopened').length,
        resolvedCount: resolved.length,
        overdueCount: overdue.length,
        criticalOrHighCount: criticalOrHigh.length,
        avgResHours,
        avgActiveScore: avgScore
      };
    });
  }, [complaints, evaluationsById]);

  // Unified Audit Feed
  const unifiedAuditEntries = useMemo(() => {
    const localOps = loadLocalAdminOpsAudit();
    return buildUnifiedAdminAuditFeed(
      complaints,
      historyByComplaintId,
      localOps,
      isDemoMode
    );
  }, [complaints, historyByComplaintId, isDemoMode, localOpsAuditVersion]);

  // Top Urgent Unresolved Complaints
  const urgentQueueAll = useMemo(() => {
    return complaints
      .filter((c) => c.status !== 'Resolved')
      .sort((a, b) => {
        const evA = evaluationsById[a.id];
        const evB = evaluationsById[b.id];
        return (evB?.score ?? 0) - (evA?.score ?? 0) || (evB?.hoursWaiting ?? 0) - (evA?.hoursWaiting ?? 0);
      });
  }, [complaints, evaluationsById]);

  // Filtered Central Complaints List
  const filteredCentralComplaints = useMemo(() => {
    const nowMs = recalcTimestampMs;
    const filtered = complaints.filter((c) => {
      const ev = evaluationsById[c.id];
      if (categoryFilter !== 'ALL' && c.category !== categoryFilter) return false;
      if (statusFilter === 'UNRESOLVED' && c.status === 'Resolved') return false;
      if (statusFilter !== 'ALL' && statusFilter !== 'UNRESOLVED' && c.status !== statusFilter) {
        return false;
      }
      if (priorityFilter !== 'ALL' && ev?.level !== priorityFilter) return false;
      if (deptFilter !== 'ALL' && c.department !== deptFilter) return false;

      if (dateRangeFilter !== 'ALL') {
        const ageHours = (nowMs - new Date(c.created_at).getTime()) / (1000 * 3600);
        if (dateRangeFilter === '24H' && ageHours > 24) return false;
        if (dateRangeFilter === '7D' && ageHours > 7 * 24) return false;
        if (dateRangeFilter === '30D' && ageHours > 30 * 24) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hit =
          c.reference_number.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.locality.toLowerCase().includes(q) ||
          c.landmark.toLowerCase().includes(q) ||
          (c.owner_name || '').toLowerCase().includes(q) ||
          c.department.toLowerCase().includes(q);
        if (!hit) return false;
      }

      return true;
    });

    return filtered.sort((a, b) => {
      const evA = evaluationsById[a.id];
      const evB = evaluationsById[b.id];
      if (sortMode === 'HIGHEST_PRIORITY') {
        if (a.status === 'Resolved' && b.status !== 'Resolved') return 1;
        if (a.status !== 'Resolved' && b.status === 'Resolved') return -1;
        return (evB?.score ?? 0) - (evA?.score ?? 0);
      }
      if (sortMode === 'OLDEST_UNRESOLVED') {
        if (a.status === 'Resolved' && b.status !== 'Resolved') return 1;
        if (a.status !== 'Resolved' && b.status === 'Resolved') return -1;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortMode === 'LONGEST_WAITING') {
        return (evB?.hoursWaiting ?? 0) - (evA?.hoursWaiting ?? 0);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [
    complaints,
    evaluationsById,
    categoryFilter,
    statusFilter,
    priorityFilter,
    deptFilter,
    dateRangeFilter,
    searchQuery,
    sortMode,
    recalcTimestampMs
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredCentralComplaints.length / PAGE_SIZE));
  const paginatedCentralComplaints = filteredCentralComplaints.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const exportComplaintsToCsv = (rows: Complaint[], filenamePrefix: string) => {
    const headers = [
      'Reference_ID',
      'Title',
      'Category',
      'Status',
      'Priority_Score',
      'Priority_Level',
      'Recorded_Severity',
      'Assigned_Department',
      'Locality',
      'Landmark',
      'Hours_Waiting',
      'Overdue_SLA',
      'Citizen_Name',
      'Created_At',
      'Updated_At',
      'Data_Source'
    ];

    const lines = rows.map((c) => {
      const ev = evaluationsById[c.id];
      return [
        c.reference_number,
        c.title,
        c.category,
        c.status,
        ev?.score ?? '',
        ev?.level ?? '',
        c.priority || 'Medium',
        c.department,
        c.locality,
        c.landmark,
        ev?.hoursWaiting ?? '',
        ev?.isOverdueSla ? 'Yes' : 'No',
        c.owner_name || 'Verified Citizen',
        c.created_at,
        c.updated_at,
        c.is_demo_record || isDemoMode ? 'Demo Data' : 'Live Database'
      ]
        .map(escapeCsvCell)
        .join(',');
    });

    const csvContent = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const inspectComplaintRecord = (c: Complaint) => {
    onSelectComplaint(c, historyByComplaintId[c.id] || []);
  };

  const selectSection = (section: AdminSectionId) => {
    setActiveSection(section);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  // Active Department Wing Configuration (if one of the 5 category sections is selected)
  const activeDeptConfig = CATEGORY_OPS_CONFIGS.find((cfg) => cfg.sectionId === activeSection);

  // Navigation Definition
  const primaryNavItems: {
    id: AdminSectionId;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
    badgeTone?: 'urgent' | 'neutral';
  }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    {
      id: 'all-complaints',
      label: 'All Complaints',
      icon: ListChecks,
      badge: metrics.total,
      badgeTone: 'neutral'
    },
    {
      id: 'priority-queue',
      label: 'Priority Queue',
      icon: Flame,
      badge: metrics.criticalUnresolved + metrics.highUnresolved,
      badgeTone: 'urgent'
    }
  ];

  const intelligenceNavItems: {
    id: AdminSectionId;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
  }[] = [
    { id: 'map-hotspots', label: 'Map & Hotspots', icon: MapIcon },
    { id: 'analytics', label: 'Analytics & Reports', icon: BarChart3 },
    {
      id: 'audit-log',
      label: 'Admin Activity / Audit',
      icon: History,
      badge: unifiedAuditEntries.length
    }
  ];

  const sectionHeaderMeta: Record<AdminSectionId, { title: string; subtitle: string }> = {
    overview: {
      title: 'Municipal Operations Overview',
      subtitle:
        'Citywide civic complaint intake, SLA compliance, smart priority triage, and departmental workload.'
    },
    'all-complaints': {
      title: 'Central Complaint Registry',
      subtitle:
        'Search, filter, sort, export, and dispatch across every civic service complaint in a unified queue.'
    },
    'priority-queue': {
      title: 'Smart Priority Triage Queue',
      subtitle:
        'Explainable 6-factor urgency ranking (0–100) highlighting critical public-safety, proximity, and SLA-overdue issues.'
    },
    'dept-roads': {
      title: 'Potholes & Road Damage Wing',
      subtitle: 'Public Works & Roads Dept · 72-hour standard SLA target.'
    },
    'dept-waste': {
      title: 'Garbage & Waste Management Wing',
      subtitle: 'Solid Waste Management Cell · 24-hour ward clearance SLA target.'
    },
    'dept-drainage': {
      title: 'Sewage & Drainage Wing',
      subtitle: 'Stormwater & Drainage Division · 48-hour public health & culvert SLA target.'
    },
    'dept-water': {
      title: 'Water Management Wing',
      subtitle: 'Municipal Water Board · 48-hour pipeline & supply restoration SLA target.'
    },
    'dept-lights': {
      title: 'Streetlight Management Wing',
      subtitle: 'Electrical & Streetlight Wing · 48-hour corridor illumination SLA target.'
    },
    'map-hotspots': {
      title: 'Civic Map & Spatial Hotspots',
      subtitle:
        'Interactive Greater Mumbai street map with priority color-coding and 550m unresolved cluster detection.'
    },
    'analytics': {
      title: 'Operational Analytics & Ward Reports',
      subtitle:
        'Departmental SLA metrics, ward-level backlog concentration, and exportable municipal summaries.'
    },
    'audit-log': {
      title: 'Administrative Activity & Audit Log',
      subtitle:
        'Chronological record of complaint status transitions, department assignments, and session triage actions.'
    }
  };

  // ===========================================================================
  // SIDEBAR RENDERER (Desktop + Mobile Drawer)
  // ===========================================================================
  const renderSidebarContent = (isMobile = false) => {
    const collapsed = !isMobile && sidebarCollapsed;

    return (
      <div className="flex flex-col h-full bg-[#202329] text-[#E6E8EC] select-none">
        {/* Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#4169E1] text-white flex items-center justify-center font-display font-bold text-sm shrink-0">
              UF
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="font-display font-bold text-white text-base tracking-tight truncate">
                  UrbanFix
                </div>
                <div className="text-[11px] text-[#9CA3AF] truncate">
                  Municipal Operations
                </div>
              </div>
            )}
          </div>

          {isMobile ? (
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-1.5 text-[#9CA3AF] hover:text-white rounded-lg cursor-pointer"
              aria-label="Close navigation menu"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              className="p-1.5 text-[#9CA3AF] hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {/* Group 1: Command & Queue */}
          <div className="space-y-1">
            {!collapsed && (
              <div className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#8C939E]">
                Command & Triage
              </div>
            )}
            {primaryNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectSection(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#4169E1] text-white'
                      : 'text-[#C4C9D4] hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </span>
                  {!collapsed && typeof item.badge === 'number' && (
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-mono rounded-md tabular-nums shrink-0 ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : item.badgeTone === 'urgent'
                          ? 'bg-[#F05B5B]/20 text-[#FCA5A5]'
                          : 'bg-white/10 text-[#D1D5DB]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Group 2: Category-Wise Department Wings */}
          <div className="space-y-1">
            {!collapsed && (
              <div className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#8C939E]">
                Department Wings
              </div>
            )}
            {categoryStats.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeSection === cat.sectionId;
              return (
                <button
                  key={cat.sectionId}
                  type="button"
                  onClick={() => selectSection(cat.sectionId)}
                  title={collapsed ? `${cat.navLabel} (${cat.activeCount} active)` : undefined}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#4169E1] text-white'
                      : 'text-[#C4C9D4] hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" />
                    {!collapsed && <span className="truncate">{cat.navLabel}</span>}
                  </span>
                  {!collapsed && (
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-mono rounded-md tabular-nums shrink-0 ${
                        isActive ? 'bg-white/20 text-white' : 'bg-white/10 text-[#D1D5DB]'
                      }`}
                    >
                      {cat.activeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Group 3: Spatial & Audit Intelligence */}
          <div className="space-y-1">
            {!collapsed && (
              <div className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#8C939E]">
                Spatial & Governance
              </div>
            )}
            {intelligenceNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectSection(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#4169E1] text-white'
                      : 'text-[#C4C9D4] hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </span>
                  {!collapsed && typeof item.badge === 'number' && (
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-mono rounded-md tabular-nums shrink-0 ${
                        isActive ? 'bg-white/20 text-white' : 'bg-white/10 text-[#D1D5DB]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Officer Profile & Session Controls */}
        <div className="p-3 border-t border-white/10 space-y-2 shrink-0">
          {!collapsed && (
            <div className="px-2.5 py-2 rounded-xl bg-white/5 space-y-0.5">
              <div className="text-xs font-bold text-white truncate">{currentUser.name}</div>
              <div className="text-[11px] text-[#9CA3AF] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#4169E1] shrink-0" />
                <span>Authorized Municipal Admin</span>
              </div>
            </div>
          )}

          {!collapsed && (
            <div className="flex items-center gap-1.5">
              {onNavigateLanding && (
                <button
                  type="button"
                  onClick={onNavigateLanding}
                  className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-[#C4C9D4] hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Globe className="w-3 h-3" />
                  <span>Public Site</span>
                </button>
              )}
              {onNavigateAbout && (
                <button
                  type="button"
                  onClick={onNavigateAbout}
                  className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-[#C4C9D4] hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Info className="w-3 h-3" />
                  <span>Architecture</span>
                </button>
              )}
            </div>
          )}

          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              title={collapsed ? 'Sign Out' : undefined}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-[#FCA5A5] hover:text-white bg-white/5 hover:bg-[#F05B5B]/25 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              {!collapsed && <span>Sign Out</span>}
            </button>
          )}
        </div>
      </div>
    );
  };

  // ===========================================================================
  // REUSABLE DAILY OPERATIONS BRIEF PANEL
  // ===========================================================================
  const renderDailyOperationsBrief = () => {
    if (!dailyBrief) return null;

    return (
      <div className="bg-white border border-[#E3E4E0] rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[#E3E4E0]">
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-[#25272B] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#4169E1]" />
                <span>Daily Operations Brief</span>
              </h3>
              <span
                className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${
                  dailyBrief.source === 'gemini'
                    ? 'bg-[#EEF2FF] text-[#2B50C7] border-[#C7D2FE]'
                    : 'bg-[#FAF9F6] text-[#555B64] border-[#E3E4E0]'
                }`}
              >
                {dailyBrief.modelLabel}
              </span>
              {isDemoMode && (
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-[#FAF9F6] text-[#555B64] border border-[#E3E4E0] rounded-md">
                  Demo Dataset Scope
                </span>
              )}
            </div>
            <p className="text-xs text-[#555B64]">
              Separates verified queue metrics from suggested administrative follow-up actions.
            </p>
          </div>

          <button
            type="button"
            disabled={loadingBrief}
            onClick={() => handleGenerateGeminiBrief(dailyBrief.source === 'gemini')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#202329] hover:bg-[#2F333C] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingBrief ? 'animate-spin' : ''}`} />
            <span>
              {loadingBrief
                ? 'Synthesizing Brief...'
                : dailyBrief.source === 'gemini'
                ? 'Refresh Gemini Brief'
                : 'Generate with Gemini AI'}
            </span>
          </button>
        </div>

        {dailyBrief.fallbackReason && (
          <div className="px-3 py-2 rounded-lg bg-[#FAF9F6] border border-[#E3E4E0] text-xs text-[#555B64]">
            {dailyBrief.fallbackReason}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
          <div className="rounded-xl bg-[#FAF9F6] border border-[#E3E4E0] p-3.5 space-y-2">
            <div className="font-bold text-[#25272B] uppercase tracking-wider text-[11px]">
              Recorded Operational Facts
            </div>
            <ul className="space-y-1.5 text-[#555B64] leading-relaxed list-disc pl-4">
              {dailyBrief.recordedFactsSummary.map((fact, idx) => (
                <li key={idx}>{fact}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl bg-[#FAF9F6] border border-[#E3E4E0] p-3.5 space-y-2">
            <div className="font-bold text-[#25272B] uppercase tracking-wider text-[11px]">
              Ward & Category Concentration
            </div>
            <ul className="space-y-1.5 text-[#555B64] leading-relaxed list-disc pl-4">
              {dailyBrief.hotspotObservations.map((obs, idx) => (
                <li key={idx}>{obs}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl bg-[#EEF2FF]/55 border border-[#C7D2FE] p-3.5 space-y-2">
            <div className="font-bold text-[#2B50C7] uppercase tracking-wider text-[11px]">
              Suggested Officer Follow-Up Actions
            </div>
            <ul className="space-y-1.5 text-[#25272B] leading-relaxed list-disc pl-4">
              {dailyBrief.suggestedFollowUpActions.map((act, idx) => (
                <li key={idx}>{act}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  // ===========================================================================
  // VIEW 1: ADMIN OVERVIEW DASHBOARD
  // ===========================================================================
  const renderOverviewSection = () => {
    const maxTrendCount = Math.max(
      1,
      ...intakeTrendBuckets.map((b) => b.totalLogged)
    );
    const maxCategoryTotal = Math.max(1, ...categoryStats.map((c) => c.total));

    return (
      <div className="space-y-6">
        {/* 8-Card Operational KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
          <div className="bg-white border border-[#E3E4E0] rounded-2xl p-4 space-y-1">
            <div className="text-[11px] font-semibold text-[#555B64]">Total Logged</div>
            <div className="text-2xl font-display font-bold text-[#25272B] tabular-nums">
              {metrics.total}
            </div>
            <div className="text-[11px] text-[#70757D] tabular-nums">
              {isDemoMode ? 'Demo civic dataset' : 'Live records'}
            </div>
          </div>

          <div className="bg-white border border-[#E3E4E0] rounded-2xl p-4 space-y-1">
            <div className="text-[11px] font-semibold text-[#555B64]">Pending Intake</div>
            <div className="text-2xl font-display font-bold text-[#B45309] tabular-nums">
              {metrics.submitted}
            </div>
            <div className="text-[11px] text-[#70757D] tabular-nums">
              {metrics.unassignedActive} unassigned
            </div>
          </div>

          <div className="bg-white border border-[#E3E4E0] rounded-2xl p-4 space-y-1">
            <div className="text-[11px] font-semibold text-[#555B64]">In Progress</div>
            <div className="text-2xl font-display font-bold text-[#4169E1] tabular-nums">
              {metrics.inProgress}
            </div>
            <div className="text-[11px] text-[#70757D] tabular-nums">
              {metrics.reopened} reopened
            </div>
          </div>

          <div className="bg-white border border-[#E3E4E0] rounded-2xl p-4 space-y-1">
            <div className="text-[11px] font-semibold text-[#555B64]">Resolved</div>
            <div className="text-2xl font-display font-bold text-[#047857] tabular-nums">
              {metrics.resolved}
            </div>
            <div className="text-[11px] text-[#70757D] tabular-nums">
              {metrics.resolutionRatePct}% closure rate
            </div>
          </div>

          <div className="bg-white border border-[#E3E4E0] rounded-2xl p-4 space-y-1">
            <div className="text-[11px] font-semibold text-[#555B64]">Critical & High</div>
            <div className="text-2xl font-display font-bold text-[#B91C1C] tabular-nums">
              {metrics.criticalUnresolved + metrics.highUnresolved}
            </div>
            <div className="text-[11px] text-[#70757D] tabular-nums">
              {metrics.criticalUnresolved} Critical · {metrics.highUnresolved} High
            </div>
          </div>

          <div className="bg-white border border-[#E3E4E0] rounded-2xl p-4 space-y-1">
            <div className="text-[11px] font-semibold text-[#555B64]">Past SLA Target</div>
            <div className="text-2xl font-display font-bold text-[#F05B5B] tabular-nums">
              {metrics.overdueSla}
            </div>
            <div className="text-[11px] text-[#70757D]">24h–72h thresholds</div>
          </div>

          <div className="bg-white border border-[#E3E4E0] rounded-2xl p-4 space-y-1">
            <div className="text-[11px] font-semibold text-[#555B64]">Avg Resolution</div>
            <div className="text-2xl font-display font-bold text-[#25272B] tabular-nums">
              {metrics.avgResolutionHours !== null
                ? formatDurationCompact(metrics.avgResolutionHours)
                : 'N/A'}
            </div>
            <div className="text-[11px] text-[#70757D] tabular-nums">
              From {metrics.resolvedSampleCount} closed
            </div>
          </div>

          <div className="bg-white border border-[#E3E4E0] rounded-2xl p-4 space-y-1">
            <div className="text-[11px] font-semibold text-[#555B64]">Recent Intake</div>
            <div className="text-2xl font-display font-bold text-[#25272B] tabular-nums">
              {metrics.received7d}
            </div>
            <div className="text-[11px] text-[#70757D] tabular-nums">
              7d ({metrics.received24h} in 24h)
            </div>
          </div>
        </div>

        {/* Daily Operations Brief */}
        {renderDailyOperationsBrief()}

        {/* Charts Row: 14-Day Intake Trend + Category Workload & SLA */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          {/* 14-Day Intake Trend by Date (SVG Chart) */}
          <div className="xl:col-span-7 bg-white border border-[#E3E4E0] rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#25272B]">
                  14-Day Complaint Intake & Closure Trend
                </h3>
                <p className="text-xs text-[#555B64]">
                  Daily logged volume vs resolved count derived from recorded timestamps
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-[#555B64]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#4169E1]" />
                  <span>Total Logged</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#2E9E6B]" />
                  <span>Resolved</span>
                </span>
              </div>
            </div>

            {intakeTrendBuckets.length === 0 ? (
              <p className="text-xs text-[#555B64] py-12 text-center">
                No complaint timestamp data available yet.
              </p>
            ) : (
              <div className="space-y-2">
                <svg
                  viewBox="0 0 560 175"
                  className="w-full h-44 overflow-visible"
                  role="img"
                  aria-label="14-day complaint intake bar chart"
                >
                  {/* Subtle horizontal reference gridlines */}
                  {[0, 0.5, 1].map((ratio, i) => {
                    const y = 145 - ratio * 120;
                    return (
                      <line
                        key={i}
                        x1="0"
                        y1={y}
                        x2="560"
                        y2={y}
                        stroke="#ECEBE6"
                        strokeDasharray="3 3"
                      />
                    );
                  })}

                  {intakeTrendBuckets.map((bucket, idx) => {
                    const slotWidth = 560 / intakeTrendBuckets.length;
                    const centerX = idx * slotWidth + slotWidth / 2;
                    const totalBarH = Math.max(
                      bucket.totalLogged > 0 ? 5 : 1,
                      Math.round((bucket.totalLogged / maxTrendCount) * 120)
                    );
                    const resBarH =
                      bucket.resolvedCount > 0
                        ? Math.max(4, Math.round((bucket.resolvedCount / maxTrendCount) * 120))
                        : 0;

                    return (
                      <g key={bucket.dateKey}>
                        <title>
                          {`${bucket.shortLabel}: ${bucket.totalLogged} logged, ${bucket.resolvedCount} resolved`}
                        </title>
                        <rect
                          x={centerX - 11}
                          y={145 - totalBarH}
                          width="10"
                          height={totalBarH}
                          rx="3"
                          fill="#4169E1"
                        />
                        {resBarH > 0 && (
                          <rect
                            x={centerX + 1}
                            y={145 - resBarH}
                            width="10"
                            height={resBarH}
                            rx="3"
                            fill="#2E9E6B"
                          />
                        )}
                        {bucket.totalLogged > 0 && (
                          <text
                            x={centerX - 6}
                            y={140 - totalBarH}
                            textAnchor="middle"
                            fontSize="9.5"
                            fill="#555B64"
                            fontFamily="JetBrains Mono, monospace"
                          >
                            {bucket.totalLogged}
                          </text>
                        )}
                        {idx % 2 === 0 && (
                          <text
                            x={centerX}
                            y="165"
                            textAnchor="middle"
                            fontSize="10"
                            fill="#70757D"
                          >
                            {bucket.shortLabel}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
          </div>

          {/* Category Workload & Department Routing Card */}
          <div className="xl:col-span-5 bg-white border border-[#E3E4E0] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#25272B]">
                  Departmental Category Workload
                </h3>
                <p className="text-xs text-[#555B64]">
                  Select any wing to open category-specific dispatch
                </p>
              </div>
              <span className="text-xs font-mono text-[#555B64] tabular-nums">
                {metrics.unresolvedCount} active
              </span>
            </div>

            <div className="space-y-3">
              {categoryStats.map((cat) => {
                const activeWidth = Math.round((cat.activeCount / maxCategoryTotal) * 100);
                const resolvedWidth = Math.round((cat.resolvedCount / maxCategoryTotal) * 100);
                const Icon = cat.icon;

                return (
                  <button
                    key={cat.sectionId}
                    type="button"
                    onClick={() => selectSection(cat.sectionId)}
                    className="w-full text-left p-2.5 rounded-xl border border-[#E3E4E0] bg-[#FAF9F6] hover:bg-[#F0EFEA] transition-colors space-y-2 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-2 font-bold text-[#25272B]">
                        <Icon className="w-3.5 h-3.5 text-[#4169E1] shrink-0" />
                        <span>{cat.navLabel}</span>
                      </span>
                      <span className="font-mono text-[11px] text-[#555B64] tabular-nums whitespace-nowrap shrink-0">
                        <strong className="text-[#25272B]">{cat.activeCount}</strong> active ·{' '}
                        {cat.resolvedCount} closed
                        {cat.overdueCount > 0 ? ` · ${cat.overdueCount} SLA!` : ''}
                      </span>
                    </div>

                    <svg
                      viewBox="0 0 100 6"
                      preserveAspectRatio="none"
                      className="w-full h-1.5 rounded-full overflow-hidden block"
                      aria-hidden="true"
                    >
                      <rect x="0" y="0" width="100" height="6" fill="#E5E4DF" />
                      {activeWidth > 0 && (
                        <rect
                          x="0"
                          y="0"
                          width={activeWidth}
                          height="6"
                          fill={cat.accentHex}
                        />
                      )}
                      {resolvedWidth > 0 && (
                        <rect
                          x={activeWidth}
                          y="0"
                          width={resolvedWidth}
                          height="6"
                          fill="#2E9E6B"
                        />
                      )}
                    </svg>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Status + Priority Distribution Strip */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Lifecycle Status Distribution */}
          <div className="bg-white border border-[#E3E4E0] rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#25272B]">
                Lifecycle Status Distribution
              </h3>
              <span className="text-xs font-mono text-[#555B64] tabular-nums">
                {metrics.total} total
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-[#FFF7ED] border border-[#FED7AA] space-y-0.5">
                <div className="text-[#9A3412] font-semibold">Submitted</div>
                <div className="text-xl font-display font-bold text-[#9A3412] tabular-nums">
                  {metrics.submitted}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#EEF2FF] border border-[#C7D2FE] space-y-0.5">
                <div className="text-[#2B50C7] font-semibold">In Progress</div>
                <div className="text-xl font-display font-bold text-[#2B50C7] tabular-nums">
                  {metrics.inProgress}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] space-y-0.5">
                <div className="text-[#B91C1C] font-semibold">Reopened</div>
                <div className="text-xl font-display font-bold text-[#B91C1C] tabular-nums">
                  {metrics.reopened}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] space-y-0.5">
                <div className="text-[#047857] font-semibold">Resolved</div>
                <div className="text-xl font-display font-bold text-[#047857] tabular-nums">
                  {metrics.resolved}
                </div>
              </div>
            </div>
          </div>

          {/* Active Priority Queue Distribution */}
          <div className="bg-white border border-[#E3E4E0] rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#25272B]">
                Unresolved Queue by Smart Priority
              </h3>
              <button
                type="button"
                onClick={() => selectSection('priority-queue')}
                className="text-xs font-semibold text-[#4169E1] hover:text-[#2B50C7] cursor-pointer"
              >
                Open Priority Queue →
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] space-y-0.5">
                <div className="text-[#B91C1C] font-semibold">Critical (80+)</div>
                <div className="text-xl font-display font-bold text-[#B91C1C] tabular-nums">
                  {metrics.criticalUnresolved}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#FFF7ED] border border-[#FED7AA] space-y-0.5">
                <div className="text-[#B45309] font-semibold">High (60–79)</div>
                <div className="text-xl font-display font-bold text-[#B45309] tabular-nums">
                  {metrics.highUnresolved}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#EEF2FF] border border-[#C7D2FE] space-y-0.5">
                <div className="text-[#2B50C7] font-semibold">Medium (30–59)</div>
                <div className="text-xl font-display font-bold text-[#2B50C7] tabular-nums">
                  {metrics.mediumUnresolved}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#FAF9F6] border border-[#E3E4E0] space-y-0.5">
                <div className="text-[#555B64] font-semibold">Low (0–29)</div>
                <div className="text-xl font-display font-bold text-[#25272B] tabular-nums">
                  {metrics.lowUnresolved}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* High-Priority Queue + Map Preview + Recent Activity */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          {/* Top High-Priority Queue */}
          <div className="xl:col-span-7 bg-white border border-[#E3E4E0] rounded-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-[#E3E4E0] flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#25272B]">
                  Immediate Priority Dispatch Queue
                </h3>
                <p className="text-xs text-[#555B64]">
                  Highest-scoring unresolved civic issues requiring officer review
                </p>
              </div>
              <button
                type="button"
                onClick={() => selectSection('priority-queue')}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#4169E1] bg-[#EEF2FF] hover:bg-[#E0E7FF] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>View Full Queue ({urgentQueueAll.length})</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-[#E3E4E0]">
              {urgentQueueAll.slice(0, 6).map((c) => {
                const ev = evaluationsById[c.id];
                return (
                  <div
                    key={c.id}
                    className="px-5 py-3.5 hover:bg-[#FAF9F6] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#25272B] tabular-nums">
                          {c.reference_number}
                        </span>
                        {ev && (
                          <PriorityLevelBadge level={ev.level} score={ev.score} compact />
                        )}
                        {renderStatusPill(c.status)}
                        <span className="text-xs font-semibold text-[#555B64]">
                          {c.category}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-[#25272B] truncate">
                        {c.title}
                      </div>
                      <p className="text-xs text-[#555B64] line-clamp-1">
                        {ev?.conciseExplanation || `${c.locality} · ${c.landmark}`}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => inspectComplaintRecord(c)}
                      className="inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#202329] hover:bg-[#2F333C] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <span>Inspect / Manage</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Map Hotspot Preview + Recent Audit Activity */}
          <div className="xl:col-span-5 space-y-5">
            <AdminHotspotsMap
              complaints={complaints}
              evaluationsById={evaluationsById}
              isDemoMode={isDemoMode}
              compactPreview
              onInspectComplaint={inspectComplaintRecord}
              onOpenFullMap={() => selectSection('map-hotspots')}
            />

            <div className="bg-white border border-[#E3E4E0] rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#25272B]">
                  Recent Audit Activity
                </h3>
                <button
                  type="button"
                  onClick={() => selectSection('audit-log')}
                  className="text-xs font-semibold text-[#4169E1] hover:text-[#2B50C7] cursor-pointer"
                >
                  Full Log →
                </button>
              </div>

              <div className="space-y-2.5">
                {unifiedAuditEntries.slice(0, 4).map((entry) => (
                  <div
                    key={entry.id}
                    className="p-2.5 rounded-xl bg-[#FAF9F6] border border-[#E3E4E0] text-xs space-y-0.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#25272B]">
                        {entry.referenceNumber
                          ? `${entry.referenceNumber} · ${entry.actionLabel}`
                          : entry.actionLabel}
                      </span>
                      <span className="font-mono text-[11px] text-[#70757D] tabular-nums whitespace-nowrap shrink-0">
                        {new Date(entry.timestamp).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short'
                        })}
                      </span>
                    </div>
                    <p className="text-[#555B64] line-clamp-1">{entry.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ===========================================================================
  // VIEW 2: ALL COMPLAINTS — CENTRAL REGISTRY TABLE
  // ===========================================================================
  const renderAllComplaintsSection = () => {
    return (
      <div className="space-y-4">
        {/* Filter & Export Toolbar */}
        <div className="bg-white border border-[#E3E4E0] rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#555B64]">
              <Filter className="w-3.5 h-3.5 text-[#4169E1]" />
              <span>
                Showing{' '}
                <strong className="text-[#25272B] tabular-nums">
                  {filteredCentralComplaints.length}
                </strong>{' '}
                of{' '}
                <strong className="text-[#25272B] tabular-nums">{complaints.length}</strong>{' '}
                complaints
              </span>
              {isDemoMode && (
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-[#FAF9F6] text-[#555B64] border border-[#E3E4E0] rounded-md">
                  Demo Data
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setWeightsModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#25272B] bg-[#FAF9F6] hover:bg-[#ECEBE6] border border-[#E3E4E0] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#4169E1]" />
                <span>Priority Weights</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  exportComplaintsToCsv(filteredCentralComplaints, 'urbanfix-complaints-export')
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#202329] hover:bg-[#2F333C] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV ({filteredCentralComplaints.length})</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
            <div className="relative lg:col-span-2">
              <Search className="w-3.5 h-3.5 text-[#70757D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Ref ID, title, street, citizen, department..."
                className="w-full pl-8 pr-3 py-2 text-xs bg-[#FAF9F6] border border-[#E3E4E0] rounded-lg text-[#25272B] placeholder:text-[#70757D] focus:outline-none focus:ring-2 focus:ring-[#4169E1]"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as 'ALL' | ComplaintCategory)}
              aria-label="Filter by category"
              className="px-3 py-2 text-xs bg-[#FAF9F6] border border-[#E3E4E0] rounded-lg text-[#25272B] focus:outline-none focus:ring-2 focus:ring-[#4169E1]"
            >
              <option value="ALL">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'ALL' | 'UNRESOLVED' | ComplaintStatus)
              }
              aria-label="Filter by status"
              className="px-3 py-2 text-xs bg-[#FAF9F6] border border-[#E3E4E0] rounded-lg text-[#25272B] focus:outline-none focus:ring-2 focus:ring-[#4169E1]"
            >
              <option value="ALL">All Statuses</option>
              <option value="UNRESOLVED">Unresolved Only</option>
              <option value="Submitted">Submitted</option>
              <option value="In Progress">In Progress</option>
              <option value="Reopened">Reopened</option>
              <option value="Resolved">Resolved</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) =>
                setPriorityFilter(e.target.value as 'ALL' | ComputedPriorityLevel)
              }
              aria-label="Filter by computed priority"
              className="px-3 py-2 text-xs bg-[#FAF9F6] border border-[#E3E4E0] rounded-lg text-[#25272B] focus:outline-none focus:ring-2 focus:ring-[#4169E1]"
            >
              <option value="ALL">All Priority Levels</option>
              <option value="Critical">Critical (80–100)</option>
              <option value="High">High (60–79)</option>
              <option value="Medium">Medium (30–59)</option>
              <option value="Low">Low (0–29)</option>
            </select>

            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              aria-label="Sort complaints"
              className="px-3 py-2 text-xs bg-[#FAF9F6] border border-[#E3E4E0] rounded-lg text-[#25272B] font-semibold focus:outline-none focus:ring-2 focus:ring-[#4169E1]"
            >
              <option value="HIGHEST_PRIORITY">Sort: Highest Priority</option>
              <option value="OLDEST_UNRESOLVED">Sort: Oldest Unresolved</option>
              <option value="LONGEST_WAITING">Sort: Longest Waiting</option>
              <option value="NEWEST">Sort: Newest Submitted</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-[#555B64]">Date Window:</span>
              {(
                [
                  ['ALL', 'All Time'],
                  ['24H', 'Last 24h'],
                  ['7D', 'Last 7 Days'],
                  ['30D', 'Last 30 Days']
                ] as [DateRangeFilter, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDateRangeFilter(id)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    dateRangeFilter === id
                      ? 'bg-[#202329] text-white'
                      : 'bg-[#FAF9F6] text-[#555B64] hover:text-[#25272B] border border-[#E3E4E0]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value as 'ALL' | MunicipalDepartment)}
                aria-label="Filter by assigned department"
                className="px-2.5 py-1 text-[11px] bg-[#FAF9F6] border border-[#E3E4E0] rounded-md text-[#25272B]"
              >
                <option value="ALL">All Departments</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              {(searchQuery ||
                categoryFilter !== 'ALL' ||
                statusFilter !== 'ALL' ||
                priorityFilter !== 'ALL' ||
                deptFilter !== 'ALL' ||
                dateRangeFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCategoryFilter('ALL');
                    setStatusFilter('ALL');
                    setPriorityFilter('ALL');
                    setDeptFilter('ALL');
                    setDateRangeFilter('ALL');
                  }}
                  className="text-xs font-semibold text-[#B91C1C] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* High-Density Responsive Table */}
        <div className="bg-white border border-[#E3E4E0] rounded-2xl overflow-hidden">
          {paginatedCentralComplaints.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <p className="text-sm font-bold text-[#25272B]">
                No complaints match your active filters.
              </p>
              <p className="text-xs text-[#555B64]">
                Try broadening the search terms, date window, or priority filter.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#FAF9F6] border-b border-[#E3E4E0] text-[11px] font-bold uppercase tracking-wider text-[#555B64]">
                    <th className="py-3 px-4 whitespace-nowrap">Ref ID</th>
                    <th className="py-3 px-4">Complaint & Citizen</th>
                    <th className="py-3 px-3 whitespace-nowrap">Category</th>
                    <th className="py-3 px-3">Locality / Ward</th>
                    <th className="py-3 px-3 whitespace-nowrap">Smart Priority</th>
                    <th className="py-3 px-3 whitespace-nowrap">Status</th>
                    <th className="py-3 px-3">Assigned Dept</th>
                    <th className="py-3 px-3 whitespace-nowrap">Waiting</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E4E0] text-xs">
                  {paginatedCentralComplaints.map((c) => {
                    const ev = evaluationsById[c.id];
                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-[#FAF9F6] transition-colors align-top"
                      >
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-mono font-bold text-[#25272B] tabular-nums">
                            {c.reference_number}
                          </div>
                          <div className="text-[11px] text-[#70757D] tabular-nums">
                            {new Date(c.created_at).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short'
                            })}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 min-w-[230px] max-w-xs">
                          <div className="font-semibold text-[#25272B] leading-snug line-clamp-2">
                            {c.title}
                          </div>
                          <div className="text-[11px] text-[#555B64] mt-0.5">
                            Citizen: {c.owner_name || 'Verified Citizen'} · Severity:{' '}
                            {c.priority || 'Medium'}
                          </div>
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md font-semibold bg-[#FAF9F6] text-[#25272B] border border-[#E3E4E0]">
                            {c.category}
                          </span>
                        </td>

                        <td className="py-3.5 px-3 min-w-[160px] max-w-[200px]">
                          <div className="font-medium text-[#25272B] truncate">
                            {c.area_name || c.locality}
                          </div>
                          <div className="text-[11px] text-[#70757D] truncate">
                            {c.landmark}
                          </div>
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {ev && (
                            <div className="space-y-1">
                              <PriorityLevelBadge
                                level={ev.level}
                                score={ev.score}
                                compact
                              />
                              {ev.nearestLandmark && ev.nearestLandmark.distanceMeters <= 550 && (
                                <div className="text-[10px] text-[#555B64] max-w-[170px] truncate">
                                  {ev.nearestLandmark.distanceMeters}m to{' '}
                                  {ev.nearestLandmark.landmark.typeLabel}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {renderStatusPill(c.status)}
                        </td>

                        <td className="py-3.5 px-3 min-w-[150px]">
                          <span
                            className={`text-xs ${
                              c.department === 'Unassigned'
                                ? 'font-semibold text-[#B45309]'
                                : 'text-[#25272B]'
                            }`}
                          >
                            {c.department}
                          </span>
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap font-mono tabular-nums">
                          {c.status === 'Resolved' ? (
                            <span className="text-[#047857]">Closed</span>
                          ) : (
                            <div className="space-y-0.5">
                              <div className="font-semibold text-[#25272B]">
                                {formatDurationCompact(ev?.hoursWaiting ?? 0)}
                              </div>
                              {ev?.isOverdueSla && (
                                <span className="inline-block text-[10px] font-sans font-bold text-[#B91C1C]">
                                  Past {ev.slaTargetHours}h SLA
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => inspectComplaintRecord(c)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#4169E1] hover:bg-[#3457C9] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <span>Inspect</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="px-5 py-3.5 bg-[#FAF9F6] border-t border-[#E3E4E0] flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="text-[#555B64] tabular-nums">
                Page <strong className="text-[#25272B]">{currentPage}</strong> of{' '}
                <strong className="text-[#25272B]">{totalPages}</strong> (
                {filteredCentralComplaints.length} records)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 font-semibold bg-white border border-[#D8D9D3] rounded-lg disabled:opacity-40 cursor-pointer"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 font-semibold bg-white border border-[#D8D9D3] rounded-lg disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ===========================================================================
  // VIEW 3: SMART PRIORITY QUEUE (EXPLAINABLE TRIAGE)
  // ===========================================================================
  const renderPriorityQueueSection = () => {
    const filteredQueue = urgentQueueAll.filter((c) => {
      const ev = evaluationsById[c.id];
      if (!ev) return false;
      if (priorityQueueTab === 'CRITICAL') return ev.level === 'Critical';
      if (priorityQueueTab === 'HIGH') return ev.level === 'High';
      if (priorityQueueTab === 'OVERDUE_SLA') return ev.isOverdueSla;
      if (priorityQueueTab === 'UNASSIGNED') return c.department === 'Unassigned';
      if (priorityQueueTab === 'CORROBORATED') return ev.relatedReports.length > 0;
      return true;
    });

    return (
      <div className="space-y-5">
        {/* Engine Banner & Controls */}
        <div className="bg-white border border-[#E3E4E0] rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-[#25272B]">
                  Explainable 6-Factor Civic Priority Engine
                </h3>
                <span className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-[#EEF2FF] text-[#2B50C7] border border-[#C7D2FE] rounded-md tabular-nums">
                  0–100 Normalized Scale
                </span>
              </div>
              <p className="text-xs text-[#555B64] leading-relaxed">
                Ranks active complaints using verifiable Severity ({weights.severity}), Haversine
                Public Landmark Proximity ({weights.publicLocationProximity}), Corridor Impact (
                {weights.trafficAndAreaImpact}), SLA Waiting Time ({weights.timeWaiting}), Spatial
                Corroboration ({weights.corroboratingReports}), and Safety-Risk Signals (
                {weights.safetyRisk}). Missing coordinates automatically normalize the denominator
                rather than assuming proximity from locality names.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleExplicitRecalculate}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#25272B] bg-[#FAF9F6] hover:bg-[#ECEBE6] border border-[#E3E4E0] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#4169E1]" />
                <span>Recalculate Now</span>
              </button>
              <button
                type="button"
                onClick={() => setWeightsModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#202329] hover:bg-[#2F333C] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Configure Weights</span>
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E3E4E0]">
            {(
              [
                ['ALL_UNRESOLVED', `All Active (${urgentQueueAll.length})`],
                ['CRITICAL', `Critical 80–100 (${metrics.criticalUnresolved})`],
                ['HIGH', `High 60–79 (${metrics.highUnresolved})`],
                ['OVERDUE_SLA', `Past SLA (${metrics.overdueSla})`],
                ['UNASSIGNED', `Unassigned Dept (${metrics.unassignedActive})`],
                [
                  'CORROBORATED',
                  `Possible Related Reports (${
                    urgentQueueAll.filter((c) => (evaluationsById[c.id]?.relatedReports.length ?? 0) > 0)
                      .length
                  })`
                ]
              ] as [typeof priorityQueueTab, string][]
            ).map(([tabId, label]) => (
              <button
                key={tabId}
                type="button"
                onClick={() => setPriorityQueueTab(tabId)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                  priorityQueueTab === tabId
                    ? 'bg-[#4169E1] text-white'
                    : 'bg-[#FAF9F6] text-[#555B64] hover:text-[#25272B] border border-[#E3E4E0]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Queue Cards with Inline Expandable "Why this priority?" */}
        {filteredQueue.length === 0 ? (
          <div className="bg-white border border-[#E3E4E0] rounded-2xl p-12 text-center text-xs text-[#555B64]">
            No unresolved complaints currently match this priority segment.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredQueue.slice(0, 30).map((c, idx) => {
              const ev = evaluationsById[c.id];
              if (!ev) return null;

              return (
                <div
                  key={c.id}
                  className="bg-white border border-[#E3E4E0] rounded-2xl p-4 sm:p-5 space-y-3"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="px-2 py-0.5 font-mono font-bold bg-[#202329] text-white rounded-md tabular-nums">
                          #{idx + 1}
                        </span>
                        <span className="font-mono font-bold text-[#25272B] tabular-nums">
                          {c.reference_number}
                        </span>
                        <span className="px-2 py-0.5 font-semibold bg-[#FAF9F6] text-[#25272B] border border-[#E3E4E0] rounded-md">
                          {c.category}
                        </span>
                        {renderStatusPill(c.status)}
                        <span className="text-[#555B64]">Dept: {c.department}</span>
                        {ev.relatedReports.length > 0 && (
                          <span className="px-2 py-0.5 text-[11px] font-semibold bg-[#EEF2FF] text-[#2B50C7] border border-[#C7D2FE] rounded-md tabular-nums">
                            {ev.relatedReports.length} possible related
                          </span>
                        )}
                      </div>

                      <h4 className="text-base font-bold text-[#25272B] leading-snug">
                        {c.title}
                      </h4>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#555B64]">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-[#4169E1]" />
                          <span>
                            {c.locality} · Near {c.landmark}
                          </span>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          Waiting {formatDurationCompact(ev.hoursWaiting)} (SLA: {ev.slaTargetHours}
                          h)
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => inspectComplaintRecord(c)}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#4169E1] hover:bg-[#3457C9] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <span>Inspect & Dispatch</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <PriorityBreakdownPanel evaluation={ev} compact />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ===========================================================================
  // VIEW 4–8: CATEGORY-WISE DEPARTMENT MANAGEMENT WINGS
  // ===========================================================================
  const renderDepartmentWingSection = (cfg: CategoryOpsConfig) => {
    const stat = categoryStats.find((s) => s.category === cfg.category)!;
    const categoryComplaints = complaints.filter((c) => c.category === cfg.category);
    const activeQuickRule =
      cfg.quickFilters.find((f) => f.id === deptSubFilter) || cfg.quickFilters[0];

    const filteredWingList = categoryComplaints
      .filter((c) => {
        const ev = evaluationsById[c.id];
        if (!ev) return false;
        if (!activeQuickRule.predicate(c, ev)) return false;
        if (deptStatusFilter === 'UNRESOLVED' && c.status === 'Resolved') return false;
        if (
          deptStatusFilter !== 'ALL' &&
          deptStatusFilter !== 'UNRESOLVED' &&
          c.status !== deptStatusFilter
        ) {
          return false;
        }
        if (deptSearch.trim()) {
          const q = deptSearch.trim().toLowerCase();
          const hit =
            c.reference_number.toLowerCase().includes(q) ||
            c.title.toLowerCase().includes(q) ||
            c.description.toLowerCase().includes(q) ||
            c.locality.toLowerCase().includes(q) ||
            c.landmark.toLowerCase().includes(q);
          if (!hit) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.status === 'Resolved' && b.status !== 'Resolved') return 1;
        if (a.status !== 'Resolved' && b.status === 'Resolved') return -1;
        return (evaluationsById[b.id]?.score ?? 0) - (evaluationsById[a.id]?.score ?? 0);
      });

    const Icon = cfg.icon;

    return (
      <div className="space-y-5">
        {/* Department Wing Operational Header */}
        <div className="bg-white border border-[#E3E4E0] rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3 max-w-3xl">
              <div className="w-10 h-10 rounded-xl bg-[#FAF9F6] border border-[#E3E4E0] flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-[#4169E1]" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-[#25272B]">{cfg.title}</h3>
                  <span className="px-2 py-0.5 text-[11px] font-semibold bg-[#FAF9F6] text-[#25272B] border border-[#E3E4E0] rounded-md">
                    Default Wing: {cfg.department}
                  </span>
                  <span className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-[#EEF2FF] text-[#2B50C7] border border-[#C7D2FE] rounded-md tabular-nums">
                    SLA Target: {cfg.slaHours}h
                  </span>
                </div>
                <p className="text-xs text-[#555B64] leading-relaxed">
                  {cfg.operationalFocus}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                exportComplaintsToCsv(
                  filteredWingList,
                  `urbanfix-${cfg.category.toLowerCase().replace(/\s+/g, '-')}`
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#202329] hover:bg-[#2F333C] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export {cfg.category} CSV</span>
            </button>
          </div>

          {/* 6 Category KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-[#FAF9F6] border border-[#E3E4E0]">
              <div className="text-[11px] font-semibold text-[#555B64]">Total in Wing</div>
              <div className="text-xl font-display font-bold text-[#25272B] tabular-nums">
                {stat.total}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#FFF7ED] border border-[#FED7AA]">
              <div className="text-[11px] font-semibold text-[#9A3412]">Pending Intake</div>
              <div className="text-xl font-display font-bold text-[#9A3412] tabular-nums">
                {stat.submittedCount}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#EEF2FF] border border-[#C7D2FE]">
              <div className="text-[11px] font-semibold text-[#2B50C7]">In Progress</div>
              <div className="text-xl font-display font-bold text-[#2B50C7] tabular-nums">
                {stat.inProgressCount}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0]">
              <div className="text-[11px] font-semibold text-[#047857]">Resolved</div>
              <div className="text-xl font-display font-bold text-[#047857] tabular-nums">
                {stat.resolvedCount}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA]">
              <div className="text-[11px] font-semibold text-[#B91C1C]">
                Critical & High Active
              </div>
              <div className="text-xl font-display font-bold text-[#B91C1C] tabular-nums">
                {stat.criticalOrHighCount}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#FAF9F6] border border-[#E3E4E0]">
              <div className="text-[11px] font-semibold text-[#555B64]">Avg Resolution</div>
              <div className="text-xl font-display font-bold text-[#25272B] tabular-nums">
                {stat.avgResHours !== null ? formatDurationCompact(stat.avgResHours) : 'N/A'}
              </div>
            </div>
          </div>

          {/* Domain-Specific Operational Quick Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E3E4E0]">
            <div className="flex flex-wrap items-center gap-2">
              {cfg.quickFilters.map((qf) => {
                const count = categoryComplaints.filter((c) => {
                  const ev = evaluationsById[c.id];
                  return ev ? qf.predicate(c, ev) : false;
                }).length;

                return (
                  <button
                    key={qf.id}
                    type="button"
                    onClick={() => setDeptSubFilter(qf.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                      deptSubFilter === qf.id
                        ? 'bg-[#4169E1] text-white'
                        : 'bg-[#FAF9F6] text-[#555B64] hover:text-[#25272B] border border-[#E3E4E0]'
                    }`}
                  >
                    {qf.label} ({count})
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#70757D] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={deptSearch}
                  onChange={(e) => setDeptSearch(e.target.value)}
                  placeholder={`Search ${cfg.category.toLowerCase()}...`}
                  className="pl-8 pr-3 py-1.5 text-xs bg-[#FAF9F6] border border-[#E3E4E0] rounded-lg text-[#25272B] focus:outline-none focus:ring-2 focus:ring-[#4169E1]"
                />
              </div>

              <select
                value={deptStatusFilter}
                onChange={(e) =>
                  setDeptStatusFilter(e.target.value as 'ALL' | 'UNRESOLVED' | ComplaintStatus)
                }
                aria-label="Filter wing status"
                className="px-2.5 py-1.5 text-xs bg-[#FAF9F6] border border-[#E3E4E0] rounded-lg text-[#25272B]"
              >
                <option value="ALL">All Statuses</option>
                <option value="UNRESOLVED">Active Queue Only</option>
                <option value="Submitted">Submitted</option>
                <option value="In Progress">In Progress</option>
                <option value="Reopened">Reopened</option>
                <option value="Resolved">Resolved</option>
              </select>
            </div>
          </div>
        </div>

        {/* Department Complaint List */}
        <div className="space-y-3">
          {filteredWingList.length === 0 ? (
            <div className="bg-white border border-[#E3E4E0] rounded-2xl p-10 text-center text-xs text-[#555B64]">
              No {cfg.category} complaints match the selected operational filter.
            </div>
          ) : (
            filteredWingList.map((c) => {
              const ev = evaluationsById[c.id];
              return (
                <div
                  key={c.id}
                  className="bg-white border border-[#E3E4E0] rounded-2xl p-4 sm:p-5 space-y-3"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono font-bold text-[#25272B] tabular-nums">
                          {c.reference_number}
                        </span>
                        {renderStatusPill(c.status)}
                        <span className="text-[#555B64]">
                          Assigned: <strong className="text-[#25272B]">{c.department}</strong>
                        </span>
                        <span className="text-[#70757D] tabular-nums">
                          Logged{' '}
                          {new Date(c.created_at).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                      </div>

                      <h4 className="text-sm sm:text-base font-bold text-[#25272B]">
                        {c.title}
                      </h4>

                      <p className="text-xs text-[#555B64] leading-relaxed line-clamp-2">
                        {c.description}
                      </p>

                      <div className="text-xs text-[#555B64] flex flex-wrap items-center gap-2 pt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-[#4169E1] shrink-0" />
                        <span>
                          {c.locality} · Landmark: {c.landmark}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => inspectComplaintRecord(c)}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#4169E1] hover:bg-[#3457C9] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <span>Inspect & Update</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {ev && <PriorityBreakdownPanel evaluation={ev} compact />}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  // ===========================================================================
  // VIEW 10: ANALYTICS & MUNICIPAL REPORTS
  // ===========================================================================
  const renderAnalyticsSection = () => {
    const wardAnalytics = CIVIC_AREAS.map((area) => {
      const items = complaints.filter(
        (c) =>
          (c.area_name || '').toLowerCase() === area.name.toLowerCase() ||
          c.locality.toLowerCase().includes(area.name.toLowerCase())
      );
      const active = items.filter((c) => c.status !== 'Resolved');
      const criticalOrHigh = active.filter((c) => {
        const lvl = evaluationsById[c.id]?.level;
        return lvl === 'Critical' || lvl === 'High';
      });
      const overdue = active.filter((c) => evaluationsById[c.id]?.isOverdueSla);

      const catCount = new Map<ComplaintCategory, number>();
      items.forEach((c) => catCount.set(c.category, (catCount.get(c.category) || 0) + 1));
      const topCategory =
        Array.from(catCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

      return {
        area,
        total: items.length,
        activeCount: active.length,
        resolvedCount: items.length - active.length,
        criticalOrHighCount: criticalOrHigh.length,
        overdueCount: overdue.length,
        topCategory
      };
    }).sort((a, b) => b.activeCount - a.activeCount);

    const deptDistribution = DEPARTMENTS.map((dept) => {
      const items = complaints.filter((c) => c.department === dept);
      const active = items.filter((c) => c.status !== 'Resolved');
      return {
        dept,
        total: items.length,
        active: active.length,
        resolved: items.length - active.length
      };
    });

    return (
      <div className="space-y-6">
        {renderDailyOperationsBrief()}

        {/* Category SLA & Resolution Performance Matrix */}
        <div className="bg-white border border-[#E3E4E0] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E3E4E0] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[#25272B]">
                Category SLA Compliance & Resolution Matrix
              </h3>
              <p className="text-xs text-[#555B64]">
                Computed strictly from recorded complaint statuses, timestamps, and category SLAs
              </p>
            </div>
            <button
              type="button"
              onClick={() => exportComplaintsToCsv(complaints, 'urbanfix-full-municipal-report')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#202329] hover:bg-[#2F333C] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Complete Registry CSV</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#FAF9F6] border-b border-[#E3E4E0] text-[11px] font-bold uppercase tracking-wider text-[#555B64]">
                  <th className="py-3 px-4">Civic Category</th>
                  <th className="py-3 px-3">SLA Target</th>
                  <th className="py-3 px-3">Total</th>
                  <th className="py-3 px-3">Active Queue</th>
                  <th className="py-3 px-3">Resolved</th>
                  <th className="py-3 px-3">Critical / High</th>
                  <th className="py-3 px-3">Past SLA</th>
                  <th className="py-3 px-3">Avg Active Score</th>
                  <th className="py-3 px-4">Avg Resolution Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E4E0] text-xs tabular-nums">
                {categoryStats.map((cat) => (
                  <tr key={cat.category} className="hover:bg-[#FAF9F6]">
                    <td className="py-3 px-4 font-bold text-[#25272B] font-sans">
                      {cat.navLabel}
                    </td>
                    <td className="py-3 px-3 font-mono">{cat.slaHours}h</td>
                    <td className="py-3 px-3 font-semibold">{cat.total}</td>
                    <td className="py-3 px-3 font-semibold text-[#4169E1]">
                      {cat.activeCount}
                    </td>
                    <td className="py-3 px-3 font-semibold text-[#047857]">
                      {cat.resolvedCount}
                    </td>
                    <td className="py-3 px-3 font-semibold text-[#B91C1C]">
                      {cat.criticalOrHighCount}
                    </td>
                    <td className="py-3 px-3 font-semibold text-[#F05B5B]">
                      {cat.overdueCount}
                    </td>
                    <td className="py-3 px-3 font-mono">{cat.avgActiveScore}/100</td>
                    <td className="py-3 px-4">
                      {cat.avgResHours !== null
                        ? formatDurationCompact(cat.avgResHours)
                        : 'No closed items'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ward Breakdown + Department Assignment Breakdown */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <div className="xl:col-span-7 bg-white border border-[#E3E4E0] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E3E4E0]">
              <h3 className="text-sm font-bold text-[#25272B]">
                Ward & Locality Concentration Across Greater Mumbai
              </h3>
              <p className="text-xs text-[#555B64]">
                Identifies high-demand municipal wards and primary civic pressure points
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#FAF9F6] border-b border-[#E3E4E0] text-[11px] font-bold uppercase tracking-wider text-[#555B64]">
                    <th className="py-2.5 px-4">Ward / Locality</th>
                    <th className="py-2.5 px-3">Total</th>
                    <th className="py-2.5 px-3">Unresolved</th>
                    <th className="py-2.5 px-3">Critical/High</th>
                    <th className="py-2.5 px-3">Past SLA</th>
                    <th className="py-2.5 px-4">Primary Issue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E4E0] text-xs tabular-nums">
                  {wardAnalytics.map((w) => (
                    <tr key={w.area.id} className="hover:bg-[#FAF9F6]">
                      <td className="py-3 px-4 font-sans">
                        <div className="font-bold text-[#25272B]">{w.area.name}</div>
                        <div className="text-[11px] text-[#70757D]">{w.area.ward}</div>
                      </td>
                      <td className="py-3 px-3 font-semibold">{w.total}</td>
                      <td className="py-3 px-3 font-semibold text-[#4169E1]">
                        {w.activeCount}
                      </td>
                      <td className="py-3 px-3 font-semibold text-[#B91C1C]">
                        {w.criticalOrHighCount}
                      </td>
                      <td className="py-3 px-3 text-[#F05B5B] font-semibold">
                        {w.overdueCount}
                      </td>
                      <td className="py-3 px-4 font-sans text-[#555B64]">{w.topCategory}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="xl:col-span-5 bg-white border border-[#E3E4E0] rounded-2xl p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[#25272B]">
                Assigned Municipal Department Load
              </h3>
              <p className="text-xs text-[#555B64]">
                Active dispatch queue vs completed resolutions per wing
              </p>
            </div>

            <div className="space-y-3">
              {deptDistribution.map((d) => {
                const maxDept = Math.max(1, ...deptDistribution.map((x) => x.total));
                const activePct = Math.round((d.active / maxDept) * 100);
                const resPct = Math.round((d.resolved / maxDept) * 100);

                return (
                  <div
                    key={d.dept}
                    className="p-3 rounded-xl bg-[#FAF9F6] border border-[#E3E4E0] space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-[#25272B] flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[#4169E1] shrink-0" />
                        <span>{d.dept}</span>
                      </span>
                      <span className="font-mono text-[11px] text-[#555B64] tabular-nums">
                        {d.active} active · {d.resolved} closed
                      </span>
                    </div>

                    <svg
                      viewBox="0 0 100 6"
                      preserveAspectRatio="none"
                      className="w-full h-1.5 rounded-full overflow-hidden block"
                      aria-hidden="true"
                    >
                      <rect x="0" y="0" width="100" height="6" fill="#E5E4DF" />
                      {activePct > 0 && (
                        <rect
                          x="0"
                          y="0"
                          width={activePct}
                          height="6"
                          fill={d.dept === 'Unassigned' ? '#E89A3C' : '#4169E1'}
                        />
                      )}
                      {resPct > 0 && (
                        <rect
                          x={activePct}
                          y="0"
                          width={resPct}
                          height="6"
                          fill="#2E9E6B"
                        />
                      )}
                    </svg>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ===========================================================================
  // VIEW 11: ADMIN ACTIVITY & IMMUTABLE AUDIT LOG
  // ===========================================================================
  const renderAuditLogSection = () => {
    const filteredAudit = unifiedAuditEntries.filter((entry) => {
      if (auditActionFilter !== 'ALL' && entry.actionType !== auditActionFilter) return false;
      if (auditSearch.trim()) {
        const q = auditSearch.trim().toLowerCase();
        const hit =
          (entry.referenceNumber || '').toLowerCase().includes(q) ||
          (entry.complaintTitle || '').toLowerCase().includes(q) ||
          entry.actorName.toLowerCase().includes(q) ||
          entry.note.toLowerCase().includes(q) ||
          entry.actionLabel.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });

    return (
      <div className="space-y-4">
        <div className="bg-white border border-[#E3E4E0] rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-[#555B64] space-y-0.5">
              <div className="font-bold text-[#25272B]">
                Audit Trail Provenance & Persistence Transparency
              </div>
              <p>
                Complaint lifecycle updates, department assignments, and category reclassifications
                persist to{' '}
                <code className="font-mono text-[#25272B]">
                  {isDemoMode ? 'demo status_history store' : 'Supabase public.status_history'}
                </code>
                . Heuristic weight adjustments and manual queue recalculations are tagged as{' '}
                <code className="font-mono text-[#25272B]">Session Operational Log</code>.
              </p>
            </div>

            <span className="px-2.5 py-1 text-xs font-mono font-semibold bg-[#FAF9F6] border border-[#E3E4E0] rounded-lg text-[#25272B] tabular-nums">
              {filteredAudit.length} events
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="relative sm:col-span-2">
              <Search className="w-3.5 h-3.5 text-[#70757D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Search by Ref ID, officer/actor name, or remark..."
                className="w-full pl-8 pr-3 py-2 text-xs bg-[#FAF9F6] border border-[#E3E4E0] rounded-lg text-[#25272B] focus:outline-none focus:ring-2 focus:ring-[#4169E1]"
              />
            </div>

            <select
              value={auditActionFilter}
              onChange={(e) =>
                setAuditActionFilter(e.target.value as 'ALL' | AdminAuditActionType)
              }
              aria-label="Filter audit events by type"
              className="px-3 py-2 text-xs bg-[#FAF9F6] border border-[#E3E4E0] rounded-lg text-[#25272B]"
            >
              <option value="ALL">All Recorded Event Types</option>
              <option value="status_transition">Status Transitions</option>
              <option value="department_assignment">Department Assignments</option>
              <option value="category_reclassified">Category Reclassifications</option>
              <option value="priority_weights_updated">Priority Weight Updates</option>
              <option value="priority_recalculated">Queue Recalculations</option>
              <option value="initial_submission">Initial Citizen Submissions</option>
            </select>
          </div>
        </div>

        <div className="bg-white border border-[#E3E4E0] rounded-2xl overflow-hidden">
          {filteredAudit.length === 0 ? (
            <div className="p-10 text-center text-xs text-[#555B64]">
              No recorded audit events match the current filter.
            </div>
          ) : (
            <div className="divide-y divide-[#E3E4E0]">
              {filteredAudit.slice(0, 80).map((entry) => {
                const targetComplaint = entry.complaintId
                  ? complaints.find((c) => c.id === entry.complaintId)
                  : undefined;

                return (
                  <div
                    key={entry.id}
                    className="px-5 py-3.5 hover:bg-[#FAF9F6] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 font-semibold rounded-md bg-[#EEF2FF] text-[#2B50C7] border border-[#C7D2FE]">
                          {entry.actionLabel}
                        </span>
                        {entry.referenceNumber && (
                          <span className="font-mono font-bold text-[#25272B] tabular-nums">
                            {entry.referenceNumber}
                          </span>
                        )}
                        <span className="text-[#555B64]">
                          Actor: <strong className="text-[#25272B]">{entry.actorName}</strong>
                        </span>
                        <span className="font-mono text-[11px] text-[#70757D] tabular-nums">
                          {new Date(entry.timestamp).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-mono bg-[#FAF9F6] text-[#555B64] border border-[#E3E4E0] rounded">
                          {entry.persistenceScope === 'supabase_status_history'
                            ? 'Supabase status_history'
                            : entry.persistenceScope === 'demo_status_history'
                            ? 'Demo status_history'
                            : 'Session Operational Log'}
                        </span>
                      </div>

                      <p className="text-[#25272B] leading-relaxed">{entry.note}</p>
                    </div>

                    {targetComplaint && (
                      <button
                        type="button"
                        onClick={() => inspectComplaintRecord(targetComplaint)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#4169E1] bg-white hover:bg-[#EEF2FF] border border-[#E3E4E0] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <span>Open Complaint</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ===========================================================================
  // MAIN SHELL LAYOUT
  // ===========================================================================
  const currentMeta = sectionHeaderMeta[activeSection];

  return (
    <div className="min-h-screen flex bg-[#F4F3EF] text-[#25272B]">
      {/* Desktop Collapsible Graphite Sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 sticky top-0 h-screen transition-all duration-200 z-30 ${
          sidebarCollapsed ? 'w-18' : 'w-64'
        }`}
      >
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#202329]/60 backdrop-blur-[2px]"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-72 max-w-[85vw] h-full z-10 shadow-2xl">
            {renderSidebarContent(true)}
          </div>
        </div>
      )}

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sticky Top Command Bar */}
        <header className="sticky top-0 z-20 bg-[#F4F3EF]/95 backdrop-blur-md border-b border-[#E3E4E0] px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-white border border-[#E3E4E0] text-[#25272B] cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-display font-bold text-[#25272B] truncate">
                  {currentMeta.title}
                </h1>
                {isDemoMode && (
                  <span className="px-2 py-0.5 text-[11px] font-semibold bg-white text-[#555B64] border border-[#E3E4E0] rounded-md whitespace-nowrap shrink-0">
                    Demo Mode · 90 Civic Records
                  </span>
                )}
                {aiServerAvailable !== null && (
                  <span
                    className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-md border whitespace-nowrap shrink-0 ${
                      aiServerAvailable
                        ? 'bg-[#EEF2FF] text-[#2B50C7] border-[#C7D2FE]'
                        : 'bg-white text-[#555B64] border-[#E3E4E0]'
                    }`}
                  >
                    <Activity className="w-3 h-3" />
                    <span>
                      {aiServerAvailable
                        ? 'Gemini AI Triage Ready'
                        : 'Rule-Based Triage Fallback'}
                    </span>
                  </span>
                )}
              </div>
              <p className="text-xs text-[#555B64] hidden sm:block truncate">
                {currentMeta.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isDemoMode &&
              (!confirmingReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmingReset(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#555B64] hover:text-[#25272B] bg-white border border-[#E3E4E0] hover:bg-[#FAF9F6] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Reset Demo Data</span>
                </button>
              ) : (
                <div className="inline-flex items-center gap-1.5 bg-[#FFF7ED] border border-[#FED7AA] px-2.5 py-1 rounded-xl">
                  <span className="text-xs font-semibold text-[#9A3412]">Reset 90 records?</span>
                  <button
                    type="button"
                    disabled={resettingDemo}
                    onClick={handleConfirmResetDemo}
                    className="px-2 py-0.5 text-xs font-bold text-white bg-[#B91C1C] rounded-md cursor-pointer"
                  >
                    {resettingDemo ? '...' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingReset(false)}
                    className="px-2 py-0.5 text-xs font-semibold text-[#555B64] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ))}

            <button
              type="button"
              onClick={() => selectSection('priority-queue')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#4169E1] hover:bg-[#3457C9] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>
                Urgent ({metrics.criticalUnresolved + metrics.highUnresolved})
              </span>
            </button>
          </div>
        </header>

        {/* Main Viewport Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          {loading ? (
            <div className="bg-white border border-[#E3E4E0] rounded-2xl p-12 text-center space-y-2">
              <RefreshCw className="w-6 h-6 text-[#4169E1] animate-spin mx-auto" />
              <div className="text-sm font-bold text-[#25272B]">
                Synchronizing Municipal Complaint Queue...
              </div>
              <p className="text-xs text-[#555B64]">
                Evaluating priority scores and status audit timelines.
              </p>
            </div>
          ) : (
            <>
              {activeSection === 'overview' && renderOverviewSection()}
              {activeSection === 'all-complaints' && renderAllComplaintsSection()}
              {activeSection === 'priority-queue' && renderPriorityQueueSection()}
              {activeDeptConfig && renderDepartmentWingSection(activeDeptConfig)}
              {activeSection === 'map-hotspots' && (
                <AdminHotspotsMap
                  complaints={complaints}
                  evaluationsById={evaluationsById}
                  isDemoMode={isDemoMode}
                  onInspectComplaint={inspectComplaintRecord}
                />
              )}
              {activeSection === 'analytics' && renderAnalyticsSection()}
              {activeSection === 'audit-log' && renderAuditLogSection()}
            </>
          )}
        </main>
      </div>

      {/* Heuristic Priority Weights Configuration Modal */}
      <PriorityWeightsModal
        isOpen={weightsModalOpen}
        weights={weights}
        onClose={() => setWeightsModalOpen(false)}
        onSaveWeights={handleSaveWeights}
        onResetDefaultWeights={handleResetDefaultWeights}
      />
    </div>
  );
};
