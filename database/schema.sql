-- PostgreSQL Database Schema for Portfolio

-- Idempotent schema setup: existing portfolio data is preserved.
-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    image TEXT,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    tech TEXT[] NOT NULL,
    github TEXT,
    live_demo TEXT,
    project_type VARCHAR(30) NOT NULL DEFAULT 'engineering',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Testimonials table
CREATE TABLE IF NOT EXISTS testimonials (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    position VARCHAR(200) NOT NULL,
    image TEXT,
    text TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    date DATE NOT NULL,
    approved BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Certificates table
CREATE TABLE IF NOT EXISTS certificates (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    issuer VARCHAR(255) NOT NULL,
    issue_date DATE NOT NULL,
    expiry_date DATE,
    credential_id TEXT,
    credential_url TEXT,
    image TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Competition results and other achievements are managed in the database.
CREATE TABLE IF NOT EXISTS achievements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL DEFAULT 'Досягнення',
    date DATE NOT NULL,
    description TEXT,
    image TEXT,
    achievement_url TEXT,
    year INTEGER,
    rank INTEGER,
    result TEXT,
    category VARCHAR(100),
    organization TEXT,
    proof_url TEXT,
    proof_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    highlight TEXT,
    featured BOOLEAN NOT NULL DEFAULT false,
    achievement_count INTEGER NOT NULL DEFAULT 1,
    source_key TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Research papers, articles, conference talks, and downloadable materials.
CREATE TABLE IF NOT EXISTS publications (
    id SERIAL PRIMARY KEY,
    title VARCHAR(300) NOT NULL,
    work_type VARCHAR(40) NOT NULL DEFAULT 'article',
    description TEXT,
    authors TEXT,
    organization TEXT,
    event_name TEXT,
    publication_date DATE,
    file_path TEXT,
    file_name TEXT,
    file_mime TEXT,
    external_url TEXT,
    featured BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Builder Orders table
CREATE TABLE IF NOT EXISTS builder_orders (
    id SERIAL PRIMARY KEY,
    site_type VARCHAR(50) NOT NULL,
    design_style VARCHAR(50) NOT NULL,
    selected_options TEXT[] DEFAULT ARRAY[]::TEXT[],
    base_price INTEGER NOT NULL,
    options_price INTEGER DEFAULT 0,
    total_price INTEGER NOT NULL,
    notes TEXT,
    client_email VARCHAR(255),
    client_phone VARCHAR(20),
    status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'contacted', 'completed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Awards table
CREATE TABLE IF NOT EXISTS awards (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    organization VARCHAR(255) NOT NULL,
    place VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    description TEXT,
    image TEXT,
    award_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category);
CREATE INDEX IF NOT EXISTS idx_testimonials_approved ON testimonials(approved);
CREATE INDEX IF NOT EXISTS idx_certificates_issue_date ON certificates(issue_date);
CREATE INDEX IF NOT EXISTS idx_achievements_year_rank ON achievements(year DESC, rank ASC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_achievements_source_key ON achievements(source_key) WHERE source_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_publications_date ON publications(publication_date DESC);
CREATE INDEX IF NOT EXISTS idx_builder_orders_status ON builder_orders(status);
CREATE INDEX IF NOT EXISTS idx_builder_orders_created_at ON builder_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_awards_date ON awards(date);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_testimonials_updated_at ON testimonials;
CREATE TRIGGER update_testimonials_updated_at BEFORE UPDATE ON testimonials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_certificates_updated_at ON certificates;
CREATE TRIGGER update_certificates_updated_at BEFORE UPDATE ON certificates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_builder_orders_updated_at ON builder_orders;
CREATE TRIGGER update_builder_orders_updated_at BEFORE UPDATE ON builder_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_awards_updated_at ON awards;
CREATE TRIGGER update_awards_updated_at BEFORE UPDATE ON awards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Singleton editable profile content. This is safe to re-run and keeps the current data.
CREATE TABLE IF NOT EXISTS profile_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    first_name VARCHAR(100) NOT NULL DEFAULT 'Володимир',
    last_name VARCHAR(100) NOT NULL DEFAULT 'Чижевський',
    headline VARCHAR(240) NOT NULL DEFAULT 'QA-тестувальник вебзастосунків',
    about TEXT NOT NULL DEFAULT '',
    email VARCHAR(254) NOT NULL DEFAULT '',
    phone VARCHAR(40) NOT NULL DEFAULT '',
    location VARCHAR(160) NOT NULL DEFAULT '',
    photo TEXT NOT NULL DEFAULT './img/re-access-zhytomyr.jpg',
    social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO profile_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Stored contact form submissions for the admin inbox.
CREATE TABLE IF NOT EXISTS contact_messages (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(254) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'new' CHECK (status IN ('new','read')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created ON contact_messages(created_at DESC);
