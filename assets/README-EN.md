# Telegraph-Image

<p align="center">
  <img src="./assets/readme-banner.svg" alt="Telegraph-Image Banner" width="100%"/>
</p>

<p align="center">
  <img alt="Cloudflare" src="https://img.shields.io/badge/Cloudflare-Pages%20%2B%20Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" />
  <img alt="R2" src="https://img.shields.io/badge/Storage-R2-ff9f1a?style=for-the-badge" />
  <img alt="D1" src="https://img.shields.io/badge/Database-D1-0ea5e9?style=for-the-badge" />
  <img alt="KV" src="https://img.shields.io/badge/Cache-KV-7c3aed?style=for-the-badge" />
</p>

<p align="center">
  A Cloudflare-native file hosting project.<br/>
  Supports <b>any file format upload</b>, admin management, block/whitelist policies, and legacy Telegraph fallback.
</p>

<p align="center">
  <a href="https://dash.cloudflare.com/?to=/:account/pages/new">
    <img alt="Deploy to Cloudflare" src="https://img.shields.io/badge/Deploy%20to-Cloudflare-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" />
  </a>
</p>

---

## Contents

1. [Highlights](#highlights)
2. [Architecture](#architecture)
3. [Quick Deploy](#quick-deploy)
4. [Bindings and Env](#bindings-and-env)
5. [API](#api)

---

## Highlights

- Upload any file type
- R2 for file body storage
- D1 for metadata/index/moderation states
- Optional KV for compatibility/cache
- Admin dashboard with list/block/whitelist/delete
- Telegraph fallback for legacy `/file/*` links

---

## Architecture

```mermaid
flowchart LR
  U[User / Browser] --> P[Cloudflare Pages]
  P --> F[Pages Functions]
  F --> R2[(R2 Bucket)]
  F --> D1[(D1 SQL)]
  F --> KV[(Workers KV optional)]
  F --> T[Telegraph Fallback]
```

Recommended storage split:

- File objects: `R2`
- Structured metadata: `D1`
- Lightweight cache/compatibility: `KV`

---

## Quick Deploy

1. Create a Cloudflare Pages project and connect this repo.
2. Create an R2 bucket, for example `telegraph-image-files`.
3. Create a D1 database, for example `telegraph_image`.
4. Optionally create a KV namespace and bind it as `img_url`.
5. Fill your real IDs in `wrangler.toml`.
6. Apply D1 migration:

```bash
wrangler d1 migrations apply telegraph_image
```

---

## Bindings and Env

### Required Bindings

- `FILE_BUCKET` => R2 bucket
- `DB` => D1 database

### Optional Binding

- `img_url` => KV namespace

### Optional Environment Variables

- `BASIC_USER` / `BASIC_PASS`
- `WhiteList_Mode=true`
- `ModerateContentApiKey`

---

## API

- `POST /upload`
  - Input: `multipart/form-data`, field `file` (also supports `Files`)
  - Output: `[{ "src": "/file/<id>" }]` (frontend-compatible)
- `GET /file/:id`
- `GET /api/manage/list`
- `GET /api/manage/block/:id`
- `GET /api/manage/white/:id`
- `GET /api/manage/delete/:id`

---

Chinese + embedded English: see [README.md](./README.md)
