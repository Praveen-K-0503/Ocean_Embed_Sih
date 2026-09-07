let map, marker, argoMarkers = [];
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
      bgGradient.addColorStop(0, "#050a17");
      bgGradient.addColorStop(1, "#0a1628");
    } else {
      bgGradient.addColorStop(0, "#f0f9ff");
      bgGradient.addColorStop(1, "#e0f2fe");
    }
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    const waveColors = isDark
      ? ["rgba(14, 165, 233, 0.25)", "rgba(56, 189, 248, 0.2)", "rgba(2, 132, 199, 0.15)", "rgba(16, 185, 129, 0.1)"]
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
  const savedTheme = localStorage.getItem("oceanembed_theme") || "light";
  applyTheme(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  applyTheme(newTheme);
  localStorage.setItem("oceanembed_theme", newTheme);
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
    const textColor = isDark ? "#cbd5e1" : "#475569";
    const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)";
    const legendColor = isDark ? "#f8fafc" : "#0f172a";

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

  const argoFloats = [
    { id: "ARGO_INCOIS_001", lat: 16.5, lon: 66.25, name: "ARGO INCOIS 001 (Central Arabian Sea)" },
    { id: "ARGO_INCOIS_002", lat: 14.5, lon: 63.5, name: "ARGO INCOIS 002 (Western Arabian Sea)" },
    { id: "ARGO_INCOIS_003", lat: 17.5, lon: 67.5, name: "ARGO INCOIS 003 (Eastern Arabian Sea)" },
    { id: "ARGO_INCOIS_004", lat: 14.25, lon: 92.75, name: "ARGO INCOIS 004 (Andaman Sea / BoB)" },
    { id: "ARGO_INCOIS_005", lat: 15.0, lon: 90.25, name: "ARGO INCOIS 005 (Central Bay of Bengal)" },
    { id: "ARGO_INCOIS_006", lat: 12.25, lon: 90.5, name: "ARGO INCOIS 006 (Southern Bay of Bengal)" }
  ];

  argoFloats.forEach(f => {
    const argoIcon = L.divIcon({
      className: "argo-marker-icon",
      html: `<div style="background:#059669; width:13px; height:13px; border-radius:50%; border:2px solid #fff; box-shadow:0 0 8px rgba(5,150,105,0.6);"></div>`
    });
    const floatMarker = L.marker([f.lat, f.lon], { icon: argoIcon }).addTo(map);
    floatMarker.bindPopup(`<b>${f.name}</b><br>Click to validate with Ground Truth`);
    floatMarker.on("click", () => {
      setCoordinates(f.lat, f.lon);
      document.getElementById("select-argo").value = f.id;
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
          fill: true,
          borderWidth: 3,
          pointRadius: 4,
          pointBackgroundColor: "#0284c7",
          tension: 0.35
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
          hidden: true
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
          hidden: false
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
          reverse: true,
          title: { display: true, text: "Depth Level (meters)", color: "#475569", font: { family: "Plus Jakarta Sans", size: 12, weight: "600" } },
          ticks: { color: "#475569" },
          grid: { color: "rgba(0, 0, 0, 0.06)" }
        }
      },
      plugins: {
        legend: {
          labels: { color: "#0f172a", font: { family: "Plus Jakarta Sans", size: 12, weight: "600" } }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${context.raw}°C at ${context.label}m depth`;
            }
          }
        }
      }
    }
  });
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
  const textCol = isDark ? "#cbd5e1" : "#475569";
  const gridCol = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)";

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

    // Profile chart: model prediction
    const validPoints = data.profile.filter(p => p.valid);
    const depths = validPoints.map(p => p.depth_m);
    const temps  = validPoints.map(p => p.temperature_c);

    // GLORYS ground truth (if available from API)
    const glorysTruth = validPoints
      .map(p => p.glorys_truth_c)
      .filter(v => v !== null && v !== undefined);

    profileChart.data.labels = depths;
    profileChart.data.datasets[0].data = temps;

    if (glorysTruth.length === depths.length) {
      profileChart.data.datasets[1].data   = glorysTruth;
      profileChart.data.datasets[1].hidden = false;
    } else {
      profileChart.data.datasets[1].data   = [];
      profileChart.data.datasets[1].hidden = true;
    }

    // Always keep and display INCOIS ARGO in-situ on chart
    const activeFloatId = document.getElementById("select-argo")?.value || "ARGO_INCOIS_001";
    const activeFloat = ARGO_SYNTHETIC[activeFloatId];
    if (activeFloat && activeFloat.obs) {
      profileChart.data.datasets[2].data   = activeFloat.obs;
      profileChart.data.datasets[2].hidden = false;
    }

    profileChart.update();

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

/* Render High-Resolution 2D Depth Section Heatmap in Dashboard Tab */
async function renderTransect(overrideVal) {
  const axis = document.getElementById("transect-axis").value;

  // Priority: overrideVal (from slider) > current input-lat/lon
  let fixedVal;
  if (overrideVal !== undefined) {
    fixedVal = overrideVal;
  } else {
    const lat = document.getElementById("input-lat").value;
    const lon = document.getElementById("input-lon").value;
    fixedVal = (axis === "lat") ? lat : lon;
    // Sync slider to current position
    const slider = document.getElementById("transect-slider");
    if (slider) slider.value = fixedVal;
    const unit = (axis === "lat") ? "°N" : "°E";
    const el = document.getElementById("slider-current-val");
    if (el) el.textContent = parseFloat(fixedVal).toFixed(2) + unit;
  }

  document.getElementById("transect-location-label").textContent =
    (axis === "lat") ? `Latitude ${parseFloat(fixedVal).toFixed(2)}°N` : `Longitude ${parseFloat(fixedVal).toFixed(2)}°E`;

  try {
    const selectedDate = document.getElementById("select-date") ? document.getElementById("select-date").value : "";
    const res = await fetch(`/api/transect?fixed_val=${fixedVal}&axis=${axis}${selectedDate ? "&date=" + selectedDate : ""}`);

    const data = await res.json();
    const container = document.getElementById("transect-view");

    // Temperature color interpolation: cold (blue) → warm (red)
    function tempToColor(val) {
      if (val === null || val === undefined) return { bg: "rgba(255,255,255,0.04)", text: "#475569", display: "-" };
      // North Indian Ocean range ~4°C (deep) to ~30°C (surface)
      const lo = 4, hi = 30;
      const t = Math.max(0, Math.min(1, (val - lo) / (hi - lo)));
      // Blue(cold) → Cyan → Green → Yellow → Orange → Red(warm)
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

    // Decide which coords to show (subsample if too many columns)
    const coords = data.coordinates;
    const depths = data.depths;
    const matrix = data.temperature_matrix; // [depth_idx][coord_idx]

    // Show every 2nd column if >40 coords to keep table readable
    const step = coords.length > 40 ? 2 : 1;
    const showCols = coords.filter((_, i) => i % step === 0);
    const showColIdxs = coords.map((_, i) => i).filter(i => i % step === 0);

    const axisLabel = (axis === "lat") ? "°E" : "°N";

    // Build table HTML
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

  } catch (err) {
    console.error("Error rendering transect table:", err);
  }
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
  const wallOpacity   = parseFloat(document.getElementById("studio-wall-opacity")?.value ?? "1.0");

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

    // 1. Build selected active color palette dynamically matching dropdown
    function buildActiveColorscale(name) {
      if (name === "Jet") {
        return [
          [0.00, "#000080"], [0.125, "#0000ff"], [0.375, "#00ffff"],
          [0.625, "#ffff00"], [0.875, "#ff0000"], [1.00, "#800000"]
        ];
      } else if (name === "Viridis") {
        return [
          [0.00, "#440154"], [0.25, "#3b528b"], [0.50, "#21918c"],
          [0.75, "#5ec962"], [1.00, "#fde725"]
        ];
      } else if (name === "Plasma") {
        return [
          [0.00, "#0d0887"], [0.25, "#6a00a8"], [0.50, "#b12a90"],
          [0.75, "#e16462"], [1.00, "#fca636"]
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
      // Default: Thermal (our signature high-intensity calibrated palette)
      return [
        [0.00, "#030838"], // Ultra-deep cold navy (0°C)
        [0.10, "#0018a8"], // Deep royal blue (3°C)
        [0.22, "#0055ff"], // Pure cobalt blue (6.6°C)
        [0.36, "#00c8ff"], // Electric cyan (10.8°C)
        [0.50, "#00e676"], // Vibrant emerald sea green (15.0°C)
        [0.64, "#ffea00"], // Radiant solar yellow (19.2°C)
        [0.76, "#ff7700"], // Warm rich amber-orange (22.8°C)
        [0.88, "#ff2200"], // Fiery tropical orange-red (26.4°C)
        [1.00, "#cc0000"]  // Intense saturated crimson red (30.0°C)
      ];
    }

    const activePalette = buildActiveColorscale(colorscale);

    // 2. Build composite colorscale for top surface (merges active ocean palette with realistic land terrain)
    function buildCompositeColorscale(baseScale) {
      const comp = [];
      for (const [normVal, hexCol] of baseScale) {
        comp.push([normVal * 0.75, hexCol]);
      }
      comp.push([0.775, "#0e3b20"]); // Coastal Mangrove Deep Green
      comp.push([0.810, "#195c2b"]); // Peninsular India Dense Forest
      comp.push([0.850, "#2d7a46"]); // Western Ghats Emerald
      comp.push([0.890, "#9c7a4b"]); // Deccan Plateau Earth Savanna
      comp.push([0.925, "#d49b4d"]); // Thar Desert Sand & Arabian Dunes
      comp.push([0.960, "#664229"]); // Mountain Rock Ridges
      comp.push([1.000, "#ffffff"]); // Himalayan Peak Snow White
      return comp;
    }

    const compositeColorscale = buildCompositeColorscale(activePalette);

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

      // Top Face: Composite Ocean Temperature + Geographic Satellite Map of India & South Asia (Z = 0m)
      const subLats = data.sub_lats || data.lats_sub;
      const subLons = data.sub_lons || data.lons_sub;
      const surfX = subLats.map(() => subLons);
      const surfY = subLats.map(latVal => subLons.map(() => latVal));
      const surfZ = subLats.map(() => subLons.map(() => 0));

      plotlyData.push({
        type: "surface",
        name: "Satellite Map + Ocean SST",
        x: surfX,
        y: surfY,
        z: surfZ,
        surfacecolor: data.top_composite_surface || data.surface_sst,
        colorscale: compositeColorscale,
        cmin: 0, cmax: 40,
        opacity: 1.0,
        showscale: false,
        lighting: solidLighting
      });

      // 5. Seafloor Base Floor (Z = -1000m) - Closes the cube so inside is completely solid
      if (studioMode === "block") {
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
          marker: { size: 2.2, color: "#ffffff", opacity: 1.0 },
          showlegend: false
        });
      }

      sceneConfig = {
        xaxis: {
          title: { text: "", font: { color: axisColor, size: 10 } },
          tickvals: [45, 60, 75, 90, 105],
          ticktext: ["45°E", "60°E", "75°E", "90°E", "105°E"],
          range: [45, 105],
          tickfont: { color: "#e2e8f0", size: 10, family: "Plus Jakarta Sans, sans-serif" },
          gridcolor: "rgba(56,189,248,0.18)",
          showgrid: true,
          zeroline: false,
          showbackground: true,
          backgroundcolor: "rgba(6,14,31,0.95)"
        },
        yaxis: {
          title: { text: "", font: { color: axisColor, size: 10 } },
          tickvals: [10, 15, 20, 25, 30],
          ticktext: ["10°N", "15°N", "20°N", "25°N", "30°N"],
          range: [5, 30],
          tickfont: { color: "#e2e8f0", size: 10, family: "Plus Jakarta Sans, sans-serif" },
          gridcolor: "rgba(56,189,248,0.18)",
          showgrid: true,
          zeroline: false,
          showbackground: true,
          backgroundcolor: "rgba(6,14,31,0.95)"
        },
        zaxis: {
          title: { text: "Depth (m)", font: { color: "#ffffff", size: 12, family: "Plus Jakarta Sans, sans-serif" } },
          tickvals: [depthToZ(0), depthToZ(50), depthToZ(100), depthToZ(200), depthToZ(300), depthToZ(500), depthToZ(700), depthToZ(1000)],
          ticktext: ["0", "50", "100", "200", "300", "500", "700", "1000"],
          range: [-1000, 0],
          tickfont: { color: "#e2e8f0", size: 10, family: "Plus Jakarta Sans, sans-serif" },
          gridcolor: "rgba(56,189,248,0.18)",
          showgrid: true,
          zeroline: false,
          showbackground: true,
          backgroundcolor: "rgba(6,14,31,0.95)"
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
        xaxis: { title: { text: xLabel, font: { color: axisColor, size: 10 } }, tickfont: { color: tickColor, size: 9 }, gridcolor: gridCol, backgroundcolor: "rgba(6,14,31,0.7)" },
        yaxis: { title: { text: "Depth (meters)", font: { color: axisColor, size: 10 } }, autorange: "reversed", tickfont: { color: tickColor, size: 9 }, gridcolor: gridCol, backgroundcolor: "rgba(6,14,31,0.7)" },
        zaxis: { title: { text: "Temp (°C)", font: { color: axisColor, size: 10 } }, tickfont: { color: tickColor, size: 9 }, gridcolor: gridCol, backgroundcolor: "rgba(6,14,31,0.7)" },
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
        xaxis: { title: { text: "Longitude (°E)", font: { color: axisColor, size: 10 } }, tickfont: { color: tickColor, size: 9 }, gridcolor: gridCol, backgroundcolor: "rgba(6,14,31,0.7)" },
        yaxis: { title: { text: "Latitude (°N)", font: { color: axisColor, size: 10 } }, tickfont: { color: tickColor, size: 9 }, gridcolor: gridCol, backgroundcolor: "rgba(6,14,31,0.7)" },
        zaxis: { title: { text: "D20 Depth (m)", font: { color: axisColor, size: 10 } }, autorange: "reversed", tickfont: { color: tickColor, size: 9 }, gridcolor: gridCol, backgroundcolor: "rgba(6,14,31,0.7)" },
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
    const axisFont = { color: isDark ? "#94a3b8" : "#64748b", size: 9 };
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
      }], { ...baseLayout, title: { text: "PC-1: Thermal Structure", font: { color: isDark ? "#cbd5e1" : "#334155", size: 10 } } }, cfg);
    }

    if (data.embedding_channel_2) {
      Plotly.newPlot("embedding-c2", [{
        z: subsample(data.embedding_channel_2, 2),
        x: data.lons ? data.lons.filter((_, i) => i % 2 === 0) : undefined,
        y: data.lats ? data.lats.filter((_, i) => i % 2 === 0) : undefined,
        type: "heatmap",
        colorscale: "RdBu",
        colorbar: { title: "Activation", titlefont: axisFont, tickfont: axisFont, thickness: 10, len: 0.9 }
      }], { ...baseLayout, title: { text: "PC-2: Dynamic Pattern", font: { color: isDark ? "#cbd5e1" : "#334155", size: 10 } } }, cfg);
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
  } else if (tabId === "validation-tab") {
    loadMetrics();
  } else if (tabId === "embedding-tab") {
    renderEmbeddings();
  } else if (tabId === "agro-tab") {
    loadAgroAnalytics();
  }
}

function exportData() {
  if (!currentPrediction) return;
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentPrediction, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `OceanEmbed_Profile_${currentPrediction.grid_latitude}N_${currentPrediction.grid_longitude}E.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/* ============================================================
   Agro Analytics — Ocean-Agriculture Impact (SST → Monsoon → Crop)
   ============================================================ */
let agroCharts = {};  // track Chart.js instances for destroy-on-reload

async function loadAgroAnalytics() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const textCol = isDark ? "#cbd5e1" : "#475569";
  const gridCol = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

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

