#!/bin/bash
# UII Parts: update the page and server to a fixed, checked version. The data is not touched.
set -euo pipefail
REV="ccd807b0e571f2b47c47d6b9933c108b7f4fb264"
RAW="https://raw.githubusercontent.com/Malek-hamdan/my-new-video/$REV/uii-server"
curl -fsSL "$RAW/server.js" -o /tmp/uii-server.js
curl -fsSL "$RAW/public/index.html" -o /tmp/uii-index.html
echo "761588dd7c9c554443a0ff3f2dfc70d73154e0c6daa988a1d9f3fa4cd959845b  /tmp/uii-server.js" | sha256sum -c --quiet
echo "62dc988850e966733a46365440db71f972930baa3bafcdc98e723bcb7d9a89f1  /tmp/uii-index.html" | sha256sum -c --quiet
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
