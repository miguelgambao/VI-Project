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
        try { data = await d3.dsv(';', 'crashesFinal.csv'); }
        catch (err) { container.append('div').text('Failed to load crashesFinal.csv — serve files via a local server.'); console.error(err); return; }
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
        const color = d3.scaleOrdinal(d3.schemeCategory10).domain(categories);

        const pad = 16;
        const vars = VARS;
        const n = vars.length;

        // Force a minimum size that exceeds viewport so content scrolls
        // Use window dimensions as the base, not container (which is limited by layout)
        const minCellSize = 150; // minimum cell size to force scrolling
        const totalW = minCellSize * n + pad * 2;
        const totalH = minCellSize * n + pad * 2;
        const finalCellSize = minCellSize;

        const svg = container.append('svg').attr('width', totalW).attr('height', totalH).style('display', 'block');
        const content = svg.append('g'); // zoom/pan layer
        const root = content.append('g').attr('transform', `translate(${pad},${pad})`);

        const scales = {};
        vars.forEach(v => {
            const arr = parsed.map(d => d[v.key]).filter(x => x != null && !isNaN(x));
            const extent = d3.extent(arr.length ? arr : [0, 1]);
            if (extent[0] === extent[1]) { extent[0] = extent[0] - 1; extent[1] = extent[1] + 1; }
            scales[v.key] = d3.scaleLinear().domain(extent).nice().range([pad, finalCellSize - pad]);
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

                const cellG = cell.append('g').attr('transform', `translate(${pad},${pad})`);

                cellG.selectAll('circle').data(points).enter().append('circle')
                    .attr('cx', d => xa(d[xi.key]))
                    .attr('cy', d => ya(d[yi.key]))
                    .attr('r', POINT_SIZE)
                    .attr('fill', d => color(d._cat))
                    .attr('opacity', 0.7);

                const xAxis = d3.axisBottom(xa).ticks(3).tickSize(2);
                const yAxis = d3.axisLeft(ya).ticks(3).tickSize(2);

                cellG.append('g').attr('transform', `translate(0,${finalCellSize - pad * 2})`).call(xAxis).selectAll('text').style('fill', '#aaa');
                cellG.append('g').call(yAxis).selectAll('text').style('fill', '#aaa');
            }
        }

        const legend = content.append('g').attr('class', 'splom-legend').attr('transform', `translate(${totalW - 160},${8})`);
        categories.forEach((c, idx) => { const ly = idx * 18; legend.append('rect').attr('x', 0).attr('y', ly).attr('width', 12).attr('height', 12).attr('fill', color(c)); legend.append('text').attr('x', 18).attr('y', ly + 10).text(c).attr('fill', '#ddd').style('font-size', '12px'); });
    }

    btnRedraw && btnRedraw.addEventListener('click', draw);
    let resizeTimer = null;
    window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => draw(), 200); });

    draw();

})();
