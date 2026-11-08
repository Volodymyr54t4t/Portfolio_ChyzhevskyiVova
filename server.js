const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const crypto = require("crypto");
const { Pool } = require("pg");

// Load local secrets without adding a runtime dependency. Never commit .env.
try {
  const envFile = fsSync.readFileSync(path.join(__dirname, ".env"), "utf8");
  for (const line of envFile.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !Object.hasOwn(process.env, match[1])) {
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const app = express();
const PORT = process.env.PORT || 3000;

const uploadBasePath = path.join(__dirname, "public", "uploads");
const certificateUploadPath = path.join(uploadBasePath, "certificates");
const awardUploadPath = path.join(uploadBasePath, "awards");
const achievementUploadPath = path.join(uploadBasePath, "achievements");
const publicationUploadPath = path.join(uploadBasePath, "publications");

[uploadBasePath, certificateUploadPath, awardUploadPath, achievementUploadPath, publicationUploadPath].forEach((dir) => {
  if (!fsSync.existsSync(dir)) {
    fsSync.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "certificateImage") {
      cb(null, certificateUploadPath);
    } else if (file.fieldname === "awardImage") {
      cb(null, awardUploadPath);
    } else if (file.fieldname === "achievementImage") {
      cb(null, achievementUploadPath);
    } else if (file.fieldname === "publicationFile") {
      cb(null, publicationUploadPath);
    } else {
      cb(null, uploadBasePath);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 30 * 1024 * 1024, // 30 MB
  },
  fileFilter: (req, file, cb) => {
    // Accept images and PDF files for certificates/achievements
    const allowedTypes = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".jfif", ".pjpeg", ".bmp", ".tiff", ".tif", ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".odt", ".odp", ".rtf", ".txt"];
    const allowedMimeTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp", "image/pjpeg", "image/bmp", "image/tiff", "image/x-tiff", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/vnd.oasis.opendocument.text", "application/vnd.oasis.opendocument.presentation", "application/rtf", "text/rtf", "text/plain", "application/octet-stream", "application/zip"];
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype ? file.mimetype.toLowerCase() : '';

    const extValid = allowedTypes.includes(ext);
    const mimeValid = allowedMimeTypes.includes(mimeType);
    const startsWithImage = mimeType.startsWith('image/');
    const isPdf = mimeType === 'application/pdf' || ext === '.pdf';

    const isPublicationFile = file.fieldname === "publicationFile";
    const publicationMimesByExtension = {
      ".pdf": ["application/pdf", "application/octet-stream"],
      ".doc": ["application/msword", "application/octet-stream"],
      ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip", "application/x-zip-compressed", "application/octet-stream"],
      ".ppt": ["application/vnd.ms-powerpoint", "application/octet-stream"],
      ".pptx": ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/zip", "application/x-zip-compressed", "application/octet-stream"],
      ".odt": ["application/vnd.oasis.opendocument.text", "application/zip", "application/x-zip-compressed", "application/octet-stream"],
      ".odp": ["application/vnd.oasis.opendocument.presentation", "application/zip", "application/x-zip-compressed", "application/octet-stream"],
      ".rtf": ["application/rtf", "text/rtf", "application/octet-stream"],
      ".txt": ["text/plain", "application/octet-stream"],
      ".png": ["image/png", "application/octet-stream"],
      ".jpg": ["image/jpeg", "image/jpg", "application/octet-stream"],
      ".jpeg": ["image/jpeg", "image/jpg", "application/octet-stream"],
    };
    const publicationFileValid = Boolean(publicationMimesByExtension[ext]?.includes(mimeType));
    // Publication attachments use a strict extension and MIME allowlist.
    if (isPublicationFile ? publicationFileValid : (extValid || mimeValid || startsWithImage || isPdf)) {
      cb(null, true);
    } else {
      console.log('File rejected:', { originalname: file.originalname, ext, mimeType });
      cb(new Error(`Допустимі формати: зображення, PDF, DOC, DOCX, PPT, PPTX, ODT, ODP, RTF, TXT. Отримано: ${ext} (${mimeType})`));
    }
  },
});

// PostgreSQL connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET;
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const REMEMBER_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const secureEqual = (a, b) => {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};
const signSession = (payload) => {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
};
app.use(express.json({ limit: "10mb" }));
function isAdminAuthenticated(req) {
  if (!SESSION_SECRET) return false;
  const token = (req.headers.cookie || "").split(";").map((part) => part.trim()).find((part) => part.startsWith("admin_session="))?.slice("admin_session=".length);
  if (!token) return false;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return false;
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(encoded).digest("base64url");
  if (!secureEqual(signature, expected)) return false;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString());
    return payload.exp > Math.floor(Date.now() / 1000);
  } catch { return false; }
}
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
app.post("/api/admin/login", loginLimiter, (req, res) => {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !SESSION_SECRET) {
    return res.status(503).json({ error: "Адмінку не налаштовано. Додайте ADMIN_EMAIL, ADMIN_PASSWORD і SESSION_SECRET у .env." });
  }
  const emailMatches = secureEqual(String(req.body.email || "").trim().toLowerCase(), ADMIN_EMAIL.toLowerCase());
  const passwordMatches = secureEqual(req.body.password, ADMIN_PASSWORD);
  if (!emailMatches || !passwordMatches) return res.status(401).json({ error: "Невірна пошта або пароль" });
  const sessionTtlSeconds = req.body.remember === true ? REMEMBER_SESSION_TTL_SECONDS : SESSION_TTL_SECONDS;
  const token = signSession({ exp: Math.floor(Date.now() / 1000) + sessionTtlSeconds });
  res.cookie("admin_session", token, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", maxAge: sessionTtlSeconds * 1000, path: "/" });
  res.json({ ok: true });
});
app.get("/api/admin/session", (req, res) => res.json({ authenticated: isAdminAuthenticated(req) }));
app.post("/api/admin/logout", (req, res) => {
  res.clearCookie("admin_session", { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/" });
  res.json({ ok: true });
});
app.use("/api/admin", (req, res, next) => {
  if (isAdminAuthenticated(req)) return next();
  res.status(401).json({ error: "Потрібно увійти до адмін-панелі" });
});

async function ensureAwardsSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS awards (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      organization VARCHAR(255) NOT NULL,
      place VARCHAR(100) NOT NULL DEFAULT 'Учасник',
      date DATE NOT NULL,
      description TEXT,
      image TEXT,
      award_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    ALTER TABLE awards
      ADD COLUMN IF NOT EXISTS place VARCHAR(100) NOT NULL DEFAULT 'Учасник',
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS image TEXT,
      ADD COLUMN IF NOT EXISTS award_url TEXT
  `);
}

async function ensurePortfolioSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      category VARCHAR(50) NOT NULL,
      image TEXT,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      tech TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      github TEXT,
      live_demo TEXT,
      project_type VARCHAR(30) NOT NULL DEFAULT 'engineering',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query("ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type VARCHAR(30) NOT NULL DEFAULT 'engineering'");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS testimonials (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      position VARCHAR(200) NOT NULL,
      image TEXT,
      text TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      date DATE NOT NULL,
      approved BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
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
    )
  `);

  const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM projects");
  if (rows[0].count === 0) {
    const projects = JSON.parse(await fs.readFile(path.join(__dirname, "public", "projects.json"), "utf8"));
    for (const project of projects) {
      await pool.query(
        `INSERT INTO projects (category, image, title, description, tech, github, live_demo)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [project.category, project.image || null, project.title, project.description, project.tech || [], project.github || null, project.live_demo || null]
      );
    }
    console.log(`✅ Додано початкові проєкти: ${projects.length}`);
  }
}

async function ensureBuilderOrdersSchema() {
  await pool.query(`
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
    )
  `);
}

async function ensureAchievementsSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS achievements (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      type VARCHAR(100) NOT NULL DEFAULT 'Конференція',
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
    )
  `);
  await pool.query(`
    ALTER TABLE achievements
      ADD COLUMN IF NOT EXISTS year INTEGER,
      ADD COLUMN IF NOT EXISTS rank INTEGER,
      ADD COLUMN IF NOT EXISTS result TEXT,
      ADD COLUMN IF NOT EXISTS category VARCHAR(100),
      ADD COLUMN IF NOT EXISTS organization TEXT,
      ADD COLUMN IF NOT EXISTS proof_url TEXT,
      ADD COLUMN IF NOT EXISTS proof_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      ADD COLUMN IF NOT EXISTS highlight TEXT,
      ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS achievement_count INTEGER NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS source_key TEXT
  `);
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_achievements_source_key ON achievements(source_key) WHERE source_key IS NOT NULL");
}

async function ensurePublicationsSchema() {
  await pool.query(`
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
    )
  `);
  await pool.query(`
    ALTER TABLE publications
      ADD COLUMN IF NOT EXISTS work_type VARCHAR(40) NOT NULL DEFAULT 'article',
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS authors TEXT,
      ADD COLUMN IF NOT EXISTS organization TEXT,
      ADD COLUMN IF NOT EXISTS event_name TEXT,
      ADD COLUMN IF NOT EXISTS publication_date DATE,
      ADD COLUMN IF NOT EXISTS file_path TEXT,
      ADD COLUMN IF NOT EXISTS file_name TEXT,
      ADD COLUMN IF NOT EXISTS file_mime TEXT,
      ADD COLUMN IF NOT EXISTS external_url TEXT,
      ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  `);
}

async function removePublicationUpload(filePath) {
  if (typeof filePath !== "string" || !filePath.startsWith("/uploads/publications/")) return;
  const fileName = path.basename(filePath);
  if (!fileName || fileName === "." || fileName === "..") return;
  try {
    await fs.unlink(path.join(publicationUploadPath, fileName));
  } catch (error) {
    if (error.code !== "ENOENT") console.error("Не вдалося прибрати файл публікації:", error);
  }
}

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

// Public API for achievements
app.get("/api/achievements", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM achievements
      ORDER BY COALESCE(year, EXTRACT(YEAR FROM date)::INTEGER) DESC, rank ASC NULLS LAST, id ASC`);
    res.json(result.rows.map((achievement) => ({
      ...achievement,
      year: achievement.year || new Date(achievement.date).getUTCFullYear(),
      category: achievement.category || achievement.type,
      result: achievement.result || achievement.type,
      proofUrl: achievement.proof_url || achievement.achievement_url || "",
      proofUrls: achievement.proof_urls?.length ? achievement.proof_urls : (achievement.proof_url ? [achievement.proof_url] : []),
      highlight: achievement.highlight || achievement.description || "",
      count: achievement.achievement_count || 1,
    })));
  } catch (error) {
    console.error("Помилка при отриманні досягнень:", error);
    res.status(500).json({ error: "Не вдалося отримати досягнення" });
  }
});

const publicationTypes = new Set(["research", "article", "conference", "other"]);
const normalizePublicationType = (value) => publicationTypes.has(value) ? value : "other";
const normalizeExternalUrl = (value) => {
  const text = String(value || "").trim();
  if (!text) return null;
  try {
    const parsed = new URL(text);
    return ["https:", "http:"].includes(parsed.protocol) ? parsed.toString() : null;
  } catch { return null; }
};

app.get("/api/publications", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM publications ORDER BY publication_date DESC NULLS LAST, id DESC");
    res.json(result.rows);
  } catch (error) {
    console.error("Помилка при отриманні наукових матеріалів:", error);
    res.status(500).json({ error: "Не вдалося отримати матеріали" });
  }
});

app.get("/api/admin/publications", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM publications ORDER BY publication_date DESC NULLS LAST, id DESC");
    res.json(result.rows);
  } catch (error) {
    console.error("Помилка при отриманні наукових матеріалів:", error);
    res.status(500).json({ error: "Не вдалося отримати матеріали" });
  }
});

app.post("/api/admin/publications", upload.single("publicationFile"), async (req, res) => {
  try {
    const { title, description, authors, organization, event_name, publication_date, external_url, featured } = req.body;
    const cleanTitle = String(title || "").trim();
    if (!cleanTitle) {
      if (req.file) await removePublicationUpload(`/uploads/publications/${req.file.filename}`);
      return res.status(400).json({ error: "Вкажіть назву матеріалу" });
    }
    const cleanUrl = normalizeExternalUrl(external_url);
    if (external_url && !cleanUrl) {
      if (req.file) await removePublicationUpload(`/uploads/publications/${req.file.filename}`);
      return res.status(400).json({ error: "Посилання має починатися з http:// або https://" });
    }
    if (!req.file && !cleanUrl) {
      return res.status(400).json({ error: "Прикріпіть файл матеріалу або додайте DOI / посилання на онлайн-версію" });
    }
    const dateValue = String(publication_date || "").trim();
    if (dateValue && (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || Number.isNaN(Date.parse(dateValue)))) {
      if (req.file) await removePublicationUpload(`/uploads/publications/${req.file.filename}`);
      return res.status(400).json({ error: "Вкажіть коректну дату" });
    }
    const filePath = req.file ? `/uploads/publications/${req.file.filename}` : null;
    const result = await pool.query(
      `INSERT INTO publications (title, work_type, description, authors, organization, event_name, publication_date, file_path, file_name, file_mime, external_url, featured)
       VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, '')::date, $8, $9, $10, $11, $12) RETURNING *`,
      [cleanTitle, normalizePublicationType(req.body.work_type), description || null, authors || null, organization || null, event_name || null, dateValue, filePath, req.file?.originalname || null, req.file?.mimetype || null, cleanUrl, featured === "true"]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (req.file) await removePublicationUpload(`/uploads/publications/${req.file.filename}`);
    console.error("Помилка при додаванні матеріалу:", error);
    res.status(500).json({ error: "Не вдалося додати матеріал" });
  }
});

app.put("/api/admin/publications/:id", upload.single("publicationFile"), async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await pool.query("SELECT * FROM publications WHERE id = $1", [id]);
    if (!existing.rowCount) {
      if (req.file) await removePublicationUpload(`/uploads/publications/${req.file.filename}`);
      return res.status(404).json({ error: "Матеріал не знайдено" });
    }
    const { title, description, authors, organization, event_name, publication_date, external_url, featured, remove_file } = req.body;
    const cleanTitle = String(title || "").trim();
    if (!cleanTitle) {
      if (req.file) await removePublicationUpload(`/uploads/publications/${req.file.filename}`);
      return res.status(400).json({ error: "Вкажіть назву матеріалу" });
    }
    const cleanUrl = normalizeExternalUrl(external_url);
    if (external_url && !cleanUrl) {
      if (req.file) await removePublicationUpload(`/uploads/publications/${req.file.filename}`);
      return res.status(400).json({ error: "Посилання має починатися з http:// або https://" });
    }
    const hasExistingFile = Boolean(existing.rows[0].file_path) && remove_file !== "true" && !req.file;
    if (!req.file && !cleanUrl && !hasExistingFile) {
      return res.status(400).json({ error: "Прикріпіть файл матеріалу або додайте DOI / посилання на онлайн-версію" });
    }
    const dateValue = String(publication_date || "").trim();
    if (dateValue && (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || Number.isNaN(Date.parse(dateValue)))) {
      if (req.file) await removePublicationUpload(`/uploads/publications/${req.file.filename}`);
      return res.status(400).json({ error: "Вкажіть коректну дату" });
    }
    const oldFilePath = existing.rows[0].file_path;
    const removeOldFile = Boolean(req.file) || remove_file === "true";
    const filePath = req.file ? `/uploads/publications/${req.file.filename}` : (removeOldFile ? null : oldFilePath);
    const result = await pool.query(
      `UPDATE publications SET title = $1, work_type = $2, description = $3, authors = $4, organization = $5, event_name = $6,
       publication_date = NULLIF($7, '')::date, file_path = $8, file_name = $9, file_mime = $10, external_url = $11, featured = $12, updated_at = CURRENT_TIMESTAMP
       WHERE id = $13 RETURNING *`,
      [cleanTitle, normalizePublicationType(req.body.work_type), description || null, authors || null, organization || null, event_name || null, dateValue, filePath,
        req.file?.originalname || (removeOldFile ? null : existing.rows[0].file_name), req.file?.mimetype || (removeOldFile ? null : existing.rows[0].file_mime), cleanUrl, featured === "true", id]
    );
    if (removeOldFile) await removePublicationUpload(oldFilePath);
    res.json(result.rows[0]);
  } catch (error) {
    if (req.file) await removePublicationUpload(`/uploads/publications/${req.file.filename}`);
    console.error("Помилка при оновленні матеріалу:", error);
    res.status(500).json({ error: "Не вдалося оновити матеріал" });
  }
});

app.delete("/api/admin/publications/:id", async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM publications WHERE id = $1 RETURNING file_path", [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: "Матеріал не знайдено" });
    await removePublicationUpload(result.rows[0].file_path);
    res.json({ message: "Матеріал видалено" });
  } catch (error) {
    console.error("Помилка при видаленні матеріалу:", error);
    res.status(500).json({ error: "Не вдалося видалити матеріал" });
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
    const { category, image, title, description, tech, github, live_demo, project_type } = req.body;
    const result = await pool.query(
      `INSERT INTO projects (category, image, title, description, tech, github, live_demo, project_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [category, image, title, description, tech, github, live_demo, project_type === "qa" ? "qa" : "engineering"]
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
    const { category, image, title, description, tech, github, live_demo, project_type } = req.body;
    const result = await pool.query(
      `UPDATE projects SET category = $1, image = $2, title = $3, description = $4, tech = $5, github = $6, live_demo = $7, project_type = $8
       WHERE id = $9 RETURNING *`,
      [category, image, title, description, tech, github, live_demo, project_type === "qa" ? "qa" : "engineering", id]
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

app.post("/api/admin/certificates", upload.single("certificateImage"), async (req, res) => {
  try {
    const { title, issuer, issue_date, expiry_date, credential_id, credential_url, image, description } = req.body;
    const imagePath = req.file
      ? `/uploads/certificates/${req.file.filename}`
      : image || null;

    const result = await pool.query(
      `INSERT INTO certificates (title, issuer, issue_date, expiry_date, credential_id, credential_url, image, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [title, issuer, issue_date, expiry_date, credential_id, credential_url, imagePath, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Помилка при додаванні сертифіката:", error);
    res.status(500).json({ error: "Не вдалося додати сертифікат" });
  }
});

app.put("/api/admin/certificates/:id", upload.single("certificateImage"), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, issuer, issue_date, expiry_date, credential_id, credential_url, image, description } = req.body;
    const existing = await pool.query("SELECT image FROM certificates WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Сертифікат не знайдено" });
    }

    const imagePath = req.file
      ? `/uploads/certificates/${req.file.filename}`
      : image || existing.rows[0].image;

    const result = await pool.query(
      `UPDATE certificates SET title = $1, issuer = $2, issue_date = $3, expiry_date = $4, credential_id = $5, credential_url = $6, image = $7, description = $8
       WHERE id = $9 RETURNING *`,
      [title, issuer, issue_date, expiry_date, credential_id, credential_url, imagePath, description, id]
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

app.post("/api/admin/awards", upload.single("awardImage"), async (req, res) => {
  try {
    const { title, organization, place, date, description, image, award_url } = req.body;
    const imagePath = req.file
      ? `/uploads/awards/${req.file.filename}`
      : image || null;
    const result = await pool.query(
      `INSERT INTO awards (title, organization, place, date, description, image, award_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [title, organization, place, date, description, imagePath, award_url || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Помилка при додаванні нагороди:", error);
    res.status(500).json({ error: "Не вдалося додати нагороду" });
  }
});

app.put("/api/admin/awards/:id", upload.single("awardImage"), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, organization, place, date, description, image, award_url } = req.body;
    const existing = await pool.query("SELECT image FROM awards WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Нагороду не знайдено" });
    }

    const imagePath = req.file
      ? `/uploads/awards/${req.file.filename}`
      : image || existing.rows[0].image;
    const result = await pool.query(
      `UPDATE awards SET title = $1, organization = $2, place = $3, date = $4, description = $5, image = $6, award_url = $7
       WHERE id = $8 RETURNING *`,
      [title, organization, place, date, description, imagePath, award_url || null, id]
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

// Achievements Admin API
app.get("/api/admin/achievements", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM achievements
      ORDER BY COALESCE(year, EXTRACT(YEAR FROM date)::INTEGER) DESC, rank ASC NULLS LAST, id ASC`);
    res.json(result.rows);
  } catch (error) {
    console.error("Помилка при отриманні досягнень:", error);
    res.status(500).json({ error: "Не вдалося отримати досягнення" });
  }
});

app.post("/api/admin/achievements", upload.single("achievementImage"), async (req, res) => {
  try {
    const { title, category, type, year, rank, result: achievementResult, organization, proof_url, proof_urls, highlight, featured, count } = req.body;
    const achievementYear = Number(year);
    if (!Number.isInteger(achievementYear) || achievementYear < 1900 || achievementYear > 2200) {
      return res.status(400).json({ error: "Вкажіть коректний рік досягнення" });
    }
    const proofList = String(proof_urls || "").split(/\r?\n/).map((url) => url.trim()).filter(Boolean);
    const rankValue = rank === "" || rank == null ? null : Number(rank);
    const categoryValue = category || type || "Досягнення";
    const imagePath = req.file
      ? `/uploads/achievements/${req.file.filename}`
      : req.body.image || null;

    const result = await pool.query(
      `INSERT INTO achievements
        (title, type, date, description, image, achievement_url, year, rank, result, category, organization, proof_url, proof_urls, highlight, featured, achievement_count)
       VALUES ($1, $2, make_date($3, 1, 1), $4, $5, $6, $3, $7, $8, $2, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [title, categoryValue, achievementYear, highlight || null, imagePath, proofList[0] || proof_url || null, rankValue, achievementResult || (rankValue ? `${rankValue} місце` : "Відзнака"), organization || null, proofList[0] || proof_url || null, proofList, highlight || null, featured === "true" || featured === true, Math.max(1, Number(count) || 1)]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Помилка при додаванні досягнення:", error);
    res.status(500).json({ error: "Не вдалося додати досягнення" });
  }
});

app.put("/api/admin/achievements/:id", upload.single("achievementImage"), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, type, year, rank, result: achievementResult, organization, proof_url, proof_urls, highlight, featured, count } = req.body;
    const achievementYear = Number(year);
    if (!Number.isInteger(achievementYear) || achievementYear < 1900 || achievementYear > 2200) {
      return res.status(400).json({ error: "Вкажіть коректний рік досягнення" });
    }
    const proofList = String(proof_urls || "").split(/\r?\n/).map((url) => url.trim()).filter(Boolean);
    const rankValue = rank === "" || rank == null ? null : Number(rank);
    const categoryValue = category || type || "Досягнення";
    const existing = await pool.query("SELECT image FROM achievements WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Досягнення не знайдено" });
    }

    const imagePath = req.file
      ? `/uploads/achievements/${req.file.filename}`
      : req.body.image || existing.rows[0].image;

    const result = await pool.query(
      `UPDATE achievements SET
        title = $1, type = $2, date = make_date($3, 1, 1), description = $4, image = $5,
        achievement_url = $6, year = $3, rank = $7, result = $8, category = $2,
        organization = $9, proof_url = $10, proof_urls = $11, highlight = $12,
        featured = $13, achievement_count = $14
       WHERE id = $15 RETURNING *`,
      [title, categoryValue, achievementYear, highlight || null, imagePath, proofList[0] || proof_url || null, rankValue, achievementResult || (rankValue ? `${rankValue} місце` : "Відзнака"), organization || null, proofList[0] || proof_url || null, proofList, highlight || null, featured === "true" || featured === true, Math.max(1, Number(count) || 1), id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Помилка при оновленні досягнення:", error);
    res.status(500).json({ error: "Не вдалося оновити досягнення" });
  }
});

app.delete("/api/admin/achievements/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM achievements WHERE id = $1", [id]);
    res.json({ message: "Досягнення видалено" });
  } catch (error) {
    console.error("Помилка при видаленні досягнення:", error);
    res.status(500).json({ error: "Не вдалося видалити досягнення" });
  }
});

// Builder Orders API
app.post("/api/builder-orders", async (req, res) => {
  try {
    const { siteType, designStyle, selectedOptions, basePrice, optionsPrice, totalPrice, notes, clientEmail, clientPhone } = req.body;
    
    if (!siteType || totalPrice === undefined) {
      return res.status(400).json({ error: "Недостатньо даних" });
    }

    const result = await pool.query(
      `INSERT INTO builder_orders (site_type, design_style, selected_options, base_price, options_price, total_price, notes, client_email, client_phone, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'new')
       RETURNING *`,
      [siteType, designStyle, selectedOptions || [], basePrice, optionsPrice, totalPrice, notes, clientEmail, clientPhone]
    );

    res.status(201).json({ message: "Замовлення створено", order: result.rows[0] });
  } catch (error) {
    console.error("Помилка при створенні замовлення:", error);
    res.status(500).json({ error: "Не вдалося створити замовлення" });
  }
});

app.get("/api/admin/builder-orders", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM builder_orders ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Помилка при отриманні замовлень:", error);
    res.status(500).json({ error: "Не вдалося отримати замовлення" });
  }
});

app.get("/api/admin/builder-orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "SELECT * FROM builder_orders WHERE id = $1",
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Замовлення не знайдено" });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Помилка при отриманні замовлення:", error);
    res.status(500).json({ error: "Не вдалося отримати замовлення" });
  }
});

app.put("/api/admin/builder-orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const result = await pool.query(
      `UPDATE builder_orders 
       SET status = COALESCE($1, status), 
           notes = COALESCE($2, notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [status, notes, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Замовлення не знайдено" });
    }

    res.json({ message: "Замовлення оновлено", order: result.rows[0] });
  } catch (error) {
    console.error("Помилка при оновленні замовлення:", error);
    res.status(500).json({ error: "Не вдалося оновити замовлення" });
  }
});

app.delete("/api/admin/builder-orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM builder_orders WHERE id = $1", [id]);
    res.json({ message: "Замовлення видалено" });
  } catch (error) {
    console.error("Помилка при видаленні замовлення:", error);
    res.status(500).json({ error: "Не вдалося видалити замовлення" });
  }
});

// Middleware для обробки помилок
app.use((error, req, res, next) => {
  console.error("Необроблена помилка:", error);
  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE" ? "Файл перевищує ліміт 30 МБ." : "Не вдалося обробити завантажений файл.";
    return res.status(400).json({ error: message });
  }
  if (String(error.message || "").startsWith("Допустимі формати:")) {
    return res.status(400).json({ error: error.message });
  }
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
    if (!process.env.DATABASE_URL) {
      throw new Error("Не задано DATABASE_URL. Додайте новий рядок підключення PostgreSQL у .env; без нього pg пробує localhost:5432.");
    }
    await ensurePortfolioSchema();
    await ensureAwardsSchema();
    await ensureBuilderOrdersSchema();
    await ensureAchievementsSchema();
    await ensurePublicationsSchema();
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
