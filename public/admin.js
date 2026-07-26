// Admin Panel JavaScript

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
async function loadSection(section) {
    switch(section) {
        case 'orders':
            await loadOrders();
            break;
        case 'projects':
            await loadProjects();
            break;
        case 'certificates':
            await loadCertificates();
            break;
        case 'awards':
            await loadAwards();
            break;
        case 'achievements':
            await loadAchievements();
            break;
        case 'testimonials':
            await loadTestimonials();
            break;
    }
}

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
    
    try {
        const projects = await apiRequest('/api/admin/projects');
        
        if (projects.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"></path>
                    </svg>
                    <p>Проєктів ще немає</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = projects.map(project => `
            <div class="item-card">
                <h3>${project.title}</h3>
                <p class="item-meta">Категорія: ${project.category}</p>
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
        container.innerHTML = '<div class="error">Помилка при завантаженні проєктів</div>';
    }
}

function openProjectModal(project = null) {
    const modal = document.getElementById('project-modal');
    const form = document.getElementById('project-form');
    const title = document.getElementById('project-modal-title');
    
    form.reset();
    document.getElementById('project-id').value = '';
    
    if (project) {
        title.textContent = 'Редагувати проєкт';
        document.getElementById('project-id').value = project.id;
        document.getElementById('project-category').value = project.category;
        document.getElementById('project-title').value = project.title;
        document.getElementById('project-description').value = project.description;
        document.getElementById('project-tech').value = project.tech.join(', ');
        document.getElementById('project-github').value = project.github || '';
        document.getElementById('project-live-demo').value = project.live_demo || '';
    } else {
        title.textContent = 'Додати проєкт';
    }
    
    modal.classList.add('active');
}

function closeProjectModal() {
    document.getElementById('project-modal').classList.remove('active');
}

async function saveProject(event) {
    event.preventDefault();
    
    const id = document.getElementById('project-id').value;
    const project = {
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
        alert('Помилка при збереженні проєкту');
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
        alert('Помилка при завантаженні проєкту');
    }
}

async function deleteProject(id) {
    if (!confirm('Ви впевнені, що хочете видалити цей проєкт?')) return;
    
    try {
        await apiRequest(`/api/admin/projects/${id}`, {
            method: 'DELETE'
        });
        await loadProjects();
    } catch (error) {
        console.error('Error deleting project:', error);
        alert('Помилка при видаленні проєкту');
    }
}

// Certificates
async function loadCertificates() {
    const container = document.getElementById('certificates-list');
    container.innerHTML = '<div class="loading">Завантаження...</div>';

    try {
        const certificates = await apiRequest('/api/admin/certificates');
        console.log('Loaded certificates:', certificates);

        if (certificates.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"></path>
                    </svg>
                    <p>Сертифікатів ще немає</p>
                </div>
            `;
            return;
        }

        container.innerHTML = certificates.map(cert => `
            <div class="item-card">
                <h3>${cert.title}</h3>
                <p class="item-meta">Організація: ${cert.issuer}</p>
                <p class="item-meta">Дата: ${new Date(cert.issue_date).toLocaleDateString('uk-UA')}</p>
                ${cert.image ? `<p class="item-meta">Зображення: ${cert.image}</p>` : ''}
                ${cert.description ? `<p>${cert.description.substring(0, 150)}${cert.description.length > 150 ? '...' : ''}</p>` : ''}
                <div class="item-actions">
                    <button class="btn-edit" onclick="editCertificate(${cert.id})">Редагувати</button>
                    <button class="btn-delete" onclick="deleteCertificate(${cert.id})">Видалити</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading certificates:', error);
        container.innerHTML = '<div class="error">Помилка при завантаженні сертифікатів</div>';
    }
}

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
        await loadCertificates();
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
        await loadCertificates();
    } catch (error) {
        console.error('Error deleting certificate:', error);
        alert('Помилка при видаленні сертифіката');
    }
}

// Awards
async function loadAwards() {
    const container = document.getElementById('awards-list');
    container.innerHTML = '<div class="loading">Завантаження...</div>';
    
    try {
        const awards = await apiRequest('/api/admin/awards');
        
        if (awards.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path>
                    </svg>
                    <p>Нагород ще немає</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = awards.map(award => `
            <div class="item-card">
                <h3>${award.title}</h3>
                <p class="item-meta">Організація: ${award.organization}</p>
                <p class="item-meta">Місце: ${award.place || 'Учасник'}</p>
                <p class="item-meta">Дата: ${new Date(award.date).toLocaleDateString('uk-UA')}</p>
                ${award.description ? `<p>${award.description.substring(0, 150)}${award.description.length > 150 ? '...' : ''}</p>` : ''}
                <div class="item-actions">
                    <button class="btn-edit" onclick="editAward(${award.id})">Редагувати</button>
                    <button class="btn-delete" onclick="deleteAward(${award.id})">Видалити</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<div class="error">Помилка при завантаженні нагород</div>';
    }
}

function openAwardModal(award = null) {
    const modal = document.getElementById('award-modal');
    const form = document.getElementById('award-form');
    const title = document.getElementById('award-modal-title');
    
    form.reset();
    document.getElementById('award-id').value = '';
    
    if (award) {
        title.textContent = 'Редагувати нагороду';
        document.getElementById('award-id').value = award.id;
        document.getElementById('award-title').value = award.title;
        document.getElementById('award-organization').value = award.organization;
        document.getElementById('award-date').value = award.date;
        document.getElementById('award-place').value = award.place || 'Учасник';
        document.getElementById('award-description').value = award.description || '';
        document.getElementById('award-image').value = award.image || '';
        document.getElementById('award-image-file').value = '';
    } else {
        title.textContent = 'Додати нагороду';
    }
    
    modal.classList.add('active');
}

function closeAwardModal() {
    document.getElementById('award-modal').classList.remove('active');
}

async function saveAward(event) {
    event.preventDefault();
    
    const id = document.getElementById('award-id').value;
    const award = {
        title: document.getElementById('award-title').value,
        organization: document.getElementById('award-organization').value,
        place: document.getElementById('award-place').value,
        date: document.getElementById('award-date').value,
        description: document.getElementById('award-description').value || null,
        image: document.getElementById('award-image').value || null
    };

    const formData = new FormData();
    Object.entries(award).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
            formData.append(key, value);
        }
    });
    const awardFile = document.getElementById('award-image-file').files[0];
    if (awardFile) {
        formData.append('awardImage', awardFile);
    }

    try {
        if (id) {
            await apiRequest(`/api/admin/awards/${id}`, {
                method: 'PUT',
                body: formData
            });
        } else {
            await apiRequest('/api/admin/awards', {
                method: 'POST',
                body: formData
            });
        }
        
        closeAwardModal();
        await loadAwards();
        alert('Нагороду успішно збережено!');
    } catch (error) {
        console.error('Error saving award:', error);
        alert('Помилка при збереженні нагороди: ' + error.message);
    }
}

async function editAward(id) {
    try {
        const awards = await apiRequest('/api/admin/awards');
        const award = awards.find(a => a.id === id);
        if (award) {
            openAwardModal(award);
        }
    } catch (error) {
        alert('Помилка при завантаженні нагороди');
    }
}

async function deleteAward(id) {
    if (!confirm('Ви впевнені, що хочете видалити цю нагороду?')) return;
    
    try {
        await apiRequest(`/api/admin/awards/${id}`, {
            method: 'DELETE'
        });
        await loadAwards();
    } catch (error) {
        console.error('Error deleting award:', error);
        alert('Помилка при видаленні нагороди');
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
async function loadAchievements() {
    const container = document.getElementById('achievements-list');
    container.innerHTML = '<div class="loading">Завантаження...</div>';
    
    try {
        const achievements = await apiRequest('/api/admin/achievements');
        
        if (achievements.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <p>Досягнень ще немає</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = achievements.map(achievement => `
            <div class="item-card">
                <h3>${achievement.title}</h3>
                <p class="item-meta">Тип: ${achievement.type}</p>
                <p class="item-meta">Дата: ${new Date(achievement.date).toLocaleDateString('uk-UA')}</p>
                ${achievement.description ? `<p>${achievement.description.substring(0, 150)}${achievement.description.length > 150 ? '...' : ''}</p>` : ''}
                <div class="item-actions">
                    <button class="btn-edit" onclick="editAchievement(${achievement.id})">Редагувати</button>
                    <button class="btn-delete" onclick="deleteAchievement(${achievement.id})">Видалити</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<div class="error">Помилка при завантаженні досягнень</div>';
    }
}

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
        document.getElementById('achievement-type').value = achievement.type;
        document.getElementById('achievement-date').value = achievement.date;
        document.getElementById('achievement-description').value = achievement.description || '';
        document.getElementById('achievement-url').value = achievement.achievement_url || '';
        document.getElementById('achievement-image').value = achievement.image || '';
        document.getElementById('achievement-image-file').value = '';
    } else {
        title.textContent = 'Додати досягнення';
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
        type: document.getElementById('achievement-type').value,
        date: document.getElementById('achievement-date').value,
        description: document.getElementById('achievement-description').value || null,
        achievement_url: document.getElementById('achievement-url').value || null,
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
        await loadAchievements();
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
        await loadAchievements();
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
loadProjects();
