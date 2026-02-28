function nowTs() {
  return Date.now();
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
  };
}

export async function ensureSchema(env) {
  if (!env.DB) return;
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      r2_key TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'r2',
      content_type TEXT,
      size INTEGER,
      ext TEXT,
      list_type TEXT NOT NULL DEFAULT 'None',
      label TEXT NOT NULL DEFAULT 'None',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at DESC);
  `);
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
        ext: "",
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
      INSERT INTO files (id, r2_key, source, content_type, size, ext, list_type, label, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
      ON CONFLICT(id) DO UPDATE SET
        r2_key = excluded.r2_key,
        source = excluded.source,
        content_type = excluded.content_type,
        size = excluded.size,
        ext = excluded.ext,
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
      "SELECT id, list_type, label, created_at FROM files ORDER BY created_at DESC"
    ).all();
    return (results || []).map((row) => ({
      name: row.id,
      metadata: {
        TimeStamp: row.created_at || 0,
        ListType: row.list_type || "None",
        Label: row.label || "None",
      },
    }));
  }

  if (env.img_url) {
    const value = await env.img_url.list();
    return (value.keys || []).map((item) => ({
      name: item.name,
      metadata: item.metadata || {},
    }));
  }

  return [];
}

export function getFileExtension(name = "") {
  const i = name.lastIndexOf(".");
  if (i <= 0 || i === name.length - 1) return "";
  const raw = name.slice(i + 1).toLowerCase();
  const ext = raw.replace(/[^a-z0-9_-]/g, "");
  return ext ? `.${ext}` : "";
}

export function createFileId(originalName = "") {
  const ext = getFileExtension(originalName);
  return `${crypto.randomUUID()}${ext}`;
}
