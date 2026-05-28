#!/usr/bin/env bash
# AgentZap backend installer — idempotente, Ubuntu 22.04+ (funciona no WSL2)
set -euo pipefail

NEED_SUDO=""
[ "$EUID" -ne 0 ] && NEED_SUDO="sudo"

echo "==> 1/6 Atualizando apt"
$NEED_SUDO apt-get update -y

echo "==> 2/6 Instalando Node.js 20, PostgreSQL, Chromium (deps openwa)"
if ! command -v node >/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | $NEED_SUDO -E bash -
  $NEED_SUDO apt-get install -y nodejs
fi
$NEED_SUDO apt-get install -y postgresql postgresql-contrib chromium-browser \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libgbm1 libasound2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libxshmfence1 libpangocairo-1.0-0 \
  libpango-1.0-0 fonts-liberation || true

echo "==> 3/6 Iniciando PostgreSQL"
$NEED_SUDO service postgresql start || true
sleep 2

echo "==> 4/6 Criando database/usuário agentzap (se não existir)"
$NEED_SUDO -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='agentzap'" | grep -q 1 || \
  $NEED_SUDO -u postgres psql -c "CREATE ROLE agentzap LOGIN PASSWORD 'agentzap';"
$NEED_SUDO -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='agentzap'" | grep -q 1 || \
  $NEED_SUDO -u postgres psql -c "CREATE DATABASE agentzap OWNER agentzap;"

echo "==> 5/6 Configurando .env + instalando deps + migrando"
cd "$(dirname "$0")"
if [ ! -f .env ]; then
  TOKEN=$(node -e "console.log(require('crypto').randomBytes(24).toString('hex'))")
  cp .env.example .env
  sed -i "s|change-me-after-install|$TOKEN|" .env
  echo ""
  echo "============================================================"
  echo "  SEU TOKEN DE API (guarde, copie pro AgentZap → Config):"
  echo "  $TOKEN"
  echo "============================================================"
  echo ""
fi
npm install
npm run migrate
npm run build

echo "==> 6/6 Iniciando com pm2"
if ! command -v pm2 >/dev/null; then $NEED_SUDO npm install -g pm2; fi
pm2 startOrReload ecosystem.config.cjs
pm2 save

echo ""
echo "✓ Pronto. Backend em http://localhost:3001/health"
echo "  Para expor publicamente: configure nginx + certbot (veja nginx.conf.example)."
