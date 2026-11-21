import React, { useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Info,
  RotateCcw,
  SlidersHorizontal,
  X
} from 'lucide-react';
import {
  ComputedPriorityLevel,
  DEFAULT_PRIORITY_WEIGHTS,
  PriorityEvaluation,
  PriorityWeights
} from '../lib/priorityEngine';

interface PriorityLevelBadgeProps {
  level: ComputedPriorityLevel;
  score?: number;
  compact?: boolean;
}

export const PriorityLevelBadge: React.FC<PriorityLevelBadgeProps> = ({
  level,
  score,
  compact = false
}) => {
  const styles: Record<
    ComputedPriorityLevel,
    { badge: string; dot: string }
  > = {
    Critical: {
      badge: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]',
      dot: 'bg-[#F05B5B]'
    },
    High: {
      badge: 'bg-[#FFF7ED] text-[#B45309] border-[#FED7AA]',
      dot: 'bg-[#E89A3C]'
    },
    Medium: {
      badge: 'bg-[#EEF2FF] text-[#2B50C7] border-[#C7D2FE]',
      dot: 'bg-[#4169E1]'
    },
    Low: {
      badge: 'bg-[#F3F4F6] text-[#4B5563] border-[#D1D5DB]',
      dot: 'bg-[#70757D]'
    }
  };

  const st = styles[level];

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold border rounded-md whitespace-nowrap shrink-0 tabular-nums ${
        compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      } ${st.badge}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${st.dot}`} />
      <span>{level}</span>
      {typeof score === 'number' && (
        <span className="font-mono opacity-90">{score}/100</span>
      )}
    </span>
  );
};

interface PriorityBreakdownPanelProps {
  evaluation: PriorityEvaluation;
  defaultExpanded?: boolean;
  compact?: boolean;
}

export const PriorityBreakdownPanel: React.FC<PriorityBreakdownPanelProps> = ({
  evaluation,
  defaultExpanded = false,
  compact = false
}) => {
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded);

  const barColorHex: Record<ComputedPriorityLevel, string> = {
    Critical: '#F05B5B',
    High: '#E89A3C',
    Medium: '#4169E1',
    Low: '#70757D'
  };

  const accentHex = barColorHex[evaluation.level];

  return (
    <div
      className={`rounded-xl border border-[#E3E4E0] bg-[#FAF9F6] ${
        compact ? 'p-3' : 'p-4'
      } space-y-2.5`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <PriorityLevelBadge
            level={evaluation.level}
            score={evaluation.score}
            compact={compact}
          />
          {evaluation.isOverdueSla && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-md whitespace-nowrap shrink-0 tabular-nums">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>Past {evaluation.slaTargetHours}h SLA</span>
            </span>
          )}
          {evaluation.isNormalizedForMissingData && (
            <span className="text-[11px] font-medium text-[#555B64] bg-white border border-[#E3E4E0] px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">
              Normalized ({evaluation.rawPoints}/{evaluation.availableMaxPoints} available pts)
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#4169E1] hover:text-[#2B50C7] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <span>Why this priority?</span>
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 shrink-0" />
          )}
        </button>
      </div>

      <p className="text-xs text-[#25272B] leading-relaxed">
        {evaluation.conciseExplanation}
      </p>

      {expanded && (
        <div className="pt-3 border-t border-[#E3E4E0] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#555B64]">
            <span className="font-semibold text-[#25272B]">
              Explainable 6-Factor Scoring Breakdown
            </span>
            <span className="font-mono tabular-nums">
              Calculated{' '}
              {new Date(evaluation.calculatedAt).toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>

          <div className="space-y-2.5">
            {evaluation.factors.map((factor) => {
              const pct =
                factor.available && factor.maxPoints > 0
                  ? Math.max(
                      0,
                      Math.min(100, Math.round((factor.awardedPoints / factor.maxPoints) * 100))
                    )
                  : 0;

              return (
                <div
                  key={factor.key}
                  className="bg-white border border-[#E3E4E0] rounded-lg p-2.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[#25272B]">{factor.label}</span>
                    {factor.available ? (
                      <span className="font-mono font-semibold text-[#25272B] tabular-nums whitespace-nowrap shrink-0">
                        +{factor.awardedPoints} / {factor.maxPoints} pts
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-[#70757D] whitespace-nowrap shrink-0">
                        Context Unavailable
                      </span>
                    )}
                  </div>

                  <svg
                    viewBox="0 0 100 5"
                    preserveAspectRatio="none"
                    className="w-full h-1.5 rounded-full overflow-hidden block"
                    aria-hidden="true"
                  >
                    <rect x="0" y="0" width="100" height="5" fill="#ECEBE6" rx="2.5" />
                    {factor.available && pct > 0 && (
                      <rect
                        x="0"
                        y="0"
                        width={pct}
                        height="5"
                        fill={accentHex}
                        rx="2.5"
                      />
                    )}
                  </svg>

                  <p className="text-[11px] text-[#555B64] leading-snug">
                    {factor.evidenceSummary}
                  </p>
                </div>
              );
            })}
          </div>

          {evaluation.missingEvidence.length > 0 && (
            <div className="rounded-lg bg-white border border-[#E3E4E0] p-2.5 flex items-start gap-2 text-[11px] text-[#555B64]">
              <Info className="w-3.5 h-3.5 text-[#E89A3C] shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-semibold text-[#25272B]">
                  Missing or Unverified Context
                </div>
                <p>{evaluation.missingEvidence.join(' · ')}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface PriorityWeightsModalProps {
  isOpen: boolean;
  weights: PriorityWeights;
  onClose: () => void;
  onSaveWeights: (nextWeights: PriorityWeights) => void;
  onResetDefaultWeights: () => void;
}

const WEIGHT_FIELDS: {
  key: keyof PriorityWeights;
  label: string;
  description: string;
  defaultVal: number;
}[] = [
  {
    key: 'severity',
    label: 'Issue Severity',
    description: 'Citizen-recorded urgency, reopened history, and severe physical defect terms.',
    defaultVal: DEFAULT_PRIORITY_WEIGHTS.severity
  },
  {
    key: 'publicLocationProximity',
    label: 'Public Location Proximity',
    description:
      'Verified Haversine distance to Mumbai schools, hospitals, and signalized transit junctions.',
    defaultVal: DEFAULT_PRIORITY_WEIGHTS.publicLocationProximity
  },
  {
    key: 'trafficAndAreaImpact',
    label: 'Corridor & Area Impact',
    description: 'Arterial road corridors, commuter station/bus access points, and trunk mains.',
    defaultVal: DEFAULT_PRIORITY_WEIGHTS.trafficAndAreaImpact
  },
  {
    key: 'timeWaiting',
    label: 'Time Waiting (SLA)',
    description: 'Unresolved hours elapsed relative to the category SLA window (24h–72h).',
    defaultVal: DEFAULT_PRIORITY_WEIGHTS.timeWaiting
  },
  {
    key: 'corroboratingReports',
    label: 'Nearby Corroborating Reports',
    description: 'Unresolved same-category civic reports within 450m verifying localized impact.',
    defaultVal: DEFAULT_PRIORITY_WEIGHTS.corroboratingReports
  },
  {
    key: 'safetyRisk',
    label: 'Supported Safety-Risk Indicator',
    description: 'Explicit electrical, open-chamber, sewage exposure, or pitch-dark corridor hazards.',
    defaultVal: DEFAULT_PRIORITY_WEIGHTS.safetyRisk
  }
];

export const PriorityWeightsModal: React.FC<PriorityWeightsModalProps> = ({
  isOpen,
  weights,
  onClose,
  onSaveWeights,
  onResetDefaultWeights
}) => {
  const [draft, setDraft] = useState<PriorityWeights>(weights);

  React.useEffect(() => {
    if (isOpen) {
      setDraft(weights);
    }
  }, [isOpen, weights]);

  if (!isOpen) return null;

  const totalMax =
    draft.severity +
    draft.publicLocationProximity +
    draft.trafficAndAreaImpact +
    draft.timeWaiting +
    draft.corroboratingReports +
    draft.safetyRisk;

  const handleFieldChange = (key: keyof PriorityWeights, rawVal: string) => {
    const parsed = Math.max(0, Math.min(60, Math.round(Number(rawVal) || 0)));
    setDraft((prev) => ({ ...prev, [key]: parsed }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#202329]/60 backdrop-blur-[2px] p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="priority-weights-modal-title"
    >
      <div className="bg-white border border-[#E3E4E0] rounded-2xl max-w-xl w-full overflow-hidden shadow-xl">
        <div className="px-6 py-4 bg-[#FAF9F6] border-b border-[#E3E4E0] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] text-[#4169E1] flex items-center justify-center shrink-0">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="priority-weights-modal-title"
                className="text-base font-bold text-[#25272B]"
              >
                Smart Priority Heuristic Weights
              </h2>
              <p className="text-xs text-[#555B64]">
                Transparent operational triage configuration (normalized to 0–100)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#555B64] hover:text-[#25272B] hover:bg-[#ECEBE6] rounded-lg transition-colors cursor-pointer"
            aria-label="Close priority weights configuration"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="rounded-xl bg-[#FAF9F6] border border-[#E3E4E0] p-3 text-xs text-[#555B64] leading-relaxed">
            <strong className="text-[#25272B]">Calibration Note:</strong> Default weights total{' '}
            <span className="font-mono font-semibold tabular-nums">100</span> points and serve as
            explainable administrative heuristics for queue ordering. If adjusted to a total other
            than 100 (current sum:{' '}
            <span className="font-mono font-semibold text-[#25272B] tabular-nums">{totalMax}</span>
            ), scores automatically normalize to the 0–100 scale.
          </div>

          <div className="space-y-3">
            {WEIGHT_FIELDS.map((field) => (
              <div
                key={field.key}
                className="p-3 rounded-xl border border-[#E3E4E0] bg-white space-y-1.5"
              >
                <div className="flex items-center justify-between gap-4">
                  <label
                    htmlFor={`weight-${field.key}`}
                    className="text-xs font-semibold text-[#25272B]"
                  >
                    {field.label}{' '}
                    <span className="text-[#70757D] font-normal">
                      (Default: {field.defaultVal})
                    </span>
                  </label>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      id={`weight-${field.key}`}
                      type="number"
                      min={0}
                      max={60}
                      value={draft[field.key]}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      className="w-16 px-2 py-1 text-xs font-mono font-semibold text-right text-[#25272B] bg-[#FAF9F6] border border-[#D8D9D3] rounded-md tabular-nums focus:outline-none focus:ring-2 focus:ring-[#4169E1]"
                    />
                    <span className="text-xs text-[#555B64] font-mono">pts</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={60}
                  value={draft[field.key]}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  className="w-full accent-[#4169E1] cursor-pointer"
                  aria-label={`${field.label} weight slider`}
                />
                <p className="text-[11px] text-[#555B64]">{field.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 bg-[#FAF9F6] border-t border-[#E3E4E0] flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setDraft({ ...DEFAULT_PRIORITY_WEIGHTS });
              onResetDefaultWeights();
              onClose();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#555B64] hover:text-[#25272B] bg-white border border-[#D8D9D3] hover:bg-[#F4F3EF] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults (100 pts)</span>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-[#555B64] hover:text-[#25272B] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={totalMax <= 0}
              onClick={() => {
                onSaveWeights(draft);
                onClose();
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#4169E1] hover:bg-[#3457C9] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Apply & Recalculate Queue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
