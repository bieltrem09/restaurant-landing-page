/* =========================================================
   SUSHI — Japanese Restaurant
   Interações e motion: GSAP 3 + ScrollTrigger + SplitText + Lenis
   Regras: só anima transform / opacity / clip-path / filter.
   prefers-reduced-motion: sem parallax, pin, partículas ou smooth scroll.
   ========================================================= */
(() => {
  "use strict";

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const root = document.documentElement;

  const hasGSAP = !!(window.gsap && window.ScrollTrigger);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const isDesktop = () => innerWidth >= 1024;

  // Sem GSAP: mostra todo o conteúdo e mantém as funções não-animadas
  if (!hasGSAP) root.classList.remove("js");
  root.classList.add("motion-ready");

  const WHATSAPP = "5511999999999";
  // Se tiver um endpoint (Formspree, API própria...), coloque aqui: o formulário fará POST em JSON.
  const FORM_ENDPOINT = "";

  const IMG = {
    niguiri: "assets/img/niguiri-salmao-macaricado-640.webp",
    detalhe: "assets/img/prato-detalhe-490.webp",
    combinado: "assets/img/prato-combinado-640.webp",
    niguiris: "assets/img/menu-niguiris-640.webp",
    uramakis: "assets/img/menu-uramakis-640.webp",
    chef: "assets/img/combinado-chef-640.webp",
  };

  let lenis = null;

  if (hasGSAP) {
    gsap.registerPlugin(ScrollTrigger);
    if (window.SplitText) gsap.registerPlugin(SplitText);
  }

  /* ---------------------------------------------------------
     Smooth scroll (Lenis) sincronizado com o ScrollTrigger
     --------------------------------------------------------- */
  function initLenis() {
    if (!hasGSAP || reduce || !window.Lenis) return;
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  function scrollToTarget(target) {
    if (lenis) lenis.scrollTo(target, { duration: 1.4, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else target.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  }

  // Links âncora passam pelo Lenis
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute("href");
    if (id.length < 2) return;
    const target = document.getElementById(id.slice(1));
    if (!target) return;
    e.preventDefault();
    closeMenu(false);
    scrollToTarget(target);
    history.replaceState(null, "", id);
    if (id === "#conteudo") target.focus?.();
  });

  /* ---------------------------------------------------------
     4.1 Preloader — logo desenhado em stroke, contador, cortina
     --------------------------------------------------------- */
  function runPreloader() {
    return new Promise((resolve) => {
      const pl = $("#preloader");
      const skip = !pl || root.classList.contains("no-preloader") || !hasGSAP;
      if (skip) {
        pl?.remove();
        resolve();
        return;
      }
      try {
        sessionStorage.setItem("sushi-visited", "1");
      } catch (e) {
        /* modo privado: ignora */
      }
      if (reduce) {
        gsap.to(pl, { autoAlpha: 0, duration: 0.3, onComplete: () => (pl.remove(), resolve()) });
        return;
      }
      lenis?.stop();
      const draws = $$(".pl-draw", pl);
      draws.forEach((p) => {
        const len = p.getTotalLength();
        p.style.strokeDasharray = len;
        p.style.strokeDashoffset = len;
      });
      const counter = $("#preloader-count");
      const n = { v: 0 };
      const tl = gsap.timeline({
        onComplete: () => {
          pl.remove();
          lenis?.start();
        },
      });
      tl.to(draws, { strokeDashoffset: 0, duration: 0.9, stagger: 0.1, ease: "power2.inOut" }, 0)
        .from(".pl-sun", { scale: 0, transformOrigin: "50% 50%", duration: 0.6, ease: "back.out(1.6)" }, 0.25)
        .to(".pl-mountain", { fillOpacity: 1, duration: 0.35 }, 0.75)
        .from(".pl-flower", { scale: 0, transformOrigin: "50% 50%", stagger: 0.06, duration: 0.3, ease: "back.out(2.2)" }, 0.8)
        .from(".preloader__word", { autoAlpha: 0, y: 10, duration: 0.7, ease: "power3.out" }, 0.2)
        .to(n, { v: 100, duration: 1.25, ease: "power1.inOut", onUpdate: () => (counter.textContent = Math.round(n.v)) }, 0)
        .to(".preloader__inner", { autoAlpha: 0, y: -24, duration: 0.3, ease: "power2.in" }, 1.3)
        .to(".preloader__curtain", { scaleY: 1, duration: 0.35, ease: "power3.in" }, 1.3)
        .to(pl, { yPercent: -100, duration: 0.7, ease: "expo.inOut" }, 1.6)
        .add(resolve, 1.7);
    });
  }

  /* ---------------------------------------------------------
     Helpers de SplitText (com fallback sem plugin)
     --------------------------------------------------------- */
  function splitChars(el) {
    if (!window.SplitText) return [el];
    return SplitText.create(el, { type: "chars", charsClass: "split-char", mask: "chars" }).chars;
  }
  function splitLines(el, mask = true) {
    if (!window.SplitText) return [el];
    return SplitText.create(el, { type: "lines", linesClass: "split-line", mask: mask ? "lines" : false }).lines;
  }

  /* ---------------------------------------------------------
     4.3 HERO — timeline de entrada (~1,6s)
     --------------------------------------------------------- */
  const heroHidden = ".hero__stage, .hero__content, .hero__proof, .hero__place, .hero__side, .scroll-hint";
  if (hasGSAP) gsap.set(heroHidden, { autoAlpha: 0 });

  function heroIntro() {
    if (!hasGSAP) return;
    gsap.set(heroHidden, { autoAlpha: 1 });
    if (reduce) return;
    // Parallax criado depois da entrada, para partir dos valores finais

    const chars = splitChars($(".hero__word"));
    const dish = ".hero__dish-back, .hero__dish-front";
    const tl = gsap.timeline({ defaults: { ease: "expo.out" }, onComplete: () => (heroScroll(), heroPointer()) });

    // 1. "SUSHI" sobe letra a letra (mask reveal)
    // 0. Sol vermelho nasce atrás da palavra
    tl.from(".hero__sun span", { scale: 0.55, autoAlpha: 0, duration: 1.6, ease: "expo.out" }, 0)
      .from(chars, { yPercent: 110, duration: 1.1, stagger: 0.06 }, 0.05)
      // 2. Sushi entra de baixo com scale e blur
      .fromTo(
        dish,
        { y: 70, scale: 0.9, filter: "blur(10px)", autoAlpha: 0 },
        { y: 0, scale: 1, filter: "blur(0px)", autoAlpha: 1, duration: 1.3, ease: "power4.out", clearProps: "filter" },
        0.15
      )
      // 3. Script dourado "escrito" da esquerda para a direita
      .fromTo(
        ".hero__script",
        { clipPath: "inset(-30% 100% -30% -10%)" },
        { clipPath: "inset(-30% -10% -30% -10%)", duration: 1.1, ease: "power2.inOut" },
        0.45
      )
      // 4. Headline e botões
      .from(".hero__content > *", { y: 30, autoAlpha: 0, duration: 0.8, stagger: 0.1, ease: "power3.out" }, 0.65)
      // 5. Cards de vidro deslizam dos cantos
      .from(".hero__proof", { x: -50, autoAlpha: 0, duration: 0.9, ease: "power3.out" }, 0.85)
      .from(".hero__place", { x: 50, autoAlpha: 0, duration: 0.9, ease: "power3.out" }, 0.9)
      .from(".hero__side, .scroll-hint", { autoAlpha: 0, duration: 0.8, ease: "power2.out" }, 1.0)
      .from(".hero__tag", { x: -24, autoAlpha: 0, duration: 0.9, ease: "power3.out" }, 1.05);
    // 6. Bokeh já está flutuando (canvas)
  }

  // Parallax em camadas no scroll + reação ao mouse
  function heroScroll() {
    if (!hasGSAP || reduce) return;
    const mobile = !isDesktop();
    gsap
      .timeline({ scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1 } })
      .to(".hero__word-wrap", { yPercent: mobile ? 20 : 45, ease: "none" }, 0) // desce mais devagar
      .to(".hero__dish-back, .hero__dish-front", { yPercent: mobile ? -10 : -28, ease: "none" }, 0) // sobe mais rápido
      .to(".hero__dish-back img, .hero__dish-front img", { scale: 1.08, ease: "none" }, 0)
      .to("#bokeh", { yPercent: 18, ease: "none" }, 0)
      .to(".hero__sun", { yPercent: mobile ? 15 : 30, ease: "none" }, 0) // sol desce devagar, atrás de tudo
      .to(".hero__tag", { autoAlpha: 0, ease: "none" }, 0)
      .to(".hero__content, .hero__proof, .hero__place, .hero__side, .scroll-hint", { y: -60, autoAlpha: 0, ease: "none" }, 0);
  }

  function heroPointer() {
    if (!finePointer || reduce) return;
    const hero = $(".hero");
    const layers = $$(".hero__dish-back, .hero__dish-front");
    const qx = layers.map((l) => gsap.quickTo(l, "x", { duration: 0.9, ease: "power3.out" }));
    const qy = layers.map((l) => gsap.quickTo(l, "y", { duration: 0.9, ease: "power3.out" }));
    const wx = gsap.quickTo(".hero__word", "x", { duration: 1.2, ease: "power3.out" });
    const bx = gsap.quickTo("#bokeh", "x", { duration: 1.4, ease: "power3.out" });
    const sx = gsap.quickTo(".hero__sun span", "x", { duration: 1.6, ease: "power3.out" });
    const sy = gsap.quickTo(".hero__sun span", "y", { duration: 1.6, ease: "power3.out" });
    hero.addEventListener("pointermove", (e) => {
      const nx = e.clientX / innerWidth - 0.5;
      const ny = e.clientY / innerHeight - 0.5;
      qx.forEach((f) => f(nx * 18));
      qy.forEach((f) => f(ny * 12));
      wx(nx * -10);
      bx(nx * -26);
      sx(nx * -14);
      sy(ny * -10);
    });
  }

  /* ---------------------------------------------------------
     Bokeh dourado (canvas leve, pausa fora da tela)
     --------------------------------------------------------- */
  function bokeh() {
    const cv = $("#bokeh");
    if (!cv || reduce) return;
    const ctx = cv.getContext("2d");
    const dpr = Math.min(devicePixelRatio || 1, 2);
    let w, h, parts, running = false, raf;
    const count = () => (innerWidth < 768 ? 18 : 42);
    function resize() {
      w = cv.clientWidth;
      h = cv.clientHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      parts = Array.from({ length: count() }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 2 + Math.random() * Math.random() * 26,
        a: 0.08 + Math.random() * 0.35,
        vy: 0.08 + Math.random() * 0.25,
        ph: Math.random() * Math.PI * 2,
      }));
    }
    function frame(t) {
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.y -= p.vy;
        const x = p.x + Math.sin(t / 2600 + p.ph) * 14;
        if (p.y < -40) p.y = h + 40;
        const tw = 0.6 + 0.4 * Math.sin(t / 900 + p.ph);
        const g = ctx.createRadialGradient(x, p.y, 0, x, p.y, p.r);
        g.addColorStop(0, `rgba(230,199,122,${p.a * tw})`);
        g.addColorStop(0.55, `rgba(201,162,74,${p.a * tw * 0.45})`);
        g.addColorStop(1, "rgba(201,162,74,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    resize();
    addEventListener("resize", debounce(resize, 200));
    new IntersectionObserver(([en]) => {
      if (en.isIntersecting && !running) {
        running = true;
        raf = requestAnimationFrame(frame);
      } else if (!en.isIntersecting && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    }).observe(cv);
  }

  /* ---------------------------------------------------------
     4.2 Header — vidro ao rolar, esconde/mostra, link ativo
     --------------------------------------------------------- */
  function header() {
    const hd = $("#header");
    const bar = $(".progress-bar");
    const toTop = $("#to-top");
    const mCta = $(".mobile-cta");
    const reserve = $("#reservas");
    const wa = $(".wa-float");
    let last = 0;
    let ticking = false;

    function update() {
      const y = scrollY;
      const max = document.documentElement.scrollHeight - innerHeight;
      const p = max > 0 ? y / max : 0;
      hd.classList.toggle("is-scrolled", y > 40);
      if (!root.classList.contains("menu-open")) hd.classList.toggle("is-hidden", y > last && y > 400);
      last = y;
      bar.style.setProperty("--p", p.toFixed(4));
      toTop.style.setProperty("--p", p.toFixed(4));
      toTop.classList.toggle("is-visible", y > innerHeight);
      wa.classList.toggle("is-hidden", y < innerHeight * 0.6);
      const r = reserve.getBoundingClientRect();
      mCta.classList.toggle("is-hidden", (r.top < innerHeight && r.bottom > 0) || root.classList.contains("menu-open"));
      ticking = false;
    }
    addEventListener("scroll", () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }, { passive: true });
    update();

    toTop.addEventListener("click", () => scrollToTarget(document.body));

    // Link ativo conforme a seção na tela
    const links = $$(".nav__link");
    const map = new Map(links.map((l) => [l.getAttribute("href").slice(1), l]));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          links.forEach((l) => {
            l.classList.remove("is-active");
            l.removeAttribute("aria-current");
          });
          const l = map.get(en.target.id);
          if (l) {
            l.classList.add("is-active");
            l.setAttribute("aria-current", "true");
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    ["inicio", "chef", "cardapio", "ambiente", "reservas", "contato"].forEach((id) => {
      const s = document.getElementById(id);
      if (s) io.observe(s);
    });
  }

  /* ---------------------------------------------------------
     Menu fullscreen
     --------------------------------------------------------- */
  const menu = $("#mobile-menu");
  const toggle = $("#menu-toggle");
  let menuTl = null;

  function openMenu() {
    menu.hidden = false;
    root.classList.add("menu-open");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Fechar menu");
    $(".mobile-cta").classList.add("is-hidden");
    lenis?.stop();
    document.body.style.overflow = "hidden";
    if (hasGSAP && !reduce) {
      menuTl?.kill();
      menuTl = gsap
        .timeline()
        .fromTo(menu, { clipPath: "circle(0% at 100% 0%)" }, { clipPath: "circle(150% at 100% 0%)", duration: 0.8, ease: "power3.inOut" })
        .from(".mobile-menu__list li", { yPercent: 60, autoAlpha: 0, stagger: 0.06, duration: 0.6, ease: "power3.out" }, 0.3)
        .from(".mobile-menu__foot, .mobile-menu__branch", { autoAlpha: 0, duration: 0.6 }, 0.5);
    }
    $(".mobile-menu__list a")?.focus({ preventScroll: true });
  }
  function closeMenu(returnFocus = true) {
    if (menu.hidden) return;
    root.classList.remove("menu-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Abrir menu");
    document.body.style.overflow = "";
    lenis?.start();
    const done = () => {
      menu.hidden = true;
      if (returnFocus) toggle.focus();
    };
    if (hasGSAP && !reduce) {
      menuTl?.kill();
      gsap.to(menu, { clipPath: "circle(0% at 100% 0%)", duration: 0.5, ease: "power3.in", onComplete: done });
    } else done();
  }
  toggle.addEventListener("click", () => (menu.hidden ? openMenu() : closeMenu()));
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeMenu();
      closeLightbox();
    }
  });

  /* ---------------------------------------------------------
     Reveals genéricos (títulos, scripts, parágrafos, imagens)
     --------------------------------------------------------- */
  function reveals() {
    if (!hasGSAP || reduce) return;

    // Títulos: linhas sobem de dentro de uma máscara
    $$("[data-split]").forEach((el) => {
      const lines = splitLines(el);
      gsap.from(lines, {
        yPercent: 110,
        duration: 1.1,
        stagger: 0.08,
        ease: "expo.out",
        scrollTrigger: { trigger: el, start: "top 88%" },
      });
    });

    // Script dourado sendo "escrito"
    $$("[data-script]").forEach((el) => {
      gsap.fromTo(
        el,
        { clipPath: "inset(-30% 100% -30% -10%)" },
        {
          clipPath: "inset(-30% -10% -30% -10%)",
          duration: 1.3,
          ease: "power2.inOut",
          scrollTrigger: { trigger: el, start: "top 88%" },
        }
      );
    });

    // Parágrafos linha a linha
    $$("[data-lines]").forEach((el) => {
      const lines = splitLines(el, false);
      gsap.from(lines, {
        y: 24,
        autoAlpha: 0,
        duration: 0.8,
        stagger: 0.08,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 90%" },
      });
    });

    // Imagens: cortina de baixo para cima + zoom-out 1.2 → 1
    $$("[data-reveal-img]").forEach((el) => {
      const img = $("img, svg", el);
      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 85%" } });
      tl.fromTo(el, { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.3, ease: "power4.out" }).fromTo(
        img,
        { scale: 1.2 },
        { scale: 1, duration: 1.4, ease: "power4.out" },
        0
      );
    });

    // Cards / passos: fade-up em lote
    ScrollTrigger.batch("[data-fade], .stats li, .contact__addr p, .hours tr, .footer__col", {
      start: "top 92%",
      once: true,
      onEnter: (els) => gsap.from(els, { y: 40, autoAlpha: 0, duration: 0.7, stagger: 0.1, ease: "power3.out" }),
    });
  }

  /* ---------------------------------------------------------
     Números animados
     --------------------------------------------------------- */
  function counters() {
    const fmt = (v, el) => (el.dataset.format === "thousands" ? Math.round(v).toLocaleString("pt-BR") : Math.round(v));
    $$("[data-count]").forEach((el) => {
      const end = +el.dataset.count;
      if (!hasGSAP || reduce) {
        el.textContent = fmt(end, el);
        return;
      }
      const o = { v: 0 };
      gsap.to(o, {
        v: end,
        duration: 1.8,
        ease: "power1.out",
        scrollTrigger: { trigger: el, start: "top 92%" },
        onUpdate: () => (el.textContent = fmt(o.v, el)),
      });
    });
  }

  /* ---------------------------------------------------------
     4.4 Marquee — velocidade e direção seguem o scroll
     --------------------------------------------------------- */
  function marquee() {
    const track = $(".marquee__track");
    if (!track || !hasGSAP || reduce) return;
    const group = $(".marquee__group", track);
    let x = 0;
    let dir = 1;
    let boost = 0;
    let gw = group.offsetWidth;
    addEventListener("resize", debounce(() => (gw = group.offsetWidth), 200));
    ScrollTrigger.create({
      trigger: ".marquee",
      start: "top bottom",
      end: "bottom top",
      onUpdate: (self) => {
        dir = self.direction;
        boost = Math.min(Math.abs(self.getVelocity()) / 120, 30);
      },
    });
    const setX = gsap.quickSetter(track, "x", "px");
    gsap.ticker.add((t, dt) => {
      const k = dt / 16.67;
      x -= dir * (0.6 + boost) * k;
      boost *= 0.92;
      if (x <= -gw) x += gw;
      if (x > 0) x -= gw;
      setX(x);
    });
  }

  /* ---------------------------------------------------------
     4.6 Assinaturas — pin horizontal (desktop) / carrossel (mobile)
     --------------------------------------------------------- */
  function signatures() {
    const sec = $(".signatures");
    const vp = $(".signatures__viewport");
    const track = $(".signatures__track");
    const bar = $(".signatures__progress");

    // Mobile / sem pin: progresso pelo scroll horizontal nativo
    vp.addEventListener("scroll", () => {
      const max = vp.scrollWidth - vp.clientWidth;
      bar.style.setProperty("--p", max > 0 ? (vp.scrollLeft / max).toFixed(3) : 0);
    }, { passive: true });

    if (!hasGSAP || reduce) return;
    const mm = gsap.matchMedia();
    mm.add("(min-width: 1024px)", () => {
      sec.classList.add("is-pinned");
      const dist = () => Math.max(0, track.scrollWidth - innerWidth);
      const tween = gsap.to(track, {
        x: () => -dist(),
        ease: "none",
        scrollTrigger: {
          trigger: sec,
          start: "top top",
          end: () => "+=" + dist(),
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => bar.style.setProperty("--p", self.progress.toFixed(3)),
        },
      });
      // Números grandes deslizam um pouco mais devagar (profundidade)
      $$(".sig-card__num", track).forEach((n) =>
        gsap.fromTo(n, { xPercent: 40 }, { xPercent: -40, ease: "none", scrollTrigger: { trigger: n.parentElement, containerAnimation: tween, start: "left right", end: "right left", scrub: true } })
      );
      return () => sec.classList.remove("is-pinned");
    });
    mm.add("(max-width: 1023px)", () => {
      gsap.from(".sig-card", { y: 40, autoAlpha: 0, duration: 0.8, stagger: 0.1, ease: "power3.out", scrollTrigger: { trigger: track, start: "top 85%" } });
    });
  }

  /* ---------------------------------------------------------
     4.7 Destaque cinematográfico — fundo preto → vinho → preto
     --------------------------------------------------------- */
  function cinema() {
    const sec = $(".cinema");
    if (!sec) return;
    if (hasGSAP && !reduce) {
      gsap
        .timeline({ scrollTrigger: { trigger: sec, start: "top bottom", end: "bottom top", scrub: true } })
        .to(sec, { backgroundColor: "#3B0A0F", ease: "none", duration: 1 })
        .to(sec, { backgroundColor: "#0A0908", ease: "none", duration: 1 });
      gsap.fromTo(".cinema__media", { scale: 0.8 }, { scale: 1, ease: "none", scrollTrigger: { trigger: sec, start: "top bottom", end: "center center", scrub: 1 } });
    } else {
      sec.style.background = "radial-gradient(80% 70% at 35% 50%, #3B0A0F, #0A0908)";
    }
    smoke($("#smoke"));
  }

  // Fumaça sutil subindo ao lado da imagem
  function smoke(cv) {
    if (!cv || reduce) return;
    const ctx = cv.getContext("2d");
    let w, h, puffs = [], running = false, raf;
    const N = innerWidth < 768 ? 14 : 26;
    function resize() {
      w = cv.width = cv.clientWidth;
      h = cv.height = cv.clientHeight;
    }
    function spawn(p = {}) {
      const left = innerWidth >= 1024 ? 0.5 : 0.5;
      return Object.assign(p, {
        x: w * (left + (Math.random() - 0.5) * 0.35),
        y: h * (0.62 + Math.random() * 0.2),
        r: 40 + Math.random() * 90,
        a: 0,
        life: 0,
        max: 380 + Math.random() * 300,
        vx: (Math.random() - 0.5) * 0.25,
        vy: -(0.25 + Math.random() * 0.45),
      });
    }
    function frame() {
      ctx.clearRect(0, 0, w, h);
      for (const p of puffs) {
        p.life++;
        p.x += p.vx + Math.sin(p.life / 60) * 0.2;
        p.y += p.vy;
        p.r += 0.18;
        const k = p.life / p.max;
        const a = Math.sin(Math.PI * Math.min(k, 1)) * 0.07;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, `rgba(235,225,215,${a})`);
        g.addColorStop(1, "rgba(235,225,215,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        if (p.life > p.max) spawn(p);
      }
      raf = requestAnimationFrame(frame);
    }
    resize();
    puffs = Array.from({ length: N }, () => {
      const p = spawn();
      p.life = Math.random() * p.max;
      return p;
    });
    addEventListener("resize", debounce(resize, 200));
    new IntersectionObserver(([en]) => {
      if (en.isIntersecting && !running) {
        running = true;
        raf = requestAnimationFrame(frame);
      } else if (!en.isIntersecting && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    }).observe(cv);
  }

  /* ---------------------------------------------------------
     4.8 Cardápio — abas, indicador, crossfade, preview no cursor
     --------------------------------------------------------- */
  function menuSection() {
    const data = window.MENU;
    const tabs = $$(".tab");
    const panel = $("#menu-panel");
    const indicator = $(".tabs__indicator");
    const cap = $("#menu-cap");
    const imgs = $$(".menu__img");
    if (!data || !panel) return;

    const fmtPrice = (p) => "R$ " + p.toLocaleString("pt-BR");
    const chefIcon =
      '<svg class="icon" aria-hidden="true"><use href="assets/icons.svg#i-chef-hat"/></svg><span class="sr-only">(recomendação do chef)</span>';

    function render(cat) {
      const c = data[cat];
      panel.innerHTML =
        '<ul class="menu-list">' +
        c.items
          .map(
            (it) =>
              `<li class="menu-item" data-thumb="${it.thumb || c.img}"><div class="menu-item__row"><h3>${it.name}${it.chef ? chefIcon : ""}</h3><span class="dots" aria-hidden="true"></span><span class="price">${fmtPrice(it.price)}</span></div><p>${it.desc}</p></li>`
          )
          .join("") +
        "</ul>";
    }

    function moveIndicator(tab) {
      const r = tab.getBoundingClientRect();
      const pr = tab.parentElement.getBoundingClientRect();
      const x = r.left - pr.left + tab.parentElement.scrollLeft;
      indicator.style.transform = `translateX(${x}px) scaleX(${r.width / 100})`;
    }

    function select(tab, focus = false) {
      const cat = tab.dataset.cat;
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute("aria-selected", on);
        t.tabIndex = on ? 0 : -1;
      });
      panel.setAttribute("aria-labelledby", tab.id);
      if (focus) tab.focus();
      tab.scrollIntoView({ block: "nearest", inline: "nearest" });
      moveIndicator(tab);
      // crossfade da imagem lateral
      imgs.forEach((im) => im.classList.toggle("is-active", im.dataset.img === data[cat].img));
      cap.textContent = data[cat].label;

      const swap = () => {
        render(cat);
        if (hasGSAP && !reduce) gsap.from($$(".menu-item", panel), { y: 18, autoAlpha: 0, duration: 0.5, stagger: 0.05, ease: "power3.out" });
      };
      if (hasGSAP && !reduce && panel.firstElementChild) {
        gsap.to(panel.firstElementChild, { autoAlpha: 0, y: -8, duration: 0.18, ease: "power2.in", onComplete: swap });
      } else swap();
    }

    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(t));
      t.addEventListener("keydown", (e) => {
        let j = null;
        if (e.key === "ArrowRight") j = (i + 1) % tabs.length;
        if (e.key === "ArrowLeft") j = (i - 1 + tabs.length) % tabs.length;
        if (e.key === "Home") j = 0;
        if (e.key === "End") j = tabs.length - 1;
        if (j !== null) {
          e.preventDefault();
          select(tabs[j], true);
        }
      });
    });
    render("niguiris");
    requestAnimationFrame(() => moveIndicator(tabs[0]));
    addEventListener("resize", debounce(() => moveIndicator($('.tab[aria-selected="true"]')), 150));
    document.fonts?.ready.then(() => moveIndicator($('.tab[aria-selected="true"]')));

    // Miniatura que segue o cursor (desktop)
    if (!finePointer || !hasGSAP) return;
    const pv = $(".menu-preview");
    const pvImg = $("img", pv);
    gsap.set(pv, { xPercent: -50, yPercent: -50, scale: 0.85 });
    const qx = gsap.quickTo(pv, "x", { duration: 0.5, ease: "power3.out" });
    const qy = gsap.quickTo(pv, "y", { duration: 0.5, ease: "power3.out" });
    panel.addEventListener("pointermove", (e) => {
      qx(e.clientX + 150);
      qy(e.clientY);
    });
    panel.addEventListener("pointerover", (e) => {
      const it = e.target.closest(".menu-item");
      if (!it) return;
      const src = IMG[it.dataset.thumb];
      if (!pvImg.src.endsWith(src)) pvImg.src = src;
      gsap.to(pv, { autoAlpha: 1, scale: 1, duration: 0.35, ease: "power3.out" });
    });
    panel.addEventListener("pointerleave", () => gsap.to(pv, { autoAlpha: 0, scale: 0.85, duration: 0.25 }));
  }

  /* ---------------------------------------------------------
     4.9 Ambiente — reveal com máscara, parallax interno, lightbox
     --------------------------------------------------------- */
  function ambient() {
    const items = $$(".bento__item");
    if (hasGSAP && !reduce) {
      items.forEach((it) => {
        // cantos arredondam ao entrar
        gsap.fromTo(
          it,
          { clipPath: "inset(14% 10% 14% 10% round 0px)" },
          { clipPath: "inset(0% 0% 0% 0% round 24px)", duration: 1.3, ease: "power4.out", scrollTrigger: { trigger: it, start: "top 88%" } }
        );
        // a foto se move dentro do container
        gsap.fromTo($("picture", it), { yPercent: -8 }, { yPercent: 8, ease: "none", scrollTrigger: { trigger: it, start: "top bottom", end: "bottom top", scrub: true } });
      });
      gsap.from(".bento__quote", { y: 40, autoAlpha: 0, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: ".bento__quote", start: "top 90%" } });
      gsap.from(".branch--tr", { autoAlpha: 0, x: 60, rotate: -6, duration: 1.6, ease: "power3.out", scrollTrigger: { trigger: ".ambient", start: "top 70%" } });
    }
    items.forEach((it) => it.addEventListener("click", () => openLightbox(it)));
    petals($("#petals"));
  }

  // Pétalas caindo — poucas e discretas
  function petals(cv) {
    if (!cv || reduce) return;
    const ctx = cv.getContext("2d");
    const dpr = Math.min(devicePixelRatio || 1, 2);
    let w, h, list, running = false, raf;
    const N = innerWidth < 768 ? 6 : 12;
    function resize() {
      w = cv.clientWidth;
      h = cv.clientHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const make = (p = {}, top = true) =>
      Object.assign(p, {
        x: Math.random() * w,
        y: top ? -20 : Math.random() * h,
        s: 5 + Math.random() * 6,
        vy: 0.35 + Math.random() * 0.5,
        vx: 0.2 + Math.random() * 0.4,
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 0.03,
        ph: Math.random() * 6,
      });
    function frame(t) {
      ctx.clearRect(0, 0, w, h);
      for (const p of list) {
        p.y += p.vy;
        p.x += p.vx + Math.sin(t / 1400 + p.ph) * 0.4;
        p.rot += p.vr;
        if (p.y > h + 20 || p.x > w + 20) make(p);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, 0.6 + 0.4 * Math.sin(t / 500 + p.ph));
        ctx.fillStyle = "rgba(200,16,46,0.55)";
        ctx.beginPath();
        ctx.moveTo(0, -p.s);
        ctx.quadraticCurveTo(p.s, -p.s * 0.2, 0, p.s);
        ctx.quadraticCurveTo(-p.s, -p.s * 0.2, 0, -p.s);
        ctx.fill();
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    }
    resize();
    list = Array.from({ length: N }, () => make({}, false));
    addEventListener("resize", debounce(resize, 200));
    new IntersectionObserver(([en]) => {
      if (en.isIntersecting && !running) {
        running = true;
        raf = requestAnimationFrame(frame);
      } else if (!en.isIntersecting && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    }).observe(cv);
  }

  // Lightbox com transição de elemento compartilhado (FLIP)
  const lb = $("#lightbox");
  const lbImg = $(".lightbox__img", lb);
  let lbSource = null;

  function openLightbox(item) {
    const src = $("img", item);
    lbSource = item;
    lbImg.src = src.currentSrc || src.src;
    lbImg.alt = src.alt;
    $(".lightbox__cap", lb).textContent = $(".bento__cap", item)?.textContent || "";
    lb.hidden = false;
    lenis?.stop();
    $("#lightbox-close").focus();
    if (!hasGSAP || reduce) return;
    const from = src.getBoundingClientRect();
    const run = () => {
      const to = lbImg.getBoundingClientRect();
      gsap.fromTo(lb, { backgroundColor: "rgba(5,4,4,0)" }, { backgroundColor: "rgba(5,4,4,0.92)", duration: 0.5 });
      gsap.fromTo(
        lbImg,
        {
          x: from.left + from.width / 2 - (to.left + to.width / 2),
          y: from.top + from.height / 2 - (to.top + to.height / 2),
          scale: Math.max(from.width / to.width, from.height / to.height),
        },
        { x: 0, y: 0, scale: 1, duration: 0.8, ease: "expo.out" }
      );
      gsap.from(".lightbox__cap, .lightbox__close", { autoAlpha: 0, duration: 0.4, delay: 0.3 });
    };
    lbImg.complete ? run() : (lbImg.onload = run);
  }
  function closeLightbox() {
    if (lb.hidden) return;
    const done = () => {
      lb.hidden = true;
      window.gsap?.set(lbImg, { clearProps: "all" });
      lenis?.start();
      lbSource?.focus();
    };
    if (!hasGSAP || reduce || !lbSource) return done();
    const from = $("img", lbSource).getBoundingClientRect();
    const to = lbImg.getBoundingClientRect();
    gsap.to(lb, { backgroundColor: "rgba(5,4,4,0)", duration: 0.35 });
    gsap.to(lbImg, {
      x: from.left + from.width / 2 - (to.left + to.width / 2),
      y: from.top + from.height / 2 - (to.top + to.height / 2),
      scale: Math.max(from.width / to.width, from.height / to.height),
      autoAlpha: 0.4,
      duration: 0.45,
      ease: "power3.in",
      onComplete: done,
    });
  }
  $("#lightbox-close").addEventListener("click", closeLightbox);
  lb.addEventListener("click", (e) => {
    if (e.target === lb) closeLightbox();
  });
  // mantém o foco dentro do diálogo
  lb.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      $("#lightbox-close").focus();
    }
  });

  /* ---------------------------------------------------------
     4.11 Depoimentos — carrossel acessível com autoplay pausável
     --------------------------------------------------------- */
  function reviews() {
    const track = $("#reviews-track");
    const slides = $$(".review", track);
    const dots = $("#reviews-dots");
    const btnToggle = $("#rev-toggle");
    let i = 0;
    let playing = !reduce;
    let hoverPause = false;
    let timer;

    slides.forEach(() => dots.appendChild(document.createElement("span")));

    function go(n) {
      i = (n + slides.length) % slides.length;
      const gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 20;
      const vpW = track.parentElement.clientWidth;
      const slideW = slides[0].offsetWidth + gap;
      const maxX = Math.max(0, track.scrollWidth - vpW);
      track.style.transform = `translateX(${-Math.min(i * slideW, maxX)}px)`;
      slides.forEach((s, k) => {
        s.classList.toggle("is-dim", k !== i);
        s.setAttribute("aria-hidden", k !== i);
      });
      $$("span", dots).forEach((d, k) => d.classList.toggle("is-active", k === i));
    }
    function schedule() {
      clearInterval(timer);
      if (playing && !hoverPause) timer = setInterval(() => go(i + 1), 6000);
    }
    function setPlaying(v) {
      playing = v;
      btnToggle.setAttribute("aria-pressed", !v);
      btnToggle.setAttribute("aria-label", v ? "Pausar rotação automática" : "Retomar rotação automática");
      $("use", btnToggle).setAttribute("href", `assets/icons.svg#i-${v ? "pause" : "play"}`);
      track.setAttribute("aria-live", v ? "off" : "polite");
      schedule();
    }
    $("#rev-prev").addEventListener("click", () => (go(i - 1), schedule()));
    $("#rev-next").addEventListener("click", () => (go(i + 1), schedule()));
    btnToggle.addEventListener("click", () => setPlaying(!playing));
    const vp = track.parentElement;
    vp.addEventListener("pointerenter", () => ((hoverPause = true), schedule()));
    vp.addEventListener("pointerleave", () => ((hoverPause = false), schedule()));
    vp.addEventListener("focusin", () => ((hoverPause = true), schedule()));
    vp.addEventListener("focusout", () => ((hoverPause = false), schedule()));
    $(".reviews").addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") go(i + 1);
      if (e.key === "ArrowLeft") go(i - 1);
    });
    // swipe
    let sx = null;
    vp.addEventListener("pointerdown", (e) => (sx = e.clientX));
    vp.addEventListener("pointerup", (e) => {
      if (sx === null) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
      sx = null;
    });
    addEventListener("resize", debounce(() => go(i), 150));
    go(0);
    setPlaying(playing);

    if (hasGSAP && !reduce) gsap.from(vp, { y: 60, autoAlpha: 0, duration: 1, ease: "power3.out", scrollTrigger: { trigger: vp, start: "top 88%" } });
  }

  /* ---------------------------------------------------------
     4.12 Reservas — diagonal no scroll, card com spring, validação
     --------------------------------------------------------- */
  function reserve() {
    if (hasGSAP && !reduce) {
      gsap.fromTo(
        ".reserve__diag",
        { clipPath: "polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)" },
        { clipPath: "polygon(0% 32%, 100% 0%, 100% 68%, 0% 100%)", ease: "none", scrollTrigger: { trigger: ".reserve", start: "top bottom", end: "center center", scrub: 1 } }
      );
      gsap.from(".reserve__form", { y: 120, autoAlpha: 0, duration: 1.6, ease: "elastic.out(1, 0.8)", scrollTrigger: { trigger: ".reserve__form", start: "top 90%" } });
    }

    const form = $("#reserve-form");
    const success = $("#form-success");
    const date = $("#f-date");
    const today = new Date();
    const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    date.min = iso(today);

    // máscara simples de telefone
    $("#f-phone").addEventListener("input", (e) => {
      const v = e.target.value.replace(/\D/g, "").slice(0, 11);
      let out = v;
      if (v.length > 2) out = `(${v.slice(0, 2)}) ${v.slice(2)}`;
      if (v.length > 7) out = `(${v.slice(0, 2)}) ${v.slice(2, v.length - 4)}-${v.slice(-4)}`;
      e.target.value = out;
    });

    const rules = {
      name: (v) => (v.trim().length >= 3 ? "" : "Informe seu nome completo."),
      phone: (v) => (/^\d{10,11}$/.test(v.replace(/\D/g, "")) ? "" : "Informe um telefone com DDD."),
      people: (v) => (v ? "" : "Selecione o número de pessoas."),
      date: (v) => {
        if (!v) return "Escolha uma data.";
        const d = new Date(v + "T12:00:00");
        if (v < iso(today)) return "Escolha uma data a partir de hoje.";
        if (d.getDay() === 1) return "Fechamos às segundas. Escolha outro dia.";
        return "";
      },
      time: (v) => (v ? "" : "Escolha um horário."),
    };
    function check(input) {
      const rule = rules[input.name];
      if (!rule) return true;
      const msg = rule(input.value);
      const field = input.closest(".field");
      field.classList.toggle("is-invalid", !!msg);
      input.setAttribute("aria-invalid", !!msg);
      $(".field__error", field).textContent = msg;
      return !msg;
    }
    $$("input, select", form).forEach((el) => {
      el.addEventListener("blur", () => el.value && check(el));
      el.addEventListener("input", () => el.closest(".field").classList.contains("is-invalid") && check(el));
      el.addEventListener("change", () => el.closest(".field").classList.contains("is-invalid") && check(el));
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const inputs = $$("[name]", form).filter((el) => rules[el.name]);
      const results = inputs.map(check);
      const firstBad = inputs[results.indexOf(false)];
      if (firstBad) {
        firstBad.focus();
        return;
      }
      const fd = Object.fromEntries(new FormData(form));
      const [y, m, d] = fd.date.split("-");
      const msg = `Olá! Gostaria de reservar uma mesa.\nNome: ${fd.name}\nTelefone: ${fd.phone}\nData: ${d}/${m}/${y} às ${fd.time}\nPessoas: ${fd.people}${fd.notes ? "\nObs.: " + fd.notes : ""}`;
      if (FORM_ENDPOINT) {
        try {
          await fetch(FORM_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fd) });
        } catch (err) {
          /* segue para o WhatsApp como alternativa */
        }
      }
      // monta a mensagem com textContent (sem injetar HTML do usuário)
      const out = $("#form-success-msg");
      const link = document.createElement("a");
      link.className = "gold";
      link.href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "Confirme pelo WhatsApp";
      out.textContent = `${fd.name.trim().split(" ")[0]}, sua mesa para ${fd.people} em ${d}/${m} às ${fd.time} está quase lá. `;
      out.append(link, ".");
      success.hidden = false;
      if (hasGSAP && !reduce) {
        const paths = $$(".form-success__icon circle, .form-success__icon path", success);
        paths.forEach((p) => {
          const l = p.getTotalLength();
          gsap.fromTo(p, { strokeDasharray: l, strokeDashoffset: l }, { strokeDashoffset: 0, duration: 0.8, ease: "power2.out", delay: p.tagName === "path" ? 0.45 : 0 });
        });
        gsap.from(success, { autoAlpha: 0, duration: 0.4 });
        gsap.from($$("h3, p, button", success), { y: 16, autoAlpha: 0, stagger: 0.08, duration: 0.6, delay: 0.3, ease: "power3.out" });
      }
      $("#form-again").focus();
    });
    $("#form-again").addEventListener("click", () => {
      form.reset();
      success.hidden = true;
      $("#f-name").focus();
    });

    // "Reservar Omakase" preenche observação
    $$("[data-omakase]").forEach((b) =>
      b.addEventListener("click", () => {
        const n = $("#f-notes");
        if (!n.value) n.value = "Omakase no balcão";
      })
    );
  }

  /* ---------------------------------------------------------
     Newsletter, footer, cursor, ano
     --------------------------------------------------------- */
  function footer() {
    const nl = $("#newsletter");
    nl.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = $("#nl-email");
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value);
      $("#nl-msg").textContent = ok ? "Obrigado! Você receberá o menu da próxima estação." : "Digite um e-mail válido.";
      input.setAttribute("aria-invalid", !ok);
      if (ok) input.value = "";
    });
    $("#year").textContent = new Date().getFullYear();

    if (hasGSAP && !reduce) {
      gsap.fromTo(".footer__word span", { yPercent: 100 }, { yPercent: 0, ease: "none", scrollTrigger: { trigger: ".footer__word", start: "top bottom", end: "bottom bottom", scrub: 1 } });
    }
  }

  function cursor() {
    if (!finePointer || !hasGSAP) return;
    const c = $(".cursor");
    const label = $(".cursor__label", c);
    const dur = reduce ? 0 : 0.35;
    const qx = gsap.quickTo(c, "x", { duration: dur, ease: "power3.out" });
    const qy = gsap.quickTo(c, "y", { duration: dur, ease: "power3.out" });
    addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      c.classList.add("is-visible");
      qx(e.clientX);
      qy(e.clientY);
    });
    document.addEventListener("pointerleave", () => c.classList.remove("is-visible"));
    document.addEventListener("pointerover", (e) => {
      const t = e.target.closest("[data-cursor]");
      c.classList.toggle("is-active", !!t);
      if (t) label.textContent = t.dataset.cursor;
    });
  }

  function debounce(fn, ms) {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  }

  /* ---------------------------------------------------------
     Boot
     --------------------------------------------------------- */
  initLenis();
  header();
  menuSection();
  reviews();
  reserve();
  footer();
  cursor();
  counters();
  bokeh();
  marquee();
  signatures();
  cinema();
  ambient();

  // Splits dependem das fontes carregadas para medir linhas corretamente
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, new Promise((r) => setTimeout(r, 1500))]).then(() => {
    reveals();
    runPreloader().then(heroIntro);
    if (hasGSAP) {
      // gatilhos abaixo do pin precisam ser calculados depois dele
      ScrollTrigger.sort();
      ScrollTrigger.refresh();
    }
  });
})();
