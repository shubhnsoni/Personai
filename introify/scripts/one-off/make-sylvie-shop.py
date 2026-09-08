"""Create real PDFs + cover images for Sylvie's shop."""
from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, ListFlowable, ListItem
from reportlab.pdfgen import canvas
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "shop"
OUT.mkdir(parents=True, exist_ok=True)

FOREST = HexColor("#047857")
INK = HexColor("#052E1A")
MUTE = HexColor("#3F5B4E")


def styles():
    s = getSampleStyleSheet()
    s.add(ParagraphStyle("CoverTitle", parent=s["Title"], fontSize=28, textColor=INK, spaceAfter=8, leading=34))
    s.add(ParagraphStyle("Kicker", parent=s["Normal"], fontSize=10, textColor=FOREST, letterSpacing=1.2, spaceAfter=12))
    s.add(ParagraphStyle("Body", parent=s["Normal"], fontSize=11, leading=16, textColor=INK, spaceAfter=8))
    s.add(ParagraphStyle("H", parent=s["Heading2"], fontSize=14, textColor=FOREST, spaceBefore=12, spaceAfter=6))
    return s


def header_footer(c: canvas.Canvas, doc):
    c.saveState()
    c.setFillColor(FOREST)
    c.rect(0, letter[1] - 18, letter[0], 18, fill=1, stroke=0)
    c.setFillColor(MUTE)
    c.setFont("Times-Roman", 8)
    c.drawString(72, 36, "Sylvie Chen  ·  Founder Lab")
    c.drawRightString(letter[0] - 72, 36, str(doc.page))
    c.restoreState()


def write_pdf(path: Path, title: str, kicker: str, blocks: list[tuple[str, str]]):
    s = styles()
    story = [
        Paragraph(kicker.upper(), s["Kicker"]),
        Paragraph(title, s["CoverTitle"]),
        Spacer(1, 8),
        Paragraph("Sylvie Chen  ·  PersonaLink", s["Body"]),
        Spacer(1, 16),
    ]
    for heading, body in blocks:
        story.append(Paragraph(heading, s["H"]))
        for para in body.split("\n\n"):
            if para.startswith("- "):
                items = [ListItem(Paragraph(line[2:], s["Body"])) for line in para.split("\n") if line.startswith("- ")]
                story.append(ListFlowable(items, bulletType="bullet", leftIndent=16))
            else:
                story.append(Paragraph(para, s["Body"]))
    SimpleDocTemplate(
        str(path),
        pagesize=letter,
        leftMargin=72,
        rightMargin=72,
        topMargin=56,
        bottomMargin=56,
        title=title,
        author="Sylvie Chen",
    ).build(story, onFirstPage=header_footer, onLaterPages=header_footer)


def cover_png(path: Path, title: str, subtitle: str, color: tuple[int, int, int]):
    w, h = 800, 1000
    img = Image.new("RGB", (w, h), color)
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 0, w, 28), fill=(255, 255, 255))
    try:
        font_lg = ImageFont.truetype("arial.ttf", 48)
        font_sm = ImageFont.truetype("arial.ttf", 22)
        font_xs = ImageFont.truetype("arial.ttf", 16)
    except OSError:
        font_lg = font_sm = font_xs = ImageFont.load_default()
    draw.text((56, 80), "PDF  ·  SYLVIE CHEN", fill=(255, 255, 255), font=font_xs)
    # wrap title
    words = title.split()
    lines, cur = [], ""
    for word in words:
        trial = (cur + " " + word).strip()
        if font_lg.getlength(trial) < w - 110:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    y = 160
    for line in lines[:4]:
        draw.text((56, y), line, fill=(255, 255, 255), font=font_lg)
        y += 58
    draw.text((56, y + 16), subtitle, fill=(220, 245, 232), font=font_sm)
    draw.rectangle((56, h - 140, 220, h - 88), outline=(255, 255, 255), width=2)
    draw.text((70, h - 126), "DOWNLOAD", fill=(255, 255, 255), font=font_xs)
    img.save(path, "PNG")


def main():
    write_pdf(
        OUT / "first-90-days-workbook.pdf",
        "First 90 days workbook",
        "Founder Lab  ·  Printable",
        [
            ("How to use this", "Print it. Write in ink. Review every Friday.\n\nPick one track: hire, raise, or cadence. Do not run all three in the same quarter."),
            ("Week 1–2  ·  See the system", "- List the work that actually moved last month.\n- Circle what only you can do.\n- Name the first role that would buy back 8 hours."),
            ("Week 3–6  ·  Scorecard", "- Write the outcomes, not the personality.\n- Score two people you already know.\n- If nobody is an 8, you do not have a hire yet."),
            ("Week 7–12  ·  Cadence", "- One weekly operating review. Same agenda.\n- One 1:1. Same three questions.\n- One number on the wall."),
            ("The wall number", "Revenue, pipeline, or hours recovered. Pick one. Everything else is a diary."),
        ],
    )
    write_pdf(
        OUT / "scorecard-pack.pdf",
        "Scorecard pack",
        "Hiring  ·  Operator · Seller · Maker",
        [
            ("What a scorecard is", "A one-page contract for the seat. Outcomes, not tasks. You score 1–10. Below 8 is a no."),
            ("Operator seat", "- Owns the weekly review.\n- Ships the board by Monday 10:00.\n- Escalates blockers the same day."),
            ("Seller seat", "- 12 qualified conversations a week.\n- Writes the next step in the CRM before they hang up.\n- No discount without a written trade."),
            ("Maker seat", "- One shipped artifact every week.\n- Reviews their own work against the brief first.\n- Asks for a decision, not a vibe."),
            ("How to score", "9–10 you would rehire tomorrow. 8 you would keep. 7 and below you coach once, then decide."),
        ],
    )
    write_pdf(
        OUT / "first-hire-checklist.pdf",
        "First hire checklist",
        "Free  ·  Before you post the role",
        [
            ("Before you write the post", "- The work exists without you for two weeks.\n- You can name the outcome in one sentence.\n- You can pay for 90 days without a miracle."),
            ("The post", "Role, outcome, first 30 days, how you work. No culture adjectives."),
            ("The first week", "Scorecard signed. Calendar shared. One shipped thing by Friday."),
        ],
    )
    cover_png(OUT / "first-90-days-workbook.png", "First 90 days\nworkbook", "Plan the quarter before you hire.", (4, 120, 87))
    cover_png(OUT / "scorecard-pack.png", "Scorecard pack", "Operator · Seller · Maker", (6, 46, 26))
    cover_png(OUT / "first-hire-checklist.png", "First hire\nchecklist", "Free download", (3, 105, 161))
    print("wrote", list(OUT.iterdir()))


if __name__ == "__main__":
    main()
