import { Taxi } from "./taxi.js";
import { loadChart, loadHeatmap, loadRidgePlot, loadTimeSeries, loadDonut, loadComparisonSeries } from './plot.js';
import * as d3 from 'd3';

let cacheDadosHeatmap = [];
let cacheDadosSerie = [];
let globalScatterData = [];
let selectedYear = 2022; // Padrão conforme solicitado

/**
 * Helper para limpar aspas e espaços de strings vindas do CSV
 * essencial para evitar quebra de seletores CSS e erros de comparação
 */
const cleanStr = (str) => (str || "").replace(/["']/g, "").trim();

const nomesMeses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

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
                <div class="year-header">Análise de Frota: Táxi ${tipo.toUpperCase()}</div>
                
                <div class="year-selector-container" data-tipo="${tipo}">
                    <button class="year-btn ${selectedYear === 2022 ? 'active' : ''}" data-year="2022">2022</button>
                    <button class="year-btn ${selectedYear === 2023 ? 'active' : ''}" data-year="2023">2023</button>
                    <button class="year-btn ${selectedYear === 2024 ? 'active' : ''}" data-year="2024">2024</button>
                </div>

                <div class="charts-grid">
                    <div class="chart-box"><h3>Distância vs Gorjeta</h3><svg id="scatter-${tipo}"></svg></div>
                    <div class="chart-box"><h3>Série Histórica Consolidada</h3><svg id="series-${tipo}"></svg></div>
                </div>
                <div class="monthly-grid" id="grid-${tipo}"></div>
            `;
            container.appendChild(section);

            // Event listeners para os botões de ano
            section.querySelectorAll('.year-btn').forEach(btn => {
                btn.onclick = (e) => updateGlobalYear(parseInt(e.target.dataset.year));
            });

            // Cria os slots para os 12 heatmaps mensais
            const grid = document.getElementById(`grid-${tipo}`);
            for (let m = 1; m <= 12; m++) {
                const box = document.createElement('div');
                box.className = 'chart-box small';
                box.innerHTML = `<h5>${nomesMeses[m-1]}</h5><svg id="heatmap-${tipo}-${m}"></svg>`;
                grid.appendChild(box);
            }
        });
    }
};

/**
 * Overview Manager: Renderiza os gráficos de resumo no topo
 */
function renderOverview() {
    const container = document.getElementById('overview-container');
    container.innerHTML = `
        <h2>Visão Geral do Mercado (Market Share & Eficiência)</h2>
        <div class="overview-grid">
            <div class="chart-box"><h3>Faturamento 2022</h3><svg id="donut-2022"></svg></div>
            <div class="chart-box"><h3>Faturamento 2023</h3><svg id="donut-2023"></svg></div>
            <div class="chart-box"><h3>Faturamento 2024</h3><svg id="donut-2024"></svg></div>
        </div>
        <div class="chart-box" style="margin-top:15px; height:300px;">
            <h3>Tendência Comparativa: Volume de Viagens Mensais (Yellow vs Green)</h3>
            <svg id="comparison-series"></svg>
        </div>
    `;

    const anos = [2022, 2023, 2024];
    anos.forEach(ano => {
        const dataAno = cacheDadosSerie.filter(d => d.ano === ano);
        const faturamento = d3.rollup(dataAno, v => d3.sum(v, d => d.faturamento_total), d => d.tipo_taxi);
        const donutData = Array.from(faturamento, ([key, value]) => ({ key, value }));
        loadDonut(donutData, `#donut-${ano}`, ano.toString());
    });

    // Agregação mensal consolidada para o gráfico de tendência comparativa
    if (cacheDadosSerie.length > 0) {
        const dadosMensais = d3.rollups(
            cacheDadosSerie,
            v => d3.sum(v, d => d.volume),
            d => d.tipo_taxi,
            d => d3.timeMonth(d.data)
        ).flatMap(([tipo, meses]) => 
            meses.map(([mes, volume]) => ({ tipo_taxi: tipo, data: mes, volume }))
        );
        loadComparisonSeries(dadosMensais, '#comparison-series');
    }
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

    // Otimização: Escala global de volume para o ano atual
    const globalMaxVolume = d3.max(heatmapFiltrado, d => d.volume) || 1;

    // Agrupamento eficiente para evitar múltiplos .filter()
    const groupedData = d3.group(heatmapFiltrado, d => d.tipo_taxi, d => d.mes);

    frotas.forEach(tipo => {
        const scatterData = (dataScatter || []).filter(d => d.tipo_taxi === tipo && Number(d.ano) === selectedYear);
        loadChart(scatterData, `#scatter-${tipo}`);
        loadTimeSeries(serieFiltrada, `#series-${tipo}`);

        const dataByMonth = groupedData.get(tipo);
        for (let m = 1; m <= 12; m++) {
            const dadosMes = dataByMonth ? dataByMonth.get(m) || [] : [];
            if (dadosMes.length > 0) {
                // Passamos o globalMaxVolume para manter a consistência visual
                loadHeatmap(dadosMes, `#heatmap-${tipo}-${m}`, { left: 40, right: 10, top: 20, bottom: 30 }, globalMaxVolume);
            }
        }
    });
}

window.onload = async () => {
    const taxi = new Taxi();
    await taxi.init();
    
    setupSidebar();

    globalScatterData = await fetchScatterData(taxi);
    await fetchCSVData();
    
    renderOverview();
    orchestratePlots(globalScatterData);
};

async function fetchScatterData(taxiInstance) {
    let dataScatter = [];
    try {
        // Intervalo 2022-2024 para dispersão
        await taxiInstance.loadTaxi([2022, 2023, 2024]);
        
        const sqlScatter = `
            SELECT * FROM (
                SELECT trip_distance, tip_amount, tipo_taxi, 
                       CAST(EXTRACT(year FROM pickup_datetime) AS INTEGER) as ano,
                       row_number() OVER(PARTITION BY tipo_taxi, EXTRACT(year FROM pickup_datetime)) as rn
                FROM taxi_trips
                WHERE trip_distance > 0.5 -- Focar em viagens com movimento relevante
                AND tip_amount > 0         -- Remover gorjetas não registradas/zero para limpar a "mancha"
                AND EXTRACT(year FROM pickup_datetime) BETWEEN 2022 AND 2024
            ) WHERE rn <= 300
        `;
        dataScatter = await taxiInstance.query(sqlScatter);
    } catch (e) {
        console.error("Erro DuckDB:", e);
    }
    return dataScatter;
}

async function fetchCSVData() {
    try {
        const resHeatmap = await fetch('/processed/hourly_pattern.csv');
        const textHeatmap = await resHeatmap.text();
        const dadosRaw = d3.csvParse(textHeatmap);
        cacheDadosHeatmap = dadosRaw.map(d => {
            return {
                ano: Number(cleanStr(d.ano)),
                mes: Number(cleanStr(d.mes)),
                tipo_taxi: cleanStr(d.tipo_taxi).toLowerCase() || 'yellow',
                hora: Number(cleanStr(d.hora)),
                volume: Number(cleanStr(d.volume)),
                dia_semana: cleanStr(d.dia_semana).toLowerCase()
            };
        });

        const resSerie = await fetch('/processed/daily_timeseries.csv');
        const textSerie = await resSerie.text();
        cacheDadosSerie = d3.csvParse(textSerie).map(s => {
            return {
                data: d3.timeParse("%Y-%m-%d")(cleanStr(s.data)),
                ano: Number(cleanStr(s.ano)),
                tipo_taxi: cleanStr(s.tipo_taxi).toLowerCase() || 'yellow',
                volume: Number(cleanStr(s.volume)),
                faturamento_total: Number(cleanStr(s.faturamento_total)),
                distancia_media: Number(cleanStr(s.distancia_media))
            };
        }).filter(s => s.data !== null);
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

function updateGlobalYear(year) {
    selectedYear = year;
    orchestratePlots(globalScatterData);
}