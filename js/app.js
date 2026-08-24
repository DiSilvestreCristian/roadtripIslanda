// ============================================================
// APP
// ============================================================
const map = L.map("map", { zoomControl: true }).setView(MAP_INITIAL_CENTER, MAP_INITIAL_ZOOM);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

// Pane ordinati: routing < tappe < hotel / cluster POI.
map.createPane("routingPane").style.zIndex = 350;
map.createPane("tappePane").style.zIndex = 500;
map.createPane("poiPane").style.zIndex = 650;

const detailsContent = document.getElementById("details-content");
function showDetails(html) { detailsContent.innerHTML = html; }
function fieldRow(label, value) {
  if (value === undefined || value === null || value === "") return "";
  return `<div class="field"><span>${label}:</span> ${value}</div>`;
}

const poiLayers = {};
const poiPoints = {};
const tappeMarkers = [];
const tappeLayer = L.layerGroup({ pane: "tappePane" }).addTo(map);
let itineraryLine = null;
let tappeData = [];
let hotelPoints = [];
const hotelMarkers = [];
let tappeVisible = true;
const HOTEL_MATCH_DISTANCE_METERS = 200;

function haversineMeters(a, b) {
  const R = 6371000;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function hotelMatchesTappa(tappa) {
  return hotelPoints.some((hotel) => haversineMeters(tappa, hotel) <= HOTEL_MATCH_DISTANCE_METERS);
}

function makeTappaIcon(tappa, hotelMatch) {
  return L.divIcon({
    className: "stop-number",
    html: `<div class="badge${hotelMatch ? " hotel-match" : ""}">${tappa.tappa}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function updateHotelAndTappaState() {
  const hotelLayer = poiLayers.hotel;
  const hotelLayerActive = hotelPoints.length > 0 && !!hotelLayer && map.hasLayer(hotelLayer);

  // Se Hotel e Tappe sono entrambi attivi, nascondi solo gli hotel
  // che coincidono con una tappa: la posizione viene rappresentata
  // dal marker della tappa, che diventa blu.
  hotelMarkers.forEach(({ marker, point }) => {
    const matches = tappeData.some((tappa) => haversineMeters(point, tappa) <= HOTEL_MATCH_DISTANCE_METERS);
    if (hotelLayerActive && matches) {
      if (hotelLayer.hasLayer(marker)) hotelLayer.removeLayer(marker);
    } else if (hotelLayerActive) {
      if (!hotelLayer.hasLayer(marker)) hotelLayer.addLayer(marker);
    }
  });

  tappeMarkers.forEach(({ marker, tappa }) => {
    const matched = hotelLayerActive && hotelMatchesTappa(tappa);
    marker.setIcon(makeTappaIcon(tappa, matched));
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
      showDetails(`<span style="color:#ff8080">Errore nel calcolo del percorso stradale: ${err.message}</span>`);
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

      tappeData.forEach((tappa) => {
        const marker = L.marker([tappa.lat, tappa.lng], {
          pane: "tappePane",
          icon: makeTappaIcon(tappa, false),
        });
        marker.bindTooltip(`${tappa.tappa}. ${tappa.nome}`, { direction: "top" });
        marker.on("click", () => {
          showDetails(`
            <b>Tappa ${tappa.tappa} — ${tappa.nome}</b>
            ${fieldRow("Giorno", tappa.giorno)}
            ${fieldRow("Coordinate", `${tappa.lat.toFixed(4)}, ${tappa.lng.toFixed(4)}`)}
            ${fieldRow("Note", tappa.note)}
          `);
        });
        marker.addTo(tappeLayer);
        tappeMarkers.push({ marker, tappa });
      });

      const container = document.getElementById("days-list");
      container.innerHTML = `
        <label class="checkbox-item">
          <input type="checkbox" checked id="tappe-toggle" />
          <span class="color-dot" style="background:${TAPPE_SOURCE.color}"></span>
          Tappe
          <span class="count">${tappeData.length}</span>
        </label>`;
      document.getElementById("tappe-toggle").addEventListener("change", (e) => {
        tappeVisible = e.target.checked;
        if (tappeVisible) {
          map.addLayer(tappeLayer);
          if (itineraryLine) map.addLayer(itineraryLine);
        } else {
          map.removeLayer(tappeLayer);
          if (itineraryLine) map.removeLayer(itineraryLine);
        }
      });

      addRoutingLine(tappeData);
      updateHotelAndTappaState();
    })
    .catch((err) => {
      console.error(err);
      showDetails(`<span style="color:#ff8080">Errore caricando le tappe: ${err.message}</span>`);
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
  marker.on("click", () => {
    showDetails(`
      <b>${p.nome}</b>
      <div class="field"><span>Categoria:</span> ${source.label}</div>
      ${fieldRow("Coordinate", `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`)}
      ${fieldRow("Indirizzo", p.indirizzo)}
      ${fieldRow("Note", p.note)}
    `);
  });
  return marker;
}

function loadPoiSource(source) {
  return fetch(source.file)
    .then((r) => {
      if (!r.ok) throw new Error(`Impossibile leggere ${source.file}`);
      return r.json();
    })
    .then((points) => {
      poiPoints[source.id] = points;

      const layer = ["benzinai", "supermercati"].includes(source.id)
        ? L.markerClusterGroup({ pane: "poiPane", showCoverageOnHover: false, maxClusterRadius: 45 })
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
  const container = document.getElementById("poi-list");
  container.innerHTML = "";
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
