import { loadDb } from './config.js';

export class Taxi {
    async init() {
        this.db = await loadDb();
        this.conn = await this.db.connect();
        this.table = 'taxi_trips';
    }

    async loadTaxi(years = [2022, 2023, 2024], monthsPerYear = 1) { 
        if (!this.db || !this.conn)
            throw new Error('Database not initialized. Please call init() first.');

        const files = [];
        const cores = ['green', 'yellow'];
        const fetchPromises = [];

        for (const year of years) {
            for (const cor of cores) {
                for (let id = 1; id <= monthsPerYear; id++) {
                    const sId = String(id).padStart(2, '0');
                    const key = `Y${year}M${sId}_${cor}`;
                    const url = `00%20-%20data/${cor}/${cor}_tripdata_${year}-${sId}.parquet`;

                    fetchPromises.push(
                        fetch(url)
                            .then(async (res) => {
                                if (!res.ok) {
                                    console.warn(`Arquivo não encontrado: ${url}`);
                                    return null;
                                }
                                // Verifica se o servidor retornou um HTML (comum em erros de rota no Vite)
                                const ct = res.headers.get('content-type');
                                if (ct && ct.includes('text/html')) {
                                    console.error(`Erro de rota: O servidor retornou HTML em vez de Parquet para: ${url}. Verifique se a pasta "00 - data" existe e se o servidor está configurado para servi-la (Dica: mova para dentro de "public/" se estiver usando Vite).`);
                                    return null;
                                }

                                const buffer = await res.arrayBuffer();
                                const uint8 = new Uint8Array(buffer);
                                // Verifica Magic Bytes "PAR1" (Parquet) nos primeiros 4 bytes
                                if (uint8[0] === 0x50 && uint8[1] === 0x41 && uint8[2] === 0x52 && uint8[3] === 0x31) {
                                    await this.db.registerFileBuffer(key, uint8);
                                    return { key, cor };
                                }
                                console.error(`Arquivo inválido (não é Parquet): ${url}`);
                                return null;
                            })
                            .catch(() => null)
                    );
                }
            }
        }

        const results = await Promise.all(fetchPromises);
        results.forEach(res => {
            if (res) files.push(res);
        });

        if (files.length === 0) {
            console.error("ERRO CRÍTICO: Nenhum arquivo Parquet válido foi carregado.");
            // Garante que a tabela exista (mesmo vazia) para não quebrar o restante do dash
            await this.conn.query(`CREATE TABLE IF NOT EXISTS ${this.table} (pickup_datetime TIMESTAMP, dropoff_datetime TIMESTAMP, trip_distance DOUBLE, tip_amount DOUBLE, tipo_taxi VARCHAR, pu INTEGER, do_loc INTEGER)`);
            return;
        }

        // Drop e Recriação segura
        await this.conn.query(`DROP TABLE IF EXISTS ${this.table}`);

        // Cada cor busca sua coluna nativa de data para não gerar Binder Error
        // Adaptado para carregar PU/DO IDs necessários para a Matriz do Samuel
        const selectQueries = files.map(f => {
            const dataColuna = f.cor === 'green' ? 'lpep_pickup_datetime' : 'tpep_pickup_datetime';
            const dropColuna = f.cor === 'green' ? 'lpep_dropoff_datetime' : 'tpep_dropoff_datetime';
            return `
                SELECT 
                    ${dataColuna}::TIMESTAMP as pickup_datetime,
                    ${dropColuna}::TIMESTAMP as dropoff_datetime,
                    trip_distance::DOUBLE as trip_distance,
                    tip_amount::DOUBLE as tip_amount,
                    '${f.cor}' as tipo_taxi,
                    PULocationID as pu,
                    DOLocationID as do_loc
                FROM read_parquet('${f.key}')
                -- Nota: DuckDB consegue filtrar por colunas (fare_amount) mesmo que não estejam no SELECT
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

    async loadTaxiForYear(year = 2023, monthsPerYear = 1) {
        if (!this.db || !this.conn)
            throw new Error('Database not initialized. Please call init() first.');

        const files = [];
        const cores = ['green', 'yellow'];
        const fetchPromises = [];

        for (const cor of cores) {
            for (let id = 1; id <= monthsPerYear; id++) {
                const sId = String(id).padStart(2, '0');
                const key = `Y${year}M${sId}_${cor}`;
                const url = `00%20-%20data/${cor}/${cor}_tripdata_${year}-${sId}.parquet`;

                fetchPromises.push(
                    fetch(url)
                        .then(async (res) => {
                            if (!res.ok) {
                                console.warn(`Arquivo não encontrado: ${url}`);
                                return null;
                            }
                            const ct = res.headers.get('content-type');
                            if (ct && ct.includes('text/html')) {
                                console.error(`Erro de rota: O servidor retornou HTML em vez de Parquet para: ${url}.`);
                                return null;
                            }
                            const buffer = await res.arrayBuffer();
                            const uint8 = new Uint8Array(buffer);
                            if (uint8[0] === 0x50 && uint8[1] === 0x41 && uint8[2] === 0x52 && uint8[3] === 0x31) {
                                await this.db.registerFileBuffer(key, uint8);
                                return { key, cor, year };
                            }
                            console.error(`Arquivo inválido (não é Parquet): ${url}`);
                            return null;
                        })
                        .catch(() => null)
                );
            }
        }

        const results = await Promise.all(fetchPromises);
        results.forEach(res => {
            if (res) files.push(res);
        });

        if (files.length === 0) {
            console.warn(`Nenhum arquivo Parquet válido foi carregado para o ano ${year}.`);
            return;
        }

        await this.conn.query(`DROP TABLE IF EXISTS ${this.table}`);

        const selectQueries = files.map(f => {
            const dataColuna = f.cor === 'green' ? 'lpep_pickup_datetime' : 'tpep_pickup_datetime';
            const dropColuna = f.cor === 'green' ? 'lpep_dropoff_datetime' : 'tpep_dropoff_datetime';
            return `
                SELECT 
                    ${dataColuna}::TIMESTAMP as pickup_datetime,
                    ${dropColuna}::TIMESTAMP as dropoff_datetime,
                    trip_distance::DOUBLE as trip_distance,
                    tip_amount::DOUBLE as tip_amount,
                    '${f.cor}' as tipo_taxi,
                    PULocationID as pu,
                    DOLocationID as do_loc
                FROM read_parquet('${f.key}')
                WHERE trip_distance > 0.1 
                  AND fare_amount >= 2.50
                  AND tip_amount IS NOT NULL
            `;
        }).join(' UNION ALL ');

        try {
            await this.conn.query(`
                CREATE TABLE ${this.table} AS 
                ${selectQueries}
            `);
            console.log(`Tabela ${this.table} criada com sucesso para o ano ${year}.`);
        } catch (error) {
            console.error(`Erro ao criar tabela para ano ${year}:`, error);
            throw error;
        }
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