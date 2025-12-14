// Shared filter state manager
// This manages all filter state and notifies listeners when filters change

const SharedFilters = {
    // Filter state
    state: {
        yearStart: 1940,
        yearEnd: 2009,
        aboardStart: 0,
        aboardEnd: 1000,
        fatalStart: 0,
        fatalEnd: 100,
        conditionsSelected: new Set(),
        showRoutes: true
    },

    // Listeners to notify when filters change
    listeners: [],

    // Data bounds (set after CSV loads)
    bounds: {
        yearMin: 1940,
        yearMax: 2009,
        aboardMin: 0,
        aboardMax: 1000,
        hasAboard: false,
        hasFatal: false
    },

    // All crash data (loaded once, shared by all views)
    data: [],

    // Register a listener to be called when filters change
    addListener(callback) {
        this.listeners.push(callback);
        // If data is already loaded, fire once immediately so views render without user clicks
        if (this.data && this.data.length) {
            callback(this.getFilteredData());
        }
    },

    // Notify all listeners that filters have changed
    notify() {
        this.listeners.forEach(callback => callback(this.getFilteredData()));
    },

    // Update filter state and notify listeners
    updateFilters(updates) {
        Object.assign(this.state, updates);
        this.notify();
    },

    // Get filtered data based on current filter state
    getFilteredData() {
        let filtered = this.data;

        // Year range filter
        filtered = filtered.filter(d =>
            d.year >= this.state.yearStart && d.year <= this.state.yearEnd
        );

        // Aboard filter
        if (this.bounds.hasAboard) {
            filtered = filtered.filter(d =>
                d.aboard != null &&
                d.aboard >= this.state.aboardStart &&
                d.aboard <= this.state.aboardEnd
            );
        }

        // Fatalities % filter
        if (this.bounds.hasFatal) {
            filtered = filtered.filter(d =>
                d.fatalPct != null &&
                d.fatalPct >= this.state.fatalStart &&
                d.fatalPct <= this.state.fatalEnd
            );
        }

        // Weather conditions filter
        if (this.state.conditionsSelected.size > 0) {
            const groupMap = {
                clear: ["clear"],
                foggy: ["fog"],
                rainy: ["rain", "heavy rain"],
                cloudy: ["mostly cloudy", "overcast", "partly cloudy"],
                snowy: ["snow"],
                windy: ["windy", "storm-level winds", "thunderstorms"]
            };

            filtered = filtered.filter(d => {
                if (!Array.isArray(d.conditions)) return false;

                for (const group of this.state.conditionsSelected) {
                    const subconds = groupMap[group];
                    if (!subconds) return false;

                    let found = false;
                    for (const sub of subconds) {
                        if (d.conditions.some(cond => cond.toLowerCase().includes(sub))) {
                            found = true;
                            break;
                        }
                    }
                    if (!found) return false;
                }
                return true;
            });
        }

        return filtered;
    },

    // Initialize filters - load data and set up UI
    async init() {
        try {
            // Load CSV data
            const crashData = await d3.dsv(";", "data/crashesFinal.csv");

            // Detect columns
            const keys = Object.keys(crashData[0]);
            const latKey = keys.find(k => k.toLowerCase().includes("lat"));
            const lonKey = keys.find(k => k.toLowerCase().includes("lon"));
            const dateKey = keys.find(k => k.toLowerCase().includes("date"));
            const timeKey = keys.find(k => k.toLowerCase().includes("time"));
            const locationKey = keys.find(k => k.toLowerCase().includes("location"));
            const operatorKey = keys.find(k => k.toLowerCase().includes("operator"));
            const routeKey = keys.find(k => k.toLowerCase().includes("route"));
            const typeKey = keys.find(k => k.toLowerCase().includes("type"));
            const summaryKey = keys.find(k => k.toLowerCase().includes("summary"));
            const generalKey = keys.find(k =>
                k.toLowerCase().includes("general") ||
                k.toLowerCase().includes("condition") ||
                k.toLowerCase().includes("weather")
            );
            const aboardKey = keys.find(k =>
                k.toLowerCase().includes("aboard") || k.toLowerCase().includes("abo")
            );
            const fatalKey = keys.find(k =>
                k.toLowerCase().includes("fatal") ||
                k.toLowerCase().includes("death") ||
                k.toLowerCase().includes("fat")
            );
            const startLatKey = keys.find(k =>
                (k.toLowerCase().includes("start") && k.toLowerCase().includes("lat")) ||
                (k.toLowerCase().includes("origin") && k.toLowerCase().includes("lat")) ||
                (k.toLowerCase().includes("orig") && k.toLowerCase().includes("lat"))
            );
            const startLonKey = keys.find(k =>
                (k.toLowerCase().includes("start") && k.toLowerCase().includes("lon")) ||
                (k.toLowerCase().includes("origin") && k.toLowerCase().includes("lon")) ||
                (k.toLowerCase().includes("orig") && k.toLowerCase().includes("lon"))
            );

            // Parse and clean data
            this.data = crashData.map(d => {
                let rawLat = (d[latKey] ?? "").toString().trim().replace(",", ".");
                let rawLon = (d[lonKey] ?? "").toString().trim().replace(",", ".");
                rawLat = rawLat.replace(/[^\d.\-]/g, "");
                rawLon = rawLon.replace(/[^\d.\-]/g, "");

                let lat = parseFloat(rawLat);
                let lon = parseFloat(rawLon);

                let startLat = null, startLon = null;
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
                    .map(s => s.trim())
                    .filter(Boolean)
                    .map(s => s.replace(/\s+/g, " ").trim());

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

                let fatalPct = null;
                if (aboard != null && aboard > 0 && fatal != null && !isNaN(fatal)) {
                    fatalPct = (fatal / aboard) * 100;
                }

                return {
                    lat, lon, year, dateStr, timeStr, locationStr, operatorStr,
                    routeStr, typeStr, summaryStr, conditions, aboard, fatal,
                    fatalPct, startLat, startLon,
                    // Keep original weather columns for scatter matrix
                    Temp_Max: d['Temp_Max'],
                    Temp_Min: d['Temp_Min'],
                    Precipitation: d['Precipitation'],
                    Wind_Max: d['Wind_Max'],
                    Cloud_Cover: d['Cloud_Cover'],
                    Pressure: d['Pressure']
                };
            }).filter(d =>
                !isNaN(d.lat) && !isNaN(d.lon) &&
                d.lat >= -90 && d.lat <= 90 &&
                d.lon >= -180 && d.lon <= 180 &&
                d.year
            );

            // Compute bounds
            const years = this.data.map(d => d.year);
            this.bounds.yearMin = Math.min(...years);
            this.bounds.yearMax = Math.max(...years);

            const aboardVals = this.data.map(d => d.aboard).filter(v => v != null && !isNaN(v));
            this.bounds.hasAboard = aboardVals.length > 0;
            if (this.bounds.hasAboard) {
                this.bounds.aboardMin = Math.min(...aboardVals);
                this.bounds.aboardMax = Math.max(...aboardVals);
            }

            const fatalVals = this.data.map(d => d.fatalPct).filter(v => v != null && !isNaN(v));
            this.bounds.hasFatal = fatalVals.length > 0;

            // Initialize filter state
            this.state.yearStart = this.bounds.yearMin;
            this.state.yearEnd = this.bounds.yearMax;
            this.state.aboardStart = this.bounds.aboardMin;
            this.state.aboardEnd = this.bounds.aboardMax;
            this.state.fatalStart = 0;
            this.state.fatalEnd = 100;

            // Initialize UI
            this.initUI();

            // Initial notification to render with full dataset
            this.notify();

        } catch (error) {
            console.error("Error loading data:", error);
        }
    },

    // Setup bidirectional slider dragging (both thumbs slide from either end)
    setupDualSliderHandler(startSlider, endSlider, updateCallback, wrapperId) {
        const wrapper = document.getElementById(wrapperId);
        if (!wrapper) return;

        let activeSlider = null;
        let dragging = false;

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

        document.addEventListener("pointerup", () => {
            startSlider.style.zIndex = 3;
            endSlider.style.zIndex = 3;
            dragging = false;
            activeSlider = null;
        });

        function pctFromEvent(e) {
            const rect = wrapper.getBoundingClientRect();
            const x = e.clientX - rect.left;
            return Math.max(0, Math.min(1, x / rect.width));
        }

        function setSliderValueFromPct(slider, pct) {
            const min = parseInt(slider.min);
            const max = parseInt(slider.max);
            const val = Math.round(min + pct * (max - min));
            slider.value = val;
            updateCallback();
        }

        wrapper.addEventListener("pointerdown", (e) => {
            e.preventDefault();

            const pct = pctFromEvent(e);
            const min = parseInt(startSlider.min);
            const max = parseInt(startSlider.max);

            const startPct = (parseInt(startSlider.value) - min) / (max - min);
            const endPct = (parseInt(endSlider.value) - min) / (max - min);

            // pick nearest thumb
            const distStart = Math.abs(pct - startPct);
            const distEnd = Math.abs(pct - endPct);
            if (distStart < distEnd) activeSlider = startSlider;
            else if (distEnd < distStart) activeSlider = endSlider;
            else {
                // Equal distance: pick by click direction
                activeSlider = pct > startPct ? endSlider : startSlider;
            }
            bringToFront(activeSlider);
            dragging = true;
            setSliderValueFromPct(activeSlider, pct);
        });

        window.addEventListener("pointermove", (e) => {
            if (!dragging || !activeSlider) return;
            const pct = pctFromEvent(e);
            setSliderValueFromPct(activeSlider, pct);
        });
    },

    // Initialize filter UI controls
    initUI() {
        // Year slider
        const startYear = document.getElementById("startYear");
        const endYear = document.getElementById("endYear");
        const yearLabel = document.getElementById("yearLabel");
        const sliderRange = document.getElementById("sliderRange");

        startYear.min = this.bounds.yearMin;
        startYear.max = this.bounds.yearMax;
        startYear.value = this.bounds.yearMin;
        endYear.min = this.bounds.yearMin;
        endYear.max = this.bounds.yearMax;
        endYear.value = this.bounds.yearMax;
        yearLabel.textContent = `${this.bounds.yearMin} - ${this.bounds.yearMax}`;

        const updateYearRange = () => {
            const min = parseInt(startYear.min);
            const max = parseInt(endYear.max);
            const start = parseInt(startYear.value);
            const end = parseInt(endYear.value);
            const percentStart = ((start - min) / (max - min)) * 100;
            const percentEnd = ((end - min) / (max - min)) * 100;
            sliderRange.style.left = percentStart + "%";
            sliderRange.style.width = (percentEnd - percentStart) + "%";
        };

        const updateYear = () => {
            let start = parseInt(startYear.value);
            let end = parseInt(endYear.value);
            if (start > end) start = end;
            if (end < start) end = start;
            startYear.value = start;
            endYear.value = end;
            yearLabel.textContent = `${start} - ${end}`;
            updateYearRange();
            this.updateFilters({ yearStart: start, yearEnd: end });
        };

        startYear.addEventListener("input", updateYear);
        endYear.addEventListener("input", updateYear);

        // Enable bidirectional dragging on year slider
        this.setupDualSliderHandler(startYear, endYear, updateYear, "sliderWrapper");

        updateYearRange();

        // Aboard slider
        if (this.bounds.hasAboard) {
            const startAboard = document.getElementById("startAboard");
            const endAboard = document.getElementById("endAboard");
            const aboardLabel = document.getElementById("aboardLabel");
            const sliderRangeAboard = document.getElementById("sliderRangeAboard");

            startAboard.min = this.bounds.aboardMin;
            startAboard.max = this.bounds.aboardMax;
            startAboard.value = this.bounds.aboardMin;
            endAboard.min = this.bounds.aboardMin;
            endAboard.max = this.bounds.aboardMax;
            endAboard.value = this.bounds.aboardMax;
            aboardLabel.textContent = `${this.bounds.aboardMin} - ${this.bounds.aboardMax}`;

            const updateAboardRange = () => {
                const min = parseFloat(startAboard.min);
                const max = parseFloat(endAboard.max);
                const start = parseFloat(startAboard.value);
                const end = parseFloat(endAboard.value);
                const percentStart = ((start - min) / (max - min)) * 100;
                const percentEnd = ((end - min) / (max - min)) * 100;
                sliderRangeAboard.style.left = percentStart + "%";
                sliderRangeAboard.style.width = (percentEnd - percentStart) + "%";
            };

            const updateAboard = () => {
                let start = parseFloat(startAboard.value);
                let end = parseFloat(endAboard.value);
                if (start > end) start = end;
                if (end < start) end = start;
                startAboard.value = start;
                endAboard.value = end;
                aboardLabel.textContent = `${Math.round(start)} - ${Math.round(end)}`;
                updateAboardRange();
                this.updateFilters({ aboardStart: start, aboardEnd: end });
            };

            startAboard.addEventListener("input", updateAboard);
            endAboard.addEventListener("input", updateAboard);

            // Enable bidirectional dragging on aboard slider
            this.setupDualSliderHandler(startAboard, endAboard, updateAboard, "sliderWrapperAboard");

            updateAboardRange();
        } else {
            document.getElementById("aboardLabel").textContent = "n/a";
        }

        // Fatal % slider
        if (this.bounds.hasFatal) {
            const startFatal = document.getElementById("startFatal");
            const endFatal = document.getElementById("endFatal");
            const fatalLabel = document.getElementById("fatalLabel");
            const sliderRangeFatal = document.getElementById("sliderRangeFatal");

            startFatal.min = 0;
            startFatal.max = 100;
            startFatal.value = 0;
            endFatal.min = 0;
            endFatal.max = 100;
            endFatal.value = 100;
            fatalLabel.textContent = "0% - 100%";

            const updateFatalRange = () => {
                const start = parseFloat(startFatal.value);
                const end = parseFloat(endFatal.value);
                const percentStart = start;
                const percentEnd = end;
                sliderRangeFatal.style.left = percentStart + "%";
                sliderRangeFatal.style.width = (percentEnd - percentStart) + "%";
            };

            const updateFatal = () => {
                let start = parseFloat(startFatal.value);
                let end = parseFloat(endFatal.value);
                if (start > end) start = end;
                if (end < start) end = start;
                startFatal.value = start;
                endFatal.value = end;
                fatalLabel.textContent = `${Math.round(start)}% - ${Math.round(end)}%`;
                updateFatalRange();
                this.updateFilters({ fatalStart: start, fatalEnd: end });
            };

            startFatal.addEventListener("input", updateFatal);
            endFatal.addEventListener("input", updateFatal);

            // Enable bidirectional dragging on fatal slider
            this.setupDualSliderHandler(startFatal, endFatal, updateFatal, "sliderWrapperFatal");

            updateFatalRange();
        } else {
            document.getElementById("fatalLabel").textContent = "n/a";
        }

        // Weather conditions checkboxes
        const conditionsList = document.getElementById("conditionsList");
        const groups = [
            { label: "Clear", value: "clear" },
            { label: "Foggy", value: "foggy" },
            { label: "Rainy", value: "rainy" },
            { label: "Cloudy", value: "cloudy" },
            { label: "Snowy", value: "snowy" },
            { label: "Windy", value: "windy" }
        ];

        groups.forEach((group, i) => {
            const label = document.createElement("label");
            label.className = "condLabel";
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.id = `cond_${i}`;
            checkbox.dataset.cond = group.value;
            checkbox.addEventListener("change", (e) => {
                if (e.target.checked) {
                    this.state.conditionsSelected.add(group.value);
                } else {
                    this.state.conditionsSelected.delete(group.value);
                }
                this.notify();
            });
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(group.label));
            conditionsList.appendChild(label);
        });

        // Update count display
        this.addListener((filtered) => {
            const countDisplay = document.getElementById("countDisplay");
            countDisplay.textContent = new Intl.NumberFormat().format(filtered.length);
        });
    }
};

// Initialize on load
SharedFilters.init();
