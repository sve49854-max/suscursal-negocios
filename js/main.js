const overlay = document.getElementById("overlay");

function closeAllMenus() {
  document.querySelectorAll(".menu.open").forEach((menu) => menu.classList.remove("open"));
}

function hide(el) {
  if (el) el.hidden = true;
}

function show(el) {
  if (el) el.hidden = false;
}

function closeOverlays() {
  document.querySelectorAll(".modal, .drawer, .help-panel").forEach(hide);
  hide(overlay);
  closeAllMenus();
}

document.querySelectorAll("[data-menu]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const menu = button.closest(".menu");
    const wasOpen = menu.classList.contains("open");
    closeAllMenus();
    if (!wasOpen) menu.classList.add("open");
  });
});

document.addEventListener("click", closeAllMenus);

document.querySelectorAll("[data-open]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const id = button.dataset.open;
    if (id === "help") {
      const panel = document.getElementById("panel-help");
      panel.hidden = !panel.hidden;
      return;
    }
    closeAllMenus();
    show(overlay);
    show(document.getElementById(`modal-${id}`) || document.getElementById(`drawer-${id}`));
  });
});

document.querySelectorAll("[data-close], #overlay").forEach((el) => {
  el.addEventListener("click", closeOverlays);
});

document.querySelectorAll("[data-cookie]").forEach((button) => {
  button.addEventListener("click", () => {
    hide(document.getElementById("modal-cookies"));
    hide(overlay);
  });
});

document.querySelectorAll(".benefit-card").forEach((card) => {
  card.addEventListener("click", () => {
    const isOpen = card.classList.contains("open");
    document.querySelectorAll(".benefit-card.open").forEach((other) => other.classList.remove("open"));
    if (!isOpen) card.classList.add("open");
  });
});

const carousel = document.querySelector("[data-carousel]");
if (carousel) {
  const track = carousel.querySelector(".carousel-track");
  const cards = [...track.children];
  const prev = carousel.querySelector("[data-prev]");
  const next = carousel.querySelector("[data-next]");
  const dotsWrap = carousel.querySelector("[data-dots]");
  const perPage = () => (window.innerWidth <= 1024 ? 1 : 3);
  let index = 0;

  function pages() {
    return Math.max(1, cards.length - perPage() + 1);
  }

  function renderDots() {
    dotsWrap.innerHTML = "";
    for (let i = 0; i < pages(); i += 1) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.setAttribute("aria-label", `Ir a la vista ${i + 1}`);
      if (i === index) dot.classList.add("is-active");
      dot.addEventListener("click", () => {
        index = i;
        update();
      });
      dotsWrap.appendChild(dot);
    }
  }

  function update() {
    const step = cards[0].getBoundingClientRect().width + 18;
    track.style.transform = `translateX(-${index * step}px)`;
    track.style.transition = "transform .35s ease";
    prev.disabled = index === 0;
    next.disabled = index >= pages() - 1;
    [...dotsWrap.children].forEach((dot, i) => dot.classList.toggle("is-active", i === index));
  }

  prev.addEventListener("click", () => {
    index = Math.max(0, index - 1);
    update();
  });
  next.addEventListener("click", () => {
    index = Math.min(pages() - 1, index + 1);
    update();
  });

  window.addEventListener("resize", () => {
    index = Math.min(index, pages() - 1);
    renderDots();
    update();
  });

  renderDots();
  update();
}

document.querySelectorAll(".drawer a").forEach((link) => {
  link.addEventListener("click", closeOverlays);
});
