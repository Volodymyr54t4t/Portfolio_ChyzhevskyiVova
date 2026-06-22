// DOM Elements
const burger = document.querySelector(".burger");
const nav = document.querySelector(".nav-links");
const navLinks = document.querySelectorAll(".nav-links li");
const themeSwitch = document.querySelector(".theme-switch");
const backToTopButton = document.querySelector(".back-to-top");
const projectsGrid = document.querySelector(".projects-grid");
const filterButtons = document.querySelectorAll(".filter-btn");
const contactForm = document.getElementById("contactForm");
const formStatus = document.getElementById("formStatus");
const toast = document.getElementById("toast");
// const testimonialModal = document.getElementById("testimonialModal"); // REMOVED
// const openTestimonialFormBtn = document.getElementById("openTestimonialForm"); // REMOVED
// const closeModalBtn = document.querySelector(".close-modal"); // REMOVED
const testimonialForm = document.getElementById("testimonialForm");
const testimonialSlider = document.querySelector(".testimonials-slider");
const testimonialDots = document.querySelector(".testimonial-dots");
const prevBtn = document.querySelector(".testimonial-prev");
const nextBtn = document.querySelector(".testimonial-next");
const pwaInstallPrompt = document.getElementById("pwaInstallPrompt");
const pwaInstallBtn = document.getElementById("pwaInstallBtn");
const pwaCloseBtn = document.getElementById("pwaCloseBtn");

// Global Variables
let currentTestimonial = 0;
let testimonials = [];
let projects = [];
let deferredPrompt;

// Theme Toggle
const toggleTheme = () => {
  document.body.classList.toggle("dark-theme");

  // Update theme icon
  if (document.body.classList.contains("dark-theme")) {
    themeSwitch.innerHTML = '<i class="fas fa-sun"></i>';
    localStorage.setItem("theme", "dark");
  } else {
    themeSwitch.innerHTML = '<i class="fas fa-moon"></i>';
    localStorage.setItem("theme", "light");
  }
};

// Check for saved theme preference
const checkTheme = () => {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark-theme");
    themeSwitch.innerHTML = '<i class="fas fa-sun"></i>';
  }
};

// Navigation
const toggleNav = () => {
  // Toggle Nav
  nav.classList.toggle("active");

  // Animate Links
  navLinks.forEach((link, index) => {
    if (link.style.animation) {
      link.style.animation = "";
    } else {
      link.style.animation = `navLinkFade 0.5s ease forwards ${
        index / 7 + 0.3
      }s`;
    }
  });

  // Burger Animation
  burger.classList.toggle("toggle");
};

// Close menu when clicking on a link
const closeNavOnClick = () => {
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("active");
      burger.classList.remove("toggle");

      navLinks.forEach((link) => {
        link.style.animation = "";
      });
    });
  });
};

// Sticky Header
const handleScroll = () => {
  const header = document.querySelector("header");
  header.classList.toggle("sticky", window.scrollY > 0);

  // Back to Top Button
  if (window.pageYOffset > 300) {
    backToTopButton.classList.add("show");
  } else {
    backToTopButton.classList.remove("show");
  }
};

// Projects rendering
const renderProjects = (filter = "all") => {
  if (!projectsGrid) return;

  const filteredProjects =
    filter === "all"
      ? projects
      : projects.filter((project) => project.category === filter);

  projectsGrid.innerHTML = filteredProjects
    .map((project) => {
      const techTags = project.tech
        .map((tech) => `<span>${tech}</span>`)
        .join("");

      return `
        <div class="project-card">
          <div class="project-info">
            <h3>${project.title}</h3>
            <p>${project.description}</p>
            <div class="project-tech">
              ${techTags}
            </div>
            <div class="project-links">
              ${project.github ? `<a href="${project.github}" target="_blank" class="btn small-btn secondary-btn">GitHub</a>` : ""}
            </div>
          </div>
        </div>`;
    })
    .join("");
};

const filterProjects = () => {
  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      filterButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      const filter = button.getAttribute("data-filter");
      renderProjects(filter);
    });
  });
};

const fetchProjects = async () => {
  try {
    const response = await fetch("/api/projects");
    if (!response.ok) {
      throw new Error(`Не вдалося завантажити проєкти: ${response.status}`);
    }
    projects = await response.json();
    renderProjects();
  } catch (error) {
    console.error("Error loading project data:", error);
    if (projectsGrid) {
      projectsGrid.innerHTML = `<div class="project-error"><p>Не вдалося завантажити проєкти.</p></div>`;
    }
  }
};

// Testimonials
const fetchTestimonials = async () => {
  try {
    const response = await fetch("/api/testimonials");
    if (!response.ok) {
      throw new Error(`Не вдалося завантажити відгуки: ${response.status}`);
    }
    testimonials = await response.json();
    renderTestimonials();
  } catch (error) {
    console.error("Error fetching testimonials:", error);
    testimonialSlider.innerHTML = `
            <div class="testimonial-error">
                <i class="fas fa-exclamation-circle"></i>
                <p>Не вдалося завантажити відгуки. Спробуйте пізніше.</p>
            </div>
        `;
  }
};

const renderTestimonials = () => {
  // Clear loading state
  testimonialSlider.innerHTML = "";
  testimonialDots.innerHTML = "";

  // Create testimonial cards
  testimonials.forEach((testimonial, index) => {
    // Create testimonial card
    const card = document.createElement("div");
    card.className = `testimonial-card ${index === 0 ? "active" : ""}`;

    // Generate stars based on rating
    let stars = "";
    for (let i = 1; i <= 5; i++) {
      if (i <= testimonial.rating) {
        stars += '<i class="fas fa-star"></i>';
      } else {
        stars += '<i class="far fa-star"></i>';
      }
    }

    // Format date
    const date = new Date(testimonial.date);
    const formattedDate = `${date.getDate()}.${
      date.getMonth() + 1
    }.${date.getFullYear()}`;

    card.innerHTML = `
            <div class="testimonial-img">
                <img src="${testimonial.image}" alt="${testimonial.name}">
            </div>
            <div class="testimonial-content">
                <p>"${testimonial.text}"</p>
                <div class="testimonial-info">
                    <h4>${testimonial.name}</h4>
                    <p>${testimonial.position}</p>
                    <div class="testimonial-rating">${stars}</div>
                    <div class="testimonial-date">${formattedDate}</div>
                </div>
            </div>
        `;

    testimonialSlider.appendChild(card);

    // Create dot
    const dot = document.createElement("span");
    dot.className = `dot ${index === 0 ? "active" : ""}`;
    dot.addEventListener("click", () => {
      showTestimonial(index);
    });

    testimonialDots.appendChild(dot);
  });

  // Set current testimonial
  currentTestimonial = 0;
  // Restart slider when testimonials update
  stopTestimonialSlider();
  startTestimonialSlider();
};

const showTestimonial = (index) => {
  // Get all testimonial cards and dots
  const testimonialCards = document.querySelectorAll(".testimonial-card");
  const dots = document.querySelectorAll(".dot");

  // Hide all testimonials
  testimonialCards.forEach((card) => card.classList.remove("active"));
  dots.forEach((dot) => dot.classList.remove("active"));

  // Show selected testimonial
  testimonialCards[index].classList.add("active");
  dots[index].classList.add("active");

  // Update current testimonial
  currentTestimonial = index;
};

const nextTestimonial = () => {
  const nextIndex = (currentTestimonial + 1) % testimonials.length;
  showTestimonial(nextIndex);
};

const prevTestimonial = () => {
  const prevIndex =
    (currentTestimonial - 1 + testimonials.length) % testimonials.length;
  showTestimonial(prevIndex);
};

// Auto slide testimonials
let testimonialInterval;
const startTestimonialSlider = () => {
  testimonialInterval = setInterval(nextTestimonial, 5000);
};

const stopTestimonialSlider = () => {
  clearInterval(testimonialInterval);
};

// Modal Functions (REMOVED - no longer needed)
// const openModal = () => {
//   testimonialModal.style.display = "block";
//   stopTestimonialSlider();
// };

// const closeModal = () => {
//   testimonialModal.style.display = "none";
//   startTestimonialSlider();
// };

// Close modal when clicking outside (REMOVED - no longer needed)
// window.addEventListener("click", (e) => {
//   if (e.target === testimonialModal) {
//     closeModal();
//   }
// });

// Submit Testimonial (POST to API)
const submitTestimonial = async (e) => {
  e.preventDefault();

  const submitBtn = testimonialForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  // Get form data
  const name = document.getElementById("testimonialName").value.trim();
  const position = document.getElementById("testimonialPosition").value.trim();
  const text = document.getElementById("testimonialText").value.trim();
  const rating = document.querySelector('input[name="rating"]:checked').value;
  const hp = document.getElementById("testimonialHp").value || ""; // honeypot

  try {
    const payload = { name, position, text, rating, hp };

    const res = await fetch('/api/testimonials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Status ${res.status}`);
    }

    const data = await res.json();

    // Inform user that testimonial is submitted and awaiting moderation
    showToast(data.message || 'Відгук надіслано. Очікує на модерацію.');

    // Reset form
    testimonialForm.reset();
  } catch (error) {
    console.error('Помилка при надсиланні відгуку:', error);
    showToast('Не вдалося надіслати відгук. Спробуйте пізніше.');
  } finally {
    submitBtn.disabled = false;
  }
};

// Contact Form
const handleContactForm = (e) => {
  e.preventDefault();

  // Get form values
  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value;
  const subject = document.getElementById("subject").value;
  const message = document.getElementById("message").value;

  // Here you would typically send the form data to a server
  // For demonstration, we'll just log it to the console
  console.log({
    name,
    email,
    subject,
    message,
  });

  // Show success message
  formStatus.className = "form-status success";
  formStatus.textContent =
    "Повідомлення успішно надіслано! Дякую за звернення.";

  // Show toast
  showToast("Повідомлення успішно надіслано!");

  // Reset form
  contactForm.reset();

  // Hide success message after 5 seconds
  setTimeout(() => {
    formStatus.style.display = "none";
  }, 5000);
};

// Toast Notification
const showToast = (message) => {
  const toastMessage = document.querySelector(".toast-message");
  toastMessage.textContent = message;

  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
};

// PWA Install Prompt
window.addEventListener("beforeinstallprompt", (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();

  // Stash the event so it can be triggered later
  deferredPrompt = e;

  // Show the install prompt
  pwaInstallPrompt.classList.add("show");
});

pwaInstallBtn.addEventListener("click", () => {
  // Hide the app provided install prompt
  pwaInstallPrompt.classList.remove("show");

  // Show the browser install prompt
  deferredPrompt.prompt();

  // Wait for the user to respond to the prompt
  deferredPrompt.userChoice.then((choiceResult) => {
    if (choiceResult.outcome === "accepted") {
      console.log("User accepted the install prompt");
      showToast("Дякуємо за встановлення додатку!");
    } else {
      console.log("User dismissed the install prompt");
    }

    // Clear the deferredPrompt variable
    deferredPrompt = null;
  });
});

pwaCloseBtn.addEventListener("click", () => {
  pwaInstallPrompt.classList.remove("show");
});

// Skill animation on scroll
const skillCards = document.querySelectorAll(".skill-card");

const showSkills = () => {
  skillCards.forEach((card) => {
    const cardPosition = card.getBoundingClientRect().top;
    const screenPosition = window.innerHeight / 1.3;

    if (cardPosition < screenPosition) {
      card.style.opacity = 1;
      card.style.transform = "translateY(0)";
    }
  });
};

// Initially set opacity to 0 and transform for animation
skillCards.forEach((card) => {
  card.style.opacity = 0;
  card.style.transform = "translateY(20px)";
  card.style.transition = "opacity 0.5s ease, transform 0.5s ease";
});

// Smooth scrolling for anchor links
const smoothScroll = () => {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();

      const targetId = this.getAttribute("href");
      const targetElement = document.querySelector(targetId);

      if (targetElement) {
        window.scrollTo({
          top: targetElement.offsetTop - 80, // Adjust for header height
          behavior: "smooth",
        });
      }
    });
  });
};

// Initialize
const init = () => {
  // Check theme
  checkTheme();

  // Event Listeners
  themeSwitch.addEventListener("click", toggleTheme);
  burger.addEventListener("click", toggleNav);
  closeNavOnClick();
  window.addEventListener("scroll", handleScroll);
  filterProjects();
  fetchProjects();
  contactForm.addEventListener("submit", handleContactForm);
  // openTestimonialFormBtn.addEventListener("click", openModal); // REMOVED
  // closeModalBtn.addEventListener("click", closeModal); // REMOVED
  testimonialForm.addEventListener("submit", submitTestimonial);
  prevBtn.addEventListener("click", () => {
    prevTestimonial();
    stopTestimonialSlider();
    startTestimonialSlider();
  });
  nextBtn.addEventListener("click", () => {
    nextTestimonial();
    stopTestimonialSlider();
    startTestimonialSlider();
  });

  // Fetch testimonials
  fetchTestimonials();

  // Poll for new approved testimonials every 15 seconds
  setInterval(() => {
    fetchTestimonials();
  }, 15000);

  // Start testimonial slider
  startTestimonialSlider();

  // Listen for scroll to trigger animation
  window.addEventListener("scroll", showSkills);

  // Trigger once on load
  window.addEventListener("load", showSkills);

  // Smooth scrolling
  smoothScroll();
};

// Run initialization
document.addEventListener("DOMContentLoaded", init);
