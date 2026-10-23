"""Build the YatraSetu AI live-demo deck (16:9, speaker notes included).

Run:  python scripts/make_demo_deck.py
Out:  presentation/YatraSetu_AI_Demo.pptx
"""
from pathlib import Path

from lxml import etree
from PIL import Image
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt

ROOT = Path(__file__).resolve().parents[1]
SHOTS = ROOT / "docs" / "screenshots"
DIAGRAMS = ROOT / "docs" / "diagrams"
OUT = ROOT / "presentation" / "YatraSetu_AI_Demo.pptx"

# ---------- design tokens (mirrors app/static/style.css) ----------
TEAL = RGBColor(0x1F, 0x4E, 0x5F)
TEAL_DARK = RGBColor(0x16, 0x39, 0x4A)
TEAL_2 = RGBColor(0x2A, 0x63, 0x77)
TEAL_L = RGBColor(0xE6, 0xEF, 0xF1)
SAFF = RGBColor(0xD9, 0x73, 0x1E)
SAFF_L = RGBColor(0xFB, 0xEF, 0xE3)
INK = RGBColor(0x1B, 0x2A, 0x33)
GREY = RGBColor(0x6B, 0x77, 0x80)
RULE = RGBColor(0xD6, 0xDE, 0xE2)
BG = RGBColor(0xF5, 0xF7, 0xF8)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
GREEN = RGBColor(0x2E, 0x8B, 0x57)
RED = RGBColor(0xC0, 0x39, 0x2B)
YELLOW = RGBColor(0xD4, 0xA0, 0x17)
PALE_BLUE = RGBColor(0xC9, 0xDD, 0xE3)

HEAD = "Cambria"
BODY = "Calibri"
MONO = "Consolas"
DEVA = "Nirmala UI"

W, H = 13.333, 7.5


# ---------- primitives ----------
def new_slide(prs, bg=BG):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    s.background.fill.solid()
    s.background.fill.fore_color.rgb = bg
    return s


def _set_alpha(shape, pct):
    """pct: 0-100 opacity of the solid fill."""
    srgb = shape.fill._xPr.find(qn("a:solidFill")).find(qn("a:srgbClr"))
    alpha = etree.SubElement(srgb, qn("a:alpha"))
    alpha.set("val", str(int(pct * 1000)))


def rect(slide, x, y, w, h, fill=None, line=None, lw=1.0, shape=MSO_SHAPE.RECTANGLE, radius=None):
    shp = slide.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    shp.shadow.inherit = False
    if fill is None:
        shp.fill.background()
    else:
        shp.fill.solid()
        shp.fill.fore_color.rgb = fill
    if line is None:
        shp.line.fill.background()
    else:
        shp.line.color.rgb = line
        shp.line.width = Pt(lw)
    if radius is not None and shape == MSO_SHAPE.ROUNDED_RECTANGLE:
        shp.adjustments[0] = radius
    return shp


def card(slide, x, y, w, h, fill=WHITE, line=RULE, radius=0.055):
    return rect(slide, x, y, w, h, fill=fill, line=line, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=radius)


def textbox(slide, x, y, w, h, anchor=MSO_ANCHOR.TOP, margins=(0, 0, 0, 0)):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left, tf.margin_right, tf.margin_top, tf.margin_bottom = [Inches(m) for m in margins]
    return box


def add_para(tf, runs, size=14, color=INK, font=BODY, bold=False, italic=False, align=PP_ALIGN.LEFT,
             space_before=0, space_after=0, line_spacing=None, first=False, bullet=False, indent=0.0,
             letter_spacing=None, link=None):
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    p.alignment = align
    if space_before:
        p.space_before = Pt(space_before)
    if space_after:
        p.space_after = Pt(space_after)
    if line_spacing:
        p.line_spacing = line_spacing
    if bullet or indent:
        pPr = p._p.get_or_add_pPr()
        base = Inches(0.22 + indent)
        pPr.set("marL", str(int(base)))
        pPr.set("indent", str(int(-Inches(0.22))))
    if isinstance(runs, str):
        runs = [(runs, {})]
    for text, opts in runs:
        r = p.add_run()
        r.text = text
        f = r.font
        f.name = opts.get("font", font)
        f.size = Pt(opts.get("size", size))
        f.bold = opts.get("bold", bold)
        f.italic = opts.get("italic", italic)
        f.color.rgb = opts.get("color", color)
        if opts.get("letter_spacing", letter_spacing):
            f._rPr.set("spc", str(int(opts.get("letter_spacing", letter_spacing) * 100)))
        if link:
            f.hyperlink.address = link
    return p


def text(slide, x, y, w, h, content, **kw):
    box = textbox(slide, x, y, w, h, anchor=kw.pop("anchor", MSO_ANCHOR.TOP))
    add_para(box.text_frame, content, first=True, **kw)
    return box


def bullets(slide, x, y, w, h, items, size=12.5, color=INK, bullet_color=SAFF, gap=5, line_spacing=1.05):
    box = textbox(slide, x, y, w, h)
    for i, item in enumerate(items):
        runs = [("•  ", {"color": bullet_color, "bold": True})]
        if isinstance(item, str):
            runs.append((item, {}))
        else:
            runs.extend(item)
        add_para(box.text_frame, runs, size=size, color=color, first=(i == 0),
                 space_after=gap, line_spacing=line_spacing, bullet=True)
    return box


def header(slide, eyebrow, title, subtitle=None):
    text(slide, 0.6, 0.33, 12.15, 0.3, eyebrow, size=10.5, color=SAFF, bold=True, letter_spacing=1.6)
    text(slide, 0.6, 0.62, 12.15, 0.68, title, size=29, color=TEAL, bold=True, font=HEAD)
    rect(slide, 0.6, 1.36, 0.9, 0.045, fill=SAFF)
    rect(slide, 1.5, 1.372, 11.25, 0.012, fill=RULE)
    if subtitle:
        text(slide, 0.6, 1.48, 12.15, 0.36, subtitle, size=13, color=GREY)


def footer(slide, n, label="YatraSetu AI · Live demo"):
    text(slide, 0.6, 7.1, 8.0, 0.24, label, size=9, color=GREY)
    text(slide, 11.9, 7.1, 0.85, 0.24, f"{n:02d}", size=9, color=GREY, align=PP_ALIGN.RIGHT)


def chip(slide, x, y, w, h, label, fill=TEAL_L, color=TEAL, size=10, bold=True):
    rect(slide, x, y, w, h, fill=fill, line=None, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.5)
    text(slide, x, y + 0.015, w, h - 0.03, label, size=size, color=color, bold=bold,
         align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)


def image_fit(slide, path, x, y, w, h, frame=True):
    iw, ih = Image.open(path).size
    scale = min(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    if frame:
        card(slide, x, y, w, h)
        dw, dh = min(dw, w - 0.16), min(dh, h - 0.42)
        px, py = x + (w - dw) / 2, y + 0.08
    else:
        px, py = x + (w - dw) / 2, y + (h - dh) / 2
    pic = slide.shapes.add_picture(str(path), Inches(px), Inches(py), Inches(dw), Inches(dh))
    pic.line.color.rgb = RULE
    pic.line.width = Pt(0.75)
    return py + dh


def notes(slide, body):
    slide.notes_slide.notes_text_frame.text = body.strip()


def metric(slide, x, y, w, h, value, label, accent=SAFF):
    card(slide, x, y, w, h)
    rect(slide, x, y, 0.06, h, fill=accent)
    text(slide, x + 0.28, y + 0.18, w - 0.4, 0.52, value, size=27, color=accent, bold=True, font=HEAD)
    text(slide, x + 0.28, y + 0.72, w - 0.45, h - 0.8, label, size=11.5, color=GREY, line_spacing=1.0)


def step_row(slide, x, y, w, num, lead, rest, h=0.62):
    rect(slide, x, y + 0.02, 0.3, 0.3, fill=SAFF, line=None, shape=MSO_SHAPE.OVAL)
    text(slide, x, y + 0.04, 0.3, 0.26, str(num), size=12, color=WHITE, bold=True,
         align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    box = textbox(slide, x + 0.42, y - 0.01, w - 0.42, h)
    add_para(box.text_frame, [(lead + " ", {"bold": True, "color": TEAL}), (rest, {"color": INK})],
             size=11.5, first=True, line_spacing=1.03)
    return y + h


# ---------- reusable demo-feature slide ----------
def feature_slide(prs, n, eyebrow, title, subtitle, image, steps, points, quote, note, caption):
    s = new_slide(prs)
    header(s, eyebrow, title, subtitle)
    end_y = image_fit(s, image, 0.6, 1.85, 7.55, 4.95)
    text(s, 0.75, min(end_y + 0.1, 6.62), 7.2, 0.24, caption, size=9.5, color=GREY, italic=True)

    rx = 8.45
    text(s, rx, 1.86, 4.25, 0.24, "RUN IT LIVE", size=9.5, color=SAFF, bold=True, letter_spacing=1.4)
    y = 2.16
    for i, (lead, rest) in enumerate(steps, 1):
        y = step_row(s, rx, y, 4.3, i, lead, rest)
    rect(s, rx, y + 0.12, 4.25, 0.012, fill=RULE)
    text(s, rx, y + 0.25, 4.25, 0.24, "POINT OUT", size=9.5, color=SAFF, bold=True, letter_spacing=1.4)
    bullets(s, rx, y + 0.5, 4.3, 1.35, points, size=10.8, gap=2.5, line_spacing=1.0)

    qy = 5.98
    card(s, rx, qy, 4.28, 0.86, fill=SAFF_L, line=RGBColor(0xF1, 0xD2, 0xB3))
    text(s, rx + 0.18, qy + 0.11, 3.95, 0.66,
         [("“", {"color": SAFF, "size": 19, "bold": True, "font": HEAD}),
          (quote, {"color": RGBColor(0x8A, 0x4A, 0x12), "italic": True}),
          ("”", {"color": SAFF, "size": 19, "bold": True, "font": HEAD})],
         size=11.2, line_spacing=1.02, anchor=MSO_ANCHOR.MIDDLE)
    footer(s, n)
    notes(s, note)
    return s


# ---------- build ----------
prs = Presentation()
prs.slide_width, prs.slide_height = Inches(W), Inches(H)

# 1 ─ title ------------------------------------------------------------------
s = new_slide(prs, TEAL)
# mountain motif
for x, y, w, h, op in [(-1.2, 5.1, 7.2, 3.4, 26), (3.1, 4.45, 8.0, 4.2, 20), (9.4, 5.0, 6.0, 3.2, 30)]:
    tri = rect(s, x, y, w, h, fill=TEAL_2, line=None, shape=MSO_SHAPE.ISOSCELES_TRIANGLE)
    _set_alpha(tri, op)
sun = rect(s, 9.55, 0.35, 1.15, 1.15, fill=SAFF, line=None, shape=MSO_SHAPE.OVAL)
_set_alpha(sun, 88)

# phone mock-up
rect(s, 10.05, 0.72, 2.92, 6.1, fill=TEAL_DARK, line=RGBColor(0x2F, 0x5C, 0x6C), lw=1.2,
     shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.11)
pic = s.shapes.add_picture(str(SHOTS / "07_mobile_view.png"), Inches(10.17), Inches(0.84),
                          width=Inches(2.68), height=Inches(5.80))
pic.line.color.rgb = TEAL_2
pic.line.width = Pt(0.75)

text(s, 0.85, 0.82, 8.4, 0.3, "LIVE DEMO  ·  MINOR PROJECT 2026", size=11, color=SAFF, bold=True, letter_spacing=2.0)
text(s, 0.8, 1.18, 9.0, 1.0, "YatraSetu AI", size=58, color=WHITE, bold=True, font=HEAD)
text(s, 0.85, 2.42, 8.4, 0.95, "A safe-travel bridge for every pilgrim in Uttarakhand.",
     size=23, color=PALE_BLUE, font=HEAD)
rect(s, 0.88, 3.56, 1.5, 0.06, fill=SAFF)
text(s, 0.85, 3.82, 8.3, 1.15,
     "One multilingual assistant. Five safety services. Grounded in official data — from a 7-day crowd "
     "forecast to a WhatsApp alert on the road that is actually closed.",
     size=14.5, color=PALE_BLUE, line_spacing=1.15)
text(s, 0.85, 5.45, 8.7, 0.32, "Ayush Singh  ·  B.Tech CSE (AI/ML)  ·  Roorkee Institute of Technology",
     size=12.5, color=WHITE, bold=True)
text(s, 0.85, 5.86, 8.7, 0.3, "github.com/AyushSinghRana15/Yatra-Setu", size=11, color=PALE_BLUE)
chip(s, 0.85, 6.45, 3.25, 0.34, "OPENROUTER  ·  LANGCHAIN  ·  FASTAPI", fill=TEAL_2, color=WHITE, size=8.8)
notes(s, """
Open with the one-line pitch: YatraSetu is a multilingual safety bridge for pilgrims — it answers questions
in the traveller's language, forecasts crowds against carrying capacity, scores the risk of their actual road,
checks health readiness, and lets district officials push one approved advisory to every affected trip.

Today is a live product demo, not a slide tour. The whole stack runs locally: FastAPI, scikit-learn,
SQLite, a LangChain chain on OpenRouter, and a plain HTML/PWA front end. It also runs with no API key.

Say: "Everything you will see is running on this laptop. Where the AI needs an external model, we use
OpenRouter through LangChain — and every generated answer is checked against retrieved official text."
""")

# 2 ─ run of show ------------------------------------------------------------
s = new_slide(prs)
header(s, "THE RUN OF SHOW", "Five stops, about six minutes",
       "Each stop is one user problem and one working screen. The screenshots in this deck are the backup.")
stops = [
    ("01", "0:00", "Ask anything", "English or Hindi, grounded answer with source", TEAL),
    ("02", "1:15", "Crowd forecast", "7 days vs carrying capacity, lighter dates", TEAL_2),
    ("03", "2:00", "Route risk", "Your road, scored 0–100, with a safe halt", SAFF),
    ("04", "2:45", "Alerts & SOS", "Consent-based trip alerts, SMS fallback", RGBColor(0xB5, 0x5D, 0x17)),
    ("05", "3:30", "Control room", "Draft → approve → broadcast, with an audit trail", TEAL_DARK),
]
cw, gap = 2.22, 0.26
for i, (num, t, title, desc, col) in enumerate(stops):
    x = 0.6 + i * (cw + gap)
    card(s, x, 2.05, cw, 2.85)
    text(s, x + 0.2, 2.22, 0.8, 0.55, num, size=27, color=col, bold=True, font=HEAD)
    text(s, x + 0.2, 2.83, 1.8, 0.24, t, size=9.5, color=GREY, bold=True)
    text(s, x + 0.2, 3.12, cw - 0.4, 0.62, title, size=14.5, color=TEAL, bold=True, font=HEAD, line_spacing=0.95)
    text(s, x + 0.2, 3.82, cw - 0.38, 0.9, desc, size=10.5, color=GREY, line_spacing=1.02)

text(s, 0.6, 5.22, 12.1, 0.3, "WHY IT LANDS", size=9.5, color=SAFF, bold=True, letter_spacing=1.4)
for i, (t, d) in enumerate([
    ("Grounded, not generated", "Every answer cites an approved source or live data — or it says it cannot answer."),
    ("Live, not generic", "Crowd and route answers pull today's forecast, IMD alert and road status."),
    ("Human in the loop", "An official approves every advisory; emergencies never wait for a model."),
]):
    x = 0.6 + i * 4.08
    card(s, x, 5.55, 3.86, 1.2, fill=TEAL_L, line=None)
    text(s, x + 0.2, 5.68, 3.5, 0.28, t, size=12, color=TEAL, bold=True)
    text(s, x + 0.2, 5.99, 3.48, 0.68, d, size=10, color=GREY, line_spacing=1.02)
footer(s, 2)
notes(s, """
Set expectations: five stops, each one user problem. If time is short, skip the health and SOS screens and
spend the extra minutes on the advisory broadcast — that is the part officials remember.

The three "why it lands" points are your theme for the whole demo: grounded, live, human-approved.
Repeat them at the close.
""")

# 3 ─ setup ------------------------------------------------------------------
s = new_slide(prs)
header(s, "PRE-FLIGHT", "Before you present", "One command, two URLs. The app seeds its own demo data on first run.")
# terminal
card(s, 0.6, 1.95, 7.25, 3.15, fill=TEAL_DARK, line=TEAL_DARK)
rect(s, 0.6, 1.95, 7.25, 0.36, fill=RGBColor(0x11, 0x2E, 0x3C))
for i, c in enumerate([RGBColor(0xE0, 0x6C, 0x5F), RGBColor(0xD9, 0xA4, 0x41), RGBColor(0x5C, 0xB8, 0x6B)]):
    rect(s, 0.8 + i * 0.2, 2.05, 0.1, 0.1, fill=c, line=None, shape=MSO_SHAPE.OVAL)
text(s, 1.55, 2.02, 6.0, 0.22, "terminal — zsh", size=9, color=PALE_BLUE)
lines = [
    ("$ ", "cd YatraSetu-AI", WHITE),
    ("$ ", "cp .env.example .env        # optional: add OPENROUTER_API_KEY", PALE_BLUE),
    ("$ ", "./run.sh", WHITE),
    ("", "Open http://127.0.0.1:8000  (dashboard: /admin)", RGBColor(0x8F, 0xC9, 0xA8)),
    ("$ ", "pytest -q                   # 23 passed", PALE_BLUE),
    ("$ ", "python scripts/evaluate.py  # writes docs/evaluation_results.json", PALE_BLUE),
]
box = textbox(s, 0.85, 2.5, 6.8, 2.4)
for i, (prompt, cmd, col) in enumerate(lines):
    add_para(box.text_frame, [(prompt, {"color": SAFF, "bold": True}), (cmd, {"color": col})],
             size=10.8, font=MONO, first=(i == 0), space_after=6)

# URLs
for i, (label, url, sub) in enumerate([
    ("TRAVELLER APP", "http://127.0.0.1:8000", "Assistant · crowd · route · health · SOS"),
    ("OFFICIALS' DASHBOARD", "http://127.0.0.1:8000/admin", "Advisories · road status · delivery · audit"),
]):
    y = 1.95 + i * 1.62
    card(s, 8.15, y, 4.6, 1.42)
    text(s, 8.38, y + 0.17, 4.1, 0.22, label, size=9, color=SAFF, bold=True, letter_spacing=1.3)
    text(s, 8.38, y + 0.44, 4.1, 0.3, url, size=14, color=TEAL, bold=True, font=MONO)
    text(s, 8.38, y + 0.83, 4.1, 0.3, sub, size=9.5, color=GREY)

# logins
card(s, 0.6, 5.38, 5.3, 1.35)
text(s, 0.82, 5.52, 4.9, 0.22, "DEMO LOGINS", size=9, color=SAFF, bold=True, letter_spacing=1.3)
text(s, 0.82, 5.79, 4.9, 0.3, "editor / editor123", size=12, color=TEAL, bold=True, font=MONO)
text(s, 0.82, 6.08, 4.9, 0.3, "approver / approver123", size=12, color=TEAL, bold=True, font=MONO)
text(s, 0.82, 6.38, 4.9, 0.25, "Editor drafts · approver publishes (four-eyes rule).", size=9.5, color=GREY)

card(s, 6.15, 5.38, 6.6, 1.35, fill=SAFF_L, line=RGBColor(0xF1, 0xD2, 0xB3))
text(s, 6.38, 5.52, 6.1, 0.22, "AI MODE — CHECK ONCE", size=9, color=SAFF, bold=True, letter_spacing=1.3)
text(s, 6.38, 5.79, 6.1, 0.75,
     [("With a key: ", {"bold": True, "color": TEAL}), ("OpenRouter + LangChain, on the traveller screen and at ", {}),
      ("/api/ai/status", {"font": MONO, "color": TEAL}), (".\n", {}),
      ("No key: ", {"bold": True, "color": TEAL}), ("offline extractive mode. Same screens, same guardrails.", {})],
     size=10.3, color=INK, line_spacing=1.05)
footer(s, 3)
notes(s, """
Pre-flight, 60 seconds before you start:
1) ./run.sh (it creates .venv, installs, seeds SQLite, starts uvicorn). 2) Open the two URLs in separate tabs.
3) Run pytest -q — 23 passed. 4) Open /api/ai/status and confirm the AI badge. 5) Keep this deck open on the
screenshots slide in case the projector or network misbehaves.

If .env has OPENROUTER_API_KEY, the traveller page shows "llm-rag · openrouter / <model> · LangChain".
If not, it shows "extractive · offline mode". Both are honest and both work; do not apologise for offline mode.
""")

# 4 ─ persona ----------------------------------------------------------------
s = new_slide(prs)
header(s, "THE PROBLEM, IN ONE PERSON", "Meet Sunita, 62, from Pune",
       "She has the faith and the savings. What she does not have is one place that tells her the truth about tomorrow.")
card(s, 0.6, 1.95, 5.15, 4.6, fill=TEAL, line=TEAL)
text(s, 0.95, 2.2, 1.0, 0.8, "“", size=64, color=SAFF, bold=True, font=HEAD)
text(s, 0.95, 2.85, 4.4, 2.2,
     "I want to go, but I don't know if the road is open, how crowded it will be, or whether my body can take the climb.",
     size=19, color=WHITE, font=HEAD, line_spacing=1.08)
rect(s, 0.98, 5.22, 0.9, 0.045, fill=SAFF)
text(s, 0.98, 5.42, 4.3, 0.55, "Sunita, 62\nFirst Char Dham yatra", size=11, color=PALE_BLUE, line_spacing=1.1)

card(s, 6.0, 1.95, 6.75, 2.12, fill=WHITE)
chip(s, 6.25, 2.15, 1.25, 0.28, "TODAY", fill=RGBColor(0xFD, 0xEE, 0xEC), color=RED, size=9)
bullets(s, 6.25, 2.55, 6.2, 1.4, [
    "Five websites, two languages, no single answer.",
    "Crowd advice is a district average, not her date.",
    "A landslide is discovered at the debris, not before.",
], size=11.2, gap=3)

card(s, 6.0, 4.24, 6.75, 2.31, fill=TEAL_L, line=RGBColor(0xC5, 0xDB, 0xE0))
chip(s, 6.25, 4.44, 1.65, 0.28, "WITH YATRASETU", fill=TEAL, color=WHITE, size=9)
bullets(s, 6.25, 4.84, 6.2, 1.55, [
    "One assistant, in Hindi, with sources and dates.",
    "A lighter date and a route risk for her actual road.",
    "A WhatsApp alert with the nearest safe halt — before she leaves.",
], size=11.2, gap=3, bullet_color=TEAL)
footer(s, 4)
notes(s, """
Use Sunita to make the demo about a person, not a stack. The three "today" failures map one-to-one to the
five screens: scattered information (assistant), unpredictable crowds (forecast), generic warnings (route +
alerts), unprepared at altitude (health), and officials who cannot reach the right people (dashboard).

Keep this to 40 seconds. Then say: "Let me show you what Sunita sees instead."
""")

# 5 ─ assistant --------------------------------------------------------------
feature_slide(
    prs, 5, "DEMO · 01  ASSISTANT", "Ask in your language. Get a sourced answer.",
    "Type in English or Hindi; the reply cites approved content or live data — never an unsourced guess.",
    SHOTS / "01_assistant_chat.png",
    [
        ("Open", "the traveller app and leave language on Auto."),
        ("Ask:", "“Is Kedarnath crowded this week?”"),
        ("Then ask in Hindi:", "“केदारनाथ में कल कितनी भीड़ होगी?”"),
    ],
    ["Live forecast in the answer, not just prose", "Source title + last-updated date", "Right panel shows intent and confidence"],
    "Every answer is grounded — or it says it cannot answer.",
    """
Type the English crowd question. Point at the date-stamped source chip under the answer, then at the
"Last response details" panel: intent = crowd, confidence, shrine detected. Now ask the Hindi question;
the answer stays in Hindi and the UI keeps the same source discipline.

If the OpenRouter key is configured, answer mode reads llm-rag; the generated text still passes the numeric
guardrail. If not, mode reads extractive. Either way the source is shown. Do not claim the LLM knows the
answer — it is only allowed to phrase retrieved passages.
""",
    "Live screenshot · traveller app, assistant tab",
)

# 6 ─ emergency --------------------------------------------------------------
feature_slide(
    prs, 6, "DEMO · 02  SAFETY OVERRIDE", "When it is an emergency, the model is not in the loop.",
    "A deterministic keyword override returns 112/108 instructions immediately, whatever the LLM is doing.",
    SHOTS / "02_assistant_emergency_fallback.png",
    [
        ("Type:", "“my father has chest pain near Linchauli”"),
        ("Point at", "the red SOS styling and Call 112."),
        ("Ask an off-topic question", "to show the honest fallback."),
    ],
    ["Emergency recall 100% in evaluation", "No API call, no latency, no hallucination", "Unknown topics get 112, not invented facts"],
    "The worst moment to be creative is an emergency.",
    """
Type the chest-pain sentence. The answer is a fixed safety template: stop climbing, keep the person warm and
seated, call 112, ambulance 108, use SOS. It is marked as an emergency in the details panel with confidence 1.0.

Then ask something off-topic — "What is the GDP of Brazil in 1990?" — and show that it refuses and points to
112 / the official helpline. This is the trust moment: the system is designed to say "I don't know".

Mention that the emergency list is bilingual and unit-tested (100% recall on 10 phrasings).
""",
    "Live screenshot · emergency override and off-topic fallback",
)

# 7 ─ crowd ------------------------------------------------------------------
feature_slide(
    prs, 7, "DEMO · 03  CROWD FORECAST", "Spread the crowd before it forms.",
    "A 7-day footfall forecast per shrine, compared with that shrine's recommended daily carrying capacity.",
    SHOTS / "03_crowd_forecast.png",
    [
        ("Open", "Crowd forecast and pick Kedarnath."),
        ("Read", "the day cards: Low / Moderate / High / Over capacity."),
        ("Find a High day", "and show the lighter-date suggestion."),
    ],
    ["Capacity 13,111/day for Kedarnath", "MAPE 13.3% on the held-out 2025 season", "Suggests two lighter dates and an alternative shrine"],
    "We don't just predict the crowd — we move it.",
    """
Pick Kedarnath and walk the seven day cards. The bar chart overlays carrying capacity. If today is not High,
change the start date to a May/June weekend until a High or Over-capacity day appears, then point at the
lighter-date and alternative-shrine suggestion.

Explain the model in one sentence: gradient-boosted trees on calendar, season position and weather features,
trained on a synthetic daily history calibrated to published season totals. Evaluation is a held-out season,
not a random split.

Be honest: daily shrine-wise counts need a data MoU. The pipeline is built so real data drops in without
code changes.
""",
    "Live screenshot · crowd forecast with capacity line",
)

# 8 ─ route ------------------------------------------------------------------
feature_slide(
    prs, 8, "DEMO · 04  ROUTE RISK", "Not a district alert — your road, on your date.",
    "Every route segment gets a transparent 0–100 score from IMD alerts, rain, official road status and terrain.",
    SHOTS / "04_route_risk.png",
    [
        ("Open", "Route risk and choose Kedarnath."),
        ("Click", "Check route: worst segment, score and reasons."),
        ("Hover the map", "to show why each segment is coloured."),
    ],
    ["18 segments on the Char Dham network", "Closed road always forces Red", "Orange/Red adds a safe halt with stay + medical"],
    "The score is explainable, because safety advice must be.",
    """
Choose Kedarnath and click Check route. The seeded demo has a Restricted stretch at Joshimath (Chamoli) and an
Orange IMD alert in Rudraprayag, so the route shows a meaningful worst segment. Read the "why" column aloud:
IMD alert points, rain points, terrain susceptibility, road status.

If the worst segment is Orange or Red, the panel suggests a safe halt with stay and medical facilities on the
traveller's side of the blockage. That is FR-17, and it is the detail officials and families remember.

Hover a segment on the SVG map to show the same factors in the tooltip.
""",
    "Live screenshot · route-risk map and segment explanation",
)

# 9 ─ health -----------------------------------------------------------------
feature_slide(
    prs, 9, "DEMO · 05  HEALTH READINESS", "The cheapest rescue is the one that never happens.",
    "A conservative, rule-based readiness check — never a diagnosis — with screening points on the actual route.",
    SHOTS / "05_health_check.png",
    [
        ("Enter", "age 68, high blood pressure, medium fitness."),
        ("Click", "Check readiness → Consult doctor first."),
        ("Tick chest pain", "to show the red-flag stop."),
    ],
    ["Four categories, from Ready to Do not trek now", "Screening mandatory at 50+", "Sonprayag screening point + medical posts"],
    "It sorts risk. It does not play doctor.",
    """
Enter 68, tick high blood pressure, keep fitness at "can walk 5 km" and choose Kedarnath. The result is
"Consult doctor first": reasons, actions (fitness certificate, acclimatisation, medicines) and the screening
point at Sonprayag with medical posts on the route.

Then tick "chest pain or pressure" and re-run: the category jumps to "Do not trek now" with 112/108 guidance.
The disclaimer is always visible. This is deliberately rules, not ML — a probabilistic answer is the wrong
tool for a red flag.
""",
    "Live screenshot · health readiness plan",
)

# 10 ─ alerts & SOS -----------------------------------------------------------
feature_slide(
    prs, 10, "DEMO · 06  ALERTS & SOS", "One message reaches only the people on that road.",
    "Consent-based trip subscription, WhatsApp delivery with SMS fallback, and an SOS that finds the nearest help.",
    SHOTS / "06_alerts_sos.png",
    [
        ("Subscribe", "a trip with the consent box ticked."),
        ("Send SOS", "from 30.66, 79.03 and show nearest help."),
        ("Note", "the masked number and hashed storage."),
    ],
    ["DPDP-style consent required", "WhatsApp first; SMS on failure", "SOS returns nearest medical facility + 112 link"],
    "Alerts are targeted by route segment and date, not broadcast to everyone.",
    """
Tick consent, subscribe 9876543210 for Kedarnath, and show the returned segment list. The number is masked in
the database and stored as a hash. A demo convention: numbers ending in 0 fail WhatsApp and fall back to SMS,
so you can show both channels offline.

Then send an SOS at the pre-filled location. It returns the nearest medical facility (Kedarnath, about a
kilometre away), a 112 dial link, and a WhatsApp share link with the map pin. Nothing is sent to a real
gateway in the prototype; the outbox simulates delivery so the whole flow is demonstrable on a laptop.
""",
    "Live screenshot · trip subscription and SOS",
)

# 11 ─ dashboard overview -----------------------------------------------------
feature_slide(
    prs, 11, "DEMO · 07  CONTROL ROOM", "One screen for the district control room.",
    "Advisories, live road and weather status, delivery reports, model back-test and a full audit trail.",
    SHOTS / "09_admin_overview.png",
    [
        ("Open", "/admin and sign in as editor."),
        ("Show", "the KPI strip and queries by language."),
        ("Switch tabs", "to Advisories and Audit."),
    ],
    ["Role-based access: editor vs approver", "Queries by intent and language", "Every action lands in the audit log"],
    "The control room can see what pilgrims are actually asking.",
    """
Sign in as editor (the form is pre-filled). The overview shows how many queries, grounded rate, subscriptions,
pending advisories, the outbox, queries by intent and language, and live route risk. This is operational
intelligence, not a vanity dashboard: it tells the district what people are worried about today.

Switch to the Audit tab and point out that logins, advisory creation, approvals, road changes and weather
updates are all recorded. That is what makes a four-eyes workflow auditable.

Keep this stop short — the next slide is the workflow that matters.
""",
    "Live screenshot · officials' dashboard overview",
)

# 12 ─ four-eyes broadcast ----------------------------------------------------
s = new_slide(prs)
header(s, "DEMO · 08  FOUR-EYES BROADCAST", "Draft → approve → broadcast. In under a minute.",
       "The author cannot publish their own advisory. Approval updates the assistant and messages affected trips.")
image_fit(s, SHOTS / "13_admin_alert_delivery.png", 0.6, 1.85, 7.55, 3.7)
text(s, 0.75, 5.62, 7.25, 0.24,
     "Live screenshot · delivery log: affected trips only, WhatsApp first, SMS fallback",
     size=9.5, color=GREY, italic=True)

# result stats
for i, (v, l, c) in enumerate([("4", "affected trips", TEAL), ("3", "WhatsApp delivered", GREEN), ("1", "SMS fallback", SAFF)]):
    x = 0.6 + i * 2.55
    card(s, x, 5.98, 2.42, 0.9, fill=WHITE)
    text(s, x + 0.16, 6.07, 0.8, 0.4, v, size=22, color=c, bold=True, font=HEAD)
    text(s, x + 0.7, 6.15, 1.65, 0.55, l, size=9.5, color=GREY, line_spacing=0.95)

rx = 8.55
text(s, rx, 1.86, 4.2, 0.24, "THE WORKFLOW", size=9.5, color=SAFF, bold=True, letter_spacing=1.4)
steps = [
    ("Draft", "Editor writes EN + HI, picks the affected segment and validity."),
    ("Approve", "A different official publishes. Self-approval returns 403."),
    ("Broadcast", "Only trips on that segment and date are messaged; SMS on failure."),
    ("Index", "The advisory is immediately searchable by the assistant."),
]
y = 2.18
for i, (lead, rest) in enumerate(steps, 1):
    y = step_row(s, rx, y, 4.2, i, lead, rest, h=0.72)
rect(s, rx, y + 0.05, 4.18, 0.012, fill=RULE)
card(s, rx, y + 0.2, 4.18, 1.05, fill=SAFF_L, line=RGBColor(0xF1, 0xD2, 0xB3))
text(s, rx + 0.18, y + 0.31, 3.85, 0.82,
     [("Try it live: ", {"bold": True, "color": TEAL}),
      ("draft the seeded Sonprayag advisory as editor, approve it as approver, then ask the assistant "
       "“Is there debris near Sonprayag?”", {})],
     size=10.2, color=INK, line_spacing=1.03)
footer(s, 12)
notes(s, """
This is the strongest live moment. As editor: Advisories tab, the form is pre-filled with the Sonprayag
landslide. Submit for approval. Point out the pending badge. Sign out, sign in as approver, click Publish.
The result: 4 affected trips, 3 delivered on WhatsApp, 1 SMS fallback (the seeded number ending in 0).

Now go back to the traveller app and ask "Is there debris near Sonprayag?" The new advisory is the top source.
That closes the loop between the control room and the pilgrim.

Emphasise the 403 if the editor tries to approve their own advisory: the four-eyes rule is enforced in code,
not in a policy document. Audit log records who did what.
""")

# 13 ─ architecture -----------------------------------------------------------
s = new_slide(prs)
header(s, "UNDER THE HOOD", "Grounded AI, not a chatbot wrapper.",
       "The generative step is one small LangChain chain, fenced by retrieval, safety rules and a numeric guardrail.")
end = image_fit(s, DIAGRAMS / "architecture.png", 0.6, 1.85, 8.45, 4.55)
text(s, 0.75, 6.48, 8.15, 0.24, "System architecture · FastAPI services, data stores and channels", size=9.5, color=GREY, italic=True)

rx = 9.35
text(s, rx, 1.86, 3.4, 0.24, "THE AI PATH", size=9.5, color=SAFF, bold=True, letter_spacing=1.4)
chain = [("1", "Language + intent", "Hindi / English, emergency override first"),
         ("2", "Hybrid retrieval", "TF-IDF word + char n-grams over approved docs"),
         ("3", "LangChain LCEL", "prompt → OpenRouter model → parser"),
         ("4", "Guardrails", "numbers must exist in passages; else extractive")]
y = 2.18
for num, t, d in chain:
    card(s, rx, y, 3.4, 0.9)
    text(s, rx + 0.14, y + 0.15, 0.35, 0.3, num, size=15, color=SAFF, bold=True, font=HEAD)
    text(s, rx + 0.5, y + 0.12, 2.75, 0.28, t, size=11.5, color=TEAL, bold=True)
    text(s, rx + 0.5, y + 0.4, 2.75, 0.42, d, size=9.4, color=GREY, line_spacing=0.98)
    y += 1.0

text(s, 0.62, 6.83, 12.1, 0.24,
     "OpenRouter + LangChain are optional: with no key, steps 3–4 are skipped and the extractive answer is used.",
     size=9.2, color=GREY, italic=True)
footer(s, 13)
notes(s, """
The architecture slide is where technical judges calm down. Explain the AI path in four steps and stress that
retrieval is ours, not the model's: bilingual TF-IDF (word + character n-grams) over approved documents, with
shrine-aware re-ranking and live forecast/route enrichment.

Then the LangChain chain: ChatPromptTemplate → ChatOpenAI pointed at OpenRouter → StrOutputParser, with
attribution headers, model fallbacks, timeout, retries and an in-process cache. The prompt is not allowed to
answer outside the numbered passages.

The guardrail is the important part: every number in the generated answer must appear in the retrieved
passages, otherwise we throw the generation away and show the extractive answer. Emergencies never reach the
model at all. Set OPENROUTER_API_KEY to switch it on; no key means the same product without generation.
""")

# 14 ─ proof -----------------------------------------------------------------
s = new_slide(prs)
header(s, "PROOF, NOT PROMISES", "The prototype already performs",
       "Everything below is reproducible from the repository in about two minutes.")
kpis = [
    ("23 / 23", "automated tests pass\n(unit + API + LangChain guardrails)", GREEN),
    ("87.5% / 95.0%", "retrieval top-1 / top-3 accuracy\n(40 bilingual gold questions)", SAFF),
    ("100%", "emergency recall on 10 phrasings\n(and 1 false alarm on the gold set)", RED),
    ("13.3%", "forecast MAPE on normal days\n(held-out 2025 season)", TEAL),
    ("80.3%", "crowd-band accuracy\n(Low / Moderate / High / Over capacity)", TEAL_2),
    ("1.3 ms", "retrieval + intent per question\n(on this laptop, CPU only)", RGBColor(0xB5, 0x5D, 0x17)),
]
for i, (v, l, c) in enumerate(kpis):
    x = 0.6 + (i % 3) * 4.12
    y = 1.95 + (i // 3) * 1.72
    metric(s, x, y, 3.9, 1.5, v, l, accent=c)

card(s, 0.6, 5.68, 12.1, 1.08, fill=TEAL_L, line=None)
text(s, 0.82, 5.82, 11.7, 0.28, "REPRODUCE", size=9, color=SAFF, bold=True, letter_spacing=1.3)
text(s, 0.82, 6.1, 11.7, 0.55,
     [("pytest -q", {"font": MONO, "color": TEAL, "bold": True}), ("   ·   ", {}),
      ("python scripts/evaluate.py", {"font": MONO, "color": TEAL, "bold": True}), ("   ·   ", {}),
      ("curl -s /api/ai/status", {"font": MONO, "color": TEAL, "bold": True}),
      ("      The OpenRouter path is also tested against a local OpenAI-compatible stub.", {"color": GREY})],
     size=11, color=GREY)
footer(s, 14)
notes(s, """
Read only three numbers aloud: 23/23 tests, 100% emergency recall, 13.3% forecast error. The rest are on the
slide for the report and for questions.

Be precise about the forecast: MAPE is on normal days in a held-out season, using synthetic daily history
calibrated to published totals. Never imply it is trained on official daily shrine counts — that is exactly
the data-sharing MoU the pilot needs.

Mention the LangChain guardrail tests: one confirms a grounded generated answer is accepted; another confirms
an invented number is rejected and the extractive answer is used. The OpenRouter HTTP path was verified
against a local OpenAI-compatible stub, so the wiring is not theoretical.
""")

# 15 ─ runbook ----------------------------------------------------------------
s = new_slide(prs)
header(s, "RUNBOOK", "If the demo fights back",
       "Golden rule: never debug live. Switch to the screenshots, keep the narrative, fix it after.")
card(s, 0.6, 1.95, 4.55, 4.75)
text(s, 0.85, 2.12, 4.1, 0.24, "PRE-FLIGHT CHECKLIST", size=9.5, color=SAFF, bold=True, letter_spacing=1.4)
checks = [
    "Server answers at :8000 and :8000/admin",
    "pytest -q says 23 passed",
    "AI badge or /api/ai/status checked",
    "Demo DB seeded (advisory + 5 trips)",
    "This deck open on the screenshots",
    "Laptop volume, brightness, charger",
]
for i, c in enumerate(checks):
    y = 2.5 + i * 0.55
    rect(s, 0.87, y + 0.02, 0.22, 0.22, fill=WHITE, line=TEAL, lw=1.2, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.2)
    text(s, 1.2, y, 3.7, 0.4, c, size=11, color=INK, line_spacing=1.0)

rows = [
    ("No API key / no internet", "Offline extractive mode is automatic. Say so; every screen still works."),
    ("401 or 429 from OpenRouter", "Check key and credits. The chain returns None and the app falls back safely."),
    ("Stale or empty dashboard", "rm yatrasetu.db && python scripts/seed_demo.py, restart uvicorn."),
    ("Port 8000 already in use", "uvicorn app.main:app --port 8001 (update the URL you show)."),
    ("Browser or projector fails", "Use docs/screenshots and the screenshot slides in this deck."),
]
tbl = s.shapes.add_table(len(rows) + 1, 2, Inches(5.45), Inches(1.95), Inches(7.25), Inches(4.15)).table
tbl.columns[0].width = Inches(2.45)
tbl.columns[1].width = Inches(4.8)
for j, h in enumerate(["SYMPTOM", "RECOVERY"]):
    cell = tbl.cell(0, j)
    cell.fill.solid(); cell.fill.fore_color.rgb = TEAL
    cell.margin_left = Inches(0.12); cell.margin_top = Inches(0.07)
    cell.text_frame.text = ""
    p = cell.text_frame.paragraphs[0]
    r = p.add_run(); r.text = h; r.font.size = Pt(9); r.font.bold = True; r.font.color.rgb = WHITE; r.font.name = BODY
for i, (a, b) in enumerate(rows, 1):
    for j, val in enumerate((a, b)):
        cell = tbl.cell(i, j)
        cell.fill.solid(); cell.fill.fore_color.rgb = WHITE if i % 2 else TEAL_L
        cell.margin_left = Inches(0.12); cell.margin_top = Inches(0.06); cell.margin_bottom = Inches(0.06)
        cell.text_frame.text = ""
        p = cell.text_frame.paragraphs[0]
        r = p.add_run(); r.text = val; r.font.size = Pt(9.8); r.font.name = BODY
        r.font.color.rgb = TEAL if j == 0 else GREY
        r.font.bold = (j == 0)
text(s, 5.45, 6.25, 7.2, 0.4,
     "If the LLM is misbehaving, unset OPENROUTER_API_KEY and restart — you lose generation, not the product.",
     size=9.5, color=GREY, italic=True)
footer(s, 15)
notes(s, """
Walk through this slide before the demo starts, not during it. The most likely failure is an OpenRouter key
that is missing, expired or out of credit. The application is designed to fall back to extractive mode on any
exception, so the demo still works — but check the badge so you are not surprised.

For a clean demo database: rm yatrasetu.db && python scripts/seed_demo.py. That recreates the weather alerts,
five subscriptions and the Restricted road at Joshimath. The advisory workflow still needs you to draft and
approve live.

Keep the screenshots folder open in Finder/Explorer. If the projector dies, switch to this deck rather than
troubleshooting in front of the audience.
""")

# 16 ─ likely questions -------------------------------------------------------
s = new_slide(prs)
header(s, "LIKELY QUESTIONS", "The four you will actually get",
       "Short answers, honest limits. The report has the detail.")
qa = [
    ("Is the footfall data real?",
     "The daily history is synthetic, calibrated to published season totals. Capacity and knowledge-base content are sourced. Real daily counts need a data-sharing MoU — the pipeline already accepts them."),
    ("Can the LLM hallucinate?",
     "It only sees retrieved passages, and every number it writes must exist in those passages. Otherwise the answer is discarded. Emergencies bypass the model entirely."),
    ("What about privacy?",
     "Explicit consent, hashed phone numbers, masked display numbers, PII redaction before any model call, and a 90-day retention promise. Aligned with DPDP Act 2023."),
    ("Why will officials use it?",
     "One publish reaches only affected trips, four-eyes approval is enforced in code, and every action is audited. It saves the control room phone calls."),
]
for i, (q, a) in enumerate(qa):
    x = 0.6 + (i % 2) * 6.15
    y = 1.95 + (i // 2) * 2.4
    card(s, x, y, 5.85, 2.15)
    rect(s, x, y, 0.06, 2.15, fill=SAFF)
    text(s, x + 0.3, y + 0.2, 5.3, 0.4, q, size=14, color=TEAL, bold=True, font=HEAD)
    text(s, x + 0.3, y + 0.7, 5.3, 1.3, a, size=10.6, color=GREY, line_spacing=1.08)
footer(s, 16)
notes(s, """
Answer these in one breath each, then stop. Over-explaining data limitations loses the room.

The honest position: the product is real, the AI pipeline is real, the daily footfall history is synthetic
because the state does not publish machine-readable shrine-wise daily counts. We calibrated it to published
season totals and we evaluate on a held-out season. The first pilot task is a data MoU.

On privacy, be specific: consent is required before storing a trip; the phone is hashed (SHA-256 with a salt
in the prototype, a vault secret in production); display numbers are masked; phone numbers and e-mails are
redacted before any text reaches OpenRouter.
""")

# 17 ─ close -----------------------------------------------------------------
s = new_slide(prs, TEAL)
for x, y, w, h, op in [(-1.4, 5.0, 7.4, 3.6, 26), (3.0, 4.3, 8.2, 4.4, 20), (9.0, 4.9, 6.4, 3.4, 28)]:
    tri = rect(s, x, y, w, h, fill=TEAL_2, line=None, shape=MSO_SHAPE.ISOSCELES_TRIANGLE)
    _set_alpha(tri, op)
rect(s, 10.1, 0.55, 1.0, 1.0, fill=SAFF, line=None, shape=MSO_SHAPE.OVAL)
text(s, 0.85, 0.9, 9.5, 0.3, "THE PILOT ASK", size=11, color=SAFF, bold=True, letter_spacing=2.0)
text(s, 0.8, 1.35, 10.5, 1.4, "One district.\nOne data MoU. One season.", size=42, color=WHITE, bold=True,
     font=HEAD, line_spacing=0.98)
text(s, 0.85, 3.55, 8.6, 0.9,
     "That is enough to prove safer, calmer yatras at a fraction of the cost of new infrastructure.",
     size=17, color=PALE_BLUE, font=HEAD, line_spacing=1.1)
for i, (t, d) in enumerate([("PILOT DISTRICTS", "Rudraprayag + Chamoli"), ("TIMELINE", "2027 yatra"), ("BUDGET", "₹25 lakh, 6 months")]):
    x = 0.85 + i * 3.25
    card(s, x, 4.72, 2.95, 0.95, fill=TEAL_2, line=RGBColor(0x3A, 0x70, 0x82))
    text(s, x + 0.18, 4.83, 2.6, 0.22, t, size=8.5, color=SAFF, bold=True, letter_spacing=1.2)
    text(s, x + 0.18, 5.1, 2.6, 0.4, d, size=13, color=WHITE, bold=True, font=HEAD)
text(s, 0.85, 6.15, 9.0, 0.35, "Thank you — questions?", size=20, color=WHITE, bold=True, font=HEAD)
text(s, 0.85, 6.62, 10.0, 0.3,
     "Ayush Singh  ·  ayush@example.com  ·  github.com/AyushSinghRana15/Yatra-Setu",
     size=10.5, color=PALE_BLUE)
notes(s, """
Close on the ask, not on the tech: one district, one data MoU, one season. Rudraprayag and Chamoli cover
Kedarnath, Badrinath and Hemkund — the highest-risk routes and the ones where the prototype already has data.

Then invite questions. If someone asks "what do you need most?", the answer is the data-sharing agreement and
a WhatsApp Business / Bhashini sandbox, not money for more features.

Pause on this slide. Do not fill the silence.
""")

OUT.parent.mkdir(parents=True, exist_ok=True)
prs.save(OUT)
print(f"Wrote {OUT} ({len(prs.slides)} slides)")
