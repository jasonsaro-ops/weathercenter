// Local Configuration & Center Focus Variables
const localLat = 40.0759;
const localLon = -75.2996;
let countdownVal = 120;
let mapObject, radarLayerGroup;

// Define Key Schuylkill River Gauge Sites (Reading to Philadelphia)
const schuylkillGauges = [
    { id: "01472000", name: "Schuylkill River at Reading, PA", lat: 40.3323, lon: -75.9324, noaaId: "RDGP1" },
    { id: "01473500", name: "Schuylkill River at Pottstown, PA", lat: 40.2429, lon: -75.6605, noaaId: "PTTP1" },
    { id: "01474500", name: "Schuylkill River at Norristown, PA", lat: 40.1118, lon: -75.3532, noaaId: "NSRP1" },
    { id: "01474703", name: "Schuylkill River at Conshohocken, PA", lat: 40.0712, lon: -75.3093, noaaId: "CSHP1" },
    { id: "01474000", name: "Schuylkill River at Philadelphia, PA (Fairmount Dam)", lat: 39.9676, lon: -75.1832, noaaId: "PADP1" }
];

// Setup GoldenLayout v1.5.9 Configurations
const config = {
    content: [{
        type: 'row',
        content: [
            {
                type: 'column',
                width: 60,
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
                width: 40,
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
            }
        ]
    }]
};

const layout = new GoldenLayout(config, '#layout-container');

// Map Component with Model Selection Options
layout.registerComponent('radarMap', function(container) {
    container.getElement().html(`
        <div style="position:relative; width:100%; height:100%;">
            <div class="control-panel" id="modelSelector">
                <div style="font-weight:bold; color:#00ffcc; margin-bottom:5px; font-size:0.9rem;">MODEL DATA FEEDS</div>
                <label><input type="radio" name="weatherModel" value="radar" checked> NEXRAD Weather Radar</label>
                <label><input type="radio" name="weatherModel" value="satellite_ir"> GOES-East Infrared</label>
                <label><input type="radio" name="weatherModel" value="satellite_vis"> GOES-East Visible</label>
            </div>
            <div id="map" class="map-component"></div>
        </div>
    `);

    setTimeout(() => {
        // Initialize map pulled back far enough to capture full CONUS tracking
        mapObject = L.map('map').setView([39.8283, -98.5795], 4);
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '©OpenStreetMap, ©CartoDB'
        }).addTo(mapObject);

        radarLayerGroup = L.layerGroup().addTo(mapObject);

        // Map Radio Control Listeners
        document.querySelectorAll('input[name="weatherModel"]').forEach(elem => {
            elem.addEventListener('change', (e) => { updateWeatherOverlay(e.target.value); });
        });

        // Initialize First Model Load (NEXRAD)
        updateWeatherOverlay('radar');

        // Add Interactive Schuylkill Hydro-Markers
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

        // Zoom map smoothly to local Schuylkill cluster view on entry
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

layout.registerComponent('hydrologyFeed', function(container) {
    container.getElement().html(`
        <div class="weather-component" id="hydro-river-list">
            <p style="color:#8b949e;">Querying streamflow telemetry telemetry...</p>
        </div>`);
    fetchSchuylkillHydrology();
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
                layerPath = `/256/{z}/{x}/{y}/3/1_0.png`; // RainViewer Infrared Profile
            } else if (modelType === 'satellite_vis') {
                layerPath = `/256/{z}/{x}/{y}/4/1_0.png`; // RainViewer Visible Profile
            } else {
                layerPath = `/256/{z}/{x}/{y}/1/1_1.png`; // Standard NEXRAD Radar Base
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

function fetchSchuylkillHydrology() {
    const siteIds = schuylkillGauges.map(g => g.id).join(',');
    // Fetch multi-station Instantaneous Values (Parameter 00065 = Gage Height)
    fetch(`https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${siteIds}&parameterCd=00065`)
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById('hydro-river-list');
            if(!container) return;
            let outputHtml = '<h3 style="margin-top:0; color:#fff;">SCHUYLKILL RIVER OBSERVATIONS</h3>';

            try {
                const timeSeriesList = data.value.timeSeries;
                
                schuylkillGauges.forEach(gauge => {
                    // Match returned API telemetry with local array configuration profile
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

// Global 2-Minute Heartbeat Execution Frame
setInterval(() => {
    countdownVal--;
    if(countdownVal <= 0) {
        countdownVal = 120;
        fetchNWSForecast();
        fetchNWSAlerts();
        fetchSchuylkillHydrology();
        const activeModel = document.querySelector('input[name="weatherModel"]:checked').value;
        updateWeatherOverlay(activeModel);
    }
    const cdElem = document.getElementById('countdown');
    if(cdElem) cdElem.innerText = countdownVal;
}, 1000);

window.addEventListener('resize', () => { layout.updateSize(); });
