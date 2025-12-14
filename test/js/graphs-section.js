// Graphs visualization module
// Handles line charts, bar charts, and scatter matrix

const GraphsSection = {
    svg: null,
    currentChart: 'line',
    currentAxis: 'crashes',
    currentBottomAxis: 'years',

    init() {
        this.svg = d3.select("#chart-svg");

        // Setup chart type buttons
        this.setupControls();

        // Listen to filter changes
        SharedFilters.addListener((filtered) => this.render(filtered));
    },

    setupControls() {
        // Axis type buttons (Crashes / Fatalities)
        document.querySelectorAll('.axisTypeBtn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.axisTypeBtn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentAxis = e.target.dataset.type;
                this.render(SharedFilters.getFilteredData());
            });
        });

        // Bottom axis buttons (Years / Weather)
        document.querySelectorAll('.bottomAxisBtn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (e.target.classList.contains('disabled')) return;
                document.querySelectorAll('.bottomAxisBtn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentBottomAxis = e.target.dataset.type;
                this.render(SharedFilters.getFilteredData());
            });
        });

        // Chart type buttons (Line / Bar / Scatter Matrix)
        document.querySelectorAll('.chartTypeBtn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.chartTypeBtn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentChart = e.target.dataset.type;
                this.updateButtonStates();
                this.render(SharedFilters.getFilteredData());
            });
        });
    },

    updateButtonStates() {
        const weatherBtn = document.querySelector('.bottomAxisBtn[data-type="weather"]');
        const yearsBtn = document.querySelector('.bottomAxisBtn[data-type="years"]');
        const axisTypeBtns = document.querySelectorAll('.axisTypeBtn');

        if (this.currentChart === 'scatter-matrix') {
            // Disable all control buttons for scatter matrix
            weatherBtn?.classList.add('disabled');
            yearsBtn?.classList.add('disabled');
            axisTypeBtns.forEach(btn => btn.classList.add('disabled'));
        } else if (this.currentChart === 'bar') {
            // Enable weather button for bar chart
            weatherBtn?.classList.remove('disabled');
            yearsBtn?.classList.remove('disabled');
            axisTypeBtns.forEach(btn => btn.classList.remove('disabled'));
        } else {
            // Line chart: disable weather, enable years
            weatherBtn?.classList.add('disabled');
            yearsBtn?.classList.remove('disabled');
            axisTypeBtns.forEach(btn => btn.classList.remove('disabled'));
            if (this.currentBottomAxis === 'weather') {
                this.currentBottomAxis = 'years';
                yearsBtn?.classList.add('active');
                weatherBtn?.classList.remove('active');
            }
        }
    },

    render(filtered) {
        const startYear = SharedFilters.state.yearStart;
        const endYear = SharedFilters.state.yearEnd;

        // Prepare data based on axis type
        let yearData = [];
        if (this.currentAxis === 'crashes') {
            const yearCounts = d3.rollup(filtered, v => v.length, d => d.year);
            const countsMap = new Map(yearCounts);
            for (let y = startYear; y <= endYear; y++) {
                yearData.push({ year: y, value: countsMap.get(y) || 0 });
            }
        } else {
            const yearFatal = d3.rollup(filtered, v => d3.sum(v, d => d.fatal || 0), d => d.year);
            const fatalMap = new Map(yearFatal);
            for (let y = startYear; y <= endYear; y++) {
                yearData.push({ year: y, value: fatalMap.get(y) || 0 });
            }
        }

        // Render based on chart type
        switch (this.currentChart) {
            case 'line':
                this.drawLine(yearData, filtered);
                break;
            case 'bar':
                if (this.currentBottomAxis === 'years') {
                    const sortedYearData = [...yearData].sort((a, b) => b.value - a.value).slice(0, 25);
                    this.drawBar(sortedYearData, filtered);
                } else {
                    this.drawWeatherBar(filtered);
                }
                break;
            case 'scatter-matrix':
                this.drawScatterMatrix(filtered, SharedFilters.data);
                break;
        }
    },

    drawLine(yearData, allData) {
        const container = document.querySelector("#chart-box");
        const rect = container.getBoundingClientRect();
        const w = Math.max(400, rect.width - 40);
        const h = Math.max(300, rect.height - 120);

        this.svg.selectAll('*').remove();

        const margin = { top: 20, right: 20, bottom: 60, left: 60 };
        const innerW = w - margin.left - margin.right;
        const innerH = h - margin.top - margin.bottom;
        const g = this.svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

        const x = d3.scaleLinear()
            .domain([SharedFilters.state.yearStart, SharedFilters.state.yearEnd])
            .range([0, innerW]);

        // Get max value from all data for consistent scale
        let maxValue = 1;
        if (this.currentAxis === 'crashes') {
            const allCounts = Array.from(d3.rollup(SharedFilters.data, v => v.length, d => d.year).values());
            maxValue = d3.max(allCounts) || 1;
        } else {
            const allFatal = Array.from(d3.rollup(SharedFilters.data, v => d3.sum(v, d => d.fatal || 0), d => d.year).values());
            maxValue = d3.max(allFatal) || 1;
        }

        const y = d3.scaleLinear().domain([0, maxValue]).range([innerH, 0]);

        // Grid lines
        const yTicks = d3.ticks(0, maxValue, 10);
        g.append('g').selectAll('line')
            .data(yTicks).enter().append('line')
            .attr('x1', 0).attr('x2', innerW)
            .attr('y1', d => y(d)).attr('y2', d => y(d))
            .attr('stroke', 'rgba(255,255,255,0.05)')
            .attr('stroke-width', 1);

        // Line and area
        const line = d3.line().x(d => x(d.year)).y(d => y(d.value)).curve(d3.curveMonotoneX);
        const area = d3.area().x(d => x(d.year)).y0(innerH).y1(d => y(d.value)).curve(d3.curveMonotoneX);

        g.append('path').datum(yearData).attr('d', area).attr('fill', 'rgba(232,85,85,0.12)');
        g.append('path').datum(yearData).attr('d', line).attr('fill', 'none').attr('stroke', '#e85555').attr('stroke-width', 2);

        // Points
        g.selectAll('circle.point').data(yearData).enter().append('circle')
            .attr('class', 'point')
            .attr('cx', d => x(d.year))
            .attr('cy', d => y(d.value))
            .attr('r', 3)
            .attr('fill', '#fff')
            .attr('stroke', '#e85555')
            .attr('stroke-width', 1);

        // Axes
        const range = SharedFilters.state.yearEnd - SharedFilters.state.yearStart;
        const step = Math.max(1, Math.floor(range / 10));
        const ticks = d3.range(SharedFilters.state.yearStart, SharedFilters.state.yearEnd + 1, step);

        g.append('g')
            .attr('transform', `translate(0,${innerH})`)
            .call(d3.axisBottom(x).tickValues(ticks).tickFormat(d3.format('d')))
            .selectAll('text').style('fill', '#ddd').style('font-size', '11px');

        g.append('g')
            .call(d3.axisLeft(y).tickValues(yTicks))
            .selectAll('text').style('fill', '#ddd').style('font-size', '11px');
    },

    drawBar(items, allData) {
        const container = document.querySelector("#chart-box");
        const rect = container.getBoundingClientRect();
        const w = Math.max(400, rect.width - 40);
        const h = Math.max(300, rect.height - 120);

        this.svg.selectAll('*').remove();

        const margin = { top: 20, right: 20, bottom: 80, left: 60 };
        const innerW = w - margin.left - margin.right;
        const innerH = h - margin.top - margin.bottom;
        const g = this.svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

        const x = d3.scaleBand()
            .domain(items.map(d => d.year))
            .range([0, innerW])
            .padding(0.15);

        let maxValue = 1;
        if (this.currentAxis === 'crashes') {
            const allCounts = Array.from(d3.rollup(SharedFilters.data, v => v.length, d => d.year).values());
            maxValue = d3.max(allCounts) || 1;
        } else {
            const allFatal = Array.from(d3.rollup(SharedFilters.data, v => d3.sum(v, d => d.fatal || 0), d => d.year).values());
            maxValue = d3.max(allFatal) || 1;
        }

        const y = d3.scaleLinear().domain([0, maxValue]).range([innerH, 0]);

        // Bars
        g.selectAll('.bar')
            .data(items).enter().append('rect')
            .attr('class', 'bar')
            .attr('x', d => x(d.year))
            .attr('y', d => y(d.value))
            .attr('width', x.bandwidth())
            .attr('height', d => innerH - y(d.value))
            .attr('fill', '#e14242');

        // Axes
        g.append('g')
            .attr('transform', `translate(0,${innerH})`)
            .call(d3.axisBottom(x))
            .selectAll('text')
            .attr('transform', 'rotate(-45)')
            .style('text-anchor', 'end')
            .style('fill', '#ddd')
            .style('font-size', '11px');

        g.append('g')
            .call(d3.axisLeft(y))
            .selectAll('text').style('fill', '#ddd').style('font-size', '11px');
    },

    drawWeatherBar(filtered) {
        const groupMap = {
            clear: ["clear"],
            foggy: ["fog"],
            rainy: ["rain", "heavy rain"],
            cloudy: ["mostly cloudy", "overcast", "partly cloudy"],
            snowy: ["snow"],
            windy: ["windy", "storm-level winds", "thunderstorms"]
        };

        const selectedGroups = Array.from(SharedFilters.state.conditionsSelected);
        let allowedConds = [];
        for (const group of selectedGroups) {
            if (groupMap[group]) allowedConds = allowedConds.concat(groupMap[group]);
        }

        const conditionCounts = {};
        for (const rec of filtered) {
            if (rec.conditions && rec.conditions.length) {
                for (const cond of rec.conditions) {
                    const key = cond.trim().toLowerCase();
                    if (!key) continue;
                    if (allowedConds.length && !allowedConds.includes(key)) continue;
                    if (!conditionCounts[key]) conditionCounts[key] = 0;
                    conditionCounts[key] += this.currentAxis === 'crashes' ? 1 : (rec.fatal || 0);
                }
            }
        }

        let weatherCounts = Object.entries(conditionCounts)
            .map(([cond, value]) => ({ year: cond.charAt(0).toUpperCase() + cond.slice(1), value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 25);

        this.drawBar(weatherCounts, filtered);
    },

    drawScatterMatrix(filtered, fullData) {
        this.svg.selectAll('*').remove();

        const VARS = [
            { key: 'Temp_Avg', label: 'Temp Avg (°C)' },
            { key: 'Precipitation', label: 'Precip (mm)' },
            { key: 'Wind_Max', label: 'Wind (max)' },
            { key: 'Cloud_Cover', label: 'Cloud (%)' },
            { key: 'Pressure', label: 'Pressure (hPa)' }
        ];

        // Helper to parse numbers robustly
        function parseNum(v) {
            if (v == null) return null;
            const s = v.toString().trim().replace(/,/g, '.').replace(/[^0-9.\-]/g, '');
            if (s === '') return null;
            const n = parseFloat(s);
            return isNaN(n) ? null : n;
        }

        const cols = fullData && fullData.length > 0 ? Object.keys(fullData[0]) : [];

        // Compute fixed extents from full data
        const fixedExtents = {};
        VARS.forEach(v => {
            const arr = fullData.map(d => {
                if (v.key === 'Temp_Avg') {
                    let tmax = parseNum(d['Temp_Max']);
                    let tmin = parseNum(d['Temp_Min']);
                    let tempAvg = null;
                    if (tmax != null && tmin != null) tempAvg = (tmax + tmin) / 2;
                    else if (tmax != null) tempAvg = tmax;
                    else if (tmin != null) tempAvg = tmin;
                    return tempAvg;
                }
                if (v.key === 'Precipitation') return parseNum(d['Precipitation']);
                if (v.key === 'Wind_Max') return parseNum(d['Wind_Max']);
                if (v.key === 'Cloud_Cover') return parseNum(d['Cloud_Cover']);
                if (v.key === 'Pressure') return parseNum(d['Pressure']);
                return null;
            }).filter(x => x != null && !isNaN(x));
            let extent = d3.extent(arr.length ? arr : [0, 1]);
            if (extent[0] === extent[1]) { extent[0] = extent[0] - 1; extent[1] = extent[1] + 1; }
            fixedExtents[v.key] = extent;
        });

        // Parse filtered data
        let parsed = filtered.map(d => {
            let tmax = parseNum(d['Temp_Max']);
            let tmin = parseNum(d['Temp_Min']);
            let tempAvg = null;
            if (tmax != null && tmin != null) tempAvg = (tmax + tmin) / 2;
            else if (tmax != null) tempAvg = tmax;
            else if (tmin != null) tempAvg = tmin;
            const precip = parseNum(d['Precipitation']);
            const wind = parseNum(d['Wind_Max']);
            const cloud = parseNum(d['Cloud_Cover']);
            const pressure = parseNum(d['Pressure']);
            return Object.assign({}, d, { Temp_Avg: tempAvg, Precipitation: precip, Wind_Max: wind, Cloud_Cover: cloud, Pressure: pressure });
        });
        parsed = parsed.filter(d => VARS.some(v => d[v.key] != null && !isNaN(d[v.key])));

        if (parsed.length === 0) {
            this.svg.append('text')
                .attr('x', 300)
                .attr('y', 200)
                .attr('text-anchor', 'middle')
                .attr('fill', '#888')
                .attr('font-size', '16px')
                .text('No weather data available for filtered selection');
            return;
        }

        const container = document.querySelector("#chart-box");
        const rect = container.getBoundingClientRect();
        const controlsRow = container.querySelector('.chartControlsRow');
        let controlsHeight = 0;
        if (controlsRow) {
            const crRect = controlsRow.getBoundingClientRect();
            controlsHeight = crRect.height + 18;
        }
        const w = rect.width || 600;
        const h = (rect.height - controlsHeight) || 600;

        const pad = 16;
        const n = VARS.length;
        const cellGap = 16;
        const cellWidth = ((w - pad * 2) - cellGap * (n - 1)) / n;
        const cellHeight = (h - pad * 2) / n;
        const totalW = cellWidth * n + cellGap * (n - 1) + pad * 2;
        const totalH = cellHeight * n + pad * 2;

        this.svg.attr('width', totalW).attr('height', totalH);
        const root = this.svg.append('g').attr('transform', `translate(${pad},${pad})`);

        // Create scales
        const scales = {};
        VARS.forEach(v => {
            const extent = fixedExtents[v.key];
            scales[v.key] = {
                x: d3.scaleLinear().domain(extent).nice().range([pad, cellWidth - pad]),
                y: d3.scaleLinear().domain(extent).nice().range([cellHeight - pad, pad])
            };
        });

        // Pearson correlation helper
        function pearsonCorr(arr1, arr2) {
            const n = arr1.length;
            if (n === 0) return NaN;
            const mean1 = d3.mean(arr1);
            const mean2 = d3.mean(arr2);
            let num = 0, den1 = 0, den2 = 0;
            for (let k = 0; k < n; k++) {
                const dx = arr1[k] - mean1;
                const dy = arr2[k] - mean2;
                num += dx * dy;
                den1 += dx * dx;
                den2 += dy * dy;
            }
            return (den1 && den2) ? num / Math.sqrt(den1 * den2) : NaN;
        }

        // Draw matrix cells
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                if (i > j) {
                    // Lower triangle: show correlation
                    const xi = VARS[j];
                    const yi = VARS[i];
                    const points = parsed.filter(d => d[xi.key] != null && !isNaN(d[xi.key]) && d[yi.key] != null && !isNaN(d[yi.key]));
                    const xVals = points.map(d => d[xi.key]);
                    const yVals = points.map(d => d[yi.key]);
                    const corr = pearsonCorr(xVals, yVals);
                    root.append('g')
                        .attr('transform', `translate(${j * (cellWidth + cellGap)},${i * cellHeight})`)
                        .append('text')
                        .attr('x', cellWidth / 2)
                        .attr('y', cellHeight / 2)
                        .attr('text-anchor', 'middle')
                        .attr('dominant-baseline', 'middle')
                        .attr('fill', '#e85555')
                        .attr('font-size', Math.max(14, cellWidth * 0.18))
                        .attr('font-weight', 700)
                        .text(isNaN(corr) ? '' : corr.toFixed(2));
                    continue;
                }

                const cell = root.append('g').attr('transform', `translate(${j * (cellWidth + cellGap)},${i * cellHeight})`);
                cell.append('rect').attr('class', 'cell').attr('width', cellWidth).attr('height', cellHeight).attr('fill', 'none');

                const xi = VARS[j];
                const yi = VARS[i];

                if (i === j) {
                    // Diagonal: show variable label
                    cell.append('text')
                        .attr('class', 'label')
                        .attr('x', cellWidth / 2)
                        .attr('y', cellHeight / 2)
                        .attr('text-anchor', 'middle')
                        .attr('dominant-baseline', 'middle')
                        .attr('fill', '#ddd')
                        .attr('font-size', Math.max(12, Math.min(cellWidth, cellHeight) * 0.18))
                        .attr('font-weight', 700)
                        .text(xi.label);
                    continue;
                }

                // Scatter plot
                const xa = scales[xi.key].x;
                const ya = scales[yi.key].y;
                const points = parsed.filter(d => d[xi.key] != null && !isNaN(d[xi.key]) && d[yi.key] != null && !isNaN(d[yi.key]));
                const cellG = cell.append('g').attr('transform', `translate(0,0)`);
                cellG.selectAll('circle').data(points).enter().append('circle')
                    .attr('cx', d => xa(d[xi.key]))
                    .attr('cy', d => ya(d[yi.key]))
                    .attr('r', 1.5)
                    .attr('fill', '#da2222f2')
                    .attr('opacity', 0.3);

                // Axes
                let xAxis = d3.axisBottom(xa).ticks(3).tickSize(2);
                let yAxis = d3.axisLeft(ya).ticks(3).tickSize(2);
                cellG.append('g').attr('transform', `translate(0,${cellHeight - pad})`).call(xAxis).selectAll('text').style('fill', '#aaa');
                cellG.append('g').call(yAxis).selectAll('text').style('fill', '#aaa');
            }
        }
    }
};

// Initialize graphs when page loads
window.addEventListener("load", () => {
    GraphsSection.init();
});
