
import { loadDb } from './config.js';

export class Taxi {
    async init() {
        this.db = await loadDb();
        this.conn = await this.db.connect();

        this.color = "green";
        this.table = 'taxi_trips';
    }

    async loadTaxi(years = [2022, 2023, 2024], monthsPerYear = 1) { 
        if (!this.db || !this.conn)
            throw new Error('Database not initialized. Please call init() first.');

        const files = [];
        const cores = ['green', 'yellow'];

        // Registra os buffers de arquivos individualmente
        for (const year of years) {
            for (const cor of cores) {
                for (let id = 1; id <= monthsPerYear; id++) {
                    const sId = String(id).padStart(2, '0');
                    const key = `Y${year}M${sId}_${cor}`;
                    const url = `/${cor}/${cor}_tripdata_${year}-${sId}.parquet`; // URL absoluta para o Vite

                    try {
                        const res = await fetch(url, { method: 'HEAD' }); // Verifica existência primeiro
                        if (!res.ok) throw new Error();
                        const dataRes = await fetch(url);
                        const buffer = await dataRes.arrayBuffer();
                        await this.db.registerFileBuffer(key, new Uint8Array(buffer));
                        files.push({ key, cor });
                    } catch (e) {
                        console.warn(`Não foi possível carregar: ${url}`);
                    }
                }
            }
        }

        await this.conn.query(`DROP TABLE IF EXISTS ${this.table}`);

        if (files.length === 0) {
            console.warn("Nenhum arquivo Parquet foi encontrado localmente.");
            // Cria tabela vazia para evitar erros de 'tabela não encontrada' em queries futuras
            await this.conn.query(`CREATE TABLE ${this.table} (pickup_datetime TIMESTAMP, trip_distance DOUBLE, tip_amount DOUBLE, tipo_taxi VARCHAR)`);
            return;
        }

        // Cada cor busca sua coluna nativa de data para não gerar Binder Error
        const selectQueries = files.map(f => {
            const dataColuna = f.cor === 'green' ? 'lpep_pickup_datetime' : 'tpep_pickup_datetime';
            return `
                SELECT 
                    ${dataColuna}::TIMESTAMP as pickup_datetime,
                    trip_distance::DOUBLE as trip_distance,
                    tip_amount::DOUBLE as tip_amount,
                    '${f.cor}' as tipo_taxi
                FROM read_parquet('${f.key}')
                WHERE trip_distance > 0.1 
                  AND fare_amount >= 2.50
                  AND tip_amount IS NOT NULL
            `;
        }).join(' UNION ALL ');

        await this.conn.query(`
            CREATE TABLE ${this.table} AS 
            ${selectQueries}
        `);
    }

    async query(sql) {
        if (!this.db || !this.conn)
            throw new Error('Database not initialized. Please call init() first.');

        let result = await this.conn.query(sql);
        return result.toArray().map(row => row.toJSON());
    }

    async test(limit = 10) {
        if (!this.db || !this.conn)
            throw new Error('Database not initialized. Please call init() first.');

        const sql = `
                SELECT * 
                FROM ${this.table}
                LIMIT ${limit}
            `;

        return await this.query(sql);
    }
}