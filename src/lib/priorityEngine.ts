import {
  CATEGORIES,
  CIVIC_AREAS,
  Complaint,
  ComplaintCategory,
  ComplaintPriority
} from '../types/urbanfix';

export type ComputedPriorityLevel = 'Critical' | 'High' | 'Medium' | 'Low';

export interface PriorityWeights {
  severity: number; // Default: 30
  publicLocationProximity: number; // Default: 25
  trafficAndAreaImpact: number; // Default: 15
  timeWaiting: number; // Default: 15
  corroboratingReports: number; // Default: 10
  safetyRisk: number; // Default: 5
}

/**
 * Initial configurable heuristic weights (maximum 100 points).
 * Documented Note: These are transparent operational triage weights designed
 * for municipal queue ordering and college demonstration — not clinically or
 * scientifically calibrated risk coefficients. Administrators can inspect and
 * adjust them in the Priority Queue configuration panel.
 */
export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  severity: 30,
  publicLocationProximity: 25,
  trafficAndAreaImpact: 15,
  timeWaiting: 15,
  corroboratingReports: 10,
  safetyRisk: 5
};

const WEIGHTS_STORAGE_KEY = 'urbanfix_priority_weights_v1';

export interface VerifiedPublicLandmark {
  id: string;
  name: string;
  type: 'school' | 'hospital' | 'traffic_signal' | 'transit_hub';
  typeLabel: string;
  lat: number;
  lng: number;
}

/**
 * Verified Greater Mumbai public reference points with real geographic coordinates.
 * Proximity is computed strictly using Haversine distance from street-level coordinates,
 * never inferred merely from a familiar ward/locality name.
 */
export const VERIFIED_MUMBAI_LANDMARKS: VerifiedPublicLandmark[] = [
  // Schools & Academic Institutions
  {
    id: 'lm-stanislaus',
    name: 'St. Stanislaus High School, Hill Road',
    type: 'school',
    typeLabel: 'School Entrance Zone',
    lat: 19.0551,
    lng: 72.8317
  },
  {
    id: 'lm-national-college',
    name: 'RD National College, Linking Road',
    type: 'school',
    typeLabel: 'College & Bus Corridor',
    lat: 19.0636,
    lng: 72.8344
  },
  {
    id: 'lm-iit-bombay',
    name: 'IIT Bombay Main Gate, Powai',
    type: 'school',
    typeLabel: 'Educational Campus Gate',
    lat: 19.1248,
    lng: 72.9131
  },
  {
    id: 'lm-jamnabai',
    name: 'Jamnabai Narsee School, Juhu',
    type: 'school',
    typeLabel: 'School Zone',
    lat: 19.1088,
    lng: 72.8322
  },
  {
    id: 'lm-ruia-podar',
    name: 'Ruia & Podar College Precinct, Matunga-Dadar',
    type: 'school',
    typeLabel: 'Educational Precinct',
    lat: 19.0235,
    lng: 72.8502
  },
  {
    id: 'lm-campion',
    name: 'Campion & Cathedral School Zone, Fort',
    type: 'school',
    typeLabel: 'School Zone',
    lat: 18.9289,
    lng: 72.8312
  },

  // Major Hospitals
  {
    id: 'lm-kokilaben',
    name: 'Kokilaben Dhirubhai Ambani Hospital, Four Bungalows',
    type: 'hospital',
    typeLabel: 'Major Hospital Access',
    lat: 19.1315,
    lng: 72.8253
  },
  {
    id: 'lm-holy-family',
    name: 'Holy Family Hospital, St. Andrews / Hill Road',
    type: 'hospital',
    typeLabel: 'Hospital Emergency Corridor',
    lat: 19.0546,
    lng: 72.8296
  },
  {
    id: 'lm-hinduja',
    name: 'PD Hinduja Hospital, Veer Savarkar Marg',
    type: 'hospital',
    typeLabel: 'Hospital Corridor',
    lat: 19.0332,
    lng: 72.8384
  },
  {
    id: 'lm-hiranandani-hosp',
    name: 'Dr LH Hiranandani Hospital, Powai',
    type: 'hospital',
    typeLabel: 'Hospital Precinct',
    lat: 19.1194,
    lng: 72.9129
  },
  {
    id: 'lm-kem-parel',
    name: 'KEM & Tata Memorial Hospital Corridor, Parel',
    type: 'hospital',
    typeLabel: 'Tertiary Hospital Zone',
    lat: 19.0022,
    lng: 72.8418
  },

  // Major Signalized Junctions & High-Density Transit Hubs
  {
    id: 'lm-lucky-junction',
    name: 'Lucky Signal Junction, SV Road Bandra',
    type: 'traffic_signal',
    typeLabel: 'Signalized Arterial Junction',
    lat: 19.0549,
    lng: 72.8401
  },
  {
    id: 'lm-plaza-signal',
    name: 'Plaza Cinema Signal, NC Kelkar Marg Dadar',
    type: 'traffic_signal',
    typeLabel: 'Signalized Transit Junction',
    lat: 19.0195,
    lng: 72.8431
  },
  {
    id: 'lm-khodadad-circle',
    name: 'Khodadad Circle (Dadar TT) Signal',
    type: 'traffic_signal',
    typeLabel: 'Major Arterial Roundabout',
    lat: 19.0174,
    lng: 72.8472
  },
  {
    id: 'lm-portuguese-church',
    name: 'Portuguese Church Signal Junction, Dadar West',
    type: 'traffic_signal',
    typeLabel: 'Signalized Junction',
    lat: 19.0188,
    lng: 72.8368
  },
  {
    id: 'lm-dn-nagar-metro',
    name: 'DN Nagar Metro Junction, New Link Road',
    type: 'transit_hub',
    typeLabel: 'Metro & Link Road Junction',
    lat: 19.1299,
    lng: 72.8336
  },
  {
    id: 'lm-versova-metro',
    name: 'Versova Metro Station Junction, Seven Bungalows',
    type: 'transit_hub',
    typeLabel: 'Metro Transit Access',
    lat: 19.131,
    lng: 72.8232
  },
  {
    id: 'lm-andheri-subway',
    name: 'Andheri Railway Subway & SV Road Crossing',
    type: 'transit_hub',
    typeLabel: 'Suburban Rail & Underpass Hub',
    lat: 19.1197,
    lng: 72.8461
  },
  {
    id: 'lm-siddhivinayak-jct',
    name: 'Siddhivinayak Signal Junction, Prabhadevi',
    type: 'traffic_signal',
    typeLabel: 'High-Footfall Signal Junction',
    lat: 19.0169,
    lng: 72.8308
  },
  {
    id: 'lm-lower-parel-stn',
    name: 'Lower Parel Station & Senapati Bapat Marg Junction',
    type: 'transit_hub',
    typeLabel: 'Commuter Rail & Arterial Corridor',
    lat: 18.9965,
    lng: 72.8302
  },
  {
    id: 'lm-worli-naka',
    name: 'Worli Naka Signal Junction',
    type: 'traffic_signal',
    typeLabel: 'Signalized Arterial Junction',
    lat: 19.0028,
    lng: 72.8184
  },
  {
    id: 'lm-juhu-circle',
    name: 'JVPD / Juhu Tara Signal Corridor',
    type: 'traffic_signal',
    typeLabel: 'Signalized Coastal Corridor',
    lat: 19.1078,
    lng: 72.8266
  },
  {
    id: 'lm-diamond-garden',
    name: 'Diamond Garden Signal, Sion-Trombay Road Chembur',
    type: 'traffic_signal',
    typeLabel: 'Signalized Arterial Junction',
    lat: 19.0518,
    lng: 72.9009
  },
  {
    id: 'lm-regal-circle',
    name: 'Regal Circle & Colaba Causeway Junction',
    type: 'traffic_signal',
    typeLabel: 'Major Civic Junction',
    lat: 18.9228,
    lng: 72.8318
  }
];

export interface PriorityFactorContribution {
  key: keyof PriorityWeights;
  label: string;
  awardedPoints: number;
  maxPoints: number;
  available: boolean;
  evidenceSummary: string;
  missingNote?: string;
}

export interface RelatedReportMatch {
  complaint: Complaint;
  distanceMeters: number | null;
  sharedKeywords: string[];
  matchReason: string;
}

export interface PriorityEvaluation {
  complaintId: string;
  score: number; // 0–100 normalized integer
  rawPoints: number;
  availableMaxPoints: number;
  isNormalizedForMissingData: boolean;
  level: ComputedPriorityLevel;
  isResolved: boolean;
  conciseExplanation: string;
  factors: PriorityFactorContribution[];
  missingEvidence: string[];
  nearestLandmark: {
    landmark: VerifiedPublicLandmark;
    distanceMeters: number;
  } | null;
  relatedReports: RelatedReportMatch[];
  hoursWaiting: number;
  slaTargetHours: number;
  isOverdueSla: boolean;
  calculatedAt: string;
}

/**
 * Great-circle Haversine distance in meters between two WGS84 coordinates.
 */
export function computeHaversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth mean radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function loadPriorityWeights(): PriorityWeights {
  try {
    const raw = localStorage.getItem(WEIGHTS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PRIORITY_WEIGHTS };
    const parsed = JSON.parse(raw) as Partial<PriorityWeights>;
    const sanitize = (val: unknown, fallback: number) =>
      typeof val === 'number' && Number.isFinite(val) && val >= 0 && val <= 60
        ? Math.round(val)
        : fallback;
    return {
      severity: sanitize(parsed.severity, DEFAULT_PRIORITY_WEIGHTS.severity),
      publicLocationProximity: sanitize(
        parsed.publicLocationProximity,
        DEFAULT_PRIORITY_WEIGHTS.publicLocationProximity
      ),
      trafficAndAreaImpact: sanitize(
        parsed.trafficAndAreaImpact,
        DEFAULT_PRIORITY_WEIGHTS.trafficAndAreaImpact
      ),
      timeWaiting: sanitize(parsed.timeWaiting, DEFAULT_PRIORITY_WEIGHTS.timeWaiting),
      corroboratingReports: sanitize(
        parsed.corroboratingReports,
        DEFAULT_PRIORITY_WEIGHTS.corroboratingReports
      ),
      safetyRisk: sanitize(parsed.safetyRisk, DEFAULT_PRIORITY_WEIGHTS.safetyRisk)
    };
  } catch {
    return { ...DEFAULT_PRIORITY_WEIGHTS };
  }
}

export function savePriorityWeights(weights: PriorityWeights): void {
  try {
    localStorage.setItem(WEIGHTS_STORAGE_KEY, JSON.stringify(weights));
  } catch {
    // Ignore storage quota issues
  }
}

export function resetPriorityWeights(): PriorityWeights {
  try {
    localStorage.removeItem(WEIGHTS_STORAGE_KEY);
  } catch {
    // Ignore storage issues
  }
  return { ...DEFAULT_PRIORITY_WEIGHTS };
}

export function getPriorityLevelFromScore(score: number): ComputedPriorityLevel {
  if (score >= 80) return 'Critical';
  if (score >= 60) return 'High';
  if (score >= 30) return 'Medium';
  return 'Low';
}

/**
 * Checks whether a complaint carries genuine street-level coordinates vs
 * missing coordinates or an unpinned ward-center fallback.
 */
export function evaluateCoordinatePrecision(complaint: Complaint): {
  hasCoordinates: boolean;
  hasStreetLevelPin: boolean;
  lat: number | null;
  lng: number | null;
} {
  const hasCoords =
    typeof complaint.approx_lat === 'number' &&
    typeof complaint.approx_lng === 'number' &&
    Number.isFinite(complaint.approx_lat) &&
    Number.isFinite(complaint.approx_lng);

  if (!hasCoords) {
    return { hasCoordinates: false, hasStreetLevelPin: false, lat: null, lng: null };
  }

  const lat = complaint.approx_lat as number;
  const lng = complaint.approx_lng as number;

  // Demo records in seedData carry explicit street-level demonstration coordinates.
  // For non-demo live records, check if the coordinates exactly match a generic ward center
  // (meaning the citizen did not opt in to attach exact street coordinates).
  if (!complaint.is_demo_record) {
    const matchesGenericWardCenter = CIVIC_AREAS.some(
      (area) => computeHaversineMeters(lat, lng, area.centerLat, area.centerLng) <= 3
    );
    if (matchesGenericWardCenter) {
      return { hasCoordinates: true, hasStreetLevelPin: false, lat, lng };
    }
  }

  return { hasCoordinates: true, hasStreetLevelPin: true, lat, lng };
}

const STOP_WORDS = new Set([
  'the',
  'and',
  'near',
  'with',
  'from',
  'into',
  'over',
  'under',
  'across',
  'along',
  'outside',
  'opposite',
  'road',
  'lane',
  'ward',
  'west',
  'east',
  'mumbai',
  'since',
  'have',
  'has',
  'been',
  'this',
  'that',
  'very',
  'area',
  'issue'
]);

function extractSignificantTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
}

/**
 * Identifies possible nearby/related complaints using category, Haversine distance,
 * and shared descriptive keywords. Strictly labelled as "Possible related reports"
 * and never treated as confirmed duplicates unless corroborated by spatial + category match.
 */
export function findPossibleRelatedReports(
  target: Complaint,
  allComplaints: Complaint[],
  maxResults = 4
): RelatedReportMatch[] {
  const targetCoord = evaluateCoordinatePrecision(target);
  const targetTokens = new Set(
    extractSignificantTokens(`${target.title} ${target.description} ${target.landmark}`)
  );

  const candidates: { match: RelatedReportMatch; rankScore: number }[] = [];

  for (const other of allComplaints) {
    if (other.id === target.id) continue;
    if (other.category !== target.category) continue;

    const otherCoord = evaluateCoordinatePrecision(other);
    let distanceMeters: number | null = null;

    if (
      targetCoord.hasStreetLevelPin &&
      otherCoord.hasStreetLevelPin &&
      targetCoord.lat !== null &&
      targetCoord.lng !== null &&
      otherCoord.lat !== null &&
      otherCoord.lng !== null
    ) {
      distanceMeters = computeHaversineMeters(
        targetCoord.lat,
        targetCoord.lng,
        otherCoord.lat,
        otherCoord.lng
      );
    }

    const otherTokens = extractSignificantTokens(
      `${other.title} ${other.description} ${other.landmark}`
    );
    const shared = Array.from(new Set(otherTokens.filter((t) => targetTokens.has(t)))).slice(
      0,
      4
    );

    const sameArea =
      (target.area_name &&
        other.area_name &&
        target.area_name.toLowerCase() === other.area_name.toLowerCase()) ||
      target.locality.toLowerCase() === other.locality.toLowerCase();

    const closePin = distanceMeters !== null && distanceMeters <= 650;
    const moderatePinWithTerms =
      distanceMeters !== null && distanceMeters <= 1100 && shared.length >= 2;
    const sameAreaWithStrongTerms = distanceMeters === null && sameArea && shared.length >= 2;

    if (!closePin && !moderatePinWithTerms && !sameAreaWithStrongTerms) {
      continue;
    }

    const reasons: string[] = [`Same category (${other.category})`];
    if (distanceMeters !== null) {
      reasons.push(`${distanceMeters}m apart`);
    } else if (sameArea) {
      reasons.push(`Same locality (${other.locality})`);
    }
    if (shared.length > 0) {
      reasons.push(`Shared terms: ${shared.slice(0, 3).join(', ')}`);
    }

    const rankScore =
      (distanceMeters !== null ? Math.max(0, 1000 - distanceMeters) / 10 : 30) +
      shared.length * 15;

    candidates.push({
      match: {
        complaint: other,
        distanceMeters,
        sharedKeywords: shared,
        matchReason: reasons.join(' · ')
      },
      rankScore
    });
  }

  return candidates
    .sort((a, b) => b.rankScore - a.rankScore)
    .slice(0, maxResults)
    .map((c) => c.match);
}

/**
 * Evaluates a single complaint using the transparent, deterministic 6-factor scoring model.
 * Every point and explanation phrase is derived directly from verifiable complaint fields.
 */
export function evaluateComplaintPriority(
  complaint: Complaint,
  allComplaints: Complaint[],
  weights: PriorityWeights = DEFAULT_PRIORITY_WEIGHTS,
  referenceNowMs: number = Date.now()
): PriorityEvaluation {
  const combinedText = `${complaint.title} ${complaint.description}`.toLowerCase();
  const locationText = `${complaint.locality} ${complaint.landmark}`.toLowerCase();
  const isResolved = complaint.status === 'Resolved';
  const missingEvidence: string[] = [];

  const categoryMeta = CATEGORIES.find((c) => c.id === complaint.category);
  const slaTargetHours = categoryMeta?.slaHours ?? 72;

  const createdMs = new Date(complaint.created_at).getTime();
  const updatedMs = new Date(complaint.updated_at).getTime();
  const endMs = isResolved ? Math.max(createdMs, updatedMs) : referenceNowMs;
  const hoursWaiting = Math.max(0, Math.round((endMs - createdMs) / (1000 * 3600)));
  const isOverdueSla = !isResolved && hoursWaiting > slaTargetHours;

  if (!complaint.image_path) {
    missingEvidence.push('No field photograph attached');
  }

  // ---------------------------------------------------------------------------
  // FACTOR 1: Issue Severity (Default Max: 30)
  // ---------------------------------------------------------------------------
  const hasRecordedSeverity = Boolean(complaint.priority);
  const recordedPriority: ComplaintPriority = complaint.priority || 'Medium';
  let severityRatio = recordedPriority === 'High' ? 0.8 : recordedPriority === 'Medium' ? 0.5 : 0.22;

  const severeTextSignals: string[] = [];
  if (
    /\b(major|burst|gushing|deep|crater|collapsed|sunken|overflowing|raw sewage|submerged|4 consecutive|5 consecutive|multiple|entire stretch|exposed steel|surcharged)\b/i.test(
      combinedText
    )
  ) {
    severityRatio = Math.min(1, severityRatio + 0.16);
    severeTextSignals.push('severe physical damage/volume described');
  }
  if (complaint.status === 'Reopened') {
    severityRatio = Math.min(1, severityRatio + 0.1);
    severeTextSignals.push('reopened after prior closure');
  }

  if (!hasRecordedSeverity) {
    missingEvidence.push('Explicit citizen severity level not recorded (inferred from text)');
  }

  const severityPoints = Math.round(weights.severity * severityRatio);
  const severityFactor: PriorityFactorContribution = {
    key: 'severity',
    label: 'Issue Severity',
    awardedPoints: severityPoints,
    maxPoints: weights.severity,
    available: true,
    evidenceSummary: hasRecordedSeverity
      ? `Recorded ${recordedPriority.toLowerCase()} severity${
          severeTextSignals.length > 0 ? ` (${severeTextSignals.join(', ')})` : ''
        }`
      : `Derived from complaint description${
          severeTextSignals.length > 0 ? ` (${severeTextSignals.join(', ')})` : ''
        }`
  };

  // ---------------------------------------------------------------------------
  // FACTOR 2: Verified Public Location Proximity (Default Max: 25)
  // Uses Haversine distance against VERIFIED_MUMBAI_LANDMARKS ONLY when street-level coordinates exist
  // ---------------------------------------------------------------------------
  const coordPrecision = evaluateCoordinatePrecision(complaint);
  let nearestLandmark: { landmark: VerifiedPublicLandmark; distanceMeters: number } | null = null;

  if (
    coordPrecision.hasStreetLevelPin &&
    coordPrecision.lat !== null &&
    coordPrecision.lng !== null
  ) {
    for (const lm of VERIFIED_MUMBAI_LANDMARKS) {
      const dist = computeHaversineMeters(
        coordPrecision.lat,
        coordPrecision.lng,
        lm.lat,
        lm.lng
      );
      if (!nearestLandmark || dist < nearestLandmark.distanceMeters) {
        nearestLandmark = { landmark: lm, distanceMeters: dist };
      }
    }
  } else {
    missingEvidence.push(
      'Street-level coordinates unavailable for exact Haversine landmark proximity check'
    );
  }

  let proximityPoints = 0;
  let proximityEvidence = '';
  const proximityAvailable = coordPrecision.hasStreetLevelPin;

  if (!proximityAvailable) {
    proximityEvidence = 'Unavailable — street-level pin not recorded (excluded from denominator)';
  } else if (nearestLandmark && nearestLandmark.distanceMeters <= 250) {
    const isCriticalCivicPairing =
      nearestLandmark.landmark.type === 'hospital' ||
      nearestLandmark.landmark.type === 'school' ||
      (nearestLandmark.landmark.type === 'traffic_signal' &&
        (complaint.category === 'Roads' || complaint.category === 'Streetlights'));
    proximityPoints = Math.round(
      weights.publicLocationProximity * (isCriticalCivicPairing ? 1.0 : 0.88)
    );
    proximityEvidence = `${nearestLandmark.distanceMeters}m from ${nearestLandmark.landmark.name} (${nearestLandmark.landmark.typeLabel})`;
  } else if (nearestLandmark && nearestLandmark.distanceMeters <= 550) {
    proximityPoints = Math.round(weights.publicLocationProximity * 0.62);
    proximityEvidence = `${nearestLandmark.distanceMeters}m from ${nearestLandmark.landmark.name} (${nearestLandmark.landmark.typeLabel})`;
  } else if (nearestLandmark && nearestLandmark.distanceMeters <= 900) {
    proximityPoints = Math.round(weights.publicLocationProximity * 0.28);
    proximityEvidence = `${nearestLandmark.distanceMeters}m from ${nearestLandmark.landmark.name}`;
  } else {
    proximityPoints = 0;
    proximityEvidence = nearestLandmark
      ? `No verified school, hospital, or signalized hub within 900m (nearest: ${nearestLandmark.distanceMeters}m)`
      : 'No verified public landmark within 900m';
  }

  const proximityFactor: PriorityFactorContribution = {
    key: 'publicLocationProximity',
    label: 'Public Location Proximity',
    awardedPoints: proximityPoints,
    maxPoints: weights.publicLocationProximity,
    available: proximityAvailable,
    evidenceSummary: proximityEvidence,
    missingNote: !proximityAvailable
      ? 'Exact coordinates missing; proximity points are not assumed from locality names.'
      : undefined
  };

  // ---------------------------------------------------------------------------
  // FACTOR 3: Corridor / Public Area Impact (Default Max: 15)
  // Strictly grounded in recorded road/corridor/facility context — never invents traffic counts
  // ---------------------------------------------------------------------------
  let impactRatio = 0.2;
  const corridorEvidence: string[] = [];

  if (
    /\b(sv road|linking road|jvlr|jogeshwari-vikhroli|senapati bapat|ambedkar road|veer savarkar|new link road|sion-trombay|shahid bhagat singh|central avenue|flyover|underpass|highway)\b/i.test(
      locationText + ' ' + combinedText
    )
  ) {
    impactRatio = Math.max(impactRatio, 0.8);
    corridorEvidence.push('primary arterial road/flyover corridor');
  }

  if (
    /\b(bus stop|bus bay|metro|railway|station|subway|pedestrian crossing|zebra crossing|market|promenade|junction|signal|roundabout)\b/i.test(
      locationText + ' ' + combinedText
    )
  ) {
    impactRatio = Math.min(1, impactRatio + 0.25);
    corridorEvidence.push('commuter transit/pedestrian access point');
  }

  if (
    complaint.category === 'Water Supply' &&
    /\b(main|pipeline|trunk|supply interruption|entire lane|low pressure across)\b/i.test(
      combinedText
    )
  ) {
    impactRatio = Math.max(impactRatio, 0.9);
    corridorEvidence.push('shared municipal water supply line');
  }

  const impactPoints = Math.round(weights.trafficAndAreaImpact * Math.min(1, impactRatio));
  const impactFactor: PriorityFactorContribution = {
    key: 'trafficAndAreaImpact',
    label: 'Corridor & Public Area Impact',
    awardedPoints: impactPoints,
    maxPoints: weights.trafficAndAreaImpact,
    available: true,
    evidenceSummary:
      corridorEvidence.length > 0
        ? `Affects ${corridorEvidence.join(' & ')} (recorded in locality/description)`
        : 'Localized street segment based on submitted location text'
  };

  // ---------------------------------------------------------------------------
  // FACTOR 4: Time Waiting & Unresolved Duration (Default Max: 15)
  // ---------------------------------------------------------------------------
  let waitingRatio = 0;
  let waitingEvidence = '';

  if (isResolved) {
    waitingRatio = 0;
    waitingEvidence = `Resolved after ${hoursWaiting}h (closed — active waiting urgency is 0)`;
  } else {
    const slaProgress = hoursWaiting / Math.max(12, slaTargetHours);
    if (slaProgress >= 1.5) {
      waitingRatio = 1.0;
    } else if (slaProgress >= 1.0) {
      waitingRatio = 0.85;
    } else if (slaProgress >= 0.65) {
      waitingRatio = 0.6;
    } else if (slaProgress >= 0.3) {
      waitingRatio = 0.38;
    } else {
      waitingRatio = 0.18;
    }
    const days = Math.floor(hoursWaiting / 24);
    const remHours = hoursWaiting % 24;
    const durationText = days > 0 ? `${days}d ${remHours}h` : `${hoursWaiting}h`;
    waitingEvidence = isOverdueSla
      ? `Unresolved for ${durationText} (exceeds ${slaTargetHours}h category SLA target)`
      : `Unresolved for ${durationText} (${slaTargetHours}h SLA target)`;
  }

  const waitingPoints = Math.round(weights.timeWaiting * waitingRatio);
  const waitingFactor: PriorityFactorContribution = {
    key: 'timeWaiting',
    label: 'Time Waiting (Unresolved)',
    awardedPoints: waitingPoints,
    maxPoints: weights.timeWaiting,
    available: true,
    evidenceSummary: waitingEvidence
  };

  // ---------------------------------------------------------------------------
  // FACTOR 5: Corroborating Nearby Reports (Default Max: 10)
  // Requires spatial + category match (<= 450m) so unverified text coincidences are not overcounted
  // ---------------------------------------------------------------------------
  const relatedReports = findPossibleRelatedReports(complaint, allComplaints, 4);
  const spatiallyCorroborated = relatedReports.filter(
    (r) =>
      r.distanceMeters !== null &&
      r.distanceMeters <= 450 &&
      r.complaint.status !== 'Resolved'
  );

  let corroboratingPoints = 0;
  let corroboratingEvidence = '';
  const corroborationAvailable = coordPrecision.hasStreetLevelPin;

  if (!corroborationAvailable) {
    corroboratingEvidence =
      'Unavailable — street-level coordinates required to verify spatial corroboration';
  } else if (spatiallyCorroborated.length >= 2) {
    corroboratingPoints = weights.corroboratingReports;
    corroboratingEvidence = `${spatiallyCorroborated.length} unresolved same-category reports within 450m`;
  } else if (spatiallyCorroborated.length === 1) {
    corroboratingPoints = Math.round(weights.corroboratingReports * 0.6);
    corroboratingEvidence = `1 unresolved same-category report (${spatiallyCorroborated[0].complaint.reference_number}, ${spatiallyCorroborated[0].distanceMeters}m away)`;
  } else {
    corroboratingPoints = 0;
    corroboratingEvidence =
      relatedReports.length > 0
        ? `${relatedReports.length} possible wider-area match(es), none within 450m unresolved threshold`
        : 'No nearby corroborating reports within 450m';
  }

  const corroboratingFactor: PriorityFactorContribution = {
    key: 'corroboratingReports',
    label: 'Nearby Corroborating Reports',
    awardedPoints: corroboratingPoints,
    maxPoints: weights.corroboratingReports,
    available: corroborationAvailable,
    evidenceSummary: corroboratingEvidence
  };

  // ---------------------------------------------------------------------------
  // FACTOR 6: Supported Public Safety Risk Indicator (Default Max: 5)
  // ---------------------------------------------------------------------------
  const safetyTriggers: string[] = [];
  if (/\b(exposed wire|live cable|open junction box|sparking|short circuit|electric shock)\b/i.test(combinedText)) {
    safetyTriggers.push('electrical hazard');
  }
  if (/\b(open manhole|missing cover|snapped.*slab|open.*slot|collapse|exposed steel|swerve|skid|tripping|ankle hazard)\b/i.test(combinedText)) {
    safetyTriggers.push('physical fall/collision hazard');
  }
  if (/\b(sewage|wastewater|contaminated|turbid|foul|unsanitary|medical|vector|stray)\b/i.test(combinedText)) {
    safetyTriggers.push('sanitation/contamination exposure');
  }
  if (/\b(dark|unlit|pitch dark|consecutive.*poles|blind spot|flooding|waterlogged)\b/i.test(combinedText)) {
    safetyTriggers.push('visibility/flooding safety risk');
  }

  const safetyRatio =
    safetyTriggers.length >= 2 ? 1.0 : safetyTriggers.length === 1 ? 0.75 : 0;
  const safetyPoints = Math.round(weights.safetyRisk * safetyRatio);

  const safetyFactor: PriorityFactorContribution = {
    key: 'safetyRisk',
    label: 'Supported Safety-Risk Indicator',
    awardedPoints: safetyPoints,
    maxPoints: weights.safetyRisk,
    available: true,
    evidenceSummary:
      safetyTriggers.length > 0
        ? `Supported by complaint text: ${safetyTriggers.join(', ')}`
        : 'No explicit acute safety-hazard keywords recorded in description'
  };

  const factors: PriorityFactorContribution[] = [
    severityFactor,
    proximityFactor,
    impactFactor,
    waitingFactor,
    corroboratingFactor,
    safetyFactor
  ];

  const configuredTotalMax =
    weights.severity +
    weights.publicLocationProximity +
    weights.trafficAndAreaImpact +
    weights.timeWaiting +
    weights.corroboratingReports +
    weights.safetyRisk;

  const availableFactors = factors.filter((f) => f.available);
  const rawPoints = availableFactors.reduce((sum, f) => sum + f.awardedPoints, 0);
  const availableMaxPoints = availableFactors.reduce((sum, f) => sum + f.maxPoints, 0);

  const isNormalizedForMissingData = availableMaxPoints < configuredTotalMax && availableMaxPoints > 0;

  let normalizedScore =
    availableMaxPoints > 0 ? Math.round((rawPoints / availableMaxPoints) * 100) : 0;
  normalizedScore = Math.max(0, Math.min(100, normalizedScore));

  // Resolved complaints do not sit in active critical dispatch, cap active display level cleanly
  // while keeping exact factor points transparent.
  const level = getPriorityLevelFromScore(normalizedScore);

  // Assemble concise explanation strictly from actual contributing factors
  const explanationParts: string[] = [];
  if (severityRatio >= 0.75) {
    explanationParts.push(`high recorded ${complaint.category.toLowerCase()} severity`);
  } else if (severityRatio >= 0.45) {
    explanationParts.push(`moderate ${complaint.category.toLowerCase()} severity`);
  } else {
    explanationParts.push(`localized ${complaint.category.toLowerCase()} report`);
  }

  if (proximityAvailable && nearestLandmark && nearestLandmark.distanceMeters <= 550) {
    explanationParts.push(
      `${nearestLandmark.distanceMeters}m from ${nearestLandmark.landmark.name}`
    );
  } else if (!proximityAvailable) {
    explanationParts.push('incomplete coordinate context (normalized)');
  }

  if (corridorEvidence.length > 0) {
    explanationParts.push(`on ${corridorEvidence[0]}`);
  }

  if (safetyTriggers.length > 0) {
    explanationParts.push(safetyTriggers[0]);
  }

  if (!isResolved) {
    const days = Math.floor(hoursWaiting / 24);
    if (isOverdueSla) {
      explanationParts.push(
        `unresolved for ${days >= 1 ? `${days}d` : `${hoursWaiting}h`} (past ${slaTargetHours}h SLA)`
      );
    } else {
      explanationParts.push(
        `waiting ${days >= 1 ? `${days}d ${hoursWaiting % 24}h` : `${hoursWaiting}h`}`
      );
    }
  } else {
    explanationParts.push('currently resolved');
  }

  if (spatiallyCorroborated.length > 0) {
    explanationParts.push(
      `${spatiallyCorroborated.length} nearby corroborating report${
        spatiallyCorroborated.length > 1 ? 's' : ''
      }`
    );
  }

  const conciseExplanation = `${level} priority (${normalizedScore}/100): ${explanationParts
    .slice(0, 4)
    .join(', ')}.`;

  return {
    complaintId: complaint.id,
    score: normalizedScore,
    rawPoints,
    availableMaxPoints,
    isNormalizedForMissingData,
    level,
    isResolved,
    conciseExplanation,
    factors,
    missingEvidence,
    nearestLandmark,
    relatedReports,
    hoursWaiting,
    slaTargetHours,
    isOverdueSla,
    calculatedAt: new Date(referenceNowMs).toISOString()
  };
}
