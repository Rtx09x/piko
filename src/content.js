(function () {
  if (window.__pikoLoaded) return;
  window.__pikoLoaded = true;

  const root = document.createElement("div");
  root.id = "piko-root";
  root.innerHTML = `
    <div class="piko-card" hidden>
      <button class="piko-close" type="button" aria-label="Dismiss Piko"></button>
      <div class="piko-face" aria-hidden="true">
        <span></span>
      </div>
      <div class="piko-copy">
        <strong>Piko</strong>
        <p></p>
        <div class="piko-actions">
          <button data-action="chat" type="button">Chat</button>
          <button data-action="helpful" type="button">Good</button>
          <button data-action="too-much" type="button">Too much</button>
          <button data-action="quiet" type="button">Sleep 1h</button>
        </div>
      </div>
    </div>
  `;
  document.documentElement.appendChild(root);

  const card = root.querySelector(".piko-card");
  const copy = root.querySelector("p");
  const close = root.querySelector(".piko-close");
  const quiet = root.querySelector('[data-action="quiet"]');
  const chat = root.querySelector('[data-action="chat"]');
  const helpful = root.querySelector('[data-action="helpful"]');
  const tooMuch = root.querySelector('[data-action="too-much"]');

  close.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "PIKO_FEEDBACK", feedback: "dismissed" });
    hide();
  });
  quiet.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "PIKO_QUIET", minutes: 60 });
    hide();
  });
  chat.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "PIKO_CHAT", text: "Help me refocus in one small step." });
    hide();
  });
  helpful.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "PIKO_FEEDBACK", feedback: "helpful" });
    hide();
  });
  tooMuch.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "PIKO_FEEDBACK", feedback: "tooMuch" });
    hide();
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "PIKO_NUDGE") {
      show(message.nudge?.text || "Want one tiny next step?");
    }
  });

  function show(text) {
    copy.textContent = text;
    card.hidden = false;
    clearTimeout(window.__pikoHideTimer);
    window.__pikoHideTimer = setTimeout(hide, 22000);
  }

  function hide() {
    card.hidden = true;
  }
})();
