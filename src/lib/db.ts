import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { Session, Fabric, FabricKind, Generation, GarmentType, OutfitItem } from '@/types';

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), 'data');

const DB_PATH = path.join(DATA_DIR, 'provador.db');

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ateliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      city TEXT,
      neighborhood TEXT,
      tagline TEXT,
      bio TEXT,
      specialty TEXT,
      avatar_image TEXT,
      cover_image TEXT,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      client_name TEXT,
      notes TEXT,
      current_garment TEXT DEFAULT 'terno',
      current_fabric_id TEXT,
      current_photo TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fabrics (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      category TEXT,
      collection TEXT,
      texture_image TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      usage_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fabric_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS generations (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      fabric_id TEXT NOT NULL REFERENCES fabrics(id),
      garment_type TEXT NOT NULL,
      client_photo TEXT NOT NULL,
      result_image TEXT,
      status TEXT DEFAULT 'pending',
      error_message TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migração aditiva — provador acumulativo / multi-peça
  migrateGenerations(db);

  // Migração aditiva — marketplace multi-ateliê
  addColumnIfMissing(db, 'fabrics', 'atelier_id', 'TEXT');
  addColumnIfMissing(db, 'sessions', 'atelier_id', 'TEXT');

  // Migração aditiva — sapatos como peças únicas (produto) vs tecidos (textura)
  addColumnIfMissing(db, 'fabrics', 'kind', "TEXT DEFAULT 'fabric'");

  // Seed categorias padrão se tabela vazia
  const catCount = (db.prepare('SELECT COUNT(*) as n FROM fabric_categories').get() as { n: number }).n;
  if (catCount === 0) {
    const defaults = ['Lã fria', 'Lã quente', 'Linho', 'Algodão premium', 'Cashmere', 'Seda', 'Microfibra', 'Outro'];
    const ins = db.prepare('INSERT INTO fabric_categories (name, sort_order) VALUES (?, ?)');
    defaults.forEach((name, i) => ins.run(name, i));
  }
}

/** Adiciona colunas novas em `generations` sem quebrar dados existentes. */
function migrateGenerations(db: Database.Database) {
  const cols = (db.prepare(`PRAGMA table_info(generations)`).all() as { name: string }[]).map((c) => c.name);
  const additions: Record<string, string> = {
    items_json: 'TEXT',
    base_image: 'TEXT',
    base_generation_id: 'TEXT',
  };
  for (const [name, type] of Object.entries(additions)) {
    if (!cols.includes(name)) {
      db.exec(`ALTER TABLE generations ADD COLUMN ${name} ${type}`);
    }
  }
}

/** Adiciona uma coluna a uma tabela se ela ainda não existir. */
function addColumnIfMissing(db: Database.Database, table: string, column: string, type: string) {
  const cols = (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}

// ── Ateliers (marketplace) ─────────────────────────────────────────────────────

export interface Atelier {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  neighborhood: string | null;
  tagline: string | null;
  bio: string | null;
  specialty: string | null;
  avatar_image: string | null;
  cover_image: string | null;
  is_active: number;
  sort_order: number;
  created_at: string;
}

export interface AtelierWithStats extends Atelier {
  fabric_count: number;
}

export function createAtelier(data: {
  id: string;
  name: string;
  slug: string;
  city?: string;
  neighborhood?: string;
  tagline?: string;
  bio?: string;
  specialty?: string;
  avatar_image?: string;
  cover_image?: string;
  sort_order?: number;
}): Atelier {
  const db = getDb();
  db.prepare(`
    INSERT INTO ateliers (id, name, slug, city, neighborhood, tagline, bio, specialty, avatar_image, cover_image, sort_order)
    VALUES (@id, @name, @slug, @city, @neighborhood, @tagline, @bio, @specialty, @avatar_image, @cover_image, @sort_order)
  `).run({
    id: data.id,
    name: data.name,
    slug: data.slug,
    city: data.city ?? null,
    neighborhood: data.neighborhood ?? null,
    tagline: data.tagline ?? null,
    bio: data.bio ?? null,
    specialty: data.specialty ?? null,
    avatar_image: data.avatar_image ?? null,
    cover_image: data.cover_image ?? null,
    sort_order: data.sort_order ?? 0,
  });
  return getAtelier(data.id)!;
}

export function getAtelier(id: string): Atelier | null {
  const db = getDb();
  return db.prepare('SELECT * FROM ateliers WHERE id = ?').get(id) as Atelier | null;
}

export function getAtelierBySlug(slug: string): Atelier | null {
  const db = getDb();
  return db.prepare('SELECT * FROM ateliers WHERE slug = ?').get(slug) as Atelier | null;
}

export function listAteliers(): AtelierWithStats[] {
  const db = getDb();
  return db.prepare(`
    SELECT a.*, COUNT(f.id) AS fabric_count
    FROM ateliers a
    LEFT JOIN fabrics f ON f.atelier_id = a.id AND f.is_active = 1 AND (f.kind = 'fabric' OR f.kind IS NULL)
    WHERE a.is_active = 1
    GROUP BY a.id
    ORDER BY a.sort_order, a.name
  `).all() as AtelierWithStats[];
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export function createSession(data: {
  id: string;
  client_name?: string;
  notes?: string;
  atelier_id?: string;
}): Session {
  const db = getDb();
  db.prepare(`
    INSERT INTO sessions (id, client_name, notes, atelier_id)
    VALUES (@id, @client_name, @notes, @atelier_id)
  `).run({
    id: data.id,
    client_name: data.client_name ?? null,
    notes: data.notes ?? null,
    atelier_id: data.atelier_id ?? null,
  });
  return getSession(data.id)!;
}

export function getSession(id: string): Session | null {
  const db = getDb();
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Session | null;
}

export function listSessions(limit = 20): Session[] {
  const db = getDb();
  return db.prepare('SELECT * FROM sessions ORDER BY created_at DESC LIMIT ?').all(limit) as Session[];
}

export interface SessionWithStats extends Session {
  generation_count: number;
  last_activity: string | null;
}

export function listSessionsWithStats(opts: {
  search?: string;
  limit?: number;
  offset?: number;
} = {}): { sessions: SessionWithStats[]; total: number } {
  const db = getDb();
  const { search, limit = 40, offset = 0 } = opts;

  const searchClause = search
    ? `WHERE s.client_name LIKE '%' || @search || '%'`
    : '';
  const params: Record<string, unknown> = { limit, offset };
  if (search) params.search = search;

  const sessions = db.prepare(`
    SELECT
      s.*,
      COUNT(g.id) AS generation_count,
      MAX(g.created_at) AS last_activity
    FROM sessions s
    LEFT JOIN generations g ON g.session_id = s.id
    ${searchClause}
    GROUP BY s.id
    ORDER BY s.created_at DESC
    LIMIT @limit OFFSET @offset
  `).all(params) as SessionWithStats[];

  const { total } = db.prepare(`
    SELECT COUNT(*) as total FROM sessions s ${searchClause}
  `).get(params) as { total: number };

  return { sessions, total };
}

export function deleteSession(id: string) {
  const db = getDb();
  // Delete child generations first (FK constraint)
  db.prepare('DELETE FROM generations WHERE session_id = ?').run(id);
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
}

export function updateSession(id: string, data: Partial<Pick<Session, 'client_name' | 'notes' | 'current_garment' | 'current_fabric_id' | 'current_photo'>>): Session | null {
  const db = getDb();
  const fields = Object.keys(data)
    .map((k) => `${k} = @${k}`)
    .join(', ');
  if (!fields) return getSession(id);
  db.prepare(`UPDATE sessions SET ${fields} WHERE id = @id`).run({ ...data, id });
  return getSession(id);
}

// ── Fabrics ───────────────────────────────────────────────────────────────────

export function createFabric(data: {
  id: string;
  name: string;
  code: string;
  category?: string;
  collection?: string;
  texture_image: string;
  atelier_id?: string;
  kind?: FabricKind;
}): Fabric {
  const db = getDb();
  db.prepare(`
    INSERT INTO fabrics (id, name, code, category, collection, texture_image, atelier_id, kind)
    VALUES (@id, @name, @code, @category, @collection, @texture_image, @atelier_id, @kind)
  `).run({
    id: data.id,
    name: data.name,
    code: data.code,
    category: data.category ?? null,
    collection: data.collection ?? null,
    texture_image: data.texture_image,
    atelier_id: data.atelier_id ?? null,
    kind: data.kind ?? 'fabric',
  });
  return getFabric(data.id)!;
}

export function getFabric(id: string): Fabric | null {
  const db = getDb();
  return db.prepare('SELECT * FROM fabrics WHERE id = ?').get(id) as Fabric | null;
}

export function listFabrics(opts: {
  search?: string;
  category?: string;
  collection?: string;
  activeOnly?: boolean;
  atelierId?: string;
  kind?: FabricKind;
} = {}): Fabric[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (opts.activeOnly !== false) {
    conditions.push('is_active = 1');
  }
  if (opts.kind) {
    // Linhas antigas têm kind NULL — tratadas como 'fabric' (tecido).
    if (opts.kind === 'fabric') {
      conditions.push("(kind = 'fabric' OR kind IS NULL)");
    } else {
      conditions.push('kind = @kind');
      params.kind = opts.kind;
    }
  }
  if (opts.atelierId) {
    conditions.push('atelier_id = @atelierId');
    params.atelierId = opts.atelierId;
  }
  if (opts.search) {
    conditions.push('(name LIKE @search OR code LIKE @search)');
    params.search = `%${opts.search}%`;
  }
  if (opts.category) {
    conditions.push('category = @category');
    params.category = opts.category;
  }
  if (opts.collection) {
    conditions.push('collection = @collection');
    params.collection = opts.collection;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return db.prepare(`SELECT * FROM fabrics ${where} ORDER BY usage_count DESC, name ASC`).all(params) as Fabric[];
}

export function updateFabric(id: string, data: Partial<Pick<Fabric, 'name' | 'code' | 'category' | 'collection' | 'texture_image' | 'is_active'>>): Fabric | null {
  const db = getDb();
  const fields = Object.keys(data).map((k) => `${k} = @${k}`).join(', ');
  if (!fields) return getFabric(id);
  db.prepare(`UPDATE fabrics SET ${fields} WHERE id = @id`).run({ ...data, id });
  return getFabric(id);
}

export function incrementFabricUsage(id: string) {
  const db = getDb();
  db.prepare('UPDATE fabrics SET usage_count = usage_count + 1 WHERE id = ?').run(id);
}

export function deleteFabric(id: string) {
  const db = getDb();
  db.prepare('DELETE FROM fabrics WHERE id = ?').run(id);
}

export function getFabricCollections(): string[] {
  const db = getDb();
  const rows = db.prepare("SELECT DISTINCT collection FROM fabrics WHERE collection IS NOT NULL AND is_active = 1 ORDER BY collection").all() as { collection: string }[];
  return rows.map((r) => r.collection);
}

// ── Fabric Categories ────────────────────────────────────────────────────────

export interface FabricCategory {
  id: number;
  name: string;
  sort_order: number;
  created_at: string;
}

export function listFabricCategories(): FabricCategory[] {
  const db = getDb();
  return db.prepare('SELECT * FROM fabric_categories ORDER BY sort_order, name').all() as FabricCategory[];
}

export function createFabricCategory(name: string): FabricCategory {
  const db = getDb();
  const maxOrder = (db.prepare('SELECT MAX(sort_order) as m FROM fabric_categories').get() as { m: number | null }).m ?? 0;
  db.prepare('INSERT INTO fabric_categories (name, sort_order) VALUES (?, ?)').run(name.trim(), maxOrder + 1);
  return db.prepare('SELECT * FROM fabric_categories WHERE name = ?').get(name.trim()) as FabricCategory;
}

export function updateFabricCategory(id: number, name: string): FabricCategory | null {
  const db = getDb();
  db.prepare('UPDATE fabric_categories SET name = ? WHERE id = ?').run(name.trim(), id);
  return db.prepare('SELECT * FROM fabric_categories WHERE id = ?').get(id) as FabricCategory | null;
}

export function deleteFabricCategory(id: number) {
  const db = getDb();
  // Limpa a categoria dos tecidos que a usavam
  const cat = db.prepare('SELECT name FROM fabric_categories WHERE id = ?').get(id) as { name: string } | null;
  if (cat) {
    db.prepare('UPDATE fabrics SET category = NULL WHERE category = ?').run(cat.name);
  }
  db.prepare('DELETE FROM fabric_categories WHERE id = ?').run(id);
}

// ── Generations ───────────────────────────────────────────────────────────────

export function createGeneration(data: {
  id: string;
  session_id: string;
  base_image: string;                 // foto original OU prévia anterior
  items: { garment_type: GarmentType; fabric_id: string }[];
  base_generation_id?: string | null;
}): Generation {
  const db = getDb();

  // Denormaliza cada item com o snapshot do tecido (nome/código/textura)
  const items: OutfitItem[] = data.items.map((it) => {
    const f = getFabric(it.fabric_id);
    return {
      garment_type: it.garment_type,
      fabric_id: it.fabric_id,
      fabric_name: f?.name,
      fabric_code: f?.code,
      fabric_texture: f?.texture_image,
    };
  });
  const first = items[0];

  db.prepare(`
    INSERT INTO generations
      (id, session_id, fabric_id, garment_type, client_photo, base_image, base_generation_id, items_json)
    VALUES
      (@id, @session_id, @fabric_id, @garment_type, @client_photo, @base_image, @base_generation_id, @items_json)
  `).run({
    id: data.id,
    session_id: data.session_id,
    fabric_id: first.fabric_id,
    garment_type: first.garment_type,
    client_photo: data.base_image,
    base_image: data.base_image,
    base_generation_id: data.base_generation_id ?? null,
    items_json: JSON.stringify(items),
  });
  return getGeneration(data.id)!;
}

/** Reconstrói `items` a partir de items_json (ou do par fabric/garment legado). */
function hydrateGeneration(row: (Generation & { items_json?: string | null }) | undefined): Generation | null {
  if (!row) return null;
  let items: OutfitItem[] = [];
  if (row.items_json) {
    try { items = JSON.parse(row.items_json) as OutfitItem[]; } catch { items = []; }
  }
  if (items.length === 0) {
    // Linha legada — deriva um único item das colunas existentes
    items = [{
      garment_type: row.garment_type,
      fabric_id: row.fabric_id,
      fabric_name: row.fabric_name,
      fabric_code: row.fabric_code,
      fabric_texture: row.fabric_texture,
    }];
  }
  delete row.items_json;
  return { ...row, base_image: row.base_image ?? row.client_photo, items };
}

export function getGeneration(id: string): Generation | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT g.*, f.name as fabric_name, f.code as fabric_code, f.texture_image as fabric_texture
    FROM generations g
    LEFT JOIN fabrics f ON f.id = g.fabric_id
    WHERE g.id = ?
  `).get(id) as (Generation & { items_json?: string | null }) | undefined;
  return hydrateGeneration(row);
}

export function updateGeneration(id: string, data: {
  status?: string;
  result_image?: string;
  error_message?: string;
}) {
  const db = getDb();
  const fields = Object.keys(data).map((k) => `${k} = @${k}`).join(', ');
  if (!fields) return;
  db.prepare(`UPDATE generations SET ${fields} WHERE id = @id`).run({ ...data, id });
}

export function listSessionGenerations(sessionId: string): Generation[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT g.*, f.name as fabric_name, f.code as fabric_code, f.texture_image as fabric_texture
    FROM generations g
    LEFT JOIN fabrics f ON f.id = g.fabric_id
    WHERE g.session_id = ?
    ORDER BY g.created_at DESC
  `).all(sessionId) as (Generation & { items_json?: string | null })[];
  return rows.map((r) => hydrateGeneration(r)!);
}

export function deleteGeneration(id: string) {
  const db = getDb();
  db.prepare('DELETE FROM generations WHERE id = ?').run(id);
}

// ── Stats / Dashboard ─────────────────────────────────────────────────────────

export interface DashboardStats {
  total_sessions: number;
  sessions_this_month: number;
  sessions_this_week: number;
  total_generations: number;
  success_generations: number;
  failed_generations: number;
  avg_per_session: number;
  success_rate: number;
  garment_breakdown: { garment_type: string; count: number }[];
  top_fabrics: { fabric_name: string; fabric_code: string; count: number }[];
  daily_activity: { day: string; count: number }[];  // últimos 30 dias
  monthly_activity: { month: string; count: number }[]; // últimos 6 meses
  recent_previews: { id: string; session_id: string; result_image: string; garment_type: string; fabric_name: string; fabric_code: string; created_at: string }[];
  hourly_heatmap: { day_of_week: number; hour: number; count: number }[];
  top_combos: { garment_type: string; fabric_name: string; fabric_code: string; count: number }[];
}

export function getStats(): DashboardStats {
  const db = getDb();

  const total_sessions = (db.prepare(
    'SELECT COUNT(*) as n FROM sessions'
  ).get() as { n: number }).n;

  const sessions_this_month = (db.prepare(`
    SELECT COUNT(*) as n FROM sessions
    WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
  `).get() as { n: number }).n;

  const sessions_this_week = (db.prepare(`
    SELECT COUNT(*) as n FROM sessions
    WHERE date(created_at) >= date('now', '-6 days')
  `).get() as { n: number }).n;

  const genRow = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN status='failed'  THEN 1 ELSE 0 END) as failed
    FROM generations
  `).get() as { total: number; success: number; failed: number };

  const success_generations = genRow.success ?? 0;
  const failed_generations  = genRow.failed  ?? 0;
  const total_generations   = genRow.total   ?? 0;

  const avg_per_session = total_sessions > 0
    ? Math.round((success_generations / total_sessions) * 10) / 10
    : 0;

  const success_rate = total_generations > 0
    ? Math.round((success_generations / total_generations) * 100)
    : 0;

  const garment_breakdown = db.prepare(`
    SELECT garment_type, COUNT(*) as count
    FROM generations WHERE status = 'success'
    GROUP BY garment_type ORDER BY count DESC
  `).all() as { garment_type: string; count: number }[];

  const top_fabrics = db.prepare(`
    SELECT f.name as fabric_name, f.code as fabric_code, COUNT(*) as count
    FROM generations g
    JOIN fabrics f ON f.id = g.fabric_id
    WHERE g.status = 'success'
    GROUP BY g.fabric_id ORDER BY count DESC LIMIT 8
  `).all() as { fabric_name: string; fabric_code: string; count: number }[];

  // Preenche os 30 dias mesmo sem dados
  const rawDaily = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as count
    FROM generations
    WHERE date(created_at) >= date('now', '-29 days')
    GROUP BY day ORDER BY day
  `).all() as { day: string; count: number }[];

  const dailyMap = new Map(rawDaily.map((r) => [r.day, r.count]));
  const daily_activity: { day: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    daily_activity.push({ day: key, count: dailyMap.get(key) ?? 0 });
  }

  const monthly_activity = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
    FROM generations
    WHERE date(created_at) >= date('now', '-180 days')
    GROUP BY month ORDER BY month
  `).all() as { month: string; count: number }[];

  // Últimas 12 prévias com sucesso (galeria)
  const recent_previews = db.prepare(`
    SELECT g.id, g.session_id, g.result_image, g.garment_type, g.created_at,
           f.name as fabric_name, f.code as fabric_code
    FROM generations g
    LEFT JOIN fabrics f ON f.id = g.fabric_id
    WHERE g.status = 'success' AND g.result_image IS NOT NULL
    ORDER BY g.created_at DESC
    LIMIT 12
  `).all() as { id: string; session_id: string; result_image: string; garment_type: string; fabric_name: string; fabric_code: string; created_at: string }[];

  // Heatmap: dia da semana (0=Dom…6=Sáb) × hora
  const hourly_heatmap = db.prepare(`
    SELECT
      CAST(strftime('%w', created_at) AS INTEGER) as day_of_week,
      CAST(strftime('%H', created_at) AS INTEGER) as hour,
      COUNT(*) as count
    FROM generations
    WHERE status = 'success'
    GROUP BY day_of_week, hour
  `).all() as { day_of_week: number; hour: number; count: number }[];

  // Top 8 combinações peça + tecido
  const top_combos = db.prepare(`
    SELECT g.garment_type, f.name as fabric_name, f.code as fabric_code, COUNT(*) as count
    FROM generations g
    JOIN fabrics f ON f.id = g.fabric_id
    WHERE g.status = 'success'
    GROUP BY g.garment_type, g.fabric_id
    ORDER BY count DESC
    LIMIT 8
  `).all() as { garment_type: string; fabric_name: string; fabric_code: string; count: number }[];

  return {
    total_sessions,
    sessions_this_month,
    sessions_this_week,
    total_generations,
    success_generations,
    failed_generations,
    avg_per_session,
    success_rate,
    garment_breakdown,
    top_fabrics,
    daily_activity,
    monthly_activity,
    recent_previews,
    hourly_heatmap,
    top_combos,
  };
}
