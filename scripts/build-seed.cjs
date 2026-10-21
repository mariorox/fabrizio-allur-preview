// Gera a pasta seed/ (catálogo inicial para o deploy) a partir de data/.
// Leva só tecidos, categorias e ateliês — sessões, gerações e fotos de
// clientes ficam de fora (o repositório é público).
// Uso: node scripts/build-seed.cjs   (com o Node 22, por causa do better-sqlite3)
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'data');
const seedDir = path.join(root, 'seed');
const seedDb = path.join(seedDir, 'provador.db');

fs.mkdirSync(seedDir, { recursive: true });
if (fs.existsSync(seedDb)) fs.unlinkSync(seedDb);

const src = new Database(path.join(dataDir, 'provador.db'), { readonly: true });
src.exec(`VACUUM INTO '${seedDb.replace(/\\/g, '/')}'`);
src.close();

const db = new Database(seedDb);
db.pragma('foreign_keys = OFF');
db.exec('DELETE FROM generations; DELETE FROM sessions; UPDATE fabrics SET usage_count = 0;');
db.pragma('journal_mode = DELETE');
db.exec('VACUUM');
const images = db.prepare('SELECT texture_image FROM fabrics').all()
  .map((r) => r.texture_image)
  .filter(Boolean);
db.close();

let copied = 0;
let missing = 0;
for (const rel of images) {
  const from = path.join(dataDir, 'uploads', rel);
  const to = path.join(seedDir, 'uploads', rel);
  if (!fs.existsSync(from)) { missing++; continue; }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  copied++;
}
console.log(`seed pronto: ${copied} imagens copiadas, ${missing} faltando`);
