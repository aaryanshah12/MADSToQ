(function () {
  "use strict";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Year */
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* Header scroll */
  const header = document.getElementById("header");
  const onScrollHeader = () => {
    if (!header) return;
    header.classList.toggle("scrolled", window.scrollY > 60);
  };
  window.addEventListener("scroll", onScrollHeader, { passive: true });
  onScrollHeader();

  /* Mobile nav */
  const navToggle = document.querySelector(".nav-toggle");
  const siteNav = document.getElementById("site-nav");
  if (navToggle && siteNav) {
    navToggle.addEventListener("click", () => {
      const open = siteNav.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", String(open));
      navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    siteNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        siteNav.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* GSAP reveals */
  if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined" && !prefersReducedMotion) {
    gsap.registerPlugin(ScrollTrigger);

    gsap.utils.toArray(".reveal").forEach((el) => {
      gsap.to(el, {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: el,
          start: "top 88%",
          toggleActions: "play none none none",
        },
      });
    });

    gsap.utils.toArray(".hero .reveal").forEach((el, i) => {
      gsap.to(el, {
        opacity: 1,
        y: 0,
        duration: 1.1,
        delay: 0.15 + i * 0.12,
        ease: "power3.out",
      });
    });

    /* Parallax banner */
    const bannerBg = document.querySelector(".banner-bg");
    if (bannerBg) {
      gsap.to(bannerBg, {
        yPercent: 25,
        ease: "none",
        scrollTrigger: {
          trigger: ".banner",
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      });
    }

    /* Hero title line stagger */
    const heroLines = document.querySelectorAll(".hero-title .line");
    if (heroLines.length) {
      gsap.from(heroLines, {
        opacity: 0,
        y: 40,
        duration: 1.2,
        stagger: 0.15,
        ease: "power3.out",
        delay: 0.2,
      });
    }
  } else {
    document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible"));
  }

  document.querySelectorAll("img").forEach((img) => {
    img.addEventListener("error", () => {
      const frame = img.closest(".hero-media, .preview-grid a, .split-media, .image-band, .room-card, .gallery-item");
      if (frame) frame.classList.add("image-failed");
      img.setAttribute("alt", "");
    });
  });

  /* Contact form - mailto fallback */
  const form = document.getElementById("inquiry-form");
  const formStatus = document.getElementById("form-status");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const name = data.get("name");
      const email = data.get("email");
      const phone = data.get("phone") || "-";
      const type = data.get("project_type") || "-";
      const message = data.get("message");
      const subject = encodeURIComponent(`Aranya Grove inquiry - ${type}`);
      const body = encodeURIComponent(
        `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\nProject type: ${type}\n\n${message}`
      );
      window.location.href = `mailto:hello@aranyagrove.in?subject=${subject}&body=${body}`;
      if (formStatus) {
        formStatus.hidden = false;
        formStatus.textContent = "Your email client should open with the inquiry draft. If not, write to hello@aranyagrove.in directly.";
        formStatus.classList.remove("error");
      }
    });
  }
})();
