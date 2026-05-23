import { Taxi } from "./taxi";
import { loadChart, clearChart } from './plot';

function callbacks(data) {
    const loadBtn  = document.querySelector('#loadBtn');
    const clearBtn = document.querySelector('#clearBtn');

    if (!loadBtn || !clearBtn) {
        return;
    }

    loadBtn.addEventListener('click', async () => {
        clearChart();
        await loadChart(data);
    });

    clearBtn.addEventListener('click', async () => {
        clearChart();
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

    // 3. Query normalizadora: junta os dois datasets garantindo metade de cada cor
    const sql = `
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
    
    // Como a conexão do DuckDB é compartilhada, podemos rodar a query a partir de qualquer instância
    const data = await taxiYellow.query(sql);
    console.log("Dados normalizados carregados:", data);

    callbacks(data);
};