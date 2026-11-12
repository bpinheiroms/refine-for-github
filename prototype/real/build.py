"""Test bench with real GitHub HTML.

Downloads public pull request pages, strips GitHub's scripts (only the HTML the
server rendered is kept) and injects the whole extension: refine.css,
settings.js, cockpit.js and content.js. No API: the extension only reads the page.

    python3 prototype/real/build.py BridgLabs/opencodereview 104 101
    cd prototype/real && python3 -m http.server 8766
    → http://127.0.0.1:8766/BridgLabs/opencodereview/pull/104/

The URL must look like /owner/repo/pull/N because that is what the extension reads.

Logged-in page (new Overview, rendered by React): save the DOM in the browser and
pass the file instead of the number:

    python3 prototype/real/build.py BridgLabs/opencodereview ~/Downloads/pr-81.html
"""
import pathlib, re, subprocess, sys

here = pathlib.Path(__file__).parent
ext = here.parent.parent / "extension"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131 Safari/537.36"

STUB = """<script>
window.chrome = { storage: { sync: { get(d, cb) { cb(d); } }, onChanged: { addListener() {} } } };
</script>
<link rel="stylesheet" href="/__ext/src/refine.css">
<script src="/__ext/src/settings.js"></script>
<script src="/__ext/src/cockpit.js"></script>
<script src="/__ext/src/content.js"></script>"""

def build(owner, repo, number, saved=None):
    if saved:
        html = saved.read_text()
    else:
        html = subprocess.run(["curl", "-sL", "-A", UA, f"https://github.com/{owner}/{repo}/pull/{number}"],
                              check=True, capture_output=True, text=True).stdout
    html = re.sub(r"<script\b[^>]*>.*?</script>", "", html, flags=re.S)  # rendered HTML only
    if saved:  # saved with the extension on: drop its nodes and tags, the bench re-runs it
        html = re.sub(r'<(aside|section) id="gr-(panel|cockpit)".*?</\1>', "", html, flags=re.S)
        html = re.sub(r'<(button|span) [^>]*class="gr-(copy-link|net|am-btn|pr-num)".*?</\1>', "", html, flags=re.S)
        html = re.sub(r'\sdata-gr-[\w-]+(="[^"]*")?', "", html)
        html = re.sub(r'<link rel="stylesheet" href="chrome-extension://[^"]*">', "", html)
    html = html.replace("</head>", STUB + "</head>", 1)
    out = here / owner / repo / "pull" / str(number)
    out.mkdir(parents=True, exist_ok=True)
    (out / "index.html").write_text(html)
    # Collapsed conversations: GitHub loads them on demand; keep a local copy.
    for tid in set(re.findall(rf"/{owner}/{repo}/pull/{number}/threads/(\d+)", html)):
        frag = subprocess.run(["curl", "-sL", "-A", UA, "-H", "Accept: text/html",
                               f"https://github.com/{owner}/{repo}/pull/{number}/threads/{tid}?rendering_on_files_tab=false"],
                              check=True, capture_output=True, text=True).stdout
        (out / "threads").mkdir(exist_ok=True)
        (out / "threads" / tid).write_text(frag)
    print(f"{owner}/{repo}#{number}: {len(html)//1024} KB")

if __name__ == "__main__":
    link = here / "__ext"  # points to extension/, so editing the extension only needs a reload
    if not link.exists():
        link.symlink_to(ext, target_is_directory=True)
    owner, repo = sys.argv[1].split("/")
    for n in sys.argv[2:]:
        f = pathlib.Path(n).expanduser()
        if f.is_file():  # DOM saved from the browser: the number comes from the file name (pr-81.html)
            build(owner, repo, int(re.search(r"(\d+)", f.stem).group(1)), f)
        else:
            build(owner, repo, int(n))
