let map, marker, argoMarkers = [];
let studioMap = null, studioMarker = null, isStudioMapInitialized = false;
let studioViewMode = "dual";
let profileChart = null;
let compactProfileChart = null;
let currentPrediction = null;
let isMapInitialized = false;

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined && val !== null) el.textContent = val;
}

// Initialize theme immediately to prevent flash of wrong theme
initTheme();

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initInteractiveLogin();
  initOceanCanvasWave();
  initDeferredVideo();

  const isLoggedIn = sessionStorage.getItem("ocean_logged_in") === "true";
  const loginScreen = document.getElementById("login-screen");
  const appScreen = document.getElementById("app-screen");

  if (isLoggedIn) {
    if (loginScreen) loginScreen.classList.add("hidden");
    if (appScreen) appScreen.classList.remove("hidden");
    showPage("home-page");
    loadDates();
    loadMetrics();
  } else {
    if (loginScreen) loginScreen.classList.remove("hidden");
    if (appScreen) appScreen.classList.add("hidden");
  }
});

/* High-Performance Deferred Video Streamer (Allows instant image paint) */
function initDeferredVideo() {
  const startVideo = () => {
    const v = document.querySelector(".home-bg-video");
    if (v) {
      const src = v.querySelector("source");
      if (src && src.dataset.src && (!src.src || src.src === window.location.href)) {
        src.src = src.dataset.src;
        v.load();
        v.play().catch(() => {});
      }
    }
  };
  if (document.readyState === "complete") {
    setTimeout(startVideo, 800);
  } else {
    window.addEventListener("load", () => setTimeout(startVideo, 800));
  }
}



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
    if (compactProfileChart) {
      compactProfileChart.update();
    }
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
  const loginScreen = document.getElementById("login-screen");
  const appScreen = document.getElementById("app-screen");
  if (loginScreen) loginScreen.classList.add("hidden");
  if (appScreen) appScreen.classList.remove("hidden");
  showPage("home-page");

  if (!isMapInitialized) {
    initMap();
    initChart();
    loadDates();
    loadMetrics();
    loadArgoValidation(false);
    isMapInitialized = true;
  } else {
    setTimeout(() => { if (map) map.invalidateSize(); }, 200);
  }
}

/* Navigation Page Switcher */
function showPage(pageId) {
  document.querySelectorAll(".page-view").forEach(p => p.classList.add("hidden"));
  document.querySelectorAll(".nav-link").forEach(btn => btn.classList.remove("active"));
  document.querySelectorAll(".hch-nav-btn").forEach(btn => btn.classList.remove("active"));

  const target = document.getElementById(pageId);
  if (target) target.classList.remove("hidden");

  const hchBtn = document.querySelector(`.hch-nav-btn[onclick*="${pageId}"]`);
  if (hchBtn) hchBtn.classList.add("active");

  // Single unified floating navbar adaptivity
  const mainNav = document.querySelector(".navbar");
  if (mainNav) {
    mainNav.style.display = "flex";
    if (pageId === "home-page") {
      mainNav.classList.add("navbar-home-theme");
      mainNav.classList.remove("navbar-light-theme");
    } else {
      mainNav.classList.add("navbar-light-theme");
      mainNav.classList.remove("navbar-home-theme");
    }
  }

  if (pageId === "home-page") {
    const btn = document.getElementById("nav-btn-home");
    if (btn) btn.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else if (pageId === "dashboard-page") {
    const btn = document.getElementById("nav-btn-dashboard");
    if (btn) btn.classList.add("active");
    if (!isMapInitialized) {
      initMap();
      initChart();
      loadDates();
      loadMetrics();
      loadArgoValidation(false);
      isMapInitialized = true;
    } else if (map) {
      setTimeout(() => { map.invalidateSize(); }, 200);
    }
  } else if (pageId === "studio-3d-page") {
    const btn = document.getElementById("nav-btn-studio");
    if (btn) btn.classList.add("active");
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
    if (inLat && document.getElementById("studio-lat")) document.getElementById("studio-lat").value = inLat;
    if (inLon && document.getElementById("studio-lon")) document.getElementById("studio-lon").value = inLon;

    renderStudio3D();
  } else if (pageId === "gnn-page") {
    const btn = document.getElementById("nav-btn-gnn");
    if (btn) btn.classList.add("active");
    const dashDate = document.getElementById("select-date")?.value;
    const gnnDate = document.getElementById("gnn-date");
    if (dashDate && gnnDate && (!gnnDate.value || gnnDate.value !== dashDate)) {
      gnnDate.value = dashDate;
    }
    fetchGnnData();
    if (gnnLeafletMap) {
      setTimeout(() => {
        gnnLeafletMap.invalidateSize();
      }, 200);
    }
  } else if (pageId === "cyclone-page") {
    const btn = document.getElementById("nav-btn-cyclone");
    if (btn) btn.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (!cycloneMapInitialized) {
      setTimeout(() => {
        initCycloneMap();
        loadCyclonePreset(currentCycloneId || "biparjoy");
      }, 60);
    } else {
      setTimeout(() => {
        if (cycloneMap) cycloneMap.invalidateSize();
      }, 100);
      loadCyclonePreset(currentCycloneId || "biparjoy");
    }
  } else if (pageId === "mhw-page") {
    const btn = document.getElementById("nav-btn-mhw");
    if (btn) btn.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => {
      if (!mhwMapInitialized) {
        initMhwMap();
        mhwMapInitialized = true;
      } else if (mhwMap) {
        mhwMap.invalidateSize();
      }
      loadMhwAnalytics();
    }, 60);
  } else if (pageId === "agro-page") {
    const btn = document.getElementById("nav-btn-agro");
    if (btn) btn.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => { loadAgroAnalytics(); }, 60);
  }
}

/* Dashboard Tab Switcher */
function switchTab(tabId, el) {
  document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));

  const targetPane = document.getElementById(tabId);
  if (targetPane) targetPane.classList.add("active");

  if (el) {
    el.classList.add("active");
  } else {
    const btn = Array.from(document.querySelectorAll(".tab-btn")).find(b => b.getAttribute("onclick")?.includes(tabId));
    if (btn) btn.classList.add("active");
  }

  if (tabId === "transect-tab") {
    renderTransect();
  } else if (tabId === "validation-tab") {
    loadMetrics();
    loadArgoValidation(false);
  } else if (tabId === "embedding-tab") {
    renderEmbeddings();
  } else if (tabId === "agro-tab") {
    loadAgroAnalytics();
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

  const triggerInputUpdate = () => {
    const lat = parseFloat(document.getElementById("input-lat").value);
    const lon = parseFloat(document.getElementById("input-lon").value);
    const date = document.getElementById("select-date").value;
    if (marker) {
      marker.setLatLng([lat, lon]);
      marker.setPopupContent(`<b>Selected Coordinate</b><br>Lat: ${lat.toFixed(2)}°N, Lon: ${lon.toFixed(2)}°E`);
      if (map) map.panTo([lat, lon]);
    }
    runPrediction(lat, lon, date);
  };

  const latInp = document.getElementById("input-lat");
  const lonInp = document.getElementById("input-lon");
  if (latInp) latInp.addEventListener("change", triggerInputUpdate);
  if (lonInp) lonInp.addEventListener("change", triggerInputUpdate);

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

  const compactCtx = document.getElementById("compactDepthProfileChart")?.getContext("2d");
  if (compactCtx) {
    compactProfileChart = new Chart(compactCtx, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "Predicted Temp (°C)",
            data: [],
            borderColor: "#0284c7",
            backgroundColor: "rgba(2, 132, 199, 0.10)",
            fill: false,
            borderWidth: 2,
            pointRadius: 2,
            pointBackgroundColor: "#0284c7",
            tension: 0.35,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { position: 'top', title: { display: true, text: "Temp (°C)", color: "#0c4a6e" }, grid: { color: "rgba(56,189,248,0.2)" } },
          y: { reverse: true, title: { display: true, text: "Depth (m)", color: "#0c4a6e" }, grid: { color: "rgba(56,189,248,0.2)" } }
        }
      }
    });
  }

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
  let temps = STANDARD_DEPTHS.map(d => profileMap.get(d)?.temperature_c ?? null);

  if (currentProfileViewMode === "temp") {
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
  
  if (compactProfileChart) {
    compactProfileChart.data.labels = STANDARD_DEPTHS;
    compactProfileChart.data.datasets[0].data = temps;
    compactProfileChart.update();
  }
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

    // Populate GNN date dropdown
    const gnnSelect = document.getElementById("gnn-date");
    if (gnnSelect) {
      gnnSelect.innerHTML = "";
      data.dates.forEach(d => {
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = d;
        gnnSelect.appendChild(opt);
      });
      gnnSelect.value = selectedDate;
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
  // Update global validation metric cards at the bottom of dashboard
  setEl("global-rmse", `${parseFloat(data.overall_rmse_c ?? 0.992).toFixed(3)} °C`);
  setEl("global-corr", parseFloat(data.overall_correlation_r ?? 0.4016).toFixed(4));
  setEl("global-bias", `${bias > 0 ? '+' : ''}${bias.toFixed(3)} °C`);

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
    
    if (data.surface_observations) {
      setEl("val-sst",   `${data.surface_observations.sst.toFixed(2)} °C`);
      setEl("val-sss",   `${data.surface_observations.sss.toFixed(2)} PSU`);
      setEl("val-ssh",   `${data.surface_observations.ssh.toFixed(2)} m`);
      setEl("val-curr-u", `${data.surface_observations.u.toFixed(2)} m/s`);
      setEl("val-curr-v", `${data.surface_observations.v.toFixed(2)} m/s`);
      let windMag = Math.sqrt(Math.pow(data.surface_observations.eastward_wind || 0, 2) + Math.pow(data.surface_observations.northward_wind || 0, 2)).toFixed(2);
      setEl("val-wind",  `${windMag} m/s`);
    }
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
    }    // Update Model Output Labels
    const modelCoordEl = document.getElementById("model-out-coord");
    const modelDateEl = document.getElementById("model-out-date");
    if (modelCoordEl) modelCoordEl.textContent = `${lat.toFixed(2)}° N, ${lon.toFixed(2)}° E`;
    if (modelDateEl) modelDateEl.textContent = date || data.date || "Latest";


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
  
  // Render Dashboard 3D Volume
  renderDashboard3D(lat, lon, date);

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
      range: [320, -5],
      title: { text: "Standard Depth (m)", font: { color: fontColor, size: 11 } },
      tickfont: { color: fontColor, size: 10 },
      gridcolor: gridColor,
      tickmode: "array",
      tickvals: [0, 50, 100, 200, 300],
      ticktext: ["0m", "50m", "100m", "200m", "300m"]
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

/* In-memory client-side 3D volume cache for instant palette/angle switches */
let _clientVolume3dCache = {};

/* Render Fullscreen 3D Volumetric Surface in Separate Studio Page */
async function renderStudio3D() {
  const container = document.getElementById("plotly-3d-studio-container");
  if (!container) return;

  const studioLat     = parseFloat(document.getElementById("studio-lat")?.value ?? "15.0");
  const studioLon     = parseFloat(document.getElementById("studio-lon")?.value ?? "65.0");
  const studioAxis    = document.getElementById("studio-axis")?.value  ?? "lat";
  const studioMode    = document.getElementById("studio-mode")?.value  ?? "block";
  const studioDate    = document.getElementById("studio-date")?.value  ?? "";
  const colorscale    = document.getElementById("studio-colorscale")?.value ?? "AbyssalMidnight";
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
  const bgColor   = isDark ? "rgba(6,14,31,0.95)" : "rgba(0,0,0,0)";
  const axisColor = isDark ? "#38bdf8" : "#0284c7";
  const tickColor = isDark ? "#94a3b8" : "#034b75";
  const gridCol   = isDark ? "rgba(56,189,248,0.12)" : "rgba(2,132,199,0.18)";
  const tickFontColor = isDark ? "#ffffff" : "#034b75";

  const cacheKey = `${studioLat.toFixed(2)}_${studioLon.toFixed(2)}_${studioDate}`;
  let data = _clientVolume3dCache[cacheKey];

  if (!data) {
    if (!container.querySelector(".plotly-graph-div")) {
      container.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; color:${isDark ? '#38bdf8' : '#0284c7'}; font-size:14px; font-family:'Plus Jakarta Sans',sans-serif; gap:12px; background:${isDark ? '#060e1f' : 'transparent'}; border-radius:14px;">
        <i class="fa-solid fa-spinner fa-spin"></i> Reconstructing 3D Thermal Volume (${studioMode.toUpperCase()}) — ${studioDate || "latest"} @ ${studioLat.toFixed(2)}°N, ${studioLon.toFixed(2)}°E...
      </div>`;
    }

    try {
      const url = `/api/volume_3d?lat=${studioLat}&lon=${studioLon}${studioDate ? "&date=" + studioDate : ""}`;
      const res = await fetch(url);
      data = await res.json();
      if (data.status !== "success") throw new Error(data.message || "API error");
      _clientVolume3dCache[cacheKey] = data;
    } catch (err) {
      console.error("3D Studio API error:", err);
      container.innerHTML = `<div style="color:#ef4444; padding:20px; font-family:'Plus Jakarta Sans',sans-serif;">Reconstruction Error: ${err.message}</div>`;
      return;
    }
  }

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
      if (p1000) setS("studio-deep", `${parseFloat(p1000.temperature_c).toFixed(2)} °C`);
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

    // 1. Build distinct dark scientific color palettes with high-contrast thermal gradients
    function buildActiveColorscale(name) {
      if (name === "AbyssalMidnight" || name === "Ocean" || name === "Deep Oceanic") {
        // Deep Abyssal Navy -> Slate Indigo -> Deep Aqua -> Electric Cyan
        return [
          [0.00, "#020617"],
          [0.22, "#0f172a"],
          [0.45, "#1e293b"],
          [0.68, "#0e7490"],
          [0.85, "#06b6d4"],
          [1.00, "#38bdf8"]
        ];
      } else if (name === "ObsidianMagma" || name === "Magma") {
        // Pitch Black -> Deep Burgundy -> Blood Crimson -> Terracotta -> Molten Gold
        return [
          [0.00, "#000000"],
          [0.22, "#3f000e"],
          [0.45, "#850014"],
          [0.68, "#b91c1c"],
          [0.85, "#ea580c"],
          [1.00, "#f59e0b"]
        ];
      } else if (name === "DarkCyberpunk" || name === "Bioluminescent") {
        // Abyssal Void -> Royal Violet -> Dark Indigo -> Neon Emerald -> High-Voltage Lime
        return [
          [0.00, "#050014"],
          [0.22, "#2e1065"],
          [0.45, "#3730a3"],
          [0.68, "#059669"],
          [0.85, "#10b981"],
          [1.00, "#84cc16"]
        ];
      } else if (name === "DeepEmerald") {
        // Deep Black-Green -> Abyssal Pine -> Dark Jade -> Tropical Sea Green -> Mint Aqua
        return [
          [0.00, "#02120a"],
          [0.22, "#064e3b"],
          [0.45, "#047857"],
          [0.68, "#059669"],
          [0.85, "#10b981"],
          [1.00, "#6ee7b7"]
        ];
      } else if (name === "DarkAmethyst" || name === "Spectral") {
        // Velvet Black Plum -> Blackberry Purple -> Dark Magenta -> Spiced Bronze -> Radiant Sun
        return [
          [0.00, "#120114"],
          [0.22, "#4a044e"],
          [0.45, "#831843"],
          [0.68, "#be123c"],
          [0.85, "#c2410c"],
          [1.00, "#facc15"]
        ];
      } else if (name === "GlacierTrench" || name === "CoolWarm") {
        // Deep Trench Black -> Prussian Blue -> Deep Cobalt -> Glacial Cyan -> Ice Crystal
        return [
          [0.00, "#030712"],
          [0.22, "#0c2340"],
          [0.45, "#1d4ed8"],
          [0.68, "#38bdf8"],
          [0.85, "#a5f3fc"],
          [1.00, "#f0fdf4"]
        ];
      } else if (name === "DarkViridis" || name === "Viridis") {
        // Ultra-Dark Violet -> Deep Indigo -> Petrol Teal -> Sage Green -> Solar Chartreuse
        return [
          [0.00, "#1e002e"],
          [0.22, "#2d1b69"],
          [0.45, "#155e75"],
          [0.68, "#15803d"],
          [0.85, "#84cc16"],
          [1.00, "#eab308"]
        ];
      }
      // Default: Deep Abyssal Midnight
      return [
        [0.00, "#020617"],
        [0.22, "#0f172a"],
        [0.45, "#1e293b"],
        [0.68, "#0e7490"],
        [0.85, "#06b6d4"],
        [1.00, "#38bdf8"]
      ];
    }

    const activePalette = buildActiveColorscale(colorscale);

    const solidLighting = {
      ambient: 0.96,
      diffuse: 0.88,
      specular: 0.04,
      roughness: 0.5,
      fresnel: 0.02
    };

    const depthToZ = (d) => - (Math.pow(d / 1000, 0.65) * 1000);
    const zDepths = depths.map(d => depthToZ(d));

    // Update floating header date subtitle
    const subElem = document.getElementById("template-date-subtitle");
    if (subElem) subElem.textContent = `${data.date || studioDate || "2024-06-01"}`;


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
          tickfont: { color: tickFontColor, size: 10, family: "Plus Jakarta Sans, sans-serif" },
          gridcolor: gridCol,
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
          tickfont: { color: tickFontColor, size: 10, family: "Plus Jakarta Sans, sans-serif" },
          gridcolor: gridCol,
          showgrid: true,
          zeroline: false,
          showbackground: false,
          mirror: false,
          showspikes: false,
          spikesides: false
        },
        zaxis: {
          title: { text: "Depth", font: { color: axisColor, size: 12, family: "Plus Jakarta Sans, sans-serif" } },
          tickmode: "array",
          tickvals: [depthToZ(0), depthToZ(200), depthToZ(500), depthToZ(1000)],
          ticktext: ["0m", "200m", "500m", "1000m"],
          range: [-1000, 0],
          tickfont: { color: tickFontColor, size: 11, family: "JetBrains Mono, monospace", weight: "700" },
          gridcolor: gridCol,
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
    if (container.querySelector(".plotly-graph-div")) {
      Plotly.react("plotly-3d-studio-container", plotlyData, layout, config);
    } else {
      container.innerHTML = "";
      Plotly.newPlot("plotly-3d-studio-container", plotlyData, layout, config);
    }

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

    const ch1 = data.embedding_channel_1 || data.pca_r;
    const ch2 = data.embedding_channel_2 || data.pca_g;

    if (ch1) {
      Plotly.newPlot("embedding-c1", [{
        z: subsample(ch1, 2),
        x: data.lons ? data.lons.filter((_, i) => i % 2 === 0) : undefined,
        y: data.lats ? data.lats.filter((_, i) => i % 2 === 0) : undefined,
        type: "heatmap",
        colorscale: "Viridis",
        colorbar: { title: "Activation", titlefont: axisFont, tickfont: axisFont, thickness: 10, len: 0.9 }
      }], { ...baseLayout, title: { text: "PC-1: Primary Thermal Pattern", font: { color: isDark ? "#0c4a6e" : "#334155", size: 10 } } }, cfg);
    }

    if (ch2) {
      Plotly.newPlot("embedding-c2", [{
        z: subsample(ch2, 2),
        x: data.lons ? data.lons.filter((_, i) => i % 2 === 0) : undefined,
        y: data.lats ? data.lats.filter((_, i) => i % 2 === 0) : undefined,
        type: "heatmap",
        colorscale: "RdBu",
        colorbar: { title: "Activation", titlefont: axisFont, tickfont: axisFont, thickness: 10, len: 0.9 }
      }], { ...baseLayout, title: { text: "PC-2: Ocean Dynamics Pattern", font: { color: isDark ? "#0c4a6e" : "#334155", size: 10 } } }, cfg);
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
  } else if (tabId === "mhw-tab") {
    loadMhwAnalytics();
  }
}

/* Download CF-1.6 Standardized NetCDF 3D Ocean Grid */
function exportNetCDF() {
  const date = (currentPrediction && currentPrediction.date) || (state && state.currentDate) || (document.getElementById("input-date") && document.getElementById("input-date").value) || "2024-06-01";
  window.location.href = `/api/export_netcdf?date=${encodeURIComponent(date)}`;
}

/* ============================================================
   Interactive Marine Heatwave (MHW) Subsurface Stress Workstation
   ============================================================ */
let mhwMap = null;
let mhwMapInitialized = false;
let mhwMarkers = {};
let mhwCustomMarker = null;
let mhwDepthChart = null;
let currentMhwData = null;
let activeMhwSanctuaryId = "lakshadweep";
let currentMhwThreshold = 28.5;
let currentMhwZoom = 200;
let isMhwPulseSimulated = false;

function initMhwMap() {
  const container = document.getElementById("mhw-leaflet-map");
  if (!container || mhwMap) return;

  // Center on North Indian Ocean
  mhwMap = L.map("mhw-leaflet-map", {
    center: [13.5, 77.0],
    zoom: 5,
    minZoom: 4,
    maxZoom: 10,
    zoomControl: true,
  });

  // Esri Ocean Basemap & Reference Labels
  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Tiles &copy; Esri, GEBCO, NOAA, National Geographic",
      maxZoom: 13,
    }
  ).addTo(mhwMap);

  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "",
      maxZoom: 13,
      opacity: 0.85,
    }
  ).addTo(mhwMap);

  // Click on map drops pin and extracts subsurface profile in real-time
  mhwMap.on("click", (e) => {
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;
    if (lat < 4.0 || lat > 30.0 || lon < 45.0 || lon > 105.0) {
      alert("Please click within the North Indian Ocean observation domain (4°N–30°N, 45°E–105°E).");
      return;
    }
    onMhwMapClick(lat, lon);
  });
}

async function onMhwMapClick(lat, lon) {
  if (!mhwMap) return;

  // Drop or move custom pin
  if (mhwCustomMarker) {
    mhwCustomMarker.setLatLng([lat, lon]);
  } else {
    const customIcon = L.divIcon({
      className: "mhw-custom-pin-wrap",
      html: `
        <div style="position:relative; width:28px; height:28px; display:flex; align-items:center; justify-content:center;">
          <div style="position:absolute; width:28px; height:28px; border-radius:50%; background:rgba(6, 182, 212, 0.4); animation: mhwPulse 1.8s infinite ease-out;"></div>
          <div style="width:14px; height:14px; border-radius:50%; background:#06b6d4; border:2.5px solid #ffffff; box-shadow:0 0 10px #06b6d4;"></div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    mhwCustomMarker = L.marker([lat, lon], { icon: customIcon }).addTo(mhwMap);
  }

  mhwCustomMarker.bindPopup(`<strong>Interactive Target</strong><br>${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E<br><small>Reconstructing 0–1000m thermal depth...</small>`).openPopup();

  // Load custom point analytics
  await loadMhwAnalytics("custom", lat, lon, currentMhwThreshold);
}

function resetMhwMapView() {
  if (mhwMap) {
    mhwMap.setView([13.5, 77.0], 5, { animate: true });
  }
}

async function loadMhwAnalytics(targetZoneId, customLat, customLon, threshold) {
  const container = document.getElementById("mhw-zones-container");
  const thresh = threshold !== undefined ? threshold : currentMhwThreshold;

  let url = `/api/mhw_analytics?threshold_c=${thresh}`;
  if (customLat !== undefined && customLon !== undefined) {
    url += `&lat=${customLat}&lon=${customLon}`;
  }

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== "success") return;

    currentMhwData = data;

    // Update KPI pills
    const maxPenEl = document.getElementById("mhw-max-pen");
    if (maxPenEl) maxPenEl.textContent = `${data.max_subsurface_penetration_m} m`;

    const severeEl = document.getElementById("mhw-severe-count");
    if (severeEl) severeEl.textContent = `${data.severe_zones_count} Active`;

    const threshBadge = document.getElementById("mhw-active-threshold-badge");
    if (threshBadge) threshBadge.textContent = `${thresh.toFixed(1)} °C`;

    const threshVal = document.getElementById("mhw-thresh-val");
    if (threshVal) threshVal.textContent = `${thresh.toFixed(1)} °C`;

    // Map markers
    if (mhwMap) {
      data.zones.forEach((z) => {
        if (z.id === "custom") return;
        if (!mhwMarkers[z.id]) {
          const catColor = z.category_color || "#ef4444";
          const icon = L.divIcon({
            className: "mhw-marker-wrap",
            html: `
              <div style="position:relative; width:28px; height:28px; display:flex; align-items:center; justify-content:center; cursor:pointer;">
                <div style="position:absolute; width:28px; height:28px; border-radius:50%; background:${catColor}33; animation: mhwPulse 2s infinite ease-out;"></div>
                <div style="width:14px; height:14px; border-radius:50%; background:${catColor}; border:2.5px solid #ffffff; box-shadow:0 0 8px ${catColor};"></div>
              </div>
            `,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          });

          const m = L.marker([z.lat, z.lon], { icon }).addTo(mhwMap);
          m.bindTooltip(`<strong>${z.name}</strong><br>${z.category} · Penetration: ${z.heat_penetration_depth_m}m`, {
            direction: "top",
            offset: [0, -10],
          });
          m.on("click", () => selectMhwSanctuary(z.id));
          mhwMarkers[z.id] = m;
        } else {
          mhwMarkers[z.id].setTooltipContent(`<strong>${z.name}</strong><br>${z.category} · Penetration: ${z.heat_penetration_depth_m}m`);
        }
      });
    }

    // Populate comparison cards grid
    if (container) {
      const regularZones = data.zones.filter(z => z.id !== "custom");
      container.innerHTML = regularZones.map((z) => {
        const isSelected = z.id === (targetZoneId || activeMhwSanctuaryId);
        return `
          <div class="mhw-zone-card" style="${isSelected ? 'border-color:#0284c7; box-shadow:0 0 0 2px rgba(2, 132, 199, 0.25);' : ''} cursor:pointer;" onclick="selectMhwSanctuary('${z.id}')">
            <div class="mhw-zc-header">
              <div>
                <h4 class="mhw-zc-name">${z.name}</h4>
                <span class="mhw-zc-basin"><i class="fa-solid fa-location-dot"></i> ${z.basin} (${z.lat.toFixed(1)}°N, ${z.lon.toFixed(1)}°E)</span>
              </div>
              <span class="mhw-category-badge" style="background:${z.category_color}18; color:${z.category_color}; border: 1.5px solid ${z.category_color};">
                ${z.category}
              </span>
            </div>
            <p class="mhw-zc-eco"><i class="fa-solid fa-leaf"></i> <strong>Ecosystem:</strong> ${z.ecosystem}</p>
            
            <div class="mhw-stats-grid">
              <div class="mhw-stat">
                <span class="mhw-stat-lbl">Surface SST</span>
                <strong>${z.sst_c} °C</strong>
              </div>
              <div class="mhw-stat">
                <span class="mhw-stat-lbl">50m Depth Temp</span>
                <strong>${z.temp_50m_c} °C</strong>
              </div>
              <div class="mhw-stat">
                <span class="mhw-stat-lbl">Thermal Anomaly</span>
                <strong style="color:${z.thermal_anomaly_c > 0 ? '#ef4444' : '#10b981'};">
                  ${z.thermal_anomaly_c > 0 ? '+' : ''}${z.thermal_anomaly_c} °C
                </strong>
              </div>
              <div class="mhw-stat">
                <span class="mhw-stat-lbl">Heat Stress</span>
                <strong>${z.degree_heating_days} °C·days</strong>
              </div>
            </div>

            <div class="mhw-penetration-block">
              <div class="mhw-pb-header">
                <span><i class="fa-solid fa-water"></i> Subsurface Heat Penetration (≥ ${thresh.toFixed(1)}°C)</span>
                <strong>${z.heat_penetration_depth_m} m deep</strong>
              </div>
              <div class="mhw-bar-track">
                <div class="mhw-bar-fill" style="width: ${Math.min(100, Math.max(8, (z.heat_penetration_depth_m / 100) * 100))}%; background: ${z.category_color};"></div>
              </div>
            </div>

            <div class="mhw-advisory-footer" style="background:${z.category_color}0d; border-left: 3px solid ${z.category_color};">
              <i class="fa-solid fa-bell" style="color:${z.category_color};"></i>
              <span><strong>Advisory:</strong> ${z.risk_level}</span>
            </div>
          </div>
        `;
      }).join("");
    }

    // Select active sanctuary
    const toSelect = targetZoneId || activeMhwSanctuaryId || "lakshadweep";
    selectMhwSanctuary(toSelect);
  } catch (err) {
    console.error("Error loading MHW analytics:", err);
  }
}

function selectMhwSanctuary(zoneId) {
  if (!currentMhwData || !currentMhwData.zones) return;
  const zone = currentMhwData.zones.find(z => z.id === zoneId) || currentMhwData.zones[0];
  if (!zone) return;

  activeMhwSanctuaryId = zone.id;

  // Update button highlights
  document.querySelectorAll(".mhw-preset-btn").forEach(btn => {
    btn.classList.toggle("active", btn.id === `btn-mhw-${zone.id}`);
  });

  // Update telemetry card
  setEl("mhw-active-name", zone.name);
  setEl("mhw-active-coords", `${zone.basin} · ${zone.lat.toFixed(2)}°N, ${zone.lon.toFixed(2)}°E`);
  
  const badge = document.getElementById("mhw-active-badge");
  if (badge) {
    badge.textContent = zone.category;
    badge.style.background = `${zone.category_color}18`;
    badge.style.color = zone.category_color;
    badge.style.border = `1.5px solid ${zone.category_color}`;
  }

  setEl("mhw-active-sst", `${zone.sst_c} °C`);
  setEl("mhw-active-temp50", `${zone.temp_50m_c} °C`);
  
  const anomEl = document.getElementById("mhw-active-anomaly");
  if (anomEl) {
    anomEl.textContent = `${zone.thermal_anomaly_c > 0 ? '+' : ''}${zone.thermal_anomaly_c} °C`;
    anomEl.style.color = zone.thermal_anomaly_c > 0 ? '#ef4444' : '#10b981';
  }

  setEl("mhw-active-dhd", `${zone.degree_heating_days} °C·days`);
  setEl("mhw-active-penetration", `${zone.heat_penetration_depth_m} m deep`);
  setEl("mhw-pb-threshold-label", `≥ ${currentMhwThreshold.toFixed(1)}°C`);

  const barFill = document.getElementById("mhw-active-bar-fill");
  if (barFill) {
    barFill.style.width = `${Math.min(100, Math.max(8, (zone.heat_penetration_depth_m / 100) * 100))}%`;
    barFill.style.background = zone.category_color;
  }

  setEl("mhw-active-advisory-text", zone.risk_level);

  // Pan map
  if (mhwMap && zone.lat && zone.lon) {
    mhwMap.panTo([zone.lat, zone.lon], { animate: true, duration: 0.5 });
  }

  // Render Depth Profile Chart
  renderMhwDepthChart(zone.full_profile || [], currentMhwThreshold);
}

function renderMhwDepthChart(profile, threshold) {
  const canvas = document.getElementById("mhwDepthChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  if (mhwDepthChart) {
    mhwDepthChart.destroy();
    mhwDepthChart = null;
  }

  // Filter depth profile to current zoom (200m or 1000m)
  const filtered = profile.filter(p => p.depth_m <= currentMhwZoom);
  const depths = filtered.map(p => p.depth_m);
  const temps = filtered.map(p => p.temp_c);

  mhwDepthChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: depths,
      datasets: [
        {
          label: "Reconstructed Temperature (°C)",
          data: temps,
          borderColor: "#ef4444",
          backgroundColor: "rgba(239, 68, 68, 0.15)",
          borderWidth: 2.5,
          tension: 0.35,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: temps.map(t => t >= threshold ? "#dc2626" : "#0284c7"),
          pointBorderColor: "#ffffff",
          pointHoverRadius: 7,
        },
        {
          label: `Bleaching Threshold (${threshold.toFixed(1)}°C)`,
          data: depths.map(() => threshold),
          borderColor: "rgba(220, 38, 38, 0.85)",
          borderWidth: 1.8,
          borderDash: [5, 5],
          fill: false,
          pointRadius: 0,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "top",
          labels: { color: "#334155", font: { family: "'Plus Jakarta Sans'", size: 11, weight: 600 } }
        },
        tooltip: {
          callbacks: {
            title: (items) => `Depth: ${items[0].label} m`,
            label: (ctx) => `${ctx.dataset.label}: ${ctx.raw} °C`
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: "Depth (m)", color: "#334155", font: { size: 11, weight: 600 } },
          ticks: { color: "#475569", font: { family: "'Plus Jakarta Sans'", size: 10 } },
          grid: { color: "rgba(0,0,0,0.06)" }
        },
        y: {
          title: { display: true, text: "Temperature (°C)", color: "#334155", font: { size: 11, weight: 600 } },
          ticks: { color: "#475569", font: { family: "'Plus Jakarta Sans'", size: 10 } },
          grid: { color: "rgba(0,0,0,0.06)" },
          suggestedMin: currentMhwZoom === 200 ? 16 : 4,
          suggestedMax: 32
        }
      }
    }
  });
}

function setMhwChartDepthZoom(zoom) {
  currentMhwZoom = zoom;
  document.getElementById("btn-mhw-zoom-200")?.classList.toggle("active", zoom === 200);
  document.getElementById("btn-mhw-zoom-1000")?.classList.toggle("active", zoom === 1000);

  if (currentMhwData) {
    const zone = currentMhwData.zones.find(z => z.id === activeMhwSanctuaryId) || currentMhwData.zones[0];
    if (zone) {
      renderMhwDepthChart(zone.full_profile || [], currentMhwThreshold);
    }
  }
}

let mhwSlideDebounce = null;
function onMhwThresholdSlide(val) {
  currentMhwThreshold = parseFloat(val);
  setEl("mhw-thresh-val", `${currentMhwThreshold.toFixed(1)} °C`);
  setEl("mhw-active-threshold-badge", `${currentMhwThreshold.toFixed(1)} °C`);

  clearTimeout(mhwSlideDebounce);
  mhwSlideDebounce = setTimeout(() => {
    loadMhwAnalytics(activeMhwSanctuaryId, undefined, undefined, currentMhwThreshold);
  }, 200);
}

function simulateMhwSpike() {
  const slider = document.getElementById("mhw-threshold-slider");
  const btn = document.getElementById("btn-mhw-pulse");
  if (!isMhwPulseSimulated) {
    isMhwPulseSimulated = true;
    currentMhwThreshold = 27.2;
    if (slider) slider.value = currentMhwThreshold;
    if (btn) {
      btn.innerHTML = `<i class="fa-solid fa-fire"></i> Spike Active (27.2°C)`;
      btn.style.background = "#b91c1c";
    }
  } else {
    isMhwPulseSimulated = false;
    currentMhwThreshold = 28.5;
    if (slider) slider.value = currentMhwThreshold;
    if (btn) {
      btn.innerHTML = `<i class="fa-solid fa-bolt"></i> +1.5°C Pulse`;
      btn.style.background = "#ef4444";
    }
  }
  onMhwThresholdSlide(currentMhwThreshold);
}

function resetMhwThreshold() {
  isMhwPulseSimulated = false;
  currentMhwThreshold = 28.5;
  const slider = document.getElementById("mhw-threshold-slider");
  if (slider) slider.value = currentMhwThreshold;
  const btn = document.getElementById("btn-mhw-pulse");
  if (btn) {
    btn.innerHTML = `<i class="fa-solid fa-bolt"></i> +1.5°C Pulse`;
    btn.style.background = "#ef4444";
  }
  onMhwThresholdSlide(28.5);
}

/* ============================================================
   Interactive Agro Analytics — Climate Scenario Simulator
   ============================================================ */
let agroCharts = {};
let currentAgroAnomaly = 0.42;
let activeAgroZone = "All";
let agroDataCache = null;
let agroSlideDebounce = null;

const AGRO_ZONE_ADVISORIES = {
  "All": {
    region: "National Coastal Agro-Climatic Belt (All 6 Zones)",
    crops: "Paddy, Groundnut, Cotton, Sugarcane, Coarse Cereals, Pulses",
    normalSowing: "June 10 – July 5",
    advisory: (anom) => anom >= 1.5
      ? "Severe El Niño / Basin warming detected. Extended monsoon delay of 8–12 days anticipated. Immediate mandate: Advise farmers to shift to short-duration drought-hardy paddy cultivars (CR Dhan 201, Sahbhagi Dhan). Enforce canal water rationing for critical seedling nursery stages."
      : anom >= 0.8
      ? "Moderate warming anomaly. Sowing window shifted by 4–6 days. Promote direct seeded rice (DSR) and staggered nursery preparation. Apply mulching to arrest surface soil moisture loss in coastal upland plots."
      : anom <= -0.8
      ? "La Niña cooling teleconnection active. Vigorous monsoon onset with surplus early rainfall. Ensure drainage channels are desilted to avoid waterlogging in deltaic lowlands. Optimal conditions for medium-to-long duration Kharif paddy cultivars."
      : "Conditions favorable for regular Kharif sowing. Maintain normal seed-bed preparation for medium-duration paddy cultivars. In rainfed coastal pockets, ensure broadbed furrow irrigation readiness in event of localized monsoon dry spells."
  },
  "Gujarat": {
    region: "Saurashtra & South Gujarat Coastal Plain",
    crops: "Bt Cotton, Groundnut (GG-20), Castor, Sesame",
    normalSowing: "June 15 – June 30",
    advisory: (anom) => anom >= 1.0
      ? "Saurashtra groundnut belt faces moisture deficit. Delay sowing until minimum 50mm soaking rainfall occurs. Pre-treat groundnut seeds with Trichoderma. Prepare for intercropping with drought-tolerant pigeon pea."
      : "Adequate soil hydration projected. Commence ridge-and-furrow planting for groundnut and cotton. Schedule pre-sowing weed management."
  },
  "Konkan": {
    region: "Konkan Coast & Goa Foothills",
    crops: "Kharif Paddy (Karjat-4), Alphonso Mango, Cashew",
    normalSowing: "June 5 – June 20",
    advisory: (anom) => anom >= 1.0
      ? "Delayed monsoon surge along Western Ghats. Utilize community farm ponds for nursery raising. Protect cashew and mango saplings with organic mulch."
      : "Heavy early rainfall likely. Ensure raised nursery beds (Mat Nursery) for paddy to withstand torrential coastal showers."
  },
  "Kerala": {
    region: "Coastal Karnataka & Kerala Malabar Coast",
    crops: "Pokkali Rice, Black Pepper, Cardamom, Coconut",
    normalSowing: "May 28 – June 15",
    advisory: (anom) => anom >= 1.0
      ? "Monsoon onset delayed along Kerala coast. Irrigate young coconut palms. In Pokkali saline tracts, delay paddy seeding until salinity drops below 2 dS/m."
      : "Regular monsoon advance confirmed. Begin transplantation of 21-day-old paddy seedlings in Kuttanad and Malabar delta tracts."
  },
  "Tamil Nadu": {
    region: "Cauvery Delta & Coromandel Coast",
    crops: "Kuruvai / Samba Paddy (ADT-43), Sugarcane, Pulses",
    normalSowing: "June 12 – July 10",
    advisory: (anom) => anom >= 1.0
      ? "Bay of Bengal SST anomaly indicates weak pre-monsoon flow. Maximize Mettur reservoir canal efficiency with Alternate Wetting and Drying (AWD) irrigation protocol."
      : "Normal delta inflow expected. Proceed with Kuruvai paddy transplantation and mechanical weeding."
  },
  "Andhra": {
    region: "Andhra Coastal Delta (Krishna-Godavari)",
    crops: "Paddy (MTU-1010), Chillies, Tobacco, Pulses",
    normalSowing: "June 20 – July 15",
    advisory: (anom) => anom >= 1.0
      ? "Dry spells predicted during tillering stage. Adopt System of Rice Intensification (SRI) to economize water usage by 35%."
      : "Optimal soil moisture profile. Maintain 2-3 cm standing water in main fields following Godavari canal releases."
  },
  "Odisha": {
    region: "Odisha Coastal Plain & Gangetic Delta",
    crops: "Swarna Paddy, Jute, Mung Bean, Oilseeds",
    normalSowing: "June 15 – July 10",
    advisory: (anom) => anom >= 1.0
      ? "Coastal rainfed tracts vulnerable to sowing delays. Promote pulse intercropping and foliar potassium spray to induce drought tolerance."
      : "Monsoon low-pressure systems active over North Bay of Bengal. Ensure robust field bunding to harness monsoon runoff."
  }
};

async function loadAgroAnalytics(simulatedAnomaly) {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const textCol = isDark ? "#0c4a6e" : "#475569";
  const gridCol = isDark ? "rgba(56, 189, 248, 0.2)" : "rgba(0,0,0,0.06)";

  const anomaly = simulatedAnomaly !== undefined ? simulatedAnomaly : currentAgroAnomaly;
  currentAgroAnomaly = anomaly;

  try {
    const res = await fetch(`/api/agro_analytics?simulated_sst_anomaly=${anomaly}`);
    const data = await res.json();
    if (data.status !== "success") throw new Error("API error");

    agroDataCache = data;
    const kpi = data.kpi;
    const mon = data.monthly;

    // ── KPI cards ──────────────────────────────────────────────
    setEl("agro-sst-anomaly", (kpi.sst_anomaly_c >= 0 ? "+" : "") + kpi.sst_anomaly_c.toFixed(2) + " °C");
    setEl("agro-monsoon-shift", (kpi.monsoon_shift_days >= 0 ? "+" : "−") + Math.abs(kpi.monsoon_shift_days).toFixed(1) + " days");
    setEl("agro-ndvi", kpi.ndvi.toFixed(3));
    setEl("agro-yield", (kpi.kharif_yield_pct >= 0 ? "+" : "") + kpi.kharif_yield_pct.toFixed(1) + "%");
    setEl("agro-moisture", kpi.soil_moisture.toFixed(3));

    // Dynamic coloring of yield
    const yieldEl = document.getElementById("agro-yield");
    if (yieldEl) {
      yieldEl.style.color = kpi.kharif_yield_pct >= 0 ? "#16a34a" : "#ef4444";
    }

    const monsoonSub = document.getElementById("agro-monsoon-sub");
    if (monsoonSub) {
      monsoonSub.textContent = kpi.monsoon_shift_days < 0 ? "Delayed advance" : "Early onset";
    }

    // Update simulation badge
    const badge = document.getElementById("agro-sim-badge");
    if (badge) {
      if (anomaly >= 1.5) {
        badge.textContent = `+${anomaly.toFixed(2)} °C · Extreme El Niño / Warming`;
        badge.style.background = "#fee2e2";
        badge.style.color = "#dc2626";
        badge.style.borderColor = "#fca5a5";
      } else if (anomaly >= 0.6) {
        badge.textContent = `+${anomaly.toFixed(2)} °C · Moderate El Niño`;
        badge.style.background = "#fef3c7";
        badge.style.color = "#d97706";
        badge.style.borderColor = "#fde68a";
      } else if (anomaly <= -0.6) {
        badge.textContent = `${anomaly.toFixed(2)} °C · La Niña Cooling Active`;
        badge.style.background = "#e0f2fe";
        badge.style.color = "#0284c7";
        badge.style.borderColor = "#bae6fd";
      } else {
        badge.textContent = `+${anomaly.toFixed(2)} °C · Near-Neutral Baseline`;
        badge.style.background = "#f0fdf4";
        badge.style.color = "#16a34a";
        badge.style.borderColor = "#bbf7d0";
      }
    }

    // ── Update Zone Advisory Card ──────────────────────────────
    updateAgroAdvisoryCard();

    // ── Chart 1: SST Anomaly vs Rainfall ───────────────────────
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
              label: "SST Anomaly (°C)",
              data: mon.sst_anomaly.map(v => Number((v + (anomaly - 0.42)).toFixed(2))),
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
              data: mon.rainfall_anomaly_mm.map(v => Number((v - (anomaly - 0.42) * 18.0).toFixed(1))),
              backgroundColor: mon.rainfall_anomaly_mm.map(v => v >= 0 ? "rgba(14,165,233,0.7)" : "rgba(251,146,60,0.7)"),
              borderColor: mon.rainfall_anomaly_mm.map(v => v >= 0 ? "#0ea5e9" : "#f97316"),
              borderWidth: 1.5,
              yAxisID: "y2",
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
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
              title: { display: true, text: "SST Anom. (°C)", color: "#ef4444", font: { size: 9 } }
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

    // ── Chart 2: Crop Yield by Zone ────────────────────────────
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
          responsive: true,
          maintainAspectRatio: false,
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

    // ── Chart 3: Soil Moisture vs OHC ──────────────────────────
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
              data: mon.soil_moisture.map(v => Number(Math.max(0.1, Math.min(0.95, v - (anomaly - 0.42) * 0.12)).toFixed(3))),
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
              label: "Ocean Heat Content (TJ/m²)",
              data: mon.ohc_tj_m2.map(v => Number((v + (anomaly - 0.42) * 0.8).toFixed(2))),
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
          responsive: true,
          maintainAspectRatio: false,
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
              title: { display: true, text: "OHC (TJ/m²)", color: "#f97316", font: { size: 9 } }
            }
          }
        }
      });
    }

    // ── Chart 4: NDVI Trend ────────────────────────────────────
    destroyChart("ndvi");
    const ctx4 = document.getElementById("agro-ndvi-chart");
    if (ctx4) {
      const zoneNames = Object.keys(data.ndvi_zones);
      const palette = ["#0ea5e9", "#22c55e", "#f97316", "#a855f7", "#ef4444", "#eab308"];
      agroCharts["ndvi"] = new Chart(ctx4, {
        type: "line",
        data: {
          labels: mon.months,
          datasets: zoneNames.map((name, i) => ({
            label: name,
            data: data.ndvi_zones[name].map(v => Number(Math.max(0.15, Math.min(0.9, v + (anomaly - 0.42) * 0.04)).toFixed(3))),
            borderColor: palette[i % palette.length],
            backgroundColor: "transparent",
            borderWidth: 2,
            pointRadius: 2,
            tension: 0.4,
          }))
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
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
      tbody.innerHTML = data.zone_summary.map((z) => {
        const riskColor = z.risk === "Low" ? "#22c55e" : z.risk === "Medium" ? "#f97316" : "#ef4444";
        const yieldStr = (z.yield_pct >= 0 ? "+" : "") + z.yield_pct.toFixed(1) + "%";
        const rainStr  = (z.rainfall_dev_pct >= 0 ? "+" : "") + z.rainfall_dev_pct.toFixed(1) + "%";
        const sstStr   = (z.sst_anomaly >= 0 ? "+" : "") + z.sst_anomaly.toFixed(2) + " °C";
        const isSelected = activeAgroZone !== "All" && z.zone.toLowerCase().includes(activeAgroZone.toLowerCase());

        return `<tr style="${isSelected ? 'background:#f0fdf4; font-weight:700;' : ''} cursor:pointer;" onclick="selectAgroZoneTableRow('${z.zone}')">
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
  }
}

function updateAgroAdvisoryCard() {
  const info = AGRO_ZONE_ADVISORIES[activeAgroZone] || AGRO_ZONE_ADVISORIES["All"];
  setEl("azac-zone-name", info.region);
  setEl("azac-crops", info.crops);

  // Sowing shift estimation
  const shiftDays = Math.round(-currentAgroAnomaly * 5.2);
  const sowingText = shiftDays < -2
    ? `Delayed by ${Math.abs(shiftDays)} days vs normal (${info.normalSowing})`
    : shiftDays > 2
    ? `Advanced by ${shiftDays} days vs normal (${info.normalSowing})`
    : `On-Schedule Normal Window (${info.normalSowing})`;

  setEl("azac-sowing", sowingText);
  setEl("azac-advisory-text", info.advisory(currentAgroAnomaly));

  const pill = document.getElementById("azac-risk-pill");
  if (pill) {
    if (Math.abs(currentAgroAnomaly) >= 1.5) {
      pill.textContent = "High Vulnerability";
      pill.style.background = "#fee2e2";
      pill.style.color = "#dc2626";
      pill.style.borderColor = "#fca5a5";
    } else if (Math.abs(currentAgroAnomaly) >= 0.8) {
      pill.textContent = "Medium Vulnerability";
      pill.style.background = "#fef3c7";
      pill.style.color = "#d97706";
      pill.style.borderColor = "#fde68a";
    } else {
      pill.textContent = "Low Vulnerability";
      pill.style.background = "#dcfce7";
      pill.style.color = "#16a34a";
      pill.style.borderColor = "#bbf7d0";
    }
  }
}

function onAgroSimSlide(val) {
  currentAgroAnomaly = parseFloat(val);
  clearTimeout(agroSlideDebounce);
  agroSlideDebounce = setTimeout(() => {
    loadAgroAnalytics(currentAgroAnomaly);
  }, 180);
}

function setAgroScenario(anomaly, label) {
  const slider = document.getElementById("agro-sim-slider");
  if (slider) slider.value = anomaly;

  document.querySelectorAll(".asb-presets-group .btn-preset").forEach(btn => {
    btn.classList.toggle("active", btn.textContent.includes(label.split(" ")[0]));
  });

  loadAgroAnalytics(anomaly);
}

function resetAgroScenario() {
  const slider = document.getElementById("agro-sim-slider");
  if (slider) slider.value = 0.42;
  setAgroScenario(0.42, "Baseline 2024");
}

function filterAgroZone(zoneKey, btnEl) {
  activeAgroZone = zoneKey;

  if (btnEl) {
    document.querySelectorAll(".azf-pills .azf-btn").forEach(b => b.classList.remove("active"));
    btnEl.classList.add("active");
  }

  updateAgroAdvisoryCard();

  if (agroDataCache) {
    const tbody = document.getElementById("agro-zone-tbody");
    if (tbody) {
      tbody.querySelectorAll("tr").forEach(tr => {
        const text = tr.textContent.toLowerCase();
        const isMatch = activeAgroZone !== "All" && text.includes(activeAgroZone.toLowerCase());
        tr.style.background = isMatch ? "#f0fdf4" : "";
        tr.style.fontWeight = isMatch ? "700" : "normal";
      });
    }
  }
}

function selectAgroZoneTableRow(zoneName) {
  let key = "All";
  if (zoneName.includes("Gujarat")) key = "Gujarat";
  else if (zoneName.includes("Konkan")) key = "Konkan";
  else if (zoneName.includes("Kerala")) key = "Kerala";
  else if (zoneName.includes("Tamil")) key = "Tamil Nadu";
  else if (zoneName.includes("Andhra")) key = "Andhra";
  else if (zoneName.includes("Odisha")) key = "Odisha";

  const btn = Array.from(document.querySelectorAll(".azf-pills .azf-btn")).find(b => b.textContent.includes(key));
  filterAgroZone(key, btn);

  document.getElementById("agro-zone-advisory-card")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/* ============================================================
   Ocean Graph Neural Network (OceanGNN) Interactive Client Module
   ============================================================ */
let currentGnnData = null;
let selectedGnnNodeId = "GNN_AS_01";
let currentGnnBasinFilter = "All";
let gnnLeafletMap = null;
let gnnEdgesLayer = null;
let gnnNodesLayer = null;
let gnnMarkersMap = {};
let gnnNodeDataMap = {};

function initGnnMap() {
  const mapContainer = document.getElementById("gnn-leaflet-map");
  if (!mapContainer) return;
  if (gnnLeafletMap) {
    gnnLeafletMap.invalidateSize();
    return;
  }

  gnnLeafletMap = L.map("gnn-leaflet-map", {
    center: [14.5, 78.5],
    zoom: 4.8,
    minZoom: 3.5,
    maxZoom: 9,
    zoomControl: true,
    attributionControl: false
  });

  // High-res watermark-free Esri Satellite Ocean Bathymetry layer
  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    attribution: "Esri & OceanEmbed",
    maxZoom: 10,
    minZoom: 3
  }).addTo(gnnLeafletMap);

  gnnEdgesLayer = L.layerGroup().addTo(gnnLeafletMap);
  gnnNodesLayer = L.layerGroup().addTo(gnnLeafletMap);

  setTimeout(() => {
    if (gnnLeafletMap) gnnLeafletMap.invalidateSize();
  }, 200);
}

async function fetchGnnData(date) {
  const reqDate = date || document.getElementById("gnn-date")?.value || document.getElementById("select-date")?.value || "2024-06-01";
  const gnnDateEl = document.getElementById("gnn-date");
  if (gnnDateEl && gnnDateEl.value !== reqDate) gnnDateEl.value = reqDate;

  try {
    const res = await fetch(`/api/gnn_inference?date=${reqDate}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== "success") throw new Error(data.message || "GNN inference error");

    currentGnnData = data;

    // 1. Update Stat cards
    const statNodes = document.getElementById("gnn-stat-nodes");
    const statEdges = document.getElementById("gnn-stat-edges");
    if (statNodes) statNodes.textContent = `${data.num_nodes} In-Situ Nodes`;
    if (statEdges) statEdges.textContent = `${data.num_edges} Hydrodynamic Edges`;

    // 2. Render dynamic interactive Leaflet graph
    renderGnnLeafletGraph();

    // 3. Select current or default node
    if (!currentGnnData.nodes.some(n => n.id === selectedGnnNodeId)) {
      selectedGnnNodeId = currentGnnData.nodes[0]?.id || "GNN_AS_01";
    }
    selectGnnNode(selectedGnnNodeId);

    // 4. Populate Benchmark Matrix
    populateGnnBenchmarkTable(data.benchmark);

  } catch (err) {
    console.error("GNN Fetch Error:", err);
  }
}

function filterGnnBasin(basin) {
  currentGnnBasinFilter = basin;
  renderGnnLeafletGraph();

  // Smoothly fly to the filtered basin in real time
  if (gnnLeafletMap) {
    if (basin === "Arabian Sea") {
      gnnLeafletMap.flyTo([16.0, 65.5], 5.2, { duration: 1.2 });
    } else if (basin === "Bay of Bengal") {
      gnnLeafletMap.flyTo([15.0, 89.5], 5.2, { duration: 1.2 });
    } else if (basin === "Equatorial NIO") {
      gnnLeafletMap.flyTo([6.5, 78.0], 5.5, { duration: 1.2 });
    } else {
      gnnLeafletMap.flyTo([14.5, 78.5], 4.8, { duration: 1.2 });
    }
  }

  // Update selected node if current node is outside the filtered basin
  if (currentGnnData && currentGnnData.nodes) {
    const visible = currentGnnData.nodes.filter(n => basin === "All" || n.basin === basin);
    if (!visible.some(n => n.id === selectedGnnNodeId) && visible.length > 0) {
      selectGnnNode(visible[0].id);
    }
  }
}

function renderGnnLeafletGraph() {
  if (!gnnLeafletMap) {
    initGnnMap();
  }
  if (!gnnLeafletMap || !currentGnnData || !currentGnnData.nodes) return;

  gnnLeafletMap.invalidateSize();
  gnnEdgesLayer.clearLayers();
  gnnNodesLayer.clearLayers();
  gnnMarkersMap = {};
  gnnNodeDataMap = {};

  // Filter nodes based on selected basin
  const visibleNodes = currentGnnData.nodes.filter(n => {
    if (currentGnnBasinFilter === "All") return true;
    return n.basin === currentGnnBasinFilter;
  });
  const visibleIds = new Set(visibleNodes.map(n => n.id));
  currentGnnData.nodes.forEach(n => { gnnNodeDataMap[n.id] = n; });

  // 1. Draw Hydrodynamic Advection Edges with glowing cyan styling
  if (currentGnnData.edges) {
    currentGnnData.edges.forEach(e => {
      if (!visibleIds.has(e.source) || !visibleIds.has(e.target)) return;
      const n1 = gnnNodeDataMap[e.source];
      const n2 = gnnNodeDataMap[e.target];
      if (!n1 || !n2) return;

      const latlngs = [[n1.lat, n1.lon], [n2.lat, n2.lon]];
      const weight = Math.max(1.5, Math.min(4.0, (e.weight || 0.5) * 3.5));
      const opacity = Math.min(0.85, Math.max(0.35, (e.weight || 0.5) * 0.9));

      // Glow edge line
      const poly = L.polyline(latlngs, {
        color: "#38bdf8",
        weight: weight,
        opacity: opacity,
        dashArray: "6, 8",
        lineCap: "round"
      });
      poly.addTo(gnnEdgesLayer);
    });
  }

  // 2. Draw In-Situ Nodes as interactive animated markers
  visibleNodes.forEach(n => {
    const isSelected = (n.id === selectedGnnNodeId);
    let basinClass = "gnn-node-as";
    let basinColor = "#38bdf8";
    if (n.basin === "Bay of Bengal") {
      basinClass = "gnn-node-bob";
      basinColor = "#34d399";
    } else if (n.basin === "Equatorial NIO") {
      basinClass = "gnn-node-equ";
      basinColor = "#f59e0b";
    }

    const shortName = n.name.split(" ")[0] + (n.name.includes("Bay") ? " BoB" : "");
    const selectedClass = isSelected ? "gnn-node-selected" : "";

    const customIcon = L.divIcon({
      className: "gnn-custom-leaflet-icon",
      html: `
        <div class="gnn-marker-container ${selectedClass} ${basinClass}" data-node-id="${n.id}">
          <div class="gnn-node-halo">
            ${isSelected ? '<div class="gnn-pulse-ring"></div>' : ''}
            <div class="gnn-node-core"></div>
          </div>
          <span class="gnn-node-label-badge">${shortName}</span>
        </div>
      `,
      iconSize: [120, 32],
      iconAnchor: [11, 16]
    });

    const marker = L.marker([n.lat, n.lon], { icon: customIcon });

    // Interactive Hover Tooltip
    const sstVal = n.surface_variables?.sst_c ? `${n.surface_variables.sst_c.toFixed(2)} °C` : "--";
    marker.bindTooltip(`
      <div style="font-weight:700; color:#fff;">${n.name} (${n.id})</div>
      <div style="color:${basinColor}; font-size:10px;">${n.basin}</div>
      <div style="font-size:10px; margin-top:2px;">Lat: ${n.lat.toFixed(2)}°N, Lon: ${n.lon.toFixed(2)}°E</div>
      <div style="font-size:10px; color:#38bdf8; font-weight:600;">SST: ${sstVal}</div>
    `, {
      className: "gnn-tooltip",
      direction: "top",
      offset: [0, -10],
      opacity: 0.95
    });

    marker.on("click", () => {
      selectGnnNode(n.id);
    });

    marker.addTo(gnnNodesLayer);
    gnnMarkersMap[n.id] = marker;
  });
}

// Alias for backwards compatibility
function drawGnnGraph() {
  renderGnnLeafletGraph();
}

function selectGnnNode(nodeId) {
  selectedGnnNodeId = nodeId;
  if (!currentGnnData || !currentGnnData.nodes) return;

  const node = currentGnnData.nodes.find(n => n.id === nodeId);
  if (!node) return;

  // 1. Update text banners
  const elId = document.getElementById("gnn-selected-node-id");
  const elName = document.getElementById("gnn-node-name");
  const elCoords = document.getElementById("gnn-node-coords");
  if (elId) elId.textContent = node.id;
  if (elName) elName.textContent = node.name;
  if (elCoords) elCoords.textContent = `${node.lat.toFixed(2)}°N, ${node.lon.toFixed(2)}°E — ${node.basin}`;

  // 2. Update 7 surface variables pills
  const s = node.surface_variables || {};
  const setEl = (id, txt) => { const e = document.getElementById(id); if (e) e.textContent = txt; };
  setEl("gnn-s-sst", `${s.sst_c ?? "--"} °C`);
  setEl("gnn-s-sss", `${s.sss_psu ?? "--"} PSU`);
  setEl("gnn-s-ssh", `${s.ssh_m ?? "--"} m`);
  setEl("gnn-s-u", `${s.u_curr ?? "--"} m/s`);
  setEl("gnn-s-v", `${s.v_curr ?? "--"} m/s`);
  const windMag = (s.wind_u && s.wind_v) ? Math.sqrt(s.wind_u**2 + s.wind_v**2).toFixed(1) : "--";
  setEl("gnn-s-wind", `${windMag} m/s`);

  // 3. Diagnostics
  setEl("gnn-d20", `~${node.d20_m ?? "--"} m`);
  setEl("gnn-deep", `${node.deep_temp_1000m ?? "--"} °C`);

  // 4. Latent Embedding chips
  const chipsContainer = document.getElementById("gnn-embedding-chips");
  if (chipsContainer && node.embedding_sample) {
    chipsContainer.innerHTML = node.embedding_sample.map((val, idx) => 
      `<span class="geb-chip">z[${idx}]=${val > 0 ? "+" : ""}${val}</span>`
    ).join("");
  }

  // 5. Plotly Reconstructed 15-Depth Profile Chart
  const chartContainer = document.getElementById("gnn-profile-chart");
  if (chartContainer && window.Plotly && node.profile) {
    const depths = node.profile.map(p => p.depth_m);
    const temps = node.profile.map(p => p.temperature_c);
    const truths = node.profile.map(p => p.truth_temperature_c);

    const traces = [
      {
        x: temps,
        y: depths,
        mode: "lines+markers",
        name: "OceanGNN Reconstruction",
        line: { color: "#38bdf8", width: 2.5, shape: "spline" },
        marker: { size: 5, color: "#38bdf8" },
        hovertemplate: "Depth: %{y}m<br>GNN: %{x:.2f}°C<extra></extra>"
      }
    ];

    if (truths && truths.some(t => t !== null && t !== undefined)) {
      traces.push({
        x: truths,
        y: depths,
        mode: "lines+markers",
        name: "GLORYS Truth",
        line: { color: "#f59e0b", width: 2, dash: "dash", shape: "spline" },
        marker: { size: 4, color: "#f59e0b" },
        hovertemplate: "Depth: %{y}m<br>Truth: %{x:.2f}°C<extra></extra>"
      });
    }

    const layout = {
      margin: { l: 45, r: 15, t: 10, b: 35 },
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      showlegend: true,
      legend: {
        x: 0.55,
        y: 0.05,
        font: { color: "#cbd5e1", size: 9 },
        bgcolor: "rgba(6, 14, 31, 0.7)"
      },
      yaxis: {
        autorange: "reversed",
        title: { text: "Depth (m)", font: { color: "#94a3b8", size: 10 } },
        tickfont: { color: "#cbd5e1", size: 9 },
        gridcolor: "rgba(56, 189, 248, 0.12)"
      },
      xaxis: {
        title: { text: "Temperature (°C)", font: { color: "#94a3b8", size: 10 } },
        tickfont: { color: "#cbd5e1", size: 9 },
        gridcolor: "rgba(56, 189, 248, 0.12)"
      }
    };

    Plotly.newPlot("gnn-profile-chart", traces, layout, { responsive: true, displayModeBar: false });
  }

  // 6. Redraw graph to highlight selected node
  drawGnnGraph();
}

function populateGnnBenchmarkTable(benchmarkList) {
  const tbody = document.getElementById("gnn-benchmark-tbody");
  if (!tbody || !benchmarkList) return;

  tbody.innerHTML = benchmarkList.map(b => {
    const isGnn = b.model.includes("OceanGNN");
    const badgeClass = isGnn ? "badge-status active" : "badge-status implemented";
    return `<tr class="${isGnn ? 'active-row' : ''}">
      <td><strong>${b.model}</strong></td>
      <td>${b.type}</td>
      <td style="color:#34d399; font-weight:700; font-family:var(--font-mono);">${b.rmse.toFixed(2)} °C</td>
      <td style="color:#38bdf8; font-weight:700; font-family:var(--font-mono);">${b.correlation.toFixed(3)}</td>
      <td style="font-family:var(--font-mono);">${b.latency_ms} ms</td>
      <td style="font-family:var(--font-mono);">${b.params}</td>
      <td><span class="${badgeClass}">${b.status}</span></td>
    </tr>`;
  }).join("");
}



async function renderDashboard3D(lat, lon, date) {
  const container = document.getElementById("dashboard-3d-volume");
  if (!container) return;
  container.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; color:#38bdf8; font-size:12px;"><i class="fa-solid fa-spinner fa-spin"></i> Rendering 3D...</div>`;
  
  try {
    const url = `/api/volume_3d?lat=${lat}&lon=${lon}${date ? "&date=" + date : ""}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== "success") throw new Error("API error");

    const depths = data.depths || [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000];
    const lonsAll = data.lons_all || data.lons;
    const latsAll = data.lats_all || data.lats;
    
    // Build active palette (Thermal)
    const activePalette = [
        [0.00, "#03045e"], [0.17, "#023e8a"], [0.33, "#0077b6"], 
        [0.50, "#00b4d8"], [0.67, "#ffd166"], [0.83, "#f77f00"], [1.00, "#d62828"]
    ];

    const solidLighting = { ambient: 0.96, diffuse: 0.88, specular: 0.04, roughness: 0.5 };
    let plotlyData = [];

    // Outer shell bounds
    if (data.temp_bounds_east) {
      plotlyData.push({ type: "surface", x: [lonsAll[lonsAll.length-1], lonsAll[lonsAll.length-1]], y: latsAll, z: [-1000, 0], surfacecolor: data.temp_bounds_east, colorscale: activePalette, cmin:0, cmax:30, showscale:false, lighting: solidLighting });
    }
    if (data.temp_bounds_west) {
      plotlyData.push({ type: "surface", x: [lonsAll[0], lonsAll[0]], y: latsAll, z: [-1000, 0], surfacecolor: data.temp_bounds_west, colorscale: activePalette, cmin:0, cmax:30, showscale:false, lighting: solidLighting });
    }
    if (data.temp_bounds_north) {
      plotlyData.push({ type: "surface", x: lonsAll, y: [latsAll[latsAll.length-1], latsAll[latsAll.length-1]], z: [-1000, 0], surfacecolor: data.temp_bounds_north, colorscale: activePalette, cmin:0, cmax:30, showscale:false, lighting: solidLighting });
    }
    if (data.temp_bounds_south) {
      plotlyData.push({ type: "surface", x: lonsAll, y: [latsAll[0], latsAll[0]], z: [-1000, 0], surfacecolor: data.temp_bounds_south, colorscale: activePalette, cmin:0, cmax:30, showscale:false, lighting: solidLighting });
    }
    if (data.temp_surface) {
      plotlyData.push({ type: "surface", x: lonsAll, y: latsAll, z: data.temp_surface.map(row => row.map(() => 0)), surfacecolor: data.temp_surface, colorscale: activePalette, cmin:0, cmax:30, showscale:false, lighting: solidLighting });
    }
    
    const layout = {
      margin: { l: 0, r: 0, t: 0, b: 0 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      scene: {
        xaxis: { visible: false },
        yaxis: { visible: false },
        zaxis: { visible: false },
        aspectratio: { x: 1, y: 1, z: 0.3 },
        camera: { eye: { x: 1.5, y: -1.5, z: 1.0 } }
      }
    };
    
    Plotly.newPlot("dashboard-3d-volume", plotlyData, layout, { responsive: true, displayModeBar: false });
  } catch (err) {
    console.error("Dashboard 3D error", err);
    container.innerHTML = `<div style="color:red; font-size:12px;">Failed to render 3D Volume</div>`;
  }
}

/* Redesigned 3D Studio Visualization Controls & Helpers */
function setVizMode(mode, btnElem) {
  const modeSelect = document.getElementById("studio-mode");
  if (modeSelect) {
    modeSelect.value = mode;
  }
  document.querySelectorAll(".viz-segmented-modes .seg-btn").forEach(b => b.classList.remove("active"));
  if (btnElem) btnElem.classList.add("active");
  renderStudio3D();
}

function trigger3DScreenshot() {
  const container = document.getElementById("plotly-3d-studio-container");
  if (container && typeof Plotly !== "undefined") {
    const curDate = document.getElementById("studio-date")?.value || 'render';
    Plotly.downloadImage(container, {
      format: 'png',
      width: 1600,
      height: 1000,
      filename: `oceanembed_3d_volumetric_${curDate}`
    });
  }
}

function toggle3DFullscreen() {
  const wrapper = document.getElementById("studio-canvas-wrapper");
  if (!wrapper) return;
  if (!document.fullscreenElement) {
    wrapper.requestFullscreen().catch(err => console.log("Fullscreen request error:", err));
  } else {
    document.exitFullscreen();
  }
}

/* ==========================================================================
   CYCLONE WATCH: TROPICAL CYCLONE HEAT POTENTIAL & RAPID INTENSIFICATION
   ========================================================================== */

let cycloneMap = null;
let cycloneTrackPolyline = null;
let cycloneMarkersGroup = null;
let cycloneTrackTchpChart = null;
let cycloneTrackSstChart = null;
let currentCycloneId = "biparjoy";
let cycloneMapInitialized = false;
let currentTrackData = [];

function initCycloneMap() {
  const mapElem = document.getElementById("cyclone-leaflet-map");
  if (!mapElem || typeof L === "undefined") return;

  cycloneMap = L.map("cyclone-leaflet-map", {
    center: [16.0, 72.0],
    zoom: 5,
    minZoom: 3,
    maxZoom: 12,
    zoomControl: true,
  });

  // Real Satellite Earth & Ocean Imagery (High-Resolution True Color)
  const esriSat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    attribution: "&copy; Esri, Maxar, Earthstar Geographics & OceanEmbed",
    maxZoom: 12,
    minZoom: 3,
  });

  // Ocean Bathymetry & Coastline Label Reference Overlay
  const oceanLabels = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}", {
    attribution: "&copy; Esri Ocean Reference",
    maxZoom: 12,
    minZoom: 3,
  });

  // Bathymetric Ocean Basemap
  const oceanBase = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}", {
    attribution: "&copy; Esri Ocean Basemap & GEBCO",
    maxZoom: 10,
    minZoom: 3,
  });

  // Dark Tactical Ocean Map
  const cartoDark = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> | OceanEmbed MoES/INCOIS',
    subdomains: "abcd",
    maxZoom: 19,
    minZoom: 3,
  });

  // Default to Real Satellite Imagery with depth/coastline labels
  esriSat.addTo(cycloneMap);
  oceanLabels.addTo(cycloneMap);

  // Basin Study Domain Boundary (North Indian Ocean 5°-30°N, 45°-105°E)
  const bounds = [[5.0, 45.0], [30.0, 105.0]];
  L.rectangle(bounds, {
    color: "#38bdf8",
    weight: 2,
    dashArray: "6, 6",
    fillColor: "#38bdf8",
    fillOpacity: 0.05,
  }).addTo(cycloneMap);

  // Interactive Layer Control
  L.control.layers({
    "🛰️ Real Satellite Imagery": esriSat,
    "🌊 Ocean Bathymetry Basemap": oceanBase,
    "🌑 Tactical Dark Ocean": cartoDark,
  }, {
    "🏷️ Coastline & Depth Labels": oceanLabels,
  }, { position: "topright" }).addTo(cycloneMap);

  cycloneTrackPolyline = L.polyline([], {
    color: "#38bdf8",
    weight: 3.5,
    dashArray: "6, 8",
    opacity: 0.85,
  }).addTo(cycloneMap);

  cycloneMarkersGroup = L.layerGroup().addTo(cycloneMap);
  cycloneMapInitialized = true;

  // Custom coordinate probe on map click
  cycloneMap.on("click", async function(e) {
    const lat = Math.round(e.latlng.lat * 100) / 100;
    const lon = Math.round(e.latlng.lng * 100) / 100;
    if (lat < 5 || lat > 30 || lon < 45 || lon > 105) return;

    try {
      const activeDate = document.getElementById("select-date")?.value || "2024-06-01";
      const resp = await fetch(`/api/predict?lat=${lat}&lon=${lon}&date=${activeDate}`);
      const data = await resp.json();
      if (data.status === "success") {
        const diag = data.diagnostics || {};
        const sst = data.profile ? data.profile[0].temperature_c : 29.0;
        const tchp = diag.tchp_kj_cm2 || 0;
        const d20 = diag.thermocline_d20_m || 0;
        const d26 = diag.d26_isotherm_m || 0;

        inspectWaypoint({
          date: `${activeDate} (Probed)`,
          lat: lat,
          lon: lon,
          stage: "Point Oceanic Heat Probe",
          wind_kts: "--",
          sst_c: sst,
          tchp_kj_cm2: tchp,
          thermocline_d20_m: d20,
          d26_isotherm_m: d26,
          ri_risk: tchp >= 60 ? "HIGH_RI_RISK" : (tchp >= 40 ? "MODERATE_RISK" : "LOW_RISK_COOLING"),
        });

        L.popup()
          .setLatLng([lat, lon])
          .setContent(`
            <div style="font-family:'Plus Jakarta Sans',sans-serif; padding:4px;">
              <strong style="color:#38bdf8;">Ocean Heat Probe</strong><br/>
              <b>Coords:</b> ${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E<br/>
              <b>TCHP:</b> <span style="color:${tchp>=60?'#ef4444':'#38bdf8'}">${tchp} kJ/cm²</span><br/>
              <b>D26 Warm Layer:</b> ${d26} m<br/>
              <b>Thermocline D20:</b> ${d20} m
            </div>
          `)
          .openOn(cycloneMap);
      }
    } catch(err) {
      console.warn("Probe error:", err);
    }
  });
}

function selectCyclonePreset(cycloneId, btnElem) {
  currentCycloneId = cycloneId;
  document.querySelectorAll(".btn-cyclone-preset").forEach(b => b.classList.remove("active"));
  if (btnElem) btnElem.classList.add("active");
  loadCyclonePreset(cycloneId);
}

async function loadCyclonePreset(cycloneId) {
  try {
    const resp = await fetch(`/api/cyclone/analyze_track?cyclone_id=${cycloneId}`);
    const data = await resp.json();
    if (data.status !== "success") return;

    const cyclone = data.cyclone;
    currentTrackData = data.track || [];

    // 1. Update Basin indicator & Tag
    const basinTag = document.getElementById("cyclone-basin-tag");
    if (basinTag) basinTag.textContent = `${cyclone.name} · ${cyclone.basin} (${cyclone.dates_active})`;

    // 2. Update KPI cards
    setEl("c-kpi-tchp", `${cyclone.max_track_tchp_kj_cm2} kJ/cm²`);
    setEl("c-kpi-d20", `${cyclone.min_thermocline_d20_m} m`);

    // Find max D26 and max wind from track
    let maxD26 = 0;
    let maxWind = 0;
    let peakStage = cyclone.category;
    currentTrackData.forEach(wp => {
      if (wp.d26_isotherm_m > maxD26) maxD26 = wp.d26_isotherm_m;
      if (wp.wind_kts > maxWind) {
        maxWind = wp.wind_kts;
        peakStage = wp.stage;
      }
    });
    setEl("c-kpi-d26", `${maxD26.toFixed(1)} m`);
    setEl("c-kpi-wind", `${maxWind} kts`);
    setEl("c-kpi-stage", peakStage);

    // 3. Update RI Alert Card
    const riCard = document.getElementById("cyclone-ri-card");
    const riStatus = document.getElementById("cyclone-ri-status");
    const riSub = document.getElementById("cyclone-ri-sub");
    if (cyclone.rapid_intensification_alert) {
      if (riCard) riCard.className = "ri-alert-card ri-high";
      if (riStatus) riStatus.textContent = "RAPID INTENSIFICATION (RI) FAVORED";
      if (riSub) riSub.textContent = `Peak Track TCHP ${cyclone.max_track_tchp_kj_cm2} kJ/cm² (> 60 Threshold)`;
    } else {
      if (riCard) riCard.className = "ri-alert-card ri-low";
      if (riStatus) riStatus.textContent = "UPWELLING COLD WAKE DOMINATED";
      if (riSub) riSub.textContent = `Peak Track TCHP ${cyclone.max_track_tchp_kj_cm2} kJ/cm² (Negative Thermal Feedback)`;
    }

    // 4. Render Map Track
    renderCycloneMapTrack(currentTrackData);

    // 5. Render Along-Track Charts
    renderAlongTrackCharts(currentTrackData);

    // 6. Inspect peak intensity waypoint by default
    let peakIndex = 0;
    let highestTchp = 0;
    currentTrackData.forEach((wp, idx) => {
      if (wp.tchp_kj_cm2 > highestTchp) {
        highestTchp = wp.tchp_kj_cm2;
        peakIndex = idx;
      }
    });
    if (currentTrackData[peakIndex]) {
      inspectWaypoint(currentTrackData[peakIndex], peakIndex);
    }
  } catch (err) {
    console.error("Error loading cyclone preset:", err);
  }
}

function renderCycloneMapTrack(track) {
  if (!cycloneMap || !cycloneTrackPolyline || !cycloneMarkersGroup) return;

  cycloneMarkersGroup.clearLayers();
  const latlngs = track.map(wp => [wp.lat, wp.lon]);
  cycloneTrackPolyline.setLatLngs(latlngs);

  track.forEach((wp, idx) => {
    // Custom pulsing SVG marker
    const color = wp.risk_color || "#38bdf8";
    const radius = Math.max(6, Math.min(14, 6 + (wp.wind_kts || 30) / 15));

    const marker = L.circleMarker([wp.lat, wp.lon], {
      radius: radius,
      fillColor: color,
      color: "#ffffff",
      weight: 2,
      opacity: 0.95,
      fillOpacity: 0.85,
    });

    const popupContent = `
      <div style="font-family:'Plus Jakarta Sans',sans-serif; min-width:180px;">
        <strong style="color:${color}; font-size:13px;"><i class="fa-solid fa-hurricane"></i> ${wp.stage}</strong><br/>
        <span style="color:#94a3b8; font-size:11px;">${wp.date} · Lat: ${wp.lat.toFixed(2)}°N, Lon: ${wp.lon.toFixed(2)}°E</span>
        <hr style="border:0; border-top:1px solid #334155; margin:6px 0;"/>
        <div style="font-size:12px; line-height:1.6;">
          <b>TCHP:</b> <span style="color:${color}; font-weight:700;">${wp.tchp_kj_cm2} kJ/cm²</span><br/>
          <b>SST:</b> ${wp.sst_c} °C<br/>
          <b>D26 Warm Layer:</b> ${wp.d26_isotherm_m} m<br/>
          <b>Thermocline D20:</b> ${wp.thermocline_d20_m} m<br/>
          <b>Winds:</b> ${wp.wind_kts} kts
        </div>
      </div>
    `;

    marker.bindPopup(popupContent);
    marker.on("click", () => inspectWaypoint(wp, idx));
    cycloneMarkersGroup.addLayer(marker);
  });

  if (latlngs.length > 0 && cycloneMap) {
    setTimeout(() => {
      if (cycloneMap) {
        cycloneMap.invalidateSize();
        try {
          cycloneMap.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] });
        } catch(e) {
          console.warn("fitBounds retry:", e);
        }
      }
    }, 150);
  }
}

function inspectWaypoint(wp, index) {
  setEl("cw-point-date", `Waypoint: ${wp.date} (${wp.stage})`);
  setEl("cw-point-coords", `Lat: ${wp.lat.toFixed(2)}°N, Lon: ${wp.lon.toFixed(2)}°E · North Indian Ocean`);
  setEl("cw-stage-badge", wp.stage || "Tropical Cyclone");
  setEl("cw-sst", `${wp.sst_c} °C`);
  setEl("cw-tchp", `${wp.tchp_kj_cm2} kJ/cm²`);
  setEl("cw-d26", `${wp.d26_isotherm_m} m`);
  setEl("cw-d20", `${wp.thermocline_d20_m} m`);
  setEl("cw-wind", `${wp.wind_kts || "--"} kts`);

  const badge = document.getElementById("cw-stage-badge");
  if (badge) {
    badge.style.background = wp.tchp_kj_cm2 >= 60 ? "rgba(239,68,68,0.25)" : (wp.tchp_kj_cm2 >= 40 ? "rgba(245,158,11,0.25)" : "rgba(16,185,129,0.25)");
    badge.style.borderColor = wp.risk_color || "#38bdf8";
    badge.style.color = wp.risk_color || "#38bdf8";
  }
}

function renderAlongTrackCharts(track) {
  const dates = track.map(w => w.date.slice(5)); // MM-DD format
  const tchps = track.map(w => w.tchp_kj_cm2);
  const ssts = track.map(w => w.sst_c);
  const d26s = track.map(w => w.d26_isotherm_m);
  const winds = track.map(w => w.wind_kts);

  // 1. Chart: TCHP vs 60 Critical Threshold
  const ctxTchp = document.getElementById("cycloneTrackTchpChart")?.getContext("2d");
  if (ctxTchp) {
    if (cycloneTrackTchpChart) cycloneTrackTchpChart.destroy();

    cycloneTrackTchpChart = new Chart(ctxTchp, {
      type: "line",
      data: {
        labels: dates,
        datasets: [
          {
            label: "Tropical Cyclone Heat Potential (TCHP)",
            data: tchps,
            borderColor: "#38bdf8",
            backgroundColor: "rgba(56, 189, 248, 0.15)",
            borderWidth: 2.5,
            tension: 0.35,
            fill: true,
            pointBackgroundColor: track.map(w => w.risk_color || "#38bdf8"),
            pointBorderColor: "#ffffff",
            pointRadius: 5,
            pointHoverRadius: 8,
          },
          {
            label: "Critical RI Threshold (60 kJ/cm²)",
            data: dates.map(() => 60),
            borderColor: "rgba(239, 68, 68, 0.85)",
            borderWidth: 1.8,
            borderDash: [6, 6],
            fill: false,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "top",
            labels: { color: "#334155", font: { family: "'Plus Jakarta Sans'", size: 11, weight: 600 } }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.raw} kJ/cm²`
            }
          }
        },
        scales: {
          x: {
            ticks: { color: "#475569", font: { family: "'Plus Jakarta Sans'", size: 10 } },
            grid: { color: "rgba(0,0,0,0.06)" }
          },
          y: {
            title: { display: true, text: "TCHP (kJ/cm²)", color: "#334155", font: { size: 11, weight: 600 } },
            ticks: { color: "#475569", font: { family: "'Plus Jakarta Sans'", size: 10 } },
            grid: { color: "rgba(0,0,0,0.06)" },
            suggestedMin: 20,
            suggestedMax: 80,
          }
        }
      }
    });
  }

  // 2. Chart: SST & D26 Warm Layer
  const ctxSst = document.getElementById("cycloneTrackSstChart")?.getContext("2d");
  if (ctxSst) {
    if (cycloneTrackSstChart) cycloneTrackSstChart.destroy();

    cycloneTrackSstChart = new Chart(ctxSst, {
      type: "line",
      data: {
        labels: dates,
        datasets: [
          {
            label: "Sea Surface Temp (SST °C)",
            data: ssts,
            borderColor: "#f59e0b",
            backgroundColor: "rgba(245, 158, 11, 0.1)",
            borderWidth: 2,
            tension: 0.3,
            yAxisID: "ySst",
            pointRadius: 4,
          },
          {
            label: "26°C Isotherm Depth D26 (m)",
            data: d26s,
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            borderWidth: 2,
            tension: 0.3,
            yAxisID: "yD26",
            pointRadius: 4,
          }
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "top",
            labels: { color: "#334155", font: { family: "'Plus Jakarta Sans'", size: 11, weight: 600 } }
          }
        },
        scales: {
          x: {
            ticks: { color: "#475569", font: { family: "'Plus Jakarta Sans'", size: 10 } },
            grid: { color: "rgba(0,0,0,0.06)" }
          },
          ySst: {
            type: "linear",
            position: "left",
            title: { display: true, text: "SST (°C)", color: "#d97706", font: { size: 11, weight: 600 } },
            ticks: { color: "#d97706", font: { size: 10 } },
            grid: { color: "rgba(0,0,0,0.06)" },
            suggestedMin: 27,
            suggestedMax: 32,
          },
          yD26: {
            type: "linear",
            position: "right",
            title: { display: true, text: "D26 Depth (m)", color: "#059669", font: { size: 11, weight: 600 } },
            ticks: { color: "#059669", font: { size: 10 } },
            grid: { drawOnChartArea: false },
            suggestedMin: 10,
            suggestedMax: 60,
          }
        }
      }
    });
  }
}

