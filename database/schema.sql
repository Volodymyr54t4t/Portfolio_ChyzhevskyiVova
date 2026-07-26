-- PostgreSQL Database Schema for Portfolio
-- Connection: postgresql://neondb_owner:npg_G0IEDSP1Bpcj@ep-aged-sea-amvochkh-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

-- Drop existing tables if they exist
DROP TABLE IF EXISTS builder_orders CASCADE;
DROP TABLE IF EXISTS awards CASCADE;
DROP TABLE IF EXISTS certificates CASCADE;
DROP TABLE IF EXISTS testimonials CASCADE;
DROP TABLE IF EXISTS projects CASCADE;

-- Projects table
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    image TEXT,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    tech TEXT[] NOT NULL,
    github TEXT,
    live_demo TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Testimonials table
CREATE TABLE testimonials (
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
CREATE TABLE certificates (
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

-- Builder Orders table
CREATE TABLE builder_orders (
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
CREATE TABLE awards (
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
CREATE INDEX idx_projects_category ON projects(category);
CREATE INDEX idx_testimonials_approved ON testimonials(approved);
CREATE INDEX idx_certificates_issue_date ON certificates(issue_date);
CREATE INDEX idx_builder_orders_status ON builder_orders(status);
CREATE INDEX idx_builder_orders_created_at ON builder_orders(created_at);
CREATE INDEX idx_awards_date ON awards(date);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_testimonials_updated_at BEFORE UPDATE ON testimonials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_certificates_updated_at BEFORE UPDATE ON certificates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_builder_orders_updated_at BEFORE UPDATE ON builder_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_awards_updated_at BEFORE UPDATE ON awards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
