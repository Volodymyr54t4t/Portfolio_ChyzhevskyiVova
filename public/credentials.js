document.addEventListener("DOMContentLoaded", async () => {
  const wayfinderDialog = document.getElementById("wayfinder-modal");
  if (wayfinderDialog) {
    document.querySelectorAll("[data-wayfinder-open]").forEach((button) => button.addEventListener("click", () => wayfinderDialog.showModal()));
    wayfinderDialog.querySelectorAll("[data-wayfinder-close]").forEach((button) => button.addEventListener("click", () => wayfinderDialog.close()));
    wayfinderDialog.addEventListener("click", (event) => { if (event.target === wayfinderDialog) wayfinderDialog.close(); });
  }

  let certificatesData = [];
  let currentCategoryFilter = "all";
  let currentLevelFilter = "all";
  let currentSortOption = "date-desc";

  async function loadCertificatesFromApi() {
    try {
      // Load certificates
      const certResponse = await fetch('/api/certificates');
      if (certResponse.ok) {
        const apiCertificates = await certResponse.json();
        const certData = apiCertificates.map((cert) => ({
          id: cert.id,
          image: cert.image || '/placeholder.svg',
          title: cert.title,
          date: cert.issue_date || cert.date || '',
          organizer: cert.issuer || cert.organization || '',
          link: cert.credential_url || '',
          category: 'Сертифікати',
          level: 'Національний',
          tags: cert.description
            ? cert.description.split(',').map((tag) => tag.trim()).filter(Boolean)
            : [],
          type: 'certificate'
        }));
        certificatesData = [...certData];
      }
    } catch (error) {
      console.error('Error loading certificates from server:', error);
    }

    try {
      // Load awards
      const awardResponse = await fetch('/api/awards');
      if (awardResponse.ok) {
        const apiAwards = await awardResponse.json();
        const awardData = apiAwards.map((award) => ({
          id: award.id,
          image: award.image || '/placeholder.svg',
          title: award.title,
          date: award.date || '',
          organizer: award.organization || '',
          link: award.award_url || '',
          category: 'Нагороди',
          level: award.place || 'Учасник',
          tags: award.description
            ? award.description.split(',').map((tag) => tag.trim()).filter(Boolean)
            : [],
          type: 'award'
        }));
        certificatesData = [...certificatesData, ...awardData];
      }
    } catch (error) {
      console.error('Error loading awards from server:', error);
    }

    try {
      // Load achievements
      const achievementResponse = await fetch('/api/achievements');
      if (achievementResponse.ok) {
        const apiAchievements = await achievementResponse.json();
        const achievementData = apiAchievements.map((achievement) => ({
          id: achievement.id,
          image: achievement.image || '/placeholder.svg',
          title: achievement.title,
          date: achievement.date || '',
          organizer: achievement.type || '',
          link: achievement.achievement_url || '',
          category: 'Досягнення',
          level: achievement.type || 'Інше',
          tags: achievement.description
            ? achievement.description.split(',').map((tag) => tag.trim()).filter(Boolean)
            : [],
          type: 'achievement'
        }));
        certificatesData = [...certificatesData, ...achievementData];
      }
    } catch (error) {
      console.error('Error loading achievements from server:', error);
    }

    // Sort by date descending by default
    certificatesData.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  const certificatesGrid = document.getElementById("certificates-grid");
  const categoryFilters = document.getElementById("category-filters");
  const levelFilters = document.getElementById("level-filters");
  const sortSelect = document.getElementById("sort-select");
  const modal = document.getElementById("certificate-modal");
  const closeButton = document.querySelector(".modal .close-button");
  const downloadPdfBtn = document.getElementById("download-pdf-btn");

  // Elements for header/footer functionality
  const burger = document.querySelector(".burger");
  const navLinks = document.querySelector(".nav-links");
  const themeSwitch = document.querySelector(".theme-switch");
  const backToTopButton = document.querySelector(".back-to-top");
  const pwaInstallPrompt = document.getElementById("pwaInstallPrompt");
  const pwaInstallBtn = document.getElementById("pwaInstallBtn");
  const pwaCloseBtn = document.getElementById("pwaCloseBtn");
  let deferredPrompt; // For PWA installation
  const allWinsGrid = document.getElementById("all-wins-grid");
  const winYearFilters = document.getElementById("win-year-filters");
  let portfolioWins = [];

  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);

  function renderWins(year = "all") {
    if (!allWinsGrid) return;
    const rows = year === "all" ? portfolioWins : portfolioWins.filter((win) => String(win.year) === year);
    allWinsGrid.innerHTML = rows.map((win) => {
      const placeClass = win.rank ? `place-${win.rank}` : "place-special";
      const proofUrls = win.proofUrls || (win.proofUrl ? [win.proofUrl] : []);
      const proofLinks = proofUrls.filter((url) => /^https:\/\//.test(url)).map((url, index) =>
        `<a class="win-proof-link" href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${proofUrls.length > 1 ? `Диплом ${index + 1}` : "Диплом"} <i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i></a>`
      ).join("");
      const placeLabel = win.count > 1 ? `${win.result} · ${win.count} дипломи` : win.result;
      return `<article class="win-card ${placeClass}">
        <div class="win-card-heading"><span class="win-year">${escapeHTML(win.year)}</span><span class="win-place">${escapeHTML(placeLabel)}</span></div>
        <div class="win-medal-icon" aria-hidden="true"><i class="${win.rank === 1 ? "fas fa-trophy" : win.rank === 2 ? "fas fa-medal" : "fas fa-award"}"></i></div>
        <h3>${escapeHTML(win.title)}</h3>
        ${win.highlight ? `<p class="win-highlight">${escapeHTML(win.highlight)}</p>` : `<p class="win-category">${escapeHTML(win.category)}</p>`}
        ${proofLinks ? `<div class="win-proof-links">${proofLinks}</div>` : ""}
      </article>`;
    }).join("") || '<p class="wins-loading">За цей рік результатів немає.</p>';
  }

  async function loadPortfolioWins() {
    if (!allWinsGrid) return;
    try {
      const response = await fetch("/wins.json");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      portfolioWins = await response.json();
      const podium = portfolioWins.filter((win) => Number.isInteger(win.rank)).reduce((sum, win) => sum + (win.count || 1), 0);
      const total = document.querySelector(".achievement-total strong");
      const summary = document.querySelector(".achievement-total small");
      if (total) total.textContent = podium;
      if (summary) summary.textContent = `і ${portfolioWins.filter((win) => !Number.isInteger(win.rank)).length} відзнаки «АП»`;
      renderWins();
    } catch (error) {
      console.error("Не вдалося завантажити список перемог:", error);
      allWinsGrid.innerHTML = '<p class="wins-loading">Не вдалося завантажити результати. Оновіть сторінку.</p>';
    }
  }

  if (winYearFilters) {
    winYearFilters.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-year]");
      if (!button) return;
      winYearFilters.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      renderWins(button.dataset.year);
    });
  }

  // --- Header/Footer Functionality ---

  // Burger menu toggle
  burger.addEventListener("click", () => {
    navLinks.classList.toggle("active");
    burger.classList.toggle("toggle");
  });

  // Theme switch
  themeSwitch.addEventListener("click", () => {
    document.body.classList.toggle("dark-theme");
    // Save theme preference to localStorage
    if (document.body.classList.contains("dark-theme")) {
      localStorage.setItem("theme", "dark");
      themeSwitch.querySelector("i").classList.replace("fa-moon", "fa-sun");
    } else {
      localStorage.setItem("theme", "light");
      themeSwitch.querySelector("i").classList.replace("fa-sun", "fa-moon");
    }
  });

  // Apply saved theme on load
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark-theme");
    themeSwitch.querySelector("i").classList.replace("fa-moon", "fa-sun");
  } else {
    themeSwitch.querySelector("i").classList.replace("fa-sun", "fa-moon");
  }

  // Back to Top button visibility
  window.addEventListener("scroll", () => {
    if (window.scrollY > 300) {
      backToTopButton.classList.add("show");
    } else {
      backToTopButton.classList.remove("show");
    }
  });

  // PWA Install Prompt logic
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    pwaInstallPrompt.classList.add("show");
  });

  pwaInstallBtn.addEventListener("click", () => {
    pwaInstallPrompt.classList.remove("show");
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === "accepted") {
          console.log("User accepted the A2HS prompt");
        } else {
          console.log("User dismissed the A2HS prompt");
        }
        deferredPrompt = null;
      });
    }
  });

  pwaCloseBtn.addEventListener("click", () => {
    pwaInstallPrompt.classList.remove("show");
  });

  // --- Certificate Page Functionality ---

  function renderCertificates(certs) {
    certificatesGrid.innerHTML = ""; // Clear existing cards

    certs.forEach((cert) => {
      const card = document.createElement("div");
      card.classList.add("certificate-card");
      card.dataset.id = cert.id;

      // Check if the image is a PDF file
      const isPdf = cert.image && cert.image.toLowerCase().endsWith('.pdf');
      const imageContent = isPdf
        ? `
          <div class="certificate-card-pdf">
            <i class="fas fa-file-pdf"></i>
            <span>PDF файл</span>
          </div>
        `
        : `<img src="${cert.image}" alt="${cert.title}" onerror="this.src='/placeholder.svg'">`;

      card.innerHTML = `
                <div class="certificate-card-image">
                    ${imageContent}
                </div>
                <div class="certificate-card-content">
                    <h3>${cert.title}</h3>
                    <p><strong>Дата:</strong> ${cert.date}</p>
                    <p><strong>Організатор:</strong> ${cert.organizer}</p>
                    <div class="tags">
                        <span class="tag">${cert.category}</span>
                        <span class="level">${cert.level}</span>
                        ${cert.tags
                          .map((tag) => `<span class="tag">${tag}</span>`)
                          .join("")}
                    </div>
                    ${isPdf && cert.image
                      ? `<a href="${cert.image}" target="_blank" rel="noopener noreferrer">Відкрити PDF</a>`
                      : cert.link
                      ? `<a href="${cert.link}" target="_blank" rel="noopener noreferrer">Переглянути</a>`
                      : ""}
                </div>
            `;
      certificatesGrid.appendChild(card);

      card.addEventListener("click", () => openModal(cert));
    });
  }

  function applyFiltersAndSort() {
    const filteredCerts = certificatesData.filter((cert) => {
      const matchesCategory =
        currentCategoryFilter === "all" ||
        cert.category === currentCategoryFilter;
      const matchesLevel =
        currentLevelFilter === "all" || cert.level === currentLevelFilter;
      return matchesCategory && matchesLevel;
    });

    filteredCerts.sort((a, b) => {
      switch (currentSortOption) {
        case "date-desc":
          return new Date(b.date) - new Date(a.date);
        case "date-asc":
          return new Date(a.date) - new Date(b.date);
        case "category-asc":
          return a.category.localeCompare(b.category);
        case "category-desc":
          return b.category.localeCompare(a.category);
        case "level-asc":
          return a.level.localeCompare(b.level);
        case "level-desc":
          return b.level.localeCompare(a.level);
        default:
          return 0;
      }
    });

    renderCertificates(filteredCerts);
  }

  // Filter event listeners
  categoryFilters.addEventListener("click", (e) => {
    if (e.target.classList.contains("filter-btn")) {
      document
        .querySelectorAll("#category-filters .filter-btn")
        .forEach((btn) => btn.classList.remove("active"));
      e.target.classList.add("active");
      currentCategoryFilter = e.target.dataset.filter;
      applyFiltersAndSort();
    }
  });

  levelFilters.addEventListener("click", (e) => {
    if (e.target.classList.contains("filter-btn")) {
      document
        .querySelectorAll("#level-filters .filter-btn")
        .forEach((btn) => btn.classList.remove("active"));
      e.target.classList.add("active");
      currentLevelFilter = e.target.dataset.filter;
      applyFiltersAndSort();
    }
  });

  // Sort event listener
  sortSelect.addEventListener("change", (e) => {
    currentSortOption = e.target.value;
    applyFiltersAndSort();
  });

  // Modal functions
  function openModal(cert) {
    document.getElementById("modal-image").src = cert.image;
    document.getElementById("modal-image").alt = cert.title;
    document.getElementById("modal-title").textContent = cert.title;
    document.getElementById("modal-date").textContent = cert.date;
    document.getElementById("modal-organizer").textContent = cert.organizer;
    document.getElementById("modal-category").textContent = cert.category;
    document.getElementById("modal-level").textContent = cert.level;
    document.getElementById("modal-tags").textContent = cert.tags.join(", ");

    const modalLinkContainer = document.getElementById("modal-link-container");
    const modalLink = document.getElementById("modal-link");
    if (cert.link) {
      modalLink.href = cert.link;
      modalLinkContainer.style.display = "block";
    } else {
      modalLinkContainer.style.display = "none";
    }

    modal.style.display = "block";
  }

  function closeModal() {
    modal.style.display = "none";
  }

  closeButton.addEventListener("click", closeModal);
  window.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

  // PDF Download functionality
  downloadPdfBtn.addEventListener("click", async () => {
    if (certificatesData.length === 0) {
      alert('Немає даних для завантаження в PDF');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(22);
    doc.text("Сертифікати, нагороди та досягнення", 105, 20, null, null, "center");
    doc.setFontSize(12);
    doc.text(
      "Згенеровано: " + new Date().toLocaleDateString("uk-UA"),
      105,
      30,
      null,
      null,
      "center"
    );

    let y = 40;
    const margin = 15;
    const lineHeight = 7;

    // Get currently filtered data
    const filteredCerts = certificatesData.filter((cert) => {
      const matchesCategory =
        currentCategoryFilter === "all" ||
        cert.category === currentCategoryFilter;
      const matchesLevel =
        currentLevelFilter === "all" || cert.level === currentLevelFilter;
      return matchesCategory && matchesLevel;
    });

    // Apply current sort
    filteredCerts.sort((a, b) => {
      switch (currentSortOption) {
        case "date-desc":
          return new Date(b.date) - new Date(a.date);
        case "date-asc":
          return new Date(a.date) - new Date(b.date);
        case "category-asc":
          return a.category.localeCompare(b.category);
        case "category-desc":
          return b.category.localeCompare(a.category);
        case "level-asc":
          return a.level.localeCompare(b.level);
        case "level-desc":
          return b.level.localeCompare(a.level);
        default:
          return 0;
      }
    });

    for (let i = 0; i < filteredCerts.length; i++) {
      const cert = filteredCerts[i];

      // Check if new page is needed
      if (y > 250) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`${i + 1}. ${cert.title}`, margin, y);
      y += lineHeight + 2;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");

      // Format date
      const formattedDate = cert.date ? new Date(cert.date).toLocaleDateString('uk-UA') : 'Невідомо';
      doc.text(`Дата: ${formattedDate}`, margin + 5, y);
      y += lineHeight;

      doc.text(`Тип: ${cert.category}`, margin + 5, y);
      y += lineHeight;

      doc.text(`Організатор: ${cert.organizer}`, margin + 5, y);
      y += lineHeight;

      doc.text(`Рівень: ${cert.level}`, margin + 5, y);
      y += lineHeight;

      if (cert.tags && cert.tags.length > 0) {
        doc.text(`Теги: ${cert.tags.join(", ")}`, margin + 5, y);
        y += lineHeight;
      }

      if (cert.link) {
        doc.textWithLink("Посилання", margin + 5, y, { url: cert.link });
        y += lineHeight;
      }

      // Add separator line
      y += 3;
      doc.setDrawColor(200);
      doc.line(margin, y, 195, y);
      y += lineHeight * 1.5;
    }

    doc.save("Сертифікати_нагороди_досягнення.pdf");
  });

  await loadPortfolioWins();
  await loadCertificatesFromApi();
  // Initial render
  applyFiltersAndSort();
});
