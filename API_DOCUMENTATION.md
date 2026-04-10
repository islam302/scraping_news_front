# Scraping News API Documentation

**Base URL:** `https://una-ai-tools-apis.una-oic.org/scraping-api/`

---

## Authentication

All endpoints (except file download) require authentication via one of:

| Method | Header | Format |
|--------|--------|--------|
| JWT Token | `Authorization` | `Bearer <token>` |
| API Key | `X-API-Key` | `<api_key>` |

**Auth Service:** `https://una-ai-tools-apis.una-oic.org/auth-api/`

**Unauthenticated Response (401):**
```json
{
  "detail": "Authentication credentials were not provided."
}
```

---

## Endpoints

### 1. Site Lists

#### `GET /api/site-lists/` — List all site lists

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

**Response `201`:**
```json
{
  "name": "gulf_sites",
  "site_count": 0,
  "sites": []
}
```

**Error `400`:** `name` is required or list already exists.

---

#### `GET /api/site-lists/<list_name>/` — Get list details

**Path Params:** `list_name` (e.g. `arabic_sites`)

**Response `200`:**
```json
{
  "name": "arabic_sites",
  "site_count": 16,
  "sites": [
    {
      "id": "uuid",
      "name": "وكالة الأنباء السعودية",
      "lang": "arabic",
      "search_url": "https://spa.gov.sa/search?q={q}"
    }
  ]
}
```

---

#### `PUT /api/site-lists/<list_name>/` — Update a list

**Request Body** (all fields optional):
```json
{
  "name": "new_list_name",
  "site_ids": ["uuid1", "uuid2", "uuid3"]
}
```

- `name` — Rename the list.
- `site_ids` — Replace all sites in the list with these IDs.

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

Unassigns all sites from the list (sites are NOT deleted).

**Response `200`:**
```json
{
  "deleted_list": "arabic_sites",
  "sites_unassigned": 16
}
```

---

#### `POST /api/site-lists/<list_name>/sites/` — Add sites to list

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

---

#### `DELETE /api/site-lists/<list_name>/sites/` — Remove sites from list

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
| `site_list` | Filter by list name (e.g. `?site_list=arabic_sites`) |

**Response `200`:**
```json
{
  "sites": [
    {
      "id": "uuid",
      "name": "وكالة الأنباء السعودية",
      "lang": "arabic",
      "site_list": "arabic_sites",
      "search_url": "https://spa.gov.sa/search?q={q}",
      "selectors": { }
    }
  ],
  "count": 30
}
```

---

#### `POST /api/sites/` — Add site(s)

**Request Body** (single or array):
```json
{
  "name": "string (required)",
  "lang": "string (default: 'arabic')",
  "site_list": "string (optional)",
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
  "site_list": "string",
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
  "site_list": "string",
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

### 5. Missions

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

### 6. Download

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

## Typical Frontend Flow

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
