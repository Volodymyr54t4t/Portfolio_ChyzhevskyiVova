// Admin Panel JavaScript

// Keep the admin interface hidden until the server confirms a valid session.
const loginOverlay = document.createElement('div');
loginOverlay.id = 'admin-login';
loginOverlay.hidden = true;
loginOverlay.innerHTML = `<form class="login-card"><div class="login-brand"><img src="./img/gallery/portrait.jpg" alt="Портрет Володимира Чижевського"><span>ВЧ · QA · FULL-STACK</span></div><h1>Вхід до панелі</h1><p>Керуйте QA-кейсами, Full-stack досвідом і портфоліо</p><label for="admin-email">Пошта</label><input id="admin-email" type="email" autocomplete="username" required><label for="admin-password">Пароль</label><input id="admin-password" type="password" autocomplete="current-password" required><label class="remember-me" for="admin-remember"><input id="admin-remember" type="checkbox"><span><strong>Запам’ятати мене</strong><small>Не виходити з акаунта 30 днів на цьому пристрої</small></span></label><button class="login-submit" type="submit">Увійти</button><div class="login-error" role="alert"></div></form>`;
document.body.appendChild(loginOverlay);
const adminRoot = document.querySelector('.admin-container');
if (adminRoot?.classList.contains('admin-container')) adminRoot.hidden = true;

async function checkAdminSession() {
    try {
        const response = await fetch(`/api/admin/session?check=${Date.now()}`, { credentials: 'same-origin', cache: 'no-store' });
        if (!response.ok) throw new Error('Не вдалося перевірити сесію');
        const session = await response.json();
        if (session.authenticated) {
            loginOverlay.hidden = true;
            if (adminRoot) adminRoot.hidden = false;
            window.scrollTo(0, 0);
            if (adminRoot && !document.getElementById('admin-logout')) {
                const logout = document.createElement('button');
                logout.id = 'admin-logout';
                logout.type = 'button';
                logout.textContent = 'Вийти';
                logout.addEventListener('click', async () => {
                    await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
                    if (adminRoot) adminRoot.hidden = true;
                    loginOverlay.hidden = false;
                });
                adminRoot.prepend(logout);
            }
            const activeSection = document.querySelector('.admin-nav button.active')?.dataset.section || 'orders';
            await loadSection(activeSection);
            return true;
        } else {
            loginOverlay.hidden = false;
            return false;
        }
    } catch {
        loginOverlay.hidden = false;
        loginOverlay.querySelector('.login-error').textContent = 'Не вдалося з’єднатися із сервером.';
        return false;
    }
}

loginOverlay.querySelector('form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const error = loginOverlay.querySelector('.login-error');
    const button = loginOverlay.querySelector('button');
    error.textContent = '';
    button.disabled = true;
    button.textContent = 'Перевіряю…';
    try {
        const response = await fetch('/api/admin/login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: document.getElementById('admin-email').value, password: document.getElementById('admin-password').value, remember: document.getElementById('admin-remember').checked }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Не вдалося увійти');
        const authenticated = await checkAdminSession();
        if (!authenticated) throw new Error('Сервер прийняв дані, але не підтвердив сесію. Перевірте з’єднання та спробуйте ще раз.');
        loginOverlay.querySelector('form').reset();
    } catch (err) { error.textContent = err.message; }
    finally { button.disabled = false; button.textContent = 'Увійти до панелі'; }
});

// Navigation
document.querySelectorAll('.admin-nav button').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.admin-nav button').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        document.querySelectorAll('.admin-section').forEach(section => section.classList.remove('active'));
        document.getElementById(button.dataset.section).classList.add('active');
        
        loadSection(button.dataset.section);
    });
});

// Load section data
let credentialItems = [];
let activeCredentialFilter = 'all';

async function loadSection(section) {
    switch(section) {
        case 'orders':
            await loadOrders();
            break;
        case 'projects':
            await loadProjects();
            break;
        case 'credentials':
            await loadCredentials();
            break;
        case 'testimonials':
            await loadTestimonials();
            break;
    }
}

document.querySelectorAll('[data-credential-filter]').forEach((button) => {
    button.addEventListener('click', () => {
        activeCredentialFilter = button.dataset.credentialFilter;
        document.querySelectorAll('[data-credential-filter]').forEach((item) => item.classList.toggle('active', item === button));
        renderCredentials();
    });
});

// API helper functions
async function apiRequest(url, options = {}) {
    try {
        const requestOptions = {
            ...options,
            headers: {
                ...options.headers
            }
        };

        if (!(requestOptions.body instanceof FormData)) {
            requestOptions.headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(url, requestOptions);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        alert('Помилка при виконанні запиту');
        throw error;
    }
}

const escapeAdminText = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);

async function loadCredentials() {
    const container = document.getElementById('credentials-list');
    if (!container) return;
    container.innerHTML = '<div class="loading">Завантаження записів…</div>';
    try {
        const [certificates, achievements] = await Promise.all([
            apiRequest('/api/admin/certificates'),
            apiRequest('/api/admin/achievements')
        ]);
        credentialItems = [
            ...achievements.map((item) => ({ ...item, kind: 'achievement' })),
            ...certificates.map((item) => ({ ...item, kind: 'certificate' }))
        ];
        renderCredentials();
    } catch (error) {
        container.innerHTML = '<div class="error">Не вдалося завантажити досягнення й сертифікати</div>';
    }
}

function renderCredentials() {
    const container = document.getElementById('credentials-list');
    if (!container) return;
    const visible = credentialItems.filter((item) => activeCredentialFilter === 'all' || item.kind === activeCredentialFilter);
    if (!visible.length) {
        container.innerHTML = '<div class="empty-state"><p>Записів у цій категорії ще немає</p></div>';
        return;
    }
    container.innerHTML = visible.map((item) => {
        if (item.kind === 'certificate') {
            const date = item.issue_date ? new Date(item.issue_date).toLocaleDateString('uk-UA') : '—';
            return `<article class="item-card credential-card">
                ${item.image ? `<div class="credential-media"><img src="${escapeAdminText(item.image)}" alt="Зображення сертифіката: ${escapeAdminText(item.title)}" loading="lazy"></div>` : ''}
                <span class="credential-kind">Сертифікат</span><h3>${escapeAdminText(item.title)}</h3>
                <p class="item-meta">${escapeAdminText(item.issuer)} · ${date}</p>
                ${item.credential_id ? `<p class="item-meta">ID: ${escapeAdminText(item.credential_id)}</p>` : ''}
                ${item.description ? `<p>${escapeAdminText(item.description)}</p>` : ''}
                <div class="item-actions"><button class="btn-edit" onclick="editCertificate(${item.id})">Редагувати</button><button class="btn-delete" onclick="deleteCertificate(${item.id})">Видалити</button></div>
            </article>`;
        }
        const rank = Number.isInteger(Number(item.rank)) && item.rank !== null ? `${item.rank} місце` : (item.result || 'Відзнака');
        const year = item.year || (item.date ? new Date(item.date).getUTCFullYear() : '');
        return `<article class="item-card credential-card">
            ${item.image ? `<div class="credential-media"><img src="${escapeAdminText(item.image)}" alt="Фото досягнення: ${escapeAdminText(item.title)}" loading="lazy"></div>` : ''}
            <span class="credential-kind">Досягнення${item.featured ? ' · На головній' : ''}</span><h3>${escapeAdminText(item.title)}</h3>
            <p class="item-meta">${escapeAdminText(year)} · ${escapeAdminText(rank)} · ${escapeAdminText(item.category || item.type || 'Досягнення')}</p>
            ${item.organization ? `<p class="item-meta">${escapeAdminText(item.organization)}</p>` : ''}
            ${(item.highlight || item.description) ? `<p>${escapeAdminText(item.highlight || item.description)}</p>` : ''}
            <div class="item-actions"><button class="btn-edit" onclick="editAchievement(${item.id})">Редагувати</button><button class="btn-delete" onclick="deleteAchievement(${item.id})">Видалити</button></div>
        </article>`;
    }).join('');
}

// Builder Orders
async function loadOrders() {
    const container = document.getElementById('orders-list');
    container.innerHTML = '<div class="loading">Завантаження...</div>';
    
    try {
        const orders = await apiRequest('/api/admin/builder-orders');
        
        if (orders.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"></path>
                    </svg>
                    <p>Замовлень ще немає</p>
                </div>
            `;
            return;
        }
        
        const statusLabels = {
            'new': '🆕 Нове',
            'reviewed': '👀 Переглянуто',
            'contacted': '📞 Зв\'язувалися',
            'completed': '✅ Виконано'
        };
        
        const statusColors = {
            'new': '#dc3545',
            'reviewed': '#ffc107',
            'contacted': '#17a2b8',
            'completed': '#28a745'
        };
        
        container.innerHTML = `
            <table style="width: 100%; border-collapse: collapse; font-size: 0.95em;">
                <thead style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                    <tr>
                        <th style="padding: 12px; text-align: left;">ID</th>
                        <th style="padding: 12px; text-align: left;">Тип</th>
                        <th style="padding: 12px; text-align: left;">Дизайн</th>
                        <th style="padding: 12px; text-align: right;">Ціна</th>
                        <th style="padding: 12px; text-align: center;">Статус</th>
                        <th style="padding: 12px; text-align: center;">Дія</th>
                    </tr>
                </thead>
                <tbody>
                    ${orders.map(order => `
                        <tr style="border-bottom: 1px solid #dee2e6;">
                            <td style="padding: 12px;">#${order.id}</td>
                            <td style="padding: 12px;">${order.site_type}</td>
                            <td style="padding: 12px;">${order.design_style}</td>
                            <td style="padding: 12px; text-align: right; font-weight: 600;">${order.total_price} грн</td>
                            <td style="padding: 12px; text-align: center;">
                                <select style="background: ${statusColors[order.status]}; color: white; border: none; padding: 6px 10px; border-radius: 5px; cursor: pointer; font-weight: 600;" onchange="updateOrderStatus(${order.id}, this.value)">
                                    <option value="new" ${order.status === 'new' ? 'selected' : ''}>🆕 Нове</option>
                                    <option value="reviewed" ${order.status === 'reviewed' ? 'selected' : ''}>👀 Переглянуто</option>
                                    <option value="contacted" ${order.status === 'contacted' ? 'selected' : ''}>📞 Зв\'язувалися</option>
                                    <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>✅ Виконано</option>
                                </select>
                            </td>
                            <td style="padding: 12px; text-align: center;">
                                <button class="btn-edit" onclick="viewOrder(${order.id})" style="padding: 6px 12px; margin: 0 3px;">👁️ Перегл.</button>
                                <button class="btn-delete" onclick="deleteOrder(${order.id})" style="padding: 6px 12px; margin: 0 3px;">🗑️ Вид.</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        container.innerHTML = '<div class="error">Помилка при завантаженні замовлень</div>';
    }
}

async function viewOrder(id) {
    try {
        const order = await apiRequest(`/api/admin/builder-orders/${id}`);
        
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Замовлення #${order.id}</h2>
                    <button class="btn-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div style="margin-bottom: 20px;">
                    <p><strong>Тип сайту:</strong> ${order.site_type}</p>
                    <p><strong>Стиль дизайну:</strong> ${order.design_style}</p>
                    <p><strong>Обрані опції:</strong> ${order.selected_options.length > 0 ? order.selected_options.join(', ') : 'немає'}</p>
                    <p><strong>Базова ціна:</strong> ${order.base_price} грн</p>
                    <p><strong>Ціна опцій:</strong> ${order.options_price} грн</p>
                    <p><strong>Загальна ціна:</strong> <strong style="color: #667eea; font-size: 1.2em;">${order.total_price} грн</strong></p>
                    <p><strong>Email:</strong> ${order.client_email || 'не вказано'}</p>
                    <p><strong>Телефон:</strong> ${order.client_phone || 'не вказано'}</p>
                    <p><strong>Примітки:</strong> ${order.notes || 'немає'}</p>
                    <p><strong>Дата створення:</strong> ${new Date(order.created_at).toLocaleDateString('uk-UA')}</p>
                    <p><strong>Статус:</strong> ${order.status}</p>
                </div>
                <div style="display: flex; gap: 10px;">
                    <input type="text" id="order-notes-${id}" placeholder="Додайте примітку..." style="flex: 1; padding: 12px; border: 2px solid #e9ecef; border-radius: 8px; font-size: 1em;">
                    <button class="btn-submit" style="flex: 0; width: auto; padding: 12px 20px;" onclick="saveOrderNotes(${id}, document.getElementById('order-notes-${id}').value)">Зберегти</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    } catch (error) {
        alert('Помилка при завантаженні замовлення');
    }
}

async function updateOrderStatus(id, status) {
    try {
        await apiRequest(`/api/admin/builder-orders/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
        await loadOrders();
    } catch (error) {
        alert('Помилка при оновленні статусу');
    }
}

async function saveOrderNotes(id, notes) {
    try {
        await apiRequest(`/api/admin/builder-orders/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ notes })
        });
        document.querySelector('.modal').remove();
        await loadOrders();
        alert('Примітки збережені');
    } catch (error) {
        alert('Помилка при збереженні приміток');
    }
}

async function deleteOrder(id) {
    if (!confirm('Ви впевнені, що хочете видалити це замовлення?')) return;
    
    try {
        await apiRequest(`/api/admin/builder-orders/${id}`, {
            method: 'DELETE'
        });
        await loadOrders();
    } catch (error) {
        alert('Помилка при видаленні замовлення');
    }
}


async function loadProjects() {
    const container = document.getElementById('projects-list');
    container.innerHTML = '<div class="loading">Завантаження...</div>';

    const categoryLabels = {
        'qa-manual': 'Ручне тестування',
        'qa-api': 'Тестування API',
        'qa-regression': 'Регресійне тестування',
        'qa-usability': 'Юзабіліті',
        'qa-accessibility': 'Доступність',
        frontend: 'Frontend',
        backend: 'Backend',
        fullstack: 'Full-stack',
        other: 'Інше'
    };
    
    try {
        const projects = await apiRequest('/api/admin/projects');
        
        if (projects.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"></path>
                    </svg>
                    <p>QA-кейсів і Full-stack досвіду ще немає</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = projects.map(project => `
            <div class="item-card">
                <h3>${project.title}</h3>
                <p class="item-meta">${project.project_type === 'qa' ? '🧪 QA-кейс' : '🛠️ Full-stack досвід'} · ${categoryLabels[project.category] || project.category}</p>
                <p>${project.description.substring(0, 150)}${project.description.length > 150 ? '...' : ''}</p>
                <div class="tech-tags">
                    ${project.tech.map(t => `<span class="tech-tag">${t}</span>`).join('')}
                </div>
                <div class="item-actions">
                    <button class="btn-edit" onclick="editProject(${project.id})">Редагувати</button>
                    <button class="btn-delete" onclick="deleteProject(${project.id})">Видалити</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<div class="error">Не вдалося завантажити записи портфоліо</div>';
    }
}

function openProjectModal(project = null) {
    const modal = document.getElementById('project-modal');
    const form = document.getElementById('project-form');
    const title = document.getElementById('project-modal-title');
    
    form.reset();
    document.getElementById('project-id').value = '';
    
    if (project) {
        title.textContent = project.project_type === 'qa' ? 'Редагувати QA-кейс' : 'Редагувати Full-stack досвід';
        document.getElementById('project-id').value = project.id;
        document.getElementById('project-type').value = project.project_type || 'engineering';
        document.getElementById('project-category').value = project.category;
        document.getElementById('project-title').value = project.title;
        document.getElementById('project-description').value = project.description;
        document.getElementById('project-tech').value = project.tech.join(', ');
        document.getElementById('project-github').value = project.github || '';
        document.getElementById('project-live-demo').value = project.live_demo || '';
    } else {
        title.textContent = 'Додати QA-кейс';
        document.getElementById('project-type').value = 'qa';
        document.getElementById('project-category').value = 'qa-manual';
    }

    syncProjectTypeLabels();
    
    modal.classList.add('active');
}

function syncProjectTypeLabels() {
    const isQa = document.getElementById('project-type')?.value === 'qa';
    const titleLabel = document.getElementById('project-title-label');
    const descriptionLabel = document.getElementById('project-description-label');
    const description = document.getElementById('project-description');
    if (titleLabel) titleLabel.textContent = isQa ? 'Назва продукту / QA-кейсу' : 'Назва створеного продукту';
    if (descriptionLabel) descriptionLabel.textContent = isQa ? 'Що тестував / опис QA-кейсу' : 'Що створив і який мав внесок';
    if (description) description.placeholder = isQa
        ? 'Обсяг перевірки, сценарії, результати та знайдені дефекти.'
        : 'Опиши реалізовані функції, свій внесок, технології та результат.';
}

document.getElementById('project-type')?.addEventListener('change', (event) => {
    const category = document.getElementById('project-category');
    if (!category) return;
    if (event.target.value === 'qa' && !category.value.startsWith('qa-')) category.value = 'qa-manual';
    if (event.target.value === 'engineering' && category.value.startsWith('qa-')) category.value = 'fullstack';
    syncProjectTypeLabels();
});

function closeProjectModal() {
    document.getElementById('project-modal').classList.remove('active');
}

async function saveProject(event) {
    event.preventDefault();
    
    const id = document.getElementById('project-id').value;
    const project = {
        project_type: document.getElementById('project-type').value,
        category: document.getElementById('project-category').value,
        title: document.getElementById('project-title').value,
        description: document.getElementById('project-description').value,
        tech: document.getElementById('project-tech').value.split(',').map(t => t.trim()).filter(t => t),
        github: document.getElementById('project-github').value || null,
        live_demo: document.getElementById('project-live-demo').value || null
    };
    
    try {
        if (id) {
            await apiRequest(`/api/admin/projects/${id}`, {
                method: 'PUT',
                body: JSON.stringify(project)
            });
        } else {
            await apiRequest('/api/admin/projects', {
                method: 'POST',
                body: JSON.stringify(project)
            });
        }
        
        closeProjectModal();
        await loadProjects();
    } catch (error) {
        console.error('Error saving project:', error);
        alert('Помилка при збереженні запису портфоліо');
    }
}

async function editProject(id) {
    try {
        const projects = await apiRequest('/api/admin/projects');
        const project = projects.find(p => p.id === id);
        if (project) {
            openProjectModal(project);
        }
    } catch (error) {
        alert('Помилка при завантаженні запису портфоліо');
    }
}

async function deleteProject(id) {
    if (!confirm('Ви впевнені, що хочете видалити цей запис портфоліо?')) return;
    
    try {
        await apiRequest(`/api/admin/projects/${id}`, {
            method: 'DELETE'
        });
        await loadProjects();
    } catch (error) {
        console.error('Error deleting project:', error);
        alert('Помилка при видаленні запису портфоліо');
    }
}

// Certificates
function openCertificateModal(certificate = null) {
    const modal = document.getElementById('certificate-modal');
    const form = document.getElementById('certificate-form');
    const title = document.getElementById('certificate-modal-title');
    
    form.reset();
    document.getElementById('certificate-id').value = '';
    
    if (certificate) {
        title.textContent = 'Редагувати сертифікат';
        document.getElementById('certificate-id').value = certificate.id;
        document.getElementById('certificate-title').value = certificate.title;
        document.getElementById('certificate-issuer').value = certificate.issuer;
        document.getElementById('certificate-issue-date').value = certificate.issue_date;
        document.getElementById('certificate-expiry-date').value = certificate.expiry_date || '';
        document.getElementById('certificate-credential-id').value = certificate.credential_id || '';
        document.getElementById('certificate-credential-url').value = certificate.credential_url || '';
        document.getElementById('certificate-image').value = certificate.image || '';
        document.getElementById('certificate-image-file').value = '';
        document.getElementById('certificate-description').value = certificate.description || '';
    } else {
        title.textContent = 'Додати сертифікат';
    }
    
    modal.classList.add('active');
}

function closeCertificateModal() {
    document.getElementById('certificate-modal').classList.remove('active');
}

async function saveCertificate(event) {
    event.preventDefault();
    
    const id = document.getElementById('certificate-id').value;
    const certificate = {
        title: document.getElementById('certificate-title').value,
        issuer: document.getElementById('certificate-issuer').value,
        issue_date: document.getElementById('certificate-issue-date').value,
        expiry_date: document.getElementById('certificate-expiry-date').value || null,
        credential_id: document.getElementById('certificate-credential-id').value || null,
        credential_url: document.getElementById('certificate-credential-url').value || null,
        image: document.getElementById('certificate-image').value || null,
        description: document.getElementById('certificate-description').value || null
    };

    const formData = new FormData();
    Object.entries(certificate).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
            formData.append(key, value);
        }
    });
    const certificateFile = document.getElementById('certificate-image-file').files[0];
    if (certificateFile) {
        formData.append('certificateImage', certificateFile);
    }

    try {
        let response;
        if (id) {
            response = await apiRequest(`/api/admin/certificates/${id}`, {
                method: 'PUT',
                body: formData
            });
        } else {
            response = await apiRequest('/api/admin/certificates', {
                method: 'POST',
                body: formData
            });
        }
        
        closeCertificateModal();
        document.querySelector('[data-credential-filter="certificate"]')?.click();
        await loadCredentials();
        alert('Сертифікат успішно збережено!');
    } catch (error) {
        console.error('Error saving certificate:', error);
        alert('Помилка при збереженні сертифіката: ' + error.message);
    }
}

async function editCertificate(id) {
    try {
        const certificates = await apiRequest('/api/admin/certificates');
        const certificate = certificates.find(c => c.id === id);
        if (certificate) {
            openCertificateModal(certificate);
        }
    } catch (error) {
        alert('Помилка при завантаженні сертифіката');
    }
}

async function deleteCertificate(id) {
    if (!confirm('Ви впевнені, що хочете видалити цей сертифікат?')) return;
    
    try {
        await apiRequest(`/api/admin/certificates/${id}`, {
            method: 'DELETE'
        });
        await loadCredentials();
    } catch (error) {
        console.error('Error deleting certificate:', error);
        alert('Помилка при видаленні сертифіката');
    }
}

// Testimonials
async function loadTestimonials() {
    const container = document.getElementById('testimonials-list');
    container.innerHTML = '<div class="loading">Завантаження...</div>';
    
    try {
        const testimonials = await apiRequest('/api/admin/testimonials');
        
        if (testimonials.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                    </svg>
                    <p>Відгуків ще немає</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = testimonials.map(testimonial => `
            <div class="item-card">
                <h3>${testimonial.name}</h3>
                <p class="item-meta">${testimonial.position}</p>
                <p class="item-meta">Рейтинг: ${'⭐'.repeat(testimonial.rating)}</p>
                <p class="item-meta">Статус: ${testimonial.approved ? '✅ Схвалено' : '⏳ Очікує'}</p>
                <p>${testimonial.text.substring(0, 150)}${testimonial.text.length > 150 ? '...' : ''}</p>
                <div class="item-actions">
                    ${!testimonial.approved ? `<button class="btn-approve" onclick="approveTestimonial(${testimonial.id})">Схвалити</button>` : ''}
                    <button class="btn-delete" onclick="deleteTestimonial(${testimonial.id})">Видалити</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<div class="error">Помилка при завантаженні відгуків</div>';
    }
}

// Achievements
function openAchievementModal(achievement = null) {
    const modal = document.getElementById('achievement-modal');
    const form = document.getElementById('achievement-form');
    const title = document.getElementById('achievement-modal-title');
    
    form.reset();
    document.getElementById('achievement-id').value = '';
    
    if (achievement) {
        title.textContent = 'Редагувати досягнення';
        document.getElementById('achievement-id').value = achievement.id;
        document.getElementById('achievement-title').value = achievement.title;
        document.getElementById('achievement-type').value = achievement.category || achievement.type || 'Інше';
        document.getElementById('achievement-year').value = achievement.year || (achievement.date ? new Date(achievement.date).getUTCFullYear() : new Date().getFullYear());
        document.getElementById('achievement-rank').value = achievement.rank ?? '';
        document.getElementById('achievement-result').value = achievement.result || achievement.type || '';
        document.getElementById('achievement-organization').value = achievement.organization || '';
        document.getElementById('achievement-count').value = achievement.achievement_count || achievement.count || 1;
        document.getElementById('achievement-description').value = achievement.highlight || achievement.description || '';
        document.getElementById('achievement-url').value = (achievement.proof_urls || achievement.proofUrls || []).join('\n') || achievement.proof_url || achievement.achievement_url || '';
        document.getElementById('achievement-featured').checked = Boolean(achievement.featured);
        document.getElementById('achievement-image').value = achievement.image || '';
        document.getElementById('achievement-image-file').value = '';
    } else {
        title.textContent = 'Додати досягнення';
        document.getElementById('achievement-year').value = new Date().getFullYear();
        document.getElementById('achievement-result').value = '';
        document.getElementById('achievement-featured').checked = false;
        document.getElementById('achievement-count').value = 1;
    }
    
    modal.classList.add('active');
}

function closeAchievementModal() {
    document.getElementById('achievement-modal').classList.remove('active');
}

async function saveAchievement(event) {
    event.preventDefault();
    
    const id = document.getElementById('achievement-id').value;
    const achievement = {
        title: document.getElementById('achievement-title').value,
        category: document.getElementById('achievement-type').value,
        year: document.getElementById('achievement-year').value,
        rank: document.getElementById('achievement-rank').value,
        result: document.getElementById('achievement-result').value,
        organization: document.getElementById('achievement-organization').value,
        count: document.getElementById('achievement-count').value,
        highlight: document.getElementById('achievement-description').value,
        proof_urls: document.getElementById('achievement-url').value,
        featured: document.getElementById('achievement-featured').checked,
        image: document.getElementById('achievement-image').value || null
    };

    const formData = new FormData();
    Object.entries(achievement).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
            formData.append(key, value);
        }
    });
    const achievementFile = document.getElementById('achievement-image-file').files[0];
    if (achievementFile) {
        formData.append('achievementImage', achievementFile);
    }

    try {
        if (id) {
            await apiRequest(`/api/admin/achievements/${id}`, {
                method: 'PUT',
                body: formData
            });
        } else {
            await apiRequest('/api/admin/achievements', {
                method: 'POST',
                body: formData
            });
        }
        
        closeAchievementModal();
        document.querySelector('[data-credential-filter="achievement"]')?.click();
        await loadCredentials();
        alert('Досягнення успішно збережено!');
    } catch (error) {
        console.error('Error saving achievement:', error);
        alert('Помилка при збереженні досягнення: ' + error.message);
    }
}

async function editAchievement(id) {
    try {
        const achievements = await apiRequest('/api/admin/achievements');
        const achievement = achievements.find(a => a.id === id);
        if (achievement) {
            openAchievementModal(achievement);
        }
    } catch (error) {
        alert('Помилка при завантаженні досягнення');
    }
}

async function deleteAchievement(id) {
    if (!confirm('Ви впевнені, що хочете видалити це досягнення?')) return;
    
    try {
        await apiRequest(`/api/admin/achievements/${id}`, {
            method: 'DELETE'
        });
        await loadCredentials();
    } catch (error) {
        console.error('Error deleting achievement:', error);
        alert('Помилка при видаленні досягнення');
    }
}

async function approveTestimonial(id) {
    try {
        await apiRequest(`/api/admin/testimonials/${id}/approve`, {
            method: 'PUT'
        });
        await loadTestimonials();
    } catch (error) {
        console.error('Error approving testimonial:', error);
        alert('Помилка при схваленні відгуку');
    }
}

async function deleteTestimonial(id) {
    if (!confirm('Ви впевнені, що хочете видалити цей відгук?')) return;
    
    try {
        await apiRequest(`/api/admin/testimonials/${id}`, {
            method: 'DELETE'
        });
        await loadTestimonials();
    } catch (error) {
        console.error('Error deleting testimonial:', error);
        alert('Помилка при видаленні відгуку');
    }
}

// Initialize
checkAdminSession();
