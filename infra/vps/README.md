# Private-testing VPS bootstrap

This directory contains a safe, idempotent baseline bootstrap for the existing Ubuntu VPS.

## Run

From a checked-out copy of this branch on the VPS:

```bash
sudo bash infra/vps/bootstrap.sh
```

The script only creates the platform directory structure and prints a read-only environment summary. It does **not** install or restart services, change firewall rules, edit Caddy, stop existing containers, clone applications, or create credentials.

## Planned layout

- `/srv/platform/apps/<app>`: deployment code/configuration
- `/srv/platform/infra`: shared proxy, monitoring, and backup configuration
- `/var/lib/platform-data/<app>`: persistent application data
- `/etc/platform/secrets`: root-only environment files
- `/var/backups/platform`: backup staging

## Before public routing

1. Verify Tencent Cloud security-group rules and confirm SSH access.
2. Review the current Caddyfile and preserve a backup.
3. Keep app runtimes bound to localhost or a private Docker network; expose only intended routes through Caddy.
4. Test a Caddy configuration with `caddy validate` before reload.
5. Keep Hermes dashboard and 9Router access restricted until authentication and network controls are verified.

The VPS is currently IP-only. HTTPS certificate behavior for an IP address depends on Caddy/issuer support and must be tested; a domain is still recommended for stable production-like testing.
