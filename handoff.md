# Handoff — motion-control pipeline (fal.ai + Higgsfield + Supabase)

conversation_type: { primary: coding, secondary: planning, confidence: 0.9 }

## Coverage
Copertura completa della conversazione, nessuna lacuna nota.

## Obiettivo attuale
Portare in produzione una pipeline che, guidata da un futuro agente RAG,
prenda i media reali di un'azienda (foto modella, posa, location, video di
riferimento del movimento) da uno storage aziendale, li mandi a Higgsfield
per generare un video (composizione + motion transfer), e riporti il
risultato nello storage/DB aziendale.

## Stato attuale — tre binari, tre stati diversi

**1. Video via fal.ai — FATTO.** Un video reale è stato generato e consegnato
(modella + location composite, motion transfer dal video di riferimento vero,
~15s 9:16). Esiste **solo** come URL temporaneo fal.media, non salvato in modo
durevole da questa sessione — vedi Blocco 3 sotto.

**2. Higgsfield MCP diretto da questa chat — STRUTTURALMENTE BLOCCATO.**
Nessun tool di upload media in questa sessione MCP; il campo `medias` rifiuta
URL https. Provato a fondo (vedi snapshot per il dettaglio), confermato non
aggirabile da qui. L'unica via è l'API REST reale di Higgsfield, trovata
leggendo il codice sorgente dell'SDK ufficiale (non c'è stato bisogno di
indovinare: contratto REST completo recuperato e verificato).

**3. Pipeline Supabase per l'agente RAG — PROGETTATA E PROVISIONATA DAL VIVO,
MAI ESEGUITA END-TO-END.** Schema Postgres isolato `motion_control` +
bucket privato `motion-control` dentro il progetto Supabase esistente
`vsl-media` (org "Studio Time", id `hyprpkvdswdruhkffhru`). Vincoli DB
testati dal vivo (CHECK su `kind`, foreign key `reference_assets → runs →
outputs`) — funzionano. Lo script end-to-end (`motion_control/test_pipeline_e2e.py`)
è scritto e committato, ma **mai lanciato**: sia `platform.higgsfield.ai` sia
`*.supabase.co` sono bloccati dal proxy di rete di *questa* sandbox
specifica (verificato con curl, non un'ipotesi) — non un problema di
Higgsfield o Supabase.

## Decisioni chiave (versione rapida — dettaglio completo nello snapshot)
- **nano-banana → flux-pro/kontext/max/multi**: nano-banana rifiuta la foto
  della modella in ogni combinazione multi-immagine (funziona da sola, fallisce
  con posa/location) — guardrail sull'identità, non un problema di prompt.
  Confermato con bisection controllata; non si è aggirato riscrivendo il
  prompt, sarebbe stato filter evasion.
- **Mai la service_role key di Supabase in chat**: usate invece policy RLS
  scoperte solo al bucket/schema `motion_control`, applicate alla chiave
  pubblica (sicura da esporre). Stessa cautela già applicata alla chiave
  fal.ai (usata una volta, richiesta rotazione).
- **Schema isolato dentro `vsl-media`, non un nuovo progetto Supabase**: il
  limite di 2 progetti gratuiti dell'org era esaurito, e l'utente ha
  confermato che questo progetto ospiterà entrambi gli agenti (hook+edit +
  motion-control) a lungo termine. `public` verificato intatto prima e dopo.
- **Browser automation (suggerita da un amico sviluppatore dell'utente) —
  sconsigliata**: una volta trovata l'API REST/SDK ufficiale, l'automazione
  browser è più fragile, non risolve comunque il problema di rete, rischio
  ToS maggiore, osservabilità peggiore.

## Blocchi aperti
1. **Application-id Higgsfield per il motion-control non confermato** — nello
   script è un placeholder (`"application-id-da-confermare"`). Va verificato
   nel catalogo app di `cloud.higgsfield.ai`, irraggiungibile da questa
   sandbox.
2. **`test_pipeline_e2e.py` mai eseguito** — serve un ambiente con accesso
   rete reale a `platform.higgsfield.ai` e `*.supabase.co`, più credenziali
   Higgsfield vere.
3. **Il video fal.ai consegnato non è salvato in modo durevole** — solo un
   URL temporaneo passato in chat. Se non già scaricato, va recuperato prima
   che scada.

## Percorsi abbandonati, utili da sapere
- Higgsfield MCP diretto per media reali: non aggirabile da questa sessione,
  non riprovare senza un cambio di connettore/ambiente.
- nano-banana per la composita con foto reali multi-riferimento: guardrail
  di piattaforma, non un problema di prompt — non insistere lì.
- Nuovo progetto Supabase dedicato: bloccato da limite piano, e comunque non
  allineato al piano dell'utente di condividere `vsl-media` tra i due agenti.

## Prossime azioni immediate
1. Scaricare/salvare il video fal.ai consegnato (URL nello snapshot).
2. Confermare l'application-id Higgsfield corretto dal catalogo app.
3. Lanciare `motion_control/test_pipeline_e2e.py` da un ambiente con rete
   vera e credenziali Higgsfield reali.
4. Riportare cosa si rompe — probabile prossimo passo dopo un run pulito:
   estendere il test dal singolo asset al flusso completo a 4 asset
   (modella + posa + location + video movimento) e fissare il prompt di
   composizione definitivo (`fal_pipeline.py`'s `COMPOSE_PROMPT_A` è il punto
   di partenza più solido già pronto).

## Rischi e implicazioni future
- **Qualunque ambiente ospiterà l'agente di produzione deve raggiungere sia
  `platform.higgsfield.ai` sia `*.supabase.co` in uscita** — verificarlo
  esplicitamente prima di scegliere dove farlo girare, altrimenti la pipeline
  è morta all'arrivo, come è successo in questa sandbox.
- Le policy RLS sulla chiave anon sono un modello di accesso provvisorio —
  da rivedere prima di traffico di produzione reale (deciderne la
  permanenza vs una service_role key gestita in un secrets manager).

## Artifact Index
La lista completa e canonica dei deliverable, con posizione e stato, è nello
snapshot di memoria — non ripetuta qui. Solo le cose da recuperare **subito**
per continuare:

### Video finale fal.ai (mp4)
- what: composita modella+location, motion transfer dal video di riferimento reale
- context: prodotto in questa sessione, unica copia esistente
- why passing it: rischio di perdita se l'URL scade
- next chat should: dire all'utente di scaricarlo se non già fatto
- retrieve: `https://v3b.fal.media/files/b/0aa5fe70/xeYLm4Jyl71pBeiYv9aWz_output.mp4` (URL temporaneo esterno, non nel repo)

### motion_control/test_pipeline_e2e.py
- what: script E2E pronto (Supabase storage/DB -> Higgsfield -> Supabase)
- context: scritto e committato questa sessione, mai eseguito
- why passing it: è il prossimo passo concreto del progetto
- next chat should: continuare a lavorarci (riempire application-id, poi far girare, poi debuggare)
- retrieve: già nel repo, branch `claude/new-session-gsrnum`

Per tutto il resto (fal_pipeline.py, run.sh, README.md, bisect_prompt.py, lo
schema/bucket Supabase), vedi la sezione **Deliverables** dello snapshot
puntato sotto — sono già nel repo o già live su Supabase, nulla da recuperare
a parte.

## Memory pointer
`MEMORY/INDEX.md` → riga unica al momento → apri
`MEMORY/2026-08-18_artistai-hub-test_motion-control-pipeline.md` per il
contesto persistente completo (decision logics classificate, gotcha, tutto
il contratto REST Higgsfield ricostruito dal codice sorgente).

---

# Preservation Notes
- Compressed: il dettaglio turno-per-turno delle diagnosi (bisection su
  nano-banana, tentativi falliti di nomi modello Higgsfield, i vari giri di
  debug del polling fal.ai) — significato preservato nelle Decisioni chiave
  e nello snapshot, non nei dettagli di processo.
- Verbatim: il contratto REST Higgsfield (endpoint, header, flusso upload)
  è riportato identico a come estratto dal codice sorgente, non parafrasato.
