// Map visualization module
// Handles the interactive world map with crash locations

const MapSection = {
    svg: null,
    g: null,
    gCountries: null,
    gRoutes: null,
    gDots: null,
    projection: null,
    path: null,
    width: 0,
    height: 0,
    zoom: null,
    _currentZoomK: 1,
    tooltip: null,

    DOT_SCREEN_BASE: 1.3,
    DOT_SCREEN_MIN: 0.5,
    DOT_SCREEN_MAX: 20,

    init() {
        this.svg = d3.select("#map-svg");
        this.tooltip = d3.select(".tooltip");

        // Get initial size
        this.updateSize();

        // Setup projection and path
        this.projection = d3.geoNaturalEarth1()
            .scale(this.width / 6)
            .translate([this.width / 2, this.height / 2]);

        this.path = d3.geoPath().projection(this.projection);
        this.g = this.svg.append("g");
        this.gCountries = this.g.append("g").attr("class", "layer countries");
        this.gRoutes = this.g.append("g").attr("class", "layer routes");
        this.gDots = this.g.append("g").attr("class", "layer dots");

        // Setup zoom
        this.zoom = d3.zoom()
            .scaleExtent([1, 100])
            .on("start", () => {
                this.svg.classed("grabbing", true);
            })
            .on("end", () => {
                this.svg.classed("grabbing", false);
            })
            .on("zoom", (event) => {
                const { transform } = event;
                this._currentZoomK = transform.k;
                this.g.attr("transform", transform);

                const screenR = Math.max(
                    this.DOT_SCREEN_MIN,
                    Math.min(this.DOT_SCREEN_BASE * Math.sqrt(transform.k), this.DOT_SCREEN_MAX)
                );
                const elR = screenR / transform.k;
                this.g.selectAll("circle.dot").attr("r", elR);
                this.g.selectAll("path.route").style("stroke-width", (0.6 / transform.k) + "px");
            });

        this.svg.call(this.zoom);

        // Load world map
        this.loadWorldMap();

        // Setup route toggle button
        const toggleBtn = document.getElementById("toggleRoutesBtn");
        toggleBtn.addEventListener("click", () => {
            SharedFilters.updateFilters({
                showRoutes: !SharedFilters.state.showRoutes
            });
            toggleBtn.textContent = SharedFilters.state.showRoutes ? "Hide routes" : "Show routes";
        });

        // Listen to filter changes
        SharedFilters.addListener((filtered) => this.render(filtered));

        // Handle window resize
        window.addEventListener("resize", () => {
            clearTimeout(this._resizeTimer);
            this._resizeTimer = setTimeout(() => {
                this.updateSize();
                this.projection.scale(this.width / 6).translate([this.width / 2, this.height / 2]);
                this.gCountries.selectAll("path.country").attr("d", this.path);
                this.render(SharedFilters.getFilteredData());
            }, 120);
        });
    },

    updateSize() {
        const container = document.querySelector("#map .section-main");
        this.width = container.clientWidth;
        this.height = container.clientHeight;
        this.svg.attr("width", this.width).attr("height", this.height);
    },

    async loadWorldMap() {
        try {
            const worldData = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
                .then(r => r.json());

            const countries = topojson.feature(worldData, worldData.objects.countries);
            this.gCountries.append("path")
                .datum(countries)
                .attr("d", this.path)
                .attr("class", "country");

            // Compute bounds and set translate extent
            const b = this.path.bounds(countries);
            const pad = 20;
            const extent = [
                [b[0][0] - pad, b[0][1] - pad],
                [b[1][0] + pad, b[1][1] + pad]
            ];
            this.zoom.translateExtent(extent);
            this.svg.call(this.zoom);
        } catch (error) {
            console.error("Error loading world map:", error);
        }
    },

    render(filtered) {
        // Draw routes if enabled
        if (SharedFilters.state.showRoutes) {
            const routesData = filtered.filter(d =>
                d.startLat != null && d.startLon != null &&
                !isNaN(d.startLat) && !isNaN(d.startLon)
            );

            const curvePath = (d) => {
                const p1 = this.projection([d.lon, d.lat]);
                const p2 = this.projection([d.startLon, d.startLat]);
                const dx = p2[0] - p1[0];
                const dy = p2[1] - p1[1];
                const mx = (p1[0] + p2[0]) / 2;
                const my = (p1[1] + p2[1]) / 2;
                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                const offset = Math.min(80, len * 0.18);
                const cx = mx - (dy / len) * offset;
                const cy = my + (dx / len) * offset;
                return `M${p1[0]},${p1[1]} Q${cx},${cy} ${p2[0]},${p2[1]}`;
            };

            const routes = this.gRoutes.selectAll("path.route")
                .data(routesData, d => `${d.lat}-${d.lon}-${d.startLat}-${d.startLon}`);

            routes.join(
                enter => enter.append("path")
                    .attr("class", "route")
                    .attr("d", curvePath)
                    .attr("fill", "none")
                    .attr("stroke", "rgb(209, 24, 24)")
                    .attr("pointer-events", "none")
                    .style("stroke-width", (0.6 / this._currentZoomK) + "px"),
                update => update
                    .attr("d", curvePath)
                    .style("stroke-width", (0.6 / this._currentZoomK) + "px"),
                exit => exit.remove()
            );
        } else {
            this.gRoutes.selectAll("path.route").remove();
        }

        // Draw dots
        const dots = this.gDots.selectAll("circle.dot")
            .data(filtered, d => `${d.lat}-${d.lon}-${d.year}-${d.aboard}-${d.fatal}`);

        const screenR = Math.max(
            this.DOT_SCREEN_MIN,
            Math.min(this.DOT_SCREEN_BASE * Math.sqrt(this._currentZoomK), this.DOT_SCREEN_MAX)
        );
        const elR = screenR / this._currentZoomK;

        dots.join(
            enter => enter.append("circle")
                .attr("class", "dot")
                .attr("r", elR)
                .attr("cx", d => this.projection([d.lon, d.lat])[0])
                .attr("cy", d => this.projection([d.lon, d.lat])[1])
                .attr("fill", "rgb(218, 34, 34)")
                .style("cursor", "pointer")
                .on("mouseover", (event, d) => this.showTooltip(event, d))
                .on("mousemove", (event) => {
                    this.tooltip
                        .style("left", (event.pageX + 12) + "px")
                        .style("top", (event.pageY + 12) + "px");
                })
                .on("mouseout", () => {
                    this.tooltip.style("display", "none");
                }),
            update => update
                .attr("cx", d => this.projection([d.lon, d.lat])[0])
                .attr("cy", d => this.projection([d.lon, d.lat])[1])
                .attr("r", elR),
            exit => exit.remove()
        );

        // Ensure dots sit above routes layer
        this.gDots.selectAll("circle.dot").raise();
    },

    async showTooltip(event, d) {
        const nf = new Intl.NumberFormat();
        const aboard = d.aboard != null && !isNaN(d.aboard) ? nf.format(d.aboard) : "n/a";
        const fatal = d.fatal != null && !isNaN(d.fatal) ? nf.format(d.fatal) : "n/a";
        const fatalPct = d.fatalPct != null && !isNaN(d.fatalPct) ? d.fatalPct.toFixed(1) + "%" : "n/a";

        // Show loading while fetching image
        let html = `
      <div id="plane-image"><em>Loading image...</em></div>
      <div><span class="k">Date:</span> ${d.dateStr ?? "n/a"} ${d.timeStr ?? ""}</div>
      <div><span class="k">Location:</span> ${d.locationStr || "n/a"}</div>
      <div><span class="k">Operator:</span> ${d.operatorStr || "n/a"}</div>
      <div><span class="k">Route:</span> ${d.routeStr || "n/a"}</div>
      <div><span class="k">Type:</span> ${d.typeStr || "n/a"}</div>
      <div><span class="k">Aboard:</span> ${aboard}</div>
      <div><span class="k">Fatalities:</span> ${fatal} (${fatalPct})</div>
      <div><span class="k">Summary:</span> ${d.summaryStr || "n/a"}</div>
    `;

        this.tooltip
            .style("display", "block")
            .html(html)
            .style("left", (event.pageX + 12) + "px")
            .style("top", (event.pageY + 12) + "px");

        // Broadened search for Wikimedia image
        let model = d.typeStr ? d.typeStr.trim() : "";
        let searchTerms = [];
        if (model) {
            searchTerms.push(model);
            // Remove after dash (e.g., "Boeing 737-800" -> "Boeing 737")
            let dashIdx = model.indexOf("-");
            if (dashIdx > 0) {
                searchTerms.push(model.substring(0, dashIdx).trim());
            }
            // Remove after parenthesis (e.g., "Douglas DC-3 (C-47)" -> "Douglas DC-3")
            let parenIdx = model.indexOf("(");
            if (parenIdx > 0) {
                searchTerms.push(model.substring(0, parenIdx).trim());
            }
            // Use first two and three words
            let words = model.split(/\s+/);
            if (words.length >= 2) {
                searchTerms.push(words[0] + " " + words[1]);
            }
            if (words.length >= 3) {
                searchTerms.push(words[0] + " " + words[1] + " " + words[2]);
            }
            // Use only manufacturer (first word)
            searchTerms.push(words[0]);
            // Add with 'aircraft', 'plane', 'jet' suffixes
            if (searchTerms.length > 0) {
                let extra = [];
                for (let t of searchTerms) {
                    extra.push(t + " aircraft");
                    extra.push(t + " plane");
                    extra.push(t + " jet");
                }
                searchTerms = searchTerms.concat(extra);
            }
        }

        let imageUrl = null;
        let foundImage = false;
        let imageTitle = null;
        for (let term of searchTerms) {
            try {
                // Wikimedia search API for images
                const searchApi = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(term)}&origin=*`;
                const searchResp = await fetch(searchApi);
                const searchData = await searchResp.json();
                if (searchData.query && searchData.query.search && searchData.query.search.length > 0) {
                    // Try up to 3 results to find a relevant plane page
                    for (let i = 0; i < Math.min(3, searchData.query.search.length); i++) {
                        let page = searchData.query.search[i];
                        let pageTitle = page.title;
                        let snippet = page.snippet ? page.snippet.toLowerCase() : "";
                        let titleLower = pageTitle.toLowerCase();
                        // Only accept if title or snippet contains plane keywords
                        if (titleLower.includes('aircraft') || titleLower.includes('plane') || titleLower.includes('jet') || titleLower.includes('airliner') || snippet.includes('aircraft') || snippet.includes('plane') || snippet.includes('jet') || snippet.includes('airliner')) {
                            // Now get the image for this page
                            const imgApi = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&titles=${encodeURIComponent(pageTitle)}&piprop=original&origin=*`;
                            const imgResp = await fetch(imgApi);
                            const imgData = await imgResp.json();
                            if (imgData.query && imgData.query.pages) {
                                const pages = Object.values(imgData.query.pages);
                                if (pages.length > 0 && pages[0].original && pages[0].original.source) {
                                    let imgSrc = pages[0].original.source;
                                    let lowerSrc = imgSrc.toLowerCase();
                                    let lowerTitle = pageTitle.toLowerCase();
                                    // Exclude logos, emblems, insignias, flags, seals
                                    if (
                                        !lowerSrc.includes('logo') &&
                                        !lowerSrc.includes('emblem') &&
                                        !lowerSrc.includes('insignia') &&
                                        !lowerSrc.includes('flag') &&
                                        !lowerSrc.includes('seal') &&
                                        !lowerTitle.includes('logo') &&
                                        !lowerTitle.includes('emblem') &&
                                        !lowerTitle.includes('insignia') &&
                                        !lowerTitle.includes('flag') &&
                                        !lowerTitle.includes('seal')
                                    ) {
                                        imageUrl = imgSrc;
                                        imageTitle = pageTitle;
                                        foundImage = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    if (foundImage) break;
                }
            } catch (e) {
                // ignore errors, fallback below
            }
        }
        let imageHtml = foundImage
            ? `<img src="${imageUrl}" alt="${imageTitle || model}" style="width:100%;height:auto;display:block;margin:0 0 8px 0;padding:0;">`
            : '<div style="color:#888;font-size:13px;margin-bottom:6px;">No image found</div>';
        // Update tooltip with image
        this.tooltip.select("#plane-image").html(imageHtml);
    }
};

// Initialize map when page loads
window.addEventListener("load", () => {
    MapSection.init();
});
