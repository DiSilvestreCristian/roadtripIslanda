// ============================================================
// APP
// ============================================================

const map = L.map("map", { zoomControl: true }).setView(MAP_INITIAL_CENTER, MAP_INITIAL_ZOOM);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const detailsContent = document.getElementById("details-content");

function showDetails(html) {
  detailsContent.innerHTML = html;
}

function fieldRow(label, value) {
  if (value === undefined || value === null || value === "") return "";
  return `<div class="field"><span>${label}:</span> ${value}</div>`;
}

// ---- Stato filtri ----
const dayLayers = {};   // giorno -> L.LayerGroup
const poiLayers = {};   // sourceId -> L.LayerGroup

// ============================================================
// PERCORSO STRADALE
// ============================================================
// OSRM riceve le coordinate nell'ordine delle tappe e restituisce
// la geometria reale delle strade percorse tra un waypoint e l'altro.
function loadRoadRoute(tappe) {
  if (tappe.length < 2) return Promise.resolve(null);

  const coordinates = tappe
    .map((t) => `${t.lng},${t.lat}`)
    .join(";");

  const url = `${ROUTING_API}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&alternatives=false`;

  return fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`Routing HTTP ${r.status}`);
      return r.json();
    })
    .then((data) => {
      if (data.code !== "Ok" || !data.routes?.length) {
        throw new Error(data.message || data.code || "Percorso non disponibile");
      }

      const route = L.geoJSON(data.routes[0].geometry, {
        style: {
          color: TAPPE_SOURCE.color,
          weight: 4,
          opacity: 0.9,
          lineCap: "round",
          lineJoin: "round",
        },
      });

      route.addTo(map);
      return route;
    })
    .catch((err) => {
      console.error("Errore caricando il percorso stradale:", err);
      showDetails(`<span style="color:#ff8080">Impossibile caricare il percorso stradale: ${err.message}</span>`);
      return null;
    });
}

// ============================================================
// TAPPE
// ============================================================
function loadTappe() {
  return fetch(TAPPE_SOURCE.file)
    .then((r) => {
      if (!r.ok) throw new Error(`Impossibile leggere ${TAPPE_SOURCE.file}`);
      return r.json();
    })
    .then((tappe) => {
      // Ordine e numerazione del viaggio basati sul campo "tappa".
      tappe.sort((a, b) => a.tappa - b.tappa);

      // Disegna il percorso sulle strade reali nell'ordine delle tappe.
      loadRoadRoute(tappe);

      tappe.forEach((tappa) => {
        const giorno = tappa.giorno;
        const numeroTappa = tappa.tappa;

        if (!dayLayers[giorno]) dayLayers[giorno] = L.layerGroup();

        // Marker = badge numerato con la tappa, cliccabile.
        const marker = L.marker([tappa.lat, tappa.lng], {
          icon: L.divIcon({
            className: "stop-number",
            html: `<div class="badge">${numeroTappa}</div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          }),
        });

        marker.bindTooltip(`${numeroTappa}. ${tappa.nome}`, { direction: "top" });
        marker.on("click", () => {
          showDetails(`
            <b>Tappa ${numeroTappa} — ${tappa.nome}</b>
            ${fieldRow("Giorno", giorno)}
            ${fieldRow("Coordinate", `${tappa.lat.toFixed(4)}, ${tappa.lng.toFixed(4)}`)}
            ${fieldRow("Note", tappa.note)}
          `);
        });

        marker.addTo(dayLayers[giorno]);
      });

      buildDaysSidebar(Object.keys(dayLayers).map(Number).sort((a, b) => a - b));
      Object.values(dayLayers).forEach((layer) => layer.addTo(map));

      // Adatta la vista iniziale a tutte le tappe.
      if (tappe.length) {
        const bounds = L.latLngBounds(tappe.map((t) => [t.lat, t.lng]));
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    })
    .catch((err) => {
      console.error(err);
      showDetails(`<span style="color:#ff8080">Errore caricando le tappe: ${err.message}</span>`);
    });
}

function buildDaysSidebar(giorni) {
  const container = document.getElementById("days-list");
  container.innerHTML = "";
  giorni.forEach((giorno) => {
    const row = document.createElement("label");
    row.className = "checkbox-item";
    row.innerHTML = `
      <input type="checkbox" checked data-giorno="${giorno}" />
      <span class="color-dot" style="background:${TAPPE_SOURCE.color}"></span>
      Giorno ${giorno}
    `;
    row.querySelector("input").addEventListener("change", (e) => {
      const layer = dayLayers[giorno];
      if (!layer) return;
      e.target.checked ? map.addLayer(layer) : map.removeLayer(layer);
    });
    container.appendChild(row);
  });
}

// ============================================================
// PUNTI DI INTERESSE (uno o piu' file json, colore per file)
// ============================================================

function loadPoiSource(source) {
  return fetch(source.file)
    .then((r) => {
      if (!r.ok) throw new Error(`Impossibile leggere ${source.file}`);
      return r.json();
    })
    .then((points) => {
      const layer = L.layerGroup();
      points.forEach((p) => {
        const marker = L.circleMarker([p.lat, p.lng], {
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

        marker.addTo(layer);
      });

      poiLayers[source.id] = layer;
      layer.addTo(map);
      return points.length;
    })
    .catch((err) => {
      console.error(err);
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
      e.target.checked ? map.addLayer(layer) : map.removeLayer(layer);
    });
    container.appendChild(row);
  });
}

// ============================================================
// AVVIO
// ============================================================

Promise.all(POI_SOURCES.map((source) => loadPoiSource(source))).then((results) => {
  const counts = {};
  POI_SOURCES.forEach((source, idx) => (counts[source.id] = results[idx]));
  buildPoiSidebar(counts);
});

loadTappe();
