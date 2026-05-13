const toast = document.querySelector(".toast");
const scoreList = document.querySelector(".score-list");
const buttons = document.querySelectorAll(".play-button");
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

const queueScore = () => Math.floor(8200 + Math.random() * 1800);
const roomId = () => Math.random().toString(36).slice(2, 6).toUpperCase();

let activeRoom = null;

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

    addScore(gameName);
    showToast(`${gameName} solo run added to the score board.`);
  });
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
