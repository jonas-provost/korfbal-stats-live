window.onload = function () {
    const STORAGE_KEY = "korfbalMatchState";

    const match = loadState();
    if (!match || !match.mainRoster || match.mainRoster.length === 0) {
        // No match has been set up yet - go configure one first
        window.location.href = "setup.html";
        return;
    }

    // ---- Match data (mutated in place, persisted via saveState) ----
    let mainRoster = match.mainRoster;       // [{number, name, position: 'attack'|'defence'}]
    let benchRoster = match.benchRoster || []; // [{number, name}]
    let subLog = match.subLog || [];           // [{index, outNumber, inNumber}]
    let actionHistory = match.actionHistory || []; // chronological list of every reversible action
    let playerStats = match.playerStats || {};
    let playerCircles = match.playerCircles || {};
    let selectedPlayer = match.selectedPlayer || null;
    let selectedBenchPlayer = null;
    let isGoal = false;
    let opponentChances = match.opponentChances || 0;
    let opponentGoals = match.opponentGoals || 0;
    let possessionLog = match.possessionLog || []; // [{team: 'ons'|'tegenstander', count, goal}]
    let forceNewAttack = false; // set true right after a goal, so the next possession entry never merges
    let timerElapsedSeconds = match.timerElapsedSeconds || 0;
    let timerRunning = !!match.timerRunning;
    let timerStartEpoch = match.timerStartEpoch || null;
    let timerInterval = null;

    const MAX_SUBS = 8;

    // ---- DOM refs ----
    const attackList = document.getElementById("attackList");
    const defenceList = document.getElementById("defenceList");
    const benchList = document.getElementById("benchList");
    const subLogBadge = document.getElementById("subLogBadge");
    const opponentNameLabel = document.getElementById("opponentNameLabel");
    const shotCanvas = document.getElementById("shotCanvas");
    const ctx = shotCanvas.getContext("2d");

    opponentNameLabel.textContent = match.opponentName || "uitploeg";
    document.querySelector(".scorebord-home .scorebord-score-home").textContent = match.homeScore || 0;
    document.querySelector(".scorebord-away .scorebord-score-away").textContent = match.awayScore || 0;

    // ---- Persistence ----

    function loadState() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }

    function saveState() {
        const homeScoreEl = document.querySelector(".scorebord-home .scorebord-score-home");
        const awayScoreEl = document.querySelector(".scorebord-away .scorebord-score-away");

        const state = {
            opponentName: match.opponentName,
            matchDate: match.matchDate,
            mainRoster,
            benchRoster,
            subLog,
            actionHistory,
            playerStats,
            playerCircles,
            selectedPlayer,
            opponentChances,
            opponentGoals,
            possessionLog,
            homeScore: homeScoreEl ? parseInt(homeScoreEl.textContent) || 0 : 0,
            awayScore: awayScoreEl ? parseInt(awayScoreEl.textContent) || 0 : 0,
            timerElapsedSeconds,
            timerRunning,
            timerStartEpoch
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    // ---- Possession log ("verloop"): alternates between 'ons' and 'tegenstander' automatically ----
    // Every shot-type action we tag (canvas click, Vrijworp, Penalty, Doorloper) adds to our
    // current attack. Every Kans/Tegengoal adds to the opponent's current attack. A new numbered
    // "aanval" starts automatically whenever the acting side changes, OR right after a goal -
    // a goal always ends the attack, even if the very next action is by the same side again.

    function logPossession(team) {
        const last = possessionLog[possessionLog.length - 1];
        if (!forceNewAttack && last && last.team === team) {
            last.count++;
        } else {
            possessionLog.push({ team: team, count: 1, goal: false });
        }
        forceNewAttack = false;
    }

    // Marks the attack that was just logged as goal-scoring, and forces the next one to be new
    function markLastPossessionAsGoal() {
        const last = possessionLog[possessionLog.length - 1];
        if (last) last.goal = true;
        forceNewAttack = true;
    }

    function undoPossession(wasGoal) {
        const last = possessionLog[possessionLog.length - 1];
        if (!last) return;
        last.count--;
        if (last.count <= 0) {
            possessionLog.pop();
        } else if (wasGoal) {
            last.goal = false;
        }
        if (wasGoal) {
            forceNewAttack = false;
        }
    }

    function updateOpponentChanceDisplay() {
        const pct = opponentChances > 0 ? Math.round((opponentGoals / opponentChances) * 100) : 0;
        document.getElementById("opponentChanceTotal").textContent =
            "Kansen tegenstander: " + opponentChances + " | Doelpunten: " + opponentGoals + "/" + opponentChances + " (" + pct + "%)";
    }

    // ---- Roster rendering ----

    function makePlayerLi(player) {
        const li = document.createElement("li");
        li.dataset.number = player.number;
        li.innerHTML = "<span class='player-number'>" + player.number + "</span>" +
            "<span class='player-name-text'>" + player.name + "</span>";
        return li;
    }

    function renderRosters() {
        attackList.innerHTML = "";
        defenceList.innerHTML = "";
        benchList.innerHTML = "";

        mainRoster.filter(function (p) { return p.position === "attack"; })
            .forEach(function (p) { attackList.appendChild(makePlayerLi(p)); });
        mainRoster.filter(function (p) { return p.position === "defence"; })
            .forEach(function (p) { defenceList.appendChild(makePlayerLi(p)); });
        benchRoster.forEach(function (p) { benchList.appendChild(makePlayerLi(p)); });

        updatePlayerListStyles();
        updateBenchListStyles();
    }

    function updatePlayerListStyles() {
        document.querySelectorAll(".player-list li").forEach(function (li) {
            const name = li.querySelector(".player-name-text").innerText;
            li.classList.toggle("selected", name === selectedPlayer);
        });
    }

    function updateBenchListStyles() {
        const benchItems = benchList.getElementsByTagName("LI");
        for (const item of benchItems) {
            const name = item.querySelector(".player-name-text").innerText;
            item.classList.toggle("selected", name === selectedBenchPlayer);
        }
    }

    const subLogList = document.getElementById("subLogList");

    function updateSubLogBadge() {
        subLogBadge.textContent = "Wissels: " + subLog.length + "/" + MAX_SUBS;
        subLogList.innerHTML = subLog.map(function (s) {
            return "<li>" + s.index + ". " + s.outNumber + " &rarr; " + s.inNumber + "</li>";
        }).join("");
    }

    renderRosters();
    updateSubLogBadge();

    // ---- Selecting a player to tag actions for ----

    document.querySelectorAll(".player-list").forEach(function (list) {
        list.addEventListener("click", function (event) {
            const li = event.target.closest("li");
            if (!li) return;
            const name = li.querySelector(".player-name-text").innerText;

            // If a bench player is selected, this click swaps them in instead of selecting for tagging
            if (selectedBenchPlayer) {
                swapPlayers(li, name);
                return;
            }

            selectedPlayer = (name === selectedPlayer) ? null : name;
            updatePlayerListStyles();
            saveState();

            if (selectedPlayer) {
                renderPlayerCanvas(selectedPlayer);
            } else {
                ctx.clearRect(0, 0, shotCanvas.width, shotCanvas.height);
            }
        });
    });

    // ---- Bench: select a bench player, then click a main player to swap them ----

    benchList.addEventListener("click", function (event) {
        const li = event.target.closest("li");
        if (!li) return;
        const name = li.querySelector(".player-name-text").innerText;
        selectedBenchPlayer = (name === selectedBenchPlayer) ? null : name;
        updateBenchListStyles();
    });

    function swapPlayers(mainListItemEl, mainPlayerName) {
        if (subLog.length >= MAX_SUBS) {
            alert("Je hebt het maximum van " + MAX_SUBS + " wissels al bereikt.");
            selectedBenchPlayer = null;
            updateBenchListStyles();
            return;
        }

        const mainNumber = mainListItemEl.dataset.number;
        const mainIndex = mainRoster.findIndex(function (p) { return String(p.number) === String(mainNumber); });
        const benchIndex = benchRoster.findIndex(function (p) { return p.name === selectedBenchPlayer; });
        if (mainIndex === -1 || benchIndex === -1) return;

        const mainPlayer = mainRoster[mainIndex];
        const benchPlayer = benchRoster[benchIndex];

        mainRoster[mainIndex] = { number: benchPlayer.number, name: benchPlayer.name, position: mainPlayer.position };
        benchRoster[benchIndex] = { number: mainPlayer.number, name: mainPlayer.name };

        subLog.push({ index: subLog.length + 1, outNumber: mainPlayer.number, inNumber: benchPlayer.number });

        // If the player who just went to the bench was selected for shot-tagging, deselect them
        if (selectedPlayer === mainPlayer.name) {
            selectedPlayer = null;
            ctx.clearRect(0, 0, shotCanvas.width, shotCanvas.height);
        }

        selectedBenchPlayer = null;
        renderRosters();
        updateSubLogBadge();
        saveState();
    }

    // ---- Shot map canvas ----

    function renderPlayerCanvas(player) {
        ctx.clearRect(0, 0, shotCanvas.width, shotCanvas.height);
        drawPlayerCircles(player);
    }

    function drawPlayerCircles(player) {
        const circles = playerCircles[player] || [];
        for (const circle of circles) {
            ctx.fillStyle = circle.isGoal ? "green" : "red";
            ctx.beginPath();
            ctx.arc(circle.x, circle.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
    }

    if (selectedPlayer && playerStats[selectedPlayer]) {
        renderPlayerCanvas(selectedPlayer);
    }

    document.getElementById("goalCheckbox").addEventListener("change", function () {
        isGoal = this.checked;
    });

    shotCanvas.addEventListener("click", function (event) {
        if (!selectedPlayer) return;

        const rect = shotCanvas.getBoundingClientRect();
        const scaleX = shotCanvas.width / rect.width;
        const scaleY = shotCanvas.height / rect.height;
        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;

        ctx.fillStyle = isGoal ? "green" : "red";
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        playerCircles[selectedPlayer] = playerCircles[selectedPlayer] || [];
        playerCircles[selectedPlayer].push({ x, y, isGoal });

        playerStats[selectedPlayer] = playerStats[selectedPlayer] || { shots: 0, goals: 0, actions: {} };
        playerStats[selectedPlayer].shots++;
        if (isGoal) {
            playerStats[selectedPlayer].goals++;
            updateHomeScore(1);
        }

        actionHistory.push({ type: "shot", player: selectedPlayer, isGoal: isGoal });
        logPossession("ons");
        if (isGoal) markLastPossessionAsGoal();

        updatePlayerStats();
    });

    // ---- Scoreboard ----

    document.querySelectorAll(".scorebord-button").forEach(function (button) {
        button.addEventListener("click", function () {
            const delta = parseInt(button.dataset.delta, 10);
            const team = button.dataset.team;
            if (team === "home") {
                updateHomeScore(delta, true);
            } else {
                updateAwayScore(delta);
            }
        });
    });

    function updateAwayScore(points) {
        const el = document.querySelector(".scorebord-away .scorebord-score-away");
        let currentScore = parseInt(el.textContent);
        currentScore = Math.max(currentScore + points, 0);
        el.textContent = currentScore;
        saveState();
    }

    function updateHomeScore(points, undo = false) {
        const el = document.querySelector(".scorebord-home .scorebord-score-home");
        let currentScore = parseInt(el.textContent);
        currentScore = undo ? Math.max(currentScore + points, 0) : currentScore + points;
        el.textContent = currentScore;
        saveState();
    }

    // ---- Action buttons (Vrijworp, Penalty, Doorloper, Rebound, Assist, Steal, Tegengoal) ----

    const SHOT_ACTIONS = ["Vrijworp", "Penalty", "Doorloper"];
    const SUPPORT_ACTIONS = ["Rebound", "Assist", "Steal"];

    document.querySelectorAll(".action-button").forEach(function (button) {
        if (button.id === "zeroChanceButton") return;
        button.addEventListener("click", function () {
            const action = button.textContent;
            if (selectedPlayer) {
                handleAction(selectedPlayer, action);
            }
        });
    });

    function handleAction(player, action) {
        const isGoalNow = document.getElementById("goalCheckbox").checked;

        playerStats[player] = playerStats[player] || { shots: 0, goals: 0, actions: {} };
        playerStats[player].actions = playerStats[player].actions || {};

        if (action === "Tegengoal") {
            playerStats[player].actions["Tegengoal"] = (playerStats[player].actions["Tegengoal"] || 0) + 1;
            updateAwayScore(1);
            opponentChances++;
            opponentGoals++;
            logPossession("tegenstander");
            markLastPossessionAsGoal();
            updateOpponentChanceDisplay();
            actionHistory.push({ type: "tegengoal", player: player });
        } else if (SUPPORT_ACTIONS.includes(action)) {
            playerStats[player].actions[action] = (playerStats[player].actions[action] || 0) + 1;
            actionHistory.push({ type: "support", player: player, action: action });
        } else if (SHOT_ACTIONS.includes(action)) {
            const actionKey = isGoalNow ? `${action} goal` : `${action} no goal`;
            playerStats[player].actions[actionKey] = (playerStats[player].actions[actionKey] || 0) + 1;
            playerStats[player].shots++;

            if (isGoalNow) {
                playerStats[player].goals++;
                updateHomeScore(1);
            }

            actionHistory.push({ type: "shotAction", player: player, actionKey: actionKey, isGoal: isGoalNow });
            logPossession("ons");
            if (isGoalNow) markLastPossessionAsGoal();
        }

        updatePlayerStats();
    }

    // ---- 0-kans: explicitly log that we had possession but took no chances at all ----
    // (this can't be inferred from clicks, since nothing gets clicked - it needs its own button)

    document.getElementById("zeroChanceButton").addEventListener("click", function () {
        possessionLog.push({ team: "ons", count: 0 });
        actionHistory.push({ type: "zeroChance" });
        saveState();
    });

    // ---- Global chronological undo (shots + actions, any player) ----

    const undoButton = document.getElementById("undoButton");
    undoButton.addEventListener("click", undoLast);

    function undoLast() {
        const entry = actionHistory.pop();
        if (!entry) return;

        if (entry.type === "opponentKans") {
            opponentChances = Math.max(opponentChances - 1, 0);
            undoPossession();
            updateOpponentChanceDisplay();
            saveState();
            return;
        }

        if (entry.type === "zeroChance" || entry.type === "opponentZeroChance") {
            undoPossession();
            saveState();
            return;
        }

        const stats = playerStats[entry.player];
        if (!stats) {
            saveState();
            return;
        }

        if (entry.type === "shot") {
            const circles = playerCircles[entry.player];
            if (circles && circles.length > 0) circles.pop();
            stats.shots = Math.max(stats.shots - 1, 0);
            if (entry.isGoal) {
                stats.goals = Math.max(stats.goals - 1, 0);
                updateHomeScore(-1, true);
            }
            undoPossession(entry.isGoal);
            if (entry.player === selectedPlayer) {
                renderPlayerCanvas(selectedPlayer);
            }
        } else if (entry.type === "tegengoal") {
            stats.actions["Tegengoal"] = Math.max((stats.actions["Tegengoal"] || 0) - 1, 0);
            updateAwayScore(-1);
            opponentChances = Math.max(opponentChances - 1, 0);
            opponentGoals = Math.max(opponentGoals - 1, 0);
            undoPossession(true);
            updateOpponentChanceDisplay();
        } else if (entry.type === "support") {
            stats.actions[entry.action] = Math.max((stats.actions[entry.action] || 0) - 1, 0);
        } else if (entry.type === "shotAction") {
            stats.actions[entry.actionKey] = Math.max((stats.actions[entry.actionKey] || 0) - 1, 0);
            stats.shots = Math.max(stats.shots - 1, 0);
            if (entry.isGoal) {
                stats.goals = Math.max(stats.goals - 1, 0);
                updateHomeScore(-1, true);
            }
            undoPossession(entry.isGoal);
        }

        updatePlayerStats();
    }

    function updatePlayerStats() {
        saveState();
    }

    // ---- Match clock: counts DOWN from 25:00, one alert when it hits 0 ----

    const HELFT_DURATION_SECONDS = 25 * 60;

    const startButton = document.getElementById("startButton");
    const pauseButton = document.getElementById("pauseButton");
    const timerElement = document.getElementById("timer");

    let timeUpAlertShown = false;

    function getElapsedSeconds() {
        if (timerRunning && timerStartEpoch) {
            return timerElapsedSeconds + (Date.now() - timerStartEpoch) / 1000;
        }
        return timerElapsedSeconds;
    }

    function getRemainingSeconds() {
        return Math.max(HELFT_DURATION_SECONDS - getElapsedSeconds(), 0);
    }

    function updateTimerDisplay() {
        const totalSeconds = Math.ceil(getRemainingSeconds());
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        timerElement.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        if (totalSeconds <= 0 && timerRunning && !timeUpAlertShown) {
            timeUpAlertShown = true;
            pauseTimer();
            alert("Tijd is om!");
        }
    }

    function startTimer() {
        if (timerRunning) return;
        timerRunning = true;
        timerStartEpoch = Date.now();
        timerInterval = setInterval(updateTimerDisplay, 1000);
        saveState();
    }

    function pauseTimer() {
        if (!timerRunning) return;
        timerElapsedSeconds += (Date.now() - timerStartEpoch) / 1000;
        timerRunning = false;
        timerStartEpoch = null;
        clearInterval(timerInterval);
        timerInterval = null;
        updateTimerDisplay();
        saveState();
    }

    startButton.addEventListener("click", startTimer);
    pauseButton.addEventListener("click", pauseTimer);

    document.getElementById("resetClockButton").addEventListener("click", function () {
        pauseTimer();
        timerElapsedSeconds = 0;
        timeUpAlertShown = false;
        updateTimerDisplay();
        saveState();
    });

    updateTimerDisplay();
    if (timerRunning) {
        timerInterval = setInterval(updateTimerDisplay, 1000);
    }

    // ---- Kans: logs a chance/attempt for the OPPONENT (any attempt counts, no detail needed) ----

    updateOpponentChanceDisplay();

    document.getElementById("kansButton").addEventListener("click", function () {
        opponentChances++;
        actionHistory.push({ type: "opponentKans" });
        logPossession("tegenstander");
        updateOpponentChanceDisplay();
        saveState();
    });

    document.getElementById("opponentZeroChanceButton").addEventListener("click", function () {
        possessionLog.push({ team: "tegenstander", count: 0 });
        actionHistory.push({ type: "opponentZeroChance" });
        saveState();
    });
};
