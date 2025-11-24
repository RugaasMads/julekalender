const API_URL = "http://127.0.0.1:8000";
const REWARD_MILESTONES = [3];

let currentDay = null;
let currentDayData = null;
let rewardPending = false;

/* =====================================
   HELLO KITTY COLLECTION
===================================== */

function updateKittyCollection() {
  const slots = document.querySelectorAll(".kitty-slot");
  const count = parseInt(localStorage.getItem("kittyCount") || "0");

  slots.forEach((slot, i) => {
    slot.classList.toggle("filled", i < count);
  });
}

/* =====================================
   PUZZLE PIECES
===================================== */

function revealPuzzlePiece(id) {
  if (!id) return;
  const piece = document.getElementById(id);
  if (!piece) return;

  const key = `puzzle_${id}`;
  if (!localStorage.getItem(key)) {
    piece.classList.add("revealed");
    localStorage.setItem(key, "true");
  } else {
    piece.classList.add("revealed");
  }
}

function restorePuzzlePieces() {
  document.querySelectorAll(".puzzle-piece").forEach(piece => {
    const key = `puzzle_${piece.id}`;
    if (localStorage.getItem(key) === "true") {
      piece.classList.add("revealed");
    }
  });
}

/* =====================================
   REWARDS
===================================== */

function addKitty() {
  let count = parseInt(localStorage.getItem("kittyCount") || "0");
  if (count >= 10) return;

  count += 1;
  localStorage.setItem("kittyCount", count);
  updateKittyCollection();

    if (REWARD_MILESTONES.includes(count)) {
        rewardPending = true;
    }   
}

function grantRewards(data, day) {
  if (!data) return;

  const rewardKey = `day_${day}_rewarded`;
  if (localStorage.getItem(rewardKey) === "true") return;

  if (data.rewardKitty) addKitty();
  if (data.rewardPuzzle) revealPuzzlePiece(data.rewardPuzzle);

if (data.rewardPopup) {
    rewardPending = data.rewardPopup;  // lagre hele reward-objektet
}

  localStorage.setItem(rewardKey, "true");
}

/* =====================================
   POPUP RENDERING
===================================== */

function renderContent(content) {
  const c = document.getElementById("content");
  const q = document.getElementById("question");

  q.innerText = content.title || "";
  c.innerHTML = `
    ${content.text ? `<p>${content.text}</p>` : ""}
    ${content.image ? `<img src="${content.image}">` : ""}
  `;
}

function showMultipleChoice(question, options) {
  const q = document.getElementById("question");
  const c = document.getElementById("content");
  const opt = document.getElementById("optionsSection");

  q.innerText = question;
  c.innerHTML = "";
  opt.innerHTML = "";
  opt.style.display = "block";

  options.forEach(option => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.innerText = option;
    btn.onclick = () => submitAnswer(option);
    opt.appendChild(btn);
  });
}

function showTextQuestion(question) {
  const q = document.getElementById("question");
  const c = document.getElementById("content");
  const opt = document.getElementById("optionsSection");
  const r = document.getElementById("result");

  q.innerText = question;
  c.innerHTML = "";
  opt.style.display = "flex";
  opt.innerHTML = "";
  r.innerText = "";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Skriv svaret ditt";
  input.className = "text-answer-input";

  const btn = document.createElement("button");
  btn.className = "option-btn";
  btn.innerText = "Svar";
  btn.onclick = () => {
    const value = input.value.trim();
    if (!value) {
      r.innerText = "Skriv et svar før du sender inn.";
      return;
    }
    submitAnswer(value);
  };

  opt.appendChild(input);
  opt.appendChild(btn);
  input.focus();
}

/* =====================================
   LOAD DAY FROM API
===================================== */

async function loadDay(day) {
  const q = document.getElementById("question");
  const c = document.getElementById("content");
  const opt = document.getElementById("optionsSection");
  const r = document.getElementById("result");

  q.innerText = "Laster...";
  c.innerHTML = "";
  opt.style.display = "none";
  opt.innerHTML = "";
  r.innerText = "";

  try {
    const response = await fetch(`${API_URL}/day/${day}`);

    if (response.status === 403) {
      q.innerText = "Denne luken er ikke tilgjengelig ennå.";
      return;
    }
    if (!response.ok) {
      q.innerText = "Fant ikke innhold for denne dagen.";
      return;
    }

    const data = await response.json();
    currentDayData = data;

    // Marker luke åpnet
    document
      .querySelector(`.calendar-box:nth-child(${day})`)
      ?.classList.add("opened");
    localStorage.setItem(`luke_${day}_opened`, "true");

    const answeredKey = `day_${day}_answered`;
    const hasMultipleChoice =
      !!data.question && Array.isArray(data.options) && data.options.length > 0 && !!data.correct_option;
    const hasTextAnswer = !!data.question && !!data.answer;

    /* ---- Question day ---- */
    if (hasMultipleChoice) {
      if (localStorage.getItem(answeredKey) === "true") {
        renderContent(data.content);
      } else {
        showMultipleChoice(data.question, data.options);
      }
      return;
    }

    if (hasTextAnswer) {
      if (localStorage.getItem(answeredKey) === "true") {
        renderContent(data.content);
      } else {
        showTextQuestion(data.question);
      }
      return;
    }

    /* ---- Pure content ---- */
    if (data.content) {
      renderContent(data.content);
      grantRewards(data, day);
    }

  } catch (e) {
    console.error(e);
    q.innerText = "Noe gikk galt ved henting av innhold.";
  }
}

/* =====================================
   SUBMIT MULTIPLE CHOICE ANSWER
===================================== */

async function submitAnswer(option) {
  const day = currentDay;
  if (!day) return;
  const r = document.getElementById("result");

  try {
    const response = await fetch(`${API_URL}/day/${day}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer: option })
    });

    if (!response.ok) {
      const error = await response.json();
      r.innerText = error.detail || "Klarte ikke å sende inn svaret.";
      return;
    }

    const result = await response.json();

    if (result.correct) {
      r.innerText = result.message || "Riktig! ❤️";

      localStorage.setItem(`day_${day}_answered`, "true");
      grantRewards(currentDayData, day);

      renderContent(result.content);
      const opt = document.getElementById("optionsSection");
      opt.innerHTML = "";      // Fjern knappene
      opt.style.display = "none";  // Skjul seksjonen helt
    } else {
      r.innerText = result.message || "Feil svar, prøv igjen!";
    }
  } catch (error) {
    console.error(error);
    r.innerText = "Noe gikk galt ved innsending av svaret.";
  }
}

/* =====================================
   POPUP CONTROL
===================================== */

function openPopup(day) {
  currentDay = day;
  document.getElementById("overlay").style.display = "flex";
  loadDay(day);
}

function closePopup() {
  const ov = document.getElementById("overlay");
  ov.style.display = "none";
  document.getElementById("question").innerText = "";
  document.getElementById("content").innerHTML = "";
  document.getElementById("optionsSection").innerHTML = "";
  document.getElementById("result").innerText = "";
  

if (rewardPending) {
    const rewardData = rewardPending;  // ta vare på
    rewardPending = null;

    setTimeout(() => {
        showReward(rewardData);
    }, 400);
}
}

/* =====================================
   INIT
===================================== */

document.addEventListener("DOMContentLoaded", () => {
  const boxes = document.querySelectorAll(".calendar-box");

  boxes.forEach((box, i) => {
    const day = i + 1;
    box.textContent = day;

    if (localStorage.getItem(`luke_${day}_opened`) === "true") {
      box.classList.add("opened");
    }

    box.addEventListener("click", () => openPopup(day));
  });

  updateKittyCollection();
  restorePuzzlePieces();
});

function animateTitle(selector) {
  const element = document.querySelector(selector);
  if (!element) {
    console.warn("Fant ikke elementet:", selector);
    return;
  }

  const text = element.innerText;
  element.innerHTML = "";

  text.split("").forEach((letter, i) => {
    const span = document.createElement("span");
    span.textContent = letter;
    span.style.animationDelay = (i * 0.05) + "s";
    element.appendChild(span);
  });

  element.classList.add("lux-type");
}

document.addEventListener("DOMContentLoaded", () => {
  animateTitle(".title");
});

function showReward(data) {
    const overlay = document.getElementById("reward-overlay");
    const modal = document.querySelector(".reward-modal");

    const closed = document.getElementById("giftClosed");
    const open = document.getElementById("giftOpen");

    const title = modal.querySelector(".reward-title");
    const subtitle = modal.querySelector(".reward-sub");
    const image = modal.querySelector(".reward-image");

    overlay.style.display = "flex";

    // Tekst
    title.innerText = data.title || "Du har fått en premie!";
    subtitle.innerText = data.subtitle || "";
    
    // Premiebilde
    if (data.image) {
        image.src = data.image;
        image.style.display = "block";
    } else {
        image.style.display = "none";
    }

    // Endre gaveboks-design
    if (data.giftBox) {
        closed.src = data.giftBox.closed;
        open.src = data.giftBox.open;
    }

    // Anim
    modal.classList.remove("visible");
    closed.style.opacity = "1";
    open.style.opacity = "0";
    open.style.transform = "translateY(0) rotate(0deg)";

    setTimeout(() => {
        modal.classList.add("visible");
    }, 50);

    setTimeout(() => {
        closed.style.opacity = "0";
        open.style.opacity = "1";
        open.style.transform = "translateY(-40px) rotate(-15deg)";
    }, 500);
}

document.getElementById("rewardClose").onclick = () => {
    document.getElementById("reward-overlay").style.display = "none";
};
