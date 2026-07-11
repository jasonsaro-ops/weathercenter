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

// Layout configuration
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

// Component Registrations
layout.registerComponent('radarMap', function(container) {
    container.getElement().html(`
        <div style="position:relative; width:100%; height:100%;">
            <div class="control-panel" id="modelSelector" style="position:absolute; top:10px; left:10px; background:rgba(22, 27, 34, 0.95); border:1px solid #00ffcc; padding:8px; border-radius:4px; z-index:99;">
                <label><input type="radio" name="weatherModel" value="radar" checked> Radar</label>
                <label><input type="radio" name="weatherModel" value="satellite_ir"> Infrared</label>
            </div>
            <div id="map" style="width:100%; height:100%;"></div>
        </div>
    `);
    setTimeout(() => {
        mapObject = L.map('map').setView([localLat, localLon], 9);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(mapObject);
        radarLayerGroup = L.layerGroup().addTo(mapObject);
        updateWeatherOverlay('radar');
    }, 200);
});

layout.registerComponent('localForecast', function(container) {
    container.getElement().html(`<div class="weather-component"><div id="current-obs"></div><div id="forecast-cards"></div></div>`);
    fetchNWSForecast();
});

layout.registerComponent('nwsAlerts', function(container) {
    container.getElement().html(`<div class="weather-component" id="alerts-container"></div>`);
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

// Lightning Component with Live Map
layout.registerComponent('lightningGrid', function(container) {
    container.getElement().html(`<div id="lightningMapContainer" style="width:100%; height:100%;"></div>`);
    container.on('shown', () => {
        if (!lightningMap) initLightningRadarMap();
        else lightningMap.invalidateSize();
    });
});

layout.init();

// --- Logic Implementation ---
function initLightningRadarMap() {
    lightningMap = L.map('lightningMapContainer', { zoomControl: false }).setView([localLat, localLon], 9);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(lightningMap);
    lightningLayerGroup = L.layerGroup().addTo(lightningMap);
    L.circleMarker([localLat, localLon], { color: '#ff5555', radius: 4 }).addTo(lightningMap);
    [16093.4, 32186.8, 48280.3].forEach(radius => {
        L.circle([localLat, localLon], { radius, color: 'rgba(0, 255, 204, 0.2)', weight: 1, fill: false, dashArray: '4, 4' }).addTo(lightningMap);
    });
}

function updateWeatherOverlay(modelType) {
    if(!radarLayerGroup) return;
    radarLayerGroup.clearLayers();
    fetch('https://api.rainviewer.com/public/maps.json')
        .then(res => res.json())
        .then(data => {
            const latest = data[data.length - 1];
            const path = modelType === 'radar' ? '/1/1_1.png' : '/3/1_0.png';
            L.tileLayer(`https://tilecache.rainviewer.com${latest.path}/256/{z}/{x}/{y}${path}`).addTo(radarLayerGroup);
        });
}

function fetchNWSForecast() { /* Existing NWS Logic */ }
function fetchNWSAlerts() { /* Existing Alert Logic */ }
function fetchAirQualityData() { /* Existing AQI Logic */ }
function fetchSchuylkillHydrology() { /* Existing Hydrology Logic */ }

setInterval(() => {
    countdownVal--;
    if(countdownVal <= 0) {
        countdownVal = 120;
        fetchNWSForecast();
        fetchNWSAlerts();
        fetchAirQualityData();
        fetchSchuylkillHydrology();
    }
}, 1000);

window.addEventListener('resize', () => { 
    layout.updateSize(); 
    if (mapObject) mapObject.invalidateSize();
    if (lightningMap) lightningMap.invalidateSize();
});
