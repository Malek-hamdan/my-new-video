#!/bin/bash
# UII Parts: update the page and server to a fixed, checked version. The data is not touched.
set -euo pipefail
REV="4227f23d5254d158841fcd750cb8faa4fd30914c"
RAW="https://raw.githubusercontent.com/Malek-hamdan/my-new-video/$REV/uii-server"
curl -fsSL "$RAW/server.js" -o /tmp/uii-server.js
curl -fsSL "$RAW/public/index.html" -o /tmp/uii-index.html
echo "84cc157529865a22a31e25ee8d88fe6bc111ba3b344b4e6d03d4dd7f97b6a7a8  /tmp/uii-server.js" | sha256sum -c --quiet
echo "62dc988850e966733a46365440db71f972930baa3bafcdc98e723bcb7d9a89f1  /tmp/uii-index.html" | sha256sum -c --quiet
tar czf /var/backups/uii-parts/before-update-$(date +%F-%H%M).tgz -C /var/lib/uii-parts c
install -m 644 /tmp/uii-server.js /opt/uii-parts/server.js
install -m 644 /tmp/uii-index.html /opt/uii-parts/public/index.html
systemctl restart uii-parts
sleep 2
if systemctl is-active --quiet uii-parts; then echo "UPDATED to ${REV:0:7}. Reload the site."; else systemctl --no-pager status uii-parts | tail -20; fi
