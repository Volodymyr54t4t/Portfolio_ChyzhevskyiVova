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
    site: { landing: "Landing Page", business_card: "Сайт-візитка", portfolio: "Персональне портфоліо", multipage: "Багатосторінковий сайт", business: "Корпоративний сайт", catalog_site: "Сайт-каталог", ecommerce: "Інтернет-магазин", blog: "Блог / інформаційний портал", events: "Платформа для заходів", webapp: "Вебплатформа / вебзастосунок", crm: "CRM / адміністративна панель", custom: "Індивідуальний вебсервіс" },
    style: { classic: "Класичний стиль", modern: "Сучасний стиль", corporate: "Корпоративний стиль", shop: "Стиль магазину" },
    option: { redesign: "Редизайн сайту", page: "Додавання сторінки", uiux: "UI/UX дизайн", frontend: "Frontend-розробка", backend: "Backend-розробка", postgres: "Підключення PostgreSQL", rest_api: "Розробка REST API", admin_panel: "Адмінпанель", api_integration: "Інтеграція API", auth: "Авторизація користувачів", seo: "SEO-оптимізація", hosting: "Розгортання на хостингу", support_monthly: "Технічна підтримка (за місяць)", bugfix: "Виправлення помилок" },
    status: { new: "Нове", reviewed: "Переглянуто", contacted: "Зв’язалися", in_progress: "У роботі", waiting_client: "Очікує на вас", completed: "Завершено", cancelled: "Скасовано" },
  };
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  const formatPrice = (value) => `${new Intl.NumberFormat("uk-UA").format(Number(value) || 0)} грн`;
  const formatOrderCurrency = (value, currency) => currency === "UAH"
    ? formatPrice(value)
    : new Intl.NumberFormat("uk-UA", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
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
      const selectedServices = Array.isArray(order.selected_services) && order.selected_services.length
        ? order.selected_services
        : [{ name: labels.site[order.site_type] || "Розробка сайту" }, ...(Array.isArray(order.selected_options) ? order.selected_options.map((id) => ({ name: labels.option[id] || id })) : [])];
      const mainService = selectedServices[0];
      const additionalServices = selectedServices.slice(1).map((service) => `${service.name}${service.unit === "hour" && service.hours ? ` · ${service.hours} год.` : service.unit === "month" ? " · за місяць" : ""}`).join(", ");
      const notes = String(order.notes || "").trim();
      const currency = /^[A-Z]{3}$/.test(String(order.currency_code || "")) ? order.currency_code : "UAH";
      const exchangeRate = Number(order.exchange_rate) || 1;
      const convertedTotal = Number(order.total_price) / exchangeRate;
      const rateNote = currency === "UAH" ? "" : `<p class="account-order-rate">Курс НБУ: 1 ${escapeHtml(currency)} = ${escapeHtml(new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 4 }).format(exchangeRate))} грн · ${escapeHtml(formatDate(order.rate_date))}${order.rate_is_stale ? " · використано кешований курс" : ""}</p>`;
      const canCancel = order.status === "new" && Number.isSafeInteger(Number(order.id));
      return `<article class="account-order-card"><div class="account-order-top"><div><span class="account-order-number">Замовлення №${escapeHtml(order.id)} · ${escapeHtml(formatDate(order.created_at))}</span><h3>${escapeHtml(mainService.name)}</h3></div><span class="account-order-status" data-status="${escapeHtml(order.status)}">${escapeHtml(status)}</span></div><div class="account-order-meta"><span>Орієнтовно: <strong>${escapeHtml(formatOrderCurrency(convertedTotal, currency))}</strong></span><span>Послуг: <strong>${selectedServices.length}</strong></span></div>${rateNote}${additionalServices ? `<p class="account-order-options"><strong>Також обрано:</strong> ${escapeHtml(additionalServices)}</p>` : ""}${notes ? `<p class="account-order-note"><strong>Коментар:</strong> ${escapeHtml(notes)}</p>` : ""}${canCancel ? `<div class="account-order-actions"><button type="button" class="account-cancel-order" data-cancel-order="${escapeHtml(order.id)}">Скасувати замовлення</button></div>` : ""}</article>`;
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
