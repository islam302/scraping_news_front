# Scraping News API Documentation

**Base URL:** `https://una-ai-tools-apis.una-oic.org/scraping-api/`

---

## Authentication

All endpoints (except file download) require authentication via one of:

| Method | Header | Format |
|--------|--------|--------|
| JWT Token | `Authorization` | `Bearer <token>` |
| API Key | `X-API-Key` | `<api_key>` |

**Auth Service:** `https://authentication-system-4svs.onrender.com`

**Unauthenticated Response (401):**
```json
{
  "detail": "Authentication credentials were not provided."
}
```

---

## Endpoints

### 1. Sites

#### `GET /api/sites/` — List all sites

**Response `200`:**
```json
{
  "sites": [
    {
      "id": "uuid",
      "name": "site_name",
      "lang": "arabic",
      "search_url": "https://example.com/search?q=",
      "selectors": { }
    }
  ],
  "count": 5
}
```

---

#### `POST /api/sites/` — Add site(s)

**Request Body** (single or array):
```json
{
  "name": "string (required)",
  "lang": "string (default: 'arabic')",
  "search_url": "string (required)",
  "selectors": { }
}
```

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
  "search_url": "string",
  "selectors": { },
  "is_active": true
}
```

**Response `200`:**
```json
{
  "id": "uuid",
  "name": "string",
  "lang": "string",
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

**Error `404`:** Site not found.

---

### 2. Scraping

#### `POST /api/scrape/` — Start a scraping mission

**Request Body:**
```json
{
  "keyword": "string (required)",
  "date_filter": "none | 24h | 48h | week | month"
}
```

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

> The scraping runs in the background. Poll `GET /api/missions/<mission_id>/` for progress.

**Error `400`:** Invalid `keyword` or `date_filter`.

---

### 3. Missions

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

##### While in progress (`pending` / `scraping` / `filtering`):
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
  "progress": {
    "total": 20,
    "done": 20,
    "current_site": ""
  },
  "created_at": "2026-03-29T10:30:00Z",
  "completed_at": "2026-03-29T10:32:00Z",
  "total_results": 35,
  "site_stats": {
    "aljazeera": { "before": 15, "after": 10 },
    "bbc_arabic": { "before": 12, "after": 8 }
  },
  "ai_filter": {
    "before": 50,
    "after": 35
  },
  "excel_download": "/api/missions/download/results_abc123.xlsx",
  "results": [
    {
      "Site": "aljazeera",
      "Title": "Article title",
      "Paragraph": "Article snippet...",
      "Date": "2026-03-28",
      "Link": "https://example.com/article"
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
  "progress": { },
  "created_at": "2026-03-29T10:30:00Z",
  "error": "Error description"
}
```

**Error `404`:** Mission not found.

---

#### `DELETE /api/missions/` — Delete all missions

**Response `200`:**
```json
{
  "deleted": 12
}
```

---

### 4. Download

#### `GET /api/missions/download/<filename>/` — Download Excel results

**No authentication required.**

**Path Params:** `filename` (e.g. `results_abc123.xlsx`)

**Response `200`:**
- Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Headers: `Content-Disposition: attachment; filename=results_*.xlsx`

**Error `404`:** File not found (returns styled HTML error page).

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
| `completed` | Done — results available |
| `failed` | Error occurred — check `error` field |

---

## Typical Frontend Flow

```
1. POST /api/scrape/  →  get mission_id
2. Poll GET /api/missions/<mission_id>/  every 3-5 seconds
3. Show progress bar using progress.done / progress.total
4. When status = "completed":
   - Render results array in table
   - Show excel_download link for export
5. When status = "failed":
   - Show error message to user
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
