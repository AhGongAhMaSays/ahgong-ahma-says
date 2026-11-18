/* ============================================================
   AhGong & AhMa Says — landing page scroll choreography
   ------------------------------------------------------------
   One tall "runway" (.scroll-wrap) drives a fixed stage.
   Scroll progress 0 -> 1 is split into two beats:

     beat 1  (phrase swap)  : "li ho bo?"  slides up & out,
                              "say more than just hello" rises in.
     beat 2  (scene swap)   : the whole illustration + phrase
                              lift away; PLAY! / LEARN! rise up.
   ============================================================ */

(function () {
  var wrap    = document.querySelector('.scroll-wrap');
  var hero    = document.querySelector('.scene-hero');
  var cta     = document.querySelector('.scene-cta');
  var p1      = document.querySelector('.phrase--one');
  var p2      = document.querySelector('.phrase--two');
  var bigBtns = Array.prototype.slice.call(document.querySelectorAll('.big-btn'));

  /* --- beat windows (fractions of total scroll progress) ---
     Snap points land at 0.0 (scene 1), 0.5 (scene 2) and 1.0 (scene 3),
     so each beat has to finish inside its half. --- */
  var B1_START = 0.02, B1_END = 0.48;   // phrase swap  (scene 1 -> 2)
  var B2_START = 0.52, B2_END = 0.98;   // scene swap   (scene 2 -> 3)

  var clamp = function (n) { return n < 0 ? 0 : n > 1 ? 1 : n; };
  // smootherstep — gentle ease in and out
  var ease  = function (t) { return t * t * t * (t * (t * 6 - 15) + 10); };
  var span  = function (p, a, b) { return ease(clamp((p - a) / (b - a))); };

  var target     = 0;   // progress the scroll position wants
  var pending    = false;
  var scrollable = 0;   // wrap.offsetHeight - innerHeight, cached — see cacheMetrics()

  // offsetHeight forces a synchronous layout recalculation to read — fine
  // once, but reading it inside readProgress() (which can fire dozens of
  // times a second during a touch scroll) meant every single scroll event
  // forced a layout, which is exactly the kind of thing that reads as
  // "laggy" on a phone. It only needs recomputing when the page's own
  // height actually changes, so it's cached here instead.
  function cacheMetrics() {
    scrollable = wrap.offsetHeight - window.innerHeight;
  }

  // Same choreography at every screen size — only the CSS composition
  // inside each scene changes with viewport width (see the media query).
  function readProgress() {
    target = scrollable > 0 ? clamp(window.scrollY / scrollable) : 0;
    if (!pending) { pending = true; requestAnimationFrame(tick); }
  }

  function render(p) {
    /* ---------- beat 1 : phrase swap ---------- */
    var a = span(p, B1_START, B1_END);
    p1.style.setProperty('--p1-y', (-170 * a) + 'px');
    p1.style.setProperty('--p1-o', String(1 - a));
    p2.style.setProperty('--p2-y', (90 * (1 - a)) + 'px');
    p2.style.setProperty('--p2-o', String(a));

    /* ---------- beat 2 : scene swap ---------- */
    var b = span(p, B2_START, B2_END);
    hero.style.setProperty('--hero-y', (-115 * b) + 'vh');
    hero.style.setProperty('--hero-o', String(clamp(1 - b * 1.5)));
    cta.style.setProperty('--cta-y', (100 * (1 - b)) + 'vh');

    for (var i = 0; i < bigBtns.length; i++) {
      var local = ease(clamp((b - i * 0.12) / (1 - i * 0.12)));
      var el = bigBtns[i];
      el.style.setProperty('--b-y', (50 * (1 - local)) + 'px');
      el.style.setProperty('--b-s', String(0.72 + 0.28 * local));
      el.style.setProperty('--b-o', String(local));
    }
  }

  // 1:1 with the scroll position — no easing, no catch-up glide.
  // rAF only throttles rendering to the frame rate.
  function tick() {
    pending = false;
    render(target);
  }

  function onResize() {
    cacheMetrics();
    readProgress();
  }

  window.addEventListener('scroll', readProgress, { passive: true });
  window.addEventListener('resize', onResize);
  cacheMetrics();
  readProgress();
  render(target);

  /* ============================================================
     Audio button — plays a recording of the phrase if one is
     dropped in at assets/audio/li-ho-bo.mp3 (silent no-op until
     the file exists). Built lazily on click so there's no request
     — and no console 404 — for a clip that isn't there yet.
     ============================================================ */
  var audioBtn = document.querySelector('.audio-btn');
  var clip = null;
  if (audioBtn) {
    audioBtn.addEventListener('click', function () {
      clip = clip || new Audio('assets/audio/li-ho-bo.mp3');
      clip.currentTime = 0;
      var pr = clip.play();
      if (pr && pr.catch) pr.catch(function () { /* no clip yet — ignore */ });
    });
  }

  /* ============================================================
     Idle scroll hint — after 5s with no cursor movement, nudge the
     visitor to keep scrolling. Hidden once they're at the last scene,
     since there's nothing further down from there. Any cursor move or
     scroll hides it again and restarts the 5s wait.
     ============================================================ */
  var hint = document.querySelector('.scroll-hint');
  if (hint) {
    var IDLE_MS = 2000;
    var idleTimer = null;

    var showHint = function () {
      if (target < B2_END) hint.classList.add('is-visible');
    };
    var hideHint = function () {
      hint.classList.remove('is-visible');
    };
    var resetIdleTimer = function () {
      hideHint();
      clearTimeout(idleTimer);
      idleTimer = setTimeout(showHint, IDLE_MS);
    };

    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('scroll', resetIdleTimer, { passive: true });
    resetIdleTimer();
  }
})();
