/* Latar bintang, navigasi aktif, progres gulir, dan tombol salin. */
(function () {
  "use strict";

  /* ---------- Latar bintang ---------- */
  var canvas = document.getElementById("stars");
  var ctx = canvas && canvas.getContext ? canvas.getContext("2d") : null;
  var reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  var W = 0, H = 0, dpr = 1;
  var stars = [];
  var shooters = [];
  var mouseX = 0, mouseY = 0, smoothX = 0, smoothY = 0;
  var scrollY = 0;
  var nextShooter = 3000;
  var rafId = 0;
  var lastT = 0;

  var LAYERS = [
    { density: 0.00012, r: [0.4, 0.9], depth: 0.012, a: [0.3, 0.65] },
    { density: 0.00005, r: [0.7, 1.3], depth: 0.03, a: [0.5, 0.9] },
    { density: 0.000016, r: [1.1, 1.9], depth: 0.06, a: [0.7, 1] }
  ];
  var TINTS = ["255,255,255", "255,226,184", "190,212,255"];

  function rand(a, b) { return a + Math.random() * (b - a); }

  function buildStars() {
    stars = [];
    LAYERS.forEach(function (layer, li) {
      var n = Math.round(W * H * layer.density);
      for (var i = 0; i < n; i++) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: rand(layer.r[0], layer.r[1]),
          a: rand(layer.a[0], layer.a[1]),
          depth: layer.depth,
          phase: Math.random() * Math.PI * 2,
          speed: rand(0.6, 1.8),
          tint: TINTS[Math.random() < 0.7 ? 0 : (Math.random() < 0.5 ? 1 : 2)],
          layer: li
        });
      }
    });
  }

  function resize() {
    if (!canvas || !ctx) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildStars();
    if (reduceQuery.matches) draw(0);
  }

  function wrap(v, max) { return ((v % max) + max) % max; }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    var animate = !reduceQuery.matches;

    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var px = s.x + (animate ? smoothX * s.depth * 90 : 0);
      var py = s.y - scrollY * s.depth * 6 + (animate ? smoothY * s.depth * 90 : 0);
      var x = wrap(px, W);
      var y = wrap(py, H);
      var tw = animate ? 0.62 + 0.38 * Math.sin(t * 0.001 * s.speed + s.phase) : 1;
      ctx.fillStyle = "rgba(" + s.tint + "," + (s.a * tw).toFixed(3) + ")";
      if (s.r < 1) {
        ctx.fillRect(x, y, s.r * 1.6, s.r * 1.6);
      } else {
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (var j = shooters.length - 1; j >= 0; j--) {
      var sh = shooters[j];
      var life = (t - sh.born) / sh.dur;
      if (life >= 1) { shooters.splice(j, 1); continue; }
      var dist = sh.len * 6 * life;
      var hx = sh.x + Math.cos(sh.angle) * dist;
      var hy = sh.y + Math.sin(sh.angle) * dist;
      var tx = hx - Math.cos(sh.angle) * sh.len;
      var ty = hy - Math.sin(sh.angle) * sh.len;
      var fade = Math.sin(life * Math.PI);
      var g = ctx.createLinearGradient(tx, ty, hx, hy);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(1, "rgba(255,240,215," + (0.9 * fade).toFixed(3) + ")");
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(hx, hy);
      ctx.stroke();
    }
  }

  function frame(t) {
    var dt = t - lastT;
    lastT = t;
    var k = Math.min(1, dt / 120);
    smoothX += (mouseX - smoothX) * k;
    smoothY += (mouseY - smoothY) * k;

    if (t > nextShooter && shooters.length < 2) {
      shooters.push({
        x: rand(W * 0.1, W * 0.9),
        y: rand(0, H * 0.45),
        angle: rand(0.35, 0.85),
        len: rand(90, 160),
        dur: rand(900, 1400),
        born: t
      });
      nextShooter = t + rand(4500, 9500);
    }

    draw(t);
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (!ctx || reduceQuery.matches || rafId) return;
    lastT = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  }

  if (ctx) {
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", function (e) {
      mouseX = (e.clientX / window.innerWidth - 0.5) * -2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * -2;
    }, { passive: true });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop(); else start();
    });
    var onMotionChange = function () {
      if (reduceQuery.matches) { stop(); draw(0); } else { start(); }
    };
    if (reduceQuery.addEventListener) reduceQuery.addEventListener("change", onMotionChange);
    else if (reduceQuery.addListener) reduceQuery.addListener(onMotionChange);
    if (reduceQuery.matches) draw(0); else start();
  }

  /* ---------- Progres gulir dan posisi bintang ---------- */
  var progressEl = document.querySelector(".nav__progress");
  var ticking = false;

  function onScroll() {
    scrollY = window.scrollY || window.pageYOffset || 0;
    if (progressEl) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
      progressEl.style.setProperty("--p", p.toFixed(4));
    }
    if (reduceQuery.matches && ctx) draw(0);
    ticking = false;
  }

  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  /* ---------- Tautan navigasi aktif ---------- */
  var links = Array.prototype.slice.call(document.querySelectorAll("[data-nav]"));
  var sections = links
    .map(function (a) { return document.getElementById(a.getAttribute("data-nav")); })
    .filter(Boolean);

  if ("IntersectionObserver" in window && sections.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) {
          a.classList.toggle("is-active", a.getAttribute("data-nav") === entry.target.id);
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
    sections.forEach(function (s) { io.observe(s); });
  }

  /* ---------- Tombol salin ---------- */
  var statusEl = document.getElementById("copy-status");

  function selectText(el) {
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function markDone(btn, ok) {
    var original = btn.getAttribute("data-label") || btn.textContent;
    btn.setAttribute("data-label", original);
    btn.textContent = ok ? "Disalin" : "Pilih teks";
    btn.classList.toggle("is-done", ok);
    if (statusEl) statusEl.textContent = ok ? "Teks disalin ke papan klip." : "Teks dipilih, tekan salin secara manual.";
    setTimeout(function () {
      btn.textContent = original;
      btn.classList.remove("is-done");
    }, 1800);
  }

  Array.prototype.forEach.call(document.querySelectorAll(".copy"), function (btn) {
    btn.addEventListener("click", function () {
      var target = document.getElementById(btn.getAttribute("data-copy"));
      if (!target) return;
      var text = target.textContent.trim();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          function () { markDone(btn, true); },
          function () { selectText(target); markDone(btn, false); }
        );
      } else {
        selectText(target);
        markDone(btn, false);
      }
    });
  });
})();
