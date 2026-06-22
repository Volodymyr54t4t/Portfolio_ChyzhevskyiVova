const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_G0IEDSP1Bpcj@ep-aged-sea-amvochkh-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

// Simple in-memory captcha store: { id -> { answer, ts } }
const captchaStore = new Map();
// Cleanup old captchas every minute
setInterval(() => {
  const now = Date.now();
  for (const [id, obj] of captchaStore) {
    if (now - obj.ts > 5 * 60 * 1000) captchaStore.delete(id);
  }
}, 60 * 1000);

// Middleware для безпеки
app.use(
  helmet({
    contentSecurityPolicy: false, // Вимкнути для розробки
  })
);

// CORS middleware
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? ["https://yourdomain.com"] // Замініть на ваш домен
        : ["http://localhost:3000", "http://127.0.0.1:3000"],
    credentials: true,
  })
);

// Prevent caching of static assets and API responses (helps on deploy)
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 хвилин
  max: 100, // максимум 100 запитів на IP за 15 хвилин
  message: {
    error: "Занадто багато запитів з цього IP, спробуйте пізніше.",
  },
});

const postLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 хвилин
  max: 5, // максимум 5 POST запитів на IP за 15 хвилин
  message: {
    error: "Занадто багато спроб додавання відгуків, спробуйте пізніше.",
  },
});

app.use(limiter);

// Middleware для обробки JSON з обробкою помилок
app.use(
  express.json({
    limit: "10mb",
    verify: (req, res, buf) => {
      // Only verify when body is present (avoid failing on empty bodies for GET/PUT without body)
      if (!buf || !buf.length) return;
      try {
        JSON.parse(buf.toString());
      } catch (e) {
        const err = new SyntaxError('Invalid JSON');
        err.status = 400;
        throw err;
      }
    },
  })
);

// Handle JSON parse / verify errors from body-parser
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError || err.type === 'entity.parse.failed' || err.type === 'entity.verify.failed') {
    return res.status(400).json({ error: 'Невірний формат JSON' });
  }
  next(err);
});

app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Статичні файли
app.use(express.static(path.join(__dirname, "public")));

// Функція валідації відгуку
function validateTestimonial(data) {
  const errors = [];

  if (
    !data.name ||
    typeof data.name !== "string" ||
    data.name.trim().length < 2
  ) {
    errors.push("Ім'я має містити принаймні 2 символи");
  }

  if (
    !data.position ||
    typeof data.position !== "string" ||
    data.position.trim().length < 2
  ) {
    errors.push("Посада має містити принаймні 2 символи");
  }

  if (
    !data.text ||
    typeof data.text !== "string" ||
    data.text.trim().length < 10
  ) {
    errors.push("Текст відгуку має містити принаймні 10 символів");
  }

  if (
    !data.rating ||
    !Number.isInteger(Number(data.rating)) ||
    Number(data.rating) < 1 ||
    Number(data.rating) > 5
  ) {
    errors.push("Рейтинг має бути цілим числом від 1 до 5");
  }

  if (data.text && data.text.length > 1000) {
    errors.push("Текст відгуку не може перевищувати 1000 символів");
  }

  if (data.name && data.name.length > 100) {
    errors.push("Ім'я не може перевищувати 100 символів");
  }

  if (data.position && data.position.length > 200) {
    errors.push("Посада не може перевищувати 200 символів");
  }

  return errors;
}

// Функція для санітизації тексту
function sanitizeText(text) {
  return text
    .trim()
    .replace(/[<>]/g, "") // Видаляємо потенційно небезпечні символи
    .replace(/\s+/g, " "); // Замінюємо множинні пробіли одним
}

// API для отримання всіх схвалених відгуків
app.get("/api/testimonials", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM testimonials WHERE approved = true ORDER BY date DESC"
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Помилка при читанні відгуків:", error);
    res.status(500).json({
      error: "Не вдалося отримати відгуки",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Simple CAPTCHA endpoint: returns a math question and id
app.get('/api/captcha', (req, res) => {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : require('crypto').randomBytes(16).toString('hex');
  const answer = a + b;
  captchaStore.set(id, { answer, ts: Date.now() });
  res.json({ id, question: `Скільки буде ${a} + ${b}?` });
});

// API для додавання нового відгуку
app.post("/api/testimonials", postLimiter, async (req, res) => {
  try {
    const { name, position, text, rating, image, hp } = req.body;

    // Honeypot check to block simple bot submissions
    if (hp && typeof hp === 'string' && hp.trim().length > 0) {
      console.warn('Honeypot triggered, rejecting submission');
      return res.status(400).json({ error: 'Invalid submission' });
    }

    // CAPTCHA validation
    const { captchaId, captchaAnswer } = req.body || {};
    if (!captchaId || typeof captchaAnswer === 'undefined') {
      return res.status(400).json({ error: 'Captcha required' });
    }
    const entry = captchaStore.get(captchaId);
    if (!entry || Number(captchaAnswer) !== Number(entry.answer)) {
      return res.status(400).json({ error: 'Captcha invalid' });
    }
    // Remove used captcha
    captchaStore.delete(captchaId);

    // Валідація даних
    const validationErrors = validateTestimonial(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: "Помилки валідації",
        details: validationErrors,
      });
    }

    // Створюємо новий відгук
    const newTestimonial = {
      name: sanitizeText(name),
      position: sanitizeText(position),
      image:
        image && typeof image === "string" && image.startsWith("http")
          ? image
          : `https://randomuser.me/api/portraits/${
              Math.random() > 0.5 ? "men" : "women"
            }/${Math.floor(Math.random() * 100)}.jpg`,
      text: sanitizeText(text),
      rating: Number.parseInt(rating),
      date: new Date().toISOString().split("T")[0],
      approved: false,
    };

    const result = await pool.query(
      `INSERT INTO testimonials (name, position, image, text, rating, date, approved)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        newTestimonial.name,
        newTestimonial.position,
        newTestimonial.image,
        newTestimonial.text,
        newTestimonial.rating,
        newTestimonial.date,
        newTestimonial.approved,
      ]
    );

    console.log(`Додано новий відгук від ${newTestimonial.name}`);

    res.status(201).json({
      message: "Відгук успішно додано та очікує на модерацію",
      testimonial: result.rows[0],
    });
  } catch (error) {
    console.error("Помилка при додаванні відгуку:", error);
    res.status(500).json({
      error: "Не вдалося додати відгук",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// API для отримання статистики (додатковий endpoint)
app.get("/api/stats", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE approved = true) as approved, COUNT(*) FILTER (WHERE approved = false) as pending, AVG(rating) as average_rating FROM testimonials"
    );
    const stats = {
      total: parseInt(result.rows[0].total),
      approved: parseInt(result.rows[0].approved),
      pending: parseInt(result.rows[0].pending),
      averageRating: result.rows[0].average_rating
        ? parseFloat(result.rows[0].average_rating).toFixed(1)
        : 0,
    };
    res.json(stats);
  } catch (error) {
    console.error("Помилка при отриманні статистики:", error);
    res.status(500).json({ error: "Не вдалося отримати статистику" });
  }
});

// Public API for projects
app.get("/api/projects", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM projects ORDER BY id DESC");
    res.json(result.rows);
  } catch (error) {
    console.error("Помилка при отриманні проектів:", error);
    res.status(500).json({ error: "Не вдалося отримати проекти" });
  }
});

// Public API for certificates
app.get("/api/certificates", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM certificates ORDER BY issue_date DESC");
    res.json(result.rows);
  } catch (error) {
    console.error("Помилка при отриманні сертифікатів:", error);
    res.status(500).json({ error: "Не вдалося отримати сертифікати" });
  }
});

// Public API for awards
app.get("/api/awards", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM awards ORDER BY date DESC");
    res.json(result.rows);
  } catch (error) {
    console.error("Помилка при отриманні нагород:", error);
    res.status(500).json({ error: "Не вдалося отримати нагороди" });
  }
});

// ============ ADMIN PANEL API ENDPOINTS ============

// Projects API
app.get("/api/admin/projects", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM projects ORDER BY id DESC");
    res.json(result.rows);
  } catch (error) {
    console.error("Помилка при отриманні проектів:", error);
    res.status(500).json({ error: "Не вдалося отримати проекти" });
  }
});

app.post("/api/admin/projects", async (req, res) => {
  try {
    const { category, image, title, description, tech, github, live_demo } = req.body;
    const result = await pool.query(
      `INSERT INTO projects (category, image, title, description, tech, github, live_demo)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [category, image, title, description, tech, github, live_demo]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Помилка при додаванні проекту:", error);
    res.status(500).json({ error: "Не вдалося додати проект" });
  }
});

app.put("/api/admin/projects/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { category, image, title, description, tech, github, live_demo } = req.body;
    const result = await pool.query(
      `UPDATE projects SET category = $1, image = $2, title = $3, description = $4, tech = $5, github = $6, live_demo = $7
       WHERE id = $8 RETURNING *`,
      [category, image, title, description, tech, github, live_demo, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Помилка при оновленні проекту:", error);
    res.status(500).json({ error: "Не вдалося оновити проект" });
  }
});

app.delete("/api/admin/projects/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM projects WHERE id = $1", [id]);
    res.json({ message: "Проект видалено" });
  } catch (error) {
    console.error("Помилка при видаленні проекту:", error);
    res.status(500).json({ error: "Не вдалося видалити проект" });
  }
});

// Certificates API
app.get("/api/admin/certificates", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM certificates ORDER BY issue_date DESC");
    res.json(result.rows);
  } catch (error) {
    console.error("Помилка при отриманні сертифікатів:", error);
    res.status(500).json({ error: "Не вдалося отримати сертифікати" });
  }
});

app.post("/api/admin/certificates", async (req, res) => {
  try {
    const { title, issuer, issue_date, expiry_date, credential_id, credential_url, image, description } = req.body;
    const result = await pool.query(
      `INSERT INTO certificates (title, issuer, issue_date, expiry_date, credential_id, credential_url, image, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [title, issuer, issue_date, expiry_date, credential_id, credential_url, image, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Помилка при додаванні сертифіката:", error);
    res.status(500).json({ error: "Не вдалося додати сертифікат" });
  }
});

app.put("/api/admin/certificates/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, issuer, issue_date, expiry_date, credential_id, credential_url, image, description } = req.body;
    const result = await pool.query(
      `UPDATE certificates SET title = $1, issuer = $2, issue_date = $3, expiry_date = $4, credential_id = $5, credential_url = $6, image = $7, description = $8
       WHERE id = $9 RETURNING *`,
      [title, issuer, issue_date, expiry_date, credential_id, credential_url, image, description, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Помилка при оновленні сертифіката:", error);
    res.status(500).json({ error: "Не вдалося оновити сертифікат" });
  }
});

app.delete("/api/admin/certificates/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM certificates WHERE id = $1", [id]);
    res.json({ message: "Сертифікат видалено" });
  } catch (error) {
    console.error("Помилка при видаленні сертифіката:", error);
    res.status(500).json({ error: "Не вдалося видалити сертифікат" });
  }
});

// Awards API
app.get("/api/admin/awards", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM awards ORDER BY date DESC");
    res.json(result.rows);
  } catch (error) {
    console.error("Помилка при отриманні нагород:", error);
    res.status(500).json({ error: "Не вдалося отримати нагороди" });
  }
});

app.post("/api/admin/awards", async (req, res) => {
  try {
    const { title, organization, date, description, image, award_url } = req.body;
    const result = await pool.query(
      `INSERT INTO awards (title, organization, date, description, image, award_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [title, organization, date, description, image, award_url]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Помилка при додаванні нагороди:", error);
    res.status(500).json({ error: "Не вдалося додати нагороду" });
  }
});

app.put("/api/admin/awards/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, organization, date, description, image, award_url } = req.body;
    const result = await pool.query(
      `UPDATE awards SET title = $1, organization = $2, date = $3, description = $4, image = $5, award_url = $6
       WHERE id = $7 RETURNING *`,
      [title, organization, date, description, image, award_url, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Помилка при оновленні нагороди:", error);
    res.status(500).json({ error: "Не вдалося оновити нагороду" });
  }
});

app.delete("/api/admin/awards/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM awards WHERE id = $1", [id]);
    res.json({ message: "Нагороду видалено" });
  } catch (error) {
    console.error("Помилка при видаленні нагороди:", error);
    res.status(500).json({ error: "Не вдалося видалити нагороду" });
  }
});

// Testimonials Admin API
app.get("/api/admin/testimonials", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM testimonials ORDER BY date DESC");
    res.json(result.rows);
  } catch (error) {
    console.error("Помилка при отриманні відгуків:", error);
    res.status(500).json({ error: "Не вдалося отримати відгуки" });
  }
});

app.put("/api/admin/testimonials/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "UPDATE testimonials SET approved = true WHERE id = $1 RETURNING *",
      [id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Помилка при схваленні відгуку:", error);
    res.status(500).json({ error: "Не вдалося схвалити відгук" });
  }
});

app.delete("/api/admin/testimonials/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM testimonials WHERE id = $1", [id]);
    res.json({ message: "Відгук видалено" });
  } catch (error) {
    console.error("Помилка при видаленні відгуку:", error);
    res.status(500).json({ error: "Не вдалося видалити відгук" });
  }
});

// Middleware для обробки помилок
app.use((error, req, res, next) => {
  console.error("Необроблена помилка:", error);
  res.status(500).json({
    error: "Внутрішня помилка сервера",
    details: process.env.NODE_ENV === "development" ? error.message : undefined,
  });
});

// Обробка неіснуючих API маршрутів
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: "API endpoint не знайдено" });
});

// Обробка всіх інших запитів - повертаємо index.html
app.get("*", (req, res) => {
  const indexPath = path.join(__dirname, "public", "index.html");

  // Перевіряємо чи існує файл
  if (fsSync.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({
      error: "Сторінку не знайдено",
      message: "Файл index.html відсутній в папці public/",
    });
  }
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("Отримано SIGTERM, завершуємо сервер...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("Отримано SIGINT, завершуємо сервер...");
  process.exit(0);
});

// Ініціалізація та запуск сервера
async function startServer() {
  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    console.log('✅ Підключено до PostgreSQL');

    app.listen(PORT, () => {
      console.log(`🚀 Сервер запущено: http://localhost:${PORT}`);
      console.log(`📁 Статичні файли: ${path.join(__dirname, "public")}`);
      console.log(`💾 Дані зберігаються в PostgreSQL (Neon)`);
      console.log(`🎛️ Адмін панель: http://localhost:${PORT}/admin.html`);
      console.log(`🌍 Середовище: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (error) {
    console.error("Помилка при запуску сервера:", error);
    process.exit(1);
  }
}

startServer();
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
