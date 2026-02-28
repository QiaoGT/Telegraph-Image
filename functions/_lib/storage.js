function nowTs() {
  return Date.now();
}

function pad2(n) {
  return n < 10 ? `0${n}` : String(n);
}

function formatDateTime(ts) {
  const d = new Date(Number(ts || 0));
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function getExtFromName(name = "") {
  const i = name.lastIndexOf(".");
  if (i <= 0 || i === name.length - 1) return "";
  return name.slice(i + 1).toLowerCase();
}

function normalizeRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    key: row.r2_key || row.id,
    source: row.source || "r2",
    listType: row.list_type || "None",
    label: row.label || "None",
    timeStamp: row.created_at || nowTs(),
    contentType: row.content_type || "application/octet-stream",
    size: typeof row.size === "number" ? row.size : 0,
    ext: row.ext || "",
    originalName: row.original_name || row.id,
    fileType: row.file_type || getExtFromName(row.original_name || row.id),
  };
}

async function hasColumn(env, table, column) {
  const { results } = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
  return (results || []).some((r) => r.name === column);
}

async function ensureColumn(env, table, column, ddl) {
  if (await hasColumn(env, table, column)) return;
  await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${ddl}`).run();
}

export async function ensureSchema(env) {
  if (!env.DB) return;
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      r2_key TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'r2',
      content_type TEXT,
      size INTEGER,
      ext TEXT,
      original_name TEXT,
      file_type TEXT,
      list_type TEXT NOT NULL DEFAULT 'None',
      label TEXT NOT NULL DEFAULT 'None',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`
  ).run();
  await ensureColumn(env, "files", "original_name", "original_name TEXT");
  await ensureColumn(env, "files", "file_type", "file_type TEXT");
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at DESC)"
  ).run();
}

export function sanitizeFilename(input = "") {
  const name = String(input || "").trim();
  if (!name) return "";
  // Keep original Unicode characters as much as possible.
  // Only replace characters that break URL path / object key semantics.
  return name
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F]/g, "_")
    .replace(/[\/\\?#%*:|"<>]/g, "_")
    .replace(/\s+$/g, "")
    .slice(0, 180);
}

export function guessMimeTypeFromName(name = "") {
  const ext = getExtFromName(name);
  const map = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    ogg: "audio/ogg",
    aac: "audio/aac",
    flac: "audio/flac",
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    mkv: "video/x-matroska",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    txt: "text/plain; charset=utf-8",
    json: "application/json; charset=utf-8",
    pdf: "application/pdf",
  };
  return map[ext] || "";
}

export async function createObjectKey(env, originalName = "") {
  const safe = sanitizeFilename(originalName);
  const fallback = `${crypto.randomUUID()}.bin`;
  let base = safe || fallback;
  if (!env.FILE_BUCKET || typeof env.FILE_BUCKET.head !== "function") return base;
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : "";
  let key = base;
  let n = 1;
  while (await env.FILE_BUCKET.head(key)) {
    n += 1;
    key = `${stem}-${n}${ext}`;
    if (n > 1000) {
      key = `${stem}-${crypto.randomUUID()}${ext}`;
      break;
    }
  }
  return key;
}

export async function getRecord(env, id) {
  if (!id) return null;
  if (env.DB) {
    const dbRow = await env.DB.prepare(
      "SELECT * FROM files WHERE id = ?1 LIMIT 1"
    )
      .bind(id)
      .first();
    if (dbRow) return normalizeRecord(dbRow);
  }

  if (env.img_url) {
    const kv = await env.img_url.getWithMetadata(id);
    if (kv && kv.metadata) {
      return {
        id,
        key: id,
        source: "telegraph",
        listType: kv.metadata.ListType || "None",
        label: kv.metadata.Label || kv.metadata.rating_label || "None",
        timeStamp: kv.metadata.TimeStamp || nowTs(),
        contentType: "",
        size: 0,
        ext: getExtFromName(id),
        originalName: id,
        fileType: getExtFromName(id),
      };
    }
  }
  return null;
}

export async function upsertRecord(env, record) {
  const ts = nowTs();
  if (env.DB) {
    await ensureSchema(env);
    await env.DB.prepare(
      `
      INSERT INTO files (
        id, r2_key, source, content_type, size, ext, original_name, file_type,
        list_type, label, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
      ON CONFLICT(id) DO UPDATE SET
        r2_key = excluded.r2_key,
        source = excluded.source,
        content_type = excluded.content_type,
        size = excluded.size,
        ext = excluded.ext,
        original_name = excluded.original_name,
        file_type = excluded.file_type,
        list_type = excluded.list_type,
        label = excluded.label,
        updated_at = excluded.updated_at
      `
    )
      .bind(
        record.id,
        record.key || record.id,
        record.source || "r2",
        record.contentType || "application/octet-stream",
        Number.isFinite(record.size) ? record.size : 0,
        record.ext || "",
        record.originalName || record.id,
        record.fileType || getExtFromName(record.originalName || record.id),
        record.listType || "None",
        record.label || "None",
        record.timeStamp || ts,
        ts
      )
      .run();
  }

  if (env.img_url) {
    await env.img_url.put(record.id, "", {
      metadata: {
        ListType: record.listType || "None",
        Label: record.label || "None",
        TimeStamp: record.timeStamp || ts,
      },
    });
  }
}

export async function setListType(env, id, listType) {
  const rec = (await getRecord(env, id)) || {
    id,
    key: id,
    source: "telegraph",
    listType: "None",
    label: "None",
    timeStamp: nowTs(),
    originalName: id,
    fileType: getExtFromName(id),
  };
  rec.listType = listType;
  await upsertRecord(env, rec);
  return rec;
}

export async function deleteRecord(env, id) {
  let keyToDelete = id;
  if (env.DB) {
    const row = await env.DB.prepare(
      "SELECT r2_key FROM files WHERE id = ?1 LIMIT 1"
    )
      .bind(id)
      .first();
    if (row?.r2_key) keyToDelete = row.r2_key;
    await env.DB.prepare("DELETE FROM files WHERE id = ?1").bind(id).run();
  }
  if (env.img_url) {
    await env.img_url.delete(id);
  }
  return keyToDelete;
}

export async function listRecords(env) {
  if (env.DB) {
    await ensureSchema(env);
    const { results } = await env.DB.prepare(
      `SELECT id, original_name, file_type, content_type, size, list_type, label, created_at
       FROM files ORDER BY created_at DESC`
    ).all();
    return (results || []).map((row) => {
      const size = Number(row.size || 0);
      const fileType =
        row.file_type || getExtFromName(row.original_name || row.id) || "unknown";
      return {
        name: row.id,
        originalName: row.original_name || row.id,
        uploadTime: formatDateTime(row.created_at || 0),
        sizeKB: (size / 1024).toFixed(2),
        fileType,
        contentType: row.content_type || "",
        metadata: {
          TimeStamp: row.created_at || 0,
          UploadTime: formatDateTime(row.created_at || 0),
          ListType: row.list_type || "None",
          Label: row.label || "None",
          FileName: row.original_name || row.id,
          FileSizeKB: (size / 1024).toFixed(2),
          FileType: fileType,
          ContentType: row.content_type || "",
        },
      };
    });
  }

  if (env.img_url) {
    const value = await env.img_url.list();
    return (value.keys || []).map((item) => ({
      name: item.name,
      originalName: item.name,
      uploadTime: formatDateTime(item.metadata?.TimeStamp || 0),
      sizeKB: "0.00",
      fileType: getExtFromName(item.name) || "unknown",
      metadata: item.metadata || {},
    }));
  }
  return [];
}
