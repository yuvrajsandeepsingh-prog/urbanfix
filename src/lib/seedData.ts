import {
  CIVIC_AREAS,
  Complaint,
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
  MunicipalDepartment,
  Profile,
  StatusHistoryEntry
} from '../types/urbanfix';

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 3600 * 1000).toISOString();

export const DEMO_CITIZEN_PROFILE: Profile = {
  id: 'demo-citizen-arjun-01',
  name: 'Arjun Deshmukh',
  email: 'arjun.deshmukh@student.edu.in',
  role: 'citizen',
  created_at: hoursAgo(420)
};

export const DEMO_CITIZEN_2_PROFILE: Profile = {
  id: 'demo-citizen-priya-02',
  name: 'Priya Nair',
  email: 'priya.nair@resident.org.in',
  role: 'citizen',
  created_at: hoursAgo(360)
};

export const DEMO_ADMIN_PROFILE: Profile = {
  id: 'demo-admin-commissioner-01',
  name: 'Rajeshwari Iyer (Zonal Nodal Officer)',
  email: 'nodal.admin@urbanfix-civic.org.in',
  role: 'admin',
  created_at: hoursAgo(720)
};

export const INITIAL_DEMO_PROFILES: Profile[] = [
  DEMO_CITIZEN_PROFILE,
  DEMO_CITIZEN_2_PROFILE,
  DEMO_ADMIN_PROFILE
];

const COMMUNITY_REPORTERS: string[] = [
  'Rohan Kulkarni',
  'Meera Gokhale',
  'Siddharth Sawant',
  'Ananya Joshi',
  'VikramadityaPatil',
  'Deepika Chavan',
  'Karan Malhotra',
  'Kavita Chitnis',
  'Nikhil Tendulkar',
  'Shreya Chatterjee',
  'Pranav Kulkarni',
  'Nandini Shah',
  'Harish Parekh',
  'Divya Natarajan',
  'Sameer Shaikh',
  'Lakshmi Subramanian',
  'Aditya Verma',
  'Pooja Deshpande',
  'Varun Mehta',
  'Sneha Kamath',
  'Gautam Nadkarni',
  'Madhavi Oak',
  'farhan Merchant',
  'Swati Patwardhan',
  'Naveen Shetty',
  'Aishwarya Pai',
  'Manoj Tiwari',
  'Bhavana Kadam',
  'Tarun Kapoor',
  'Rekha Srinivas'
].map((name) =>
  name === 'VikramadityaPatil'
    ? 'Vikramaditya Patil'
    : name === 'farhan Merchant'
    ? 'Farhan Merchant'
    : name
);

interface RawSeedSpec {
  refNum: number;
  category: ComplaintCategory;
  areaId: string;
  streetLocality: string;
  landmark: string;
  title: string;
  description: string;
  status: ComplaintStatus;
  priority: ComplaintPriority;
  hoursOld: number;
  lat: number;
  lng: number;
  ownerKey?: 'arjun' | 'priya';
  latestRemark?: string;
}

const CATEGORY_DEPT_MAP: Record<ComplaintCategory, MunicipalDepartment> = {
  Roads: 'Public Works & Roads Dept',
  'Waste Management': 'Solid Waste Management Cell',
  Drainage: 'Stormwater & Drainage Division',
  'Water Supply': 'Municipal Water Board',
  Streetlights: 'Electrical & Streetlight Wing'
};

// 90 Unique Fictional Demo Complaints across Greater Mumbai (18 per category)
const SEED_SPECS: RawSeedSpec[] = [
  // ==========================================================================
  // 1. ROADS — Potholes / Road Damage (18 unique Mumbai records)
  // ==========================================================================
  {
    refNum: 1042,
    category: 'Roads',
    areaId: 'bandra-west',
    streetLocality: 'Linking Road, Bandra West, H/W Ward',
    landmark: 'Opposite National College Bus Stop',
    title: 'Deep waterlogged pothole cluster obstructing left commuter lane',
    description:
      'A 1.3-meter asphalt depression has opened near the bus bay on Linking Road, forcing two-wheelers and BEST buses to swerve sharply into fast traffic.',
    status: 'In Progress',
    priority: 'High',
    hoursOld: 46,
    lat: 19.0634,
    lng: 72.8342,
    ownerKey: 'arjun',
    latestRemark: 'Mastic asphalt patching crew dispatched for night-window resurfacing.'
  },
  {
    refNum: 1001,
    category: 'Roads',
    areaId: 'bandra-west',
    streetLocality: 'Hill Road, Bandra West, H/W Ward',
    landmark: 'Near St. Stanislaus High School Gate',
    title: 'Sunken utility trench across pedestrian crossing approach',
    description:
      'Recent duct restoration settled unevenly across the westbound lane, leaving a sharp 4-inch drop right before the school zebra crossing.',
    status: 'Submitted',
    priority: 'High',
    hoursOld: 14,
    lat: 19.0552,
    lng: 72.8318
  },
  {
    refNum: 1002,
    category: 'Roads',
    areaId: 'bandra-west',
    streetLocality: 'Turner Road, Bandra West, H/W Ward',
    landmark: 'Outside Bandra Gymkhana Junction',
    title: 'Dislodged concrete paver blocks along turning radius',
    description:
      'Heavy delivery trucks have loosened over twenty interlocking paver blocks at the intersection, creating loose rubble and ankle hazards.',
    status: 'Resolved',
    priority: 'Medium',
    hoursOld: 172,
    lat: 19.0589,
    lng: 72.8331,
    latestRemark: 'Sub-base compacted and concrete pavers relaid flush with road camber.'
  },
  {
    refNum: 1003,
    category: 'Roads',
    areaId: 'andheri-west',
    streetLocality: 'New Link Road, Andheri West, K/W Ward',
    landmark: 'Below DN Nagar Metro Viaduct Pillar 108',
    title: 'Multiple sharp craters forming beneath metro pier expansion joint',
    description:
      'Runoff dripping from overhead drainage spouts has eroded the top bitumen layer into three consecutive potholes in the middle lane.',
    status: 'In Progress',
    priority: 'High',
    hoursOld: 68,
    lat: 19.1298,
    lng: 72.8334,
    latestRemark: 'Barricading placed; cold-mix repair scheduled tonight.'
  },
  {
    refNum: 1004,
    category: 'Roads',
    areaId: 'andheri-west',
    streetLocality: 'JP Road, Seven Bungalows, Andheri West',
    landmark: 'Near Versova Metro Station East Exit',
    title: 'Crumbled footpath kerb stones forcing pedestrians onto road',
    description:
      'Broken kerb edges and missing footpath tiles outside the metro exit make wheelchair and senior citizen movement unsafe during peak hours.',
    status: 'Submitted',
    priority: 'Medium',
    hoursOld: 27,
    lat: 19.1312,
    lng: 72.8235
  },
  {
    refNum: 1005,
    category: 'Roads',
    areaId: 'dadar-prabhadevi',
    streetLocality: 'NC Kelkar Marg, Dadar West, G/N Ward',
    landmark: 'Near Plaza Cinema Signal',
    title: 'Severely rutted asphalt strip at bus halting bay',
    description:
      'Repeated braking at the signal has pushed up an asphalt ridge alongside a deep wheel rut, jarring auto-rickshaws and cyclists.',
    status: 'In Progress',
    priority: 'High',
    hoursOld: 82,
    lat: 19.0196,
    lng: 72.8429,
    latestRemark: 'Milling and concrete bus-bay apron strengthening approved.'
  },
  {
    refNum: 1006,
    category: 'Roads',
    areaId: 'dadar-prabhadevi',
    streetLocality: 'Veer Savarkar Marg, Prabhadevi, G/N Ward',
    landmark: 'Opposite Siddhivinayak Temple North Gate',
    title: 'Damaged speed table markings and chipped ramp edge',
    description:
      'Thermoplastic markings have worn off completely and the southern edge of the speed table has sheared away, surprising motorists at night.',
    status: 'Resolved',
    priority: 'Low',
    hoursOld: 215,
    lat: 19.0168,
    lng: 72.8312,
    latestRemark: 'Ramp edge re-profiled and reflective cat-eyes plus paint restored.'
  },
  {
    refNum: 1007,
    category: 'Roads',
    areaId: 'powai',
    streetLocality: 'Jogeshwari-Vikhroli Link Road, Powai, S Ward',
    landmark: 'Near IIT Bombay Main Gate Flyover Ramp',
    title: 'Wide longitudinal crack and pothole on flyover slip road',
    description:
      'Heavy freight vehicles merging onto JVLR have widened a seam into a 20 cm deep pothole with exposed steel mesh.',
    status: 'Submitted',
    priority: 'High',
    hoursOld: 19,
    lat: 19.1246,
    lng: 72.9128
  },
  {
    refNum: 1008,
    category: 'Roads',
    areaId: 'powai',
    streetLocality: 'Central Avenue, Hiranandani Gardens, Powai',
    landmark: 'Adjacent to Galleria Shopping Arcade',
    title: 'Subsiding cobblestone crosswalk panel at roundabout',
    description:
      'A 2-meter section of decorative stone paving at the pedestrian crossing has sunk by 8 cm, pooling water and tripping walkers.',
    status: 'Resolved',
    priority: 'Medium',
    hoursOld: 190,
    lat: 19.1182,
    lng: 72.9108,
    latestRemark: 'Sand bedding leveled and stone blocks reset securely.'
  },
  {
    refNum: 1009,
    category: 'Roads',
    areaId: 'colaba-fort',
    streetLocality: 'Shahid Bhagat Singh Road, Colaba, A Ward',
    landmark: 'Near Regal Circle Traffic Island',
    title: 'Fractured concrete joint slab jolting southbound vehicles',
    description:
      'An expansion joint between two concrete road panels has spalled badly, leaving a jagged 15 cm gap right in the center lane.',
    status: 'In Progress',
    priority: 'High',
    hoursOld: 51,
    lat: 18.9236,
    lng: 72.8318,
    ownerKey: 'priya',
    latestRemark: 'Rapid-curing polymer mortar joint repair scheduled with traffic police.'
  },
  {
    refNum: 1010,
    category: 'Roads',
    areaId: 'colaba-fort',
    streetLocality: 'DN Road, Fort, A Ward',
    landmark: 'Outside CSMT Heritage Subway Entrance 3',
    title: 'Uneven heritage footpath flagstones causing trip hazard',
    description:
      'Four basalt walkway slabs along the arcade have tilted loose over an old utility chamber, rocking underfoot during office rush hour.',
    status: 'Submitted',
    priority: 'Medium',
    hoursOld: 34,
    lat: 18.9384,
    lng: 72.8349
  },
  {
    refNum: 1011,
    category: 'Roads',
    areaId: 'lower-parel-worli',
    streetLocality: 'Senapati Bapat Marg, Lower Parel, G/S Ward',
    landmark: 'Opposite Phoenix Palladium North Exit',
    title: 'Eroded asphalt shoulder and exposed gravel near taxi stand',
    description:
      'Continuous water seepage and heavy cab queueing have stripped the top coat across a 5-meter stretch, scattering loose aggregate.',
    status: 'Reopened',
    priority: 'High',
    hoursOld: 148,
    lat: 18.9952,
    lng: 72.8294,
    latestRemark: 'Temporary cold-mix washed out; reopened for full hot-mix resurfacing.'
  },
  {
    refNum: 1012,
    category: 'Roads',
    areaId: 'lower-parel-worli',
    streetLocality: 'Dr Annie Besant Road, Worli, G/S Ward',
    landmark: 'Near Atria Mall Pedestrian Signal',
    title: 'Damaged median divider bollard and displaced concrete kerb',
    description:
      'A nocturnal collision knocked a concrete median block 30 cm into the fast lane, posing a serious collision risk in low visibility.',
    status: 'Resolved',
    priority: 'High',
    hoursOld: 132,
    lat: 19.0028,
    lng: 72.8189,
    latestRemark: 'Median block craned back into alignment and hazard striping repainted.'
  },
  {
    refNum: 1013,
    category: 'Roads',
    areaId: 'juhu-vile-parle',
    streetLocality: 'Juhu Tara Road, Juhu, K/W Ward',
    landmark: 'Opposite SNDT Women’s University Gate',
    title: 'Chain of potholes along coastal bus corridor',
    description:
      'Five medium-to-deep potholes have linked together along the left lane, splashing pedestrians and slowing morning school buses.',
    status: 'In Progress',
    priority: 'High',
    hoursOld: 62,
    lat: 19.0984,
    lng: 72.8286,
    latestRemark: 'Ward road engineer inspected; wet-mix base patching underway.'
  },
  {
    refNum: 1014,
    category: 'Roads',
    areaId: 'juhu-vile-parle',
    streetLocality: 'Hanuman Road, Vile Parle East, K/E Ward',
    landmark: 'Near Parle Tilak Vidyalaya Corner',
    title: 'Collapsed tactile footpath ramp at intersection',
    description:
      'Corner kerb ramp tiles have caved in over a telecom chamber, leaving an unprotected 20 cm cavity on a busy school route.',
    status: 'Submitted',
    priority: 'Medium',
    hoursOld: 22,
    lat: 19.0998,
    lng: 72.8468
  },
  {
    refNum: 1015,
    category: 'Roads',
    areaId: 'chembur',
    streetLocality: 'Central Avenue Road, Chembur East, M/W Ward',
    landmark: 'Near Diamond Garden Signal',
    title: 'Deep crater beside utility manhole frame in center lane',
    description:
      'Asphalt surrounding a circular cast-iron frame has eroded away, exposing a sharp steel rim that has punctured two-wheeler tyres.',
    status: 'Submitted',
    priority: 'High',
    hoursOld: 11,
    lat: 19.0518,
    lng: 72.9016
  },
  {
    refNum: 1016,
    category: 'Roads',
    areaId: 'chembur',
    streetLocality: 'RC Marg, Chembur Colony, M/W Ward',
    landmark: 'Near Chembur Monorail Station Approach',
    title: 'Buckled pedestrian paver strip along station rickshaw lane',
    description:
      'Tree roots and heavy rains have lifted footpath pavers into a steep ridge, forcing commuters to walk in the active rickshaw lane.',
    status: 'Resolved',
    priority: 'Low',
    hoursOld: 245,
    lat: 19.0574,
    lng: 72.8952,
    latestRemark: 'Footpath re-graded with root-zone spacing and slip-resistant blocks.'
  },
  {
    refNum: 1017,
    category: 'Roads',
    areaId: 'andheri-west',
    streetLocality: 'SV Road, Andheri West, K/W Ward',
    landmark: 'Near Shoppers Stop Signal',
    title: 'Peeled bitumen carpet across main four-way junction box',
    description:
      'Surface course has stripped across 12 square meters in the middle of the SV Road junction, creating dust clouds and skidding hazards.',
    status: 'In Progress',
    priority: 'Medium',
    hoursOld: 74,
    lat: 19.1194,
    lng: 72.8442,
    latestRemark: 'Tack coat and hot-mix overlay queued for Sunday early-morning slot.'
  },

  // ==========================================================================
  // 2. WASTE MANAGEMENT — Garbage / Waste Collection (18 unique Mumbai records)
  // ==========================================================================
  {
    refNum: 1020,
    category: 'Waste Management',
    areaId: 'bandra-west',
    streetLocality: 'Pali Mala Road, Bandra West, H/W Ward',
    landmark: 'Near Pali Market Back Gate',
    title: 'Overflowing community compactor bins spilling onto lane',
    description:
      'Both wheeled market bins are filled past capacity since yesterday afternoon, with vegetable crates and wet bags blocking half the lane.',
    status: 'Submitted',
    priority: 'High',
    hoursOld: 18,
    lat: 19.0621,
    lng: 72.8289,
    ownerKey: 'arjun'
  },
  {
    refNum: 1018,
    category: 'Waste Management',
    areaId: 'bandra-west',
    streetLocality: 'Chapel Road, Bandra West, H/W Ward',
    landmark: 'Near Mount Carmel Church Steps',
    title: 'Uncollected Renovation rubble Bags dumped along wall',
    description:
      'Fourteen sacks of plaster and broken tiles were left overnight along the narrow residential bend, obstructing morning sanitation sweeping.',
    status: 'In Progress',
    priority: 'Medium',
    hoursOld: 39,
    lat: 19.0519,
    lng: 72.8294,
    latestRemark: 'Debris mini-tipper vehicle assigned for H/W Ward afternoon clearance.'
  },
  {
    refNum: 1019,
    category: 'Waste Management',
    areaId: 'andheri-west',
    streetLocality: 'Lokhandwala Back Road, Andheri West, K/W Ward',
    landmark: 'Near Joggers Park Entrance',
    title: 'Foul odour and scattered litter around damaged enclosure',
    description:
      'Stray dogs have torn open uncollected refuse bags outside the broken bin shed, scattering plastic packaging onto the walking track entrance.',
    status: 'Resolved',
    priority: 'High',
    hoursOld: 112,
    lat: 19.1422,
    lng: 72.8248,
    latestRemark: 'Enclosure gate welded, waste cleared, and disinfectant spray applied.'
  },
  {
    refNum: 1021,
    category: 'Waste Management',
    areaId: 'andheri-west',
    streetLocality: 'Yari Road, Versova, Andheri West',
    landmark: 'Near Fisheries University Bus Terminus',
    title: 'Missed door-to-door dry waste pickup for three apartment blocks',
    description:
      'Segregated dry waste bins from societies on Cross Lane 4 have remained uncollected for 48 hours due to route vehicle breakdown.',
    status: 'Submitted',
    priority: 'Medium',
    hoursOld: 29,
    lat: 19.1368,
    lng: 72.8168
  },
  {
    refNum: 1022,
    category: 'Waste Management',
    areaId: 'dadar-prabhadevi',
    streetLocality: 'Senapati Bapat Marg, Dadar West, G/N Ward',
    landmark: 'Outside Dadar Flower Market Footbridge',
    title: 'Floral and organic waste mound accumulating under FOB stairs',
    description:
      'Large heaps of discarded marigold stems, banana leaves, and wet twine are decomposing beneath the staircase, making the pavement slippery.',
    status: 'In Progress',
    priority: 'High',
    hoursOld: 21,
    lat: 19.0185,
    lng: 72.8414,
    latestRemark: 'Dedicated organic waste compactor routed for twice-daily market sweep.'
  },
  {
    refNum: 1023,
    category: 'Waste Management',
    areaId: 'dadar-prabhadevi',
    streetLocality: 'LJ Road, Mahim-Dadar Border, G/N Ward',
    landmark: 'Near Sitladevi Temple Signal',
    title: 'Broken cast-iron litter bin spilling wrappers onto sidewalk',
    description:
      'Pedestrian pole-mounted bin has rusted off its bottom hinge, dropping cups and wrappers straight onto the bus queue walkway.',
    status: 'Resolved',
    priority: 'Low',
    hoursOld: 196,
    lat: 19.0324,
    lng: 72.8418,
    latestRemark: 'Twin-compartment stainless steel street bin installed.'
  },
  {
    refNum: 1024,
    category: 'Waste Management',
    areaId: 'powai',
    streetLocality: 'Adi Shankaracharya Marg, Powai, S Ward',
    landmark: 'Opposite Powai Nirvana Park Gate',
    title: 'Garden trimmings and plastic bags piled along stormwater kerb',
    description:
      'Pruned branches mixed with household plastic bags have been stacked for five days, threatening to block the adjacent roadside drain inlet.',
    status: 'In Progress',
    priority: 'Medium',
    hoursOld: 64,
    lat: 19.1154,
    lng: 72.9089,
    latestRemark: 'Horticulture shredder van and sanitation crew scheduled.'
  },
  {
    refNum: 1025,
    category: 'Waste Management',
    areaId: 'powai',
    streetLocality: 'Chandivali Farm Road, Powai, S Ward',
    landmark: 'Near Nahar Amrit Shakti Junction',
    title: 'Secondary transfer point skip overflowing onto service lane',
    description:
      'Metal hook-loader container has not been swapped since yesterday morning, causing commercial waste bags to pile around the skip.',
    status: 'Submitted',
    priority: 'High',
    hoursOld: 15,
    lat: 19.1112,
    lng: 72.8964
  },
  {
    refNum: 1026,
    category: 'Waste Management',
    areaId: 'colaba-fort',
    streetLocality: 'Colaba Causeway, Colaba, A Ward',
    landmark: 'Near Leopold Cafe & Walton Road Corner',
    title: 'Evening street-stall packaging overflowing corner bins',
    description:
      'Cardboard cartons and food containers exceed corner bin capacity every night by 9 PM, blowing across the heritage shopping walkway.',
    status: 'Resolved',
    priority: 'Medium',
    hoursOld: 140,
    lat: 18.9219,
    lng: 72.8315,
    latestRemark: 'Added late-evening 9:30 PM beat collection round on Causeway.'
  },
  {
    refNum: 1027,
    category: 'Waste Management',
    areaId: 'colaba-fort',
    streetLocality: 'Mint Road, Ballard Estate, Fort, A Ward',
    landmark: 'Behind Custom House Lane',
    title: 'Discarded office furniture and thermocol blocking alley',
    description:
      'Old broken chairs, fluorescent packaging, and shredded paper sacks were dumped in the service lane, creating a fire and sanitation hazard.',
    status: 'Submitted',
    priority: 'Medium',
    hoursOld: 31,
    lat: 18.9342,
    lng: 72.8384,
    ownerKey: 'priya'
  },
  {
    refNum: 1028,
    category: 'Waste Management',
    areaId: 'lower-parel-worli',
    streetLocality: 'NM Joshi Marg, Lower Parel, G/S Ward',
    landmark: 'Near Currey Road Bridge West Ramp',
    title: 'Chronic roadside garbage spot re-forming beside transformer',
    description:
      'Despite warning boards, nocturnal dumping of mixed kitchen waste beside the electrical plinth attracts rodents and blocks pedestrians.',
    status: 'Reopened',
    priority: 'High',
    hoursOld: 128,
    lat: 18.9968,
    lng: 72.8336,
    latestRemark: 'Cleared once; reopened to station marshals and place planters.'
  },
  {
    refNum: 1029,
    category: 'Waste Management',
    areaId: 'lower-parel-worli',
    streetLocality: 'Worli Naka, G/S Ward',
    landmark: 'Near BDD Chawl Cross Lane 2',
    title: 'Damaged community wheelie bin leaking leachate on road',
    description:
      'Cracked 1100-liter green bin leaks foul liquid across the crossroad slope, creating an unhygienic stretch near local provision stores.',
    status: 'In Progress',
    priority: 'High',
    hoursOld: 37,
    lat: 19.0054,
    lng: 72.8226,
    latestRemark: 'Replacement HDPE bin requisitioned from G/S Ward depot.'
  },
  {
    refNum: 1030,
    category: 'Waste Management',
    areaId: 'juhu-vile-parle',
    streetLocality: 'Juhu Church Road, Juhu, K/W Ward',
    landmark: 'Near St. Joseph’s Church Bus Stop',
    title: 'Weekend plastic bottles and coconut shells overflowing bins',
    description:
      'High visitor footfall left three roadside bins overflowing with tender coconut shells and PET bottles along the pedestrian footpath.',
    status: 'Resolved',
    priority: 'Medium',
    hoursOld: 92,
    lat: 19.1046,
    lng: 72.8274,
    latestRemark: 'Cleared by morning beach-sector sanitation squad.'
  },
  {
    refNum: 1031,
    category: 'Waste Management',
    areaId: 'juhu-vile-parle',
    streetLocality: 'Tejpal Road, Vile Parle East, K/E Ward',
    landmark: 'Near Vile Parle Station East Footbridge',
    title: 'Hawker lane food waste left uncollected after market closure',
    description:
      'Rotting fruit peels and wet cardboard boxes remain along the station approach gutter each morning until 10 AM.',
    status: 'Submitted',
    priority: 'Medium',
    hoursOld: 12,
    lat: 19.0992,
    lng: 72.8451
  },
  {
    refNum: 1032,
    category: 'Waste Management',
    areaId: 'chembur',
    streetLocality: 'Station Avenue Road, Chembur East, M/W Ward',
    landmark: 'Near Chembur Railway Station West Plaza',
    title: 'Overflowing twin segregation bins outside commuter plaza',
    description:
      'Heavy commuter traffic has filled both wet and dry waste receptacles, with paper plates blowing onto the auto-rickshaw stand.',
    status: 'In Progress',
    priority: 'Medium',
    hoursOld: 26,
    lat: 19.0622,
    lng: 72.9009,
    latestRemark: 'Beat supervisor alerted for immediate mid-day clearance.'
  },
  {
    refNum: 1033,
    category: 'Waste Management',
    areaId: 'chembur',
    streetLocality: 'Sindhi Society Main Road, Chembur, M/W Ward',
    landmark: 'Opposite Swami Vivekanand Junior College',
    title: 'Dead tree branches and sweepings pile blocking parking bay',
    description:
      'Sanitation sweepings mixed with fallen gulmohar branches have sat uncollected for four days near the college gate.',
    status: 'Resolved',
    priority: 'Low',
    hoursOld: 184,
    lat: 19.0558,
    lng: 72.8918,
    latestRemark: 'Lifted by M/W Ward tractor-trolley unit and kerb swept clean.'
  },
  {
    refNum: 1034,
    category: 'Waste Management',
    areaId: 'bandra-west',
    streetLocality: 'Carter Road Promenade Service Lane, Bandra West',
    landmark: 'Near Otters Club Signal',
    title: 'Food-delivery packaging bags piled behind promenade bench',
    description:
      'Takeaway containers and beverage cups discarded overnight behind the seating bay are attracting crows and stray animals.',
    status: 'Submitted',
    priority: 'Low',
    hoursOld: 9,
    lat: 19.0648,
    lng: 72.8236
  },
  {
    refNum: 1035,
    category: 'Waste Management',
    areaId: 'powai',
    streetLocality: 'Saki Vihar Road, Powai, S Ward',
    landmark: 'Near Larsen & Toubro Gate 4',
    title: 'Canteen waste sacks left on median verge overnight',
    description:
      'Six black refuse sacks left uncollected on the central verge were torn open, spilling wet waste into the right-turn pocket.',
    status: 'Resolved',
    priority: 'High',
    hoursOld: 105,
    lat: 19.1188,
    lng: 72.8936,
    latestRemark: 'Cleared by S Ward sanitation team; notice issued to commercial vendor.'
  },

  // ==========================================================================
  // 3. DRAINAGE — Sewage / Drainage (18 unique Mumbai records)
  // ==========================================================================
  {
    refNum: 1038,
    category: 'Drainage',
    areaId: 'bandra-west',
    streetLocality: 'SV Road, Bandra West, H/W Ward',
    landmark: 'Near Lucky Junction Underpass Approach',
    title: 'Choked stormwater grate causing ankle-deep waterlogging',
    description:
      'Plastic silt and leaves have completely clogged three roadside gully traps near Lucky Junction, backing stagnant water across the kerb lane.',
    status: 'In Progress',
    priority: 'High',
    hoursOld: 38,
    lat: 19.0548,
    lng: 72.8398,
    ownerKey: 'arjun',
    latestRemark: 'Suction-cum-jetting machine deployed to desilt gully chambers.'
  },
  {
    refNum: 1036,
    category: 'Drainage',
    areaId: 'bandra-west',
    streetLocality: 'St. Andrews Road, Bandra West, H/W Ward',
    landmark: 'Near Bandra Gymkhana Cross Lane',
    title: 'Cracked concrete stormwater slab over deep roadside drain',
    description:
      'One corner of the precast drain cover has snapped, leaving an open 25 cm slot directly in the path of evening walkers.',
    status: 'Submitted',
    priority: 'High',
    hoursOld: 17,
    lat: 19.0579,
    lng: 72.8299
  },
  {
    refNum: 1037,
    category: 'Drainage',
    areaId: 'andheri-west',
    streetLocality: 'SV Road, Andheri Subway West Approach, K/W Ward',
    landmark: '50m West of Andheri Railway Subway',
    title: 'Silt buildup inside box culvert slowing rainwater discharge',
    description:
      'Heavy sediment accumulation in the interceptor grate reduces drainage capacity, risking rapid flooding inside the subway dip.',
    status: 'In Progress',
    priority: 'High',
    hoursOld: 76,
    lat: 19.1198,
    lng: 72.8458,
    latestRemark: 'Mechanical desilting grab bucket clearing culvert mouth.'
  },
  {
    refNum: 1039,
    category: 'Drainage',
    areaId: 'andheri-west',
    streetLocality: 'Four Bungalows Market Road, Andheri West',
    landmark: 'Near Kokilaben Hospital Crossroad',
    title: 'Sewage chamber seepage emitting foul smell on main road',
    description:
      'Wastewater is bubbling slowly from the rim of a surcharged sewer manhole since yesterday evening, creating an unsanitary puddle.',
    status: 'Submitted',
    priority: 'High',
    hoursOld: 13,
    lat: 19.1319,
    lng: 72.8269
  },
  {
    refNum: 1040,
    category: 'Drainage',
    areaId: 'dadar-prabhadevi',
    streetLocality: 'Dr Babasaheb Ambedkar Road, Dadar TT, G/N Ward',
    landmark: 'Near Khodadad Circle Flyover Pillar',
    title: 'Blocked kerbside drain inlets pooling water at bus stop',
    description:
      'Commuters boarding buses have to step through a 6-meter puddle of stagnant grey water trapped by a choked stormwater inlet.',
    status: 'Resolved',
    priority: 'Medium',
    hoursOld: 158,
    lat: 19.0172,
    lng: 72.8469,
    latestRemark: 'Lateral pipe rodded clear and cast-iron hinged grate cleaned.'
  },
  {
    refNum: 1041,
    category: 'Drainage',
    areaId: 'dadar-prabhadevi',
    streetLocality: 'Gokhale Road South, Dadar West, G/N Ward',
    landmark: 'Near Portuguese Church Junction',
    title: 'Rusted and rattling manhole cover sinking below road grade',
    description:
      'Cast-iron sewer cover frame is cracked and clangs loudly under every passing car, threatening to collapse into the shaft.',
    status: 'In Progress',
    priority: 'High',
    hoursOld: 49,
    lat: 19.0156,
    lng: 72.8388,
    latestRemark: 'Heavy-duty SFRC frame and cover replacement underway.'
  },
  {
    refNum: 1043,
    category: 'Drainage',
    areaId: 'powai',
    streetLocality: 'Powai Lake Promenade Service Road, S Ward',
    landmark: 'Near Ganesh Ghat Viewing Deck',
    title: 'Clogged roadside catch-pit overflowing across footpath',
    description:
      'Silt and fallen leaves have blocked the catch-pit grille, sending muddy runoff across the morning jogging promenade.',
    status: 'Resolved',
    priority: 'Low',
    hoursOld: 210,
    lat: 19.1232,
    lng: 72.9052,
    latestRemark: 'Catch-pit desilted and trash screen cleared by S Ward crew.'
  },
  {
    refNum: 1044,
    category: 'Drainage',
    areaId: 'powai',
    streetLocality: 'Kailash Complex Link Road, Powai, S Ward',
    landmark: 'Near Hiranandani Hospital Rear Gate',
    title: 'Slow sewer line backflow in residential cross lane',
    description:
      'Grease and root intrusion in the branch sewer line are causing intermittent overflow from the inspection chamber during morning peak hours.',
    status: 'Submitted',
    priority: 'Medium',
    hoursOld: 28,
    lat: 19.1165,
    lng: 72.9136
  },
  {
    refNum: 1045,
    category: 'Drainage',
    areaId: 'colaba-fort',
    streetLocality: 'Madame Cama Road, Fort, A Ward',
    landmark: 'Near Cooperage Bandstand Garden Gate',
    title: 'Missing cast-iron bars on kerb stormwater grating',
    description:
      'Three iron bars have snapped out of the horizontal kerb grate, creating a dangerous wheel-trap for bicycles along the garden edge.',
    status: 'In Progress',
    priority: 'Medium',
    hoursOld: 61,
    lat: 18.9268,
    lng: 72.8294,
    latestRemark: 'Safety cone placed; new ductile-iron grating fabricated for install.'
  },
  {
    refNum: 1046,
    category: 'Drainage',
    areaId: 'colaba-fort',
    streetLocality: 'Cuffe Parade Captain Prakash Pethe Marg, A Ward',
    landmark: 'Near Maker Tower Gate B',
    title: 'Stagnant water pooling in subsided roadside channel',
    description:
      'Reverse road gradient prevents wash water from reaching the nearest drain chamber, breeding mosquitoes beside the pedestrian gate.',
    status: 'Resolved',
    priority: 'Medium',
    hoursOld: 175,
    lat: 18.9148,
    lng: 72.8229,
    ownerKey: 'priya',
    latestRemark: 'Micro-trench cut to connect low point to stormwater chamber; larvicide sprayed.'
  },
  {
    refNum: 1047,
    category: 'Drainage',
    areaId: 'lower-parel-worli',
    streetLocality: 'Ganpatrao Kadam Marg, Lower Parel, G/S Ward',
    landmark: 'Under Lower Parel Railway Workshop Wall',
    title: 'Chronic waterlogging pocket from choked box drain',
    description:
      'Debris inside the covered roadside drain forces murky water onto the carriageway after even brief washing or pipeline flushing.',
    status: 'Reopened',
    priority: 'High',
    hoursOld: 136,
    lat: 18.9945,
    lng: 72.8312,
    latestRemark: 'Surface inlet cleared earlier, but downstream choke persists; jetting truck reassigned.'
  },
  {
    refNum: 1048,
    category: 'Drainage',
    areaId: 'lower-parel-worli',
    streetLocality: 'Worli Sea Face Service Lane, Worli, G/S Ward',
    landmark: 'Near Worli Dairy Bus Stop',
    title: 'Corroded inspection chamber lid along promenade footpath',
    description:
      'Salt-air corrosion has thinned the metal chamber cover over the stormwater outfall duct, flexing visibly when stepped upon.',
    status: 'Submitted',
    priority: 'High',
    hoursOld: 20,
    lat: 19.0086,
    lng: 72.8168
  },
  {
    refNum: 1049,
    category: 'Drainage',
    areaId: 'juhu-vile-parle',
    streetLocality: 'Gulmohar Road, JVPD Scheme, Juhu, K/W Ward',
    landmark: 'Near CritiCare Hospital Junction',
    title: 'Blocked cross-drainage pipe flooding intersection corner',
    description:
      'Silt and plastic bottles wedged inside the cross-culvert cause persistent corner puddling that impedes school van drop-offs.',
    status: 'In Progress',
    priority: 'Medium',
    hoursOld: 55,
    lat: 19.1128,
    lng: 72.8334,
    latestRemark: 'High-pressure jetting scheduled by K/W Ward drainage cell.'
  },
  {
    refNum: 1050,
    category: 'Drainage',
    areaId: 'juhu-vile-parle',
    streetLocality: 'Nehru Road, Vile Parle East, K/E Ward',
    landmark: 'Near Domestic Airport Western Express Underpass',
    title: 'Silt-choked linear trench drain across service road',
    description:
      'Linear slotted drain across the service ramp is packed solid with mud and gravel, sending water straight onto the main highway merge.',
    status: 'Resolved',
    priority: 'High',
    hoursOld: 144,
    lat: 19.0976,
    lng: 72.8524,
    latestRemark: 'Trench grates lifted, desilted end-to-end, and bolted down.'
  },
  {
    refNum: 1051,
    category: 'Drainage',
    areaId: 'chembur',
    streetLocality: 'VN Purav Marg, Chunabhatti-Chembur Link, M/W Ward',
    landmark: 'Near Maitri Park Bus Stop',
    title: 'Overflowing sewer inspection chamber near bus shelter',
    description:
      'Foul wastewater is trickling from a blocked 300mm sewer line into the open roadside gutter right beside waiting commuters.',
    status: 'Submitted',
    priority: 'High',
    hoursOld: 8,
    lat: 19.0504,
    lng: 72.8938
  },
  {
    refNum: 1052,
    category: 'Drainage',
    areaId: 'chembur',
    streetLocality: '10th Road, Chembur East, M/W Ward',
    landmark: 'Near Ambedkar Garden East Gate',
    title: 'Displaced concrete slab leaving gap on footpath drain',
    description:
      'Utility cable workers shifted a concrete drain slab and left a 30 cm opening unguarded beside the park entrance.',
    status: 'Resolved',
    priority: 'Medium',
    hoursOld: 162,
    lat: 19.0549,
    lng: 72.9028,
    latestRemark: 'Slab repositioned and mortared flush by ward masonry team.'
  },
  {
    refNum: 1053,
    category: 'Drainage',
    areaId: 'andheri-west',
    streetLocality: 'Veera Desai Road, Andheri West, K/W Ward',
    landmark: 'Near Azad Nagar Metro Station Gate 2',
    title: 'Foul backflow from commercial lane grease trap into storm drain',
    description:
      'Congealed kitchen grease from nearby eateries has narrowed the storm drain inlet, causing stagnant puddles and strong odour.',
    status: 'Submitted',
    priority: 'Medium',
    hoursOld: 33,
    lat: 19.1282,
    lng: 72.8384
  },
  {
    refNum: 1054,
    category: 'Drainage',
    areaId: 'dadar-prabhadevi',
    streetLocality: 'Ranade Road, Dadar West, G/N Ward',
    landmark: 'Near Dadar Western Railway Footbridge',
    title: 'Subsided gully grate trapping market handcarts',
    description:
      'Roadside stormwater grate has dropped 10 cm below the asphalt level, jamming handcart wheels and pooling wash water.',
    status: 'In Progress',
    priority: 'Low',
    hoursOld: 88,
    lat: 19.0189,
    lng: 72.8421,
    latestRemark: 'Brick masonry collar raising queued for night traffic block.'
  },

  // ==========================================================================
  // 4. WATER SUPPLY — Water Leakage / Water Supply (18 unique Mumbai records)
  // ==========================================================================
  {
    refNum: 1055,
    category: 'Water Supply',
    areaId: 'bandra-west',
    streetLocality: 'Waterfield Road, Bandra West, H/W Ward',
    landmark: 'Near Linking Road Post Office Crossing',
    title: 'Clean treated water gushing from underground ferrule joint',
    description:
      'Potable water bubbles continuously through an asphalt crack during morning supply hours (6:30–9:30 AM), wasting thousands of liters.',
    status: 'Resolved',
    priority: 'High',
    hoursOld: 118,
    lat: 19.0609,
    lng: 72.8339,
    ownerKey: 'arjun',
    latestRemark: 'Excavated, replaced corroded brass ferrule, and restored road patch.'
  },
  {
    refNum: 1056,
    category: 'Water Supply',
    areaId: 'bandra-west',
    streetLocality: 'Perry Cross Road, Bandra West, H/W Ward',
    landmark: 'Near Kantwadi Junction',
    title: 'Severe drop in morning municipal supply pressure',
    description:
      'Four residential buildings on Perry Cross Road are receiving less than 20 minutes of trickle flow during the scheduled morning slot.',
    status: 'In Progress',
    priority: 'Medium',
    hoursOld: 44,
    lat: 19.0584,
    lng: 72.8276,
    latestRemark: 'Hydraulic engineer checking zone sluice valve throttling and air locks.'
  },
  {
    refNum: 1057,
    category: 'Water Supply',
    areaId: 'andheri-west',
    streetLocality: 'CD Barfiwala Road, Andheri West, K/W Ward',
    landmark: 'Near Gokhale Bridge Approach',
    title: 'Leaking 250mm sluice valve chamber flooding kerb lane',
    description:
      'Gland packing inside the main valve chamber has failed, filling the valve pit and sending a steady stream down the slope.',
    status: 'In Progress',
    priority: 'High',
    hoursOld: 29,
    lat: 19.1168,
    lng: 72.8432,
    latestRemark: 'Water Works maintenance crew scheduled after evening supply cutoff.'
  },
  {
    refNum: 1058,
    category: 'Water Supply',
    areaId: 'andheri-west',
    streetLocality: 'Model Town Road, Seven Bungalows, Andheri West',
    landmark: 'Opposite Nana Nani Park Gate',
    title: 'Slightly turbid water observed during initial 10 minutes of supply',
    description:
      'Residents noticed brownish discolouration at the start of morning water supply following nearby trench work; testing requested.',
    status: 'Submitted',
    priority: 'High',
    hoursOld: 15,
    lat: 19.1292,
    lng: 72.8256
  },
  {
    refNum: 1059,
    category: 'Water Supply',
    areaId: 'dadar-prabhadevi',
    streetLocality: 'Lady Jamshedji Road, Dadar West, G/N Ward',
    landmark: 'Near Shivaji Park Gymkhana Turn',
    title: 'Broken standpipe tap wasting water beside bus shelter',
    description:
      'Brass bib-cock on a municipal drinking standpost has sheared off, running continuously into the roadside drain.',
    status: 'Resolved',
    priority: 'Medium',
    hoursOld: 96,
    lat: 19.0258,
    lng: 72.8384,
    latestRemark: 'Heavy-duty push-type self-closing tap fitted by G/N Water Dept.'
  },
  {
    refNum: 1060,
    category: 'Water Supply',
    areaId: 'dadar-prabhadevi',
    streetLocality: 'Appasaheb Marathe Marg, Prabhadevi, G/N Ward',
    landmark: 'Near Century Bazaar Junction',
    title: 'Feeder pipeline collar seepage softening asphalt edge',
    description:
      'Damp patch and steady trickle emerging beside the footpath indicate a slow leak on the 150mm distribution main.',
    status: 'Submitted',
    priority: 'Medium',
    hoursOld: 24,
    lat: 19.0124,
    lng: 72.8289
  },
  {
    refNum: 1061,
    category: 'Water Supply',
    areaId: 'powai',
    streetLocality: 'Rambaug Lane, Powai, S Ward',
    landmark: 'Near Powai Police Station Signal',
    title: 'Burst PVC branch connection spraying onto pedestrian walkway',
    description:
      'Heavy vehicle wheel crushed a shallow service pipe near the kerb, sending a pressurized jet across the footpath.',
    status: 'In Progress',
    priority: 'High',
    hoursOld: 19,
    lat: 19.1214,
    lng: 72.9024,
    latestRemark: 'Isolation valve shut temporarily; GI sleeve coupling repair active.'
  },
  {
    refNum: 1062,
    category: 'Water Supply',
    areaId: 'powai',
    streetLocality: 'Cliff Avenue, Hiranandani Gardens, Powai, S Ward',
    landmark: 'Near Heritage Garden Entrance',
    title: 'Uncapped meter box pit posing hazard on sidewalk',
    description:
      'Cast-iron lid over a roadside bulk water meter pit is missing, leaving exposed valves and piping vulnerable to damage.',
    status: 'Resolved',
    priority: 'Low',
    hoursOld: 204,
    lat: 19.1149,
    lng: 72.9114,
    latestRemark: 'Hinged lockable meter box cover installed.'
  },
  {
    refNum: 1063,
    category: 'Water Supply',
    areaId: 'colaba-fort',
    streetLocality: 'Wodehouse Road, Colaba, A Ward',
    landmark: 'Near Badhwar Park Crossing',
    title: 'Irregular evening water supply timing and air-lock surge',
    description:
      'Supply arrives 45 minutes late with heavy air sputtering in consumer meters, reducing daily storage tank refill by half.',
    status: 'In Progress',
    priority: 'Medium',
    hoursOld: 58,
    lat: 18.9189,
    lng: 72.8256,
    ownerKey: 'priya',
    latestRemark: 'Air-release valve serviced at A Ward feeder point; pressure being monitored.'
  },
  {
    refNum: 1064,
    category: 'Water Supply',
    areaId: 'colaba-fort',
    streetLocality: 'Pherozeshah Mehta Road, Fort, A Ward',
    landmark: 'Near Horniman Circle North Gate',
    title: 'Underground main joint leak pooling clear water near kerb',
    description:
      'Continuous clear water seepage along basalt kerb joints even outside supply hours suggests a trunk main pinhole leak.',
    status: 'Submitted',
    priority: 'High',
    hoursOld: 16,
    lat: 18.9326,
    lng: 72.8342
  },
  {
    refNum: 1065,
    category: 'Water Supply',
    areaId: 'lower-parel-worli',
    streetLocality: 'Delisle Road (NM Joshi Marg), Lower Parel, G/S Ward',
    landmark: 'Near Chinchpokli Station West Footbridge',
    title: 'Leaking air-relief valve drenching passing commuters',
    description:
      'Elevated air-relief assembly on the 450mm water main sprays water onto the adjacent walkway whenever line pressure peaks.',
    status: 'Resolved',
    priority: 'Medium',
    hoursOld: 149,
    lat: 18.9896,
    lng: 72.8322,
    latestRemark: 'Float seal replaced and drain pipe routed safely into chamber.'
  },
  {
    refNum: 1066,
    category: 'Water Supply',
    areaId: 'lower-parel-worli',
    streetLocality: 'Pandurang Budhkar Marg, Worli, G/S Ward',
    landmark: 'Near Doordarshan Kendra Gate',
    title: 'Sunken valve chamber frame creating water-filled dip',
    description:
      'Slow valve stem drip combined with a sunken chamber collar keeps the left lane perpetually slick for motorcyclists.',
    status: 'Submitted',
    priority: 'Medium',
    hoursOld: 36,
    lat: 19.0042,
    lng: 72.8249
  },
  {
    refNum: 1067,
    category: 'Water Supply',
    areaId: 'juhu-vile-parle',
    streetLocality: '10th Road, JVPD Scheme, Juhu, K/W Ward',
    landmark: 'Near Kaifi Azmi Park',
    title: 'Service pipe ruptured by tree root heave near compound wall',
    description:
      'Uplifted roots cracked a 50mm GI branch line, flooding the footpath tiles during evening supply hours.',
    status: 'Resolved',
    priority: 'High',
    hoursOld: 126,
    lat: 19.1098,
    lng: 72.8318,
    latestRemark: 'Flexible MDPE bypass section installed around root zone.'
  },
  {
    refNum: 1068,
    category: 'Water Supply',
    areaId: 'juhu-vile-parle',
    streetLocality: 'MG Road, Vile Parle East, K/E Ward',
    landmark: 'Near Sathaye College Bus Stop',
    title: 'Low tail-end pressure affecting three housing societies',
    description:
      'Tail-end societies at the eastern end of MG Road receive weak pressure for only 25 minutes compared to the 90-minute ward schedule.',
    status: 'In Progress',
    priority: 'Medium',
    hoursOld: 71,
    lat: 19.1018,
    lng: 72.8486,
    latestRemark: 'Acoustic leak detection check scheduled along upstream feeder.'
  },
  {
    refNum: 1069,
    category: 'Water Supply',
    areaId: 'chembur',
    streetLocality: '16th Road, Chembur East, M/W Ward',
    landmark: 'Near Chembur Gymkhana Gate',
    title: 'Corroded distribution coupling leaking into storm gutter',
    description:
      'Clean treated water is pouring steadily from an exposed pipe crossing inside the roadside drain channel, risking back-siphonage.',
    status: 'Reopened',
    priority: 'High',
    hoursOld: 110,
    lat: 19.0568,
    lng: 72.9041,
    latestRemark: 'Clamp seal slipped under morning surge; reopened for full coupling weld.'
  },
  {
    refNum: 1070,
    category: 'Water Supply',
    areaId: 'chembur',
    streetLocality: 'Tilak Nagar Main Road, Chembur West, M/W Ward',
    landmark: 'Near Sahakar Cinema Signal',
    title: 'Damaged valve spindle cap filled with road debris',
    description:
      'Missing cast-iron surface box lid has allowed stones and sand to pack around the main isolation spindle.',
    status: 'Submitted',
    priority: 'Low',
    hoursOld: 41,
    lat: 19.0668,
    lng: 72.8924
  },
  {
    refNum: 1071,
    category: 'Water Supply',
    areaId: 'bandra-west',
    streetLocality: 'Mount Mary Road, Bandra West, H/W Ward',
    landmark: 'Near Basilica Steps Bend',
    title: 'Booster zone timing mismatch leaving uphill lane dry',
    description:
      'Elevated stretch near the hill bend received negligible flow for two consecutive mornings due to early valve changeover.',
    status: 'Resolved',
    priority: 'Medium',
    hoursOld: 166,
    lat: 19.0472,
    lng: 72.8242,
    latestRemark: 'Bhandarwada hill-zone valve schedule synchronized and verified.'
  },
  {
    refNum: 1072,
    category: 'Water Supply',
    areaId: 'powai',
    streetLocality: 'DP Road 9, Rambaug, Powai, S Ward',
    landmark: 'Near Milind Nagar Community Hall',
    title: 'Leaking public meter cluster soaking narrow pedestrian alley',
    description:
      'Loose union nuts on three adjacent society meters keep the entire stone-paved passage wet and mossy.',
    status: 'Submitted',
    priority: 'Low',
    hoursOld: 23,
    lat: 19.1202,
    lng: 72.8998
  },

  // ==========================================================================
  // 5. STREETLIGHTS — Streetlights (18 unique Mumbai records)
  // ==========================================================================
  {
    refNum: 1073,
    category: 'Streetlights',
    areaId: 'bandra-west',
    streetLocality: '16th Road, Bandra West, H/W Ward',
    landmark: 'Between Mini Punjab Corner and Pali Village',
    title: 'Four consecutive LED streetlights completely unlit at night',
    description:
      'Poles H/W-16R-08 through 11 remain pitch dark after 7 PM under dense tree canopy, making evening pedestrian movement unsafe.',
    status: 'In Progress',
    priority: 'High',
    hoursOld: 32,
    lat: 19.0642,
    lng: 72.8312,
    ownerKey: 'arjun',
    latestRemark: 'Underground feeder phase fault traced; electrical van assigned.'
  },
  {
    refNum: 1074,
    category: 'Streetlights',
    areaId: 'bandra-west',
    streetLocality: 'Bandstand Promenade Road, Bandra West, H/W Ward',
    landmark: 'Near Jogging Track South Turn',
    title: 'Flickering LED luminaire strobing across seafront bend',
    description:
      'Failing LED driver on Pole BS-24 strobes rapidly all night, dazzling cyclists and motorists rounding the curve.',
    status: 'Resolved',
    priority: 'Low',
    hoursOld: 138,
    lat: 19.0454,
    lng: 72.8208,
    latestRemark: '90W LED driver module replaced and waterproof gasket sealed.'
  },
  {
    refNum: 1075,
    category: 'Streetlights',
    areaId: 'andheri-west',
    streetLocality: 'Link Road Service Lane, Lokhandwala, Andheri West',
    landmark: 'Near Infinity Mall Footbridge Landing',
    title: 'Dark landing zone beneath pedestrian footbridge stairs',
    description:
      'Both soffit floodlights under the staircase landing have burned out, leaving commuters stepping down into complete shadow.',
    status: 'Submitted',
    priority: 'High',
    hoursOld: 14,
    lat: 19.1411,
    lng: 72.8314
  },
  {
    refNum: 1076,
    category: 'Streetlights',
    areaId: 'andheri-west',
    streetLocality: 'JP Road, Azad Nagar, Andheri West, K/W Ward',
    landmark: 'Near Bhavan’s College Main Gate',
    title: 'Streetlight feeder pillar door missing latch with exposed terminal',
    description:
      'Metal inspection door at the base of the street pole has rusted loose, leaving live terminal blocks accessible at sidewalk height.',
    status: 'In Progress',
    priority: 'High',
    hoursOld: 22,
    lat: 19.1248,
    lng: 72.8369,
    latestRemark: 'Emergency insulation sleeve fitted; lockable FRP door ordered.'
  },
  {
    refNum: 1077,
    category: 'Streetlights',
    areaId: 'dadar-prabhadevi',
    streetLocality: 'Shivaji Park Perimeter Road, Dadar West, G/N Ward',
    landmark: 'Near Meenatai Thackeray Statue Gate',
    title: 'Three walkway post-top lamps out along park footpath',
    description:
      'Senior citizens and evening walkers face a 90-meter unlit stretch along the outer park pavement due to tripped circuit.',
    status: 'Resolved',
    priority: 'Medium',
    hoursOld: 108,
    lat: 19.0278,
    lng: 72.8389,
    latestRemark: 'Replaced corroded underground cable joint and restored all 3 lamps.'
  },
  {
    refNum: 1078,
    category: 'Streetlights',
    areaId: 'dadar-prabhadevi',
    streetLocality: 'Gokhale Road North, Dadar West, G/N Ward',
    landmark: 'Near Sena Bhavan Signal',
    title: 'Faulty astronomical timer keeping lights burning at midday',
    description:
      'Eight high-mast and median luminaires along Gokhale Road remain switched on at 1 PM, wasting electricity daily.',
    status: 'Submitted',
    priority: 'Low',
    hoursOld: 35,
    lat: 19.0226,
    lng: 72.8428
  },
  {
    refNum: 1079,
    category: 'Streetlights',
    areaId: 'powai',
    streetLocality: 'High Street, Hiranandani Gardens, Powai, S Ward',
    landmark: 'Near Crisil House Bus Stop',
    title: 'Overgrown peltophorum branches blocking streetlight beam',
    description:
      'Lamp is lit, but dense low-hanging foliage completely blocks illumination from reaching the crosswalk and bus shelter below.',
    status: 'In Progress',
    priority: 'Medium',
    hoursOld: 52,
    lat: 19.1194,
    lng: 72.9082,
    latestRemark: 'Joint clearance scheduled with S Ward Tree Authority pruning van.'
  },
  {
    refNum: 1080,
    category: 'Streetlights',
    areaId: 'powai',
    streetLocality: 'JVLR Service Road, Powai, S Ward',
    landmark: 'Near L&T Flyover East Ramp',
    title: 'Five consecutive highway service-lane poles dark at night',
    description:
      'Complete outage along a 180-meter stretch of the unlit service lane creates high risk for office commuters walking from bus stops.',
    status: 'Submitted',
    priority: 'High',
    hoursOld: 10,
    lat: 19.1228,
    lng: 72.8962
  },
  {
    refNum: 1081,
    category: 'Streetlights',
    areaId: 'colaba-fort',
    streetLocality: 'MG Road, Kala Ghoda, Fort, A Ward',
    landmark: 'Near Jehangir Art Gallery Crossing',
    title: 'Heritage cast-iron lantern fixture flickering and dim',
    description:
      'Two decorative pedestrian-level lanterns at the Kala Ghoda crossing have dimmed to a faint glow, reducing crosswalk visibility.',
    status: 'Resolved',
    priority: 'Medium',
    hoursOld: 154,
    lat: 18.9278,
    lng: 72.8319,
    ownerKey: 'priya',
    latestRemark: 'Warm-white retrofit LED modules replaced inside heritage lanterns.'
  },
  {
    refNum: 1082,
    category: 'Streetlights',
    areaId: 'colaba-fort',
    streetLocality: 'PJ Ramchandani Marg, Colaba, A Ward',
    landmark: 'Behind Taj Mahal Palace Seafront Walk',
    title: 'Salt-corroded luminaire bracket tilted over promenade',
    description:
      'Top bracket arm on Pole A-44 has rusted at the weld collar and tilts downward, needing preventive replacement before high winds.',
    status: 'In Progress',
    priority: 'High',
    hoursOld: 47,
    lat: 18.9212,
    lng: 72.8334,
    latestRemark: 'Hydraulic boom truck booked to replace marine-grade galvanized arm.'
  },
  {
    refNum: 1083,
    category: 'Streetlights',
    areaId: 'lower-parel-worli',
    streetLocality: 'Tulsi Pipe Road, Lower Parel West, G/S Ward',
    landmark: 'Outside Lower Parel Station West Skywalk Exit',
    title: 'Unlit station exit alley during late evening local train arrivals',
    description:
      'Both wall-bracket LED floodlights outside the western station exit have been off for three nights, leaving a crowded bottleneck dark.',
    status: 'Submitted',
    priority: 'High',
    hoursOld: 18,
    lat: 18.9964,
    lng: 72.8304
  },
  {
    refNum: 1084,
    category: 'Streetlights',
    areaId: 'lower-parel-worli',
    streetLocality: 'Khan Abdul Gaffar Khan Marg, Worli Sea Face',
    landmark: 'Near Sea Link Promenade North End',
    title: 'Intermittent tripping of median twin-arm streetlights',
    description:
      'Six twin-arm poles shut off every night around 9:30 PM due to moisture ingress tripping the feeder pillar MCB.',
    status: 'Reopened',
    priority: 'Medium',
    hoursOld: 122,
    lat: 19.0138,
    lng: 72.8174,
    latestRemark: 'MCB reset twice; reopened to replace damp cable termination glands.'
  },
  {
    refNum: 1085,
    category: 'Streetlights',
    areaId: 'juhu-vile-parle',
    streetLocality: 'Vaikunthlal Mehta Road, JVPD Scheme, Juhu',
    landmark: 'Near Mithibai College Signal',
    title: 'Crosswalk high-mast floodlight half-extinguished at busy junction',
    description:
      'Three of the six floodlight modules atop the junction mast are dark, leaving evening student crossings poorly lit.',
    status: 'In Progress',
    priority: 'Medium',
    hoursOld: 66,
    lat: 19.1038,
    lng: 72.8368,
    latestRemark: 'Winch-lowering maintenance scheduled for mast luminaire replacement.'
  },
  {
    refNum: 1086,
    category: 'Streetlights',
    areaId: 'juhu-vile-parle',
    streetLocality: 'Subhash Road, Vile Parle East, K/E Ward',
    landmark: 'Near Dinanath Mangeshkar Natyagriha',
    title: 'Dead streetlight at narrow residential T-junction',
    description:
      'Corner pole K/E-112 is completely off, making oncoming cyclists and pedestrians invisible to turning vehicles.',
    status: 'Resolved',
    priority: 'Medium',
    hoursOld: 182,
    lat: 19.1024,
    lng: 72.8462,
    latestRemark: '70W LED street luminaire replaced and tested.'
  },
  {
    refNum: 1087,
    category: 'Streetlights',
    areaId: 'chembur',
    streetLocality: 'Nagesh Patilwadi Marg, Chembur East, M/W Ward',
    landmark: 'Near Fine Arts Society Auditorium',
    title: 'Loose overhead service wire sagging beside street pole',
    description:
      'Insulated supply drop cable detached from its tension clamp after heavy wind and hangs within reach of tall trucks.',
    status: 'Submitted',
    priority: 'High',
    hoursOld: 12,
    lat: 19.0586,
    lng: 72.8994
  },
  {
    refNum: 1088,
    category: 'Streetlights',
    areaId: 'chembur',
    streetLocality: 'Pestom Sagar Road No. 4, Chembur West, M/W Ward',
    landmark: 'Near Pestom Sagar Municipal Garden',
    title: 'Two park-approach streetlights failing to switch on at dusk',
    description:
      'Photocell sensor covered in grime fails to trigger the two entrance poles along the residential garden lane.',
    status: 'Resolved',
    priority: 'Low',
    hoursOld: 220,
    lat: 19.0642,
    lng: 72.8958,
    latestRemark: 'Photocell relay cleaned and calibrated by electrical wing.'
  },
  {
    refNum: 1089,
    category: 'Streetlights',
    areaId: 'bandra-west',
    streetLocality: 'St. John Baptist Road, Bandra West, H/W Ward',
    landmark: 'Near Mount Mary Steps Archway',
    title: 'Heritage step-pathway lamp shattered and unlit',
    description:
      'Polycarbonate diffuser and LED bulb on the pedestrian steps pole are broken, leaving steep stone steps shadowed after sunset.',
    status: 'Submitted',
    priority: 'Medium',
    hoursOld: 25,
    lat: 19.0488,
    lng: 72.8251,
    ownerKey: 'arjun'
  },
  {
    refNum: 1090,
    category: 'Streetlights',
    areaId: 'powai',
    streetLocality: 'Orchard Avenue, Hiranandani Gardens, Powai, S Ward',
    landmark: 'Near Forest Club Roundabout',
    title: 'Leaning tubular pole after reversing delivery van impact',
    description:
      'Tubular pole S-209 is leaning 15 degrees toward the carriageway with cracked foundation grout, though luminaire still glows.',
    status: 'In Progress',
    priority: 'High',
    hoursOld: 40,
    lat: 19.1162,
    lng: 72.9094,
    latestRemark: 'Power isolated safely; civil foundation re-casting in progress.'
  }
];

function buildInitialDemoData(): {
  complaints: Complaint[];
  history: StatusHistoryEntry[];
} {
  const complaints: Complaint[] = [];
  const history: StatusHistoryEntry[] = [];

  SEED_SPECS.forEach((spec, index) => {
    const area = CIVIC_AREAS.find((a) => a.id === spec.areaId) || CIVIC_AREAS[0];
    const id = `c-demo-${spec.refNum}`;
    const reference_number = `UF-2026-${String(spec.refNum).padStart(4, '0')}`;

    const ownerId =
      spec.ownerKey === 'arjun'
        ? DEMO_CITIZEN_PROFILE.id
        : spec.ownerKey === 'priya'
        ? DEMO_CITIZEN_2_PROFILE.id
        : `demo-community-user-${(index % COMMUNITY_REPORTERS.length) + 1}`;

    const ownerName =
      spec.ownerKey === 'arjun'
        ? DEMO_CITIZEN_PROFILE.name
        : spec.ownerKey === 'priya'
        ? DEMO_CITIZEN_2_PROFILE.name
        : COMMUNITY_REPORTERS[index % COMMUNITY_REPORTERS.length];

    const createdAt = hoursAgo(spec.hoursOld);
    const updatedHours =
      spec.status === 'Submitted'
        ? spec.hoursOld
        : Math.max(2, Math.round(spec.hoursOld * 0.35));
    const updatedAt = hoursAgo(updatedHours);

    const department: MunicipalDepartment =
      spec.status === 'Submitted' && spec.hoursOld < 36
        ? 'Unassigned'
        : CATEGORY_DEPT_MAP[spec.category];

    complaints.push({
      id,
      reference_number,
      owner_user_id: ownerId,
      owner_name: ownerName,
      category: spec.category,
      title: spec.title,
      description: spec.description,
      locality: spec.streetLocality,
      landmark: spec.landmark,
      image_path: null,
      department,
      status: spec.status,
      priority: spec.priority,
      area_name: area.name,
      approx_lat: Number(spec.lat.toFixed(5)),
      approx_lng: Number(spec.lng.toFixed(5)),
      is_demo_record: true,
      created_at: createdAt,
      updated_at: updatedAt
    });

    // 1. Initial Submitted Entry
    history.push({
      id: `sh-${spec.refNum}-1`,
      complaint_id: id,
      previous_status: null,
      new_status: 'Submitted',
      actor_id: ownerId,
      actor_name: ownerName,
      note: 'Complaint submitted via UrbanFix Citizen Portal.',
      timestamp: createdAt
    });

    // 2. Subsequent Lifecycle Entries
    if (spec.status === 'In Progress') {
      history.push({
        id: `sh-${spec.refNum}-2`,
        complaint_id: id,
        previous_status: 'Submitted',
        new_status: 'In Progress',
        actor_id: DEMO_ADMIN_PROFILE.id,
        actor_name: DEMO_ADMIN_PROFILE.name,
        note:
          spec.latestRemark ||
          `Assigned to ${CATEGORY_DEPT_MAP[spec.category]} for field inspection and repair.`,
        timestamp: updatedAt
      });
    } else if (spec.status === 'Resolved') {
      const midHours = Math.max(updatedHours + 6, Math.round(spec.hoursOld * 0.68));
      history.push({
        id: `sh-${spec.refNum}-2`,
        complaint_id: id,
        previous_status: 'Submitted',
        new_status: 'In Progress',
        actor_id: DEMO_ADMIN_PROFILE.id,
        actor_name: DEMO_ADMIN_PROFILE.name,
        note: `Routed to ${CATEGORY_DEPT_MAP[spec.category]} field maintenance unit.`,
        timestamp: hoursAgo(midHours)
      });
      history.push({
        id: `sh-${spec.refNum}-3`,
        complaint_id: id,
        previous_status: 'In Progress',
        new_status: 'Resolved',
        actor_id: DEMO_ADMIN_PROFILE.id,
        actor_name: DEMO_ADMIN_PROFILE.name,
        note:
          spec.latestRemark ||
          'Issue resolved on site and verified by zonal field supervisor.',
        timestamp: updatedAt
      });
    } else if (spec.status === 'Reopened') {
      const step2Hours = Math.round(spec.hoursOld * 0.78);
      const step3Hours = Math.round(spec.hoursOld * 0.52);
      history.push({
        id: `sh-${spec.refNum}-2`,
        complaint_id: id,
        previous_status: 'Submitted',
        new_status: 'In Progress',
        actor_id: DEMO_ADMIN_PROFILE.id,
        actor_name: DEMO_ADMIN_PROFILE.name,
        note: `Assigned to ${CATEGORY_DEPT_MAP[spec.category]}.`,
        timestamp: hoursAgo(step2Hours)
      });
      history.push({
        id: `sh-${spec.refNum}-3`,
        complaint_id: id,
        previous_status: 'In Progress',
        new_status: 'Resolved',
        actor_id: DEMO_ADMIN_PROFILE.id,
        actor_name: DEMO_ADMIN_PROFILE.name,
        note: 'Initial temporary restoration completed.',
        timestamp: hoursAgo(step3Hours)
      });
      history.push({
        id: `sh-${spec.refNum}-4`,
        complaint_id: id,
        previous_status: 'Resolved',
        new_status: 'Reopened',
        actor_id: DEMO_ADMIN_PROFILE.id,
        actor_name: DEMO_ADMIN_PROFILE.name,
        note:
          spec.latestRemark ||
          'Reopened for permanent engineering rectification following follow-up check.',
        timestamp: updatedAt
      });
    }
  });

  return { complaints, history };
}

const BUILT_DEMO = buildInitialDemoData();

export const INITIAL_DEMO_COMPLAINTS: Complaint[] = BUILT_DEMO.complaints;
export const INITIAL_DEMO_HISTORY: StatusHistoryEntry[] = BUILT_DEMO.history;
