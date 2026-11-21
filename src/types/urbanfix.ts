export type UserRole = 'citizen' | 'admin';

export type ComplaintCategory =
  | 'Roads'
  | 'Water Supply'
  | 'Waste Management'
  | 'Streetlights'
  | 'Drainage';

export type ComplaintStatus =
  | 'Submitted'
  | 'In Progress'
  | 'Resolved'
  | 'Reopened';

export type ComplaintPriority = 'High' | 'Medium' | 'Low';

export type MunicipalDepartment =
  | 'Unassigned'
  | 'Public Works & Roads Dept'
  | 'Municipal Water Board'
  | 'Solid Waste Management Cell'
  | 'Electrical & Streetlight Wing'
  | 'Stormwater & Drainage Division';

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface Complaint {
  id: string;
  reference_number: string;
  owner_user_id: string;
  owner_name?: string;
  category: ComplaintCategory;
  title: string;
  description: string;
  locality: string;
  landmark: string;
  image_path: string | null;
  department: MunicipalDepartment;
  status: ComplaintStatus;
  priority?: ComplaintPriority;
  area_name?: string;
  approx_lat?: number;
  approx_lng?: number;
  is_demo_record?: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Privacy-safe projection for the Citizen Portal Issue Map.
 * Strictly omits email, phone, exact home address, and private owner_user_id.
 */
export interface PublicMapIssue {
  id: string;
  reference_number: string;
  reporter_display_name: string;
  category: ComplaintCategory;
  title: string;
  description: string;
  locality: string;
  landmark: string;
  area_name: string;
  status: ComplaintStatus;
  priority: ComplaintPriority;
  approx_lat: number;
  approx_lng: number;
  is_demo_record: boolean;
  is_exact_pin: boolean;
  created_at: string;
  updated_at: string;
  is_own_complaint: boolean;
}

export interface StatusHistoryEntry {
  id: string;
  complaint_id: string;
  previous_status: ComplaintStatus | null;
  new_status: ComplaintStatus;
  actor_id: string;
  actor_name?: string;
  note?: string;
  timestamp: string;
}

export interface CreateComplaintInput {
  category: ComplaintCategory;
  title: string;
  description: string;
  locality: string;
  landmark: string;
  priority?: ComplaintPriority;
  areaName?: string;
  consentedLat?: number | null;
  consentedLng?: number | null;
  imageFile?: File | null;
  imagePreviewDataUrl?: string | null;
}

export interface AdminUpdateComplaintInput {
  complaintId: string;
  newStatus: ComplaintStatus;
  department: MunicipalDepartment;
  note?: string;
}

export interface CivicAreaOption {
  id: string;
  name: string;
  ward: string;
  fullLocality: string;
  centerLat: number;
  centerLng: number;
}

export const MUMBAI_DEFAULT_CENTER: { lat: number; lng: number } = {
  lat: 19.0596,
  lng: 72.8495
};

export const CIVIC_AREAS: CivicAreaOption[] = [
  {
    id: 'bandra-west',
    name: 'Bandra West',
    ward: 'H/W Ward',
    fullLocality: 'Bandra West, Linking Road, H/W Ward',
    centerLat: 19.0596,
    centerLng: 72.8295
  },
  {
    id: 'andheri-west',
    name: 'Andheri West',
    ward: 'K/W Ward',
    fullLocality: 'Andheri West, Lokhandwala & SV Road, K/W Ward',
    centerLat: 19.1364,
    centerLng: 72.8296
  },
  {
    id: 'dadar-prabhadevi',
    name: 'Dadar & Prabhadevi',
    ward: 'G/N Ward',
    fullLocality: 'Dadar West, Shivaji Park, G/N Ward',
    centerLat: 19.0213,
    centerLng: 72.8424
  },
  {
    id: 'powai',
    name: 'Powai',
    ward: 'S Ward',
    fullLocality: 'Powai, JVLR & Hiranandani Gardens, S Ward',
    centerLat: 19.1176,
    centerLng: 72.906
  },
  {
    id: 'colaba-fort',
    name: 'Colaba & Fort',
    ward: 'A Ward',
    fullLocality: 'Fort & Colaba Causeway, A Ward',
    centerLat: 18.9281,
    centerLng: 72.8328
  },
  {
    id: 'lower-parel-worli',
    name: 'Lower Parel & Worli',
    ward: 'G/S Ward',
    fullLocality: 'Lower Parel, Senapati Bapat Marg, G/S Ward',
    centerLat: 18.9986,
    centerLng: 72.8288
  },
  {
    id: 'juhu-vile-parle',
    name: 'Juhu & Vile Parle',
    ward: 'K/E & K/W Ward',
    fullLocality: 'Juhu Tara Road & Vile Parle West, K/W Ward',
    centerLat: 19.1075,
    centerLng: 72.8263
  },
  {
    id: 'chembur',
    name: 'Chembur',
    ward: 'M/W Ward',
    fullLocality: 'Chembur East, Central Avenue, M/W Ward',
    centerLat: 19.0522,
    centerLng: 72.9005
  }
];

export const CATEGORIES: {
  id: ComplaintCategory;
  label: string;
  citizenLabel: string;
  defaultDepartment: MunicipalDepartment;
  slaHours: number;
  markerColor: string;
  summary: string;
  examples: string;
}[] = [
  {
    id: 'Roads',
    label: 'Roads & Footpaths',
    citizenLabel: 'Potholes / Road Damage',
    defaultDepartment: 'Public Works & Roads Dept',
    slaHours: 72,
    markerColor: '#E89A3C',
    summary: 'Asphalt potholes, sunken utility trenches, broken paver blocks, and damaged dividers.',
    examples: 'Crater near bus stop on SV Road, uneven footpath pavers'
  },
  {
    id: 'Waste Management',
    label: 'Waste Management',
    citizenLabel: 'Garbage / Waste Collection',
    defaultDepartment: 'Solid Waste Management Cell',
    slaHours: 24,
    markerColor: '#F05B5B',
    summary: 'Overflowing community bins, missed ward collection trucks, and roadside debris.',
    examples: 'Uncollected waste point near market lane, overflowing bin'
  },
  {
    id: 'Drainage',
    label: 'Drainage & Sewers',
    citizenLabel: 'Sewage / Drainage',
    defaultDepartment: 'Stormwater & Drainage Division',
    slaHours: 48,
    markerColor: '#7C5CFA',
    summary: 'Choked stormwater grates, sewage backflow, waterlogged junctions, and brokenchamber covers.',
    examples: 'Blocked monsoon culvert near subway, overflowing sewer line'
  },
  {
    id: 'Water Supply',
    label: 'Water Supply',
    citizenLabel: 'Water Leakage / Water Supply',
    defaultDepartment: 'Municipal Water Board',
    slaHours: 48,
    markerColor: '#4169E1',
    summary: 'Main pipeline leaks, broken sluice valves, low supply pressure, and turbid water.',
    examples: 'Treated water main leaking onto crossroad, damaged valve'
  },
  {
    id: 'Streetlights',
    label: 'Streetlights',
    citizenLabel: 'Streetlights',
    defaultDepartment: 'Electrical & Streetlight Wing',
    slaHours: 48,
    markerColor: '#2E9E6B',
    summary: 'Dark street stretches, flickering LED fixtures, damaged poles, and faulty timers.',
    examples: 'Four consecutive unlit poles along promenade, exposed junction box'
  }
];

export const DEPARTMENTS: MunicipalDepartment[] = [
  'Unassigned',
  'Public Works & Roads Dept',
  'Municipal Water Board',
  'Solid Waste Management Cell',
  'Electrical & Streetlight Wing',
  'Stormwater & Drainage Division'
];

export const INDIAN_LOCALITIES: string[] = CIVIC_AREAS.map((a) => a.fullLocality);
