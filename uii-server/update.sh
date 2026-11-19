#!/bin/bash
# UII Parts: update the page and server to a fixed, checked version. The data is not touched.
set -euo pipefail
REV="f4701df9641ef6e2320427e048f439e8f0f47ab1"
RAW="https://raw.githubusercontent.com/Malek-hamdan/my-new-video/$REV/uii-server"
curl -fsSL "$RAW/server.js" -o /tmp/uii-server.js
curl -fsSL "$RAW/public/index.html" -o /tmp/uii-index.html
echo "43cf075d8547f5a7a1495cf33d5d714b1416d28c4b380492467dcca605467bbd  /tmp/uii-server.js" | sha256sum -c --quiet
echo "6bd4ffbb863c48c4ae5b6f6c8efae4f0d5f1cfc9ca4477c9dc56d112c2d8fcc9  /tmp/uii-index.html" | sha256sum -c --quiet
tar czf /var/backups/uii-parts/before-update-$(date +%F-%H%M).tgz -C /var/lib/uii-parts c
install -m 644 /tmp/uii-server.js /opt/uii-parts/server.js
install -m 644 /tmp/uii-index.html /opt/uii-parts/public/index.html
systemctl restart uii-parts
sleep 2
if systemctl is-active --quiet uii-parts; then echo "UPDATED to ${REV:0:7}. Reload the site."; else systemctl --no-pager status uii-parts | tail -20; fi
