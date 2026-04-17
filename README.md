# Pipeline Guide

A desktop app for teams to write, browse, and follow step-by-step operational guides.

Built with Electron + a lightweight Node.js REST API server. Guide content lives on your server; the app connects directly over HTTP with username/password authentication.

---

## Architecture

```
[ Electron App ]  ──HTTP──►  [ Guide Server ]
   (Windows)                   node server.js
                                ~/guides/*.md
```

---

## Quick Start

### 1. Install app dependencies

```bash
npm install
npm start
```

### 2. Set up the guide server

```bash
cd server
npm install
node server.js
```

Create `server/users.json` and `server/.env` before starting (see below).

### 3. Connect

Fill in the login form:
- **Server Address / Port** — hostname or IP of the machine running the server, default port `7842`
- **Username / Password** — your credentials from `server/users.json`

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
  infrastructure/
    kubernetes/
      deployments/
        guide.md
```

The folder path determines the category hierarchy — nesting is unlimited.

---

## Server

### Configuration (`server/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `7842` | Port to listen on |
| `BIND` | `0.0.0.0` | Bind address (`127.0.0.1` for localhost only) |
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

Roles: `admin` (full CRUD + image upload) · `viewer` (read only)

> `users.json` and `.env` are gitignored — never commit them.

### API

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/login` | — | Get session token |
| `POST` | `/api/logout` | any | Invalidate token |
| `GET` | `/api/me` | any | Current user info |
| `GET` | `/api/guides` | any | List all guides |
| `GET` | `/api/guides/content?path=…` | any | Get guide content |
| `GET` | `/api/images?path=…` | any | Get image as base64 |
| `POST` | `/api/guides` | admin | Create guide |
| `PUT` | `/api/guides` | admin | Update guide |
| `DELETE` | `/api/guides` | admin | Delete guide |
| `POST` | `/api/images` | admin | Upload image |

---

## Security Notes

- Session tokens are in-memory and expire on server restart
- `users.json` and `.env` are gitignored
- Set `BIND=127.0.0.1` if running the server and app on the same machine
- Use a reverse proxy (nginx, Caddy) with TLS if exposing over a network
