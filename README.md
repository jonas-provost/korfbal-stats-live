# 🏀 Korfbal Stats Live

Live wedstrijdstatistieken voor korfbal — bijhouden tijdens de match, delen na afloop.

Een installeerbare Progressive Web App (PWA) die courtside draait op elk toestel: laptop, tablet of iPad. Geen internet nodig tijdens de wedstrijd, geen account, geen server.

![Status](https://img.shields.io/badge/status-actief-brightgreen)
![Type](https://img.shields.io/badge/type-PWA-blue)
![Stack](https://img.shields.io/badge/stack-vanilla%20JS-yellow)
![Werkt offline](https://img.shields.io/badge/offline-ready-success)

---

## ✨ Features

- 🎯 **Shotkaart** — tik op het veld waar een kans genomen is, per speler, doelpunt of gemist
- 🔄 **Wissels** — bank ↔ opstelling, met een teller en volledige log achteraf
- ⏱️ **Klok** — instelbare speeltijd per helft (30/25/20 min), met countdown en waarschuwing
- 📊 **Live kansen-teller** — voor beide teams, met rendement-percentage, altijd zichtbaar
- 📈 **Verloop** — grafische weergave van balbezit en kansen per aanval doorheen de wedstrijd
- 🧾 **Export** — volledig wedstrijdrapport als PDF (incl. schotkaart per speler) of Excel
- 👥 **Meerdere teams** — importeer elk elftal via een Excel-bestand, wissel via een dropdown
- 📱 **Installeerbaar** — werkt als volwaardige app op laptop én tablet, ook offline

## 🖥️ Gebruiken

1. Open de live link (GitHub Pages)
2. Stel je wedstrijd op: tegenstander, team, speeltijd, opstelling (sleep spelers naar Aanval/Verdediging/Bank)
3. Volg de wedstrijd: tik acties aan, tag schoten op het veld, houd de klok bij
4. Bekijk **Verloop** voor het live overzicht, of exporteer achteraf een PDF/Excel

Installeren als app: open de link in Chrome (laptop) → *App installeren*, of in Safari (iPad) → *Zet op beginscherm*.

## 🛠️ Tech stack

Zuivere HTML, CSS en JavaScript — geen framework, geen build-stap, geen backend. Alle data blijft lokaal op het toestel (localStorage).

| Onderdeel | Gebruikt voor |
|---|---|
| [Chart.js](https://www.chartjs.org/) | Grafieken op de verloop-pagina |
| [jsPDF](https://github.com/parallax/jsPDF) + AutoTable | PDF-wedstrijdrapport |
| [SheetJS](https://sheetjs.com/) | Excel importeren/exporteren |
| Service Worker | Offline werking, installeerbaar als PWA |

## 📁 Structuur

```
setup.html   → opstelling & wedstrijd starten (startpagina)
index.html   → live wedstrijdtracking
stats.html   → statistieken & export
verloop.html → grafisch wedstrijdverloop
```

## 📌 Versie

Huidige versie staat rechtsonder in de app zelf (bv. `v1.3 · build 2026-09-05.2`) — handig om te checken of een update goed is doorgekomen na een deploy.
