#!/usr/bin/env bash
# End-to-end run with the confirmed asset mapping.
#
#   export FAL_KEY='<key-id>:<key-secret>'
#   ./run.sh compose          build 4 variants of the composite still
#   ./run.sh motion <img-url> animate the chosen variant
set -euo pipefail
cd "$(dirname "$0")"

# Asset roles confirmed by the user. Getting person and pose the wrong way
# round would put the reference model's face in the output, so these are
# pinned here rather than passed ad hoc.
PERSON="https://files.catbox.moe/s6udqo.jpeg"   # model — identity to preserve
POSE="https://files.catbox.moe/z5pir4.jpeg"     # TikTok frame — pose/framing only
LOCATION="https://files.catbox.moe/ec55s1.jpeg" # subway underpass
VIDEO="https://files.catbox.moe/vzz7wf.mp4"     # motion reference

case "${1:-}" in
  compose)
    exec python3 fal_pipeline.py compose \
      --person "$PERSON" --pose "$POSE" --location "$LOCATION" \
      --variants 4 --out compose_result.json
    ;;
  motion)
    [ $# -ge 2 ] || { echo "usage: $0 motion <composite-image-url>" >&2; exit 1; }
    exec python3 fal_pipeline.py motion \
      --image "$2" --video "$VIDEO" \
      --orientation video --out motion_result.json
    ;;
  check) exec python3 fal_pipeline.py check ;;
  *) echo "usage: $0 {check|compose|motion <image-url>}" >&2; exit 1 ;;
esac
