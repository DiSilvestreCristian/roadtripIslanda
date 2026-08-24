// ============================================================
// APP
// ============================================================

const map = L.map("map", { zoomControl: true }).setView(MAP_INITIAL_CENTER, MAP_INITIAL_ZOOM);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

// ---- Ring Road ----
L.polyline(RING_ROAD_COORDS, {
  color: "#ffffff",
  weight: 4,
  opacity: 0.85,
  dashArray: "1,8",
  lineCap: "round",
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
// TAPPE (viaggio diviso per giorni)
// ============================================================

function loadTappe() {
  return fetch(TAPPE_SOURCE.file)
    .then((r) => {
      if (!r.ok) throw new Error(`Impossibile leggere ${TAPPE_SOURCE.file}`);
      return r.json();
    })
    .then((tappe) => {
      // Ordina per giorno per un tooltip/numerazione coerente
      tappe.sort((a, b) => a.giorno - b.giorno);

      tappe.forEach((tappa, idx) => {
        const giorno = tappa.giorno;
        if (!dayLayers[giorno]) dayLayers[giorno] = L.layerGroup();

        const marker = L.circleMarker([tappa.lat, tappa.lng], {
          radius: 9,
          color: "#fff",
          weight: 2,
          fillColor: TAPPE_SOURCE.color,
          fillOpacity: 1,
        });

        marker.bindTooltip(`${giorno}. ${tappa.nome}`, {
          permanent: false,
          direction: "top",
        });

        // Numero del giorno sempre visibile sopra il marker
        const label = L.marker([tappa.lat, tappa.lng], {
          icon: L.divIcon({
            className: "stop-label",
            html: `${giorno}`,
            iconSize: [20, 20],
            iconAnchor: [-8, 8],
          }),
          interactive: false,
        });

        marker.on("click", () => {
          showDetails(`
            <b>Giorno ${giorno} — ${tappa.nome}</b>
            ${fieldRow("Coordinate", `${tappa.lat.toFixed(4)}, ${tappa.lng.toFixed(4)}`)}
            ${fieldRow("Note", tappa.note)}
          `);
        });

        marker.addTo(dayLayers[giorno]);
        label.addTo(dayLayers[giorno]);
      });

      buildDaysSidebar(Object.keys(dayLayers).map(Number).sort((a, b) => a - b));
      Object.values(dayLayers).forEach((layer) => layer.addTo(map));
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
