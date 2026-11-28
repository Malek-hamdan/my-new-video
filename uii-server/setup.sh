#!/bin/bash
# UII Parts server: one-time setup on a fresh Ubuntu 24.04 droplet. Run as root.
# Installs: swap, firewall, fail2ban, Node.js (a supported long-term version), Caddy (HTTPS), the UII Parts service,
# daily data copies, then asks for the first admin's username and password (typed here, never stored in a file).
set -euo pipefail

REV="d669a038dabac9a0dbee5f7500ca1deb864c90cc"
SUM_SERVER="9dab9f2383f9dd79cbaf206603f83e0d481d6e48e0f3a3110dcb64dbe6bcc3e4"
SUM_PAGE="862836af45241095a0c4224ec315b7d33e878fa78d63a882a49d4613483fae19"
ASSETS="manifest.webmanifest:40bec7e1780bc6d073ba70c1dd65276319bf51c0bc16e5679ca17cb131e311eb icon-192.png:79f941979922fc3e432eda86ae40d11652a0f1b8b6838a65e1037851c2fdb6a5 icon-512.png:5fa63fbc6f6d88d7635cc43b938e9d928f0614ac8174c463801d95aa2a64d91d icon-maskable-512.png:35be84a9550cc1c60fd3f8482c02038c23dc284fcab4b630387571644f308535 apple-touch-icon.png:efaee9db10aae282818246c01e84c7a11db6d4f9d52546452563db513fd9eba7 favicon-32.png:0c1fa49992ae2cea934d28b0a9b4dbecb1692cca1c6fb228d80bba4d29952e24 favicon.ico:0c1fa49992ae2cea934d28b0a9b4dbecb1692cca1c6fb228d80bba4d29952e24 sw.js:c1f725de4bfc6c88b8a52846ad461a0c271c762acecd3a20f2c36e772aa35b67"
# Node.js: from nodejs.org, checked against its fingerprint (the same version as update.sh)
NODE_VER="v24.22.3"
NODE_SUM="4f2b175a6d53a5c617a80dba2676238a0688cef28c6da4eba35c7d844e66fcfb"

RAW="https://raw.githubusercontent.com/Malek-hamdan/my-new-video/$REV/uii-server"
NODE_URL="https://nodejs.org/dist/$NODE_VER/node-$NODE_VER-linux-x64.tar.xz"
step() { echo; echo "==> $*"; }
die() { echo "STOPPED: $*" >&2; exit 1; }
[ "$(id -u)" = 0 ] || die "run this as root"
[ "$(uname -m)" = x86_64 ] || die "this script is for an x86_64 server"

# a private working folder (not a shared /tmp name that someone else could point somewhere)
T="$(mktemp -d /root/uii-setup.XXXXXX)"
trap 'rm -rf "$T"' EXIT
chmod 700 "$T"

IP="$(curl -fsS --max-time 3 http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address || true)"
[ -n "$IP" ] || IP="$(hostname -I | awk '{print $1}')"
HOST="$(echo "$IP" | tr . -).sslip.io"
export DEBIAN_FRONTEND=noninteractive

step "1/8 Swap (1 GB) so the small server never runs out of memory"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

step "2/8 Packages: firewall, fail2ban, tools"
apt-get -o DPkg::Lock::Timeout=600 update -q
apt-get -o DPkg::Lock::Timeout=600 install -y -q ufw fail2ban curl gnupg sudo xz-utils debian-keyring debian-archive-keyring apt-transport-https

step "3/8 Node.js $NODE_VER (checked against its fingerprint)"
curl -fsSL "$NODE_URL" -o "$T/node.tar.xz"
echo "$NODE_SUM  $T/node.tar.xz" | sha256sum -c --quiet
mkdir "$T/nodex" && tar xJf "$T/node.tar.xz" -C "$T/nodex" --strip-components=1
[ "$("$T/nodex/bin/node" -v)" = "$NODE_VER" ] || die "the downloaded Node.js is not $NODE_VER"
chmod -R a+rX "$T/nodex"
rm -rf /opt/node; mv "$T/nodex" /opt/node

step "4/8 Caddy (gives the site HTTPS by itself)"
if ! command -v caddy >/dev/null; then
  curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get -o DPkg::Lock::Timeout=600 update -q && apt-get -o DPkg::Lock::Timeout=600 install -y -q caddy
fi

step "5/8 UII Parts files (checked against their fingerprints)"
id uii >/dev/null 2>&1 || useradd --system --home /var/lib/uii-parts --shell /usr/sbin/nologin uii
install -d -m 755 /opt/uii-parts /opt/uii-parts/public
install -d -m 700 /var/lib/uii-parts /var/backups/uii-parts
curl -fsSL "$RAW/server.js" -o "$T/server.js"
curl -fsSL "$RAW/public/index.html" -o "$T/index.html"
echo "$SUM_SERVER  $T/server.js" | sha256sum -c --quiet
echo "$SUM_PAGE  $T/index.html" | sha256sum -c --quiet
install -m 644 "$T/server.js" /opt/uii-parts/server.js
install -m 644 "$T/index.html" /opt/uii-parts/public/index.html
for a in $ASSETS; do f="${a%%:*}"; curl -fsSL "$RAW/public/$f" -o "$T/asset-$f"; echo "${a#*:}  $T/asset-$f" | sha256sum -c --quiet; install -m 644 "$T/asset-$f" "/opt/uii-parts/public/$f"; done
chown -R uii:uii /var/lib/uii-parts
chmod 700 /var/lib/uii-parts

step "6/8 Service (starts by itself after a reboot, with its own limits)"
cat > /etc/systemd/system/uii-parts.service <<'UNIT'
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
UNIT
chmod 644 /etc/systemd/system/uii-parts.service
# helper to make or reset an admin later:  uii-admin  (stops the service, runs as the uii user, starts the service again whatever happens)
cat > /usr/local/bin/uii-admin <<'HELP'
#!/bin/bash
set -e
[ "$(id -u)" = 0 ] || { echo "Run it as root."; exit 1; }
systemctl stop uii-parts
trap 'systemctl start uii-parts' EXIT
sudo -u uii env DATA=/var/lib/uii-parts /opt/node/bin/node /opt/uii-parts/server.js make-admin || true
HELP
chmod 755 /usr/local/bin/uii-admin

step "7/8 HTTPS address: https://$HOST, firewall (only SSH and the website), fail2ban"
cat > /etc/caddy/Caddyfile <<CADDY
$HOST {
	encode gzip
	request_body {
		max_size 2MB
	}
	header -Server
	reverse_proxy 127.0.0.1:3000
}
CADDY
chmod 644 /etc/caddy/Caddyfile
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
systemctl enable --now fail2ban >/dev/null

step "Daily copy of the data at night (private files), kept 30 days in /var/backups/uii-parts"
cat > /etc/cron.daily/uii-parts-backup <<'CRON'
#!/bin/bash
umask 077
mkdir -p /var/backups/uii-parts && chmod 700 /var/backups/uii-parts
tar czf /var/backups/uii-parts/data-$(date +%F).tgz --exclude=./lock -C /var/lib/uii-parts .
find /var/backups/uii-parts -name 'data-*.tgz' -mtime +30 -delete
CRON
chmod 755 /etc/cron.daily/uii-parts-backup

step "8/8 First admin account (type it here; it is not saved anywhere else)"
if [ ! -s /var/lib/uii-parts/c/users.json ]; then
  until sudo -u uii env DATA=/var/lib/uii-parts /opt/node/bin/node /opt/uii-parts/server.js make-admin; do echo "Try again."; done
else
  echo "Accounts already there: skipped. (To add or reset an admin later: uii-admin)"
fi

systemctl daemon-reload
systemctl enable --now uii-parts >/dev/null
systemctl restart uii-parts caddy
sleep 3
echo
# the page must come back exactly as it was checked
ok=0
for i in $(seq 1 25); do
  if systemctl is-active --quiet uii-parts && curl -fsS --max-time 5 http://127.0.0.1:3000/ -o "$T/h.html" 2>/dev/null && [ "$(sha256sum < "$T/h.html" | cut -d' ' -f1)" = "$SUM_PAGE" ]; then ok=1; break; fi
  sleep 1
done
if [ "$ok" = 1 ] && systemctl is-active --quiet caddy; then
  echo "DONE. Open:  https://$HOST"
  echo "(The first visit can take up to a minute while the HTTPS certificate is made.)"
else
  echo "Something did not start. Send the lines below to Claude:"
  systemctl --no-pager status uii-parts caddy | tail -30
fi
