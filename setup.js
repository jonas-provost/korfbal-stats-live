window.onload = function () {
    const STORAGE_KEY = "korfbalMatchState";
    const ROSTERS_KEY = "korfbalRosters";

    // Default squad: U17
    const DEFAULT_SQUAD = [
        { number: 1, name: "Klara" },
        { number: 2, name: "Fem" },
        { number: 3, name: "Fieke" },
        { number: 4, name: "Alexia" },
        { number: 5, name: "Dennis" },
        { number: 6, name: "Selle" },
        { number: 7, name: "Stan" },
        { number: 8, name: "Seppe" },
        { number: 9, name: "Teo" },
        { number: 10, name: "Robbe" },
        { number: 11, name: "Dylano" }
    ];

    // ---- Rosters: multiple named teams (e.g. U13, U15, U17), stored in localStorage ----

    function loadRosters() {
        const raw = localStorage.getItem(ROSTERS_KEY);
        if (!raw) {
            const initial = { "U17": DEFAULT_SQUAD };
            localStorage.setItem(ROSTERS_KEY, JSON.stringify(initial));
            return initial;
        }
        try {
            const parsed = JSON.parse(raw);
            if (!parsed || Object.keys(parsed).length === 0) {
                return { "U17": DEFAULT_SQUAD };
            }
            return parsed;
        } catch (e) {
            return { "U17": DEFAULT_SQUAD };
        }
    }

    function saveRosters() {
        localStorage.setItem(ROSTERS_KEY, JSON.stringify(rosters));
    }

    let rosters = loadRosters();

    const rosterSelect = document.getElementById("rosterSelect");

    function renderRosterOptions(selectName) {
        rosterSelect.innerHTML = Object.keys(rosters).map(function (name) {
            return "<option value=\"" + name + "\">" + name + "</option>";
        }).join("");
        if (selectName && rosters[selectName]) {
            rosterSelect.value = selectName;
        }
    }
    renderRosterOptions();

    rosterSelect.addEventListener("change", function () {
        loadSquadIntoPool(rosters[rosterSelect.value] || DEFAULT_SQUAD);
    });

    document.getElementById("deleteRosterButton").addEventListener("click", function () {
        const name = rosterSelect.value;
        if (name === "U17") {
            alert("Het standaardteam kan niet verwijderd worden.");
            return;
        }
        if (!confirm("Team \"" + name + "\" verwijderen?")) return;
        delete rosters[name];
        saveRosters();
        renderRosterOptions("U17");
        loadSquadIntoPool(rosters["U17"] || DEFAULT_SQUAD);
    });

    // ---- Excel/CSV import ----

    document.getElementById("rosterFileInput").addEventListener("change", function (event) {
        const file = event.target.files[0];
        if (!file) return;

        const isCsv = file.name.toLowerCase().endsWith(".csv");
        const reader = new FileReader();

        reader.onload = function (e) {
            const players = isCsv ? parseCsv(e.target.result) : parseExcel(e.target.result);

            if (!players || players.length === 0) {
                alert("Kon geen spelers uit dit bestand halen. Zorg voor kolommen \"Nummer\" en \"Naam\".");
                return;
            }

            const name = prompt("Naam voor dit team (bv. U13):", "");
            if (!name) return;

            rosters[name] = players;
            saveRosters();
            renderRosterOptions(name);
            loadSquadIntoPool(players);
            event.target.value = "";
        };

        if (isCsv) {
            reader.readAsText(file);
        } else {
            reader.readAsArrayBuffer(file);
        }
    });

    function findColumn(headers, keywords) {
        return headers.findIndex(function (h) {
            return keywords.some(function (k) { return h.includes(k); });
        });
    }

    function parseCsv(text) {
        const lines = text.split(/\r?\n/).filter(function (l) { return l.trim() !== ""; });
        if (lines.length === 0) return [];

        const headers = lines[0].split(/[,;]/).map(function (h) { return h.trim().toLowerCase(); });
        let numberIdx = findColumn(headers, ["nummer", "number", "nr"]);
        let nameIdx = findColumn(headers, ["naam", "name"]);
        let startRow = 1;
        if (numberIdx === -1 || nameIdx === -1) {
            numberIdx = 0;
            nameIdx = 1;
            startRow = 0; // no usable header row - treat row 1 as data too
        }

        const players = [];
        for (let i = startRow; i < lines.length; i++) {
            const cols = lines[i].split(/[,;]/);
            const number = parseInt((cols[numberIdx] || "").trim(), 10);
            const name = (cols[nameIdx] || "").trim();
            if (name && !isNaN(number)) {
                players.push({ number: number, name: name });
            }
        }
        return players;
    }

    function parseExcel(arrayBuffer) {
        if (!window.XLSX) {
            alert("Kon de Excel-bibliotheek niet laden (geen internetverbinding?).");
            return [];
        }

        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (rows.length === 0) return [];

        const headers = (rows[0] || []).map(function (h) { return String(h).trim().toLowerCase(); });
        let numberIdx = findColumn(headers, ["nummer", "number", "nr"]);
        let nameIdx = findColumn(headers, ["naam", "name"]);
        let startRow = 1;
        if (numberIdx === -1 || nameIdx === -1) {
            numberIdx = 0;
            nameIdx = 1;
            startRow = 0;
        }

        const players = [];
        for (let i = startRow; i < rows.length; i++) {
            const row = rows[i];
            if (!row) continue;
            const number = parseInt(row[numberIdx], 10);
            const name = String(row[nameIdx] || "").trim();
            if (name && !isNaN(number)) {
                players.push({ number: number, name: name });
            }
        }
        return players;
    }

    // ---- Drag-and-drop lineup grid ----

    const zones = {
        attack: document.querySelector('.zone-drop[data-zone="attack"]'),
        defence: document.querySelector('.zone-drop[data-zone="defence"]'),
        bench: document.querySelector('.zone-drop[data-zone="bench"]'),
        pool: document.querySelector('.zone-drop[data-zone="pool"]')
    };

    const maxes = { attack: 4, defence: 4, bench: 6, pool: Infinity };

    const counts = {
        attack: document.getElementById("attackCount"),
        defence: document.getElementById("defenceCount"),
        bench: document.getElementById("benchCount")
    };

    function makeChip(player) {
        const chip = document.createElement("div");
        chip.className = "player-chip";
        chip.draggable = true;
        chip.dataset.number = player.number;
        chip.dataset.name = player.name;
        chip.innerHTML = "<span class='player-number'>" + player.number + "</span>" + player.name;

        chip.addEventListener("dragstart", function (event) {
            event.dataTransfer.setData("text/plain", String(player.number));
            chip.classList.add("dragging");
        });
        chip.addEventListener("dragend", function () {
            chip.classList.remove("dragging");
        });

        // Tap-to-cycle fallback for touch devices without drag support:
        // tap a chip to send it to the next zone in the cycle.
        chip.addEventListener("click", function () {
            const cycle = ["pool", "attack", "defence", "bench"];
            const current = chip.parentElement.dataset.zone;
            const nextZone = cycle[(cycle.indexOf(current) + 1) % cycle.length];
            moveChip(chip, nextZone);
        });

        return chip;
    }

    function loadSquadIntoPool(squad) {
        Object.keys(zones).forEach(function (zoneName) { zones[zoneName].innerHTML = ""; });
        squad.forEach(function (player) {
            zones.pool.appendChild(makeChip(player));
        });
        updateCounts();
    }

    loadSquadIntoPool(rosters[rosterSelect.value] || DEFAULT_SQUAD);

    function moveChip(chip, zoneName) {
        const targetZone = zones[zoneName];
        if (zoneName !== "pool" && targetZone.children.length >= maxes[zoneName]) {
            return; // zone full, ignore
        }
        targetZone.appendChild(chip);
        updateCounts();
    }

    Object.keys(zones).forEach(function (zoneName) {
        const el = zones[zoneName];
        el.addEventListener("dragover", function (event) {
            event.preventDefault();
        });
        el.addEventListener("drop", function (event) {
            event.preventDefault();
            const number = event.dataTransfer.getData("text/plain");
            const chip = document.querySelector(".player-chip[data-number='" + number + "']");
            if (!chip) return;
            moveChip(chip, zoneName);
        });
    });

    function updateCounts() {
        counts.attack.textContent = zones.attack.children.length + "/4";
        counts.defence.textContent = zones.defence.children.length + "/4";
        counts.bench.textContent = zones.bench.children.length + "/6";
    }
    updateCounts();

    document.getElementById("startMatchButton").addEventListener("click", function () {
        const opponentName = document.getElementById("opponentInput").value.trim() || "uitploeg";

        const attackChips = Array.from(zones.attack.children);
        const defenceChips = Array.from(zones.defence.children);
        const benchChips = Array.from(zones.bench.children);
        const poolChips = Array.from(zones.pool.children);

        if (attackChips.length !== 4 || defenceChips.length !== 4) {
            alert("Je hebt precies 4 aanvallers en 4 verdedigers nodig om te starten.");
            return;
        }

        if (poolChips.length > 0) {
            const proceed = confirm(poolChips.length + " speler(s) staan nog bij 'Spelers' en doen niet mee. Toch doorgaan?");
            if (!proceed) return;
        }

        function chipToPlayer(chip, position) {
            const player = { number: parseInt(chip.dataset.number, 10), name: chip.dataset.name };
            if (position) player.position = position;
            return player;
        }

        const mainRoster = attackChips.map(function (c) { return chipToPlayer(c, "attack"); })
            .concat(defenceChips.map(function (c) { return chipToPlayer(c, "defence"); }));
        const benchRoster = benchChips.map(function (c) { return chipToPlayer(c); });

        const state = {
            opponentName: opponentName,
            matchDate: new Date().toISOString(),
            mainRoster: mainRoster,
            benchRoster: benchRoster,
            subLog: [],
            actionHistory: [],
            possessionLog: [],
            opponentChances: 0,
            opponentGoals: 0,
            playerStats: {},
            playerCircles: {},
            selectedPlayer: null,
            homeScore: 0,
            awayScore: 0,
            timerElapsedSeconds: 0,
            timerRunning: false,
            timerStartEpoch: null
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        window.location.href = "index.html";
    });
};
