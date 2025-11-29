function getMapSize() {
  const wrap = document.getElementById("mapWrap");
  // If a map wrapper exists (with the filters to the right), use its width
  // so the map occupies the remaining ~80% of the screen. Fall back to
  // window size if it's not available.
  const w = wrap ? wrap.clientWidth : Math.floor(window.innerWidth * 0.8);
  const h = wrap ? wrap.clientHeight : Math.floor(window.innerHeight * 0.85);
  return { w, h };
}

let { w: width, h: height } = getMapSize();

const svg = d3.select("svg");
svg.attr("width", width).attr("height", height);

let projection = d3
  .geoNaturalEarth1()
  .scale(width / 6)
  .translate([width / 2, height / 2]);

const path = d3.geoPath().projection(() => projection()).projection(projection);
const g = svg.append("g");

// tooltip element (hidden until hover)
const tooltip = d3
  .select("body")
  .append("div")
  .attr("class", "tooltip")
  .style("display", "none");

// dot sizing configuration (these are desired on-screen radii in pixels).
// We convert them to element `r` by dividing by the current zoom scale so
// group scaling doesn't amplify sizes unexpectedly.
const DOT_SCREEN_BASE = 1.3; // base on-screen radius at k ~= 1
const DOT_SCREEN_MIN = 0.5; // minimum on-screen radius in px
const DOT_SCREEN_MAX = 20; // maximum on-screen radius in px (visual cap)

let _currentZoomK = 1;
const zoom = d3
  .zoom()
  .scaleExtent([1, 100])
  .on("zoom", (event) => {
    const { transform } = event;
    _currentZoomK = transform.k;
    g.attr("transform", transform);
    // Compute desired on-screen radius (use a gentle sqrt(k) growth), clamp,
    // then divide by k to get the SVG `r` value because the group itself is
    // scaled by `k` via the transform.
    const screenR = Math.max(
      DOT_SCREEN_MIN,
      Math.min(DOT_SCREEN_BASE * Math.sqrt(transform.k), DOT_SCREEN_MAX)
    );
    const elR = screenR / transform.k;
    g.selectAll("circle.dot").attr("r", elR);
    g.selectAll("path.route").style("stroke-width", 0.6 / transform.k + "px");
  });
svg.call(zoom);

let allLocations = [];
let filters = {};

const startSlider = document.getElementById("startYear");
const endSlider = document.getElementById("endYear");
const yearLabel = document.getElementById("yearLabel");
const sliderRange = document.getElementById("sliderRange");
const sliderWrapper = document.getElementById("sliderWrapper");

function updateSliderRange() {
  const min = parseInt(startSlider.min);
  const max = parseInt(endSlider.max);
  const start = parseInt(startSlider.value);
  const end = parseInt(endSlider.value);

  // Use percent positions so the colored range and thumbs align with the visual track
  const percentStart = ((start - min) / (max - min)) * 100;
  const percentEnd = ((end - min) / (max - min)) * 100;

  sliderRange.style.left = percentStart + "%";
  sliderRange.style.width = percentEnd - percentStart + "%";
}

// Load map + CSV
Promise.all([
  fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then(
    (r) => r.json()
  ),
  d3.dsv(";", "crashesFinal.csv"),
]).then(([worldData, crashData]) => {
  // Detect columns
  const keys = Object.keys(crashData[0]);
  const latKey = keys.find((k) => k.toLowerCase().includes("lat"));
  const lonKey = keys.find((k) => k.toLowerCase().includes("lon"));
  const dateKey = keys.find((k) => k.toLowerCase().includes("date"));
  const timeKey = keys.find((k) => k.toLowerCase().includes("time"));
  const locationKey = keys.find((k) => k.toLowerCase().includes("location"));
  const operatorKey = keys.find((k) => k.toLowerCase().includes("operator"));
  const routeKey = keys.find((k) => k.toLowerCase().includes("route"));
  const typeKey = keys.find((k) => k.toLowerCase().includes("type"));
  const summaryKey = keys.find((k) => k.toLowerCase().includes("summary"));
  const generalKey = keys.find(
    (k) =>
      k.toLowerCase().includes("general") ||
      k.toLowerCase().includes("condition") ||
      k.toLowerCase().includes("weather")
  );
  const aboardKey = keys.find(
    (k) => k.toLowerCase().includes("aboard") || k.toLowerCase().includes("abo")
  );
  const fatalKey = keys.find(
    (k) =>
      k.toLowerCase().includes("fatal") ||
      k.toLowerCase().includes("death") ||
      k.toLowerCase().includes("fat")
  );
  // optional starting/origin coordinate columns (if present in CSV)
  const startLatKey = keys.find(
    (k) =>
      (k.toLowerCase().includes("start") && k.toLowerCase().includes("lat")) ||
      (k.toLowerCase().includes("origin") && k.toLowerCase().includes("lat")) ||
      (k.toLowerCase().includes("orig") && k.toLowerCase().includes("lat"))
  );
  const startLonKey = keys.find(
    (k) =>
      (k.toLowerCase().includes("start") && k.toLowerCase().includes("lon")) ||
      (k.toLowerCase().includes("origin") && k.toLowerCase().includes("lon")) ||
      (k.toLowerCase().includes("orig") && k.toLowerCase().includes("lon"))
  );

  if (!latKey || !lonKey || !dateKey) {
    console.error("Missing lat/lon/date columns");
    return;
  }

  allLocations = crashData
    .map((d) => {
      let rawLat = (d[latKey] ?? "").toString().trim().replace(",", ".");
      let rawLon = (d[lonKey] ?? "").toString().trim().replace(",", ".");
      rawLat = rawLat.replace(/[^\d.\-]/g, "");
      rawLon = rawLon.replace(/[^\d.\-]/g, "");

      let lat = parseFloat(rawLat);
      let lon = parseFloat(rawLon);

      // optional starting/origin coordinates
      let startLat = null;
      let startLon = null;
      if (startLatKey && d[startLatKey] != null) {
        let raw = d[startLatKey].toString().trim().replace(",", ".");
        raw = raw.replace(/[^\d.\-]/g, "");
        startLat = raw === "" ? null : parseFloat(raw);
      }
      if (startLonKey && d[startLonKey] != null) {
        let raw = d[startLonKey].toString().trim().replace(",", ".");
        raw = raw.replace(/[^\d.\-]/g, "");
        startLon = raw === "" ? null : parseFloat(raw);
      }

      let year = null;
      let dateStr = null;
      if (d[dateKey]) {
        dateStr = d[dateKey];
        let dt = new Date(d[dateKey]);
        if (!isNaN(dt)) year = dt.getFullYear();
      }

      const timeStr = timeKey ? d[timeKey] || "" : "";
      const locationStr = locationKey ? d[locationKey] || "" : "";
      const operatorStr = operatorKey ? d[operatorKey] || "" : "";
      const routeStr = routeKey ? d[routeKey] || "" : "";
      const typeStr = typeKey ? d[typeKey] || "" : "";
      const summaryStr = summaryKey ? d[summaryKey] || "" : "";
      const condRaw = generalKey ? d[generalKey] || "" : "";
      const conditions = (condRaw || "")
        .toString()
        .split(/[;,]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.replace(/\s+/g, " ").trim());

      // parse aboard/fatal values if columns exist
      let aboard = null;
      if (aboardKey && d[aboardKey] != null) {
        let raw = d[aboardKey].toString().trim().replace(/,/g, "");
        raw = raw.replace(/[^\d.\-]/g, "");
        aboard = raw === "" ? null : parseFloat(raw);
      }
      let fatal = null;
      if (fatalKey && d[fatalKey] != null) {
        let raw = d[fatalKey].toString().trim().replace(/,/g, "");
        raw = raw.replace(/[^\d.\-]/g, "");
        fatal = raw === "" ? null : parseFloat(raw);
      }

      // compute fatal percentage if both aboard and fatal present
      let fatalPct = null;
      if (aboard != null && aboard > 0 && fatal != null && !isNaN(fatal)) {
        fatalPct = (fatal / aboard) * 100;
      }

      return {
        lat,
        lon,
        year,
        dateStr,
        timeStr,
        locationStr,
        operatorStr,
        routeStr,
        typeStr,
        summaryStr,
        conditions,
        aboard,
        fatal,
        fatalPct,
        startLat,
        startLon,
      };
    })
    .filter(
      (d) =>
        !isNaN(d.lat) &&
        !isNaN(d.lon) &&
        d.lat >= -90 &&
        d.lat <= 90 &&
        d.lon >= -180 &&
        d.lon <= 180 &&
        d.year
    );

  // compute min/max for aboard and fatal if available
  let aboardVals = allLocations
    .map((d) => d.aboard)
    .filter((v) => v != null && !isNaN(v));
  // use fatal percentage values for percent-based filtering
  let fatalVals = allLocations
    .map((d) => d.fatalPct)
    .filter((v) => v != null && !isNaN(v));
  const hasAboard = aboardVals.length > 0;
  const hasFatal = fatalVals.length > 0;
  const aboardMin = hasAboard ? Math.min(...aboardVals) : 0;
  const aboardMax = hasAboard ? Math.max(...aboardVals) : 0;
  // fatal percent slider will be percentage-based (0-100)
  const fatalMin = 0;
  const fatalMax = 100;

  // Draw map
  const countries = topojson.feature(worldData, worldData.objects.countries);
  g.append("path").datum(countries).attr("d", path).attr("class", "country");

  // ensure the SVG has explicit pixel dimensions so transforms use the correct
  // viewport size. We'll also compute translateExtent from the projected
  // country bounds and set up a resize handler to update everything when the
  // container size changes (so the map occupies the left area when the
  // filters occupy the right column).
  svg.attr("width", width).attr("height", height);

  function computeAndApplyExtent() {
    // recompute projection based on current container size
    ({ w: width, h: height } = getMapSize());
    svg.attr("width", width).attr("height", height);
    projection.scale(width / 6).translate([width / 2, height / 2]);
    // ensure path generator uses updated projection
    path.projection(projection);
    // update country path geometry
    g.selectAll("path.country").attr("d", path);

    // compute bounds from the countries geometry and apply padding
    const b = path.bounds(countries);
    const pad = 20;
    const extent = [
      [b[0][0] - pad, b[0][1] - pad],
      [b[1][0] + pad, b[1][1] + pad],
    ];

    zoom.translateExtent(extent);
    svg.call(zoom);
  }

  // initial extent application
  computeAndApplyExtent();

  // update map sizing and bounds when window resizes so the map occupies the
  // space left after the right-hand filter panel (responsive behavior)
  window.addEventListener("resize", () => {
    // small throttle to avoid thrashing on rapid resize
    clearTimeout(window.__mapResizeTimer);
    window.__mapResizeTimer = setTimeout(() => {
      computeAndApplyExtent();
      // re-render dots/routes to new projected positions
      drawDots();
    }, 120);
  });

  // Initialize filters (global `filters` declared earlier)
  filters.yearStart = parseInt(startSlider.value);
  filters.yearEnd = parseInt(endSlider.value);
  filters.aboardStart = aboardMin;
  filters.aboardEnd = aboardMax;
  filters.fatalStart = fatalMin;
  filters.fatalEnd = fatalMax;
  // show route lines by default
  filters.showRoutes = true;

  // setup Aboard slider values if available
  if (hasAboard) {
    document.getElementById("startAboard").min = aboardMin;
    document.getElementById("startAboard").max = aboardMax;
    document.getElementById("endAboard").min = aboardMin;
    document.getElementById("endAboard").max = aboardMax;
    document.getElementById("startAboard").value = aboardMin;
    document.getElementById("endAboard").value = aboardMax;
    document.getElementById(
      "aboardLabel"
    ).textContent = `${aboardMin} - ${aboardMax}`;
  } else {
    document.getElementById ("sliderContainerAboard").style.opacity = 0.5;
    document.getElementById("aboardLabel").textContent = "n/a";
  }

  if (hasFatal) {
    // Fatalities use percentage of aboard (0-100)
    document.getElementById("startFatal").min = 0;
    document.getElementById("startFatal").max = 100;
    document.getElementById("endFatal").min = 0;
    document.getElementById("endFatal").max = 100;
    document.getElementById("startFatal").value = 0;
    document.getElementById("endFatal").value = 100;
    document.getElementById("fatalLabel").textContent = `0% - 100%`;
  } else {
    document.getElementById("sliderContainerFatal").style.opacity = 0.5;
    document.getElementById("fatalLabel").textContent = "n/a";
  }

  // wire up route toggle button
  const toggleBtn = document.getElementById("toggleRoutesBtn");
  if (toggleBtn) {
    toggleBtn.textContent = filters.showRoutes ? "Hide routes" : "Show routes";
    toggleBtn.addEventListener("click", () => {
      filters.showRoutes = !filters.showRoutes;
      toggleBtn.textContent = filters.showRoutes
        ? "Hide routes"
        : "Show routes";
      drawDots();
    });
  }

  // Build unique weather/condition list and render checkboxes
  const condSet = new Set();
  allLocations.forEach((d) => {
    if (Array.isArray(d.conditions))
      d.conditions.forEach((c) => condSet.add(c));
  });
  const conds = Array.from(condSet).sort();
  const condContainer = document.getElementById("conditionsContainer");
  if (conds.length === 0) {
    condContainer.innerHTML =
      '<div class="sliderTitle">Weather Conditions</div><div class="sliderValue">n/a</div>';
  } else {
    // initialize selected set empty (no condition filter by default)
    filters.conditionsSelected = new Set();
    let html = '<div class="sliderTitle">Weather Conditions</div>';
    html += '<div class="conditionsList">';
    conds.forEach((c, i) => {
      const id = "cond_" + i;
      // start unchecked
      html += `<label class="condLabel"><input type="checkbox" id="${id}" data-cond="${c}"> ${c}</label>`;
    });
    html += "</div>";
    condContainer.innerHTML = html;

    // wire events
    conds.forEach((c, i) => {
      const id = "cond_" + i;
      const cb = document.getElementById(id);
      cb.addEventListener("change", (e) => {
        if (e.target.checked) filters.conditionsSelected.add(c);
        else filters.conditionsSelected.delete(c);
        drawDots();
      });
    });
  }

  // Initial draw
  updateSliderRange();
  drawDots();

  function updateYear() {
    let start = parseInt(startSlider.value);
    let end = parseInt(endSlider.value);
    if (start > end) start = end;
    if (end < start) end = start;
    startSlider.value = start;
    endSlider.value = end;
    yearLabel.textContent = `${start} - ${end}`;
    filters.yearStart = start;
    filters.yearEnd = end;
    updateSliderRange();
    drawDots();
  }

  startSlider.addEventListener("input", updateYear);
  endSlider.addEventListener("input", updateYear);

  // Allow both overlapping sliders to be draggable by bringing the active
  // thumb's input to the front when the user interacts with it.
  function bringToFront(slider) {
    if (slider === startSlider) {
      startSlider.style.zIndex = 4;
      endSlider.style.zIndex = 3;
    } else {
      endSlider.style.zIndex = 4;
      startSlider.style.zIndex = 3;
    }
  }

  [startSlider, endSlider].forEach((s) => {
    s.addEventListener("pointerdown", () => bringToFront(s));
    s.addEventListener("focus", () => bringToFront(s));
  });

  // Reset stacking after interaction ends so both remain usable
  document.addEventListener("pointerup", () => {
    startSlider.style.zIndex = 3;
    endSlider.style.zIndex = 3;
  });

  // If overlapping inputs still intercept each other, implement a
  // custom pointer handler on the wrapper: choose nearest thumb on
  // pointerdown and drive that slider while dragging.
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

  sliderWrapper.addEventListener("pointerdown", (e) => {
    // Prevent text/image dragging
    e.preventDefault();

    const pct = pctFromEvent(e);
    const min = parseInt(startSlider.min);
    const max = parseInt(startSlider.max);

    const startPct = (parseInt(startSlider.value) - min) / (max - min);
    const endPct = (parseInt(endSlider.value) - min) / (max - min);

    // pick nearest thumb
    activeSlider =
      Math.abs(pct - startPct) <= Math.abs(pct - endPct)
        ? startSlider
        : endSlider;
    bringToFront(activeSlider);
    dragging = true;
    setSliderValueFromPct(activeSlider, pct);
  });

  window.addEventListener("pointermove", (e) => {
    if (!dragging || !activeSlider) return;
    const pct = pctFromEvent(e);
    setSliderValueFromPct(activeSlider, pct);
  });

  window.addEventListener("pointerup", (e) => {
    if (dragging) {
      dragging = false;
      activeSlider = null;
      // restore stacking
      startSlider.style.zIndex = 3;
      endSlider.style.zIndex = 3;
    }
  });

  // Generic setup for additional dual sliders (aboard/fatal)
  function setupDual(
    wrapperId,
    startId,
    endId,
    rangeId,
    labelId,
    hasValues,
    isPercent = false
  ) {
    const wrapper = document.getElementById(wrapperId);
    const start = document.getElementById(startId);
    const end = document.getElementById(endId);
    const rangeEl = document.getElementById(rangeId);
    const label = document.getElementById(labelId);

    function updateRange() {
      const min = parseFloat(start.min);
      const max = parseFloat(start.max);
      const s = parseFloat(start.value);
      const e = parseFloat(end.value);
      let percentStart = ((s - min) / (max - min)) * 100;
      let percentEnd = ((e - min) / (max - min)) * 100;
      rangeEl.style.left = percentStart + "%";
      rangeEl.style.width = percentEnd - percentStart + "%";
      if (isPercent) label.textContent = `${s}% - ${e}%`;
      else label.textContent = `${s} - ${e}`;
    }

    function bringToFront(slider) {
      if (slider === start) {
        start.style.zIndex = 4;
        end.style.zIndex = 3;
      } else {
        end.style.zIndex = 4;
        start.style.zIndex = 3;
      }
    }

    if (!hasValues) return { updateRange: () => {} };

    start.addEventListener("input", () => {
      // keep order
      let sv = parseFloat(start.value);
      let ev = parseFloat(end.value);
      if (sv > ev) sv = ev;
      start.value = sv;
      // update filters object
      const base = startId.replace(/^start/, "").toLowerCase();
      filters[base + "Start"] = sv;
      updateRange();
      drawDots();
    });
    end.addEventListener("input", () => {
      let sv = parseFloat(start.value);
      let ev = parseFloat(end.value);
      if (ev < sv) ev = sv;
      end.value = ev;
      const base2 = endId.replace(/^end/, "").toLowerCase();
      filters[base2 + "End"] = ev;
      updateRange();
      drawDots();
    });

    [start, end].forEach((s) => {
      s.addEventListener("pointerdown", () => bringToFront(s));
      s.addEventListener("focus", () => bringToFront(s));
    });

    // wrapper pointer handler to pick nearest
    let active = null;
    let draggingLocal = false;

    function pctFromEventLocal(e) {
      const rect = wrapper.getBoundingClientRect();
      const x = e.clientX - rect.left;
      return Math.max(0, Math.min(1, x / rect.width));
    }

    function setValFromPct(slider, pct) {
      const min = parseFloat(slider.min);
      const max = parseFloat(slider.max);
      const val = Math.round(min + pct * (max - min));
      slider.value = val;
      slider.dispatchEvent(new Event("input"));
    }

    wrapper.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const pct = pctFromEventLocal(e);
      const min = parseFloat(start.min);
      const max = parseFloat(start.max);
      const sPct = (parseFloat(start.value) - min) / (max - min);
      const ePct = (parseFloat(end.value) - min) / (max - min);
      active = Math.abs(pct - sPct) <= Math.abs(pct - ePct) ? start : end;
      bringToFront(active);
      draggingLocal = true;
      setValFromPct(active, pct);
    });

    window.addEventListener("pointermove", (e) => {
      if (!draggingLocal || !active) return;
      const pct = pctFromEventLocal(e);
      setValFromPct(active, pct);
    });

    window.addEventListener("pointerup", () => {
      if (draggingLocal) {
        draggingLocal = false;
        active = null;
        start.style.zIndex = 3;
        end.style.zIndex = 3;
      }
    });

    // initial range render
    updateRange();
    return { updateRange };
  }

  // initialize Aboard/Fatal sliders
  const aboardSetup = setupDual(
    "sliderWrapperAboard",
    "startAboard",
    "endAboard",
    "sliderRangeAboard",
    "aboardLabel",
    hasAboard,
    false
  );
  const fatalSetup = setupDual(
    "sliderWrapperFatal",
    "startFatal",
    "endFatal",
    "sliderRangeFatal",
    "fatalLabel",
    hasFatal,
    true
  );
});

// Draw dots filtered by active filters
function drawDots() {
  const f = filters;
  if (!f || Object.keys(f).length === 0) return;

  let filtered = allLocations.filter(
    (d) => d.year >= f.yearStart && d.year <= f.yearEnd
  );
  if (f.aboardStart !== undefined && f.aboardEnd !== undefined) {
    filtered = filtered.filter(
      (d) =>
        d.aboard != null && d.aboard >= f.aboardStart && d.aboard <= f.aboardEnd
    );
  }
  if (f.fatalStart !== undefined && f.fatalEnd !== undefined) {
    filtered = filtered.filter(
      (d) =>
        d.fatalPct != null &&
        d.fatalPct >= f.fatalStart &&
        d.fatalPct <= f.fatalEnd
    );
  }

  // apply weather condition checkbox filters (if present)
  // when checkboxes are selected we require the crash to include ALL selected conditions (AND)
  if (f.conditionsSelected && f.conditionsSelected.size > 0) {
    const selected = Array.from(f.conditionsSelected);
    filtered = filtered.filter(
      (d) =>
        Array.isArray(d.conditions) &&
        selected.every((s) => d.conditions.includes(s))
    );
  }

  // update crash count display
  const countEl = document.getElementById("countDisplay");
  if (countEl) {
    countEl.textContent = new Intl.NumberFormat().format(filtered.length);
  }

  // Draw curved red route lines for records that include a starting/origin point
  if (f.showRoutes) {
    const routesData = filtered.filter(
      (d) =>
        d.startLat != null &&
        d.startLon != null &&
        !isNaN(d.startLat) &&
        !isNaN(d.startLon)
    );
    function curvePath(d) {
      const p1 = projection([d.lon, d.lat]);
      const p2 = projection([d.startLon, d.startLat]);
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const mx = (p1[0] + p2[0]) / 2;
      const my = (p1[1] + p2[1]) / 2;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const offset = Math.min(80, len * 0.18);
      const cx = mx - (dy / len) * offset;
      const cy = my + (dx / len) * offset;
      return `M${p1[0]},${p1[1]} Q${cx},${cy} ${p2[0]},${p2[1]}`;
    }

    const routes = g
      .selectAll("path.route")
      .data(
        routesData,
        (d) =>
          d.lat +
          "-" +
          d.lon +
          "-route-" +
          (d.startLat ?? "") +
          "-" +
          (d.startLon ?? "")
      );

    routes.join(
      (enter) =>
        enter
          .append("path")
          .attr("class", "route")
          .attr("d", curvePath)
          .attr("fill", "none")
          .attr("stroke", "rgba(255,60,60,0.95)")
          .attr("pointer-events", "none")
          .style("stroke-width", 0.6 / _currentZoomK + "px"),
      (update) =>
        update
          .attr("d", curvePath)
          .style("stroke-width", 0.6 / _currentZoomK + "px"),
      (exit) => exit.remove()
    );
    // ensure all route elements reflect the current zoom stroke width immediately
    g.selectAll("path.route").style("stroke-width", 0.6 / _currentZoomK + "px");
  } else {
    // remove any existing routes if user toggles them off
    g.selectAll("path.route").remove();
  }

  const dots = g
    .selectAll("circle.dot")
    .data(
      filtered,
      (d) =>
        d.lat +
        "-" +
        d.lon +
        "-" +
        d.year +
        "-" +
        (d.aboard ?? "") +
        "-" +
        (d.fatal ?? "")
    );

  dots.join(
    (enter) =>
      enter
        .append("circle")
        .attr("class", "dot")
        .attr("r", () => {
          const screenR = Math.max(
            DOT_SCREEN_MIN,
            Math.min(DOT_SCREEN_BASE * Math.sqrt(_currentZoomK), DOT_SCREEN_MAX)
          );
          return screenR / _currentZoomK;
        })
        .attr("cx", (d) => projection([d.lon, d.lat])[0])
        .attr("cy", (d) => projection([d.lon, d.lat])[1])
        .on("mouseover", (event, d) => {
          const nf = new Intl.NumberFormat();
          const aboard =
            d.aboard != null && !isNaN(d.aboard) ? nf.format(d.aboard) : "n/a";
          const fatal =
            d.fatal != null && !isNaN(d.fatal) ? nf.format(d.fatal) : "n/a";
          const fatalPct =
            d.fatalPct != null && !isNaN(d.fatalPct)
              ? d.fatalPct.toFixed(1) + "%"
              : "n/a";
          const coords =
            d.lat != null && d.lon != null
              ? `${d.lat.toFixed(3)}, ${d.lon.toFixed(3)}`
              : "n/a";

          const html = `
                    <div><span class="k">Date:</span> ${d.dateStr ?? "n/a"} ${
            d.timeStr ?? ""
          }</div>
                    <div><span class="k">Location:</span> ${
                      d.locationStr || "n/a"
                    }</div>
                    <div><span class="k">Operator:</span> ${
                      d.operatorStr || "n/a"
                    }</div>
                    <div><span class="k">Route:</span> ${
                      d.routeStr || "n/a"
                    }</div>
                    <div><span class="k">Type:</span> ${
                      d.typeStr || "n/a"
                    }</div>
                    <div><span class="k">Fatalities:</span> ${fatal} (${fatalPct})</div>
                    <div><span class="k">Summary:</span> ${
                      d.summaryStr || "n/a"
                    }</div>
                `;
          tooltip.style("display", "block").html(html);
          tooltip
            .style("left", event.pageX + 12 + "px")
            .style("top", event.pageY + 12 + "px");
        })
        .on("mousemove", (event) => {
          tooltip
            .style("left", event.pageX + 12 + "px")
            .style("top", event.pageY + 12 + "px");
        })
        .on("mouseout", () => {
          tooltip.style("display", "none");
        }),
    (update) =>
      update
        .attr("cx", (d) => projection([d.lon, d.lat])[0])
        .attr("cy", (d) => projection([d.lon, d.lat])[1])
        .attr("r", () => {
          const screenR = Math.max(
            DOT_SCREEN_MIN,
            Math.min(DOT_SCREEN_BASE * Math.sqrt(_currentZoomK), DOT_SCREEN_MAX)
          );
          return screenR / _currentZoomK;
        }),
    (exit) => exit.remove()
  );
}
