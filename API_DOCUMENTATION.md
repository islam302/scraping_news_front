# Scraping News API Documentation

**Base URL:** `https://una-ai-tools-apis.una-oic.org/scraping-api/`

---

## Authentication

All endpoints (except file download) require authentication via one of:

| Method | Header | Format |
|--------|--------|--------|
| JWT Token | `Authorization` | `Bearer <token>` |
| API Key | `X-API-Key` | `<api_key>` |

**Auth Base URL:** `https://una-ai-tools-apis.una-oic.org/auth-api/`

**Unauthenticated Response (401):**
```json
{
  "detail": "Authentication credentials were not provided."
}
```

---

## URL Trailing Slash

All endpoints accept URLs **with or without** a trailing slash. Both work identically:

```
GET /api/sites      ✓
GET /api/sites/     ✓
GET /api/missions   ✓
GET /api/missions/  ✓
```

This applies to all routes in the API.

---

## Auth API Endpoints

**Base URL:** `https://una-ai-tools-apis.una-oic.org/auth-api/`

### 1. Token (Login / Refresh / Verify)

#### `POST /api/auth/token/` — Login (get JWT tokens)

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response `200`:**
```json
{
  "access": "eyJ...",
  "refresh": "eyJ..."
}
```

---

#### `POST /api/auth/token/refresh/` — Refresh access token

**Request Body:**
```json
{
  "refresh": "eyJ..."
}
```

**Response `200`:**
```json
{
  "access": "eyJ..."
}
```

---

#### `POST /api/auth/token/verify/` — Verify token validity

**Request Body:**
```json
{
  "token": "eyJ..."
}
```

**Response `200`:** `{}` (valid)

**Response `401`:** Token is invalid or expired.

---

### 2. Register

#### `POST /api/auth/register/` — Register a new user

**Request Body:**
```json
{
  "username": "string",
  "email": "string",
  "password": "string",
  "organization": "string (optional)"
}
```

**Response `201`:**
```json
{
  "id": "uuid",
  "username": "string",
  "email": "string"
}
```

---

### 3. Profile

#### `GET /api/auth/profile/` — Get current user profile

**Headers:** `Authorization: Bearer <token>` or `X-API-Key: <key>`

**Response `200`:**
```json
{
  "id": "uuid",
  "username": "string",
  "email": "string",
  "organization": "string",
  "role": "user | admin"
}
```

---

#### `PATCH /api/auth/profile/` — Update profile

**Headers:** `Authorization: Bearer <token>`

**Request Body** (partial):
```json
{
  "email": "new@email.com",
  "organization": "string"
}
```

**Response `200`:** Updated profile object.

---

### 4. API Keys

#### `GET /api/auth/api-keys/` — List API keys

**Headers:** `Authorization: Bearer <token>`

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "key": "abc123...",
    "created_at": "2026-01-01T00:00:00Z"
  }
]
```

---

#### `POST /api/auth/api-keys/` — Create a new API key

**Headers:** `Authorization: Bearer <token>`

**Response `201`:**
```json
{
  "id": "uuid",
  "key": "abc123..."
}
```

---

#### `DELETE /api/auth/api-keys/<key_id>/` — Delete an API key

**Headers:** `Authorization: Bearer <token>`

**Response `200`:**
```json
{
  "deleted": true
}
```

---

### 5. Password Reset

#### `POST /api/auth/password-reset/` — Request password reset email

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response `200`:**
```json
{
  "message": "Password reset email sent"
}
```

---

#### `POST /api/auth/password-reset-confirm/<token>/<uidb64>/` — Confirm reset

**Request Body:**
```json
{
  "password": "new_password"
}
```

**Response `200`:**
```json
{
  "message": "Password updated successfully"
}
```

---

### 6. User Management (Admin Only)

All require `Authorization: Bearer <admin_token>`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/auth/users/` | List all users |
| `GET` | `/api/auth/users/<user_id>/` | Get user details |
| `POST` | `/api/auth/users/` | Create user |
| `PATCH` | `/api/auth/users/<user_id>/` | Update user |
| `DELETE` | `/api/auth/users/<user_id>/` | Delete user |

#### Create/Update User Body:
```json
{
  "username": "string",
  "email": "string",
  "password": "string",
  "organization": "string",
  "role": "user | admin"
}
```

---

### Auth Flow Summary

```
1. POST /api/auth/register/              → Create account
2. POST /api/auth/token/                 → Get access + refresh tokens
3. Use access token:  Authorization: Bearer <access>
4. POST /api/auth/token/refresh/         → Renew expired access token
5. POST /api/auth/api-keys/             → Get permanent API key
6. Use API key:       X-API-Key: <key>
```

---

## Scraping API Endpoints

**Base URL:** `https://una-ai-tools-apis.una-oic.org/scraping-api/`

### 1. Site Lists

> A site can belong to **multiple lists** simultaneously.
> Adding/removing/deleting a list **never** deletes a site from the master list (`/api/sites/`).

#### `GET /api/site-lists/` — List all site lists

Returns every list currently in use, plus any created-but-empty lists pending first assignment.

**Response `200`:**
```json
{
  "site_lists": [
    {
      "name": "arabic_sites",
      "site_count": 16,
      "sites": [
        { "id": "uuid", "name": "وكالة الأنباء السعودية" }
      ]
    },
    {
      "name": "other_langs",
      "site_count": 14,
      "sites": [...]
    }
  ],
  "count": 2
}
```

---

#### `POST /api/site-lists/` — Create a new site list

**Request Body:**
```json
{
  "name": "gulf_sites"
}
```

| Field | Rules |
|-------|-------|
| `name` | Required. Any non-empty string (Arabic, spaces, symbols — all allowed). Max 100 characters. Must be unique. |

**Response `201`:**
```json
{
  "name": "gulf_sites",
  "site_count": 0,
  "sites": []
}
```

**Examples of valid names:**
```
"gulf_sites"
"مواقع الخليج"
"Morning Scan 🌅"
"priority-A"
```

**Error `400`:** `name` missing, empty, longer than 100 chars, or already exists.

---

#### `GET /api/site-lists/<list_name>/` — Get list details

**Path Params:** `list_name` (e.g. `arabic_sites`, supports Arabic / spaces / special chars URL-encoded)

**Response `200`:**
```json
{
  "name": "arabic_sites",
  "site_count": 16,
  "sites": [
    {
      "id": "uuid",
      "name": "وكالة الأنباء السعودية",
      "site_lists": ["arabic_sites", "gulf_sites"]
    }
  ]
}
```

> A site may appear in multiple lists — its `site_lists` array shows all memberships.

---

#### `PUT /api/site-lists/<list_name>/` — Update a list

**Request Body** (all fields optional):
```json
{
  "name": "new_list_name",
  "site_ids": ["uuid1", "uuid2", "uuid3"]
}
```

| Field | Description |
|-------|-------------|
| `name` | Rename the list (updates the name in every site's `site_lists` array). Fails with `400` if a list with the new name already exists. |
| `site_ids` | Replace the membership of this list — other lists on those sites are preserved. |

**Response `200`:**
```json
{
  "name": "new_list_name",
  "site_count": 3,
  "sites": [...]
}
```

---

#### `DELETE /api/site-lists/<list_name>/` — Delete a list

Removes the list name from every site's `site_lists` array. Sites themselves are **not** deleted, and their other list memberships are preserved.

**Response `200`:**
```json
{
  "deleted_list": "arabic_sites",
  "sites_unassigned": 16
}
```

---

#### `POST /api/site-lists/<list_name>/sites/` — Add sites to list

Appends `<list_name>` to each site's `site_lists` array. **Does not remove the site from any other list it belongs to.**

**Request Body:**
```json
{
  "site_ids": ["uuid1", "uuid2"]
}
```

**Response `200`:**
```json
{
  "added": 2,
  "list": "arabic_sites"
}
```

> `added` counts only sites that weren't already in the list.

---

#### `DELETE /api/site-lists/<list_name>/sites/` — Remove sites from list

Removes `<list_name>` from each site's `site_lists` array. **Other list memberships remain untouched.**

**Request Body:**
```json
{
  "site_ids": ["uuid1"]
}
```

**Response `200`:**
```json
{
  "removed": 1,
  "list": "arabic_sites"
}
```

---

### 2. Sites

#### `GET /api/sites/` — List all sites

**Query Params:**
| Param | Description |
|-------|-------------|
| `site_list` | Filter by list name (e.g. `?site_list=arabic_sites`). Returns sites whose `site_lists` array contains this value. |

**Response `200`:**
```json
{
  "sites": [
    {
      "id": "uuid",
      "name": "وكالة الأنباء السعودية",
      "lang": "arabic",
      "site_lists": ["arabic_sites", "gulf_sites"],
      "search_url": "https://spa.gov.sa/search?q={q}",
      "selectors": { }
    }
  ],
  "count": 30
}
```

> A site can belong to **multiple lists** at the same time (e.g. Saudi in both `arabic_sites` and `gulf_sites`).

---

#### `POST /api/sites/` — Add site(s)

**Request Body** (single or array):
```json
{
  "name": "string (required)",
  "lang": "string (default: 'arabic')",
  "site_lists": ["arabic_sites", "gulf_sites"],
  "search_url": "string (required)",
  "selectors": { }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `site_lists` | array of strings | Lists this site belongs to (optional). |
| `site_list` | string | Legacy alias — accepted as a single-item list. |

**Response `201`:**
```json
{
  "created": 1,
  "updated": 0
}
```

**Error `400`:** `name` and `search_url` are required.

---

#### `PUT /api/sites/<site_id>/` — Update a site

**Path Params:** `site_id` (UUID)

**Request Body** (partial or full):
```json
{
  "name": "string",
  "lang": "string",
  "site_lists": ["arabic_sites", "gulf_sites"],
  "search_url": "string",
  "selectors": { },
  "is_active": true
}
```

> `site_list` (singular string) is still accepted for backward compatibility — it's converted to a single-item `site_lists` array.

**Response `200`:**
```json
{
  "id": "uuid",
  "name": "string",
  "lang": "string",
  "site_lists": ["arabic_sites", "gulf_sites"],
  "search_url": "string",
  "selectors": { }
}
```

**Error `404`:** Site not found.

---

#### `DELETE /api/sites/<site_id>/` — Delete a site (soft delete)

**Path Params:** `site_id` (UUID)

**Response `200`:**
```json
{
  "deleted": "site_name"
}
```

---

### 3. Scraping (Full Pipeline)

#### `POST /api/scrape/` — Start a full scraping mission

Runs Google SerpAPI search + Playwright site scraping + AI filtering.

**Request Body:**
```json
{
  "keyword": "string (required)",
  "date_filter": "none | 24h | 48h | week | month",
  "site_list": "string or array (optional)"
}
```

| Field | Description |
|-------|-------------|
| `keyword` | Search keyword (required) |
| `date_filter` | Time filter (default: `"none"`) |
| `site_list` | `"arabic_sites"` or `["arabic_sites", "other_langs"]` or omit for all |

| `date_filter` | Description |
|---------------|-------------|
| `none` | No date filter (default) |
| `24h` | Last 24 hours |
| `48h` | Last 48 hours |
| `week` | Last 7 days |
| `month` | Last 30 days |

**Response `202`:**
```json
{
  "mission_id": "uuid",
  "status": "pending"
}
```

> Runs in background via Celery. Poll `GET /api/missions/<mission_id>/` for progress.

**Error `400`:** Invalid `keyword`, `date_filter`, or `site_list`.

---

### 4. Google Search Only

#### `POST /api/google-search/` — Google-only search mission

Searches Google (SerpAPI) for the keyword across all sites. No Playwright scraping, no AI filtering. Faster than full scrape.

**Request Body:**
```json
{
  "keyword": "string (required)",
  "date_filter": "none | 24h | 48h | week | month",
  "site_list": "string or array (optional)"
}
```

**Response `202`:**
```json
{
  "mission_id": "uuid",
  "status": "pending"
}
```

> Runs in background via Celery. Poll `GET /api/missions/<mission_id>/` for results.

---

### 5. Scheduled Scraping (Recurring)

#### `POST /api/scrape/scheduled/` — Create a scheduled recurring scrape

Creates a recurring scrape job that runs automatically every N hours for a total duration.

**Request Body:**
```json
{
  "keyword": "string (required)",
  "date_filter": "none | 24h | 48h | week | month",
  "site_list": "string or array (optional)",
  "interval_hours": 3,
  "duration_hours": 24
}
```

| Field | Description |
|-------|-------------|
| `keyword` | Search keyword (required) |
| `date_filter` | Time filter (default: `"none"`) |
| `site_list` | Site list filter (same as `/api/scrape/`) |
| `interval_hours` | Run every N hours (min: 1) |
| `duration_hours` | Total duration before auto-expiry (must be >= interval_hours) |

**Response `202`:**
```json
{
  "id": "uuid",
  "keyword": "مضيق هرمز",
  "status": "active",
  "interval_hours": 3,
  "duration_hours": 24,
  "expires_at": "2026-04-11T10:30:00Z",
  "message": "Scheduled: runs every 3h for 24h. First run dispatched."
}
```

> First run starts immediately. Each subsequent run is auto-dispatched via Celery self-chaining (no Celery Beat required). Each run creates a new Mission.

**SerpAPI Budget Note:**
| Interval | Runs/day | SerpAPI calls/day (16 sites) |
|----------|----------|------------------------------|
| 1h | 24 | 384 |
| 3h | 8 | 128 |
| 6h | 4 | 64 |

---

#### `GET /api/scrape/scheduled/` — List all scheduled scrapes

**Response `200`:**
```json
{
  "scheduled_scrapes": [
    {
      "id": "uuid",
      "keyword": "مضيق هرمز",
      "date_filter": "24h",
      "site_lists": ["arabic_sites"],
      "interval_hours": 3,
      "duration_hours": 24,
      "status": "active",
      "run_count": 4,
      "started_at": "2026-04-10T10:30:00Z",
      "next_run_at": "2026-04-10T22:30:00Z",
      "expires_at": "2026-04-11T10:30:00Z"
    }
  ],
  "count": 1
}
```

---

#### `GET /api/scrape/scheduled/<id>/` — Get schedule details + missions

**Response `200`:**
```json
{
  "id": "uuid",
  "keyword": "مضيق هرمز",
  "date_filter": "24h",
  "site_lists": ["arabic_sites"],
  "interval_hours": 3,
  "duration_hours": 24,
  "status": "active",
  "run_count": 4,
  "started_at": "2026-04-10T10:30:00Z",
  "next_run_at": "2026-04-10T22:30:00Z",
  "expires_at": "2026-04-11T10:30:00Z",
  "missions": [
    {
      "mission_id": "uuid",
      "status": "completed",
      "total_results": 42,
      "created_at": "2026-04-10T19:30:00Z",
      "completed_at": "2026-04-10T19:34:00Z"
    },
    {
      "mission_id": "uuid",
      "status": "completed",
      "total_results": 38,
      "created_at": "2026-04-10T16:30:00Z",
      "completed_at": "2026-04-10T16:33:00Z"
    }
  ]
}
```

> Each mission can be viewed via `GET /api/missions/<mission_id>/` for full results.

---

#### `DELETE /api/scrape/scheduled/<id>/` — Stop a scheduled scrape

Cancels all future runs. Already-completed missions are NOT deleted.

**Response `200`:**
```json
{
  "id": "uuid",
  "status": "stopped",
  "message": "Schedule stopped. No future runs will be dispatched."
}
```

---

#### Scheduled Scrape Status Flow

```
ACTIVE → EXPIRED   (auto, when now >= expires_at)
ACTIVE → STOPPED   (manual, via DELETE)
```

| Status | Description |
|--------|-------------|
| `active` | Running — next run is scheduled |
| `stopped` | Manually stopped by user |
| `expired` | Duration reached — no more runs |

---

### 6. Missions (apply for all types of scrape and google search)

#### `GET /api/missions/` — List all missions

Returns the 50 most recent missions, newest first.

**Response `200`:**
```json
{
  "missions": [
    {
      "mission_id": "uuid",
      "keyword": "string",
      "status": "pending | scraping | filtering | completed | failed",
      "total_results": 42,
      "created_at": "2026-03-29T10:30:00Z",
      "completed_at": "2026-03-29T10:32:00Z"
    }
  ]
}
```

---

#### `GET /api/missions/<mission_id>/` — Get mission status & results

**Path Params:** `mission_id` (UUID)

##### While in progress:
```json
{
  "mission_id": "uuid",
  "keyword": "string",
  "status": "scraping",
  "progress": {
    "total": 20,
    "done": 8,
    "current_site": "aljazeera"
  },
  "created_at": "2026-03-29T10:30:00Z"
}
```

##### On `completed`:
```json
{
  "mission_id": "uuid",
  "keyword": "string",
  "status": "completed",
  "created_at": "2026-03-29T10:30:00Z",
  "completed_at": "2026-03-29T10:32:00Z",
  "total_results": 35,
  "site_stats": {
    "وكالة الأنباء السعودية": { "before": 15, "after": 10 },
    "Google (بحث دقيق)": { "before": 42, "after": 30 }
  },
  "ai_filter": {
    "before": 150,
    "after": 35
  },
  "excel_download": "https://...download/results_abc123.xlsx/",
  "results": [
    {
      "Site": "وكالة الأنباء السعودية",
      "Title": "Article title",
      "Paragraph": "Article snippet...",
      "Date": "2026-03-28",
      "Link": "https://example.com/article",
      "Image": "https://example.com/image.jpg"
    }
  ]
}
```

##### On `failed`:
```json
{
  "mission_id": "uuid",
  "keyword": "string",
  "status": "failed",
  "created_at": "2026-03-29T10:30:00Z",
  "error": "Error description"
}
```

**Error `404`:** Mission not found.

---

#### `DELETE /api/missions/<mission_id>/` — Delete a single mission

**Response `200`:**
```json
{
  "deleted": "keyword_name"
}
```

---

#### `DELETE /api/missions/` — Delete all missions

**Response `200`:**
```json
{
  "deleted": 12
}
```

---

### 7. Download

#### `GET /api/missions/download/<filename>/` — Download Excel results

**No authentication required.**

**Path Params:** `filename` (e.g. `results_abc123.xlsx`)

**Response `200`:**
- Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Headers: `Content-Disposition: attachment; filename=results_*.xlsx`

**Error `404`:** File not found.

---

## Pipeline Flow

### Full Scrape (`/api/scrape/`)
```
1. Google SerpAPI search (per site, sequential)
2. Playwright scraping (parallel browser groups)
3. Merge results + deduplicate by Link
4. AI filter (GPT-4o, batched 10 articles/call)
5. Generate Excel
6. Save to DB
```

### Google Only (`/api/google-search/`)
```
1. Google SerpAPI search (per site, sequential)
2. Generate Excel
3. Save to DB
```

### Scheduled Scrape (`/api/scrape/scheduled/`)
```
1. Create ScheduledScrape record
2. Dispatch first run immediately
3. Each run:
   a. Google SerpAPI search (per site)
   b. Playwright scraping (parallel)
   c. Merge + deduplicate + AI filter
   d. Save Mission + results + Excel
4. After each run: re-enqueue with countdown = interval_hours × 3600
5. Stop when: expired (duration reached) or stopped (by user)
```

---

## Mission Status Flow

```
pending → scraping → filtering → completed
                                ↘ failed
```

| Status | Description |
|--------|-------------|
| `pending` | Mission created, waiting to start |
| `scraping` | Actively scraping sites |
| `filtering` | AI filtering results for relevance |
| `completed` | Done — results & Excel available |
| `failed` | Error occurred — check `error` field |

---

## Typical Frontend Flows

### One-time scrape:
```
1. POST /api/scrape/ (or /api/google-search/)  →  get mission_id
2. Poll GET /api/missions/<mission_id>/  every 3-5 seconds
3. Show progress bar using progress.done / progress.total
4. When status = "completed":
   - Render results array in table
   - Show excel_download link for export
   - Display Image for each result
5. When status = "failed":
   - Show error message to user
```

### Scheduled recurring scrape:
```
1. POST /api/scrape/scheduled/  →  get schedule id
2. Poll GET /api/scrape/scheduled/<id>/  to see run_count + missions
3. For each mission in the missions array:
   - GET /api/missions/<mission_id>/  for full results
4. To stop:  DELETE /api/scrape/scheduled/<id>/
```

---

## Error Response Format

All errors follow this pattern:

```json
{
  "error": "Description of what went wrong"
}
```

| Code | Meaning |
|------|---------|
| `400` | Bad request — missing/invalid parameters |
| `401` | Unauthorized — missing or invalid auth |
| `404` | Resource not found |
| `500` | Server error |

---

## CORS

All origins are allowed. No special CORS configuration needed on the frontend.

---

## Docker Deployment

The project ships with a full Docker setup for easy deployment.

### Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Builds the Python image with Playwright Chromium |
| `docker-compose.yml` | Orchestrates 5 services: db, redis, web, celery-worker, celery-beat |
| `.dockerignore` | Excludes dev files from the image |
| `.env.example` | Template for environment variables |

### Services

| Service | Port | Description |
|---------|------|-------------|
| `db` | `5432` | PostgreSQL 16 |
| `redis` | `6379` | Celery broker + result backend |
| `web` | `8000` | Django API (gunicorn, 3 workers) |
| `celery-worker` | — | Runs scrape tasks (solo pool, `vps_queue`) |
| `celery-beat` | — | Scheduler for cleanup tasks |

### Quick Start

**1. Clone + setup env:**
```bash
git clone <repo>
cd scraping_news_api
cp .env.example .env
# Edit .env and set OPENAI_API_KEY + SERPAPI_KEY
```

**2. Build and start:**
```bash
docker compose up -d --build
```

**3. Run migrations (first time only):**
```bash
docker compose exec web python manage.py migrate
```

**4. Check logs:**
```bash
docker compose logs -f web celery-worker
```

**5. Access the API:**
```
http://localhost:8000/api/
```

### Environment Variables

Set these in `.env`:

| Variable | Required | Description |
|----------|----------|-------------|
| `SECRET_KEY` | Yes (prod) | Django secret key |
| `DEBUG` | No | `0` for production, `1` for dev |
| `ALLOWED_HOSTS` | No | Comma-separated hosts (default: `*`) |
| `DB_NAME` | No | Postgres DB name (default: `scraping_news`) |
| `DB_USER` | No | Postgres user (default: `postgres`) |
| `DB_PASSWORD` | No | Postgres password (default: `postgres`) |
| `OPENAI_API_KEY` | Yes | For AI filtering (GPT-4o) |
| `SERPAPI_KEY` | Yes | For Google search |
| `EXTERNAL_AUTH_BASE_URL` | No | Auth service URL |
| `PLAYWRIGHT_PROXY` | No | Optional proxy for anti-bot bypass |

### Common Commands

```bash
# Stop all services
docker compose down

# Rebuild after code changes
docker compose up -d --build web celery-worker

# Run Django commands
docker compose exec web python manage.py createsuperuser
docker compose exec web python manage.py shell

# View logs for a specific service
docker compose logs -f celery-worker

# Restart a single service
docker compose restart web

# Remove volumes (DESTRUCTIVE — deletes DB!)
docker compose down -v
```

### Production Notes

- Put a reverse proxy (nginx/Caddy) in front of `web:8000` for HTTPS
- Set `DEBUG=0` and a real `SECRET_KEY` in `.env`
- Set `ALLOWED_HOSTS` to your domain
- Use external managed Postgres/Redis for production (not the compose-provided ones)
- Mount `media_data` volume for Excel exports persistence
- Playwright Chromium is included — needs ~1GB disk per container

### VPS Deployment (Without Docker)

If deploying without Docker on a VPS:

**1. Install system deps:**
```bash
sudo apt-get install python3.13 python3-pip postgresql redis-server
```

**2. Install Python deps:**
```bash
pip install -r requirements.txt
playwright install chromium
playwright install-deps
```

**3. Set env vars** (in `.env` or systemd service):
```bash
export OPENAI_API_KEY=sk-...
export SERPAPI_KEY=...
export DB_HOST=localhost
# etc.
```

**4. Run migrations:**
```bash
python manage.py migrate
python manage.py collectstatic --noinput
```

**5. Start services (systemd recommended):**
```bash
# API
gunicorn Config.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 300

# Celery worker
celery -A Config worker --loglevel=info -Q vps_queue,celery --pool=solo

# Celery beat (cleanup)
celery -A Config beat --loglevel=info
```

---

## Project Structure

```
scraping_news_api/
├── Config/                  # Django project
│   ├── settings.py          # Config (reads from env vars)
│   ├── celery.py            # Celery app + cleanup schedule
│   ├── auth_utils.py        # External JWT + API Key auth
│   └── urls.py
├── scraper/                 # Main app
│   ├── models.py            # SiteConfig, Mission, ScheduledScrape, MissionResult
│   ├── views.py             # All API endpoints
│   ├── urls.py              # URL patterns (with/without trailing slash)
│   ├── tasks.py             # Celery tasks (scrape, google, scheduled, cleanup)
│   ├── services.py          # Scrape pipeline orchestration
│   ├── scraping.py          # Per-site scraping logic
│   ├── browser.py           # Playwright stealth browser
│   ├── parsers.py           # HTML parsing + article extraction
│   ├── filters.py           # AI filter (GPT-4o batched)
│   ├── google_search.py     # SerpAPI client
│   ├── config.py            # Env/DB config helpers
│   └── migrations/          # DB migrations (0001-0011)
├── user_auth/               # External auth client
├── media/exports/           # Generated Excel files
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── API_DOCUMENTATION.md     # This file
└── manage.py
```
