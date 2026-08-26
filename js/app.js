// ============================================================
// APP
// ============================================================
const map = L.map("map", { zoomControl: false }).setView(MAP_INITIAL_CENTER, MAP_INITIAL_ZOOM);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

// Pane ordinati: routing < tappe < hotel / cluster POI < posizione utente.
map.createPane("routingPane").style.zIndex = 350;
map.createPane("tappePane").style.zIndex = 500;
map.createPane("poiPane").style.zIndex = 650;
map.createPane("userLocationPane").style.zIndex = 700;

function fieldRow(label, value) {
  if (value === undefined || value === null || value === "") return "";
  return `<div class="field"><span>${label}:</span> ${value}</div>`;
}

const poiLayers = {};
const poiPoints = {};
const tappeMarkers = []; // { marker, group }
const tappeLayer = L.layerGroup({ pane: "tappePane" }).addTo(map);
let itineraryLine = null;
let tappeData = [];
let hotelPoints = [];
const hotelMarkers = [];
let tappeVisible = true;
const HOTEL_MATCH_DISTANCE_METERS = 200;
const TAPPA_GROUP_DISTANCE_METERS = 50; // sotto questa distanza, due tappe sono considerate "lo stesso punto"

function haversineMeters(a, b) {
  const R = 6371000;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Trova l'hotel (oggetto completo, non solo booleano) che coincide con un punto,
// così possiamo riusarne nome/indirizzo/note nella descrizione di tappe coincidenti.
function findMatchingHotel(point) {
  return hotelPoints.find((hotel) => haversineMeters(point, hotel) <= HOTEL_MATCH_DISTANCE_METERS) || null;
}

// ============================================================
// RAGGRUPPAMENTO TAPPE COINCIDENTI
// (stesso hotel per più notti, oppure ritorno in un punto già visitato)
// ============================================================
function groupTappe(tappeSorted) {
  const groups = [];
  tappeSorted.forEach((tappa) => {
    const existing = groups.find((g) => haversineMeters(g, tappa) <= TAPPA_GROUP_DISTANCE_METERS);
    if (existing) {
      existing.tappe.push(tappa);
    } else {
      groups.push({ lat: tappa.lat, lng: tappa.lng, tappe: [tappa] });
    }
  });
  return groups;
}

function makeTappaIcon(group, hotelMatch) {
  const isMulti = group.tappe.length > 1;
  const label = group.tappe.map((t) => t.tappa).join("/");
  return L.divIcon({
    className: "stop-number",
    html: `<div class="badge${hotelMatch ? " hotel-match" : ""}${isMulti ? " multi" : ""}">${label}</div>`,
    iconSize: isMulti ? [36, 26] : [26, 26],
    iconAnchor: isMulti ? [18, 13] : [13, 13],
  });
}

function groupTooltipLabel(group, hotel) {
  const numbers = group.tappe.map((t) => t.tappa).join("/");
  if (hotel) return `${numbers}. ${hotel.nome}`;
  return group.tappe.map((t) => `${t.tappa}. ${t.nome}`).join(" / ");
}

// HTML del popup di un gruppo di tappe coincidenti: se il punto coincide
// con un hotel, la descrizione (nome/indirizzo/note) è quella dell'hotel.
function groupDetailsHtml(group) {
  const hotel = findMatchingHotel(group);
  const blocks = group.tappe.map((tappa) => `
    <div class="detail-block">
      <b>Tappa ${tappa.tappa} — ${hotel ? hotel.nome : tappa.nome}</b>
      ${fieldRow("Giorno", tappa.giorno)}
      ${hotel ? fieldRow("Indirizzo", hotel.indirizzo) : ""}
      ${fieldRow("Coordinate", `${tappa.lat.toFixed(4)}, ${tappa.lng.toFixed(4)}`)}
      ${fieldRow("Note tappa", tappa.note)}
      ${hotel ? fieldRow("Note hotel", hotel.note) : ""}
    </div>
  `);
  return blocks.join('<hr class="detail-sep" />');
}

function updateHotelAndTappaState() {
  const hotelLayer = poiLayers.hotel;
  const hotelLayerActive = hotelPoints.length > 0 && !!hotelLayer && map.hasLayer(hotelLayer);
  const tappeLayerActive = map.hasLayer(tappeLayer);
  const hotelAndTappeActive = hotelLayerActive && tappeLayerActive;

  // Se Hotel e Tappe sono entrambi attivi, nascondi solo gli hotel
  // che coincidono con una tappa: la posizione viene rappresentata
  // dal marker della tappa, che diventa blu.
  hotelMarkers.forEach(({ marker, point }) => {
    const matches = tappeData.some((tappa) => haversineMeters(point, tappa) <= HOTEL_MATCH_DISTANCE_METERS);
    if (hotelAndTappeActive && matches) {
      if (hotelLayer.hasLayer(marker)) hotelLayer.removeLayer(marker);
    } else if (hotelLayerActive) {
      if (!hotelLayer.hasLayer(marker)) hotelLayer.addLayer(marker);
    }
  });

  tappeMarkers.forEach(({ marker, group }) => {
    const matchedHotel = hotelAndTappeActive ? findMatchingHotel(group) : null;
    marker.setIcon(makeTappaIcon(group, !!matchedHotel));
    marker.setTooltipContent(groupTooltipLabel(group, matchedHotel));
  });
}

function addRoutingLine(tappe) {
  if (itineraryLine) map.removeLayer(itineraryLine);
  const coordinates = tappe.map((t) => `${t.lng},${t.lat}`).join(";");
  const url = `${ROUTING_SOURCE.baseUrl}/${coordinates}?overview=full&geometries=geojson&steps=false`;
  fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`OSRM HTTP ${r.status}`);
      return r.json();
    })
    .then((data) => {
      if (!data.routes || !data.routes.length) throw new Error("Nessun percorso stradale disponibile");
      itineraryLine = L.geoJSON(data.routes[0].geometry, {
        pane: "routingPane",
        style: { color: ROUTING_SOURCE.color, weight: 4, opacity: 0.85 }
      }).addTo(map);
      if (tappe.length) map.fitBounds(itineraryLine.getBounds(), { padding: [40, 40] });
    })
    .catch((err) => {
      console.error("Errore routing:", err);
    });
}

function loadTappe() {
  return fetch(TAPPE_SOURCE.file)
    .then((r) => {
      if (!r.ok) throw new Error(`Impossibile leggere ${TAPPE_SOURCE.file}`);
      return r.json();
    })
    .then((tappe) => {
      tappeData = tappe.slice().sort((a, b) => a.tappa - b.tappa);
      tappeMarkers.length = 0;
      tappeLayer.clearLayers();

      const groups = groupTappe(tappeData);

      groups.forEach((group) => {
        const marker = L.marker([group.lat, group.lng], {
          pane: "tappePane",
          icon: makeTappaIcon(group, false),
        });
        marker.bindTooltip(groupTooltipLabel(group, null), { direction: "top" });
        marker.bindPopup(groupDetailsHtml(group), { maxWidth: 300 });
        marker.addTo(tappeLayer);
        tappeMarkers.push({ marker, group });
      });

      const layersList = document.getElementById("layers-list");
      const tappeRow = document.createElement("label");
      tappeRow.className = "checkbox-item";
      tappeRow.innerHTML = `
        <input type="checkbox" checked id="tappe-toggle" />
        <span class="color-dot" style="background:${TAPPE_SOURCE.color}"></span>
        Tappe
        <span class="count">${tappeData.length}</span>
      `;
      layersList.appendChild(tappeRow);
      tappeRow.querySelector("input").addEventListener("change", (e) => {
        tappeVisible = e.target.checked;
        if (tappeVisible) {
          map.addLayer(tappeLayer);
          if (itineraryLine) map.addLayer(itineraryLine);
        } else {
          map.removeLayer(tappeLayer);
          if (itineraryLine) map.removeLayer(itineraryLine);
        }
        updateHotelAndTappaState();
      });

      addRoutingLine(tappeData);
      updateHotelAndTappaState();
    })
    .catch((err) => {
      console.error("Errore caricando le tappe:", err);
    });
}

function createPoiMarker(source, p) {
  const marker = L.circleMarker([p.lat, p.lng], {
    pane: "poiPane",
    radius: 6,
    color: "#0b1120",
    weight: 1,
    fillColor: source.color,
    fillOpacity: 0.95,
  });
  marker.bindTooltip(p.nome, { direction: "top" });
  marker.bindPopup(`
    <b>${p.nome}</b>
    <div class="field"><span>Categoria:</span> ${source.label}</div>
    ${fieldRow("Coordinate", `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`)}
    ${fieldRow("Indirizzo", p.indirizzo)}
    ${fieldRow("Note", p.note)}
  `);
  return marker;
}

// Icona di cluster colorata secondo il colore della categoria (source.color),
// invece dei colori di default (verde/giallo/arancio) di Leaflet.markercluster.
function makeClusterIconCreateFunction(color) {
  return function (cluster) {
    return L.divIcon({
      html: `<div class="cluster-icon" style="background:${color}">${cluster.getChildCount()}</div>`,
      className: "poi-cluster",
      iconSize: [36, 36],
    });
  };
}

function loadPoiSource(source) {
  return fetch(source.file)
    .then((r) => {
      if (!r.ok) throw new Error(`Impossibile leggere ${source.file}`);
      return r.json();
    })
    .then((points) => {
      poiPoints[source.id] = points;

      const layer = CLUSTERED_POI_IDS.includes(source.id)
        ? L.markerClusterGroup({
            pane: "poiPane",
            showCoverageOnHover: false,
            maxClusterRadius: 45,
            iconCreateFunction: makeClusterIconCreateFunction(source.color),
          })
        : L.layerGroup({ pane: "poiPane" });

      points.forEach((p) => {
        const marker = createPoiMarker(source, p);
        marker.addTo(layer);
        if (source.id === "hotel") hotelMarkers.push({ marker, point: p });
      });
      poiLayers[source.id] = layer;
      layer.addTo(map);

      if (source.id === "hotel") {
        hotelPoints = points;
        updateHotelAndTappaState();
      }
      return points.length;
    })
    .catch((err) => {
      console.error(err);
      poiPoints[source.id] = [];
      return 0;
    });
}

function buildPoiSidebar(counts) {
  const container = document.getElementById("layers-list");
  POI_SOURCES.forEach((source) => {
    const row = document.createElement("label");
    row.className = "checkbox-item";
    row.innerHTML = `
      <input type="checkbox" checked data-poi="${source.id}" />
      <span class="color-dot" style="background:${source.color}"></span>
      ${source.label}
      <span class="count">${counts[source.id] ?? 0}</span>
    `;
    row.querySelector("input").addEventListener("change", (e) => {
      const layer = poiLayers[source.id];
      if (!layer) return;
      if (e.target.checked) map.addLayer(layer); else map.removeLayer(layer);
      if (source.id === "hotel") updateHotelAndTappaState();
    });
    container.appendChild(row);
  });
}

Promise.all(POI_SOURCES.map((source) => loadPoiSource(source))).then((results) => {
  const counts = {};
  POI_SOURCES.forEach((source, idx) => (counts[source.id] = results[idx]));
  buildPoiSidebar(counts);
  updateHotelAndTappaState();
});
loadTappe();

// ============================================================
// SIDEBAR — menu hamburger apribile/richiudibile
// Il menu si chiude SOLO tramite il bottone "✕": cliccare sulla
// mappa (per selezionare un altro marker) non lo chiude più.
// ============================================================
const sidebarEl = document.getElementById("sidebar");
const sidebarToggleBtn = document.getElementById("sidebar-toggle");
const sidebarCloseBtn = document.getElementById("sidebar-close");
const sidebarOverlay = document.getElementById("sidebar-overlay");

function openSidebar() {
  sidebarEl.classList.add("open");
  sidebarOverlay.classList.add("visible");
  sidebarToggleBtn.classList.add("is-hidden");
}
function closeSidebar() {
  sidebarEl.classList.remove("open");
  sidebarOverlay.classList.remove("visible");
  sidebarToggleBtn.classList.remove("is-hidden");
}
function toggleSidebar() {
  if (sidebarEl.classList.contains("open")) closeSidebar(); else openSidebar();
}

sidebarToggleBtn.addEventListener("click", toggleSidebar);
sidebarCloseBtn.addEventListener("click", closeSidebar);

// Su desktop parte aperta, su smartphone parte chiusa per lasciare spazio alla mappa.
if (window.matchMedia("(min-width: 721px)").matches) {
  openSidebar();
}

// ============================================================
// POSIZIONE ATTUALE (geolocalizzazione)
// ============================================================
let userLocationMarker = null;
let userLocationWatchId = null;
let userLocationBtnEl = null;

const LocateControl = L.Control.extend({
  options: { position: "topright" },
  onAdd: function () {
    const btn = L.DomUtil.create("button", "locate-btn");
    btn.type = "button";
    btn.innerHTML = "📍";
    btn.title = "Mostra la mia posizione";
    L.DomEvent.disableClickPropagation(btn);
    L.DomEvent.on(btn, "click", toggleUserLocation);
    userLocationBtnEl = btn;
    return btn;
  },
});
map.addControl(new LocateControl());

function toggleUserLocation() {
  if (userLocationWatchId !== null) {
    stopUserLocation();
    return;
  }
  if (!navigator.geolocation) {
    alert("Geolocalizzazione non supportata dal browser.");
    return;
  }
  userLocationWatchId = navigator.geolocation.watchPosition(
    (pos) => updateUserLocation(pos),
    (err) => {
      console.error(err);
      alert(`Impossibile ottenere la posizione: ${err.message}`);
      stopUserLocation();
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
  );
  if (userLocationBtnEl) userLocationBtnEl.classList.add("active");
}

function updateUserLocation(pos) {
  const latlng = [pos.coords.latitude, pos.coords.longitude];
  if (!userLocationMarker) {
    userLocationMarker = L.marker(latlng, {
      pane: "userLocationPane",
      icon: L.divIcon({
        className: "user-location-marker",
        html: `<div class="user-location-dot"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
    }).addTo(map);
    userLocationMarker.bindTooltip("La tua posizione", { direction: "top" });
    map.setView(latlng, 12);
  } else {
    userLocationMarker.setLatLng(latlng);
  }
}

function stopUserLocation() {
  if (userLocationWatchId !== null) {
    navigator.geolocation.clearWatch(userLocationWatchId);
    userLocationWatchId = null;
  }
  if (userLocationMarker) {
    map.removeLayer(userLocationMarker);
    userLocationMarker = null;
  }
  if (userLocationBtnEl) userLocationBtnEl.classList.remove("active");
}
