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
        case 'projects':
            await loadProjects();
            break;
        case 'certificates':
            await loadCertificates();
            break;
        case 'awards':
            await loadAwards();
            break;
        case 'testimonials':
            await loadTestimonials();
            break;
    }
}

// API helper functions
async function apiRequest(url, options = {}) {
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
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

// Projects
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
                ${cert.description ? `<p>${cert.description.substring(0, 150)}${cert.description.length > 150 ? '...' : ''}</p>` : ''}
                <div class="item-actions">
                    <button class="btn-edit" onclick="editCertificate(${cert.id})">Редагувати</button>
                    <button class="btn-delete" onclick="deleteCertificate(${cert.id})">Видалити</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
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
    
    try {
        if (id) {
            await apiRequest(`/api/admin/certificates/${id}`, {
                method: 'PUT',
                body: JSON.stringify(certificate)
            });
        } else {
            await apiRequest('/api/admin/certificates', {
                method: 'POST',
                body: JSON.stringify(certificate)
            });
        }
        
        closeCertificateModal();
        await loadCertificates();
    } catch (error) {
        console.error('Error saving certificate:', error);
        alert('Помилка при збереженні сертифіката');
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
        document.getElementById('award-description').value = award.description || '';
        document.getElementById('award-image').value = award.image || '';
        document.getElementById('award-url').value = award.award_url || '';
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
        date: document.getElementById('award-date').value,
        description: document.getElementById('award-description').value || null,
        image: document.getElementById('award-image').value || null,
        award_url: document.getElementById('award-url').value || null
    };
    
    try {
        if (id) {
            await apiRequest(`/api/admin/awards/${id}`, {
                method: 'PUT',
                body: JSON.stringify(award)
            });
        } else {
            await apiRequest('/api/admin/awards', {
                method: 'POST',
                body: JSON.stringify(award)
            });
        }
        
        closeAwardModal();
        await loadAwards();
    } catch (error) {
        console.error('Error saving award:', error);
        alert('Помилка при збереженні нагороди');
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
