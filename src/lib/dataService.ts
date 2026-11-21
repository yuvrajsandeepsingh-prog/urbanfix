import {
  AdminUpdateComplaintInput,
  CIVIC_AREAS,
  Complaint,
  ComplaintCategory,
  CreateComplaintInput,
  Profile,
  PublicMapIssue,
  StatusHistoryEntry
} from '../types/urbanfix';
import {
  DEMO_ADMIN_PROFILE,
  DEMO_CITIZEN_2_PROFILE,
  DEMO_CITIZEN_PROFILE,
  INITIAL_DEMO_COMPLAINTS,
  INITIAL_DEMO_HISTORY,
  INITIAL_DEMO_PROFILES
} from './seedData';
import { isSupabaseConfigured, supabase } from './supabase';

const STORAGE_KEYS = {
  PROFILES: 'urbanfix_demo_profiles_v3',
  COMPLAINTS: 'urbanfix_demo_complaints_v3',
  HISTORY: 'urbanfix_demo_history_v3',
  SESSION_USER_ID: 'urbanfix_demo_session_uid_v1'
};

export function inferAreaAndCoordinates(
  locality: string,
  explicitAreaName?: string
): { areaName: string; lat: number; lng: number } {
  const haystack = `${explicitAreaName || ''} ${locality}`.toLowerCase();
  const matchedArea =
    CIVIC_AREAS.find(
      (area) =>
        haystack.includes(area.name.toLowerCase()) ||
        haystack.includes(area.ward.toLowerCase()) ||
        haystack.includes(area.id.toLowerCase())
    ) || CIVIC_AREAS[0];

  return {
    areaName: matchedArea.name,
    lat: Number(matchedArea.centerLat.toFixed(5)),
    lng: Number(matchedArea.centerLng.toFixed(5))
  };
}

/**
 * Converts Complaint records into privacy-safe PublicMapIssue objects.
 * Strictly strips owner_user_id, email addresses, and private account metadata,
 * and never assigns random coordinates to real user complaints.
 */
export function toPublicMapIssues(
  sourceComplaints: Complaint[],
  currentUserId?: string | null
): PublicMapIssue[] {
  return sourceComplaints.map((c) => {
    const hasStoredCoords =
      typeof c.approx_lat === 'number' && typeof c.approx_lng === 'number';
    const inferred = inferAreaAndCoordinates(c.locality, c.area_name);
    const isDemoRecord = Boolean(c.is_demo_record || !isSupabaseConfigured);

    return {
      id: c.id,
      reference_number: c.reference_number,
      reporter_display_name: c.owner_name?.trim() || 'Verified Citizen',
      category: c.category,
      title: c.title,
      description: c.description,
      locality: c.locality,
      landmark: c.landmark,
      area_name: c.area_name || inferred.areaName,
      status: c.status,
      priority: c.priority || 'Medium',
      approx_lat: hasStoredCoords ? (c.approx_lat as number) : inferred.lat,
      approx_lng: hasStoredCoords ? (c.approx_lng as number) : inferred.lng,
      is_demo_record: isDemoRecord,
      is_exact_pin: hasStoredCoords && !isDemoRecord,
      created_at: c.created_at,
      updated_at: c.updated_at,
      is_own_complaint: Boolean(currentUserId && c.owner_user_id === currentUserId)
    };
  });
}

function loadDemoStore() {
  try {
    const rawProfiles = localStorage.getItem(STORAGE_KEYS.PROFILES);
    const rawComplaints = localStorage.getItem(STORAGE_KEYS.COMPLAINTS);
    const rawHistory = localStorage.getItem(STORAGE_KEYS.HISTORY);

    const profiles: Profile[] = rawProfiles ? JSON.parse(rawProfiles) : INITIAL_DEMO_PROFILES;
    const complaints: Complaint[] = rawComplaints
      ? JSON.parse(rawComplaints)
      : INITIAL_DEMO_COMPLAINTS;
    const history: StatusHistoryEntry[] = rawHistory
      ? JSON.parse(rawHistory)
      : INITIAL_DEMO_HISTORY;

    if (!rawProfiles) localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
    if (!rawComplaints) localStorage.setItem(STORAGE_KEYS.COMPLAINTS, JSON.stringify(complaints));
    if (!rawHistory) localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));

    return { profiles, complaints, history };
  } catch {
    return {
      profiles: [...INITIAL_DEMO_PROFILES],
      complaints: [...INITIAL_DEMO_COMPLAINTS],
      history: [...INITIAL_DEMO_HISTORY]
    };
  }
}

function saveDemoStore(data: {
  profiles?: Profile[];
  complaints?: Complaint[];
  history?: StatusHistoryEntry[];
}) {
  try {
    if (data.profiles) localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(data.profiles));
    if (data.complaints)
      localStorage.setItem(STORAGE_KEYS.COMPLAINTS, JSON.stringify(data.complaints));
    if (data.history) localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(data.history));
  } catch {
    // Ignore storage quota errors in restricted frames
  }
}

export function resetDemoDataset(): void {
  saveDemoStore({
    profiles: INITIAL_DEMO_PROFILES,
    complaints: INITIAL_DEMO_COMPLAINTS,
    history: INITIAL_DEMO_HISTORY
  });
}

export function generateReferenceNumber(existingComplaints: Complaint[]): string {
  const year = new Date().getFullYear();
  const existingNumbers = existingComplaints
    .map((c) => {
      const match = c.reference_number.match(/^UF-\d{4}-(\d{4})$/);
      return match ? parseInt(match[1], 10) : 1000;
    })
    .filter((n) => !Number.isNaN(n));

  const maxNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 1090;
  const nextNum = Math.min(9999, maxNum + 1);
  return `UF-${year}-${String(nextNum).padStart(4, '0')}`;
}

export function isComplaintOverdue(complaint: Complaint): {
  overdue: boolean;
  hoursElapsed: number;
  daysElapsed: number;
} {
  const createdMs = new Date(complaint.created_at).getTime();
  const hoursElapsed = Math.max(0, Math.round((Date.now() - createdMs) / (1000 * 3600)));
  const daysElapsed = Math.floor(hoursElapsed / 24);
  const overdue = complaint.status !== 'Resolved' && hoursElapsed > 72;
  return { overdue, hoursElapsed, daysElapsed };
}

// ============================================================================
// AUTHENTICATION & SESSION MANAGEMENT
// ============================================================================

export async function getCurrentProfile(): Promise<Profile | null> {
  if (isSupabaseConfigured && supabase) {
    const {
      data: { session },
      error: sessionErr
    } = await supabase.auth.getSession();
    if (sessionErr || !session?.user) return null;

    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profErr || !profile) {
      return {
        id: session.user.id,
        name:
          (session.user.user_metadata?.name as string) ||
          session.user.email?.split('@')[0] ||
          'Citizen',
        email: session.user.email || '',
        role: 'citizen',
        created_at: session.user.created_at
      };
    }

    return {
      id: profile.id,
      name: profile.name,
      email: profile.email || session.user.email || '',
      role: profile.role === 'admin' ? 'admin' : 'citizen',
      created_at: profile.created_at
    };
  }

  // Demo Mode Session
  const { profiles } = loadDemoStore();
  const savedUid = localStorage.getItem(STORAGE_KEYS.SESSION_USER_ID);
  if (!savedUid) return null;
  return profiles.find((p) => p.id === savedUid) || null;
}

export async function signInUser(email: string, password: string): Promise<Profile> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password
    });
    if (error || !data.user) {
      throw new Error(error?.message || 'Unable to sign in with the provided credentials.');
    }
    const profile = await getCurrentProfile();
    if (!profile) {
      throw new Error('Signed in, but user profile could not be retrieved from the database.');
    }
    return profile;
  }

  // Demo Mode Sign-In
  const { profiles } = loadDemoStore();
  let matched = profiles.find((p) => p.email.toLowerCase() === normalizedEmail);

  if (!matched) {
    throw new Error(
      'No account found with this email in the Demo dataset. Use Sign Up to register a new Citizen account, or click one of the Viva Demo Quick-Fill accounts below.'
    );
  }

  localStorage.setItem(STORAGE_KEYS.SESSION_USER_ID, matched.id);
  return matched;
}

export async function signUpCitizen(
  name: string,
  email: string,
  password: string
): Promise<{ profile: Profile; requiresEmailConfirmation: boolean }> {
  const trimmedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();

  if (trimmedName.length < 2) {
    throw new Error('Please provide your full name (minimum 2 characters).');
  }
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('Please provide a valid email address.');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  if (isSupabaseConfigured && supabase) {
    // Public registration strictly creates a citizen account. Role cannot be passed as admin.
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          name: trimmedName,
          role: 'citizen'
        }
      }
    });

    if (error || !data.user) {
      throw new Error(error?.message || 'Registration failed.');
    }

    const newProfile: Profile = {
      id: data.user.id,
      name: trimmedName,
      email: normalizedEmail,
      role: 'citizen',
      created_at: new Date().toISOString()
    };

    // If email confirmation is disabled in Supabase, session is active immediately
    if (data.session) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        name: trimmedName,
        email: normalizedEmail,
        role: 'citizen'
      });
    }

    return {
      profile: newProfile,
      requiresEmailConfirmation: !data.session
    };
  }

  // Demo Mode Registration (strictly enforces role: 'citizen')
  const { profiles } = loadDemoStore();
  if (profiles.some((p) => p.email.toLowerCase() === normalizedEmail)) {
    throw new Error('An account with this email already exists. Please sign in instead.');
  }

  const createdProfile: Profile = {
    id: `demo-citizen-${Date.now()}`,
    name: trimmedName,
    email: normalizedEmail,
    role: 'citizen',
    created_at: new Date().toISOString()
  };

  const nextProfiles = [...profiles, createdProfile];
  saveDemoStore({ profiles: nextProfiles });
  localStorage.setItem(STORAGE_KEYS.SESSION_USER_ID, createdProfile.id);

  return { profile: createdProfile, requiresEmailConfirmation: false };
}

export async function signOutUser(): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
    return;
  }
  localStorage.removeItem(STORAGE_KEYS.SESSION_USER_ID);
}

export function switchDemoSessionRole(target: 'citizen' | 'citizen2' | 'admin' | 'guest'): Profile | null {
  if (isSupabaseConfigured) return null;
  if (target === 'guest') {
    localStorage.removeItem(STORAGE_KEYS.SESSION_USER_ID);
    return null;
  }
  const profile =
    target === 'admin'
      ? DEMO_ADMIN_PROFILE
      : target === 'citizen2'
      ? DEMO_CITIZEN_2_PROFILE
      : DEMO_CITIZEN_PROFILE;
  localStorage.setItem(STORAGE_KEYS.SESSION_USER_ID, profile.id);
  return profile;
}

// ============================================================================
// COMPLAINTS & STATUS HISTORY DATA ACCESS (RLS-AWARE)
// ============================================================================

export async function fetchComplaintsForUser(currentUser: Profile | null): Promise<{
  complaints: Complaint[];
  historyByComplaintId: Record<string, StatusHistoryEntry[]>;
  publicSummaryAllComplaints: Complaint[];
  nearbyMapIssues: PublicMapIssue[];
}> {
  if (isSupabaseConfigured && supabase) {
    if (!currentUser) {
      // Unauthenticated visitor on landing page: fetch only what RLS allows or return empty list
      const { data: pubData } = await supabase
        .from('complaints')
        .select('*, profiles(name)')
        .order('created_at', { ascending: false });

      const mapped = (pubData || []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        reference_number: String(row.reference_number),
        owner_user_id: String(row.owner_user_id),
        owner_name: (row.profiles as { name?: string } | null)?.name || 'Citizen',
        category: row.category as Complaint['category'],
        title: String(row.title),
        description: String(row.description),
        locality: String(row.locality),
        landmark: String(row.landmark),
        image_path: (row.image_path as string | null) || null,
        department: (row.department as Complaint['department']) || 'Unassigned',
        status: row.status as Complaint['status'],
        created_at: String(row.created_at),
        updated_at: String(row.updated_at)
      }));

      return {
        complaints: mapped,
        historyByComplaintId: {},
        publicSummaryAllComplaints: mapped,
        nearbyMapIssues: toPublicMapIssues(mapped, null)
      };
    }

    // Authenticated query: RLS automatically restricts citizens to their own rows and allows admins all rows
    let query = supabase
      .from('complaints')
      .select('*, profiles(name)')
      .order('created_at', { ascending: false });

    if (currentUser.role !== 'admin') {
      query = query.eq('owner_user_id', currentUser.id);
    }

    const { data: rows, error } = await query;
    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    const complaints: Complaint[] = (rows || []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      reference_number: String(row.reference_number),
      owner_user_id: String(row.owner_user_id),
      owner_name: (row.profiles as { name?: string } | null)?.name || currentUser.name,
      category: row.category as Complaint['category'],
      title: String(row.title),
      description: String(row.description),
      locality: String(row.locality),
      landmark: String(row.landmark),
      image_path: (row.image_path as string | null) || null,
      department: (row.department as Complaint['department']) || 'Unassigned',
      status: row.status as Complaint['status'],
      created_at: String(row.created_at),
      updated_at: String(row.updated_at)
    }));

    const complaintIds = complaints.map((c) => c.id);
    const historyByComplaintId: Record<string, StatusHistoryEntry[]> = {};

    if (complaintIds.length > 0) {
      const { data: historyRows, error: histErr } = await supabase
        .from('status_history')
        .select('*, profiles(name)')
        .in('complaint_id', complaintIds)
        .order('timestamp', { ascending: true });

      if (histErr) {
        throw new Error(`Failed to load status history: ${histErr.message}`);
      }

      for (const h of historyRows || []) {
        const entry: StatusHistoryEntry = {
          id: String(h.id),
          complaint_id: String(h.complaint_id),
          previous_status: (h.previous_status as Complaint['status'] | null) || null,
          new_status: h.new_status as Complaint['status'],
          actor_id: String(h.actor_id),
          actor_name: (h.profiles as { name?: string } | null)?.name || 'Authorized Officer',
          note: (h.note as string | undefined) || undefined,
          timestamp: String(h.timestamp)
        };
        if (!historyByComplaintId[entry.complaint_id]) {
          historyByComplaintId[entry.complaint_id] = [];
        }
        historyByComplaintId[entry.complaint_id].push(entry);
      }
    }

    return {
      complaints,
      historyByComplaintId,
      publicSummaryAllComplaints: complaints,
      nearbyMapIssues: toPublicMapIssues(complaints, currentUser.id)
    };
  }

  // Demo Mode: Enforce identical RLS isolation rules!
  // Citizens only receive their own private complaints in their personal list;
  // nearbyMapIssues provides privacy-safe community pins without email or owner_user_id.
  const { complaints: allComplaints, history: allHistory } = loadDemoStore();
  const sortedAll = [...allComplaints].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const visibleComplaints = !currentUser
    ? []
    : currentUser.role === 'admin'
    ? sortedAll
    : sortedAll.filter((c) => c.owner_user_id === currentUser.id);

  const historyByComplaintId: Record<string, StatusHistoryEntry[]> = {};
  for (const h of allHistory) {
    if (!historyByComplaintId[h.complaint_id]) {
      historyByComplaintId[h.complaint_id] = [];
    }
    historyByComplaintId[h.complaint_id].push(h);
  }
  Object.values(historyByComplaintId).forEach((list) =>
    list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  );

  return {
    complaints: visibleComplaints,
    historyByComplaintId,
    publicSummaryAllComplaints: sortedAll,
    nearbyMapIssues: toPublicMapIssues(sortedAll, currentUser?.id)
  };
}

export async function lookupComplaintByReference(
  referenceNumber: string
): Promise<{ complaint: Complaint; history: StatusHistoryEntry[] } | null> {
  const normalizedRef = referenceNumber.trim().toUpperCase();
  if (!normalizedRef) return null;

  if (isSupabaseConfigured && supabase) {
    const { data: row, error } = await supabase
      .from('complaints')
      .select('*, profiles(name)')
      .eq('reference_number', normalizedRef)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!row) return null;

    const { data: histRows } = await supabase
      .from('status_history')
      .select('*, profiles(name)')
      .eq('complaint_id', row.id)
      .order('timestamp', { ascending: true });

    const complaint: Complaint = {
      id: String(row.id),
      reference_number: String(row.reference_number),
      owner_user_id: String(row.owner_user_id),
      owner_name: (row.profiles as { name?: string } | null)?.name || 'Citizen',
      category: row.category,
      title: String(row.title),
      description: String(row.description),
      locality: String(row.locality),
      landmark: String(row.landmark),
      image_path: row.image_path || null,
      department: row.department || 'Unassigned',
      status: row.status,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at)
    };

    const history: StatusHistoryEntry[] = (histRows || []).map((h: Record<string, unknown>) => ({
      id: String(h.id),
      complaint_id: String(h.complaint_id),
      previous_status: (h.previous_status as Complaint['status'] | null) || null,
      new_status: h.new_status as Complaint['status'],
      actor_id: String(h.actor_id),
      actor_name: (h.profiles as { name?: string } | null)?.name || 'Municipal System',
      note: (h.note as string | undefined) || undefined,
      timestamp: String(h.timestamp)
    }));

    return { complaint, history };
  }

  const { complaints, history } = loadDemoStore();
  const match = complaints.find((c) => c.reference_number.toUpperCase() === normalizedRef);
  if (!match) return null;
  const itemHistory = history
    .filter((h) => h.complaint_id === match.id)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return { complaint: match, history: itemHistory };
}

export async function createCitizenComplaint(
  currentUser: Profile,
  input: CreateComplaintInput
): Promise<Complaint> {
  const title = input.title.trim();
  const description = input.description.trim();
  const locality = input.locality.trim();
  const landmark = input.landmark.trim();

  if (title.length < 5) {
    throw new Error('Complaint title must be at least 5 characters long.');
  }
  if (description.length < 15) {
    throw new Error('Please provide a clear description (minimum 15 characters).');
  }
  if (locality.length < 3) {
    throw new Error('Please specify the locality or ward.');
  }
  if (landmark.length < 3) {
    throw new Error('Please specify a recognizable nearby landmark.');
  }

  if (isSupabaseConfigured && supabase) {
    const refNumber = `UF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    let uploadedImagePath: string | null = null;

    if (input.imageFile) {
      const ext = input.imageFile.name.split('.').pop() || 'jpg';
      const storagePath = `${currentUser.id}/${refNumber}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('complaint-images')
        .upload(storagePath, input.imageFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Failed to upload complaint photo to private bucket: ${uploadError.message}`);
      }
      uploadedImagePath = storagePath;
    }

    const { data, error } = await supabase
      .from('complaints')
      .insert({
        reference_number: refNumber,
        owner_user_id: currentUser.id,
        category: input.category,
        title,
        description,
        locality,
        landmark,
        image_path: uploadedImagePath,
        department: 'Unassigned',
        status: 'Submitted'
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Failed to save complaint in Supabase database.');
    }

    const inferredLive = inferAreaAndCoordinates(locality, input.areaName);
    const hasConsentedPin =
      typeof input.consentedLat === 'number' && typeof input.consentedLng === 'number';

    return {
      id: data.id,
      reference_number: data.reference_number,
      owner_user_id: data.owner_user_id,
      owner_name: currentUser.name,
      category: data.category,
      title: data.title,
      description: data.description,
      locality: data.locality,
      landmark: data.landmark,
      image_path: data.image_path,
      department: data.department,
      status: data.status,
      priority: input.priority || 'Medium',
      area_name: inferredLive.areaName,
      approx_lat: hasConsentedPin ? Number(input.consentedLat!.toFixed(5)) : inferredLive.lat,
      approx_lng: hasConsentedPin ? Number(input.consentedLng!.toFixed(5)) : inferredLive.lng,
      is_demo_record: false,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  }

  // Demo Mode Persistence
  const { complaints, history } = loadDemoStore();
  const reference_number = generateReferenceNumber(complaints);
  const timestamp = new Date().toISOString();
  const newId = `c-${Date.now()}`;
  const inferredDemo = inferAreaAndCoordinates(locality, input.areaName);
  const hasConsentedDemoPin =
    typeof input.consentedLat === 'number' && typeof input.consentedLng === 'number';

  const newComplaint: Complaint = {
    id: newId,
    reference_number,
    owner_user_id: currentUser.id,
    owner_name: currentUser.name,
    category: input.category,
    title,
    description,
    locality,
    landmark,
    image_path: input.imagePreviewDataUrl || null,
    department: 'Unassigned',
    status: 'Submitted',
    priority: input.priority || 'Medium',
    area_name: inferredDemo.areaName,
    approx_lat: hasConsentedDemoPin ? Number(input.consentedLat!.toFixed(5)) : inferredDemo.lat,
    approx_lng: hasConsentedDemoPin ? Number(input.consentedLng!.toFixed(5)) : inferredDemo.lng,
    is_demo_record: true,
    created_at: timestamp,
    updated_at: timestamp
  };

  const initialHistory: StatusHistoryEntry = {
    id: `sh-${Date.now()}`,
    complaint_id: newId,
    previous_status: null,
    new_status: 'Submitted',
    actor_id: currentUser.id,
    actor_name: currentUser.name,
    note: 'Complaint registered by citizen via UrbanFix portal.',
    timestamp
  };

  saveDemoStore({
    complaints: [newComplaint, ...complaints],
    history: [...history, initialHistory]
  });

  return newComplaint;
}

export async function adminUpdateComplaintStatus(
  adminUser: Profile,
  input: AdminUpdateComplaintInput
): Promise<Complaint> {
  if (adminUser.role !== 'admin') {
    throw new Error('Unauthorized: Only administrators may assign departments or update complaint statuses.');
  }

  if (isSupabaseConfigured && supabase) {
    // Invoke the SECURITY DEFINER PostgreSQL function that validates admin role and appends to status_history
    const { data, error } = await supabase.rpc('admin_update_complaint', {
      p_complaint_id: input.complaintId,
      p_new_status: input.newStatus,
      p_department: input.department,
      p_note: input.note?.trim() || null
    });

    if (error || !data) {
      throw new Error(error?.message || 'Failed to update complaint via Supabase RPC.');
    }

    return {
      id: data.id,
      reference_number: data.reference_number,
      owner_user_id: data.owner_user_id,
      category: data.category,
      title: data.title,
      description: data.description,
      locality: data.locality,
      landmark: data.landmark,
      image_path: data.image_path,
      department: data.department,
      status: data.status,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  }

  // Demo Mode Admin Update
  const { complaints, history } = loadDemoStore();
  const idx = complaints.findIndex((c) => c.id === input.complaintId);
  if (idx === -1) {
    throw new Error('Complaint record not found.');
  }

  const existing = complaints[idx];
  const timestamp = new Date().toISOString();
  const updated: Complaint = {
    ...existing,
    status: input.newStatus,
    department: input.department,
    updated_at: timestamp
  };

  const nextComplaints = [...complaints];
  nextComplaints[idx] = updated;

  const defaultNote =
    existing.status !== input.newStatus && existing.department !== input.department
      ? `Status changed from ${existing.status} to ${input.newStatus}; assigned to ${input.department}.`
      : existing.status !== input.newStatus
      ? `Status updated from ${existing.status} to ${input.newStatus}.`
      : `Department assignment updated to ${input.department}.`;

  const historyEntry: StatusHistoryEntry = {
    id: `sh-${Date.now()}`,
    complaint_id: existing.id,
    previous_status: existing.status,
    new_status: input.newStatus,
    actor_id: adminUser.id,
    actor_name: adminUser.name,
    note: input.note?.trim() || defaultNote,
    timestamp
  };

  saveDemoStore({
    complaints: nextComplaints,
    history: [...history, historyEntry]
  });

  return updated;
}

export async function adminUpdateComplaintCategory(
  adminUser: Profile,
  input: {
    complaintId: string;
    newCategory: ComplaintCategory;
    rationaleNote?: string;
  }
): Promise<Complaint> {
  if (adminUser.role !== 'admin') {
    throw new Error('Unauthorized: Only municipal administrators may reclassify complaint categories.');
  }

  if (isSupabaseConfigured && supabase) {
    const { data: existingRow, error: fetchErr } = await supabase
      .from('complaints')
      .select('*')
      .eq('id', input.complaintId)
      .single();

    if (fetchErr || !existingRow) {
      throw new Error(fetchErr?.message || 'Complaint record could not be loaded for category update.');
    }

    const previousCategory = existingRow.category as ComplaintCategory;
    if (previousCategory === input.newCategory) {
      return {
        id: String(existingRow.id),
        reference_number: String(existingRow.reference_number),
        owner_user_id: String(existingRow.owner_user_id),
        category: previousCategory,
        title: String(existingRow.title),
        description: String(existingRow.description),
        locality: String(existingRow.locality),
        landmark: String(existingRow.landmark),
        image_path: (existingRow.image_path as string | null) || null,
        department: (existingRow.department as Complaint['department']) || 'Unassigned',
        status: existingRow.status as Complaint['status'],
        created_at: String(existingRow.created_at),
        updated_at: String(existingRow.updated_at)
      };
    }

    const { error: updateErr } = await supabase
      .from('complaints')
      .update({
        category: input.newCategory,
        updated_at: new Date().toISOString()
      })
      .eq('id', input.complaintId);

    if (updateErr) {
      throw new Error(`Failed to update complaint category: ${updateErr.message}`);
    }

    const auditNote =
      input.rationaleNote?.trim() ||
      `Category updated from ${previousCategory} to ${input.newCategory} after administrative review.`;

    const { data: rpcRow, error: rpcErr } = await supabase.rpc('admin_update_complaint', {
      p_complaint_id: input.complaintId,
      p_new_status: existingRow.status,
      p_department: existingRow.department || 'Unassigned',
      p_note: auditNote
    });

    if (rpcErr || !rpcRow) {
      throw new Error(rpcErr?.message || 'Category updated, but audit log entry failed.');
    }

    return {
      id: String(rpcRow.id),
      reference_number: String(rpcRow.reference_number),
      owner_user_id: String(rpcRow.owner_user_id),
      category: input.newCategory,
      title: String(rpcRow.title),
      description: String(rpcRow.description),
      locality: String(rpcRow.locality),
      landmark: String(rpcRow.landmark),
      image_path: (rpcRow.image_path as string | null) || null,
      department: (rpcRow.department as Complaint['department']) || 'Unassigned',
      status: rpcRow.status as Complaint['status'],
      created_at: String(rpcRow.created_at),
      updated_at: String(rpcRow.updated_at)
    };
  }

  // Demo Mode Category Reclassification
  const { complaints, history } = loadDemoStore();
  const idx = complaints.findIndex((c) => c.id === input.complaintId);
  if (idx === -1) {
    throw new Error('Complaint record not found.');
  }

  const existing = complaints[idx];
  if (existing.category === input.newCategory) {
    return existing;
  }

  const timestamp = new Date().toISOString();
  const updated: Complaint = {
    ...existing,
    category: input.newCategory,
    updated_at: timestamp
  };

  const nextComplaints = [...complaints];
  nextComplaints[idx] = updated;

  const historyEntry: StatusHistoryEntry = {
    id: `sh-${Date.now()}`,
    complaint_id: existing.id,
    previous_status: existing.status,
    new_status: existing.status,
    actor_id: adminUser.id,
    actor_name: adminUser.name,
    note:
      input.rationaleNote?.trim() ||
      `Category updated from ${existing.category} to ${input.newCategory} after administrative review.`,
    timestamp
  };

  saveDemoStore({
    complaints: nextComplaints,
    history: [...history, historyEntry]
  });

  return updated;
}

export async function resolveImageSignedUrl(imagePath: string | null): Promise<string | null> {
  if (!imagePath) return null;
  if (imagePath.startsWith('data:') || imagePath.startsWith('http') || imagePath.startsWith('/')) {
    return imagePath;
  }
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.storage
      .from('complaint-images')
      .createSignedUrl(imagePath, 3600);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  }
  return null;
}
