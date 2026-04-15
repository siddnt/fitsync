from __future__ import annotations

import html
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
INPUT_MD = ROOT / "docs" / "ddd-design.md"
OUTPUT_HTML = ROOT / "docs" / "ddd-design.export.html"
OUTPUT_PDF = ROOT / "docs" / "ddd-design.pdf"


def resolve_asset_src(src: str) -> str:
    if re.match(r"^(?:https?:|data:|file:)", src):
        return src
    return (INPUT_MD.parent / src).resolve().as_uri()


def format_inline(text: str) -> str:
    escaped = html.escape(text)
    escaped = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", escaped)
    escaped = re.sub(r"`([^`]+)`", r"<code>\1</code>", escaped)
    return escaped


def collect_paragraph(lines: list[str], start: int) -> tuple[str, int]:
    parts: list[str] = []
    index = start
    while index < len(lines):
        line = lines[index]
        if not line.strip():
            break
        stripped = line.lstrip()
        if (
            stripped.startswith("#")
            or stripped == "---"
            or stripped.startswith("![")
            or stripped.startswith("|")
            or stripped.startswith("- ")
            or re.match(r"^\d+\.\s+", stripped)
            or stripped.startswith("```")
        ):
            break
        parts.append(line.strip())
        index += 1
    return " ".join(parts), index


def parse_table_row(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def build_html(markdown_text: str) -> str:
    lines = markdown_text.splitlines()
    body: list[str] = []
    index = 0

    while index < len(lines):
        raw = lines[index]
        line = raw.strip()

        if not line:
            index += 1
            continue

        if line.startswith("### "):
            body.append(f"<h3>{format_inline(line[4:])}</h3>")
            index += 1
            continue

        if line.startswith("## "):
            body.append(f"<h2>{format_inline(line[3:])}</h2>")
            index += 1
            continue

        if line.startswith("# "):
            body.append(f"<h1>{format_inline(line[2:])}</h1>")
            index += 1
            continue

        if line == "---":
            body.append("<hr />")
            index += 1
            continue

        image_match = re.match(r"!\[(.*?)\]\((.*?)\)", line)
        if image_match:
            alt, src = image_match.groups()
            body.append(
                f'<figure class="diagram"><img src="{html.escape(resolve_asset_src(src))}" '
                f'alt="{html.escape(alt)}" /></figure>'
            )
            index += 1
            continue

        if line.startswith("|"):
            table_lines: list[str] = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                table_lines.append(lines[index].strip())
                index += 1

            if len(table_lines) >= 2:
                headers = parse_table_row(table_lines[0])
                rows = [parse_table_row(entry) for entry in table_lines[2:]]
                table_parts = ["<table><thead><tr>"]
                table_parts.extend(f"<th>{format_inline(cell)}</th>" for cell in headers)
                table_parts.append("</tr></thead><tbody>")
                for row in rows:
                    table_parts.append("<tr>")
                    table_parts.extend(f"<td>{format_inline(cell)}</td>" for cell in row)
                    table_parts.append("</tr>")
                table_parts.append("</tbody></table>")
                body.append("".join(table_parts))
            continue

        if re.match(r"^\d+\.\s+", line):
            body.append("<ol>")
            while index < len(lines) and re.match(r"^\d+\.\s+", lines[index].strip()):
                current = lines[index].strip()
                item_text = re.sub(r"^\d+\.\s+", "", current)
                index += 1
                detail_lines: list[str] = []
                while index < len(lines):
                    next_line = lines[index]
                    if not next_line.strip():
                        index += 1
                        break
                    if re.match(r"^\d+\.\s+", next_line.strip()) or next_line.strip().startswith(("### ", "## ", "# ", "|", "![", "- ", "---")):
                        break
                    detail_lines.append(next_line.strip())
                    index += 1

                detail = f"<div class='list-detail'>{format_inline(' '.join(detail_lines))}</div>" if detail_lines else ""
                body.append(f"<li>{format_inline(item_text)}{detail}</li>")
            body.append("</ol>")
            continue

        if line.startswith("- "):
            body.append("<ul>")
            while index < len(lines) and lines[index].strip().startswith("- "):
                item = lines[index].strip()[2:]
                body.append(f"<li>{format_inline(item)}</li>")
                index += 1
            body.append("</ul>")
            continue

        if line.startswith("```"):
            fence = line
            index += 1
            code_lines: list[str] = []
            while index < len(lines) and lines[index].strip() != fence:
                code_lines.append(lines[index])
                index += 1
            index += 1
            code_html = html.escape("\n".join(code_lines))
            body.append(f"<pre><code>{code_html}</code></pre>")
            continue

        paragraph, index = collect_paragraph(lines, index)
        if paragraph:
            body.append(f"<p>{format_inline(paragraph)}</p>")
            continue

        index += 1

    styles = """
    @page { size: A4; margin: 10mm 10mm; }
    body {
      font-family: "Segoe UI", Arial, sans-serif;
      color: #0f172a;
      line-height: 1.45;
      font-size: 11.5px;
      margin: 0;
      padding: 0;
    }
    main {
      max-width: none;
      margin: 0;
    }
    h1, h2, h3 {
      color: #0f172a;
      margin-top: 14px;
      margin-bottom: 6px;
      page-break-after: auto;
      break-after: auto;
    }
    h1 { font-size: 22px; border-bottom: 2px solid #cbd5e1; padding-bottom: 5px; }
    h2 { font-size: 17px; }
    h3 { font-size: 13px; }
    p { margin: 6px 0; text-align: justify; }
    hr { border: none; border-top: 1px solid #cbd5e1; margin: 14px 0; }
    strong { color: #111827; }
    code {
      font-family: Consolas, "Courier New", monospace;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 1px 4px;
      font-size: 11px;
    }
    pre {
      background: #0f172a;
      color: white;
      padding: 10px 12px;
      border-radius: 8px;
      overflow: hidden;
      white-space: pre-wrap;
      page-break-inside: avoid;
    }
    pre code {
      background: transparent;
      border: 0;
      color: white;
      padding: 0;
    }
    ul, ol { margin: 6px 0 8px 18px; padding: 0; }
    li { margin: 3px 0; }
    .list-detail { margin-top: 4px; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0 12px;
      font-size: 10.5px;
      page-break-inside: auto;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 6px 7px;
      vertical-align: top;
    }
    th {
      background: #e2e8f0;
      text-align: left;
    }
    tr { page-break-inside: avoid; }
    figure.diagram {
      margin: 6px 0 10px;
      padding: 0;
      border: 0;
      background: transparent;
      text-align: center;
      page-break-inside: avoid;
      break-inside: avoid-page;
    }
    figure.diagram img {
      max-width: 100%;
      max-height: 205mm;
      width: auto;
      height: auto;
      display: inline-block;
    }
    """

    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>FitSync DDD Design</title>
    <style>{styles}</style>
  </head>
  <body>
    <main>
      {''.join(body)}
    </main>
  </body>
</html>
"""


def find_edge() -> Path:
    candidates = [
        Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
        Path(r"C:\Program Files (x86)\Microsoft\Copilot\Application\msedge.exe"),
        Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    raise FileNotFoundError("Neither Microsoft Edge nor Google Chrome was found.")


def main() -> None:
    markdown_text = INPUT_MD.read_text(encoding="utf-8")
    OUTPUT_HTML.write_text(build_html(markdown_text), encoding="utf-8")

    browser = find_edge()
    cmd = [
        str(browser),
        "--headless",
        "--disable-gpu",
        "--allow-file-access-from-files",
        "--print-to-pdf-no-header",
        "--virtual-time-budget=8000",
        f"--print-to-pdf={OUTPUT_PDF}",
        OUTPUT_HTML.resolve().as_uri(),
    ]
    subprocess.run(cmd, check=True)

    if not OUTPUT_PDF.exists():
        raise FileNotFoundError(f"PDF was not created at {OUTPUT_PDF}")

    print(f"PDF created at {OUTPUT_PDF}")


if __name__ == "__main__":
    main()
