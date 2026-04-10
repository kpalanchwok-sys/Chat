# 🔐 LockGate Chat — Backend API

Production-ready Node.js + Express + Socket.io + MongoDB chat backend.

---

## 📁 Project Structure

```
lockgate-backend/
├── server.js                  # Entry point
├── config/
│   ├── db.js                  # MongoDB connection (with retry)
│   ├── jwt.js                 # Token generation & verification
│   └── multer.js              # File upload config
├── models/
│   ├── User.js
│   ├── Group.js
│   └── Message.js
├── routes/
│   ├── auth.js
│   ├── groups.js
│   ├── messages.js            # Nested under /groups/:groupId/messages
│   └── users.js
├── services/
│   ├── authService.js         # Auth business logic
│   ├── groupService.js        # Group business logic
│   └── messageService.js      # Message business logic
├── middleware/
│   ├── auth.js                # JWT auth (HTTP + Socket)
│   ├── validate.js            # express-validator rules
│   ├── rateLimiter.js         # Rate + speed limiting
│   └── errorHandler.js        # Global error handler
├── socket/
│   └── socketHandler.js       # All real-time events
├── utils/
│   ├── logger.js              # Winston logger
│   ├── response.js            # Standardised API responses
│   ├── asyncHandler.js        # try/catch wrapper
│   └── AppError.js            # Custom error class
└── uploads/                   # Served as static files
    ├── images/
    ├── files/
    └── avatars/
```

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your values

# 3. Start dev server
npm run dev

# 4. Start production server
npm start
```

---

## 🔑 Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `5000` |
| `NODE_ENV` | `development` / `production` | `development` |
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017/lockgate_chat` |
| `JWT_SECRET` | Access token secret (min 32 chars) | — |
| `JWT_EXPIRES_IN` | Access token TTL | `15m` |
| `JWT_REFRESH_SECRET` | Refresh token secret (min 32 chars) | — |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL | `30d` |
| `CLIENT_URL` | Allowed CORS origin(s), comma-separated | `http://localhost:3000` |
| `MAX_FILE_SIZE_MB` | Max upload size in MB | `10` |
| `UPLOAD_DIR` | Upload directory | `uploads` |
| `RATE_LIMIT_MAX` | Max requests per window | `100` |
| `AUTH_RATE_LIMIT_MAX` | Max auth attempts per 15 min | `10` |
| `LOG_LEVEL` | Winston log level | `info` |

---

## 📡 REST API Reference

### Auth `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | ❌ | Register new user |
| POST | `/login` | ❌ | Login, get tokens |
| POST | `/refresh` | ❌ | Refresh access token |
| POST | `/logout` | ✅ | Logout, revoke token |
| GET | `/me` | ✅ | Get current user |

**Register body:**
```json
{ "username": "john_doe", "email": "john@example.com", "password": "Secret123", "bio": "Hey!" }
```

**Login body:**
```json
{ "email": "john@example.com", "password": "Secret123" }
```

**Response shape:**
```json
{ "success": true, "message": "...", "data": { "user": {}, "accessToken": "...", "refreshToken": "..." } }
```

---

### Groups `/api/groups`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | ✅ | Browse public groups (`?search=&page=&limit=`) |
| GET | `/my` | ✅ | My joined groups |
| POST | `/` | ✅ | Create group |
| POST | `/join-invite` | ✅ | Join private group via invite code |
| GET | `/:id` | ✅ | Get group details |
| POST | `/:id/join` | ✅ | Join public group |
| POST | `/:id/leave` | ✅ | Leave group |
| PATCH | `/:id` | ✅ Admin | Update group info |
| DELETE | `/:id` | ✅ Owner | Delete group |
| GET | `/:id/members` | ✅ Member | List members |
| PATCH | `/:id/members/:userId/role` | ✅ Admin | Change member role |
| DELETE | `/:id/members/:userId` | ✅ Mod+ | Kick member |
| POST | `/:id/invite/regenerate` | ✅ Admin | Regenerate invite code |
| POST | `/:id/avatar` | ✅ Admin | Upload group avatar |

**Create group body:**
```json
{ "name": "Sailors Hub", "description": "...", "type": "public", "maxMembers": 200, "tags": ["sailing"] }
```

---

### Messages `/api/groups/:groupId/messages`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | ✅ Member | Get messages (`?page=&limit=&before=`) |
| POST | `/` | ✅ Member | Send message (+ file upload via `multipart/form-data`) |
| PATCH | `/:messageId` | ✅ Sender | Edit message |
| DELETE | `/:messageId` | ✅ Sender/Mod | Delete message (soft) |
| POST | `/:messageId/react` | ✅ Member | Toggle emoji reaction |
| POST | `/read` | ✅ Member | Mark all as read |
| POST | `/:messageId/pin` | ✅ Admin | Pin/unpin message |

**Send message (text):**
```json
{ "content": "Hello everyone!", "type": "text" }
```

**Send message with file** (`multipart/form-data`):
```
content: "Here's a photo"
files: [<file>]   ← up to 5 files
```

**Reply to message:**
```json
{ "content": "Agree!", "type": "reply", "replyTo": "<messageId>" }
```

---

### Users `/api/users`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/search?q=` | ✅ | Search users |
| GET | `/:id` | ✅ | Get user profile |
| PATCH | `/me` | ✅ | Update profile |
| POST | `/me/avatar` | ✅ | Upload avatar |
| PATCH | `/me/password` | ✅ | Change password |

---

## 🔌 Socket.io Events

Connect with:
```js
const socket = io('http://localhost:5000', {
  auth: { token: '<accessToken>' }
});
```

### Client → Server (emit)

| Event | Payload | Description |
|---|---|---|
| `group:join` | `{ groupId }` | Join a group room |
| `group:leave` | `{ groupId }` | Leave a group room |
| `message:send` | `{ groupId, content, type?, replyTo? }` | Send message |
| `message:edit` | `{ messageId, groupId, content }` | Edit message |
| `message:delete` | `{ messageId, groupId }` | Delete message |
| `message:react` | `{ messageId, groupId, emoji }` | Toggle reaction |
| `typing:start` | `{ groupId }` | Start typing |
| `typing:stop` | `{ groupId }` | Stop typing |
| `messages:read` | `{ groupId }` | Mark as read |

### Server → Client (listen)

| Event | Payload | Description |
|---|---|---|
| `message:new` | `{ message }` | New message received |
| `message:edited` | `{ message }` | Message was edited |
| `message:deleted` | `{ messageId, groupId }` | Message was deleted |
| `message:reacted` | `{ messageId, reactions }` | Reaction updated |
| `typing:update` | `{ groupId, typingUsers: [{userId, username}] }` | Who's typing |
| `messages:read` | `{ groupId, userId }` | User read messages |
| `user:online` | `{ userId, username }` | User came online |
| `user:offline` | `{ userId, username, lastSeen }` | User went offline |

---

## 🔒 Security Features

- **Helmet** — HTTP security headers
- **CORS** — configurable per-origin whitelist
- **Rate limiting** — general API + strict auth limits
- **Speed limiting** — progressive delay after threshold
- **express-mongo-sanitize** — prevent NoSQL injection
- **XSS sanitization** — message content stripped of HTML
- **JWT rotation** — short-lived access tokens + refresh token
- **Soft deletes** — messages never permanently erased (audit trail)
- **Password hashing** — bcrypt with cost factor 12
- **Password change invalidation** — all sessions revoked on password change

---

## 📦 Production Deployment Checklist

- [ ] Set strong `JWT_SECRET` and `JWT_REFRESH_SECRET` (32+ random chars)
- [ ] Set `NODE_ENV=production`
- [ ] Configure `CLIENT_URL` to your real frontend domain
- [ ] Use a managed MongoDB (Atlas) with auth + IP allowlist
- [ ] Store uploads on S3/GCS instead of local disk
- [ ] Put Nginx in front as reverse proxy
- [ ] Enable SSL/TLS termination at load balancer
- [ ] Set up log aggregation (Datadog, Logtail, Papertrail)
- [ ] Configure `LOG_LEVEL=warn` in production
- [ ] Use PM2 or a process manager with cluster mode
