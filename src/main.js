import { Taxi } from "./taxi";
import { loadChart, loadMacroChart, clearChart, loadAdjacencyMatrix } from './plot';

function setActiveView(activeId) {
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.id === activeId);
    });
}

function setupViewButtons(microData, macroData, adjData) {
    const microBtn = document.querySelector('#viewMicroBtn');
    const macroBtn = document.querySelector('#viewMacroBtn');
    const adjBtn = document.querySelector('#viewAdjBtn');
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

    if (adjBtn) {
        adjBtn.addEventListener('click', async () => {
            clearChart();
            await loadAdjacencyMatrix(adjData);
            setActiveView('viewAdjBtn');
        });
    }

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

    // Detect column types for each table to construct safe timestamp expressions
    async function getTableInfo(tableName) {
        const res = await taxiYellow.query(`PRAGMA table_info('${tableName}');`);
        // res is array of objects with 'name' and 'type'
        const map = {};
        res.forEach(r => { map[r.name] = (r.type || '').toUpperCase(); });
        return map;
    }

    const yellowSchema = await getTableInfo('taxi_yellow_2023');
    const greenSchema = await getTableInfo('taxi_green_2023');

    function tsExpr(colName, schema) {
        const type = schema[colName] || '';
        // If column exists and is integer-like, treat as epoch ms; otherwise assume timestamp
        if (/INT|BIGINT|LONG/i.test(type)) {
            return `to_timestamp(${colName}/1000)`;
        }
        // If column is DOUBLE/FLOAT, assume seconds epoch
        if (/DOUBLE|FLOAT|REAL/i.test(type)) {
            return `to_timestamp(${colName})`;
        }
        // default: assume timestamp already
        return `${colName}`;
    }

    const yellow_pickup = tsExpr('tpep_pickup_datetime', yellowSchema);
    const yellow_dropoff = tsExpr('tpep_dropoff_datetime', yellowSchema);
    const green_pickup = tsExpr('lpep_pickup_datetime', greenSchema);
    const green_dropoff = tsExpr('lpep_dropoff_datetime', greenSchema);

    const adjacencySql = `
        WITH routes AS (
            SELECT
                PULocationID AS pu,
                DOLocationID AS do_loc,
                'yellow' AS taxi_color,
                CAST(NULL AS INTEGER) AS trip_type,
                COUNT(*) AS volume,
                AVG(CASE WHEN date_diff('second', ${yellow_pickup}, ${yellow_dropoff}) > 0
                    THEN trip_distance / (date_diff('second', ${yellow_pickup}, ${yellow_dropoff})/3600.0)
                    ELSE NULL END) AS avg_speed
            FROM taxi_yellow_2023
            WHERE PULocationID IS NOT NULL AND DOLocationID IS NOT NULL
            GROUP BY PULocationID, DOLocationID

            UNION ALL

            SELECT
                PULocationID AS pu,
                DOLocationID AS do_loc,
                'green' AS taxi_color,
                trip_type,
                COUNT(*) AS volume,
                AVG(CASE WHEN date_diff('second', ${green_pickup}, ${green_dropoff}) > 0
                    THEN trip_distance / (date_diff('second', ${green_pickup}, ${green_dropoff})/3600.0)
                    ELSE NULL END) AS avg_speed
            FROM taxi_green_2023
            WHERE PULocationID IS NOT NULL AND DOLocationID IS NOT NULL
            GROUP BY PULocationID, DOLocationID, trip_type
        )
        , route_totals AS (
            SELECT pu, do_loc, SUM(volume) AS total_volume
            FROM routes
            GROUP BY pu, do_loc
        )
        SELECT r.*
        FROM routes r
        JOIN (
            SELECT pu, do_loc FROM route_totals ORDER BY total_volume DESC LIMIT 40
        ) topr ON r.pu = topr.pu AND r.do_loc = topr.do_loc
        ORDER BY r.pu, r.do_loc, r.taxi_color;
    `;

    const microData = await taxiYellow.query(microSql);
    const macroData = await taxiYellow.query(macroSql);
    const adjData = await taxiYellow.query(adjacencySql);
    console.log("Dados micro carregados:", microData);
    console.log("Dados macro carregados:", macroData);
    console.log("Dados adjacency carregados:", adjData);

    setupViewButtons(microData, macroData, adjData);
    await loadChart(microData);
    setActiveView('viewMicroBtn');
};