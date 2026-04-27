#!/usr/bin/env python3
"""
Migrate essays to wh-essays/wh-essays/

Sources:
  1. wayward-house/src/content/essays/*.mdx  (Astro MDX format)
  2. waywardhouse-site/articles/*.qmd         (old Quarto/Jekyll hybrid format)

Output:
  wh-essays/wh-essays/<slug>.qmd  (vanilla Quarto front matter)
"""

import os
import re
import shutil
import sys
from pathlib import Path

# ── paths ──────────────────────────────────────────────────────────────────────
REPO_ROOT   = Path(__file__).parent.parent          # ~/src/websites/
MDX_SRC     = REPO_ROOT / "wayward-house/src/content/essays"
QMD_SRC     = REPO_ROOT / "waywardhouse-site/articles"
IMAGES_SRC  = REPO_ROOT / "waywardhouse-site/assets/images"
OUT_DIR     = REPO_ROOT / "wh-essays/wh-essays"
IMAGES_OUT  = OUT_DIR / "assets/images"

# Fields to drop from any source
DROP_KEYS = {
    "type", "article-series", "article-sequence", "body-classes", "interactive",
    "tags", "readTime", "heroImage", "heroTreatment", "featured", "draft",
    "last_modified_at", "excerpt",
}

# Old-site signals slugs — skip these here
SIGNALS_SLUGS = {"system-signals-001", "system-signals-002",
                  "system-signals-003", "system-signals-004"}

# Old-site non-essay files to skip
SKIP_SLUGS = {"feed", "index"} | SIGNALS_SLUGS


def parse_front_matter(text: str) -> tuple[dict, str]:
    """Split YAML front matter from body. Returns (raw_lines_dict, body)."""
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end == -1:
        return {}, text
    fm_raw = text[3:end].strip()
    body = text[end + 4:].lstrip("\n")
    # Simple line-by-line parser — good enough for flat + list YAML
    lines = fm_raw.splitlines()
    result = {}
    current_key = None
    list_items = []
    for line in lines:
        # list item
        if line.startswith("  - ") or line.startswith("- "):
            item = re.sub(r"^\s*-\s*", "", line).strip().strip('"').strip("'")
            list_items.append(item)
            continue
        # key: value
        m = re.match(r'^(\S[^:]*?):\s*(.*)', line)
        if m:
            if current_key and list_items:
                result[current_key] = list_items
                list_items = []
            current_key = m.group(1).strip()
            val = m.group(2).strip().strip('"').strip("'")
            # strip YAML block scalar markers (>, |) — content comes on next lines
            if val in (">", "|", ">-", "|-"):
                val = ""
            if val:
                result[current_key] = val
            # else wait for list items on following lines
        elif line.startswith("  ") and current_key and not list_items:
            # multiline scalar continuation — append
            existing = result.get(current_key, "")
            result[current_key] = (existing + " " + line.strip()).strip()
    if current_key and list_items:
        result[current_key] = list_items
    return result, body


def normalise_topics(fm: dict) -> list[str]:
    """Produce a clean categories list from topics/tags."""
    raw = fm.get("topics", [])
    if isinstance(raw, str):
        # "[Urban Geography]" inline list
        raw = re.findall(r'[\w\s\-]+', raw)
    cats = []
    for t in raw:
        t = t.strip().strip('"').strip("'")
        if t:
            cats.append(t)
    return cats


def clean_image_path(val: str) -> str:
    """Convert /assets/images/foo.jpg → assets/images/foo.jpg."""
    return val.lstrip("/")


def build_fm_qmd(fm: dict, source: str) -> str:
    """Build clean Quarto front matter string."""
    out = {}

    # title
    out["title"] = fm.get("title", "Untitled")

    # subtitle: prefer subtitle, fall back to dek
    sub = fm.get("subtitle") or fm.get("dek")
    if sub:
        out["subtitle"] = sub

    # date
    date = fm.get("date") or fm.get("pubDate")
    if date:
        out["date"] = date

    # description
    desc = fm.get("description")
    if desc:
        out["description"] = desc

    # categories (from topics)
    cats = normalise_topics(fm)
    if cats:
        out["categories"] = cats

    # image
    img = fm.get("image")
    if img and not img.startswith("http"):
        out["image"] = clean_image_path(img)

    # toc
    out["toc"] = True

    return out


def serialise_fm(d: dict) -> str:
    lines = ["---"]
    for k, v in d.items():
        if isinstance(v, list):
            lines.append(f"{k}:")
            for item in v:
                lines.append(f"  - \"{item}\"")
        elif isinstance(v, bool):
            lines.append(f"{k}: {str(v).lower()}")
        else:
            sv = str(v)
            # Long description/subtitle → block scalar to avoid quoting headaches
            if k in ("description", "subtitle") and len(sv) > 80:
                lines.append(f"{k}: >")
                # wrap at ~72 chars
                words = sv.split()
                line_buf = "  "
                for w in words:
                    if len(line_buf) + len(w) + 1 > 74:
                        lines.append(line_buf.rstrip())
                        line_buf = "  " + w + " "
                    else:
                        line_buf += w + " "
                if line_buf.strip():
                    lines.append(line_buf.rstrip())
            elif any(c in sv for c in [':', '#', '[', ']', '{', '}']):
                lines.append(f'{k}: "{sv}"')
            else:
                lines.append(f"{k}: {sv}")
    lines.append("---")
    return "\n".join(lines)


def migrate_mdx(path: Path) -> tuple[str, str]:
    """Returns (slug, qmd_content)."""
    slug = path.stem
    text = path.read_text(encoding="utf-8")
    fm, body = parse_front_matter(text)
    out_fm = build_fm_qmd(fm, "mdx")
    return slug, serialise_fm(out_fm) + "\n\n" + body.strip() + "\n"


def migrate_qmd(path: Path) -> tuple[str, str]:
    """Returns (slug, qmd_content)."""
    slug = path.stem
    text = path.read_text(encoding="utf-8")
    fm, body = parse_front_matter(text)
    out_fm = build_fm_qmd(fm, "qmd")
    return slug, serialise_fm(out_fm) + "\n\n" + body.strip() + "\n"


def copy_images(fm_list: list[dict]):
    """Copy referenced images from old site assets."""
    IMAGES_OUT.mkdir(parents=True, exist_ok=True)
    for fm in fm_list:
        img = fm.get("image")
        if img and not img.startswith("http"):
            img_path = IMAGES_SRC / Path(img).name
            if img_path.exists():
                shutil.copy2(img_path, IMAGES_OUT / img_path.name)
                print(f"  [img] copied {img_path.name}")
            else:
                print(f"  [img] NOT FOUND: {img_path}")


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    written = []
    all_fm = []

    # ── Canonical source: old site QMD essays only ────────────────────────────
    # Astro hub MDX essays are filler/placeholder — do NOT use them.
    print("=== Migrating QMD essays from waywardhouse-site ===")
    for qmd in sorted(QMD_SRC.glob("*.qmd")):
        slug = qmd.stem
        if slug in SKIP_SLUGS:
            continue
        slug_out, content = migrate_qmd(qmd)
        out_path = OUT_DIR / f"{slug_out}.qmd"
        out_path.write_text(content, encoding="utf-8")
        print(f"  {slug_out}.qmd  ← {qmd.name}")
        written.append(slug_out)
        fm, _ = parse_front_matter(qmd.read_text())
        all_fm.append(fm)

    # ── 3. Copy images ────────────────────────────────────────────────────────
    print(f"\n=== Copying images ===")
    copy_images(all_fm)

    print(f"\n✓ Done. {len(written)} essays written to {OUT_DIR}")
    for s in sorted(written):
        print(f"  {s}")


if __name__ == "__main__":
    main()
