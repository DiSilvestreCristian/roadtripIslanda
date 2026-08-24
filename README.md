# Road Trip Islanda

Mappa interattiva della Ring Road (Route 1) con tappe del viaggio divise per
giorno e punti di interesse (hotel, benzinai, supermercati, ...) caricati da
file JSON separati, ciascuno con un colore di marker dedicato.

## Struttura

```
index.html
css/style.css
js/config.js      <- elenco file POI + colori + coordinate ring road
js/app.js         <- logica: mappa, layer, filtri, popup dettagli
data/tappe.json
data/hotel.json
data/benzinai.json
data/supermercati.json
```

## Come eseguirlo in locale

`fetch()` dei file JSON non funziona aprendo `index.html` direttamente dal
filesystem (`file://`): serve un piccolo server HTTP locale.

```bash
cd iceland-roadtrip
python3 -m http.server 8000
# poi apri http://localhost:8000
```

In alternativa con Node: `npx serve .`

## Come pubblicarlo su GitHub Pages

1. Fai commit e push di tutti i file nel repo (root, non serve una cartella `docs/`
   a meno che tu non l'abbia già impostata così).
2. Su GitHub: Settings → Pages → Source → seleziona il branch (es. `main`) e la
   cartella `/root`.
3. Dopo un paio di minuti il sito è live su `https://<utente>.github.io/<repo>/`.

## Come aggiungere/modificare dati

- **Tappe del viaggio**: modifica `data/tappe.json`. Ogni oggetto ha
  `giorno`, `nome`, `lat`, `lng`, `note` (opzionale). La sidebar genera
  automaticamente un filtro per ogni giorno trovato.
- **Nuova categoria di punti di interesse** (es. ristoranti): crea
  `data/ristoranti.json` con lo stesso formato di `data/hotel.json`
  (`nome`, `lat`, `lng`, `indirizzo` opzionale, `note` opzionale), poi
  aggiungi una riga in `POI_SOURCES` dentro `js/config.js`:

  ```js
  { id: "ristoranti", file: "data/ristoranti.json", label: "Ristoranti", color: "#c084fc" }
  ```

  Non serve toccare altro codice: marker, colore e voce filtro in sidebar
  compaiono da soli.

## Nota sulla Ring Road

Il tracciato disegnato in `js/config.js` (`RING_ROAD_COORDS`) è una spezzata
approssimata passante per le città principali (Reykjavík, Selfoss, Vík,
Höfn, Egilsstaðir, Mývatn, Akureyri, Borgarnes...), non il tracciato
stradale esatto. È sufficiente come riferimento visivo ma non segue ogni
curva reale della strada.

## Prossimi passi consigliati

1. **Ring road precisa**: sostituire la spezzata approssimata con un vero
   GeoJSON della Route 1 (estraibile da OpenStreetMap tramite Overpass API,
   o da dataset pubblici tipo Natural Earth) e caricarlo con `fetch` +
   `L.geoJSON()` invece della `L.polyline` statica.
2. **Linea che collega le tappe in ordine**: disegnare una polyline che
   unisce i punti di `tappe.json` in ordine di giorno, per visualizzare il
   percorso effettivo pianificato (diverso dalla ring road generica).
3. **Clustering dei marker**: con molti benzinai/supermercati usare
   `Leaflet.markercluster` per evitare che la mappa diventi troppo affollata
   agli zoom bassi.
4. **Deep link**: salvare in URL (query string) i filtri attivi (giorni/POI)
   così puoi condividere una vista specifica.
5. **Modalità offline**: precaricare le tile con un service worker, utile
   in Islanda dove il segnale può mancare.
