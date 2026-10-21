// Roda antes do `next start` no servidor: se o DATA_DIR ainda não tem banco
// (disco efêmero do Render grátis), copia o catálogo inicial de seed/.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(root, 'data');
const seedDir = path.join(root, 'seed');

if (fs.existsSync(path.join(dataDir, 'provador.db'))) {
  console.log(`[prepare-data] banco já existe em ${dataDir}`);
} else if (fs.existsSync(seedDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.cpSync(seedDir, dataDir, { recursive: true });
  console.log(`[prepare-data] catálogo inicial copiado para ${dataDir}`);
} else {
  console.log('[prepare-data] sem seed/, o app começa com banco vazio');
}
