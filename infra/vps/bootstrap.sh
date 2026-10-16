#!/usr/bin/env bash
set -Eeuo pipefail

# Safe, idempotent directory bootstrap for the private-testing platform.
# Does NOT modify Caddy, firewall rules, Docker containers, SSH, or existing app data.

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run with sudo: sudo bash infra/vps/bootstrap.sh" >&2
  exit 1
fi

if [[ -r /etc/os-release ]]; then
  . /etc/os-release
  if [[ "${ID:-}" != "ubuntu" ]]; then
    echo "Warning: designed for Ubuntu; detected ${PRETTY_NAME:-unknown OS}." >&2
  fi
fi

apps=(
  "life-planner-saas"
  "ai-endurance-coach"
  "Recuiter-Industrial"
  "wedding-planner"
  "Kept"
  "Snackloop-ERP"
  "diskon-bot"
)

install -d -o root -g root -m 0750 /srv/platform
install -d -o root -g root -m 0750 /srv/platform/apps
install -d -o root -g root -m 0750 /srv/platform/infra/caddy
install -d -o root -g root -m 0750 /srv/platform/infra/monitoring
install -d -o root -g root -m 0750 /srv/platform/infra/backup
install -d -o root -g root -m 0750 /srv/platform/scripts

install -d -o root -g root -m 0750 /var/lib/platform-data
install -d -o root -g root -m 0700 /etc/platform
install -d -o root -g root -m 0700 /etc/platform/secrets
install -d -o root -g root -m 0700 /var/backups/platform

for app in "${apps[@]}"; do
  install -d -o root -g root -m 0750 "/srv/platform/apps/${app}"
  install -d -o root -g root -m 0750 "/var/lib/platform-data/${app}"
done

echo
echo "Platform directories prepared. Existing services were not changed."
echo
printf ' %-28s %s\n' "CHECK" "STATUS"
printf ' %-28s %s\n' "Docker CLI" "$(command -v docker >/dev/null 2>&1 && echo present || echo MISSING)"
if command -v docker >/dev/null 2>&1; then
  printf ' %-28s %s\n' "Docker daemon" "$(docker info >/dev/null 2>&1 && echo reachable || echo 'not reachable for root')"
  printf ' %-28s %s\n' "Docker Compose plugin" "$(docker compose version >/dev/null 2>&1 && echo present || echo MISSING)"
fi
printf ' %-28s %s\n' "Caddy config" "$(test -f /etc/caddy/Caddyfile && echo exists || echo not-found)"
printf ' %-28s %s\n' "UFW" "$(command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | head -n1 || echo unavailable)"
printf ' %-28s %s\n' "Disk free" "$(df -h / | awk 'NR==2 {print $4 " free (" $5 " used)"}')"
printf ' %-28s %s\n' "Memory available" "$(free -h | awk '/Mem:/ {print $7 " available"}')"

echo
echo "Next: audit Tencent Cloud firewall and current Caddy routes before adding public app routes."
echo "No secrets were created. Do not put real credentials in Git."
