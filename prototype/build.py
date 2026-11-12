"""Gera versões em arquivo único dos protótipos (CSS/JS da extensão embutidos).

    python3 prototype/build.py   →  prototype/dist/index.html, prototype/dist/overview.html
"""
import pathlib, re
here = pathlib.Path(__file__).parent
ext = here.parent / "extension" / "src"
out = here / "dist"
out.mkdir(exist_ok=True)

def inline(html: str) -> str:
    html = html.replace('<link rel="stylesheet" href="../extension/src/refine.css" />',
                        "<style>" + (ext / "refine.css").read_text() + "</style>")
    for name in ["settings.js", "content.js"]:
        html = html.replace(f'<script src="../extension/src/{name}"></script>',
                            "<script>" + (ext / name).read_text() + "</script>")
    html = html.replace('<script src="stub.js"></script>', "<script>" + (here / "stub.js").read_text() + "</script>")
    return html

def compact(html: str) -> str:
    html = re.sub(r"/\*.*?\*/", "", html, flags=re.S)
    html = re.sub(r"<!--.*?-->", "", html, flags=re.S)
    html = re.sub(r"(^|\n)\s*//[^\n]*", r"\1", html)
    return re.sub(r"\n\s*\n+", "\n", html)

for name in ["index.html", "overview.html"]:
    html = inline((here / name).read_text())
    (out / name).write_text(html)
    (out / name.replace(".html", ".min.html")).write_text(compact(html))
    print(name, len(html))
