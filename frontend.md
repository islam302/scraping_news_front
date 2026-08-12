# Frontend Integration Reference — Category News Scraper

Reference for frontend developers integrating with the **category scrape** API.
Scraping is now **category-based only** — the old keyword "search bar" endpoints
(`/api/scrape`, `/api/google-search`, `/api/scrape/scheduled`, `/api/sites`,
`/api/site-lists`) have been **removed**.

---

## 1. Base URL & conventions

- **Path prefix:** every route is served under `/scraping-api` (Django
  `FORCE_SCRIPT_NAME = '/scraping-api'`).
  → Full base: `https://<host>/scraping-api/api/`
- **Trailing slash:** optional on every route (`/api/categories` == `/api/categories/`).
- **Content type:** JSON. Send `Content-Type: application/json` on POST/PATCH.
- **Encoding:** all Arabic is UTF-8.

### Authentication
| Endpoint group | Auth required |
|---|---|
| `category-*` (scrape, categories, sites, site-lists) | ❌ No (public / `AllowAny`) |
| `GET/DELETE /missions/` and `/missions/<id>/` | ✅ Yes (authenticated user) |
| `GET /missions/download/<file>/` | ❌ No (public download link) |

> Mission list/detail use the platform's standard authentication. Send the same
> auth header the rest of the authenticated app uses.

---

## 2. The scrape flow (how it fits together)

```
1. GET  /api/categories/            → discover category keys + site lists
2. POST /api/category-scrape/       → dispatch a scrape  → returns mission_id (202)
3. GET  /api/missions/<mission_id>/ → poll until status == "completed"
4. Use results[] from the poll response, or download the Excel via excel_download
```

`titles_only: true` is the exception — it runs **inline** and returns titles
directly in the POST response (no mission, no polling). Good for quick previews.

---

## 3. `POST /api/category-scrape/` — start a scrape

### Request body
| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `keyword` | string | ✅ | — | The Arabic search phrase. |
| `categories` | string[] \| string | ✅ | — | Category keys (see §5). Pass `["all"]` to search **every** category. |
| `site_lists` | string[] \| string | ❌ | all sites | Restrict to lists, e.g. `["arabic_sites"]` (see §6). |
| `max_days` | int | ❌ | `7` | Date window, **1–30**. Articles older than this are dropped. |
| `max_pages` | int | ❌ | `300` | Safety cap on pagination per category (1–300). Date window is the real stop. |
| `ai_filter` | bool | ❌ | `true` | OpenAI relevance filter (keyword match on title). `false` = keep everything crawled. |
| `titles_only` | bool | ❌ | `false` | `true` → run inline, return titles only (skips body fetch + mission). |

Aliases accepted: `category` (string) for `categories`, `site_list` for `site_lists`.

**Category rules:**
- `categories` is **required** — the API never crawls implicitly.
- Max **5** category keys per request, **unless** you pass the "all" token.
- **"all" token:** any of `"all"`, `"الكل"`, `"شامل"`, `"*"` → expands to every
  available category for the chosen `site_lists` and **bypasses the 5-cap**.
  Discoverable as `all_categories_token` in the `/api/categories/` response.

### Response — full run (HTTP `202 Accepted`)
```json
{
  "mission_id": "0b3f…-uuid",
  "status": "pending",
  "keyword": "أولمبياد العلوم النووية الدولي",
  "categories": ["general", "technology", "culture"],
  "site_lists": ["arabic_sites"],
  "poll": "/api/missions/0b3f…/",
  "message": "Category scrape dispatched. Poll the mission for results."
}
```
→ Then poll `GET /api/missions/<mission_id>/` (§7).

### Response — `titles_only: true` (HTTP `200 OK`, inline)
```json
{
  "keyword": "…", "max_days": 7, "max_pages": 300, "ai_filter": true,
  "categories": ["general"], "site_lists": ["arabic_sites"],
  "available_categories": ["general", "political", "..."],
  "crawled": 896, "after_ai": 3, "total_results": 3,
  "titles": ["عنوان 1", "عنوان 2", "عنوان 3"]
}
```

### Example
```json
POST /scraping-api/api/category-scrape/
{
  "keyword": "أولمبياد العلوم النووية الدولي",
  "categories": ["all"],
  "site_lists": ["arabic_sites"],
  "max_days": 7
}
```

### Errors (HTTP `400`)
| Condition | Response `error` |
|---|---|
| Missing keyword | `'keyword' is required` |
| Missing categories | `'categories' is required (pick at least one).` (+ `available_categories`) |
| > 5 categories (no "all") | `Too many categories: N. Max 5 per request. Use 'all' to search every category.` |
| Unknown category key | `Unknown category: [..]. Choose from: [...], or 'all' for every category.` |
| `max_days` not 1–30 | `'max_days' must be between 1 and 30` |

---

## 4. `GET /api/categories/` — discover categories

Optional query: `?site_lists=arabic_sites,gulf_agencies` to narrow.

```json
{
  "available_categories": ["general", "political", "economy", "..."],
  "categories": {
    "general": [
      {"site": "وكالة الأنباء السعودية", "label": "عام", "url": "https://spa.gov.sa/..."},
      {"site": "وكالة أنباء الإمارات",   "label": "عام", "url": "https://www.wam.ae/..."}
    ],
    "technology": [ {"site": "…", "label": "علوم وتقنيات", "url": "…"} ]
  },
  "site_lists": ["arabic_sites", "gulf_agencies", "other_sites"],
  "all_categories_token": "all"
}
```
- `available_categories` — flat list of keys to use in `categories`.
- `categories` — map of key → the sites exposing it (with each site's own label/URL).
- `all_categories_token` — pass this as a category to search everything.

---

## 5. Category keys (unified catalog)

Keys are **shared across sites** — selecting a key searches that topic on every
site that exposes it. `general` also auto-includes `political` (umbrella).

| Key | Meaning |
|---|---|
| `general` | عام / آخر الأخبار / دولي (world+international folded in) |
| `political` | سياسة / رئاسة / أحزاب |
| `local` | محليات |
| `regional` | إقليمي / محافظات / ولايات |
| `economy` | اقتصاد / مال وأعمال |
| `sport` | رياضة |
| `culture` | ثقافة / فنون |
| `technology` | علوم / تقنية / تكنولوجيا |
| `education` | تعليم |
| `health` | صحة |
| `social` | مجتمع / اجتماعي |
| `environment` | بيئة |
| `tourism` | سياحة وترفيه |
| `world` | منوعات عالمية |
| `security` | أمن / أمن وقضاء |
| `parliament` | برلمان / مجلس الشعب / التشريعي |
| `reports` | تقارير / تحقيقات / مقابلات |
| `opinion` | مقالات / آراء |
| `misc` | متفرقات / منوعات / أخرى |

### Per-site categories (16 active sites)
| Site | List | Category keys exposed |
|---|---|---|
| 🇸🇦 وكالة الأنباء السعودية (SPA) | gulf, arabic | general, political, economy, sport, social, culture, tourism, technology, health, environment, world |
| 🇦🇪 وكالة أنباء الإمارات (WAM) | gulf, arabic | general, economy, sport, technology, culture |
| 🇶🇦 وكالة الأنباء القطرية (QNA) | gulf, arabic | general, local, economy, sport, technology, misc |
| 🇱🇧 الوطنية للإعلام (NNA) | arabic | political, security, economy, misc, culture, sport, general, regional |
| 🇸🇾 وكالة أنباء سوريا (SANA) | arabic | general, local, parliament, economy, political, regional, sport |
| 🇩🇿 وكالة الأنباء الجزائرية (APS) | arabic | general, economy, culture, sport, political |
| 🇯🇴 بترا (PETRA) | arabic | general, local, economy, sport, culture, political, regional, education, reports, misc |
| 🇮🇶 وكالة الأنباء العراقية (INA) | arabic | general, political, local, security, economy, sport, culture, misc, reports, opinion |
| 🇵🇸 وفا (WAFA) | arabic | general, political, parliament, economy, culture, sport, environment, local, regional, opinion, reports, misc |
| 🇾🇪 سبأ (SABA) | arabic | general, local, economy, sport, culture, reports |
| 🇱🇾 وكالة الأنباء الليبية (LANA) | arabic | general, local, political, economy, culture, sport, reports, misc |
| 🇲🇷 وكالة الأنباء الموريتانية (AMI) | arabic | general, local, regional, economy, culture, sport, social, health |
| 🇸🇴 وكالة الأنباء الصومالية (SONNA) | arabic | general, local, culture, education, economy, sport, political, opinion |
| 🇦🇫 باختر (BAKHTAR) | other | political, economy, security, general, social, culture, health, technology, sport |
| 🇹🇯 خبر (KHOVAR) | other | political, parliament, economy, social, security, sport, culture, regional |
| 🇸🇳 وكالة الأنباء السنغالية (APS) | other | general, political, social, economy, culture, sport, environment, health, regional, misc, reports |

> **Google-only sources** (searched via Google index, not category-crawled, so
> they appear in results but not as `category-sites`): 🇴🇲 عُمان, 🇧🇭 البحرين, 🇲🇦 المغرب.

---

## 6. Site lists

Pass in `site_lists` to scope the scrape.

| List | Contents |
|---|---|
| `arabic_sites` | All Arab-country agencies (native Arabic). |
| `gulf_agencies` | Gulf subset (SPA, WAM, QNA) — also in `arabic_sites`. |
| `other_sites` | Non-Arab-country agencies: 🇦🇫 Bakhtar, 🇹🇯 Khovar, 🇸🇳 APS Senegal. Content may be a translated layer (APS Senegal = machine-translated). |

Omit `site_lists` to search **all** sites.

---

## 7. `GET /api/missions/<mission_id>/` — poll status (auth)

Poll every ~2–3s until `status` is `completed` or `failed`.

`status` values: `pending` → `scraping` → `filtering` → `completed` | `failed`.

### While running
```json
{ "mission_id": "…", "keyword": "…", "status": "scraping", "progress": {}, "created_at": "2026-08-11T…" }
```

### Completed
```json
{
  "mission_id": "…", "keyword": "…", "status": "completed",
  "created_at": "…", "completed_at": "…",
  "total_results": 3,
  "ai_filter": { "before": 5408, "after": 3 },
  "site_stats": { "…": {"before": N, "after": M} },
  "excel_download": "https://<host>/scraping-api/api/missions/download/category_ab12cd34.xlsx/",
  "results": [
    {
      "Site": "وكالة أنباء سوريا",
      "Title": "تكريم الفريق السوري الفائز في أولمبياد العلوم النووية الدولي INSO 2026",
      "Paragraph": "…",
      "Body": "… full article text …",
      "Date": "2026-08-11T00:24:25+03:00",
      "Link": "https://…",
      "Image": "https://…"
    }
  ]
}
```
`ai_filter.before` = crawled count, `.after` = kept after the AI filter.

### Failed
```json
{ "mission_id": "…", "status": "failed", "error": "…traceback…" }
```

### `DELETE /api/missions/<id>/`
Deletes one mission and its results → `{ "deleted": "<id>", "keyword": "…" }`.

---

## 8. `GET /api/missions/` — list recent missions (auth)

```json
{ "missions": [
  { "mission_id": "…", "keyword": "…", "status": "completed",
    "total_results": 3, "created_at": "…", "completed_at": "…" }
] }
```
Returns the 50 most recent. `DELETE /api/missions/` wipes all missions.

## `GET /api/missions/download/<filename>/`
Streams the generated `.xlsx` (public link). Use the `excel_download` URL from the
mission response directly. 404 renders a styled HTML page (not JSON).

---

## 9. Managing category sites (admin UI)

Full CRUD on the crawl configuration (public endpoints — gate in the UI as needed).

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/category-sites/` | List sites (`?site_lists=a,b` to filter). Returns `{count, sites:[…]}`. |
| `POST` | `/api/category-sites/` | Create a site. |
| `GET` | `/api/category-sites/<id>/` | Retrieve one. |
| `PATCH`/`PUT` | `/api/category-sites/<id>/` | Update (partial/full). |
| `DELETE` | `/api/category-sites/<id>/` | Delete. |
| `GET` | `/api/category-site-lists/` | List site-list names with counts: `{site_lists:[{name, sites}]}`. |

### Site object shape
```json
{
  "id": "uuid", "name": "…", "base_url": "https://…",
  "site_lists": ["arabic_sites"],
  "categories": [ {"key": "general", "label": "عام", "url": "https://…"} ],
  "js": true, "page_mode": "query", "page_wait": "", "load_more": "",
  "selectors": { "item": "…", "link": "…", "title": "…", "date": "…" },
  "is_active": true, "created_at": "…", "updated_at": "…"
}
```
Google-only sources appear in the GET list with `"mode": "google_search"` and
`"categories": []`.

Create/update validation: `name` + `base_url` required; `categories` items need at
least `key` + `url`; `site_lists`/`categories`/`selectors` must be the right types.
Duplicate `name` → `409`.

---

## 10. Cost & performance (OpenAI)

The AI filter uses **gpt-4o**, batching **25 articles/request** (title + date only).
Cost scales with the number of **crawled** articles (every crawled title is sent to
the filter).

- **≈ $0.000347 per crawled article** → **every ~1,000 articles ≈ $0.35**.

Measured for `["all"]` on `arabic_sites`:
| Window | Articles crawled | gpt-4o batches | Cost |
|---|---|---|---|
| `max_days: 1` | 896 | 36 | ~$0.31 |
| `max_days: 3` | 2,095 | 84 | ~$0.73 |
| `max_days: 7` | 5,408 | 217 | ~$1.88 |

**To reduce cost:** pick specific category keys instead of `all`. E.g. a science
news needs only `["general","technology","culture"]` (~⅓ the crawl of `all`).
`titles_only`/`fetch_body` does **not** change OpenAI cost (bodies are scraped, not
sent to the model). `ai_filter: false` skips OpenAI entirely (zero cost, but no
relevance filtering).

---

## 11. Quick recipes

**Broad cross-topic search (widest net):**
```json
{ "keyword": "…", "categories": ["all"], "site_lists": ["arabic_sites"], "max_days": 7 }
```
**Focused & cheap:**
```json
{ "keyword": "…", "categories": ["general","technology","culture"], "site_lists": ["arabic_sites"], "max_days": 3 }
```
**Fast preview (no mission, no OpenAI):**
```json
{ "keyword": "…", "categories": ["general"], "titles_only": true, "ai_filter": false, "max_days": 1 }
```
