const revealItems = document.querySelectorAll(".reveal");

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
      }
    });
  },
  { threshold: 0.2 }
);

revealItems.forEach((item) => observer.observe(item));

const pageName = window.location.pathname.split("/").pop() || "index.html";
const navLinks = document.querySelectorAll(".nav-links a");

navLinks.forEach((link) => {
  const href = link.getAttribute("href");
  if (href === pageName || (pageName === "" && href === "index.html")) {
    link.classList.add("is-active");
  }
});

const siteHeader = document.querySelector(".site-header");
const navWrap = document.querySelector(".nav-wrap");
const navActionLinks = document.querySelectorAll(".nav-actions a");

if (siteHeader && navWrap) {
  const navToggle = document.createElement("button");
  navToggle.className = "nav-toggle";
  navToggle.setAttribute("type", "button");
  navToggle.setAttribute("aria-label", "Toggle menu");
  navToggle.setAttribute("aria-expanded", "false");
  navToggle.innerHTML =
    '<span class="nav-toggle-line"></span><span class="nav-toggle-line"></span><span class="nav-toggle-line"></span>';
  navWrap.appendChild(navToggle);

  const navBackdrop = document.createElement("div");
  navBackdrop.className = "nav-backdrop";
  siteHeader.appendChild(navBackdrop);

  const setMenuState = (open) => {
    siteHeader.classList.toggle("is-open", open);
    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.classList.toggle("nav-locked", open);
  };

  const closeMenu = () => setMenuState(false);

  navToggle.addEventListener("click", () => {
    setMenuState(!siteHeader.classList.contains("is-open"));
  });

  navBackdrop.addEventListener("click", closeMenu);

  [...navLinks, ...navActionLinks].forEach((link) =>
    link.addEventListener("click", closeMenu)
  );

  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });
}

const allowMotionCursor =
  window.matchMedia("(prefers-reduced-motion: no-preference)").matches &&
  window.matchMedia("(pointer: fine)").matches;

if (allowMotionCursor) {
  const cursor = document.createElement("div");
  cursor.className = "motion-cursor";
  document.body.appendChild(cursor);
  document.body.classList.add("custom-cursor-active");

  document.addEventListener("mousemove", (event) => {
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
  });

  const interactiveElements = document.querySelectorAll(
    "a, button, .tilt-card, .gallery-grid img"
  );

  interactiveElements.forEach((element) => {
    element.addEventListener("mouseenter", () => {
      cursor.classList.add("is-hovering");
    });
    element.addEventListener("mouseleave", () => {
      cursor.classList.remove("is-hovering");
    });
  });

  cursor.style.left = `${window.innerWidth / 2}px`;
  cursor.style.top = `${window.innerHeight / 2}px`;
}

const allowScrollFx = window.matchMedia(
  "(prefers-reduced-motion: no-preference)"
).matches;

if (allowScrollFx) {
  const scroll3dItems = document.querySelectorAll(
    ".hero-stock-image, .product-simple-card, .service-card, .about-stock-image"
  );

  scroll3dItems.forEach((item) => item.classList.add("scroll-3d"));

  let ticking = false;

  const updateScroll3d = () => {
    const viewportCenter = window.innerHeight / 2;

    scroll3dItems.forEach((item) => {
      const rect = item.getBoundingClientRect();
      const elementCenter = rect.top + rect.height / 2;
      const distance = (elementCenter - viewportCenter) / window.innerHeight;
      const clamped = Math.max(-1, Math.min(1, distance));

      const rotateX = clamped * -12;
      const rotateY = clamped * 7;
      const translateZ = (1 - Math.abs(clamped)) * 22;

      item.style.setProperty("--rx", `${rotateX.toFixed(2)}deg`);
      item.style.setProperty("--ry", `${rotateY.toFixed(2)}deg`);
      item.style.setProperty("--tz", `${translateZ.toFixed(2)}px`);
    });

    ticking = false;
  };

  const onScroll = () => {
    if (!ticking) {
      requestAnimationFrame(updateScroll3d);
      ticking = true;
    }
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();

  const allowWeightedTilt = window.matchMedia("(pointer: fine)").matches;

  if (allowWeightedTilt) {
    scroll3dItems.forEach((item) => {
      let currentX = 0;
      let currentY = 0;
      let currentZ = 0;
      let targetX = 0;
      let targetY = 0;
      let targetZ = 0;
      let rafId = 0;

      const animateTilt = () => {
        currentX += (targetX - currentX) * 0.14;
        currentY += (targetY - currentY) * 0.14;
        currentZ += (targetZ - currentZ) * 0.14;

        item.style.setProperty("--hx", `${currentX.toFixed(2)}deg`);
        item.style.setProperty("--hy", `${currentY.toFixed(2)}deg`);
        item.style.setProperty("--tzh", `${currentZ.toFixed(2)}px`);

        const stillMoving =
          Math.abs(targetX - currentX) > 0.05 ||
          Math.abs(targetY - currentY) > 0.05 ||
          Math.abs(targetZ - currentZ) > 0.08;

        if (stillMoving) {
          rafId = requestAnimationFrame(animateTilt);
        } else {
          rafId = 0;
        }
      };

      const startTiltAnimation = () => {
        if (!rafId) {
          rafId = requestAnimationFrame(animateTilt);
        }
      };

      item.addEventListener("mouseenter", () => {
        item.classList.add("is-tilting");
        targetZ = 16;
        startTiltAnimation();
      });

      item.addEventListener("mousemove", (event) => {
        const rect = item.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width - 0.5;
        const py = (event.clientY - rect.top) / rect.height - 0.5;

        // Weighted "fall towards cursor" behavior.
        targetY = px * 14;
        targetX = py * -12;
        targetZ = 18;
        startTiltAnimation();
      });

      item.addEventListener("mouseleave", () => {
        item.classList.remove("is-tilting");
        targetX = 0;
        targetY = 0;
        targetZ = 0;
        startTiltAnimation();
      });
    });
  }
}

const initImageCarousels = () => {
  const galleries = document.querySelectorAll(".role-gallery, .workflow-gallery");

  galleries.forEach((gallery) => {
    if (gallery.dataset.carouselReady === "true") return;
    const slides = Array.from(gallery.querySelectorAll("img"));
    if (slides.length <= 1) return;

    gallery.dataset.carouselReady = "true";
    gallery.classList.add("image-carousel-track");
    slides.forEach((slide) => slide.classList.add("carousel-slide"));

    const viewport = document.createElement("div");
    viewport.className = "image-carousel-viewport";
    gallery.parentNode.insertBefore(viewport, gallery);
    viewport.appendChild(gallery);

    const carousel = document.createElement("div");
    carousel.className = "image-carousel";
    viewport.parentNode.insertBefore(carousel, viewport);
    carousel.appendChild(viewport);

    const controls = document.createElement("div");
    controls.className = "image-carousel-controls";
    controls.innerHTML =
      '<button type="button" class="carousel-btn" aria-label="Previous image">&#8249;</button><button type="button" class="carousel-btn" aria-label="Next image">&#8250;</button>';
    carousel.appendChild(controls);

    let index = 0;
    const [prevBtn, nextBtn] = controls.querySelectorAll(".carousel-btn");

    const update = () => {
      gallery.style.transform = `translateX(-${index * 100}%)`;
    };

    prevBtn.addEventListener("click", () => {
      index = index === 0 ? slides.length - 1 : index - 1;
      update();
    });

    nextBtn.addEventListener("click", () => {
      index = index === slides.length - 1 ? 0 : index + 1;
      update();
    });

    let touchStartX = 0;
    let touchEndX = 0;

    viewport.addEventListener(
      "touchstart",
      (event) => {
        touchStartX = event.changedTouches[0].clientX;
      },
      { passive: true }
    );

    viewport.addEventListener(
      "touchend",
      (event) => {
        touchEndX = event.changedTouches[0].clientX;
        const delta = touchStartX - touchEndX;
        if (Math.abs(delta) < 30) return;
        if (delta > 0) {
          index = index === slides.length - 1 ? 0 : index + 1;
        } else {
          index = index === 0 ? slides.length - 1 : index - 1;
        }
        update();
      },
      { passive: true }
    );

    update();
  });
};

initImageCarousels();
