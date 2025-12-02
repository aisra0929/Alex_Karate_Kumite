document.addEventListener('DOMContentLoaded', () => {
    const MATCH_DURATIONS = [
        '00:30', '01:00', '01:30', '02:00', '02:30',
        '03:00', '03:30', '04:00', '04:30', '05:00',
    ];
    const WEIGHT_CLASSES = {
        Male: ['-60 kg', '-67 kg', '-75 kg', '-84 kg', '+84 kg'],
        Female: ['-50 kg', '-55 kg', '-61 kg', '-68 kg', '+68 kg'],
    };
    const STORAGE_KEY = 'ekfScoreboardLogs';
    const GAP_LIMIT = 8;
    const PDF_LINE_LIMIT = 90;
    const PDF_PAGE = { width: 612, height: 792, margin: 50, lineHeight: 14 };

    const els = {
        setupOverlay: document.getElementById('setup-screen'),
        playerCountSelect: document.getElementById('player-count-select'),
        playerGrid: document.getElementById('player-name-grid'),
        matchDurationSelect: document.getElementById('match-duration-select'),
        genderSelect: document.getElementById('gender-select'),
        weightSelect: document.getElementById('weight-class-select'),
        startTournamentBtn: document.getElementById('start-tournament-btn'),
        historyTriggers: document.querySelectorAll('[data-history-trigger], #history-btn'),
        roundBanner: document.getElementById('round-banner'),
        roundNumber: document.getElementById('round-number'),
        aoNameInput: document.getElementById('ao-name-input'),
        akaNameInput: document.getElementById('aka-name-input'),
        aoScore: document.getElementById('ao-score'),
        akaScore: document.getElementById('aka-score'),
        aoSenshu: document.getElementById('ao-senshu'),
        akaSenshu: document.getElementById('aka-senshu'),
        scoreButtons: document.querySelectorAll('.score-btn'),
        penaltyButtons: document.querySelectorAll('.penalty-btn'),
        startPauseBtn: document.getElementById('start-pause-btn'),
        resetBtn: document.getElementById('reset-timer-btn'),
        timerDisplay: document.getElementById('timer'),
        fullscreenBtn: document.getElementById('fullscreen-btn'),
        scoreboardUi: document.getElementById('scoreboard-ui'),
        aoFlagScore: document.getElementById('ao-flag-score'),
        akaFlagScore: document.getElementById('aka-flag-score'),
        aoFlagControls: document.getElementById('ao-flag-controls'),
        akaFlagControls: document.getElementById('aka-flag-controls'),
        swapBtn: document.getElementById('swap-sides-btn'),
        historyModal: document.getElementById('history-modal'),
        historyList: document.getElementById('history-list'),
        historyPreview: document.getElementById('history-preview'),
        historyClose: document.querySelector('[data-close-history]'),
        eraseHistoryBtn: document.getElementById('erase-history-btn'),
        winnerModal: document.getElementById('winner-modal'),
        winnerModalClose: document.getElementById('winner-modal-close'),
        winnerTitle: document.getElementById('winner-title'),
        winnerMessage: document.getElementById('winner-message'),
        winnerDeclareAo: document.getElementById('declare-ao-winner'),
        winnerDeclareAka: document.getElementById('declare-aka-winner'),
        winnerNextBtn: document.getElementById('winner-modal-next'),
        winnerActions: document.querySelector('.winner-actions'),
        bracketGrid: document.getElementById('bracket-grid'),
        bracketStatus: document.getElementById('bracket-status'),
        refereeInput: document.getElementById('referee-input'),
    };

    const state = {
        timer: {
            duration: 120,
            remaining: 120,
            ticking: false,
            intervalId: null,
        },
        scores: { ao: 0, aka: 0 },
        penalties: { ao: [], aka: [] },
        roundCount: 1,
        logBuffer: [],
        matchStartTime: null,
        tournament: {
            playerCount: 0,
            players: [],
            rounds: [],
            active: { roundIndex: 0, matchIndex: 0 },
            division: { gender: 'Male', weightClass: WEIGHT_CLASSES.Male[0] },
        },
        playerFlags: {},
        controlsLocked: true,
    };

    /**
     * Utility helpers
     */
    const secondsFromLabel = (label) => {
        const [m, s] = label.split(':').map(Number);
        return (m * 60) + s;
    };

    const formatClock = (totalSeconds) => {
        const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const seconds = (totalSeconds % 60).toString().padStart(2, '0');
        return `${minutes}:${seconds}`;
    };

    const showToast = (text) => {
        els.roundBanner.textContent = text;
        els.roundBanner.classList.remove('hidden');
        requestAnimationFrame(() => els.roundBanner.classList.add('visible'));
        setTimeout(() => {
            els.roundBanner.classList.remove('visible');
            setTimeout(() => els.roundBanner.classList.add('hidden'), 300);
        }, 2500);
    };

    /**
     * Setup screen
     */
    const renderPlayerInputs = () => {
        const count = Number(els.playerCountSelect.value);
        els.playerGrid.innerHTML = '';
        for (let i = 1; i <= count; i += 1) {
            const index = i - 1;
            const wrapper = document.createElement('label');
            wrapper.className = 'player-input';
            wrapper.innerHTML = `
                Player ${i}
                <input type="text" data-player-index="${index}" placeholder="Enter name">
                <div class="player-flag-row">
                    <input type="file" accept="image/*" data-player-flag="${index}">
                    <img class="player-flag-preview" data-player-flag-preview="${index}" alt="Flag preview">
                </div>
            `;
            els.playerGrid.appendChild(wrapper);
            const preview = wrapper.querySelector('.player-flag-preview');
            const existingFlag = state.playerFlags[index];
            if (existingFlag && preview) {
                preview.src = existingFlag;
                preview.style.display = 'block';
            }
        }
    };

    const populateMatchDurations = () => {
        const fragment = document.createDocumentFragment();
        MATCH_DURATIONS.forEach((label) => {
            const opt = document.createElement('option');
            opt.value = label;
            opt.textContent = label;
            if (label === '02:00') opt.selected = true;
            fragment.appendChild(opt);
        });
        els.matchDurationSelect.appendChild(fragment);
    };

    const populateWeightClasses = (gender) => {
        const classes = WEIGHT_CLASSES[gender] || [];
        els.weightSelect.innerHTML = '';
        classes.forEach((label, index) => {
            const opt = document.createElement('option');
            opt.value = label;
            opt.textContent = label;
            if (index === 0) opt.selected = true;
            els.weightSelect.appendChild(opt);
        });
    };

    const syncDivisionSelection = () => {
        state.tournament.division = {
            gender: els.genderSelect.value,
            weightClass: els.weightSelect.value,
        };
    };

    const gatherPlayerConfigs = () => {
        const inputs = els.playerGrid.querySelectorAll('input[data-player-index]');
        return Array.from(inputs).map((input) => {
            const idx = Number(input.dataset.playerIndex);
            const name = input.value.trim() || `Player ${idx + 1}`;
            const flag = state.playerFlags[idx] || null;
            return { name, seed: idx + 1, flag };
        });
    };

    const createInitialBracket = (players) => {
        const rounds = [];
        let currentPlayers = players.map((entry, idx) => {
            if (typeof entry === 'string') {
                return { name: entry, seed: idx + 1, flag: null };
            }
            return {
                name: entry.name,
                seed: entry.seed ?? idx + 1,
                flag: entry.flag || null,
            };
        });
        let roundIndex = 0;

        while (currentPlayers.length > 1) {
            const roundMatches = [];
            for (let i = 0; i < currentPlayers.length; i += 2) {
                roundMatches.push({
                    id: `R${roundIndex + 1}-M${(i / 2) + 1}`,
                    players: [currentPlayers[i] || null, currentPlayers[i + 1] || null],
                    winner: null,
                    complete: false,
                });
            }
            rounds.push(roundMatches);
            currentPlayers = roundMatches.map(() => ({ name: 'TBD', seed: null, flag: null }));
            roundIndex += 1;
        }

        state.tournament.rounds = rounds;
    };

    const renderBracket = () => {
        const { rounds } = state.tournament;
        els.bracketGrid.innerHTML = '';
        rounds.forEach((matches, roundIdx) => {
            const column = document.createElement('div');
            column.className = 'round-column';
            const title = document.createElement('h4');
            title.textContent = `Round ${roundIdx + 1}`;
            column.appendChild(title);

            matches.forEach((match) => {
                const p1 = match.players[0] || {};
                const p2 = match.players[1] || {};
                const p1Flag = p1.flag ? `<img src="${p1.flag}" alt="" class="bracket-flag">` : '';
                const p2Flag = p2.flag ? `<img src="${p2.flag}" alt="" class="bracket-flag">` : '';
                const card = document.createElement('div');
                card.className = `match-card ${match.winner ? 'winner-known' : ''}`;
                card.innerHTML = `
                    <div class="match-title">${match.id}</div>
                    <div class="competitor">${p1Flag}<span>${p1.name || 'TBD'}</span> <span>${match.winner === 0 ? '✔' : ''}</span></div>
                    <div class="competitor">${p2Flag}<span>${p2.name || 'TBD'}</span> <span>${match.winner === 1 ? '✔' : ''}</span></div>
                `;
                column.appendChild(card);
            });
            els.bracketGrid.appendChild(column);
        });
        const division = state.tournament.division;
        const divisionLabel = division ? ` • ${division.gender} ${division.weightClass}` : '';
        els.bracketStatus.textContent = `Round ${state.tournament.active.roundIndex + 1} • Match ${state.tournament.active.matchIndex + 1}${divisionLabel}`;
    };

    /**
     * Scoreboard helpers
     */
    const updateScoreDisplays = () => {
        els.aoScore.textContent = state.scores.ao;
        els.akaScore.textContent = state.scores.aka;
    };

    const resetPenalties = () => {
        els.penaltyButtons.forEach((btn) => btn.classList.remove('active'));
        state.penalties = { ao: [], aka: [] };
    };

    const resetSenshu = () => {
        [els.aoSenshu, els.akaSenshu].forEach((indicator) => indicator.classList.remove('active'));
    };

    const resetScores = () => {
        state.scores = { ao: 0, aka: 0 };
        updateScoreDisplays();
    };

    const updateTimerDisplay = () => {
        els.timerDisplay.textContent = formatClock(state.timer.remaining);
    };

    const setTimerDuration = (seconds) => {
        state.timer.duration = seconds;
        state.timer.remaining = seconds;
        updateTimerDisplay();
    };

    const lockControls = (locked) => {
        state.controlsLocked = locked;
        [...els.scoreButtons, ...els.penaltyButtons, els.swapBtn, els.aoSenshu, els.akaSenshu].forEach((el) => {
            el.disabled = locked;
            el.classList.toggle('disabled', locked);
        });
    };

    const startTimer = () => {
        if (state.timer.ticking || state.controlsLocked) return;
        state.timer.ticking = true;
        state.matchStartTime = state.matchStartTime || new Date();
        els.startPauseBtn.innerHTML = '&#10074;&#10074;';
        state.timer.intervalId = setInterval(() => {
            if (state.timer.remaining <= 0) {
                stopTimer();
                const winner = decideWinnerByScore();
                if (winner) {
                    declareWinner(winner, 'Time elapsed');
                } else {
                    lockControls(true);
                    els.winnerTitle.textContent = 'Time up';
                    els.winnerMessage.textContent = 'Scores tied. Please declare a winner.';
                    els.winnerActions.classList.remove('hidden');
                    els.winnerModal.classList.remove('hidden');
                }
                return;
            }
            state.timer.remaining -= 1;
            updateTimerDisplay();
        }, 1000);
    };

    const stopTimer = () => {
        if (state.timer.intervalId) {
            clearInterval(state.timer.intervalId);
            state.timer.intervalId = null;
        }
        state.timer.ticking = false;
        els.startPauseBtn.innerHTML = '&#9658;';
    };

    const resetTimer = () => {
        stopTimer();
        state.timer.remaining = state.timer.duration;
        updateTimerDisplay();
    };

    const handleScoreChange = (team, delta, label) => {
        if (state.controlsLocked) return;
        const next = state.scores[team] + delta;
        state.scores[team] = Math.max(0, next);
        updateScoreDisplays();
        recordLog(`${team.toUpperCase()} score ${delta > 0 ? '+' : ''}${delta} (${label}) → ${state.scores[team]}`);
        checkGapRule();
    };

    const handlePenalty = (btn) => {
        if (state.controlsLocked) return;
        btn.classList.toggle('active');
        const team = btn.closest('.penalty-grid').dataset.team;
        const penalty = btn.dataset.penalty;
        if (btn.classList.contains('active')) {
            state.penalties[team].push(penalty);
            recordLog(`${team.toUpperCase()} penalty: ${penalty}`);
        } else {
            state.penalties[team] = state.penalties[team].filter((p) => p !== penalty);
            recordLog(`${team.toUpperCase()} penalty cleared: ${penalty}`);
        }
    };

    const toggleSenshu = (indicator) => {
        if (state.controlsLocked) return;
        const team = indicator.dataset.team;
        const other = team === 'ao' ? els.akaSenshu : els.aoSenshu;
        indicator.classList.toggle('active');
        if (indicator.classList.contains('active')) {
            other.classList.remove('active');
            recordLog(`${team.toUpperCase()} gains Senshu`);
        } else {
            recordLog(`${team.toUpperCase()} loses Senshu`);
        }
    };

    const checkGapRule = () => {
        const gap = Math.abs(state.scores.ao - state.scores.aka);
        if (gap >= GAP_LIMIT) {
            const winner = state.scores.ao > state.scores.aka ? 'ao' : 'aka';
            declareWinner(winner, `${GAP_LIMIT}-point gap reached`);
        }
    };

    const decideWinnerByScore = () => {
        if (state.scores.ao === state.scores.aka) return null;
        return state.scores.ao > state.scores.aka ? 'ao' : 'aka';
    };

    /**
     * Logging helpers
     */
    const recordLog = (line) => {
        const stamp = new Date().toLocaleTimeString();
        state.logBuffer.push(`[${stamp}] ${line}`);
    };

    const getStoredLogs = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

    const persistLogs = (logs) => localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));

    const saveMatchLog = (winnerTeam, reason) => {
        const logs = getStoredLogs();
        const start = state.matchStartTime ? state.matchStartTime.toISOString() : new Date().toISOString();
        const end = new Date().toISOString();
        const timerLabel = formatClock(state.timer.duration);
        const winnerName = winnerTeam === 'ao' ? els.aoNameInput.value : els.akaNameInput.value;
        const loserName = winnerTeam === 'ao' ? els.akaNameInput.value : els.aoNameInput.value;
        const header = [
            `Match Start: ${start}`,
            `Match End: ${end}`,
            `Round: ${state.roundCount}`,
            `Configured Time: ${timerLabel}`,
            `Winner: ${winnerName}`,
            `Loser: ${loserName}`,
            `Reason: ${reason}`,
            `Bracket Position: Round ${state.tournament.active.roundIndex + 1} Match ${state.tournament.active.matchIndex + 1}`,
            `Division: ${state.tournament.division.gender} ${state.tournament.division.weightClass}`,
            `Referee: ${els.refereeInput.value || 'N/A'}`,
        ];
        const body = header.concat(['--- Events ---', ...state.logBuffer, '--- Scoreboard ---', `AO: ${state.scores.ao}`, `AKA: ${state.scores.aka}`]);
        const content = body.join('\n');
        const filename = `match-${end.replace(/[:T]/g, '-').split('.')[0]}.txt`;
        logs.unshift({ id: Date.now(), filename, content });
        persistLogs(logs);
    };

    const renderHistoryList = (logs) => {
        els.historyList.innerHTML = '';
        if (!logs.length) {
            els.historyPreview.textContent = 'No saved matches yet.';
            return;
        }

        els.historyPreview.textContent = 'Select a log to preview its contents.';

        logs.forEach((log) => {
            const li = document.createElement('li');
            li.dataset.logId = log.id;

            const selectBtn = document.createElement('button');
            selectBtn.type = 'button';
            selectBtn.className = 'history-entry';
            selectBtn.textContent = log.filename;
            selectBtn.addEventListener('click', () => {
                els.historyList.querySelectorAll('li').forEach((item) => item.classList.remove('active'));
                li.classList.add('active');
                els.historyPreview.textContent = log.content;
            });

            const pdfBtn = document.createElement('button');
            pdfBtn.type = 'button';
            pdfBtn.className = 'history-download-btn';
            pdfBtn.textContent = 'Download PDF';
            pdfBtn.addEventListener('click', (evt) => {
                evt.stopPropagation();
                downloadLogAsPdf(log);
            });

            li.appendChild(selectBtn);
            li.appendChild(pdfBtn);
            els.historyList.appendChild(li);
        });
    };

    const openHistoryModal = () => {
        renderHistoryList(getStoredLogs());
        els.historyModal.classList.remove('hidden');
    };

    const closeHistoryModal = () => els.historyModal.classList.add('hidden');

    const eraseHistory = () => {
        if (!window.confirm('Erase all saved match history? This cannot be undone.')) return;
        persistLogs([]);
        renderHistoryList([]);
    };

    const escapePdfText = (text) => text
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');

    const wrapPdfLines = (text) => {
        const wrapped = [];
        const rawLines = text.split('\n');
        rawLines.forEach((line) => {
            let working = line || ' ';
            while (working.length > PDF_LINE_LIMIT) {
                wrapped.push(working.slice(0, PDF_LINE_LIMIT));
                working = working.slice(PDF_LINE_LIMIT);
            }
            wrapped.push(working.length ? working : ' ');
        });
        return wrapped;
    };

    const createPdfBlob = (text) => {
        const lines = wrapPdfLines(text).map(escapePdfText);
        const maxLinesPerPage = Math.floor((PDF_PAGE.height - (PDF_PAGE.margin * 2)) / PDF_PAGE.lineHeight);
        const chunks = [];
        for (let i = 0; i < lines.length; i += maxLinesPerPage) {
            chunks.push(lines.slice(i, i + maxLinesPerPage));
        }
        if (!chunks.length) chunks.push([' ']);

        const objects = [];
        const addObject = (body) => {
            objects.push(body);
            return objects.length;
        };

        addObject('<< /Type /Catalog /Pages 2 0 R >>'); // 1
        const pagesIndex = addObject('__PAGES__'); // 2 placeholder
        const fontIndex = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'); // 3
        const pageNumbers = [];

        chunks.forEach((chunk) => {
            let contentStream = 'BT\n/F1 12 Tf\n14 TL\n';
            contentStream += `50 ${PDF_PAGE.height - PDF_PAGE.margin} Td\n`;
            chunk.forEach((line, idx) => {
                if (idx > 0) contentStream += 'T*\n';
                contentStream += `(${line || ' '}) Tj\n`;
            });
            contentStream += 'ET';
            const contentIndex = addObject(`<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`);
            const pageIndex = addObject(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE.width} ${PDF_PAGE.height}] /Contents ${contentIndex} 0 R /Resources << /Font << /F1 ${fontIndex} 0 R >> >> >>`);
            pageNumbers.push(pageIndex);
        });

        objects[pagesIndex - 1] = `<< /Type /Pages /Kids [${pageNumbers.map((num) => `${num} 0 R`).join(' ')}] /Count ${pageNumbers.length} >>`;

        let pdf = '%PDF-1.4\n';
        const offsets = [0];
        objects.forEach((body, idx) => {
            offsets[idx + 1] = pdf.length;
            pdf += `${idx + 1} 0 obj\n${body}\nendobj\n`;
        });
        const xrefPosition = pdf.length;
        pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
        for (let i = 1; i <= objects.length; i += 1) {
            pdf += `${offsets[i].toString().padStart(10, '0')} 00000 n \n`;
        }
        pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPosition}\n%%EOF`;
        return new Blob([pdf], { type: 'application/pdf' });
    };

    const downloadLogAsPdf = (log) => {
        const blob = createPdfBlob(log.content);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = log.filename.replace('.txt', '.pdf');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(link.href), 0);
    };

    /**
     * Winner & match flow
     */
    const declareWinner = (team, reason) => {
        stopTimer();
        lockControls(true);
        const winnerName = team === 'ao' ? els.aoNameInput.value : els.akaNameInput.value;
        const loserName = team === 'ao' ? els.akaNameInput.value : els.aoNameInput.value;
        els.winnerTitle.textContent = `${winnerName} wins!`;
        els.winnerMessage.textContent = `${winnerName} defeated ${loserName}. Reason: ${reason}.`;
        els.winnerActions.classList.add('hidden');
        els.winnerModal.classList.remove('hidden');
        saveMatchLog(team, reason);
        advanceBracket(team);
    };

    const advanceBracket = (winnerTeam) => {
        const { rounds, active } = state.tournament;
        const match = rounds[active.roundIndex][active.matchIndex];
        match.complete = true;
        const winnerIndex = winnerTeam === 'ao' ? 0 : 1;
        match.winner = winnerIndex;

        const nextRound = rounds[active.roundIndex + 1];
        if (nextRound) {
            const targetMatch = nextRound[Math.floor(active.matchIndex / 2)];
            if (targetMatch) {
                const winnerPlayer = match.players[winnerIndex] || { name: winnerIndex === 0 ? els.aoNameInput.value : els.akaNameInput.value, flag: null, seed: null };
                targetMatch.players[active.matchIndex % 2] = { ...winnerPlayer };
            }
        }

        renderBracket();
    };

    const closeWinnerModal = () => {
        els.winnerModal.classList.add('hidden');
    };

    const loadNextMatch = () => {
        const { active, rounds } = state.tournament;
        const nextIndex = active.matchIndex + 1;
        if (nextIndex < rounds[active.roundIndex].length) {
            state.tournament.active.matchIndex = nextIndex;
        } else if (active.roundIndex + 1 < rounds.length) {
            state.tournament.active.roundIndex += 1;
            state.tournament.active.matchIndex = 0;
        } else {
            showToast('Tournament complete!');
            return;
        }
        state.roundCount += 1;
        updateRoundUI();
        prepareMatch();
    };

    const updateRoundUI = () => {
        els.roundNumber.textContent = state.roundCount;
        showToast(`Round ${state.roundCount} – Get Ready`);
    };

    const prepareMatch = () => {
        resetScores();
        resetPenalties();
        resetSenshu();
        state.logBuffer = [];
        state.matchStartTime = null;
        lockControls(false);
        resetTimer();
        const { roundIndex, matchIndex } = state.tournament.active;
        const match = state.tournament.rounds[roundIndex][matchIndex];
        const [playerA = { name: 'TBD', flag: null }, playerB = { name: 'TBD', flag: null }] = match.players;
        els.aoNameInput.value = playerA.name;
        els.akaNameInput.value = playerB.name;
        const applyFlag = (img, src) => {
            if (!img) return;
            if (src) {
                img.src = src;
                img.style.display = 'block';
            } else {
                img.removeAttribute('src');
                img.style.display = 'none';
            }
        };
        applyFlag(els.aoFlagScore, playerA.flag);
        applyFlag(els.akaFlagScore, playerB.flag);
        applyFlag(els.aoFlagControls, playerA.flag);
        applyFlag(els.akaFlagControls, playerB.flag);
        recordLog(`Match ready: ${playerA.name} vs ${playerB.name}`);
        renderBracket();
    };

    /**
     * Swap logic
     */
    const swapSides = () => {
        if (state.controlsLocked) return;
        const left = document.querySelector('.team[data-side="left"]');
        const right = document.querySelector('.team[data-side="right"]');
        left.classList.toggle('ao');
        left.classList.toggle('aka');
        right.classList.toggle('ao');
        right.classList.toggle('aka');

        const aoName = els.aoNameInput.value;
        const akaName = els.akaNameInput.value;
        const aoScore = state.scores.ao;
        const akaScore = state.scores.aka;

        els.aoNameInput.value = akaName;
        els.akaNameInput.value = aoName;
        state.scores.ao = akaScore;
        state.scores.aka = aoScore;
        updateScoreDisplays();

        const aoSenshuActive = els.aoSenshu.classList.contains('active');
        const akaSenshuActive = els.akaSenshu.classList.contains('active');
        els.aoSenshu.classList.toggle('active', akaSenshuActive);
        els.akaSenshu.classList.toggle('active', aoSenshuActive);

        recordLog('Sides swapped (names & colors)');
    };

    /**
     * Fullscreen helpers
     */
    const getFullscreenElement = () => document.fullscreenElement
        || document.webkitFullscreenElement
        || document.mozFullScreenElement
        || document.msFullscreenElement;

    const requestFullscreen = (element) => {
        if (!element) return Promise.reject(new Error('No fullscreen target'));
        if (element.requestFullscreen) return element.requestFullscreen();
        if (element.webkitRequestFullscreen) return element.webkitRequestFullscreen();
        if (element.mozRequestFullScreen) return element.mozRequestFullScreen();
        if (element.msRequestFullscreen) return element.msRequestFullscreen();
        return Promise.reject(new Error('Fullscreen not supported'));
    };

    const exitFullscreen = () => {
        if (document.exitFullscreen) return document.exitFullscreen();
        if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
        if (document.mozCancelFullScreen) return document.mozCancelFullScreen();
        if (document.msExitFullscreen) return document.msExitFullscreen();
        return Promise.resolve();
    };

    const toggleFullscreen = () => {
        if (!els.scoreboardUi) return;
        const activeElement = getFullscreenElement();
        if (activeElement === els.scoreboardUi) {
            exitFullscreen();
        } else if (!activeElement) {
            requestFullscreen(els.scoreboardUi).catch(() => {});
        } else {
            exitFullscreen().then(() => requestFullscreen(els.scoreboardUi)).catch(() => {});
        }
    };

    /**
     * Event wiring
     */
    populateMatchDurations();
    populateWeightClasses(els.genderSelect.value);
    renderPlayerInputs();
    syncDivisionSelection();
    els.playerCountSelect.addEventListener('change', renderPlayerInputs);
    els.genderSelect.addEventListener('change', () => {
        populateWeightClasses(els.genderSelect.value);
        syncDivisionSelection();
    });
    els.weightSelect.addEventListener('change', syncDivisionSelection);

    els.playerGrid.addEventListener('change', (event) => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement)) return;
        if (input.type !== 'file' || !input.dataset.playerFlag) return;
        const index = Number(input.dataset.playerFlag);
        const file = input.files && input.files[0];
        if (!file) {
            delete state.playerFlags[index];
            const preview = els.playerGrid.querySelector(`.player-flag-preview[data-player-flag-preview="${index}"]`);
            if (preview) {
                preview.removeAttribute('src');
                preview.style.display = 'none';
            }
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const result = typeof reader.result === 'string' ? reader.result : '';
            state.playerFlags[index] = result;
            const preview = els.playerGrid.querySelector(`.player-flag-preview[data-player-flag-preview="${index}"]`);
            if (preview) {
                preview.src = result;
                preview.style.display = 'block';
            }
        };
        reader.readAsDataURL(file);
    });

    els.startTournamentBtn.addEventListener('click', () => {
        const playerConfigs = gatherPlayerConfigs();
        if (!playerConfigs.length) return;
        state.tournament.playerCount = playerConfigs.length;
        state.tournament.players = playerConfigs;
        state.tournament.active = { roundIndex: 0, matchIndex: 0 };
        syncDivisionSelection();
        createInitialBracket(playerConfigs);
        renderBracket();
        setTimerDuration(secondsFromLabel(els.matchDurationSelect.value));
        els.setupOverlay.classList.add('hidden');
        state.roundCount = 1;
        updateRoundUI();
        prepareMatch();
        recordLog(`Match duration set to ${els.matchDurationSelect.value}`);
    });

    els.matchDurationSelect.addEventListener('change', () => {
        if (state.timer.ticking || !state.controlsLocked) {
            // Prevent changing during match
            els.matchDurationSelect.value = formatClock(state.timer.duration);
            return;
        }
        setTimerDuration(secondsFromLabel(els.matchDurationSelect.value));
    });

    els.startPauseBtn.addEventListener('click', () => {
        if (state.controlsLocked) return;
        if (state.timer.ticking) {
            stopTimer();
            recordLog('Timer paused');
        } else {
            startTimer();
            recordLog('Timer started');
        }
    });

    els.resetBtn.addEventListener('click', () => {
        stopTimer();
        prepareMatch();
        recordLog('Match reset');
    });

    els.scoreButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const team = btn.dataset.team;
            const delta = Number(btn.dataset.points);
            const label = btn.textContent.trim();
            handleScoreChange(team, delta, label);
        });
    });

    els.penaltyButtons.forEach((btn) => {
        btn.addEventListener('click', () => handlePenalty(btn));
    });

    [els.aoSenshu, els.akaSenshu].forEach((indicator) => {
        indicator.addEventListener('click', () => toggleSenshu(indicator));
    });

    els.swapBtn.addEventListener('click', swapSides);

    els.historyTriggers.forEach((btn) => btn.addEventListener('click', openHistoryModal));
    els.historyClose.addEventListener('click', closeHistoryModal);
    if (els.eraseHistoryBtn) {
        els.eraseHistoryBtn.addEventListener('click', eraseHistory);
    }

    els.winnerModalClose.addEventListener('click', closeWinnerModal);
    els.winnerDeclareAo.addEventListener('click', () => declareWinner('ao', 'Manual decision'));
    els.winnerDeclareAka.addEventListener('click', () => declareWinner('aka', 'Manual decision'));
    els.winnerNextBtn.addEventListener('click', () => {
        closeWinnerModal();
        loadNextMatch();
    });

    if (els.fullscreenBtn) {
        els.fullscreenBtn.addEventListener('click', toggleFullscreen);
        const fullscreenEvents = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
        const handleFsChange = () => {
            const active = getFullscreenElement() === els.scoreboardUi;
            els.fullscreenBtn.classList.toggle('active', active);
        };
        fullscreenEvents.forEach((evt) => document.addEventListener(evt, handleFsChange));
    }

    // Initialize timer display with default
    lockControls(true);
    updateTimerDisplay();
});

