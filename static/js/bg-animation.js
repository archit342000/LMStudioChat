/**
 * Luminous Chat — 3D Background Animation
 * Extracted from script.js (Phase 1 refactor).
 * Self-contained: reads only #bg-stars canvas and document.body.classList.
 */
document.addEventListener("DOMContentLoaded", function () {
  function initBackgroundAnimation() {
    const canvas = document.getElementById("bg-stars");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let width, height;
    let particles = [];
    const count = 900;
    let radius = 350;
    const perspective = 800;

    let mouseX = 0,
      mouseY = 0;
    let mouseX_lerp = 0,
      mouseY_lerp = 0;

    // Follow / Drift State
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let followX = targetX;
    let followY = targetY;

    // Ripple Effect State
    let rippleX = 0;
    let rippleStrength = 0;

    const colors = [
      "#2563EB", // Higher contrast Blue
      "#3B82F6", // Brighter Blue (Hex replacement for var(--accent))
      "#1E40AF", // Deep Ocean Blue
      "#60A5FA", // Sky Blue (Hex replacement for var(--accent-light))
      "#DBEAFE", // High contrast White-Blue for Dark mode
    ];

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = canvas.width = window.innerWidth * dpr;
      height = canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.scale(dpr, dpr);

      const minDim = Math.min(window.innerWidth, window.innerHeight);
      if (window.innerWidth <= 768) {
        radius = minDim * 0.38; // Slightly smaller on mobile
      } else {
        radius = Math.max(300, minDim * 0.28); // Smaller on desktop
      }

      targetX = window.innerWidth / 2;
      targetY = window.innerHeight / 2;
    }

    function createParticles() {
      particles = [];
      for (let i = 0; i < count; i++) {
        const phi = Math.acos(-1 + (2 * i) / count);
        const theta = Math.sqrt(count * Math.PI) * phi;

        const dispersion = radius * 0.9;
        const r = radius + (Math.random() - 0.5) * dispersion;

        const ux = Math.cos(theta) * Math.sin(phi);
        const uy = Math.sin(theta) * Math.sin(phi);
        const uz = Math.cos(phi);

        particles.push({
          ux,
          uy,
          uz,
          dist: r,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 1.5 + Math.random() * 2.5, // Slightly smaller particles
        });
      }
    }

    function rotatePoint(p, ax, ay) {
      let cosY = Math.cos(ay),
        sinY = Math.sin(ay);
      let x1 = p.x * cosY - p.z * sinY;
      let z1 = p.x * sinY + p.z * cosY;
      let cosX = Math.cos(ax),
        sinX = Math.sin(ax);
      let y2 = p.y * cosX - z1 * sinX;
      let z2 = p.y * sinX + z1 * cosX;
      return { x: x1, y: y2, z: z2 };
    }

    function animate() {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      const time = Date.now();

      mouseX_lerp += (mouseX - mouseX_lerp) * 0.05;
      mouseY_lerp += (mouseY - mouseY_lerp) * 0.05;

      // Smoother but faster responsive following
      followX += (targetX - followX) * 0.06;
      followY += (targetY - followY) * 0.06;

      const driftX = Math.sin(time * 0.0006) * 40;
      const driftY = Math.cos(time * 0.0008) * 30;

      const finalCenterX = followX + driftX;
      const finalCenterY = followY + driftY;

      const currentRotX = -mouseY_lerp * 0.3;
      const currentRotY = time * 0.0001 + mouseX_lerp * 0.4;

      // Update Ripple Burst (Fine-tuned for Antigravity)
      if (rippleStrength > 0.01) {
        rippleStrength *= 0.99;
        rippleX += 2.5; // Slightly faster than before but still "slow"
      } else {
        rippleStrength = 0;
        rippleX = 0;
      }

      const projected = [];
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        const wavePattern =
          Math.sin(time * 0.0015 + p.ux * 2 + p.uy * 2 + p.uz * 2) * 15;
        const rBase = p.dist + wavePattern;

        let rx = p.ux * rBase;
        let ry = p.uy * rBase;
        let rz = p.uz * rBase;

        if (rippleStrength > 0) {
          const diff = Math.abs(rBase - rippleX);
          if (diff < 160) {
            const wavePeak = Math.exp(-Math.pow(diff / 75, 2));
            const force = wavePeak * rippleStrength * 140;
            rx += p.ux * force;
            ry += p.uy * force;
            rz += p.uz * force;
          }
        }

        const r = rotatePoint(
          { x: rx, y: ry, z: rz },
          currentRotX,
          currentRotY,
        );
        const scale = perspective / (perspective + r.z);

        if (scale < 0) continue;

        projected.push({
          x: r.x * scale + finalCenterX,
          y: r.y * scale + finalCenterY,
          z: r.z,
          color: p.color,
          size: p.size * scale,
        });
      }

      projected.sort((a, b) => b.z - a.z);

      const isDark = document.body.classList.contains("dark");

      projected.forEach((p) => {
        const alpha = Math.min(
          isDark ? 0.98 : 0.92,
          Math.max(0.1, (p.z + radius) / (2 * radius) + 0.18),
        );
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      requestAnimationFrame(animate);
    }

    function triggerRipple(x, y) {
      // Instant position push to eliminate visual lag
      followX += (x - followX) * 0.15;
      followY += (y - followY) * 0.15;

      targetX = x;
      targetY = y;

      rippleX = radius * 0.3; // Start even deeper to hidden particles hit sooner
      rippleStrength = 1.3; // Stronger initial impact
    }

    // Unified Pointer Events for zero-lag response
    window.addEventListener(
      "pointerdown",
      (e) => {
        triggerRipple(e.clientX, e.clientY);
      },
      { passive: true },
    );

    window.addEventListener(
      "pointermove",
      (e) => {
        mouseX = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
        mouseY =
          (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
        targetX = e.clientX;
        targetY = e.clientY;
      },
      { passive: true },
    );

    // Prevent default touch actions (scrolling/jank) when interacting with background
    canvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });

    resize();
    createParticles();
    animate();
    window.addEventListener("resize", () => {
      resize();
      createParticles();
    });
  }

  initBackgroundAnimation();
});
