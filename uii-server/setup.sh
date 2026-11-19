#!/bin/bash
# UII Parts server: one-time setup on a fresh Ubuntu 24.04 droplet. Run as root.
# Installs: swap, firewall, fail2ban, Node.js, Caddy (HTTPS), the UII Parts service, daily data copies,
# then asks for the first admin's username and password (typed here, never stored in a file).
set -euo pipefail

REV="3f28383ba3402e9f704e832bf288766965c9f71c"
RAW="https://raw.githubusercontent.com/Malek-hamdan/my-new-video/$REV/uii-server"
SUM_SERVER="43cf075d8547f5a7a1495cf33d5d714b1416d28c4b380492467dcca605467bbd"
SUM_PAGE="c55ae1faece09f3af0daca475c0b52b87481625ddbfbfffe2ca39f39b2f06604"

IP="$(curl -fsS --max-time 3 http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address || true)"
[ -n "$IP" ] || IP="$(hostname -I | awk '{print $1}')"
HOST="$(echo "$IP" | tr . -).sslip.io"
export DEBIAN_FRONTEND=noninteractive
step() { echo; echo "==> $*"; }

step "1/8 Swap (1 GB) so the small server never runs out of memory"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

step "2/8 Packages: Node.js, firewall, fail2ban"
apt-get -o DPkg::Lock::Timeout=600 update -q
apt-get -o DPkg::Lock::Timeout=600 install -y -q nodejs ufw fail2ban curl gnupg debian-keyring debian-archive-keyring apt-transport-https

step "3/8 Caddy (gives the site HTTPS by itself)"
if ! command -v caddy >/dev/null; then
  curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get -o DPkg::Lock::Timeout=600 update -q && apt-get -o DPkg::Lock::Timeout=600 install -y -q caddy
fi

step "4/8 UII Parts files (checked against their fingerprints)"
id uii >/dev/null 2>&1 || useradd --system --home /var/lib/uii-parts --shell /usr/sbin/nologin uii
mkdir -p /opt/uii-parts/public /var/lib/uii-parts /var/backups/uii-parts
curl -fsSL "$RAW/server.js" -o /tmp/uii-server.js
curl -fsSL "$RAW/public/index.html" -o /tmp/uii-index.html
echo "$SUM_SERVER  /tmp/uii-server.js" | sha256sum -c --quiet
echo "$SUM_PAGE  /tmp/uii-index.html" | sha256sum -c --quiet
install -m 644 /tmp/uii-server.js /opt/uii-parts/server.js
install -m 644 /tmp/uii-index.html /opt/uii-parts/public/index.html
chown -R uii:uii /var/lib/uii-parts
chmod 700 /var/lib/uii-parts

step "5/8 Service (starts by itself after a reboot)"
cat > /etc/systemd/system/uii-parts.service <<UNIT
[Unit]
Description=UII Parts
After=network.target

[Service]
User=uii
Environment=PORT=3000
Environment=DATA=/var/lib/uii-parts
ExecStart=/usr/bin/node /opt/uii-parts/server.js
Restart=always
RestartSec=2
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/uii-parts
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT
# helper to make or reset an admin later:  uii-admin
cat > /usr/local/bin/uii-admin <<'HELP'
#!/bin/bash
set -e
systemctl stop uii-parts
sudo -u uii DATA=/var/lib/uii-parts /usr/bin/node /opt/uii-parts/server.js make-admin || true
systemctl start uii-parts
HELP
chmod 755 /usr/local/bin/uii-admin

step "6/8 HTTPS address: https://$HOST"
cat > /etc/caddy/Caddyfile <<CADDY
$HOST {
	encode gzip
	reverse_proxy 127.0.0.1:3000
}
CADDY

step "7/8 Firewall (only SSH and the website) and fail2ban"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
systemctl enable --now fail2ban >/dev/null

step "Daily copy of the data at night, kept 30 days in /var/backups/uii-parts"
cat > /etc/cron.daily/uii-parts-backup <<'CRON'
#!/bin/bash
tar czf /var/backups/uii-parts/data-$(date +%F).tgz --exclude=./lock -C /var/lib/uii-parts .
find /var/backups/uii-parts -name 'data-*.tgz' -mtime +30 -delete
CRON
chmod 755 /etc/cron.daily/uii-parts-backup

step "8/8 First admin account (type it here; it is not saved anywhere else)"
if [ ! -s /var/lib/uii-parts/c/users.json ]; then
  until sudo -u uii DATA=/var/lib/uii-parts /usr/bin/node /opt/uii-parts/server.js make-admin; do echo "Try again."; done
else
  echo "Accounts already there: skipped. (To add or reset an admin later: uii-admin)"
fi

systemctl daemon-reload
systemctl enable --now uii-parts >/dev/null
systemctl restart uii-parts caddy
sleep 3
echo
if systemctl is-active --quiet uii-parts && systemctl is-active --quiet caddy; then
  echo "DONE. Open:  https://$HOST"
  echo "(The first visit can take up to a minute while the HTTPS certificate is made.)"
else
  echo "Something did not start. Send the lines below to Claude:"
  systemctl --no-pager status uii-parts caddy | tail -30
fi
