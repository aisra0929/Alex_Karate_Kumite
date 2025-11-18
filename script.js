// Score logic
let scoreA = 0;
let scoreB = 0;

const scoreDisplayA = document.getElementById('scoreA');
const scoreDisplayB = document.getElementById('scoreB');

document.querySelectorAll('.add-score').forEach(btn => {
  btn.addEventListener('click', () => {
    const player = btn.dataset.player;
    const points = parseInt(btn.dataset.points);
    if (player === 'A') scoreA += points;
    else scoreB += points;
    scoreDisplayA.textContent = scoreA;
    scoreDisplayB.textContent = scoreB;
  });
});

// Timer logic
let timer;
let time = 180; // 3 minutes in seconds
const timeDisplay = document.getElementById('time');

function updateTime() {
  let minutes = Math.floor(time / 60);
  let seconds = time % 60;
  if (seconds < 10) seconds = '0' + seconds;
  timeDisplay.textContent = `${minutes}:${seconds}`;
}

document.getElementById('start').addEventListener('click', () => {
  if (!timer) {
    timer = setInterval(() => {
      if (time > 0) {
        time--;
        updateTime();
      } else {
        clearInterval(timer);
        timer = null;
        alert('Time is up!');
      }
    }, 1000);
  }
});

document.getElementById('pause').addEventListener('click', () => {
  clearInterval(timer);
  timer = null;
});

document.getElementById('reset').addEventListener('click', () => {
  clearInterval(timer);
  timer = null;
  time = 180;
  updateTime();
  scoreA = 0;
  scoreB = 0;
  scoreDisplayA.textContent = scoreA;
  scoreDisplayB.textContent = scoreB;
});

// Initialize display
updateTime();
