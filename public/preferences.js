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
