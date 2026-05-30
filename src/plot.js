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
    // Remove adjacency matrix elements if present
    d3.select('#matrixGroup').remove();
    d3.select('#adjLegend').remove();
    d3.select('#matrixTooltip').remove();
    d3.select('#axisXLabelAdj').remove();
    d3.select('#axisYLabelAdj').remove();
}


export async function loadAdjacencyMatrix(rawData, margens = { left: 100, right: 25, top: 50, bottom: 120 }) {
    clearChart();

    const svg = d3.select('svg');
    if (!svg) return;

    const svgWidth = +svg.style('width').split('px')[0];
    const svgHeight = +svg.style('height').split('px')[0];

    // Preprocess: aggregate by (pu, do) combining fleets, compute weighted avg speed and predominant fleet/trip_type
    const map = new Map();
    let globalMaxVolume = 0;

    for (const r of rawData) {
        const pu = r.pu;
        const do_ = r.do_loc !== undefined ? r.do_loc : r.do;
        const key = `${pu}|${do_}`;
        const volume = Number(r.volume) || 0;
        const avg_speed = r.avg_speed === null || r.avg_speed === undefined ? null : Number(r.avg_speed);
        const taxi_color = r.taxi_color;
        const trip_type = r.trip_type === null || r.trip_type === undefined ? null : r.trip_type;

        if (!map.has(key)) {
            map.set(key, {
                pu, do: do_, totalVolume: 0, speedWeightSum: 0, speedWeightCount: 0,
                fleetCounts: {}, greenTripTypeCounts: {}
            });
        }

        const entry = map.get(key);
        entry.totalVolume += volume;
        if (avg_speed !== null) {
            entry.speedWeightSum += avg_speed * volume;
            entry.speedWeightCount += volume;
        }
        entry.fleetCounts[taxi_color] = (entry.fleetCounts[taxi_color] || 0) + volume;
        if (taxi_color === 'green' && trip_type != null) {
            entry.greenTripTypeCounts[trip_type] = (entry.greenTripTypeCounts[trip_type] || 0) + volume;
        }

        if (entry.totalVolume > globalMaxVolume) globalMaxVolume = entry.totalVolume;
    }

    const aggregated = Array.from(map.values()).map(d => {
        const combinedAvgSpeed = d.speedWeightCount > 0 ? d.speedWeightSum / d.speedWeightCount : null;
        // predominant fleet
        const fleets = Object.entries(d.fleetCounts);
        fleets.sort((a,b) => b[1] - a[1]);
        const predominantFleet = fleets.length ? fleets[0][0] : null;
        // predominant trip type for green
        let predominantTripType = null;
        if (predominantFleet === 'green') {
            const g = Object.entries(d.greenTripTypeCounts || {});
            if (g.length) {
                g.sort((a,b) => b[1] - a[1]);
                predominantTripType = g[0][0];
            }
        }
        return Object.assign({}, d, { avg_speed: combinedAvgSpeed, predominantFleet, predominantTripType });
    });

    // Unique origins and destinations sorted by total volume
    const originTotals = new Map();
    const destTotals = new Map();
    aggregated.forEach(d => {
        originTotals.set(d.pu, (originTotals.get(d.pu) || 0) + d.totalVolume);
        destTotals.set(d.do || d.do_loc, (destTotals.get(d.do || d.do_loc) || 0) + d.totalVolume);
    });

    const origins = Array.from(originTotals.entries()).sort((a,b)=>b[1]-a[1]).map(d=>d[0]);
    const destinations = Array.from(destTotals.entries()).sort((a,b)=>b[1]-a[1]).map(d=>d[0]);

    const matrixGroup = svg.selectAll('#matrixGroup').data([0]).join('g').attr('id','matrixGroup')
        .attr('transform', `translate(${margens.left}, ${margens.top})`);

    const width = svgWidth - margens.left - margens.right;
    const height = svgHeight - margens.top - margens.bottom;

    // increase padding for better spacing between cells
    const xBand = d3.scaleBand().domain(destinations).range([0, width]).padding(0.20);
    const yBand = d3.scaleBand().domain(origins).range([0, height]).padding(0.20);

    // color scale for avg_speed (low -> red (gargalo), high -> green (fluxo rápido))
    const speedValues = aggregated.map(d => d.avg_speed).filter(v => v !== null && !isNaN(v));
    const minSpeed = d3.min(speedValues) || 0;
    const maxSpeed = d3.max(speedValues) || 1;
    const colorScale = d3.scaleSequential(d3.interpolateRdYlGn).domain([minSpeed, maxSpeed]);

    const opacityScale = d3.scaleLinear().domain([0, globalMaxVolume || 1]).range([0.35, 1]);

    // Title
    const title = svg.selectAll('#chartTitle').data([0]);
    title.join('text')
        .attr('id', 'chartTitle')
        .attr('x', svgWidth / 2)
        .attr('y', margens.top / 2)
        .attr('text-anchor', 'middle')
        .attr('font-size', '18px')
        .attr('font-weight', '700')
        .text('Matriz de Adjacência (Origem x Destino) — Top Rotas');

    // Axes labels (category ticks)
    const xAxisGroup = matrixGroup.selectAll('.x-axis').data([0]).join('g').attr('class','x-axis')
        .attr('transform', `translate(0, ${height})`);
    xAxisGroup.call(d3.axisBottom(xBand).tickSize(0));
    xAxisGroup.selectAll('text').attr('transform','rotate(-90)').attr('dx','-0.6em').attr('dy','-0.5em').style('text-anchor','end');

    const yAxisGroup = matrixGroup.selectAll('.y-axis').data([0]).join('g').attr('class','y-axis');
    yAxisGroup.call(d3.axisLeft(yBand).tickSize(0));

    // Axis labels for adjacency matrix
    const xLabelAdj = svg.selectAll('#axisXLabelAdj').data([0]);
    xLabelAdj.join('text')
        .attr('id', 'axisXLabelAdj')
        .attr('x', margens.left + width / 2)
        .attr('y', svgHeight - 20)
        .attr('text-anchor', 'middle')
        .attr('font-size', '13px')
        .text('Destino (DOLocationID)');

    const yLabelAdj = svg.selectAll('#axisYLabelAdj').data([0]);
    yLabelAdj.join('text')
        .attr('id', 'axisYLabelAdj')
        .attr('x', 12)
        .attr('y', margens.top + height / 2)
        .attr('transform', `rotate(-90, 12, ${margens.top + height / 3})`)
        .attr('text-anchor', 'middle')
        .attr('font-size', '13px')
        .text('Origem (PULocationID)');

    // Tooltip
    let tooltip = d3.select('#matrixTooltip');
    if (tooltip.empty()) {
        tooltip = d3.select('body').append('div').attr('id','matrixTooltip')
            .style('position','absolute')
            .style('pointer-events','none')
            .style('background','rgba(0,0,0,0.8)')
            .style('color','#fff')
            .style('padding','8px')
            .style('border-radius','4px')
            .style('font-size','12px')
            .style('display','none');
    }

    // Draw cells
    const cells = matrixGroup.selectAll('.cell').data(aggregated, d => `${d.pu}|${d.do || d.do_loc}`);
    const cellsEnter = cells.enter().append('rect').attr('class','cell');

    cellsEnter.merge(cells)
        .attr('x', d => xBand(d.do || d.do_loc))
        .attr('y', d => yBand(d.pu))
        .attr('width', xBand.bandwidth())
        .attr('height', yBand.bandwidth())
        .attr('fill', d => d.avg_speed === null ? '#eee' : colorScale(d.avg_speed))
        .attr('opacity', d => opacityScale(d.totalVolume))
        .attr('stroke', '#444')
        .on('mouseover', function(event, d) {
            const html = `Origem: ${d.pu}<br/>Destino: ${d.do || d.do_loc}<br/>Frota predominante: ${d.predominantFleet || 'N/A'}<br/>Volume: ${d.totalVolume}<br/>Velocidade média: ${d.avg_speed ? d.avg_speed.toFixed(2) + ' mph' : 'N/A'}${d.predominantFleet === 'green' && d.predominantTripType ? '<br/>Trip Type (green): ' + d.predominantTripType : ''}`;
            tooltip.html(html).style('display','block');
            d3.select(this).attr('stroke-width',2);
        })
        .on('mousemove', function(event) {
            tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY + 12) + 'px');
        })
        .on('mouseout', function() {
            tooltip.style('display','none');
            d3.select(this).attr('stroke-width',1);
        });

    cells.exit().remove();

    // Legend for color (speed)
    const legendWidth = 200;
    const legendHeight = 10;
    const legendGroup = svg.selectAll('#adjLegend').data([0]).join('g').attr('id','adjLegend')
        .attr('transform', `translate(${svgWidth - margens.right - legendWidth}, ${margens.top + height + 60})`);

    // create a gradient for legend
    const defs = svg.select('defs').empty() ? svg.append('defs') : svg.select('defs');
    defs.selectAll('#speedGradient').remove();
    const gradient = defs.append('linearGradient').attr('id','speedGradient').attr('x1','0%').attr('x2','100%');
    // sample colors across domain
    const stops = d3.range(0,1.01,0.25);
    stops.forEach((t,i) => {
        gradient.append('stop')
            .attr('offset', `${t*100}%`)
            .attr('stop-color', colorScale(minSpeed + (1 - t) * (maxSpeed - minSpeed)));
    });

    legendGroup.selectAll('*').remove();
    legendGroup.append('rect')
        .attr('width', legendWidth)
        .attr('height', legendHeight)
        .attr('fill','url(#speedGradient)')
        .attr('stroke','#333');

    legendGroup.append('text').attr('x', 0).attr('y', -6).attr('font-size',12).text('Velocidade média (mph)');
    legendGroup.append('text').attr('x', 0).attr('y', legendHeight + 18).attr('font-size',11).text(minSpeed.toFixed(1));
    legendGroup.append('text').attr('x', legendWidth - 30).attr('y', legendHeight + 18).attr('font-size',11).text(maxSpeed.toFixed(1));
}