// Local Configuration & Center Focus Variables
const localLat = 40.0759;
const localLon = -75.2996;
let countdownVal = 120;
let mapObject, radarLayerGroup;
let lightningMap, lightningLayerGroup; 

const AIRNOW_API_KEY = ""; 

const schuylkillGauges = [
    { id: "01472000", name: "Schuylkill River at Reading, PA", lat: 40.3323, lon: -75.9324, noaaId: "RDGP1" },
    { id: "01473500", name: "Schuylkill River at Pottstown, PA", lat: 40.2429, lon: -75.6605, noaaId: "PTTP1" },
    { id: "01474500", name: "Schuylkill River at Norristown, PA", lat: 40.1118, lon: -75.3532, noaaId: "NSRP1" },
    { id: "01474703", name: "Schuylkill River at Conshohocken, PA", lat: 40.0712, lon: -75.3093, noaaId: "CSHP1" },
    { id: "01474000", name: "Schuylkill River at Philadelphia, PA (Fairmount Dam)", lat: 39.9676, lon: -75.1832, noaaId: "PADP1" }
];

// REVISED: Layout Hierarchy - Column 3 now houses Lightning Grid followed by Air Quality Matrix
const config = {
    content: [{
        type: 'row',
        content: [
            {
                type: 'column',
                width: 40,
                content: [
                    { type: 'component', componentName: 'radarMap', title: 'NATIONWIDE WEATHER TRACKER & SCHUYLKILL GAUGE MATRICES' },
                    { type: 'component', componentName: 'localForecast', title: '7-DAY GEOGRAPHIC OUTLOOK (19428)' }
                ]
            },
            {
                type: 'column',
                width: 30,
                content: [
                    { type: 'component', componentName: 'nwsAlerts', title: 'CRITICAL HAZARD & NOAA ALERTS' },
                    { type: 'component', componentName: 'hydrologyFeed', title: 'SCHUYLKILL HYDROLOGIC REAL-TIME STREAMFLOW' }
                ]
            },
            {
                type: 'column',
                width: 30,
                content: [
                    { type: 'component', componentName: 'lightningGrid', title: 'DYNAMIC LOCAL LIGHTNING DETECTION ARRAY (30 MI RADIUS)' },
                    { type: 'component', componentName: 'airQualityPanel', title: 'REGIONAL AIR QUALITY MATRIX (AIRNOW REGIONAL)' }
                ]
            }
        ]
    }]
};

const layout = new GoldenLayout(config, '#layout-container');

// Registration of components
layout.registerComponent('radarMap', function(container) {
    container.getElement().html(`
        <div style="position:relative; width:100%; height:100%;">
            <div id="map" class="map-component" style="width:100%; height:100%;"></div>
        </div>
    `);
    setTimeout(() => {
        mapObject = L.map('map').setView([39.8283, -98.5795], 4);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(mapObject);
        radarLayerGroup = L.layerGroup().addTo(mapObject);
        updateWeatherOverlay('radar');
    }, 200);
});

layout.registerComponent('localForecast', function(container) {
    container.getElement().html(`<div class="weather-component"><div id="current-obs"></div><div class="forecast-grid" id="forecast-cards"></div></div>`);
    fetchNWSForecast();
});

layout.registerComponent('nwsAlerts', function(container) {
    container.getElement().html(`<div class="weather-component"><div id="alerts-container"></div></div>`);
    fetchNWSAlerts();
});

layout.registerComponent('airQualityPanel', function(container) {
    container.getElement().html(`<div class="weather-component" id="aqi-container-target"></div>`);
    fetchAirQualityData();
});

layout.registerComponent('hydrologyFeed', function(container) {
    container.getElement().html(`<div class="weather-component" id="hydro-river-list"></div>`);
    fetchSchuylkillHydrology();
});

// NEW: Real Map implementation for Lightning Component
layout.registerComponent('lightningGrid', function(container) {
    container.getElement().html(`<div id="lightningMapContainer" style="width:100%; height:100%;"></div>`);
    container.on('shown', () => {
        if (!lightningMap) initLightningRadarMap();
        else lightningMap.invalidateSize();
    });
});

layout.init();

// --- Lightning System Logic ---
function initLightningRadarMap() {
    lightningMap = L.map('lightningMapContainer', { zoomControl: false }).setView([localLat, localLon], 9);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(lightningMap);
    lightningLayerGroup = L.layerGroup().addTo(lightningMap);

    L.circleMarker([localLat, localLon], { color: '#ff5555', radius: 4 }).addTo(lightningMap);

    [16093.4, 32186.8, 48280.3].forEach(radius => {
        L.circle([localLat, localLon], { radius, color: 'rgba(0, 255, 204, 0.2)', weight: 1, fill: false }).addTo(lightningMap);
    });
}

// --- Data Fetching Operations ---
// [Functions: fetchNWSForecast, fetchNWSAlerts, fetchAirQualityData, fetchSchuylkillHydrology, updateWeatherOverlay]
// (Ensure existing function definitions remain identical to previous confirmed working states)

setInterval(() => {
    countdownVal--;
    if(countdownVal <= 0) {
        countdownVal = 120;
        fetchNWSForecast();
        fetchNWSAlerts();
        fetchAirQualityData();
        fetchSchuylkillHydrology();
    }
    const cdElem = document.getElementById('countdown');
    if(cdElem) cdElem.innerText = countdownVal;
}, 1000);

window.addEventListener('resize', () => { 
    layout.updateSize(); 
    if (mapObject) mapObject.invalidateSize();
    if (lightningMap) lightningMap.invalidateSize();
});
