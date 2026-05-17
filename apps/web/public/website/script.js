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

  const LUMINANCE_THRESHOLD = 0.42;
  const DARK_SURFACE_SELECTOR =
    ".portfolio-design-card, .portfolio-browser-bar, .portfolio-screen-overlay, .portfolio-teaser-domain, .btn-primary, .nav-cta";

  const parseColor = (value) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (trimmed === "transparent") return null;

    const hex = trimmed.match(/^#([0-9a-f]{3,8})$/i);
    if (hex) {
      let h = hex[1];
      if (h.length === 3) {
        h = h
          .split("")
          .map((c) => c + c)
          .join("");
      }
      const int = parseInt(h.slice(0, 6), 16);
      return {
        r: (int >> 16) & 255,
        g: (int >> 8) & 255,
        b: int & 255,
        a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
      };
    }

    const rgb = trimmed.match(/rgba?\(([^)]+)\)/i);
    if (!rgb) return null;
    const parts = rgb[1].split(",").map((part) => part.trim());
    if (parts.length < 3) return null;
    return {
      r: Number(parts[0]),
      g: Number(parts[1]),
      b: Number(parts[2]),
      a: parts[3] !== undefined ? Number(parts[3]) : 1,
    };
  };

  const relativeLuminance = ({ r, g, b }) => {
    const channel = (c) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };

  const averageColorLuminance = (colors) => {
    if (!colors.length) return null;
    let weight = 0;
    let total = 0;
    colors.forEach((color) => {
      const alpha = Number.isFinite(color.a) ? Math.max(0, Math.min(1, color.a)) : 1;
      if (alpha < 0.04) return;
      total += relativeLuminance(color) * alpha;
      weight += alpha;
    });
    return weight ? total / weight : null;
  };

  const colorsFromBackground = (style) => {
    const colors = [];
    const bgColor = parseColor(style.backgroundColor);
    if (bgColor) colors.push(bgColor);

    const bgImage = style.backgroundImage;
    if (bgImage && bgImage !== "none") {
      const matches = bgImage.matchAll(/(#[0-9a-f]{3,8}|rgba?\([^)]+\))/gi);
      for (const match of matches) {
        const parsed = parseColor(match[0]);
        if (parsed) colors.push(parsed);
      }
    }
    return colors;
  };

  const imageSampleCanvas = document.createElement("canvas");
  imageSampleCanvas.width = 1;
  imageSampleCanvas.height = 1;
  const imageSampleCtx = imageSampleCanvas.getContext("2d", { willReadFrequently: true });

  const sampleImageLuminance = (img, clientX, clientY) => {
    if (!img.complete || !img.naturalWidth) return null;
    const rect = img.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      return null;
    }

    const x = ((clientX - rect.left) / rect.width) * img.naturalWidth;
    const y = ((clientY - rect.top) / rect.height) * img.naturalHeight;

    try {
      imageSampleCtx.clearRect(0, 0, 1, 1);
      imageSampleCtx.drawImage(img, x, y, 1, 1, 0, 0, 1, 1);
      const [r, g, b, a] = imageSampleCtx.getImageData(0, 0, 1, 1).data;
      if (a < 12) return null;
      return relativeLuminance({ r, g, b });
    } catch {
      return null;
    }
  };

  const resolveSurfaceTheme = (clientX, clientY) => {
    const stack = document
      .elementsFromPoint(clientX, clientY)
      .filter((el) => el !== cursor && !cursor.contains(el));

    for (const el of stack) {
      const themed = el.closest("[data-cursor-theme]");
      if (themed) {
        return themed.dataset.cursorTheme === "dark" ? "dark" : "light";
      }
    }

    for (const el of stack) {
      if (el.matches?.(DARK_SURFACE_SELECTOR)) {
        return "dark";
      }

      if (el.tagName === "IMG") {
        const imageLum = sampleImageLuminance(el, clientX, clientY);
        if (imageLum !== null) {
          return imageLum < LUMINANCE_THRESHOLD ? "dark" : "light";
        }
      }

      const style = getComputedStyle(el);
      const colors = colorsFromBackground(style);
      const lum = averageColorLuminance(colors);
      if (lum !== null) {
        return lum < LUMINANCE_THRESHOLD ? "dark" : "light";
      }
    }

    return "light";
  };

  let cursorX = window.innerWidth / 2;
  let cursorY = window.innerHeight / 2;
  let pendingCursorUpdate = false;

  const updateCursorTheme = () => {
    pendingCursorUpdate = false;
    const theme = resolveSurfaceTheme(cursorX, cursorY);
    cursor.classList.toggle("is-on-dark", theme === "dark");
  };

  const scheduleCursorThemeUpdate = () => {
    if (!pendingCursorUpdate) {
      pendingCursorUpdate = true;
      requestAnimationFrame(updateCursorTheme);
    }
  };

  document.addEventListener(
    "mousemove",
    (event) => {
      cursorX = event.clientX;
      cursorY = event.clientY;
      cursor.style.left = `${cursorX}px`;
      cursor.style.top = `${cursorY}px`;
      scheduleCursorThemeUpdate();
    },
    { passive: true }
  );

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

  cursor.style.left = `${cursorX}px`;
  cursor.style.top = `${cursorY}px`;
  scheduleCursorThemeUpdate();
  window.addEventListener("scroll", scheduleCursorThemeUpdate, { passive: true });
  window.addEventListener("resize", scheduleCursorThemeUpdate, { passive: true });
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
