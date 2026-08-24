# Modifiche applicate

## 1. Numerazione marker
I marker delle tappe sono numerati usando il campo `tappa` di `data/tappe.json`, non più usando `giorno`.

Esempio: le tappe 3, 4, 5 e 6 dello stesso giorno mostrano rispettivamente 3, 4, 5 e 6.

## 2. Rimozione della spezzata Ring Road
È stata rimossa la `L.polyline(RING_ROAD_COORDS, ...)` presente in `js/app.js` e sono state eliminate le coordinate statiche `RING_ROAD_COORDS` da `js/config.js`.

La Ring Road non viene quindi più disegnata artificialmente sopra la mappa.

## 3. Percorso stradale reale tra le tappe
Il collegamento tra le tappe usa OSRM (OpenStreetMap Routing Machine):

- le coordinate vengono ordinate per `tappa`;
- vengono inviate a `https://router.project-osrm.org/route/v1/driving/...`;
- OSRM restituisce una geometria `GeoJSON` del percorso stradale;
- Leaflet la visualizza con `L.geoJSON()`.

Questa implementazione segue l'idea del README relativa alla sostituzione delle linee geometriche con un vero servizio/dato di routing.

### Nota
Il progetto ora dipende dal servizio pubblico OSRM per calcolare il percorso quando la pagina viene aperta. Se in futuro vuoi una versione completamente indipendente da servizi esterni, il passo successivo sarebbe generare e distribuire una geometria stradale locale oppure ospitare un motore di routing dedicato.
