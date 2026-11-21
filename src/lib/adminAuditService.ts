import { Complaint, ComplaintCategory, StatusHistoryEntry } from '../types/urbanfix';

export type AdminAuditActionType =
  | 'status_transition'
  | 'department_assignment'
  | 'initial_submission'
  | 'category_reclassified'
  | 'priority_weights_updated'
  | 'priority_recalculated'
  | 'demo_dataset_reset';

export type AuditPersistenceScope =
  | 'supabase_status_history'
  | 'demo_status_history'
  | 'local_session_log';

export interface AdminAuditEntry {
  id: string;
  timestamp: string;
  actionType: AdminAuditActionType;
  actionLabel: string;
  actorName: string;
  complaintId?: string;
  referenceNumber?: string;
  complaintTitle?: string;
  complaintCategory?: ComplaintCategory;
  previousValue?: string;
  newValue?: string;
  note: string;
  persistenceScope: AuditPersistenceScope;
}

const LOCAL_OPS_AUDIT_KEY = 'urbanfix_admin_ops_audit_v1';

export function loadLocalAdminOpsAudit(): AdminAuditEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_OPS_AUDIT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AdminAuditEntry[]) : [];
  } catch {
    return [];
  }
}

export function recordLocalAdminOpsAudit(
  entry: Omit<AdminAuditEntry, 'id' | 'timestamp' | 'persistenceScope'>
): AdminAuditEntry {
  const created: AdminAuditEntry = {
    ...entry,
    id: `ops-audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    persistenceScope: 'local_session_log'
  };

  try {
    const existing = loadLocalAdminOpsAudit();
    const updated = [created, ...existing].slice(0, 120);
    localStorage.setItem(LOCAL_OPS_AUDIT_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota issues in restricted frames
  }

  return created;
}

export function clearLocalAdminOpsAudit(): void {
  try {
    localStorage.removeItem(LOCAL_OPS_AUDIT_KEY);
  } catch {
    // Ignore storage issues
  }
}

/**
 * Merges real complaint status_history records with real session-recorded administrative
 * operations (priority weight changes, explicit recalculations, category updates).
 * Strictly avoids inventing synthetic log rows.
 */
export function buildUnifiedAdminAuditFeed(
  complaints: Complaint[],
  historyByComplaintId: Record<string, StatusHistoryEntry[]>,
  localOpsEntries: AdminAuditEntry[],
  isDemoMode: boolean
): AdminAuditEntry[] {
  const complaintMap = new Map<string, Complaint>();
  for (const c of complaints) {
    complaintMap.set(c.id, c);
  }

  const historyPersistence: AuditPersistenceScope = isDemoMode
    ? 'demo_status_history'
    : 'supabase_status_history';

  const derivedFromHistory: AdminAuditEntry[] = [];

  for (const [complaintId, entries] of Object.entries(historyByComplaintId)) {
    const complaint = complaintMap.get(complaintId);
    for (const h of entries) {
      const noteText = h.note || '';
      const isCategoryChange = /category updated from/i.test(noteText);
      const isInitial = h.previous_status === null;
      const isDeptOnly =
        !isInitial &&
        !isCategoryChange &&
        h.previous_status === h.new_status &&
        /department/i.test(noteText);

      let actionType: AdminAuditActionType = 'status_transition';
      let actionLabel = 'Status Transition';
      if (isCategoryChange) {
        actionType = 'category_reclassified';
        actionLabel = 'Category Reclassified';
      } else if (isInitial) {
        actionType = 'initial_submission';
        actionLabel = 'Complaint Logged';
      } else if (isDeptOnly) {
        actionType = 'department_assignment';
        actionLabel = 'Department Assigned';
      }

      derivedFromHistory.push({
        id: h.id,
        timestamp: h.timestamp,
        actionType,
        actionLabel,
        actorName: h.actor_name || (isInitial ? 'Verified Citizen' : 'Authorized Officer'),
        complaintId,
        referenceNumber: complaint?.reference_number,
        complaintTitle: complaint?.title,
        complaintCategory: complaint?.category,
        previousValue: h.previous_status || undefined,
        newValue: h.new_status,
        note:
          noteText ||
          (h.previous_status
            ? `Status changed from ${h.previous_status} to ${h.new_status}.`
            : `Initial status recorded as ${h.new_status}.`),
        persistenceScope: historyPersistence
      });
    }
  }

  return [...localOpsEntries, ...derivedFromHistory].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
