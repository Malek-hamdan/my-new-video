#!/bin/bash
# UII Parts: update the page and server to a fixed, checked version. The data is kept (a copy is taken first).
# If the new version does not start properly, the old one is put back by itself.
set -euo pipefail
umask 077

REV="5c3c54eb8e1bedfe7b87a69e54db1c7dc32755bb"
SUM_SERVER="c20eda2b2eb37cbf5d5d77a9e500398fc9d9f0b87aff30bbcbec226f8aaa042b"
SUM_PAGE="de32546379d824960321d46589749417dfcd74d68a678bad964290386a28b406"
ASSETS="manifest.webmanifest:40bec7e1780bc6d073ba70c1dd65276319bf51c0bc16e5679ca17cb131e311eb icon-192.png:79f941979922fc3e432eda86ae40d11652a0f1b8b6838a65e1037851c2fdb6a5 icon-512.png:5fa63fbc6f6d88d7635cc43b938e9d928f0614ac8174c463801d95aa2a64d91d icon-maskable-512.png:35be84a9550cc1c60fd3f8482c02038c23dc284fcab4b630387571644f308535 apple-touch-icon.png:efaee9db10aae282818246c01e84c7a11db6d4f9d52546452563db513fd9eba7 favicon-32.png:0c1fa49992ae2cea934d28b0a9b4dbecb1692cca1c6fb228d80bba4d29952e24 favicon.ico:0c1fa49992ae2cea934d28b0a9b4dbecb1692cca1c6fb228d80bba4d29952e24"
# Node.js: a supported long-term version, from nodejs.org, checked against its fingerprint
NODE_VER="v24.22.3"
NODE_SUM="4f2b175a6d53a5c617a80dba2676238a0688cef28c6da4eba35c7d844e66fcfb"

RAW="${UII_RAW:-https://raw.githubusercontent.com/Malek-hamdan/my-new-video/$REV/uii-server}"
NODE_URL="${UII_NODE_URL:-https://nodejs.org/dist/$NODE_VER/node-$NODE_VER-linux-x64.tar.xz}"
R="${UII_ROOT:-}"                                   # empty on the server; a test folder when this script is tested
APP="$R/opt/uii-parts"; PREV="$R/opt/uii-parts-prev"; NODEDIR="$R/opt/node"
DATA="$R/var/lib/uii-parts"; BAK="$R/var/backups/uii-parts"
UNIT="$R/etc/systemd/system/uii-parts.service"; CADDYF="$R/etc/caddy/Caddyfile"; HELPER="$R/usr/local/bin/uii-admin"
PORT=3000
say() { echo; echo "==> $*"; }
die() { echo "STOPPED: $*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || [ -n "$R" ] || die "run this as root"
[ "$(uname -m)" = x86_64 ] || die "this server is not x86_64"
[ -d "$APP" ] && [ -d "$DATA" ] || die "UII Parts is not installed here"

# a private working folder (not a shared /tmp name that someone else could point somewhere)
mkdir -p "$R/root"
T="$(mktemp -d "$R/root/uii-update.XXXXXX")"
trap 'rm -rf "$T"' EXIT
chmod 700 "$T"

say "1/7 Downloading and checking the new files"
curl -fsSL "$RAW/server.js" -o "$T/server.js"
curl -fsSL "$RAW/public/index.html" -o "$T/index.html"
echo "$SUM_SERVER  $T/server.js" | sha256sum -c --quiet
echo "$SUM_PAGE  $T/index.html" | sha256sum -c --quiet
for a in $ASSETS; do f="${a%%:*}"; curl -fsSL "$RAW/public/$f" -o "$T/asset-$f"; echo "${a#*:}  $T/asset-$f" | sha256sum -c --quiet; done

say "2/7 Node.js $NODE_VER"
if [ ! -x "$NODEDIR/bin/node" ] || [ "$("$NODEDIR/bin/node" -v)" != "$NODE_VER" ]; then
  curl -fsSL "$NODE_URL" -o "$T/node.tar.xz"
  echo "$NODE_SUM  $T/node.tar.xz" | sha256sum -c --quiet
  mkdir "$T/nodex" && tar xJf "$T/node.tar.xz" -C "$T/nodex" --strip-components=1
  [ "$("$T/nodex/bin/node" -v)" = "$NODE_VER" ] || die "the downloaded Node.js is not $NODE_VER"
  chmod -R a+rX "$T/nodex"
  rm -rf "$NODEDIR.old"
  if [ -d "$NODEDIR" ]; then mv "$NODEDIR" "$NODEDIR.old"; fi
  mv "$T/nodex" "$NODEDIR"
  rm -rf "$NODEDIR.old"
else
  echo "already installed"
fi

say "3/7 Copy of the data and of the current version (so nothing is lost)"
mkdir -p "$BAK"; chmod 700 "$BAK"
chmod 600 "$BAK"/*.tgz 2>/dev/null || true
tar czf "$BAK/before-update-$(date +%F-%H%M).tgz" --exclude=./lock -C "$DATA" .
find "$BAK" -name 'before-update-*.tgz' -mtime +60 -delete
rm -rf "$PREV"; mkdir -p "$PREV"
cp -a "$APP" "$PREV/app"
for f in "$UNIT:unit" "$CADDYF:Caddyfile" "$HELPER:uii-admin" "$R/etc/cron.daily/uii-parts-backup:backup"; do
  if [ -f "${f%%:*}" ]; then cp -a "${f%%:*}" "$PREV/${f#*:}"; fi
done

say "4/7 Installing"
install -d -m 755 "$APP" "$APP/public"
install -m 644 "$T/server.js" "$APP/server.js"
install -m 644 "$T/index.html" "$APP/public/index.html"
for a in $ASSETS; do f="${a%%:*}"; install -m 644 "$T/asset-$f" "$APP/public/$f"; done
chown -R uii:uii "$DATA"; chmod 700 "$DATA"

# the nightly copy: private files, kept 30 days
cat > "$R/etc/cron.daily/uii-parts-backup" <<'CRON'
#!/bin/bash
umask 077
mkdir -p /var/backups/uii-parts && chmod 700 /var/backups/uii-parts
tar czf /var/backups/uii-parts/data-$(date +%F).tgz --exclude=./lock -C /var/lib/uii-parts .
find /var/backups/uii-parts -name 'data-*.tgz' -mtime +30 -delete
CRON
chmod 755 "$R/etc/cron.daily/uii-parts-backup"

# the helper that makes or resets an admin: stops the service, runs as the uii user, starts the service again whatever happens
cat > "$HELPER" <<'HELP'
#!/bin/bash
set -e
[ "$(id -u)" = 0 ] || { echo "Run it as root."; exit 1; }
systemctl stop uii-parts
trap 'systemctl start uii-parts' EXIT
sudo -u uii env DATA=/var/lib/uii-parts /opt/node/bin/node /opt/uii-parts/server.js make-admin || true
HELP
chmod 755 "$HELPER"

# the service: own limits, and no more rights than it needs
cat > "$UNIT" <<'UNITFILE'
[Unit]
Description=UII Parts
After=network.target

[Service]
User=uii
Environment=PORT=3000
Environment=DATA=/var/lib/uii-parts
ExecStart=/opt/node/bin/node /opt/uii-parts/server.js
Restart=always
RestartSec=2
UMask=0077
MemoryHigh=300M
MemoryMax=400M
TasksMax=64
LimitNOFILE=2048
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/uii-parts
PrivateTmp=true
PrivateDevices=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
ProtectClock=true
ProtectHostname=true
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
RestrictNamespaces=true
RestrictRealtime=true
LockPersonality=true
CapabilityBoundingSet=
SystemCallArchitectures=native

[Install]
WantedBy=multi-user.target
UNITFILE
chmod 644 "$UNIT"

say "5/7 The web address settings (HTTPS front)"
if [ -f "$CADDYF" ]; then
  HOST="$(grep -m1 -oE '^[A-Za-z0-9.-]+\.sslip\.io' "$CADDYF" || true)"
  if [ -n "$HOST" ]; then
    cat > "$T/Caddyfile" <<CADDY
$HOST {
	encode gzip
	request_body {
		max_size 2MB
	}
	header -Server
	reverse_proxy 127.0.0.1:$PORT
}
CADDY
    if caddy validate --config "$T/Caddyfile" --adapter caddyfile >/dev/null 2>&1; then
      if ! cmp -s "$T/Caddyfile" "$CADDYF"; then install -m 644 "$T/Caddyfile" "$CADDYF"; systemctl reload caddy || echo "(Caddy did not reload: it is checked below)"; fi
    else
      echo "The new Caddy settings did not check out: left as they were."
    fi
  else
    echo "No address found in the Caddy file: left as it was."
  fi
fi

say "6/7 Starting the new version"
systemctl daemon-reload
systemctl restart uii-parts

say "7/7 Checking that it really works (page fingerprint, sign-in endpoint, icons)"
healthy() {
  systemctl is-active --quiet uii-parts || return 1
  curl -fsS --max-time 5 "http://127.0.0.1:$PORT/" -o "$T/h.html" 2>/dev/null || return 1
  [ "$(sha256sum < "$T/h.html" | cut -d' ' -f1)" = "$SUM_PAGE" ] || return 1
  [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$PORT/api/me")" = 401 ] || return 1
  for a in $ASSETS; do [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$PORT/${a%%:*}")" = 200 ] || return 1; done
}
ok=0
for i in $(seq 1 25); do if healthy; then ok=1; break; fi; sleep 1; done

if [ "$ok" != 1 ]; then
  echo
  echo "The new version did not start properly. Putting the old one back..."
  systemctl --no-pager status uii-parts 2>/dev/null | tail -12 || true
  rm -rf "$APP"; cp -a "$PREV/app" "$APP"
  for f in "unit:$UNIT" "Caddyfile:$CADDYF" "uii-admin:$HELPER" "backup:$R/etc/cron.daily/uii-parts-backup"; do
    if [ -f "$PREV/${f%%:*}" ]; then cp -a "$PREV/${f%%:*}" "${f#*:}"; fi
  done
  systemctl reload caddy 2>/dev/null || true
  systemctl daemon-reload
  systemctl restart uii-parts
  sleep 3
  if systemctl is-active --quiet uii-parts; then echo "THE OLD VERSION IS RUNNING AGAIN. Your data is as it was. Send the lines above to Claude."; else echo "The old version is not running either. Send ALL the lines above to Claude."; fi
  exit 1
fi
curl -fsS --max-time 10 -o /dev/null "https://$(grep -m1 -oE '^[A-Za-z0-9.-]+\.sslip\.io' "$CADDYF" 2>/dev/null || echo localhost)/" 2>/dev/null || echo "(Note: the address from outside did not answer yet; the server itself is fine. Try the site in a minute.)"
echo
echo "UPDATED to ${REV:0:7}. Node.js $("$NODEDIR/bin/node" -v). Reload the site (Ctrl + Shift + R)."
