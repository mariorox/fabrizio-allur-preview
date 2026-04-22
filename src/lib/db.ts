import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { Session, Fabric, Generation, GarmentType } from '@/types';

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), 'data');

const DB_PATH = path.join(DATA_DIR, 'fabrizio.db');

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

  // Seed categorias padrão se tabela vazia
  const catCount = (db.prepare('SELECT COUNT(*) as n FROM fabric_categories').get() as { n: number }).n;
  if (catCount === 0) {
    const defaults = ['Lã fria', 'Lã quente', 'Linho', 'Algodão premium', 'Cashmere', 'Seda', 'Microfibra', 'Outro'];
    const ins = db.prepare('INSERT INTO fabric_categories (name, sort_order) VALUES (?, ?)');
    defaults.forEach((name, i) => ins.run(name, i));
  }
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export function createSession(data: {
  id: string;
  client_name?: string;
  notes?: string;
}): Session {
  const db = getDb();
  db.prepare(`
    INSERT INTO sessions (id, client_name, notes)
    VALUES (@id, @client_name, @notes)
  `).run({ id: data.id, client_name: data.client_name ?? null, notes: data.notes ?? null });
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
}): Fabric {
  const db = getDb();
  db.prepare(`
    INSERT INTO fabrics (id, name, code, category, collection, texture_image)
    VALUES (@id, @name, @code, @category, @collection, @texture_image)
  `).run({
    id: data.id,
    name: data.name,
    code: data.code,
    category: data.category ?? null,
    collection: data.collection ?? null,
    texture_image: data.texture_image,
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
} = {}): Fabric[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (opts.activeOnly !== false) {
    conditions.push('is_active = 1');
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
  fabric_id: string;
  garment_type: GarmentType;
  client_photo: string;
}): Generation {
  const db = getDb();
  db.prepare(`
    INSERT INTO generations (id, session_id, fabric_id, garment_type, client_photo)
    VALUES (@id, @session_id, @fabric_id, @garment_type, @client_photo)
  `).run(data);
  return getGeneration(data.id)!;
}

export function getGeneration(id: string): Generation | null {
  const db = getDb();
  return db.prepare(`
    SELECT g.*, f.name as fabric_name, f.code as fabric_code, f.texture_image as fabric_texture
    FROM generations g
    LEFT JOIN fabrics f ON f.id = g.fabric_id
    WHERE g.id = ?
  `).get(id) as Generation | null;
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
  return db.prepare(`
    SELECT g.*, f.name as fabric_name, f.code as fabric_code, f.texture_image as fabric_texture
    FROM generations g
    LEFT JOIN fabrics f ON f.id = g.fabric_id
    WHERE g.session_id = ?
    ORDER BY g.created_at DESC
  `).all(sessionId) as Generation[];
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
