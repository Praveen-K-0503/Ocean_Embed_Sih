import re

with open("app/static/app.js", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add compactProfileChart variable
content = re.sub(
    r'(let profileChart = null;)',
    r'\1\nlet compactProfileChart = null;',
    content
)

# 2. Add compactProfileChart initialization inside initChart()
init_chart_addition = """
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
"""
content = re.sub(
    r'(profileChart = new Chart\(ctx, \{[\s\S]*?\}\);)',
    r'\1\n' + init_chart_addition,
    content
)

# 3. Add compactProfileChart update logic in updateProfileChartData()
update_chart_addition = """
  if (compactProfileChart) {
    compactProfileChart.data.labels = STANDARD_DEPTHS;
    compactProfileChart.data.datasets[0].data = temps;
    compactProfileChart.update();
  }
"""
content = re.sub(
    r'(profileChart\.update\(\);\s*\n\s*\})',
    update_chart_addition + r'\1',
    content
)

# 4. Replace val-uv and val-wind with the new 6-card fields
obs_replacement = """
    setEl("val-sst",   `${data.surface_sst_c} °C`);
    setEl("val-sss",   `${data.surface_sss_psu} PSU`);
    setEl("val-ssh",   `${data.surface_ssh_m} m`);
    setEl("val-curr-u", `${data.surface_u_ms} m/s`);
    setEl("val-curr-v", `${data.surface_v_ms} m/s`);
    let windMag = Math.sqrt(Math.pow(data.surface_u_wind_ms||0, 2) + Math.pow(data.surface_v_wind_ms||0, 2)).toFixed(2);
    setEl("val-wind",  `${windMag} m/s`);
"""

content = re.sub(
    r'setEl\("val-sst"[\s\S]*?setEl\("val-depth"[^\n]*\n',
    obs_replacement,
    content
)

with open("app/static/app.js", "w", encoding="utf-8") as f:
    f.write(content)

print("app.js updated.")
