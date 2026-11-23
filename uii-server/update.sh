#!/bin/bash
# UII Parts: update the page and server to a fixed, checked version. The data is not touched.
set -euo pipefail
REV="eb94c69df52077714f5c5bcae2451ff696282a90"
RAW="https://raw.githubusercontent.com/Malek-hamdan/my-new-video/$REV/uii-server"
curl -fsSL "$RAW/server.js" -o /tmp/uii-server.js
curl -fsSL "$RAW/public/index.html" -o /tmp/uii-index.html
echo "fe4ee19faef2901d039690c96aa639c4d7a19ec8409023a6cf0a9e714f497803  /tmp/uii-server.js" | sha256sum -c --quiet
echo "0fcec3f2e5a5cbafaa457bc45372d6af9ac70ba72581d9df9d9772676d29dc82  /tmp/uii-index.html" | sha256sum -c --quiet
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
systemctl restart uii-parts
sleep 2
if systemctl is-active --quiet uii-parts; then echo "UPDATED to ${REV:0:7}. Reload the site."; else systemctl --no-pager status uii-parts | tail -20; fi
