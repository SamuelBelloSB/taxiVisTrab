import { Taxi } from "./taxi.js";
import { loadChart, clearChart, loadHeatmap } from './plot.js'; 

let escolhasHeatmap = { green: true, yellow: true };

function callbacks(taxi, dataScatter) {
    const loadBtn = document.querySelector('#loadBtn');
    const clearBtn = document.querySelector('#clearBtn');
    const btnGreen = document.querySelector('#btnFiltroGreen');
    const btnYellow = document.querySelector('#btnFiltroYellow');

    if (!loadBtn || !clearBtn || !btnGreen || !btnYellow) return;

    loadBtn.addEventListener('click', async () => {
        clearChart();
        await loadChart(dataScatter);
    });

    clearBtn.addEventListener('click', () => clearChart());

    // Recalcula e filtra os dados dinamicamente no DuckDB
    async function recalcularHeatmap() {
        if (!escolhasHeatmap.green && !escolhasHeatmap.yellow) {
            loadHeatmap([], escolhasHeatmap);
            return;
        }

        let condicoes = [];
        if (escolhasHeatmap.green) condicoes.push("'green'");
        if (escolhasHeatmap.yellow) condicoes.push("'yellow'");

        const sql = `
            SELECT
                dayofweek(pickup_datetime) as dia_semana,
                hour(pickup_datetime) as hora_dia,
                CAST(COUNT(*) AS INTEGER) as total_corridas
            FROM taxi_2023
            WHERE tipo_taxi IN (${condicoes.join(',')})
            GROUP BY dia_semana, hora_dia
            ORDER BY dia_semana, hora_dia
        `;
        const dados = await taxi.query(sql);
        loadHeatmap(dados, escolhasHeatmap);
    }

    btnGreen.addEventListener('click', async () => {
        const ativo = btnGreen.getAttribute('data-active') === 'true';
        escolhasHeatmap.green = !ativo;
        btnGreen.setAttribute('data-active', !ativo);
        btnGreen.textContent = !ativo ? "Táxi Verde: LIGADO" : "Táxi Verde: DESLIGADO";
        await recalcularHeatmap();
    });

    btnYellow.addEventListener('click', async () => {
        const ativo = btnYellow.getAttribute('data-active') === 'true';
        escolhasHeatmap.yellow = !ativo;
        btnYellow.setAttribute('data-active', !ativo);
        btnYellow.textContent = !ativo ? "Táxi Amarelo: LIGADO" : "Táxi Amarelo: DESLIGADO";
        await recalcularHeatmap();
    });
}

window.onload = async () => {
    const taxi = new Taxi();
    await taxi.init();
    await taxi.loadTaxi();

    // Captura uma amostra limpa contendo dados de ambas as frotas para o Scatter Plot
    const sqlScatter = `
        (SELECT trip_distance, tip_amount, tipo_taxi FROM taxi_2023 WHERE tipo_taxi = 'green' LIMIT 150)
        UNION ALL
        (SELECT trip_distance, tip_amount, tipo_taxi FROM taxi_2023 WHERE tipo_taxi = 'yellow' LIMIT 150)
    `;
    const dataScatter = await taxi.query(sqlScatter);

    // Dados iniciais do Heatmap contendo tudo carregado
    const sqlHeatmapInicial = `
        SELECT
            dayofweek(pickup_datetime) as dia_semana,
            hour(pickup_datetime) as hora_dia,
            CAST(COUNT(*) AS INTEGER) as total_corridas
        FROM taxi_2023
        GROUP BY dia_semana, hora_dia
        ORDER BY dia_semana, hora_dia
    `;
    const dataHeatmapInicial = await taxi.query(sqlHeatmapInicial);
    
    callbacks(taxi, dataScatter);

    // Carregamento inicial limpo dos dois gráficos na tela
    await loadChart(dataScatter);
    loadHeatmap(dataHeatmapInicial, escolhasHeatmap);
};