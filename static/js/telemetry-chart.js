/**
 * Luminous Chat — Telemetry Diagnostics & Canvas Charting Controller
 * Extracted from script.js
 */

window.TelemetryChart = {
  telemetryDataPoints: [],
  config: {},

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
        if (this.telemetryDashboardModal) {
          this.telemetryDashboardModal.classList.remove("open");
          setTimeout(() => (this.telemetryDashboardModal.style.display = "none"), 300);
        }
      });
    }

    // Run Speed Test button click
    if (this.runTestModelSpeedBtn) {
      this.runTestModelSpeedBtn.addEventListener("click", async () => {
        await this.runModelSpeedTest();
      });
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

    // Handle high-DPI displays
    const rect = this.telemetryChartFileSystem.getBoundingClientRect();
    this.telemetryChartFileSystem.width = rect.width * (window.devicePixelRatio || 1);
    this.telemetryChartFileSystem.height = rect.height * (window.devicePixelRatio || 1);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

    const width = rect.width;
    const height = rect.height;
    const paddingLeft = 45;
    const paddingBottom = 35;
    const paddingTop = 20;
    const paddingRight = 20;
    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;

    ctx.clearRect(0, 0, width, height);

    if (this.telemetryDataPoints.length === 0) return;

    // Determine max values for scaling
    let minX = this.telemetryDataPoints[0].tokens;
    let maxX = this.telemetryDataPoints[this.telemetryDataPoints.length - 1].tokens;
    let rangeX = maxX - minX;
    if (rangeX === 0) rangeX = 1; // Prevent division by zero

    let maxY = Math.max(...this.telemetryDataPoints.map((p) => p.tps), 10); // Floor of 10 TPS
    maxY = maxY * 1.2; // Add 20% headroom

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
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";

    // Calculate a clean step size based on range
    let tickStep;
    if (rangeX <= 500) tickStep = 50;
    else if (rangeX <= 2500) tickStep = 250;
    else if (rangeX <= 10000) tickStep = 1000;
    else if (rangeX <= 50000) tickStep = 5000;
    else tickStep = 10000;

    // Find the first clean multiple of tickStep that is >= minX
    let currentTick = Math.ceil(minX / tickStep) * tickStep;

    while (currentTick <= maxX) {
      const x = paddingLeft + ((currentTick - minX) / rangeX) * plotWidth;

      // Draw grid line
      ctx.moveTo(x, paddingTop);
      ctx.lineTo(x, height - paddingBottom);

      // Draw label
      let labelText;
      if (tickStep >= 1000) {
        labelText = (currentTick / 1000).toFixed(0) + "k";
      } else {
        // For small steps, use 1 decimal if needed, but drop .0
        labelText = (currentTick / 1000).toFixed(1).replace(".0", "") + "k";
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
      const x = paddingLeft + ((point.tokens - minX) / rangeX) * plotWidth;
      const y = height - paddingBottom - (point.tps / maxY) * plotHeight;
      if (index === 0) {
        ctx.moveTo(x, height - paddingBottom);
        ctx.lineTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    if (this.telemetryDataPoints.length > 0) {
      const lastPoint = this.telemetryDataPoints[this.telemetryDataPoints.length - 1];
      const lastX =
        paddingLeft + ((lastPoint.tokens - minX) / rangeX) * plotWidth;
      const firstPoint = this.telemetryDataPoints[0];
      const firstX =
        paddingLeft + ((firstPoint.tokens - minX) / rangeX) * plotWidth;
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
      const x = paddingLeft + ((point.tokens - minX) / rangeX) * plotWidth;
      const y = height - paddingBottom - (point.tps / maxY) * plotHeight;

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
      const x = paddingLeft + ((point.tokens - minX) / rangeX) * plotWidth;
      const y = height - paddingBottom - (point.tps / maxY) * plotHeight;
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

    try {
      const response = await fetch("/api/models/test-speed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
              if (data.timings) {
                turnCount++;
                const ttft = data.timings.prompt_ms;
                const prefillTps =
                  data.timings.prompt_n / (data.timings.prompt_ms / 1000);
                currentTurnDecodeTps =
                  data.timings.predicted_n /
                  (data.timings.predicted_ms / 1000);

                totalTtftSum += ttft;
                totalPrefillTpsSum += prefillTps;
                totalDecodeTpsSum += currentTurnDecodeTps;

                const avgTtft = (totalTtftSum / turnCount).toFixed(0);
                const avgPrefill = (totalPrefillTpsSum / turnCount).toFixed(2);
                const avgDecode = (totalDecodeTpsSum / turnCount).toFixed(2);

                if (this.testSpeedTtft) this.testSpeedTtft.textContent = `${avgTtft}`;
                if (this.testSpeedPrefillTps) this.testSpeedPrefillTps.textContent = `${avgPrefill}`;
                if (this.testSpeedCurrentTps) this.testSpeedCurrentTps.textContent = `${avgDecode}`;

                const prompt_n = data.timings.prompt_n || 0;
                const predicted_n = data.timings.predicted_n || 0;
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
      if (this.testSpeedStatus) {
        this.testSpeedStatus.textContent = "Failed";
        this.testSpeedStatus.style.color = "var(--color-rose-500)";
      }
      if (this.testSpeedCurrentTps) {
        this.testSpeedCurrentTps.textContent = err.message;
      }
    }
  }
};
