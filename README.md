# Pipeline Guide

A desktop app for teams to write, browse, and follow step-by-step operational guides — accessed securely over SSH.

Built with Electron + a lightweight Node.js API server. All guide content lives on your server; the app connects via SSH tunnel so nothing is exposed to the internet.

---

## Architecture

```
[ Electron App ]  ──SSH──►  [ Remote Server ]
   (Windows)                  node server.js
                               ~/guides/*.md
```

- **SSH Only mode** — reads guides directly via `cat` / `find` over SSH. No server setup required.
- **API Server mode** — connects to the Express REST API over an SSH tunnel. Enables guide creation, editing, deletion, and image uploads.

---

## Quick Start

### 1. Install app dependencies

```bash
npm install
npm start
```

### 2. Set up the guide server (on the remote machine)

```bash
cd server
bash setup.sh [guides-dir] [port]
```

`setup.sh` will:
- Install server dependencies
- Create sample guides in `~/guides`
- Generate an auth token and write `server/.env`
- Optionally install a systemd service (`INSTALL_SERVICE=1 bash setup.sh`)

### 3. Connect

Fill in the login form:
- **Host / Port** — your SSH server
- **Username / Auth** — SSH credentials (password or private key)
- **Connection Mode** — SSH Only (read-only) or API Server (full CRUD)
- **Guide Password** — your account password from `server/users.json` (API mode only)

---

## Guide Format

Guides are Markdown files with optional YAML frontmatter:

```markdown
---
title: My Guide
tags: devops, incident
description: Short summary shown in the card view
icon: 🚀
---

# My Guide

## Step 1: Do the first thing

Explanation and commands here.

## Step 2: Verify

Check the output.
```

Each `##` heading becomes a collapsible step with a completion checkbox.

### Directory structure

```
guides/
  ci-cd/
    jenkins-pipeline/
      guide.md
  runbooks/
    service-down/
      guide.md
```

The path determines hierarchy: `category/subcategory/guide.md`

---

## Server

### Configuration (`server/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `7842` | Port (localhost only) |
| `GUIDES_DIR` | `~/guides` | Path to guides directory |
| `USERS_FILE` | `./users.json` | Path to users file |
| `NODE_ENV` | `development` | Set to `production` to enforce auth |

### Users (`server/users.json`)

```json
[
  { "username": "alice", "password": "yourpassword", "role": "admin" },
  { "username": "bob",   "password": "viewerpass",   "role": "viewer" }
]
```

Roles: `admin` (full CRUD) · `viewer` (read only)

> `users.json` is gitignored — never commit it.

### Running manually

```bash
cd server && node server.js
```

---

## Security Notes

- The server binds only to `127.0.0.1` — never directly reachable from the network
- All remote access goes through an SSH tunnel
- Session tokens are in-memory and expire on server restart
- `users.json` and `.env` are gitignored
