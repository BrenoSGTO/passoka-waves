// Praias de Florianópolis.
// facing = direção (graus, a partir do Norte) para onde a praia "olha" (normal ao mar).
// Coordenadas e orientação medidas na linha de costa e no polígono de cada praia do OpenStreetMap.
// Swell vindo dessa direção entra em cheio; vento vindo de facing+180 é terral (offshore).
window.BEACHES = [
  { id: 'brava',        name: 'Praia Brava',        region: 'Norte', lat: -27.3990, lon: -48.4132, facing: 80 },
  { id: 'ingleses',     name: 'Ingleses',           region: 'Norte', lat: -27.4329, lon: -48.3900, facing: 45 },
  { id: 'santinho',     name: 'Santinho',           region: 'Norte', lat: -27.4579, lon: -48.3744, facing: 110 },
  { id: 'mocambique',   name: 'Moçambique',         region: 'Leste', lat: -27.5213, lon: -48.4118, facing: 115 },
  { id: 'barra',        name: 'Barra da Lagoa',     region: 'Leste', lat: -27.5711, lon: -48.4264, facing: 50 },
  { id: 'galheta',      name: 'Galheta',            region: 'Leste', lat: -27.5935, lon: -48.4252, facing: 150 },
  { id: 'mole',         name: 'Praia Mole',         region: 'Leste', lat: -27.6022, lon: -48.4325, facing: 125 },
  { id: 'joaquina',     name: 'Joaquina',           region: 'Leste', lat: -27.6340, lon: -48.4533, facing: 135 },
  { id: 'campeche',     name: 'Campeche',           region: 'Sul',   lat: -27.6872, lon: -48.4830, facing: 115 },
  { id: 'morro',        name: 'Morro das Pedras',   region: 'Sul',   lat: -27.7106, lon: -48.4996, facing: 115 },
  { id: 'armacao',      name: 'Armação',            region: 'Sul',   lat: -27.7363, lon: -48.5070, facing: 90 },
  { id: 'matadeiro',    name: 'Matadeiro',          region: 'Sul',   lat: -27.7544, lon: -48.4984, facing: 60 },
  { id: 'lagoinha',     name: 'Lagoinha do Leste',  region: 'Sul',   lat: -27.7734, lon: -48.4856, facing: 125 },
  { id: 'pantano',      name: 'Pântano do Sul',     region: 'Sul',   lat: -27.7841, lon: -48.5194, facing: 160 },
  { id: 'solidao',      name: 'Solidão',            region: 'Sul',   lat: -27.7943, lon: -48.5333, facing: 120 },
  { id: 'naufragados',  name: 'Naufragados',        region: 'Sul',   lat: -27.8346, lon: -48.5632, facing: 200 },
];

// Ponto de modelo de ondas ~8 km mar adentro, na direção em que a praia olha.
window.BEACHES.forEach(b => {
  const d = 0.07, r = b.facing * Math.PI / 180;
  b.mlat = +(b.lat + d * Math.cos(r)).toFixed(4);
  b.mlon = +(b.lon + d * Math.sin(r) / Math.cos(b.lat * Math.PI / 180)).toFixed(4);
});
