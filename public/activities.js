document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("activity-grid");
  if (!grid) return;
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const labels = { all: "Усі", activity: "Конкурси й навчання", volunteering: "Волонтерство", accreditation: "Акредитації" };
  const search = document.getElementById("activity-search");
  const filters = document.getElementById("activity-filters");
  const counts = document.getElementById("activity-counts");
  const visibleCount = document.getElementById("activity-visible-count");
  let items = [];
  let selected = "all";
  const normalizeTitle = (title) => String(title || "")
    .replace(/\s*[·(]\s*(?:робота\s*)?\d+\s*\)?\s*$/iu, "")
    .trim().toLocaleLowerCase("uk-UA");
  const groupItems = (source) => {
    const grouped = new Map();
    source.forEach((item) => {
      const key = [item.group, item.type, normalizeTitle(item.title), item.date || item.sourceYear || "", item.organizer || ""].join("|");
      if (!grouped.has(key)) grouped.set(key, { ...item, entries: [] });
      grouped.get(key).entries.push(item);
    });
    return [...grouped.values()];
  };
  const render = () => {
    const q = (search?.value || "").trim().toLocaleLowerCase("uk-UA");
    const grouped = groupItems(items);
    const shown = grouped.filter((item) => (selected === "all" || item.group === selected)
      && `${item.title} ${item.type} ${item.entries.map((entry) => entry.result).join(" ")} ${item.organizer} ${item.venue || ""}`.toLocaleLowerCase("uk-UA").includes(q));
    grid.innerHTML = shown.map((item) => {
      const results = new Map();
      item.entries.forEach((entry) => results.set(entry.result, (results.get(entry.result) || 0) + 1));
      const resultBadges = [...results].map(([result, count]) => `<span class="activity-result">${escapeHTML(result)}${count > 1 ? ` · ${count}` : ""}</span>`).join("");
      const repeatNote = item.entries.length > 1 ? `<p class="activity-repeat-note">${item.entries.length} роботи / результати</p>` : "";
      return `<article class="activity-card"><div class="activity-card-top"><span class="activity-kind">${escapeHTML(item.type)}</span><time class="activity-date">${escapeHTML(item.date || (item.sourceYear ? String(item.sourceYear) : "Дата не вказана"))}</time></div><h3>${escapeHTML(item.title)}</h3><div class="activity-results">${resultBadges}</div>${repeatNote}${item.organizer ? `<p class="activity-meta">${escapeHTML(item.organizer)}</p>` : ""}${item.venue ? `<p class="activity-meta">${escapeHTML(item.venue)}</p>` : ""}${item.sourceYear && item.date && item.date.slice(-4) !== String(item.sourceYear) ? `<p class="activity-meta">Навчальний рік у джерелі: ${escapeHTML(item.sourceYear)}</p>` : ""}</article>`;
    }).join("") || '<div class="wins-empty"><strong>Нічого не знайдено</strong><span>Змініть фільтр або пошуковий запит.</span></div>';
    if (visibleCount) visibleCount.textContent = `Показано ${shown.length} подій із ${items.length} записів`;
  };
  try {
    const response = await fetch("/activities.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    items = await response.json();
    const groups = ["all", ...new Set(items.map((item) => item.group))];
    filters.innerHTML = groups.map((group) => `<button type="button" class="${group === selected ? "active" : ""}" data-group="${escapeHTML(group)}">${escapeHTML(labels[group] || group)}</button>`).join("");
    filters.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-group]");
      if (!button) return;
      selected = button.dataset.group;
      filters.querySelectorAll("button").forEach((node) => node.classList.toggle("active", node === button));
      render();
    });
    search?.addEventListener("input", render);
    const totals = Object.entries(labels).filter(([key]) => key !== "all").map(([key, label]) => `<span><strong>${items.filter((item) => item.group === key).length}</strong> ${escapeHTML(label)}</span>`).join("");
    counts.innerHTML = `<span><strong>${items.length}</strong> записів</span>${totals}`;
    render();
  } catch (error) {
    grid.innerHTML = '<p class="wins-empty">Не вдалося завантажити список активностей.</p>';
    if (visibleCount) visibleCount.textContent = "";
  }
});
