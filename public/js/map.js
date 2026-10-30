// Leaflet map wrapper. Leaflet is loaded as a global (window.L) from /vendor/leaflet.
// Markers use shape and symbol as well as colour, so status is not colour-only.
// Pins that would overlap at the current zoom are merged into one numbered cluster
// pin. Pressing a cluster zooms in on it, and clusters split as you zoom.

import { el } from './dom.js';
import { icon, statusIconName } from './icons.js';
import { t } from './i18n.js';
import { formatNumber } from './format.js';

const DEFAULT_CENTER = [17.9689, 79.5941]; // Warangal
const DEFAULT_ZOOM = 12;
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';

// A pin is 36 x 44 pixels. Two pins conflict when they are closer than this in both directions,
// so grouping on this rule guarantees that visible pins never overlap.
const PIN_CLEARANCE_X = 40;
const PIN_CLEARANCE_Y = 48;
// From this zoom level every ATM is shown as its own pin
const CLUSTER_OFF_ZOOM = 16;

export function isMapAvailable() {
  return typeof window.L !== 'undefined';
}

// Groups ATMs whose pins would overlap on screen. Each group is drawn at the position of its
// first member (the anchor), and anchors are never closer than the pin size, so nothing overlaps.
// The selected ATM is always an anchor, so its own position and highlight are kept.
export function groupByScreenDistance(items, selectedId, clearanceX = PIN_CLEARANCE_X, clearanceY = PIN_CLEARANCE_Y) {
  const ordered = [...items].sort((a, b) => (b.id === selectedId) - (a.id === selectedId));
  const groups = [];

  for (const item of ordered) {
    const target = groups.find(
      (group) => Math.abs(group.x - item.x) < clearanceX && Math.abs(group.y - item.y) < clearanceY
    );
    if (target) target.members.push(item);
    else groups.push({ x: item.x, y: item.y, members: [item] });
  }
  return groups.map((g) => g.members);
}

export function createMap(container, { onSelect }) {
  const L = window.L;

  const map = L.map(container, {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    zoomControl: true,
    scrollWheelZoom: false,
    attributionControl: true,
  });

  L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUTION }).addTo(map);

  // Page scrolling should not be hijacked by the map. Wheel zoom is enabled only after the map is used.
  map.on('focus click', () => map.scrollWheelZoom.enable());
  map.on('blur', () => map.scrollWheelZoom.disable());
  container.addEventListener('mouseleave', () => map.scrollWheelZoom.disable());

  const markerLayer = L.layerGroup().addTo(map);
  const userLayer = L.layerGroup().addTo(map);
  let atms = [];
  let selectedId = null;
  let userLocation = null;

  function statusLabel(atm) {
    return `${atm.name}, ${t(`status.${atm.availability.status}`)}`;
  }

  function atmIcon(atm, selected) {
    const status = atm.availability.status;
    const body = el(
      'span',
      { class: `atm-marker atm-marker--${status.toLowerCase()}${selected ? ' is-selected' : ''}` },
      icon(statusIconName(status), 18)
    );
    return L.divIcon({ className: 'atm-marker-wrap', html: body, iconSize: [36, 44], iconAnchor: [18, 44] });
  }

  function clusterIcon(count, selected) {
    const body = el(
      'span',
      { class: `atm-marker atm-cluster${selected ? ' is-selected' : ''}` },
      el('span', { class: 'atm-cluster__count', text: formatNumber(count) })
    );
    return L.divIcon({ className: 'atm-marker-wrap', html: body, iconSize: [36, 44], iconAnchor: [18, 44] });
  }

  function labelElement(marker, text) {
    const node = marker.getElement();
    if (node) {
      node.setAttribute('aria-label', text);
      node.setAttribute('title', text);
    }
  }

  function setZoomLabels() {
    const zoomIn = container.querySelector('.leaflet-control-zoom-in');
    const zoomOut = container.querySelector('.leaflet-control-zoom-out');
    if (zoomIn) {
      zoomIn.setAttribute('title', t('map.zoomIn'));
      zoomIn.setAttribute('aria-label', t('map.zoomIn'));
    }
    if (zoomOut) {
      zoomOut.setAttribute('title', t('map.zoomOut'));
      zoomOut.setAttribute('aria-label', t('map.zoomOut'));
    }
  }

  function zoomInOn(members) {
    const points = members.map((m) => [m.atm.lat, m.atm.lng]);
    map.fitBounds(L.latLngBounds(points), { padding: [70, 70], maxZoom: CLUSTER_OFF_ZOOM });
  }

  // Rebuilds every pin for the current zoom level
  function draw() {
    markerLayer.clearLayers();

    const zoom = map.getZoom();
    const items = atms.map((atm) => {
      const point = map.latLngToContainerPoint([atm.lat, atm.lng]);
      return { id: atm.id, atm, x: point.x, y: point.y };
    });

    const groups = zoom >= CLUSTER_OFF_ZOOM ? items.map((item) => [item]) : groupByScreenDistance(items, selectedId);

    for (const members of groups) {
      if (members.length === 1) {
        const { atm } = members[0];
        const marker = L.marker([atm.lat, atm.lng], {
          icon: atmIcon(atm, atm.id === selectedId),
          keyboard: true,
          title: statusLabel(atm),
          riseOnHover: true,
        });
        marker.on('click', () => onSelect(atm.id));
        marker.addTo(markerLayer);
        labelElement(marker, statusLabel(atm));
      } else {
        const anchor = members[0].atm;
        const label = t('map.cluster', { count: members.length });
        const marker = L.marker([anchor.lat, anchor.lng], {
          icon: clusterIcon(members.length, members.some((m) => m.id === selectedId)),
          keyboard: true,
          title: label,
          riseOnHover: true,
        });
        marker.on('click', () => zoomInOn(members));
        marker.addTo(markerLayer);
        labelElement(marker, label);
      }
    }
  }

  function fit() {
    const points = atms.map((a) => [a.lat, a.lng]);
    if (userLocation) points.push([userLocation.lat, userLocation.lng]);
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], atms.length === 0 ? 13 : 15);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 15 });
  }

  // Pins depend on the zoom level, so they are rebuilt whenever it changes
  map.on('zoomend', draw);
  setZoomLabels();

  return {
    setAtms(nextAtms, { fitBounds = false } = {}) {
      atms = nextAtms;
      draw();
      if (fitBounds) fit();
      setZoomLabels();
    },

    // zoomTo: used when an ATM is chosen from the list, so it appears as its own pin
    select(id, { zoomTo = false } = {}) {
      selectedId = id;
      const atm = atms.find((a) => a.id === id);

      if (atm && zoomTo && map.getZoom() < CLUSTER_OFF_ZOOM) {
        map.setView([atm.lat, atm.lng], CLUSTER_OFF_ZOOM);
        draw();
        return;
      }

      draw();
      if (atm && !map.getBounds().contains([atm.lat, atm.lng])) {
        map.panTo([atm.lat, atm.lng]);
      }
    },

    clearSelection() {
      this.select(null);
    },

    setUserLocation(lat, lng, accuracy) {
      userLayer.clearLayers();
      userLocation = { lat, lng };
      L.circleMarker([lat, lng], {
        radius: 8,
        className: 'user-location-dot',
        interactive: false,
      }).addTo(userLayer);
      if (Number.isFinite(accuracy) && accuracy > 0 && accuracy < 5000) {
        L.circle([lat, lng], {
          radius: accuracy,
          className: 'user-location-accuracy',
          interactive: false,
        }).addTo(userLayer);
      }
    },

    clearUserLocation() {
      userLayer.clearLayers();
      userLocation = null;
    },

    fit,
    refreshLabels() {
      setZoomLabels();
      draw();
    },
    invalidateSize: () => map.invalidateSize(),
  };
}
