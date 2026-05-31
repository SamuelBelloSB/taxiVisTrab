# Relatório Técnico: Visualização da Mobilidade Urbana de NY (2022-2024)

## 1. Introdução
Este projeto apresenta uma ferramenta de análise visual sobre o mercado de táxis de Nova York no período pós-pandemia. O objetivo é compreender as diferenças operacionais e geográficas entre os táxis licenciados (Yellow) e os táxis de bairro (Green).

## 2. Pipeline e Arquitetura de Dados
Devido ao volume de dados (milhões de registros), o projeto utiliza uma arquitetura de processamento em duas camadas:
1. **Pré-processamento (ETL):** Script Node.js que agrega registros brutos em arquivos otimizados, tratando outliers (viagens > 100 milhas ou tarifas < $2.50).
2. **Motor Analítico In-Browser:** O uso de **DuckDB-Wasm** permite consultas SQL em tempo real no lado do cliente, garantindo que interações como a Matriz de Adjacências sejam instantâneas.

## 3. Metodologia Visual
O design foi fundamentado no conceito de **Data-Ink Ratio** (Tufte), eliminando elementos decorativos para priorizar a informação.

### 3.1 Mapeamento Visual e Justificativas

**Matriz de Adjacências (Fluxo):**
- **Justificativa:** Resolve o problema de oclusão comum em mapas de nós e elos.
- **Canais:** Cor (Velocidade - escala RdYlGn) e Opacidade (Volume).

**Tendência Comparativa (Série Temporal):**
- **Justificativa:** O uso de **Escala Symlog** é crucial para permitir a comparação da frota Verde (baixo volume) com a Amarela (alto volume) no mesmo eixo Y sem invisibilizar a primeira.

**Dispersão (Scatter Plot):**
- **Justificativa:** Aplicação de **scaleSqrt** (Raiz Quadrada) no eixo de distância para lidar com a distribuição de cauda longa, melhorando a visibilidade da massa de dados em viagens curtas.

## 4. Interatividade (Mantra de Shneiderman)
A interface segue rigorosamente o princípio: *Overview first, zoom and filter, then details-on-demand*:
1. **Overview:** KPIs totais e Tendência trienal no topo.
2. **Filtro:** Seleção de ano que reprocessa os heatmaps e dispersões.
3. **Details-on-demand:** Tooltips dinâmicos que revelam a frota predominante, velocidades exatas e valores monetários.

## 5. Conclusões
A análise revela que, embora a frota Amarela domine o volume total, a frota Verde possui janelas de eficiência em horários específicos fora do horário comercial, sugerindo uma complementaridade no ecossistema de transportes de NY.

---
**Disciplina:** Visualização de Dados
**Instituição:** UFF - Instituto de Computação
**Data:** 30 de Maio de 2026