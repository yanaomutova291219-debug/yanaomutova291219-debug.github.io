const exhibits = window.MUSEUM_EXHIBITS;
const $ = (id) => document.getElementById(id);
    const image = $("artifactImage");
    const stage = $("viewerStage");
    const storySide = document.querySelector(".story-side");
    const artNumber = $("artifactNumber");
    const rail = $("exhibitRail");
    const viewStatus = $("viewStatus");
    let activeIndex = 0;
    let zoom = 1;
    let rotateY = 0;
    let rotateX = 0;
    let frameIndex = 0;
    let dragging = false;
    let pointerStartX = 0;
    let pointerStartY = 0;
    let dragBaseY = 0;
    let dragBaseX = 0;
    let lastFrameStep = 0;
    let hasShownExhibit = false;
    let narrationState = "idle";
    let speechUtterance = null;
    let speechQueue = [];
    let speechQueueIndex = 0;
    let speechTimer = 0;
    let selectedSpeechVoice = null;
    let swipeStart = null;
    const speech = window.speechSynthesis || null;

    const pad = (number) => String(number).padStart(2, "0");
    const activeExhibit = () => exhibits[activeIndex];
    const framesFor = (exhibit) => exhibit.frames && exhibit.frames.length ? exhibit.frames : [exhibit.image];

    function drawView() {
      image.style.transform = "perspective(1100px) rotateX(" + rotateX + "deg) rotateY(" + rotateY + "deg) scale(" + zoom + ")";
    }

    function setFrame(nextFrame) {
      const exhibit = activeExhibit();
      const frames = framesFor(exhibit);
      frameIndex = (nextFrame + frames.length) % frames.length;
      image.src = frames[frameIndex];
      image.alt = exhibit.frames && exhibit.frames.length > 1
        ? exhibit.title + " — " + (frameIndex === 0 ? "лицевая сторона" : "оборотная сторона")
        : exhibit.imageAlt;
      artNumber.textContent = "Экспонат " + pad(activeIndex + 1) + " / " + pad(exhibits.length);
    }

    function showExhibit(index, focusRailItem) {
      const nextIndex = (index + exhibits.length) % exhibits.length;
      const changed = nextIndex !== activeIndex;
      const delta = (nextIndex - activeIndex + exhibits.length) % exhibits.length;
      const direction = delta === 0 || delta <= exhibits.length / 2 ? 1 : -1;
      if (changed) stopNarration();
      if (changed && hasShownExhibit) animatePage(direction);
      activeIndex = nextIndex;
      const exhibit = activeExhibit();
      zoom = 1;
      rotateY = 0;
      rotateX = 0;
      frameIndex = 0;
      image.src = exhibit.image;
      image.alt = exhibit.imageAlt;
      $("artifactNumber").textContent = "Экспонат " + pad(activeIndex + 1) + " / " + pad(exhibits.length);
      $("artifactEra").textContent = exhibit.era;
      $("stageCaption").textContent = exhibit.imageCaption;
      $("storyRoom").textContent = exhibit.room;
      $("storyCategory").textContent = exhibit.category;
      $("exhibitTitle").textContent = exhibit.title;
      $("exhibitMeta").textContent = exhibit.meta;
      $("exhibitIntro").textContent = exhibit.intro;
      $("progressCurrent").textContent = pad(activeIndex + 1);
      $("storyProgressBar").style.width = ((activeIndex + 1) / exhibits.length * 100) + "%";
      $("previousItem").href = "/kazachya-starina/exhibits/" + exhibits[(activeIndex + exhibits.length - 1) % exhibits.length].id + ".html";
      $("nextItem").href = "/kazachya-starina/exhibits/" + exhibits[(activeIndex + 1) % exhibits.length].id + ".html";
      $("exhibitTotal").textContent = String(exhibits.length);
      if ($("railCount")) $("railCount").textContent = exhibits.length + " предметов • листайте ленту";
      $("headerCount").textContent = exhibits.length + " историй";
      $("storyText").replaceChildren(...exhibit.story.map((paragraph) => {
        const p = document.createElement("p");
        p.textContent = paragraph;
        return p;
      }));
      $("whyText").textContent = exhibit.why;
      $("detailRow").replaceChildren(...exhibit.details.map((detail) => {
        const chip = document.createElement("span");
        chip.className = "detail-chip";
        chip.textContent = detail;
        return chip;
      }));
      const sourceLink = $("sourceLink");
      if (exhibit.source) {
        sourceLink.href = exhibit.source.url;
        sourceLink.textContent = exhibit.source.label + " ↗";
        sourceLink.classList.add("is-visible");
      } else {
        sourceLink.removeAttribute("href");
        sourceLink.classList.remove("is-visible");
      }
      if (rail) {
        rail.querySelectorAll(".rail-item").forEach((item, itemIndex) => {
          const selected = itemIndex === activeIndex;
          item.setAttribute("aria-current", selected ? "true" : "false");
          item.setAttribute("tabindex", selected ? "0" : "-1");
        });
        if (focusRailItem) {
          rail.querySelectorAll(".rail-item")[activeIndex].focus();
        } else {
          rail.querySelectorAll(".rail-item")[activeIndex].scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
        }
      }
      drawView();
      document.title = exhibit.title + " — Казачья старина";
      viewStatus.textContent = exhibit.title + ". Экспонат " + (activeIndex + 1) + " из " + exhibits.length;
      hasShownExhibit = true;
    }

    function makeRail() {
      exhibits.forEach((exhibit, index) => {
        const button = document.createElement("button");
        button.className = "rail-item";
        button.type = "button";
        button.setAttribute("role", "tab");
        button.setAttribute("aria-current", index === 0 ? "true" : "false");
        button.setAttribute("aria-label", pad(index + 1) + ". " + exhibit.title);
        button.setAttribute("tabindex", index === 0 ? "0" : "-1");
        button.addEventListener("click", () => showExhibit(index, false));
        button.addEventListener("keydown", (event) => {
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault();
            const direction = event.key === "ArrowRight" ? 1 : -1;
            showExhibit(index + direction, true);
          }
        });
        const thumb = document.createElement("span");
        thumb.className = "rail-thumb";
        const thumbImage = document.createElement("img");
        thumbImage.src = exhibit.image;
        thumbImage.alt = "";
        thumbImage.loading = index > 3 ? "lazy" : "eager";
        thumbImage.decoding = "async";
        thumb.append(thumbImage);
        const copy = document.createElement("span");
        copy.className = "rail-copy";
        const number = document.createElement("span");
        number.className = "rail-number";
        number.textContent = pad(index + 1);
        const name = document.createElement("span");
        name.className = "rail-name";
        name.textContent = exhibit.title;
        copy.append(number, name);
        button.append(thumb, copy);
        rail.append(button);
      });
    }

    function rotate(direction) {
      const exhibit = activeExhibit();
      if (exhibit.frames && exhibit.frames.length > 1) {
        setFrame(frameIndex + direction);
        viewStatus.textContent = exhibit.title + ": " + (frameIndex === 0 ? "лицевая сторона" : "оборотная сторона");
      } else {
        rotateY = Math.max(-42, Math.min(42, rotateY + direction * 12));
        drawView();
        viewStatus.textContent = "Угол поворота " + Math.round(rotateY) + " градусов";
      }
    }

    function changeZoom(delta) {
      zoom = Math.max(.75, Math.min(2.65, zoom + delta));
      drawView();
      viewStatus.textContent = "Масштаб " + Math.round(zoom * 100) + " процентов";
    }

    function resetView() {
      zoom = 1;
      rotateY = 0;
      rotateX = 0;
      frameIndex = 0;
      setFrame(0);
      drawView();
      viewStatus.textContent = "Исходный вид";
    }

    function setNarrationUI(state, message) {
      narrationState = state;
      const narration = $("narration");
      const toggle = $("speakToggle");
      narration.classList.toggle("is-speaking", state === "speaking");
      narration.classList.toggle("is-paused", state === "paused");
      toggle.setAttribute("aria-pressed", state === "speaking" || state === "paused" ? "true" : "false");
      toggle.querySelector("span[aria-hidden]").textContent = state === "speaking" ? "Ⅱ" : "▶";
      $("speakLabel").textContent = state === "speaking" ? "Пауза" : state === "paused" ? "Продолжить" : state === "ended" ? "Слушать снова" : state === "error" ? "Попробовать снова" : "Слушать историю";
      $("narrationStatus").textContent = message;
    }

    function voiceKey(voice) {
      return voice.name + "::" + voice.lang;
    }

    function loadRussianVoices() {
      const select = $("voiceSelect");
      if (!speech || !select) return;
      const available = speech.getVoices();
      const russian = available.filter((voice) => /^ru(?:-|_)/i.test(voice.lang));
      let saved = "";
      try { saved = localStorage.getItem("kazachya-starina-voice") || ""; } catch (_) {}
      select.replaceChildren();
      if (!russian.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Русский голос браузера";
        select.append(option);
        select.disabled = true;
        selectedSpeechVoice = null;
        $("speakToggle").disabled = true;
        $("speakRestart").disabled = true;
        if (narrationState === "idle") $("narrationStatus").textContent = "На устройстве не найден русский голос для чтения.";
        return;
      }
      russian.sort((a, b) => {
        const score = (voice) => (/google|microsoft|milena|irina|alena|elena|katya|anna/i.test(voice.name) ? 2 : 0) + (voice.localService ? 1 : 0);
        return score(b) - score(a) || a.name.localeCompare(b.name, "ru");
      });
      russian.forEach((voice) => {
        const option = document.createElement("option");
        option.value = voiceKey(voice);
        option.textContent = voice.name + " · " + voice.lang;
        select.append(option);
      });
      select.disabled = false;
      $("speakToggle").disabled = false;
      $("speakRestart").disabled = false;
      const preferred = russian.find((voice) => voiceKey(voice) === saved) || russian[0];
      select.value = voiceKey(preferred);
      selectedSpeechVoice = preferred;
      if (narrationState === "idle") $("narrationStatus").textContent = "Выберите русский голос; история читается короткими фрагментами.";
    }

    function speakableText(value) {
      return value
        .replace(/50\s+копеек/gi, "пятьдесят копеек")
        .replace(/\b1926\s*года\b/gi, "тысяча девятьсот двадцать шестого года")
        .replace(/\b1926-го\b/gi, "тысяча девятьсот двадцать шестого года")
        .replace(/\b1926\b/g, "тысяча девятьсот двадцать шестого года")
        .replace(/\b1932-го\b/gi, "тысяча девятьсот тридцать второго года")
        .replace(/\b1932\s*года\b/gi, "тысяча девятьсот тридцать второго года")
        .replace(/\b1932\b/g, "тысяча девятьсот тридцать второго года")
        .replace(/\b1933\s*года\b/gi, "тысяча девятьсот тридцать третьего года")
        .replace(/\b1933\b/g, "тысяча девятьсот тридцать третьего года")
        .replace(/\s*[•·]\s*/g, ", ")
        .replace(/\s+([,.;:!?])/g, "$1")
        .replace(/\s*—\s*/g, ", ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function narrationChunks(value) {
      const text = speakableText(value);
      const sentences = text.match(/[^.!?…;:]+[.!?…;:]*|[^.!?…;:]+$/gu) || [text];
      const chunks = [];
      let current = "";
      sentences.forEach((sentence) => {
        const part = sentence.trim();
        if (!part) return;
        if (current && current.length + part.length + 1 > 360) {
          chunks.push(current);
          current = "";
        }
        if (part.length <= 360) {
          current = current ? current + " " + part : part;
          return;
        }
        const words = part.split(/\s+/);
        words.forEach((word) => {
          if (current && current.length + word.length + 1 > 360) {
            chunks.push(current);
            current = "";
          }
          current = current ? current + " " + word : word;
        });
      });
      if (current) chunks.push(current);
      return chunks;
    }

    function speakNextChunk() {
      if (speechQueueIndex >= speechQueue.length) {
        speechUtterance = null;
        setNarrationUI("ended", "История завершена");
        return;
      }
      const utterance = new SpeechSynthesisUtterance(speechQueue[speechQueueIndex]);
      selectedSpeechVoice = speech.getVoices().find((voice) => voiceKey(voice) === $("voiceSelect").value) || selectedSpeechVoice;
      if (selectedSpeechVoice) utterance.voice = selectedSpeechVoice;
      utterance.lang = selectedSpeechVoice ? selectedSpeechVoice.lang : "ru-RU";
      utterance.rate = .91;
      utterance.pitch = 1;
      utterance.volume = 1;
      speechUtterance = utterance;
      utterance.onstart = () => {
        if (speechUtterance === utterance) setNarrationUI("speaking", "Фрагмент " + (speechQueueIndex + 1) + " из " + speechQueue.length);
      };
      utterance.onend = () => {
        if (speechUtterance !== utterance) return;
        speechUtterance = null;
        speechQueueIndex += 1;
        speechTimer = window.setTimeout(speakNextChunk, 130);
      };
      utterance.onerror = (event) => {
        if (speechUtterance !== utterance || event.error === "interrupted" || event.error === "canceled") return;
        speechUtterance = null;
        setNarrationUI("error", "Озвучивание остановилось. Попробуйте другой русский голос.");
      };
      speech.speak(utterance);
    }

    function stopNarration(message) {
      const oldUtterance = speechUtterance;
      speechUtterance = null;
      speechQueue = [];
      speechQueueIndex = 0;
      if (speechTimer) window.clearTimeout(speechTimer);
      speechTimer = 0;
      if (speech) speech.cancel();
      if (oldUtterance) {
        oldUtterance.onend = null;
        oldUtterance.onerror = null;
      }
      setNarrationUI("idle", message || "Русская озвучка • короткие фрагменты");
    }

    function startNarration() {
      if (!speech || !window.SpeechSynthesisUtterance) {
        setNarrationUI("error", "В этом браузере озвучивание недоступно.");
        return;
      }
      if (!speech.getVoices().some((voice) => /^ru(?:-|_)/i.test(voice.lang))) {
        setNarrationUI("error", "На устройстве не найден русский голос для чтения.");
        return;
      }
      speech.cancel();
      if (speechTimer) window.clearTimeout(speechTimer);
      const exhibit = activeExhibit();
      speechQueue = [exhibit.title, exhibit.meta, exhibit.intro, ...exhibit.story, "Почему этот предмет в музее.", exhibit.why].flatMap(narrationChunks);
      speechQueueIndex = 0;
      setNarrationUI("speaking", "Подготовка русской озвучки…");
      speakNextChunk();
    }

    function animatePage(direction) {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const sign = direction >= 0 ? 1 : -1;
      const options = { duration: 1020, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" };
      if (stage.animate) {
        const stageAnimation = stage.animate([
          { opacity: .08, filter: "blur(16px) saturate(.55)", transform: "perspective(1400px) translate3d(" + (sign * 94) + "px, 24px, -330px) rotateY(" + (sign * -28) + "deg) rotateX(5deg) scale(.68)" },
          { opacity: .86, filter: "blur(2px) saturate(1.15)", transform: "perspective(1400px) translate3d(" + (sign * -9) + "px, -5px, 22px) rotateY(" + (sign * 2) + "deg) scale(1.025)", offset: .65 },
          { opacity: 1, filter: "blur(0) saturate(1)", transform: "perspective(1400px) translate3d(0, 0, 0) rotateY(0) rotateX(0) scale(1)" }
        ], options);
        stageAnimation.onfinish = () => stageAnimation.cancel();
      }
      if (storySide.animate) {
        const pageAnimation = storySide.animate([
          { opacity: .08, filter: "blur(18px)", transform: "perspective(1300px) translate3d(" + (sign * 130) + "px, 35px, -390px) rotateY(" + (sign * -25) + "deg) scale(.76)" },
          { opacity: 1, filter: "blur(0)", transform: "perspective(1300px) translate3d(" + (sign * -7) + "px, -4px, 16px) rotateY(" + (sign * 1) + "deg) scale(1.02)", offset: .62 },
          { opacity: 1, filter: "blur(0)", transform: "perspective(1300px) translate3d(0, 0, 0) rotateY(0deg) scale(1)" }
        ], options);
        pageAnimation.onfinish = () => pageAnimation.cancel();
      }
    }

    $("rotateLeft").addEventListener("click", () => rotate(-1));
    $("rotateRight").addEventListener("click", () => rotate(1));
    $("zoomOut").addEventListener("click", () => changeZoom(-.18));
    $("zoomIn").addEventListener("click", () => changeZoom(.18));
    $("resetView").addEventListener("click", resetView);
    const artifactSide = stage.closest(".artifact-side");
    const fullscreenButton = $("fullscreen");
    const closeView = document.createElement("button");
    closeView.type = "button";
    closeView.className = "viewer-close";
    closeView.textContent = "×";
    closeView.setAttribute("aria-label", "Закрыть полный экран");
    artifactSide.append(closeView);
    fullscreenButton.setAttribute("aria-haspopup", "dialog");
    fullscreenButton.setAttribute("aria-expanded", "false");
    let expandedView = false;

    function setExpandedView(expanded) {
      expandedView = expanded;
      artifactSide.classList.toggle("is-expanded", expanded);
      document.documentElement.classList.toggle("viewer-open", expanded);
      fullscreenButton.setAttribute("aria-expanded", String(expanded));
      fullscreenButton.setAttribute("aria-label", expanded ? "Вернуть обычный вид" : "Открыть на весь экран");
      if (expanded) {
        artifactSide.parentElement.style.animation = "none";
        artifactSide.setAttribute("role", "dialog");
        artifactSide.setAttribute("aria-modal", "true");
        artifactSide.setAttribute("aria-label", "Экспонат крупным планом");
        closeView.focus();
      } else {
        artifactSide.removeAttribute("role");
        artifactSide.removeAttribute("aria-modal");
        artifactSide.removeAttribute("aria-label");
        fullscreenButton.focus();
      }
    }

    fullscreenButton.addEventListener("click", () => setExpandedView(!expandedView));
    closeView.addEventListener("click", () => setExpandedView(false));
    artifactSide.addEventListener("keydown", (event) => {
      if (!expandedView) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setExpandedView(false);
      } else if (event.key === "Tab") {
        const controls = Array.from(artifactSide.querySelectorAll("button, [tabindex='0']"))
          .filter((element) => element.offsetParent !== null);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
    $("speakToggle").addEventListener("click", () => {
      if (!speech) return;
      if (narrationState === "speaking") {
        if (speechUtterance) speech.pause();
        else if (speechTimer) window.clearTimeout(speechTimer);
        speechTimer = 0;
        setNarrationUI("paused", "Озвучивание на паузе");
      } else if (narrationState === "paused") {
        if (speechUtterance) speech.resume();
        else speechTimer = window.setTimeout(speakNextChunk, 0);
        setNarrationUI("speaking", "Сейчас звучит история этого экспоната");
      } else {
        startNarration();
      }
    });
    $("speakRestart").addEventListener("click", startNarration);
    loadRussianVoices();
    if (speech) speech.onvoiceschanged = loadRussianVoices;
    $("voiceSelect").addEventListener("change", () => {
      const voice = speech?.getVoices().find((item) => voiceKey(item) === $("voiceSelect").value) || null;
      selectedSpeechVoice = voice;
      try { if (voice) localStorage.setItem("kazachya-starina-voice", voiceKey(voice)); } catch (_) {}
      if (narrationState === "speaking" || narrationState === "paused") {
        stopNarration("Голос изменён. Нажмите «Слушать историю» ещё раз.");
      }
    });
    if (!speech) {
      $("speakToggle").disabled = true;
      $("speakRestart").disabled = true;
      setNarrationUI("error", "В этом браузере озвучивание недоступно.");
    }

    storySide.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" || event.target.closest("button, a")) return;
      swipeStart = { x: event.clientX, y: event.clientY, time: Date.now() };
    });
    storySide.addEventListener("pointerup", (event) => {
      if (!swipeStart) return;
      const dx = event.clientX - swipeStart.x;
      const dy = event.clientY - swipeStart.y;
      const quick = Date.now() - swipeStart.time < 650;
      swipeStart = null;
      if (quick && Math.abs(dx) > 58 && Math.abs(dx) > Math.abs(dy) * 1.25) {
        window.location.href = dx < 0 ? $("nextItem").href : $("previousItem").href;
      }
    });
    storySide.addEventListener("pointercancel", () => { swipeStart = null; });

    stage.addEventListener("pointerdown", (event) => {
      dragging = true;
      pointerStartX = event.clientX;
      pointerStartY = event.clientY;
      dragBaseY = rotateY;
      dragBaseX = rotateX;
      lastFrameStep = 0;
      stage.classList.add("is-dragging");
      try { stage.setPointerCapture(event.pointerId); } catch (_) {}
    });
    stage.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const dx = event.clientX - pointerStartX;
      const dy = event.clientY - pointerStartY;
      const exhibit = activeExhibit();
      if (exhibit.frames && exhibit.frames.length > 1) {
        const step = Math.trunc(dx / 70);
        if (step !== lastFrameStep) {
          setFrame(frameIndex + lastFrameStep - step);
          lastFrameStep = step;
        }
        rotateX = Math.max(-10, Math.min(10, dragBaseX - dy * .09));
      } else {
        rotateY = Math.max(-42, Math.min(42, dragBaseY + dx * .2));
        rotateX = Math.max(-13, Math.min(13, dragBaseX - dy * .11));
      }
      drawView();
    });
    function endDrag() { dragging = false; stage.classList.remove("is-dragging"); }
    stage.addEventListener("pointerup", endDrag);
    stage.addEventListener("pointercancel", endDrag);
    stage.addEventListener("wheel", (event) => {
      event.preventDefault();
      changeZoom(event.deltaY < 0 ? .12 : -.12);
    }, { passive: false });
    stage.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") { event.preventDefault(); rotate(-1); }
      if (event.key === "ArrowRight") { event.preventDefault(); rotate(1); }
      if (event.key === "+" || event.key === "=") { event.preventDefault(); changeZoom(.18); }
      if (event.key === "-") { event.preventDefault(); changeZoom(-.18); }
      if (event.key === "0") { event.preventDefault(); resetView(); }
    });

    const menuToggle = $("menuToggle");
    const navLinks = $("navLinks");
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

    if (rail) makeRail();
    const pageExhibitIndex = exhibits.findIndex((exhibit) => exhibit.id === document.body.dataset.exhibit);
    showExhibit(pageExhibitIndex >= 0 ? pageExhibitIndex : 0, false);
