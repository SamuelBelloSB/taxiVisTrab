## 1. 🚖 Introdução e Contextualização do Sistema

O framework original TaxiVis (Ferreira et al., 2013) consolidou-se como um marco na análise visual urbana ao permitir a exploração espaço-temporal de trajetórias de táxis em Nova Iorque através de consultas geográficas baseadas em mapas.

Este projeto executa uma reformulação da interface do TaxiVis, eliminando completamente as representações geográficas literais. Essa aplicação migra a análise para o campo das visualizações abstratas.

Ao desacoplar o espaço físico das coordenadas visuais, nosso sistema utiliza o motor relacional DuckDB no lado do servidor/carregamento para processar volumes massivos de arquivos Parquet, e o ecossistema D3.js no lado do cliente para renderizar as visualizações integradas. Esta arquitetura visa revelar a estrutura oculta da dinâmica urbana de Nova Iorque através do framework analítico de três níveis de Tamara Munzner (What, Why, How).

---

## 2. ⚙️ Engenharia de Dados e Infraestrutura de Pré-processamento (What / Data)

A base de dados do projeto consiste nos registros históricos de viagens de táxis amarelos (Yellow Taxi) e verdes (Green Taxi) de Nova Iorque, cobrindo o horizonte temporal de 2022 a 2024. A infraestrutura implementada nos arquivos `taxi.js` e `prepare-data.js` mitiga a latência arquitetural por meio de uma estratégia de pré-processamento pesado via DuckDB.

O dataset original é do tipo Tabela Relacional, onde cada item representa uma viagem individual e os atributos são tipificados conforme o framework de Munzner:

* `tpep_pickup_datetime` / `lpep_pickup_datetime`: Atributo Temporal, ordenado, contínuo e cíclico.
* `trip_distance`: Atributo Quantitativo, quantifica a magnitude da distância linear em milhas.
* `fare_amount` / `tip_amount`: Atributos Quantitativos, expressando valores monetários.
* `PULocationID` (Origem) / `DOLocationID` (Destino): Atributos Categoriais Nominais que identificam as zonas de tráfego da TLC (Taxi and Limousine Commission).
* `tipo_taxi`: Atributo Categorial Nominal binário (yellow ou green).

Para viabilizar a fluidez da interface web, os dados brutos sofrem severas filtragens e agregações estruturadas no arquivo `prepare-data.js`:

**🧹 1. Filtragem de Inconsistências (Data Cleaning)**

```sql
WHERE trip_distance > 0.1 AND fare_amount >= 2.50 AND tip_amount IS NOT NULL

```

> **Justificativa Semântica:** Viagens com distâncias inferiores a **0,1 milhas** ou tarifas abaixo do valor fixo inicial de bandeira (**$2,50**) representam ruídos operacionais, cancelamentos ou falhas na transmissão do taxímetro que distorceriam as médias globais de velocidade e faturamento.

**🔄 2. Derivação de Atributos e Agregação Espaço-Temporal Abstrata**
Para alimentar o Heatmap, o DuckDB extrai componentes cíclicos do tempo e consolida as métricas:

```sql
SELECT 
    ano,
    Lower(Trim(dia_semana)) as dia_semana,
    EXTRACT(HOUR FROM pickup_time) as hora,
    tipo_taxi,
    COUNT(*) as volume
FROM t_cleaned_trips 
GROUP BY ano, dia_semana, hora, tipo_taxi

```

> **Justificativa Semântica:** Reduz o dataset de muitas linhas para uma matriz compacta indexada por **7 dias x 24 horas**, permitindo que o D3.js execute renderizações instantâneas ao alternar filtros globais de ano.

**📅 3. Agregação para a Série Temporal Diária**

```sql
SELECT 
    CAST(pickup_time AS DATE) as data, ano, mes, tipo_taxi,
    COUNT(*) as volume,
    ROUND(SUM(fare_amount), 2) as faturamento_total,
    ROUND(AVG(trip_distance), 2) as distancia_media
FROM t_cleaned_trips 
GROUP BY CAST(pickup_time AS DATE), ano, mes, tipo_taxi, dia_semana

```

> **Justificativa Semântica:** Transforma eventos discretos pontuais em fluxos contínuos de séries temporais diárias, calculando agregados de soma e média para suportar análises de tendências sazonais de longo prazo.

---

## 3. 📊 Decomposição das Visualizações sob o Framework de Munzner

Abaixo, cada uma das visualizações implementadas na plataforma é detalhada segundo os níveis What (Dados Disponibilizados), Why (Tarefas Suportadas) e How (Design e Justificativa de Canais Visuais).

### 📍 VISUALIZAÇÃO DO SCATTERPLOT

Implementamos um Gráfico de Dispersão (Scatterplot). A decomposição sob o framework de três níveis de Tamara Munzner revela um design focado na exploração de correlações e tratamento de distribuições assimétricas.

#### 📦 What (Dados e Atributos)
A visualização consome um dataset onde cada item (linha) representa uma viagem individual de táxi.

* `trip_distance` **(Eixo X):** Atributo Quantitativo Contínuo. Representa a distância da viagem em milhas.
* `tip_amount` **(Eixo Y):** Atributo Quantitativo Contínuo. Representa o valor da gorjeta em dólares.
* `tipo_taxi` **(Cor - coresScatter):** Atributo Categórico Nominal (yellow ou green). Identifica a frota do veículo.
* **Transformações de Atributos:** Aplicação de Escala de Raiz Quadrada (`d3.scaleSqrt`) em ambos os eixos. *Justificativa:* Dados financeiros e de distância possuem distribuição assimétrica à direita. A raiz quadrada "abre" a visualização para valores baixos e "comprime" os outliers.

#### 🎯 Why (Tarefas Analíticas)
O Scatterplot é o idioma visual definitivo para analisar a relação bidimensional entre duas variáveis numéricas.

* **Descobrir e Correlacionar:** Avaliar se existe correlação linear ou não-linear entre a distância percorrida e a gorjeta.
* **Identificar Outliers:** Localizar visualmente comportamentos anômalos (ex: viagens curtas com gorjetas altíssimas).
* **Comparar Distribuições:** Comparar o comportamento de gorjetas entre clientes da frota Amarela versus Verde.

#### 🖌️ How (Marcas e Canais de Design)

* **Marcas (Marks):** Pontos implementados através do elemento SVG `<circle>`.
* **Posição Espacial Bidimensional Alinhada:** O olho humano cruza a posição horizontal e vertical quase instantaneamente (canal mais eficaz).
* **Matiz de Cor:** Codifica o `tipo_taxi`, garantindo agrupamento pré-atentivo das frotas.
* **Transparência/Saturação (Mitigação de Overplotting):** Uso de raio pequeno, borda fina e opacidade reduzida. O acúmulo de pontos translúcidos transforma o canal de posição em um canal de densidade geométrica.
* **Linhas de Referência (Gridlines):** Auxiliam o olho a ancorar pontos flutuantes de volta aos eixos.

---

### 📈 VISUALIZAÇÃO DE SÉRIE TEMPORAL

Gráfico de Série Temporal (Time Series com Área Preenchida) destaca a eficácia do mapeamento espacial alinhado para revelar a evolução contínua de dados ao longo do tempo.

#### 📦 What (Dados e Atributos)

* `data` **(Eixo X):** Atributo Temporal Contínuo.
* `volume` **(Eixo Y):** Atributo Quantitativo Sequencial (Magnitude de contagem).
* `tipo_taxi` **(Cor):** Atributo Categórico Nominal (yellow ou green).
* **Transformações Estruturais:** Suavização Temporal com o uso de `.nice()` no eixo Y para legibilidade humana.

#### 🎯 Why (Tarefas Analíticas)

* **Identificar Tendências:** Observar o comportamento macro (sazonalidade) e micro (oscilações curtas) da demanda.
* **Localizar Extremos:** Encontrar rapidamente os dias/meses com maiores picos ou vales profundos.
* **Resumir a Evolução:** Extrair uma síntese do comportamento da frota ao longo das estações do ano.

#### 🖌️ How (Marcas e Canais de Design)

* **Marcas (Marks):** Linha (`d3.line()`) para a silhueta principal e Área (`d3.area()`) para ancorar à base.
* **Posição Espacial em Escala Comum:** O tempo flui da esquerda para a direita (X), a magnitude cresce de baixo para cima (Y).
* **Matiz de Cor:** Define a cor do contorno para diferenciar categorias.
* **Luminância/Transparência por Gradiente:** Ajuda a perceber a "massa" da métrica sem ocultar as linhas de grade do fundo.
* **Interpolação de Curva (**`d3.curveMonotoneX`**):** Arredonda transições geométricas de dados diários ruidosos, evitando o padrão "dente de serra".
* **Texto e Rotação:** Rotação de rótulos em -45° para evitar colisão horizontal.

---

### 🌡️ VISUALIZAÇÃO DE HEATMAP

A visualização consome uma tabela de dados pré-agregada do DuckDB que sumariza eventos discretos em intervalos de tempo cíclicos.

#### 📦 What (Dados e Atributos)

* `hora` **(Eixo X):** Atributo Quantitativo Discreto e Cíclico (0 a 23).
* `dia_semana` **(Eixo Y):** Atributo Categórico Ordinal e Cíclico (Dom a Sáb).
* `volume` **(Luminância/Saturação):** Atributo Quantitativo Sequencial (Magnitude).
* `tipo_taxi` **(Matiz de Cor):** Atributo Categórico Nominal.
* **Transformações:** Filtragem de células vazias e aplicação de escala matemática logarítmica para a cor.

#### 🎯 Why (Tarefas Analíticas)

* **Descobrir e Identificar Padrões:** Revelar a periodicidade da demanda urbana e identificar picos absolutos.
* **Resumir a Distribuição:** Comprimir milhões de viagens em uma grade de 168 células.
* **Comparar Frotas e Escalas:** Uso do parâmetro `globalMax` para permitir comparação justa de saturação entre frotas.

#### 🖌️ How (Marcas e Canais de Design)

* **Marcas (Marks):** Áreas/Superfícies (elementos `<rect>` em matriz celular).
* **Posição Espacial Bidimensional:** Fixa o tempo em uma grade geométrica ortogonal.
* **Matiz de Cor:** Interpolação de verdes e amarelos/laranjas para categorização pré-atentiva.
* **Luminância/Saturação (Escala Logarítmica):** Essencial para lidar com extrema assimetria de dados, garantindo que madrugadas (baixo volume) permaneçam visíveis perto dos horários de pico.
* **Texto / Rótulos:** Abreviação de rótulos em telas menores para evitar sobrecarga cognitiva.

---

### 🕸️ VISUALIZAÇÃO MATRIZ DE ADJACÊNCIAS

Muito eficiente para a exploração de topologias de rede, focando inteiramente em relações espaciais e de fluxo.

#### 📦 What (Dados e Atributos)

* `pu` e `do` **(Origem e Destino):** Atributos Categoriais Nominais (Nós da rede).
* `volume` **(Transparência/Opacidade):** Atributo Quantitativo Contínuo (Força da conexão).
* `avg_speed` **(Matiz e Saturação):** Atributo Quantitativo Contínuo (Eficiência do fluxo).
* `tipo_taxi` **(Interatividade):** Atributo Categórico Nominal.
* **Transformações:** Agregação de arestas (Edge Bundling), Derivação Ponderada da velocidade média e Filtragem de Topologia (Top 15 Hubs).

#### 🎯 Why (Tarefas Analíticas)

* **Consultar e Explorar:** Cruzar bairros de origem e destino para extrair características da rota.
* **Descobrir Gargalos:** Identificar rotas engarrafadas versus vias de alta fluidez.
* **Resumir Fluxos:** Identificar rapidamente os principais corredores de mobilidade.

#### 🖌️ How (Marcas e Canais de Design)

* **Marcas (Marks):** Área/Superfície (elementos `<rect>` em grade).
* **Posição Bidimensional Ortogonal:** Elimina 100% o cruzamento de arestas (edge-crossing).
* **Matiz e Saturação de Cor:** Mapeia a Velocidade Média, evidenciando áreas "frias" ou "quentes" de trânsito.
* **Transparência / Opacidade:** Codifica o Volume Total. Rotas massivas ganham solidez visual sem alterar a leitura da cor (velocidade).
* **Interação de Detalhes sob Demanda:** Tooltips em hover revelam números exatos, completando o ciclo analítico.

---

### 📉 VISUALIZAÇÃO SÉRIE COMPARATIVA

Exibe quatro variáveis simultaneamente na tela (Volume e Faturamento, para as frotas Amarela e Verde) ao longo do tempo.

![Tendência Comparativa](00%20-%20data/img/tendenciaComparativa.png)

#### 📦 What (Dados e Atributos)

* `data` **(Eixo X):** Atributo Temporal Contínuo.
* `volume` e `faturamento` **(Eixo Y):** Atributos Quantitativos Contínuos.
* `tipo_taxi` **(Cor):** Atributo Categórico Nominal.
* **Transformações:** Escala Simétrica Logarítmica (`d3.scaleSymlog()`) para comprimir valores gigantescos e expandir menores, permitindo convivência no mesmo eixo Y. Agrupamento estrutural por frota e data.

#### 🎯 Why (Tarefas Analíticas)

* **Comparar e Correlacionar:** Entender a relação de proporcionalidade entre volume de viagens e faturamento financeiro.
* **Descobrir Divergências:** Identificar se frotas andam juntas ou de forma independente a longo prazo.
* **Consultar Detalhes:** Tarefa transferida para interatividade, devido à compressão visual do symlog.

#### 🖌️ How (Marcas e Canais de Design)

* **Marcas (Marks):** Linhas Contínuas e Pontos nos vértices para ancoragem temporal.
* **Posição Bidimensional:** Eixo Y compartilhado para comparação direta.
* **Matiz de Cor:** Codifica exclusivamente a frota (Amarela ou Verde).
* **Padrão de Linha / Textura:** Diferencia as métricas. Volume (linha sólida) vs Faturamento (linha tracejada).
* **Opacidade:** Linha de faturamento recebe opacidade reduzida, criando hierarquia visual favorável ao volume.
* **Interatividade (Busca Binária):** Uso de `d3.bisector` para projetar linha guia vertical e tooltips com valores reais descompactados.

---

### 📋 VISUALIZAÇÃO KPI SUMÁRIO

Painel estruturado como uma tabela de sumário executivo com dados altamente sumarizados.

![KPI Sumario Executivo do Mercado](00%20-%20data/img/sumarioExecutivo.png)


#### 📦 What (Dados e Atributos)

* `label` **(Colunas):** Atributo Categórico Ordinal (Particionador de tempo).
* `tipo_taxi` **(Linhas):** Atributo Categórico Nominal.
* `faturamento` **(Célula Principal):** Atributo Quantitativo Contínuo.
* `volume` **(Célula Secundária):** Atributo Quantitativo Discreto.
* **Transformações:** Formatação tipográfica de dados (`d3.format`) para converter números brutos em glifos textuais compactos (ex: **$1.5B**).

#### 🎯 Why (Tarefas Analíticas)

* **Apresentar e Resumir:** Fornecer os totais absolutos do mercado de táxis como contexto primário.
* **Comparar Proporcionalidade:** Constatar a dominância de frotas através do cruzamento visual.
* **Consultar Valores Exatos:** Extração de valores nominais precisos onde gráficos abstratos falham.

#### 🖌️ How (Marcas e Canais de Design)

* **Marcas (Marks):** Textos / Glifos (os próprios números) e Regiões Espaciais (células `div`).
* **Posição Tabular 2D:** Método mais eficaz para busca direcionada cruzando linhas e colunas.
* **Matiz de Cor:** Bordas coloridas garantem consistência visual global com o resto do painel (pre-attentive linking).
* **Hierarquia Tipográfica:** Tamanhos de fonte guiam o olho primeiro para o faturamento financeiro e depois para o esforço logístico (viagens).
* **Realce de Fundo / Contorno:** Demarcação visual clara para separar colunas de "Total" dos particionamentos temporais.

Aqui está a conclusão simplificada e coesa, mantendo o formato em Markdown com emojis para dar continuidade ao estilo do seu relatório:

---

## 4. 🏁 Conclusão Geral do Projeto

Ao abandonar os mapas tradicionais, o projeto apostou no poder das visualizações abstratas. Essa mudança de paradigma resolveu problemas clássicos na análise de dados urbanos, como a poluição visual por excesso de pontos sobrepostos e o caos de milhares de rotas cruzadas.

O sucesso desta abordagem se apoia em três pilares fundamentais:

* **🚀 1. Alta Performance com DuckDB:** A adoção deste motor analítico permitiu processar milhões de registros quase instantaneamente. O DuckDB assumiu o trabalho pesado de filtrar ruídos e calcular médias, entregando à interface web apenas os dados essenciais. Isso garantiu uma aplicação rápida e fluida.
* **🎨 2. Visualizações Sob Medida com D3.js:** O uso do ecossistema D3.js foi vital para construir gráficos customizados que fugissem do padrão, viabilizando recursos complexos como as séries temporais comparativas e a matriz de adjacência.
* **🧠 3. Design Científico (Framework de Munzner):** Nenhuma escolha visual foi feita por acaso. A natureza dos dados e o objetivo da análise ditaram as regras. A posição na tela foi reservada para os dados mais importantes (como tempo e distância), enquanto as cores foram aplicadas de forma estratégica para diferenciar rapidamente as frotas e os fluxos.

O resultado é um painel de *Visual Analytics* maduro e direto. Em vez de simplesmente "mostrar onde os táxis estão", a plataforma responde a perguntas complexas sobre a dinâmica de Nova Iorque: como a demanda varia ao longo do dia, qual o impacto econômico no tempo e onde estão os verdadeiros gargalos de trânsito.

Por fim, este projeto prova que unir uma engenharia de dados eficiente a um design visual com base científica é o caminho ideal para transformar dados brutos e massivos em ferramentas claras para a tomada de decisão.