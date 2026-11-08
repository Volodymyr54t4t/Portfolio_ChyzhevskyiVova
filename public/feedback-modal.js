(() => {
  let activeDialog;
  let modalQueue = Promise.resolve();

  const createDialog = () => {
    const dialog = document.createElement('dialog');
    dialog.className = 'feedback-dialog';
    dialog.setAttribute('aria-labelledby', 'feedback-dialog-title');
    dialog.innerHTML = `
      <div class="feedback-dialog-card">
        <div class="feedback-dialog-icon" aria-hidden="true"><i class="fas fa-circle-info"></i></div>
        <h2 id="feedback-dialog-title"></h2>
        <p class="feedback-dialog-message"></p>
        <div class="feedback-dialog-actions"></div>
      </div>`;
    document.body.appendChild(dialog);
    return dialog;
  };

  const show = ({ title, message, confirm = false, danger = false }) => {
    if (activeDialog?.open) activeDialog.close();
    const dialog = activeDialog = createDialog();
    dialog.querySelector('#feedback-dialog-title').textContent = title;
    dialog.querySelector('.feedback-dialog-message').textContent = message;
    const icon = dialog.querySelector('.feedback-dialog-icon');
    icon.classList.toggle('is-danger', danger);
    icon.innerHTML = `<i class="fas ${danger ? 'fa-triangle-exclamation' : confirm ? 'fa-circle-question' : 'fa-circle-check'}" aria-hidden="true"></i>`;
    const actions = dialog.querySelector('.feedback-dialog-actions');
    let resolveResult;
    const result = new Promise((resolve) => { resolveResult = resolve; });
    const finish = (value) => {
      if (dialog.open) dialog.close();
      dialog.remove();
      if (activeDialog === dialog) activeDialog = null;
      resolveResult(value);
    };
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'feedback-dialog-button secondary';
    cancel.textContent = confirm ? 'Скасувати' : 'Закрити';
    cancel.addEventListener('click', () => finish(false));
    actions.appendChild(cancel);
    if (confirm) {
      const accept = document.createElement('button');
      accept.type = 'button';
      accept.className = `feedback-dialog-button${danger ? ' danger' : ''}`;
      accept.textContent = danger ? 'Видалити' : 'Підтвердити';
      accept.addEventListener('click', () => finish(true));
      actions.appendChild(accept);
    }
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(false); }, { once: true });
    dialog.addEventListener('click', (event) => { if (event.target === dialog) finish(false); });
    dialog.showModal();
    cancel.focus();
    return result;
  };

  const enqueue = (options) => {
    const result = modalQueue.then(() => show(options));
    modalQueue = result.then(() => undefined, () => undefined);
    return result;
  };
  window.showAppModal = (message, options = {}) => enqueue({
    title: options.title || (options.type === 'error' ? 'Сталася помилка' : 'Готово'),
    message: String(message ?? ''),
    danger: options.type === 'error',
  });
  window.showAppConfirm = (message, options = {}) => enqueue({
    title: options.title || 'Підтвердіть дію',
    message: String(message ?? ''),
    confirm: true,
    danger: options.danger !== false,
  });
})();
