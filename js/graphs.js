// graphs.js - builds a single bar chart showing years with the most accidents

	const csvPath = "../data/crashesFinal.csv";
	const barSvg = d3.select("#barSvg");
	let all = [];

	// current chart type: 'line' | 'pie'
	let currentChart = 'line';
	// axis type: 'crashes' | 'fatalities'
	let currentAxis = 'crashes';

	// slider elements (year dual-slider visuals and interactions)
	const startSlider = document.getElementById("startYear");
	const endSlider = document.getElementById("endYear");
	const yearLabel = document.getElementById("yearLabel");
	const sliderRange = document.getElementById("sliderRange");
	const sliderWrapper = document.getElementById("sliderWrapper");

	function updateSliderRange() {
		if (!startSlider || !endSlider || !sliderRange) return;
		const min = parseInt(startSlider.min);
		const max = parseInt(endSlider.max);
		const start = parseInt(startSlider.value);
		const end = parseInt(endSlider.value);

		const percentStart = ((start - min) / (max - min)) * 100;
		const percentEnd = ((end - min) / (max - min)) * 100;

		sliderRange.style.left = percentStart + "%";
		sliderRange.style.width = percentEnd - percentStart + "%";
	}

	function updateYear() {
		if (!startSlider || !endSlider || !yearLabel) return;
		let start = parseInt(startSlider.value);
		let end = parseInt(endSlider.value);
		if (start > end) start = end;
		if (end < start) end = start;
		startSlider.value = start;
		endSlider.value = end;
		yearLabel.textContent = `${start} - ${end}`;
		updateSliderRange();
		renderCharts();
	}

	function bringToFront(slider) {
		if (slider === startSlider) {
			startSlider.style.zIndex = 4;
			endSlider.style.zIndex = 3;
		} else {
			endSlider.style.zIndex = 4;
			startSlider.style.zIndex = 3;
		}
	}

	if (startSlider && endSlider) {
		startSlider.addEventListener('input', updateYear);
		endSlider.addEventListener('input', updateYear);

		[startSlider, endSlider].forEach((s) => {
			s.addEventListener('pointerdown', () => bringToFront(s));
			s.addEventListener('focus', () => bringToFront(s));
		});

		document.addEventListener('pointerup', () => {
			startSlider.style.zIndex = 3;
			endSlider.style.zIndex = 3;
		});

		// wrapper pointer handling to pick nearest thumb
		let activeSlider = null;
		let dragging = false;

		function pctFromEvent(e) {
			const rect = sliderWrapper.getBoundingClientRect();
			const x = e.clientX - rect.left;
			return Math.max(0, Math.min(1, x / rect.width));
		}

		function setSliderValueFromPct(slider, pct) {
			const min = parseInt(slider.min);
			const max = parseInt(slider.max);
			const val = Math.round(min + pct * (max - min));
			slider.value = val;
			updateYear();
		}

		sliderWrapper.addEventListener('pointerdown', (e) => {
			e.preventDefault();
			const pct = pctFromEvent(e);
			const min = parseInt(startSlider.min);
			const max = parseInt(endSlider.max);

			const startPct = (parseInt(startSlider.value) - min) / (max - min);
			const endPct = (parseInt(endSlider.value) - min) / (max - min);

			const distStart = Math.abs(pct - startPct);
			const distEnd = Math.abs(pct - endPct);
			if (distStart < distEnd) activeSlider = startSlider;
			else if (distEnd < distStart) activeSlider = endSlider;
			else {
				activeSlider = pct > startPct ? endSlider : startSlider;
			}
			bringToFront(activeSlider);
			dragging = true;
			setSliderValueFromPct(activeSlider, pct);
		});

		window.addEventListener('pointermove', (e) => {
			if (!dragging || !activeSlider) return;
			const pct = pctFromEvent(e);
			setSliderValueFromPct(activeSlider, pct);
		});

		window.addEventListener('pointerup', (e) => {
			if (dragging) {
				dragging = false;
				activeSlider = null;
				startSlider.style.zIndex = 3;
				endSlider.style.zIndex = 3;
			}
		});
	}

	// status helper for on-page message
	function setStatus(msg, isError) {
		// keep logging for debugging, but do not update the DOM (no visible loading UI)
		if (isError) console.error('graphs status:', msg); else console.log('graphs status:', msg);
	}

	// get filter values from DOM
	function getFilters() {
		const startY = parseInt(document.getElementById("startYear").value);
		const endY = parseInt(document.getElementById("endYear").value);
		const aboardStart = parseFloat(document.getElementById("startAboard").value || 0);
		const aboardEnd = parseFloat(document.getElementById("endAboard").value || 9999);
		const fatalStart = parseFloat(document.getElementById("startFatal").value || 0);
		const fatalEnd = parseFloat(document.getElementById("endFatal").value || 100);
		const conds = new Set();
		document.querySelectorAll('.conditionsList input[type="checkbox"]').forEach((cb) => { if (cb.checked) conds.add(cb.dataset.cond); });
		return { startY, endY, aboardStart, aboardEnd, fatalStart, fatalEnd, conds };
	}

	function filterData(data) {
		const f = getFilters();
		return data.filter((d) => {
			if (!d.year || d.year < f.startY || d.year > f.endY) return false;
			if (d.aboard == null || d.aboard < f.aboardStart || d.aboard > f.aboardEnd) return false;
			if (d.fatalPct == null || d.fatalPct < f.fatalStart || d.fatalPct > f.fatalEnd) return false;
			if (f.conds.size > 0) {
				if (!Array.isArray(d.conditions)) return false;
				for (const c of f.conds) if (!d.conditions.includes(c)) return false;
			}
			return true;
		});
	}

	function renderCharts() {
		try {
			const filtered = filterData(all);
			console.log('renderCharts - filtered length:', filtered.length);
			const countEl = document.getElementById("countDisplay"); if (countEl) countEl.textContent = new Intl.NumberFormat().format(filtered.length);

			const f = getFilters();
			const startYear = f.startY;
			const endYear = f.endY;
			// prepare counts by year
			let yearData;
			if (currentAxis === 'crashes') {
				const yearCounts = d3.rollup(filtered, v => v.length, d => d.year);
				const countsMap = new Map(yearCounts);
				yearData = [];
				for (let y = startYear; y <= endYear; y++) yearData.push({ year: y, value: countsMap.get(y) || 0 });
			} else {
				// fatalities by year
				const yearFatal = d3.rollup(filtered, v => d3.sum(v, d => d.fatal || 0), d => d.year);
				const fatalMap = new Map(yearFatal);
				yearData = [];
				for (let y = startYear; y <= endYear; y++) yearData.push({ year: y, value: fatalMap.get(y) || 0 });
			}

			// choose renderer based on current chart type
			switch (currentChart) {
				case 'line':
					drawLine(yearData, startYear, endYear);
					break;
				case 'bar':
					// use yearData for bar chart, each bar is a year, ordered right to left by value
					const sortedYearData = [...yearData].sort((a, b) => b.value - a.value);
					drawBar(sortedYearData);
					break;
				default:
					drawLine(yearData, startYear, endYear);
			}
		} catch (err) {
			console.error('renderCharts error', err);
			setStatus('Error rendering charts (see console)', true);
		}
	}


	function drawLine(data, startYear, endYear) {
		const container = document.getElementById('barWrap');
		const rect = container ? container.getBoundingClientRect() : { width: 600, height: 400 };
		console.log('drawLine - container rect:', rect, 'data length:', data.length);
		const w = Math.max(420, rect.width || 420);
		const h = Math.max(320, rect.height || 320);
		// leave extra bottom padding so overlay buttons don't cover axis/points
		const bottomPad = 100;
		barSvg.attr('width', w).attr('height', h);
		barSvg.selectAll('*').remove();

		const margin = { top: 20, right: 20, bottom: bottomPad, left: 60 };
		const innerW = w - margin.left - margin.right;
		const innerH = h - margin.top - margin.bottom;
		const g = barSvg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

		const x = d3.scaleLinear().domain([startYear, endYear]).range([0, innerW]);
		// use the global maximum (across the entire dataset) so the y-axis top stays constant
		let maxValue = 1;
		try {
			if (currentAxis === 'crashes') {
				const allCounts = Array.from(d3.rollup(all, v => v.length, d => d.year).values());
				if (allCounts.length) maxValue = d3.max(allCounts) || 1;
			} else {
				const allFatal = Array.from(d3.rollup(all, v => d3.sum(v, d => d.fatal || 0), d => d.year).values());
				if (allFatal.length) maxValue = d3.max(allFatal) || 1;
			}
		} catch (e) {
			maxValue = d3.max(data, d => d.value) || 1;
		}
		// set y domain exactly to the maximum (do not .nice() so top equals global maximum)
		const y = d3.scaleLinear().domain([0, maxValue]).range([innerH, 0]);

		// compute ticks so the top tick equals the maxValue; use more lines for easier reading
		const yTicks = d3.ticks(0, maxValue, 12);

		// draw subtle horizontal grid lines for easier reading (behind the chart)
		g.append('g').attr('class', 'grid')
			.selectAll('line').data(yTicks).enter().append('line')
			.attr('x1', 0).attr('x2', innerW)
			.attr('y1', d => y(d)).attr('y2', d => y(d))
			.attr('stroke', 'rgba(255,255,255,0.045)')
			.attr('stroke-width', 1);

		const line = d3.line().x(d => x(d.year)).y(d => y(d.value)).curve(d3.curveMonotoneX);

		// area under the line (subtle)
		const area = d3.area().x(d => x(d.year)).y0(innerH).y1(d => y(d.value)).curve(d3.curveMonotoneX);
		g.append('path').datum(data).attr('d', area).attr('fill', 'rgba(232,85,85,0.12)');

		g.append('path').datum(data).attr('d', line).attr('fill', 'none').attr('stroke', '#e85555').attr('stroke-width', 2);

		// points
		g.selectAll('circle.point').data(data).enter().append('circle')
			.attr('class', 'point')
			.attr('cx', d => x(d.year))
			.attr('cy', d => y(d.value))
			.attr('r', 3)
			.attr('fill', '#fff')
			.attr('stroke', '#e85555')
			.attr('stroke-width', 1)
			.on('mouseenter', (event, d) => {
				const tt = d3.select('body').append('div').attr('class', 'tooltip').style('display', 'block');
				if (currentAxis === 'crashes') {
					tt.html(`<div><strong>${d.year}</strong></div><div>${d.value} crashes</div>`)
						.style('left', (event.pageX + 10) + 'px').style('top', (event.pageY + 10) + 'px');
				} else {
					tt.html(`<div><strong>${d.year}</strong></div><div>${d.value} fatalities</div>`)
						.style('left', (event.pageX + 10) + 'px').style('top', (event.pageY + 10) + 'px');
				}
			})
			.on('mouseleave', () => { d3.selectAll('body .tooltip').remove(); });

		// x axis ticks: pick a reasonable step so labels don't overlap
		const range = endYear - startYear;
		const approxTicks = Math.min(12, Math.max(1, Math.floor(range / 5)));
		const step = Math.max(1, Math.floor(range / approxTicks));
		const ticks = d3.range(startYear, endYear + 1, step);

		const xAxis = d3.axisBottom(x).tickValues(ticks).tickFormat(d3.format('d'));
		// compute ticks so the top tick equals the maxValue (reuse yTicks declared above)
		const yAxis = d3.axisLeft(y).tickValues(yTicks);

		g.append('g').attr('transform', `translate(0,${innerH})`).call(xAxis).selectAll('text').style('fill', '#ddd').style('font-size', '11px');
		g.append('g').call(yAxis).selectAll('text').style('fill', '#ddd').style('font-size', '11px');

		// y label
		g.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('y', -45)
			.attr('x', -innerH / 2)
			.attr('dy', '1em')
			.style('text-anchor', 'middle')
			.style('fill', '#ddd')
			.style('font-size', '12px')
			.text(currentAxis === 'crashes' ? 'Crashes' : 'Fatalities');
	}




	function drawBar(items) {
		// items: [{year, value}, ...]
		const container = document.getElementById('barWrap');
		const rect = container ? container.getBoundingClientRect() : { width: 600, height: 400 };
		const w = Math.max(320, rect.width || 420);
		const h = Math.max(320, rect.height || 320);
		barSvg.attr('width', w).attr('height', h);
		barSvg.selectAll('*').remove();

		const margin = { top: 40, right: 40, bottom: 60, left: 60 };
		const innerW = w - margin.left - margin.right;
		const innerH = h - margin.top - margin.bottom;
		const g = barSvg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

		const x = d3.scaleBand()
			.domain(items.map(d => d.year))
			.range([0, innerW])
			.padding(0.15);
		const y = d3.scaleLinear()
			.domain([0, d3.max(items, d => d.value)])
			.range([innerH, 0]);

		// x-axis
		g.append('g')
			.attr('transform', `translate(0,${innerH})`)
			.call(d3.axisBottom(x).tickFormat(d => d))
			.selectAll('text')
			.attr('transform', 'rotate(-45)')
			.style('text-anchor', 'end');

		// y-axis
		g.append('g')
			.call(d3.axisLeft(y));

		// bars
		g.selectAll('.bar')
			.data(items)
			.enter()
			.append('rect')
			.attr('class', 'bar')
			.attr('x', d => x(d.year))
			.attr('y', d => y(d.value))
			.attr('width', x.bandwidth())
			.attr('height', d => innerH - y(d.value))
			.attr('fill', '#e85555')
			.on('mouseenter', (event, d) => {
				const tt = d3.select('body').append('div').attr('class', 'tooltip').style('display', 'block');
				tt.html(`<div><strong>${d.year}</strong></div><div>${d.value} ${currentAxis === 'crashes' ? 'crashes' : 'fatalities'}</div>`)
					.style('left', (event.pageX + 10) + 'px').style('top', (event.pageY + 10) + 'px');
			})
			.on('mouseleave', () => { d3.selectAll('body .tooltip').remove(); });

		// ...removed value labels on top of bars...
	}

	// wire up control events
	function wireControls() {
		["startYear", "endYear", "startAboard", "endAboard", "startFatal", "endFatal"].forEach(id => {
			const el = document.getElementById(id);
			if (el) el.addEventListener('input', () => { renderCharts(); });
		});
		const condContainer = document.getElementById('conditionsContainer');
		if (condContainer) condContainer.addEventListener('change', (e) => { renderCharts(); });
		window.addEventListener('resize', () => { clearTimeout(window.__graphsResize); window.__graphsResize = setTimeout(renderCharts, 120); });
	}

	function initChartTypeButtons() {
		const chartWrap = document.getElementById('chartTypeControls');
		if (chartWrap) {
			chartWrap.querySelectorAll('.chartTypeBtn').forEach(btn => {
				btn.addEventListener('click', (e) => {
					const t = btn.dataset.type;
					if (!t) return;
					currentChart = t;
					chartWrap.querySelectorAll('.chartTypeBtn').forEach(b => b.classList.remove('active'));
					btn.classList.add('active');
					renderCharts();
				});
			});
		}
		// axis type buttons
		const axisWrap = document.getElementById('axisTypeControls');
		if (axisWrap) {
			axisWrap.querySelectorAll('.axisTypeBtn').forEach(btn => {
				btn.addEventListener('click', (e) => {
					const t = btn.dataset.type;
					if (!t) return;
					currentAxis = t;
					axisWrap.querySelectorAll('.axisTypeBtn').forEach(b => b.classList.remove('active'));
					btn.classList.add('active');
					renderCharts();
				});
			});
		}
	}

	// Generic setup for dual sliders (aboard/fatal) — adapted from map page
	function setupDual(wrapperId, startId, endId, rangeId, labelId, hasValues, isPercent = false) {
		const wrapper = document.getElementById(wrapperId);
		const start = document.getElementById(startId);
		const end = document.getElementById(endId);
		const rangeEl = document.getElementById(rangeId);
		const label = document.getElementById(labelId);

		function updateRange() {
			if (!start || !end || !rangeEl) return;
			const min = parseFloat(start.min);
			const max = parseFloat(start.max);
			const s = parseFloat(start.value);
			const e = parseFloat(end.value);
			let percentStart = ((s - min) / (max - min)) * 100;
			let percentEnd = ((e - min) / (max - min)) * 100;
			rangeEl.style.left = percentStart + "%";
			rangeEl.style.width = percentEnd - percentStart + "%";
			if (label) {
				if (isPercent) label.textContent = `${s}% - ${e}%`;
				else label.textContent = `${s} - ${e}`;
			}
		}

		if (!hasValues) return { updateRange: () => { } };

		start.addEventListener('input', () => {
			let sv = parseFloat(start.value);
			let ev = parseFloat(end.value);
			if (sv > ev) sv = ev;
			start.value = sv;
			updateRange();
			renderCharts();
		});
		end.addEventListener('input', () => {
			let sv = parseFloat(start.value);
			let ev = parseFloat(end.value);
			if (ev < sv) ev = sv;
			end.value = ev;
			updateRange();
			renderCharts();
		});

		[start, end].forEach((s) => {
			if (!s) return;
			s.addEventListener('pointerdown', () => { s.style.zIndex = 4; });
		});

		// wrapper pointer handling
		let active = null;
		let draggingLocal = false;

		function pctFromEventLocal(e) {
			if (!wrapper || !start) return 0;
			const rect = wrapper.getBoundingClientRect();
			const x = e.clientX - rect.left;
			return Math.max(0, Math.min(1, x / rect.width));
		}

		function setValFromPct(slider, pct) {
			const min = parseFloat(slider.min);
			const max = parseFloat(slider.max);
			const val = Math.round(min + pct * (max - min));
			slider.value = val;
			slider.dispatchEvent(new Event('input'));
		}

		if (wrapper) {
			wrapper.addEventListener('pointerdown', (e) => {
				e.preventDefault();
				const pct = pctFromEventLocal(e);
				const min = parseFloat(start.min);
				const max = parseFloat(start.max);
				const sPct = (parseFloat(start.value) - min) / (max - min);
				const ePct = (parseFloat(end.value) - min) / (max - min);
				const dS = Math.abs(pct - sPct);
				const dE = Math.abs(pct - ePct);
				active = dS < dE ? start : (dE < dS ? end : (pct > sPct ? end : start));
				draggingLocal = true;
				setValFromPct(active, pct);
			});

			window.addEventListener('pointermove', (e) => {
				if (!draggingLocal || !active) return;
				const pct = pctFromEventLocal(e);
				setValFromPct(active, pct);
			});

			window.addEventListener('pointerup', () => {
				if (draggingLocal) {
					draggingLocal = false;
					active = null;
					if (start) start.style.zIndex = 3;
					if (end) end.style.zIndex = 3;
				}
			});
		}

		updateRange();
		return { updateRange };
	}

	// parse CSV and initialize
	d3.dsv(';', csvPath).then(raw => {
		if (!raw || raw.length === 0) {
			console.error('CSV loaded but empty');
			return;
		}

		const keys = Object.keys(raw[0]);
		const latKey = keys.find(k => k.toLowerCase().includes('lat'));
		const lonKey = keys.find(k => k.toLowerCase().includes('lon'));
		const dateKey = keys.find(k => k.toLowerCase().includes('date'));
		const timeKey = keys.find(k => k.toLowerCase().includes('time'));
		const locationKey = keys.find(k => k.toLowerCase().includes('location'));
		const operatorKey = keys.find(k => k.toLowerCase().includes('operator'));
		const routeKey = keys.find(k => k.toLowerCase().includes('route'));
		const typeKey = keys.find(k => k.toLowerCase().includes('type'));
		const generalKey = keys.find(k => k.toLowerCase().includes('general') || k.toLowerCase().includes('condition') || k.toLowerCase().includes('weather'));
		const aboardKey = keys.find(k => k.toLowerCase().includes('aboard') || k.toLowerCase().includes('abo'));
		const fatalKey = keys.find(k => k.toLowerCase().includes('fatal') || k.toLowerCase().includes('death') || k.toLowerCase().includes('fat'));

		all = raw.map(d => {
			// parse lat/lon if present
			let lat = null;
			let lon = null;
			if (latKey) {
				let rawLat = (d[latKey] ?? '').toString().trim().replace(',', '.');
				rawLat = rawLat.replace(/[^\d.\-]/g, '');
				lat = rawLat === '' ? NaN : parseFloat(rawLat);
			}
			if (lonKey) {
				let rawLon = (d[lonKey] ?? '').toString().trim().replace(',', '.');
				rawLon = rawLon.replace(/[^\d.\-]/g, '');
				lon = rawLon === '' ? NaN : parseFloat(rawLon);
			}
			const dateStr = dateKey ? d[dateKey] : null;
			let year = null;
			if (dateStr) { const dt = new Date(dateStr); if (!isNaN(dt)) year = dt.getFullYear(); }
			const condRaw = generalKey ? d[generalKey] || '' : '';
			const conditions = (condRaw || '').toString().split(/[;,]/).map(s => s.trim()).filter(Boolean);
			let aboard = null; if (aboardKey && d[aboardKey] != null) { let r = d[aboardKey].toString().replace(/,/g, '').replace(/[^\d.\-]/g, ''); aboard = r === '' ? null : parseFloat(r); }
			let fatal = null; if (fatalKey && d[fatalKey] != null) { let r = d[fatalKey].toString().replace(/,/g, '').replace(/[^\d.\-]/g, ''); fatal = r === '' ? null : parseFloat(r); }
			let fatalPct = null; if (aboard != null && aboard > 0 && fatal != null && !isNaN(fatal)) fatalPct = (fatal / aboard) * 100;
			return { lat, lon, year, dateStr, timeStr: timeKey ? d[timeKey] : '', locationStr: locationKey ? d[locationKey] : '', operatorStr: operatorKey ? d[operatorKey] : '', routeStr: routeKey ? d[routeKey] : '', typeStr: typeKey ? d[typeKey] : '', summaryStr: '', conditions, aboard, fatal, fatalPct };
		}).filter(d => !isNaN(d.lat) && !isNaN(d.lon) && d.lat >= -90 && d.lat <= 90 && d.lon >= -180 && d.lon <= 180 && d.year);

		// populate condition checkboxes
		const condSet = new Set(); all.forEach(d => d.conditions.forEach(c => condSet.add(c)));
		const conds = Array.from(condSet).sort();
		const condContainer = document.getElementById('conditionsContainer');
		if (condContainer) {
			if (conds.length === 0) condContainer.innerHTML = '<div class="sliderTitle">Weather Conditions</div><div class="sliderValue">n/a</div>';
			else {
				let html = '<div class="sliderTitle">Weather Conditions</div><div class="conditionsList">';
				conds.forEach((c, i) => { html += `<label class="condLabel"><input type="checkbox" id="gcond_${i}" data-cond="${c}"> ${c}</label>`; });
				html += '</div>';
				condContainer.innerHTML = html;
			}
		}

		console.log('CSV parsed - raw rows:', raw.length, 'records with year:', all.length);

		wireControls();

		// chart type buttons
		initChartTypeButtons();

		// set year slider bounds
		if (all.length > 0) {
			const years = all.map(d => d.year);
			const ymin = Math.min(...years); const ymax = Math.max(...years);
			const sy = document.getElementById('startYear'); const ey = document.getElementById('endYear');
			if (sy && ey) {
				sy.min = ymin; sy.max = ymax; ey.min = ymin; ey.max = ymax; sy.value = ymin; ey.value = ymax;
			}
			const ylab = document.getElementById('yearLabel'); if (ylab) ylab.textContent = `${ymin} - ${ymax}`;
		}

		// update year slider visuals
		updateSliderRange();

		// compute aboard/fatal presence and initialize dual sliders for them
		const aboardVals = all.map(d => d.aboard).filter(v => v != null && !isNaN(v));
		const fatalVals = all.map(d => d.fatalPct).filter(v => v != null && !isNaN(v));
		const hasAboard = aboardVals.length > 0;
		const hasFatal = fatalVals.length > 0;

		// initialize slider input ranges and labels
		if (hasAboard) {
			const aMin = Math.min(...aboardVals);
			const aMax = Math.max(...aboardVals);
			const sA = document.getElementById('startAboard');
			const eA = document.getElementById('endAboard');
			if (sA && eA) {
				sA.min = aMin; sA.max = aMax; eA.min = aMin; eA.max = aMax; sA.value = aMin; eA.value = aMax;
			}
			const al = document.getElementById('aboardLabel'); if (al) al.textContent = `${aMin} - ${aMax}`;
		} else {
			const sc = document.getElementById('sliderContainerAboard'); if (sc) sc.style.opacity = 0.5;
			const al = document.getElementById('aboardLabel'); if (al) al.textContent = 'n/a';
		}

		if (hasFatal) {
			const sF = document.getElementById('startFatal');
			const eF = document.getElementById('endFatal');
			if (sF && eF) {
				sF.min = 0; sF.max = 100; eF.min = 0; eF.max = 100; sF.value = 0; eF.value = 100;
			}
			const fl = document.getElementById('fatalLabel'); if (fl) fl.textContent = '0% - 100%';
		} else {
			const sc = document.getElementById('sliderContainerFatal'); if (sc) sc.style.opacity = 0.5;
			const fl = document.getElementById('fatalLabel'); if (fl) fl.textContent = 'n/a';
		}

		const aboardSetup = setupDual('sliderWrapperAboard', 'startAboard', 'endAboard', 'sliderRangeAboard', 'aboardLabel', hasAboard, false);
		const fatalSetup = setupDual('sliderWrapperFatal', 'startFatal', 'endFatal', 'sliderRangeFatal', 'fatalLabel', hasFatal, true);

		renderCharts();
	}).catch(err => { console.error('failed to load CSV', err); const cc = document.getElementById('conditionsContainer'); if (cc) cc.innerHTML = '<div class="sliderTitle">Weather Conditions</div><div class="sliderValue">CSV load failed</div>'; });

// ...existing code...

