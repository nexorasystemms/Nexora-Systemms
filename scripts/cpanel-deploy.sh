#!/bin/bash
# Deploy the Vite SPA to the cPanel document root after `git` pull.
set -euo pipefail

export PATH="/opt/alt/alt-nodejs22/root/usr/bin:/opt/alt/alt-nodejs20/root/usr/bin:/opt/alt/alt-nodejs18/root/usr/bin:/opt/cpanel/ea-nodejs20/bin:/usr/local/bin:/usr/bin:${PATH}"

# CloudLinux "Setup Node.js App" virtualenv, if present.
if compgen -G "${HOME}/nodevenv/*/2*/bin/activate" > /dev/null; then
  # shellcheck disable=SC1090
  source "$(ls -1d "${HOME}"/nodevenv/*/2*/bin/activate | tail -n 1)"
fi

if [ -f "${HOME}/.nexora.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "${HOME}/.nexora.env"
  set +a
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm was not found on PATH."
  echo "In cPanel open Setup Node.js App, create an app with Node 20+, then Deploy HEAD Commit again."
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "${NODE_MAJOR}" -lt 20 ]; then
  echo "Node ${NODE_MAJOR} is too old for this Vite build. Select Node 20 or 22 in Setup Node.js App."
  exit 1
fi

npm ci
npm run build

DEPLOYPATH="${CPANEL_DEPLOYPATH:-${HOME}/nexorasystems.solutions}"
if [ ! -d "${DEPLOYPATH}" ]; then
  echo "Deploy path does not exist: ${DEPLOYPATH}"
  echo "Set CPANEL_DEPLOYPATH in ${HOME}/.nexora.env to this domain's document root (cPanel → Domains)."
  exit 1
fi

if [ ! -d dist ] || [ ! -f dist/index.html ]; then
  echo "Build did not produce dist/index.html"
  exit 1
fi

# Copy the production bundle, including .htaccess from public/.
/bin/cp -a dist/. "${DEPLOYPATH}/"

echo "Deployed Vite dist/ to ${DEPLOYPATH}"
