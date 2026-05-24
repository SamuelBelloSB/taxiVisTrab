import { Taxi } from "./taxi";
import { loadChart, loadMacroChart, clearChart } from './plot';

function setActiveView(activeId) {
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.id === activeId);
    });
}

function setupViewButtons(microData, macroData) {
    const microBtn = document.querySelector('#viewMicroBtn');
    const macroBtn = document.querySelector('#viewMacroBtn');
    const clearBtn = document.querySelector('#clearBtn');

    if (!microBtn || !macroBtn || !clearBtn) {
        return;
    }

    microBtn.addEventListener('click', async () => {
        clearChart();
        await loadChart(microData);
        setActiveView('viewMicroBtn');
    });

    macroBtn.addEventListener('click', async () => {
        clearChart();
        await loadMacroChart(macroData);
        setActiveView('viewMacroBtn');
    });

    clearBtn.addEventListener('click', () => {
        clearChart();
        setActiveView(null);
    });
}

window.onload = async () => {
    // 1. Inicializa e carrega os dados dos táxis Amarelos
    const taxiYellow = new Taxi('yellow');
    await taxiYellow.init();
    await taxiYellow.loadTaxi(2); // Carrega 2 meses para ter uma boa amostragem

    // 2. Inicializa e carrega os dados dos táxis Verdes
    const taxiGreen = new Taxi('green');
    await taxiGreen.init();
    await taxiGreen.loadTaxi(2);

    const microSql = `
        (SELECT
            'yellow' AS taxi_color,
            trip_distance,
            tip_amount
        FROM
            taxi_yellow_2023
        WHERE
            trip_distance > 0 AND tip_amount > 0
        LIMIT 150)

        UNION ALL

        (SELECT
            'green' AS taxi_color,
            trip_distance,
            tip_amount
        FROM
            taxi_green_2023
        WHERE
            trip_distance > 0 AND tip_amount > 0
        LIMIT 150)
    `;

    const macroSql = `
        SELECT 'yellow' AS taxi_color, SUM(tip_amount) AS total_tips
        FROM taxi_yellow_2023
        WHERE tip_amount > 0

        UNION ALL

        SELECT 'green' AS taxi_color, SUM(tip_amount) AS total_tips
        FROM taxi_green_2023
        WHERE tip_amount > 0;
    `;

    const microData = await taxiYellow.query(microSql);
    const macroData = await taxiYellow.query(macroSql);
    console.log("Dados micro carregados:", microData);
    console.log("Dados macro carregados:", macroData);

    setupViewButtons(microData, macroData);
    await loadChart(microData);
    setActiveView('viewMicroBtn');
};