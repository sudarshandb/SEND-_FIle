# Local Media Hosting and File Sharing

A local Docker Compose project using React, Express, Mongoose, and MongoDB. Image/video files are saved under `backend/uploads/`; MongoDB stores account, session, and media metadata.

## Start

From this directory run `docker compose up --build`, then open <http://localhost:3000> (login is also directly available at `/login`). Create an account on the login screen. API health check: <http://localhost:5000/api/health>.

## Deploy to Render

The root [`render.yaml`](render.yaml) Blueprint defines an API Docker web service with a persistent disk mounted at `/app/uploads` and a separate React Static Site. MongoDB must be provided by an external MongoDB service; copy its connection string into the API's `MONGO_URI` setting. Render disks preserve only data written under their mount path, so keep `UPLOAD_DIR=/app/uploads`.

During initial Blueprint setup, provide these values when prompted:

- API service: `MONGO_URI` (MongoDB connection string), `PUBLIC_BASE_URL` (API's `https://<service>.onrender.com` URL), `FRONTEND_BASE_URL` (frontend's Render URL), and `FRONTEND_ORIGIN` (same frontend origin, without a trailing slash).
- Static site: `REACT_APP_API_URL` (the API URL, e.g. `https://<service>.onrender.com`). CRA embeds this variable during the build, so changing it requires a new frontend deploy.

`PORT` is supplied by Render and the server listens on `process.env.PORT || 5000` at `0.0.0.0`. The API health check uses `/api/health`. The Docker frontend image is an alternative production build using Nginx; for Render, the Blueprint's Static Site is recommended.

## Authentication and ownership

- Register with an email and password of at least 8 characters. Passwords are stored as salted Node.js `scrypt` hashes.
- Login issues a random 256-bit bearer token. The API stores only its SHA-256 hash and expires the session after 7 days. The browser keeps the raw token in `sessionStorage` and sends it in the `Authorization: Bearer` header.
- Upload and dashboard-list routes require login. New media stores its owner's User ObjectId. The listing filters by that owner, and revoke only finds media owned by the authenticated account. An attempt to revoke another account's media returns 404.
- Public viewers need no account, but need the random 256-bit share token in the link. Public routes reveal only that deliberately shared media and check expiry/revocation on metadata and asset requests.
- Logout revokes the current account session token. Each login replaces the account's previous session token, so only the newest login remains valid.

This is a learning project, not production identity infrastructure. It has no email verification, password reset, account recovery, login throttling, or multi-device session management. Protect the service with HTTPS before sending credentials over a network. `sessionStorage` limits token persistence to the browser tab session, but a frontend XSS vulnerability could still steal it.

## Project layout

```text
media-hosting-app/
├── backend/
│   ├── models/Media.js
│   ├── models/User.js
│   ├── uploads/              # local uploaded bytes
│   ├── server.js
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── public/index.html
│   ├── src/components/Dashboard.js
│   ├── src/components/LoginScreen.js
│   ├── src/components/MediaView.js
│   ├── src/App.js
│   ├── nginx.conf
│   └── Dockerfile
├── postman/Media-Hosting.postman_collection.json
├── docker-compose.yml
└── render.yaml
```

## API

| Method | Path | Access | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | JSON `{ "email", "password" }`; creates an account and returns a session token. |
| `POST` | `/api/auth/login` | Public | JSON `{ "email", "password" }`; logs in and returns a session token. |
| `GET` | `/api/auth/me` | Signed in | Returns the current account. |
| `POST` | `/api/auth/logout` | Signed in | Revokes the active token. |
| `POST` | `/api/media/upload` | Owner | Multipart fields `file`, `expiryMinutes`; one image/video up to 10 MB. |
| `GET` | `/api/media` | Owner | Lists only the signed-in owner's media. |
| `DELETE` | `/api/media/:id` | Owner | Revokes and deletes a file only if it belongs to the signed-in owner. |
| `GET` | `/api/share/:token` | Public link | Validates share token and expiry, then returns metadata and increments views. |
| `GET` | `/api/share/:token/asset` | Public link | Streams the active image/video inline. |

Expiry is validated server-side from 1 minute to 365 days. Expired media is denied, though its disk file remains until revoked or manually cleaned. No total storage quota or rate limit is configured.

## Postman

Import `postman/Media-Hosting.postman_collection.json`. Register or login first; the collection saves the bearer token automatically. Then upload a file, which saves the generated share token. The collection can list the current owner's files, fetch public metadata/asset, revoke an owned file, and log out.

## Persistence

Docker Compose bind-mounts `backend/uploads/` and stores MongoDB data in the `mongo_data` named volume. They survive container restarts. `docker compose down` preserves the named volume; `docker compose down -v` deletes the MongoDB data volume. Do not use that command if you need to preserve accounts and metadata.
"# SEND-_FIle" 
