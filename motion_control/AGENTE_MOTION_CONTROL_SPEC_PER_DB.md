# Agente Motion-Control — specifica funzionale per l'unificazione del database

Questo documento descrive cosa fa l'"agente motion-control" e di cosa ha
bisogno per lavorare, in modo che possa essere integrato nello stesso
database di un altro agente già esistente (un agente di assemblaggio video
hook+edit, con un proprio schema di produzione già in uso). Non contiene
schema SQL definitivo: è la specifica su cui progettare quello schema.

Chi legge questo file non ha visto la conversazione originale — tutto quello
che serve per capire l'agente è qui dentro.

---

## 1. Cosa fa l'agente, in una frase

Prende quattro asset di riferimento reali (una persona/modella, una posa, una
location, un video di movimento) e produce un video finale: una foto
composita che mette la persona nella location con quella posa, poi animata
seguendo la coreografia del video di riferimento (tecnica nota come "motion
transfer" o "motion control" / "puppeteer").

Obiettivo di fondo: dare a un content team la possibilità di generare
contenuto video con una persona reale (es. una modella sotto contratto) in
scenari e movimenti diversi, senza dover rifare uno shooting fisico ogni
volta.

---

## 2. Pipeline completa, passo per passo

### 2.1 Intake — quattro asset in ingresso, ciascuno con un ruolo fisso

Ogni esecuzione della pipeline parte da esattamente quattro riferimenti,
ciascuno con un ruolo che **non è intercambiabile** con gli altri (vedi
sezione 3 per il dettaglio):

| ruolo | cosa contiene |
|---|---|
| `model` | foto della persona reale — l'identità da preservare |
| `pose` | un'immagine di riferimento SOLO per posa/inquadratura corporea |
| `location` | foto dell'ambientazione/scenario |
| `motion_video` | un video breve — SOLO il movimento/coreografia da trasferire |

### 2.2 Step 1 — Composizione (immagine)

I tre riferimenti immagine (`model`, `pose`, `location`) vengono passati
insieme a un modello di generazione immagini multi-reference, con un prompt
che descrive: identità da bloccare (tratti fisici, capelli, pelle, eventuali
segni distintivi), la posa esatta (posizione di braccia/mani/gambe presa dal
riferimento `pose`), l'ambientazione (presa dal riferimento `location`),
oltre a camera, luce, palette colore.

Output: una o più **varianti** di una singola immagine composita
(tipicamente si generano 3-4 varianti per ogni run, non una sola — vedi 2.8
sul perché).

**Nota tecnica importante sulla scelta del modello**: non tutti i modelli di
composizione multi-reference accettano una foto di persona reale combinata
con altri riferimenti. Abbiamo verificato che almeno un modello (nano-banana,
via Higgsfield) rifiuta sistematicamente la foto `model` in *qualunque*
combinazione con altri riferimenti (funziona da sola, fallisce se abbinata a
`pose` o `location`) — è un guardrail di piattaforma sul trasferimento di
identità, non un problema di come è scritto il prompt. Un altro modello
(flux-pro/kontext/max/multi, via fal.ai) accetta la stessa combinazione senza
problemi. **Implicazione per il DB**: serve un modo per registrare quale
modello/provider ha funzionato per quale combinazione di asset, perché non è
garantito che tutti i modelli accettino tutte le combinazioni.

### 2.3 Step 1.5 — QA automatico sulla composita (obbligatorio)

Prima di procedere, ogni immagine generata va verificata automaticamente,
perché il processo è **rumoroso**: con alcuni prompt/modelli, una frazione
consistente delle immagini generate (nella nostra esperienza fino al 70-75%
dei tentativi con un certo stile di prompt) torna **completamente nera o
sottoesposta** — quindi tecnicamente "riuscita" come chiamata API, ma
inutilizzabile.

Controlli minimi da fare su ogni immagine prima di accettarla:
- non è un frame nero/vuoto (controllo di luminosità media)
- il volto è leggibile
- **busto/parte superiore del corpo chiaramente visibile e non tagliata** —
  è un requisito tecnico hard per lo step successivo: alcuni provider di
  motion-control (es. Kling) **rifiutano** l'immagine con un errore esplicito
  ("No complete upper body detected") se il soggetto è troppo piccolo nel
  frame o mal inquadrato. Questo va scoperto qui, non dopo aver già pagato
  per il motion transfer.

Le immagini che falliscono il QA vengono scartate (non consumano lo step
successivo); si tiene traccia comunque del tentativo per capacità di
diagnosi.

### 2.4 Step 2 — Selezione della variante

Tra le immagini che passano il QA, va scelta quella da usare per il passo
successivo. Nel processo attuale la scelta è umana (un content editor guarda
le varianti e sceglie), ma è ragionevole prevedere in futuro una selezione
automatica/euristica. **Implicazione per il DB**: serve tracciare *quale*
variante tra le N generate è stata scelta e (idealmente) perché.

### 2.5 Step 3 — Motion transfer (immagine → video)

L'immagine composita scelta più il `motion_video` di riferimento vengono
passati a un modello di motion-control/puppeteer (nella pipeline provata:
Kling v3 pro via fal.ai). Il modello anima l'immagine seguendo la
coreografia del video di riferimento.

Parametri rilevanti:
- **orientamento**: si può chiedere al modello di seguire il movimento del
  *corpo* nel video di riferimento (modalità tipica per questo caso d'uso)
  oppure il movimento della *camera* — sono modalità diverse, va scelta
  quella corretta per l'obiettivo.
- **durata**: i modelli di motion-control hanno un tetto massimo sulla
  durata del video di riferimento accettato (nella nostra esperienza intorno
  ai 30 secondi per Kling) — un video di riferimento più lungo va scartato o
  tagliato prima.
- il video di output non è detto che duri quanto il riferimento (nella
  nostra prova: riferimento 19s, output ~15s) — non c'è garanzia di durata
  1:1.

### 2.6 Step 4 — QA sul video finale

Come per l'immagine, va verificato il risultato prima di consegnarlo:
esposizione corretta durante tutta la clip (non solo nel primo frame),
soggetto riconoscibile, nessun problema di continuità. **Nota rilevante**:
il motion transfer copia il movimento del riferimento **letteralmente**,
senza filtrarlo — se il video sorgente contiene un gesto non desiderato
(es. qualcosa di inappropriato per il contesto commerciale), quel gesto
compare identico nel video finale. Va previsto un controllo/trim del
materiale sorgente *prima* di usarlo come `motion_video`, o un controllo
post-generazione che possa segnalarlo.

### 2.7 Step 5 — Consegna e archiviazione

Il video finale (e idealmente anche l'immagine composita intermedia) vanno
salvati in modo permanente nello storage aziendale — i provider esterni
(fal.ai, Higgsfield) restituiscono URL temporanei/esterni, non pensati come
archiviazione a lungo termine. Il DB deve registrare dove finisce ogni
output, non solo il fatto che è stato generato.

### 2.8 Perché il processo è stocastico, e cosa implica per il DB

Punto strutturale da tenere presente in fase di design: **una "run" della
pipeline non è un'operazione 1:1 (un input → un output)**. È normale che:
- lo stesso step venga tentato più volte prima di ottenere un risultato
  accettabile (vedi il tasso di frame neri sopra)
- lo stesso identico prompt, con le stesse immagini, dia risultati diversi
  (a volte accettati, a volte rifiutati da un content-filter) a chiamate
  successive — non è deterministico
- un errore di un provider possa essere temporaneo/di piano (es. un modello
  bloccato dietro un tier di abbonamento non ancora attivo) e non un
  problema strutturale

Lo schema dati deve modellare comodamente **N tentativi per step**, con lo
stato di ciascuno (in coda / in corso / completato / rifiutato / errore),
non assumere che ogni step produca esattamente un risultato.

---

## 3. I quattro tipi di asset — natura, uso corretto, metadati necessari

Principio comune a tutti e quattro: **ogni asset ha un ruolo fisso e gli
asset non sono intercambiabili tra loro**, anche quando sembrano
"simili" (es. `pose` e `motion_video` sono entrambi "riferimenti di
movimento/posizione del corpo", ma uno è un'immagine statica e l'altro un
video — e servono in step diversi della pipeline).

### 3.1 `model` — la persona reale

**Cosa è**: una o più foto della persona (es. una modella) la cui identità
deve comparire nel risultato finale. È l'unico asset la cui **identità va
preservata esattamente**.

**Metadati utili per classificarla/recuperarla**:
- descrizione fisica: tono della pelle, colore/lunghezza/stile dei capelli,
  corporatura, tratti del viso, segni distintivi (tatuaggi, nei, cicatrici)
- outfit associato (se l'asset include anche l'abbigliamento da preservare)
- eventuali note su diritti d'uso / consenso della persona ritratta — è un
  dato sensibile (immagine di una persona reale usata per generazione AI),
  vale la pena avere un campo esplicito tipo `usage_rights_confirmed` /
  `consent_on_file`, anche solo come promemoria operativo
- **flag di compatibilità provider**: quali modelli di generazione hanno
  rifiutato/accettato questo asset in combinazione con altri (vedi 2.2) — è
  informazione che si accumula nel tempo e vale la pena non perdere

**Attenzione**: non confondere con `pose` — un asset `model` non descrive
*come* la persona è messa in posa, solo *chi* è.

### 3.2 `pose` — riferimento di posa e inquadratura

**Cosa è**: un'immagine (spesso presa da altrove — social media, shooting di
terzi) che mostra **solo** una posizione del corpo e un'inquadratura da
replicare. **Non contribuisce mai all'identità** del soggetto finale — il
volto/corpo di chi compare in questa immagine non deve mai influenzare il
risultato.

**Metadati utili**:
- descrizione testuale della posa: posizione di braccia, mani, gambe,
  inclinazione del busto, direzione dello sguardo, distanza dalla camera
- provenienza/fonte (se presa da una piattaforma esterna, es. handle
  TikTok/Instagram di origine) — utile sia per tracciabilità che per
  eventuali questioni di attribuzione/diritti sull'uso come riferimento
- **nota esplicita nel prompt/documentazione**: "solo riferimento di
  posa/inquadratura, identità NON da questo asset" — è facile che chi scrive
  il prompt di generazione lo dia per scontato, ma è un'informazione che va
  portata nel DB in modo esplicito, non lasciata all'implicito

### 3.3 `location` — l'ambientazione

**Cosa è**: una foto dello scenario/ambiente in cui va collocato il
soggetto.

**Metadati utili**:
- descrizione dell'ambiente: tipo di luogo, materiali/colori dominanti,
  caratteristiche della luce presenti nella foto originale (è il campo più
  critico in pratica: prompt di luce poco dettagliati portano a immagini
  sottoesposte/nere nello step di composizione — vedi 2.3)
- eventuali elementi di profondità/prospettiva rilevanti per la resa in
  camera (es. corridoio con punto di fuga centrale, soffitto, elementi di
  contesto come specchi o strutture)
- se è un luogo reale fotografato o generato/di stock, e relative note su
  diritti d'uso

### 3.4 `motion_video` — il riferimento di movimento

**Cosa è**: un video breve che contiene **solo** la coreografia/il movimento
da trasferire al soggetto finale. Come per `pose`, **non contribuisce mai
all'identità** — chi compare nel video di riferimento è irrilevante, conta
solo come si muove.

**Metadati utili**:
- **durata** — campo critico: i modelli di motion-control hanno un tetto
  massimo (vedi 2.5); un video troppo lungo va segnalato/scartato prima di
  tentare la generazione, non dopo un errore a run già avviata
  - dimensioni, fps, formato/codec (consigliato normalizzare tutto a un
  formato coerente, es. mp4 h264/aac, prima di archiviare — evita sorprese
  di compatibilità con i provider)
- descrizione testuale del movimento/coreografia (utile per un futuro
  recupero semantico: "gesto tra i capelli", "ondeggio dei fianchi",
  "sequenza di balletto completa", ecc.)
- **flag di revisione contenuto**: se il video contiene movimenti/gesti non
  desiderati in un contesto commerciale (vedi 2.6) — idealmente un campo che
  indichi se il video è stato controllato/tagliato prima dell'uso, e da che
  timestamp a che timestamp è "sicuro" da usare

---

## 4. Metadati trasversali, utili per il recupero semantico (RAG)

Al di là dei campi specifici per tipo, ogni asset — di qualunque `kind` —
beneficia di questi campi comuni, pensati per permettere a un agente di
recuperarli in base a una richiesta in linguaggio naturale (non solo per
ID):

- una descrizione libera, scritta a mano o generata da un modello di
  visione, che cattura cosa mostra l'asset (in stile "vibe"/mood, non solo
  fattuale)
- tag/categorie per filtri rapidi (es. mood, ambientazione, stile)
- un punteggio di qualità/riuso (quanto è "pronto all'uso" — analogo al
  pattern già visto nell'altro agente, dove esiste un concetto simile per i
  contenuti hook/edit)
- data di creazione/importazione, e se disponibile la fonte originale

Nota di coerenza: l'altro agente (hook+edit) ha già un pattern maturo e
testato per questo tipo di libreria — asset con `kind` immutabile dopo
l'inserimento, deduplica per checksum, un flusso di staging→approvazione
prima che un file diventi un asset "pronto all'uso". Vale la pena valutare
di riusare lo stesso pattern per gli asset di questo agente invece di
reinventarne uno diverso, proprio perché l'obiettivo finale è un database
condiviso.

---

## 5. Cosa succede fuori dal DB — cosa serve comunque tracciare

Gli step di generazione (2.2 e 2.5) avvengono su servizi esterni (provider
di generazione AI). Il DB non contiene i modelli di AI, ma deve tracciare
abbastanza per ricostruire cosa è successo:

- quale provider/modello è stato usato per ogni step di ogni run
- un identificativo della richiesta lato provider (per poterla verificare/
  recuperare in caso di problemi)
- lo stato della richiesta (in coda, in corso, completata, fallita, con che
  errore)
- l'URL/riferimento esterno temporaneo restituito dal provider, **e**
  l'indicazione se/dove quel risultato è stato poi salvato in modo
  permanente nello storage interno (i due non coincidono — l'URL esterno
  scade, la copia interna no)
- l'esito del QA automatico per ogni tentativo (accettato/scartato, e
  perché)

---

## 6. Prima bozza di schema già esistente — punto di partenza, non vincolo

Durante l'esplorazione di questo agente è già stato provisionato, dal vivo,
un primo schema di prova (Postgres, su Supabase, isolato in uno schema
dedicato `motion_control` dentro un progetto esistente). Tre tabelle:

- `reference_assets` — un asset per riga: `kind` (model/pose/location/
  motion_video), filename, path nello storage, content_type, dimensioni,
  durata (per i video), checksum
- `runs` — una riga per esecuzione: quali quattro asset usati, prompt di
  composizione, stato
- `outputs` — un risultato per riga (immagine composita o video finale):
  a quale run appartiene, quale step (`composite_image` / `final_video`),
  provider usato, id della richiesta lato provider, dove è salvato
  internamente, esito QA

Questa è una prima approssimazione pensata per un test isolato, **non**
il disegno finale — non copre ancora, ad esempio, multi-tentativo esplicito
per step (attualmente un `run` assume implicitamente un solo tentativo per
asset), non condivide alcun pattern con lo schema dell'altro agente, e non
ha ancora i campi di metadati "trasversali" descritti alla sezione 4. Va
rivista/rifusa in fase di unificazione, non semplicemente incollata.

---

## 7. Vincoli tecnici noti, da rispettare nel design

- un `motion_video` più lungo del tetto massimo del provider di
  motion-control (~30s per Kling) non è utilizzabile as-is
- un'immagine composita con busto/parte superiore del corpo non chiaramente
  visibile viene rifiutata dal motion-control — è un requisito hard sulla
  *composizione*, non solo un criterio estetico
- non tutti i modelli di composizione accettano una foto di persona reale
  combinata con altri riferimenti — la combinazione di provider/modello che
  funziona per un dato asset `model` non è garantita valere per tutti i
  modelli, e va tracciata
- gli URL restituiti dai provider esterni sono temporanei — non vanno mai
  trattati come archiviazione permanente

---

## 8. Domande aperte per la progettazione del DB unificato

- Come rappresentare il concetto di "non intercambiabilità" tra `pose` e
  `motion_video` (entrambi riferimenti di movimento/posizione, ma uno
  immagine statica e uno video) in modo che un agente RAG non li confonda
  in fase di recupero?
- Conviene riusare il pattern esistente dell'altro agente (staging →
  approvazione → asset "pronto") anche per questi quattro `kind`, o merita
  un flusso diverso dato che qui gli asset sono meno numerosi e più
  "curati a mano" rispetto a una libreria di clip hook/edit?
- Come modellare il multi-tentativo per step (più immagini generate per
  run, alcune scartate dal QA) in modo pulito, senza dover duplicare l'intera
  riga di `run` per ogni tentativo?
- Vale la pena avere una tabella "combinazioni note funzionanti" (asset
  `model` X + provider Y = risultato accettabile) come cache/ottimizzazione,
  dato che il comportamento di alcuni provider su un dato asset è stabile
  nel tempo?
