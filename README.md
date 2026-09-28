# OneCal — Shared Executive Calendar, Preparation Heatmap & Team Planner 🗓️⚡

**OneCal** is a high-performance, shared calendar and team preparation tracker designed for executive alignment, trade fairs, portfolio reviews, and campaign planning across global verticals.

---

### 🌟 Key Capabilities & Features

* **🗓️ Switchable Multi-View Calendar:** Smooth transitions across **Day**, **Week**, **Month**, and **Year** views.
* **🔥 Dynamic Preparation Heatmap:**
  * Configurable preparation time in days (`prep_days`) preceding each event.
  * Visual color & glow intensity increases dynamically as event date approaches:
    * 🔵 **Initial Planning** (T-20d+)
    * 🟡 **Active Prep** (T-14d)
    * 🟠 **High Intensity** (T-7d)
    * 🔴 **Crunch Time** (T-3d)
    * 🟣 **Event Day**
* **⚡ Team Preparation Radar:** Real-time dashboard showing exactly which events require team focus and preparation today, ranked by urgency.
* **🏷️ Comprehensive Multi-Dimensional Categorization:**
  * **Scope:** Internal / External
  * **Format:** Physical / Virtual
  * **Region & Map:** EMEA, Germany, Americas, APAC, Global (with interactive Leaflet map pinning)
  * **Event Type:** Portfolio, Fair, Meeting, Campaign
  * **Vertical Filter:** CPG, Auto, A&D, Electronics, Life Sciences, Data Centers, Cross Industry
* **🌐 Web Resource Link & Thumbnail Previews:** Direct URL tagging with visual thumbnail preview.
* **💬 Multimedia Collaboration:** Real-time team comments, base64 photo uploads, and in-browser voice note audio recording.
* **🔒 Granular Privacy:** Public / Shared team events vs Private confidential strategy sessions.
* **📅 Fiscal Year Archive (FY26, FY25, FY24):** Default focus on active FY with instant switching to explore historical years.
* **🖼️ Media Gallery:** Rich visual feed of photos from past events and fairs.
* **📊 KPI & Analytics Suite:** Breakdown charts by vertical, regional coverage, event format, and active preparation workload.
* **📖 Printable Executive Diary Export:** Full continuous multi-page PDF generator with formatted cover stats and chronological briefs.
* **📦 Platform Migration & Cloud Sync:** 1-click JSON backup export/import and Supabase cloud sync.

---

### 🚀 Architecture
* **Frontend:** Static SPA (Tailwind CSS, Plus Jakarta Sans & Playfair Display, Leaflet, Chart.js, Supabase JS).
* **Cloud Database:** Supabase PostgreSQL with Row Level Security.
* **Deployment:** Hosted natively on GitHub Pages with automated CI/CD GitHub Actions.
