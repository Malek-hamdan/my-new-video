#!/bin/bash
# UII Parts: update the page and server to a fixed, checked version. The data is not touched.
set -euo pipefail
REV="7bc6401e7183aab212151e24f6813d87f172e6cb"
RAW="https://raw.githubusercontent.com/Malek-hamdan/my-new-video/$REV/uii-server"
curl -fsSL "$RAW/server.js" -o /tmp/uii-server.js
curl -fsSL "$RAW/public/index.html" -o /tmp/uii-index.html
echo "22bbc170da157c35f663d0222352fb1e59b6091f36cd6d76df2cb172d1afc637  /tmp/uii-server.js" | sha256sum -c --quiet
echo "85a0972732bf8d009dd69a76d5e10217761fb05f3e99c9c0997b08c851f82401  /tmp/uii-index.html" | sha256sum -c --quiet
# the app icon and the install file (name:checksum)
ASSETS="manifest.webmanifest:40bec7e1780bc6d073ba70c1dd65276319bf51c0bc16e5679ca17cb131e311eb icon-192.png:79f941979922fc3e432eda86ae40d11652a0f1b8b6838a65e1037851c2fdb6a5 icon-512.png:5fa63fbc6f6d88d7635cc43b938e9d928f0614ac8174c463801d95aa2a64d91d icon-maskable-512.png:35be84a9550cc1c60fd3f8482c02038c23dc284fcab4b630387571644f308535 apple-touch-icon.png:efaee9db10aae282818246c01e84c7a11db6d4f9d52546452563db513fd9eba7 favicon-32.png:0c1fa49992ae2cea934d28b0a9b4dbecb1692cca1c6fb228d80bba4d29952e24 favicon.ico:0c1fa49992ae2cea934d28b0a9b4dbecb1692cca1c6fb228d80bba4d29952e24"
for a in $ASSETS; do f="${a%%:*}"; curl -fsSL "$RAW/public/$f" -o "/tmp/uii-$f"; echo "${a#*:}  /tmp/uii-$f" | sha256sum -c --quiet; done
tar czf /var/backups/uii-parts/before-update-$(date +%F-%H%M).tgz --exclude=./lock -C /var/lib/uii-parts .
# the nightly copy also takes the change log and the list of collections, not only c/
cat > /etc/cron.daily/uii-parts-backup <<'CRON'
#!/bin/bash
tar czf /var/backups/uii-parts/data-$(date +%F).tgz --exclude=./lock -C /var/lib/uii-parts .
find /var/backups/uii-parts -name 'data-*.tgz' -mtime +30 -delete
CRON
chmod 755 /etc/cron.daily/uii-parts-backup
install -m 644 /tmp/uii-server.js /opt/uii-parts/server.js
install -m 644 /tmp/uii-index.html /opt/uii-parts/public/index.html
for a in $ASSETS; do f="${a%%:*}"; install -m 644 "/tmp/uii-$f" "/opt/uii-parts/public/$f"; done
systemctl restart uii-parts
sleep 2
if systemctl is-active --quiet uii-parts; then echo "UPDATED to ${REV:0:7}. Reload the site."; else systemctl --no-pager status uii-parts | tail -20; fi
