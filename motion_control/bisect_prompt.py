#!/usr/bin/env python3
"""Find which section of a prompt trips fal's content checker.

Submits candidate prompts against the real reference images and reports only
pass/fail, so a rejected prompt can be narrowed down without guesswork. Each
passing candidate generates one image and therefore costs credit — keep the
candidate list short.

    python3 bisect_prompt.py
"""
import json
import subprocess
import sys
import time

KEY_ENV = "FAL_KEY"
IMAGES = [
    "https://files.catbox.moe/s6udqo.jpeg",
    "https://files.catbox.moe/z5pir4.jpeg",
    "https://files.catbox.moe/ec55s1.jpeg",
]
ENDPOINT = "https://queue.fal.run/fal-ai/nano-banana/edit"


def post(url, key, payload=None, method="POST"):
    cmd = ["curl", "-sS", "-X", method, url, "-H", f"Authorization: Key {key}",
           "-H", "Content-Type: application/json", "--max-time", "40"]
    if payload is not None:
        with open("/tmp/bisect.json", "w") as fh:
            json.dump(payload, fh)
        cmd += ["--data", "@/tmp/bisect.json"]
    out = subprocess.run(cmd, capture_output=True, text=True).stdout
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return {"raw": out[:400]}


def test(label, prompt, key):
    sub = post(ENDPOINT, key, {"prompt": prompt, "image_urls": IMAGES, "num_images": 1})
    if "status_url" not in sub:
        print(f"  {label:<28} SUBMIT FAILED  {json.dumps(sub)[:120]}")
        return None
    for _ in range(18):
        time.sleep(10)
        st = post(sub["status_url"], key, method="GET").get("status", "?")
        if st == "COMPLETED":
            break
    body = post(sub["response_url"], key, method="GET")
    if "images" in body:
        print(f"  {label:<28} PASS   {body['images'][0]['url']}")
        return True
    detail = body.get("detail")
    kind = detail[0].get("type") if isinstance(detail, list) and detail else detail
    print(f"  {label:<28} BLOCKED ({kind})")
    return False


def main():
    import os
    key = os.environ.get(KEY_ENV)
    if not key:
        sys.exit(f"{KEY_ENV} not set")

    full = open("prompt_lean.txt").read()
    # Split on the ALL-CAPS section headers.
    sections, current = {}, "INTRO"
    sections[current] = []
    for line in full.splitlines():
        head = line.split(":")[0]
        if head.isupper() and len(head) > 3 and ":" in line:
            current = head
            sections[current] = []
        sections[current].append(line)
    names = list(sections)
    print("sections:", ", ".join(names), "\n")

    joined = lambda keep: "\n".join(
        "\n".join(sections[n]) for n in names if n in keep).strip()

    # Drop one section at a time; whichever omission flips it to PASS is the culprit.
    for drop in names:
        keep = [n for n in names if n != drop]
        if test(f"without {drop}", joined(keep), key):
            print(f"\n=> culprit: {drop}")
            return
    print("\n=> no single section responsible; trigger is cumulative")


if __name__ == "__main__":
    main()
