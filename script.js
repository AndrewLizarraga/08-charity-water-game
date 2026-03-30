// Variables to control game state
let gameRunning = false; // Keeps track of whether game is active or not
let dropMaker; // Timer that creates water drops
let polutionCloud; // Timer that creates pollution clouds
let timerInterval; // Tracks the timer update loop
let collisionChecker; // Detects collisions between drops and the can
let elapsedSeconds = 0; // Total active play time in seconds
let speedStep = 0; // Increases every 30 seconds to speed up spawning
let score = 0;
let gameOver = false;

const HIGH_SCORE_KEY = "waterDropHighScore";

const WATER_DROP_BASE_SPAWN_MS = 1000;
const POLUTION_CLOUD_BASE_SPAWN_MS = 5000;
const SPEED_STEP_SECONDS = 15;
const SPEED_FACTOR_PER_STEP = 0.5;
const MAX_SPEED_STEP = 8;

const BASE_GAME_WIDTH = 800;
const BASE_DROP_SIZE = 60;
const BASE_CLOUD_SIZE = 96;

const CAN_HITBOX_INSET_X_RATIO = 0.18;
const CAN_HITBOX_INSET_Y_RATIO = 0.3;
const DROP_HITBOX_INSET_X_RATIO = 0.2;
const DROP_HITBOX_INSET_Y_RATIO = 0.2;
const CLOUD_HITBOX_INSET_X_RATIO = 0.22;
const CLOUD_HITBOX_INSET_Y_RATIO = 0.25;

const startButton = document.getElementById("start-btn");
const timeDisplay = document.getElementById("time");
const scoreDisplay = document.getElementById("score");
const gameContainer = document.getElementById("game-container");
const waterCan = document.getElementById("water-can");
const loseModal = document.getElementById("lose-modal");
const finalScoreDisplay = document.getElementById("final-score");
const highScoreDisplay = document.getElementById("high-score");
const restartButton = document.getElementById("restart-btn");

let isDraggingCan = false;
let canDragOffsetX = 0;
let activePointerId = null;

// Show timer starting at 0 before the game begins
timeDisplay.textContent = elapsedSeconds;
scoreDisplay.textContent = score;
updateGameContainerMetrics();

// Wait for button click to start the game
startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", restartGame);
window.addEventListener("resize", updateGameContainerMetrics);

// Prevent browser image drag behavior and enable controlled dragging
waterCan.draggable = false;
waterCan.addEventListener("pointerdown", (event) => {
  const canRect = waterCan.getBoundingClientRect();
  isDraggingCan = true;
  activePointerId = event.pointerId;
  canDragOffsetX = event.clientX - canRect.left;
  waterCan.classList.add("dragging");
  waterCan.setPointerCapture(event.pointerId);
  event.preventDefault();
});

window.addEventListener("pointermove", (event) => {
  if (!isDraggingCan) return;
  if (activePointerId !== null && event.pointerId !== activePointerId) return;
  moveCanToClientX(event.clientX);
});

window.addEventListener("pointerup", (event) => {
  if (!isDraggingCan) return;
  if (activePointerId !== null && event.pointerId !== activePointerId) return;
  isDraggingCan = false;
  activePointerId = null;
  waterCan.classList.remove("dragging");
});

window.addEventListener("pointercancel", (event) => {
  if (!isDraggingCan) return;
  if (activePointerId !== null && event.pointerId !== activePointerId) return;
  isDraggingCan = false;
  activePointerId = null;
  waterCan.classList.remove("dragging");
});

function startGame() {
  if (gameOver) return;

  // If running, pause the game
  if (gameRunning) {
    stopSpawnTimers();
    clearInterval(timerInterval);
    clearInterval(collisionChecker);
    setDropsPaused(true);
    gameRunning = false;
    startButton.textContent = "Start";
    return;
  }

  // If paused/stopped, start the game
  gameRunning = true;
  startButton.textContent = "Pause";
  setDropsPaused(false);

  startSpawnTimers();

  // Count up while the game is actively running
  timerInterval = setInterval(() => {
    elapsedSeconds += 1;
    timeDisplay.textContent = elapsedSeconds;

    const nextSpeedStep = Math.min(
      MAX_SPEED_STEP,
      Math.floor(elapsedSeconds / SPEED_STEP_SECONDS)
    );
    if (nextSpeedStep !== speedStep) {
      speedStep = nextSpeedStep;
      startSpawnTimers();
    }
  }, 1000);

  collisionChecker = setInterval(checkCollisions, 16);
}

function getSpawnInterval(baseIntervalMs) {
  return baseIntervalMs * Math.pow(SPEED_FACTOR_PER_STEP, speedStep);
}

function stopSpawnTimers() {
  clearInterval(dropMaker);
  clearInterval(polutionCloud);
}

function startSpawnTimers() {
  stopSpawnTimers();
  dropMaker = setInterval(createDrop, getSpawnInterval(WATER_DROP_BASE_SPAWN_MS));
  polutionCloud = setInterval(
    createPolutionCloud,
    getSpawnInterval(POLUTION_CLOUD_BASE_SPAWN_MS)
  );
}

function setDropsPaused(isPaused) {
  const drops = document.querySelectorAll(".water-drop, .polution-cloud");
  drops.forEach((drop) => {
    drop.style.animationPlayState = isPaused ? "paused" : "running";
  });
}

function clampValue(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getScaledSize(baseSize, minSize, maxSize) {
  const scale = gameContainer.offsetWidth / BASE_GAME_WIDTH;
  return clampValue(baseSize * scale, minSize, maxSize);
}

function updateGameContainerMetrics() {
  const fallDistance = gameContainer.offsetHeight + 40;
  gameContainer.style.setProperty("--fall-distance", `${fallDistance}px`);

  if (waterCan.style.left.endsWith("px")) {
    const currentLeft = Number.parseFloat(waterCan.style.left) || 0;
    const maxLeft = Math.max(0, gameContainer.offsetWidth - waterCan.offsetWidth);
    const clampedLeft = clampValue(currentLeft, 0, maxLeft);
    waterCan.style.left = `${clampedLeft}px`;
    waterCan.style.transform = "none";
  }
}

function moveCanToClientX(clientX) {
  const containerRect = gameContainer.getBoundingClientRect();
  const maxLeft = containerRect.width - waterCan.offsetWidth;
  const desiredLeft = clientX - containerRect.left - canDragOffsetX;
  const boundedLeft = Math.max(0, Math.min(desiredLeft, maxLeft));

  waterCan.style.left = `${boundedLeft}px`;
  waterCan.style.transform = "none";
}

function createDrop() {
  // Create a new div element that will be our water drop
  const drop = document.createElement("div");
  drop.className = "water-drop";

  // Make drops different sizes for visual variety
  const initialSize = getScaledSize(BASE_DROP_SIZE, 30, 60);
  const sizeMultiplier = Math.random() * 0.8 + 0.5;
  const size = initialSize * sizeMultiplier;
  const scoreValue = Math.floor(size / 10);
  drop.style.width = drop.style.height = `${size}px`;
  drop.dataset.size = `${scoreValue}`;

  // Position the drop randomly across the game width
  const gameWidth = gameContainer.offsetWidth;
  const xPosition = Math.random() * (gameWidth - size);
  drop.style.left = `${xPosition}px`;

  // Make drops fall for 4 seconds
  drop.style.animationDuration = "4s";

  // Add the new drop to the game screen
  document.getElementById("game-container").appendChild(drop);

  // Remove drops that reach the bottom (weren't clicked)
  drop.addEventListener("animationend", () => {
    drop.remove(); // Clean up drops that weren't caught
  });
}

function checkCollisions() {
  const canRectRaw = waterCan.getBoundingClientRect();
  const canRect = insetRect(
    canRectRaw,
    canRectRaw.width * CAN_HITBOX_INSET_X_RATIO,
    canRectRaw.height * CAN_HITBOX_INSET_Y_RATIO
  );

  const drops = document.querySelectorAll(".water-drop");
  const clouds = document.querySelectorAll(".polution-cloud");

  drops.forEach((drop) => {
    if (drop.dataset.caught === "true") return;

    const dropRectRaw = drop.getBoundingClientRect();
    const dropRect = insetRect(
      dropRectRaw,
      dropRectRaw.width * DROP_HITBOX_INSET_X_RATIO,
      dropRectRaw.height * DROP_HITBOX_INSET_Y_RATIO
    );

    const isOverlapping = isRectOverlapping(dropRect, canRect);

    if (!isOverlapping) return;

    drop.dataset.caught = "true";
    score += Number(drop.dataset.size || 0);
    scoreDisplay.textContent = score;
    drop.remove();
  });

  for (const cloud of clouds) {
    const cloudRectRaw = cloud.getBoundingClientRect();
    const cloudRect = insetRect(
      cloudRectRaw,
      cloudRectRaw.width * CLOUD_HITBOX_INSET_X_RATIO,
      cloudRectRaw.height * CLOUD_HITBOX_INSET_Y_RATIO
    );

    if (isRectOverlapping(cloudRect, canRect)) {
      endGame();
      break;
    }
  }
}

function insetRect(rect, insetX, insetY) {
  const maxInsetX = Math.max(0, rect.width / 2 - 1);
  const maxInsetY = Math.max(0, rect.height / 2 - 1);

  const safeInsetX = Math.min(Math.max(0, insetX), maxInsetX);
  const safeInsetY = Math.min(Math.max(0, insetY), maxInsetY);

  return {
    left: rect.left + safeInsetX,
    right: rect.right - safeInsetX,
    top: rect.top + safeInsetY,
    bottom: rect.bottom - safeInsetY
  };
}

function isRectOverlapping(rectA, rectB) {
  return (
    rectA.left < rectB.right &&
    rectA.right > rectB.left &&
    rectA.top < rectB.bottom &&
    rectA.bottom > rectB.top
  );
}

function endGame() {
  if (gameOver) return;

  gameOver = true;
  gameRunning = false;
  stopSpawnTimers();
  clearInterval(timerInterval);
  clearInterval(collisionChecker);
  setDropsPaused(true);

  const highScoreResult = updateHighScore(score);

  finalScoreDisplay.textContent = score;
  highScoreDisplay.textContent = highScoreResult.highScore;
  highScoreDisplay.classList.toggle("new-high-score", highScoreResult.isNewHighScore);

  loseModal.classList.remove("hidden");
  startButton.textContent = "Start";
  startButton.disabled = true;
}

function updateHighScore(finalScore) {
  const storedValue = Number(localStorage.getItem(HIGH_SCORE_KEY));
  const previousHighScore = Number.isFinite(storedValue) ? storedValue : 0;

  const isNewHighScore =
    previousHighScore <= 0 ? finalScore > 0 : finalScore > previousHighScore;

  const highScore = isNewHighScore ? finalScore : previousHighScore;

  if (isNewHighScore) {
    localStorage.setItem(HIGH_SCORE_KEY, String(finalScore));
    confetti({
      particleCount: 300,
      spread: 90,
      origin: {x:1, y: 0.6 }
    })

    confetti({
      particleCount: 300,
      spread: 90,
      origin: { x: 0, y: 0.6}
    });
  }

  return { isNewHighScore, highScore };
}

function clearFallingObjects() {
  const fallingObjects = document.querySelectorAll(".water-drop, .polution-cloud");
  fallingObjects.forEach((item) => item.remove());
}

function restartGame() {
  stopSpawnTimers();
  clearInterval(timerInterval);
  clearInterval(collisionChecker);

  gameRunning = false;
  gameOver = false;
  elapsedSeconds = 0;
  speedStep = 0;
  score = 0;

  clearFallingObjects();

  timeDisplay.textContent = elapsedSeconds;
  scoreDisplay.textContent = score;
  loseModal.classList.add("hidden");

  startButton.disabled = false;
  startButton.textContent = "Start";

  waterCan.style.left = "50%";
  waterCan.style.transform = "translateX(-50%)";
  updateGameContainerMetrics();
}

function createPolutionCloud() {
  const cloud = document.createElement("img");
  cloud.className = "polution-cloud";
  cloud.src = "img/polutionCloud.png";
  cloud.alt = "Pollution cloud";

  const initialSize = getScaledSize(BASE_CLOUD_SIZE, 56, 96);
  const sizeMultiplier = Math.random() * 0.7 + 0.7;
  const size = initialSize * sizeMultiplier;
  cloud.style.width = `${size}px`;

  const gameWidth = gameContainer.offsetWidth;
  const xPosition = Math.random() * (gameWidth - size);
  cloud.style.left = `${xPosition}px`;
  cloud.style.animationDuration = "4s";

  gameContainer.appendChild(cloud);

  cloud.addEventListener("animationend", () => {
    cloud.remove();
  });
}
