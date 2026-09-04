window.onload = function () {
    const STORAGE_KEY = "korfbalMatchState";
    const state = loadState();

    const SHOT_COLUMNS = ["vrijworp", "penalty", "doorloper"];
    let otherSort = { column: "vrijworp", direction: "desc" };

    renderMeta(state);
    renderScoreboard(state);
    renderMainStats(state);
    renderOtherActions();

    document.querySelectorAll("#otherActionsTable th[data-sort]").forEach(function (th) {
        th.addEventListener("click", function () {
            const column = th.dataset.sort;
            if (otherSort.column === column) {
                otherSort.direction = otherSort.direction === "asc" ? "desc" : "asc";
            } else {
                otherSort.column = column;
                otherSort.direction = "desc";
            }
            renderOtherActions();
        });
    });

    document.getElementById("downloadPdfButton").addEventListener("click", function () {
        exportPdf(state);
    });

    document.getElementById("downloadExcelButton").addEventListener("click", function () {
        exportExcel(state);
    });

    document.getElementById("resetMatchButton").addEventListener("click", function () {
        const wantsPdf = confirm("Wil je eerst een PDF downloaden van deze wedstrijd? (OK = ja, Annuleren = nee, direct verder)");
        if (wantsPdf) {
            exportPdf(state);
        }

        const proceed = confirm("Nieuwe wedstrijd starten? De huidige stats gaan verloren.");
        if (!proceed) return;

        localStorage.removeItem(STORAGE_KEY);
        window.location.href = "setup.html";
    });

    function loadState() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return { playerStats: {}, homeScore: 0, awayScore: 0 };
        }
        try {
            return JSON.parse(raw);
        } catch (e) {
            return { playerStats: {}, homeScore: 0, awayScore: 0 };
        }
    }

    function formatDate(isoString) {
        const date = isoString ? new Date(isoString) : new Date();
        return date.toLocaleDateString("nl-BE", { day: "2-digit", month: "2-digit", year: "numeric" });
    }

    function renderMeta(state) {
        const opponent = state.opponentName || "uitploeg";
        document.getElementById("statsOpponentName").textContent = opponent;
        document.getElementById("matchMeta").textContent = "Neerlandia vs " + opponent + " - " + formatDate(state.matchDate);
    }

    function renderScoreboard(state) {
        document.getElementById("statsHomeScore").textContent = state.homeScore || 0;
        document.getElementById("statsAwayScore").textContent = state.awayScore || 0;
    }

    // ---- Hoofdstatistieken: Kansen (color-coded rendement), Tegengoals, Rebounds ----

    function getShotActionData(stats, actionName) {
        const actions = stats.actions || {};
        const scored = actions[actionName + " goal"] || 0;
        const noGoal = actions[actionName + " no goal"] || 0;
        return { scored: scored, total: scored + noGoal };
    }

    // Below 20% red, below 50% orange, above 49% light green, above 74% bright green
    function rendementClass(pct) {
        if (pct > 74) return "stats-bar-fill-bright-green";
        if (pct > 49) return "stats-bar-fill-light-green";
        if (pct < 20) return "stats-bar-fill-red";
        return "stats-bar-fill-orange";
    }

    function metricRowHtml(label, scored, total) {
        const pct = total > 0 ? Math.round((scored / total) * 100) : 0;
        // A 0%-wide bar is invisible - if shots were taken but none scored, show a full red bar instead
        const barWidth = (pct === 0 && total > 0) ? 100 : pct;
        return "<div class='stats-metric'>" +
            "<div class='stats-metric-top'>" +
                "<span class='stats-metric-label'>" + label + "</span>" +
                "<span class='stats-metric-value'>" + scored + "/" + total + "</span>" +
            "</div>" +
            "<div class='stats-bar-track'>" +
                "<div class='stats-bar-fill " + rendementClass(pct) + "' style='width: " + barWidth + "%;'></div>" +
            "</div>" +
            "<div class='stats-metric-pct'>" + pct + "% rendement</div>" +
        "</div>";
    }

    function countRowHtml(label, count) {
        return "<div class='stats-count-row'>" +
            "<span class='stats-count-label'>" + label + "</span>" +
            "<span class='stats-count-value'>" + count + "</span>" +
        "</div>";
    }

    function renderMainStats(state) {
        const container = document.getElementById("mainStatsList");
        const players = Object.keys(state.playerStats || {});

        if (players.length === 0) {
            container.innerHTML = "<p class='stats-empty'>Nog geen acties geregistreerd.</p>";
            return;
        }

        players.sort(function (a, b) {
            return (state.playerStats[b].goals || 0) - (state.playerStats[a].goals || 0);
        });

        container.innerHTML = "";

        players.forEach(function (player) {
            const stats = state.playerStats[player];
            const actions = stats.actions || {};
            const rebounds = actions["Rebound"] || 0;
            const tegengoals = actions["Tegengoal"] || 0;

            const card = document.createElement("div");
            card.className = "stats-card";
            card.innerHTML =
                "<div class='stats-card-header'>" +
                    "<span class='stats-card-name'>" + player + "</span>" +
                "</div>" +
                metricRowHtml("Kansen", stats.goals || 0, stats.shots || 0) +
                "<div class='stats-count-list'>" +
                    countRowHtml("Tegengoals", tegengoals) +
                    countRowHtml("Rebounds", rebounds) +
                "</div>";

            container.appendChild(card);
        });
    }

    // ---- Overige acties: Vrijworp / Penalty / Doorloper (scored/taken) + Assist / Steal (count) ----

    function getOtherActionRows() {
        return Object.keys(state.playerStats || {}).map(function (player) {
            const stats = state.playerStats[player];
            const actions = stats.actions || {};
            return {
                player: player,
                vrijworp: getShotActionData(stats, "Vrijworp"),
                penalty: getShotActionData(stats, "Penalty"),
                doorloper: getShotActionData(stats, "Doorloper"),
                assist: actions["Assist"] || 0,
                steal: actions["Steal"] || 0
            };
        });
    }

    function renderOtherActions() {
        const tbody = document.querySelector("#otherActionsTable tbody");
        const rows = getOtherActionRows();

        if (rows.length === 0) {
            tbody.innerHTML = "<tr><td colspan='6' class='stats-empty'>Nog geen acties geregistreerd.</td></tr>";
            updateOtherSortIndicators();
            return;
        }

        rows.sort(function (a, b) {
            const col = otherSort.column;
            let result;
            if (col === "player") {
                result = a.player.localeCompare(b.player);
            } else if (SHOT_COLUMNS.includes(col)) {
                result = a[col].total - b[col].total;
            } else {
                result = a[col] - b[col];
            }
            return otherSort.direction === "asc" ? result : -result;
        });

        tbody.innerHTML = rows.map(function (row) {
            return "<tr>" +
                "<td>" + row.player + "</td>" +
                "<td class='fraction'>" + row.vrijworp.scored + "/" + row.vrijworp.total + "</td>" +
                "<td class='fraction'>" + row.penalty.scored + "/" + row.penalty.total + "</td>" +
                "<td class='fraction'>" + row.doorloper.scored + "/" + row.doorloper.total + "</td>" +
                "<td>" + row.assist + "</td>" +
                "<td>" + row.steal + "</td>" +
                "</tr>";
        }).join("");

        updateOtherSortIndicators();
    }

    function updateOtherSortIndicators() {
        document.querySelectorAll("#otherActionsTable th[data-sort]").forEach(function (th) {
            th.classList.remove("sorted-asc", "sorted-desc");
            if (th.dataset.sort === otherSort.column) {
                th.classList.add(otherSort.direction === "asc" ? "sorted-asc" : "sorted-desc");
            }
        });
    }

    // ---- PDF wrap-up export ----

    function exportPdf(state) {
        if (!window.jspdf) {
            alert("PDF-bibliotheek kon niet geladen worden (geen internetverbinding?). Wedstrijd wordt niet geëxporteerd.");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const opponent = state.opponentName || "uitploeg";
        const dateStr = formatDate(state.matchDate);
        const players = Object.keys(state.playerStats || {});

        doc.setFontSize(16);
        doc.text("Wedstrijdverslag", 14, 18);
        doc.setFontSize(11);
        doc.text("Neerlandia vs " + opponent + " - " + dateStr, 14, 26);
        doc.text("Eindstand: " + (state.homeScore || 0) + " - " + (state.awayScore || 0), 14, 33);

        const mainRows = players
            .sort(function (a, b) { return (state.playerStats[b].goals || 0) - (state.playerStats[a].goals || 0); })
            .map(function (player) {
                const stats = state.playerStats[player];
                const actions = stats.actions || {};
                const shots = stats.shots || 0;
                const goals = stats.goals || 0;
                const pct = shots > 0 ? Math.round((goals / shots) * 100) : 0;
                return [
                    player,
                    goals + "/" + shots + " (" + pct + "%)",
                    actions["Tegengoal"] || 0,
                    actions["Rebound"] || 0
                ];
            });

        doc.autoTable({
            startY: 40,
            head: [["Speler", "Kansen", "Tegengoals", "Rebounds"]],
            body: mainRows
        });

        const otherRows = players.map(function (player) {
            const stats = state.playerStats[player];
            const actions = stats.actions || {};
            const vrijworp = getShotActionData(stats, "Vrijworp");
            const penalty = getShotActionData(stats, "Penalty");
            const doorloper = getShotActionData(stats, "Doorloper");
            return [
                player,
                vrijworp.scored + "/" + vrijworp.total,
                penalty.scored + "/" + penalty.total,
                doorloper.scored + "/" + doorloper.total,
                actions["Assist"] || 0,
                actions["Steal"] || 0
            ];
        });

        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 10,
            head: [["Speler", "Vrijworp", "Penalty", "Doorloper", "Assist", "Steal"]],
            body: otherRows
        });

        if (Array.isArray(state.subLog) && state.subLog.length > 0) {
            const subRows = state.subLog.map(function (s) {
                return [s.index, s.outNumber + " -> " + s.inNumber];
            });
            doc.autoTable({
                startY: doc.lastAutoTable.finalY + 10,
                head: [["Wissel", "Nummer uit -> in"]],
                body: subRows
            });
        }

        const fileDate = (state.matchDate ? new Date(state.matchDate) : new Date()).toISOString().slice(0, 10);

        // ---- Per-player shot maps (field + their own shot dots), then save ----
        const playersWithShots = players.filter(function (p) {
            const circles = (state.playerCircles || {})[p];
            return circles && circles.length > 0;
        });

        if (playersWithShots.length === 0) {
            doc.save("wedstrijd-" + fileDate + ".pdf");
            return;
        }

        loadFieldImage().then(function (fieldImg) {
            const pageHeight = doc.internal.pageSize.getHeight();
            const imgWidth = 85;
            const imgHeight = imgWidth * (548 / 630);
            let cursorY = doc.lastAutoTable.finalY + 14;

            if (cursorY + 10 > pageHeight - 10) {
                doc.addPage();
                cursorY = 15;
            }
            doc.setFontSize(13);
            doc.text("Schotkaarten per speler", 14, cursorY);
            cursorY += 8;

            playersWithShots.forEach(function (player) {
                if (cursorY + imgHeight + 10 > pageHeight - 10) {
                    doc.addPage();
                    cursorY = 15;
                }
                doc.setFontSize(11);
                doc.text(player, 14, cursorY);
                const dataUrl = shotMapDataUrl(fieldImg, state.playerCircles[player]);
                doc.addImage(dataUrl, "PNG", 14, cursorY + 3, imgWidth, imgHeight);
                cursorY += imgHeight + 14;
            });

            doc.save("wedstrijd-" + fileDate + ".pdf");
        }).catch(function () {
            doc.save("wedstrijd-" + fileDate + ".pdf");
        });
    }

    function loadFieldImage() {
        return new Promise(function (resolve, reject) {
            const img = new Image();
            img.onload = function () { resolve(img); };
            img.onerror = function () { reject(new Error("field image failed to load")); };
            img.src = "KorfbalVeldSmall.png";
        });
    }

    function shotMapDataUrl(fieldImg, circles) {
        const canvas = document.createElement("canvas");
        canvas.width = 630;
        canvas.height = 548;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(fieldImg, 0, 0, canvas.width, canvas.height);

        circles.forEach(function (c) {
            ctx.fillStyle = c.isGoal ? "green" : "red";
            ctx.beginPath();
            ctx.arc(c.x, c.y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = "#000";
            ctx.stroke();
        });

        return canvas.toDataURL("image/png");
    }

    // ---- Excel export: multiple clean tables, meant to be imported into Power BI or similar ----

    function exportExcel(state) {
        if (!window.XLSX) {
            alert("Kon de Excel-bibliotheek niet laden (geen internetverbinding?). Export mislukt.");
            return;
        }

        const players = Object.keys(state.playerStats || {});
        const roster = (state.mainRoster || []).concat(state.benchRoster || []);

        function numberFor(name) {
            const entry = roster.find(function (p) { return p.name === name; });
            return entry ? entry.number : "";
        }

        function shotData(stats, actionName) {
            const actions = stats.actions || {};
            const scored = actions[actionName + " goal"] || 0;
            const noGoal = actions[actionName + " no goal"] || 0;
            return { scored: scored, total: scored + noGoal };
        }

        // ---- MatchInfo ----
        const matchInfoRows = [
            ["Veld", "Waarde"],
            ["Tegenstander", state.opponentName || "uitploeg"],
            ["Datum", formatDate(state.matchDate)],
            ["Eindstand thuis", state.homeScore || 0],
            ["Eindstand uit", state.awayScore || 0],
            ["Kansen tegenstander", state.opponentChances || 0],
            ["Doelpunten tegenstander", state.opponentGoals || 0]
        ];

        // ---- PlayerStats (one row per player, wide format) ----
        const playerStatsRows = [[
            "Naam", "Nummer", "Shots", "Goals", "Kansen_Percentage",
            "Vrijworp_Gescoord", "Vrijworp_Totaal",
            "Penalty_Gescoord", "Penalty_Totaal",
            "Doorloper_Gescoord", "Doorloper_Totaal",
            "Rebounds", "Assists", "Steals", "Tegengoals"
        ]];
        players.forEach(function (name) {
            const stats = state.playerStats[name];
            const actions = stats.actions || {};
            const shots = stats.shots || 0;
            const goals = stats.goals || 0;
            const pct = shots > 0 ? Math.round((goals / shots) * 100) : 0;
            const vrijworp = shotData(stats, "Vrijworp");
            const penalty = shotData(stats, "Penalty");
            const doorloper = shotData(stats, "Doorloper");
            playerStatsRows.push([
                name, numberFor(name), shots, goals, pct,
                vrijworp.scored, vrijworp.total,
                penalty.scored, penalty.total,
                doorloper.scored, doorloper.total,
                actions["Rebound"] || 0, actions["Assist"] || 0, actions["Steal"] || 0, actions["Tegengoal"] || 0
            ]);
        });

        // ---- ShotLocations (for the shotmap visual - canvas was 630 x 548 px, origin top-left) ----
        const shotRows = [["Speler", "Nummer", "X", "Y", "Doelpunt"]];
        players.forEach(function (name) {
            const circles = (state.playerCircles || {})[name] || [];
            circles.forEach(function (c) {
                shotRows.push([name, numberFor(name), c.x, c.y, c.isGoal ? "Ja" : "Nee"]);
            });
        });

        // ---- PossessionLog (verloop) ----
        const possessionRows = [["Aanval_Nummer", "Team", "Aantal_Kansen", "Doelpunt"]];
        (state.possessionLog || []).forEach(function (entry, i) {
            possessionRows.push([i + 1, entry.team === "ons" ? "Ons team" : "Tegenstander", entry.count, entry.goal ? "Ja" : "Nee"]);
        });

        // ---- SubstitutionLog ----
        const subRows = [["Wissel_Nummer", "Nummer_Uit", "Nummer_In"]];
        (state.subLog || []).forEach(function (s) {
            subRows.push([s.index, s.outNumber, s.inNumber]);
        });

        // ---- ActionLog (full chronological event log) ----
        const actionLogRows = [["Volgnummer", "Type", "Speler", "Details"]];
        (state.actionHistory || []).forEach(function (entry, i) {
            let type = entry.type;
            let speler = entry.player || "";
            let details = "";
            if (entry.type === "shot") {
                type = "Schot (veld)";
                details = entry.isGoal ? "Doelpunt" : "Gemist";
            } else if (entry.type === "shotAction") {
                type = (entry.actionKey || "").replace(" goal", "").replace(" no goal", "");
                details = entry.isGoal ? "Doelpunt" : "Gemist";
            } else if (entry.type === "support") {
                type = entry.action;
            } else if (entry.type === "tegengoal") {
                type = "Tegengoal";
            } else if (entry.type === "opponentKans") {
                type = "Kans tegenstander";
            } else if (entry.type === "zeroChance") {
                type = "0 Kans (ons)";
            } else if (entry.type === "opponentZeroChance") {
                type = "0 Kans (tegenstander)";
            }
            actionLogRows.push([i + 1, type, speler, details]);
        });

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(matchInfoRows), "MatchInfo");
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(playerStatsRows), "PlayerStats");
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(shotRows), "ShotLocations");
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(possessionRows), "PossessionLog");
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(subRows), "SubstitutionLog");
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(actionLogRows), "ActionLog");

        const fileDate = (state.matchDate ? new Date(state.matchDate) : new Date()).toISOString().slice(0, 10);
        XLSX.writeFile(workbook, "wedstrijd-data-" + fileDate + ".xlsx");
    }
};
