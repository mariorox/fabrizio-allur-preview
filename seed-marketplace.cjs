/* Semeia o marketplace: 8 ateliês reais de SP + tecidos genéricos.
   Idempotente — reexecutar limpa e recria os ateliês semeados. */
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, 'data', 'provador.db'));
db.pragma('foreign_keys = ON');

const uid = () => crypto.randomUUID();

const ateliers = [
  {
    name: 'Pedro Corulla', slug: 'pedro-corulla', prefix: 'PC',
    city: 'São Paulo', neighborhood: 'Vila Nova Conceição',
    tagline: 'Alfaiataria contemporânea sob medida',
    specialty: 'Ternos e costumes sob medida',
    bio: 'Ateliê de 400m² dedicado à alfaiataria contemporânea, com atendimento individual e caimento desenhado para cada cliente.',
    cover: 1, avatar: 1,
  },
  {
    name: 'Vasco Vasconcellos', slug: 'vasco-vasconcellos', prefix: 'VV',
    city: 'São Paulo', neighborhood: 'Jardins',
    tagline: 'Sob medida artesanal, costura à mão',
    specialty: 'Costura à mão e canvas flutuante',
    bio: 'Alfaiataria artesanal com peças construídas à mão, do molde ao acabamento. Tradição sartorial em São Paulo e Brasília.',
    cover: 2, avatar: 2,
  },
  {
    name: 'Milton Silva Per Uomo', slug: 'milton-silva-per-uomo', prefix: 'MS',
    city: 'São Paulo', neighborhood: 'Higienópolis',
    tagline: 'Corte italiano, 50 anos de ofício',
    specialty: 'Smokings e ternos de cerimônia',
    bio: 'Meio século de ofício no corte italiano. Acabamento impecável para ternos, smokings e trajes de cerimônia.',
    cover: 3, avatar: 3,
  },
  {
    name: 'Merino Alfaiataria', slug: 'merino-alfaiataria', prefix: 'ME',
    city: 'São Paulo', neighborhood: 'Itaim Bibi',
    tagline: 'Tecidos nobres e acabamento de alto padrão',
    specialty: 'Costumes, ternos e smokings',
    bio: 'Peças produzidas sob rigoroso controle de qualidade, com os melhores tecidos e versões contemporâneas do clássico.',
    cover: 4, avatar: 4,
  },
  {
    name: 'Ricardo Almeida', slug: 'ricardo-almeida', prefix: 'RA',
    city: 'São Paulo', neighborhood: 'Cidade Jardim',
    tagline: 'Moda masculina premium',
    specialty: 'Ternos, camisaria e black tie',
    bio: 'Referência em moda masculina premium no Brasil, do sob medida ao pronto, com camisaria e trajes de gala.',
    cover: 5, avatar: 5,
  },
  {
    name: 'Ellegancy Costuras', slug: 'ellegancy-costuras', prefix: 'EL',
    city: 'São Paulo', neighborhood: 'Bela Vista',
    tagline: 'Alta costura masculina e ajustes finos',
    specialty: 'Sob medida e ajustes de precisão',
    bio: 'Equipe experiente em alta costura masculina, do sob medida ao ajuste fino, com precisão e excelência.',
    cover: 6, avatar: 6,
  },
  {
    name: 'Alfaiataria Scavone', slug: 'alfaiataria-scavone', prefix: 'SC',
    city: 'São Paulo', neighborhood: 'República',
    tagline: 'Tradição sartorial desde 1947',
    specialty: 'Ternos clássicos e tecidos importados',
    bio: 'Casa tradicional da alfaiataria paulistana, com curadoria de tecidos importados e corte clássico atemporal.',
    cover: 7, avatar: 7,
  },
  {
    name: 'Sartoria Lucca', slug: 'sartoria-lucca', prefix: 'LU',
    city: 'São Paulo', neighborhood: 'Pinheiros',
    tagline: 'Sartoria de inspiração napolitana',
    specialty: 'Spalla camicia e construção leve',
    bio: 'Inspiração napolitana: ombro spalla camicia, construção leve e desestruturada para um caimento natural.',
    cover: 8, avatar: 8,
  },
  {
    // Textos provisorios e neutros — trocar pelos dados reais do ateliê.
    name: 'Fabrizio Allur', slug: 'fabrizio-allur', prefix: 'FA',
    city: 'São Paulo', neighborhood: null,
    tagline: 'Alfaiataria sob medida',
    specialty: 'Ternos e costumes sob medida',
    bio: 'Ateliê de alfaiataria sob medida, com atendimento individual e peças construídas a partir das medidas de cada cliente.',
    cover: 9, avatar: 9,
  },
];

// Pool de tecidos genéricos (nome base + categoria)
const fabricBases = [
  ["Lã Super 120's", 'Lã fria'],
  ["Lã Super 150's", 'Lã fria'],
  ['Tropical Lã Fria', 'Lã fria'],
  ['Risca de Giz', 'Lã fria'],
  ['Sharkskin', 'Lã fria'],
  ['Príncipe de Gales', 'Lã quente'],
  ['Tweed Espinha', 'Lã quente'],
  ['Flanela', 'Lã quente'],
  ['Linho Irlandês', 'Linho'],
  ['Linho Cru', 'Linho'],
  ['Cashmere Blend', 'Cashmere'],
  ['Algodão Egípcio', 'Algodão premium'],
  ['Seda Selvagem', 'Seda'],
  ['Veludo', 'Outro'],
];
const colors = ['Marinho', 'Grafite', 'Antracite', 'Chumbo', 'Bege', 'Café', 'Petróleo', 'Off-white', 'Carvão', 'Tabaco'];

const insAtelier = db.prepare(`
  INSERT INTO ateliers (id, name, slug, city, neighborhood, tagline, bio, specialty, avatar_image, cover_image, sort_order)
  VALUES (@id, @name, @slug, @city, @neighborhood, @tagline, @bio, @specialty, @avatar_image, @cover_image, @sort_order)
`);
const insFabric = db.prepare(`
  INSERT INTO fabrics (id, name, code, category, collection, texture_image, atelier_id)
  VALUES (@id, @name, @code, @category, @collection, @texture_image, @atelier_id)
`);

// Slugs passados na linha de comando limitam o que sera semeado:
//   node seed-marketplace.cjs                  -> todos (recria os 9)
//   node seed-marketplace.cjs fabrizio-allur   -> so esse, sem tocar nos outros
const onlySlugs = process.argv.slice(2);

const seed = db.transaction(() => {
  let texCursor = 0;
  ateliers.forEach((a, ai) => {
    if (onlySlugs.length && !onlySlugs.includes(a.slug)) return;
    // limpa execução anterior deste slug
    const existing = db.prepare('SELECT id FROM ateliers WHERE slug = ?').get(a.slug);
    if (existing) {
      db.prepare('DELETE FROM fabrics WHERE atelier_id = ?').run(existing.id);
      db.prepare('DELETE FROM ateliers WHERE id = ?').run(existing.id);
    }
    const atelierId = uid();
    insAtelier.run({
      id: atelierId, name: a.name, slug: a.slug, city: a.city, neighborhood: a.neighborhood,
      tagline: a.tagline, bio: a.bio, specialty: a.specialty,
      avatar_image: `/ateliers/avatar-${a.avatar}.jpg`,
      cover_image: `/ateliers/cover-${a.cover}.jpg`,
      sort_order: ai,
    });

    // 8 tecidos por ateliê
    const n = 8;
    for (let j = 0; j < n; j++) {
      const [base, category] = fabricBases[(ai * 3 + j) % fabricBases.length];
      const color = colors[(ai * 2 + j) % colors.length];
      // derivado de (ai, j) e nao de um contador corrido: assim semear um
      // ateliê sozinho gera as mesmas texturas que semear todos de uma vez
      const texIdx = ((ai * n + j) % 15) + 1;
      texCursor++;
      insFabric.run({
        id: uid(),
        name: `${base} ${color}`,
        code: `${a.prefix}-${100 + j}`,
        category,
        collection: 'Coleção Atemporal',
        texture_image: `fabrics/seed-tex-${String(texIdx).padStart(2, '0')}.jpg`,
        atelier_id: atelierId,
      });
    }
  });
});

seed();

const ateCount = db.prepare('SELECT COUNT(*) n FROM ateliers').get().n;
const fabByAtelier = db.prepare(`
  SELECT a.name, COUNT(f.id) c FROM ateliers a
  LEFT JOIN fabrics f ON f.atelier_id = a.id
  GROUP BY a.id ORDER BY a.sort_order
`).all();
console.log('Ateliês:', ateCount);
fabByAtelier.forEach(r => console.log(`  - ${r.name}: ${r.c} tecidos`));
db.pragma('wal_checkpoint(TRUNCATE)');
db.close();
