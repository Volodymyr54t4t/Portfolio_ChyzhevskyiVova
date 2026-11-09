(() => {
  const validThemes = new Set(["light", "dark"]);
  const styles = new Set(["minimal", "terminal", "cyber", "professional"]);
  const savedTheme = (() => { try { return localStorage.getItem("theme"); } catch { return null; } })();
  const setTheme = (theme, persist = true) => {
    const dark = theme === "dark";
    document.body.classList.toggle("dark-theme", dark);
    document.querySelectorAll(".theme-switch i").forEach(icon => {
      icon.classList.toggle("fa-moon", !dark);
      icon.classList.toggle("fa-sun", dark);
    });
    if (persist) { try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch {} }
  };
  window.setPortfolioTheme = setTheme;
  setTheme(validThemes.has(savedTheme) ? savedTheme : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"), false);

  const setStyle = (style, persist = true) => {
    const selected = styles.has(style) ? style : "minimal";
    document.body.dataset.portfolioStyle = selected;
    document.querySelectorAll("[data-portfolio-style-select]").forEach(select => { select.value = selected; });
    if (persist) { try { localStorage.setItem("portfolio-style", selected); } catch {} }
  };
  let initialStyle = "minimal";
  try { initialStyle = localStorage.getItem("portfolio-style") || initialStyle; } catch {}
  setStyle(initialStyle, false);

  const neonDefaults = { enabled: true, colors: ["#37e8ff", "#735bff", "#ff42bd"], speed: 22, intensity: 45, width: 2 };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || min));
  const normalizeNeon = (value = {}) => ({
    enabled: value.enabled !== false,
    colors: neonDefaults.colors.map((fallback, index) => /^#[\da-f]{6}$/i.test(value.colors?.[index] || "") ? value.colors[index] : fallback),
    speed: clamp(value.speed, 6, 50),
    intensity: clamp(value.intensity, 10, 100),
    width: clamp(value.width, 1, 5),
  });
  // Wait for the shared server setting before showing the effect. This avoids
  // briefly flashing neon for every visitor when the admin disabled it.
  let neonSettings = { ...neonDefaults, enabled: false };

  const renderNeonSettings = () => {
    let svg = document.querySelector(".neon-flow-layer");
    if (!svg) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.classList.add("neon-flow-layer");
      svg.setAttribute("aria-hidden", "true");
      svg.innerHTML = '<defs><linearGradient id="neon-flow-gradient" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse"><stop class="neon-stop-one" offset="0%"/><stop class="neon-stop-two" offset="52%"/><stop class="neon-stop-three" offset="100%"/></linearGradient><filter id="neon-flow-glow" x="-60%" y="-5%" width="220%" height="110%"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path class="neon-side-rail neon-side-left-rail"/><path class="neon-side-rail neon-side-right-rail"/><path class="neon-side-glow neon-side-left-glow" pathLength="1"/><path class="neon-side-glow neon-side-right-glow" pathLength="1"/><path class="neon-side-beam neon-side-left-beam" pathLength="1"/><path class="neon-side-beam neon-side-right-beam" pathLength="1"/>';
      document.body.prepend(svg);
    }
    const height = Math.max(document.documentElement.scrollHeight, innerHeight);
    const width = document.documentElement.clientWidth || innerWidth;
    const inset = Math.max(10, neonSettings.width * 2.5 + 4);
    svg.style.height = `${height}px`;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("preserveAspectRatio", "none");
    const segments = Math.ceil(height / 700) + 1;
    const makeSidePath = (x, inward) => {
      let path = `M ${x} -80`;
      for (let i = 0; i < segments; i++) {
        const y = i * 700;
        path += ` C ${x + inward * 2} ${y + 110}, ${x + inward * 2} ${y + 230}, ${x} ${y + 350} C ${x - inward * 2} ${y + 470}, ${x - inward * 2} ${y + 590}, ${x} ${y + 700}`;
      }
      return path;
    };
    const leftPath = makeSidePath(inset, 1);
    const rightPath = makeSidePath(width - inset, -1);
    svg.querySelector(".neon-side-left-rail").setAttribute("d", leftPath);
    svg.querySelector(".neon-side-left-glow").setAttribute("d", leftPath);
    svg.querySelector(".neon-side-right-rail").setAttribute("d", rightPath);
    svg.querySelector(".neon-side-right-glow").setAttribute("d", rightPath);
    svg.querySelector(".neon-side-left-beam").setAttribute("d", leftPath);
    svg.querySelector(".neon-side-right-beam").setAttribute("d", rightPath);
    svg.querySelector("#neon-flow-gradient").setAttribute("y2", String(height));
    svg.querySelector(".neon-stop-one").setAttribute("stop-color", neonSettings.colors[0]);
    svg.querySelector(".neon-stop-two").setAttribute("stop-color", neonSettings.colors[1]);
    svg.querySelector(".neon-stop-three").setAttribute("stop-color", neonSettings.colors[2]);
    svg.classList.toggle("is-disabled", !neonSettings.enabled);
    svg.style.setProperty("--neon-flow-speed", `${neonSettings.speed}s`);
    svg.style.setProperty("--neon-flow-opacity", String(neonSettings.intensity / 100));
    svg.style.setProperty("--neon-flow-width", `${neonSettings.width}px`);
    document.body.style.setProperty("--neon-color-one", neonSettings.colors[0]);
    document.body.style.setProperty("--neon-color-two", neonSettings.colors[1]);
    document.body.style.setProperty("--neon-color-three", neonSettings.colors[2]);
    document.body.style.setProperty("--neon-flow-opacity", String(neonSettings.intensity / 100));
    document.body.style.setProperty("--neon-flow-width", `${neonSettings.width}px`);
    document.body.classList.toggle("neon-effect-disabled", !neonSettings.enabled);
  };
  const setNeonSettings = (settings, persist = true) => {
    neonSettings = normalizeNeon(settings);
    renderNeonSettings();
    if (persist) { try { localStorage.setItem("portfolio-neon-settings", JSON.stringify(neonSettings)); } catch {} }
    window.dispatchEvent(new CustomEvent("portfolio-neon-change", { detail: neonSettings }));
    return neonSettings;
  };
  window.setPortfolioNeonSettings = setNeonSettings;
  setNeonSettings(neonSettings, false);
  const refreshNeonLayout = () => requestAnimationFrame(renderNeonSettings);
  window.addEventListener("load", refreshNeonLayout, { once: true });
  window.addEventListener("resize", refreshNeonLayout, { passive: true });
  if ("ResizeObserver" in window) new ResizeObserver(refreshNeonLayout).observe(document.body);
  fetch("/api/site-settings", { cache: "no-store" }).then(response => response.ok ? response.json() : null).then(result => {
    if (result?.neon) setNeonSettings(result.neon);
  }).catch(() => {
    try {
      const cached = JSON.parse(localStorage.getItem("portfolio-neon-settings") || "null");
      if (cached) setNeonSettings(cached, false);
    } catch {}
  });

  if (matchMedia("(max-width: 768px)").matches) {
    document.querySelectorAll(".scroll-down").forEach(element => { element.style.display = "none"; });
  }

  document.addEventListener("click", event => {
    const theme = event.target.closest(".theme-switch");
    if (theme) setTheme(document.body.classList.contains("dark-theme") ? "light" : "dark");
    const burger = event.target.closest(".burger");
    const nav = document.querySelector(".nav-links");
    const closeMenu = () => {
      nav?.classList.remove("active");
      document.querySelector(".burger")?.classList.remove("toggle");
      document.querySelector(".burger")?.setAttribute("aria-expanded", "false");
    };
    if (burger) {
      const open = !nav?.classList.contains("active");
      nav?.classList.toggle("active", open);
      burger.classList.toggle("toggle", open);
      burger.setAttribute("aria-expanded", String(open));
    } else if (event.target.closest(".nav-links a")) closeMenu();
    else if (nav?.classList.contains("active") && !event.target.closest("nav")) closeMenu();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      document.querySelector(".nav-links")?.classList.remove("active");
      document.querySelector(".burger")?.classList.remove("toggle");
      document.querySelector(".burger")?.setAttribute("aria-expanded", "false");
    }
  });
  window.addEventListener("resize", () => {
    if (innerWidth > 1200) {
      document.querySelector(".nav-links")?.classList.remove("active");
      document.querySelector(".burger")?.classList.remove("toggle");
      document.querySelector(".burger")?.setAttribute("aria-expanded", "false");
    }
  }, { passive: true });
  document.addEventListener("change", event => { if (event.target.matches("[data-portfolio-style-select]")) setStyle(event.target.value); });
})();
