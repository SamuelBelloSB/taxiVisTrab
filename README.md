# Fluxo de Táxis de NY (2022 — 2024)

Este projeto é um dashboard interativo para análise visual da mobilidade urbana de Nova York, focando na comparação entre as frotas de Táxis Amarelos (Yellow) e Verdes (Green).

## Arquitetura do Projeto

O projeto utiliza uma arquitetura moderna de processamento de dados híbrido:

1.  **Frontend:** Desenvolvido em Vanilla JavaScript com a biblioteca **D3.js** para todas as renderizações de SVG.
2.  **Processamento em Tempo Real:** Utiliza **DuckDB-Wasm** para executar consultas SQL complexas diretamente no navegador sobre arquivos Parquet.
3.  **Pré-processamento:** Um script Node.js (`src/prepare-data.js`) agrega milhões de registros brutos em arquivos CSV otimizados para as séries temporais e heatmaps.
4.  **Estética:** Design minimalista com paleta de cores "Umber e Moss" (terroso), focado em alto contraste e redução de ruído visual.

## Como Executar

### Requisitos
- Node.js (v16+)
- Um servidor local (Live Server, http-server, etc.)

### Configuração do Dataset
1. Crie a estrutura de pastas:
   ```text
   /public/data/green/ (coloque os arquivos .parquet aqui)
   /public/data/yellow/ (coloque os arquivos .parquet aqui)
   ```
2. Execute o pré-processamento:
   ```bash
   node src/prepare-data.js
   ```
   Isso gerará os arquivos em `public/data/processed/` necessários para o carregamento rápido.

### Execução
Abra o `index.html` através de um servidor local (necessário para o suporte a Web Workers do DuckDB-Wasm).

## Visualizações Implementadas

- **Matriz de Adjacências (Origem x Destino):** Fluxo entre as 15 principais localidades com canal de velocidade.
- **Tendência Comparativa (Volume x Faturamento):** Comparação trienal entre frotas.
- **Mapa de Calor (Horário x Dia):** Concentração de demanda por quadrimestres.
- **Série Temporal (Volume):** Evolução mensal de cada frota.
- **Dispersão (Distância x Gorjeta):** Análise de correlação e comportamento do passageiro.

---
**Desenvolvedores:** Danilo Silva & Samuel Bello
**Instituição:** Universidade Federal Fluminense (UFF)