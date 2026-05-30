import duckdb from 'duckdb';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../00 - data/local_cache.db');
const PROCESSED_DIR = path.join(__dirname, '../00 - data/processed');
const GREEN_DIR = path.join(__dirname, '../00 - data/green');
const YELLOW_DIR = path.join(__dirname, '../00 - data/yellow');

if (!fs.existsSync(PROCESSED_DIR)) {
    fs.mkdirSync(PROCESSED_DIR, { recursive: true });
}

console.log('Iniciando o pré-processamento de dados...');

function getParquetFiles(dirPath) {
    if (!fs.existsSync(dirPath)) return [];
    return fs.readdirSync(dirPath)
        .filter(f => f.endsWith('.parquet'))
        .map(f => path.join(dirPath, f).replace(/\\/g, '/'));
}

const greenFiles = getParquetFiles(GREEN_DIR);
const yellowFiles = getParquetFiles(YELLOW_DIR);

if (greenFiles.length === 0 && yellowFiles.length === 0) {
    console.error('Nenhum arquivo .parquet encontrado nas pastas green ou yellow.');
    process.exit(1);
}

const db = new duckdb.Database(DB_PATH);
const con = db.connect();

console.time('Tempo total de processamento');

function runQuery(query) {
    return new Promise((resolve, reject) => {
        con.run(query, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

async function main() {
    try {
        console.log(`Mapeando arquivos Parquet (Green: ${greenFiles.length}, Yellow: ${yellowFiles.length})...`);
        
        let unionQueries = [];

        if (yellowFiles.length > 0) {
            const yellowList = yellowFiles.map(f => `'${f}'`).join(', ');
            unionQueries.push(`
                SELECT 
                    tpep_pickup_datetime::TIMESTAMP as pickup_time,
                    'yellow' as tipo_taxi,
                    trip_distance,
                    fare_amount,
                    tip_amount
                FROM read_parquet([${yellowList}])
            `);
        }

        if (greenFiles.length > 0) {
            const greenList = greenFiles.map(f => `'${f}'`).join(', ');
            unionQueries.push(`
                SELECT 
                    lpep_pickup_datetime::TIMESTAMP as pickup_time,
                    'green' as tipo_taxi,
                    trip_distance,
                    fare_amount,
                    tip_amount
                FROM read_parquet([${greenList}])
            `);
        }

        const viewQuery = `
            CREATE OR REPLACE VIEW v_raw_trips AS 
            ${unionQueries.join(' UNION ALL ')}
        `;

        await runQuery(viewQuery);

        console.log('Limpando e filtrando dados temporais...');
        await runQuery(`
            CREATE OR REPLACE TABLE t_cleaned_trips AS
            SELECT 
                pickup_time,
                tipo_taxi,
                EXTRACT(year FROM pickup_time) as ano,
                EXTRACT(month FROM pickup_time) as mes,
                EXTRACT(day FROM pickup_time) as dia,
                strftime(pickup_time, '%A') as dia_semana,
                EXTRACT(hour FROM pickup_time) as hora,
                trip_distance,
                fare_amount,
                (fare_amount + tip_amount) as total_pago
            FROM v_raw_trips
            WHERE pickup_time BETWEEN '2022-01-01' AND '2024-12-31'
              AND fare_amount >= 2.50 -- Bandeirada mínima de NY
              AND trip_distance > 0.1 -- Ignorar viagens de 0 milhas ou erros de GPS
              AND trip_distance < 100 -- Limpar outliers absurdos de distância
              AND fare_amount < 500;  -- Limpar outliers de erro de cobrança
        `);

        console.log('Exportando agregação para o Heatmap Temporal...');
        const heatmapCsv = path.join(PROCESSED_DIR, 'hourly_pattern.csv').replace(/\\/g, '/');
        
        // CORREÇÃO: Trocado LINE_FEED por NEW_LINE para o DuckDB aceitar
        await runQuery(`
            COPY (
                SELECT 
                    ano,
                    mes,
                    tipo_taxi,
                    Lower(Trim(dia_semana)) as dia_semana,
                    hora,
                    COUNT(*) as volume,
                    ROUND(AVG(fare_amount), 2) as tarifa_media,
                    ROUND(AVG(trip_distance), 2) as distancia_media
                FROM t_cleaned_trips
                GROUP BY ano, mes, tipo_taxi, dia_semana, hora
                ORDER BY ano, mes, 
                         CASE Lower(Trim(dia_semana)) 
                            WHEN 'monday' THEN 1 WHEN 'tuesday' THEN 2 WHEN 'wednesday' THEN 3 
                            WHEN 'thursday' THEN 4 WHEN 'friday' THEN 5 WHEN 'saturday' THEN 6 WHEN 'sunday' THEN 7 
                         END, 
                         hora
            ) TO '${heatmapCsv}' WITH (HEADER, DELIMITER ',', FORCE_QUOTE *, NEW_LINE '\n');
        `);

        console.log('Exportando agregação para a Série Temporal...');
        const timeseriesCsv = path.join(PROCESSED_DIR, 'daily_timeseries.csv').replace(/\\/g, '/');
        await runQuery(`
            COPY (
                SELECT 
                    CAST(pickup_time AS DATE) as data,
                    ano,
                    mes,
                    tipo_taxi,
                    Lower(Trim(dia_semana)) as dia_semana,
                    COUNT(*) as volume,
                    ROUND(SUM(fare_amount), 2) as faturamento_total,
                    ROUND(AVG(trip_distance), 2) as distancia_media
                FROM t_cleaned_trips
                GROUP BY CAST(pickup_time AS DATE), ano, mes, tipo_taxi, dia_semana
                ORDER BY data
            ) TO '${timeseriesCsv}' WITH (HEADER, DELIMITER ',', FORCE_QUOTE *, NEW_LINE '\n');
        `);

        console.log('Processamento concluído com sucesso!');
        console.timeEnd('Tempo total de processamento');

    } catch (error) {
        console.error('Erro durante o processamento SQL:', error);
    } finally {
        con.close();
        db.close();
        
        if (fs.existsSync(DB_PATH)) {
            try {
                fs.unlinkSync(DB_PATH);
            } catch (e) {
                // Silencia falhas de IO de arquivo ocupado
            }
        }
    }
}

main();