// NOTA: taxi.js / config.js (DuckDB-Wasm) continuam no projeto para exploracao
// local, mas foram tirados do caminho critico do boot. Em producao o dashboard
// le apenas os CSVs pre-agregados gerados por `node src/prepare-data.js`.
import { loadChart, loadHeatmap, loadTimeSeries, loadKPITable, loadComparisonSeries, loadAdjacencyMatrix, clearChart } from './plot.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

// Base dos dados processados. Publicando a raiz do repo no GitHub Pages o
// conteudo de public/ fica sob ./public/. Se um dia passarem a publicar o
// dist/ do Vite, basta trocar para './data/processed'.
const DATA_BASE = './public/data/processed';

let cacheDadosHeatmap = [];
let cacheDadosSerie = [];
let cacheDadosMatriz = [];
let cacheDadosScatter = [];
let globalScatterData = [];
let selectedYear = 2022; // Padrão conforme solicitado

/**
 * Helper para limpar aspas e espaços de strings vindas do CSV
 * essencial para evitar quebra de seletores CSS e erros de comparação
 */
const cleanStr = (str) => (str || "").replace(/["']/g, "").trim();

const nomesMeses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const nomesQuadrimestres = ["1º Quadrimestre (Jan-Abr)", "2º Quadrimestre (Mai-Ago)", "3º Quadrimestre (Set-Dez)"];
const MATRIX_FLEET_TYPES = ['yellow', 'green'];
const getFleetLabel = tipo => tipo === 'yellow' ? 'Amarela' : 'Verde';
const getMatrixHash = tipo => `#matriz-${tipo}`;

/**
 * UI Manager: Responsável pela manipulação dinâmica do DOM
 */
const UIManager = {
    renderSkeleton(frotas) {
        const container = document.getElementById('timeline-container');
        const nav = document.getElementById('dynamic-nav');
        container.innerHTML = '';
        
        const title = nav.querySelector('span');
        nav.innerHTML = ''; nav.appendChild(title);
        title.textContent = "Frotas";

        frotas.forEach(tipo => {
            const link = document.createElement('a');
            link.href = `#block-${tipo}`;
            link.textContent = tipo.charAt(0).toUpperCase() + tipo.slice(1);
            nav.appendChild(link);

            const section = document.createElement('section');
            section.className = 'year-block';
            section.id = `block-${tipo}`;
            section.innerHTML = `
                <div class="year-header">Frota ${tipo === 'green' ? 'Verde' : 'Amarela'}</div>
                
                <div class="year-selector-container" data-tipo="${tipo}">
                    <button class="year-btn ${selectedYear === 2022 ? 'active' : ''}" data-year="2022">2022</button>
                    <button class="year-btn ${selectedYear === 2023 ? 'active' : ''}" data-year="2023">2023</button>
                    <button class="year-btn ${selectedYear === 2024 ? 'active' : ''}" data-year="2024">2024</button>
                </div>

                <div class="charts-grid">
                    <div class="chart-box"><h3>Dispersão (Distância x Gorjeta)</h3><svg id="scatter-${tipo}"></svg></div>
                    <div class="chart-box"><h3>Série Temporal (Volume)</h3><svg id="series-${tipo}"></svg></div>
                </div>
                <div class="pattern-header-container">
                    <div class="pattern-header">Mapa de Calor (Horário x Dia)</div>
                    <div class="pattern-subtitle">Concentração de viagens por período</div>
                </div>
                <div class="monthly-grid" id="grid-${tipo}"></div>
            `;
            container.appendChild(section);

            // Event listeners para os botões de ano
            section.querySelectorAll('.year-btn').forEach(btn => {
                btn.onclick = (e) => updateGlobalYear(parseInt(e.target.dataset.year));
            });

            // Cria os slots para os 3 heatmaps quadrimestrais
            const grid = document.getElementById(`grid-${tipo}`);
            for (let q = 1; q <= 3; q++) {
                const box = document.createElement('div');
                box.className = 'chart-box small';
                box.innerHTML = `<h5>${nomesQuadrimestres[q-1]}</h5><svg id="heatmap-${tipo}-q${q}"></svg>`;
                grid.appendChild(box);
            }
        });
    }
};

/**
 * Overview Manager: Renderiza os gráficos de resumo no topo
 */
async function renderOverview() {
    const container = document.getElementById('overview-container');
    const yearButtonsMarkup = AVAILABLE_YEARS.map(year => `
        <button class="year-btn ${currentMatrixYear === year ? 'active' : ''}" data-year="${year}">${year}</button>
    `).join('');

    container.innerHTML = `
        <div style="width: 100%; text-align: left; margin-bottom: 30px; border-bottom: 2px solid #5b6346; padding-bottom: 10px;">
            <h1 style="color: #5b6346; margin: 0; font-size: 2.2em;">Fluxo de Táxis de NY</h1>
        </div>
        <div id="matrix-year-selector" class="year-selector-container">
            ${yearButtonsMarkup}
        </div>
        <div class="charts-grid" style="margin-top: 20px;">
            <div class="chart-box" style="height:520px;">
                <h3 style="min-height: 2.5em; display: flex; align-items: center; text-align: center;">Matriz de Adjacências (Origem x Destino)</h3>
                <div class="pattern-subtitle">Cor indica velocidade média (Canal de Velocidade).</div>
                <svg id="adjacency-matrix"></svg>
            </div>
            <div class="chart-box" style="height:520px;">
                <h3 style="min-height: 2.5em; display: flex; align-items: center; text-align: center;">Tendência Comparativa (Volume x Faturamento)</h3>
                <div class="pattern-subtitle">Evolução consolidada das frotas no triênio.</div>
                <svg id="comparison-series"></svg>
            </div>
        </div>

        <h2 style="margin-top: 30px;">Sumário Executivo do Mercado</h2>
        <div id="kpi-table-container"></div>
    `;

    if (cacheDadosSerie.length === 0) return;

    const years = [2022, 2023, 2024];
    const kpiData = years.map(ano => ({
        label: `Ano ${ano}`,
        stats: d3.rollups(cacheDadosSerie.filter(d => d.ano === ano), 
            v => ({
                faturamento: d3.sum(v, d => d.faturamento_total),
                volume: d3.sum(v, d => d.volume)
            }), d => d.tipo_taxi)
    }));

    const statsTotal = d3.rollups(cacheDadosSerie, v => ({
        faturamento: d3.sum(v, d => d.faturamento_total),
        volume: d3.sum(v, d => d.volume)
    }), d => d.tipo_taxi);
    
    kpiData.push({ label: 'Total Triênio', stats: statsTotal, highlighted: true });

    loadKPITable(kpiData, '#kpi-table-container');

    // Agregação mensal consolidada para o gráfico de tendência comparativa
    if (cacheDadosSerie.length > 0) {
        const dadosMensais = d3.rollups(
            cacheDadosSerie,
            v => ({
                volume: d3.sum(v, d => d.volume),
                faturamento: d3.sum(v, d => d.faturamento_total)
            }),
            d => d.tipo_taxi,
            d => d3.timeMonth(d.data)
        ).flatMap(([tipo, meses]) => 
            meses.map(([mes, val]) => ({ tipo_taxi: tipo, data: mes, volume: val.volume, faturamento: val.faturamento }))
        );
        
        console.log("Amostra Agregação Mensal (Comparativo):", dadosMensais.filter(d => d.tipo_taxi === 'green').slice(0, 3));
        loadComparisonSeries(dadosMensais, '#comparison-series');
    }
}

const DEFAULT_MATRIX_HASH = '#matriz-yellow';
let currentMatrixYear = 2023;
const AVAILABLE_YEARS = [2022, 2023, 2024];


function getMatrixColorFromHash(hash) {
    const normalized = (hash || '').toLowerCase();
    if (normalized === '#matriz-green') return 'green';
    if (normalized === '#matriz-yellow') return 'yellow';
    return null;
}

function isMatrixHash(hash) {
    return /^#matriz-(yellow|green)$/.test((hash || '').toLowerCase());
}

function isFleetHash(hash) {
    return /^#block-(yellow|green)$/.test((hash || '').toLowerCase());
}

function updateMatrixButtons(activeColor) {
    document.querySelectorAll('.matrix-tab').forEach(button => {
        const buttonColor = button.dataset.hash.replace('#matriz-', '');
        button.classList.toggle('active', buttonColor === activeColor);
    });
}

function setOverviewVisible(visible) {
    const overview = document.getElementById('overview-container');
    if (overview) overview.style.display = visible ? '' : 'none';
}

function setTimelineVisible(visible) {
    const timeline = document.getElementById('timeline-container');
    if (timeline) timeline.style.display = visible ? '' : 'none';
}

function renderMatrixNavigation() {
    const container = document.getElementById('matrix-tabs');
    if (!container) return;
    container.innerHTML = '';

    MATRIX_FLEET_TYPES.forEach(tipo => {
        const link = document.createElement('a');
        link.dataset.hash = getMatrixHash(tipo);
        link.href = getMatrixHash(tipo);
        link.textContent = `Matriz ${getFleetLabel(tipo)}`;
        container.appendChild(link);
    });
}

function attachMatrixNavigation() {
    document.querySelectorAll('.matrix-tab').forEach(button => {
        button.addEventListener('click', () => {
            window.location.hash = button.dataset.hash;
        });
    });
}

function attachYearSelector() {
    const yearSelector = document.getElementById('matrix-year-selector');
    if (!yearSelector) return;

    yearSelector.querySelectorAll('.year-btn').forEach(button => {
        button.addEventListener('click', async () => {
            // nome proprio: `selectedYear` (modulo) controla os blocos de frota,
            // `currentMatrixYear` controla a matriz. Sao independentes.
            const ano = parseInt(button.dataset.year);
            if (ano === currentMatrixYear) return;

            currentMatrixYear = ano;
            updateYearButtons(ano);
            
            const hash = window.location.hash || DEFAULT_MATRIX_HASH;
            const color = getMatrixColorFromHash(hash) || 'yellow';
            await renderMatrixView(color);
        });
    });
    
    updateYearButtons(currentMatrixYear);
}

function updateYearButtons(activeYear) {
    // BUGFIX: o seletor era global ('.year-btn'), entao alternar o ano da matriz
    // tambem repintava os botoes dos blocos de frota - que sao controlados por
    // `selectedYear`, uma variavel diferente. O botao marcava 2024 enquanto os
    // graficos ainda mostravam 2022. Agora fica restrito ao seletor da matriz.
    document.querySelectorAll('#matrix-year-selector .year-btn').forEach(button => {
        const btnYear = parseInt(button.dataset.year);
        button.classList.toggle('active', btnYear === activeYear);
    });
}

function showYearSelector(visible) {
    const selector = document.getElementById('matrix-year-selector');
    if (selector) selector.style.display = visible ? 'flex' : 'none';
}

async function renderMatrixView(color) {
    const taxiColor = color === 'green' ? 'green' : 'yellow';

    clearChart('#adjacency-matrix');

    // BUGFIX: a versao anterior consultava a tabela `taxi_${cor}_${ano}`, que o
    // loadTaxiForYear() nunca criava (ele sempre cria `taxi_trips`). A query
    // estourava, caia no catch e o fallback nao filtrava por tipo_taxi, entao
    // as matrizes Amarela e Verde renderizavam exatamente os mesmos dados.
    const adjData = cacheDadosMatriz.filter(
        d => d.tipo_taxi === taxiColor && d.ano === currentMatrixYear
    );

    if (adjData.length === 0) {
        console.warn(`Sem dados de matriz para ${taxiColor} em ${currentMatrixYear}.`);
        return;
    }

    const title = `Matriz de Adjacência - Frota ${getFleetLabel(taxiColor)} (${currentMatrixYear})`;
    await loadAdjacencyMatrix(adjData, taxiColor, '#adjacency-matrix', { left: 70, right: 30, top: 45, bottom: 90 }, title);
}

async function handleHashChange() {
    let hash = window.location.hash || DEFAULT_MATRIX_HASH;
    if (!hash || (!isMatrixHash(hash) && !isFleetHash(hash))) {
        window.history.replaceState(null, '', DEFAULT_MATRIX_HASH);
        hash = DEFAULT_MATRIX_HASH;
    }

    if (isMatrixHash(hash)) {
        const color = getMatrixColorFromHash(hash) || 'yellow';
        setOverviewVisible(true);
        setTimelineVisible(false);
        showYearSelector(true);
        updateMatrixButtons(color);
        updateYearButtons(currentMatrixYear);
        await renderMatrixView(color);
    } else {
        setOverviewVisible(false);
        setTimelineVisible(true);
        showYearSelector(false);
    }
}

function setupRouting() {
    renderMatrixNavigation();
    attachMatrixNavigation();
    attachYearSelector();
    window.addEventListener('hashchange', () => handleHashChange());
    handleHashChange();
}

const DataProcessor = {
    getUniqueFrotas(data) {
        return [...new Set(data.map(d => d.tipo_taxi))].sort();
    },
};

function orchestratePlots(dataScatter) {
    if (!cacheDadosHeatmap.length) return;

    const frotas = DataProcessor.getUniqueFrotas(cacheDadosHeatmap);
    UIManager.renderSkeleton(frotas);

    // Filtragem dos dados baseada no estado global do ano selecionado
    const heatmapFiltrado = cacheDadosHeatmap.filter(d => d.ano === selectedYear);
    const serieFiltrada = cacheDadosSerie.filter(d => d.data.getFullYear() === selectedYear);

    // Agregação por Quadrimestre (Consolida 4 meses em cada bloco)
    const dadosQuadrimestrais = d3.rollups(
        heatmapFiltrado,
        v => d3.sum(v, d => d.volume),
        d => d.tipo_taxi,
        d => Math.floor((d.mes - 1) / 4) + 1, // Calcula o Quadrimestre (1 a 3)
        d => d.dia_semana,
        d => d.hora
    ).flatMap(([tipo, periods]) => 
        periods.flatMap(([q, dias]) => 
            dias.flatMap(([dia, horas]) => 
                horas.map(([hora, volume]) => ({ tipo_taxi: tipo, quarter: q, dia_semana: dia, hora, volume }))
            )
        )
    );

    // Otimização: Escala global de volume para o ano atual
    const globalMaxVolume = d3.max(dadosQuadrimestrais, d => d.volume) || 1;

    const groupedData = d3.group(dadosQuadrimestrais, d => d.tipo_taxi, d => d.quarter);

    frotas.forEach(tipo => {
        const scatterData = (dataScatter || []).filter(d => d.tipo_taxi === tipo && Number(d.ano) === selectedYear);
        loadChart(scatterData, `#scatter-${tipo}`);
        const serieDaFrota = serieFiltrada.filter(d => d.tipo_taxi === tipo);
        loadTimeSeries(serieDaFrota, `#series-${tipo}`);

        const dataByQ = groupedData.get(tipo);
        for (let q = 1; q <= 3; q++) {
            const dadosQ = dataByQ ? dataByQ.get(q) || [] : [];
            loadHeatmap(dadosQ, `#heatmap-${tipo}-q${q}`, { left: 40, right: 45, top: 20, bottom: 90 }, globalMaxVolume);
        }
    });
}

window.onload = async () => {
    setupSidebar();

    // Antes: init do DuckDB-Wasm + loadTaxi() baixava ~134 MB de Parquet
    // (jan/2022, jan/2023, jan/2024 das duas frotas) e travava a main thread
    // antes de desenhar qualquer coisa. No Pages a pagina nunca chegava a
    // ficar idle. Agora sao ~4 CSVs agregados, na casa dos KB.
    await fetchCSVData();
    globalScatterData = cacheDadosScatter;

    await renderOverview();
    orchestratePlots(globalScatterData);
    setupRouting();
    renderFooter();
};

/**
 * Renderiza as informações institucionais e referências
 */
function renderFooter() {
    const mainContainer = document.querySelector('.main-container');
    if (!mainContainer || document.getElementById('inst-footer')) return;

    const footer = document.createElement('footer');
    footer.id = 'inst-footer';
    footer.className = 'dashboard-footer';
    footer.innerHTML = `
        <div class="footer-info">
            <div class="footer-column">
                <h4>Instituição</h4>
                <p>Universidade Federal Fluminense (UFF)<br>
                Instituto de Computação<br>
                Disciplina: Visualização de Dados 2026.1</p>
            </div>
            <div class="footer-column">
                <h4>Desenvolvedores</h4>
                <p>Danilo Silva<br>
                Samuel Bello</p>
            </div>
            <div class="footer-column">
                <h4>Referências e Fontes</h4>
                <p>
                    <strong>Dataset:</strong> <a href="https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page" target="_blank">NYC TLC Trip Record Data</a><br>
                    <strong>Artigo Base:</strong> <a href="https://ieeexplore.ieee.org/document/6634127/" target="_blank">TaxiVis: A Visual Analytics System</a><br>
                    <strong>Repositório:</strong> <a href="https://github.com/SamuelBelloSB/taxiVisTrab.git" target="_blank">GitHub Project</a>
                </p>
            </div>
        </div>
        <div style="text-align: center; font-size: 0.9em; color: #f7f3f0; margin-top: 25px; font-weight: 600; opacity: 0.9; border-top: 1px solid #5b6346; padding-top: 15px;">
            Trabalho acadêmico desenvolvido para fins de estudo e análise de fluxos urbanos.
        </div>
    `;
    mainContainer.appendChild(footer);
}

async function fetchCsv(nome) {
    const res = await fetch(`${DATA_BASE}/${nome}`);
    if (!res.ok) throw new Error(`HTTP ${res.status} ao buscar ${nome}`);
    return d3.csvParse(await res.text());
}

async function fetchCSVData() {
    try {
        const dadosRaw = await fetchCsv('hourly_pattern.csv');
        cacheDadosHeatmap = dadosRaw.map(d => {
            return {
                ano: Number(cleanStr(d.ano)),
                mes: Number(cleanStr(d.mes)),
                tipo_taxi: cleanStr(d.tipo_taxi).toLowerCase(),
                hora: Number(cleanStr(d.hora)),
                volume: Number(cleanStr(d.volume)),
                dia_semana: cleanStr(d.dia_semana).toLowerCase()
            };
        }).filter(d => d.ano >= 2022 && d.ano <= 2024);

        cacheDadosSerie = (await fetchCsv('daily_timeseries.csv')).map(s => {
            return {
                data: d3.timeParse("%Y-%m-%d")(cleanStr(s.data)),
                ano: Number(cleanStr(s.ano)),
                tipo_taxi: cleanStr(s.tipo_taxi).toLowerCase(),
                volume: Number(cleanStr(s.volume)),
                faturamento_total: Number(cleanStr(s.faturamento_total)),
                distancia_media: Number(cleanStr(s.distancia_media))
            };
        }).filter(s => s.data !== null && s.ano >= 2022 && s.ano <= 2024);

        cacheDadosScatter = (await fetchCsv('scatter_sample.csv')).map(d => ({
            trip_distance: Number(cleanStr(d.trip_distance)),
            tip_amount: Number(cleanStr(d.tip_amount)),
            tipo_taxi: cleanStr(d.tipo_taxi).toLowerCase(),
            ano: Number(cleanStr(d.ano))
        }));

        cacheDadosMatriz = (await fetchCsv('adjacency_matrix.csv')).map(d => ({
            pu: Number(cleanStr(d.pu)),
            do_loc: Number(cleanStr(d.do_loc)),
            tipo_taxi: cleanStr(d.tipo_taxi).toLowerCase(),
            ano: Number(cleanStr(d.ano)),
            volume: Number(cleanStr(d.volume)),
            avg_speed: cleanStr(d.avg_speed) === '' ? null : Number(cleanStr(d.avg_speed))
        }));

        // Debug para verificar se os dados verdes existem no dataset carregado
        const checkFrotas = d3.rollup(cacheDadosSerie, v => d3.sum(v, d => d.volume), d => d.tipo_taxi);
        console.log("Registros por frota carregados:", checkFrotas);
        
    } catch (e) {
        console.error("Erro CSV:", e);
    }
}

function setupSidebar() {
    const btnToggle = document.getElementById('toggle-sidebar');
    if (btnToggle) {
        btnToggle.onclick = () => {
            document.body.classList.toggle('sidebar-minimized');
        };
    }
}

async function updateGlobalYear(year) {
    if (selectedYear === year) return;
    document.body.style.cursor = 'wait'; // Feedback visual de processamento
    selectedYear = year;
    // Aguarda um pequeno frame para o cursor atualizar antes de travar a thread
    await new Promise(r => setTimeout(r, 10));
    orchestratePlots(globalScatterData);
    document.body.style.cursor = 'default';
}
