Please do a SECURITY REVIEW of a small web system I run for my company's spare-parts store room. Do not rewrite it, do not send a new version, and do not send big code blocks. Find weaknesses and tell me about them.

**The code (public repository, read it directly):**
https://github.com/Malek-hamdan/my-new-video/tree/25518d715151f8e580debb13ad7e66ebbcdd18a7/uii-server

Files, in order of importance:
1. `uii-server/server.js`: the whole server (Node.js, no packages, about 300 lines)
2. `uii-server/shim.js`: the browser side of the link to the server (login, data reads and writes, live updates)
3. `uii-server/setup.sh` and `uii-server/update.sh`: how the server is installed and updated
4. `uii-roles-demo/auth.js`: accounts, permissions, approvals and Activity log in the page
5. `uii-server/build_server.py`: how the page is built
6. `uii-server/public/index.html`: the built page (large, single file; read only the parts you need)

**How it works**
- One DigitalOcean droplet (Ubuntu 24.04, 512 MB). Caddy in front with HTTPS on `<ip>.sslip.io`. Node listens on 127.0.0.1:3000 only. ufw allows 22, 80 and 443 only, and fail2ban is on.
- Data is stored as one JSON file per collection in /var/lib/uii-parts/c, written to a temp file and then renamed into place. Daily tar copy kept for 30 days.
- Accounts: the admin makes every account (there is no sign up). The browser sends SHA-256("uiird:"+username+":"+password), and the server stores scrypt of that value with a salt. The session is a random token in an HttpOnly, Secure, SameSite=Lax cookie lasting 90 days; the server keeps only the SHA-256 of the token.
- Each write must carry the header `X-UII: 1` (protection against cross-site requests). Sign-in is limited to 8 wrong tries per IP every 15 minutes.
- API: `/api/login`, `/api/logout`, `/api/me`, `/api/live` (Server-Sent Events), `GET/PUT/DELETE /api/c/<collection>/<id>`.
- Permissions per person: receive, transfer, edit, editRef, delete, order, export, backup, activity, users, needsOk, approve.

**Known limits (confirm or correct, and tell me how serious each one really is):**
- The server checks only: signed in; `users` permission to change accounts; "has at least one write permission" for other data; the Activity log cannot be deleted, and only the same user can overwrite an entry. The finer rules (e.g. a Storekeeper may only Receive/Transfer, and only through approval) are checked in the page, not on the server.
- "Open account" (an admin acting as another person) happens only in the page; the server session stays the admin's.
- The SHA-256 the browser sends acts like the password itself.
- The repository is public (code only; no data and no passwords in it).

**Check these, in this order:**
1. Can someone without an account read or change anything?
2. Can a signed-in person with few rights (Viewer, Storekeeper) do more than allowed by calling the API directly? Give concrete examples.
3. Sessions and cookies: theft, fixation, sign-out, a turned-off or deleted account, a changed password.
4. Input checks: collection and id names, path tricks, very large or strange JSON, prototype pollution (`__proto__`, `constructor`), names starting with `_`.
5. Denial of service on 512 MB: large bodies, many open `/api/live` connections, many collections, files growing forever.
6. Data safety: the file writes, a crash in the middle of a write, the backups, running `uii-admin` while the service runs.
7. Setup and update scripts: downloads pinned by commit and checked by SHA-256; systemd hardening; firewall; anything run as root that should not be.
8. The page: XSS (names, part names and Activity text come from users), and anything sensitive kept in localStorage or sessionStorage.
9. Anything else.

**How to answer**
A table, most serious first. One row per finding:
| # | Severity (Critical / High / Medium / Low) | File and line or function | What is wrong | How someone would use it (a short real example) | The fix (in words, 1 or 2 lines) |

Then:
- What you checked and found **fine** (short list), so I know it was covered.
- Mark anything you are **not sure** about as "unconfirmed", and keep it separate from real findings.
- No general advice that doesn't point to a specific place in this code.
