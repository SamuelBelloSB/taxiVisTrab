import * as d3 from 'd3';

// Cores otimizadas para daltonismo (Paleta Okabe-Ito)
// Yellow: Laranja/Amarelo (#e69f00), Green: Verde Azulado (#009e73)
const coresScatter = { green: '#009e73', yellow: '#e69f00' }; 
const domDiasMinuscula = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const rotulosDiasPT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const horasEixo = Array.from({ length: 24 }, function(_, i) { return i; });

/**
 * Singleton para Tooltip global para evitar poluição do DOM
 */
function getTooltip() {
    let t = d3.select("body").select(".chart-tooltip");
    if (t.empty()) t = d3.select("body").append("div").attr("class", "tooltip chart-tooltip");
    return t;
}

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

    // Linhas de Grade (Grid lines) para facilitar a leitura dos pontos
    g.append('g')
        .attr('class', 'grid')
        .attr('transform', `translate(0, ${alturaGrafico})`)
        .call(d3.axisBottom(mapX).ticks(5).tickSize(-alturaGrafico).tickFormat(''))
        .selectAll('line')
        .attr('stroke', '#d4c3a3')
        .attr('stroke-opacity', 0.2);

    g.append('g')
        .attr('class', 'grid')
        .call(d3.axisLeft(mapY).ticks(6).tickSize(-larguraGrafico).tickFormat(''))
        .selectAll('line')
        .attr('stroke', '#d4c3a3')
        .attr('stroke-opacity', 0.2);

    // Eixo X com Título
    g.append('g')
        .attr('transform', 'translate(0, ' + alturaGrafico + ')')
        .call(d3.axisBottom(mapX).ticks(5).tickPadding(8)
            .tickFormat(d => d % 1 === 0 ? d : d3.format(".1f")(d)))
        .append('text')
        .attr('x', larguraGrafico / 2)
        .attr('y', 40)
        .attr('fill', '#5b6346')
        .attr('text-anchor', 'middle')
        .attr('font-weight', 'bold')
        .text('Distância (milhas)');

    // Eixo Y com Título
    g.append('g')
        .call(d3.axisLeft(mapY).ticks(6).tickFormat(d => `$${d}`))
        .append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -margens.left + 15)
        .attr('x', -alturaGrafico / 2)
        .attr('fill', '#5b6346')
        .attr('text-anchor', 'middle')
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
    const escalaCor = d3.scaleLog().domain([1, Math.max(2, maxVal)]).range([0, 1]);

    g.selectAll('.celula').data(data.filter(function(d) { return d.volume > 0; })).join('rect')
        .attr('x', function(d) { return mapX(d.hora); })
        .attr('y', function(d) { return mapY(d.dia_semana); })
        .attr('width', mapX.bandwidth()).attr('height', mapY.bandwidth())
        // Viridis: Escala universalmente acessível (Roxo -> Verde -> Amarelo)
        .attr('fill', function(d) { return d3.interpolateViridis(escalaCor(d.volume)); }).attr('rx', 2);

    // Eixo X (Horas)
    g.append('g')
        .attr('transform', 'translate(0, ' + alturaGrafico + ')')
        .call(d3.axisBottom(mapX)
            .tickValues(horasEixo.filter(h => isSmallChart ? h % 6 === 0 : h % 3 === 0))
            .tickPadding(6)
            .tickFormat(d => d + 'h'))

    if (!isSmallChart) {
        g.select(".domain").attr("stroke", "#d4c3a3");
    }

    g.append('g').call(d3.axisLeft(mapY)
        .tickPadding(6)
        .tickFormat(function(d) {
            // Abreviação agressiva para charts pequenos
            const label = rotulosDiasPT[domDiasMinuscula.indexOf(d)] || d;
            return isSmallChart ? label[0] : label;
        }));

    // Legenda de Cor (apenas se houver dados)
    if (data.length > 0) {
        const legendWidth = larguraGrafico * 0.5; // Reduzido para dar mais espaço ao texto lateral
        const legendHeight = 8;
        const legendG = g.append('g')
            .attr('transform', `translate(${(larguraGrafico - legendWidth)/2}, ${alturaGrafico + 30})`);

        const legendScale = d3.range(0, 1.1, 0.1);
        
        legendG.selectAll('rect')
            .data(legendScale)
            .join('rect')
            .attr('x', d => d * legendWidth)
            .attr('y', 0)
            .attr('width', legendWidth / 10)
            .attr('height', legendHeight)
            .attr('fill', d => d3.interpolateViridis(d));

        legendG.append('text')
            .attr('x', -5)
            .attr('y', legendHeight - 1)
            .attr('text-anchor', 'end')
            .style('font-size', '9px')
            .text('Min');

        legendG.append('text')
            .attr('x', legendWidth + 5)
            .attr('y', legendHeight - 1)
            .attr('text-anchor', 'start')
            .style('font-size', '9px')
            .text('Pico de Demanda');
    }
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
            .attr('fill', '#5b6346').attr('stroke', '#fdfbf7').attr('stroke-width', 1) 
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

    const tipo = data[0]?.tipo_taxi || 'yellow';
    const corPrincipal = coresScatter[tipo];
    const idGradiente = `grad-${tipo}-${selector.replace('#', '')}`;

    // Definição do Gradiente para a área
    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
        .attr("id", idGradiente)
        .attr("x1", "0%").attr("y1", "0%")
        .attr("x2", "0%").attr("y2", "100%");

    gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", corPrincipal)
        .attr("stop-opacity", 0.4);

    gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", corPrincipal)
        .attr("stop-opacity", 0.05);

    const limitesData = d3.extent(data, function(d) { return d.data; });
    const mapX = d3.scaleTime().domain(limitesData).range([0, larguraGrafico]);
    const mapY = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.volume) || 100])
        .nice() // Garante que o eixo termine em um número redondo
        .range([alturaGrafico, 0]);

    // Adiciona linhas de grade horizontais sutis
    g.append('g')
        .attr('class', 'grid')
        .call(d3.axisLeft(mapY).ticks(6).tickSize(-larguraGrafico).tickFormat(''))
        .selectAll('line')
        .attr('stroke', '#d4c3a3')
        .attr('stroke-opacity', 0.15);

    const geradorLinha = d3.line()
        .x(function(d) { return mapX(d.data); })
        .y(function(d) { return mapY(d.volume); })
        .curve(d3.curveMonotoneX); // Suaviza a "onda"

    const geradorArea = d3.area()
        .x(function(d) { return mapX(d.data); })
        .y0(alturaGrafico)
        .y1(function(d) { return mapY(d.volume); })
        .curve(d3.curveMonotoneX);

    // Desenha a área preenchida com gradiente
    g.append('path').datum(data)
        .attr('fill', `url(#${idGradiente})`)
        .attr('d', geradorArea);

    // Desenha a linha de contorno
    g.append('path').datum(data)
        .attr('fill', 'none').attr('stroke', corPrincipal).attr('stroke-width', 2).attr('d', geradorLinha); 

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
 * Painel de KPIs em formato de Tabela Consolidada
 * Elimina repetição de legendas e otimiza espaço horizontal
 */
export function loadKPITable(data, selector) {
    const container = d3.select(selector);
    if (!container.node()) return;
    container.selectAll('*').remove();

    const table = container.append('div').attr('class', 'kpi-table-wrapper');
    const frotas = ['yellow', 'green'];
    const nomes = { yellow: 'TÁXI AMARELO', green: 'TÁXI VERDE' };
    const formatMoeda = d3.format("$,.2s");
    const formatNum = d3.format(".2s");

    // Header
    const header = table.append('div').attr('class', 'kpi-table-row header');
    header.append('div').text('Frota / Período');
    data.forEach(d => {
        header.append('div').text(d.label).classed('total-col', d.highlighted);
    });

    frotas.forEach(tipo => {
        const row = table.append('div').attr('class', 'kpi-table-row')
            .style('border-left', `5px solid ${coresScatter[tipo]}`);
        
        row.append('div').attr('class', 'fleet-name').text(nomes[tipo]).style('color', coresScatter[tipo]);
        
        data.forEach(d => {
            const stats = d.stats.find(s => s[0] === tipo)?.[1] || { faturamento: 0, volume: 0 };
            const cell = row.append('div').attr('class', 'kpi-cell').classed('total-col', d.highlighted);
            
            cell.append('span').attr('class', 'val')
                .text(formatMoeda(stats.faturamento).replace('G', 'B'));
            
            cell.append('span').attr('class', 'sub')
                .text(formatNum(stats.volume) + ' viagens');
        });
    });
}

/**
 * Gráfico de Séries Comparativas (Multi-Line) para Visão Geral
 * Compara o volume de ambas as frotas simultaneamente
 */
export function loadComparisonSeries(data, selector) {
    const svg = d3.select(selector);
    if (!svg.node()) return;
    
    const tooltip = getTooltip();

    svg.selectAll('*').remove();

    const margens = { top: 30, right: 120, bottom: 40, left: 60 };
    const rectDim = svg.node().getBoundingClientRect();
    const width = (rectDim.width || 800) - margens.left - margens.right;
    const height = (rectDim.height || 340) - margens.top - margens.bottom;

    const g = svg.append('g').attr('transform', `translate(${margens.left},${margens.top})`);

    const extentX = d3.extent(data, d => d.data);
    const mapX = d3.scaleTime().domain(extentX).range([0, width]);

    const mapY = d3.scaleSymlog()
        .constant(50000) 
        .domain([0, d3.max(data, d => Math.max(d.volume || 0, d.faturamento || 0)) * 1.2 || 1000])
        .range([height, 0]);

    const lineVolume = d3.line().x(d => mapX(d.data)).y(d => mapY(d.volume)).curve(d3.curveMonotoneX);
    const lineFaturamento = d3.line().x(d => mapX(d.data)).y(d => mapY(d.faturamento)).curve(d3.curveMonotoneX);

    const nested = d3.group(data, d => d.tipo_taxi);
    const dataByDate = d3.group(data, d => d.data.getTime());
    const sortedDates = Array.from(dataByDate.keys()).sort();

    nested.forEach((values, key) => {
        if (!values || values.length === 0) return;
        const sortedValues = values.sort((a,b) => a.data - b.data);

        g.append('path').datum(sortedValues).attr('fill', 'none').attr('stroke', coresScatter[key]).attr('stroke-width', 3).attr('d', lineVolume);
        g.append('path').datum(sortedValues).attr('fill', 'none').attr('stroke', coresScatter[key]).attr('stroke-width', 2).attr('stroke-dasharray', '5,3').style('opacity', 0.6).attr('d', lineFaturamento);

        // Adiciona pontos para garantir visibilidade de volumes baixos
        g.append('g')
            .attr('class', `dot-${key}`)
            .selectAll('circle')
            .data(sortedValues)
            .join('circle')
            .attr('cx', d => mapX(d.data))
            .attr('cy', d => mapY(d.volume))
            .attr('r', 3)
            .attr('fill', coresScatter[key])
            .style('opacity', 0.8);

        // Label da frota no final da linha
        const lastPoint = sortedValues[sortedValues.length - 1];
        if (!lastPoint) return;
        
        // Label Volume
        g.append('text')
            .attr('x', mapX(lastPoint.data) + 5)
            .attr('y', mapY(lastPoint.volume))
            .attr('fill', coresScatter[key])
            .style('font-size', '10px')
            .style('font-weight', 'bold')
            .text(key === 'yellow' ? 'Vol. Amarela' : 'Vol. Verde');

        // Label Faturamento
        g.append('text')
            .attr('x', mapX(lastPoint.data) + 5)
            .attr('y', mapY(lastPoint.faturamento))
            .attr('fill', coresScatter[key])
            .style('font-size', '10px')
            .style('font-style', 'italic')
            .text(key === 'yellow' ? 'Fat. Amarela' : 'Fat. Verde');
    });

    // Eixo X: Intervalos de 6 meses para melhor espaçamento
    g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(mapX)
            .ticks(d3.timeMonth.every(6))
            .tickFormat(d3.timeFormat("%b/%y")));
    
    // Eixo Y: Labels forçadas em pontos estratégicos para evitar acúmulo no topo
    g.append('g')
        .call(d3.axisLeft(mapY)
            .tickValues([0, 100000, 1000000, 10000000, 100000000])
            .tickFormat(d3.format(".1s")));

    // Camada de Interatividade
    const focusLine = g.append('line')
        .attr('stroke', '#8b7d6b')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '3,3')
        .attr('y1', 0)
        .attr('y2', height)
        .style('display', 'none');

    const formatVal = d3.format(",.0f");
    const formatMonth = d3.timeFormat("%B %Y");

    g.append('rect')
        .attr('width', width)
        .attr('height', height)
        .style('fill', 'none')
        .style('pointer-events', 'all')
        .on('mouseover', () => { tooltip.style('display', 'block'); focusLine.style('display', 'block'); })
        .on('mouseout', () => { tooltip.style('display', 'none'); focusLine.style('display', 'none'); })
        .on('mousemove', function(event) {
            const xPos = d3.pointer(event)[0];
            const xDate = mapX.invert(xPos).getTime();
            
            // Busca binária para encontrar a data mais próxima
            const bisect = d3.bisector(d => d).left;
            const idx = bisect(sortedDates, xDate);
            const actualDate = sortedDates[idx] || sortedDates[sortedDates.length - 1];

            const records = dataByDate.get(actualDate) || [];
            const y = records.find(r => r.tipo_taxi === 'yellow') || { volume: 0, faturamento: 0 };
            const v = records.find(r => r.tipo_taxi === 'green') || { volume: 0, faturamento: 0 };

            focusLine.attr('x1', mapX(new Date(actualDate))).attr('x2', mapX(new Date(actualDate)));

            tooltip
                .style('left', (event.pageX + 15) + 'px')
                .style('top', (event.pageY - 20) + 'px')
                .html(`
                    <div class="tooltip-title">${formatMonth(new Date(actualDate))}</div>
                    <div style="color:${coresScatter.yellow}"><b>AMARELO:</b> ${formatVal(y.volume)} vig. ($${formatVal(y.faturamento)})</div>
                    <div style="color:${coresScatter.green}"><b>VERDE:</b> ${formatVal(v.volume)} vig. ($${formatVal(v.faturamento)})</div>
                `);
        });
}