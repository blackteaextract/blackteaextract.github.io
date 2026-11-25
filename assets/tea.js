// Tea, kept for the whole browser tab (sessionStorage):
// - steeping: while a mouse moves on the page, the background slowly takes on
//   a faint tea colour (full strength after 4 minutes). Mouse only.
// - dunking: hovering the name dips the "_" like a tea bag. Mouse only.
// - brewing: the [ brew ] button on the home page is a real 4-minute tea
//   timer; the page steeps to full strength along with it.
(function () {
  var FULL = 240, IDLE = 1.5, TICK = 0.5, DUNK = 5;
  var mouse = matchMedia("(hover: hover) and (pointer: fine)").matches;
  var still = matchMedia("(prefers-reduced-motion: reduce)").matches;

  var root = document.documentElement, state = { t: 0, dunks: 0 };
  try { Object.assign(state, JSON.parse(sessionStorage.getItem("tea")) || {}); } catch (e) {}
  function save() { try { sessionStorage.setItem("tea", JSON.stringify(state)); } catch (e) {} }
  function render() {
    root.style.setProperty("--steep", Math.min(state.t / FULL, 1).toFixed(4));
    root.style.setProperty("--dunks", Math.min(state.dunks, 8));
  }
  render();

  if (mouse) {
    var lastMove = -Infinity;
    addEventListener("mousemove", function () { lastMove = performance.now(); }, { passive: true });
    setInterval(function () {
      if (state.t >= FULL || performance.now() - lastMove > IDLE * 1000) return;
      state.t += TICK; render(); save();
    }, TICK * 1000);
  }

  addEventListener("DOMContentLoaded", function () {
    if (mouse) document.querySelectorAll(".name").forEach(dunk);
    var button = document.querySelector(".brew");
    if (button) brew(button);
  });

  function dunk(name) {
    var bag = name.querySelector(".bag"), dipping = false;
    if (!bag) return;
    name.addEventListener("mouseenter", function () {
      if (dipping) return;
      dipping = true;
      state.dunks++; state.t = Math.min(state.t + DUNK, FULL); render(); save();
      if (still) { dipping = false; return; }
      bag.animate(
        [{ transform: "translateY(0)" }, { transform: "translateY(.22em)" }, { transform: "translateY(0)" }],
        { duration: 900, easing: "ease-in-out" }
      ).onfinish = function () { dipping = false; };
    });
  }

  function brew(button) {
    var title = document.title, timer = null, hush = 0;
    button.hidden = false;

    function show(text) { button.textContent = text; }
    function tick() {
      var left = Math.ceil((state.brewEnd - Date.now()) / 1000);
      if (left <= 0) return done(true);
      var p = 1 - left / FULL;
      state.t = Math.max(state.t, state.brewFrom + (FULL - state.brewFrom) * p);
      render(); save();
      if (Date.now() > hush) show("steeping… " + Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0"));
    }
    function done(live) {
      clearInterval(timer); timer = null;
      delete state.brewEnd; delete state.brewFrom;
      state.t = FULL; render(); save();
      show("your tea is ready. go drink it.");
      if (live) document.title = "tea's ready · " + title;
    }
    function start() {
      state.brewEnd = Date.now() + FULL * 1000;
      state.brewFrom = state.t;
      document.title = title;
      timer = setInterval(tick, 250); tick();
    }

    button.addEventListener("click", function () {
      if (!timer) return start();
      hush = Date.now() + 1500; show("patience.");
    });

    if (state.brewEnd > Date.now()) { timer = setInterval(tick, 250); tick(); }
    else if (state.brewEnd) done(false);
  }
})();
