const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const publicShareUrl = "https://project-fgt3r.vercel.app";

const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 8,
  maximumFractionDigits: 8,
});

const els = {
  form: document.querySelector("#plannerForm"),
  token: document.querySelector("#token"),
  amount: document.querySelector("#amount"),
  averageCost: document.querySelector("#averageCost"),
  gainPercent: document.querySelector("#gainPercent"),
  lossPercent: document.querySelector("#lossPercent"),
  gainTab: document.querySelector("#gainTab"),
  lossTab: document.querySelector("#lossTab"),
  slider: document.querySelector("#targetSlider"),
  sliderLabel: document.querySelector("#sliderLabel"),
  sliderValue: document.querySelector("#sliderValue"),
  tokenLabel: document.querySelector("#tokenLabel"),
  positionValue: document.querySelector("#positionValue"),
  targetPrice: document.querySelector("#targetPrice"),
  targetValue: document.querySelector("#targetValue"),
  costBasis: document.querySelector("#costBasis"),
  profitLoss: document.querySelector("#profitLoss"),
  profitLossLabel: document.querySelector("#profitLossLabel"),
  breakEven: document.querySelector("#breakEven"),
  hopiumRating: document.querySelector("#hopiumRating"),
  scenarioBadge: document.querySelector("#scenarioBadge"),
  settingsButton: document.querySelector("#settingsButton"),
  settingsMenu: document.querySelector("#settingsMenu"),
  themeToggle: document.querySelector("#themeToggle"),
  themeLabel: document.querySelector("#themeLabel"),
  copyResults: document.querySelector("#copyResults"),
  shareCalculator: document.querySelector("#shareCalculator"),
  copyMessage: document.querySelector("#copyMessage"),
  canvas: document.querySelector("#projectionChart"),
};

let mode = "gain";
let theme = "dark";
let settingsOpen = false;
let messageTimer;

function asNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function setMode(nextMode) {
  mode = nextMode;
  const isGain = mode === "gain";
  els.gainTab.classList.toggle("active", isGain);
  els.lossTab.classList.toggle("active", !isGain);
  els.gainTab.setAttribute("aria-pressed", String(isGain));
  els.lossTab.setAttribute("aria-pressed", String(!isGain));
  els.slider.max = isGain ? "5000" : "100";
  els.slider.value = isGain ? els.gainPercent.value : els.lossPercent.value;
  render();
}

function getScenario() {
  const amount = Math.max(0, asNumber(els.amount.value));
  const averageCost = Math.max(0, asNumber(els.averageCost.value));
  const gainPercent = Math.max(0, asNumber(els.gainPercent.value));
  const lossPercent = clamp(asNumber(els.lossPercent.value), 0, 100);
  const percent = mode === "gain" ? gainPercent : lossPercent;
  const multiplier = mode === "gain" ? 1 + percent / 100 : 1 - percent / 100;
  const targetPrice = averageCost * multiplier;
  const costBasis = amount * averageCost;
  const targetValue = amount * targetPrice;
  const profitLoss = targetValue - costBasis;

  return {
    token: els.token.value.trim() || "Token",
    amount,
    averageCost,
    percent,
    targetPrice,
    costBasis,
    targetValue,
    profitLoss,
  };
}

function getHopiumRating(gainPercent) {
  if (gainPercent >= 10000) {
    return "Legendary Hopium";
  }
  if (gainPercent >= 5000) {
    return "Full Send Mode";
  }
  if (gainPercent >= 1000) {
    return "Dangerously Bullish";
  }
  if (gainPercent >= 500) {
    return "Big Dog Energy";
  }
  if (gainPercent >= 100) {
    return "Mild Hopium";
  }
  return "Tiny Tail Wag";
}

function drawChart(scenario) {
  const canvas = els.canvas;
  const styles = getComputedStyle(document.body);
  const chartBg = styles.getPropertyValue("--chart-bg").trim();
  const line = styles.getPropertyValue("--line").trim();
  const ink = styles.getPropertyValue("--ink").trim();
  const muted = styles.getPropertyValue("--muted").trim();
  const panel = styles.getPropertyValue("--panel-strong").trim();
  const gain = styles.getPropertyValue("--gain").trim();
  const loss = styles.getPropertyValue("--loss").trim();
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;
  const pad = width < 520 ? 34 : 54;
  const chartWidth = width - pad * 2;
  const chartHeight = height - pad * 2;
  const start = scenario.averageCost;
  const end = scenario.targetPrice;
  const high = Math.max(start, end, 0.00000001);
  const low = Math.min(start, end, 0);
  const range = Math.max(high - low, high * 0.08);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = chartBg;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);
  for (let i = 0; i <= 4; i += 1) {
    const y = pad + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  function yFor(value) {
    return pad + chartHeight - ((value - low) / range) * chartHeight;
  }

  const color = mode === "gain" ? gain : loss;
  const fill = mode === "gain" ? "rgba(38, 194, 129, 0.16)" : "rgba(255, 107, 53, 0.16)";
  const startY = yFor(start);
  const endY = yFor(end);

  const gradient = ctx.createLinearGradient(0, pad, 0, height - pad);
  gradient.addColorStop(0, fill);
  gradient.addColorStop(1, "rgba(255,255,255,0)");

  ctx.beginPath();
  ctx.moveTo(pad, startY);
  for (let i = 0; i <= 42; i += 1) {
    const progress = i / 42;
    const ease = 1 - Math.pow(1 - progress, 2);
    const x = pad + chartWidth * progress;
    const y = startY + (endY - startY) * ease + Math.sin(progress * Math.PI * 2) * 5;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width - pad, height - pad);
  ctx.lineTo(pad, height - pad);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(pad, startY);
  for (let i = 0; i <= 42; i += 1) {
    const progress = i / 42;
    const ease = 1 - Math.pow(1 - progress, 2);
    const x = pad + chartWidth * progress;
    const y = startY + (endY - startY) * ease + Math.sin(progress * Math.PI * 2) * 5;
    ctx.lineTo(x, y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.stroke();

  drawPoint(ctx, pad, startY, ink);
  drawPoint(ctx, width - pad, endY, color);
  drawLabel(ctx, "Avg cost", priceFormatter.format(start), pad, startY, "left", {
    panel,
    line,
    muted,
    ink,
  });
  drawLabel(ctx, "Target", priceFormatter.format(end), width - pad, endY, "right", {
    panel,
    line,
    muted,
    ink,
  });
}

function drawPoint(ctx, x, y, color) {
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawLabel(ctx, title, value, x, y, align, colors) {
  const boxWidth = 132;
  const boxHeight = 48;
  const left = align === "right" ? x - boxWidth : x;
  const top = Math.max(12, Math.min(y - 62, ctx.canvas.height - boxHeight - 12));

  ctx.fillStyle = colors.panel;
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 1;
  roundRect(ctx, left, top, boxWidth, boxHeight, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = colors.muted;
  ctx.font = "700 11px system-ui, sans-serif";
  ctx.fillText(title, left + 10, top + 18);
  ctx.fillStyle = colors.ink;
  ctx.font = "800 13px system-ui, sans-serif";
  ctx.fillText(value, left + 10, top + 36);
}

function setTheme(nextTheme) {
  theme = nextTheme;
  const isLight = theme === "light";
  document.body.classList.toggle("light-mode", isLight);
  els.themeToggle.setAttribute("aria-pressed", String(isLight));
  els.themeLabel.textContent = isLight ? "Light mode" : "Dark mode";
  render();
}

function setSettingsOpen(open) {
  settingsOpen = open;
  els.settingsMenu.hidden = !settingsOpen;
  els.settingsButton.setAttribute("aria-expanded", String(settingsOpen));
  els.settingsButton.setAttribute(
    "aria-label",
    settingsOpen ? "Close settings" : "Open settings",
  );
}

function showMessage(message) {
  window.clearTimeout(messageTimer);
  els.copyMessage.textContent = message;
  messageTimer = window.setTimeout(() => {
    els.copyMessage.textContent = "";
  }, 2400);
}

async function copyText(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
    showMessage(successMessage);
  } catch (error) {
    showMessage("Copy failed. You can select and copy the result manually.");
  }
}

function buildResultSummary() {
  const scenario = getScenario();
  const gainPercent = Math.max(0, asNumber(els.gainPercent.value));
  const rating = getHopiumRating(gainPercent);
  const resultLabel = mode === "gain" ? "Potential profit" : "Potential loss";

  return [
    "Hopium Calculator:",
    `Token: ${scenario.token}`,
    `Average cost/input value: ${priceFormatter.format(scenario.averageCost)}`,
    `Gain target: ${gainPercent.toLocaleString("en-US")}%`,
    `Projected target price: ${priceFormatter.format(scenario.targetPrice)}`,
    `Projected result: ${resultLabel} ${formatter.format(Math.abs(scenario.profitLoss))}`,
    `Hopium Rating: ${rating}`,
    "For entertainment only - not financial advice.",
  ].join("\n");
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function render() {
  const scenario = getScenario();
  const isGain = mode === "gain";

  els.tokenLabel.textContent = scenario.token;
  els.positionValue.textContent = formatter.format(scenario.costBasis);
  els.targetPrice.textContent = priceFormatter.format(scenario.targetPrice);
  els.targetValue.textContent = formatter.format(scenario.targetValue);
  els.costBasis.textContent = formatter.format(scenario.costBasis);
  els.breakEven.textContent = priceFormatter.format(scenario.averageCost);
  els.hopiumRating.textContent = getHopiumRating(Math.max(0, asNumber(els.gainPercent.value)));
  els.profitLoss.textContent = formatter.format(Math.abs(scenario.profitLoss));
  els.profitLossLabel.textContent = isGain ? "Potential profit" : "Potential loss";
  els.profitLoss.style.color = isGain ? "var(--gain)" : "var(--loss)";
  els.scenarioBadge.textContent = isGain ? "Gain scenario" : "Loss scenario";
  els.scenarioBadge.classList.toggle("gain", isGain);
  els.scenarioBadge.classList.toggle("loss", !isGain);
  els.sliderLabel.textContent = isGain ? "Gain target" : "Loss target";
  els.sliderValue.textContent = `${scenario.percent.toLocaleString("en-US")}%`;

  drawChart(scenario);
}

els.gainTab.addEventListener("click", () => setMode("gain"));
els.lossTab.addEventListener("click", () => setMode("loss"));
els.settingsButton.addEventListener("click", (event) => {
  event.stopPropagation();
  setSettingsOpen(!settingsOpen);
});
els.themeToggle.addEventListener("click", () => setTheme(theme === "dark" ? "light" : "dark"));

els.settingsMenu.addEventListener("click", (event) => {
  event.stopPropagation();
});

document.addEventListener("click", () => {
  if (settingsOpen) {
    setSettingsOpen(false);
  }
});

els.slider.addEventListener("input", () => {
  if (mode === "gain") {
    els.gainPercent.value = els.slider.value;
  } else {
    els.lossPercent.value = els.slider.value;
  }
  render();
});

els.copyResults.addEventListener("click", () => {
  copyText(buildResultSummary(), "Results copied.");
});

els.shareCalculator.addEventListener("click", () => {
  copyText(publicShareUrl, "Link copied.");
});

[els.token, els.amount, els.averageCost, els.gainPercent, els.lossPercent].forEach((input) => {
  input.addEventListener("input", () => {
    if (input === els.gainPercent && mode === "gain") {
      els.slider.value = Math.min(asNumber(input.value), asNumber(els.slider.max));
    }
    if (input === els.lossPercent && mode === "loss") {
      const value = clamp(asNumber(input.value), 0, 100);
      els.lossPercent.value = value;
      els.slider.value = value;
    }
    render();
  });
});

window.addEventListener("resize", render);
render();
