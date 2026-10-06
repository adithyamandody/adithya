#!/usr/bin/env python3
"""
Malayalam text -> pen-plotter G-code.

    python3 shape.py "ആദിത്യ" --preview out.png --gcode out.gcode

Why this cannot run on the ESP32, or in the browser: Malayalam needs complex
text SHAPING. ക + ് + യ is not three glyphs side by side, it is one conjunct
ക്യ, and the vowel sign െ is stored after its consonant but drawn before it.
Only a real shaping engine gets this right, so HarfBuzz does it here and the
microcontroller just streams the result.

The pipeline:

    text -> uharfbuzz        shape: conjuncts, reordering, positioning
         -> fontTools pen    glyph outlines as contours
         -> flatten          curves into line segments a plotter can follow
         -> scale            font units into millimetres
         -> G-code           pen up/down as Z moves

ALWAYS look at the PNG before sending anything to the printer. Garbage shaping
is obvious on screen and completely invisible in G-code, and a bad plot costs
ninety seconds and a sheet of paper.
"""
import argparse
import math
import pathlib
import sys

try:
    import uharfbuzz as hb
    from fontTools.ttLib import TTFont
    from fontTools.pens.recordingPen import RecordingPen
except ImportError as e:
    sys.exit(f"missing dependency: {e}\n"
             "  python3 -m venv .venv && .venv/bin/pip install uharfbuzz fonttools pillow pyserial")

FONT = pathlib.Path(__file__).parent / "fonts" / "NotoSansMalayalam.ttf"


# ── curve flattening ──────────────────────────────────────────────────────
# A plotter draws straight lines. Curves become many short segments; the step
# count is what trades plot time against visible faceting.

def _quad(p0, p1, p2, n):
    for i in range(1, n + 1):
        t = i / n
        u = 1 - t
        yield (u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
               u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1])


def _cubic(p0, p1, p2, p3, n):
    for i in range(1, n + 1):
        t = i / n
        u = 1 - t
        yield (u**3 * p0[0] + 3 * u*u*t * p1[0] + 3 * u*t*t * p2[0] + t**3 * p3[0],
               u**3 * p0[1] + 3 * u*u*t * p1[1] + 3 * u*t*t * p2[1] + t**3 * p3[1])


def _contours(pen_value, steps):
    """RecordingPen output -> list of closed point lists."""
    out, cur, pos = [], [], (0.0, 0.0)
    for op, args in pen_value:
        if op == "moveTo":
            if len(cur) > 1:
                out.append(cur)
            pos = args[0]
            cur = [pos]
        elif op == "lineTo":
            pos = args[0]
            cur.append(pos)
        elif op == "qCurveTo":
            pts = list(args)
            # a trailing None means the contour is all off-curve points
            if pts[-1] is None:
                pts = pts[:-1] + [((pts[0][0] + pts[-2][0]) / 2,
                                   (pts[0][1] + pts[-2][1]) / 2)]
            for i in range(len(pts) - 1):
                ctrl, end = pts[i], pts[i + 1]
                if i < len(pts) - 2:          # implied on-curve midpoint
                    end = ((ctrl[0] + pts[i + 1][0]) / 2, (ctrl[1] + pts[i + 1][1]) / 2)
                cur.extend(_quad(pos, ctrl, end, steps))
                pos = end
        elif op == "curveTo":
            a, b, c = args[-3], args[-2], args[-1]
            cur.extend(_cubic(pos, a, b, c, steps))
            pos = c
        elif op == "closePath":
            if len(cur) > 1:
                cur.append(cur[0])
                out.append(cur)
            cur = []
    if len(cur) > 1:
        out.append(cur)
    return out


# ── shaping ───────────────────────────────────────────────────────────────

def shape(text, font_path=FONT, height_mm=12.0, steps=6):
    """Malayalam string -> contours in millimetres, baseline at y=0."""
    blob = hb.Blob.from_file_path(str(font_path))
    face = hb.Face(blob)
    hbfont = hb.Font(face)
    upem = face.upem

    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()          # script, direction, language
    hb.shape(hbfont, buf)

    tt = TTFont(str(font_path))
    glyf = tt.getGlyphSet()
    order = tt.getGlyphOrder()
    scale = height_mm / upem

    contours, x, y = [], 0.0, 0.0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        name = order[info.codepoint]
        pen = RecordingPen()
        glyf[name].draw(pen)
        for c in _contours(pen.value, steps):
            contours.append([(((px + x + pos.x_offset) * scale),
                              ((py + y + pos.y_offset) * scale)) for px, py in c])
        x += pos.x_advance
        y += pos.y_advance

    return contours, (x * scale)


# ── output ────────────────────────────────────────────────────────────────

def to_gcode(contours, *, origin=(20.0, 20.0), feed=1200, travel=3000,
             pen_down=0.0, pen_up=5.0, text=""):
    ox, oy = origin
    g = [
        "; AksharaScan — Malayalam on a pen plotter",
        f"; text: {text}",
        "; A 3D printer with a pen where the hotend was.",
        "; The heater is NEVER commanded: Marlin's thermal runaway protection",
        "; is mandatory and must not be patched out. An unheated hotend with",
        "; its thermistor still attached reads ambient and never trips.",
        "G21        ; millimetres",
        "G90        ; absolute",
        "G28        ; home",
        f"G1 Z{pen_up:.2f} F{travel}   ; pen up",
    ]
    for c in contours:
        if len(c) < 2:
            continue
        x0, y0 = c[0]
        g.append(f"G0 X{ox + x0:.3f} Y{oy + y0:.3f} F{travel}")
        g.append(f"G1 Z{pen_down:.2f} F{travel}    ; pen down")
        for px, py in c[1:]:
            g.append(f"G1 X{ox + px:.3f} Y{oy + py:.3f} F{feed}")
        g.append(f"G1 Z{pen_up:.2f} F{travel}      ; pen up")
    g += [f"G0 X0 Y{oy + 60:.1f} F{travel}   ; move clear so the sheet can be lifted",
          "M84        ; motors off"]
    return "\n".join(g) + "\n"


def to_png(contours, path, width_mm, height_mm=12.0, px_per_mm=12, pad=6):
    """Look at this before plotting. Bad shaping is obvious here and invisible
    in G-code."""
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        return None
    w = int((width_mm + pad * 2) * px_per_mm)
    h = int((height_mm * 2.2 + pad * 2) * px_per_mm)
    base = h - int((pad + height_mm * 0.6) * px_per_mm)
    img = Image.new("RGB", (max(w, 40), max(h, 40)), "white")
    d = ImageDraw.Draw(img)
    d.line([(0, base), (w, base)], fill="#dddddd")          # the baseline
    for c in contours:
        pts = [(pad * px_per_mm + px * px_per_mm, base - py * px_per_mm) for px, py in c]
        if len(pts) > 1:
            d.line(pts, fill="black", width=2)
    img.save(path)
    return path


def stats(contours):
    pts = sum(len(c) for c in contours)
    dist = 0.0
    for c in contours:
        for a, b in zip(c, c[1:]):
            dist += math.dist(a, b)
    return pts, dist


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("text")
    ap.add_argument("--font", default=str(FONT))
    ap.add_argument("--height", type=float, default=12.0, help="text height in mm")
    ap.add_argument("--steps", type=int, default=6, help="segments per curve")
    ap.add_argument("--gcode")
    ap.add_argument("--preview", default="preview.png")
    a = ap.parse_args()

    contours, width = shape(a.text, a.font, a.height, a.steps)
    pts, dist = stats(contours)
    print(f"text     {a.text}")
    print(f"contours {len(contours)}  points {pts}")
    print(f"size     {width:.1f} x {a.height:.1f} mm   pen travel {dist:.0f} mm")

    if a.preview:
        p = to_png(contours, a.preview, width, a.height)
        print(f"preview  {p}   <- LOOK AT THIS before plotting")
    if a.gcode:
        pathlib.Path(a.gcode).write_text(to_gcode(contours, text=a.text))
        lines = len(to_gcode(contours, text=a.text).splitlines())
        print(f"gcode    {a.gcode}  ({lines} lines)")


if __name__ == "__main__":
    main()
