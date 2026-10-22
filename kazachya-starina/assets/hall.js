(() => {
  const exhibits = window.MUSEUM_EXHIBITS || [];
  const heroImage = document.getElementById("heroRelic");
  if (heroImage && exhibits[0]) { heroImage.src = exhibits[0].image; heroImage.alt = exhibits[0].imageAlt; }
  const grid = document.getElementById("exhibitGrid");
  const filtersHost = document.getElementById("hallFilters");
  const search = document.getElementById("exhibitSearch");
  const resultCount = document.getElementById("resultCount");
  const emptySearch = document.getElementById("emptySearch");
  const collectionWheel = document.getElementById("collectionWheel");
  const wheelStage = document.getElementById("wheelStage");
  const wheelRing = document.getElementById("wheelRing");
  const wheelItems = [];
  const pageReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const pointerFine = window.matchMedia("(pointer: fine)");
  const roomFilters = [
    { id: "all", label: "Весь зал" },
    { id: "home", label: "Дом и вера", items: ["coin", "lapti", "icon", "cross", "amulet", "carpet", "lyulka", "cradle"] },
    { id: "horse", label: "Конный уклад", items: ["whip", "crop"] },
    { id: "memory", label: "Память и служба", items: ["black-board", "medals", "old-photo"] }
  ];
  let activeRoom = "all";
  let observer = null;
  let carouselItems = [];
  let carouselIndex = 0;
  let carouselStep = 0;
  let carouselRadius = 0;
  let carouselDrag = null;
  let suppressWheelClick = false;
  let dragAngle = 0;

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  function amountLabel(amount) {
    if (amount % 10 === 1 && amount % 100 !== 11) return amount + " экспонат";
    if (amount % 10 >= 2 && amount % 10 <= 4 && (amount % 100 < 12 || amount % 100 > 14)) return amount + " экспоната";
    return amount + " экспонатов";
  }

  function selectedExhibits() {
    const query = search.value.trim().toLocaleLowerCase("ru");
    const filter = roomFilters.find((item) => item.id === activeRoom);
    return exhibits.filter((exhibit) => {
      const inRoom = !filter || !filter.items || filter.items.includes(exhibit.id);
      const text = [exhibit.title, exhibit.meta, exhibit.category, exhibit.era, exhibit.intro, exhibit.why].join(" ").toLocaleLowerCase("ru");
      return inRoom && (!query || text.includes(query));
    });
  }

  function cardIndexFor(exhibit) {
    return String(exhibits.indexOf(exhibit) + 1).padStart(2, "0");
  }

  function wheelCardFor(exhibit, index) {
    const button = make("button", "wheel-card");
    button.type = "button";
    button.setAttribute("aria-label", "Выбрать экспонат: " + exhibit.title + ". Нажмите ещё раз, чтобы открыть страницу");
    button.setAttribute("tabindex", "-1");
    button.dataset.exhibit = exhibit.id;
    const number = make("span", "wheel-card-index", cardIndexFor(exhibit) + " / 13");
    const art = make("span", "wheel-card-art");
    const halo = make("span", "wheel-card-halo");
    const image = document.createElement("img");
    image.src = exhibit.image;
    image.alt = exhibit.imageAlt;
    image.loading = "eager";
    image.decoding = "async";
    const title = make("span", "wheel-card-title", exhibit.title);
    const meta = make("span", "wheel-card-meta", exhibit.meta);
    art.append(halo, image);
    button.append(number, art, title, meta);
    button.addEventListener("click", () => {
      if (suppressWheelClick) return;
      if (index === carouselIndex) window.location.assign("/kazachya-starina/exhibits/" + exhibit.id + ".html");
      else setCarouselIndex(index, true);
    });
    wheelRing.append(button);
    wheelItems.push(button);
    return button;
  }

  function updateCarouselLayout() {
    if (!carouselItems.length || !wheelStage) return;
    carouselStep = carouselItems.length >= 6 ? 360 / carouselItems.length : 60;
    carouselRadius = Math.min(540, Math.max(220, wheelStage.clientWidth * .42));
    wheelItems.forEach((card, index) => {
      card.style.transform = "translate(-50%, -50%) rotateY(" + (index * carouselStep) + "deg) translateZ(" + carouselRadius + "px)";
    });
    updateCarouselPosition(false);
  }

  function updateCarouselPosition(announce = true) {
    if (!carouselItems.length) return;
    const exhibit = carouselItems[carouselIndex];
    wheelRing.style.transform = "rotateX(0deg) rotateY(" + (-carouselIndex * carouselStep + dragAngle) + "deg)";
    wheelItems.forEach((card, index) => {
      const distance = Math.min((index - carouselIndex + carouselItems.length) % carouselItems.length, (carouselIndex - index + carouselItems.length) % carouselItems.length);
      card.classList.toggle("is-active", index === carouselIndex);
      card.classList.toggle("is-near", distance === 1);
      card.classList.toggle("is-distant", distance > 2);
      card.setAttribute("aria-current", index === carouselIndex ? "true" : "false");
      card.setAttribute("aria-pressed", index === carouselIndex ? "true" : "false");
      card.tabIndex = index === carouselIndex ? 0 : -1;
      card.querySelector("img").style.viewTransitionName = index === carouselIndex ? "museum-object" : "none";
    });
    const number = String(carouselIndex + 1).padStart(2, "0");
    const total = String(carouselItems.length).padStart(2, "0");
    document.getElementById("wheelCount").textContent = cardIndexFor(exhibit) + " / 13 · " + exhibit.category.toLocaleUpperCase("ru");
    document.getElementById("wheelTitle").textContent = exhibit.title;
    document.getElementById("wheelMeta").textContent = exhibit.meta;
    document.getElementById("wheelCounter").innerHTML = number + " <i>/</i> " + total;
    const open = document.getElementById("wheelOpen");
    open.href = "/kazachya-starina/exhibits/" + exhibit.id + ".html";
    if (announce) document.getElementById("wheelStatus").textContent = exhibit.title + ". Экспонат " + number + " из " + total;
  }

  function setCarouselIndex(index, focusCard = false) {
    if (!carouselItems.length) return;
    carouselIndex = (index + carouselItems.length) % carouselItems.length;
    dragAngle = 0;
    updateCarouselPosition();
    if (focusCard) wheelItems[carouselIndex].focus();
  }

  function renderCarousel(items) {
    if (!collectionWheel || !wheelRing) return;
    const previousId = carouselItems[carouselIndex]?.id;
    carouselItems = items;
    carouselIndex = Math.max(0, carouselItems.findIndex((item) => item.id === previousId));
    wheelItems.length = 0;
    wheelRing.replaceChildren();
    collectionWheel.hidden = !carouselItems.length;
    if (!carouselItems.length) return;
    carouselItems.forEach(wheelCardFor);
    requestAnimationFrame(updateCarouselLayout);
  }

  function initCarousel() {
    if (!wheelStage || !wheelRing) return;
    document.getElementById("wheelPrevious").addEventListener("click", () => setCarouselIndex(carouselIndex - 1));
    document.getElementById("wheelNext").addEventListener("click", () => setCarouselIndex(carouselIndex + 1));
    document.getElementById("wheelOpen").addEventListener("click", () => {
      document.querySelectorAll(".wheel-card img, .card-art img, #heroRelic").forEach((image) => { image.style.viewTransitionName = "none"; });
      wheelItems[carouselIndex]?.querySelector("img").style.setProperty("view-transition-name", "museum-object");
    });
    wheelStage.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight") { event.preventDefault(); setCarouselIndex(carouselIndex + 1, true); }
      if (event.key === "ArrowLeft") { event.preventDefault(); setCarouselIndex(carouselIndex - 1, true); }
      if (event.key === "Home") { event.preventDefault(); setCarouselIndex(0, true); }
      if (event.key === "End") { event.preventDefault(); setCarouselIndex(carouselItems.length - 1, true); }
    });
    wheelStage.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      carouselDrag = { x: event.clientX, y: event.clientY, moved: false, time: Date.now() };
      wheelRing.style.transition = "none";
      try { wheelStage.setPointerCapture(event.pointerId); } catch (_) {}
    });
    wheelStage.addEventListener("pointermove", (event) => {
      if (!carouselDrag) return;
      const dx = event.clientX - carouselDrag.x;
      const dy = event.clientY - carouselDrag.y;
      if (Math.abs(dx) > 5 && Math.abs(dx) > Math.abs(dy)) carouselDrag.moved = true;
      if (!carouselDrag.moved) return;
      dragAngle = -dx * .52;
      updateCarouselPosition(false);
    });
    wheelStage.addEventListener("pointerup", (event) => {
      if (!carouselDrag) return;
      const dx = event.clientX - carouselDrag.x;
      const dy = event.clientY - carouselDrag.y;
      const elapsed = Math.max(1, Date.now() - carouselDrag.time);
      const moved = carouselDrag.moved && Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.25;
      carouselDrag = null;
      wheelRing.style.transition = "";
      if (moved) {
        const steps = Math.min(3, Math.max(1, Math.round(Math.abs(dx) / 125 + Math.abs(dx / elapsed) / 1.2)));
        suppressWheelClick = true;
        window.setTimeout(() => { suppressWheelClick = false; }, 450);
        setCarouselIndex(carouselIndex + (dx < 0 ? steps : -steps));
      } else {
        dragAngle = 0;
        updateCarouselPosition(false);
      }
    });
    wheelStage.addEventListener("pointercancel", () => {
      carouselDrag = null;
      wheelRing.style.transition = "";
      dragAngle = 0;
      updateCarouselPosition(false);
    });
    window.addEventListener("resize", updateCarouselLayout, { passive: true });
  }

  function cardFor(exhibit, index) {
    const link = make("a", "exhibit-card");
    link.href = "/kazachya-starina/exhibits/" + exhibit.id + ".html";
    link.setAttribute("aria-label", "Открыть экспонат: " + exhibit.title + ". " + exhibit.meta);
    link.style.transitionDelay = Math.min((index % 4) * 65, 195) + "ms";
    const art = make("span", "card-art");
    const image = document.createElement("img");
    image.src = exhibit.image;
    image.alt = exhibit.imageAlt;
    image.loading = index < 4 ? "eager" : "lazy";
    image.decoding = "async";
    const number = make("span", "card-index", String(exhibits.indexOf(exhibit) + 1).padStart(2, "0") + " / 13");
    const visit = make("span", "card-visit", "↗");
    visit.setAttribute("aria-hidden", "true");
    art.append(image, number, visit);
    const copy = make("span", "card-copy");
    copy.append(make("span", "card-room", exhibit.category), make("strong", "", exhibit.title), make("span", "card-meta", exhibit.meta));
    copy.append(make("span", "card-why", exhibit.why));
    link.append(art, copy);
    link.addEventListener("click", () => {
      document.querySelectorAll(".card-art img").forEach((artImage) => { artImage.style.viewTransitionName = "none"; });
      const heroImage = document.getElementById("heroRelic");
      if (heroImage) heroImage.style.viewTransitionName = "none";
      image.style.viewTransitionName = "museum-object";
    });
    if (pointerFine.matches && !pageReducedMotion.matches) {
      link.addEventListener("pointermove", (event) => {
        const rect = link.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - .5;
        const y = (event.clientY - rect.top) / rect.height - .5;
        link.classList.add("is-tilting");
        link.style.setProperty("--tilt-y", (x * 5.5).toFixed(2) + "deg");
        link.style.setProperty("--tilt-x", (y * -5.5).toFixed(2) + "deg");
      });
      link.addEventListener("pointerleave", () => {
        link.classList.remove("is-tilting");
        link.style.setProperty("--tilt-y", "0deg");
        link.style.setProperty("--tilt-x", "0deg");
      });
    }
    if (observer) observer.observe(link);
    else link.classList.add("is-visible");
    return link;
  }

  function renderGrid() {
    const selected = selectedExhibits();
    renderCarousel(selected);
    if (observer) grid.querySelectorAll(".exhibit-card").forEach((card) => observer.unobserve(card));
    grid.replaceChildren(...selected.map((exhibit, index) => cardFor(exhibit, index)));
    resultCount.textContent = amountLabel(selected.length);
    emptySearch.hidden = selected.length > 0;
  }

  function makeFilters() {
    roomFilters.forEach((filter) => {
      const button = make("button", "filter-button", filter.label);
      button.type = "button";
      button.setAttribute("aria-pressed", filter.id === activeRoom ? "true" : "false");
      button.addEventListener("click", () => {
        activeRoom = filter.id;
        filtersHost.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", item === button ? "true" : "false"));
        renderGrid();
      });
      filtersHost.append(button);
    });
  }

  function initReveal() {
    if (pageReducedMotion.matches || !("IntersectionObserver" in window)) {
      document.querySelectorAll("[data-reveal]").forEach((item) => item.classList.add("is-visible"));
      return;
    }
    observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          currentObserver.unobserve(entry.target);
        }
      });
    }, { threshold: .12, rootMargin: "0px 0px -35px 0px" });
    document.querySelectorAll("[data-reveal]").forEach((item) => observer.observe(item));
  }

  function initSky() {
    const canvas = document.getElementById("skyField");
    if (!canvas || pageReducedMotion.matches) return;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;
    let width = 0;
    let height = 0;
    let scale = 1;
    let stars = [];
    let frame = 0;
    function resize() {
      scale = Math.min(window.devicePixelRatio || 1, 1.6);
      width = window.innerWidth;
      height = Math.min(940, Math.max(650, window.innerHeight * 1.05));
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      canvas.style.height = height + "px";
      context.setTransform(scale, 0, 0, scale, 0, 0);
      const count = Math.min(145, Math.max(55, Math.round(width * height / 8200)));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.05 + .18,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * .0008 + .00018,
        drift: Math.random() * .025 + .004
      }));
    }
    function paint(time) {
      context.clearRect(0, 0, width, height);
      stars.forEach((star) => {
        const pulse = .18 + (Math.sin(time * star.speed + star.phase) + 1) * .25;
        star.x += star.drift * .18;
        if (star.x > width + 2) star.x = -2;
        context.beginPath();
        context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        context.fillStyle = "rgba(237, 219, 183, " + pulse.toFixed(3) + ")";
        context.fill();
      });
      frame = window.requestAnimationFrame(paint);
    }
    resize();
    frame = window.requestAnimationFrame(paint);
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) window.cancelAnimationFrame(frame);
      else frame = window.requestAnimationFrame(paint);
    });
  }

  function initHeroParallax() {
    const stage = document.getElementById("heroStage");
    const image = document.getElementById("heroRelic");
    if (!stage || !image || !pointerFine.matches || pageReducedMotion.matches) return;
    stage.addEventListener("pointermove", (event) => {
      const rect = stage.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      stage.style.setProperty("--pointer-y", ((x - .5) * 11).toFixed(2) + "deg");
      stage.style.setProperty("--pointer-x", ((.5 - y) * 8).toFixed(2) + "deg");
      stage.style.setProperty("--glow-x", (x * 100).toFixed(1) + "%");
      stage.style.setProperty("--glow-y", (y * 100).toFixed(1) + "%");
    });
    stage.addEventListener("pointerleave", () => {
      stage.style.setProperty("--pointer-y", "0deg");
      stage.style.setProperty("--pointer-x", "0deg");
      stage.style.setProperty("--glow-x", "50%");
      stage.style.setProperty("--glow-y", "48%");
    });
  }

  function initHeroTransition() {
    const heroImage = document.getElementById("heroRelic");
    if (!heroImage) return;
    document.querySelectorAll(".hero-relic-link, .hero-feature-link").forEach((link) => {
      link.addEventListener("click", () => {
        document.querySelectorAll(".card-art img").forEach((artImage) => { artImage.style.viewTransitionName = "none"; });
        heroImage.style.viewTransitionName = "museum-object";
      });
    });
  }

  const menuToggle = document.getElementById("menuToggle");
  const navLinks = document.getElementById("navLinks");
  menuToggle.addEventListener("click", () => {
    const open = navLinks.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", open ? "true" : "false");
    menuToggle.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
  });
  navLinks.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      navLinks.classList.remove("is-open");
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Открыть меню");
    }
  });
  search.addEventListener("input", renderGrid);
  makeFilters();
  initReveal();
  initCarousel();
  renderGrid();
  initSky();
  initHeroParallax();
  initHeroTransition();
})();
