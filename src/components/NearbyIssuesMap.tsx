import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  AlertCircle,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  Droplets,
  Lightbulb,
  List,
  Map as MapIcon,
  MapPin,
  Moon,
  RefreshCw,
  RotateCcw,
  Search,
  Sun,
  Trash2,
  User,
  Waves,
  Wrench,
  X
} from 'lucide-react';
import {
  CATEGORIES,
  CIVIC_AREAS,
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
  MUMBAI_DEFAULT_CENTER,
  PublicMapIssue
} from '../types/urbanfix';

export type MapTileStyle = 'street' | 'dark';
type DisplayMode = 'map' | 'list';

interface NearbyIssuesMapProps {
  issues: PublicMapIssue[];
  selectedAreaId: string; // 'ALL' or a CivicAreaOption.id
  onSelectAreaId: (areaId: string) => void;
  isDemoMode: boolean;
  loading?: boolean;
  compactPreview?: boolean;
  highlightedIssueId?: string | null;
  mapStyle?: MapTileStyle;
  onChangeMapStyle?: (style: MapTileStyle) => void;
  onExploreFullMap?: (focusedIssueId?: string | null) => void;
  onInspectOwnIssue?: (issueId: string) => void;
}

/**
 * OpenStreetMap Standard raster tile server:
 * - Free, public, OpenStreetMap-compatible street map requiring no paid API key.
 * - Verified unwatermarked on Cloud Run (*.run.app) origins (unlike CARTO basemaps,
 *   which inject "API KEY REQUIRED" watermarked tiles when Referer matches *.run.app).
 * - Adheres to OpenStreetMap Tile Usage Policy: standard tile.openstreetmap.org URL
 *   without {s} subdomain sharding or @2x retina suffixes, bounded zoom (10–19),
 *   scrollWheelZoom disabled on compact preview, and visible © OpenStreetMap attribution.
 */
const OSM_STREET_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

const CATEGORY_VISUALS: Record<
  ComplaintCategory,
  {
    citizenLabel: string;
    shortLabel: string;
    hex: string;
    dotClass: string;
    popupCatClass: string;
    icon: React.FC<{ className?: string }>;
    glyphPath: string;
  }
> = {
  Roads: {
    citizenLabel: 'Potholes / Road Damage',
    shortLabel: 'Potholes & Roads',
    hex: '#E89A3C',
    dotClass: 'bg-[#E89A3C]',
    popupCatClass: 'urbanfix-popup-cat-roads',
    icon: Wrench,
    glyphPath: 'M5 17l3-10h8l3 10M12 9v5'
  },
  'Waste Management': {
    citizenLabel: 'Garbage / Waste Collection',
    shortLabel: 'Garbage & Waste',
    hex: '#F05B5B',
    dotClass: 'bg-[#F05B5B]',
    popupCatClass: 'urbanfix-popup-cat-waste',
    icon: Trash2,
    glyphPath: 'M8 8h8l-1 9H9L8 8zm2-2h4'
  },
  Drainage: {
    citizenLabel: 'Sewage / Drainage',
    shortLabel: 'Sewage & Drainage',
    hex: '#7C5CFA',
    dotClass: 'bg-[#7C5CFA]',
    popupCatClass: 'urbanfix-popup-cat-drainage',
    icon: Waves,
    glyphPath: 'M6 11c2-2 4 2 6 0s4 2 6 0M6 15c2-2 4 2 6 0s4 2 6 0'
  },
  'Water Supply': {
    citizenLabel: 'Water Leakage / Water Supply',
    shortLabel: 'Water Supply',
    hex: '#4169E1',
    dotClass: 'bg-[#4169E1]',
    popupCatClass: 'urbanfix-popup-cat-water',
    icon: Droplets,
    glyphPath: 'M12 6c-3 4-4.5 6-4.5 8.2a4.5 4.5 0 009 0C16.5 12 15 10 12 6z'
  },
  Streetlights: {
    citizenLabel: 'Streetlights',
    shortLabel: 'Streetlights',
    hex: '#2E9E6B',
    dotClass: 'bg-[#2E9E6B]',
    popupCatClass: 'urbanfix-popup-cat-lights',
    icon: Lightbulb,
    glyphPath: 'M12 6a4 4 0 00-2.5 7.1V15h5v-1.9A4 4 0 0012 6zm-1.5 11h3'
  }
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function hasValidCoordinates(issue: PublicMapIssue): boolean {
  return (
    typeof issue.approx_lat === 'number' &&
    typeof issue.approx_lng === 'number' &&
    Number.isFinite(issue.approx_lat) &&
    Number.isFinite(issue.approx_lng) &&
    Math.abs(issue.approx_lat) <= 90 &&
    Math.abs(issue.approx_lng) <= 180
  );
}

function matchesCivicArea(
  issue: PublicMapIssue,
  area: (typeof CIVIC_AREAS)[number]
): boolean {
  return (
    issue.area_name.toLowerCase() === area.name.toLowerCase() ||
    issue.locality.toLowerCase().includes(area.name.toLowerCase())
  );
}

function createPinMarkup(
  category: ComplaintCategory,
  isSelected: boolean,
  isDarkMap: boolean
): string {
  const vis = CATEGORY_VISUALS[category];
  const ringStroke = isSelected
    ? isDarkMap
      ? '#FFFFFF'
      : '#1F2227'
    : '#FFFFFF';
  const strokeWidth = isSelected ? 2.8 : 2;
  const radius = isSelected ? 15 : 12.5;
  const halo = isSelected
    ? `<circle cx="19" cy="19" r="18" fill="${vis.hex}" fill-opacity="0.30" />`
    : '';

  return `
    <div class="urbanfix-pin-shell">
      <svg width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        ${halo}
        <circle cx="19" cy="19" r="${radius}" fill="${vis.hex}" stroke="${ringStroke}" stroke-width="${strokeWidth}" />
        <g transform="translate(7, 7) scale(1)">
          <path d="${vis.glyphPath}" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        </g>
      </svg>
    </div>
  `;
}

function createPopupMarkup(issue: PublicMapIssue): string {
  const vis = CATEGORY_VISUALS[issue.category];
  const formattedDate = new Date(issue.created_at).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const statusDisplay = issue.status === 'Submitted' ? 'Pending (Submitted)' : issue.status;
  const dataLabel = issue.is_demo_record
    ? 'Demo Data · Approximate Mumbai coordinates'
    : issue.is_exact_pin
    ? 'Public Civic Report · Opt-in Pin'
    : 'Public Civic Report · Ward Center Pin';

  return `
    <div class="urbanfix-popup-body">
      <div class="urbanfix-popup-kicker">
        <span class="${vis.popupCatClass}">${escapeHtml(vis.citizenLabel)}</span>
        <span>${escapeHtml(statusDisplay)}</span>
      </div>
      <div class="urbanfix-popup-title">${escapeHtml(issue.title)}</div>
      <div class="urbanfix-popup-meta">
        <div class="urbanfix-popup-row">
          <span><strong>Ref:</strong> ${escapeHtml(issue.reference_number)}</span>
          <span>${escapeHtml(formattedDate)}</span>
        </div>
        <div><strong>Locality:</strong> ${escapeHtml(issue.locality)}</div>
        <div><strong>Landmark:</strong> ${escapeHtml(issue.landmark)}</div>
        <div class="urbanfix-popup-row">
          <span><strong>Priority:</strong> ${escapeHtml(issue.priority)}</span>
          <span><strong>By:</strong> ${escapeHtml(issue.reporter_display_name)}${issue.is_own_complaint ? ' (You)' : ''}</span>
        </div>
        <div class="urbanfix-popup-badge">${escapeHtml(dataLabel)}</div>
      </div>
    </div>
  `;
}

export const NearbyIssuesMap: React.FC<NearbyIssuesMapProps> = ({
  issues,
  selectedAreaId,
  onSelectAreaId,
  isDemoMode,
  loading = false,
  compactPreview = false,
  highlightedIssueId,
  mapStyle: controlledMapStyle,
  onChangeMapStyle,
  onExploreFullMap,
  onInspectOwnIssue
}) => {
  const [internalMapStyle, setInternalMapStyle] = useState<MapTileStyle>('street');
  const effectiveMapStyle: MapTileStyle = controlledMapStyle ?? internalMapStyle;

  const updateMapStyle = (nextStyle: MapTileStyle) => {
    setInternalMapStyle(nextStyle);
    onChangeMapStyle?.(nextStyle);
  };

  const [displayMode, setDisplayMode] = useState<DisplayMode>('map');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | ComplaintCategory>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ComplaintStatus>('ALL');
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(
    highlightedIssueId || null
  );
  const [tileWarning, setTileWarning] = useState<boolean>(false);
  const [tileRetryNonce, setTileRetryNonce] = useState<number>(0);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const markerMapRef = useRef<Record<string, L.Marker>>({});
  const tileErrorCounterRef = useRef<number>(0);
  const tileLoadedCounterRef = useRef<number>(0);

  const selectedAreaOption = useMemo(
    () => CIVIC_AREAS.find((a) => a.id === selectedAreaId) || null,
    [selectedAreaId]
  );

  // Use only complaints that have valid coordinates; never invent random coordinates
  const mappableAllIssues = useMemo(
    () => issues.filter(hasValidCoordinates),
    [issues]
  );

  // Per-locality marker counts so dropdowns explain exact ward totals (e.g. Andheri West = 12 of 90)
  const areaMarkerCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: mappableAllIssues.length };
    CIVIC_AREAS.forEach((area) => {
      counts[area.id] = mappableAllIssues.filter((issue) =>
        matchesCivicArea(issue, area)
      ).length;
    });
    return counts;
  }, [mappableAllIssues]);

  useEffect(() => {
    if (highlightedIssueId) {
      setSelectedIssueId(highlightedIssueId);
      setCategoryFilter('ALL');
      setStatusFilter('ALL');
      setSearchQuery('');
      setDisplayMode('map');
    }
  }, [highlightedIssueId]);

  // Filter issues consistently across Map markers and List items
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (selectedAreaOption && !matchesCivicArea(issue, selectedAreaOption)) {
        return false;
      }
      if (!compactPreview) {
        if (categoryFilter !== 'ALL' && issue.category !== categoryFilter) {
          return false;
        }
        if (statusFilter !== 'ALL' && issue.status !== statusFilter) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const hitTitle = issue.title.toLowerCase().includes(q);
          const hitLoc = issue.locality.toLowerCase().includes(q);
          const hitLandmark = issue.landmark.toLowerCase().includes(q);
          const hitRef = issue.reference_number.toLowerCase().includes(q);
          const hitCat = CATEGORY_VISUALS[issue.category].citizenLabel.toLowerCase().includes(q);
          if (!hitTitle && !hitLoc && !hitLandmark && !hitRef && !hitCat) {
            return false;
          }
        }
      }
      return true;
    });
  }, [issues, selectedAreaOption, compactPreview, categoryFilter, statusFilter, searchQuery]);

  // Markers currently plotted on the map (only filtered records with valid coordinates)
  const displayedMarkers = useMemo(
    () => filteredIssues.filter(hasValidCoordinates),
    [filteredIssues]
  );

  // Category counts within current locality/search/status scope
  const categoryCounts = useMemo(() => {
    const scopeSubset = issues.filter((issue) => {
      if (selectedAreaOption && !matchesCivicArea(issue, selectedAreaOption)) {
        return false;
      }
      if (statusFilter !== 'ALL' && issue.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hit =
          issue.title.toLowerCase().includes(q) ||
          issue.locality.toLowerCase().includes(q) ||
          issue.landmark.toLowerCase().includes(q) ||
          issue.reference_number.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });

    const counts: Record<string, number> = { ALL: scopeSubset.length };
    CATEGORIES.forEach((c) => {
      counts[c.id] = scopeSubset.filter((i) => i.category === c.id).length;
    });
    return counts;
  }, [issues, selectedAreaOption, statusFilter, searchQuery]);

  // Keep selected issue synchronized with filtered results
  useEffect(() => {
    if (filteredIssues.length === 0) {
      setSelectedIssueId(null);
      return;
    }
    if (compactPreview) {
      if (selectedIssueId && !filteredIssues.some((i) => i.id === selectedIssueId)) {
        setSelectedIssueId(null);
      }
      return;
    }
    if (!selectedIssueId || !filteredIssues.some((i) => i.id === selectedIssueId)) {
      setSelectedIssueId(filteredIssues[0].id);
    }
  }, [filteredIssues, selectedIssueId, compactPreview]);

  const selectedIssue = useMemo(() => {
    if (!selectedIssueId) {
      return compactPreview ? null : filteredIssues[0] || null;
    }
    return (
      filteredIssues.find((i) => i.id === selectedIssueId) ||
      (compactPreview ? null : filteredIssues[0] || null)
    );
  }, [filteredIssues, selectedIssueId, compactPreview]);

  // Initialize Leaflet Map when Map View is visible + keep responsive via ResizeObserver
  useEffect(() => {
    if (displayMode !== 'map' || loading) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        tileLayerRef.current = null;
        markersLayerRef.current = null;
        markerMapRef.current = {};
      }
      return;
    }

    const container = mapContainerRef.current;
    if (!container || mapInstanceRef.current) return;

    const initialCenter: [number, number] = selectedAreaOption
      ? [selectedAreaOption.centerLat, selectedAreaOption.centerLng]
      : [MUMBAI_DEFAULT_CENTER.lat, MUMBAI_DEFAULT_CENTER.lng];
    const initialZoom = selectedAreaOption ? 14 : 11;

    const map = L.map(container, {
      center: initialCenter,
      zoom: initialZoom,
      minZoom: 10,
      maxZoom: 19,
      scrollWheelZoom: !compactPreview,
      zoomControl: false
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
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
      markersLayerRef.current = null;
      markerMapRef.current = {};
    };
  }, [displayMode, loading, compactPreview]);

  // Attach verified OpenStreetMap TileLayer and handle retry / network errors cleanly
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || displayMode !== 'map' || loading) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    tileErrorCounterRef.current = 0;
    tileLoadedCounterRef.current = 0;
    setTileWarning(false);

    const nextLayer = L.tileLayer(OSM_STREET_TILE_URL, {
      attribution: OSM_TILE_ATTRIBUTION,
      minZoom: 10,
      maxZoom: 19,
      crossOrigin: true
    });

    nextLayer.on('tileerror', () => {
      tileErrorCounterRef.current += 1;
      if (tileErrorCounterRef.current >= 4 && tileLoadedCounterRef.current === 0) {
        setTileWarning(true);
      } else if (tileErrorCounterRef.current >= 8) {
        setTileWarning(true);
      }
    });

    nextLayer.on('tileload', () => {
      tileLoadedCounterRef.current += 1;
      tileErrorCounterRef.current = 0;
      setTileWarning(false);
    });

    nextLayer.addTo(map);
    tileLayerRef.current = nextLayer;
  }, [displayMode, loading, tileRetryNonce]);

  // Smoothly pan/zoom viewport when manual locality filter changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || displayMode !== 'map') return;

    if (selectedAreaOption) {
      map.setView([selectedAreaOption.centerLat, selectedAreaOption.centerLng], 14, {
        animate: true
      });
    } else {
      map.setView([MUMBAI_DEFAULT_CENTER.lat, MUMBAI_DEFAULT_CENTER.lng], 11, {
        animate: true
      });
    }
  }, [selectedAreaOption, displayMode]);

  // 1) Build markers ONLY when displayedMarkers or displayMode changes (never clears open popup on click!)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markersLayerRef.current;
    if (!map || !group || displayMode !== 'map') return;

    group.clearLayers();
    markerMapRef.current = {};

    const isDark = effectiveMapStyle === 'dark';

    displayedMarkers.forEach((issue) => {
      const isSelected = selectedIssueId === issue.id;
      const icon = L.divIcon({
        className: 'urbanfix-custom-pin',
        html: createPinMarkup(issue.category, isSelected, isDark),
        iconSize: [38, 38],
        iconAnchor: [19, 19],
        popupAnchor: [0, -16]
      });

      const marker = L.marker([issue.approx_lat, issue.approx_lng], {
        icon,
        title: `${issue.reference_number} — ${issue.title}`,
        alt: `${CATEGORY_VISUALS[issue.category].citizenLabel}: ${issue.title}`,
        zIndexOffset: isSelected ? 1000 : issue.is_own_complaint ? 400 : 0
      });

      marker.bindPopup(createPopupMarkup(issue), {
        maxWidth: 300,
        closeButton: true
      });

      marker.on('click', () => {
        setSelectedIssueId(issue.id);
      });

      marker.addTo(group);
      markerMapRef.current[issue.id] = marker;
    });

    if (highlightedIssueId && markerMapRef.current[highlightedIssueId]) {
      const target = markerMapRef.current[highlightedIssueId];
      const latLng = target.getLatLng();
      map.setView(latLng, Math.max(map.getZoom(), 15), { animate: true });
      target.openPopup();
    }
  }, [displayedMarkers, displayMode, highlightedIssueId]);

  // 2) Update marker active ring & map theme in-place without closing open Leaflet popups
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || displayMode !== 'map') return;

    const isDark = effectiveMapStyle === 'dark';

    displayedMarkers.forEach((issue) => {
      const marker = markerMapRef.current[issue.id];
      if (!marker) return;
      const isSelected = selectedIssue?.id === issue.id;
      marker.setIcon(
        L.divIcon({
          className: 'urbanfix-custom-pin',
          html: createPinMarkup(issue.category, isSelected, isDark),
          iconSize: [38, 38],
          iconAnchor: [19, 19],
          popupAnchor: [0, -16]
        })
      );
      marker.setZIndexOffset(isSelected ? 1000 : issue.is_own_complaint ? 400 : 0);
    });
  }, [selectedIssue?.id, effectiveMapStyle, displayedMarkers, displayMode]);

  // Focus a specific issue on the map (from List View or Side Rail)
  const focusIssueOnMap = (issue: PublicMapIssue) => {
    setSelectedIssueId(issue.id);
    if (displayMode !== 'map') {
      setDisplayMode('map');
      window.setTimeout(() => {
        const map = mapInstanceRef.current;
        const marker = markerMapRef.current[issue.id];
        if (map && hasValidCoordinates(issue)) {
          map.setView([issue.approx_lat, issue.approx_lng], Math.max(map.getZoom(), 15), {
            animate: true
          });
          marker?.openPopup();
        }
      }, 180);
      return;
    }

    const map = mapInstanceRef.current;
    const marker = markerMapRef.current[issue.id];
    if (map && hasValidCoordinates(issue)) {
      map.setView([issue.approx_lat, issue.approx_lng], Math.max(map.getZoom(), 14), {
        animate: true
      });
      marker?.openPopup();
    }
  };

  const handleRetryTiles = () => {
    setTileWarning(false);
    setTileRetryNonce((n) => n + 1);
  };

  const resetAllFilters = () => {
    setSearchQuery('');
    setCategoryFilter('ALL');
    setStatusFilter('ALL');
    onSelectAreaId('ALL');
  };

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    categoryFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    selectedAreaId !== 'ALL';

  const renderStatusBadge = (status: ComplaintStatus) => {
    switch (status) {
      case 'Resolved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#ECF8F2] text-[#176341] border border-[#BDE4D1] whitespace-nowrap shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Resolved</span>
          </span>
        );
      case 'In Progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#EEF2FD] text-[#2849B8] border border-[#C6D3FA] whitespace-nowrap shrink-0">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>In Progress</span>
          </span>
        );
      case 'Reopened':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FEF0F0] text-[#AC2F2F] border border-[#F6C8C8] whitespace-nowrap shrink-0">
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span>Reopened</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FDF5EA] text-[#8A4F0E] border border-[#F1D5B0] whitespace-nowrap shrink-0">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>Pending</span>
          </span>
        );
    }
  };

  const renderPriorityText = (priority: ComplaintPriority) => {
    if (priority === 'High') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#C23434] whitespace-nowrap">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>High Priority</span>
        </span>
      );
    }
    if (priority === 'Medium') {
      return (
        <span className="text-xs font-semibold text-[#8A4F0E] whitespace-nowrap">
          Medium Priority
        </span>
      );
    }
    return (
      <span className="text-xs font-medium text-[#555B64] whitespace-nowrap">
        Low Priority
      </span>
    );
  };

  const renderTileErrorBanner = () => {
    if (!tileWarning || displayMode !== 'map') return null;

    return (
      <div
        role="alert"
        className="bg-[#FDF5EA] border border-[#EAB975] rounded-xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-[#6E3D07]"
      >
        <div className="flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-[#C26A12] shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-[#25272B]">
              Street map tiles could not be loaded completely
            </div>
            <p className="text-xs sm:text-sm text-[#555B64] mt-0.5">
              OpenStreetMap tile servers may be temporarily unreachable on your network. Retry
              loading street tiles or inspect all complaints in List View.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRetryTiles}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white border border-[#D8C2A3] text-[#1F2227] hover:bg-[#FAF9F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Map Tiles</span>
          </button>

          {!compactPreview && (
            <button
              type="button"
              onClick={() => setDisplayMode('list')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-[#202329] hover:bg-[#2F333C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] cursor-pointer whitespace-nowrap shrink-0"
            >
              <List className="w-3.5 h-3.5" />
              <span>Switch to List View</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  /* =========================================================================
     COMPACT OVERVIEW PREVIEW MODE
  ========================================================================= */
  if (compactPreview) {
    return (
      <div className="bg-white border border-[#DCDDD8] rounded-2xl overflow-hidden shadow-2xs">
        {/* Compact Preview Header: Title, Explicit Marker Count, Locality Filter, Street/Dark Toggle, Explore CTA */}
        <div className="px-5 py-4 border-b border-[#E3E4E0] flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-base font-bold text-[#1F2227]">
                Mumbai Reported Issues Map
              </h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold font-mono tabular-nums bg-[#EEF2FD] text-[#2849B8] border border-[#CFD9FA]">
                Showing {displayedMarkers.length} of {mappableAllIssues.length} markers
              </span>
              {isDemoMode && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-[#F4F3EF] text-[#4A5058] border border-[#DCDDD8]">
                  Demo Data
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-[#555B64]">
              <span>
                {selectedAreaOption
                  ? `Filtered to ${selectedAreaOption.name} (${selectedAreaOption.ward})`
                  : 'Showing all Greater Mumbai civic wards — click any marker to inspect report details'}
              </span>
              {selectedAreaOption && (
                <button
                  type="button"
                  onClick={() => onSelectAreaId('ALL')}
                  className="font-semibold text-[#3358CC] hover:text-[#2343A8] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] rounded cursor-pointer whitespace-nowrap"
                >
                  Show all {mappableAllIssues.length} markers
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Inline Locality Selector Synchronized with Full Map & Sidebar */}
            <div>
              <label htmlFor="preview-locality-select" className="sr-only">
                Filter map preview by Mumbai locality
              </label>
              <select
                id="preview-locality-select"
                value={selectedAreaId}
                onChange={(e) => onSelectAreaId(e.target.value)}
                className="px-3 py-2 text-xs font-semibold text-[#1F2227] bg-[#F4F3EF] hover:bg-[#ECEBE6] border border-[#DCDDD8] rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4169E1] cursor-pointer"
              >
                <option value="ALL">
                  All Mumbai Localities ({areaMarkerCounts.ALL || 0})
                </option>
                {CIVIC_AREAS.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name} ({areaMarkerCounts[area.id] || 0})
                  </option>
                ))}
              </select>
            </div>

            {/* Street / Dark Map Toggle */}
            <div
              role="group"
              aria-label="Map tile theme"
              className="inline-flex items-center p-0.5 bg-[#F4F3EF] border border-[#DCDDD8] rounded-lg"
            >
              <button
                type="button"
                aria-pressed={effectiveMapStyle === 'street'}
                onClick={() => updateMapStyle('street')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] ${
                  effectiveMapStyle === 'street'
                    ? 'bg-white text-[#1F2227] shadow-2xs'
                    : 'text-[#555B64] hover:text-[#1F2227]'
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-[#D9822B]" />
                <span>Street</span>
              </button>
              <button
                type="button"
                aria-pressed={effectiveMapStyle === 'dark'}
                onClick={() => updateMapStyle('dark')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] ${
                  effectiveMapStyle === 'dark'
                    ? 'bg-[#202329] text-white'
                    : 'text-[#555B64] hover:text-[#1F2227]'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Dark</span>
              </button>
            </div>

            {onExploreFullMap && (
              <button
                type="button"
                onClick={() => onExploreFullMap(selectedIssue?.id || null)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-[#4169E1] hover:bg-[#3358CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] focus-visible:ring-offset-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Explore Full Map</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Tile Error Fallback inside Compact Preview */}
        {tileWarning && <div className="p-4 border-b border-[#E3E4E0]">{renderTileErrorBanner()}</div>}

        {/* Geographic OpenStreetMap Canvas */}
        {loading ? (
          <div className="h-[360px] sm:h-[390px] bg-[#F4F3EF] animate-pulse" />
        ) : (
          <div
            ref={mapContainerRef}
            className={`urbanfix-leaflet-container w-full h-[360px] sm:h-[390px] ${
              effectiveMapStyle === 'dark' ? 'urbanfix-map-dark' : ''
            }`}
            aria-label="Mumbai civic issues street map preview"
          />
        )}

        {/* Active Clicked Marker Quick Summary Bar */}
        {selectedIssue && (
          <div className="px-5 py-3 bg-[#EEF2FD]/65 border-t border-[#CFD9FA] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="font-mono font-bold text-[#1F2227] tabular-nums shrink-0">
                {selectedIssue.reference_number}
              </span>
              {renderStatusBadge(selectedIssue.status)}
              <span className="font-semibold text-[#1F2227] truncate">
                {selectedIssue.title}
              </span>
              <span className="text-[#555B64] truncate">· {selectedIssue.locality}</span>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {selectedIssue.is_own_complaint && onInspectOwnIssue && (
                <button
                  type="button"
                  onClick={() => onInspectOwnIssue(selectedIssue.id)}
                  className="font-semibold text-[#3358CC] hover:underline cursor-pointer whitespace-nowrap"
                >
                  Open timeline →
                </button>
              )}
              {onExploreFullMap && (
                <button
                  type="button"
                  onClick={() => onExploreFullMap(selectedIssue.id)}
                  className="font-semibold text-[#3358CC] hover:underline cursor-pointer whitespace-nowrap"
                >
                  Inspect in Full Map →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Color-Coded Category Legend & Honest Tile Attribution Note */}
        <div className="px-5 py-3.5 bg-[#FAF9F6] border-t border-[#E3E4E0] flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 text-xs text-[#555B64]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {CATEGORIES.map((cat) => {
              const vis = CATEGORY_VISUALS[cat.id];
              const Icon = vis.icon;
              return (
                <span
                  key={cat.id}
                  className="inline-flex items-center gap-1.5 font-medium text-[#1F2227]"
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${vis.dotClass}`}
                    aria-hidden="true"
                  />
                  <Icon className="w-3.5 h-3.5 text-[#555B64] shrink-0" />
                  <span>{vis.shortLabel}</span>
                </span>
              );
            })}
          </div>

          <span className="text-xs text-[#555B64]">
            {effectiveMapStyle === 'dark'
              ? 'OpenStreetMap Standard (dark tile filter · no API key required)'
              : isDemoMode
              ? 'OpenStreetMap Standard · Demo Data approximate coordinates'
              : 'OpenStreetMap Standard · Public civic locations'}
          </span>
        </div>
      </div>
    );
  }

  /* =========================================================================
     FULL EXPLORE ISSUE MAP EXPERIENCE (MAP + LIST SYNCHRONIZATION)
  ========================================================================= */
  return (
    <div className="space-y-5">
      {/* Control Bar: Search, Locality, Status, Map/List Toggle, Street/Dark Toggle */}
      <div className="bg-white border border-[#DCDDD8] rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xs">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          {/* Search + Locality + Status Filters */}
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 flex-1">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-[#555B64] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Mumbai streets, landmarks, titles, or ID..."
                aria-label="Search reported issues"
                className="w-full pl-10 pr-9 py-2.5 text-sm text-[#1F2227] placeholder:text-[#686E78] bg-[#F4F3EF]/80 border border-[#DCDDD8] rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4169E1]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555B64] hover:text-[#1F2227] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div>
              <label htmlFor="explore-locality-select" className="sr-only">
                Filter by Mumbai locality
              </label>
              <select
                id="explore-locality-select"
                value={selectedAreaId}
                onChange={(e) => onSelectAreaId(e.target.value)}
                className="w-full sm:w-auto px-3.5 py-2.5 text-sm font-medium text-[#1F2227] bg-[#F4F3EF]/80 border border-[#DCDDD8] rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4169E1] cursor-pointer"
              >
                <option value="ALL">
                  All Mumbai Localities ({areaMarkerCounts.ALL || 0})
                </option>
                {CIVIC_AREAS.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name} · {area.ward} ({areaMarkerCounts[area.id] || 0})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="explore-status-select" className="sr-only">
                Filter by complaint status
              </label>
              <select
                id="explore-status-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'ALL' | ComplaintStatus)}
                className="w-full sm:w-auto px-3.5 py-2.5 text-sm font-medium text-[#1F2227] bg-[#F4F3EF]/80 border border-[#DCDDD8] rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4169E1] cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="Submitted">Pending (Submitted)</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Reopened">Reopened</option>
              </select>
            </div>
          </div>

          {/* Right Controls: Map/List Toggle + Street/Dark Toggle */}
          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 shrink-0">
            {/* Map View / List View Toggle */}
            <div
              role="group"
              aria-label="View mode"
              className="inline-flex items-center p-1 bg-[#F4F3EF] border border-[#DCDDD8] rounded-xl"
            >
              <button
                type="button"
                aria-pressed={displayMode === 'map'}
                onClick={() => setDisplayMode('map')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] ${
                  displayMode === 'map'
                    ? 'bg-white text-[#1F2227] shadow-2xs'
                    : 'text-[#555B64] hover:text-[#1F2227]'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>Map View</span>
              </button>
              <button
                type="button"
                aria-pressed={displayMode === 'list'}
                onClick={() => setDisplayMode('list')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] ${
                  displayMode === 'list'
                    ? 'bg-white text-[#1F2227] shadow-2xs'
                    : 'text-[#555B64] hover:text-[#1F2227]'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>List View</span>
              </button>
            </div>

            {/* Street / Dark Map Style Toggle */}
            {displayMode === 'map' && (
              <div
                role="group"
                aria-label="Map tile theme"
                className="inline-flex items-center p-1 bg-[#F4F3EF] border border-[#DCDDD8] rounded-xl"
              >
                <button
                  type="button"
                  aria-pressed={effectiveMapStyle === 'street'}
                  onClick={() => updateMapStyle('street')}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] ${
                    effectiveMapStyle === 'street'
                      ? 'bg-white text-[#1F2227] shadow-2xs'
                      : 'text-[#555B64] hover:text-[#1F2227]'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5 text-[#D9822B]" />
                  <span>Street View</span>
                </button>
                <button
                  type="button"
                  aria-pressed={effectiveMapStyle === 'dark'}
                  onClick={() => updateMapStyle('dark')}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] ${
                    effectiveMapStyle === 'dark'
                      ? 'bg-[#202329] text-white'
                      : 'text-[#555B64] hover:text-[#1F2227]'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>Dark View</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Color-Coded Category Filter Bar + Marker Count Summary */}
        <div className="pt-3 border-t border-[#E3E4E0] flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setCategoryFilter('ALL')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] ${
                categoryFilter === 'ALL'
                  ? 'bg-[#202329] text-white border-[#202329]'
                  : 'bg-white text-[#1F2227] border-[#DCDDD8] hover:bg-[#F4F3EF]'
              }`}
            >
              <span>All Categories</span>
              <span
                className={`font-mono tabular-nums ${
                  categoryFilter === 'ALL' ? 'text-white/80' : 'text-[#555B64]'
                }`}
              >
                {categoryCounts.ALL || 0}
              </span>
            </button>

            {CATEGORIES.map((cat) => {
              const vis = CATEGORY_VISUALS[cat.id];
              const Icon = vis.icon;
              const isActive = categoryFilter === cat.id;
              const count = categoryCounts[cat.id] || 0;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryFilter(isActive ? 'ALL' : cat.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] ${
                    isActive
                      ? 'bg-[#4169E1] text-white border-[#4169E1]'
                      : 'bg-white text-[#1F2227] border-[#DCDDD8] hover:bg-[#F4F3EF]'
                  }`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      isActive ? 'bg-white' : vis.dotClass
                    }`}
                    aria-hidden="true"
                  />
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isActive ? 'text-white' : 'text-[#555B64]'
                    }`}
                  />
                  <span>{vis.citizenLabel}</span>
                  <span
                    className={`font-mono tabular-nums ${
                      isActive ? 'text-white/85' : 'text-[#555B64]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 text-xs text-[#555B64] shrink-0">
            <span className="tabular-nums">
              Showing <strong className="text-[#1F2227]">{displayedMarkers.length}</strong> of{' '}
              <strong className="text-[#1F2227]">{mappableAllIssues.length}</strong>{' '}
              {displayMode === 'map' ? 'markers' : 'reports'}
              {isDemoMode ? ' · Demo Data' : ''}
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="font-semibold text-[#3358CC] hover:text-[#2343A8] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] rounded cursor-pointer whitespace-nowrap"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tile Loading Error Banner (with Retry + Switch to List View) */}
      {renderTileErrorBanner()}

      {/* =====================================================================
          MODE A: INTERACTIVE STREET / DARK MAP + SYNCHRONIZED INSPECTOR RAIL
      ===================================================================== */}
      {displayMode === 'map' ? (
        loading ? (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-8 h-[560px] bg-white border border-[#DCDDD8] rounded-2xl animate-pulse" />
            <div className="xl:col-span-4 h-[560px] bg-white border border-[#DCDDD8] rounded-2xl animate-pulse" />
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
            {/* Geographic Leaflet Map Canvas */}
            <div className="xl:col-span-8 bg-white border border-[#DCDDD8] rounded-2xl overflow-hidden flex flex-col shadow-2xs">
              <div className="relative flex-1 min-h-[450px] sm:min-h-[540px]">
                <div
                  ref={mapContainerRef}
                  className={`urbanfix-leaflet-container w-full h-full min-h-[450px] sm:min-h-[540px] ${
                    effectiveMapStyle === 'dark' ? 'urbanfix-map-dark' : ''
                  }`}
                  aria-label="Interactive street map of reported Mumbai civic issues"
                />

                {displayedMarkers.length === 0 && (
                  <div className="absolute inset-0 z-20 bg-[#202329]/55 backdrop-blur-[2px] flex items-center justify-center p-6">
                    <div className="bg-white border border-[#DCDDD8] rounded-2xl p-6 max-w-sm text-center space-y-3 shadow-lg">
                      <MapPin className="w-8 h-8 text-[#555B64] mx-auto" />
                      <h3 className="text-base font-bold text-[#1F2227]">
                        No Markers Match Your Filters
                      </h3>
                      <p className="text-sm text-[#555B64]">
                        Clear the active search, category, status, or locality filter to view
                        reported issues on the map.
                      </p>
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        className="px-4 py-2 text-xs font-semibold text-white bg-[#4169E1] hover:bg-[#3358CC] rounded-lg transition-colors cursor-pointer"
                      >
                        Reset Map Filters
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Honest Data, Privacy & Tile Source Caption */}
              <div className="px-4 py-3 bg-[#FAF9F6] border-t border-[#E3E4E0] flex flex-wrap items-center justify-between gap-2 text-xs text-[#555B64]">
                <span>
                  {isDemoMode
                    ? 'Demo Data: Sample Mumbai civic reports at approximate street coordinates.'
                    : 'Public civic map: Personal emails, phone numbers, and exact home addresses are never shown.'}
                </span>
                <span className="font-mono tabular-nums text-[#4A5058]">
                  {effectiveMapStyle === 'dark'
                    ? 'OpenStreetMap Standard · Dark Tile Filter (No API Key)'
                    : 'OpenStreetMap Standard Street Tiles'}
                </span>
              </div>
            </div>

            {/* Synchronized Selected Issue Inspector + Scrollable Results Rail */}
            <div className="xl:col-span-4 bg-white border border-[#DCDDD8] rounded-2xl flex flex-col max-h-[620px] overflow-hidden shadow-2xs">
              {/* Selected Marker Details */}
              <div className="p-5 border-b border-[#E3E4E0] bg-[#FAF9F6]">
                {selectedIssue ? (
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs text-[#555B64] min-w-0">
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            CATEGORY_VISUALS[selectedIssue.category].dotClass
                          }`}
                          aria-hidden="true"
                        />
                        <span className="font-mono font-bold text-[#1F2227] tabular-nums shrink-0">
                          {selectedIssue.reference_number}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate font-medium text-[#1F2227]">
                          {CATEGORY_VISUALS[selectedIssue.category].citizenLabel}
                        </span>
                      </div>
                      {renderStatusBadge(selectedIssue.status)}
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="text-base font-bold text-[#1F2227] leading-snug">
                        {selectedIssue.title}
                      </h3>
                      <p className="text-sm text-[#4A5058] leading-relaxed">
                        {selectedIssue.description}
                      </p>
                    </div>

                    <div className="pt-2.5 border-t border-[#E3E4E0] space-y-2 text-xs text-[#1F2227]">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-[#4169E1] shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold">{selectedIssue.locality}</div>
                          <div className="text-[#555B64]">Landmark: {selectedIssue.landmark}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="inline-flex items-center gap-1.5 text-[#555B64]">
                          <User className="w-3.5 h-3.5 text-[#555B64]" />
                          <span>
                            {selectedIssue.reporter_display_name}
                            {selectedIssue.is_own_complaint ? ' (You)' : ''}
                          </span>
                        </span>
                        {renderPriorityText(selectedIssue.priority)}
                      </div>

                      <div className="flex items-center justify-between gap-2 text-[#555B64]">
                        <span className="inline-flex items-center gap-1.5 tabular-nums">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            {new Date(selectedIssue.created_at).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                        </span>
                        <span className="font-medium text-[#4A5058]">
                          {selectedIssue.is_demo_record ? 'Demo Data' : 'Public Summary'}
                        </span>
                      </div>

                      {selectedIssue.is_own_complaint && onInspectOwnIssue && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => onInspectOwnIssue(selectedIssue.id)}
                            className="w-full py-2 px-3 rounded-lg text-xs font-semibold text-white bg-[#4169E1] hover:bg-[#3358CC] transition-colors cursor-pointer"
                          >
                            Open Personal Complaint Timeline →
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center text-sm text-[#555B64]">
                    Select a marker or adjust filters to inspect complaint details.
                  </div>
                )}
              </div>

              {/* Synchronized Click-to-Focus List */}
              <div className="px-5 py-2.5 border-b border-[#E3E4E0] bg-white flex items-center justify-between text-xs font-semibold text-[#555B64]">
                <span className="tabular-nums">
                  Matching Markers ({displayedMarkers.length})
                </span>
                <span>Click to focus marker</span>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-[#E3E4E0]">
                {displayedMarkers.length === 0 ? (
                  <div className="p-8 text-center text-sm text-[#555B64]">
                    No issues match the selected filters.
                  </div>
                ) : (
                  displayedMarkers.map((issue) => {
                    const active = selectedIssue?.id === issue.id;
                    const vis = CATEGORY_VISUALS[issue.category];
                    return (
                      <button
                        key={issue.id}
                        type="button"
                        onClick={() => focusIssueOnMap(issue)}
                        className={`w-full text-left px-5 py-3.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:bg-[#EEF2FD] ${
                          active ? 'bg-[#EEF2FD]/85' : 'hover:bg-[#F4F3EF]/75'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs text-[#555B64] mb-1">
                          <span className="inline-flex items-center gap-1.5 font-semibold text-[#1F2227] truncate">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${vis.dotClass}`}
                              aria-hidden="true"
                            />
                            <span className="truncate">
                              {vis.shortLabel} · {issue.area_name}
                            </span>
                          </span>
                          <span className="font-mono font-medium text-[#4A5058] tabular-nums shrink-0">
                            {issue.status === 'Submitted' ? 'Pending' : issue.status}
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-[#1F2227] line-clamp-1">
                          {issue.title}
                        </div>
                        <div className="text-xs text-[#555B64] truncate mt-0.5">
                          {issue.locality}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )
      ) : (
        /* ===================================================================
           MODE B: SYNCHRONIZED READABLE LIST VIEW
        =================================================================== */
        <div className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="h-32 bg-white border border-[#DCDDD8] rounded-2xl animate-pulse"
                />
              ))}
            </div>
          ) : filteredIssues.length === 0 ? (
            <div className="bg-white border border-[#DCDDD8] rounded-2xl p-12 text-center space-y-3">
              <Search className="w-8 h-8 text-[#555B64] mx-auto" />
              <h3 className="text-base font-bold text-[#1F2227]">
                No Civic Issues Match Your Filters
              </h3>
              <p className="text-sm text-[#555B64] max-w-md mx-auto">
                Try clearing your search query or selecting All Mumbai Localities and All
                Categories.
              </p>
              <button
                type="button"
                onClick={resetAllFilters}
                className="px-4 py-2.5 text-sm font-semibold text-white bg-[#4169E1] hover:bg-[#3358CC] rounded-xl transition-colors cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredIssues.map((issue) => {
                const vis = CATEGORY_VISUALS[issue.category];
                const isSelected = selectedIssue?.id === issue.id;

                return (
                  <article
                    key={issue.id}
                    className={`bg-white rounded-2xl p-5 border transition-colors flex flex-col justify-between gap-4 ${
                      isSelected
                        ? 'border-[#4169E1] ring-1 ring-[#4169E1]/25'
                        : 'border-[#DCDDD8] hover:border-[#BFC2BA]'
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs text-[#555B64] min-w-0">
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${vis.dotClass}`}
                            aria-hidden="true"
                          />
                          <span className="font-mono font-bold text-[#1F2227] tabular-nums shrink-0">
                            {issue.reference_number}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate font-semibold text-[#1F2227]">
                            {vis.citizenLabel}
                          </span>
                        </div>
                        {renderStatusBadge(issue.status)}
                      </div>

                      <h3 className="text-base font-bold text-[#1F2227] leading-snug">
                        {issue.title}
                      </h3>

                      <p className="text-sm text-[#4A5058] leading-relaxed line-clamp-2">
                        {issue.description}
                      </p>
                    </div>

                    <div className="pt-3.5 border-t border-[#E3E4E0] space-y-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2 text-[#1F2227]">
                        <span className="inline-flex items-center gap-1.5 font-medium truncate">
                          <MapPin className="w-3.5 h-3.5 text-[#4169E1] shrink-0" />
                          <span className="truncate">{issue.locality}</span>
                        </span>
                        {renderPriorityText(issue.priority)}
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-1">
                        <div className="text-[#555B64] truncate">
                          <span>{issue.reporter_display_name}</span>
                          {issue.is_own_complaint && (
                            <span className="font-semibold text-[#3358CC]"> (You)</span>
                          )}
                          <span aria-hidden="true"> · </span>
                          <span className="tabular-nums">
                            {new Date(issue.created_at).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                          {issue.is_demo_record && (
                            <>
                              <span aria-hidden="true"> · </span>
                              <span className="font-medium text-[#4A5058]">Demo Data</span>
                            </>
                          )}
                        </div>

                        {hasValidCoordinates(issue) && (
                          <button
                            type="button"
                            onClick={() => focusIssueOnMap(issue)}
                            className="inline-flex items-center gap-1 font-semibold text-[#3358CC] hover:text-[#2343A8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] rounded cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            <span>Locate on Map</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
