document.addEventListener("DOMContentLoaded", async () => {
  const dialog = document.getElementById("wayfinder-modal");
  if (dialog) {
    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-wayfinder-open]")) dialog.showModal();
    });
    dialog.querySelectorAll("[data-wayfinder-close]").forEach((button) => {
      button.addEventListener("click", () => dialog.close());
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  }

  const grid = document.getElementById("all-wins-grid");
  const yearFilters = document.getElementById("win-year-filters");
  const placeFilters = document.getElementById("win-place-filters");
  const searchInput = document.getElementById("wins-search");
  const exportButton = document.getElementById("export-wins-btn");
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);

  let wins = [];
  let selectedYear = "all";
  let selectedPlace = "all";
  let searchQuery = "";

  const getFilteredWins = () => wins.filter((win) => {
    const matchesYear = selectedYear === "all" || String(win.year) === selectedYear;
    const matchesPlace = selectedPlace === "all"
      || (selectedPlace === "special" ? !Number.isInteger(win.rank) : String(win.rank) === selectedPlace);
    const haystack = `${win.title} ${win.category} ${win.organization} ${win.highlight || ""}`.toLocaleLowerCase("uk-UA");
    return matchesYear && matchesPlace && haystack.includes(searchQuery);
  });

  const renderWins = () => {
    if (!grid) return;
    const visibleWins = getFilteredWins();
    grid.innerHTML = visibleWins.map((win) => {
      const rankClass = Number.isInteger(win.rank) ? `place-${win.rank}` : "place-special";
      const proofUrls = (win.proofUrls || (win.proofUrl ? [win.proofUrl] : [])).filter((url) => /^https:\/\//.test(url));
      const placeLabel = win.count > 1 ? `${win.result} · ${win.count} дипломи` : win.result;
      const proofLinks = proofUrls.length
        ? proofUrls.map((url, index) => `<a class="win-proof-link" href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${proofUrls.length > 1 ? `Диплом ${index + 1}` : "Відкрити диплом"}<i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i></a>`).join("")
        : '<span class="win-proof-missing"><i class="fas fa-circle-info" aria-hidden="true"></i> Посилання на диплом не додано</span>';
      return `<article class="win-card ${rankClass}">
        <div class="win-card-heading"><span class="win-year"><i class="far fa-calendar" aria-hidden="true"></i> ${escapeHTML(win.year)}</span><span class="win-place">${escapeHTML(placeLabel)}</span></div>
        ${win.image ? `<img class="win-photo" src="${escapeHTML(win.image)}" alt="Фото досягнення: ${escapeHTML(win.title)}" loading="lazy" />` : ""}
        <div class="win-medal-icon" aria-hidden="true"><i class="${win.rank === 1 ? "fas fa-trophy" : win.rank === 2 ? "fas fa-medal" : win.rank === 3 ? "fas fa-award" : "fas fa-star"}"></i></div>
        <h3>${escapeHTML(win.title)}</h3>
        ${win.highlight ? `<p class="win-highlight">${escapeHTML(win.highlight)}</p>` : `<p class="win-category">${escapeHTML(win.category || "Досягнення")}</p>`}
        ${win.organization ? `<p class="win-organization">${escapeHTML(win.organization)}</p>` : ""}
        <div class="win-proof-links">${proofLinks}</div>
      </article>`;
    }).join("") || '<div class="wins-empty"><i class="fas fa-magnifying-glass" aria-hidden="true"></i><strong>Нічого не знайдено</strong><span>Спробуй змінити рік, результат або пошуковий запит.</span></div>';

    const visibleCount = document.getElementById("wins-visible-count");
    if (visibleCount) visibleCount.textContent = `Показано ${visibleWins.length} із ${wins.length} результатів`;
  };

  const loadWins = async () => {
    if (!grid) return;
    try {
      const response = await fetch("/api/achievements", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      wins = await response.json();
      const featuredWin = wins.find((win) => /RE:\s?Access/i.test(win.title));
      const featuredSection = document.querySelector('.featured-achievement');
      if (featuredSection) {
        featuredSection.hidden = !featuredWin;
        featuredSection.style.display = featuredWin ? '' : 'none';
        if (featuredWin) {
          const featuredTitle = document.getElementById('featured-achievement-title');
          const featuredDetail = document.getElementById('featured-achievement-detail');
          if (featuredTitle) featuredTitle.textContent = featuredWin.title;
          if (featuredDetail) featuredDetail.textContent = [featuredWin.result, featuredWin.highlight, featuredWin.organization].filter(Boolean).join(' · ');
        }
      }
      const podiumCount = wins.filter((win) => Number.isInteger(win.rank)).reduce((sum, win) => sum + (win.count || 1), 0);
      const honorableCount = wins.filter((win) => !Number.isInteger(win.rank)).length;
      const total = document.querySelector(".achievement-total strong");
      const summary = document.querySelector(".achievement-total small");
      if (total) total.textContent = podiumCount;
      if (summary) summary.textContent = `і ${honorableCount} відзнаки «АП»`;
      if (yearFilters) {
        const years = [...new Set(wins.map((win) => Number(win.year)).filter(Number.isInteger))].sort((a, b) => b - a);
        yearFilters.innerHTML = `<button class="active" type="button" data-year="all">Усі роки</button>${years.map((year) => `<button type="button" data-year="${year}">${year}</button>`).join("")}`;
      }
      renderWins();
    } catch (error) {

      grid.innerHTML = '';
      showAppModal('Не вдалося завантажити досягнення. Оновіть сторінку.', { type: 'error' });
    }
  };

  yearFilters?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-year]");
    if (!button) return;
    selectedYear = button.dataset.year;
    yearFilters.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
    renderWins();
  });

  placeFilters?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-place]");
    if (!button) return;
    selectedPlace = button.dataset.place;
    placeFilters.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
    renderWins();
  });

  searchInput?.addEventListener("input", () => {
    searchQuery = searchInput.value.trim().toLocaleLowerCase("uk-UA");
    renderWins();
  });

  exportButton?.addEventListener("click", () => {
    if (!getFilteredWins().length) return;
    window.print();
  });

  const backToTop = document.querySelector(".back-to-top");
  const updateBackToTop = () => backToTop?.classList.toggle("show", window.scrollY > 300);
  window.addEventListener("scroll", updateBackToTop, { passive: true });
  updateBackToTop();

  const installPrompt = document.getElementById("pwaInstallPrompt");
  const installButton = document.getElementById("pwaInstallBtn");
  const dismissInstallButton = document.getElementById("pwaCloseBtn");
  let deferredPrompt;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    installPrompt?.classList.add("show");
  });
  installButton?.addEventListener("click", async () => {
    installPrompt?.classList.remove("show");
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    deferredPrompt = null;
  });
  dismissInstallButton?.addEventListener("click", () => installPrompt?.classList.remove("show"));

  await loadWins();
});
