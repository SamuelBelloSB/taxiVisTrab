import * as duckdb from "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/+esm";

export async function loadDb() {
  // Pega os links oficiais direto do CDN automaticamente (sem precisar de arquivos locais)
  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
  
  // O DuckDB escolhe o melhor pacote para o navegador do usuário
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

  // Instancia a versão assíncrona do DuckDB-wasm
  const worker = new Worker(bundle.mainWorker);
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);
  
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

  return db;
}