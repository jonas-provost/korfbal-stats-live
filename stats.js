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
        doc.save("wedstrijd-" + fileDate + ".pdf");
    }
};
