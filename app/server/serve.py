#!/usr/bin/env python3
"""
Plotter server — runs on the laptop, not the tablet.

    POST /write  {"text": "നീ സുഖം ആണോ"}

Malayalam needs complex text shaping (conjuncts reorder and fuse), so this has
to be Python with HarfBuzz; an ESP32 cannot do it. The tablet joins the
laptop's hotspot, so no internet is required — KITE venues commonly have none.

    pip install flask uharfbuzz fonttools vpype pyserial
    python3 app/server/serve.py --port /dev/tty.usbserial-XXXX

NOT YET IMPLEMENTED: shape.py. Phase 7. Until then this returns 501 so the
app's WRITE button fails gracefully instead of hanging.
"""
import argparse

try:
    from flask import Flask, request, jsonify
except ImportError:
    raise SystemExit("pip install flask")

app = Flask(__name__)
ARGS = None


@app.after_request
def cors(r):
    r.headers["Access-Control-Allow-Origin"] = "*"
    r.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return r


@app.route("/write", methods=["POST", "OPTIONS"])
def write():
    if request.method == "OPTIONS":
        return ("", 204)
    text = (request.get_json(silent=True) or {}).get("text", "").strip()
    if not text:
        return jsonify(error="no text"), 400
    print(f"[write] {text!r}")
    # TODO phase 7: shape.py -> paths -> G-code -> stream over ARGS.port.
    # ALWAYS render the shaped output to PNG and eyeball it before sending
    # anything to the printer. Garbage shaping is obvious on screen and
    # invisible in G-code.
    return jsonify(error="plotter not implemented yet (phase 7)",
                   received=text), 501


@app.route("/health")
def health():
    return jsonify(ok=True, port=ARGS.port if ARGS else None)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--port", help="printer serial device, e.g. /dev/tty.usbserial-0001")
    p.add_argument("--host", default="0.0.0.0")
    p.add_argument("--http-port", type=int, default=5000)
    ARGS = p.parse_args()
    print(f"AksharaScan plotter server on http://{ARGS.host}:{ARGS.http_port}")
    app.run(host=ARGS.host, port=ARGS.http_port)
