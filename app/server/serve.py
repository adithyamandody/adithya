#!/usr/bin/env python3
"""
Plotter server — runs on the laptop, not the tablet.

    POST /write    {"text": "ആദിത്യ"}   shape, generate G-code, stream to the printer
    POST /preview  {"text": "ആദിത്യ"}   PNG of exactly what would be drawn
    GET  /health                        is anything plugged in?

Malayalam needs complex text shaping — ക + ് + യ is one conjunct, not three
glyphs — so this has to be Python with HarfBuzz. The ESP32 cannot do it and
neither can the browser. The tablet joins the laptop's hotspot; no internet is
required, which matters because fair venues commonly have no WiFi.

    .venv/bin/python app/server/serve.py --dry-run
    .venv/bin/python app/server/serve.py --port /dev/tty.usbserial-0001

--dry-run writes the G-code to a file instead of a printer, so the whole path
can be tested before any hardware exists.
"""
import argparse
import pathlib
import time

try:
    from flask import Flask, request, jsonify, send_file
except ImportError:
    raise SystemExit("pip install flask")

import shape as shaper

app = Flask(__name__)
ARGS = None
OUT = pathlib.Path(__file__).parent / "out"


@app.after_request
def cors(r):
    r.headers["Access-Control-Allow-Origin"] = "*"
    r.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return r


def _text():
    return (request.get_json(silent=True) or {}).get("text", "").strip()


@app.route("/preview", methods=["POST", "OPTIONS"])
def preview():
    """Render without plotting. Always look at this first: bad shaping is
    obvious on screen and completely invisible in G-code."""
    if request.method == "OPTIONS":
        return ("", 204)
    text = _text()
    if not text:
        return jsonify(error="no text"), 400
    OUT.mkdir(exist_ok=True)
    contours, width = shaper.shape(text, ARGS.font, ARGS.height)
    png = OUT / "preview.png"
    shaper.to_png(contours, png, width, ARGS.height)
    return send_file(png, mimetype="image/png")


def stream_gcode(gcode, port, baud):
    """Send line by line, waiting for the printer's 'ok' after each.

    Streaming without waiting overruns the firmware's buffer and the plot
    silently loses moves — the sort of failure that looks like a bad font."""
    import serial
    sent = 0
    with serial.Serial(port, baud, timeout=10) as ser:
        time.sleep(2)                      # the board resets when the port opens
        ser.reset_input_buffer()
        for line in gcode.splitlines():
            line = line.split(";")[0].strip()
            if not line:
                continue
            ser.write((line + "\n").encode())
            while True:
                r = ser.readline().decode(errors="replace").strip().lower()
                if r.startswith("ok") or r == "":
                    break
                if "error" in r or "!!" in r:
                    raise RuntimeError(f"printer said: {r}")
            sent += 1
    return sent


@app.route("/write", methods=["POST", "OPTIONS"])
def write():
    if request.method == "OPTIONS":
        return ("", 204)
    text = _text()
    if not text:
        return jsonify(error="no text"), 400

    contours, width = shaper.shape(text, ARGS.font, ARGS.height)
    pts, dist = shaper.stats(contours)
    gcode = shaper.to_gcode(contours, text=text,
                            pen_down=ARGS.pen_down, pen_up=ARGS.pen_up,
                            feed=ARGS.feed)

    OUT.mkdir(exist_ok=True)
    (OUT / "last.gcode").write_text(gcode)
    shaper.to_png(contours, OUT / "last.png", width, ARGS.height)
    print(f"[write] {text!r}  {len(contours)} contours, {pts} points, "
          f"{width:.0f}x{ARGS.height:.0f}mm, {dist:.0f}mm of pen travel")

    if ARGS.dry_run or not ARGS.port:
        return jsonify(ok=True, dryRun=True, text=text,
                       contours=len(contours), points=pts,
                       widthMm=round(width, 1), travelMm=round(dist),
                       gcodeLines=len(gcode.splitlines()),
                       savedTo=str(OUT / "last.gcode"),
                       note="dry run — nothing was sent to a printer")
    try:
        sent = stream_gcode(gcode, ARGS.port, ARGS.baud)
        return jsonify(ok=True, text=text, linesSent=sent,
                       travelMm=round(dist), note="plotting — do not touch the bed")
    except Exception as e:
        return jsonify(error=str(e), savedTo=str(OUT / "last.gcode")), 502


@app.route("/health")
def health():
    return jsonify(ok=True, port=ARGS.port, dryRun=ARGS.dry_run,
                   font=pathlib.Path(ARGS.font).name, heightMm=ARGS.height)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--port", help="printer serial device, e.g. /dev/tty.usbserial-0001")
    p.add_argument("--baud", type=int, default=115200)
    p.add_argument("--dry-run", action="store_true",
                   help="write G-code to a file instead of a printer")
    p.add_argument("--font", default=str(shaper.FONT))
    p.add_argument("--height", type=float, default=12.0)
    p.add_argument("--pen-down", type=float, default=0.0)
    p.add_argument("--pen-up", type=float, default=5.0)
    p.add_argument("--feed", type=int, default=1200)
    p.add_argument("--host", default="0.0.0.0")
    p.add_argument("--http-port", type=int, default=5000)
    ARGS = p.parse_args()
    mode = "DRY RUN" if (ARGS.dry_run or not ARGS.port) else ARGS.port
    print(f"AksharaScan plotter on http://{ARGS.host}:{ARGS.http_port}  ({mode})")
    app.run(host=ARGS.host, port=ARGS.http_port)
