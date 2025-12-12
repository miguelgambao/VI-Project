// bottom axis type: 'years' | 'weather'
let currentBottomAxis = 'years';
// graphs.js - builds a single bar chart showing years with the most accidents

	const csvPath = "../data/crashesFinal.csv";
	let barSvg = d3.select("#barSvg");
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
				// Weather condition groups
				const groupMap = {
					clear: ["clear"],
					foggy: ["fog"],
					rainy: ["rain", "heavy rain"],
					cloudy: ["mostly cloudy", "overcast", "partly cloudy"],
					snowy: ["snow"],
					windy: ["windy", "storm-level winds", "thunderstorms"]
				};
				for (const group of f.conds) {
					const subconds = groupMap[group];
					if (!subconds) continue;
					let found = false;
					for (const sub of subconds) {
						if (d.conditions.some(cond => cond.toLowerCase().includes(sub))) {
							found = true;
							break;
						}
					}
					if (!found) return false;
				}
			}
			return true;
		});
	}

	function renderCharts() {
		try {
			const barWrap = document.getElementById('barWrap');
			const barSvgEl = document.getElementById('barSvg');
			// Remove all SVGs except #barSvg (never remove #barSvg)
			if (barWrap) {
				barWrap.querySelectorAll('svg').forEach(svg => {
					if (svg.id !== 'barSvg') svg.remove();
				});
			}
			// If switching to line/bar and #barSvg is missing, recreate it
			let barSvgElCurrent = document.getElementById('barSvg');
			if (!barSvgElCurrent && currentChart !== 'scatter-matrix') {
				// Recreate #barSvg if missing
				const newSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
				newSvg.setAttribute('id', 'barSvg');
				const barWrapDiv = document.getElementById('barWrap');
				if (barWrapDiv) {
					barWrapDiv.insertBefore(newSvg, barWrapDiv.firstChild);
				}
				barSvgElCurrent = newSvg;
			}
			// Show or hide #barSvg depending on chart type
			if (barSvgElCurrent) {
				if (currentChart === 'scatter-matrix') {
					barSvgElCurrent.style.display = 'none';
				} else {
					barSvgElCurrent.style.display = 'block';
				}
				// Re-select barSvg in case it was hidden and D3 selection is stale
				barSvg = d3.select(barSvgElCurrent);
			}
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
					if (currentBottomAxis === 'years') {
						// use yearData for bar chart, each bar is a year, ordered right to left by value
						const sortedYearData = [...yearData].sort((a, b) => b.value - a.value).slice(0, 25);
						drawBar(sortedYearData);
					} else if (currentBottomAxis === 'weather') {
						// Only show conditions from the selected filter group(s)
						const groupMap = {
							clear: ["clear"],
							foggy: ["fog"],
							rainy: ["rain", "heavy rain"],
							cloudy: ["mostly cloudy", "overcast", "partly cloudy"],
							snowy: ["snow"],
							windy: ["windy", "storm-level winds", "thunderstorms"]
						};
						// Get selected filter groups
						const selectedGroups = Array.from(document.querySelectorAll('.conditionsList input[type="checkbox"]:checked')).map(cb => cb.dataset.cond);
						let allowedConds = [];
						for (const group of selectedGroups) {
							if (groupMap[group]) allowedConds = allowedConds.concat(groupMap[group]);
						}
						allowedConds = allowedConds.map(s => s.toLowerCase());
						const conditionCounts = {};
						for (const rec of filtered) {
							if (rec.conditions && rec.conditions.length) {
								for (const cond of rec.conditions) {
									const key = cond.trim().toLowerCase();
									if (!key) continue;
									if (allowedConds.length && !allowedConds.includes(key)) continue;
									if (!conditionCounts[key]) conditionCounts[key] = 0;
									conditionCounts[key] += currentAxis === 'crashes' ? 1 : (rec.fatal || 0);
								}
							}
						}
						let weatherCounts = Object.entries(conditionCounts).map(([cond, value]) => ({ year: cond.charAt(0).toUpperCase() + cond.slice(1), value }));
						weatherCounts = weatherCounts.sort((a, b) => b.value - a.value).slice(0, 25);
						drawBar(weatherCounts);
					}
					break;
				   case 'scatter-matrix':
					   // Hide #barSvg and draw scatter matrix SVG
					   drawScatterMatrix(filtered, all); // pass both filtered and full data
					   break;
				default:
					drawLine(yearData, startYear, endYear);
			}

		// Draws a scatter matrix (SPLOM) using a subset of weather variables
		function drawScatterMatrix(data) {
			const container = document.getElementById('barWrap');
			if (!container) return;
			// Only remove any existing SVGs that are not #barSvg
			container.querySelectorAll('svg').forEach(svg => {
				if (svg.id !== 'barSvg') svg.remove();
			});
			const VARS = [
				{ key: 'Temp_Avg', label: 'Temp Avg (°C)' },
				{ key: 'Precipitation', label: 'Precip (mm)' },
				{ key: 'Wind_Max', label: 'Wind (max)' },
				{ key: 'Cloud_Cover', label: 'Cloud (%)' },
				{ key: 'Pressure', label: 'Pressure (hPa)' }
			];
			   // Robust SPLOM logic from scatterplot.js
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
				   };
			   }
			   // Get columns from full data
			   const fullData = arguments.length > 1 ? arguments[1] : data;
			   const cols = fullData.length > 0 ? Object.keys(fullData[0]) : [];
			   const keys = detectCols(cols);
			   // Compute fixed extents from full data
			   const fixedExtents = {};
			   VARS.forEach(v => {
				   const arr = fullData.map(d => {
					   if (v.key === 'Temp_Avg') {
						   let tmax = keys.tempMax ? parseNum(d[keys.tempMax]) : null;
						   let tmin = keys.tempMin ? parseNum(d[keys.tempMin]) : null;
						   let tempAvg = null;
						   if (tmax != null && tmin != null) tempAvg = (tmax + tmin) / 2;
						   else if (tmax != null) tempAvg = tmax;
						   else if (tmin != null) tempAvg = tmin;
						   if (tempAvg == null) {
							   const tempCol = Object.keys(d).find(k => k.toLowerCase().includes('temp'));
							   if (tempCol) {
								   const v = parseNum(d[tempCol]);
								   if (v != null) tempAvg = v;
							   }
						   }
						   return tempAvg;
					   }
					   if (v.key === 'Precipitation') return keys.precip ? parseNum(d[keys.precip]) : null;
					   if (v.key === 'Wind_Max') return keys.wind ? parseNum(d[keys.wind]) : null;
					   if (v.key === 'Cloud_Cover') return keys.cloud ? parseNum(d[keys.cloud]) : null;
					   if (v.key === 'Pressure') return keys.pressure ? parseNum(d[keys.pressure]) : null;
					   return null;
				   }).filter(x => x != null && !isNaN(x));
				   let extent = d3.extent(arr.length ? arr : [0, 1]);
				   if (extent[0] === extent[1]) { extent[0] = extent[0] - 1; extent[1] = extent[1] + 1; }
				   fixedExtents[v.key] = extent;
			   });
			   // Parse and prepare data for SPLOM (filtered)
			   let parsed = data.map(d => {
				   let tmax = keys.tempMax ? parseNum(d[keys.tempMax]) : null;
				   let tmin = keys.tempMin ? parseNum(d[keys.tempMin]) : null;
				   let tempAvg = null;
				   if (tmax != null && tmin != null) tempAvg = (tmax + tmin) / 2;
				   else if (tmax != null) tempAvg = tmax;
				   else if (tmin != null) tempAvg = tmin;
				   if (tempAvg == null) {
					   const tempCol = Object.keys(d).find(k => k.toLowerCase().includes('temp'));
					   if (tempCol) {
						   const v = parseNum(d[tempCol]);
						   if (v != null) tempAvg = v;
					   }
				   }
				   const precip = keys.precip ? parseNum(d[keys.precip]) : null;
				   const wind = keys.wind ? parseNum(d[keys.wind]) : null;
				   const cloud = keys.cloud ? parseNum(d[keys.cloud]) : null;
				   const pressure = keys.pressure ? parseNum(d[keys.pressure]) : null;
				   return Object.assign({}, d, { Temp_Avg: tempAvg, Precipitation: precip, Wind_Max: wind, Cloud_Cover: cloud, Pressure: pressure });
			   });
			   parsed = parsed.filter(d => VARS.some(v => d[v.key] != null && !isNaN(d[v.key])));
			   const pad = 16;
			   const n = VARS.length;
			   const cellGap = 16; // horizontal gap between cells
			   // Use the chartBox's size, minus the controls row height
			   const chartBox = container;
			   const controlsRow = chartBox.querySelector('.chartControlsRow');
			   const boxRect = chartBox.getBoundingClientRect();
			   let controlsHeight = 0;
			   if (controlsRow) {
				   const crRect = controlsRow.getBoundingClientRect();
				   controlsHeight = crRect.height + 18; // add a little extra spacing
			   }
			   const w = boxRect.width || 600;
			   const h = (boxRect.height - controlsHeight) || 600;
			   const cellWidth = ((w - pad * 2) - cellGap * (n - 1)) / n;
			   const cellHeight = (h - pad * 2) / n;
			   const totalW = cellWidth * n + cellGap * (n - 1) + pad * 2;
			   const totalH = cellHeight * n + pad * 2;
			   const svg = d3.select(container).append('svg')
				   .attr('width', totalW)
				   .attr('height', totalH)
				   .style('display', 'block')
				   .style('position', 'absolute')
				   .style('top', 0)
				   .style('left', 0)
				   .style('right', 0)
				   .style('bottom', controlsHeight + 'px');
			   const root = svg.append('g').attr('transform', `translate(${pad},${pad})`);
			  // Scales (use fixed extents from full data)
			  const scales = {};
			  VARS.forEach(v => {
				  const extent = fixedExtents[v.key];
				  scales[v.key] = {
					  x: d3.scaleLinear().domain(extent).nice().range([pad, cellWidth - pad]),
					  y: d3.scaleLinear().domain(extent).nice().range([cellHeight - pad, pad])
				  };
			  });
			   // Helper to compute Pearson correlation
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
					   let xAxis = d3.axisBottom(xa).ticks(3).tickSize(2);
					   let yAxis = d3.axisLeft(ya).ticks(3).tickSize(2);
					   cellG.append('g').attr('transform', `translate(0,${cellHeight - pad})`).call(xAxis).selectAll('text').style('fill', '#aaa');
					   cellG.append('g').call(yAxis).selectAll('text').style('fill', '#aaa');
				   }
			   }
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

		// ...removed y-axis title label...
	}




	function drawBar(items) {
		// items: [{year, value}, ...]
		const container = document.getElementById('barWrap');
		const rect = container ? container.getBoundingClientRect() : { width: 600, height: 400 };
		const w = Math.max(320, rect.width || 420);
		const h = Math.max(320, rect.height || 320);
		barSvg.attr('width', w).attr('height', h);
		barSvg.selectAll('*').remove();

		// Increase bottom margin for more space for year labels
		const margin = { top: 40, right: 40, bottom: 110, left: 60 };
		const innerW = w - margin.left - margin.right;
		const innerH = h - margin.top - margin.bottom;
		const g = barSvg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

		let x;
		if (currentBottomAxis === 'weather') {
			x = d3.scalePoint()
				.domain(items.map(d => d.year))
				.range([0, innerW])
				.padding(0.5);
		} else {
			x = d3.scaleBand()
				.domain(items.map(d => d.year))
				.range([0, innerW])
				.padding(0.15);
		}
		// Use correct max value for y-axis
		let maxValue = 1;
		if (currentBottomAxis === 'weather') {
			maxValue = d3.max(items, d => d.value) || 1;
		} else if (currentAxis === 'crashes') {
			const allCounts = Array.from(d3.rollup(all, v => v.length, d => d.year).values());
			if (allCounts.length) maxValue = d3.max(allCounts) || 1;
		} else {
			const allFatal = Array.from(d3.rollup(all, v => d3.sum(v, d => d.fatal || 0), d => d.year).values());
			if (allFatal.length) maxValue = d3.max(allFatal) || 1;
		}
		const y = d3.scaleLinear()
			.domain([0, maxValue])
			.range([innerH, 0]);

		// x-axis with year tick labels for every bar, centered and visible
		const years = items.map(d => d.year);
		const xAxisG = g.append('g')
			.attr('transform', `translate(0,${innerH})`)
			.style('z-index', 20)
			.call(d3.axisBottom(x)
				.tickValues(years)
				.tickFormat(d => d)
			);
		xAxisG.selectAll('text')
			.attr('text-anchor', 'middle')
			.attr('x', 0)
			.attr('y', 18)
			.attr('transform', null)
			.style('fill', '#ddd')
			.style('font-size', '13px')
			.style('font-weight', 'bold')
			.style('display', 'block')
			.style('opacity', 1);

		// y-axis
		g.append('g')
			.call(d3.axisLeft(y));

		// bars
		if (currentBottomAxis === 'weather') {
			// Use scalePoint, draw bars centered at each point
			const barWidth = Math.max(24, innerW / (items.length * 2));
			g.selectAll('.bar')
				.data(items)
				.enter()
				.append('rect')
				.attr('class', 'bar')
				.attr('x', d => x(d.year) - barWidth / 2)
				.attr('y', d => y(d.value))
				.attr('width', barWidth)
				.attr('height', d => innerH - y(d.value))
				.attr('fill', '#e85555')
				.on('mouseenter', (event, d) => {
					const tt = d3.select('body').append('div').attr('class', 'tooltip').style('display', 'block');
					tt.html(`<div><strong>${d.year}</strong></div><div>${d.value} ${currentAxis === 'crashes' ? 'crashes' : 'fatalities'}</div>`)
						.style('left', (event.pageX + 10) + 'px').style('top', (event.pageY + 10) + 'px');
				})
				.on('mouseleave', () => { d3.selectAll('body .tooltip').remove(); });
		} else {
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
		}

		// ...removed value labels on top of bars...
	}

	// wire up control events
	function wireControls() {
	// Bottom axis controls: enable weather only for Bar (Ordered)
	const bottomAxisWrap = document.getElementById('bottomAxisControls');
	const weatherBtn = bottomAxisWrap ? bottomAxisWrap.querySelector('.bottomAxisBtn[data-type="weather"]') : null;
	const yearsBtn = bottomAxisWrap ? bottomAxisWrap.querySelector('.bottomAxisBtn[data-type="years"]') : null;
	const chartTypeWrap = document.getElementById('chartTypeControls');
	const axisTypeWrap = document.getElementById('axisTypeControls');
	const crashesBtn = axisTypeWrap ? axisTypeWrap.querySelector('.axisTypeBtn[data-type="crashes"]') : null;
	const fatalitiesBtn = axisTypeWrap ? axisTypeWrap.querySelector('.axisTypeBtn[data-type="fatalities"]') : null;

	function setButtonDisabled(btn, disabled) {
		if (!btn) return;
		if (disabled) {
			btn.classList.add('disabled');
			btn.disabled = true;
		} else {
			btn.classList.remove('disabled');
			btn.disabled = false;
		}
	}

	function updateButtonStates(chartType) {
		if (chartType === 'scatter-matrix') {
			setButtonDisabled(weatherBtn, true);
			setButtonDisabled(yearsBtn, true);
			setButtonDisabled(crashesBtn, true);
			setButtonDisabled(fatalitiesBtn, true);
		} else if (chartType === 'bar') {
			setButtonDisabled(weatherBtn, false);
			setButtonDisabled(yearsBtn, false);
			setButtonDisabled(crashesBtn, false);
			setButtonDisabled(fatalitiesBtn, false);
		} else {
			setButtonDisabled(weatherBtn, true);
			setButtonDisabled(yearsBtn, false);
			setButtonDisabled(crashesBtn, false);
			setButtonDisabled(fatalitiesBtn, false);
		}
		// If weatherBtn is disabled and active, switch to years
		if (weatherBtn && weatherBtn.classList.contains('active') && weatherBtn.disabled) {
			if (yearsBtn) yearsBtn.click();
		}
	}

	if (chartTypeWrap && weatherBtn) {
		chartTypeWrap.querySelectorAll('.chartTypeBtn').forEach(btn => {
			btn.addEventListener('click', () => {
				const t = btn.dataset.type;
				updateButtonStates(t);
			});
		});
	}
		// bottom axis controls
		if (bottomAxisWrap) {
			bottomAxisWrap.querySelectorAll('.bottomAxisBtn').forEach(btn => {
				btn.addEventListener('click', (e) => {
					const t = btn.dataset.type;
					if (!t) return;
					currentBottomAxis = t;
					bottomAxisWrap.querySelectorAll('.bottomAxisBtn').forEach(b => b.classList.remove('active'));
					btn.classList.add('active');
					renderCharts();
				});
			});
		}
		// Ensure correct state on initial load
		setTimeout(() => {
			// If a chart type button is marked .active, set currentChart accordingly
			const activeChartBtn = document.querySelector('.chartTypeBtn.active');
			if (activeChartBtn && activeChartBtn.dataset.type) {
				currentChart = activeChartBtn.dataset.type;
			}
			updateButtonStates(currentChart);
		}, 0);
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

		// Weather variable extraction (from scatterplot.js)
		function parseNum(v) {
			if (v == null) return null;
			const s = v.toString().trim().replace(/,/g, '.').replace(/[^0-9.\-]/g, '');
			if (s === '') return null;
			const n = parseFloat(s);
			return isNaN(n) ? null : n;
		}
		// Try to detect column names (for robustness)
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
			};
		}
		const weatherCols = detectCols(keys);
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
			// Weather variables
			const tmax = weatherCols.tempMax ? parseNum(d[weatherCols.tempMax]) : null;
			const tmin = weatherCols.tempMin ? parseNum(d[weatherCols.tempMin]) : null;
			const tempAvg = tmax != null && tmin != null ? (tmax + tmin) / 2 : (tmax != null ? tmax : tmin);
			const precip = weatherCols.precip ? parseNum(d[weatherCols.precip]) : null;
			const wind = weatherCols.wind ? parseNum(d[weatherCols.wind]) : null;
			const cloud = weatherCols.cloud ? parseNum(d[weatherCols.cloud]) : null;
			const pressure = weatherCols.pressure ? parseNum(d[weatherCols.pressure]) : null;
			return { lat, lon, year, dateStr, timeStr: timeKey ? d[timeKey] : '', locationStr: locationKey ? d[locationKey] : '', operatorStr: operatorKey ? d[operatorKey] : '', routeStr: routeKey ? d[routeKey] : '', typeStr: typeKey ? d[typeKey] : '', summaryStr: '', conditions, aboard, fatal, fatalPct, Temp_Avg: tempAvg, Precipitation: precip, Wind_Max: wind, Cloud_Cover: cloud, Pressure: pressure };
		}).filter(d => !isNaN(d.lat) && !isNaN(d.lon) && d.lat >= -90 && d.lat <= 90 && d.lon >= -180 && d.lon <= 180 && d.year);

		// populate grouped condition checkboxes
		const condContainer = document.getElementById('conditionsContainer');
		if (condContainer) {
			let html = '<div class="sliderTitle">Weather Conditions</div><div class="conditionsList">';
			const groups = [
				{ label: "Clear", value: "clear" },
				{ label: "Foggy", value: "foggy" },
				{ label: "Rainy", value: "rainy" },
				{ label: "Cloudy", value: "cloudy" },
				{ label: "Snowy", value: "snowy" },
				{ label: "Windy", value: "windy" }
			];
			groups.forEach((g, i) => {
				html += `<label class="condLabel"><input type="checkbox" id="gcond_${i}" data-cond="${g.value}"> ${g.label}</label>`;
			});
			html += '</div>';
			condContainer.innerHTML = html;
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

