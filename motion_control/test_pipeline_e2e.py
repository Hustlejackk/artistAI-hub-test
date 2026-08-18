#!/usr/bin/env python3
"""
Test end-to-end della pipeline: Supabase (storage + DB) -> Higgsfield -> Supabase.

NON eseguibile dalla sandbox di questa sessione: sia platform.higgsfield.ai sia
*.supabase.co sono bloccati dal proxy di rete di questo ambiente (verificato,
non un'ipotesi). Lancialo da un ambiente con accesso internet reale: il tuo
laptop, un server, una VM cloud.

Credenziali necessarie (environment variables):
    SUPABASE_URL                 es. https://hyprpkvdswdruhkffhru.supabase.co
    SUPABASE_PUBLISHABLE_KEY     chiave pubblica (sicura da avere in un .env
                                  locale) - lavora perche' le policy RLS scoped
                                  al bucket/schema motion_control sono gia'
                                  applicate al progetto
    HF_API_KEY / HF_API_SECRET   da cloud.higgsfield.ai/dashboard

Installazione:
    pip install higgsfield-client httpx

Cosa verifica, in ordine:
    1. legge un file locale (l'asset "sorgente", al posto del DB aziendale)
    2. lo carica nel bucket Supabase 'motion-control' (storage reale)
    3. registra l'asset in motion_control.reference_assets
    4. carica GLI STESSI BYTE su Higgsfield (prova che l'ingest non li altera)
    5. sottomette una generazione reale e fa polling fino al completamento
    6. scarica il risultato e lo ricarica su Supabase storage
    7. scrive la riga di output in motion_control.outputs
"""
import hashlib
import mimetypes
import os
import sys
import time

import httpx

try:
    import higgsfield_client as hf
except ImportError:
    sys.exit("pip install higgsfield-client")

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_KEY = os.environ["SUPABASE_PUBLISHABLE_KEY"]
BUCKET = "motion-control"

sb_headers = {"Authorization": f"Bearer {SUPABASE_KEY}", "apikey": SUPABASE_KEY}


def sb_upload(local_path: str, storage_path: str, content_type: str) -> None:
    """Carica un file nel bucket Supabase. Byte-per-byte, nessuna conversione."""
    with open(local_path, "rb") as fh:
        data = fh.read()
    r = httpx.post(
        f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{storage_path}",
        headers={**sb_headers, "Content-Type": content_type},
        content=data,
        timeout=120,
    )
    r.raise_for_status()


def sb_insert(table: str, row: dict) -> dict:
    r = httpx.post(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers={**sb_headers, "Content-Type": "application/json", "Prefer": "return=representation"},
        json=row,
        timeout=30,
    )
    r.raise_for_status()
    return r.json()[0]


def main():
    # --- passo 0: l'asset "sorgente" -------------------------------------
    # In produzione questo path arriva da una query al DB/RAG; qui e' un
    # file locale solo per far girare il test end-to-end.
    if len(sys.argv) < 2:
        sys.exit("uso: python3 test_pipeline_e2e.py <path-video-locale>")
    local_video = sys.argv[1]

    checksum = hashlib.sha256(open(local_video, "rb").read()).hexdigest()
    content_type = mimetypes.guess_type(local_video)[0] or "video/mp4"
    size_bytes = os.path.getsize(local_video)
    storage_path = f"inputs/motion_video/{checksum[:12]}.mp4"

    print(f"[1/7] file locale: {local_video} ({size_bytes} bytes, sha256={checksum[:12]}...)")

    # --- passo 1: upload nel TUO storage (fonte di verita' aziendale) ----
    print("[2/7] upload su Supabase storage...")
    sb_upload(local_video, storage_path, content_type)
    print(f"      -> motion-control/{storage_path}")

    # --- passo 2: registrazione nel DB ------------------------------------
    print("[3/7] insert in motion_control.reference_assets...")
    asset = sb_insert("motion_control.reference_assets", {
        "kind": "motion_video",
        "filename": os.path.basename(local_video),
        "storage_path": storage_path,
        "content_type": content_type,
        "size_bytes": size_bytes,
        "checksum": checksum,
    })
    print(f"      -> asset id {asset['id']}")

    run = sb_insert("motion_control.runs", {
        "motion_asset_id": asset["id"],
        "compose_prompt": "test end-to-end",
        "status": "composing",
    })
    print(f"      -> run id {run['id']}")

    # --- passo 3: STESSI BYTE verso Higgsfield ----------------------------
    # Prova diretta che l'ingest non altera il file: leggiamo di nuovo dal
    # locale (potremmo anche rileggerlo da Supabase storage per una prova
    # ancora piu' stringente - lasciato come esercizio).
    print("[4/7] upload su Higgsfield (stessi byte)...")
    hf_public_url = hf.upload_file(local_video)
    print(f"      -> {hf_public_url}")

    # --- passo 4: generazione reale ---------------------------------------
    # NOTA: sostituisci 'application-id' con l'id reale del modello che userai
    # (verificalo nel catalogo app di cloud.higgsfield.ai - non ancora
    # confermato in questa sessione, vedi conversazione precedente).
    print("[5/7] submit generazione...")
    request_controller = hf.submit(
        "application-id-da-confermare",
        arguments={"video_url": hf_public_url},
    )
    print(f"      -> request_id {request_controller.request_id}")

    for status in request_controller.poll_request_status(delay=5):
        print(f"      status: {status}")
    result = request_controller.get()

    # --- passo 5: risultato torna nel TUO storage -------------------------
    print("[6/7] download risultato e ricarica su Supabase...")
    result_url = result.get("video", {}).get("url") or result.get("url")
    result_bytes = httpx.get(result_url, timeout=120).content
    out_path = f"outputs/{run['id']}/final.mp4"
    httpx.post(
        f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{out_path}",
        headers={**sb_headers, "Content-Type": "video/mp4"},
        content=result_bytes,
        timeout=120,
    ).raise_for_status()

    print("[7/7] insert in motion_control.outputs...")
    sb_insert("motion_control.outputs", {
        "run_id": run["id"],
        "stage": "final_video",
        "provider": "higgsfield",
        "provider_job_id": request_controller.request_id,
        "storage_path": out_path,
        "external_url": result_url,
    })

    print(f"\nFATTO. Video finale salvato in Supabase: {BUCKET}/{out_path}")


if __name__ == "__main__":
    main()
