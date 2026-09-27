const navToggle = document.querySelector("[data-nav-toggle]");
const navLinks = [...document.querySelectorAll("[data-manual-nav] a")];
const search = document.querySelector("[data-manual-search]");
const backToTop = document.querySelector("[data-back-to-top]");
const chapters = [...document.querySelectorAll("main section[id]")];

navToggle?.addEventListener("click", () => {
  const open = document.body.classList.toggle("nav-open");
  navToggle.setAttribute("aria-expanded", String(open));
});

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    document.body.classList.remove("nav-open");
    navToggle?.setAttribute("aria-expanded", "false");
  });
});

search?.addEventListener("input", () => {
  const query = search.value.trim().toLowerCase();
  navLinks.forEach((link) => {
    link.hidden = Boolean(query) && !link.textContent.toLowerCase().includes(query);
  });
});

search?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    const result = navLinks.find((link) => !link.hidden);
    if (result) result.click();
  }
});

const observer = new IntersectionObserver(
  (entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    navLinks.forEach((link) => {
      link.classList.toggle("active", link.hash === `#${visible.target.id}`);
    });
  },
  { rootMargin: "-15% 0px -70% 0px", threshold: [0.05, 0.25, 0.6] },
);

chapters.forEach((chapter) => observer.observe(chapter));

function updatePageProgress() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const percent = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
  document.body.style.setProperty("--reading-progress", `${Math.min(100, percent)}%`);
  backToTop?.classList.toggle("visible", window.scrollY > 700);
}

window.addEventListener("scroll", updatePageProgress, { passive: true });
updatePageProgress();

backToTop?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

const dialog = document.querySelector("[data-image-dialog]");
const dialogImage = dialog?.querySelector("img");
const dialogClose = dialog?.querySelector("button");

document.querySelectorAll("[data-enlarge]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!dialog || !dialogImage) return;
    const image = button.querySelector("img");
    if (!image) return;
    dialogImage.src = image.src;
    dialogImage.alt = image.alt;
    dialog.showModal();
  });
});

dialogClose?.addEventListener("click", () => dialog.close());
dialog?.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
    event.preventDefault();
    search?.focus();
  }
});
