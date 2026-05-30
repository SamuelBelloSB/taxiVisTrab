import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROCESSED_DIR = path.join(__dirname, '../00 - data/processed');
const HEATMAP_PATH = path.join(PROCESSED_DIR, 'hourly_pattern.csv');
const TIMESERIES_PATH = path.join(PROCESSED_DIR, 'daily_timeseries.csv');

console.log('--- Iniciando validacao dos dados pre-processados ---\n');

function verificarArquivo(filePath, nome) {
    if (!fs.existsSync(filePath)) {
        console.error(`ERRO: Arquivo ${nome} nao foi encontrado em: ${filePath}`);
        return false;
    }

    const conteudo = fs.readFileSync(filePath, 'utf-8').trim().split('\n');
    const totalLinhas = conteudo.length - 1;

    if (totalLinhas <= 0) {
        console.error(`ERRO: O arquivo ${nome} esta vazio.`);
        return false;
    }

    console.log(`[OK] ${nome}: Encontrado.`);
    console.log(`     Total de registros: ${totalLinhas}`);
    console.log(`     Cabecalho: ${conteudo[0]}`);
    console.log(`     Amostra L1: ${conteudo[1]}`);

    const colunasPrimeiraLinha = conteudo[1].split(',');
    if (colunasPrimeiraLinha.some(coluna => coluna === '' || coluna === 'null' || coluna === 'NaN')) {
        console.warn(`AVISO: Detectados valores nulos ou invalidos na primeira linha de ${nome}.`);
    }

    return true;
}

const heatmapValido = verificarArquivo(HEATMAP_PATH, 'hourly_pattern.csv');
console.log(''); 
const timeseriesValida = verificarArquivo(TIMESERIES_PATH, 'daily_timeseries.csv');

if (heatmapValido && timeseriesValida) {
    console.log('\nValidacao concluida: Ambos os arquivos estao estruturalmente corretos.');
} else {
    console.error('\nValidacao falhou: Inconsistencias encontradas nos arquivos gerados.');
}