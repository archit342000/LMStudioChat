/**
 * Luminous Chat — Telemetry Diagnostics & Canvas Charting Controller
 * Extracted from script.js
 */

window.TelemetryChart = {
  telemetryDataPoints: [],
  config: {},
  targetContextThreshold: 0,
  testAbortController: null,

  // Cached DOM elements
  sysTestModelSpeedBtn: null,
  testModelSpeedModal: null,
  closeTestModelSpeedBtn: null,
  runTestModelSpeedBtn: null,
  testSpeedModelSelect: null,
  testSpeedContextSlider: null,
  testSpeedContextVal: null,
  telemetryDashboardModal: null,
  closeTelemetryDashboardBtn: null,
  telemetryModelName: null,
  telemetryChartFileSystem: null,
  testSpeedStatus: null,
  testSpeedTokensGen: null,
  testSpeedTtft: null,
  testSpeedPrefillTps: null,
  testSpeedCurrentTps: null,
  stopTestBtn: null,

  init: function(config = {}) {
    this.config = config;

    // Cache DOM Elements
    this.sysTestModelSpeedBtn = document.getElementById("sys-test-model-speed");
    this.testModelSpeedModal = document.getElementById("test-model-speed-modal");
    this.closeTestModelSpeedBtn = document.getElementById("close-test-model-speed");
    this.runTestModelSpeedBtn = document.getElementById("run-model-speed-test");
    this.testSpeedModelSelect = document.getElementById("test-speed-model-select");
    this.testSpeedContextSlider = document.getElementById("test-speed-context-slider");
    this.testSpeedContextVal = document.getElementById("test-speed-context-val");
    this.telemetryDashboardModal = document.getElementById("telemetry-dashboard-modal");
    this.closeTelemetryDashboardBtn = document.getElementById("close-telemetry-dashboard");
    this.telemetryModelName = document.getElementById("telemetry-model-name");
    this.telemetryChartFileSystem = document.getElementById("telemetry-chart");
    this.testSpeedStatus = document.getElementById("test-speed-status");
    this.testSpeedTokensGen = document.getElementById("test-speed-tokens-gen");
    this.testSpeedTtft = document.getElementById("test-speed-ttft");
    this.testSpeedPrefillTps = document.getElementById("test-speed-prefill-tps");
    this.testSpeedCurrentTps = document.getElementById("test-speed-current-tps");
    this.stopTestBtn = document.getElementById("stop-model-speed-test");

    this.setupListeners();
  },

  setupListeners: function() {
    // Open Speed Test modal click
    if (this.sysTestModelSpeedBtn) {
      this.sysTestModelSpeedBtn.addEventListener("click", async () => {
        if (typeof this.config.closeSystemSettings === "function") {
          this.config.closeSystemSettings();
        }

        if (this.testModelSpeedModal) {
          this.testModelSpeedModal.style.display = "flex";
          setTimeout(() => this.testModelSpeedModal.classList.add("open"), 10);
        }

        await this.fetchModelsForDropdown();
      });
    }

    // Close Speed Test modal click
    if (this.closeTestModelSpeedBtn) {
      this.closeTestModelSpeedBtn.addEventListener("click", () => {
        if (this.testModelSpeedModal) {
          this.testModelSpeedModal.classList.remove("open");
          setTimeout(() => (this.testModelSpeedModal.style.display = "none"), 300);
        }
      });
    }

    // Context threshold slider input listener
    if (this.testSpeedContextSlider && this.testSpeedContextVal) {
      this.testSpeedContextSlider.addEventListener("input", (e) => {
        this.testSpeedContextVal.textContent = e.target.value;
      });
    }

    // Close Telemetry Dashboard modal click
    if (this.closeTelemetryDashboardBtn) {
      this.closeTelemetryDashboardBtn.addEventListener("click", () => {
        this.stopModelSpeedTest();
        if (this.telemetryDashboardModal) {
          this.telemetryDashboardModal.classList.remove("open");
          setTimeout(() => (this.telemetryDashboardModal.style.display = "none"), 300);
        }
      });
    }

    // Stop Speed Test button click
    if (this.stopTestBtn) {
      this.stopTestBtn.addEventListener("click", () => {
        this.stopModelSpeedTest();
      });
    }

    // Run Speed Test button click
    if (this.runTestModelSpeedBtn) {
      this.runTestModelSpeedBtn.addEventListener("click", async () => {
        await this.runModelSpeedTest();
      });
    }
  },

  stopModelSpeedTest: function() {
    if (this.testAbortController) {
      this.testAbortController.abort();
      this.testAbortController = null;
    }
    if (this.stopTestBtn) {
      this.stopTestBtn.style.display = "none";
    }
  },

  fetchModelsForDropdown: async function() {
    if (!this.testSpeedModelSelect) return;

    try {
      const response = await fetch("/api/models/config");
      if (response.ok) {
        const data = await response.json();
        this.testSpeedModelSelect.innerHTML = "";

        const llmModels = new Set();
        if (data.research) {
          Object.values(data.research).forEach((m) => llmModels.add(m));
        }
        if (data.general) {
          Object.values(data.general).forEach((m) => llmModels.add(m));
        }

        if (llmModels.size > 0) {
          Array.from(llmModels).forEach((model) => {
            const option = document.createElement("option");
            option.value = model;
            option.textContent = model;
            this.testSpeedModelSelect.appendChild(option);
          });
        } else {
          this.testSpeedModelSelect.innerHTML =
            '<option value="" disabled selected>No models found.</option>';
        }
      }
    } catch (e) {
      console.error("Failed to fetch models for speed test:", e);
      this.testSpeedModelSelect.innerHTML =
        '<option value="" disabled selected>Failed to load models.</option>';
    }
  },

  drawTelemetryChart: function() {
    if (!this.telemetryChartFileSystem) return;
    const ctx = this.telemetryChartFileSystem.getContext("2d");
    if (!ctx) return;

    // Handle high-DPI displays only when dimensions change
    const rect = this.telemetryChartFileSystem.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const targetWidth = Math.floor(rect.width * dpr);
    const targetHeight = Math.floor(rect.height * dpr);

    if (this.telemetryChartFileSystem.width !== targetWidth || this.telemetryChartFileSystem.height !== targetHeight) {
      this.telemetryChartFileSystem.width = targetWidth;
      this.telemetryChartFileSystem.height = targetHeight;
      ctx.scale(dpr, dpr);
    }

    const width = rect.width;
    const height = rect.height;
    const paddingLeft = 55; // Increased padding to prevent label clipping
    const paddingBottom = 35;
    const paddingTop = 20;
    const paddingRight = 25; // Slightly increased padding
    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;

    ctx.clearRect(0, 0, width, height);

    if (this.telemetryDataPoints.length === 0) return;

    // Determine max values for scaling
    const minX = 0; // Fixed baseline at 0
    const maxX = this.targetContextThreshold || Math.max(...this.telemetryDataPoints.map((p) => p.tokens), 2048);
    let rangeX = maxX - minX;
    if (rangeX === 0) rangeX = 1; // Prevent division by zero

    let maxY = Math.max(...this.telemetryDataPoints.map((p) => p.tps).filter(t => !isNaN(t) && isFinite(t)), 10); // Floor of 10 TPS
    maxY = maxY * 1.2; // Add 20% headroom
    if (!isFinite(maxY)) maxY = 12;

    // Draw Grid & Labels
    ctx.lineWidth = 1;
    ctx.font = "10px monospace";
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    // Horizontal lines (Y-axis)
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    for (let i = 0; i <= 4; i++) {
      const y = paddingTop + plotHeight * (i / 4);
      // Draw grid line
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(width - paddingRight, y);

      // Draw label
      const labelValue = (maxY - maxY * (i / 4)).toFixed(0);
      ctx.fillText(labelValue, paddingLeft - 10, y);
    }
    ctx.stroke();

    // Vertical lines (X-axis) - Dynamic 'Nice Ticks'
    ctx.textBaseline = "top";
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";

    // Calculate a clean step size based on range
    let tickStep;
    if (rangeX <= 500) tickStep = 100;
    else if (rangeX <= 2500) tickStep = 500;
    else if (rangeX <= 10000) tickStep = 2000;
    else if (rangeX <= 50000) tickStep = 10000;
    else if (rangeX <= 150000) tickStep = 25000;
    else if (rangeX <= 500000) tickStep = 100000;
    else tickStep = 200000;

    let currentTick = 0;

    while (currentTick <= maxX) {
      const x = paddingLeft + ((currentTick - minX) / rangeX) * plotWidth;

      // Draw grid line
      ctx.moveTo(x, paddingTop);
      ctx.lineTo(x, height - paddingBottom);

      // Draw label with boundary-aware text alignment
      if (x - paddingLeft < 10) {
        ctx.textAlign = "left";
      } else if (width - paddingRight - x < 10) {
        ctx.textAlign = "right";
      } else {
        ctx.textAlign = "center";
      }

      let labelText;
      if (currentTick === 0) {
        labelText = "0";
      } else if (currentTick < 1000) {
        labelText = currentTick.toString();
      } else {
        const kVal = currentTick / 1000;
        if (kVal % 1 === 0) {
          labelText = kVal.toFixed(0) + "k";
        } else {
          labelText = kVal.toFixed(1).replace(".0", "") + "k";
        }
      }

      ctx.fillText(labelText, x, height - paddingBottom + 10);

      currentTick += tickStep;
    }
    ctx.stroke();

    // Create gradient for fill
    const gradient = ctx.createLinearGradient(
      0,
      paddingTop,
      0,
      height - paddingBottom,
    );
    gradient.addColorStop(0, "rgba(16, 185, 129, 0.4)"); // Emerald
    gradient.addColorStop(1, "rgba(16, 185, 129, 0.0)");

    // Draw Filled Area
    ctx.beginPath();
    this.telemetryDataPoints.forEach((point, index) => {
      const pointTokens = !isNaN(point.tokens) && isFinite(point.tokens) ? point.tokens : 0;
      const pointTps = !isNaN(point.tps) && isFinite(point.tps) ? point.tps : 0;
      const x = paddingLeft + ((pointTokens - minX) / rangeX) * plotWidth;
      const y = height - paddingBottom - (pointTps / maxY) * plotHeight;
      if (index === 0) {
        ctx.moveTo(x, height - paddingBottom);
        ctx.lineTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    if (this.telemetryDataPoints.length > 0) {
      const lastPoint = this.telemetryDataPoints[this.telemetryDataPoints.length - 1];
      const lastPointTokens = !isNaN(lastPoint.tokens) && isFinite(lastPoint.tokens) ? lastPoint.tokens : 0;
      const lastX =
        paddingLeft + ((lastPointTokens - minX) / rangeX) * plotWidth;
      const firstPoint = this.telemetryDataPoints[0];
      const firstPointTokens = !isNaN(firstPoint.tokens) && isFinite(firstPoint.tokens) ? firstPoint.tokens : 0;
      const firstX =
        paddingLeft + ((firstPointTokens - minX) / rangeX) * plotWidth;
      ctx.lineTo(lastX, height - paddingBottom);
      ctx.lineTo(firstX, height - paddingBottom);
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // Draw Waveform Line
    ctx.beginPath();
    ctx.strokeStyle = "var(--color-emerald)";
    ctx.lineWidth = 3;
    ctx.shadowBlur = 12;
    ctx.shadowColor = "var(--color-emerald)";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    this.telemetryDataPoints.forEach((point, index) => {
      const pointTokens = !isNaN(point.tokens) && isFinite(point.tokens) ? point.tokens : 0;
      const pointTps = !isNaN(point.tps) && isFinite(point.tps) ? point.tps : 0;
      const x = paddingLeft + ((pointTokens - minX) / rangeX) * plotWidth;
      const y = height - paddingBottom - (pointTps / maxY) * plotHeight;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw Data Points
    ctx.shadowBlur = 0;
    this.telemetryDataPoints.forEach((point) => {
      const pointTokens = !isNaN(point.tokens) && isFinite(point.tokens) ? point.tokens : 0;
      const pointTps = !isNaN(point.tps) && isFinite(point.tps) ? point.tps : 0;
      const x = paddingLeft + ((pointTokens - minX) / rangeX) * plotWidth;
      const y = height - paddingBottom - (pointTps / maxY) * plotHeight;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "var(--color-neutral-900)";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "var(--color-emerald)";
      ctx.stroke();
    });
  },

  runModelSpeedTest: async function() {
    if (!this.testSpeedModelSelect) return;
    const selectedModel = this.testSpeedModelSelect.value;
    if (!selectedModel) {
      if (typeof showToast === "function") {
        showToast("Please select a model first.", "error");
      }
      return;
    }

    const targetContextThreshold = this.testSpeedContextSlider
      ? parseInt(this.testSpeedContextSlider.value)
      : 2048;

    this.targetContextThreshold = targetContextThreshold;

    // Transition UI
    if (this.testModelSpeedModal) {
      this.testModelSpeedModal.classList.remove("open");
      setTimeout(() => (this.testModelSpeedModal.style.display = "none"), 300);
    }
    if (this.telemetryDashboardModal) {
      this.telemetryDashboardModal.style.display = "flex";
      setTimeout(() => this.telemetryDashboardModal.classList.add("open"), 10);
    }

    // Dashboard Reset
    if (this.telemetryModelName) this.telemetryModelName.textContent = selectedModel;
    if (this.testSpeedStatus) {
      this.testSpeedStatus.textContent = "Unloading & Loading (may take a moment)...";
      this.testSpeedStatus.style.color = "var(--color-blue-400)";
    }
    if (this.testSpeedTokensGen) this.testSpeedTokensGen.textContent = "0";
    if (this.testSpeedTtft) this.testSpeedTtft.textContent = "-";
    if (this.testSpeedPrefillTps) this.testSpeedPrefillTps.textContent = "-";
    if (this.testSpeedCurrentTps) this.testSpeedCurrentTps.textContent = "-";

    this.telemetryDataPoints = [];
    this.drawTelemetryChart();

    this.testAbortController = new AbortController();
    if (this.stopTestBtn) {
      this.stopTestBtn.style.display = "block";
    }

    try {
      const response = await fetch("/api/models/test-speed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: this.testAbortController.signal,
        body: JSON.stringify({
          model: selectedModel,
          target_context_threshold: targetContextThreshold,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Server error");
      }

      if (this.testSpeedStatus) {
        this.testSpeedStatus.textContent = "Streaming Generation...";
        this.testSpeedStatus.style.color = "var(--color-green-400)";
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let ttftLogged = false;
      let currentTurnTokens = 0;
      let hasProcessedTimingsForCurrentTurn = false;

      let buffer = "";

      // Aggregates
      let totalTtftSum = 0;
      let totalPrefillTpsSum = 0;
      let totalDecodeTpsSum = 0;
      let turnCount = 0;

      // Temporary storage to sync timings and usage
      let currentTurnDecodeTps = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // Keep the last incomplete line

        for (let line of lines) {
          line = line.trim();
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const data = JSON.parse(line.substring(6));

              if (data.error) {
                throw new Error(data.error);
              }

              if (data.test_status && this.testSpeedStatus) {
                this.testSpeedStatus.textContent = data.test_status;
                if (data.test_status.startsWith("Completed")) {
                  this.testSpeedStatus.style.color = "var(--color-green-400)";
                } else {
                  this.testSpeedStatus.style.color = "var(--color-blue-400)";
                }
                if (data.test_status.startsWith("Starting Turn")) {
                  ttftLogged = false;
                  hasProcessedTimingsForCurrentTurn = false;
                  currentTurnTokens = 0;
                  currentTurnDecodeTps = null;
                }
              }

              if (
                data.choices &&
                data.choices.length > 0 &&
                data.choices[0].delta &&
                "content" in data.choices[0].delta
              ) {
                if (!ttftLogged) {
                  ttftLogged = true;
                  if (this.testSpeedStatus) {
                    this.testSpeedStatus.textContent = "Streaming Generation...";
                    this.testSpeedStatus.style.color = "var(--color-green-400)";
                  }
                }
              }

              // Handle native timings block if available
              if (data.timings && !hasProcessedTimingsForCurrentTurn) {
                hasProcessedTimingsForCurrentTurn = true;
                turnCount++;
                const prompt_ms = data.timings.prompt_ms || 1.0;
                const predicted_ms = data.timings.predicted_ms || 1.0;
                const prompt_n = data.timings.prompt_n || 0;
                const predicted_n = data.timings.predicted_n || 0;

                const ttft = prompt_ms;
                const prefillTps = prompt_ms > 0 ? (prompt_n / (prompt_ms / 1000)) : 0;
                currentTurnDecodeTps = predicted_ms > 0 ? (predicted_n / (predicted_ms / 1000)) : 0;

                totalTtftSum += ttft;
                totalPrefillTpsSum += prefillTps;
                totalDecodeTpsSum += currentTurnDecodeTps;

                const avgTtft = (totalTtftSum / turnCount).toFixed(0);
                const avgPrefill = (totalPrefillTpsSum / turnCount).toFixed(2);
                const avgDecode = (totalDecodeTpsSum / turnCount).toFixed(2);

                if (this.testSpeedTtft) this.testSpeedTtft.textContent = `${avgTtft}`;
                if (this.testSpeedPrefillTps) this.testSpeedPrefillTps.textContent = `${avgPrefill}`;
                if (this.testSpeedCurrentTps) this.testSpeedCurrentTps.textContent = `${avgDecode}`;

                // Fallback context size if usage block doesn't come
                if (
                  prompt_n + predicted_n > 0 &&
                  (!data.usage || !data.usage.total_tokens)
                ) {
                  currentTurnTokens = prompt_n + predicted_n;
                  if (this.testSpeedTokensGen) {
                    this.testSpeedTokensGen.textContent = currentTurnTokens.toString();
                  }
                }
              }

              if (data.usage && data.usage.total_tokens) {
                currentTurnTokens = data.usage.total_tokens;
                if (this.testSpeedTokensGen) {
                  this.testSpeedTokensGen.textContent = currentTurnTokens.toString();
                }
              }

              // Sync Plotting
              if (currentTurnTokens > 0 && currentTurnDecodeTps !== null) {
                this.telemetryDataPoints.push({
                  tokens: currentTurnTokens,
                  tps: currentTurnDecodeTps,
                });
                this.drawTelemetryChart();
                currentTurnDecodeTps = null; // Reset for next turn
                currentTurnTokens = 0; // Reset for next turn
              }
            } catch (e) {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }

      if (this.testSpeedStatus && this.testSpeedStatus.textContent === "Streaming Generation...") {
        this.testSpeedStatus.textContent = "Completed";
      }
    } catch (err) {
      if (err.name === "AbortError") {
        if (this.testSpeedStatus) {
          this.testSpeedStatus.textContent = "Stopped";
          this.testSpeedStatus.style.color = "var(--color-amber)";
        }
      } else {
        if (this.testSpeedStatus) {
          this.testSpeedStatus.textContent = "Failed";
          this.testSpeedStatus.style.color = "var(--color-rose-500)";
        }
        if (this.testSpeedCurrentTps) {
          this.testSpeedCurrentTps.textContent = err.message;
        }
      }
    } finally {
      this.testAbortController = null;
      if (this.stopTestBtn) {
        this.stopTestBtn.style.display = "none";
      }
    }
  }
};
