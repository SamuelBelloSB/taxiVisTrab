
import { loadDb } from './config.js';

export class Taxi {
    async init() {
        this.db = await loadDb();
        this.conn = await this.db.connect();

        this.color = "green";
        this.table = 'taxi_2023';
    }

    async loadTaxi(months = 2) { 
        if (!this.db || !this.conn)
            throw new Error('Database not initialized. Please call init() first.');

        const files = [];
        const cores = ['green', 'yellow'];

        // Registra os buffers de arquivos individualmente
        for (const cor of cores) {
            for (let id = 1; id <= months; id++) {
                const sId = String(id).padStart(2, '0');
                const key = `Y2023M${sId}_${cor}`;
                const url = `${cor}/${cor}_tripdata_2023-${sId}.parquet`;

                try {
                    const res = await fetch(url);
                    if (!res.ok) continue;
                    await this.db.registerFileBuffer(key, new Uint8Array(await res.arrayBuffer()));
                    files.push({ key, cor });
                } catch (e) {
                    console.warn(`Não foi possível carregar: ${url}`);
                }
            }
        }

        await this.conn.query(`DROP TABLE IF EXISTS ${this.table}`);

        // Cada cor busca sua coluna nativa de data para não gerar Binder Error
        const selectQueries = files.map(f => {
            const dataColuna = f.cor === 'green' ? 'lpep_pickup_datetime' : 'tpep_pickup_datetime';
            return `
                SELECT 
                    ${dataColuna} as pickup_datetime,
                    trip_distance,
                    tip_amount,
                    '${f.cor}' as tipo_taxi
                FROM read_parquet(${f.key})
                WHERE trip_distance IS NOT NULL AND tip_amount IS NOT NULL
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