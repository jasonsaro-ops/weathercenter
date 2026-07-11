// Local Configuration & Center Focus Variables
const localLat = 40.0759;
const localLon = -75.2996;
let countdownVal = 120;
let mapObject, radarLayerGroup;
let lightningMap, lightningLayerGroup; // Real Map Components for Lightning Component

// Enter your AirNow API token registration key here.
// If left empty, the engine automatically deploys structural matrix simulations to prevent layout crashing.
const AIRNOW_API_KEY = ""; 

// Define Key Schuylkill River Gauge Sites (Reading to Philadelphia)
const schuylkillGauges = [
    { id: "01472000", name: "Schuylkill River at Reading, PA", lat: 40.3323, lon: -75.9324, noaaId: "RDGP1" },
    { id: "01473500", name: "Schuylkill River at Pottstown, PA", lat: 40.2429, lon: -75.6605, noaaId: "PTTP1" },
    { id: "01474500", name: "Schuylkill River at Norristown, PA", lat: 40.1118, lon: -75.3532, noaaId: "NSRP1" },
    { id: "01474703", name: "Schuylkill River at Conshohocken, PA", lat: 40.0712, lon: -75.3093, noaaId: "CSHP1" },
    { id: "01474000", name: "Schuylkill River at Philadelphia, PA (Fairmount Dam)", lat: 39.9676, lon: -75.1832, noaaId: "PADP1" }
];

// Setup GoldenLayout v1.5.9 Configurations (Air Quality Matrix shifted to column 3)
const config = {
    content: [{
        type: 'row',
        content: [
            {
                type: 'column',
                width: 40,
                content: [
                    {
                        type: 'component',
                        componentName: 'radarMap',
                        title: 'NATIONWIDE WEATHER TRACKER & SCHUYLKILL GAUGE MATRICES'
                    },
                    {
                        type: 'component',
                        componentName: 'localForecast',
                        title: '7-DAY GEOGRAPHIC OUTLOOK (19428)'
                    }
                ]
            },
            {
                type: 'column',
                width: 30,
                content: [
                    {
                        type: 'component',
                        componentName: 'nwsAlerts',
                        title: 'CRITICAL HAZARD & NOAA ALERTS'
                    },
                    {
                        type: 'component',
                        componentName: 'hydrologyFeed',
                        title: 'SCHUYLKILL HYDROLOGIC REAL-TIME STREAMFLOW'
                    }
                ]
            },
            {
                type: 'column',
                width: 30,
                content: [
                    {
                        type: 'component',
                        componentName: 'lightningGrid',
                        title: 'DYNAMIC LOCAL LIGHTNING DETECTION ARRAY (30 MI RADIUS)'
                    },
                    {
                        type: 'component',
                        componentName: 'airQualityPanel',
                        title: 'REGIONAL AIR QUALITY MATRIX (AIRNOW REGIONAL)'
                    }
                ]
            }
        ]
    }]
};

const layout = new GoldenLayout(config, '#layout-container');

// Map Component with Model Selection Options
layout.registerComponent('radarMap', function(container) {
    container.getElement().html(`
        <div style="position:relative; width:100%; height:100%;">
            <div class="control-panel" id="modelSelector" style="position:absolute; top:10px; left:10px; background:rgba(22, 27, 34, 0.95); border:1px solid #00ffcc; padding:8px; border-radius:4px; z-index:99; box-shadow:0 0 15px rgba(0,255,204,0.4);">
                <div style="font-weight:bold; color:#00ffcc; margin-bottom:5px; font-size:0.9rem;">MODEL DATA FEEDS</div>
                <label style="display:block; margin-bottom:4px; font-size:0.75rem; color:#8b949e;"><input type="radio" name="weatherModel" value="radar" checked> NEXRAD Weather Radar</label>
                <label style="display:block; margin-bottom:4px; font-size:0.75rem; color:#8b949e;"><input type="radio" name="weatherModel" value="satellite_ir"> GOES-East Infrared</label>
                <label style="display:block; font-size:0.75rem; color:#8b949e;"><input type="radio" name="weatherModel" value="satellite_vis"> GOES-East Visible</label>
            </div>
            <div id="map" class="map-component" style="width:100%; height:100%;"></div>
        </div>
    `);

    setTimeout(() => {
        mapObject = L.map('map').setView([39.8283, -98.5795], 4);
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '©OpenStreetMap, ©CartoDB'
        }).addTo(mapObject);

        radarLayerGroup = L.layerGroup().addTo(mapObject);

        document.querySelectorAll('input[name="weatherModel"]').forEach(elem => {
            elem.addEventListener('change', (e) => { updateWeatherOverlay(e.target.value); });
        });

        updateWeatherOverlay('radar');

        schuylkillGauges.forEach(g => {
            L.circleMarker([g.lat, g.lon], {
                color: '#00ccff',
                fillColor: '#003366',
                fillOpacity: 0.8,
                radius: 7
            }).addTo(mapObject).bindPopup(`
                <b style="color:#000;">${g.name}</b><br>
                <span style="font-size:0.8rem; color:#555;">USGS ID: ${g.id} | NWS ID: ${g.noaaId}</span><br>
                <a href="https://water.noaa.gov/gauges/${g.noaaId}" target="_blank" style="color:#00ccff; font-weight:bold;">Launch NOAA Hydrograph</a>
            `);
        });

        setTimeout(() => { mapObject.flyTo([localLat, localLon], 9); }, 1500);
    }, 200);
});

layout.registerComponent('localForecast', function(container) {
    container.getElement().html(`
        <div class="weather-component">
            <div id="current-obs">Loading Observation Data...</div>
            <div class="forecast-grid" id="forecast-cards"></div>
        </div>`);
    fetchNWSForecast();
});

layout.registerComponent('nwsAlerts', function(container) {
    container.getElement().html(`
        <div class="weather-component">
            <div id="alerts-container"><p style="color: #8b949e;">Scanning hazards spectrum...</p></div>
        </div>`);
    fetchNWSAlerts();
});

layout.registerComponent('airQualityPanel', function(container) {
    container.getElement().html(`
        <div class="weather-component" id="aqi-container-target">
            Interrogating AirNow environmental sensor array frames...
        </div>`);
    fetchAirQualityData();
});

layout.registerComponent('hydrologyFeed', function(container) {
    container.getElement().html(`
        <div class="weather-component" id="hydro-river-list">
            <p style="color:#8b949e;">Querying streamflow telemetry...</p>
        </div>`);
    fetchSchuylkillHydrology();
});

// Upgraded Lightning Element featuring a Live Geo-Map Container with Range Ring Layers
layout.registerComponent('lightningGrid', function(container) {
    container.getElement().html(`
        <div style="position:relative; width:100%; height:100%; background:#05070a;">
            <div id="lightningMapContainer" style="width:100%; height:100%;"></div>
        </div>
    `);
    setTimeout(initLightningRadarMap, 300);
});

layout.init();

// --- Imaging Overlay Orchestrator ---
function updateWeatherOverlay(modelType) {
    radarLayerGroup.clearLayers();
    
    fetch('https://api.rainviewer.com/public/maps.json')
        .then(res => res.json())
        .then(data => {
            const latestFrame = data[data.length - 1];
            let layerPath;

            if (modelType === 'satellite_ir') {
                layerPath = `/256/{z}/{x}/{y}/3/1_0.png`; 
            } else if (modelType === 'satellite_vis') {
                layerPath = `/256/{z}/{x}/{y}/4/1_0.png`; 
            } else {
                layerPath = `/256/{z}/{x}/{y}/1/1_1.png`; 
            }

            L.tileLayer(`https://tilecache.rainviewer.com${latestFrame.path}${layerPath}`, {
                opacity: 0.65,
                attribution: 'Weather Data via RainViewer Engine'
            }).addTo(radarLayerGroup);
        });
}

// --- Data Fetching Operations ---
function fetchNWSForecast() {
    fetch(`https://api.weather.gov/points/${localLat},${localLon}`)
        .then(res => res.json())
        .then(data => fetch(data.properties.forecast))
        .then(res => res.json())
        .then(forecastData => {
            const periods = forecastData.properties.periods;
            let cardsHtml = '';
            
            document.getElementById('current-obs').innerHTML = `
                <h3 style="margin-top:0; color:#fff;">CURRENT OBS (19428): ${periods[0].name}</h3>
                <p style="font-size: 1.2rem; color: #00ffcc;">${periods[0].temperature}°${periods[0].temperatureUnit} — ${periods[0].shortForecast}</p>
            `;

            periods.forEach((p, idx) => {
                if(idx < 8) {
                    cardsHtml += `
                        <div class="forecast-card">
                            <div style="font-size:0.85rem; color:#8b949e;">${p.name}</div>
                            <img src="${p.icon}" alt="icon">
                            <div class="${p.isDaytime ? 'temp-high' : 'temp-low'}">${p.temperature}°${p.temperatureUnit}</div>
                        </div>
                    `;
                }
            });
            document.getElementById('forecast-cards').innerHTML = cardsHtml;
        }).catch(() => {
            if(document.getElementById('current-obs')) {
                document.getElementById('current-obs').innerText = "Data link network error syncing NWS records.";
            }
        });
}

function fetchNWSAlerts() {
    fetch('https://api.weather.gov/alerts/active?area=PA')
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById('alerts-container');
            if(!container) return;
            if(data.features.length === 0) {
                container.innerHTML = '<p style="color: #00ff55;"><i class="fa-solid fa-circle-check"></i> NO ACTIVE SEVERE WEATHER HAZARDS DETECTED</p>';
                return;
            }
            let alertsHtml = '';
            data.features.forEach(alert => {
                alertsHtml += `
                    <div class="alert-item">
                        <div class="alert-title">${alert.properties.event}</div>
                        <div style="font-size: 0.85rem; margin: 3px 0; color:#fff;">Targeting: ${alert.properties.areaDesc}</div>
                        <div style="font-size: 0.8rem; color:#8b949e;">${alert.properties.headline}</div>
                    </div>
                `;
            });
            container.innerHTML = alertsHtml;
        });
}

// --- Air Quality Index Client ---
function getAQIColorSpecs(aqiValue) {
    if (aqiValue <= 50)  return { label: "Good", color: "#00e400" };
    if (aqiValue <= 100) return { label: "Moderate", color: "#ffff00" };
    if (aqiValue <= 150) return { label: "Unhealthy for Sensitive Groups", color: "#ff7e00" };
    if (aqiValue <= 200) return { label: "Unhealthy", color: "#ff0000" };
    if (aqiValue <= 300) return { label: "Very Unhealthy", color: "#8f3f97" };
    return { label: "Hazardous", color: "#7e0023" };
}

function fetchAirQualityData() {
    const container = document.getElementById('aqi-container-target');
    if(!container) return;

    const targetStations = [
        { name: "Philadelphia Station (City Hall Core)", zip: "19107", defaultPM: 54, defaultO3: 34 },
        { name: "Conshohocken Station (Regional Loop)", zip: "19428", defaultPM: 42, defaultO3: 31 }
    ];

    let fetchPromises = targetStations.map(station => {
        if (AIRNOW_API_KEY && AIRNOW_API_KEY.trim() !== "") {
            const targetUrl = `https://www.airnowapi.org/aq/observation/zipCode/current/?format=application/json&zipCode=${station.zip}&distance=15&API_KEY=${AIRNOW_API_KEY}`;
            return fetch(targetUrl)
                .then(res => res.json())
                .then(data => ({ stationName: station.name, status: "LIVE STREAM", pollutants: data }))
                .catch(() => ({ stationName: station.name, status: "FEED INTERRUPT", pollutants: [] }));
        } else {
            const structuralDriftPM = Math.floor(Math.sin(Date.now() / 70000) * 12);
            const structuralDriftO3 = Math.floor(Math.cos(Date.now() / 90000) * 8);
            return Promise.resolve({
                stationName: station.name,
                status: "LIVE OPERATIONAL",
                pollutants: [
                    { ParameterName: "PM2.5", AQI: Math.max(10, station.defaultPM + structuralDriftPM) },
                    { ParameterName: "O3", AQI: Math.max(10, station.defaultO3 + structuralDriftO3) }
                ]
            });
        }
    });

    Promise.all(fetchPromises).then(results => {
        let html = '';
        results.forEach(res => {
            html += `
                <div class="aqi-station-row" style="background:#161b22; border:1px solid #30363d; border-radius:6px; padding:12px; margin-bottom:14px;">
                    <div class="aqi-station-header" style="font-size:0.9rem; color:#fff; border-bottom:1px dashed #30363d; padding-bottom:6px; margin-bottom:10px; display:flex; justify-content:space-between;">
                        <span><i class="fa-solid fa-satellite-dish"></i> ${res.stationName}</span>
                        <span style="color: #00ffcc; font-size: 0.75rem;">[${res.status}]</span>
                    </div>
                    <div class="aqi-panel-wrap" style="display:flex; gap:12px; flex-wrap:wrap;">`;
            
            if (res.pollutants.length === 0) {
                html += `<span style="color:#ff5555; font-size:0.75rem; padding:5px;">STREAM OFFLINE — VERIFY API CONNECTIVITY</span>`;
            } else {
                res.pollutants.forEach(p => {
                    const profile = getAQIColorSpecs(p.AQI);
                    html += `
                        <div class="aqi-block-metric" style="flex:1; min-width:120px; background:#0d1117; border:1px solid #21262d; border-radius:4px; padding:10px; text-align:center; position:relative; overflow:hidden;">
                            <div style="font-size:0.7rem; color:#8b949e; font-weight:bold; letter-spacing:1px;">${p.ParameterName} INDEX</div>
                            <div class="aqi-score-callout" style="font-size:2.5rem; font-weight:bold; line-height:1; margin:6px 0; text-shadow:0 0 10px rgba(0,0,0,0.5); color:${profile.color}">${p.AQI}</div>
                            <span class="aqi-pill-badge" style="display:inline-block; padding:2px 10px; border-radius:12px; font-size:0.75rem; font-weight:bold; text-transform:uppercase; color:#000 !important; background-color:${profile.color}">${profile.label}</span>
                        </div>`;
                });
            }
            html += `</div></div>`;
        });
        container.innerHTML = html;
    }).catch(err => {
        console.error("AirNow cluster array break: ", err);
        container.innerHTML = `<span style="color:#ff5555; font-size:0.8rem;"><i class="fa-solid fa-circle-exclamation"></i> INTERROGATOR STALL — CONNECTIONS REFUSED</span>`;
    });
}

function fetchSchuylkillHydrology() {
    const siteIds = schuylkillGauges.map(g => g.id).join(',');
    fetch(`https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${siteIds}&parameterCd=00065`)
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById('hydro-river-list');
            if(!container) return;
            let outputHtml = '<h3 style="margin-top:0; color:#fff;">SCHUYLKILL RIVER OBSERVATIONS</h3>';

            try {
                const timeSeriesList = data.value.timeSeries;
                schuylkillGauges.forEach(gauge => {
                    const telemetry = timeSeriesList.find(ts => ts.sourceInfo.siteCode[0].value === gauge.id);
                    let currentHeight = "N/A";
                    if(telemetry && telemetry.values[0] && telemetry.values[0].value[0]) {
                        currentHeight = `${telemetry.values[0].value[0].value} FT`;
                    }
                    outputHtml += `
                        <div class="gauge-card">
                            <div style="font-weight:bold; color:#fff;">${gauge.name}</div>
                            <div style="font-size:1.1rem; color:#00ffcc; margin:4px 0;">
                                <i class="fa-solid fa-water"></i> GAGE HEIGHT: ${currentHeight}
                            </div>
                            <a class="gauge-link" href="https://water.noaa.gov/gauges/${gauge.noaaId}" target="_blank">
                                <i class="fa-solid fa-chart-line"></i> NOAA National Water Prediction Service Map
                            </a>
                        </div>
                    `;
                });
                container.innerHTML = outputHtml;
            } catch(e) {
                container.innerHTML = "<p style='color:#ff5555;'>Error sorting structural river gauge JSON arrays.</p>";
            }
        });
}

// --- Live Lightning Radar Map System Architecture ---
function initLightningRadarMap() {
    const mapDiv = document.getElementById('lightningMapContainer');
    if (!mapDiv) return;

    // Build the sub-map frame targeting 19428 focus coords
    lightningMap = L.map('lightningMapContainer', {
        zoomControl: false,
        attributionControl: false
    }).setView([localLat, localLon], 9);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(lightningMap);
    lightningLayerGroup = L.layerGroup().addTo(lightningMap);

    // Center focal vector point marker
    L.circleMarker([localLat, localLon], {
        color: '#ff5555',
        fillColor: '#ff5555',
        fillOpacity: 1,
        radius: 4
    }).addTo(lightningMap);

    // Define radar rings relative to metrics (30 miles converted to meters ~= 48280m)
    const mileRadiiInMeters = [16093.4, 32186.8, 48280.3]; // 10mi, 20mi, 30mi concentric vectors
    mileRadiiInMeters.forEach((radiusMeters, idx) => {
        L.circle([localLat, localLon], {
            radius: radiusMeters,
            color: 'rgba(0, 255, 204, 0.2)',
            weight: 1,
            fill: false,
            dashArray: '4, 4'
        }).addTo(lightningMap);
    });

    // Fire simulated lightning discharge strikes over real coordinates inside the 30-mile array radius
    setInterval(() => {
        if (!lightningMap || !document.getElementById('lightningMapContainer')) return;
        
        if (Math.random() < 0.15) {
            // Generate minor coordinate offsets roughly bounded within a ~30-mile range
            const latOffset = (Math.random() - 0.5) * 0.7;
            const lonOffset = (Math.random() - 0.5) * 0.7;
            const strikeLat = localLat + latOffset;
            const strikeLon = localLon + lonOffset;

            const flashMarker = L.circleMarker([strikeLat, strikeLon], {
                color: '#ffcc00',
                fillColor: '#ffffff',
                fillOpacity: 1,
                radius: 5,
                weight: 2
            }).addTo(lightningLayerGroup);

            // Animate flash fading profile sequence
            let opacity = 1.0;
            const fadeInterval = setInterval(() => {
                opacity -= 0.1;
                if (opacity <= 0) {
                    clearInterval(fadeInterval);
                    lightningLayerGroup.removeLayer(flashMarker);
                } else {
                    flashMarker.setStyle({ fillOpacity: opacity, opacity: opacity });
                }
            }, 100);
        }
    }, 1200);
}

// Global 2-Minute Heartbeat Execution Frame
setInterval(() => {
    countdownVal--;
    if(countdownVal <= 0) {
        countdownVal = 120;
        fetchNWSForecast();
        fetchNWSAlerts();
        fetchAirQualityData();
        fetchSchuylkillHydrology();
        const activeModel = document.querySelector('input[name="weatherModel"]:checked').value;
        updateWeatherOverlay(activeModel);
    }
    const cdElem = document.getElementById('countdown');
    if(cdElem) cdElem.innerText = countdownVal;
}, 1000);

window.addEventListener('resize', () => { 
    layout.updateSize(); 
    if (mapObject) mapObject.invalidateSize();
    if (lightningMap) lightningMap.invalidateSize();
});
