(() => {
  const authSection = document.getElementById("account-auth");
  const dashboard = document.getElementById("account-dashboard");
  if (!authSection || !dashboard) return;

  const $ = (selector) => document.querySelector(selector);
  const authMessage = $("#account-auth-message");
  const loginForm = $("#login-form");
  const registerForm = $("#register-form");
  const safeNext = new URLSearchParams(location.search).get("next");
  const redirectAfterAuth = safeNext === "builder.html" ? "builder.html#builder" : null;
  const labels = {
    site: { landing: "Лендінг", business: "Корпоративний сайт", portfolio: "Портфоліо", blog: "Блог", ecommerce: "Інтернет-магазин" },
    style: { classic: "Класичний стиль", modern: "Сучасний стиль", corporate: "Корпоративний стиль", shop: "Стиль магазину" },
    option: { responsive: "Адаптивний дизайн", seo: "SEO-оптимізація", admin: "Панель адміністратора", catalog: "Каталог товарів / послуг", contact: "Контактна форма", multilang: "Багатомовність", blog: "Блог / новини", integration: "Інтеграція API / CRM", support: "Онлайн-чат / підтримка", analytics: "Підключення аналітики" },
    status: { new: "Нове", reviewed: "Переглянуто", contacted: "Зв’язалися", in_progress: "У роботі", waiting_client: "Очікує на вас", completed: "Завершено", cancelled: "Скасовано" },
  };
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  const formatPrice = (value) => `${new Intl.NumberFormat("uk-UA").format(Number(value) || 0)} грн`;
  const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Дата невідома" : new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium" }).format(date);
  };
  const showMessage = (element, message, success = false) => {
    element.textContent = message || "";
    element.classList.toggle("success", success);
  };
  async function request(url, options = {}) {
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...options, headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Не вдалося виконати запит. Спробуйте ще раз.");
    return data;
  }
  function setMode(mode) {
    const isLogin = mode === "login";
    loginForm.hidden = !isLogin;
    registerForm.hidden = isLogin;
    document.querySelectorAll("[data-auth-mode]").forEach((button) => {
      const active = button.dataset.authMode === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    showMessage(authMessage, "");
  }
  function renderOrders(orders) {
    const container = $("#account-orders");
    $("#orders-count").textContent = String(orders.length);
    if (!orders.length) {
      container.innerHTML = '<div class="account-empty"><i class="fas fa-inbox" aria-hidden="true"></i><strong>Поки що замовлень немає</strong><br>Створіть конфігурацію сайту, щоб почати.<br><a href="builder.html">Перейти до конструктора <i class="fas fa-arrow-right" aria-hidden="true"></i></a></div>';
      return;
    }
    container.innerHTML = orders.map((order) => {
      const status = labels.status[order.status] || "Опрацьовується";
      const options = Array.isArray(order.selected_options) ? order.selected_options.map((item) => labels.option[item] || item).join(", ") : "";
      const notes = String(order.notes || "").trim();
      const canCancel = order.status === "new" && Number.isSafeInteger(Number(order.id));
      return `<article class="account-order-card"><div class="account-order-top"><div><span class="account-order-number">Замовлення №${escapeHtml(order.id)} · ${escapeHtml(formatDate(order.created_at))}</span><h3>${escapeHtml(labels.site[order.site_type] || "Розробка сайту")}</h3></div><span class="account-order-status" data-status="${escapeHtml(order.status)}">${escapeHtml(status)}</span></div><div class="account-order-meta"><span>Стиль: <strong>${escapeHtml(labels.style[order.design_style] || "Індивідуальний")}</strong></span><span>Орієнтовно: <strong>${escapeHtml(formatPrice(order.total_price))}</strong></span></div>${options ? `<p class="account-order-options"><strong>Функції:</strong> ${escapeHtml(options)}</p>` : ""}${notes ? `<p class="account-order-note"><strong>Коментар:</strong> ${escapeHtml(notes)}</p>` : ""}${canCancel ? `<div class="account-order-actions"><button type="button" class="account-cancel-order" data-cancel-order="${escapeHtml(order.id)}">Скасувати замовлення</button></div>` : ""}</article>`;
    }).join("");
  }
  async function loadOrders() {
    const container = $("#account-orders");
    container.innerHTML = '<p class="account-loading">Завантаження замовлень…</p>';
    try { renderOrders(await request("/api/account/orders")); }
    catch (error) { container.innerHTML = `<p class="account-empty">${escapeHtml(error.message)} <button type="button" id="retry-orders">Спробувати ще</button></p>`; }
  }
  function showDashboard(user) {
    authSection.hidden = true;
    dashboard.hidden = false;
    $("#dashboard-title").textContent = `Вітаємо, ${user.name}!`;
    $("#dashboard-email").textContent = user.email;
    $("#profile-name").value = user.name;
    $("#profile-email").value = user.email;
    loadOrders();
    if (redirectAfterAuth) location.assign(redirectAfterAuth);
  }
  async function submitAuth(form, endpoint) {
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    showMessage(authMessage, "");
    try {
      const body = Object.fromEntries(new FormData(form).entries());
      const data = await request(endpoint, { method: "POST", body: JSON.stringify(body) });
      showDashboard(data.user);
    } catch (error) { showMessage(authMessage, error.message); }
    finally { submit.disabled = false; }
  }
  document.querySelectorAll("[data-auth-mode]").forEach((button) => button.addEventListener("click", () => setMode(button.dataset.authMode)));
  loginForm.addEventListener("submit", (event) => { event.preventDefault(); submitAuth(loginForm, "/api/auth/login"); });
  registerForm.addEventListener("submit", (event) => { event.preventDefault(); submitAuth(registerForm, "/api/auth/register"); });
  $("#account-orders").addEventListener("click", async (event) => {
    if (event.target.id === "retry-orders") return loadOrders();
    const button = event.target.closest("[data-cancel-order]");
    if (!button || !window.confirm("Скасувати це нове замовлення?")) return;
    button.disabled = true;
    try { await request(`/api/account/orders/${encodeURIComponent(button.dataset.cancelOrder)}/cancel`, { method: "PATCH", body: "{}" }); await loadOrders(); }
    catch (error) { button.disabled = false; window.alert(error.message); }
  });
  $("#profile-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('[type="submit"]'); button.disabled = true;
    try { const data = await request("/api/account/profile", { method: "PATCH", body: JSON.stringify({ name: $("#profile-name").value }) }); $("#dashboard-title").textContent = `Вітаємо, ${data.user.name}!`; showMessage($("#profile-message"), "Ім’я збережено", true); }
    catch (error) { showMessage($("#profile-message"), error.message); }
    finally { button.disabled = false; }
  });
  $("#password-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const currentPassword = $("#current-password").value;
    const newPassword = $("#new-password").value;
    const confirmPassword = $("#confirm-password").value;
    if (newPassword !== confirmPassword) return showMessage($("#password-message"), "Нові паролі не збігаються");
    const button = event.currentTarget.querySelector('[type="submit"]'); button.disabled = true;
    try { const data = await request("/api/account/password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }); event.currentTarget.reset(); showMessage($("#password-message"), data.message, true); }
    catch (error) { showMessage($("#password-message"), error.message); }
    finally { button.disabled = false; }
  });
  $("#account-logout").addEventListener("click", async () => {
    try { await request("/api/auth/logout", { method: "POST", body: "{}" }); }
    finally { dashboard.hidden = true; authSection.hidden = false; setMode("login"); }
  });

  request("/api/auth/session").then((data) => { if (data.authenticated) showDashboard(data.user); }).catch((error) => showMessage(authMessage, error.message));
})();
