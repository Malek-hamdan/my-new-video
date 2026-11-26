#!/usr/bin/env python3
"""Fill the version and the fingerprints into setup.sh and update.sh.

    python3 uii-server/release.py <commit>      fingerprints of the files as they are in that commit (what the server will download)
    python3 uii-server/release.py --worktree    fingerprints of the files on disk (for testing the scripts here)

The commit must already be pushed: the scripts download from it, and refuse anything that does not match.
"""
import hashlib, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
ASSET_FILES = ["manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png", "favicon-32.png", "favicon.ico"]

if len(sys.argv) != 2:
    sys.exit(__doc__)
arg = sys.argv[1]

def blob(rel):
    if arg == "--worktree":
        return open(os.path.join(REPO, rel), "rb").read()
    return subprocess.check_output(["git", "-C", REPO, "show", arg + ":" + rel])

def sha(rel):
    return hashlib.sha256(blob(rel)).hexdigest()

rev = "0" * 40 if arg == "--worktree" else subprocess.check_output(["git", "-C", REPO, "rev-parse", arg], text=True).strip()
vals = {
    "REV": rev,
    "SUM_SERVER": sha("uii-server/server.js"),
    "SUM_PAGE": sha("uii-server/public/index.html"),
    "ASSETS": " ".join(f + ":" + sha("uii-server/public/" + f) for f in ASSET_FILES),
}
for name in ("update.sh", "setup.sh"):
    path = os.path.join(HERE, name)
    s = open(path).read()
    for k, v in vals.items():
        s, n = re.subn(r'(?m)^%s="[^"]*"$' % k, '%s="%s"' % (k, v), s)
        if n != 1:
            sys.exit("%s: expected one %s line, found %d" % (name, k, n))
    open(path, "w").write(s)
print(("working files" if arg == "--worktree" else "commit " + rev[:7]) + ": " + ", ".join(k + "=" + v[:12] for k, v in vals.items() if k != "ASSETS"))
