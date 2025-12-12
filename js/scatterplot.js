// js/scatterplot.js — basic SPLOM implementation (tabs indentation)
// Loads `crashesFinal.csv` (semicolon-separated) and draws a small SPLOM.

(function () {
    const container = d3.select('#chart');
    const btnRedraw = document.getElementById('btnRedraw');

    const VARS = [
        { key: 'Temp_Avg', label: 'Temp Avg (°C)' },
        { key: 'Precipitation', label: 'Precip (mm)' },
        { key: 'Wind_Max', label: 'Wind (max)' },
        { key: 'Cloud_Cover', label: 'Cloud (%)' },
        { key: 'Pressure', label: 'Pressure (hPa)' }
    ];

    // Configuration for performance and appearance
    const POINT_SIZE = 1; // Change this value to adjust point size (1-5 recommended)
    const SAMPLE_RATE = 1.0; // Use 0.5 for 50% of data, 0.25 for 25%, 1.0 for all data

    function categorizeCondition(s) {
        if (!s) return 'Other';
        const low = s.toString().toLowerCase();
        if (/storm|severe|thunder|hurricane|cyclone|tornado/.test(low)) return 'Severe';
        if (/rain/.test(low)) return 'Rain';
        if (/snow|sleet|blizzard|ice/.test(low)) return 'Snow';
        if (/fog|mist/.test(low)) return 'Fog';
        if (/wind/.test(low)) return 'Windy';
        if (/overcast|cloud|cloudy/.test(low)) return 'Cloudy';
        if (/clear/.test(low)) return 'Clear';
        return 'Other';
    }

    function parseNum(v) {
        if (v == null) return null;
        const s = v.toString().trim().replace(/,/g, '.').replace(/[^0-9.\-]/g, '');
        if (s === '') return null;
        const n = parseFloat(s);
        return isNaN(n) ? null : n;
    }

    function detectCols(cols) {
        const lower = cols.map(c => c.toLowerCase());
        function find(pred) { const i = lower.findIndex(pred); return i === -1 ? null : cols[i]; }
        return {
            tempMax: find(c => c.includes('temp') && c.includes('max')) || find(c => c.includes('temp_max')),
            tempMin: find(c => c.includes('temp') && c.includes('min')) || find(c => c.includes('temp_min')),
            precip: find(c => c.includes('precip')) || find(c => c.includes('precipitation')),
            wind: find(c => c.includes('wind')) || find(c => c.includes('wind_max')),
            cloud: find(c => c.includes('cloud')) || find(c => c.includes('cloud_cover')),
            pressure: find(c => c.includes('press')) || find(c => c.includes('pressure')),
            general: find(c => c.includes('general') || c.includes('condition') || c.includes('weather')) || find(c => c.includes('general_conditions'))
        };
    }

    async function draw() {
        container.selectAll('*').remove();
        let data;
        try { data = await d3.dsv(';', '/data/crashesFinal.csv'); }
        catch (err) { container.append('div').text('Failed to load /data/crashesFinal.csv — serve files via a local server.'); console.error(err); return; }
        if (!data || data.length === 0) { container.append('div').text('No rows in CSV'); return; }

        const cols = Object.keys(data[0]);
        const keys = detectCols(cols);

        let parsed = data.map(d => {
            const tmax = keys.tempMax ? parseNum(d[keys.tempMax]) : null;
            const tmin = keys.tempMin ? parseNum(d[keys.tempMin]) : null;
            const tempAvg = tmax != null && tmin != null ? (tmax + tmin) / 2 : (tmax != null ? tmax : tmin);
            const precip = keys.precip ? parseNum(d[keys.precip]) : null;
            const wind = keys.wind ? parseNum(d[keys.wind]) : null;
            const cloud = keys.cloud ? parseNum(d[keys.cloud]) : null;
            const pressure = keys.pressure ? parseNum(d[keys.pressure]) : null;
            const generalRaw = keys.general ? d[keys.general] : null;
            const category = categorizeCondition(generalRaw);
            return Object.assign({}, d, { Temp_Avg: tempAvg, Precipitation: precip, Wind_Max: wind, Cloud_Cover: cloud, Pressure: pressure, _cat: category });
        });

        // Apply sampling if configured (for faster rendering)
        if (SAMPLE_RATE < 1.0) {
            parsed = parsed.filter(() => Math.random() < SAMPLE_RATE);
        } const categories = Array.from(new Set(parsed.map(d => d._cat))).sort();

        // Use the requested categorical color mapping (explicit mapping)
        const colorMap = {
            'Severe': '#FF3333',   // Bright Red - most visible, represents danger
            'Rain': '#00CCFF',     // Cyan / Light Blue - represents water, bright and visible
            'Cloudy': '#B0B0B0',   // Light Grey / Silver - neutral background context
            'Fog': '#00FF99',      // Mint Green / Teal - distinct from Rain and Severe
            'Windy': '#FFD700',    // Yellow / Gold - universal caution color
            'Other': '#888888'     // Dark grey for "Other" category
        };
        const catList = categories.slice();
        const paletteFallback = d3.schemeCategory10 || ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];
        const color = (cat) => {
            if (cat && colorMap[cat]) return colorMap[cat];
            const i = Math.max(0, catList.indexOf(cat));
            return paletteFallback[i % paletteFallback.length];
        };

        const pad = 16;
        const vars = VARS;
        const n = vars.length;

        // Get container dimensions for responsive sizing
        const containerRect = container.node().getBoundingClientRect();
        // Container width includes its padding, height does too but we need to account for navbar
        const navbarHeight = 72; // navbar is fixed at top with 72px total (padding + nav height)
        const containerW = containerRect.width || window.innerWidth - 32;
        const containerH = (containerRect.height - navbarHeight) || window.innerHeight - 172; // subtract navbar space from available height

        // Calculate cell size to fill the available space without scrolling
        const cellSizeFromWidth = (containerW - pad * 2) / n;
        const cellSizeFromHeight = (containerH - pad * 2) / n;
        const finalCellSize = Math.min(cellSizeFromWidth, cellSizeFromHeight);

        const totalW = finalCellSize * n + pad * 2;
        const totalH = finalCellSize * n + pad * 2;

        const svg = container.append('svg').attr('width', totalW).attr('height', totalH).style('display', 'block');
        const content = svg.append('g'); // zoom/pan layer
        const root = content.append('g').attr('transform', `translate(${pad},${pad})`);

        // Add zoom functionality with pan constraints
        const zoom = d3.zoom()
            .scaleExtent([1, 10])
            .on('zoom', (event) => {
                // Only allow panning when zoomed in (scale > 1)
                if (event.transform.k === 1) {
                    // At zoom level 1, reset to identity (centered)
                    content.attr('transform', d3.zoomIdentity);
                } else {
                    // When zoomed in, allow panning
                    content.attr('transform', event.transform);
                }
            });

        svg.call(zoom);

        // Allow double-click to reset zoom with smooth animation
        svg.on('dblclick.zoom', function (event) {
            event.stopImmediatePropagation();
            svg.transition()
                .duration(750)
                .call(zoom.transform, d3.zoomIdentity)
                .on('end', () => {
                    // Ensure content is reset to identity after transition
                    content.attr('transform', d3.zoomIdentity);
                    // Reset zoom transform on the SVG too
                    zoom.transform(svg, d3.zoomIdentity);
                });
        });

        const scales = {};
        const scalesInfo = {};
        vars.forEach(v => {
            const arr = parsed.map(d => d[v.key]).filter(x => x != null && !isNaN(x));
            const extent = d3.extent(arr.length ? arr : [0, 1]);
            if (extent[0] === extent[1]) { extent[0] = extent[0] - 1; extent[1] = extent[1] + 1; }

            // Only apply symlog to Precipitation; leave other variables linear.
            if (v.key === 'Precipitation') {
                const posVals = arr.filter(x => x > 0);
                const minPos = posVals.length ? d3.min(posVals) : null;
                const maxVal = extent[1];
                // choose a small offset to start slightly before zero
                const offset = minPos ? Math.max(minPos / 10, 0.1) : 0.1;
                const domainLower = -offset; // start a bit before zero
                const domainUpper = Math.max(1, maxVal);
                const s = d3.scaleSymlog().domain([domainLower, domainUpper]).range([pad, finalCellSize - pad]);
                s.constant(offset);
                scales[v.key] = s;
                scalesInfo[v.key] = 'symlog';
            } else {
                scales[v.key] = d3.scaleLinear().domain(extent).nice().range([pad, finalCellSize - pad]);
                scalesInfo[v.key] = 'linear';
            }
        });

        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                const cell = root.append('g').attr('transform', `translate(${j * finalCellSize},${i * finalCellSize})`);
                cell.append('rect').attr('class', 'cell').attr('width', finalCellSize).attr('height', finalCellSize).attr('fill', '#0b0b0b');

                const xi = vars[j];
                const yi = vars[i];

                if (i === j) { cell.append('text').attr('class', 'label').attr('x', finalCellSize / 2).attr('y', finalCellSize / 2).attr('text-anchor', 'middle').text(xi.label); continue; }

                const xa = scales[xi.key].copy().range([0, finalCellSize - pad * 2]);
                const ya = scales[yi.key].copy().range([finalCellSize - pad * 2, 0]);

                const points = parsed.filter(d => d[xi.key] != null && !isNaN(d[xi.key]) && d[yi.key] != null && !isNaN(d[yi.key]));

                // Drawing order: draw low-priority categories first so high-priority
                // categories are rendered on top. Cloudy & Rain should be at the bottom;
                // Severe, Fog, Windy should be drawn last (on top).
                const drawPriority = {
                    'Cloudy': 0,
                    'Rain': 0,
                    'Other': 1,
                    'Snow': 1,
                    'Clear': 1,
                    'Severe': 2,
                    'Fog': 2,
                    'Windy': 2
                };
                points.sort((a, b) => {
                    const pa = drawPriority[a._cat] !== undefined ? drawPriority[a._cat] : 1;
                    const pb = drawPriority[b._cat] !== undefined ? drawPriority[b._cat] : 1;
                    if (pa !== pb) return pa - pb; // lower priority first
                    // tie-breaker: preserve category order from catList
                    return (catList.indexOf(a._cat) - catList.indexOf(b._cat));
                });

                const cellG = cell.append('g').attr('transform', `translate(${pad},${pad})`);

                cellG.selectAll('circle').data(points).enter().append('circle')
                    .attr('cx', d => xa(d[xi.key]))
                    .attr('cy', d => ya(d[yi.key]))
                    .attr('r', POINT_SIZE)
                    .attr('fill', '#da2222f2')
                    .attr('opacity', 0.3);

                let xAxis = d3.axisBottom(xa).ticks(3).tickSize(2);
                let yAxis = d3.axisLeft(ya).ticks(3).tickSize(2);
                // If this axis is the precipitation axis, show the selected ticks only.
                if (xi.key === 'Precipitation') {
                    // candidate ticks updated per request
                    const candidates = [0, 1, 2, 5, 10, 40, 140];
                    const dom = scales[xi.key].domain();
                    const ticks = candidates.filter(t => t >= dom[0] && t <= dom[1]);
                    xAxis = d3.axisBottom(xa).tickValues(ticks).tickFormat(d3.format('d')).tickSize(2);
                } else if (scalesInfo[xi.key] === 'symlog') {
                    xAxis = d3.axisBottom(xa).ticks(5).tickFormat(d3.format('.2s')).tickSize(2);
                }
                if (yi.key === 'Precipitation') {
                    const candidatesY = [0, 1, 2, 5, 10, 20, 50, 140];
                    const domY = scales[yi.key].domain();
                    const ticksY = candidatesY.filter(t => t >= domY[0] && t <= domY[1]);
                    yAxis = d3.axisLeft(ya).tickValues(ticksY).tickFormat(d3.format('d')).tickSize(2);
                } else if (scalesInfo[yi.key] === 'symlog') {
                    yAxis = d3.axisLeft(ya).ticks(5).tickFormat(d3.format('.2s')).tickSize(2);
                }

                cellG.append('g').attr('transform', `translate(0,${finalCellSize - pad * 2})`).call(xAxis).selectAll('text').style('fill', '#aaa');
                cellG.append('g').call(yAxis).selectAll('text').style('fill', '#aaa');
            }
        }

        // Legend removed: all dots are now red, so no legend is needed.
    }

    btnRedraw && btnRedraw.addEventListener('click', draw);
    let resizeTimer = null;
    window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => draw(), 200); });

    draw();

})();
