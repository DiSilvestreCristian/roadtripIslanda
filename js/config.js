// ============================================================
// CONFIGURAZIONE
// ============================================================
// Per aggiungere una nuova categoria di punti di interesse:
// 1. Crea un nuovo file json in /data (stesso formato degli altri, vedi es. hotel.json)
// 2. Aggiungi una riga qui sotto in POI_SOURCES con file, etichetta e colore
// Non serve toccare altro: la sidebar e i marker si generano da soli.
const POI_SOURCES = [
  { id: "hotel",        file: "data/hotel.json",        label: "Hotel",        color: "#5eb1ff" },
  { id: "benzinai",     file: "data/benzinai.json",     label: "Benzinai",     color: "#ffb454" },
  { id: "supermercati", file: "data/supermercati.json", label: "Supermercati", color: "#7ee787" },
];

const TAPPE_SOURCE = { file: "data/tappe.json", color: "#ff5e7d" };

// Vista iniziale della mappa (centro Islanda)
const MAP_INITIAL_CENTER = [64.9, -18.5];
const MAP_INITIAL_ZOOM = 6;

// Servizio di routing stradale. Le tappe vengono inviate nell'ordine
// del campo "tappa" e il servizio restituisce il percorso sulle strade.
const ROUTING_API = "https://router.project-osrm.org";
