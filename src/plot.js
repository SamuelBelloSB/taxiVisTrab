import * as d3 from 'd3';

// Cores suaves escolhidas para os círculos do scatter plot
const coresScatter = {
    green: '#78c97c',   // Verde suave / pastel
    yellow: '#f5f25c'  // Amarelo suave / claro
};

// ==========================================
// GRÁFICO 1: GRÁFICO DE DISPERSÃO (SCATTER PLOT)
// ==========================================
export async function loadChart(data, margens = { left: 50, right: 25, top: 25, bottom: 50 }) {
    const svg = d3.select('#scatter-svg');
    if (!svg.node()) return;

    const larguraTotal = +svg.style("width").split("px")[0] || 600;
    const alturaTotal = +svg.style("height").split("px")[0] || 350;
    const larguraGrafico = larguraTotal - margens.left - margens.right;
    const alturaGrafico = alturaTotal - margens.top - margens.bottom;

    svg.selectAll('*').remove();
    const g = svg.append('g').attr('transform', `translate(${margens.left}, ${margens.top})`);

    if (!data || data.length === 0) return;

    // Definição dos eixos baseados nos limites dos dados reais
    const distExtent = d3.extent(data, d => d.trip_distance);
    const mapX = d3.scaleLinear().domain([0, distExtent[1] || 15]).range([0, larguraGrafico]);

    const tipExtent = d3.extent(data, d => d.tip_amount);
    const mapY = d3.scaleLinear().domain([0, tipExtent[1] || 20]).range([alturaGrafico, 0]);

    // Renderiza eixos horizontais e verticais
    g.append('g').attr('transform', `translate(0, ${alturaGrafico})`).call(d3.axisBottom(mapX));
    g.append('g').call(d3.axisLeft(mapY));

    // Desenha as bolinhas coloridas de acordo com o tipo_taxi de forma explícita
    g.selectAll('.ponto-taxi')
        .data(data)
        .join('circle')
        .attr('class', 'ponto-taxi')
        .attr('cx', d => mapX(d.trip_distance))
        .attr('cy', d => mapY(d.tip_amount))
        .attr('r', 4.5)
        .attr('fill', d => coresScatter[d.tipo_taxi] || '#757575')
        .attr('stroke', '#000000')
        .attr('stroke-width', 0.5)
        .style('opacity', 0.8);
}

export function clearChart() {
    d3.select('#scatter-svg').selectAll('*').remove();
}

// ==========================================
// GRÁFICO 2: HEATMAP (MATRIZ TEMPORAL)
// ==========================================
export function loadHeatmap(data, escolhas = { green: true, yellow: true }, margens = { left: 50, right: 25, top: 40, bottom: 50 }) {
    const svg = d3.select('#heatmap-svg');
    if (!svg.node()) return;

    const larguraTotal = +svg.style("width").split("px")[0] || 600;
    const alturaTotal = +svg.style("height").split("px")[0] || 350;
    const larguraGrafico = larguraTotal - margens.left - margens.right;
    const alturaGrafico = alturaTotal - margens.top - margens.bottom;

    svg.selectAll('*').remove();
    
    // Se nenhum filtro estiver selecionado, o gráfico fica 100% vazio conforme solicitado
    if (!escolhas.green && !escolhas.yellow) return;

    const g = svg.append('g').attr('transform', `translate(${margens.left}, ${margens.top})`);

    svg.append('text')
        .attr('x', larguraTotal / 2).attr('y', 25).attr('text-anchor', 'middle')
        .style('font-family', 'sans-serif').style('font-size', '13px').style('font-weight', 'bold')
        .text('Densidade Temporal: Volume de Corridas na Grade Horária');

    const domX = Array.from({ length: 7 }, (_, i) => BigInt(i));
    const domY = Array.from({ length: 24 }, (_, i) => BigInt(i));
    const rótulosDias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    const mapX = d3.scaleBand().domain(domX).range([0, larguraGrafico]).padding(0.05);
    const mapY = d3.scaleBand().domain(domY).range([0, alturaGrafico]).padding(0.05);

    const maxCorridas = d3.max(data, d => d.total_corridas) || 1;

    // Escalas de cores sóbrias e profissionais do D3 de fácil leitura
    let interpoladorCor;
    if (escolhas.green && escolhas.yellow) {
        interpoladorCor = d3.interpolateBlues;   // Ambos ligados: Escala azul clássica (soma)
    } else if (escolhas.green) {
        interpoladorCor = d3.interpolateGreens;  // Apenas Verde ligado
    } else {
        interpoladorCor = d3.interpolateOranges; // Apenas Amarelo ligado
    }

    const escalaCor = d3.scaleSequential().interpolator(interpoladorCor).domain([0, maxCorridas]);

    g.selectAll('.celula')
        .data(data)
        .join('rect')
        .attr('class', 'celula')
        .attr('x', d => mapX(d.dia_semana))
        .attr('y', d => mapY(d.hora_dia))
        .attr('width', mapX.bandwidth())
        .attr('height', mapY.bandwidth())
        .attr('fill', d => escalaCor(d.total_corridas))
        .attr('rx', 1);

    // Eixos estruturais
    g.append('g').attr('transform', `translate(0, ${alturaGrafico})`)
        .call(d3.axisBottom(mapX).tickFormat(d => rótulosDias[Number(d)])).style('font-family', 'sans-serif');

    g.append('g').call(d3.axisLeft(mapY).tickValues(domY.filter(h => h % 3n === 0n)).tickFormat(d => `${String(d).padStart(2, '0')}h`))
        .style('font-family', 'sans-serif');
}