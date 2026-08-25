window.onload = function () {
    const STORAGE_KEY = "korfbalMatchState";
    const state = loadState();
    const log = state.possessionLog || [];

    const ONS_COLOR = "#5a5a5a";
    const TEGENSTANDER_COLOR = "#e05656";

    function loadState() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { possessionLog: [] };
        try {
            const parsed = JSON.parse(raw);
            return { possessionLog: parsed.possessionLog || [] };
        } catch (e) {
            return { possessionLog: [] };
        }
    }

    if (!window.Chart) {
        document.querySelector(".verloop-container").innerHTML =
            "<a href='index.html' class='back-link'>&larr; Terug naar match</a>" +
            "<p class='stats-empty'>Kon de grafiekbibliotheek niet laden (geen internetverbinding?).</p>";
        return;
    }

    if (log.length === 0) {
        document.querySelector(".verloop-top").innerHTML = "<p class='stats-empty'>Nog geen aanvallen geregistreerd.</p>";
        document.querySelector(".verloop-bottom").innerHTML = "<p class='stats-empty'>Nog geen aanvallen geregistreerd.</p>";
        return;
    }

    // ---- Bucket every logged attack by how many kansen it had, per side ----

    function bucketKey(count) {
        if (count <= 0) return "0";
        if (count === 1) return "1";
        if (count === 2) return "2";
        return "3plus";
    }

    const buckets = {
        "0": { ons: 0, tegenstander: 0 },
        "1": { ons: 0, tegenstander: 0 },
        "2": { ons: 0, tegenstander: 0 },
        "3plus": { ons: 0, tegenstander: 0 }
    };

    log.forEach(function (entry) {
        buckets[bucketKey(entry.count)][entry.team]++;
    });

    function makePie(canvasId, bucket) {
        new Chart(document.getElementById(canvasId), {
            type: "pie",
            data: {
                labels: ["Ons team", "Tegenstander"],
                datasets: [{
                    data: [bucket.ons, bucket.tegenstander],
                    backgroundColor: [ONS_COLOR, TEGENSTANDER_COLOR]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: 0 },
                plugins: {
                    legend: {
                        display: true,
                        position: "bottom",
                        labels: { boxWidth: 12, font: { size: 10 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                return ctx.label + ": " + ctx.raw + " aanval(len)";
                            }
                        }
                    }
                }
            }
        });
    }

    makePie("pieChart0", buckets["0"]);
    makePie("pieChart1", buckets["1"]);
    makePie("pieChart2", buckets["2"]);
    makePie("pieChart3plus", buckets["3plus"]);

    // ---- Bar chart: kansen per aanval, in chronological order ----

    const GOAL_BORDER_COLOR = "#f1c40f";

    const labels = log.map(function (_, i) { return String(i + 1); });
    const data = log.map(function (entry) { return entry.count; });
    const colors = log.map(function (entry) { return entry.team === "ons" ? ONS_COLOR : TEGENSTANDER_COLOR; });
    const borderColors = log.map(function (entry) { return entry.goal ? GOAL_BORDER_COLOR : "transparent"; });
    const borderWidths = log.map(function (entry) { return entry.goal ? 3 : 0; });

    new Chart(document.getElementById("attackBarChart"), {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: "Kansen",
                data: data,
                backgroundColor: colors,
                borderColor: borderColors,
                borderWidth: borderWidths
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: "Aanval" } },
                y: { beginAtZero: true, ticks: { stepSize: 1 }, title: { display: true, text: "Aantal kansen" } }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (ctx) {
                            const entry = log[ctx.dataIndex];
                            const base = (entry.team === "ons" ? "Ons team" : "Tegenstander") + ": " + entry.count + " kansen";
                            return entry.goal ? base + " (doelpunt)" : base;
                        }
                    }
                }
            }
        }
    });
};
