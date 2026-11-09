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
  const render = () => {
    const q = (search?.value || "").trim().toLocaleLowerCase("uk-UA");
    const shown = items.filter((item) => (selected === "all" || item.group === selected)
      && `${item.title} ${item.type} ${item.result} ${item.organizer} ${item.venue || ""}`.toLocaleLowerCase("uk-UA").includes(q));
    grid.innerHTML = shown.map((item) => `<article class="activity-card"><div class="activity-card-top"><span class="activity-kind">${escapeHTML(item.type)}</span><time class="activity-date">${escapeHTML(item.date || (item.sourceYear ? String(item.sourceYear) : "Дата не вказана"))}</time></div><h3>${escapeHTML(item.title)}</h3><span class="activity-result">${escapeHTML(item.result)}</span>${item.organizer ? `<p class="activity-meta">${escapeHTML(item.organizer)}</p>` : ""}${item.venue ? `<p class="activity-meta">${escapeHTML(item.venue)}</p>` : ""}${item.sourceYear && item.date && item.date.slice(-4) !== String(item.sourceYear) ? `<p class="activity-meta">Навчальний рік у джерелі: ${escapeHTML(item.sourceYear)}</p>` : ""}</article>`).join("") || '<div class="wins-empty"><strong>Нічого не знайдено</strong><span>Змініть фільтр або пошуковий запит.</span></div>';
    if (visibleCount) visibleCount.textContent = `Показано ${shown.length} із ${items.length} активностей`;
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
