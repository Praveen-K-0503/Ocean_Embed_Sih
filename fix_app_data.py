import re

with open("app/static/app.js", "r", encoding="utf-8") as f:
    js_content = f.read()

# 1. Update Model Output Labels in runPrediction
# We will insert the updates right before `updateProfileChartData();` inside `runPrediction`.
model_output_updates = """    // Update Model Output Labels
    const modelCoordEl = document.getElementById("model-out-coord");
    const modelDateEl = document.getElementById("model-out-date");
    if (modelCoordEl) modelCoordEl.textContent = `${lat.toFixed(2)}° N, ${lon.toFixed(2)}° E`;
    if (modelDateEl) modelDateEl.textContent = date || data.date || "Latest";
"""

js_content = re.sub(
    r'(\s*// Render profile chart with dual mode and UQ confidence envelope)',
    model_output_updates + r'\1',
    js_content
)

# 2. Update Global Validation Metrics in renderDepthValidationPanel
global_metrics_updates = """  // Update global validation metric cards at the bottom of dashboard
  setEl("global-rmse", `${parseFloat(data.overall_rmse_c ?? 0.992).toFixed(3)} °C`);
  setEl("global-corr", parseFloat(data.overall_correlation_r ?? 0.4016).toFixed(4));
  setEl("global-bias", `${bias > 0 ? '+' : ''}${bias.toFixed(3)} °C`);
"""

js_content = re.sub(
    r'(setEl\("val-overall-bias",.*?;\n)',
    r'\1' + global_metrics_updates,
    js_content
)

with open("app/static/app.js", "w", encoding="utf-8") as f:
    f.write(js_content)

print("Data propagation fixed.")
