(() => {
  const emailInput = document.getElementById("clientEmail");
  const note = document.getElementById("builder-account-note");
  if (!emailInput || !note) return;
  fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" })
    .then((response) => response.json().then((data) => ({ response, data })))
    .then(({ response, data }) => {
      if (!response.ok) throw new Error(data.error || "Не вдалося перевірити кабінет");
      if (data.authenticated) {
        emailInput.value = data.user.email;
        note.textContent = `Замовлення буде збережено в кабінеті ${data.user.name}. `;
        const link = document.createElement("a"); link.href = "account.html"; link.textContent = "Переглянути замовлення"; note.append(link);
      } else {
        note.textContent = "Щоб надіслати замовлення та бачити його статус, ";
        const link = document.createElement("a"); link.href = "account.html?next=builder.html"; link.textContent = "увійдіть або створіть кабінет"; note.append(link);
        note.append(document.createTextNode("."));
      }
    })
    .catch(() => { note.textContent = "Не вдалося перевірити вхід. Оновіть сторінку або відкрийте кабінет."; });
})();
