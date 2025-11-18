// --- STATE VARIABLES ---
let aoScore = 0;
let akaScore = 0;
const MAX_TIME = 180; // 3 minutes
let currentTime = MAX_TIME;
let timerInterval = null;
let isTimerRunning = false;
const WINNING_GAP = 6; 

// --- DOM ELEMENTS ---
const aoScoreDisplay = document.getElementById('ao-score');
const akaScoreDisplay = document.getElementById('aka-score');
const timerDisplay = document.getElementById('timer');
const startPauseBtn = document.getElementById('start-pause-btn');
const resetTimerBtn = document.getElementById('reset-timer-btn');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const aoSenshuBtn = document.getElementById('ao-senshu');
const akaSenshuBtn = document.getElementById('aka-senshu');
const winningGapValue = document.getElementById('winning-gap-value');

// Icons for Play/Pause
const PLAY_ICON = '&#9658;'; // Triangle
const PAUSE_ICON = '&#10074;&#10074;'; // Double Vertical Bars

// --- FUNCTIONS ---

function updateScore(team, points) {
    if (team === 'ao') {
        aoScore = Math.max(0, aoScore + points);
        aoScoreDisplay.textContent = aoScore;
    } else if (team === 'aka') {
        akaScore = Math.max(0, akaScore + points);
        akaScoreDisplay.textContent = akaScore;
    }
    checkWinningGap();
}

function checkWinningGap() {
    const scoreDifference = Math.abs(aoScore - akaScore);
    
    // Highlight the gap text if close or met
    if (scoreDifference >= WINNING_GAP) {
        timerDisplay.style.color = "red"; 
        winningGapValue.style.color = "red";
    } else {
        timerDisplay.style.color = "#00ffcc";
        winningGapValue.style.color = "#aaa";
    }
}

function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function countdown() {
    if (currentTime <= 0) {
        clearInterval(timerInterval);
        isTimerRunning = false;
        timerDisplay.textContent = "00:00";
        timerDisplay.style.color = "red";
        startPauseBtn.innerHTML = PLAY_ICON;
        return;
    }
    currentTime--;
    timerDisplay.textContent = formatTime(currentTime);
}

function toggleTimer() {
    if (isTimerRunning) {
        // PAUSE
        clearInterval(timerInterval);
        startPauseBtn.innerHTML = PLAY_ICON;
    } else {
        // START
        if (currentTime > 0) {
            timerInterval = setInterval(countdown, 1000);
            startPauseBtn.innerHTML = PAUSE_ICON;
        }
    }
    isTimerRunning = !isTimerRunning;
}

function resetMatch() {
    clearInterval(timerInterval);
    isTimerRunning = false;
    startPauseBtn.innerHTML = PLAY_ICON;
    
    // Reset Scores
    aoScore = 0;
    akaScore = 0;
    aoScoreDisplay.textContent = '0';
    akaScoreDisplay.textContent = '0';
    
    // Reset Timer
    currentTime = MAX_TIME;
    timerDisplay.textContent = formatTime(currentTime);
    timerDisplay.style.color = "#00ffcc";
    winningGapValue.style.color = "#aaa";

    // Reset Senshu
    aoSenshuBtn.classList.remove('active');
    akaSenshuBtn.classList.remove('active');

    // Reset Penalties
    document.querySelectorAll('.penalty-btn').forEach(btn => {
        btn.classList.remove('active');
    });
}

function toggleSenshu(team) {
    if (team === 'ao') {
        if (aoSenshuBtn.classList.contains('active')) {
            aoSenshuBtn.classList.remove('active');
        } else {
            aoSenshuBtn.classList.add('active');
            akaSenshuBtn.classList.remove('active'); // Exclusive
        }
    } else {
        if (akaSenshuBtn.classList.contains('active')) {
            akaSenshuBtn.classList.remove('active');
        } else {
            akaSenshuBtn.classList.add('active');
            aoSenshuBtn.classList.remove('active'); // Exclusive
        }
    }
}

// --- EVENT LISTENERS ---

// Score Buttons
document.querySelectorAll('.score-btn').forEach(button => {
    button.addEventListener('click', (e) => {
        const team = e.currentTarget.dataset.team;
        const points = parseInt(e.currentTarget.dataset.points);
        updateScore(team, points);
    });
});

// Senshu Buttons
aoSenshuBtn.addEventListener('click', () => toggleSenshu('ao'));
akaSenshuBtn.addEventListener('click', () => toggleSenshu('aka'));

// Penalty Buttons
document.querySelectorAll('.penalty-btn').forEach(button => {
    button.addEventListener('click', (e) => {
        e.currentTarget.classList.toggle('active');
    });
});

// Controls
startPauseBtn.addEventListener('click', toggleTimer);
resetTimerBtn.addEventListener('click', () => {
    if(confirm("Are you sure you want to reset the match?")) {
        resetMatch();
    }
});

fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(e => {
            console.log(`Error enabling fullscreen mode: ${e.message} (${e.name})`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
});

// Init
timerDisplay.textContent = formatTime(MAX_TIME);