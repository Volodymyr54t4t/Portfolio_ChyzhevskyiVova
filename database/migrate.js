const { Pool } = require('pg');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_G0IEDSP1Bpcj@ep-aged-sea-amvochkh-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

async function migrateProjects() {
  try {
    const projectsPath = path.join(__dirname, '../public/projects.json');
    const projectsData = await fs.readFile(projectsPath, 'utf8');
    const projects = JSON.parse(projectsData);

    for (const project of projects) {
      await pool.query(
        `INSERT INTO projects (category, image, title, description, tech, github, live_demo)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT DO NOTHING`,
        [
          project.category,
          project.image || null,
          project.title,
          project.description,
          project.tech,
          project.github || null,
          project.live_demo || null
        ]
      );
    }
    console.log(`✅ Migrated ${projects.length} projects`);
  } catch (error) {
    console.error('❌ Error migrating projects:', error.message);
  }
}

async function migrateTestimonials() {
  try {
    const testimonialsPath = path.join(__dirname, '../data/testimonials.json');
    // If file doesn't exist, skip testimonials migration
    if (!fsSync.existsSync(testimonialsPath)) {
      console.log('ℹ️ testimonials.json not found — skipping testimonials migration');
      return;
    }
    const testimonialsData = await fs.readFile(testimonialsPath, 'utf8');
    const testimonials = JSON.parse(testimonialsData);

    for (const testimonial of testimonials) {
      await pool.query(
        `INSERT INTO testimonials (name, position, image, text, rating, date, approved)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT DO NOTHING`,
        [
          testimonial.name,
          testimonial.position,
          testimonial.image || null,
          testimonial.text,
          testimonial.rating,
          testimonial.date,
          testimonial.approved !== false
        ]
      );
    }
    console.log(`✅ Migrated ${testimonials.length} testimonials`);
  } catch (error) {
    console.error('❌ Error migrating testimonials:', error.message);
  }
}

async function runMigration() {
  try {
    console.log('🚀 Starting migration...');
    
    // Read and execute schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf8');
    await pool.query(schema);
    console.log('✅ Schema created successfully');

    // Migrate data
    await migrateProjects();
    await migrateTestimonials();

    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await pool.end();
  }
}

runMigration();
