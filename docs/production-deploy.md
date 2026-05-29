# Production deploy on VPS

This project runs as a separate Docker Compose project and must not reuse or modify
AmnesiaVPN compose files, containers, networks, or volumes.

## Layout

- App directory: `/opt/ntrwtk-vpn-payment-bot`
- Compose file: `docker-compose.prod.yml`
- Compose project name: `ntrwtk-vpn-payment-bot`
- Runtime mode: Telegram polling, no webhook
- Database: dedicated PostgreSQL container with named volume
- Secrets: server-side `.env`, never committed to git

The production compose file does not publish PostgreSQL ports to the host. The bot
connects to PostgreSQL over the private Compose network.

## First deploy on VPS

```bash
sudo mkdir -p /opt/ntrwtk-vpn-payment-bot
sudo chown "$USER":"$USER" /opt/ntrwtk-vpn-payment-bot
git clone https://github.com/netorwtik/ntrwtk_vpn_menage_system.git /opt/ntrwtk-vpn-payment-bot
cd /opt/ntrwtk-vpn-payment-bot
cp deploy/production.env.example .env
nano .env
```

Fill in real values for `BOT_TOKEN`, `ADMIN_TELEGRAM_IDS`,
`POSTGRES_PASSWORD`, and payment details.

```bash
docker compose -p ntrwtk-vpn-payment-bot -f docker-compose.prod.yml up -d postgres
docker compose -p ntrwtk-vpn-payment-bot -f docker-compose.prod.yml run --rm migrate
docker compose -p ntrwtk-vpn-payment-bot -f docker-compose.prod.yml up -d --build bot
docker compose -p ntrwtk-vpn-payment-bot -f docker-compose.prod.yml ps
docker compose -p ntrwtk-vpn-payment-bot -f docker-compose.prod.yml logs -f bot
```

## Updates

```bash
cd /opt/ntrwtk-vpn-payment-bot
git pull --ff-only origin main
docker compose -p ntrwtk-vpn-payment-bot -f docker-compose.prod.yml up -d postgres
docker compose -p ntrwtk-vpn-payment-bot -f docker-compose.prod.yml run --rm migrate
docker compose -p ntrwtk-vpn-payment-bot -f docker-compose.prod.yml up -d --build bot
docker compose -p ntrwtk-vpn-payment-bot -f docker-compose.prod.yml logs --tail=100 bot
```

## GitHub Actions secrets

Add repository or environment secrets:

- `VPS_HOST`: VPS hostname or IP address
- `VPS_USER`: SSH user with access to Docker
- `VPS_SSH_PRIVATE_KEY`: private SSH key for deploy
- `VPS_SSH_KNOWN_HOSTS`: known_hosts line for the VPS

Optional environment variable:

- `APP_DIR`: defaults to `/opt/ntrwtk-vpn-payment-bot`

Generate `VPS_SSH_KNOWN_HOSTS` locally:

```bash
ssh-keyscan -H YOUR_VPS_HOST
```

## Checks

```bash
docker compose -p ntrwtk-vpn-payment-bot -f docker-compose.prod.yml ps
docker compose -p ntrwtk-vpn-payment-bot -f docker-compose.prod.yml logs --tail=100 bot
docker compose -p ntrwtk-vpn-payment-bot -f docker-compose.prod.yml logs --tail=100 postgres
```

In Telegram, send `/start`, `/help`, and `/admin` from an admin account.

## Backup and rollback

Create a database backup before risky updates:

```bash
cd /opt/ntrwtk-vpn-payment-bot
mkdir -p backups
docker compose -p ntrwtk-vpn-payment-bot -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U vpn_bot -d vpn_payments > "backups/vpn_payments_$(date +%F_%H-%M-%S).sql"
```

Rollback application code:

```bash
cd /opt/ntrwtk-vpn-payment-bot
git log --oneline -5
git checkout COMMIT_SHA
docker compose -p ntrwtk-vpn-payment-bot -f docker-compose.prod.yml up -d --build bot
docker compose -p ntrwtk-vpn-payment-bot -f docker-compose.prod.yml logs --tail=100 bot
```

Do not run `docker system prune`, `docker container prune`, `docker network prune`,
`docker volume prune`, or broad `docker rm` commands on a VPS that also runs
AmnesiaVPN.
