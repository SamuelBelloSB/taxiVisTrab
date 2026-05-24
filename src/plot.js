import * as d3 from 'd3';

const formatCurrency = d3.format('$,.2f');

export async function loadChart(data, margens = { left: 50, right: 25, top: 25, bottom: 50 }) {
    const svg = d3.select('svg');

    if (!svg) {
        return;
    }

    const svgWidth = +svg.style('width').split('px')[0];
    const svgHeight = +svg.style('height').split('px')[0];

    // ---- Escalas
    const distExtent = d3.extent(data, d => d.trip_distance);
    const mapX = d3.scaleLinear().domain(distExtent).range([0, svgWidth - margens.left - margens.right]);

    const tipExtent = d3.extent(data, d => d.tip_amount);
    const mapY = d3.scaleLinear().domain(tipExtent).range([svgHeight - margens.bottom - margens.top, 0]);

    // ---- Escala de Cores (NOVO)
    // Mapeia a string 'yellow' para a cor amarela e 'green' para verde
    const colorScale = d3.scaleOrdinal()
        .domain(['yellow', 'green'])
        .range(['#F7B731', '#20BF6B']); 

    // ---- Título do gráfico
    const title = svg.selectAll('#chartTitle').data([0]);
    title.join('text')
        .attr('id', 'chartTitle')
        .attr('x', svgWidth / 2)
        .attr('y', margens.top / 2)
        .attr('text-anchor', 'middle')
        .attr('font-size', '18px')
        .attr('font-weight', '700')
        .text('Relação entre Distância da Corrida e Valor da Gorjeta');

    // ---- Eixos
    const xAxis  = d3.axisBottom(mapX);
    const groupX = svg.selectAll('#axisX').data([0]);

    groupX.join('g')
        .attr('id', 'axisX')
        .attr('class', 'x axis')
        .attr('transform', `translate(${margens.left}, ${svgHeight - margens.bottom})`)
        .call(xAxis);

    const yAxis  = d3.axisLeft(mapY);
    const groupY = svg.selectAll('#axisY').data([0]);

    groupY.join('g')
        .attr('id', 'axisY')
        .attr('class', 'y axis')
        .attr('transform', `translate(${margens.left}, ${margens.top})`)
        .call(yAxis);

    const xLabel = svg.selectAll('#axisXLabel').data([0]);
    xLabel.join('text')
        .attr('id', 'axisXLabel')
        .attr('x', svgWidth / 2)
        .attr('y', svgHeight - 10)
        .attr('text-anchor', 'middle')
        .attr('font-size', '14px')
        .text('Eixo X: Distância da corrida (trip_distance)');

    const yLabel = svg.selectAll('#axisYLabel').data([0]);
    yLabel.join('text')
        .attr('id', 'axisYLabel')
        .attr('x', -svgHeight / 2)
        .attr('y', 15)
        .attr('transform', 'rotate(-90)')
        .attr('text-anchor', 'middle')
        .attr('font-size', '14px')
        .text('Eixo Y: Valor da gorjeta (tip_amount)');

    const legend = svg.selectAll('#legend').data([0]);
    const legendGroup = legend.join('g')
        .attr('id', 'legend')
        .attr('transform', `translate(${svgWidth - margens.right - 180}, ${margens.top + 10})`);

    const legendItems = legendGroup.selectAll('.legend-item').data(colorScale.domain());
    const legendEnter = legendItems.join('g')
        .attr('class', 'legend-item')
        .attr('transform', (d, i) => `translate(0, ${i * 22})`);

    legendEnter.selectAll('circle')
        .data(d => [d])
        .join('circle')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', 6)
        .attr('fill', d => colorScale(d));

    legendEnter.selectAll('text')
        .data(d => [d])
        .join('text')
        .attr('x', 14)
        .attr('y', 5)
        .attr('font-size', '13px')
        .text(d => d === 'yellow' ? 'Yellow Taxi (círculo amarelo)' : 'Green Taxi (círculo verde)');


    // ---- Círculos
    const selection = svg.selectAll('#group').data([0]);
    const cGroup = selection.join('g')
            .attr('id', 'group');

    const circles = cGroup.selectAll('circle')
        .data(data);

    
    circles.enter()
        .append('circle')
        .attr('cx', d => mapX(d.trip_distance))
        .attr('cy', d => mapY(d.tip_amount))
        .attr('r', 5) // Aumentado para 5 para melhor visualização
        .attr('opacity', 0.7) // Opacidade para lidar com sobreposição
        .style('fill', d => colorScale(d.taxi_color)) // Aplica a cor baseada no tipo de táxi
        .style('stroke', '#333') // Borda escura suave
        .style('stroke-width', 0.5);

    circles.exit()
        .remove();

    circles
        .attr('cx', d => mapX(d.trip_distance))
        .attr('cy', d => mapY(d.tip_amount))
        .attr('r', 5)
        .attr('opacity', 0.7)
        .style('fill', d => colorScale(d.taxi_color)) // Atualiza a cor se os dados mudarem
        .style('stroke', '#333')
        .style('stroke-width', 0.5);

    d3.select('#group')
        .attr('transform', `translate(${margens.left}, ${margens.top})`);

}

export async function loadMacroChart(data, margens = { left: 50, right: 25, top: 25, bottom: 50 }) {
    const svg = d3.select('svg');

    if (!svg) {
        return;
    }

    const svgWidth = +svg.style('width').split('px')[0];
    const svgHeight = +svg.style('height').split('px')[0];

    const totals = data.map(d => ({
        taxi_color: d.taxi_color,
        total_tips: Number(d.total_tips)
    }));

    const colorScale = d3.scaleOrdinal()
        .domain(['yellow', 'green'])
        .range(['#F7B731', '#20BF6B']);

    const maxTotal = d3.max(totals, d => d.total_tips) || 0;
    const radiusScale = d3.scaleSqrt()
        .domain([0, maxTotal])
        .range([30, 90]);

    const xScale = d3.scalePoint()
        .domain(totals.map(d => d.taxi_color))
        .range([0, svgWidth - margens.left - margens.right])
        .padding(0.5);

    const title = svg.selectAll('#chartTitle').data([0]);
    title.join('text')
        .attr('id', 'chartTitle')
        .attr('x', svgWidth / 2)
        .attr('y', margens.top / 2)
        .attr('text-anchor', 'middle')
        .attr('font-size', '18px')
        .attr('font-weight', '700')
        .text('Comparativo de Gorjetas Totais (Amarelo vs Verde)');

    const group = svg.selectAll('#macroGroup').data([0]);
    const container = group.join('g')
        .attr('id', 'macroGroup')
        .attr('transform', `translate(${margens.left}, ${margens.top + 30})`);

    const items = container.selectAll('.macro-item').data(totals, d => d.taxi_color);
    const itemsEnter = items.enter()
        .append('g')
        .attr('class', 'macro-item');

    itemsEnter.append('circle');
    itemsEnter.append('text').attr('class', 'macro-label');
    itemsEnter.append('text').attr('class', 'macro-value');

    const itemsMerged = itemsEnter.merge(items);

    itemsMerged
        .attr('transform', d => `translate(${xScale(d.taxi_color)}, ${svgHeight / 2 - margens.top - margens.bottom})`);

    itemsMerged.select('circle')
        .attr('r', d => radiusScale(d.total_tips))
        .attr('fill', d => colorScale(d.taxi_color))
        .attr('opacity', 0.8)
        .attr('stroke', '#333')
        .attr('stroke-width', 1);

    itemsMerged.select('.macro-label')
        .attr('x', 0)
        .attr('y', d => -radiusScale(d.total_tips) - 14)
        .attr('text-anchor', 'middle')
        .attr('font-size', '14px')
        .attr('font-weight', '700')
        .text(d => d.taxi_color === 'yellow' ? 'Yellow Taxi' : 'Green Taxi');

    itemsMerged.select('.macro-value')
        .attr('x', 0)
        .attr('y', d => radiusScale(d.total_tips) + 24)
        .attr('text-anchor', 'middle')
        .attr('font-size', '14px')
        .text(d => formatCurrency(d.total_tips));

    items.exit().remove();
}

export function clearChart() {
    d3.select('#group')
        .selectAll('circle')
        .remove();

    d3.select('#axisX')
        .selectAll('*')
        .remove();

    d3.select('#axisY')
        .selectAll('*')
        .remove();

    d3.select('#macroGroup').remove();
    d3.select('#chartTitle').remove();
    d3.select('#axisXLabel').remove();
    d3.select('#axisYLabel').remove();
    d3.select('#legend').remove();
}