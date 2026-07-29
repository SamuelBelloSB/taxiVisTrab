import * as duckdb from "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/+esm";

export async function loadDb() {
  // 1. Pega os links oficiais do CDN
  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

  // 2. O TRUQUE DO BLOB (Contorna o bloqueio de segurança CORS)
  // Criamos uma URL temporária local que importa o worker do CDN
  const worker_url = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
  );

  // 3. Instancia o Web Worker usando a URL local
  const worker = new Worker(worker_url);
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);
  
  // 4. Inicia o banco de dados
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  
  // 5. Limpa a URL temporária da memória para otimização
  URL.revokeObjectURL(worker_url);

  return db;
}