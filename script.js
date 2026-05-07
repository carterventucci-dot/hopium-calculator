const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const publicShareUrl = "https://project-fgt3r.vercel.app";
const krakenTickerUrl = "https://api.kraken.com/0/public/Ticker?pair=";
const krakenAssetPairsUrl = "https://api.kraken.com/0/public/AssetPairs";
const krakenDogPair = "DOGUSD";
const krakenBtcPair = "XBTUSD";
const livePricesCacheKey = "hopiumCalculatorKrakenLivePrices";
const livePricesRefreshMs = 5 * 60 * 1000;

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
  dogPrice: document.querySelector("#dogPrice"),
  dogChange: document.querySelector("#dogChange"),
  btcPrice: document.querySelector("#btcPrice"),
  btcChange: document.querySelector("#btcChange"),
  pricesUpdated: document.querySelector("#pricesUpdated"),
  pricesStatus: document.querySelector("#pricesStatus"),
  refreshPrices: document.querySelector("#refreshPrices"),
  canvas: document.querySelector("#projectionChart"),
};

let mode = "gain";
let theme = "dark";
let settingsOpen = false;
let messageTimer;
let livePricesTimer;

function asNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function readLivePricesCache() {
  try {
    const saved = localStorage.getItem(livePricesCacheKey);
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    return null;
  }
}

function writeLivePricesCache(data) {
  try {
    localStorage.setItem(
      livePricesCacheKey,
      JSON.stringify({
        savedAt: Date.now(),
        data,
      }),
    );
  } catch (error) {
    // If storage is unavailable, live prices still work for the current page load.
  }
}

function isFreshCache(cache) {
  return Boolean(cache && cache.data && Date.now() - cache.savedAt < livePricesRefreshMs);
}

function formatDogPrice(value) {
  if (!Number.isFinite(value)) {
    return "Unavailable";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value >= 1 ? 2 : 8,
    maximumFractionDigits: value >= 1 ? 4 : 10,
  }).format(value);
}

function formatBtcPrice(value) {
  if (!Number.isFinite(value)) {
    return "Unavailable";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getKrakenLastPrice(ticker) {
  const price = Number(ticker?.c?.[0]);
  return Number.isFinite(price) ? price : null;
}

function getKrakenChangePercent(ticker) {
  const current = Number(ticker?.c?.[0]);
  const open = Number(ticker?.o);
  if (!Number.isFinite(current) || !Number.isFinite(open) || open === 0) {
    return null;
  }

  return ((current - open) / open) * 100;
}

function findTickerByRequestedPair(result, requestedPair) {
  if (!result) {
    return null;
  }

  if (result[requestedPair]) {
    return result[requestedPair];
  }

  if (requestedPair === krakenBtcPair && result.XXBTZUSD) {
    return result.XXBTZUSD;
  }

  if (requestedPair !== krakenBtcPair) {
    const dogEntry = Object.entries(result).find(([pairName]) => pairName !== "XXBTZUSD");
    return dogEntry?.[1] || null;
  }

  return null;
}

function makeKrakenTickerUrl(pairs) {
  return `${krakenTickerUrl}${encodeURIComponent(pairs.join(","))}`;
}

async function fetchKrakenJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Kraken request failed");
  }

  const data = await response.json();
  if (data.error?.length) {
    throw new Error(data.error.join(", "));
  }

  return data.result || {};
}

async function findDogUsdPair() {
  const pairs = await fetchKrakenJson(krakenAssetPairsUrl);
  const entries = Object.entries(pairs);
  const match = entries.find(([, pair]) => {
    const altname = pair.altname || "";
    const wsname = pair.wsname || "";
    return altname === krakenDogPair || wsname === "DOG/USD";
  });

  return match?.[1]?.altname || match?.[0] || null;
}

async function fetchKrakenPrices() {
  const fetchedAt = Date.now();

  try {
    const result = await fetchKrakenJson(makeKrakenTickerUrl([krakenDogPair, krakenBtcPair]));
    const dogTicker = findTickerByRequestedPair(result, krakenDogPair);
    const btcTicker = findTickerByRequestedPair(result, krakenBtcPair);
    const dogPrice = getKrakenLastPrice(dogTicker);
    const btcPrice = getKrakenLastPrice(btcTicker);

    return {
      dogPair: krakenDogPair,
      btcPair: krakenBtcPair,
      dogPrice,
      btcPrice,
      dogChange: getKrakenChangePercent(dogTicker),
      btcChange: getKrakenChangePercent(btcTicker),
      fetchedAt,
    };
  } catch (error) {
    const foundDogPair = await findDogUsdPair();
    const fallbackPairs = foundDogPair ? [foundDogPair, krakenBtcPair] : [krakenBtcPair];
    const result = await fetchKrakenJson(makeKrakenTickerUrl(fallbackPairs));
    const dogTicker = foundDogPair ? findTickerByRequestedPair(result, foundDogPair) : null;
    const btcTicker = findTickerByRequestedPair(result, krakenBtcPair);

    return {
      dogPair: foundDogPair || krakenDogPair,
      btcPair: krakenBtcPair,
      dogPrice: getKrakenLastPrice(dogTicker),
      btcPrice: getKrakenLastPrice(btcTicker),
      dogChange: getKrakenChangePercent(dogTicker),
      btcChange: getKrakenChangePercent(btcTicker),
      fetchedAt,
    };
  }
}

function formatTickerChange(value) {
  if (!Number.isFinite(value)) {
    return "24h unavailable";
  }

  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function setChangeClass(element, value) {
  element.classList.toggle("positive", Number.isFinite(value) && value >= 0);
  element.classList.toggle("negative", Number.isFinite(value) && value < 0);
}

function renderLivePrices(data, statusText) {
  const hasDog = Number.isFinite(data?.dogPrice);
  const hasBtc = Number.isFinite(data?.btcPrice);

  els.dogPrice.textContent = hasDog ? formatDogPrice(data.dogPrice) : "DOG unavailable";
  els.btcPrice.textContent = hasBtc ? formatBtcPrice(data.btcPrice) : "BTC unavailable";
  els.dogChange.textContent = hasDog ? formatTickerChange(data.dogChange) : "DOG unavailable";
  els.btcChange.textContent = hasBtc ? formatTickerChange(data.btcChange) : "BTC unavailable";
  setChangeClass(els.dogChange, data?.dogChange);
  setChangeClass(els.btcChange, data?.btcChange);
  els.pricesUpdated.textContent = data?.fetchedAt
    ? new Date(data.fetchedAt).toLocaleString()
    : "Unavailable";
  els.pricesStatus.textContent =
    hasDog || hasBtc ? statusText : "Unavailable";
}

function renderLivePricesError(message) {
  els.dogPrice.textContent = "DOG unavailable";
  els.btcPrice.textContent = "BTC unavailable";
  els.dogChange.textContent = "DOG unavailable";
  els.btcChange.textContent = "BTC unavailable";
  els.dogChange.classList.remove("positive", "negative");
  els.btcChange.classList.remove("positive", "negative");
  els.pricesUpdated.textContent = "Unavailable";
  els.pricesStatus.textContent = message;
}

async function loadLivePrices() {
  const cache = readLivePricesCache();

  if (isFreshCache(cache)) {
    renderLivePrices(cache.data, "Cached");
    return;
  }

  els.pricesStatus.textContent = "Refreshing...";

  try {
    const data = await fetchKrakenPrices();
    if (!Number.isFinite(data.dogPrice) && !Number.isFinite(data.btcPrice)) {
      throw new Error("No Kraken prices returned");
    }

    writeLivePricesCache(data);
    renderLivePrices(data, "Live");
  } catch (error) {
    if (cache?.data) {
      renderLivePrices(cache.data, "Cached");
      return;
    }

    renderLivePricesError("Live prices unavailable right now.");
  }
}

function startLivePricesTimer() {
  window.clearInterval(livePricesTimer);
  if (document.hidden) {
    return;
  }

  livePricesTimer = window.setInterval(loadLivePrices, livePricesRefreshMs);
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

els.refreshPrices.addEventListener("click", () => {
  loadLivePrices();
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
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    window.clearInterval(livePricesTimer);
    return;
  }

  loadLivePrices();
  startLivePricesTimer();
});

render();
loadLivePrices();
startLivePricesTimer();
