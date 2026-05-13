const toast = document.querySelector(".toast");
const scoreList = document.querySelector(".score-list");
const buttons = document.querySelectorAll(".play-button");

const queueScore = () => Math.floor(8200 + Math.random() * 1800);

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

buttons.forEach((button) => {
  button.addEventListener("click", () => {
    const gameName = button.dataset.game;
    addScore(gameName);
    showToast(`${gameName} added to the local test board.`);
  });
});
