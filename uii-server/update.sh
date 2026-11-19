#!/bin/bash
# UII Parts: update the page and server to a fixed, checked version. The data is not touched.
set -euo pipefail
REV="1f820d8f5e67865227a7576b72fed6a669a51e5c"
RAW="https://raw.githubusercontent.com/Malek-hamdan/my-new-video/$REV/uii-server"
curl -fsSL "$RAW/server.js" -o /tmp/uii-server.js
curl -fsSL "$RAW/public/index.html" -o /tmp/uii-index.html
echo "43cf075d8547f5a7a1495cf33d5d714b1416d28c4b380492467dcca605467bbd  /tmp/uii-server.js" | sha256sum -c --quiet
echo "fd69e85a1c227dfaab7d245ad96abdcb45e31e1edfc1087181bc54f4f2a41e53  /tmp/uii-index.html" | sha256sum -c --quiet
tar czf /var/backups/uii-parts/before-update-$(date +%F-%H%M).tgz -C /var/lib/uii-parts c
install -m 644 /tmp/uii-server.js /opt/uii-parts/server.js
install -m 644 /tmp/uii-index.html /opt/uii-parts/public/index.html
systemctl restart uii-parts
sleep 2
if systemctl is-active --quiet uii-parts; then echo "UPDATED to ${REV:0:7}. Reload the site."; else systemctl --no-pager status uii-parts | tail -20; fi
