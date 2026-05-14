const toast = document.querySelector(".toast");
const scoreList = document.querySelector(".score-list");
const buttons = document.querySelectorAll(".play-button");
const categoryButtons = document.querySelectorAll(".category-pill");
const miniGames = document.querySelectorAll(".mini-game");
const arcadeTabs = document.querySelectorAll(".arcade-tab");
const gamePanels = document.querySelectorAll("[data-game-panel]");
const activeGameTitle = document.querySelector("#active-game-title");
const roomForm = document.querySelector("#room-form");
const quickRoomForm = document.querySelector("#quick-room-form");
const quickCreateRoomButton = document.querySelector("#quick-create-room");
const joinRoomButton = document.querySelector("#join-room");
const gameSelect = document.querySelector("#game-select");
const playerNameInput = document.querySelector("#player-name");
const quickPlayerNameInput = document.querySelector("#quick-player-name");
const roomCode = document.querySelector("#room-code");
const roomGame = document.querySelector("#room-game");
const playerList = document.querySelector("#player-list");
const reactionPad = document.querySelector("#reaction-pad");
const reactionStatus = document.querySelector("#reaction-status");
const reactionResult = document.querySelector("#reaction-result");
const memoryStart = document.querySelector("#memory-start");
const memoryBoard = document.querySelector("#memory-board");
const memoryResult = document.querySelector("#memory-result");
const clickStart = document.querySelector("#click-start");
const clickArena = document.querySelector("#click-arena");
const clickTarget = document.querySelector("#click-target");
const clickResult = document.querySelector("#click-result");

const queueScore = () => Math.floor(8200 + Math.random() * 1800);
const roomId = () => Math.random().toString(36).slice(2, 6).toUpperCase();

let activeRoom = null;
let reactionState = "idle";
let reactionTimer = null;
let reactionStartedAt = 0;
let reactionBest = null;
let memoryPattern = [];
let memoryInput = [];
let memoryLocked = true;
let clickScore = 0;
let clickRunning = false;
let clickTimer = null;

const showToast = (message) => {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    toast.classList.remove("visible");
  }, 2600);
};

const addScore = (gameName) => {
  const item = document.createElement("li");
  item.innerHTML = `<span>${gameName}</span><strong>${queueScore()}</strong>`;
  scoreList.prepend(item);

  while (scoreList.children.length > 5) {
    scoreList.lastElementChild.remove();
  }
};

const openGame = (gameName) => {
  activeGameTitle.textContent = gameName;
  arcadeTabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.openGame === gameName);
  });
  gamePanels.forEach((panel) => {
    panel.classList.toggle("is-hidden", panel.dataset.gamePanel !== gameName);
  });
  document.querySelector("#play").scrollIntoView({ behavior: "smooth" });
};

const renderRoom = () => {
  if (!activeRoom) {
    roomCode.textContent = "NO ROOM";
    roomGame.textContent = "Pick a game";
    playerList.innerHTML = '<span class="empty-state">Create a room to add players.</span>';
    return;
  }

  roomCode.textContent = activeRoom.code;
  roomGame.textContent = activeRoom.game;
  playerList.innerHTML = activeRoom.players
    .map((player) => `<span class="player-chip">${player}</span>`)
    .join("");
};

const createRoom = (gameName, playerName) => {
  if (playerName) {
    playerNameInput.value = playerName;
    quickPlayerNameInput.value = playerName;
  }

  activeRoom = {
    code: roomId(),
    game: gameName,
    players: [playerName || "Player 1"],
  };

  renderRoom();
  showToast(`Room ${activeRoom.code} created for ${gameName}.`);
};

const joinLocalRoom = () => {
  if (!activeRoom) {
    createRoom(gameSelect.value, playerNameInput.value.trim());
  }

  const guestNumber = activeRoom.players.length + 1;
  activeRoom.players.push(`Guest ${guestNumber}`);
  renderRoom();
  addScore(activeRoom.game);
  showToast(`Guest ${guestNumber} joined ${activeRoom.code}.`);
};

buttons.forEach((button) => {
  button.addEventListener("click", () => {
    const gameName = button.dataset.game;
    const action = button.dataset.action;

    if (action === "room") {
      gameSelect.value = gameName;
      createRoom(gameName, playerNameInput.value.trim());
      document.querySelector("#lobby").scrollIntoView({ behavior: "smooth" });
      return;
    }

    openGame(["Reaction Dash", "Memory Grid", "Click Storm"].includes(gameName) ? gameName : "Click Storm");
    showToast(`${gameName} loaded in the arcade.`);
  });
});

arcadeTabs.forEach((tab) => {
  tab.addEventListener("click", () => openGame(tab.dataset.openGame));
});

categoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;
    categoryButtons.forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");

    miniGames.forEach((game) => {
      const categories = game.dataset.category || "";
      game.hidden = filter !== "all" && !categories.includes(filter);
    });
  });
});

miniGames.forEach((game) => {
  game.addEventListener("click", () => {
    const gameName = game.dataset.game;
    gameSelect.value = ["Click Storm", "Reaction Dash", "Memory Grid"].includes(gameName)
      ? gameName
      : "Reaction Dash";
    openGame(["Reaction Dash", "Memory Grid", "Click Storm"].includes(gameName) ? gameName : "Click Storm");
    showToast(`${gameName} opened in the arcade.`);
  });
});

const startReaction = () => {
  window.clearTimeout(reactionTimer);
  reactionState = "waiting";
  reactionPad.textContent = "...";
  reactionPad.classList.remove("is-ready", "is-miss");
  reactionStatus.textContent = "Wait for green";
  reactionTimer = window.setTimeout(() => {
    reactionState = "ready";
    reactionStartedAt = performance.now();
    reactionPad.textContent = "Tap";
    reactionPad.classList.add("is-ready");
    reactionStatus.textContent = "Tap now";
  }, 900 + Math.random() * 1800);
};

reactionPad.addEventListener("click", () => {
  if (reactionState === "idle") {
    startReaction();
    return;
  }

  if (reactionState === "waiting") {
    window.clearTimeout(reactionTimer);
    reactionState = "idle";
    reactionPad.textContent = "Start";
    reactionPad.classList.add("is-miss");
    reactionStatus.textContent = "Too soon";
    reactionResult.textContent = "False start. Try again.";
    return;
  }

  const score = Math.round(performance.now() - reactionStartedAt);
  reactionBest = reactionBest === null ? score : Math.min(reactionBest, score);
  reactionState = "idle";
  reactionPad.textContent = "Start";
  reactionPad.classList.remove("is-ready");
  reactionStatus.textContent = `${score}ms`;
  reactionResult.textContent = `Best: ${reactionBest}ms`;
  addScore("Reaction Dash");
});

const flashMemoryTile = (tile) => {
  const button = memoryBoard.querySelector(`[data-tile="${tile}"]`);
  button.classList.add("is-lit");
  window.setTimeout(() => button.classList.remove("is-lit"), 360);
};

const playMemoryPattern = () => {
  memoryLocked = true;
  memoryInput = [];
  memoryPattern.forEach((tile, index) => {
    window.setTimeout(() => flashMemoryTile(tile), 520 * index);
  });
  window.setTimeout(() => {
    memoryLocked = false;
    memoryResult.textContent = `Repeat ${memoryPattern.length} tile${memoryPattern.length === 1 ? "" : "s"}`;
  }, 520 * memoryPattern.length + 120);
};

const nextMemoryRound = () => {
  memoryPattern.push(Math.floor(Math.random() * 9));
  memoryResult.textContent = `Round: ${memoryPattern.length}`;
  playMemoryPattern();
};

memoryStart.addEventListener("click", () => {
  memoryPattern = [];
  memoryInput = [];
  nextMemoryRound();
});

memoryBoard.querySelectorAll("button").forEach((tile) => {
  tile.addEventListener("click", () => {
    if (memoryLocked || memoryPattern.length === 0) return;
    const value = Number(tile.dataset.tile);
    flashMemoryTile(value);
    memoryInput.push(value);

    const index = memoryInput.length - 1;
    if (memoryInput[index] !== memoryPattern[index]) {
      memoryLocked = true;
      memoryResult.textContent = `Game over. Score: ${memoryPattern.length - 1}`;
      addScore("Memory Grid");
      return;
    }

    if (memoryInput.length === memoryPattern.length) {
      memoryLocked = true;
      window.setTimeout(nextMemoryRound, 650);
    }
  });
});

const moveClickTarget = () => {
  const maxX = Math.max(0, clickArena.clientWidth - clickTarget.offsetWidth);
  const maxY = Math.max(0, clickArena.clientHeight - clickTarget.offsetHeight);
  clickTarget.style.left = `${Math.random() * maxX}px`;
  clickTarget.style.top = `${Math.random() * maxY}px`;
};

clickStart.addEventListener("click", () => {
  clickScore = 0;
  clickRunning = true;
  clickResult.textContent = "Score: 0 | Time: 15";
  clickTarget.disabled = false;
  moveClickTarget();
  window.clearInterval(clickTimer);

  let timeLeft = 15;
  clickTimer = window.setInterval(() => {
    timeLeft -= 1;
    clickResult.textContent = `Score: ${clickScore} | Time: ${timeLeft}`;
    if (timeLeft <= 0) {
      window.clearInterval(clickTimer);
      clickRunning = false;
      clickTarget.disabled = true;
      clickResult.textContent = `Final score: ${clickScore}`;
      addScore("Click Storm");
    }
  }, 1000);
});

clickTarget.addEventListener("click", () => {
  if (!clickRunning) return;
  clickScore += 1;
  clickResult.textContent = `Score: ${clickScore}`;
  moveClickTarget();
});

roomForm.addEventListener("submit", (event) => {
  event.preventDefault();
  createRoom(gameSelect.value, playerNameInput.value.trim());
});

quickRoomForm.addEventListener("submit", (event) => {
  event.preventDefault();
  createRoom(gameSelect.value, quickPlayerNameInput.value.trim());
  document.querySelector("#lobby").scrollIntoView({ behavior: "smooth" });
});

quickCreateRoomButton.addEventListener("click", () => {
  createRoom(gameSelect.value, quickPlayerNameInput.value.trim());
  document.querySelector("#lobby").scrollIntoView({ behavior: "smooth" });
});

joinRoomButton.addEventListener("click", joinLocalRoom);
