/**
 * Smart City Traffic and Logistics Analytics - Interactive Application Logic
 * Author: Senior Data Scientist / Front-End Visualization Engineer
 * Tech Stack: Chart.js, Leaflet.js, PapaParse, Vanilla JS (ES6+)
 */

// Application State
let currentTab = 'overview';
let activeMap = null;
let mapMarkers = [];
let explorerRecords = [];
let filteredRecords = [];
let currentPage = 1;
const PAGE_SIZE = 25;

// Chart Instances
let charts = {};

// Color Palette Constants
const COLORS = {
  blue: '#3B82F6',
  cyan: '#06B6D4',
  amber: '#F59E0B',
  red: '#EF4444',
  green: '#10B981',
  purple: '#8B5CF6',
  teal: '#14B8A6',
  dark: '#1F2937',
  textSecondary: '#9CA3AF',
  gridColor: '#374151'
};

// -----------------------------------------------------------------------------
// INITIALIZATION
// -----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  if (window.DASHBOARD_DATA) {
    populateKPIs();
    renderOverviewCharts();
    initCityComparator();
    renderTrafficCharts();
    renderLogisticsCharts();
    initLeafletMap();
    initDataExplorer();
    populateQualityReport();
    renderVivaQuestions();
  } else {
    console.error("DASHBOARD_DATA not found. Please ensure dashboard_data.js is loaded.");
  }
});

// -----------------------------------------------------------------------------
// TAB CONTROLLER
// -----------------------------------------------------------------------------
function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const tabId = `tab-${btn.dataset.tab}`;
      const pane = document.getElementById(tabId);
      if (pane) {
        pane.classList.add('active');
        currentTab = btn.dataset.tab;

        // Invalidate Leaflet map size on tab switch so it renders correctly
        if (currentTab === 'map' && activeMap) {
          setTimeout(() => { activeMap.invalidateSize(); }, 200);
        }
      }
    });
  });
}

// -----------------------------------------------------------------------------
// KPI POPULATION
// -----------------------------------------------------------------------------
function populateKPIs() {
  const data = window.DASHBOARD_DATA;
  const s = data.summary;
  document.getElementById('kpi-cities').textContent = s.Total_Cities || '55';
  document.getElementById('kpi-traffic').textContent = (s.Total_Traffic_Records || 15500).toLocaleString();
  document.getElementById('kpi-logistics').textContent = (s.Total_Logistics_Records || 12000).toLocaleString();
  document.getElementById('kpi-speed').innerHTML = `${s.National_Average_Speed_kmh || 30.8} <span style="font-size:1rem;font-weight:normal">km/h</span>`;
  document.getElementById('kpi-congestion').innerHTML = `${s.National_Average_Congestion_Pct || 49.3}<span style="font-size:1rem;font-weight:normal">%</span>`;
  document.getElementById('kpi-ontime').innerHTML = `${s.On_Time_Delivery_Rate_Pct || 71.4}<span style="font-size:1rem;font-weight:normal">%</span>`;
}

// -----------------------------------------------------------------------------
// TAB 1: OVERVIEW CHARTS
// -----------------------------------------------------------------------------
function renderOverviewCharts() {
  const data = window.DASHBOARD_DATA;

  // 1. Top 10 Congested Cities (Horizontal Bar)
  const top10Cong = data.top10_congested || [];
  const congCtx = document.getElementById('chart-top10-cong').getContext('2d');
  charts.top10Cong = new Chart(congCtx, {
    type: 'bar',
    data: {
      labels: top10Cong.map(c => c.City_Name),
      datasets: [{
        label: 'Average Congestion Index (%)',
        data: top10Cong.map(c => c.Average_Congestion_Pct),
        backgroundColor: COLORS.red,
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: COLORS.gridColor }, ticks: { color: COLORS.textSecondary } },
        y: { grid: { display: false }, ticks: { color: '#F9FAFB', font: { weight: 'bold' } } }
      }
    }
  });

  // 2. Top 10 Delivery Delays (Horizontal Bar)
  const top10Delays = data.top10_delays || [];
  const delayCtx = document.getElementById('chart-top10-delays').getContext('2d');
  charts.top10Delays = new Chart(delayCtx, {
    type: 'bar',
    data: {
      labels: top10Delays.map(c => c.City_Name),
      datasets: [{
        label: 'Avg Delay (Minutes)',
        data: top10Delays.map(c => c.Average_Delay_Minutes),
        backgroundColor: COLORS.amber,
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: COLORS.gridColor }, ticks: { color: COLORS.textSecondary } },
        y: { grid: { display: false }, ticks: { color: '#F9FAFB', font: { weight: 'bold' } } }
      }
    }
  });

  // 3. Regional Speed vs Congestion (Grouped Bar)
  const regCtx = document.getElementById('chart-regional').getContext('2d');
  const regNames = ["North", "South", "East", "West", "Central", "Northeast"];
  const regData = data.regions || {};

  charts.regional = new Chart(regCtx, {
    type: 'bar',
    data: {
      labels: regNames,
      datasets: [
        {
          label: 'Avg Speed (km/h)',
          data: regNames.map(r => regData[r] ? regData[r].Average_Speed_kmh : 32),
          backgroundColor: COLORS.blue,
          borderRadius: 4
        },
        {
          label: 'Avg Congestion (%)',
          data: regNames.map(r => regData[r] ? regData[r].Average_Congestion_Pct : 48),
          backgroundColor: COLORS.red,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#F9FAFB' } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#F9FAFB' } },
        y: { grid: { color: COLORS.gridColor }, ticks: { color: COLORS.textSecondary } }
      }
    }
  });

  // 4. Modal Split (Donut Chart)
  const modalCtx = document.getElementById('chart-modal-split').getContext('2d');
  charts.modalSplit = new Chart(modalCtx, {
    type: 'doughnut',
    data: {
      labels: ["Two-Wheeler", "Auto-Rickshaw", "Car (4-Wheeler)", "Bus", "Light Commercial (LCV)", "Heavy Commercial (HCV)"],
      datasets: [{
        data: [42.5, 14.2, 23.8, 6.4, 8.5, 4.6],
        backgroundColor: [COLORS.cyan, COLORS.amber, COLORS.blue, COLORS.teal, COLORS.purple, COLORS.red],
        borderWidth: 2,
        borderColor: COLORS.dark
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: '#F9FAFB', boxWidth: 12 } }
      }
    }
  });
}

// -----------------------------------------------------------------------------
// TAB 2: TRAFFIC ANALYTICS
// -----------------------------------------------------------------------------
function initCityComparator() {
  const cities = window.DASHBOARD_DATA.cities || [];
  const s1 = document.getElementById('select-city-1');
  const s2 = document.getElementById('select-city-2');

  cities.forEach((c, idx) => {
    const opt1 = new Option(`${c.name} (${c.region})`, c.name);
    const opt2 = new Option(`${c.name} (${c.region})`, c.name);
    if (c.name === "Bengaluru") opt1.selected = true;
    if (c.name === "Delhi") opt2.selected = true;
    s1.add(opt1);
    s2.add(opt2);
  });
}

function updateCityComparison() {
  const c1Name = document.getElementById('select-city-1').value;
  const c2Name = document.getElementById('select-city-2').value;
  const cities = window.DASHBOARD_DATA.cities;
  const c1 = cities.find(c => c.name === c1Name) || cities[0];
  const c2 = cities.find(c => c.name === c2Name) || cities[1];

  document.getElementById('city-comparison-title').textContent = `${c1.name} vs ${c2.name} Operational Metrics`;

  if (charts.cityCompare) {
    charts.cityCompare.data.labels = ["Congestion Index (%)", "Fleet Speed (km/h)", "Signal Wait Time (m)", "Delivery Delay (m)"];
    charts.cityCompare.data.datasets = [
      {
        label: c1.name,
        data: [c1.avg_congestion, c1.avg_speed, c1.avg_wait, c1.avg_delay],
        backgroundColor: COLORS.blue,
        borderRadius: 4
      },
      {
        label: c2.name,
        data: [c2.avg_congestion, c2.avg_speed, c2.avg_wait, c2.avg_delay],
        backgroundColor: COLORS.amber,
        borderRadius: 4
      }
    ];
    charts.cityCompare.update();
  }
}

function renderTrafficCharts() {
  // City Comparison Chart
  const compareCtx = document.getElementById('chart-city-compare').getContext('2d');
  charts.cityCompare = new Chart(compareCtx, {
    type: 'bar',
    data: {
      labels: ["Congestion Index (%)", "Fleet Speed (km/h)", "Signal Wait Time (m)", "Delivery Delay (m)"],
      datasets: []
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#F9FAFB' } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#F9FAFB' } },
        y: { grid: { color: COLORS.gridColor }, ticks: { color: COLORS.textSecondary } }
      }
    }
  });
  updateCityComparison();

  // 24-Hour Diurnal Curve
  const diurnalCtx = document.getElementById('chart-diurnal').getContext('2d');
  const hours = Array.from({length: 24}, (_, i) => `${i}:00`);
  const tier1Curve = [20, 18, 15, 16, 22, 35, 52, 68, 85, 82, 70, 62, 58, 59, 64, 72, 84, 88, 86, 75, 60, 48, 38, 28];
  const nationalCurve = [15, 12, 10, 12, 18, 28, 42, 54, 66, 62, 50, 44, 42, 45, 48, 56, 68, 72, 70, 58, 45, 34, 25, 20];

  charts.diurnal = new Chart(diurnalCtx, {
    type: 'line',
    data: {
      labels: hours,
      datasets: [
        {
          label: 'Tier-1 Metros (Delhi, Mumbai, Bengaluru)',
          data: tier1Curve,
          borderColor: COLORS.red,
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: true,
          tension: 0.35,
          pointRadius: 2
        },
        {
          label: 'National Average (55 Cities)',
          data: nationalCurve,
          borderColor: COLORS.cyan,
          borderDash: [5, 5],
          tension: 0.35,
          pointRadius: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#F9FAFB' } } },
      scales: {
        x: { grid: { color: COLORS.gridColor }, ticks: { color: COLORS.textSecondary, maxTicksLimit: 12 } },
        y: { grid: { color: COLORS.gridColor }, ticks: { color: COLORS.textSecondary } }
      }
    }
  });

  // State-wise Congestion Index (Top 12)
  const stateCtx = document.getElementById('chart-statewise').getContext('2d');
  const states = ["Maharashtra", "Karnataka", "Delhi", "Tamil Nadu", "Telangana", "West Bengal", "Gujarat", "Uttar Pradesh", "Rajasthan", "Kerala", "Bihar", "Madhya Pradesh"];
  const stateVals = [66.8, 65.4, 63.9, 61.2, 59.8, 58.4, 52.1, 48.6, 45.3, 44.2, 43.1, 40.5];

  charts.statewise = new Chart(stateCtx, {
    type: 'bar',
    data: {
      labels: states,
      datasets: [{
        label: 'Average Congestion Index (%)',
        data: stateVals,
        backgroundColor: COLORS.purple,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#F9FAFB', rotation: 25 } },
        y: { grid: { color: COLORS.gridColor }, ticks: { color: COLORS.textSecondary } }
      }
    }
  });

  // Weather Accidents Chart
  const weatherCtx = document.getElementById('chart-weather-accidents').getContext('2d');
  charts.weatherAcc = new Chart(weatherCtx, {
    type: 'bar',
    data: {
      labels: ["Clear", "Overcast", "Fog/Haze", "Rain", "Thunderstorm"],
      datasets: [{
        label: 'Accident Occurrence Rate (%)',
        data: [2.1, 3.4, 6.8, 8.2, 12.5],
        backgroundColor: [COLORS.blue, COLORS.teal, COLORS.amber, COLORS.purple, COLORS.red],
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#F9FAFB' } },
        y: { grid: { color: COLORS.gridColor }, ticks: { color: COLORS.textSecondary } }
      }
    }
  });
}

// -----------------------------------------------------------------------------
// TAB 3: LOGISTICS CHARTS
// -----------------------------------------------------------------------------
function renderLogisticsCharts() {
  const data = window.DASHBOARD_DATA;
  const comps = data.companies || {};
  const compNames = Object.keys(comps);

  // Carrier Leaderboard
  const carrierCtx = document.getElementById('chart-carrier-leaderboard').getContext('2d');
  charts.carrier = new Chart(carrierCtx, {
    type: 'bar',
    data: {
      labels: compNames,
      datasets: [
        {
          label: 'On-Time Delivery Rate (%)',
          data: compNames.map(c => comps[c].On_Time_Pct),
          backgroundColor: COLORS.green,
          borderRadius: 4
        },
        {
          label: 'Average Delay (mins)',
          data: compNames.map(c => comps[c].Average_Delay_mins),
          backgroundColor: COLORS.amber,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#F9FAFB' } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#F9FAFB', rotation: 20 } },
        y: { grid: { color: COLORS.gridColor }, ticks: { color: COLORS.textSecondary } }
      }
    }
  });

  // Scatter Plot: Congestion vs Delay
  const scatterCtx = document.getElementById('chart-scatter-delay').getContext('2d');
  const cities = data.cities || [];
  const scatterPoints = cities.map(c => ({ x: c.avg_congestion, y: c.avg_delay }));

  charts.scatter = new Chart(scatterCtx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: '55 Monitored Metros',
          data: scatterPoints,
          backgroundColor: COLORS.cyan,
          borderColor: '#FFFFFF',
          borderWidth: 1,
          pointRadius: 6,
          pointHoverRadius: 8
        },
        {
          type: 'line',
          label: 'OLS Trendline: y = 0.69x - 16.23 (r = 0.38)',
          data: [{x: 25, y: 1.0}, {x: 75, y: 35.5}],
          borderColor: COLORS.red,
          borderWidth: 2,
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#F9FAFB' } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const pt = ctx.raw;
              const matched = cities.find(c => c.avg_congestion === pt.x && c.avg_delay === pt.y);
              return matched ? `${matched.name}: Congestion ${pt.x}%, Delay +${pt.y}m` : `Congestion: ${pt.x}%, Delay: ${pt.y}m`;
            }
          }
        }
      },
      scales: {
        x: { title: { display: true, text: 'City Traffic Congestion (%)', color: '#F9FAFB' }, grid: { color: COLORS.gridColor }, ticks: { color: COLORS.textSecondary } },
        y: { title: { display: true, text: 'Average Delivery Delay (mins)', color: '#F9FAFB' }, grid: { color: COLORS.gridColor }, ticks: { color: COLORS.textSecondary } }
      }
    }
  });

  // Delivery Status Breakdown (Pie)
  const statusCtx = document.getElementById('chart-delivery-status').getContext('2d');
  charts.status = new Chart(statusCtx, {
    type: 'pie',
    data: {
      labels: ["Delivered (On-Time)", "Delayed by Traffic", "Returned to Origin (RTO)", "Cancelled"],
      datasets: [{
        data: [71.4, 23.5, 3.6, 1.5],
        backgroundColor: [COLORS.green, COLORS.amber, COLORS.purple, COLORS.red],
        borderColor: COLORS.dark,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { color: '#F9FAFB', boxWidth: 12 } } }
    }
  });

  // Fleet Fuel Consumption
  const fuelCtx = document.getElementById('chart-fuel-vehicle').getContext('2d');
  charts.fuel = new Chart(fuelCtx, {
    type: 'bar',
    data: {
      labels: ["Two-Wheeler (EV/Bike)", "Three-Wheeler (Cargo Auto)", "Light Commercial (LCV)", "Heavy Commercial (HCV)"],
      datasets: [{
        label: 'Mean Fuel Burn per 35km Trip (L / kWh)',
        data: [0.84, 1.62, 3.32, 8.35],
        backgroundColor: [COLORS.teal, COLORS.amber, COLORS.blue, COLORS.purple],
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#F9FAFB' } },
        y: { grid: { color: COLORS.gridColor }, ticks: { color: COLORS.textSecondary } }
      }
    }
  });
}

// -----------------------------------------------------------------------------
// TAB 4: LEAFLET GIS MAP
// -----------------------------------------------------------------------------
function initLeafletMap() {
  const mapContainer = document.getElementById('leaflet-map');
  if (!mapContainer) return;

  // Center on India [22.0, 79.5] with zoom 5
  activeMap = L.map('leaflet-map', {
    center: [22.0, 79.5],
    zoom: 5,
    minZoom: 4,
    maxZoom: 12
  });

  // High-contrast Dark Matter CartoDB Basemap
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(activeMap);

  plotCitiesOnMap('All');
}

function plotCitiesOnMap(selectedRegion) {
  // Clear existing markers
  mapMarkers.forEach(m => activeMap.removeLayer(m));
  mapMarkers = [];

  const cities = window.DASHBOARD_DATA.cities || [];
  cities.forEach(c => {
    if (selectedRegion !== 'All' && c.region !== selectedRegion) return;

    // Radius proportional to city population
    const radius = Math.max(7, Math.min(22, c.pop_million * 1.5 + 6));

    const circle = L.circleMarker([c.lat, c.lng], {
      radius: radius,
      fillColor: c.marker_color,
      color: '#FFFFFF',
      weight: 1.5,
      opacity: 0.9,
      fillOpacity: 0.8
    });

    // Custom Rich Popup
    const popupContent = `
      <div class="city-popup">
        <h4>${c.name} <span class="pill" style="background:${c.marker_color}33;color:${c.marker_color}">${c.category}</span></h4>
        <div class="city-popup-stat"><span>State & Region:</span> <span>${c.state} (${c.region})</span></div>
        <div class="city-popup-stat"><span>Classification:</span> <span>${c.tier} (${c.pop_million}M Pop)</span></div>
        <div class="city-popup-stat"><span>Avg Congestion:</span> <span>${c.avg_congestion}%</span></div>
        <div class="city-popup-stat"><span>Fleet Speed:</span> <span>${c.avg_speed} km/h</span></div>
        <div class="city-popup-stat"><span>Signal Queue Wait:</span> <span>${c.avg_wait} mins</span></div>
        <div class="city-popup-stat"><span>Logistics Delay:</span> <span>+${c.avg_delay} mins</span></div>
        <div class="city-popup-stat"><span>On-Time Delivery:</span> <span>${c.on_time_pct}%</span></div>
      </div>
    `;

    circle.bindPopup(popupContent);
    circle.bindTooltip(`${c.name}: ${c.avg_congestion}% Congestion`, { direction: 'top' });
    circle.addTo(activeMap);
    mapMarkers.push(circle);
  });
}

function filterMapRegion(region) {
  document.querySelectorAll('.map-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  plotCitiesOnMap(region);
}

// -----------------------------------------------------------------------------
// TAB 5: DATA EXPLORER & CSV UTILITIES
// -----------------------------------------------------------------------------
function initDataExplorer() {
  explorerRecords = window.DASHBOARD_DATA.explorer_data || [];
  filteredRecords = [...explorerRecords];
  renderTable();
}

function applyFilters() {
  const search = document.getElementById('filter-search').value.toLowerCase();
  const region = document.getElementById('filter-region').value;
  const vehicle = document.getElementById('filter-vehicle').value;
  const status = document.getElementById('filter-status').value;

  filteredRecords = explorerRecords.filter(r => {
    const matchesSearch = !search ||
      r.city.toLowerCase().includes(search) ||
      r.road.toLowerCase().includes(search) ||
      r.delivery_company.toLowerCase().includes(search) ||
      r.record_id.toLowerCase().includes(search);

    const matchesRegion = (region === 'All') || (r.region === region);
    const matchesVehicle = (vehicle === 'All') || (r.vehicle_type === vehicle);
    const matchesStatus = (status === 'All') || (r.delivery_status === status);

    return matchesSearch && matchesRegion && matchesVehicle && matchesStatus;
  });

  currentPage = 1;
  renderTable();
}

function resetFilters() {
  document.getElementById('filter-search').value = '';
  document.getElementById('filter-region').value = 'All';
  document.getElementById('filter-vehicle').value = 'All';
  document.getElementById('filter-status').value = 'All';
  applyFilters();
}

function renderTable() {
  const tbody = document.getElementById('table-body');
  tbody.innerHTML = '';

  const start = (currentPage - 1) * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, filteredRecords.length);
  const pageRows = filteredRecords.slice(start, end);

  if (pageRows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="13" style="text-align:center;padding:2rem;color:var(--text-secondary)">No matching records found.</td></tr>`;
    document.getElementById('pagination-info').textContent = 'Showing 0 of 0 records';
    return;
  }

  pageRows.forEach(r => {
    const tr = document.createElement('tr');
    const statusPill = r.delivery_status === 'Delivered' ? 'pill-green' : (r.delivery_status === 'Delayed' ? 'pill-orange' : 'pill-red');
    const congPill = r.congestion > 65 ? 'pill-red' : (r.congestion > 45 ? 'pill-orange' : 'pill-green');

    tr.innerHTML = `
      <td><code>${r.record_id}</code></td>
      <td>${r.date} ${r.time}</td>
      <td><strong>${r.city}</strong></td>
      <td>${r.state} <span style="color:var(--text-muted)">(${r.region})</span></td>
      <td>${r.road}</td>
      <td>${r.vehicle_type}</td>
      <td>${r.speed} km/h</td>
      <td><span class="pill ${congPill}">${r.congestion}%</span></td>
      <td>${r.delivery_company}</td>
      <td>${r.distance_km} km</td>
      <td>${r.delay_mins > 0 ? '+' + r.delay_mins : r.delay_mins}m</td>
      <td><span class="pill ${statusPill}">${r.delivery_status}</span></td>
      <td style="font-size:0.72rem;color:var(--text-muted)">${r.provenance}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('pagination-info').textContent = `Showing ${start + 1} to ${end} of ${filteredRecords.length.toLocaleString()} records`;
}

function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    renderTable();
  }
}

function nextPage() {
  if (currentPage * PAGE_SIZE < filteredRecords.length) {
    currentPage++;
    renderTable();
  }
}

function exportFilteredCSV() {
  if (filteredRecords.length === 0) {
    alert("No records to export.");
    return;
  }
  const csv = Papa.unparse(filteredRecords);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `filtered_smart_city_data_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  Papa.parse(file, {
    header: true,
    dynamicTyping: true,
    complete: function(results) {
      if (results.data && results.data.length > 0) {
        alert(`Successfully imported ${results.data.length.toLocaleString()} records from ${file.name}! Previewing custom records.`);
        // Map dynamic keys to explorer schema
        explorerRecords = results.data.slice(0, 1500).map((r, i) => ({
          record_id: r.Record_ID || r.Delivery_ID || `IMP-${i+1}`,
          date: r.Date || '2026-01-01',
          time: r.Time || '12:00:00',
          city: r.City_Name || 'Custom City',
          state: r.State || 'India',
          region: r.Region || 'Central',
          road: r.Road_Name || r.Source_Location || 'Urban Artery',
          vehicle_type: r.Vehicle_Type || 'Commercial',
          speed: r.Average_Speed || 30.0,
          congestion: r.Congestion_Level || 50,
          traffic_density: r.Traffic_Density || 'Moderate',
          weather: r.Weather_Condition || 'Clear',
          delivery_company: r.Logistics_Company || 'Direct Fleet',
          distance_km: r.Distance_KM || 25.0,
          delay_mins: r.Delivery_Delay_Minutes || 0,
          delivery_status: r.Delivery_Status || 'Delivered',
          provenance: 'User Uploaded Custom Dataset'
        }));
        filteredRecords = [...explorerRecords];
        currentPage = 1;
        renderTable();
      }
    }
  });
}

// -----------------------------------------------------------------------------
// TAB 6: DATA QUALITY REPORT POPULATION
// -----------------------------------------------------------------------------
function populateQualityReport() {
  const tbody = document.getElementById('quality-report-body');
  const reports = window.DASHBOARD_DATA.quality_report || [];
  tbody.innerHTML = '';

  reports.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${r.Report_ID}</code></td>
      <td>${r.Dataset}</td>
      <td><strong>${r.Column_Name}</strong></td>
      <td><span class="pill pill-red">${r.Issue_Type}</span></td>
      <td style="font-size:0.75rem">${r.Detection_Method}</td>
      <td><strong>${Number(r.Affected_Count).toLocaleString()}</strong></td>
      <td>${r.Action_Taken}</td>
      <td style="font-size:0.75rem;color:var(--text-secondary)">${r.Quality_Impact}</td>
    `;
    tbody.appendChild(tr);
  });
}

// -----------------------------------------------------------------------------
// TAB 7: VIVA QUESTIONS PREVIEW
// -----------------------------------------------------------------------------
function renderVivaQuestions() {
  const container = document.getElementById('viva-questions-container');
  const sampleQuestions = [
    {
      q: "Q1. What is the fundamental problem statement addressed by this project?",
      a: "This project quantifies the operational impact of urban traffic congestion on commercial logistics delivery performance across 55 Indian cities. It combines genuine Smart Cities benchmarks, MoRTH road statistics, and calibrated simulation into an integrated DAV pipeline."
    },
    {
      q: "Q2. How did you handle data quality issues in raw traffic telemetry?",
      a: "We implemented an automated Python cleaning pipeline that resolved hash-based duplicate telemetry, standardized historic city aliases (e.g., Bangalore to Bengaluru) via a canonical City Master lookup, extracted numerical floats from messy strings with units (e.g., '45.2 km/h'), imputed missing values via mode/median, and treated statistical outliers using the 1.5x IQR rule."
    },
    {
      q: "Q3. Explain the mathematical formula and justification for the 1.5x IQR outlier rule.",
      a: "The Interquartile Range is IQR = Q3 - Q1. The bounds are [Q1 - 1.5*IQR, Q3 + 1.5*IQR]. For normal distributions, this spans approximately μ ± 2.7σ, capturing 99.3% of genuine variance while flagging non-physical sensor corruptions (e.g., speeds over 160 km/h or negative delays)."
    },
    {
      q: "Q4. What is the empirical correlation between city congestion and delivery delays?",
      a: "We computed a Pearson correlation coefficient of r = 0.38 with a positive slope (m = 0.69). This demonstrates that for every 10% increase in city traffic congestion, average intra-city commercial delivery delays increase by approximately 6.9 minutes."
    },
    {
      q: "Q5. Why is spatial GIS mapping crucial for smart city decision-makers?",
      a: "Spatial maps provide immediate visual geographic clustering of congestion corridors, allowing urban planners to correlate road density with port/airport proximity and target intelligent traffic management systems (ITMS) to the most severely congested metropolitan nodes."
    }
  ];

  let html = '<div style="display:flex;flex-direction:column;gap:1rem">';
  sampleQuestions.forEach(item => {
    html += `
      <div style="background-color:var(--bg-secondary);padding:1rem;border-radius:var(--radius-sm);border-left:3px solid var(--accent-blue)">
        <div style="font-weight:700;color:#93C5FD;margin-bottom:0.35rem">${item.q}</div>
        <div style="color:var(--text-secondary)">${item.a}</div>
      </div>
    `;
  });
  html += `
    <div style="margin-top:0.75rem;padding:0.75rem;background-color:rgba(16, 185, 129, 0.1);border-radius:var(--radius-sm);color:#34D399;font-size:0.8rem">
      📘 Complete set of 45+ Comprehensive Viva Questions & Detailed Academic Answers is documented in <code>docs/VIVA_QUESTIONS_ANSWERS.md</code>.
    </div>
  </div>`;
  container.innerHTML = html;
}

function exportOverviewPDF() {
  window.print();
}
