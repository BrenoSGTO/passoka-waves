<img src="assets/icon.svg" width="64" height="64" alt="">

# Passoka Waves

Previsão de ondas, swell, vento e maré para as praias de Florianópolis, no estilo Surfguru/Windy.

**Site:** https://brenosgto.github.io/passoka-waves/

## Fontes de dados

| Dado | Fonte | Observação |
|---|---|---|
| Ondas, swell 1/2, vaga de vento, temp. da água | [Open-Meteo Marine API](https://open-meteo.com/en/docs/marine-weather-api) | ECMWF WAM, MFWAM, DWD, GFS Wave. Grátis, sem chave, CORS liberado |
| Maré (nível do mar) | Open-Meteo Marine `sea_level_height_msl` | Modelada; preamar/baixa-mar calculadas a partir da curva |
| Vento, rajadas, tempo, sol | [Open-Meteo Forecast API](https://open-meteo.com/en/docs) | Melhor modelo regional automaticamente |
| Mapa animado | [Windy embed](https://embed.windy.com) | Ondas, swell e vento |
| Mapa das praias | Leaflet + OpenStreetMap | |

Site 100% estático (HTML/CSS/JS, sem build) — roda direto no GitHub Pages.
Para rodar local: `python -m http.server` e abra http://localhost:8000.

Praias e orientação ficam em `js/beaches.js`; a nota de surf é calculada em `js/api.js`.
