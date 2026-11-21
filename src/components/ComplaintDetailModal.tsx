import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  GitBranch,
  History,
  MapPin,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Tag,
  User,
  X
} from 'lucide-react';
import {
  AdminUpdateComplaintInput,
  CATEGORIES,
  Complaint,
  ComplaintCategory,
  ComplaintStatus,
  DEPARTMENTS,
  MunicipalDepartment,
  Profile,
  StatusHistoryEntry
} from '../types/urbanfix';
import { isComplaintOverdue, resolveImageSignedUrl } from '../lib/dataService';
import {
  DEFAULT_PRIORITY_WEIGHTS,
  evaluateComplaintPriority,
  PriorityWeights
} from '../lib/priorityEngine';
import {
  AdminComplaintAiAnalysis,
  buildDeterministicComplaintAnalysis,
  requestComplaintAiAnalysis
} from '../lib/adminAiService';
import { PriorityBreakdownPanel } from './PriorityBreakdownPanel';

interface ComplaintDetailModalProps {
  complaint: Complaint | null;
  history: StatusHistoryEntry[];
  currentUser: Profile | null;
  isDemoMode: boolean;
  onClose: () => void;
  onAdminUpdate?: (input: AdminUpdateComplaintInput) => Promise<void>;
  allComplaints?: Complaint[];
  priorityWeights?: PriorityWeights;
  onAdminCategoryUpdate?: (input: {
    complaintId: string;
    newCategory: ComplaintCategory;
    rationaleNote?: string;
  }) => Promise<void>;
  onSelectRelatedComplaint?: (complaint: Complaint) => void;
}

const STATUS_OPTIONS: ComplaintStatus[] = ['Submitted', 'In Progress', 'Resolved', 'Reopened'];

export const ComplaintDetailModal: React.FC<ComplaintDetailModalProps> = ({
  complaint,
  history,
  currentUser,
  isDemoMode,
  onClose,
  onAdminUpdate,
  allComplaints,
  priorityWeights = DEFAULT_PRIORITY_WEIGHTS,
  onAdminCategoryUpdate,
  onSelectRelatedComplaint
}) => {
  const [selectedStatus, setSelectedStatus] = useState<ComplaintStatus>('Submitted');
  const [selectedDept, setSelectedDept] = useState<MunicipalDepartment>('Unassigned');
  const [adminNote, setAdminNote] = useState('');
  const [confirmingUpdate, setConfirmingUpdate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null);

  // Admin AI & Category Reclassification State
  const [aiAnalysis, setAiAnalysis] = useState<AdminComplaintAiAnalysis | null>(null);
  const [loadingGemini, setLoadingGemini] = useState<boolean>(false);
  const [selectedCategoryDraft, setSelectedCategoryDraft] = useState<ComplaintCategory>('Roads');
  const [confirmingCategoryChange, setConfirmingCategoryChange] = useState<boolean>(false);
  const [updatingCategory, setUpdatingCategory] = useState<boolean>(false);

  const isAdmin = currentUser?.role === 'admin';

  const evaluation = useMemo(() => {
    if (!complaint || !isAdmin) return null;
    const pool = allComplaints && allComplaints.length > 0 ? allComplaints : [complaint];
    return evaluateComplaintPriority(complaint, pool, priorityWeights);
  }, [complaint, isAdmin, allComplaints, priorityWeights]);

  useEffect(() => {
    if (complaint) {
      setSelectedStatus(complaint.status);
      setSelectedDept(complaint.department);
      setSelectedCategoryDraft(complaint.category);
      setAdminNote('');
      setConfirmingUpdate(false);
      setConfirmingCategoryChange(false);
      setErrorMsg(null);
      setSuccessMsg(null);
      resolveImageSignedUrl(complaint.image_path).then(setResolvedImageUrl);
    }
  }, [complaint]);

  // Populate instant rule-based explainable analysis immediately when admin opens a complaint
  useEffect(() => {
    if (complaint && isAdmin && evaluation) {
      const localAnalysis = buildDeterministicComplaintAnalysis(complaint, evaluation);
      setAiAnalysis(localAnalysis);
      if (localAnalysis.categorization.suggestedCategory !== complaint.category) {
        setSelectedCategoryDraft(localAnalysis.categorization.suggestedCategory);
      } else {
        setSelectedCategoryDraft(complaint.category);
      }
    } else {
      setAiAnalysis(null);
    }
  }, [complaint, isAdmin, evaluation]);

  if (!complaint) return null;

  const { overdue, hoursElapsed, daysElapsed } = isComplaintOverdue(complaint);
  const hasChanges =
    selectedStatus !== complaint.status ||
    selectedDept !== complaint.department ||
    adminNote.trim().length > 0;

  const handleRunGeminiAnalysis = async (forceRefresh = false) => {
    if (!evaluation) return;
    setLoadingGemini(true);
    try {
      const res = await requestComplaintAiAnalysis(complaint, evaluation, { forceRefresh });
      setAiAnalysis(res);
      if (res.categorization.suggestedCategory !== complaint.category) {
        setSelectedCategoryDraft(res.categorization.suggestedCategory);
      }
    } finally {
      setLoadingGemini(false);
    }
  };

  const handleApplyCategoryChange = async () => {
    if (!onAdminCategoryUpdate || selectedCategoryDraft === complaint.category) return;
    setUpdatingCategory(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const rationaleNote =
        aiAnalysis && aiAnalysis.categorization.suggestedCategory === selectedCategoryDraft
          ? `Category updated from ${complaint.category} to ${selectedCategoryDraft} following administrative triage review (${aiAnalysis.categorization.rationale})`
          : `Category updated from ${complaint.category} to ${selectedCategoryDraft} by municipal administrator.`;

      await onAdminCategoryUpdate({
        complaintId: complaint.id,
        newCategory: selectedCategoryDraft,
        rationaleNote
      });
      setConfirmingCategoryChange(false);
      setSuccessMsg(
        `Category updated to ${selectedCategoryDraft} and recorded in status_history.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update complaint category.');
    } finally {
      setUpdatingCategory(false);
    }
  };

  const handleRequestSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!hasChanges) {
      setErrorMsg(
        'Please modify the status, assigned department, or add an official remark before saving.'
      );
      return;
    }
    setConfirmingUpdate(true);
  };

  const handleConfirmAdminUpdate = async () => {
    if (!onAdminUpdate) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await onAdminUpdate({
        complaintId: complaint.id,
        newStatus: selectedStatus,
        department: selectedDept,
        note: adminNote.trim() || undefined
      });
      setConfirmingUpdate(false);
      setAdminNote('');
      setSuccessMsg('Complaint status and department assignment recorded in audit history.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update complaint.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStatusBadge = (status: ComplaintStatus) => {
    switch (status) {
      case 'Resolved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Resolved</span>
          </span>
        );
      case 'In Progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[#EEF2FF] text-[#2B50C7] border border-[#C7D2FE]">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>In Progress</span>
          </span>
        );
      case 'Reopened':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]">
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span>Reopened</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[#FFF7ED] text-[#B45309] border border-[#FED7AA]">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>Submitted</span>
          </span>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#202329]/60 backdrop-blur-[2px] p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="complaint-modal-title"
    >
      <div
        className={`bg-white border border-[#E3E4E0] rounded-2xl ${
          isAdmin ? 'max-w-4xl' : 'max-w-3xl'
        } w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-[#E3E4E0] bg-[#FAF9F6]">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#555B64]">
              <span className="font-mono font-bold text-[#25272B] tabular-nums">
                {complaint.reference_number}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-[#25272B]">{complaint.category}</span>
              <span aria-hidden="true">·</span>
              {renderStatusBadge(complaint.status)}
              {overdue && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA] tabular-nums">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Overdue ({daysElapsed}d {hoursElapsed % 24}h)
                  </span>
                </span>
              )}
              {(isDemoMode || complaint.is_demo_record) && (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white text-[#555B64] border border-[#E3E4E0]">
                  Demo Data
                </span>
              )}
            </div>
            <h2
              id="complaint-modal-title"
              className="text-lg font-bold text-[#25272B] leading-snug"
            >
              {complaint.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#555B64] hover:text-[#25272B] hover:bg-[#ECEBE6] rounded-lg transition-colors shrink-0 cursor-pointer"
            aria-label="Close complaint details"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Admin Smart Priority Breakdown */}
          {isAdmin && evaluation && (
            <PriorityBreakdownPanel evaluation={evaluation} defaultExpanded={false} />
          )}

          {/* Core Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-6 border-b border-[#E3E4E0] text-sm">
            <div className="space-y-1">
              <div className="text-xs text-[#555B64] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#4169E1]" />
                <span>Locality & Ward</span>
              </div>
              <p className="font-semibold text-[#25272B] text-xs sm:text-sm">
                {complaint.locality}
              </p>
              <p className="text-xs text-[#555B64]">Landmark: {complaint.landmark}</p>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-[#555B64] flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#4169E1]" />
                <span>Assigned Department</span>
              </div>
              <p className="font-semibold text-[#25272B] text-xs sm:text-sm">
                {complaint.department}
              </p>
              <p className="text-xs text-[#555B64]">
                Severity: {complaint.priority || 'Medium'}
              </p>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-[#555B64] flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#4169E1]" />
                <span>Reporting Citizen</span>
              </div>
              <p className="font-semibold text-[#25272B] text-xs sm:text-sm">
                {complaint.owner_name || 'Verified Citizen'}
              </p>
              <p className="text-xs text-[#555B64] tabular-nums">
                Logged{' '}
                {new Date(complaint.created_at).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                })}
              </p>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-[#555B64] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#4169E1]" />
                <span>Last Updated</span>
              </div>
              <p className="font-semibold text-[#25272B] text-xs sm:text-sm tabular-nums">
                {new Date(complaint.updated_at).toLocaleString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>

          {/* Description & Field Photo */}
          <div className="space-y-2 pb-6 border-b border-[#E3E4E0]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#555B64] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#4169E1]" />
              <span>Detailed Citizen Observation</span>
            </h3>
            <p className="text-sm text-[#25272B] leading-relaxed whitespace-pre-line">
              {complaint.description}
            </p>

            {resolvedImageUrl && (
              <div className="mt-4">
                <p className="text-xs text-[#555B64] mb-2">Attached Field Photograph:</p>
                <div className="rounded-xl overflow-hidden border border-[#E3E4E0] bg-[#FAF9F6] max-h-64 flex items-center justify-center">
                  <img
                    src={resolvedImageUrl}
                    alt={`Photographic evidence for ${complaint.reference_number}`}
                    referrerPolicy="no-referrer"
                    className="max-h-64 w-auto object-contain"
                  />
                </div>
              </div>
            )}
          </div>

          {/* =================================================================
              ADMIN-ONLY EXPLAINABLE AI TRIAGE SUITE & RELATED REPORTS
          ================================================================= */}
          {isAdmin && evaluation && aiAnalysis && (
            <div className="rounded-2xl border border-[#E3E4E0] bg-[#FAF9F6] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E3E4E0]">
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-[#25272B] flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-[#4169E1]" />
                      <span>AI-Assisted Triage & Category Review</span>
                    </h3>
                    <span
                      className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${
                        aiAnalysis.source === 'gemini'
                          ? 'bg-[#EEF2FF] text-[#2B50C7] border-[#C7D2FE]'
                          : 'bg-white text-[#555B64] border-[#E3E4E0]'
                      }`}
                    >
                      {aiAnalysis.modelLabel}
                    </span>
                  </div>
                  <p className="text-xs text-[#555B64]">
                    Strictly grounded in submitted complaint fields (private citizen PII excluded).
                  </p>
                </div>

                <button
                  type="button"
                  disabled={loadingGemini}
                  onClick={() =>
                    handleRunGeminiAnalysis(aiAnalysis.source === 'gemini')
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#202329] hover:bg-[#2F333C] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${loadingGemini ? 'animate-spin' : ''}`}
                  />
                  <span>
                    {loadingGemini
                      ? 'Analyzing with Gemini...'
                      : aiAnalysis.source === 'gemini'
                      ? 'Refresh Gemini Analysis'
                      : 'Generate with Gemini AI'}
                  </span>
                </button>
              </div>

              {aiAnalysis.fallbackReason && (
                <div className="rounded-lg bg-white border border-[#E3E4E0] px-3 py-2 text-xs text-[#555B64]">
                  {aiAnalysis.fallbackReason}
                </div>
              )}

              {/* A. Structured Complaint Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-white border border-[#E3E4E0] rounded-xl p-3 space-y-1">
                  <div className="font-bold text-[#25272B]">Main Problem</div>
                  <p className="text-[#555B64] leading-relaxed">
                    {aiAnalysis.summary.mainProblem}
                  </p>
                </div>
                <div className="bg-white border border-[#E3E4E0] rounded-xl p-3 space-y-1">
                  <div className="font-bold text-[#25272B]">Potential Civic Impact</div>
                  <p className="text-[#555B64] leading-relaxed">
                    {aiAnalysis.summary.potentialImpact}
                  </p>
                </div>
                <div className="bg-white border border-[#E3E4E0] rounded-xl p-3 space-y-1">
                  <div className="font-bold text-[#25272B]">Recorded Operational Details</div>
                  <p className="text-[#555B64] leading-relaxed">
                    {aiAnalysis.summary.importantDetails}
                  </p>
                </div>
                <div className="bg-white border border-[#E3E4E0] rounded-xl p-3 space-y-1">
                  <div className="font-bold text-[#25272B]">Missing / Unverified Context</div>
                  <p className="text-[#555B64] leading-relaxed">
                    {aiAnalysis.summary.missingInformation}
                  </p>
                </div>
              </div>

              {/* C. AI Priority Narrative */}
              <div className="bg-white border border-[#E3E4E0] rounded-xl p-3 space-y-1 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[#25272B]">
                    Priority Score Narrative (Deterministic Score: {evaluation.score}/100)
                  </span>
                </div>
                <p className="text-[#555B64] leading-relaxed">{aiAnalysis.priorityNarrative}</p>
              </div>

              {/* B. Assisted Categorization & Authorized Reclassification */}
              <div className="bg-white border border-[#E3E4E0] rounded-xl p-3.5 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-bold text-[#25272B]">
                    <Tag className="w-3.5 h-3.5 text-[#4169E1]" />
                    <span>Assisted Category Verification</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                      aiAnalysis.categorization.matchesCurrent
                        ? 'bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]'
                        : 'bg-[#FFF7ED] text-[#B45309] border border-[#FED7AA]'
                    }`}
                  >
                    {aiAnalysis.categorization.matchesCurrent
                      ? `Matches Filed Category (${complaint.category})`
                      : `Suggested Reclassification: ${aiAnalysis.categorization.suggestedCategory}`}
                  </span>
                </div>

                <p className="text-[#555B64] leading-relaxed">
                  {aiAnalysis.categorization.rationale}
                </p>

                {onAdminCategoryUpdate && (
                  <div className="pt-2 border-t border-[#E3E4E0] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <label
                        htmlFor="admin-reclassify-category"
                        className="text-xs font-semibold text-[#25272B]"
                      >
                        Administrative Category:
                      </label>
                      <select
                        id="admin-reclassify-category"
                        value={selectedCategoryDraft}
                        onChange={(e) => {
                          setSelectedCategoryDraft(e.target.value as ComplaintCategory);
                          setConfirmingCategoryChange(false);
                        }}
                        className="px-2.5 py-1.5 text-xs bg-[#FAF9F6] border border-[#D8D9D3] rounded-lg text-[#25272B] focus:outline-none focus:ring-2 focus:ring-[#4169E1]"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.id} ({c.label})
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedCategoryDraft !== complaint.category && (
                      !confirmingCategoryChange ? (
                        <button
                          type="button"
                          onClick={() => setConfirmingCategoryChange(true)}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-[#4169E1] hover:bg-[#3457C9] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Review Category Change → {selectedCategoryDraft}
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={updatingCategory}
                            onClick={() => setConfirmingCategoryChange(false)}
                            className="px-2.5 py-1.5 text-xs font-semibold text-[#555B64] bg-[#FAF9F6] border border-[#D8D9D3] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={updatingCategory}
                            onClick={handleApplyCategoryChange}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-[#202329] hover:bg-[#2F333C] disabled:opacity-50 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            {updatingCategory ? 'Applying...' : 'Confirm & Log Category Update'}
                          </button>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>

              {/* D. Possible Related Reports */}
              <div className="bg-white border border-[#E3E4E0] rounded-xl p-3.5 space-y-2.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-bold text-[#25272B]">
                    <GitBranch className="w-3.5 h-3.5 text-[#4169E1]" />
                    <span>Possible Related Reports</span>
                  </div>
                  <span className="text-[11px] text-[#555B64] tabular-nums">
                    {evaluation.relatedReports.length} candidate{' '}
                    {evaluation.relatedReports.length === 1 ? 'match' : 'matches'} (never
                    auto-merged)
                  </span>
                </div>

                {evaluation.relatedReports.length === 0 ? (
                  <p className="text-[#555B64]">
                    No nearby same-category complaints or strong shared-keyword candidates detected.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {evaluation.relatedReports.map((rel) => (
                      <div
                        key={rel.complaint.id}
                        className="p-2.5 rounded-lg border border-[#E3E4E0] bg-[#FAF9F6] flex flex-wrap items-center justify-between gap-2"
                      >
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-bold text-[#25272B] tabular-nums">
                              {rel.complaint.reference_number}
                            </span>
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-white border border-[#E3E4E0] rounded text-[#555B64]">
                              {rel.complaint.status}
                            </span>
                            <span className="text-[#25272B] font-semibold truncate">
                              {rel.complaint.title}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#555B64]">{rel.matchReason}</p>
                        </div>

                        {onSelectRelatedComplaint && (
                          <button
                            type="button"
                            onClick={() => onSelectRelatedComplaint(rel.complaint)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#4169E1] hover:text-[#2B50C7] bg-white border border-[#E3E4E0] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <span>Inspect</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Status Timeline */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#25272B] flex items-center gap-2">
                <History className="w-4 h-4 text-[#4169E1]" />
                <span>Immutable Status Audit Timeline</span>
              </h3>
              <span className="text-xs text-[#555B64] tabular-nums">
                {history.length} {history.length === 1 ? 'recorded event' : 'recorded events'}
              </span>
            </div>

            {history.length === 0 ? (
              <p className="text-xs text-[#555B64] py-2">
                Initial status recorded upon submission ({complaint.status}).
              </p>
            ) : (
              <ol className="relative border-l border-[#D8D9D3] ml-2.5 space-y-4 py-1">
                {history.map((entry, idx) => {
                  const isLatest = idx === history.length - 1;
                  return (
                    <li key={entry.id} className="ml-5">
                      <span
                        className={`absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full border-2 border-white ${
                          isLatest ? 'bg-[#4169E1]' : 'bg-[#9CA3AF]'
                        }`}
                      />
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#555B64]">
                        <span className="font-semibold text-[#25272B]">
                          {entry.previous_status
                            ? `${entry.previous_status} → ${entry.new_status}`
                            : `Initial Status: ${entry.new_status}`}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {new Date(entry.timestamp).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        {entry.actor_name && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>By {entry.actor_name}</span>
                          </>
                        )}
                      </div>
                      {entry.note && (
                        <p className="mt-1 text-sm text-[#25272B] leading-relaxed">{entry.note}</p>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {/* Admin Action Panel */}
          {isAdmin && onAdminUpdate && (
            <form
              onSubmit={handleRequestSave}
              className="pt-6 border-t border-[#E3E4E0] space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-[#25272B] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#4169E1]" />
                  <span>Municipal Administrator Dispatch & Status Controls</span>
                </h3>
                <span className="text-xs text-[#555B64]">
                  Appends signed record to status_history
                </span>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C]">
                  {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="p-3 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-xs text-[#047857]">
                  {successMsg}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="admin-dept-select"
                    className="block text-xs font-semibold text-[#25272B] mb-1.5"
                  >
                    Assign Municipal Department
                  </label>
                  <select
                    id="admin-dept-select"
                    value={selectedDept}
                    onChange={(e) => {
                      setSelectedDept(e.target.value as MunicipalDepartment);
                      setConfirmingUpdate(false);
                    }}
                    className="w-full px-3 py-2 text-sm bg-[#FAF9F6] border border-[#D8D9D3] rounded-xl text-[#25272B] focus:outline-none focus:ring-2 focus:ring-[#4169E1]"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="admin-status-select"
                    className="block text-xs font-semibold text-[#25272B] mb-1.5"
                  >
                    Update Lifecycle Status
                  </label>
                  <select
                    id="admin-status-select"
                    value={selectedStatus}
                    onChange={(e) => {
                      setSelectedStatus(e.target.value as ComplaintStatus);
                      setConfirmingUpdate(false);
                    }}
                    className="w-full px-3 py-2 text-sm bg-[#FAF9F6] border border-[#D8D9D3] rounded-xl text-[#25272B] focus:outline-none focus:ring-2 focus:ring-[#4169E1]"
                  >
                    {STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="admin-action-note"
                  className="block text-xs font-semibold text-[#25272B] mb-1.5"
                >
                  Official Resolution / Dispatch Remark (Optional)
                </label>
                <input
                  id="admin-action-note"
                  type="text"
                  value={adminNote}
                  onChange={(e) => {
                    setAdminNote(e.target.value);
                    setConfirmingUpdate(false);
                  }}
                  placeholder="e.g., Ward engineer inspected site; cold-mix asphalt work order issued"
                  className="w-full px-3 py-2 text-sm bg-[#FAF9F6] border border-[#D8D9D3] rounded-xl text-[#25272B] placeholder:text-[#70757D] focus:outline-none focus:ring-2 focus:ring-[#4169E1]"
                />
              </div>

              {!confirmingUpdate ? (
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-semibold text-[#25272B] bg-[#FAF9F6] hover:bg-[#ECEBE6] border border-[#E3E4E0] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Close Window
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#4169E1] hover:bg-[#3457C9] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Review & Save Update
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-[#FFF7ED] border border-[#FED7AA] space-y-3">
                  <div className="text-xs text-[#9A3412] space-y-1">
                    <p className="font-bold">
                      Confirm Official Administrative Action for {complaint.reference_number}
                    </p>
                    <p>
                      Status will be set to <strong>{selectedStatus}</strong> and department set to{' '}
                      <strong>{selectedDept}</strong>. This action writes an immutable entry to{' '}
                      <code className="font-mono">status_history</code>.
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setConfirmingUpdate(false)}
                      className="px-3.5 py-1.5 text-xs font-semibold text-[#25272B] bg-white border border-[#D8D9D3] hover:bg-[#FAF9F6] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleConfirmAdminUpdate}
                      className="px-4 py-1.5 text-xs font-semibold text-white bg-[#202329] hover:bg-[#2F333C] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {submitting ? 'Recording...' : 'Confirm & Commit Update'}
                    </button>
                  </div>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
