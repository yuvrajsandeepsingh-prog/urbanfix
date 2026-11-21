import {
  CATEGORIES,
  Complaint,
  ComplaintCategory
} from '../types/urbanfix';
import {
  evaluateCoordinatePrecision,
  PriorityEvaluation
} from './priorityEngine';

export interface AdminComplaintAiAnalysis {
  source: 'gemini' | 'deterministic';
  modelLabel: string;
  generatedAt: string;
  fallbackReason?: string;
  summary: {
    mainProblem: string;
    potentialImpact: string;
    importantDetails: string;
    missingInformation: string;
  };
  categorization: {
    currentCategory: ComplaintCategory;
    suggestedCategory: ComplaintCategory;
    matchesCurrent: boolean;
    rationale: string;
  };
  priorityNarrative: string;
}

export interface AdminDailyOperationsBrief {
  source: 'gemini' | 'deterministic';
  modelLabel: string;
  generatedAt: string;
  fallbackReason?: string;
  recordedFactsSummary: string[];
  hotspotObservations: string[];
  suggestedFollowUpActions: string[];
}

const complaintAnalysisCache = new Map<string, AdminComplaintAiAnalysis>();
const dailyBriefCache = new Map<string, AdminDailyOperationsBrief>();

function scrubClientText(input: string): string {
  return input
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/\b(?:\+?91[-\s]?)?[6-9]\d{9}\b/g, '[redacted-phone]')
    .trim();
}

const CATEGORY_LEXICON: Record<ComplaintCategory, { terms: RegExp; label: string }[]> = {
  Roads: [
    { terms: /\bpothole|crater|asphalt|bitumen\b/i, label: 'pothole/asphalt surface damage' },
    { terms: /\bpaver|footpath|pavement|curb|divider\b/i, label: 'footpath/paver/divider defect' },
    { terms: /\btrench|resurfacing|carriageway|lane depression\b/i, label: 'excavated trench/carriageway hazard' }
  ],
  'Waste Management': [
    { terms: /\bgarbage|trash|refuse|litter|rubbish\b/i, label: 'uncollected municipal waste' },
    { terms: /\bbin|compactor|skip|dumper\b/i, label: 'community bin/collection container overflow' },
    { terms: /\bdebris|dumping|organic waste|collection\b/i, label: 'roadside dumping/missed collection' }
  ],
  Drainage: [
    { terms: /\bsewage|sewer|wastewater|effluent\b/i, label: 'sewage/wastewater discharge' },
    { terms: /\bdrain|stormwater|culvert|gully|grate|silt\b/i, label: 'stormwater drain/grate obstruction' },
    { terms: /\bmanhole|chamber|waterlog|backflow\b/i, label: 'inspection chamber/waterlogging hazard' }
  ],
  'Water Supply': [
    { terms: /\bwater main|pipeline|pipe|sluice valve|hydrant|ferrule\b/i, label: 'municipal water pipeline/valve defect' },
    { terms: /\bleak|leaking|gushing|burst\b/i, label: 'active treated-water leakage' },
    { terms: /\blow pressure|no water|supply|turbid|discolored|contaminated\b/i, label: 'water supply pressure/quality issue' }
  ],
  Streetlights: [
    { terms: /\bstreetlight|lamp|luminaire|led fixture|floodlight\b/i, label: 'street lighting luminaire fault' },
    { terms: /\bunlit|pitch dark|dark stretch|flicker|daytime burning|timer\b/i, label: 'corridor illumination/timer failure' },
    { terms: /\bpole|feeder pillar|junction box|cable\b/i, label: 'electrical pole/junction box issue' }
  ]
};

/**
 * Deterministic, non-fabricated rule-based complaint analysis.
 * Used immediately for instant zero-latency inspection and as an automatic fallback
 * whenever Gemini API is unavailable or rate-limited.
 */
export function buildDeterministicComplaintAnalysis(
  complaint: Complaint,
  evaluation: PriorityEvaluation
): AdminComplaintAiAnalysis {
  const combined = `${complaint.title}. ${complaint.description}`;
  const coordInfo = evaluateCoordinatePrecision(complaint);

  // 1) Categorization check via keyword lexicon
  const categoryHits: { category: ComplaintCategory; matchedLabels: string[] }[] = CATEGORIES.map(
    (c) => {
      const matchedLabels = CATEGORY_LEXICON[c.id]
        .filter((rule) => rule.terms.test(combined))
        .map((rule) => rule.label);
      return { category: c.id, matchedLabels };
    }
  ).sort((a, b) => b.matchedLabels.length - a.matchedLabels.length);

  const topMatch = categoryHits[0];
  const currentMatchCount =
    categoryHits.find((c) => c.category === complaint.category)?.matchedLabels.length ?? 0;

  let suggestedCategory: ComplaintCategory = complaint.category;
  let rationale = '';

  if (topMatch && topMatch.matchedLabels.length > currentMatchCount && topMatch.matchedLabels.length >= 1) {
    suggestedCategory = topMatch.category;
    rationale = `Complaint text references ${topMatch.matchedLabels.join(
      ' and '
    )}, which aligns more closely with ${topMatch.category} than the currently filed ${
      complaint.category
    } category.`;
  } else if (currentMatchCount > 0) {
    const matchedForCurrent =
      categoryHits.find((c) => c.category === complaint.category)?.matchedLabels || [];
    rationale = `Current category (${complaint.category}) is directly supported by ${matchedForCurrent.join(
      ' and '
    )} described in the report.`;
  } else {
    rationale = `Retaining citizen-selected category (${complaint.category}); no conflicting service keywords detected in title or description.`;
  }

  // 2) Structured summary grounded strictly in submitted fields
  const sentences = complaint.description
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const mainProblem = `${complaint.title} reported in ${complaint.locality}.`;
  const potentialImpact =
    sentences.length > 1
      ? sentences[sentences.length - 1]
      : `Affects public civic access near ${complaint.landmark} (${complaint.category} SLA: ${evaluation.slaTargetHours}h).`;
  const importantDetails = `Landmark: ${complaint.landmark} · Department: ${
    complaint.department
  } · Status: ${complaint.status}${
    evaluation.nearestLandmark && evaluation.nearestLandmark.distanceMeters <= 550
      ? ` · ${evaluation.nearestLandmark.distanceMeters}m from ${evaluation.nearestLandmark.landmark.name}`
      : ''
  }.`;

  const missingItems: string[] = [];
  if (!complaint.image_path) missingItems.push('no field photograph attached');
  if (!coordInfo.hasStreetLevelPin) missingItems.push('exact street-level coordinate pin not recorded');
  if (complaint.department === 'Unassigned') missingItems.push('municipal department not yet assigned');

  const missingInformation =
    missingItems.length > 0
      ? `Intake/dispatch gaps: ${missingItems.join('; ')}.`
      : 'All standard intake fields (description, landmark, coordinates, and department) are present.';

  // 3) Priority narrative grounded strictly in deterministic factor points
  const topFactors = [...evaluation.factors]
    .filter((f) => f.available && f.awardedPoints > 0)
    .sort((a, b) => b.awardedPoints - a.awardedPoints)
    .slice(0, 3)
    .map((f) => `${f.label.toLowerCase()} (${f.awardedPoints}/${f.maxPoints} pts: ${f.evidenceSummary})`);

  const priorityNarrative =
    topFactors.length > 0
      ? `Assigned ${evaluation.score}/100 (${evaluation.level}) primarily driven by ${topFactors.join(
          '; '
        )}.${
          evaluation.isNormalizedForMissingData
            ? ' Score denominator was normalized so unavailable coordinate factors do not unfairly penalize this report.'
            : ''
        }`
      : `Assigned ${evaluation.score}/100 (${evaluation.level}) based on recorded ${
          complaint.category
        } status (${complaint.status}) and available intake fields.`;

  return {
    source: 'deterministic',
    modelLabel: 'Rule-Based Explainable Triage (Local Fallback)',
    generatedAt: new Date().toISOString(),
    summary: {
      mainProblem,
      potentialImpact,
      importantDetails,
      missingInformation
    },
    categorization: {
      currentCategory: complaint.category,
      suggestedCategory,
      matchesCurrent: suggestedCategory === complaint.category,
      rationale
    },
    priorityNarrative
  };
}

export async function checkAdminAiServerStatus(): Promise<{
  available: boolean;
  model: string | null;
}> {
  try {
    const res = await fetch('/api/admin/ai/status');
    if (!res.ok) return { available: false, model: null };
    const data = (await res.json()) as { available?: boolean; model?: string | null };
    return {
      available: Boolean(data.available),
      model: data.model || null
    };
  } catch {
    return { available: false, model: null };
  }
}

export async function requestComplaintAiAnalysis(
  complaint: Complaint,
  evaluation: PriorityEvaluation,
  options?: { forceRefresh?: boolean }
): Promise<AdminComplaintAiAnalysis> {
  const cacheKey = `${complaint.id}:${complaint.updated_at}:${complaint.category}:${evaluation.score}`;
  if (!options?.forceRefresh && complaintAnalysisCache.has(cacheKey)) {
    return complaintAnalysisCache.get(cacheKey)!;
  }

  const coordInfo = evaluateCoordinatePrecision(complaint);
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 22000);

  try {
    // Strictly send ONLY civic issue attributes — never citizen name, email, or user ID
    const res = await fetch('/api/admin/ai/analyze-complaint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        referenceNumber: complaint.reference_number,
        category: complaint.category,
        title: scrubClientText(complaint.title),
        description: scrubClientText(complaint.description),
        locality: scrubClientText(complaint.locality),
        landmark: scrubClientText(complaint.landmark),
        status: complaint.status,
        recordedSeverity: complaint.priority || 'Medium',
        hasFieldPhoto: Boolean(complaint.image_path),
        hasStreetLevelPin: coordInfo.hasStreetLevelPin,
        computedScore: evaluation.score,
        computedLevel: evaluation.level,
        factors: evaluation.factors.map((f) => ({
          label: f.label,
          awardedPoints: f.awardedPoints,
          maxPoints: f.maxPoints,
          available: f.available,
          evidenceSummary: f.evidenceSummary
        })),
        missingEvidence: evaluation.missingEvidence
      })
    });

    window.clearTimeout(timeoutId);

    const payload = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      model?: string;
      error?: string;
      analysis?: {
        summary: AdminComplaintAiAnalysis['summary'];
        categorization: {
          suggestedCategory: ComplaintCategory;
          rationale: string;
        };
        priorityNarrative: string;
      };
    };

    if (!res.ok || !payload.ok || !payload.analysis) {
      const fallback = buildDeterministicComplaintAnalysis(complaint, evaluation);
      fallback.fallbackReason =
        payload.error || 'Gemini AI endpoint unavailable; displaying verified rule-based analysis.';
      return fallback;
    }

    const suggested = payload.analysis.categorization.suggestedCategory;
    const result: AdminComplaintAiAnalysis = {
      source: 'gemini',
      modelLabel: `Gemini AI (${payload.model || 'gemini-3.1-flash-lite'})`,
      generatedAt: new Date().toISOString(),
      summary: payload.analysis.summary,
      categorization: {
        currentCategory: complaint.category,
        suggestedCategory: suggested,
        matchesCurrent: suggested === complaint.category,
        rationale: payload.analysis.categorization.rationale
      },
      priorityNarrative: payload.analysis.priorityNarrative
    };

    complaintAnalysisCache.set(cacheKey, result);
    return result;
  } catch (err) {
    window.clearTimeout(timeoutId);
    const fallback = buildDeterministicComplaintAnalysis(complaint, evaluation);
    fallback.fallbackReason =
      err instanceof Error && err.name === 'AbortError'
        ? 'AI request timed out; displaying local deterministic analysis.'
        : 'AI service unreachable; displaying local deterministic analysis.';
    return fallback;
  }
}

export function buildDeterministicDailyBrief(
  complaints: Complaint[],
  evaluationsById: Record<string, PriorityEvaluation>,
  isDemoMode: boolean
): AdminDailyOperationsBrief {
  const total = complaints.length;
  const unresolved = complaints.filter((c) => c.status !== 'Resolved');
  const pendingCount = complaints.filter((c) => c.status === 'Submitted').length;
  const inProgressCount = complaints.filter((c) => c.status === 'In Progress').length;
  const resolvedCount = complaints.filter((c) => c.status === 'Resolved').length;
  const reopenedCount = complaints.filter((c) => c.status === 'Reopened').length;
  const unassignedCount = unresolved.filter((c) => c.department === 'Unassigned').length;

  const criticalUnresolved = unresolved.filter(
    (c) => evaluationsById[c.id]?.level === 'Critical'
  );
  const highUnresolved = unresolved.filter((c) => evaluationsById[c.id]?.level === 'High');
  const overdueSla = unresolved.filter((c) => evaluationsById[c.id]?.isOverdueSla);

  // Category concentration
  const catCounts = CATEGORIES.map((cat) => {
    const active = unresolved.filter((c) => c.category === cat.id);
    const overdue = active.filter((c) => evaluationsById[c.id]?.isOverdueSla);
    return {
      category: cat.id,
      activeCount: active.length,
      overdueCount: overdue.length,
      slaHours: cat.slaHours,
      defaultDepartment: cat.defaultDepartment
    };
  }).sort((a, b) => b.activeCount - a.activeCount);

  // Locality concentration
  const areaMap = new Map<string, { area: string; active: number; urgent: number }>();
  for (const c of unresolved) {
    const areaKey = c.area_name || c.locality.split(',')[0].trim();
    const cur = areaMap.get(areaKey) || { area: areaKey, active: 0, urgent: 0 };
    cur.active += 1;
    const lvl = evaluationsById[c.id]?.level;
    if (lvl === 'Critical' || lvl === 'High') cur.urgent += 1;
    areaMap.set(areaKey, cur);
  }
  const topAreas = Array.from(areaMap.values()).sort(
    (a, b) => b.urgent - a.urgent || b.active - a.active
  );

  const topUrgent = [...unresolved]
    .sort((a, b) => (evaluationsById[b.id]?.score ?? 0) - (evaluationsById[a.id]?.score ?? 0))
    .slice(0, 3);

  const recordedFactsSummary: string[] = [
    `${total} total complaints on record${
      isDemoMode ? ' (Demonstration Dataset)' : ''
    }: ${unresolved.length} active (${pendingCount} Submitted, ${inProgressCount} In Progress, ${reopenedCount} Reopened) and ${resolvedCount} Resolved.`,
    `${criticalUnresolved.length} Critical-priority and ${highUnresolved.length} High-priority unresolved complaints currently in queue; ${overdueSla.length} active complaints exceed their category SLA window.`,
    catCounts[0]
      ? `Highest active departmental backlog is ${catCounts[0].category} (${catCounts[0].activeCount} unresolved, ${catCounts[0].overdueCount} past ${catCounts[0].slaHours}h SLA).`
      : 'No active category backlog recorded.'
  ];

  const hotspotObservations: string[] = [];
  if (topAreas[0]) {
    hotspotObservations.push(
      `${topAreas[0].area} has the highest concentration of urgent issues (${topAreas[0].urgent} Critical/High out of ${topAreas[0].active} unresolved reports).`
    );
  }
  if (topAreas[1]) {
    hotspotObservations.push(
      `${topAreas[1].area} follows with ${topAreas[1].active} unresolved reports (${topAreas[1].urgent} Critical/High priority).`
    );
  }
  const wasteOverdue = catCounts.find((c) => c.category === 'Waste Management');
  if (wasteOverdue && wasteOverdue.overdueCount > 0) {
    hotspotObservations.push(
      `Waste Management has ${wasteOverdue.overdueCount} uncollected sanitation report(s) exceeding the 24-hour ward clearance target.`
    );
  }

  const suggestedFollowUpActions: string[] = [];
  if (topUrgent[0]) {
    const ev = evaluationsById[topUrgent[0].id];
    suggestedFollowUpActions.push(
      `Prioritize immediate officer review for ${topUrgent[0].reference_number} (${topUrgent[0].category}, ${ev?.score ?? 0}/100) near ${topUrgent[0].landmark}.`
    );
  }
  if (unassignedCount > 0) {
    suggestedFollowUpActions.push(
      `Route the ${unassignedCount} unassigned complaint(s) in Submitted/Reopened state to their respective municipal wings.`
    );
  } else if (overdueSla.length > 0) {
    suggestedFollowUpActions.push(
      `Audit field progress notes on the ${overdueSla.length} SLA-overdue unresolved complaint(s), starting with Reopened and 24h Waste Management items.`
    );
  }
  if (catCounts[0] && catCounts[0].activeCount > 0) {
    suggestedFollowUpActions.push(
      `Coordinate cluster dispatch with ${catCounts[0].defaultDepartment} for grouped corridors on the Map & Hotspots view.`
    );
  }

  return {
    source: 'deterministic',
    modelLabel: 'Deterministic Queue Digest',
    generatedAt: new Date().toISOString(),
    recordedFactsSummary,
    hotspotObservations:
      hotspotObservations.length > 0
        ? hotspotObservations
        : ['No multi-complaint geographic clusters currently exceed urgent thresholds.'],
    suggestedFollowUpActions:
      suggestedFollowUpActions.length > 0
        ? suggestedFollowUpActions
        : ['Continue routine monitoring of incoming citizen submissions.']
  };
}

export async function requestDailyOperationsBrief(
  complaints: Complaint[],
  evaluationsById: Record<string, PriorityEvaluation>,
  isDemoMode: boolean,
  options?: { forceRefresh?: boolean }
): Promise<AdminDailyOperationsBrief> {
  const unresolved = complaints.filter((c) => c.status !== 'Resolved');
  const cacheKey = `brief:${complaints.length}:${unresolved.length}:${
    unresolved.filter((c) => evaluationsById[c.id]?.level === 'Critical').length
  }:${isDemoMode}`;

  if (!options?.forceRefresh && dailyBriefCache.has(cacheKey)) {
    return dailyBriefCache.get(cacheKey)!;
  }

  const categoryBreakdown = CATEGORIES.map((cat) => {
    const active = unresolved.filter((c) => c.category === cat.id);
    return {
      category: cat.id,
      unresolvedCount: active.length,
      overdueSlaCount: active.filter((c) => evaluationsById[c.id]?.isOverdueSla).length,
      slaHours: cat.slaHours
    };
  });

  const localityMap = new Map<string, { locality: string; unresolved: number; criticalOrHigh: number }>();
  for (const c of unresolved) {
    const loc = c.area_name || c.locality.split(',')[0].trim();
    const entry = localityMap.get(loc) || { locality: loc, unresolved: 0, criticalOrHigh: 0 };
    entry.unresolved += 1;
    const lvl = evaluationsById[c.id]?.level;
    if (lvl === 'Critical' || lvl === 'High') entry.criticalOrHigh += 1;
    localityMap.set(loc, entry);
  }

  const topUrgentItems = [...unresolved]
    .sort((a, b) => (evaluationsById[b.id]?.score ?? 0) - (evaluationsById[a.id]?.score ?? 0))
    .slice(0, 5)
    .map((c) => ({
      referenceNumber: c.reference_number,
      category: c.category,
      locality: c.area_name || c.locality,
      status: c.status,
      department: c.department,
      score: evaluationsById[c.id]?.score ?? 0,
      level: evaluationsById[c.id]?.level ?? 'Medium'
    }));

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 22000);

  try {
    const res = await fetch('/api/admin/ai/daily-brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        isDemoMode,
        totalComplaints: complaints.length,
        pendingCount: complaints.filter((c) => c.status === 'Submitted').length,
        inProgressCount: complaints.filter((c) => c.status === 'In Progress').length,
        resolvedCount: complaints.filter((c) => c.status === 'Resolved').length,
        reopenedCount: complaints.filter((c) => c.status === 'Reopened').length,
        criticalCount: unresolved.filter((c) => evaluationsById[c.id]?.level === 'Critical').length,
        highCount: unresolved.filter((c) => evaluationsById[c.id]?.level === 'High').length,
        overdueSlaCount: unresolved.filter((c) => evaluationsById[c.id]?.isOverdueSla).length,
        unassignedCount: unresolved.filter((c) => c.department === 'Unassigned').length,
        categoryBreakdown,
        localityHotspots: Array.from(localityMap.values())
          .sort((a, b) => b.criticalOrHigh - a.criticalOrHigh || b.unresolved - a.unresolved)
          .slice(0, 5),
        topUrgentItems
      })
    });

    window.clearTimeout(timeoutId);

    const payload = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      model?: string;
      error?: string;
      brief?: {
        recordedFactsSummary: string[];
        hotspotObservations: string[];
        suggestedFollowUpActions: string[];
      };
    };

    if (!res.ok || !payload.ok || !payload.brief) {
      const fallback = buildDeterministicDailyBrief(complaints, evaluationsById, isDemoMode);
      fallback.fallbackReason =
        payload.error || 'Gemini AI brief unavailable; displaying deterministic queue digest.';
      return fallback;
    }

    const result: AdminDailyOperationsBrief = {
      source: 'gemini',
      modelLabel: `Gemini AI (${payload.model || 'gemini-3.1-flash-lite'})`,
      generatedAt: new Date().toISOString(),
      recordedFactsSummary: payload.brief.recordedFactsSummary,
      hotspotObservations: payload.brief.hotspotObservations,
      suggestedFollowUpActions: payload.brief.suggestedFollowUpActions
    };

    dailyBriefCache.set(cacheKey, result);
    return result;
  } catch {
    window.clearTimeout(timeoutId);
    const fallback = buildDeterministicDailyBrief(complaints, evaluationsById, isDemoMode);
    fallback.fallbackReason = 'AI service unreachable; displaying deterministic queue digest.';
    return fallback;
  }
}
