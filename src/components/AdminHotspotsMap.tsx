import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  AlertCircle,
  ArrowUpRight,
  Layers,
  MapPin,
  Moon,
  RefreshCw,
  Search,
  Sun
} from 'lucide-react';
import {
  CATEGORIES,
  CIVIC_AREAS,
  Complaint,
  ComplaintCategory,
  ComplaintStatus,
  MUMBAI_DEFAULT_CENTER
} from '../types/urbanfix';
import {
  ComputedPriorityLevel,
  computeHaversineMeters,
  PriorityEvaluation
} from '../lib/priorityEngine';
import { PriorityLevelBadge } from './PriorityBreakdownPanel';

const OSM_STREET_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

type MapTileStyle = 'street' | 'dark';
type MarkerColorMode = 'priority' | 'category';

interface SpatialHotspotCluster {
  id: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  areaLabel: string;
  dominantCategory: ComplaintCategory;
  unresolvedCount: number;
  criticalOrHighCount: number;
  maxScore: number;
  memberIds: string[];
}

interface AdminHotspotsMapProps {
  complaints: Complaint[];
  evaluationsById: Record<string, PriorityEvaluation>;
  isDemoMode: boolean;
  compactPreview?: boolean;
  onInspectComplaint: (complaint: Complaint) => void;
  onOpenFullMap?: () => void;
}

const CATEGORY_HEX: Record<ComplaintCategory, string> = {
  Roads: '#E89A3C',
  'Waste Management': '#F05B5B',
  Drainage: '#7C5CFA',
  'Water Supply': '#4169E1',
  Streetlights: '#2E9E6B'
};

const CATEGORY_GLYPH: Record<ComplaintCategory, string> = {
  Roads: 'M5 17l3-10h8l3 10M12 9v5',
  'Waste Management': 'M8 8h8l-1 9H9L8 8zm2-2h4',
  Drainage: 'M6 11c2-2 4 2 6 0s4 2 6 0M6 15c2-2 4 2 6 0s4 2 6 0',
  'Water Supply': 'M12 6c-3 4-4.5 6-4.5 8.2a4.5 4.5 0 009 0C16.5 12 15 10 12 6z',
  Streetlights: 'M12 6a4 4 0 00-2.5 7.1V15h5v-1.9A4 4 0 0012 6zm-1.5 11h3'
};

const PRIORITY_HEX: Record<ComputedPriorityLevel, string> = {
  Critical: '#F05B5B',
  High: '#E89A3C',
  Medium: '#4169E1',
  Low: '#70757D'
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function hasValidComplaintCoords(c: Complaint): c is Complaint & { approx_lat: number; approx_lng: number } {
  return (
    typeof c.approx_lat === 'number' &&
    typeof c.approx_lng === 'number' &&
    Number.isFinite(c.approx_lat) &&
    Number.isFinite(c.approx_lng) &&
    Math.abs(c.approx_lat) <= 90 &&
    Math.abs(c.approx_lng) <= 180
  );
}

function matchesArea(c: Complaint, area: (typeof CIVIC_AREAS)[number]): boolean {
  return (
    (c.area_name || '').toLowerCase() === area.name.toLowerCase() ||
    c.locality.toLowerCase().includes(area.name.toLowerCase())
  );
}

function createAdminPinMarkup(
  category: ComplaintCategory,
  level: ComputedPriorityLevel,
  colorMode: MarkerColorMode,
  isSelected: boolean,
  isDarkMap: boolean
): string {
  const fillHex = colorMode === 'priority' ? PRIORITY_HEX[level] : CATEGORY_HEX[category];
  const glyph = CATEGORY_GLYPH[category];
  const ringStroke = isSelected ? (isDarkMap ? '#FFFFFF' : '#202329') : '#FFFFFF';
  const strokeWidth = isSelected ? 2.8 : 2;
  const radius = isSelected ? 15 : 12.5;
  const halo =
    isSelected || level === 'Critical'
      ? `<circle cx="19" cy="19" r="${isSelected ? 18 : 16.5}" fill="${fillHex}" fill-opacity="${
          isSelected ? '0.32' : '0.20'
        }" />`
      : '';

  return `
    <div class="urbanfix-pin-shell">
      <svg width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        ${halo}
        <circle cx="19" cy="19" r="${radius}" fill="${fillHex}" stroke="${ringStroke}" stroke-width="${strokeWidth}" />
        <g transform="translate(7, 7) scale(1)">
          <path d="${glyph}" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        </g>
      </svg>
    </div>
  `;
}

function createAdminPopupMarkup(
  complaint: Complaint,
  evaluation: PriorityEvaluation | undefined,
  isDemoMode: boolean
): string {
  const scoreText = evaluation ? `${evaluation.score}/100 (${evaluation.level})` : 'Evaluated';
  const dataSourceBadge =
    complaint.is_demo_record || isDemoMode
      ? 'Demo Data · Approximate Mumbai coordinates'
      : 'Live Municipal Record';

  return `
    <div class="urbanfix-popup-body">
      <div class="urbanfix-popup-kicker">
        <span>${escapeHtml(complaint.category)}</span>
        <span>${escapeHtml(scoreText)}</span>
      </div>
      <div class="urbanfix-popup-title">${escapeHtml(complaint.title)}</div>
      <div class="urbanfix-popup-meta">
        <div class="urbanfix-popup-row">
          <span><strong>Ref:</strong> ${escapeHtml(complaint.reference_number)}</span>
          <span><strong>Status:</strong> ${escapeHtml(complaint.status)}</span>
        </div>
        <div><strong>Locality:</strong> ${escapeHtml(complaint.locality)}</div>
        <div><strong>Landmark:</strong> ${escapeHtml(complaint.landmark)}</div>
        <div><strong>Dept:</strong> ${escapeHtml(complaint.department)}</div>
        <div class="urbanfix-popup-badge">${escapeHtml(dataSourceBadge)}</div>
      </div>
    </div>
  `;
}

/**
 * Computes genuine geographic hotspot clusters from unresolved complaints that possess
 * valid coordinates using greedy 550m Haversine spatial grouping. Never invents hotspots
 * when coordinates are missing.
 */
export function computeSpatialHotspots(
  complaints: Complaint[],
  evaluationsById: Record<string, PriorityEvaluation>
): SpatialHotspotCluster[] {
  const activeMappable = complaints.filter(
    (c): c is Complaint & { approx_lat: number; approx_lng: number } =>
      c.status !== 'Resolved' && hasValidComplaintCoords(c)
  );

  const visited = new Set<string>();
  const clusters: SpatialHotspotCluster[] = [];

  // Order seeds by highest priority so cluster centroids anchor around urgent issues
  const sortedSeeds = [...activeMappable].sort(
    (a, b) => (evaluationsById[b.id]?.score ?? 0) - (evaluationsById[a.id]?.score ?? 0)
  );

  for (const seed of sortedSeeds) {
    if (visited.has(seed.id)) continue;

    const neighbors = activeMappable.filter(
      (other) =>
        !visited.has(other.id) &&
        computeHaversineMeters(
          seed.approx_lat,
          seed.approx_lng,
          other.approx_lat,
          other.approx_lng
        ) <= 550
    );

    if (neighbors.length < 2) continue;

    neighbors.forEach((n) => visited.add(n.id));

    const avgLat = neighbors.reduce((s, n) => s + n.approx_lat, 0) / neighbors.length;
    const avgLng = neighbors.reduce((s, n) => s + n.approx_lng, 0) / neighbors.length;

    let maxDist = 240;
    for (const n of neighbors) {
      const d = computeHaversineMeters(avgLat, avgLng, n.approx_lat, n.approx_lng);
      if (d + 120 > maxDist) maxDist = Math.min(620, d + 120);
    }

    const catFreq = new Map<ComplaintCategory, number>();
    let criticalOrHigh = 0;
    let maxScore = 0;

    for (const n of neighbors) {
      catFreq.set(n.category, (catFreq.get(n.category) || 0) + 1);
      const ev = evaluationsById[n.id];
      if (ev) {
        if (ev.level === 'Critical' || ev.level === 'High') criticalOrHigh += 1;
        if (ev.score > maxScore) maxScore = ev.score;
      }
    }

    const dominantCategory =
      Array.from(catFreq.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || seed.category;

    clusters.push({
      id: `hotspot-${seed.id}`,
      centerLat: avgLat,
      centerLng: avgLng,
      radiusMeters: maxDist,
      areaLabel: seed.area_name || seed.locality.split(',')[0].trim(),
      dominantCategory,
      unresolvedCount: neighbors.length,
      criticalOrHighCount: criticalOrHigh,
      maxScore,
      memberIds: neighbors.map((n) => n.id)
    });
  }

  return clusters.sort(
    (a, b) =>
      b.criticalOrHighCount - a.criticalOrHighCount ||
      b.unresolvedCount - a.unresolvedCount ||
      b.maxScore - a.maxScore
  );
}

export const AdminHotspotsMap: React.FC<AdminHotspotsMapProps> = ({
  complaints,
  evaluationsById,
  isDemoMode,
  compactPreview = false,
  onInspectComplaint,
  onOpenFullMap
}) => {
  const [mapStyle, setMapStyle] = useState<MapTileStyle>('street');
  const [colorMode, setColorMode] = useState<MarkerColorMode>('priority');
  const [showHotspotRings, setShowHotspotRings] = useState<boolean>(true);
  const [areaFilter, setAreaFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | ComplaintCategory>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNRESOLVED' | ComplaintStatus>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | ComputedPriorityLevel>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [tileWarning, setTileWarning] = useState<boolean>(false);
  const [tileRetryNonce, setTileRetryNonce] = useState<number>(0);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const hotspotsLayerRef = useRef<L.LayerGroup | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const markerMapRef = useRef<Record<string, L.Marker>>({});
  const tileErrorCounterRef = useRef<number>(0);
  const tileLoadedCounterRef = useRef<number>(0);

  const mappableAll = useMemo(
    () => complaints.filter(hasValidComplaintCoords),
    [complaints]
  );

  const unmappableCount = complaints.length - mappableAll.length;

  const selectedAreaOption = useMemo(
    () => CIVIC_AREAS.find((a) => a.id === areaFilter) || null,
    [areaFilter]
  );

  const areaCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: mappableAll.length };
    for (const area of CIVIC_AREAS) {
      counts[area.id] = mappableAll.filter((c) => matchesArea(c, area)).length;
    }
    return counts;
  }, [mappableAll]);

  const filteredMarkers = useMemo(() => {
    return mappableAll.filter((c) => {
      if (selectedAreaOption && !matchesArea(c, selectedAreaOption)) return false;
      if (!compactPreview) {
        if (categoryFilter !== 'ALL' && c.category !== categoryFilter) return false;
        if (statusFilter === 'UNRESOLVED' && c.status === 'Resolved') return false;
        if (statusFilter !== 'ALL' && statusFilter !== 'UNRESOLVED' && c.status !== statusFilter) {
          return false;
        }
        const ev = evaluationsById[c.id];
        if (priorityFilter !== 'ALL' && ev?.level !== priorityFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const hit =
            c.reference_number.toLowerCase().includes(q) ||
            c.title.toLowerCase().includes(q) ||
            c.locality.toLowerCase().includes(q) ||
            c.landmark.toLowerCase().includes(q);
          if (!hit) return false;
        }
      }
      return true;
    });
  }, [
    mappableAll,
    selectedAreaOption,
    compactPreview,
    categoryFilter,
    statusFilter,
    priorityFilter,
    searchQuery,
    evaluationsById
  ]);

  const hotspots = useMemo(
    () => computeSpatialHotspots(filteredMarkers, evaluationsById),
    [filteredMarkers, evaluationsById]
  );

  useEffect(() => {
    if (filteredMarkers.length === 0) {
      setSelectedComplaintId(null);
      return;
    }
    if (!selectedComplaintId || !filteredMarkers.some((c) => c.id === selectedComplaintId)) {
      const highestPriority = [...filteredMarkers].sort(
        (a, b) => (evaluationsById[b.id]?.score ?? 0) - (evaluationsById[a.id]?.score ?? 0)
      )[0];
      setSelectedComplaintId(highestPriority?.id || filteredMarkers[0].id);
    }
  }, [filteredMarkers, selectedComplaintId, evaluationsById]);

  const selectedComplaint = useMemo(
    () =>
      filteredMarkers.find((c) => c.id === selectedComplaintId) || filteredMarkers[0] || null,
    [filteredMarkers, selectedComplaintId]
  );

  // Initialize Leaflet Map instance
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapInstanceRef.current) return;

    const map = L.map(container, {
      center: [MUMBAI_DEFAULT_CENTER.lat, MUMBAI_DEFAULT_CENTER.lng],
      zoom: 11,
      minZoom: 10,
      maxZoom: 19,
      scrollWheelZoom: !compactPreview,
      zoomControl: false
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    const hotspotsGroup = L.layerGroup().addTo(map);
    const markersGroup = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    hotspotsLayerRef.current = hotspotsGroup;
    markersLayerRef.current = markersGroup;

    const invalidateTimer = window.setTimeout(() => {
      map.invalidateSize();
    }, 100);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize({ pan: false });
      });
      resizeObserver.observe(container);
    }

    return () => {
      window.clearTimeout(invalidateTimer);
      resizeObserver?.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
      hotspotsLayerRef.current = null;
      markersLayerRef.current = null;
      markerMapRef.current = {};
    };
  }, [compactPreview]);

  // Attach verified OpenStreetMap Standard tile layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    tileErrorCounterRef.current = 0;
    tileLoadedCounterRef.current = 0;
    setTileWarning(false);

    const layer = L.tileLayer(OSM_STREET_TILE_URL, {
      attribution: OSM_TILE_ATTRIBUTION,
      minZoom: 10,
      maxZoom: 19,
      crossOrigin: true
    });

    layer.on('tileerror', () => {
      tileErrorCounterRef.current += 1;
      if (tileErrorCounterRef.current >= 4 && tileLoadedCounterRef.current === 0) {
        setTileWarning(true);
      } else if (tileErrorCounterRef.current >= 8) {
        setTileWarning(true);
      }
    });

    layer.on('tileload', () => {
      tileLoadedCounterRef.current += 1;
      tileErrorCounterRef.current = 0;
      setTileWarning(false);
    });

    layer.addTo(map);
    tileLayerRef.current = layer;
  }, [tileRetryNonce]);

  // Pan viewport on locality filter selection
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (selectedAreaOption) {
      map.setView([selectedAreaOption.centerLat, selectedAreaOption.centerLng], 14, {
        animate: true
      });
    } else {
      map.setView([MUMBAI_DEFAULT_CENTER.lat, MUMBAI_DEFAULT_CENTER.lng], 11, {
        animate: true
      });
    }
  }, [selectedAreaOption]);

  // Render spatial hotspot rings
  useEffect(() => {
    const group = hotspotsLayerRef.current;
    if (!group) return;
    group.clearLayers();

    if (!showHotspotRings) return;

    hotspots.forEach((cluster) => {
      const isUrgent = cluster.criticalOrHighCount >= 2 || cluster.maxScore >= 80;
      const strokeColor = isUrgent ? '#F05B5B' : '#E89A3C';
      const circle = L.circle([cluster.centerLat, cluster.centerLng], {
        radius: cluster.radiusMeters,
        color: strokeColor,
        weight: 1.75,
        dashArray: '5, 5',
        fillColor: strokeColor,
        fillOpacity: 0.12,
        interactive: true
      });

      circle.bindTooltip(
        `${cluster.areaLabel} Hotspot: ${cluster.unresolvedCount} unresolved (${cluster.criticalOrHighCount} Critical/High)${
          isDemoMode ? ' · Demo Data' : ''
        }`,
        { direction: 'top' }
      );

      circle.on('click', () => {
        if (cluster.memberIds[0]) {
          setSelectedComplaintId(cluster.memberIds[0]);
        }
      });

      circle.addTo(group);
    });
  }, [hotspots, showHotspotRings, isDemoMode]);

  // 1) Build markers only when filteredMarkers or colorMode changes (never clears popup on click)
  useEffect(() => {
    const group = markersLayerRef.current;
    if (!group) return;

    group.clearLayers();
    markerMapRef.current = {};

    const isDark = mapStyle === 'dark';

    filteredMarkers.forEach((c) => {
      const ev = evaluationsById[c.id];
      const level: ComputedPriorityLevel = ev?.level || 'Medium';
      const isSelected = c.id === selectedComplaintId;

      const icon = L.divIcon({
        className: 'urbanfix-custom-pin',
        html: createAdminPinMarkup(c.category, level, colorMode, isSelected, isDark),
        iconSize: [38, 38],
        iconAnchor: [19, 19],
        popupAnchor: [0, -16]
      });

      const marker = L.marker([c.approx_lat, c.approx_lng], {
        icon,
        title: `${c.reference_number} — ${c.title}`,
        zIndexOffset: isSelected ? 900 : level === 'Critical' ? 500 : 100
      });

      marker.bindPopup(createAdminPopupMarkup(c, ev, isDemoMode), {
        maxWidth: 300,
        closeButton: true
      });

      marker.on('click', () => {
        setSelectedComplaintId(c.id);
      });

      marker.addTo(group);
      markerMapRef.current[c.id] = marker;
    });
  }, [filteredMarkers, colorMode, evaluationsById, isDemoMode]);

  // 2) Update marker icon highlight without rebuilding layers
  useEffect(() => {
    const isDark = mapStyle === 'dark';
    filteredMarkers.forEach((c) => {
      const marker = markerMapRef.current[c.id];
      if (!marker) return;
      const ev = evaluationsById[c.id];
      const level: ComputedPriorityLevel = ev?.level || 'Medium';
      const isSelected = c.id === selectedComplaintId;

      marker.setIcon(
        L.divIcon({
          className: 'urbanfix-custom-pin',
          html: createAdminPinMarkup(c.category, level, colorMode, isSelected, isDark),
          iconSize: [38, 38],
          iconAnchor: [19, 19],
          popupAnchor: [0, -16]
        })
      );
      marker.setZIndexOffset(isSelected ? 900 : level === 'Critical' ? 500 : 100);
    });
  }, [selectedComplaintId, mapStyle, colorMode, filteredMarkers, evaluationsById]);

  const focusComplaintOnMap = (complaint: Complaint) => {
    setSelectedComplaintId(complaint.id);
    const map = mapInstanceRef.current;
    const marker = markerMapRef.current[complaint.id];
    if (map && hasValidComplaintCoords(complaint)) {
      map.setView([complaint.approx_lat, complaint.approx_lng], Math.max(map.getZoom(), 14), {
        animate: true
      });
      marker?.openPopup();
    }
  };

  if (compactPreview) {
    return (
      <div className="bg-white border border-[#E3E4E0] rounded-2xl overflow-hidden flex flex-col">
        <div className="px-5 py-3.5 border-b border-[#E3E4E0] flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#25272B]">
                Geographic Hotspot Preview
              </h3>
              {isDemoMode && (
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-[#FAF9F6] text-[#555B64] border border-[#E3E4E0] rounded-md">
                  Demo Data
                </span>
              )}
            </div>
            <p className="text-xs text-[#555B64] tabular-nums">
              {filteredMarkers.length} geo-tagged reports · {hotspots.length} active unresolved{' '}
              {hotspots.length === 1 ? 'cluster' : 'clusters'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMapStyle((s) => (s === 'street' ? 'dark' : 'street'))}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#25272B] bg-[#FAF9F6] hover:bg-[#ECEBE6] border border-[#E3E4E0] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {mapStyle === 'street' ? (
                <>
                  <Moon className="w-3.5 h-3.5" />
                  <span>Dark</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5" />
                  <span>Street</span>
                </>
              )}
            </button>
            {onOpenFullMap && (
              <button
                type="button"
                onClick={onOpenFullMap}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#4169E1] hover:bg-[#3457C9] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Open Hotspot Console</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="relative h-72 w-full">
          <div
            ref={mapContainerRef}
            className={`urbanfix-leaflet-container w-full h-full ${
              mapStyle === 'dark' ? 'urbanfix-map-dark' : ''
            }`}
          />
          {tileWarning && (
            <div className="absolute top-3 left-3 right-14 z-20 bg-white/95 border border-[#FECACA] rounded-xl px-3 py-2 flex items-center justify-between gap-2 shadow-sm">
              <span className="text-xs text-[#B91C1C] font-medium">
                Street tiles delayed. Markers remain interactive.
              </span>
              <button
                type="button"
                onClick={() => setTileRetryNonce((n) => n + 1)}
                className="px-2.5 py-1 text-xs font-semibold text-white bg-[#202329] rounded-md whitespace-nowrap shrink-0 cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}
        </div>

        {hotspots.length > 0 && (
          <div className="px-5 py-3 bg-[#FAF9F6] border-t border-[#E3E4E0] flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-[#25272B]">
              Top Cluster: {hotspots[0].areaLabel} ({hotspots[0].unresolvedCount} unresolved ·{' '}
              {hotspots[0].criticalOrHighCount} Critical/High)
            </span>
            {selectedComplaint && (
              <button
                type="button"
                onClick={() => onInspectComplaint(selectedComplaint)}
                className="font-semibold text-[#4169E1] hover:text-[#2B50C7] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Inspect {selectedComplaint.reference_number} →
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  const selectedEvaluation = selectedComplaint
    ? evaluationsById[selectedComplaint.id]
    : undefined;

  return (
    <div className="space-y-4">
      {/* Control Bar */}
      <div className="bg-white border border-[#E3E4E0] rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#555B64]">
            <span className="font-semibold text-[#25272B] tabular-nums">
              Showing {filteredMarkers.length} of {mappableAll.length} geo-tagged complaints
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {hotspots.length} spatial {hotspots.length === 1 ? 'hotspot' : 'hotspots'} (&le;550m)
            </span>
            {unmappableCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  {unmappableCount} omitted (no coordinates recorded)
                </span>
              </>
            )}
            {isDemoMode && (
              <span className="px-2 py-0.5 text-[11px] font-semibold bg-[#FAF9F6] text-[#555B64] border border-[#E3E4E0] rounded-md">
                Demo Data · Approximate Mumbai Coordinates
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Color Mode Switch */}
            <div className="inline-flex rounded-lg border border-[#E3E4E0] bg-[#FAF9F6] p-0.5">
              <button
                type="button"
                onClick={() => setColorMode('priority')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  colorMode === 'priority'
                    ? 'bg-[#202329] text-white'
                    : 'text-[#555B64] hover:text-[#25272B]'
                }`}
              >
                Color by Priority
              </button>
              <button
                type="button"
                onClick={() => setColorMode('category')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  colorMode === 'category'
                    ? 'bg-[#202329] text-white'
                    : 'text-[#555B64] hover:text-[#25272B]'
                }`}
              >
                Color by Category
              </button>
            </div>

            {/* Hotspot Rings Toggle */}
            <button
              type="button"
              onClick={() => setShowHotspotRings((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showHotspotRings
                  ? 'bg-[#FFF7ED] text-[#B45309] border-[#FED7AA]'
                  : 'bg-[#FAF9F6] text-[#555B64] border-[#E3E4E0]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Hotspot Rings ({hotspots.length})</span>
            </button>

            {/* Street / Dark Map Toggle */}
            <button
              type="button"
              onClick={() => setMapStyle((s) => (s === 'street' ? 'dark' : 'street'))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#25272B] bg-[#FAF9F6] hover:bg-[#ECEBE6] border border-[#E3E4E0] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {mapStyle === 'street' ? (
                <>
                  <Moon className="w-3.5 h-3.5" />
                  <span>Dark Map</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5" />
                  <span>Street Map</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#70757D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ref, street, landmark..."
              className="w-full pl-8 pr-3 py-2 text-xs bg-[#FAF9F6] border border-[#E3E4E0] rounded-lg text-[#25272B] placeholder:text-[#70757D] focus:outline-none focus:ring-2 focus:ring-[#4169E1]"
            />
          </div>

          <select
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            aria-label="Filter map by Mumbai ward"
            className="px-3 py-2 text-xs bg-[#FAF9F6] border border-[#E3E4E0] rounded-lg text-[#25272B] focus:outline-none focus:ring-2 focus:ring-[#4169E1]"
          >
            <option value="ALL">All Mumbai Wards ({areaCounts.ALL ?? 0})</option>
            {CIVIC_AREAS.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name} ({areaCounts[area.id] ?? 0})
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'ALL' | ComplaintCategory)}
            aria-label="Filter map by service category"
            className="px-3 py-2 text-xs bg-[#FAF9F6] border border-[#E3E4E0] rounded-lg text-[#25272B] focus:outline-none focus:ring-2 focus:ring-[#4169E1]"
          >
            <option value="ALL">All 5 Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as 'ALL' | 'UNRESOLVED' | ComplaintStatus)
            }
            aria-label="Filter map by status"
            className="px-3 py-2 text-xs bg-[#FAF9F6] border border-[#E3E4E0] rounded-lg text-[#25272B] focus:outline-none focus:ring-2 focus:ring-[#4169E1]"
          >
            <option value="ALL">All Statuses</option>
            <option value="UNRESOLVED">Unresolved Queue Only</option>
            <option value="Submitted">Submitted (Pending)</option>
            <option value="In Progress">In Progress</option>
            <option value="Reopened">Reopened</option>
            <option value="Resolved">Resolved</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) =>
              setPriorityFilter(e.target.value as 'ALL' | ComputedPriorityLevel)
            }
            aria-label="Filter map by computed priority"
            className="px-3 py-2 text-xs bg-[#FAF9F6] border border-[#E3E4E0] rounded-lg text-[#25272B] focus:outline-none focus:ring-2 focus:ring-[#4169E1]"
          >
            <option value="ALL">All Priority Levels</option>
            <option value="Critical">Critical (80–100)</option>
            <option value="High">High (60–79)</option>
            <option value="Medium">Medium (30–59)</option>
            <option value="Low">Low (0–29)</option>
          </select>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] text-[#555B64]">
          <span className="font-semibold text-[#25272B]">
            Active Legend ({colorMode === 'priority' ? 'Priority Score' : 'Civic Category'}):
          </span>
          {colorMode === 'priority' ? (
            <>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F05B5B]" />
                <span>Critical (80–100)</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#E89A3C]" />
                <span>High (60–79)</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#4169E1]" />
                <span>Medium (30–59)</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#70757D]" />
                <span>Low (0–29)</span>
              </span>
            </>
          ) : (
            CATEGORIES.map((cat) => (
              <span key={cat.id} className="inline-flex items-center gap-1.5">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    cat.id === 'Roads'
                      ? 'bg-[#E89A3C]'
                      : cat.id === 'Waste Management'
                      ? 'bg-[#F05B5B]'
                      : cat.id === 'Drainage'
                      ? 'bg-[#7C5CFA]'
                      : cat.id === 'Water Supply'
                      ? 'bg-[#4169E1]'
                      : 'bg-[#2E9E6B]'
                  }`}
                />
                <span>{cat.label}</span>
              </span>
            ))
          )}
        </div>
      </div>

      {/* Main Split: Map Canvas + Hotspot & Inspector Rail */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-8 bg-white border border-[#E3E4E0] rounded-2xl overflow-hidden relative min-h-[480px]">
          <div
            ref={mapContainerRef}
            className={`urbanfix-leaflet-container w-full h-[520px] ${
              mapStyle === 'dark' ? 'urbanfix-map-dark' : ''
            }`}
          />

          {tileWarning && (
            <div className="absolute top-3 left-3 right-14 z-20 bg-white/95 border border-[#FECACA] rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-2 text-xs text-[#B91C1C]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  OpenStreetMap street tiles encountered a network delay. Complaint markers remain
                  available.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setTileRetryNonce((n) => n + 1)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#202329] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Tiles</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Operations Inspector & Hotspot List */}
        <div className="xl:col-span-4 flex flex-col gap-4">
          {/* Selected Marker Inspector */}
          <div className="bg-white border border-[#E3E4E0] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#555B64]">
                Selected Map Report
              </span>
              {selectedComplaint && (
                <span className="font-mono text-xs font-semibold text-[#25272B] tabular-nums">
                  {selectedComplaint.reference_number}
                </span>
              )}
            </div>

            {selectedComplaint ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {selectedEvaluation && (
                    <PriorityLevelBadge
                      level={selectedEvaluation.level}
                      score={selectedEvaluation.score}
                      compact
                    />
                  )}
                  <span className="px-2 py-0.5 text-[11px] font-semibold bg-[#FAF9F6] text-[#25272B] border border-[#E3E4E0] rounded-md">
                    {selectedComplaint.category}
                  </span>
                  <span className="px-2 py-0.5 text-[11px] font-semibold bg-[#FAF9F6] text-[#555B64] border border-[#E3E4E0] rounded-md">
                    {selectedComplaint.status}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-[#25272B] leading-snug">
                  {selectedComplaint.title}
                </h4>

                <div className="text-xs text-[#555B64] space-y-1">
                  <div className="flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#4169E1] shrink-0 mt-0.5" />
                    <span>
                      {selectedComplaint.locality} · Near {selectedComplaint.landmark}
                    </span>
                  </div>
                  <div>
                    <strong className="text-[#25272B]">Department:</strong>{' '}
                    {selectedComplaint.department}
                  </div>
                </div>

                {selectedEvaluation && (
                  <p className="text-xs text-[#555B64] bg-[#FAF9F6] border border-[#E3E4E0] rounded-xl p-2.5 leading-relaxed">
                    {selectedEvaluation.conciseExplanation}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => onInspectComplaint(selectedComplaint)}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#4169E1] hover:bg-[#3457C9] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Inspect & Manage Complaint</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <p className="text-xs text-[#555B64] py-6 text-center">
                No geo-tagged complaints match the active map filters.
              </p>
            )}
          </div>

          {/* Detected Spatial Hotspots */}
          <div className="bg-white border border-[#E3E4E0] rounded-2xl p-4 space-y-3 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-[#25272B]">
                  Spatial Hotspot Clusters
                </h4>
                <p className="text-[11px] text-[#555B64]">
                  Unresolved clusters within 550m Haversine radius
                </p>
              </div>
              <span className="font-mono text-xs font-semibold text-[#25272B] tabular-nums">
                {hotspots.length}
              </span>
            </div>

            {hotspots.length === 0 ? (
              <p className="text-xs text-[#555B64] py-4">
                No multi-complaint unresolved spatial clusters found within the current filter
                selection.
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {hotspots.slice(0, 8).map((cluster) => (
                  <button
                    key={cluster.id}
                    type="button"
                    onClick={() => {
                      const lead = filteredMarkers.find((m) => m.id === cluster.memberIds[0]);
                      if (lead) focusComplaintOnMap(lead);
                    }}
                    className="w-full text-left p-2.5 rounded-xl border border-[#E3E4E0] bg-[#FAF9F6] hover:bg-[#F0EFEA] transition-colors space-y-1 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#25272B] truncate">
                        {cluster.areaLabel}
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-[#B91C1C] tabular-nums whitespace-nowrap shrink-0">
                        {cluster.unresolvedCount} active · Peak {cluster.maxScore}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#555B64] flex items-center justify-between gap-2">
                      <span>Primary: {cluster.dominantCategory}</span>
                      <span className="tabular-nums">
                        {cluster.criticalOrHighCount} Critical/High
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
