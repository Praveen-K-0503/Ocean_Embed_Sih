import re

with open("app/static/app.js", "r", encoding="utf-8") as f:
    js_content = f.read()

# 1. FIX DATA BINDING for Key Surface Observations
old_data_binding = """    setEl("val-sst",   `${data.surface_sst_c} °C`);
    setEl("val-sss",   `${data.surface_sss_psu} PSU`);
    setEl("val-ssh",   `${data.surface_ssh_m} m`);
    setEl("val-curr-u", `${data.surface_u_ms} m/s`);
    setEl("val-curr-v", `${data.surface_v_ms} m/s`);
    let windMag = Math.sqrt(Math.pow(data.surface_u_wind_ms||0, 2) + Math.pow(data.surface_v_wind_ms||0, 2)).toFixed(2);
    setEl("val-wind",  `${windMag} m/s`);"""

new_data_binding = """    if (data.surface_observations) {
      setEl("val-sst",   `${data.surface_observations.sst.toFixed(2)} °C`);
      setEl("val-sss",   `${data.surface_observations.sss.toFixed(2)} PSU`);
      setEl("val-ssh",   `${data.surface_observations.ssh.toFixed(2)} m`);
      setEl("val-curr-u", `${data.surface_observations.u.toFixed(2)} m/s`);
      setEl("val-curr-v", `${data.surface_observations.v.toFixed(2)} m/s`);
      let windMag = Math.sqrt(Math.pow(data.surface_observations.eastward_wind || 0, 2) + Math.pow(data.surface_observations.northward_wind || 0, 2)).toFixed(2);
      setEl("val-wind",  `${windMag} m/s`);
    }"""

js_content = js_content.replace(old_data_binding, new_data_binding)

# 2. Add renderDashboard3D() to app.js
dashboard_3d_func = """
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
"""

js_content += "\n" + dashboard_3d_func

# 3. Call renderDashboard3D in runPrediction
run_prediction_update = """  } catch (err) {
    console.error("Error predicting profile:", err);
  }
  
  // Render Dashboard 3D Volume
  renderDashboard3D(lat, lon, date);
"""
js_content = js_content.replace("""  } catch (err) {
    console.error("Error predicting profile:", err);
  }
}""", run_prediction_update + "\n}")

with open("app/static/app.js", "w", encoding="utf-8") as f:
    f.write(js_content)


# --- 4. FIX STYLES.CSS ---
with open("app/static/styles.css", "r", encoding="utf-8") as f:
    css_content = f.read()

# Make Validation Metrics horizontal, limit model card height
css_additions = """
/* Corrections for Redesign */
.validation-metrics-body {
  display: flex !important;
  flex-direction: row !important;
  justify-content: space-between !important;
  align-items: stretch !important;
  gap: 12px;
  padding: 16px !important;
}

.validation-metrics-body .metric-block {
  flex: 1;
  margin-bottom: 0 !important;
  padding: 12px 16px !important;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
}

.model-output-body {
  display: flex !important;
  flex-direction: row !important;
  gap: 16px !important;
  padding: 16px !important;
  height: 250px !important;
}

.model-info-grid {
  flex: 0 0 45% !important;
  margin-bottom: 0 !important;
  align-content: start;
}

.model-volume-viz {
  flex: 1 !important;
  border-radius: 8px;
  overflow: hidden;
  background: #0f172a;
  position: relative;
}

#dashboard-3d-volume {
  width: 100%;
  height: 100%;
}

.surface-obs-grid {
  gap: 8px !important;
}
.obs-card {
  padding: 8px 12px !important;
}
.obs-value {
  margin-bottom: 4px !important;
  font-size: 16px !important;
}
.obs-icon {
  font-size: 12px !important;
}
.obs-title {
  font-size: 11px !important;
}

.main-top-row .flex-65 { flex: 0 0 calc(65% - 10px) !important; max-width: calc(65% - 10px); }
.main-top-row .flex-35 { flex: 0 0 calc(35% - 10px) !important; max-width: calc(35% - 10px); }

.main-bottom-row .flex-60 { flex: 0 0 calc(60% - 10px) !important; max-width: calc(60% - 10px); }
.main-bottom-row .flex-40 { flex: 0 0 calc(40% - 10px) !important; max-width: calc(40% - 10px); }

.compact-profile-body {
  height: 400px !important;
}
.map-container {
  height: 400px !important;
}

/* Ensure tabs are constrained and clean */
.tab-pane {
  min-height: 400px;
}
"""
css_content += "\n" + css_additions

with open("app/static/styles.css", "w", encoding="utf-8") as f:
    f.write(css_content)

print("Execution complete.")
