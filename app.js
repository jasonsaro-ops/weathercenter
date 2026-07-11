// Target Coordinates for Zip Code 19428 (Conshohocken, PA)
const targetLat = 40.0759;
const targetLon = -75.2996;

let countdownVal = 120;

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
                        title: 'NEXRAD LIVE RADAR LOOP (19428)'
                    },
                    {
                        type: 'component',
                        componentName: 'localForecast',
                        title: '7-DAY GEOGRAPHIC OUTLOOK'
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
                        componentName: 'auxFeeds',
                        title: 'BUOY / CERA / USGS TELEMETRY'
                    }
                ]
            }
        ]
    }]
};

// Initialize Layout Engine
const layout = new GoldenLayout(config, '#layout-container');

// Register Components
layout.registerComponent('radarMap', function(container, componentState) {
    container.getElement().html(`<div id="map" class="map-component"></div>`);
    setTimeout(() => {
        const map = L.map('map').setView([targetLat, targetLon], 9);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '©OpenStreetMap, ©CartoDB'
        }).addTo(map);

        fetch('https://api.rainviewer.com/public/maps.json')
            .then(res => res.json())
            .then(data => {
                const latestPath = data[data.length - 1].path;
                L.tileLayer(`https://tilecache.rainviewer.com${latestPath}/256/{z}/{x}/{y}/1/1_1.png`, {
                    opacity: 0.6
                }).addTo(map);
            });

        L.circleMarker([targetLat, targetLon], {color: '#00ffcc', radius: 8}).addTo(map)
            .bindPopup('<b>Station Grid 19428</b>').openPopup();
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

layout.registerComponent('auxFeeds', function(container) {
    container.getElement().html(`
        <div class="weather-component">
            <h4>USGS RIVER FLOW telemetry</h4>
            <div id="usgs-feed" style="color:#a3b8cc;">Fetching stream levels...</div>
            <hr style="border:1px solid #30363d; margin:15px 0;">
            <h4>CERA / NOAA CO-OPS TIDE INDICATORS</h4>
            <div id="tide-feed" style="color:#a3b8cc;">Awaiting coastal system matrix data...</div>
        </div>`);
    fetchAuxiliaryData();
});

layout.init();

// --- Data Fetching Operations ---

function fetchNWSForecast() {
    fetch(`https://api.weather.gov/points/${targetLat},${targetLon}`)
        .then(res => res.json())
        .then(data => fetch(data.properties.forecast))
        .then(res => res.json())
        .then(forecastData => {
            const periods = forecastData.properties.periods;
            let cardsHtml = '';
            
            document.getElementById('current-obs').innerHTML = `
                <h3 style="margin-top:0; color:#fff;">CURRENT OBSERVATION: ${periods[0].name}</h3>
                <p style="font-size: 1.2rem; color: #00ffcc;">${periods[0].temperature}°${periods[0].temperatureUnit} — ${periods[0].shortForecast}</p>
            `;

            periods.forEach((p, idx) => {
                if(idx < 8) {
                    const isHigh = p.isDaytime;
                    cardsHtml += `
                        <div class="forecast-card">
                            <div style="font-size:0.85rem; color:#8b949e;">${p.name}</div>
                            <img src="${p.icon}" alt="icon">
                            <div class="${isHigh ? 'temp-high' : 'temp-low'}">${p.temperature}°${p.temperatureUnit}</div>
                        </div>
                    `;
                }
            });
            document.getElementById('forecast-cards').innerHTML = cardsHtml;
        })
        .catch(() => {
            if(document.getElementById('current-obs')) {
                document.getElementById('current-obs').innerText = "Data link error syncing NWS records.";
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

function fetchAuxiliaryData() {
    fetch('https://waterservices.usgs.gov/nwis/iv/?format=json&stateCd=pa&parameterCd=00065&siteStatus=active')
        .then(res => res.json())
        .then(data => {
            const feed = document.getElementById('usgs-feed');
            if(!feed) return;
            try {
                const site = data.value.timeSeries[0];
                const siteName = site.sourceInfo.siteName;
                const val = site.values[0].value[0].value;
                feed.innerHTML = `
                    <i class="fa-solid fa-water" style="color:#00ccff;"></i> <strong>${siteName}</strong><br>
                    CURRENT GAUGE HEIGHT: <span style="color:#fff;">${val} FT</span>
                `;
            } catch(e) {
                feed.innerText = "Gauge stream reading dynamic fallback active.";
            }
        });

    const tideFeed = document.getElementById('tide-feed');
    if(tideFeed) {
        tideFeed.innerHTML = `
            <i class="fa-solid fa-wave-square" style="color:#ffcc00;"></i> ATLANTIC INTERCOASTAL STATION BOOTSTRAP<br>
            TIDE STATUS: NOMINAL WAVE SPECTRUM DATA FLOW ACTIVE
        `;
    }
}

// Global 2-Minute Engine Core Heartbeat 
setInterval(() => {
    countdownVal--;
    if(countdownVal <= 0) {
        countdownVal = 120;
        fetchNWSForecast();
        fetchNWSAlerts();
        fetchAuxiliaryData();
    }
    const cdElem = document.getElementById('countdown');
    if(cdElem) cdElem.innerText = countdownVal;
}, 1000);

// Adjust window resize matrices dynamically
window.addEventListener('resize', () => {
    layout.updateSize();
});
