# StrawBerry Research and Implementation

## Obiettivo della ricerca

Questo progetto studia il metodo StrawBerry per la sintesi automatica dei protocolli di comportamento dei servizi web. L'obiettivo e duplice:

- analizzare in modo sistematico l'approccio originale per servizi SOAP/WSDL
- definire e validare una variante per servizi REST basati su OpenAPI, con una pipeline concreta e ripetibile

L'idea di fondo e la stessa: partire dal contratto del servizio, estrarre dipendenze tra operazioni e usare tali dipendenze per sintetizzare un protocollo di invocazione realistico.

## Domande di ricerca

- Come inferire dipendenze tra operazioni REST quando i vincoli non sono espliciti nei messaggi?
- Quali euristiche sono robuste su OpenAPI (payload JSON, parametri path/query/header, auth)?
- Quanto il comportamento inferito per REST e comparabile con quello ottenibile da WSDL?
- Quali limitazioni emergono rispetto al metodo originale e quali estensioni sono necessarie?

## Metodo e workflow

Il workflow applicato in questo repository segue una variante semplificata della pipeline StrawBerry:

1. Ingest della specifica (WSDL per SOAP o OpenAPI per REST).
2. Normalizzazione e risoluzione dei riferimenti (es. $ref, composizioni schema).
3. Estrazione delle operazioni e dei loro input/output in una forma uniforme.
4. Sintesi delle dipendenze tra operazioni a partire dai campi compatibili.
5. Refinement dinamico delle dipendenze tramite esecuzioni reali.
6. Produzione di report e base informativa per la generazione del protocollo.

Per la variante REST, il focus attuale e sulle dipendenze con verifica runtime: la sintesi del protocollo vero e proprio e considerata un passo successivo.

## Risultati ottenuti

### StrawBerry-REST (prototipo)

Il prototipo in `strawberry-rest/` implementa le fasi iniziali della pipeline per REST:

- parsing di specifiche OpenAPI 3.1 (YAML/JSON)
- risoluzione di $ref e merge di allOf
- supporto a oneOf/anyOf con discriminatori quando presenti
- flattening dei payload JSON in una lista di campi uniformi
- estrazione delle operazioni con metadati (metodo, path, request/response, path/query/header/cookie params, auth)
- estrazione di dipendenze con euristiche migliorate e punteggio di confidenza
- refinement dinamico per verificare dipendenze su esecuzioni reali
- generazione di report in `output/dependencies.json` e `output/summary.md`

### Cosa prende in input e cosa produce (e perche)

Input principali:

- Specifica OpenAPI 3.1 (YAML/JSON): e la fonte di verita per operazioni, parametri e schemi.
- Base URL del servizio (solo per refinement): serve per eseguire il flusso reale e verificare le dipendenze.

Output principali:

- `strawberry-rest/output/<app>-<timestamp>/dependencies.json`: dataset completo di operazioni e dipendenze, con confidenza e stato di verifica.
- `strawberry-rest/output/<app>-<timestamp>/summary.md`: sintesi leggibile che mostra come le operazioni si collegano tra loro.

Scopo:

- Rendere esplicite le dipendenze operative tra endpoint REST (es. token, cartId, orderId).
- Fornire una base per la sintesi di un protocollo di invocazione o per test automatici.

### Demo end-to-end

Script di demo in root: `run-demo.sh`. Mostra l'intero flusso, dal parsing della spec alla verifica runtime.

```bash
./run-demo.sh
```

Passi eseguiti:

1. Build/type-check di `strawberry-rest` e `rest-mini-e-commerce`.
2. Analisi statica della specifica OpenAPI per inferire le dipendenze.
3. Avvio del servizio REST di esempio.
4. Refinement dinamico per verificare le dipendenze inferite.
5. Scrittura dei report in `strawberry-rest/output/<app>-<timestamp>/` dove `<app>` e il nome della cartella dell'app analizzata.

### Caso di studio REST

Il servizio `rest-mini-e-commerce/` fornisce un'API REST minima e ben documentata, pensata per esporre dipendenze reali:

- token da `/auth/login` usato nelle operazioni protette
- `cartId` da `/carts` usato per aggiungere item e creare ordini
- `orderId` da `/orders` usato per leggere lo stato dell'ordine

La specifica in `rest-mini-e-commerce/openapi.yaml` e il flusso in `rest-mini-e-commerce/docs/usage.md` permettono di verificare se le dipendenze estratte coincidono con quelle attese.

### Materiale di ricerca

La cartella `knowledge/` raccoglie note su contesto, formalizzazione e limiti del metodo. Serve da base teorica per confrontare SOAP e REST.

## Differenze principali: StrawBerry per SOAP vs REST

### Contratto e modello di servizio

- SOAP: WSDL descrive operazioni e messaggi con tipi XSD; il contratto e fortemente tipizzato e centrato su messaggi.
- REST: OpenAPI descrive endpoint e metodi HTTP; il contratto e centrato su risorse e payload JSON.

### Modellazione dei dati

- SOAP: i messaggi e le loro parti sono il nucleo dei dati osservabili.
- REST: i dati sono distribuiti tra body, parametri path/query/header e token di autenticazione.

### Espressivita dei vincoli

- SOAP: le dipendenze sono spesso esplicite nella struttura dei messaggi e nei tipi.
- REST: le dipendenze sono spesso implicite e richiedono inferenza basata su nomi, tipi e pattern.

### Semantica delle operazioni

- SOAP: operazioni orientate ai messaggi, meno legate a un modello di risorse.
- REST: operazioni legate a risorse e workflow (creazione, aggiornamento, lettura).

### Autenticazione e stato

- SOAP: spesso header e binding specifici.
- REST: token e header standard (es. Authorization) diventano una dipendenza trasversale.

### Output della pipeline

- SOAP: la sintesi del protocollo deriva dalla struttura WSDL e dai messaggi.
- REST: la sintesi deve partire da un set di dipendenze inferite tra operazioni.

## Limiti attuali della variante REST

- Supporto schemi migliorato: oneOf/anyOf e discriminatori sono coperti, ma non esiste ancora una strategia per conflitti semantici.
- Estrazione parametri completa per path/query/header/cookie, ma senza inferenza semantica avanzata.
- Euristiche migliorate ma ancora limitate (niente sinonimi o mapping manuale).
- Risposte: viene considerata solo la prima 2xx disponibile.
- Refinement dinamico: usa un flusso fisso di test, non generalizza a servizi REST arbitrari.

## Struttura del repository

- `strawberry-rest/`: prototipo per OpenAPI con estrazione dipendenze
- `rest-mini-e-commerce/`: servizio REST di riferimento e spec OpenAPI
- `knowledge/`: note e materiale di ricerca

## Esecuzione del prototipo (REST)

```bash
cd strawberry-rest
npm install
npm run analyze -- --spec ../rest-mini-e-commerce/openapi.yaml
```

Refinement dinamico (richiede il server del caso di studio in esecuzione):

```bash
cd rest-mini-e-commerce
npm install
npm run dev
```

```bash
cd strawberry-rest
npm run refine -- --spec ../rest-mini-e-commerce/openapi.yaml --base http://localhost:3000
```

## App di riferimento aggiuntiva

E stata importata l'app Swagger Petstore in `third-party/` per testare StrawBerry-REST su una specifica esterna:

- Repo originale: https://github.com/swagger-api/swagger-petstore
- Spec locale: `third-party/src/main/resources/openapi.yaml`
