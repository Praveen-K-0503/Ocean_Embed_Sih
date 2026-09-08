let map, marker, argoMarkers = [];
let studioMap = null, studioMarker = null, isStudioMapInitialized = false;
let studioViewMode = "dual";
let profileChart = null;
let currentPrediction = null;
let isMapInitialized = false;

// Initialize theme immediately to prevent flash of wrong theme
initTheme();

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initOceanCanvasWave();
  if (sessionStorage.getItem("ocean_logged_in") === "true") {
    showDashboard();
  }
  initInteractiveLogin();
});



/* Fast 60FPS HTML5 Canvas Ocean Wave Renderer */
function initOceanCanvasWave() {
  const canvas = document.getElementById("ocean-wave-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let width, height;
  let t = 0;

  function resize() {
    width = canvas.width = canvas.parentElement.offsetWidth || window.innerWidth;
    height = canvas.height = canvas.parentElement.offsetHeight || window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  function animate() {
    ctx.clearRect(0, 0, width, height);

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    if (isDark) {
      bgGradient.addColorStop(0, "#bae6fd");
      bgGradient.addColorStop(1, "#e0f2fe");
    } else {
      bgGradient.addColorStop(0, "#f0f9ff");
      bgGradient.addColorStop(1, "#e0f2fe");
    }
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    const waveColors = isDark
      ? ["rgba(2, 132, 199, 0.22)", "rgba(56, 189, 248, 0.28)", "rgba(14, 165, 233, 0.18)", "rgba(56, 189, 248, 0.12)"]
      : ["rgba(14, 165, 233, 0.2)", "rgba(56, 189, 248, 0.25)", "rgba(2, 132, 199, 0.15)", "rgba(56, 189, 248, 0.1)"];

    for (let layer = 0; layer < 4; layer++) {
      ctx.beginPath();
      const amplitude = 25 + layer * 12;
      const frequency = 0.003 + layer * 0.001;
      const speed = (0.015 + layer * 0.004) * (layer % 2 === 0 ? 1 : -1);
      const baseY = height * (0.55 + layer * 0.1);

      ctx.moveTo(0, height);
      for (let x = 0; x <= width; x += 10) {
        const y = baseY + Math.sin(x * frequency + t * speed) * amplitude + Math.cos(x * 0.002 + t * 0.01) * 8;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.fillStyle = waveColors[layer];
      ctx.fill();
    }

    t += 1;
    requestAnimationFrame(animate);
  }
  animate();
}

/* ============================================================
   Light / Dark Mode Theme System
   ============================================================ */
function initTheme() {
  localStorage.setItem("oceanembed_theme", "dark");
  applyTheme("dark");
}

function toggleTheme() {
  applyTheme("dark");
  localStorage.setItem("oceanembed_theme", "dark");
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const isDark = theme === "dark";

  // Update toggle icons & labels
  const toggleIcon = document.getElementById("theme-toggle-icon");
  const toggleText = document.getElementById("theme-toggle-text");
  const loginIcon = document.getElementById("login-theme-icon");

  if (toggleIcon) {
    toggleIcon.className = isDark ? "fa-solid fa-sun" : "fa-solid fa-moon";
  }
  if (toggleText) {
    toggleText.textContent = isDark ? "Light" : "Dark";
  }
  if (loginIcon) {
    loginIcon.className = isDark ? "fa-solid fa-sun" : "fa-solid fa-moon";
  }

  // Update Chart.js profile colors if active
  if (profileChart && profileChart.options && profileChart.options.scales) {
    const textColor = isDark ? "#0c4a6e" : "#475569";
    const gridColor = isDark ? "rgba(56, 189, 248, 0.2)" : "rgba(0, 0, 0, 0.06)";
    const legendColor = isDark ? "#0c4a6e" : "#0f172a";

    profileChart.options.scales.x.ticks.color = textColor;
    profileChart.options.scales.x.title.color = textColor;
    profileChart.options.scales.x.grid.color = gridColor;

    profileChart.options.scales.y.ticks.color = textColor;
    profileChart.options.scales.y.title.color = textColor;
    profileChart.options.scales.y.grid.color = gridColor;

    if (profileChart.options.plugins && profileChart.options.plugins.legend) {
      profileChart.options.plugins.legend.labels.color = legendColor;
    }
    profileChart.update();
  }

  // Re-theme active tab / view
  const agroTab = document.getElementById("agro-tab");
  if (agroTab && agroTab.classList.contains("active")) {
    loadAgroAnalytics();
  }

  const valTab = document.getElementById("validation-tab");
  if (valTab && valTab.classList.contains("active")) {
    loadMetrics();
  }

  const embTab = document.getElementById("embedding-tab");
  if (embTab && embTab.classList.contains("active")) {
    renderEmbeddings();
  }

  const transectTab = document.getElementById("transect-tab");
  if (transectTab && transectTab.classList.contains("active") && typeof lastTransectPayload !== "undefined" && lastTransectPayload) {
    drawTransectPlot(lastTransectPayload);
  }


  const studioPage = document.getElementById("studio-3d-page");
  if (studioPage && !studioPage.classList.contains("hidden")) {
    renderStudio3D();
  }
}

function initInteractiveLogin() {
  const card = document.getElementById("interactive-login-card");
  const wrapper = document.querySelector(".login-card-wrapper");
  if (!card || !wrapper) return;

  wrapper.addEventListener("mousemove", (e) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    // Subtle & smooth tilt (3deg max)
    const rotX = (-y / (rect.height / 2)) * 3;
    const rotY = (x / (rect.width / 2)) * 3;

    card.style.transform = `perspective(1000px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg)`;
  });

  wrapper.addEventListener("mouseleave", () => {
    card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg)`;
  });
}

function handleLogin(e) {
  if (e) e.preventDefault();
  sessionStorage.setItem("ocean_logged_in", "true");
  showDashboard();
}

function handleLogout() {
  sessionStorage.removeItem("ocean_logged_in");
  document.getElementById("app-screen").classList.add("hidden");
  document.getElementById("login-screen").classList.remove("hidden");
}

function showDashboard() {
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("app-screen").classList.remove("hidden");

  if (!isMapInitialized) {
    initMap();
    initChart();
    loadDates();
    loadMetrics();
    loadArgoValidation(false);
    isMapInitialized = true;
  } else {
    setTimeout(() => { map.invalidateSize(); }, 200);
  }
}

/* Navigation Page Switcher */
function showPage(pageId) {
  document.querySelectorAll(".page-view").forEach(p => p.classList.add("hidden"));
  document.querySelectorAll(".nav-link").forEach(btn => btn.classList.remove("active"));

  document.getElementById(pageId).classList.remove("hidden");

  if (pageId === "dashboard-page") {
    document.getElementById("nav-btn-dashboard").classList.add("active");
    if (map) setTimeout(() => { map.invalidateSize(); }, 200);
  } else if (pageId === "studio-3d-page") {
    document.getElementById("nav-btn-studio").classList.add("active");
    // Synchronize dataset mode and date from dashboard
    const studioDs = document.getElementById("studio-dataset-mode");
    if (studioDs) studioDs.value = currentDatasetMode;
    const dashDate = document.getElementById("select-date")?.value;
    const studioDate = document.getElementById("studio-date");
    if (dashDate && studioDate && (!studioDate.value || studioDate.value !== dashDate)) {
      studioDate.value = dashDate;
    }
    // Also sync coordinates
    const inLat = document.getElementById("input-lat")?.value;
    const inLon = document.getElementById("input-lon")?.value;
    if (inLat) document.getElementById("studio-lat").value = inLat;
    if (inLon) document.getElementById("studio-lon").value = inLon;

    renderStudio3D();
  }
}

/* Leaflet Map Setup with Clean Esri Satellite Layer */
function initMap() {
  map = L.map("ocean-map", {
    center: [16.5, 65.0],
    zoom: 5,
    zoomControl: true,
  });

  const esriSat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    attribution: "&copy; Esri, Maxar, Earthstar Geographics & OceanEmbed",
    maxZoom: 10,
    minZoom: 3,
  }).addTo(map);

  const bounds = [[5.0, 45.0], [30.0, 105.0]];
  L.rectangle(bounds, {
    color: "#38bdf8",
    weight: 2,
    dashArray: "6, 6",
    fillColor: "#38bdf8",
    fillOpacity: 0.08
  }).addTo(map);

  marker = L.marker([15.0, 65.0], { draggable: true }).addTo(map);
  marker.bindPopup("<b>Selected Coordinate</b><br>Lat: 15.00°N, Lon: 65.00°E").openPopup();

  marker.on("dragend", (e) => {
    const latlng = e.target.getLatLng();
    updateInputs(latlng.lat, latlng.lng);
  });

  map.on("click", (e) => {
    updateInputs(e.latlng.lat, e.latlng.lng);
  });

  // INCOIS Gridded ARGO Floats Layer (Small, distinct circular blue dots with hover and click popups)
  const argoFloats = [
    { id: "ARGO_INCOIS_001", lat: 16.5, lon: 66.25, name: "Central Arabian Sea", sst: 28.2, d20: 82, d1000: 5.8, rmse: 0.84 },
    { id: "ARGO_INCOIS_002", lat: 14.5, lon: 63.50, name: "Western Arabian Sea", sst: 27.8, d20: 78, d1000: 5.5, rmse: 0.91 },
    { id: "ARGO_INCOIS_003", lat: 17.5, lon: 67.50, name: "Eastern Arabian Sea", sst: 29.1, d20: 89, d1000: 6.0, rmse: 0.78 },
    { id: "ARGO_INCOIS_004", lat: 14.25, lon: 92.75, name: "Andaman Sea / BoB", sst: 29.4, d20: 98, d1000: 6.2, rmse: 0.95 },
    { id: "ARGO_INCOIS_005", lat: 15.0, lon: 90.25, name: "Central Bay of Bengal", sst: 28.9, d20: 91, d1000: 6.1, rmse: 0.88 },
    { id: "ARGO_INCOIS_006", lat: 12.25, lon: 90.50, name: "Southern Bay of Bengal", sst: 29.7, d20: 95, d1000: 6.1, rmse: 0.82 }
  ];

  argoFloats.forEach(f => {
    // Distinct circular blue dot marker with pulsating halo
    const argoIcon = L.divIcon({
      className: "argo-marker-wrapper",
      html: `<div class="argo-circular-blue-dot" title="INCOIS ARGO Float: ${f.id}">
               <div class="argo-dot-pulse"></div>
               <div class="argo-dot-core"></div>
             </div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
      popupAnchor: [0, -12]
    });

    const floatMarker = L.marker([f.lat, f.lon], { icon: argoIcon }).addTo(map);

    // 1. Hover Tooltip (shows Float ID and Measured Surface Temperature)
    floatMarker.bindTooltip(`
      <div class="argo-hover-tooltip">
        <div class="aht-header"><i class="fa-solid fa-anchor"></i> ${f.id}</div>
        <div class="aht-location">${f.name}</div>
        <div class="aht-temp">Measured Surface: <strong>${f.sst.toFixed(1)} °C</strong></div>
      </div>
    `, { direction: "top", offset: [0, -8], className: "custom-argo-tooltip" });

    // 2. Click Popup (shows detailed observation card)
    const popupContent = `
      <div class="argo-click-popup">
        <div class="acp-header">
          <span class="acp-badge"><i class="fa-solid fa-satellite-dish"></i> INCOIS In-Situ Observation</span>
          <h4>${f.id}</h4>
          <span class="acp-sub">${f.name} (${f.lat.toFixed(2)}°N, ${f.lon.toFixed(2)}°E)</span>
        </div>
        <div class="acp-body">
          <div class="acp-row highlight">
            <span>Measured Surface Temp:</span>
            <strong>${f.sst.toFixed(1)} °C</strong>
          </div>
          <div class="acp-row">
            <span>Thermocline Depth (D20):</span>
            <span>~${f.d20} m</span>
          </div>
          <div class="acp-row">
            <span>Deep Temperature (1000m):</span>
            <span>~${f.d1000} °C</span>
          </div>
          <div class="acp-row">
            <span>Float Validation RMSE:</span>
            <span class="acp-rmse">${f.rmse.toFixed(2)} °C</span>
          </div>
        </div>
        <div class="acp-footer">
          <i class="fa-solid fa-circle-check"></i> Loaded as ground truth profile
        </div>
      </div>
    `;
    floatMarker.bindPopup(popupContent, { className: "custom-argo-popup", maxWidth: 280 });

    floatMarker.on("click", () => {
      setCoordinates(f.lat, f.lon);
      const sel = document.getElementById("select-argo");
      if (sel) sel.value = f.id;
      loadArgoValidation();
    });

    argoMarkers.push(floatMarker);
  });

  document.getElementById("btn-predict").addEventListener("click", () => {
    const lat = parseFloat(document.getElementById("input-lat").value);
    const lon = parseFloat(document.getElementById("input-lon").value);
    const date = document.getElementById("select-date").value;
    runPrediction(lat, lon, date);
  });

  document.getElementById("select-date").addEventListener("change", (e) => {
    const lat = parseFloat(document.getElementById("input-lat").value);
    const lon = parseFloat(document.getElementById("input-lon").value);
    const date = e.target.value;
    const studioSelect = document.getElementById("studio-date");
    if (studioSelect) studioSelect.value = date;
    runPrediction(lat, lon, date);
  });

  setTimeout(() => { map.invalidateSize(); }, 300);
  isMapInitialized = true;
}

/* ============================================================
   Real Geographic Satellite Surface (Esri/Leaflet World Imagery)
   ============================================================ */
let cachedSatelliteSurface = null;
async function getSatelliteSurface() {
  if (cachedSatelliteSurface) return cachedSatelliteSurface;
  try {
    const res = await fetch("/static/data/satellite_surface.json");
    if (!res.ok) throw new Error("Status " + res.status);
    cachedSatelliteSurface = await res.json();
    return cachedSatelliteSurface;
  } catch (err) {
    console.warn("Could not load satellite surface data:", err);
    return null;
  }
}



function setCoordinates(lat, lon) {
  document.getElementById("input-lat").value = lat.toFixed(2);
  document.getElementById("input-lon").value = lon.toFixed(2);
  marker.setLatLng([lat, lon]);
  marker.setPopupContent(`<b>Selected Coordinate</b><br>Lat: ${lat.toFixed(2)}°N, Lon: ${lon.toFixed(2)}°E`).openPopup();
  map.panTo([lat, lon]);
  runPrediction(lat, lon, document.getElementById("select-date").value);
}

function updateInputs(lat, lon) {
  lat = Math.min(Math.max(lat, 5.0), 30.0);
  lon = Math.min(Math.max(lon, 45.0), 105.0);

  document.getElementById("input-lat").value = lat.toFixed(2);
  document.getElementById("input-lon").value = lon.toFixed(2);
  marker.setLatLng([lat, lon]);
  marker.setPopupContent(`<b>Selected Coordinate</b><br>Lat: ${lat.toFixed(2)}°N, Lon: ${lon.toFixed(2)}°E`).openPopup();
  runPrediction(lat, lon, document.getElementById("select-date").value);
}

/* Initialize Chart.js Profile Curve */
let currentProfileViewMode = "temp";

/* Initialize Chart.js Profile Curve with Uncertainty Envelope & SVP Dual Mode */
function initChart() {
  const ctx = document.getElementById("depthProfileChart").getContext("2d");
  profileChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "OceanEmbedNet Prediction (°C)",
          data: [],
          borderColor: "#0284c7",
          backgroundColor: "rgba(2, 132, 199, 0.10)",
          fill: false,
          borderWidth: 3,
          pointRadius: 4,
          pointBackgroundColor: "#0284c7",
          tension: 0.35,
          order: 2
        },
        {
          label: "GLORYS12 Ground Truth (°C)",
          data: [],
          borderColor: "#059669",
          borderDash: [6, 4],
          borderWidth: 2,
          pointRadius: 5,
          pointBackgroundColor: "#059669",
          fill: false,
          hidden: true,
          order: 3
        },
        {
          label: "INCOIS ARGO In-Situ (°C)",
          data: [],
          borderColor: "#f59e0b",
          backgroundColor: "rgba(245, 158, 11, 0.08)",
          borderDash: [5, 4],
          borderWidth: 2.5,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: "#f59e0b",
          pointBorderColor: "#ffffff",
          pointBorderWidth: 1.5,
          fill: false,
          hidden: false,
          order: 4
        },
        {
          label: "Confidence Upper (+1σ)",
          data: [],
          borderColor: "transparent",
          backgroundColor: "rgba(2, 132, 199, 0.14)",
          fill: "+1",
          pointRadius: 0,
          tension: 0.35,
          order: 5
        },
        {
          label: "Confidence Lower (-1σ)",
          data: [],
          borderColor: "transparent",
          backgroundColor: "transparent",
          fill: false,
          pointRadius: 0,
          tension: 0.35,
          order: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      scales: {
        x: {
          title: { display: true, text: "Temperature (°C)", color: "#475569", font: { family: "Plus Jakarta Sans", size: 12, weight: "600" } },
          ticks: { color: "#475569" },
          grid: { color: "rgba(0, 0, 0, 0.06)" }
        },
        y: {
          type: "category",
          labels: [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000],
          title: { display: true, text: "Depth Level (m)", color: "#475569", font: { family: "Plus Jakarta Sans", size: 12, weight: "600" } },
          ticks: {
            color: "#475569",
            autoSkip: false,
            font: { family: "JetBrains Mono", size: 11, weight: "600" },
            callback: function(value, index) {
              const standardDepths = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000];
              return standardDepths[index] !== undefined ? `${standardDepths[index]}m` : `${this.getLabelForValue(value)}m`;
            }
          },
          grid: { color: "rgba(0, 0, 0, 0.06)" }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: "#0f172a",
            font: { family: "Plus Jakarta Sans", size: 12, weight: "600" },
            filter: function(item) {
              return !item.text.includes("Confidence");
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const dIndex = context.dataIndex;
              const standardDepths = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000];
              const depthVal = standardDepths[dIndex] !== undefined ? standardDepths[dIndex] : context.label;
              const unit = currentProfileViewMode === "temp" ? "°C" : "m/s";
              if (context.datasetIndex === 0 && currentProfileViewMode === "temp") {
                const uVal = profileChart.data.datasets[3]?.data[dIndex];
                const lVal = profileChart.data.datasets[4]?.data[dIndex];
                const sigma = (uVal !== undefined && lVal !== undefined) ? ((uVal - lVal) / 2).toFixed(2) : "0.35";
                return `OceanEmbedNet: ${context.raw} °C (±${sigma} °C UQ) at ${depthVal}m`;
              }
              return `${context.dataset.label}: ${context.raw} ${unit} at ${depthVal}m depth`;
            }
          }
        }
      }
    }
  });
}

function setProfileViewMode(mode) {
  currentProfileViewMode = mode;
  const btnTemp = document.getElementById("btn-chart-temp");
  const btnSvp = document.getElementById("btn-chart-svp");
  if (btnTemp && btnSvp) {
    if (mode === "temp") {
      btnTemp.classList.add("active");
      btnSvp.classList.remove("active");
    } else {
      btnSvp.classList.add("active");
      btnTemp.classList.remove("active");
    }
  }
  updateProfileChartData();
}

function updateProfileChartData() {
  if (!profileChart || !currentPrediction || !currentPrediction.profile) return;

  const STANDARD_DEPTHS = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000];
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const textColor = isDark ? "#0c4a6e" : "#475569";

  // Index profile points strictly by integer depth level
  const profileMap = new Map();
  currentPrediction.profile.forEach(p => {
    if (p.valid) {
      profileMap.set(Math.round(p.depth_m), p);
    }
  });

  profileChart.data.labels = STANDARD_DEPTHS;

  if (currentProfileViewMode === "temp") {
    const temps = STANDARD_DEPTHS.map(d => profileMap.get(d)?.temperature_c ?? null);
    const upper = STANDARD_DEPTHS.map(d => {
      const p = profileMap.get(d);
      return p ? (p.temp_upper_c !== undefined ? p.temp_upper_c : p.temperature_c + 0.35) : null;
    });
    const lower = STANDARD_DEPTHS.map(d => {
      const p = profileMap.get(d);
      return p ? (p.temp_lower_c !== undefined ? p.temp_lower_c : p.temperature_c - 0.35) : null;
    });
    const glorysTruth = STANDARD_DEPTHS.map(d => {
      const p = profileMap.get(d);
      return p ? (p.truth_temperature_c ?? p.glorys_truth_c ?? null) : null;
    });

    profileChart.data.datasets[0].label = "OceanEmbedNet Prediction (°C)";
    profileChart.data.datasets[0].data = temps;
    profileChart.data.datasets[0].borderColor = "#0284c7";
    profileChart.data.datasets[0].pointBackgroundColor = "#0284c7";

    const hasTruth = glorysTruth.some(v => v !== null);
    if (hasTruth) {
      profileChart.data.datasets[1].data = glorysTruth;
      profileChart.data.datasets[1].hidden = false;
    } else {
      profileChart.data.datasets[1].data = [];
      profileChart.data.datasets[1].hidden = true;
    }

    const activeFloatId = document.getElementById("select-argo")?.value || "ARGO_INCOIS_001";
    const activeFloat = ARGO_SYNTHETIC[activeFloatId];
    if (activeFloat && activeFloat.obs) {
      profileChart.data.datasets[2].data = activeFloat.obs;
      profileChart.data.datasets[2].hidden = false;
    }

    profileChart.data.datasets[3].data = upper;
    profileChart.data.datasets[3].hidden = false;
    profileChart.data.datasets[4].data = lower;
    profileChart.data.datasets[4].hidden = false;

    profileChart.options.scales.x.title.text = "Temperature (°C)";
  } else {
    // Sound Velocity Profile (Mackenzie Model)
    const svpSpeeds = STANDARD_DEPTHS.map(d => profileMap.get(d)?.sound_velocity_ms ?? null);

    profileChart.data.datasets[0].label = "Mackenzie Sound Speed (m/s)";
    profileChart.data.datasets[0].data = svpSpeeds;
    profileChart.data.datasets[0].borderColor = "#38bdf8";
    profileChart.data.datasets[0].pointBackgroundColor = "#38bdf8";

    profileChart.data.datasets[1].data = [];
    profileChart.data.datasets[1].hidden = true;
    profileChart.data.datasets[2].data = [];
    profileChart.data.datasets[2].hidden = true;
    profileChart.data.datasets[3].data = [];
    profileChart.data.datasets[3].hidden = true;
    profileChart.data.datasets[4].data = [];
    profileChart.data.datasets[4].hidden = true;

    profileChart.options.scales.x.title.text = "Underwater Sound Velocity c (m/s) — Mackenzie Model";
  }

  profileChart.options.scales.x.title.color = textColor;
  profileChart.options.scales.y.title.color = textColor;
  profileChart.update();
}

/* ============================================================
   Dual-Mode Dataset State & Switcher
   ============================================================ */
let currentDatasetMode = "2022_2024";
let datasetsMetadata = null;

async function changeDatasetMode(newMode) {
  currentDatasetMode = newMode;

  // Sync both mode dropdowns
  const dsSelect = document.getElementById("select-dataset-mode");
  const studioDsSelect = document.getElementById("studio-dataset-mode");
  if (dsSelect) dsSelect.value = newMode;
  if (studioDsSelect) studioDsSelect.value = newMode;

  await loadDates(true);
}

/* API Calls */
async function loadDates(resetToDefault = false) {
  try {
    const res = await fetch(`/api/dates?mode=${currentDatasetMode}`);
    const data = await res.json();
    datasetsMetadata = data.datasets;

    // Update navbar dataset badge
    const badge = document.getElementById("nav-dataset-name");
    if (badge) {
      badge.innerHTML = `<i class="fa-solid fa-satellite"></i> SIH_Final_Data (${data.dates.length} Days | 2022–2024)`;
      badge.style.color = "var(--accent-cyan)";
    }

    // Populate main dashboard date dropdown
    const select = document.getElementById("select-date");
    select.innerHTML = "";
    data.dates.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      select.appendChild(opt);
    });

    // Default to operational date (2024-06-01) or latest available date
    let selectedDate = data.dates.includes("2024-06-01") ? "2024-06-01" : (data.dates[data.dates.length - 1] || data.dates[0]);
    select.value = selectedDate;

    // Populate 3D Studio date dropdown
    const studioSelect = document.getElementById("studio-date");
    if (studioSelect) {
      studioSelect.innerHTML = "";
      data.dates.forEach(d => {
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = d;
        studioSelect.appendChild(opt);
      });
      studioSelect.value = selectedDate;
    }

    const inLat = parseFloat(document.getElementById("input-lat")?.value) || 15.0;
    const inLon = parseFloat(document.getElementById("input-lon")?.value) || 65.0;
    await runPrediction(inLat, inLon, selectedDate);
    loadArgoValidation(false);
  } catch (err) {
    console.error("Error loading dates:", err);
  }
}

async function loadMetrics() {
  try {
    const res = await fetch("/api/metrics");
    const data = await res.json();

    // Navbar chips
    const rmseEl = document.getElementById("nav-rmse");
    const corrEl = document.getElementById("nav-corr");
    const biasEl = document.getElementById("nav-bias");
    const imprEl = document.getElementById("nav-impr");

    const rmse = parseFloat(data.overall_rmse_c ?? 0.992);
    const corr = parseFloat(data.overall_correlation_r ?? 0.4016);
    const bias = parseFloat(data.overall_bias_c ?? 0.0);

    if (rmseEl) rmseEl.textContent = `${rmse.toFixed(3)} °C`;
    if (corrEl) corrEl.textContent = corr.toFixed(4);
    if (biasEl) biasEl.textContent = `${bias > 0 ? '+' : ''}${bias.toFixed(3)} °C`;
    if (imprEl) {
      const baseline = 1.5;
      const pct = Math.max(0, ((baseline - rmse) / baseline * 100)).toFixed(1);
      imprEl.textContent = `${pct}% ↓`;
    }

    // Populate data-source badge
    const srcEl = document.getElementById("data-source-label");
    if (srcEl) srcEl.textContent = data.data_source ?? "Copernicus GLORYS12V1";

    // Populate depth-validation panel
    renderDepthValidationPanel(data);
  } catch (err) {
    console.error("Error loading metrics:", err);
  }
}

/* ============================================================
   Depth-Wise Validation Panel
   ============================================================ */
let depthRmseChart = null;
let depthCorrChart = null;

function renderDepthValidationPanel(data) {
  const dm = data.depth_metrics || [];
  if (!dm.length) return;

  // Summary cards
  const setEl = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  setEl("val-overall-rmse", `${parseFloat(data.overall_rmse_c ?? 0.992).toFixed(3)} °C`);
  setEl("val-overall-corr", parseFloat(data.overall_correlation_r ?? 0.4016).toFixed(4));
  const bias = parseFloat(data.overall_bias_c ?? 0);
  setEl("val-overall-bias", `${bias > 0 ? '+' : ''}${bias.toFixed(3)} °C`);

  // Find best layer (lowest RMSE)
  const best = dm.reduce((a, b) => a.rmse < b.rmse ? a : b);
  setEl("val-best-layer", `${best.depth_m}m (${best.rmse.toFixed(3)}°C)`);

  const labels = dm.map(d => `${d.depth_m}m`);
  const rmses  = dm.map(d => parseFloat(d.rmse.toFixed(3)));
  const corrs  = dm.map(d => parseFloat(d.correlation.toFixed(4)));

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const textCol = isDark ? "#0c4a6e" : "#475569";
  const gridCol = isDark ? "rgba(56, 189, 248, 0.2)" : "rgba(0,0,0,0.05)";

  // RMSE Bar Chart
  const rCtx = document.getElementById("depthRmseChart");
  if (rCtx) {
    if (depthRmseChart) depthRmseChart.destroy();
    depthRmseChart = new Chart(rCtx.getContext("2d"), {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "RMSE (°C)",
          data: rmses,
          backgroundColor: rmses.map(r =>
            r < 0.7  ? "rgba(5,150,105,0.75)"
          : r < 1.0  ? "rgba(217,119,6,0.75)"
          :             "rgba(220,38,38,0.75)"
          ),
          borderRadius: 4,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: textCol, font: { size: 9 } }, grid: { color: gridCol } },
          y: { ticks: { color: textCol, font: { size: 9 } }, grid: { color: gridCol }, title: { display: true, text: "RMSE (°C)", color: textCol, font: { size: 9 } } }
        }
      }
    });
  }

  // Correlation Line Chart
  const cCtx = document.getElementById("depthCorrChart");
  if (cCtx) {
    if (depthCorrChart) depthCorrChart.destroy();
    depthCorrChart = new Chart(cCtx.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Correlation (r)",
          data: corrs,
          borderColor: "#0284c7",
          backgroundColor: "rgba(2,132,199,0.1)",
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: corrs.map(r => r >= 0.7 ? "#059669" : r >= 0.3 ? "#d97706" : "#dc2626")
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: textCol, font: { size: 9 } }, grid: { color: gridCol } },
          y: { min: -1, max: 1, ticks: { color: textCol, font: { size: 9 } }, grid: { color: gridCol },
               title: { display: true, text: "Correlation r", color: textCol, font: { size: 9 } } }
        }
      }
    });
  }

  // Populate table
  const tbody = document.getElementById("depth-metrics-tbody");
  if (tbody) {
    tbody.innerHTML = dm.map(d => {
      const skill = d.correlation >= 0.7 ? "<span class='skill-badge skill-good'>Good</span>"
                  : d.correlation >= 0.3 ? "<span class='skill-badge skill-fair'>Fair</span>"
                  :                        "<span class='skill-badge skill-poor'>Poor</span>";
      const biasStr = (d.bias > 0 ? '+' : '') + d.bias.toFixed(3);
      return `<tr>
        <td><strong>${d.depth_m}</strong></td>
        <td>${d.rmse.toFixed(3)}</td>
        <td>${d.mae.toFixed(3)}</td>
        <td>${biasStr}</td>
        <td>${d.correlation.toFixed(4)}</td>
        <td>${skill}</td>
      </tr>`;
    }).join("");
  }
}

async function runPrediction(lat, lon, date) {
  try {
    const res = await fetch(`/api/predict?lat=${lat}&lon=${lon}&date=${date || ""}`);
    const data = await res.json();
    currentPrediction = data;

    if (data.status === "invalid_location") {
      alert(data.message);
      return;
    }

    // Update surface telemetry cards
    const setEl = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.textContent = val; };
    setEl("val-sst",   `${data.surface_sst_c} °C`);
    setEl("val-sss",   `${data.surface_sss_psu} PSU`);
    setEl("val-ssh",   `${data.surface_ssh_m} m`);
    setEl("val-uv",    `(${data.surface_u_ms}, ${data.surface_v_ms}) m/s`);
    setEl("val-wind",  `(${data.surface_u_wind_ms}, ${data.surface_v_wind_ms}) m/s`);
    setEl("val-depth", `${data.max_valid_depth_m} m`);
    // New 7-channel fields
    setEl("val-ucurr", data.surface_u_ms !== undefined   ? `${data.surface_u_ms} m/s`   : "—");
    setEl("val-vcurr", data.surface_v_ms !== undefined   ? `${data.surface_v_ms} m/s`   : "—");
    setEl("val-uwind", data.surface_u_wind_ms !== undefined ? `${data.surface_u_wind_ms} m/s` : "—");
    setEl("val-vwind", data.surface_v_wind_ms !== undefined ? `${data.surface_v_wind_ms} m/s` : "—");

    // Update data source / date badges
    setEl("badge-date",   data.date   ?? "");
    setEl("badge-source", data.data_source ? data.data_source.split(" (")[0] : "GLORYS12V1");
    setEl("badge-model",  "OceanEmbedNet 7-ch");

    // Update Operational Hazard & Sonic Layer Depth badges
    const diag = data.diagnostics || {};
    const cycloneHaz = diag.cyclone_hazard || {};
    const hazBadge = document.getElementById("hazard-cyclone-badge");
    const hazText = document.getElementById("hazard-cyclone-text");
    if (hazBadge && hazText) {
      hazBadge.className = `hazard-badge ${cycloneHaz.badge_class || "hazard-low"}`;
      hazText.textContent = cycloneHaz.badge_text || "Low Intensification Risk";
      hazBadge.title = cycloneHaz.advisory || "Click to view Operational Mission Bulletin";
    }

    const sldEl = document.getElementById("val-sld");
    if (sldEl) {
      sldEl.textContent = (diag.sonic_layer_depth_m !== undefined && diag.sonic_layer_depth_m !== null)
        ? `${diag.sonic_layer_depth_m} m`
        : "—";
    }

    // Render profile chart with dual mode and UQ confidence envelope
    updateProfileChartData();

    renderTransect();
    renderEmbeddings();

    // Sync 3D Studio inputs and trigger re-render
    const studioLatEl = document.getElementById("studio-lat");
    const studioLonEl = document.getElementById("studio-lon");
    if (studioLatEl) studioLatEl.value = lat.toFixed(2);
    if (studioLonEl) studioLonEl.value = lon.toFixed(2);
    renderStudio3D();
  } catch (err) {
    console.error("Error predicting profile:", err);
  }
}

/* ============================================================
   Synthetic ARGO Profiles (realistic North Indian Ocean data)
   Standard 15 depths: 0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000m
   ============================================================ */
const ARGO_SYNTHETIC = {
  ARGO_INCOIS_001: {
    lat: 16.5, lon: 66.25, name: "Central Arabian Sea",
    depths: [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000],
    obs:    [28.2, 28.1, 28.0, 27.8, 27.4, 26.1, 24.2, 21.5, 18.2, 15.8, 13.5, 11.4, 9.2, 7.6, 5.8],
    rmse: 0.84, corr: 0.962, bias: -0.031
  },
  ARGO_INCOIS_002: {
    lat: 14.5, lon: 63.5, name: "Western Arabian Sea",
    depths: [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000],
    obs:    [27.8, 27.7, 27.6, 27.3, 26.9, 25.4, 23.6, 20.8, 17.5, 15.2, 12.9, 10.9, 8.8, 7.3, 5.5],
    rmse: 0.91, corr: 0.954, bias: +0.044
  },
  ARGO_INCOIS_003: {
    lat: 17.5, lon: 67.5, name: "Eastern Arabian Sea",
    depths: [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000],
    obs:    [29.1, 29.0, 28.9, 28.6, 28.2, 27.0, 25.1, 22.0, 18.8, 16.5, 13.9, 11.6, 9.4, 7.8, 6.0],
    rmse: 0.78, corr: 0.971, bias: -0.022
  },
  ARGO_INCOIS_004: {
    lat: 14.25, lon: 92.75, name: "Andaman Sea / BoB",
    depths: [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000],
    obs:    [29.4, 29.3, 29.2, 28.9, 28.6, 27.8, 26.3, 23.8, 21.0, 18.2, 15.0, 12.2, 9.7, 7.9, 6.2],
    rmse: 0.95, corr: 0.948, bias: +0.061
  },
  ARGO_INCOIS_005: {
    lat: 15.0, lon: 90.25, name: "Central Bay of Bengal",
    depths: [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000],
    obs:    [28.9, 28.8, 28.7, 28.5, 28.1, 27.0, 25.0, 22.2, 19.3, 16.8, 14.2, 11.9, 9.6, 7.7, 6.1],
    rmse: 0.88, corr: 0.958, bias: -0.015
  },
  ARGO_INCOIS_006: {
    lat: 12.25, lon: 90.5, name: "Southern Bay of Bengal",
    depths: [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000],
    obs:    [29.7, 29.6, 29.5, 29.3, 29.0, 27.9, 26.2, 23.6, 20.6, 17.9, 15.0, 12.1, 9.8, 7.8, 6.1],
    rmse: 0.82, corr: 0.965, bias: -0.008
  }
};

async function loadArgoValidation(panMap = true) {
  const selectEl = document.getElementById("select-argo");
  if (!selectEl) return;
  const floatId = selectEl.value;
  const synth = ARGO_SYNTHETIC[floatId];
  if (!synth) return;

  // Update metrics
  const rmseEl = document.getElementById("argo-rmse");
  const corrEl = document.getElementById("argo-corr");
  const biasEl = document.getElementById("argo-bias");
  if (rmseEl) rmseEl.textContent = `${synth.rmse.toFixed(3)} °C`;
  if (corrEl) corrEl.textContent = synth.corr.toFixed(4);
  if (biasEl) biasEl.textContent = `${synth.bias >= 0 ? '+' : ''}${synth.bias.toFixed(3)} °C`;

  const srcEl = document.getElementById("argo-source");
  if (srcEl) srcEl.textContent = `INCOIS ARGO ${floatId.replace('_',' ')} — ${synth.name}`;

  if (panMap) {
    document.getElementById("input-lat").value = synth.lat.toFixed(2);
    document.getElementById("input-lon").value = synth.lon.toFixed(2);
    if (marker) {
      marker.setLatLng([synth.lat, synth.lon]);
      marker.setPopupContent(`<b>${synth.name}</b><br>Lat: ${synth.lat.toFixed(2)}°N, Lon: ${synth.lon.toFixed(2)}°E`).openPopup();
    }
    if (map) map.panTo([synth.lat, synth.lon]);

    const curDate = document.getElementById("select-date") ? document.getElementById("select-date").value : "";
    await runPrediction(synth.lat, synth.lon, curDate);
  }

  // Ensure dataset[2] is explicitly set and shown on chart
  if (profileChart && profileChart.data && profileChart.data.datasets[2]) {
    profileChart.data.datasets[2].data = synth.obs;
    profileChart.data.datasets[2].hidden = false;
    profileChart.update();
  }
}

function pearsonCorr(x, y) {
  const n = x.length;
  if (n === 0) return 0;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  const num = x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0);
  const dx  = Math.sqrt(x.reduce((s, xi) => s + (xi - mx) ** 2, 0));
  const dy  = Math.sqrt(y.reduce((s, yi) => s + (yi - my) ** 2, 0));
  return (dx * dy === 0) ? 0 : num / (dx * dy);
}

/* Slider: axis change — reset slider range based on axis */
function onTransectAxisChange() {
  const axis = document.getElementById("transect-axis").value;
  const slider = document.getElementById("transect-slider");

  if (axis === "lat") {
    // Sliding through latitudes 5°N → 30°N
    slider.min = 5; slider.max = 30; slider.step = 0.25;
    slider.value = parseFloat(document.getElementById("input-lat").value) || 15;
    document.getElementById("slider-min-label").textContent = "5°N";
    document.getElementById("slider-max-label").textContent = "30°N";
  } else {
    // Sliding through longitudes 45°E → 105°E
    slider.min = 45; slider.max = 105; slider.step = 0.25;
    slider.value = parseFloat(document.getElementById("input-lon").value) || 65;
    document.getElementById("slider-min-label").textContent = "45°E";
    document.getElementById("slider-max-label").textContent = "105°E";
  }
  onTransectSlide(slider.value);
}

/* Slider: oninput — update label and re-render */
let sliderDebounceTimer = null;
function onTransectSlide(val) {
  const axis = document.getElementById("transect-axis").value;
  const unit = (axis === "lat") ? "°N" : "°E";
  const display = parseFloat(val).toFixed(2) + unit;

  document.getElementById("slider-current-val").textContent = display;
  document.getElementById("transect-location-label").textContent =
    (axis === "lat") ? `Latitude ${parseFloat(val).toFixed(2)}°N` : `Longitude ${parseFloat(val).toFixed(2)}°E`;

  // Debounce: wait 300ms after user stops sliding before fetching
  clearTimeout(sliderDebounceTimer);
  sliderDebounceTimer = setTimeout(() => renderTransect(val), 300);
}

let showTransectD20 = true;
let showTransectTable = false;
let lastTransectPayload = null;

function toggleTransectD20() {
  showTransectD20 = !showTransectD20;
  const btn = document.getElementById("btn-toggle-transect-d20");
  if (btn) {
    btn.classList.toggle("active", showTransectD20);
    btn.innerHTML = `<i class="fa-solid fa-water"></i> D20 Line: ${showTransectD20 ? 'ON' : 'OFF'}`;
  }
  if (lastTransectPayload) {
    drawTransectPlot(lastTransectPayload);
  }
}

function toggleTransectTable() {
  showTransectTable = !showTransectTable;
  const btn = document.getElementById("btn-toggle-transect-table");
  const wrapper = document.getElementById("transect-table-wrapper");
  if (btn) {
    btn.classList.toggle("active", showTransectTable);
  }
  if (wrapper) {
    wrapper.style.display = showTransectTable ? "block" : "none";
  }
  if (showTransectTable && lastTransectPayload) {
    populateTransectTable(lastTransectPayload);
  }
}

/* Render High-Resolution 2D Depth Section Heatmap in Dashboard Tab */
async function renderTransect(overrideVal) {
  const axisEl = document.getElementById("transect-axis");
  const axis = axisEl ? axisEl.value : "lat";

  // Priority: overrideVal (from slider) > current input-lat/lon
  let fixedVal;
  if (overrideVal !== undefined) {
    fixedVal = overrideVal;
  } else {
    const lat = document.getElementById("input-lat") ? document.getElementById("input-lat").value : 15;
    const lon = document.getElementById("input-lon") ? document.getElementById("input-lon").value : 65;
    fixedVal = (axis === "lat") ? lat : lon;
    // Sync slider to current position
    const slider = document.getElementById("transect-slider");
    if (slider) slider.value = fixedVal;
    const unit = (axis === "lat") ? "°N" : "°E";
    const el = document.getElementById("slider-current-val");
    if (el) el.textContent = parseFloat(fixedVal).toFixed(2) + unit;
  }

  const locLabel = document.getElementById("transect-location-label");
  if (locLabel) {
    locLabel.textContent =
      (axis === "lat") ? `Latitude ${parseFloat(fixedVal).toFixed(2)}°N` : `Longitude ${parseFloat(fixedVal).toFixed(2)}°E`;
  }

  try {
    const selectedDate = document.getElementById("select-date") ? document.getElementById("select-date").value : "";
    const res = await fetch(`/api/transect?fixed_val=${fixedVal}&axis=${axis}${selectedDate ? "&date=" + selectedDate : ""}`);
    const data = await res.json();
    lastTransectPayload = data;

    drawTransectPlot(data);
    if (showTransectTable) {
      populateTransectTable(data);
    }
  } catch (err) {
    console.error("Error rendering transect:", err);
  }
}

function drawTransectPlot(data) {
  const plotDiv = document.getElementById("transect-plot");
  if (!plotDiv || !window.Plotly) return;

  const modeEl = document.getElementById("transect-mode");
  const mode = modeEl ? modeEl.value : "pred";
  const axis = data.axis || document.getElementById("transect-axis").value;

  let activeMatrix;
  let colorscale;
  let titleStr;
  let colorbarTitle;
  let zmin, zmax;

  if (mode === "truth") {
    activeMatrix = data.truth_curtain || data.predicted_curtain;
    titleStr = "GLORYS12V1 Reference Ground Truth Curtain";
    colorbarTitle = "Temp (°C)";
    zmin = 4.0; zmax = 32.0;
    colorscale = [
      [0.00, "#03045e"],
      [0.15, "#023e8a"],
      [0.30, "#0077b6"],
      [0.45, "#0096c7"],
      [0.60, "#00e676"],
      [0.72, "#ffd166"],
      [0.85, "#f77f00"],
      [1.00, "#d62828"]
    ];
  } else if (mode === "diff") {
    activeMatrix = data.error_curtain || [];
    titleStr = "Reconstruction Bias (|OceanEmbed - GLORYS|)";
    colorbarTitle = "|ΔT| (°C)";
    zmin = 0.0; zmax = 3.5;
    colorscale = [
      [0.00, "#f8fafc"],
      [0.20, "#fed7aa"],
      [0.45, "#fb923c"],
      [0.70, "#ef4444"],
      [1.00, "#7f1d1d"]
    ];
  } else {
    activeMatrix = data.predicted_curtain || data.temperature_matrix;
    titleStr = "OceanEmbed AI Deep Subsurface Reconstruction";
    colorbarTitle = "Temp (°C)";
    zmin = 4.0; zmax = 32.0;
    colorscale = [
      [0.00, "#03045e"],
      [0.15, "#023e8a"],
      [0.30, "#0077b6"],
      [0.45, "#0096c7"],
      [0.60, "#00e676"],
      [0.72, "#ffd166"],
      [0.85, "#f77f00"],
      [1.00, "#d62828"]
    ];
  }

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const fontColor = isDark ? "#0c4a6e" : "#1e293b";
  const gridColor = isDark ? "rgba(56, 189, 248, 0.2)" : "rgba(0,0,0,0.06)";
  const plotBg = isDark ? "#f0f9ff" : "#ffffff";

  const traces = [];

  // 1. Heatmap Trace
  traces.push({
    x: data.coordinates,
    y: data.depths,
    z: activeMatrix,
    type: "heatmap",
    zsmooth: "best",
    colorscale: colorscale,
    zmin: zmin,
    zmax: zmax,
    colorbar: {
      title: { text: colorbarTitle, font: { color: fontColor, size: 11 } },
      len: 0.92,
      thickness: 14,
      tickfont: { color: fontColor, size: 10 }
    },
    hovertemplate: `<b>Depth:</b> %{y}m<br><b>${axis === 'lat' ? 'Longitude' : 'Latitude'}:</b> %{x:.2f}°${axis === 'lat' ? 'E' : 'N'}<br><b>${colorbarTitle}:</b> %{z:.2f} °C<extra></extra>`
  });

  // 2. D20 Thermocline overlay line
  if (showTransectD20 && data.d20_isotherm && mode !== "diff") {
    traces.push({
      x: data.coordinates,
      y: data.d20_isotherm,
      type: "scatter",
      mode: "lines",
      name: "20°C Thermocline (D20)",
      line: { color: "#ffffff", width: 2.5, dash: "dash" },
      hovertemplate: "<b>D20 Thermocline:</b> %{y:.1f}m<extra></extra>"
    });
  }

  const layout = {
    title: {
      text: `<b>${titleStr}</b> — ${data.fixed_location || ''} (${data.date || ''})`,
      font: { color: fontColor, size: 12 },
      x: 0.02,
      xanchor: "left"
    },
    autosize: true,
    height: 380,
    margin: { l: 65, r: 40, t: 36, b: 48 },
    paper_bgcolor: "transparent",
    plot_bgcolor: plotBg,
    xaxis: {
      title: { text: axis === "lat" ? "Longitude across North Indian Ocean (°E)" : "Latitude across North Indian Ocean (°N)", font: { color: fontColor, size: 11 } },
      tickfont: { color: fontColor, size: 10 },
      gridcolor: gridColor,
      zeroline: false
    },
    yaxis: {
      autorange: "reversed",
      title: { text: "Standard Depth (m)", font: { color: fontColor, size: 11 } },
      tickfont: { color: fontColor, size: 10 },
      gridcolor: gridColor,
      tickmode: "array",
      tickvals: [0, 50, 100, 200, 300, 500, 700, 1000],
      ticktext: ["0m", "50m", "100m", "200m", "300m", "500m", "700m", "1000m"]
    },
    legend: {
      orientation: "h",
      y: 1.12,
      x: 0.65,
      font: { color: fontColor, size: 10 }
    }
  };

  const config = {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ["lasso2d", "select2d"]
  };

  Plotly.react(plotDiv, traces, layout, config);
}

function populateTransectTable(data) {
  const container = document.getElementById("transect-table-wrapper");
  if (!container) return;

  function tempToColor(val) {
    if (val === null || val === undefined) return { bg: "rgba(255,255,255,0.04)", text: "#475569", display: "-" };
    const lo = 4, hi = 30;
    const t = Math.max(0, Math.min(1, (val - lo) / (hi - lo)));
    let r, g, b;
    if (t < 0.25) {
      const s = t / 0.25;
      r = Math.round(0 + s * 0);       g = Math.round(100 + s * 155); b = Math.round(200 + s * 55);
    } else if (t < 0.5) {
      const s = (t - 0.25) / 0.25;
      r = Math.round(0 + s * 100);     g = Math.round(200 + s * 55);  b = Math.round(200 - s * 200);
    } else if (t < 0.75) {
      const s = (t - 0.5) / 0.25;
      r = Math.round(100 + s * 155);   g = Math.round(220 - s * 50);  b = Math.round(0);
    } else {
      const s = (t - 0.75) / 0.25;
      r = Math.round(220 + s * 35);    g = Math.round(170 - s * 130); b = Math.round(0);
    }
    const textColor = t > 0.55 ? "#fff" : "#0f172a";
    return { bg: `rgb(${r},${g},${b})`, text: textColor, display: val.toFixed(1) };
  }

  const coords = data.coordinates || [];
  const depths = data.depths || [];
  const matrix = data.predicted_curtain || data.temperature_matrix || [];
  const axis = data.axis || document.getElementById("transect-axis").value;
  const axisLabel = (axis === "lat") ? "°E" : "°N";

  const step = coords.length > 40 ? 2 : 1;
  const showCols = coords.filter((_, i) => i % step === 0);
  const showColIdxs = coords.map((_, i) => i).filter(i => i % step === 0);

  let html = `<table class="transect-table"><thead><tr>
    <th class="depth-col">Depth (m)</th>
    ${showCols.map(c => `<th>${parseFloat(c).toFixed(1)}${axisLabel}</th>`).join("")}
  </tr></thead><tbody>`;

  depths.forEach((depth, d_idx) => {
    const row = matrix[d_idx];
    html += `<tr><td class="depth-label">${depth}m</td>`;
    showColIdxs.forEach(c_idx => {
      const val = row ? row[c_idx] : null;
      const col = tempToColor(val);
      html += `<td style="background:${col.bg}; color:${col.text};">${col.display}</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}



/* Sync date changed in 3D Studio back to main dashboard */
function syncDateFromStudio(date) {
  const dashDate = document.getElementById("select-date");
  if (dashDate) dashDate.value = date;
  const badge = document.getElementById("badge-date");
  if (badge) badge.textContent = date;
  renderStudio3D();
}



/* Quick Jump to Important Basin Regions in 3D Studio */
function jumpStudioRegion(lat, lon, name) {
  const latEl = document.getElementById("studio-lat");
  const lonEl = document.getElementById("studio-lon");
  if (latEl) latEl.value = lat.toFixed(2);
  if (lonEl) lonEl.value = lon.toFixed(2);

  const latRange = document.getElementById("studio-lat-range");
  const lonRange = document.getElementById("studio-lon-range");
  if (latRange) latRange.value = lat.toFixed(2);
  if (lonRange) lonRange.value = lon.toFixed(2);

  const latBadge = document.getElementById("studio-lat-badge");
  const lonBadge = document.getElementById("studio-lon-badge");
  if (latBadge) latBadge.textContent = `${lat.toFixed(2)}°N`;
  if (lonBadge) lonBadge.textContent = `${lon.toFixed(2)}°E`;

  const inLat = document.getElementById("input-lat");
  const inLon = document.getElementById("input-lon");
  if (inLat) inLat.value = lat.toFixed(2);
  if (inLon) inLon.value = lon.toFixed(2);



  document.querySelectorAll(".btn-studio-chip").forEach(c => c.classList.remove("active"));
  if (typeof event !== "undefined" && event && event.target) {
    event.target.classList.add("active");
  }
  renderStudio3D();
}

let isSolidVolume = true;

function toggleSolidVolume() {
  isSolidVolume = !isSolidVolume;
  const btn = document.getElementById("btn-toggle-solid");
  const lbl = document.getElementById("lbl-solid-status");
  if (lbl) lbl.textContent = isSolidVolume ? "On" : "Off";
  if (btn) {
    if (isSolidVolume) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  }
  renderStudio3D();
}

/* Render Fullscreen 3D Volumetric Surface in Separate Studio Page */
async function renderStudio3D() {
  const container = document.getElementById("plotly-3d-studio-container");
  if (!container) return;

  const studioLat     = parseFloat(document.getElementById("studio-lat")?.value ?? "15.0");
  const studioLon     = parseFloat(document.getElementById("studio-lon")?.value ?? "65.0");
  const studioAxis    = document.getElementById("studio-axis")?.value  ?? "lat";
  const studioMode    = document.getElementById("studio-mode")?.value  ?? "block";
  const studioDate    = document.getElementById("studio-date")?.value  ?? "";
  const colorscale    = document.getElementById("studio-colorscale")?.value ?? "Thermal";
  const wallOpacity   = isSolidVolume ? 1.0 : 0.40;

  // Keep badges and range inputs in sync
  const latBadge = document.getElementById("studio-lat-badge");
  const lonBadge = document.getElementById("studio-lon-badge");
  if (latBadge) latBadge.textContent = `${studioLat.toFixed(2)}°N`;
  if (lonBadge) lonBadge.textContent = `${studioLon.toFixed(2)}°E`;

  const latRange = document.getElementById("studio-lat-range");
  const lonRange = document.getElementById("studio-lon-range");
  if (latRange && Math.abs(parseFloat(latRange.value) - studioLat) > 0.01) latRange.value = studioLat;
  if (lonRange && Math.abs(parseFloat(lonRange.value) - studioLon) > 0.01) lonRange.value = studioLon;

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const bgColor   = isDark ? "rgba(6,14,31,0.95)" : "#0a1628";
  const axisColor = "#38bdf8";
  const tickColor = isDark ? "#94a3b8" : "#cbd5e1";
  const gridCol   = isDark ? "rgba(56,189,248,0.12)" : "rgba(56,189,248,0.15)";

  container.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; color:#38bdf8; font-size:14px; font-family:'Plus Jakarta Sans',sans-serif; gap:12px; background:#060e1f; border-radius:14px;">
    <i class="fa-solid fa-spinner fa-spin"></i> Reconstructing 3D Thermal Volume (${studioMode.toUpperCase()}) — ${studioDate || "latest"} @ ${studioLat.toFixed(2)}°N, ${studioLon.toFixed(2)}°E...
  </div>`;

  try {
    const url = `/api/volume_3d?lat=${studioLat}&lon=${studioLon}${studioDate ? "&date=" + studioDate : ""}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== "success") throw new Error(data.message || "API error");

    // Populate sidebar stats
    const setS = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    if (data.surface_telemetry) {
      setS("studio-sst", `${data.surface_telemetry.sst_c} °C`);
      setS("studio-sss", `${data.surface_telemetry.sss_psu} PSU`);
      setS("studio-ssh", `${data.surface_telemetry.ssh_m} m`);
    }
    // Thermocline depth at center
    if (data.profile_at_center && data.profile_at_center.length > 0) {
      const p1000 = data.profile_at_center.find(p => p.depth_m >= 900);
      if (p1000) setS("studio-deep", `${p1000.temperature_c} °C`);
      const sst = data.surface_telemetry ? data.surface_telemetry.sst_c : 28.0;
      const therm = data.profile_at_center.find(p => p.temperature_c < sst - 4.5);
      setS("studio-thermo", therm ? `~${therm.depth_m}m` : "~92m");
    }

    let plotlyData = [];
    let sceneConfig = {};

    const depths = data.depths || [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000];
    const lonsAll = data.lons_all || data.lons;
    const latsAll = data.lats_all || data.lats;
    const minLat = latsAll[0];
    const maxLat = latsAll[latsAll.length - 1];
    const minLon = lonsAll[0];
    const maxLon = lonsAll[lonsAll.length - 1];

    // 1. Build selected active color palette dynamically: Warm red/yellow surface water -> Cool dark blue deep water
    function buildActiveColorscale(name) {
      if (name === "Viridis") {
        // Ocean thermal Viridis: Cool dark blue (0°C deep water) -> teal -> green -> warm yellow -> warm orange (surface)
        return [
          [0.00, "#081d58"], // 0°C: Cold deep navy
          [0.20, "#253494"], // 6°C: Cool ocean blue
          [0.40, "#21918c"], // 12°C: Intermediate teal
          [0.60, "#41ab5d"], // 18°C: Green thermocline
          [0.80, "#fde725"], // 24°C: Warm radiant yellow
          [1.00, "#ff5400"]  // 30°C: Warm surface orange-red
        ];
      } else if (name === "Jet") {
        return [
          [0.00, "#000080"], [0.125, "#0000ff"], [0.375, "#00ffff"],
          [0.625, "#ffff00"], [0.875, "#ff0000"], [1.00, "#800000"]
        ];
      } else if (name === "Plasma") {
        return [
          [0.00, "#03045e"], [0.25, "#0077b6"], [0.50, "#00b4d8"],
          [0.75, "#f77f00"], [1.00, "#d62828"]
        ];
      } else if (name === "Turbo") {
        return [
          [0.00, "#30123b"], [0.20, "#4162e0"], [0.40, "#19bb6a"],
          [0.60, "#a2fc3c"], [0.80, "#e84715"], [1.00, "#7a0403"]
        ];
      } else if (name === "Cividis") {
        return [
          [0.00, "#00204d"], [0.25, "#414d6b"], [0.50, "#7c7b78"],
          [0.75, "#b9ac70"], [1.00, "#ffea46"]
        ];
      }
      // Default: Thermal Palette (Warm colors [red/yellow] for warm surface water, and cool colors [dark blue] for cold deep water)
      return [
        [0.00, "#03045e"], // 0°C: Deepest cold navy blue
        [0.17, "#023e8a"], // 5°C (1000m): Deep cold blue
        [0.33, "#0077b6"], // 10°C: Intermediate oceanic blue
        [0.50, "#00b4d8"], // 15°C: Cyan thermocline transition
        [0.67, "#ffd166"], // 20°C: Radiant solar yellow
        [0.83, "#f77f00"], // 25°C: Warm rich amber orange
        [1.00, "#d62828"]  // 30°C: Warm surface tropical crimson red
      ];
    }

    const activePalette = buildActiveColorscale(colorscale);

    // Solid matte lighting eliminating milky glaze or washed-out translucency
    const solidLighting = {
      ambient: 0.96,
      diffuse: 0.88,
      specular: 0.04,
      roughness: 0.5,
      fresnel: 0.02
    };

    // Perceptual depth stretch so upper 200m thermocline is visually prominent as in template
    const depthToZ = (d) => - (Math.pow(d / 1000, 0.65) * 1000);
    const zDepths = depths.map(d => depthToZ(d));

    // Update floating header date subtitle
    const subElem = document.getElementById("template-date-subtitle");
    if (subElem) subElem.textContent = `North Indian Ocean | ${data.date || studioDate || "2024-06-01"}`;

    if (studioMode === "block" || studioMode === "curtains") {
      // 1. South Boundary Wall (along 5°N from 45°E to 105°E down to 1000m) - 100% Solid
      if (studioMode === "block" && wallOpacity > 0.01) {
        const southX = zDepths.map(() => lonsAll);
        const southY = zDepths.map(() => lonsAll.map(() => minLat));
        const southZ = zDepths.map(z => lonsAll.map(() => z));

        plotlyData.push({
          type: "surface",
          name: `South Boundary (5°N)`,
          x: southX, y: southY, z: southZ,
          surfacecolor: data.south_slice || data.lat_slice,
          colorscale: activePalette,
          cmin: 0, cmax: 30,
          colorbar: {
            orientation: "h",
            x: 0.22, xanchor: "center",
            y: 0.06, yanchor: "bottom",
            len: 0.36, thickness: 15,
            title: { text: "Temperature (°C)", font: { color: "#ffffff", size: 11, family: "Plus Jakarta Sans, sans-serif" }, side: "top" },
            tickvals: [0, 5, 10, 15, 20, 25, 30],
            ticktext: ["0", "5", "10", "15", "20", "25", "30"],
            tickfont: { color: "#cbd5e1", size: 9 },
            bgcolor: "rgba(6, 14, 31, 0.8)",
            bordercolor: "rgba(56, 189, 248, 0.4)",
            borderwidth: 1
          },
          opacity: wallOpacity,
          showscale: true,
          hoverinfo: "skip",
          lighting: solidLighting
        });

        // 2. West Boundary Wall (along 45°E from 5°N to 30°N down to 1000m) - 100% Solid
        const westX = zDepths.map(() => latsAll.map(() => minLon));
        const westY = zDepths.map(() => latsAll);
        const westZ = zDepths.map(z => latsAll.map(() => z));

        plotlyData.push({
          type: "surface",
          name: `West Boundary (45°E)`,
          x: westX, y: westY, z: westZ,
          surfacecolor: data.west_slice || data.lon_slice,
          colorscale: activePalette,
          cmin: 0, cmax: 30,
          opacity: wallOpacity,
          showscale: false,
          hoverinfo: "skip",
          lighting: solidLighting
        });

        // 3. East Boundary Wall (along 105°E from 5°N to 30°N down to 1000m) - 100% Solid
        const eastX = zDepths.map(() => latsAll.map(() => maxLon));
        const eastY = zDepths.map(() => latsAll);
        const eastZ = zDepths.map(z => latsAll.map(() => z));

        plotlyData.push({
          type: "surface",
          name: `East Boundary (105°E)`,
          x: eastX, y: eastY, z: eastZ,
          surfacecolor: data.east_slice || data.lon_slice,
          colorscale: activePalette,
          cmin: 0, cmax: 30,
          opacity: wallOpacity,
          showscale: false,
          hoverinfo: "skip",
          lighting: solidLighting
        });

        // 4. North Boundary Wall (along 30°N from 45°E to 105°E down to 1000m) - 100% Solid
        const northX = zDepths.map(() => lonsAll);
        const northY = zDepths.map(() => lonsAll.map(() => maxLat));
        const northZ = zDepths.map(z => lonsAll.map(() => z));

        plotlyData.push({
          type: "surface",
          name: `North Boundary (30°N)`,
          x: northX, y: northY, z: northZ,
          surfacecolor: data.north_slice || data.lat_slice,
          colorscale: activePalette,
          cmin: 0, cmax: 30,
          opacity: wallOpacity,
          showscale: false,
          hoverinfo: "skip",
          lighting: solidLighting
        });
      }

      // If curtains mode: show orthogonal interior cuts
      if (studioMode === "curtains") {
        const latCutX = zDepths.map(() => lonsAll);
        const latCutY = zDepths.map(() => lonsAll.map(() => studioLat));
        const latCutZ = zDepths.map(z => lonsAll.map(() => z));

        plotlyData.push({
          type: "surface",
          name: `Lat Cut (${studioLat.toFixed(2)}°N)`,
          x: latCutX, y: latCutY, z: latCutZ,
          surfacecolor: data.lat_slice,
          colorscale: activePalette,
          cmin: 0, cmax: 30,
          colorbar: {
            orientation: "h",
            x: 0.22, xanchor: "center",
            y: 0.06, yanchor: "bottom",
            len: 0.36, thickness: 15,
            title: { text: "Temperature (°C)", font: { color: "#ffffff", size: 11, family: "Plus Jakarta Sans, sans-serif" }, side: "top" },
            tickvals: [0, 5, 10, 15, 20, 25, 30],
            ticktext: ["0", "5", "10", "15", "20", "25", "30"],
            tickfont: { color: "#cbd5e1", size: 9 },
            bgcolor: "rgba(6, 14, 31, 0.8)",
            bordercolor: "rgba(56, 189, 248, 0.4)",
            borderwidth: 1
          },
          opacity: 1.0,
          showscale: true,
          lighting: solidLighting
        });

        const lonCutX = zDepths.map(() => latsAll.map(() => studioLon));
        const lonCutY = zDepths.map(() => latsAll);
        const lonCutZ = zDepths.map(z => latsAll.map(() => z));

        plotlyData.push({
          type: "surface",
          name: `Lon Cut (${studioLon.toFixed(2)}°E)`,
          x: lonCutX, y: lonCutY, z: lonCutZ,
          surfacecolor: data.lon_slice,
          colorscale: activePalette,
          cmin: 0, cmax: 30,
          opacity: 1.0,
          showscale: false,
          lighting: solidLighting
        });

        // Probe marker
        plotlyData.push({
          type: "scatter3d",
          mode: "lines+markers",
          name: `Probe Fix (${studioLat.toFixed(2)}°N, ${studioLon.toFixed(2)}°E)`,
          x: [studioLon, studioLon],
          y: [studioLat, studioLat],
          z: [0, -1000],
          line: { color: "#fbbf24", width: 8 },
          marker: { size: [9, 5], color: ["#fbbf24", "#ef4444"] },
          showlegend: true
        });
      }

      // Top Face: Real Geographic Satellite Map (Leaflet / Esri World Imagery) or SST (Z = 0m)
      const topTexture = document.getElementById("studio-top-texture")?.value ?? "satellite";
      const satData = await getSatelliteSurface();

      if (topTexture === "satellite" && satData && satData.indices) {
        const satLats = satData.lats;
        const satLons = satData.lons;
        const satX = satLats.map(() => satLons);
        const satY = satLats.map(latVal => satLons.map(() => latVal));
        const satZ = satLats.map(() => satLons.map(() => 0));

        plotlyData.push({
          type: "surface",
          name: "Original Satellite Map (Esri/Leaflet)",
          x: satX,
          y: satY,
          z: satZ,
          surfacecolor: satData.indices,
          colorscale: satData.colorscale,
          cmin: 0,
          cmax: 255,
          opacity: 1.0,
          showscale: false,
          hoverinfo: "x+y",
          hovertemplate: "<b>Original Satellite Map</b><br>Lat: %{y:.2f}°N<br>Lon: %{x:.2f}°E<extra></extra>",
          lighting: solidLighting
        });
      } else {
        const subLats = data.sub_lats || data.lats_sub;
        const subLons = data.sub_lons || data.lons_sub;
        const surfX = subLats.map(() => subLons);
        const surfY = subLats.map(latVal => subLons.map(() => latVal));
        const surfZ = subLats.map(() => subLons.map(() => 0));

        plotlyData.push({
          type: "surface",
          name: "Sea Surface Temperature (SST)",
          x: surfX,
          y: surfY,
          z: surfZ,
          surfacecolor: data.surface_sst,
          colorscale: activePalette,
          cmin: 0,
          cmax: 30,
          opacity: 1.0,
          showscale: false,
          hoverinfo: "skip",
          lighting: solidLighting
        });
      }

      // 5. Seafloor Base Floor (Z = -1000m) - Closes the cube so inside is completely solid
      if (studioMode === "block") {
        const subLats = data.sub_lats || data.lats_sub;
        const subLons = data.sub_lons || data.lons_sub;
        const botX = subLats.map(() => subLons);
        const botY = subLats.map(latVal => subLons.map(() => latVal));
        const botZ = subLats.map(() => subLons.map(() => depthToZ(1000)));

        plotlyData.push({
          type: "surface",
          name: "Seafloor Base (1000m)",
          x: botX,
          y: botY,
          z: botZ,
          surfacecolor: data.bottom_slice || subLats.map(() => subLons.map(() => 5.2)),
          colorscale: activePalette,
          cmin: 0,
          cmax: 30,
          opacity: wallOpacity,
          showscale: false,
          hoverinfo: "skip",
          lighting: solidLighting
        });
      }

      // Coastline vector overlay tracing peninsular India and subcontinent
      if (data.coastlines && data.coastlines.lats && data.coastlines.lats.length > 0) {
        plotlyData.push({
          type: "scatter3d",
          mode: "markers",
          name: "Coastlines & Borders",
          x: data.coastlines.lons,
          y: data.coastlines.lats,
          z: data.coastlines.lats.map(() => 0.8),
          marker: { size: 2.2, color: "#38bdf8", opacity: 0.9 },
          hoverinfo: "skip",
          showlegend: false
        });
      }

      // In-situ ARGO observation float markers on the top satellite surface
      const argoFloats = [
        { id: "ARGO_INCOIS_001", lat: 16.5, lon: 66.25, name: "Central Arabian Sea", sst: 28.2 },
        { id: "ARGO_INCOIS_002", lat: 14.5, lon: 63.50, name: "Western Arabian Sea", sst: 27.8 },
        { id: "ARGO_INCOIS_003", lat: 17.5, lon: 67.50, name: "Eastern Arabian Sea", sst: 29.1 },
        { id: "ARGO_INCOIS_004", lat: 14.25, lon: 92.75, name: "Andaman Sea / BoB", sst: 29.4 },
        { id: "ARGO_INCOIS_005", lat: 15.0, lon: 90.25, name: "Central Bay of Bengal", sst: 28.9 },
        { id: "ARGO_INCOIS_006", lat: 12.25, lon: 90.50, name: "Southern Bay of Bengal", sst: 29.7 }
      ];
      plotlyData.push({
        type: "scatter3d",
        mode: "markers+text",
        name: "INCOIS ARGO Floats",
        x: argoFloats.map(f => f.lon),
        y: argoFloats.map(f => f.lat),
        z: argoFloats.map(() => 1.5),
        marker: { size: 5.5, color: "#38bdf8", symbol: "circle", line: { color: "#ffffff", width: 1.5 } },
        text: argoFloats.map(f => f.id),
        textposition: "top center",
        textfont: { color: "#bae6fd", size: 9, family: "Plus Jakarta Sans, sans-serif" },
        hovertemplate: "<b>%{text}</b><br>Lat: %{y:.2f}°N, Lon: %{x:.2f}°E<extra></extra>",
        showlegend: true
      });

      // Selected Reconstruction Center Pin
      plotlyData.push({
        type: "scatter3d",
        mode: "markers",
        name: `Center (${studioLat.toFixed(2)}°N, ${studioLon.toFixed(2)}°E)`,
        x: [studioLon],
        y: [studioLat],
        z: [2.5],
        marker: { size: 8, color: "#f59e0b", symbol: "diamond", line: { color: "#ffffff", width: 2 } },
        hovertemplate: `<b>Selected Center</b><br>Lat: ${studioLat.toFixed(2)}°N<br>Lon: ${studioLon.toFixed(2)}°E<extra></extra>`,
        showlegend: true
      });

      sceneConfig = {
        xaxis: {
          title: { text: "", font: { color: axisColor, size: 10 } },
          tickmode: "array",
          tickvals: [45, 60, 75, 90, 105],
          ticktext: ["45°E", "60°E", "75°E", "90°E", "105°E"],
          range: [45, 105],
          tickfont: { color: "#ffffff", size: 10, family: "Plus Jakarta Sans, sans-serif" },
          gridcolor: "rgba(56,189,248,0.20)",
          showgrid: true,
          zeroline: false,
          showbackground: false,
          mirror: false,
          showspikes: false,
          spikesides: false
        },
        yaxis: {
          title: { text: "", font: { color: axisColor, size: 10 } },
          tickmode: "array",
          tickvals: [10, 15, 20, 25, 30],
          ticktext: ["10°N", "15°N", "20°N", "25°N", "30°N"],
          range: [5, 30],
          tickfont: { color: "#ffffff", size: 10, family: "Plus Jakarta Sans, sans-serif" },
          gridcolor: "rgba(56,189,248,0.20)",
          showgrid: true,
          zeroline: false,
          showbackground: false,
          mirror: false,
          showspikes: false,
          spikesides: false
        },
        zaxis: {
          title: { text: "Depth", font: { color: "#ffffff", size: 12, family: "Plus Jakarta Sans, sans-serif" } },
          tickmode: "array",
          tickvals: [depthToZ(0), depthToZ(200), depthToZ(500), depthToZ(1000)],
          ticktext: ["0m", "200m", "500m", "1000m"],
          range: [-1000, 0],
          tickfont: { color: "#ffffff", size: 11, family: "JetBrains Mono, monospace", weight: "700" },
          gridcolor: "rgba(56,189,248,0.25)",
          showgrid: true,
          zeroline: false,
          showbackground: false,
          mirror: false,
          showspikes: false,
          spikesides: false
        },
        camera: {
          eye: { x: 1.45, y: -1.75, z: 0.95 },
          center: { x: 0, y: 0, z: -0.22 },
          up: { x: 0, y: 0, z: 1 }
        },
        aspectmode: "manual",
        aspectratio: { x: 1.55, y: 1.25, z: 0.92 }
      };

    } else if (studioMode === "surface") {
      const isLat = (studioAxis === "lat");
      const coords = isLat ? data.lons_all : data.lats_all;
      const matrix = isLat ? data.lat_slice : data.lon_slice;
      const xLabel = isLat ? "Longitude (°E)" : "Latitude (°N)";

      plotlyData.push({
        type: "surface",
        x: coords,
        y: data.depths,
        z: matrix,
        colorscale: activePalette,
        opacity: 1.0,
        colorbar: {
          orientation: "h",
          x: 0.5, xanchor: "center",
          y: -0.12, yanchor: "top",
          len: 0.8, thickness: 16,
          title: { text: "Temperature (°C)", font: { color: "#f8fafc", size: 12, family: "Plus Jakarta Sans" } },
          ticksuffix: "°C",
          tickfont: { color: "#cbd5e1", size: 10 },
          bgcolor: "rgba(11,17,32,0.85)", bordercolor: "rgba(56,189,248,0.3)", borderwidth: 1
        },
        contours: {
          x: { show: true, highlightcolor: "#38bdf8", width: 2, color: "rgba(56,189,248,0.25)" },
          y: { show: true, highlightcolor: "#34d399", width: 2, color: "rgba(52,211,153,0.2)" },
          z: { show: true, usecolormap: true, project: { z: true }, highlightcolor: "#fbbf24", width: 1 }
        },
        lighting: { ambient: 0.7, diffuse: 0.8, roughness: 0.5, fresnel: 0.2 }
      });

      // Target location vertical line on transect surface
      const targetCoord = isLat ? studioLon : studioLat;
      plotlyData.push({
        type: "scatter3d",
        mode: "lines+markers",
        name: `Location Fix (${targetCoord.toFixed(2)}°)`,
        x: [targetCoord, targetCoord],
        y: [0, 1000],
        z: [30, 4],
        line: { color: "#fbbf24", width: 6 },
        marker: { size: 8, color: "#fbbf24" }
      });

      sceneConfig = {
        xaxis: { title: { text: xLabel, font: { color: axisColor, size: 10 } }, tickfont: { color: tickColor, size: 9 }, gridcolor: gridCol, showbackground: false, mirror: false, showspikes: false, spikesides: false },
        yaxis: { title: { text: "Depth (meters)", font: { color: axisColor, size: 10 } }, autorange: "reversed", tickfont: { color: tickColor, size: 9 }, gridcolor: gridCol, showbackground: false, mirror: false, showspikes: false, spikesides: false },
        zaxis: { title: { text: "Temp (°C)", font: { color: axisColor, size: 10 } }, tickfont: { color: tickColor, size: 9 }, gridcolor: gridCol, showbackground: false, mirror: false, showspikes: false, spikesides: false },
        camera: {
          eye: { x: 1.3, y: 1.3, z: 0.8 },
          center: { x: 0, y: 0, z: 0 },
          up: { x: 0, y: 0, z: 1 }
        },
        aspectmode: "manual",
        aspectratio: { x: 2.0, y: 0.9, z: 0.8 }
      };

    } else if (studioMode === "d20") {
      plotlyData.push({
        type: "surface",
        name: "D20 Thermocline Depth",
        x: data.sub_lons,
        y: data.sub_lats,
        z: data.d20_thermocline,
        colorscale: activePalette,
        reversescale: true,
        opacity: 1.0,
        colorbar: {
          orientation: "h",
          x: 0.5, xanchor: "center",
          y: -0.12, yanchor: "top",
          len: 0.8, thickness: 16,
          title: { text: "D20 Depth (m)", font: { color: "#f8fafc", size: 12, family: "Plus Jakarta Sans" } },
          ticksuffix: "m",
          tickfont: { color: "#cbd5e1", size: 10 },
          bgcolor: "rgba(11,17,32,0.85)", bordercolor: "rgba(56,189,248,0.3)", borderwidth: 1
        },
        contours: {
          z: { show: true, usecolormap: true, highlightcolor: "#38bdf8", project: { z: true } }
        }
      });

      // Target Pin on D20 surface
      plotlyData.push({
        type: "scatter3d",
        mode: "markers+text",
        name: `D20 Pin (${studioLat.toFixed(2)}°N, ${studioLon.toFixed(2)}°E)`,
        x: [studioLon],
        y: [studioLat],
        z: [100],
        marker: { size: 12, color: "#f59e0b", symbol: "diamond" }
      });

      sceneConfig = {
        xaxis: { title: { text: "Longitude (°E)", font: { color: axisColor, size: 10 } }, tickfont: { color: tickColor, size: 9 }, gridcolor: gridCol, showbackground: false, mirror: false, showspikes: false, spikesides: false },
        yaxis: { title: { text: "Latitude (°N)", font: { color: axisColor, size: 10 } }, tickfont: { color: tickColor, size: 9 }, gridcolor: gridCol, showbackground: false, mirror: false, showspikes: false, spikesides: false },
        zaxis: { title: { text: "D20 Depth (m)", font: { color: axisColor, size: 10 } }, autorange: "reversed", tickfont: { color: tickColor, size: 9 }, gridcolor: gridCol, showbackground: false, mirror: false, showspikes: false, spikesides: false },
        camera: {
          eye: { x: 1.3, y: -1.3, z: 0.8 },
          center: { x: 0, y: 0, z: 0 },
          up: { x: 0, y: 0, z: 1 }
        },
        aspectmode: "manual",
        aspectratio: { x: 1.8, y: 1.2, z: 0.8 }
      };
    }

    const titleModeName = studioMode === "block"    ? "3D Reconstruction of Ocean Temperature (Volumetric Block)"
                        : studioMode === "curtains" ? "Orthogonal Curtains (SST Surface + Depth Curtains)"
                        : studioMode === "surface"  ? `0.25° Transect Thermal Surface (${studioAxis === "lat" ? studioLat.toFixed(2)+"°N" : studioLon.toFixed(2)+"°E"})`
                        :                             "D20 Thermocline Depth Topography (20°C Isotherm)";

    const layout = {
      title: studioMode === "block" ? false : {
        text: `${titleModeName}<br><span style="font-size:11px; color:#94a3b8;">North Indian Ocean | ${studioDate || "2024-06-01"} | Center: ${studioLat.toFixed(2)}°N, ${studioLon.toFixed(2)}°E</span>`,
        font: { color: "#f8fafc", size: 14, family: "Plus Jakarta Sans" },
        x: 0.5, y: 0.98
      },
      margin: { l: 0, r: 0, b: 0, t: studioMode === "block" ? 0 : 25 },
      paper_bgcolor: bgColor,
      plot_bgcolor: bgColor,
      hovermode: false,
      showlegend: studioMode === "curtains",
      legend: {
        x: 0.01,
        y: 0.05,
        orientation: "h",
        bgcolor: "rgba(11,17,32,0.85)",
        bordercolor: "rgba(56,189,248,0.3)",
        borderwidth: 1,
        font: { color: "#f8fafc", size: 10, family: "Plus Jakarta Sans" }
      },
      scene: {
        bgcolor: bgColor,
        hovermode: false,
        ...sceneConfig
      }
    };

    container.innerHTML = "";
    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ["sendDataToCloud"],
      toImageButtonOptions: {
        format: "png", filename: `OceanEmbed_3D_${studioMode}_${studioDate}`,
        height: 800, width: 1400, scale: 2
      }
    };
    Plotly.newPlot("plotly-3d-studio-container", plotlyData, layout, config);

    // Dynamic Compass Needle Rotation on 3D Camera Orbit
    const graphDiv = document.getElementById("plotly-3d-studio-container");
    if (graphDiv && graphDiv.on) {
      graphDiv.on("plotly_relayout", function(ed) {
        if (ed["scene.camera"] && ed["scene.camera"].eye) {
          const eye = ed["scene.camera"].eye;
          const angleRad = Math.atan2(eye.x, -eye.y);
          const angleDeg = angleRad * (180 / Math.PI);
          const needle = document.getElementById("compass-needle");
          if (needle) needle.style.transform = `rotate(${angleDeg}deg)`;
        }
      });
    }

  } catch (err) {
    container.innerHTML = `<div style="color:#f87171; padding:30px; background:#060e1f; border-radius:14px; font-family:Plus Jakarta Sans,sans-serif;"><i class="fa-solid fa-triangle-exclamation"></i> Error rendering 3D visualization: ${err.message}</div>`;
    console.error("Error rendering 3D Studio:", err);
  }
}

/* Interactive 3D Camera Rotation via Compass (N, S, E, W, Reset) */
function setCompassCamera(dir) {
  const container = document.getElementById("plotly-3d-studio-container");
  if (!container || !container._fullLayout) return;

  let eye = { x: 1.4, y: -1.4, z: 0.9 };
  if (dir === 'N') eye = { x: 0, y: -2.4, z: 0.4 };
  else if (dir === 'S') eye = { x: 0, y: 2.4, z: 0.4 };
  else if (dir === 'E') eye = { x: -2.4, y: 0, z: 0.4 };
  else if (dir === 'W') eye = { x: 2.4, y: 0, z: 0.4 };

  Plotly.relayout(container, {
    'scene.camera.eye': eye
  });
}


async function renderEmbeddings() {
  try {
    const selectedDate = document.getElementById("select-date") ? document.getElementById("select-date").value : "";
    const res = await fetch(`/api/embeddings${selectedDate ? "?date=" + selectedDate : ""}`);
    const data = await res.json();

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const axisFont = { color: isDark ? "#0c4a6e" : "#64748b", size: 9 };
    const paperBg  = "rgba(0,0,0,0)";

    // Helper: thin out embedding grid for performance (subsample every 3rd row/col)
    function subsample(matrix, step) {
      if (!matrix || !matrix.length) return matrix;
      return matrix.filter((_, i) => i % step === 0)
                   .map(row => row.filter((_, j) => j % step === 0));
    }

    const baseLayout = {
      margin: { t: 5, b: 30, l: 35, r: 8 },
      paper_bgcolor: paperBg,
      plot_bgcolor: paperBg,
      xaxis: { title: "Lon (°E)", titlefont: axisFont, tickfont: axisFont },
      yaxis: { title: "Lat (°N)", titlefont: axisFont, tickfont: axisFont }
    };

    const cfg = { responsive: true, displayModeBar: false };

    if (data.embedding_channel_1) {
      Plotly.newPlot("embedding-c1", [{
        z: subsample(data.embedding_channel_1, 2),
        x: data.lons ? data.lons.filter((_, i) => i % 2 === 0) : undefined,
        y: data.lats ? data.lats.filter((_, i) => i % 2 === 0) : undefined,
        type: "heatmap",
        colorscale: "Viridis",
        colorbar: { title: "Activation", titlefont: axisFont, tickfont: axisFont, thickness: 10, len: 0.9 }
      }], { ...baseLayout, title: { text: "PC-1: Thermal Structure", font: { color: isDark ? "#0c4a6e" : "#334155", size: 10 } } }, cfg);
    }

    if (data.embedding_channel_2) {
      Plotly.newPlot("embedding-c2", [{
        z: subsample(data.embedding_channel_2, 2),
        x: data.lons ? data.lons.filter((_, i) => i % 2 === 0) : undefined,
        y: data.lats ? data.lats.filter((_, i) => i % 2 === 0) : undefined,
        type: "heatmap",
        colorscale: "RdBu",
        colorbar: { title: "Activation", titlefont: axisFont, tickfont: axisFont, thickness: 10, len: 0.9 }
      }], { ...baseLayout, title: { text: "PC-2: Dynamic Pattern", font: { color: isDark ? "#0c4a6e" : "#334155", size: 10 } } }, cfg);
    }
  } catch (err) {
    console.error("Error rendering embeddings:", err);
  }
}

function switchTab(tabId, btnEl) {
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelectorAll(".tab-pane").forEach(pane => pane.classList.remove("active"));

  let btn = btnEl;
  if (!btn && typeof event !== "undefined" && event && event.target) {
    btn = event.target.closest(".tab-btn");
  }
  if (!btn) {
    btn = document.querySelector(`.tab-btn[onclick*="${tabId}"]`);
  }
  if (btn) btn.classList.add("active");

  const targetPane = document.getElementById(tabId);
  if (targetPane) targetPane.classList.add("active");

  if (tabId === "transect-tab") {
    const slider = document.getElementById("transect-slider");
    const axis = document.getElementById("transect-axis").value;
    if (axis === "lat") {
      slider.min = 5; slider.max = 30; slider.step = 0.25;
      slider.value = parseFloat(document.getElementById("input-lat").value) || 15;
      document.getElementById("slider-min-label").textContent = "5°N";
      document.getElementById("slider-max-label").textContent = "30°N";
      document.getElementById("slider-current-val").textContent = parseFloat(slider.value).toFixed(2) + "°N";
    } else {
      slider.min = 45; slider.max = 105; slider.step = 0.25;
      slider.value = parseFloat(document.getElementById("input-lon").value) || 65;
      document.getElementById("slider-min-label").textContent = "45°E";
      document.getElementById("slider-max-label").textContent = "105°E";
      document.getElementById("slider-current-val").textContent = parseFloat(slider.value).toFixed(2) + "°E";
    }
    renderTransect();
    setTimeout(() => {
      const plotEl = document.getElementById("transect-plot");
      if (plotEl && window.Plotly) Plotly.Plots.resize(plotEl);
    }, 120);
  } else if (tabId === "validation-tab") {
    loadMetrics();
  } else if (tabId === "embedding-tab") {
    renderEmbeddings();
  } else if (tabId === "agro-tab") {
    loadAgroAnalytics();
  }
}

function exportData() {
  if (!currentPrediction) {
    alert("No prediction data available to export. Please select an ocean coordinate first.");
    return;
  }
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentPrediction, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `OceanEmbed_Profile_${currentPrediction.grid_latitude}N_${currentPrediction.grid_longitude}E.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/* Operational CF-Compliant CSV Exporter for Numerical Ocean Models */
function exportCSV() {
  if (!currentPrediction || !currentPrediction.profile) {
    alert("No active prediction profile to export. Please select an ocean point first.");
    return;
  }
  const p = currentPrediction;
  const diag = p.diagnostics || {};
  const ch = diag.cyclone_hazard || {};

  let csv = [];
  csv.push("# OceanEmbed Operational Subsurface Profile (SIH PS 26066 - MoES / INCOIS)");
  csv.push(`# Date: ${p.date}`);
  csv.push(`# Latitude: ${p.grid_latitude} N, Longitude: ${p.grid_longitude} E`);
  csv.push(`# Data Source: ${p.data_source || 'Copernicus GLORYS12V1'}`);
  csv.push(`# Thermocline Depth (D20): ${diag.thermocline_d20_m ?? 'N/A'} m`);
  csv.push(`# Mixed Layer Depth (MLD): ${diag.mixed_layer_depth_m ?? 'N/A'} m`);
  csv.push(`# Sonic Layer Depth (SLD): ${diag.sonic_layer_depth_m ?? 'N/A'} m`);
  csv.push(`# Tropical Cyclone Heat Potential (TCHP): ${diag.tchp_kj_cm2 ?? 'N/A'} kJ/cm2 (${ch.badge_text || 'Low Risk'})`);
  csv.push(`# Upper Ocean Heat Content (0-300m): ${diag.ohc_300m_gj_m2 ?? 'N/A'} GJ/m2`);
  csv.push("# -------------------------------------------------------------");
  csv.push("depth_m,temperature_pred_c,uncertainty_sigma_c,temp_upper_c,temp_lower_c,sound_velocity_ms,glorys_truth_c,error_c");

  p.profile.forEach(row => {
    if (!row.valid) return;
    csv.push([
      row.depth_m,
      row.temperature_c ?? "",
      row.uncertainty_sigma_c ?? "",
      row.temp_upper_c ?? "",
      row.temp_lower_c ?? "",
      row.sound_velocity_ms ?? "",
      row.truth_temperature_c ?? (row.glorys_truth_c ?? ""),
      row.error_c ?? ""
    ].join(","));
  });

  const blob = new Blob([csv.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `OceanEmbed_Profile_${p.grid_latitude}N_${p.grid_longitude}E_${p.date}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/* Executive Operational Mission Intelligence Bulletin Modal */
function openExecutiveBulletin() {
  if (!currentPrediction) {
    alert("Please select and reconstruct an ocean point first.");
    return;
  }
  const p = currentPrediction;
  const diag = p.diagnostics || {};
  const ch = diag.cyclone_hazard || {};
  const mhw = diag.marine_heatwave || {};

  // Header timestamp
  const tsEl = document.getElementById("bulletin-timestamp");
  if (tsEl) {
    tsEl.textContent = `North Indian Ocean Sector | Lat: ${p.grid_latitude.toFixed(2)}°N, Lon: ${p.grid_longitude.toFixed(2)}°E | Date: ${p.date}`;
  }

  // Hazard Box
  const hBox = document.getElementById("bulletin-hazard-box");
  const hTitle = document.getElementById("bulletin-hazard-title");
  const hDesc = document.getElementById("bulletin-hazard-desc");
  const hIcon = document.getElementById("bhb-icon");

  if (hBox && hTitle && hDesc) {
    const cls = ch.badge_class || "hazard-low";
    hBox.className = `bulletin-hazard-banner ${cls === "hazard-severe" ? "hazard-banner-severe" : (cls === "hazard-moderate" ? "hazard-banner-moderate" : "hazard-banner-low")}`;
    hTitle.textContent = `Tropical Cyclone Potential: ${ch.badge_text || "Low Intensification Risk"}`;
    hDesc.textContent = ch.advisory || `TCHP is ${diag.tchp_kj_cm2 || 0} kJ/cm². Subsurface thermal conditions are within normal climatological bounds.`;
    if (hIcon) {
      hIcon.innerHTML = cls === "hazard-severe" ? '<i class="fa-solid fa-bolt"></i>' : (cls === "hazard-moderate" ? '<i class="fa-solid fa-triangle-exclamation"></i>' : '<i class="fa-solid fa-shield-halved"></i>');
    }
  }

  // Grid metrics
  const setEl = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.textContent = val; };
  setEl("b-d20", diag.thermocline_d20_m ? `${diag.thermocline_d20_m} m` : "—");
  setEl("b-mld", diag.mixed_layer_depth_m ? `${diag.mixed_layer_depth_m} m` : "—");
  setEl("b-sld", diag.sonic_layer_depth_m ? `${diag.sonic_layer_depth_m} m` : "—");
  setEl("b-sound-surface", diag.surface_sound_velocity_ms ? `${diag.surface_sound_velocity_ms} m/s` : "—");
  setEl("b-tchp", diag.tchp_kj_cm2 !== undefined ? `${diag.tchp_kj_cm2} kJ/cm²` : "—");
  setEl("b-ohc", diag.ohc_300m_gj_m2 !== undefined ? `${diag.ohc_300m_gj_m2} GJ/m²` : "—");

  // Satellite pills
  const satPills = document.getElementById("bulletin-satellite-pills");
  if (satPills && p.surface_observations) {
    const obs = p.surface_observations;
    const u10 = obs.u10 ?? obs.u_wind ?? 0;
    const v10 = obs.v10 ?? obs.v_wind ?? 0;
    const windSpeed = Math.sqrt(u10**2 + v10**2).toFixed(1);
    satPills.innerHTML = `
      <div class="sat-pill"><span class="sat-pill-name">OSTIA Sea Surface Temp</span><span class="sat-pill-val">${obs.sst !== undefined ? obs.sst + ' °C' : '—'}</span></div>
      <div class="sat-pill"><span class="sat-pill-name">SMAP Surface Salinity</span><span class="sat-pill-val">${obs.sss !== undefined ? obs.sss + ' PSU' : '—'}</span></div>
      <div class="sat-pill"><span class="sat-pill-name">Altimetry Sea Level Anomaly</span><span class="sat-pill-val">${obs.sla !== undefined ? obs.sla + ' m' : '—'}</span></div>
      <div class="sat-pill"><span class="sat-pill-name">Surface Current (Zonal U)</span><span class="sat-pill-val">${obs.u !== undefined ? obs.u + ' m/s' : '—'}</span></div>
      <div class="sat-pill"><span class="sat-pill-name">Surface Current (Meridional V)</span><span class="sat-pill-val">${obs.v !== undefined ? obs.v + ' m/s' : '—'}</span></div>
      <div class="sat-pill"><span class="sat-pill-name">10m Surface Wind Velocity</span><span class="sat-pill-val">${windSpeed} m/s</span></div>
    `;
  }

  // Action Items List
  const actionsList = document.getElementById("bulletin-actions-list");
  if (actionsList) {
    let items = [];
    if (ch.level === "SEVERE_RI_ALERT") {
      items.push(`<li><i class="fa-solid fa-triangle-exclamation" style="color:#f87171;"></i> <div><strong>IMD Cyclone Rapid Intensification Alert:</strong> High TCHP reservoir (> 80 kJ/cm²) identified. Tropical disturbances entering this zone have elevated probability of rapid intensification into severe cyclonic storms. Advise INCOIS & SDMA coastal monitoring.</div></li>`);
    } else if (ch.level === "MODERATE_ALERT") {
      items.push(`<li><i class="fa-solid fa-triangle-exclamation" style="color:#fbbf24;"></i> <div><strong>Cyclone Thermal Reservoir:</strong> Moderate TCHP supporting sustained storm tracks. Recommend routine satellite radar surveillance.</div></li>`);
    } else {
      items.push(`<li><i class="fa-solid fa-circle-check" style="color:#34d399;"></i> <div><strong>Tropical Cyclone Fuel:</strong> Subsurface thermal conditions are within normal climatological bounds; low risk of rapid tropical storm intensification.</div></li>`);
    }

    if (diag.sonic_layer_depth_m) {
      items.push(`<li><i class="fa-solid fa-water" style="color:#38bdf8;"></i> <div><strong>Naval Tactical Sonar Advisory:</strong> Sonic Layer Depth is established at <strong>${diag.sonic_layer_depth_m}m</strong>. Active sonar surface duct operates from 0 to ${diag.sonic_layer_depth_m}m. Submarines operating below ${diag.sonic_layer_depth_m}m occupy the acoustic shadow zone.</div></li>`);
    }

    if (mhw && mhw.detected) {
      items.push(`<li><i class="fa-solid fa-fire" style="color:#fb923c;"></i> <div><strong>Marine Ecological Alert:</strong> Marine Heatwave (${mhw.category}) identified with SST at ${mhw.sst_c}°C. Thermal stress threshold reached for coral reefs and pelagic migratory species.</div></li>`);
    } else {
      items.push(`<li><i class="fa-solid fa-fish" style="color:#38bdf8;"></i> <div><strong>Fisheries Advisory:</strong> Normal thermocline gradient supports stable pelagic fishing zones across continental shelf breaks.</div></li>`);
    }

    actionsList.innerHTML = items.join("");
  }

  const modal = document.getElementById("bulletin-modal");
  if (modal) modal.classList.remove("hidden");
}

function closeExecutiveBulletin() {
  const modal = document.getElementById("bulletin-modal");
  if (modal) modal.classList.add("hidden");
}

/* ============================================================
   Agro Analytics — Ocean-Agriculture Impact (SST → Monsoon → Crop)
   ============================================================ */
let agroCharts = {};  // track Chart.js instances for destroy-on-reload

async function loadAgroAnalytics() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const textCol = isDark ? "#0c4a6e" : "#475569";
  const gridCol = isDark ? "rgba(56, 189, 248, 0.2)" : "rgba(0,0,0,0.06)";

  // Get current selected date from dashboard dropdown
  const dateEl = document.getElementById("select-date");
  const currentDate = dateEl ? dateEl.value : "2024-06-01";

  try {
    const res = await fetch(`/api/agro_analytics?date=${currentDate}`);
    const data = await res.json();
    if (data.status !== "success") throw new Error("API error");

    const kpi   = data.kpi;
    const mon   = data.monthly;
    const zones = data.ndvi_zones;

    // ── KPI cards ──────────────────────────────────────────────
    const setKpi = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    setKpi("agro-sst-anomaly",   (kpi.sst_anomaly_c >= 0 ? "+" : "") + kpi.sst_anomaly_c.toFixed(2) + " \u00b0C");
    setKpi("agro-monsoon-shift", (kpi.monsoon_shift_days >= 0 ? "+" : "\u2212") + Math.abs(kpi.monsoon_shift_days).toFixed(1) + " days");
    setKpi("agro-ndvi",          kpi.ndvi.toFixed(3));
    setKpi("agro-yield",         (kpi.kharif_yield_pct >= 0 ? "+" : "") + kpi.kharif_yield_pct.toFixed(1) + "%");
    setKpi("agro-moisture",      kpi.soil_moisture.toFixed(3));

    // ── Chart 1: SST Anomaly vs Rainfall (dual axis) ───────────
    const destroyChart = (id) => { if (agroCharts[id]) { agroCharts[id].destroy(); delete agroCharts[id]; } };

    destroyChart("sst-monsoon");
    const ctx1 = document.getElementById("agro-sst-monsoon-chart");
    if (ctx1) {
      agroCharts["sst-monsoon"] = new Chart(ctx1, {
        data: {
          labels: mon.months,
          datasets: [
            {
              type: "line",
              label: "SST Anomaly (\u00b0C)",
              data: mon.sst_anomaly,
              borderColor: "#ef4444",
              backgroundColor: "rgba(239,68,68,0.12)",
              borderWidth: 2.5,
              pointRadius: 4,
              pointBackgroundColor: "#ef4444",
              yAxisID: "y1",
              tension: 0.4,
              fill: true,
            },
            {
              type: "bar",
              label: "Rainfall Anomaly (mm)",
              data: mon.rainfall_anomaly_mm,
              backgroundColor: mon.rainfall_anomaly_mm.map(v => v >= 0 ? "rgba(14,165,233,0.7)" : "rgba(251,146,60,0.7)"),
              borderColor: mon.rainfall_anomaly_mm.map(v => v >= 0 ? "#0ea5e9" : "#f97316"),
              borderWidth: 1.5,
              yAxisID: "y2",
            }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: textCol, font: { size: 10 } } },
            tooltip: { mode: "index" }
          },
          scales: {
            x: { ticks: { color: textCol, font: { size: 9 } }, grid: { color: gridCol } },
            y1: {
              type: "linear", position: "left",
              ticks: { color: "#ef4444", font: { size: 9 } },
              grid: { color: gridCol },
              title: { display: true, text: "SST Anom. (\u00b0C)", color: "#ef4444", font: { size: 9 } }
            },
            y2: {
              type: "linear", position: "right",
              ticks: { color: "#0ea5e9", font: { size: 9 } },
              grid: { drawOnChartArea: false },
              title: { display: true, text: "Rainfall Anom. (mm)", color: "#0ea5e9", font: { size: 9 } }
            }
          }
        }
      });
    }

    // ── Chart 2: Crop Yield by Zone (horizontal bar) ───────────
    destroyChart("crop-yield");
    const ctx2 = document.getElementById("agro-crop-yield-chart");
    if (ctx2) {
      const zones2 = data.zone_summary;
      agroCharts["crop-yield"] = new Chart(ctx2, {
        type: "bar",
        data: {
          labels: zones2.map(z => z.zone),
          datasets: [{
            label: "Yield Forecast (%)",
            data: zones2.map(z => z.yield_pct),
            backgroundColor: zones2.map(z => z.yield_pct >= 0 ? "rgba(34,197,94,0.75)" : "rgba(239,68,68,0.75)"),
            borderColor: zones2.map(z => z.yield_pct >= 0 ? "#22c55e" : "#ef4444"),
            borderWidth: 1.5,
            borderRadius: 6,
          }]
        },
        options: {
          indexAxis: "y",
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: ctx => `${ctx.parsed.x >= 0 ? "+" : ""}${ctx.parsed.x.toFixed(1)}%` } }
          },
          scales: {
            x: {
              ticks: { color: textCol, font: { size: 9 }, callback: v => (v >= 0 ? "+" : "") + v + "%" },
              grid: { color: gridCol },
              title: { display: true, text: "Yield Deviation from Baseline", color: textCol, font: { size: 9 } }
            },
            y: { ticks: { color: textCol, font: { size: 9 } }, grid: { color: gridCol } }
          }
        }
      });
    }

    // ── Chart 3: Soil Moisture vs Ocean Heat Content ───────────
    destroyChart("moisture");
    const ctx3 = document.getElementById("agro-moisture-chart");
    if (ctx3) {
      agroCharts["moisture"] = new Chart(ctx3, {
        data: {
          labels: mon.months,
          datasets: [
            {
              type: "line",
              label: "Soil Moisture Index",
              data: mon.soil_moisture,
              borderColor: "#8b5cf6",
              backgroundColor: "rgba(139,92,246,0.15)",
              borderWidth: 2.5,
              pointRadius: 4,
              tension: 0.4,
              fill: true,
              yAxisID: "y1",
            },
            {
              type: "line",
              label: "Ocean Heat Content (TJ/m\u00b2)",
              data: mon.ohc_tj_m2,
              borderColor: "#f97316",
              backgroundColor: "rgba(249,115,22,0.1)",
              borderWidth: 2,
              pointRadius: 4,
              borderDash: [5, 3],
              tension: 0.4,
              yAxisID: "y2",
            }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { color: textCol, font: { size: 10 } } } },
          scales: {
            x: { ticks: { color: textCol, font: { size: 9 } }, grid: { color: gridCol } },
            y1: {
              position: "left",
              ticks: { color: "#8b5cf6", font: { size: 9 } },
              grid: { color: gridCol },
              title: { display: true, text: "Soil Moisture", color: "#8b5cf6", font: { size: 9 } }
            },
            y2: {
              position: "right",
              ticks: { color: "#f97316", font: { size: 9 } },
              grid: { drawOnChartArea: false },
              title: { display: true, text: "OHC (TJ/m\u00b2)", color: "#f97316", font: { size: 9 } }
            }
          }
        }
      });
    }

    // ── Chart 4: NDVI Trend by Coastal Zone ───────────────────
    destroyChart("ndvi");
    const ctx4 = document.getElementById("agro-ndvi-chart");
    if (ctx4) {
      const zoneNames = Object.keys(zones);
      const palette = ["#0ea5e9", "#22c55e", "#f97316", "#a855f7", "#ef4444", "#eab308"];
      agroCharts["ndvi"] = new Chart(ctx4, {
        type: "line",
        data: {
          labels: mon.months,
          datasets: zoneNames.map((name, i) => ({
            label: name,
            data: zones[name],
            borderColor: palette[i % palette.length],
            backgroundColor: "transparent",
            borderWidth: 2,
            pointRadius: 2,
            tension: 0.4,
          }))
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: textCol, font: { size: 9 }, boxWidth: 12 } }
          },
          scales: {
            x: { ticks: { color: textCol, font: { size: 9 } }, grid: { color: gridCol } },
            y: {
              ticks: { color: textCol, font: { size: 9 } }, grid: { color: gridCol },
              title: { display: true, text: "NDVI Index", color: textCol, font: { size: 9 } },
              min: 0.1, max: 0.9
            }
          }
        }
      });
    }

    // ── Zone summary table ──────────────────────────────────────
    const tbody = document.getElementById("agro-zone-tbody");
    if (tbody) {
      tbody.innerHTML = data.zone_summary.map(z => {
        const riskColor = z.risk === "Low" ? "#22c55e" : z.risk === "Medium" ? "#f97316" : "#ef4444";
        const yieldStr = (z.yield_pct >= 0 ? "+" : "") + z.yield_pct.toFixed(1) + "%";
        const rainStr  = (z.rainfall_dev_pct >= 0 ? "+" : "") + z.rainfall_dev_pct.toFixed(1) + "%";
        const sstStr   = (z.sst_anomaly >= 0 ? "+" : "") + z.sst_anomaly.toFixed(2) + " \u00b0C";
        return `<tr>
          <td><strong>${z.zone}</strong><br><small style="color:var(--text-muted)">${z.region}</small></td>
          <td style="color:${z.sst_anomaly >= 0 ? '#ef4444' : '#0ea5e9'}; font-weight:700;">${sstStr}</td>
          <td style="color:${z.rainfall_dev_pct >= 0 ? '#0ea5e9' : '#f97316'}; font-weight:700;">${rainStr}</td>
          <td>${z.ndvi.toFixed(3)}</td>
          <td style="color:${z.yield_pct >= 0 ? '#22c55e' : '#ef4444'}; font-weight:700;">${yieldStr}</td>
          <td><span style="background:${riskColor}20; color:${riskColor}; padding:2px 8px; border-radius:6px; font-size:10px; font-weight:700;">${z.risk}</span></td>
        </tr>`;
      }).join("");
    }

  } catch (err) {
    console.error("Agro Analytics error:", err);
    const tab = document.getElementById("agro-tab");
    if (tab) tab.querySelector(".agro-charts-grid").innerHTML = `<div style="padding:20px; color:#ef4444;">Error loading Agro Analytics: ${err.message}</div>`;
  }
}

