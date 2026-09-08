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

### Requirements

- Windows 10 or later for the desktop app
- Node.js 18 or later with npm

### 1. Install dependencies

```bash
npm install
cd server
npm install
cd ..
```

### 2. Create local server configuration

For local development, create `server/users.json` with at least one user:

```json
[
  { "username": "alice", "password": "yourpassword", "role": "admin" }
]
```

You can omit `server/.env` when using the defaults. To customize the server, create it with:

```dotenv
PORT=7842
BIND=127.0.0.1
GUIDES_DIR=C:/Users/<you>/guides
USERS_FILE=./users.json
NODE_ENV=development
```

The server loads this file automatically from its own directory. `server/users.json` and `server/.env` are gitignored.

### 3. Start the guide server

```bash
cd server
npm start
```

For development without `users.json`, leave `NODE_ENV` unset or set it to `development`. The API then provides a temporary `dev` admin login. Production mode requires `users.json`.

### 4. Start the desktop app

In a second terminal from the repository root:

```bash
npm start
```

### 5. Connect

Fill in the login form:
- **Server Address / Port** — hostname or IP of the machine running the server, default port `7842`
- **Username / Password** — your credentials from `server/users.json`

Set the server address to `127.0.0.1` when both processes run on the same computer. The server binds to localhost by default.

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
| `BIND` | `127.0.0.1` | Documented bind address; the current server always listens on localhost |
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

> `users.json` and `.env` are gitignored — never commit them. Passwords are currently stored as plain text, so restrict access to this file.

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
- The current server listens on `127.0.0.1`; the `BIND` setting is reserved for future use
- Set `NODE_ENV=production` only after creating `server/users.json`
- Use a reverse proxy (nginx, Caddy) with TLS if exposing over a network

## Verification

From the repository root, verify the installed desktop dependency:

```bash
npm exec -- electron --version
```

With the server running, verify its health endpoint:

```bash
curl http://127.0.0.1:7842/api/health
```
