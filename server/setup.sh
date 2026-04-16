#!/usr/bin/env bash
# Pipeline Guide Server — setup script
# Run once on the remote server as the user who will own the guides.
# Usage: bash setup.sh [guides-dir] [port]
set -euo pipefail

GUIDES_DIR="${1:-$HOME/guides}"
PORT="${2:-7842}"
SERVER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="pipeline-guide"

# ── Detect Node ───────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "Node.js not found. Install it first: https://nodejs.org"
  exit 1
fi
NODE_VER=$(node -e "process.stdout.write(process.versions.node)")
echo "Node.js $NODE_VER found"

# ── Install deps ──────────────────────────────────────────────────────────────
echo "Installing server dependencies…"
cd "$SERVER_DIR"
npm install --omit=dev --silent

# ── Create guides dir & sample content ───────────────────────────────────────
mkdir -p "$GUIDES_DIR"/{ci-cd/jenkins-pipeline,runbooks/service-down,troubleshooting/db-connection}

write_if_missing() {
  local file="$1"; shift
  [[ -f "$file" ]] && return
  cat > "$file" "$@"
  echo "  created $file"
}

write_if_missing "$GUIDES_DIR/ci-cd/jenkins-pipeline/guide.md" <<'MD'
---
title: Jenkins Pipeline Troubleshooting
tags: jenkins, ci, build
description: Diagnose and fix common Jenkins pipeline failures
---

# Jenkins Pipeline Troubleshooting

## Step 1: Check Console Logs

Navigate to the failed build and open Console Output.

```bash
jenkins-cli console <job-name> <build-number>
```

Look for **ERROR**, **FAILED**, or timeout messages.

## Step 2: Verify Agent Availability

Check agents are online and have disk/memory headroom.

```bash
curl -s http://jenkins/computer/api/json | jq '.computer[].offline'
```

## Step 3: Check Plugin Versions

Go to **Manage Jenkins → Plugin Manager** and look for warnings.

## Step 4: Replay the Pipeline

Use the **Replay** button to tweak Jenkinsfile without committing.

## Step 5: Escalate

If unresolved, share the build URL and log excerpt with the DevOps team.
MD

write_if_missing "$GUIDES_DIR/runbooks/service-down/guide.md" <<'MD'
---
title: Service Down Runbook
tags: incident, on-call, runbook
description: Immediate steps when a production service goes down
---

# Service Down Runbook

## Step 1: Confirm the Outage

```bash
curl -I https://your-service/health
```

## Step 2: Notify the Team

Post in **#incidents** with: service name, first seen time, user impact.

## Step 3: Check Recent Deployments

Review deploys in the last 30 minutes.

## Step 4: Inspect Resources

```bash
kubectl top pods -n production
kubectl describe pod <pod-name> -n production
```

## Step 5: Rollback if Needed

```bash
kubectl rollout undo deployment/<service-name> -n production
```

## Step 6: Post-Incident Review

Schedule a blameless postmortem within 48 hours.
MD

write_if_missing "$GUIDES_DIR/troubleshooting/db-connection/guide.md" <<'MD'
---
title: Database Connection Failures
tags: database, postgres, troubleshooting
description: Steps to diagnose why the app cannot connect to the database
---

# Database Connection Failures

## Step 1: Verify DB is Running

```bash
systemctl status postgresql
```

## Step 2: Test Connectivity

```bash
psql -h <host> -U <user> -d <db> -c "SELECT 1"
```

## Step 3: Check Connection Limits

```sql
SELECT count(*) FROM pg_stat_activity;
SHOW max_connections;
```

## Step 4: Review App Config

Confirm DATABASE_URL, DB_HOST, DB_PORT are correct.

## Step 5: Check Firewall

Ensure port 5432 is open between app servers and DB.
MD

# ── Generate token ────────────────────────────────────────────────────────────
TOKEN_FILE="$SERVER_DIR/.token"
if [[ ! -f "$TOKEN_FILE" ]]; then
  python3 -c "import secrets; print(secrets.token_hex(32))" > "$TOKEN_FILE" 2>/dev/null \
    || openssl rand -hex 32 > "$TOKEN_FILE"
  chmod 600 "$TOKEN_FILE"
  echo "Generated token → $TOKEN_FILE"
fi
TOKEN="$(cat "$TOKEN_FILE")"

# ── Write env file ────────────────────────────────────────────────────────────
ENV_FILE="$SERVER_DIR/.env"
cat > "$ENV_FILE" <<ENV
PORT=$PORT
GUIDES_DIR=$GUIDES_DIR
GUIDE_TOKEN=$TOKEN
NODE_ENV=production
ENV
chmod 600 "$ENV_FILE"
echo "Wrote $ENV_FILE"

# ── Systemd service (optional, requires sudo) ─────────────────────────────────
if command -v systemctl &>/dev/null && [[ "${INSTALL_SERVICE:-}" == "1" ]]; then
  SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
  sudo tee "$SERVICE_FILE" > /dev/null <<UNIT
[Unit]
Description=Pipeline Guide Server
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$SERVER_DIR
ExecStart=$(command -v node) $SERVER_DIR/server.js
EnvironmentFile=$ENV_FILE
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
  sudo systemctl daemon-reload
  sudo systemctl enable --now "$SERVICE_NAME"
  echo "Systemd service '$SERVICE_NAME' installed and started."
else
  echo ""
  echo "To start manually:"
  echo "  cd $SERVER_DIR && env \$(cat .env | xargs) node server.js"
  echo ""
  echo "To install as a systemd service (requires sudo):"
  echo "  INSTALL_SERVICE=1 bash setup.sh"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Server port : $PORT  (bound to 127.0.0.1)"
echo "  Guides dir  : $GUIDES_DIR"
echo "  Token       : $TOKEN"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Copy the token above into the Electron app's API Token field."
echo "The server only listens on localhost — connect via SSH tunnel:"
echo "  ssh -L 7842:127.0.0.1:7842 user@your-server"
