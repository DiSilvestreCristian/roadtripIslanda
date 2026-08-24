// ============================================================
// CONFIGURAZIONE
// ============================================================
const POI_SOURCES = [
  { id: "hotel",        file: "data/hotel.json",        label: "Hotel",        color: "#5eb1ff" },
  { id: "benzinai",     file: "data/benzinai.json",     label: "Benzinai",     color: "#ffb454" },
  { id: "supermercati", file: "data/supermercati.json", label: "Supermercati", color: "#7ee787" },
];
const TAPPE_SOURCE = { file: "data/tappe.json", color: "#ff5e7d" };
const MAP_INITIAL_CENTER = [64.9, -18.5];
const MAP_INITIAL_ZOOM = 6;
const ROUTING_SOURCE = {
  baseUrl: "https://router.project-osrm.org/route/v1/driving",
  color: "#f1f5f9"
};
