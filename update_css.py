import os

css_additions = """
/* ============================================================
   RECONSTRUCTION DASHBOARD REDESIGN (NEW STYLES)
   ============================================================ */

/* Floating Navbar */
.floating-navbar {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  width: 95%;
  max-width: 1400px;
  height: 64px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 32px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  box-shadow: 0 4px 24px rgba(12, 74, 110, 0.08);
  z-index: 1000;
}

.floating-navbar .brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.floating-navbar .brand-logo-badge {
  background: #0ea5e9;
  color: white;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.4);
}

.floating-navbar .brand-title {
  font-size: 18px;
  font-weight: 700;
  color: #0c4a6e;
  line-height: 1;
}

.floating-navbar .brand-subtitle {
  font-size: 9px;
  color: #64748b;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  font-weight: 600;
}

.floating-navbar .page-nav {
  background: transparent;
  border: none;
  padding: 0;
  display: flex;
  gap: 4px;
}

.floating-navbar .nav-link {
  background: transparent;
  border: none;
  color: #475569;
  font-size: 13px;
  font-weight: 500;
  padding: 8px 16px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: none;
  transition: all 0.2s ease;
}

.floating-navbar .nav-link:hover {
  color: #0ea5e9;
  background: rgba(14, 165, 233, 0.05);
}

.floating-navbar .nav-link.active {
  background: #0ea5e9;
  color: white;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.3);
}

.floating-navbar .nav-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.nav-search-bar {
  display: flex;
  align-items: center;
  background: rgba(241, 245, 249, 0.8);
  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 20px;
  padding: 6px 12px;
  width: 280px;
}

.nav-search-bar .search-icon {
  color: #94a3b8;
  font-size: 13px;
}

.nav-search-bar input {
  border: none;
  background: transparent;
  outline: none;
  padding: 0 8px;
  font-size: 12px;
  width: 100%;
  color: #334155;
  font-family: var(--font-main);
}

.nav-search-bar .shortcut-key {
  font-size: 10px;
  background: white;
  padding: 2px 6px;
  border-radius: 4px;
  color: #94a3b8;
  border: 1px solid #e2e8f0;
}

.nav-icon-btn {
  background: transparent;
  border: none;
  color: #475569;
  font-size: 18px;
  position: relative;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-icon-btn .badge-dot {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 8px;
  height: 8px;
  background: #ef4444;
  border-radius: 50%;
  border: 2px solid white;
}

.nav-user-profile {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 24px;
  transition: background 0.2s;
}

.nav-user-profile:hover {
  background: rgba(241, 245, 249, 0.8);
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #1e293b;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
}

.user-info {
  display: flex;
  flex-direction: column;
}

.user-info .user-name {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
  line-height: 1.2;
}

.user-info .user-role {
  font-size: 10px;
  color: #64748b;
}

.dropdown-icon {
  font-size: 10px;
  color: #94a3b8;
}

/* Dashboard Hero Background Area */
.dashboard-hero-header {
  position: relative;
  width: 100%;
  min-height: 320px;
  background: url('/static/images/hero_ocean.jpg') center/cover no-repeat;
  padding: 100px 4% 20px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.hero-bg-overlay {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background: linear-gradient(to bottom, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.85) 50%, var(--bg-body) 100%);
  z-index: 1;
}

.hero-content {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 1800px;
  margin: 0 auto;
}

.hero-breadcrumb {
  font-size: 12px;
  color: #0284c7;
  margin-bottom: 8px;
}
.hero-breadcrumb span {
  font-weight: 600;
  color: #0c4a6e;
}

.hero-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 24px;
}

.hero-page-title {
  font-size: 32px;
  font-weight: 800;
  color: #0c4a6e;
  letter-spacing: -0.5px;
  margin-bottom: 4px;
}

.hero-page-subtitle {
  font-size: 14px;
  color: #475569;
  font-weight: 500;
}

.hero-tagline {
  font-family: 'Great Vibes', cursive;
  font-size: 24px;
  color: #0284c7;
  line-height: 1.1;
  text-align: right;
  display: block;
}

.hero-summary-cards {
  display: flex;
  gap: 16px;
  margin-bottom: -40px; /* Overlap into main content */
}

.summary-card {
  flex: 1;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: var(--shadow-sm);
}

.summary-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #f0f9ff;
  color: #0ea5e9;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.summary-details h4 {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 2px;
}

.summary-details p {
  font-size: 11px;
  color: #475569;
  line-height: 1.4;
}

/* Key Surface Observations Grid */
.surface-obs-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.obs-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
}

.obs-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.obs-icon {
  font-size: 14px;
}
.sst-color { color: #f97316; }
.sss-color { color: #0ea5e9; }
.ssh-color { color: #3b82f6; }
.curr-color { color: #6366f1; }
.wind-color { color: #8b5cf6; }

.obs-title {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}

.obs-value {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 8px;
}

.obs-footer {
  font-size: 10px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.text-success { color: #10b981; }

/* Main layout updates */
.dashboard-grid {
  padding-top: 60px; /* Space for overlapped summary cards */
}

.main-top-row {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

.flex-65 { flex: 0 0 65%; }
.flex-35 { flex: 0 0 calc(35% - 20px); }
.flex-50 { flex: 0 0 calc(50% - 10px); }

.main-bottom-row {
  display: flex;
  gap: 20px;
  margin-top: 20px;
}

/* Ensure map height allows for compact profile beside it */
.map-container {
  height: 400px;
}
.compact-profile-body {
  height: 400px;
  padding: 8px;
}

.model-info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.model-info-item {
  display: flex;
  flex-direction: column;
}

.info-label {
  font-size: 11px;
  color: #64748b;
  text-transform: uppercase;
  font-weight: 600;
  margin-bottom: 4px;
}

.info-val {
  font-size: 14px;
  color: #0f172a;
}

.metric-block {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
  margin-bottom: 12px;
}

.metric-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}
.purple-bg { background: #8b5cf6; }
.green-bg { background: #10b981; }
.orange-bg { background: #f59e0b; }

.metric-text {
  display: flex;
  flex-direction: column;
}
.m-label {
  font-size: 12px;
  color: #64748b;
  font-weight: 600;
}
.m-val {
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
}
"""

with open("app/static/styles.css", "a", encoding="utf-8") as f:
    f.write(css_additions)
print("CSS updated.")
