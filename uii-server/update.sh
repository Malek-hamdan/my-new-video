#!/bin/bash
# UII Parts: update the page and server to a fixed, checked version. The data is not touched.
set -euo pipefail
REV="c763157eb0adde3c69d0ba0bf15ebf23fbe4f84a"
RAW="https://raw.githubusercontent.com/Malek-hamdan/my-new-video/$REV/uii-server"
curl -fsSL "$RAW/server.js" -o /tmp/uii-server.js
curl -fsSL "$RAW/public/index.html" -o /tmp/uii-index.html
echo "f783cbb8cb56e8e079792c8d42539190439672166efa6999e515b662e02a1609  /tmp/uii-server.js" | sha256sum -c --quiet
echo "43182b7a3897a336d3450c8ef9ea9c2dc5fb36b55cb8242b1826f552dab2de3f  /tmp/uii-index.html" | sha256sum -c --quiet
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
