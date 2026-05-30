import * as d3 from 'd3';

// Cores mais saturadas e escuras para representar densidade via opacidade
const coresScatter = { green: '#1b4332', yellow: '#78350f' }; // Tons mais profundos para contraste
const domDiasMinuscula = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const rotulosDiasPT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const horasEixo = Array.from({ length: 24 }, function(_, i) { return i; });

export function loadChart(data, selector = '#scatter-svg', margens = { left: 50, right: 25, top: 25, bottom: 50 }) {
    const svg = d3.select(selector);
    if (!svg.node()) return;
    const larguraGrafico = (svg.node().getBoundingClientRect().width || 500) - margens.left - margens.right;
    const alturaGrafico = (svg.node().getBoundingClientRect().height || 280) - margens.top - margens.bottom;

    svg.selectAll('*').remove();
    const g = svg.append('g').attr('transform', 'translate(' + margens.left + ', ' + margens.top + ')');

    // Garante que o domínio seja válido mesmo com dados vazios
    const maxDist = d3.max(data || [], d => d.trip_distance) || 15;
    const maxTip = d3.max(data || [], d => d.tip_amount) || 20;

    // Uso de scaleSqrt para normalizar a distribuição: 
    // "Abre" o detalhamento em valores baixos e comprime os outliers.
    const mapX = d3.scaleSqrt().domain([0, maxDist]).range([0, larguraGrafico]);
    const mapY = d3.scaleSqrt().domain([0, maxTip]).range([alturaGrafico, 0]);

    // Eixo X com Título
    g.append('g')
        .attr('transform', 'translate(0, ' + alturaGrafico + ')')
        .call(d3.axisBottom(mapX).ticks(8).tickFormat(d3.format(".1f")))
        .append('text')
        .attr('x', larguraGrafico)
        .attr('y', 40)
        .attr('fill', '#5b6346')
        .attr('text-anchor', 'end')
        .attr('font-weight', 'bold')
        .text('Distância (milhas)');

    // Eixo Y com Título
    g.append('g')
        .call(d3.axisLeft(mapY).ticks(6).tickFormat(d => `$${d}`))
        .append('text')
        .attr('x', -margens.left + 10)
        .attr('y', -10)
        .attr('fill', '#5b6346')
        .attr('text-anchor', 'start')
        .attr('font-weight', 'bold')
        .text('Gorjeta ($)');

    if (!data || data.length === 0) return;

    g.selectAll('circle').data(data).join('circle')
        .attr('cx', function(d) { return mapX(d.trip_distance); })
        .attr('cy', function(d) { return mapY(d.tip_amount); })
        .attr('r', 3).attr('fill', function(d) { return coresScatter[d.tipo_taxi] || '#757575'; })
        .attr('stroke', '#2a241e').attr('stroke-width', 0.2)
        .style('opacity', 0.5); // Opacidade reduzida para que a sobreposição (overlap) revele a real densidade
}

// 1. GRAFICO DO HEATMAP
export function loadHeatmap(data, selector = '#heatmap-svg', margens = { left: 50, right: 25, top: 40, bottom: 50 }, globalMax) {
    const svg = d3.select(selector);
    if (!svg.node()) return;
    
    // Melhoria de robustez: detecção de tamanho do container
    const rect = svg.node().getBoundingClientRect();
    const larguraGrafico = (rect.width || 300) - margens.left - margens.right;
    const alturaGrafico = (rect.height || 200) - margens.top - margens.bottom;
    const isSmallChart = larguraGrafico < 350; // Threshold ajustado para o grid de 4 colunas

    svg.selectAll('*').remove();
    const g = svg.append('g').attr('transform', 'translate(' + margens.left + ', ' + margens.top + ')');

    const mapX = d3.scaleBand().domain(horasEixo).range([0, larguraGrafico]).padding(0.04);
    const mapY = d3.scaleBand().domain(domDiasMinuscula).range([0, alturaGrafico]).padding(0.04);

    // Se globalMax for fornecido, usamos ele para comparar cores entre diferentes heatmaps
    const maxVal = globalMax || d3.max(data, d => d.volume) || 1;
    const escalaCor = d3.scaleLog().domain([1, Math.max(2, maxVal)]).range([0.15, 1]);

    g.selectAll('.celula').data(data.filter(function(d) { return d.volume > 0; })).join('rect')
        .attr('x', function(d) { return mapX(d.hora); })
        .attr('y', function(d) { return mapY(d.dia_semana); })
        .attr('width', mapX.bandwidth()).attr('height', mapY.bandwidth())
        // YlOrBr: O marrom escuro representará os picos de volume
        .attr('fill', function(d) { return d3.interpolateYlOrBr(escalaCor(d.volume)); }).attr('rx', 2);

    // Eixo X (Horas)
    g.append('g')
        .attr('transform', 'translate(0, ' + alturaGrafico + ')')
        .call(d3.axisBottom(mapX)
            .tickValues(horasEixo.filter(h => isSmallChart ? h % 6 === 0 : h % 3 === 0))
            .tickFormat(d => d + 'h'))

    if (!isSmallChart) {
        g.select(".domain").attr("stroke", "#d4c3a3");
    }

    g.append('g').call(d3.axisLeft(mapY)
        .tickFormat(function(d) {
            // Abreviação agressiva para charts pequenos
            const label = rotulosDiasPT[domDiasMinuscula.indexOf(d)] || d;
            return isSmallChart ? label[0] : label;
        }));
}

// 2. GRAFICO DO RIDGE PLOT
export function loadRidgePlot(data, selector = '#ridge-svg', margens = { left: 50, right: 25, top: 30, bottom: 40 }) {
    const svg = d3.select(selector);
    if (!svg.node()) return;
    const larguraGrafico = (svg.node().getBoundingClientRect().width || 500) - margens.left - margens.right;
    const alturaGrafico = (svg.node().getBoundingClientRect().height || 280) - margens.top - margens.bottom;

    svg.selectAll('*').remove();
    const g = svg.append('g').attr('transform', 'translate(' + margens.left + ', ' + margens.top + ')');

    const mapX = d3.scaleLinear().domain([0, 23]).range([0, larguraGrafico]);
    const mapY = d3.scaleBand().domain(domDiasMinuscula).range([0, alturaGrafico]);

    const maxVolume = d3.max(data, function(d) { return d.volume; }) || 1;
    const escalaAlturaRidge = d3.scaleLinear().domain([0, maxVolume]).range([0, 45]);

    domDiasMinuscula.forEach(function(dia) {
        let dadosDoDia = data.filter(function(d) { return d.dia_semana === dia; });
        dadosDoDia.sort(function(a, b) { return a.hora - b.hora; });

        let linhaEvolucao = d3.line()
            .x(function(d) { return mapX(d.hora); })
            .y(function(d) { 
                let baseDoDia = (mapY(dia) || 0) + mapY.bandwidth() / 1.2;
                return baseDoDia - escalaAlturaRidge(d.volume); 
            });

        g.append('path').datum(dadosDoDia)
            .attr('fill', '#a66e4e').attr('stroke', '#fdfbf7').attr('stroke-width', 1) 
            .attr('style', 'opacity: 0.8').attr('d', linhaEvolucao);
    });

    // Eixo X
    g.append('g')
        .attr('transform', 'translate(0, ' + alturaGrafico + ')')
        .call(d3.axisBottom(mapX).tickFormat(d => d + 'h'))
        .append('text')
        .attr('x', larguraGrafico)
        .attr('y', 35)
        .attr('fill', '#5b6346')
        .attr('text-anchor', 'end')
        .text('Horário');

    g.append('g').call(d3.axisLeft(mapY).tickFormat(function(d) {
        return rotulosDiasPT[domDiasMinuscula.indexOf(d)] || d;
    }));
}

// 3. GRAFICO DA TIME SERIES
export function loadTimeSeries(data, selector = '#series-svg', margens = { left: 60, right: 25, top: 30, bottom: 60 }) {
    const svg = d3.select(selector);
    if (!svg.node() || !data || data.length === 0) return;
    const larguraGrafico = (svg.node().getBoundingClientRect().width || 500) - margens.left - margens.right;
    const alturaGrafico = (svg.node().getBoundingClientRect().height || 280) - margens.top - margens.bottom;

    svg.selectAll('*').remove();
    const g = svg.append('g').attr('transform', 'translate(' + margens.left + ', ' + margens.top + ')');

    const limitesData = d3.extent(data, function(d) { return d.data; });
    const mapX = d3.scaleTime().domain(limitesData).range([0, larguraGrafico]);
    const mapY = d3.scaleLinear().domain([0, d3.max(data, function(d) { return d.volume; }) || 100]).range([alturaGrafico, 0]);

    const geradorLinha = d3.line()
        .x(function(d) { return mapX(d.data); })
        .y(function(d) { return mapY(d.volume); });

    g.append('path').datum(data)
        .attr('fill', 'none').attr('stroke', '#8b5e34').attr('stroke-width', 3).attr('d', geradorLinha); 

    // Eixo X: Abreviação de meses e rotação para evitar colisões
    const eixoX = d3.axisBottom(mapX)
        .ticks(d3.timeMonth.every(1))
        .tickFormat(d3.timeFormat("%b")); // "Jan", "Feb", etc.

    g.append('g')
        .attr('transform', 'translate(0, ' + alturaGrafico + ')')
        .call(eixoX)
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-45)"); // Rotaciona para caber melhor

    // Eixo Y com rótulo de volume
    g.append('g')
        .call(d3.axisLeft(mapY).ticks(6))
        .append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -50)
        .attr('x', -alturaGrafico / 2)
        .attr('fill', '#5b6346')
        .attr('text-anchor', 'middle')
        .attr('font-weight', 'bold')
        .text('Total de Viagens');
}

/**
 * Gráfico de Rosquinha para Market Share
 */
export function loadDonut(data, selector, title) {
    const svg = d3.select(selector);
    if (!svg.node()) return;
    svg.selectAll('*').remove();

    const containerRect = svg.node().getBoundingClientRect();
    const width = containerRect.width || 250;
    const height = 200;
    const radius = Math.min(width, height) / 2 - 20;

    const g = svg.append('g').attr('transform', `translate(${width / 2}, ${height / 2})`);
    
    const pie = d3.pie()
        .value(d => d.value)
        .sort(null);

    const arc = d3.arc()
        .innerRadius(radius * 0.55)
        .outerRadius(radius);

    const labelArc = d3.arc()
        .innerRadius(radius * 0.7)
        .outerRadius(radius * 0.7);

    const total = d3.sum(data, d => d.value);

    const arcs = g.selectAll('.arc')
        .data(pie(data))
        .enter().append('g');

    arcs.append('path')
        .attr('d', arc)
        .attr('fill', d => coresScatter[d.data.key])
        .attr('stroke', '#f7f3f0')
        .attr('stroke-width', 1.5);

    // Adiciona labels de porcentagem/nome se houver espaço
    arcs.filter(d => (d.endAngle - d.startAngle) > 0.3)
        .append('text')
        .attr('transform', d => `translate(${labelArc.centroid(d)})`)
        .attr('class', 'donut-label')
        .attr('text-anchor', 'middle')
        .text(d => {
            const percent = (d.data.value / total * 100).toFixed(0);
            return `${d.data.key.charAt(0).toUpperCase()}: ${percent}%`;
        });

    g.append('text')
        .attr('class', 'donut-center-text')
        .attr('text-anchor', 'middle')
        .attr('dy', '-0.2em')
        .style('font-weight', 'bold')
        .text(title);

    g.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '1.2em')
        .style('font-size', '10px')
        .style('fill', '#8b7d6b')
        .text(`$${(total/1e6).toFixed(1)}M`);
}

/**
 * Gráfico de Séries Comparativas (Multi-Line) para Visão Geral
 * Compara o volume de ambas as frotas simultaneamente
 */
export function loadComparisonSeries(data, selector) {
    const svg = d3.select(selector);
    if (!svg.node()) return;
    svg.selectAll('*').remove();

    const margens = { top: 30, right: 100, bottom: 40, left: 60 };
    const containerRect = svg.node().getBoundingClientRect();
    const width = containerRect.width - margens.left - margens.right;
    const height = (containerRect.height || 250) - margens.top - margens.bottom;

    const g = svg.append('g').attr('transform', `translate(${margens.left},${margens.top})`);

    const mapX = d3.scaleTime()
        .domain(d3.extent(data, d => d.data))
        .range([0, width]);

    const mapY = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.volume) * 1.15 || 100]) // Margem extra para os labels
        .range([height, 0]);

    const line = d3.line()
        .x(d => mapX(d.data))
        .y(d => mapY(d.volume))
        .curve(d3.curveMonotoneX);

    const nested = d3.group(data, d => d.tipo_taxi);

    nested.forEach((values, key) => {
        g.append('path')
            .datum(values.sort((a,b) => a.data - b.data))
            .attr('fill', 'none')
            .attr('stroke', coresScatter[key])
            .attr('stroke-width', 3)
            .attr('d', line);

        // Label da frota no final da linha
        const lastPoint = values[values.length - 1];
        g.append('text')
            .attr('x', mapX(lastPoint.data) + 5)
            .attr('y', mapY(lastPoint.volume))
            .attr('fill', coresScatter[key])
            .style('font-weight', 'bold')
            .text(key === 'yellow' ? 'Amarela' : 'Verde');
    });

    g.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(mapX).ticks(6));
    g.append('g').call(d3.axisLeft(mapY).ticks(5));
}