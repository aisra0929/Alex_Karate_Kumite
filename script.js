document.addEventListener('DOMContentLoaded', () => {
    const MATCH_DURATIONS = ['00:30', '01:00', '01:30', '02:00', '02:30', '03:00', '03:30', '04:00', '04:30', '05:00'];
    const WEIGHT_CLASSES = {
        Male: ['-60 kg', '-67 kg', '-75 kg', '-84 kg', '+84 kg'],
        Female: ['-50 kg', '-55 kg', '-61 kg', '-68 kg', '+68 kg'],
    };
    const STORAGE_KEY = 'ekfScoreboardLogs';
    const GAP_LIMIT = 8;
    const PDF_LINE_LIMIT = 90;
    const PDF_PAGE = { width: 612, height: 792, margin: 50, lineHeight: 14 };

    const els = {
        landingPage: document.getElementById('landing-page'),
        enterSiteBtn: document.getElementById('enter-site-btn'),
        appShell: document.getElementById('main-app-shell'),
        backToLandingBtn: document.getElementById('back-to-landing-btn'),
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
        decisionModal: document.getElementById('decision-modal'),
        decisionTitle: document.getElementById('decision-title'),
        decisionMessage: document.getElementById('decision-message'),
        decisionConfirmBtn: document.getElementById('decision-confirm-btn'),
        decisionCancelBtn: document.getElementById('decision-cancel-btn'),
        decisionClose: document.getElementById('decision-close'),
        bracketGrid: document.getElementById('bracket-grid'),
        bracketStatus: document.getElementById('bracket-status'),
        refereeInput: document.getElementById('referee-input'),
    };

    const state = {
        timer: { duration: 120, remaining: 120, ticking: false, intervalId: null },
        scores: { ao: 0, aka: 0 },
        penalties: { ao: [], aka: [] },
        roundCount: 1,
        logBuffer: [],
        matchStartTime: null,
        tournament: { playerCount: 0, players: [], rounds: [], active: { roundIndex: 0, matchIndex: 0 }, division: { gender: 'Male', weightClass: WEIGHT_CLASSES.Male[0] } },
        playerFlags: {},
        controlsLocked: true,
        pendingDecision: null
    };

    if (els.enterSiteBtn) els.enterSiteBtn.addEventListener('click', () => { els.landingPage.classList.add('hidden'); els.appShell.classList.remove('hidden'); els.setupOverlay.classList.remove('hidden'); });
    if (els.backToLandingBtn) els.backToLandingBtn.addEventListener('click', () => { els.appShell.classList.add('hidden'); els.landingPage.classList.remove('hidden'); els.setupOverlay.classList.add('hidden'); if (getFullscreenElement()) exitFullscreen(); });

    const secondsFromLabel = (label) => { const [m, s] = label.split(':').map(Number); return (m * 60) + s; };
    const formatClock = (totalSeconds) => { const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0'); const seconds = (totalSeconds % 60).toString().padStart(2, '0'); return `${minutes}:${seconds}`; };
    const showToast = (text) => { els.roundBanner.textContent = text; els.roundBanner.classList.remove('hidden'); requestAnimationFrame(() => els.roundBanner.classList.add('visible')); setTimeout(() => { els.roundBanner.classList.remove('visible'); setTimeout(() => els.roundBanner.classList.add('hidden'), 300); }, 2500); };

    const renderPlayerInputs = () => {
        const count = Number(els.playerCountSelect.value);
        els.playerGrid.innerHTML = '';
        for (let i = 1; i <= count; i += 1) {
            const index = i - 1;
            const wrapper = document.createElement('label');
            wrapper.className = 'player-input';
            wrapper.innerHTML = `Player ${i}<input type="text" data-player-index="${index}" placeholder="Leave empty for default"><div class="player-flag-row"><input type="file" accept="image/*" data-player-flag="${index}"><img class="player-flag-preview" data-player-flag-preview="${index}" alt="Flag preview"></div>`;
            els.playerGrid.appendChild(wrapper);
            const preview = wrapper.querySelector('.player-flag-preview');
            const existingFlag = state.playerFlags[index];
            if (existingFlag && preview) { preview.src = existingFlag; preview.style.display = 'block'; }
        }
    };

    const populateMatchDurations = () => { const f = document.createDocumentFragment(); MATCH_DURATIONS.forEach(l => { const o = document.createElement('option'); o.value = l; o.textContent = l; if(l==='02:00') o.selected=true; f.appendChild(o); }); els.matchDurationSelect.appendChild(f); };
    const populateWeightClasses = (g) => { const c = WEIGHT_CLASSES[g]||[]; els.weightSelect.innerHTML=''; c.forEach((l,i)=>{ const o=document.createElement('option'); o.value=l; o.textContent=l; if(i===0)o.selected=true; els.weightSelect.appendChild(o); }); };
    const syncDivisionSelection = () => { state.tournament.division = { gender: els.genderSelect.value, weightClass: els.weightSelect.value }; };
    const gatherPlayerConfigs = () => Array.from(els.playerGrid.querySelectorAll('input[data-player-index]')).map(i => ({ name: i.value.trim(), seed: Number(i.dataset.playerIndex)+1, flag: state.playerFlags[Number(i.dataset.playerIndex)]||null }));
    
    const createInitialBracket = (players) => {
        let currentPlayers = players.map((p, i) => (typeof p === 'string' ? { name: p, seed: i+1, flag: null } : { name: p.name, seed: p.seed??i+1, flag: p.flag||null }));
        const rounds = [];
        let roundIndex = 0;
        while (currentPlayers.length > 1) {
            const roundMatches = [];
            for (let i = 0; i < currentPlayers.length; i += 2) {
                roundMatches.push({ id: `R${roundIndex+1}-M${(i/2)+1}`, players: [currentPlayers[i]||null, currentPlayers[i+1]||null], winner: null, complete: false });
            }
            rounds.push(roundMatches);
            currentPlayers = roundMatches.map(() => ({ name: 'TBD', seed: null, flag: null }));
            roundIndex++;
        }
        state.tournament.rounds = rounds;
    };

    const renderBracket = () => {
        els.bracketGrid.innerHTML = '';
        state.tournament.rounds.forEach((matches, i) => {
            const col = document.createElement('div'); col.className = 'round-column';
            const title = document.createElement('h4'); title.textContent = `Round ${i+1}`; col.appendChild(title);
            matches.forEach(m => {
                const p1 = m.players[0]||{}; const p2 = m.players[1]||{};
                const card = document.createElement('div'); card.className = `match-card ${m.winner!==null?'winner-known':''}`;
                card.innerHTML = `<div class="match-title">${m.id}</div>
                    <div class="competitor">${p1.flag?`<img src="${p1.flag}" class="bracket-flag">`:''}<span>${p1.name||`Player ${p1.seed||'?'}`}</span><span>${m.winner===0?'✔':''}</span></div>
                    <div class="competitor">${p2.flag?`<img src="${p2.flag}" class="bracket-flag">`:''}<span>${p2.name||`Player ${p2.seed||'?'}`}</span><span>${m.winner===1?'✔':''}</span></div>`;
                col.appendChild(card);
            });
            els.bracketGrid.appendChild(col);
        });
        const div = state.tournament.division;
        els.bracketStatus.textContent = `Round ${state.tournament.active.roundIndex + 1} • Match ${state.tournament.active.matchIndex + 1} • ${div.gender} ${div.weightClass}`;
    };

    const updateScoreDisplays = () => { els.aoScore.textContent = state.scores.ao; els.akaScore.textContent = state.scores.aka; };
    const resetPenalties = () => { els.penaltyButtons.forEach(b => b.classList.remove('active')); state.penalties = { ao: [], aka: [] }; };
    const resetSenshu = () => { [els.aoSenshu, els.akaSenshu].forEach(i => i.classList.remove('active')); };
    const resetScores = () => { state.scores = { ao: 0, aka: 0 }; updateScoreDisplays(); };
    const updateTimerDisplay = () => { els.timerDisplay.textContent = formatClock(state.timer.remaining); };
    const setTimerDuration = (s) => { state.timer.duration = s; state.timer.remaining = s; updateTimerDisplay(); };
    const lockControls = (locked) => {
        state.controlsLocked = locked;
        [...els.scoreButtons, ...els.penaltyButtons, els.swapBtn, els.aoSenshu, els.akaSenshu].forEach(e => { e.disabled = locked; e.classList.toggle('disabled', locked); });
    };

    const startTimer = () => {
        if(state.timer.ticking || state.controlsLocked) return;
        state.timer.ticking = true; state.matchStartTime = state.matchStartTime || new Date();
        els.startPauseBtn.innerHTML = '&#10074;&#10074;';
        state.timer.intervalId = setInterval(() => {
            if(state.timer.remaining <= 0) {
                stopTimer();
                const winner = decideWinnerByScore();
                if(winner) declareWinner(winner, 'Time elapsed');
                else { lockControls(true); els.winnerTitle.textContent = 'Time up'; els.winnerMessage.textContent = 'Scores tied. Please declare a winner.'; els.winnerActions.classList.remove('hidden'); els.winnerModal.classList.remove('hidden'); }
                return;
            }
            state.timer.remaining--; updateTimerDisplay();
        }, 1000);
    };
    const stopTimer = () => { if(state.timer.intervalId) clearInterval(state.timer.intervalId); state.timer.ticking = false; els.startPauseBtn.innerHTML = '&#9658;'; };
    const resetTimer = () => { stopTimer(); state.timer.remaining = state.timer.duration; updateTimerDisplay(); };

    const handleScoreChange = (team, delta, label) => { if(state.controlsLocked) return; state.scores[team] = Math.max(0, state.scores[team] + delta); updateScoreDisplays(); recordLog(`${team.toUpperCase()} score ${delta>0?'+':''}${delta} (${label}) → ${state.scores[team]}`); checkGapRule(); };

    // --- PENALTY & K/S LOGIC ---
    const handlePenalty = (btn) => {
        if (state.controlsLocked) return;
        const grid = btn.closest('.penalty-grid');
        if(!grid) { console.error("Missing penalty-grid parent"); return; }
        const team = grid.dataset.team;
        if(!team) { console.error("Missing data-team in HTML"); return; }

        if (btn.classList.contains('k-btn')) { promptDrasticAction('KIKEN', team); return; }
        if (btn.classList.contains('s-btn')) { promptDrasticAction('SHIKKAKU', team); return; }

        btn.classList.toggle('active');
        const penalty = btn.dataset.penalty || btn.textContent; // fallback if dataset missing
        if (btn.classList.contains('active')) { state.penalties[team].push(penalty); recordLog(`${team.toUpperCase()} penalty: ${penalty}`); }
        else { state.penalties[team] = state.penalties[team].filter(p => p !== penalty); recordLog(`${team.toUpperCase()} penalty cleared: ${penalty}`); }
    };

    const promptDrasticAction = (type, offenderTeam) => {
        state.pendingDecision = { type, offenderTeam };
        if (type === 'KIKEN') {
            els.decisionTitle.textContent = "⚠️ Apply KIKEN (Bout Forfeiture)";
            els.decisionMessage.textContent = "Confirm that the offender has forfeited the match due to KIKEN. This action is irreversible for the bout.";
            els.decisionConfirmBtn.textContent = "CONFIRM FORFEITURE (K)";
        } else {
            els.decisionTitle.textContent = "🚨 Apply SHIKKAKU";
            els.decisionMessage.textContent = "🚨 WARNING: This action disqualifies the offender from the entire tournament.";
            els.decisionConfirmBtn.textContent = "CONFIRM SHIKKAKU (S)";
        }
        els.decisionModal.classList.remove('hidden');
    };

    const confirmDrasticAction = () => {
        if (!state.pendingDecision) return;
        const { type, offenderTeam } = state.pendingDecision;
        els.decisionModal.classList.add('hidden');
        
        // WINNER IS OPPOSITE PLAYER
        const winnerTeam = offenderTeam === 'ao' ? 'aka' : 'ao';
        state.scores[winnerTeam] = 8; state.scores[offenderTeam] = 0; updateScoreDisplays();

        let resultTitle = type === 'KIKEN' ? "✅ Match Winner Declared" : "🚫 Tournament Disqualification";
        let resultMessage = type === 'KIKEN' 
            ? `The Opponent wins **8-0** by **KIKEN**. Match complete.` 
            : `The Offender is disqualified (**SHIKKAKU**). Opponent wins **8-0**.`;

        declareWinner(winnerTeam, type, resultTitle, resultMessage);
        state.pendingDecision = null;
    };
    const closeDecisionModal = () => { els.decisionModal.classList.add('hidden'); state.pendingDecision = null; };

    const toggleSenshu = (ind) => { if(state.controlsLocked) return; const t = ind.dataset.team; const o = t==='ao'?els.akaSenshu:els.aoSenshu; ind.classList.toggle('active'); if(ind.classList.contains('active')){ o.classList.remove('active'); recordLog(`${t.toUpperCase()} gains Senshu`); } else recordLog(`${t.toUpperCase()} loses Senshu`); };
    const checkGapRule = () => { if(Math.abs(state.scores.ao - state.scores.aka) >= GAP_LIMIT) declareWinner(state.scores.ao > state.scores.aka ? 'ao' : 'aka', `${GAP_LIMIT}-point gap`); };
    const decideWinnerByScore = () => { if(state.scores.ao === state.scores.aka) return null; return state.scores.ao > state.scores.aka ? 'ao' : 'aka'; };

    const recordLog = (l) => { state.logBuffer.push(`[${new Date().toLocaleTimeString()}] ${l}`); };
    const getStoredLogs = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const persistLogs = (l) => localStorage.setItem(STORAGE_KEY, JSON.stringify(l));
    const saveMatchLog = (wTeam, reason) => {
        const h = [`Winner: ${wTeam==='ao'?els.aoNameInput.value:els.akaNameInput.value}`, `Reason: ${reason}`];
        const logs = getStoredLogs();
        logs.unshift({ id: Date.now(), filename: `match-${Date.now()}.txt`, content: h.concat(state.logBuffer).join('\n') });
        persistLogs(logs);
    };

    // Winner Flow - UPDATED to hide manual buttons if K/S
    const declareWinner = (team, reason, customTitle, customMessage) => {
        stopTimer(); lockControls(true);
        const wName = team === 'ao' ? els.aoNameInput.value : els.akaNameInput.value;
        const lName = team === 'ao' ? els.akaNameInput.value : els.aoNameInput.value;
        els.winnerTitle.textContent = customTitle || `${wName} wins!`;
        if (customMessage) els.winnerMessage.innerHTML = customMessage.replace(/\*\*/g, '<b>').replace(/\*\*/g, '</b>');
        else els.winnerMessage.textContent = `${wName} defeated ${lName}. Reason: ${reason}.`;
        
        // HIDE Manual declare buttons if it's an auto-decision
        if (reason === 'KIKEN' || reason === 'SHIKKAKU' || reason.includes('gap')) {
            els.winnerActions.classList.add('hidden');
        } else {
            els.winnerActions.classList.remove('hidden'); // Show for normal time-up tie
        }
        
        els.winnerModal.classList.remove('hidden');
        saveMatchLog(team, reason);
        advanceBracket(team);
    };

    const advanceBracket = (wTeam) => {
        const { rounds, active } = state.tournament;
        const m = rounds[active.roundIndex][active.matchIndex];
        m.complete = true; m.winner = wTeam === 'ao' ? 0 : 1;
        const nextR = rounds[active.roundIndex + 1];
        if (nextR) {
            const targetM = nextR[Math.floor(active.matchIndex / 2)];
            if (targetM) {
                const wPlayer = m.players[m.winner] || { name: wTeam === 'ao' ? els.aoNameInput.value : els.akaNameInput.value, flag: null };
                targetM.players[active.matchIndex % 2] = { ...wPlayer };
            }
        }
        renderBracket();
    };

    const closeWinnerModal = () => els.winnerModal.classList.add('hidden');
    const loadNextMatch = () => {
        const { active, rounds } = state.tournament;
        if (active.matchIndex + 1 < rounds[active.roundIndex].length) state.tournament.active.matchIndex++;
        else if (active.roundIndex + 1 < rounds.length) { state.tournament.active.roundIndex++; state.tournament.active.matchIndex = 0; }
        else { showToast('Tournament complete!'); return; }
        state.roundCount++; updateRoundUI(); prepareMatch();
    };
    const updateRoundUI = () => { els.roundNumber.textContent = state.roundCount; showToast(`Round ${state.roundCount} – Get Ready`); };
    
    const prepareMatch = () => {
        resetScores(); resetPenalties(); resetSenshu(); state.logBuffer = []; state.matchStartTime = null; state.pendingDecision = null; lockControls(false); resetTimer();
        const m = state.tournament.rounds[state.tournament.active.roundIndex][state.tournament.active.matchIndex];
        const [pA, pB] = m.players;
        els.aoNameInput.value = pA?.name || 'AO'; els.akaNameInput.value = pB?.name || 'AKA';
        const applyFlag = (img, src) => { if(img) { if(src){img.src=src;img.style.display='block'}else{img.removeAttribute('src');img.style.display='none'}}};
        applyFlag(els.aoFlagScore, pA?.flag); applyFlag(els.akaFlagScore, pB?.flag);
        recordLog(`Match ready: ${els.aoNameInput.value} vs ${els.akaNameInput.value}`);
        renderBracket();
    };

    const swapSides = () => { if(state.controlsLocked)return; const l=document.querySelector('.team[data-side="left"]'), r=document.querySelector('.team[data-side="right"]'); l.classList.toggle('ao');l.classList.toggle('aka');r.classList.toggle('ao');r.classList.toggle('aka'); const t=els.aoNameInput.value;els.aoNameInput.value=els.akaNameInput.value;els.akaNameInput.value=t; const s=state.scores.ao;state.scores.ao=state.scores.aka;state.scores.aka=s; updateScoreDisplays(); const a=els.aoSenshu.classList.contains('active');els.aoSenshu.classList.toggle('active',els.akaSenshu.classList.contains('active'));els.akaSenshu.classList.toggle('active',a); recordLog('Swapped'); };

    // --- Init ---
    populateMatchDurations(); populateWeightClasses(els.genderSelect.value); renderPlayerInputs(); syncDivisionSelection();
    els.playerCountSelect.addEventListener('change', renderPlayerInputs);
    els.genderSelect.addEventListener('change', () => { populateWeightClasses(els.genderSelect.value); syncDivisionSelection(); });
    els.weightSelect.addEventListener('change', syncDivisionSelection);
    els.playerGrid.addEventListener('change', (e) => {
        const i = e.target; if(i.type==='file'){ const idx=Number(i.dataset.playerFlag); const f=i.files[0]; 
        if(!f){delete state.playerFlags[idx]; return;} const r=new FileReader(); r.onload=()=>{state.playerFlags[idx]=r.result; renderPlayerInputs();}; r.readAsDataURL(f); }
    });
    els.startTournamentBtn.addEventListener('click', () => {
        const p = gatherPlayerConfigs(); if(!p.length)return; state.tournament.playerCount=p.length; state.tournament.players=p; state.tournament.active={roundIndex:0,matchIndex:0};
        syncDivisionSelection(); createInitialBracket(p); renderBracket(); setTimerDuration(secondsFromLabel(els.matchDurationSelect.value));
        els.setupOverlay.classList.add('hidden'); els.appShell.classList.remove('hidden');
        state.roundCount=1; updateRoundUI(); prepareMatch();
    });
    els.matchDurationSelect.addEventListener('change', () => { if(!state.timer.ticking && state.controlsLocked) setTimerDuration(secondsFromLabel(els.matchDurationSelect.value)); });
    els.startPauseBtn.addEventListener('click', () => state.timer.ticking ? stopTimer() : startTimer());
    els.resetBtn.addEventListener('click', () => { stopTimer(); prepareMatch(); });
    els.scoreButtons.forEach(b => b.addEventListener('click', () => handleScoreChange(b.dataset.team, Number(b.dataset.points), b.textContent)));
    
    // --- PENALTY WIRING ---
    els.penaltyButtons.forEach(b => b.addEventListener('click', () => {
        if(b.classList.contains('plus')) { state.timer.remaining++; updateTimerDisplay(); return; }
        if(b.classList.contains('minus')) { state.timer.remaining = Math.max(0, state.timer.remaining-1); updateTimerDisplay(); return; }
        handlePenalty(b);
    }));

    if(els.decisionConfirmBtn) els.decisionConfirmBtn.addEventListener('click', confirmDrasticAction);
    if(els.decisionCancelBtn) els.decisionCancelBtn.addEventListener('click', closeDecisionModal);
    if(els.decisionClose) els.decisionClose.addEventListener('click', closeDecisionModal);
    
    els.swapBtn.addEventListener('click', swapSides);
    els.historyTriggers.forEach(b => b.addEventListener('click', openHistoryModal));
    els.historyClose.addEventListener('click', closeHistoryModal);
    if(els.eraseHistoryBtn) els.eraseHistoryBtn.addEventListener('click', eraseHistory);
    els.winnerModalClose.addEventListener('click', closeWinnerModal);
    els.winnerDeclareAo.addEventListener('click', () => declareWinner('ao', 'Manual'));
    els.winnerDeclareAka.addEventListener('click', () => declareWinner('aka', 'Manual'));
    els.winnerNextBtn.addEventListener('click', () => { closeWinnerModal(); loadNextMatch(); });
    if (els.fullscreenBtn) els.fullscreenBtn.addEventListener('click', toggleFullscreen);

    lockControls(true); updateTimerDisplay();
});