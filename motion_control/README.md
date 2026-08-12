# Motion Control pipeline

Composites a model into a location in a referenced pose, then animates that
still by transferring motion from a reference video.

Higgsfield's MCP connector can't do this from these sessions: it exposes only
`generate_image_batch` / `generate_video_batch`, with no media-upload tools, so
no reference file can enter its pipeline. This calls fal.ai directly over HTTP
instead.

## Environment findings

Probed from this sandbox on 2026-08-12:

| Host | State | Notes |
| --- | --- | --- |
| `fal.run` | reachable | sync endpoints |
| `queue.fal.run` | reachable | queue endpoints; motion-control path returns 401, so the model exists |
| `fal.ai` | reachable | HTTP 429 at the edge |
| `rest.alpha.fal.ai` | **blocked** | fal's storage upload host |
| `fal.media`, `v3.fal.media` | **blocked** | CDN serving uploads and results |
| `api.klingapi.com` | **blocked** | proxy answers 502 to CONNECT |

Two consequences shape the design:

- **No storage uploads.** References are inlined as base64 data URIs instead
  (`as_url()` accepts a path or an https URL). Stills are comfortable; the
  2.7 MB reference video becomes ~3.7 MB of base64 and may hit the request-body
  ceiling. If it does, host the video somewhere reachable and pass the URL.
- **No result downloads.** Generated assets are served from `fal.media`, which
  this sandbox cannot reach. The pipeline prints result URLs; open them from
  outside the sandbox.

Kling's first-party API is unusable here regardless of credentials —
`api.klingapi.com` is refused at CONNECT.

## Usage

```bash
export FAL_KEY='<key-id>:<key-secret>'   # https://fal.ai/dashboard/keys

python3 fal_pipeline.py check

python3 fal_pipeline.py compose \
  --person   model.jpg \
  --pose     pose_frame.jpg \
  --location tunnel.jpg \
  --variants 4

python3 fal_pipeline.py motion \
  --image composite.png \
  --video motion_reference.mp4 \
  --orientation video
```

`compose` defaults to the variant A prompt (hands gripping the jacket lapels).
Pass `--prompt file.txt` to override it — use that for variant B, which gives
the model long straight hair so the pose reference can be followed literally.

`--orientation video` follows the body choreography, which is what motion
transfer means here; `image` follows camera movement instead.

## Attribution

The pose reference frame (TikTok, @la.bianchis) governs pose and framing only.
The reference video contributes motion only. Facial identity comes from the
model photograph in every case.
