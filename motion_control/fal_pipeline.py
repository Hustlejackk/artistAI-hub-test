#!/usr/bin/env python3
"""
Motion Control pipeline (fal.ai direct HTTP).

Bypasses the Higgsfield MCP connector, which in these sessions exposes only
generate_image_batch / generate_video_batch and no media-upload tools.

Stages
  check    verify network reachability + FAL_KEY validity
  upload   push a local asset to fal storage, print the resulting URL
  compose  build the composite still (identity + pose + location lock)
  motion   transfer motion from a reference video onto the composite still

All HTTP goes through curl: the sandbox routes outbound traffic via an agent
proxy with a custom CA bundle, and curl already trusts it.
"""

import argparse
import base64
import json
import mimetypes
import os
import subprocess
import sys
import time

QUEUE = "https://queue.fal.run"
SYNC = "https://fal.run"

COMPOSE_MODEL = "fal-ai/nano-banana/edit"
MOTION_MODEL = "fal-ai/kling-video/v3/pro/motion-control"
MOTION_MODEL_FALLBACK = "fal-ai/kling-video/v2.6/pro/motion-control"

# Hosts confirmed reachable from this environment. fal.media, v3.fal.media and
# rest.alpha.fal.ai are NOT routable here, which is why uploads fall back to
# inline data URIs and why result assets must be fetched client-side.
REACHABLE = ["https://fal.run", "https://queue.fal.run", "https://fal.ai"]
BLOCKED = ["https://rest.alpha.fal.ai", "https://fal.media", "https://v3.fal.media"]


def key() -> str:
    k = os.environ.get("FAL_KEY", "").strip()
    if not k:
        sys.exit(
            "FAL_KEY is not set.\n"
            "Create one at https://fal.ai/dashboard/keys, then:\n"
            "  export FAL_KEY='<key-id>:<key-secret>'"
        )
    return k


def curl(method, url, payload=None, timeout=180):
    """Issue an HTTP request via curl. Returns (status_code, parsed_body)."""
    cmd = [
        "curl", "-sS", "-X", method, url,
        "-H", f"Authorization: Key {key()}",
        "-H", "Content-Type: application/json",
        "-w", "\n__STATUS__%{http_code}",
        "--max-time", str(timeout),
    ]
    tmp = None
    if payload is not None:
        # Payloads carrying data URIs get large; pass via file to dodge ARG_MAX.
        tmp = "/tmp/fal_payload.json"
        with open(tmp, "w") as fh:
            json.dump(payload, fh)
        cmd += ["--data", f"@{tmp}"]

    res = subprocess.run(cmd, capture_output=True, text=True)
    if tmp and os.path.exists(tmp):
        os.remove(tmp)
    if res.returncode != 0:
        return 0, {"curl_error": res.stderr.strip(), "exit_code": res.returncode}

    raw = res.stdout
    status = 0
    if "__STATUS__" in raw:
        raw, _, tail = raw.rpartition("\n__STATUS__")
        status = int(tail.strip() or 0)
    try:
        return status, json.loads(raw)
    except json.JSONDecodeError:
        return status, {"raw": raw[:2000]}


def to_data_uri(path: str) -> str:
    """Inline a local file as a data URI.

    fal's normal upload host (rest.alpha.fal.ai) is unreachable from this
    sandbox, so references are inlined instead. Fine for stills; videos of more
    than a few MB may exceed the request-body ceiling.
    """
    if not os.path.exists(path):
        sys.exit(f"asset not found: {path}")
    mime = mimetypes.guess_type(path)[0] or "application/octet-stream"
    size_mb = os.path.getsize(path) / 1_048_576
    if size_mb > 8:
        print(f"  !! {os.path.basename(path)} is {size_mb:.1f} MB inline — may be rejected",
              file=sys.stderr)
    with open(path, "rb") as fh:
        return f"data:{mime};base64," + base64.b64encode(fh.read()).decode()


def as_url(ref: str) -> str:
    """Accept either an https URL or a local path (inlined as a data URI)."""
    return ref if ref.startswith(("http://", "https://", "data:")) else to_data_uri(ref)


def submit_and_poll(model: str, payload: dict, poll_every=10, ceiling=1800):
    """Queue a job, then poll to completion. Returns the result body."""
    status, body = curl("POST", f"{QUEUE}/{model}", payload)
    if status != 200:
        return None, (status, body)

    req_id = body.get("request_id")
    if not req_id:
        return None, (status, body)

    base = f"{QUEUE}/{model.split('/')[0]}/{'/'.join(model.split('/')[1:])}"
    print(f"  queued: {req_id}")

    waited = 0
    while waited < ceiling:
        time.sleep(poll_every)
        waited += poll_every
        st, sb = curl("GET", f"{base}/requests/{req_id}/status")
        state = sb.get("status", "?")
        print(f"  [{waited:>4}s] {state}")
        if state == "COMPLETED":
            rst, rb = curl("GET", f"{base}/requests/{req_id}")
            return rb, None
        if state in ("FAILED", "CANCELLED"):
            return None, (st, sb)
    return None, (0, {"error": f"timed out after {ceiling}s", "request_id": req_id})


# --------------------------------------------------------------------------- #
# stages
# --------------------------------------------------------------------------- #

def cmd_check(_):
    print("network reachability")
    for host in REACHABLE + BLOCKED:
        code = subprocess.run(
            ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", host, "--max-time", "10"],
            capture_output=True, text=True).stdout.strip()
        verdict = "unreachable" if code == "000" else f"reachable (HTTP {code})"
        print(f"  {host:<30} {verdict}")

    print("\ncredential check")
    if not os.environ.get("FAL_KEY"):
        print("  FAL_KEY not set — create at https://fal.ai/dashboard/keys")
        return
    status, body = curl("POST", f"{SYNC}/{COMPOSE_MODEL}", {})
    if status == 401:
        print("  FAL_KEY rejected (401) — key is invalid or revoked")
    elif status in (200, 422):
        print(f"  FAL_KEY accepted (HTTP {status} — auth passed)")
    else:
        print(f"  inconclusive: HTTP {status} {json.dumps(body)[:300]}")


def cmd_compose(args):
    prompt = open(args.prompt).read() if args.prompt else COMPOSE_PROMPT_A
    print("encoding references...")
    images = [as_url(p) for p in (args.person, args.pose, args.location)]

    payload = {
        "prompt": prompt,
        "image_urls": images,
        "num_images": args.variants,
        "aspect_ratio": "9:16",
        "output_format": "png",
    }
    print(f"submitting {COMPOSE_MODEL} ({args.variants} variants)...")
    result, err = submit_and_poll(COMPOSE_MODEL, payload)
    if err:
        sys.exit(f"compose failed: HTTP {err[0]}\n{json.dumps(err[1], indent=2)[:1500]}")

    print("\ncomposite variants:")
    for i, img in enumerate(result.get("images", []), 1):
        print(f"  [{i}] {img.get('url')}")
    with open(args.out, "w") as fh:
        json.dump(result, fh, indent=2)
    print(f"\nfull response -> {args.out}")


def cmd_motion(args):
    print("encoding inputs...")
    payload = {
        "image_url": as_url(args.image),
        "video_url": as_url(args.video),
        "orientation": args.orientation,
    }
    model = args.model
    print(f"submitting {model}...")
    result, err = submit_and_poll(model, payload, poll_every=15, ceiling=2400)

    if err and err[0] == 404 and model == MOTION_MODEL:
        print(f"  {model} unavailable, retrying {MOTION_MODEL_FALLBACK}")
        result, err = submit_and_poll(MOTION_MODEL_FALLBACK, payload, poll_every=15, ceiling=2400)
    if err:
        sys.exit(f"motion transfer failed: HTTP {err[0]}\n{json.dumps(err[1], indent=2)[:1500]}")

    url = (result.get("video") or {}).get("url")
    print(f"\nfinal video: {url}")
    print("NOTE: fal.media is not routable from this sandbox — open the URL "
          "outside it to download.")
    with open(args.out, "w") as fh:
        json.dump(result, fh, indent=2)
    print(f"full response -> {args.out}")


def cmd_upload(args):
    """Attempt a real fal storage upload; falls back to reporting data-URI mode."""
    status, body = curl("POST", f"{SYNC}/storage/upload/initiate",
                        {"content_type": mimetypes.guess_type(args.path)[0]})
    if status != 200:
        sys.exit(
            f"storage upload unavailable here (HTTP {status}).\n"
            "rest.alpha.fal.ai is blocked by the network policy; use local paths "
            "directly with `compose`/`motion`, which inline them as data URIs."
        )
    print(json.dumps(body, indent=2))


COMPOSE_PROMPT_A = """IDENTITY (lock to person reference):
Young woman, tanned olive skin, strong defined eyebrows, glossy neutral-brown
lips, sharp cheekbones, slim athletic build with visible abdominal definition,
small fine-line tattoo on left ribcage. Dark brown hair in a short wet-look
slicked bob, damp strands falling loose around the face. Direct confident gaze
into the lens, lips slightly parted, chin dipped just below level.
Preserve facial identity exactly from the person reference.

POSE (lock to pose reference):
Standing frontal to camera, full body. Weight slightly forward, subtle lean
into the lens, shoulders rolled marginally forward and relaxed. Both arms bent,
elbows dropped close to the ribs and angled slightly outward, forearms raised so
both hands sit at mid-chest to waist height. Each hand grips a lapel of the open
leather jacket, pulling it forward and outward, forearms roughly symmetrical.
Legs straight, feet planted about shoulder width apart, hips square to camera.
Head level and centered, facing the lens straight on.

WARDROBE (lock to person reference):
Oversized black leather jacket worn open, collar popped, sleeves long past the
wrists, silver zipper hanging loose. Black scoop bra top. Black fitted mini
skirt low on the hips. White knee-high leather boots.

ENVIRONMENT (lock to location reference):
Underground pedestrian subway tunnel. Walls clad in white rectangular ceramic
tile with fine grey grout lines, faintly stained and aged. Recessed fluorescent
strip lights set into the ceiling edges on both sides, running away from camera
in one-point perspective. Coarse dark grey concrete ceiling. Chrome tubular
handrails mounted on both walls at hip height. Dark asphalt floor, matte and
slightly damp. Convex security mirror on the far wall. Metal drainage grate in
the foreground floor. Subject stands centered in the corridor, mid-depth,
roughly 3 metres from camera, framed full body with headroom.

CAMERA & LENS:
35mm full-frame equivalent, f/2.8, camera at hip height, level, centered on the
corridor vanishing point. Corridor geometry stays readable in depth; gentle
falloff on the far tiles and back wall while the subject holds critical focus.
Mild natural wide-angle perspective, no distortion on the face. Vertical 9:16.

LIGHTING:
Motivated entirely by the practical fluorescents. Hard cool key spilling from
the ceiling strips above and to both sides - 6000K, bluish-white - carving bright
speculars along the shoulders, collarbones and the top of the leather jacket,
with a crisp rim down both arms. A soft frontal bounce off the white tile wall
lifts the face just enough to keep eyes and features fully readable, killing any
raccoon-eye from the top light. Light falls off steeply below the knees; the
floor and the bottom of the frame sink into deep shadow. Background tunnel two
stops darker than the subject, so she separates cleanly.

SHADOWS & GROUNDING:
Tight dark contact shadow directly under both boots. Soft short shadow pooling
behind her feet, cast forward-down by the overhead strips. Faint blurred
reflection of the boots and lower legs in the damp asphalt. Subtle cool bounce
from the white tiles onto the outer edges of the jacket. Ambient occlusion where
the jacket meets the torso and under the chin.

COLOR & GRADE:
Cold desaturated palette - blue-grey tiles, near-black floor, cyan-white
highlights. Skin retains its warm tan against the cold surroundings. Deep
crushed blacks, controlled highlights on the fluorescent tubes with slight
bloom. Cinematic, not HDR.

REALISM:
Photographic realism. Visible skin texture with pores and fine imperfections,
natural specular sheen on damp hair, genuine grain in the leather, authentic
fabric weave. Real photograph shot on a full-frame sensor, subtle sensor noise
in the shadows, natural lens character. Unretouched skin.

NEGATIVE:
plastic skin, airbrushed, waxy, over-smoothed, over-sharpened, HDR halos,
warm orange lighting, extra fingers, deformed hands, floating feet, missing
contact shadow, flat frontal flash, blown highlights, text, watermark,
distorted face, changed facial identity, long hair"""


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("check", help="verify network + FAL_KEY").set_defaults(fn=cmd_check)

    up = sub.add_parser("upload", help="try a real fal storage upload")
    up.add_argument("path")
    up.set_defaults(fn=cmd_upload)

    co = sub.add_parser("compose", help="build the composite still")
    co.add_argument("--person", required=True, help="model photo (path or url)")
    co.add_argument("--pose", required=True, help="pose reference frame")
    co.add_argument("--location", required=True, help="location photo")
    co.add_argument("--prompt", help="prompt file; defaults to variant A")
    co.add_argument("--variants", type=int, default=4)
    co.add_argument("--out", default="compose_result.json")
    co.set_defaults(fn=cmd_compose)

    mo = sub.add_parser("motion", help="transfer motion onto the composite")
    mo.add_argument("--image", required=True, help="composite still (path or url)")
    mo.add_argument("--video", required=True, help="motion reference video")
    mo.add_argument("--orientation", default="video", choices=["video", "image"])
    mo.add_argument("--model", default=MOTION_MODEL)
    mo.add_argument("--out", default="motion_result.json")
    mo.set_defaults(fn=cmd_motion)

    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
