# TODO - taxiVisTrab (CSV otimizado para Dispersão e Matriz)

## Etapa 1 — Preparar CSVs no preprocess
- [x] Atualizar `src/prepare-data.js` para exportar:
  - `public/data/processed/dispersion_points.csv`
  - `public/data/processed/adjacency_matrix_edges.csv`

- [ ] Garantir filtros e amostragem da Dispersão iguais aos do front (até 300 por (ano, frota)).
- [ ] Garantir a query da Matriz (volume, avg_speed, HAVING COUNT>10, LIMIT 100) igual ao front.

## Etapa 2 — Trocar consumo no front
- [ ] Atualizar `src/main.js` para carregar `dispersion_points.csv` em vez de DuckDB.
- [ ] Atualizar `src/main.js` para carregar `adjacency_matrix_edges.csv` em vez de DuckDB.
- [ ] Manter o formato dos objetos exatamente como o `orchestratePlots()` e `loadAdjacencyMatrix()` esperam.

## Etapa 3 — Validar
- [ ] Executar `node src/prepare-data.js` e confirmar que os 2 CSVs aparecem em `public/data/processed/`.
- [ ] Rodar o app (vite) e verificar visualmente que Scatter e Matriz ficam “iguais”/quase iguais.

