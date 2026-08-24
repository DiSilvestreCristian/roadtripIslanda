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

// Ring Road (Route 1) approssimata attraverso le città principali che attraversa.
// NB: è una spezzata semplificata (non il tracciato stradale esatto). Vedi il
// suggerimento "Ring Road precisa" nelle estensioni per sostituirla con un
// GeoJSON ufficiale (es. estratto da OpenStreetMap / Natural Earth).
const RING_ROAD_COORDS = [
  [64.1466, -21.9426], // Reykjavík
  [63.9333, -21.0333], // Hveragerði
  [63.9333, -20.9833], // Selfoss
  [63.8333, -20.4167], // Hella
  [63.5333, -19.9500], // Vík í Mýrdal
  [63.7912, -18.0530], // Kirkjubæjarklaustur
  [64.0700, -16.5800], // Jökulsárlón
  [64.2539, -15.2082], // Höfn
  [64.6547, -14.2894], // Djúpivogur
  [64.7961, -13.9749], // Breiðdalsvík
  [65.2833, -14.4000], // Egilsstaðir
  [65.6297, -14.3306], // Egilsstaðir -> nord
  [65.6560, -16.6510], // Mývatn
  [65.6885, -18.1262], // Akureyri
  [65.4406, -19.1500], // Varmahlíð
  [65.6595, -20.2967], // Blönduós
  [64.9319, -21.2842], // Borgarnes
  [64.1466, -21.9426], // ritorno a Reykjavík
];
