import { loadDb } from './config';

export class Taxi {
    // 1. Construtor recebe a cor (amarelo por padrão se nada for passado)
    constructor(color = 'yellow') {
        this.color = color;
        // O nome da tabela agora fica dinâmico, ex: taxi_yellow_2023 ou taxi_green_2023
        this.table = `taxi_${this.color}_2023`; 
    }

    async init() {
        // 2. Singleton estático: reaproveita o banco de dados se outra classe Taxi já o carregou
        if (!Taxi.sharedDb) {
            Taxi.sharedDb = await loadDb();
            Taxi.sharedConn = await Taxi.sharedDb.connect();
        }
        this.db = Taxi.sharedDb;
        this.conn = Taxi.sharedConn;
    }

    async loadTaxi(months = 2) {
        if (!this.db || !this.conn)
            throw new Error('Database not initialized. Please call init() first.');

        const files = [];

        for (let id = 1; id <= months; id++) {
            const sId = String(id).padStart(2, '0')
            // 3. A chave do buffer precisa ter a cor para não sobrescrever os meses (ex: Y2023M01_yellow)
            const fileKey = `Y2023M${sId}_${this.color}`;
            
            files.push({ key: fileKey, url: `${this.color}/${this.color}_tripdata_2023-${sId}.parquet` });

            const res = await fetch(files[files.length - 1].url);
            await this.db.registerFileBuffer(files[files.length - 1].key, new Uint8Array(await res.arrayBuffer()));
        }

        // 4. Adicionei IF NOT EXISTS e aspas simples nas chaves mapeadas para evitar erros de sintaxe no DuckDB
        await this.conn.query(`
            CREATE TABLE IF NOT EXISTS ${this.table} AS
                SELECT * FROM read_parquet([${files.map(d => "'" + d.key + "'").join(",")}]);
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
                SELECT * FROM ${this.table}
                LIMIT ${limit}
            `;

        return await this.query(sql);
    }
}