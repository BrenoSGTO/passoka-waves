// Praias de Florianópolis.
// facing = direção (graus, a partir do Norte) para onde a praia "olha" (normal ao mar).
// Swell vindo dessa direção entra em cheio; vento vindo de facing+180 é terral (offshore).
window.BEACHES = [
  { id: 'brava',        name: 'Praia Brava',        region: 'Norte', lat: -27.3985, lon: -48.4130, facing: 60 },
  { id: 'ingleses',     name: 'Ingleses',           region: 'Norte', lat: -27.4360, lon: -48.3930, facing: 25 },
  { id: 'santinho',     name: 'Santinho',           region: 'Norte', lat: -27.4630, lon: -48.3780, facing: 90 },
  { id: 'mocambique',   name: 'Moçambique',         region: 'Leste', lat: -27.5150, lon: -48.4080, facing: 95 },
  { id: 'barra',        name: 'Barra da Lagoa',     region: 'Leste', lat: -27.5740, lon: -48.4220, facing: 65 },
  { id: 'galheta',      name: 'Galheta',            region: 'Leste', lat: -27.5920, lon: -48.4300, facing: 95 },
  { id: 'mole',         name: 'Praia Mole',         region: 'Leste', lat: -27.6020, lon: -48.4330, facing: 100 },
  { id: 'joaquina',     name: 'Joaquina',           region: 'Leste', lat: -27.6290, lon: -48.4480, facing: 110 },
  { id: 'campeche',     name: 'Campeche',           region: 'Sul',   lat: -27.6760, lon: -48.4770, facing: 110 },
  { id: 'morro',        name: 'Morro das Pedras',   region: 'Sul',   lat: -27.7130, lon: -48.5030, facing: 120 },
  { id: 'armacao',      name: 'Armação',            region: 'Sul',   lat: -27.7470, lon: -48.5050, facing: 100 },
  { id: 'matadeiro',    name: 'Matadeiro',          region: 'Sul',   lat: -27.7540, lon: -48.4980, facing: 95 },
  { id: 'lagoinha',     name: 'Lagoinha do Leste',  region: 'Sul',   lat: -27.7730, lon: -48.4840, facing: 125 },
  { id: 'pantano',      name: 'Pântano do Sul',     region: 'Sul',   lat: -27.7810, lon: -48.5100, facing: 180 },
  { id: 'solidao',      name: 'Solidão',            region: 'Sul',   lat: -27.7950, lon: -48.5270, facing: 150 },
  { id: 'naufragados',  name: 'Naufragados',        region: 'Sul',   lat: -27.8330, lon: -48.5630, facing: 200 },
];

// Ponto de modelo de ondas ~8 km mar adentro, na direção em que a praia olha.
window.BEACHES.forEach(b => {
  const d = 0.07, r = b.facing * Math.PI / 180;
  b.mlat = +(b.lat + d * Math.cos(r)).toFixed(4);
  b.mlon = +(b.lon + d * Math.sin(r) / Math.cos(b.lat * Math.PI / 180)).toFixed(4);
});
