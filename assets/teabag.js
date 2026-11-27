// The tea bag cursor (click the "_" in the name) and, while holding it, a hidden
// tea table (circle the mouse or type "tea"): flick sugar cubes into the cup with
// a spoon catapult. Mouse only, off with reduced motion.
(function () {
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var STEP = 1 / 120, G = 1300, AIR = 0.988, ITER = 8, SEG = 6, ROPE = 6, BAG = 20;
  // the spoon's angle points from the pivot to the bowl, from REST (bowl down) to STOP
  var CUBE = 20, ARM = 100, TAIL = 55, REST = Math.PI - 0.3, STOP = Math.PI + 0.78;
  var SCENE = 520, SCENE_MAX = 820; // how far from the table's left end the cup can stand
  var PIV = 140; // the hinge, from the table's left end
  var HOLD = { x: 4, y: 16 }; // where a carried cube hangs off the pointer
  var GRIP = 40; // a carried spoon is held this far from the end of its handle
  var STIR = 900, TURNS = 8; // stirring needed: px through the tea, and changes of direction
  var ROLL = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0";
  var HS = 1.15; // the hand's scale
  // the bag, its tag, and its string (KN links of KL), at 12.5 px to the cm
  var BW = 62, BH = 78, TW = 30, TH = 24, KN = 10, KL = 18;

  var root = document.documentElement, dark = matchMedia("(prefers-color-scheme: dark)");
  var cv, ctx, W = 0, H = 0, col = {}, held = false;
  var m = { x: 0, y: 0, on: false, link: false, down: false, moved: 0 };
  var p = [], spin = 0, lastAng = null, typed = "";
  var game = null, raf = 0, last = 0, acc = 0;
  try { held = sessionStorage.getItem("teabag") === "1"; } catch (e) {}

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // --- the bag on a string ---------------------------------------------------
  // p: 0 the tag (the pointer), 1..ROPE-1 string, ROPE and ROPE+1 the bag's top and bottom; w: inverse mass

  function hang() {
    p = [];
    for (var i = 0; i <= ROPE + 1; i++) {
      var y = m.y + 4 + Math.min(i, ROPE) * SEG + (i > ROPE ? BAG : 0);
      p.push({ x: m.x, y: y, px: m.x, py: y, w: i === 0 ? 0 : i >= ROPE ? 0.25 : 1 });
    }
    lastAng = null;
  }

  function link(a, b, len, stiff) {
    var dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
    if (!stiff && d <= len) return;
    var k = (d - len) / d / (a.w + b.w);
    a.x += dx * k * a.w; a.y += dy * k * a.w;
    b.x -= dx * k * b.w; b.y -= dy * k * b.w;
  }

  function step(dt) {
    var g = G * dt * dt, i, q;
    p[0].x = m.x; p[0].y = m.y + 4;
    for (i = 1; i < p.length; i++) {
      q = p[i];
      var vx = (q.x - q.px) * AIR, vy = (q.y - q.py) * AIR;
      q.px = q.x; q.py = q.y;
      q.x += vx; q.y += vy + g;
    }
    for (var k = 0; k < ITER; k++) {
      for (i = 0; i < ROPE; i++) link(p[i], p[i + 1], SEG, false);
      link(p[ROPE], p[ROPE + 1], BAG, true);
    }
  }

  // opening the table: 3.5 quick loops one way, with the bag swinging round too
  var turn = 0, lastDir = null, lastM = null;
  function unwrap(da) { return da > Math.PI ? da - 2 * Math.PI : da < -Math.PI ? da + 2 * Math.PI : da; }
  function track(dt) {
    var keep = Math.exp(-dt / 1.5);
    if (lastM) {
      var vx = m.x - lastM.x, vy = m.y - lastM.y;
      if (vx * vx + vy * vy > 4) {
        var dir = Math.atan2(vy, vx);
        if (lastDir !== null) turn = turn * keep + unwrap(dir - lastDir);
        lastDir = dir;
      } else { turn *= keep; lastDir = null; }
    }
    lastM = { x: m.x, y: m.y };
    var a = p[ROPE], b = p[ROPE + 1], dx = (a.x + b.x) / 2 - p[0].x, dy = (a.y + b.y) / 2 - p[0].y;
    if (dx * dx + dy * dy < 225) return;
    var ang = Math.atan2(dy, dx);
    if (lastAng !== null) spin = spin * keep + unwrap(ang - lastAng);
    lastAng = ang;
    var loop = 2 * Math.PI;
    if (Math.abs(turn) > 3.5 * loop && Math.abs(spin) > 2 * loop && turn * spin > 0) start();
  }

  function hold(on) {
    if (!on && game) return leave(); // the table goes first; gone() then puts the bag back
    held = on;
    try { sessionStorage.setItem("teabag", on ? "1" : "0"); } catch (e) {}
    document.querySelectorAll(".bag").forEach(function (b) { b.classList.toggle("taken", on); });
    root.classList.toggle("teabag", on && m.on && !game);
    if (on) hang();
    wake();
  }

  // --- the table -------------------------------------------------------------
  // in window coordinates, shifted along on scroll; physics runs in fixed STEPs

  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function lay() {
    var g = game, r = g.spot.getBoundingClientRect(), w = Math.min(r.width, clamp(r.width * 0.65, SCENE, SCENE_MAX)), left = r.left;
    if (g.ox !== undefined && (left !== g.ox || r.top !== g.oy)) {
      var dx = left - g.ox, dy = r.top - g.oy;
      g.cubes.concat(g.drops).forEach(function (k) { k.x += dx; k.y += dy; });
      if (g.carry && g.carry.from && g.carry.from.x !== undefined) { g.carry.from.x += dx; g.carry.from.y += dy; }
      if (g.hand) { g.hand.x += dx; g.hand.y += dy; }
      if (g.spoon) { g.spoon.bx += dx; g.spoon.by += dy; }
    }
    g.ox = left; g.oy = r.top;
    g.L = r.left; g.R = r.right; g.ground = r.top + 176;
    g.wall = g.R;
    g.pivot = { x: g.L + PIV, y: g.ground - 2 * CUBE };
    // right of the pile, the handle on the table
    var hi = Math.max(PIV + 160, w - 104);
    g.span = [Math.min(300, hi), hi];
    g.cupTo = clamp(g.cupTo, g.span[0], g.span[1]);
    g.cupAt = clamp(g.cupAt, g.span[0], g.span[1]);
    cupPlace();
  }
  // dish: the saucer's top, left of the cup
  function cupPlace() {
    var g = game, cx = g.L + g.cupAt, bottom = g.ground - 12, top = bottom - 96;
    g.cup = { l: cx - 70, r: cx + 70, cx: cx, top: top, surf: top + 8, bottom: bottom, dish: g.ground - 14 };
  }
  function bowl(a) { var q = game.pivot; return { x: q.x + Math.cos(a) * ARM, y: q.y + Math.sin(a) * ARM }; }
  function tail(a) { var q = game.pivot; return { x: q.x - Math.cos(a) * TAIL, y: q.y - Math.sin(a) * TAIL }; }

  function start() {
    var foot = document.querySelector("main footer");
    if (game || !foot || !m.on) return;
    var spot = document.createElement("div");
    spot.className = "cup-spot";
    spot.innerHTML = '<div class="cup-ui"><button type="button">[ again ]</button><button type="button">[ close ]</button></div>';
    var buttons = spot.querySelectorAll("button");
    buttons[0].addEventListener("click", again);
    buttons[1].addEventListener("click", leave);
    foot.parentNode.insertBefore(spot, foot);
    spot.offsetHeight; // so the height transition runs
    spot.classList.add("on");
    spin = turn = 0;
    root.classList.remove("teabag");
    game = { spot: spot, againButton: buttons[0], rise: 0, dir: 1, cubes: [], drops: [], cupAt: 0, cupTo: 0, sway: 0 };
    lay();
    again();
    setTimeout(function () {
      var r = spot.getBoundingClientRect();
      if (r.top < 0 || r.bottom > innerHeight) spot.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 600);
    wake();
  }
  function again() {
    if (!game) return;
    var g = game, s = g.span;
    g.cupAt = g.cupTo = s[0] + (s[1] - s[0]) * 0.65;
    cupPlace();
    g.cubes = [thing("bag", 0, 0, "steep")];
    g.drops = []; g.splash = null; g.carry = null; g.tag = null;
    g.ripple = 0; g.stir = 0; g.shuffle = 0; g.brew = 0.35;
    g.spoon = null; g.stirred = 0; g.roll = 0;
    var old = g.spot.querySelector("iframe");
    if (old) old.remove();
    g.arm = { a: REST, pa: REST, w: 0, lo: REST, hi: STOP, load: "cube", seed: Math.random() * 100 };
    var r = restPose();
    g.hand = { x: r.x + 90, y: r.y, a: r.a, curl: 0, state: "rest", t: 9, show: 0 };
    var x0 = g.pivot.x + TAIL + 20;
    [[0, 0], [1, 0], [2, 0], [0.5, 1], [1.5, 1]].forEach(function (o) {
      g.cubes.push(thing("cube", x0 + o[0] * (CUBE + 1), g.ground - CUBE / 2 - o[1] * CUBE, "rest"));
    });
  }
  function leave() {
    if (!game || game.dir < 0) return;
    game.dir = -1; wake();
    game.spot.classList.add("leaving");
  }
  function gone() {
    var spot = game.spot;
    spot.classList.remove("on");
    setTimeout(function () { spot.remove(); }, 600);
    game = null;
    root.classList.remove("grab", "grabbing");
    hold(false);
  }

  // seed: its own wobble in the drawing
  function thing(kind, x, y, state) {
    return { kind: kind, x: x, y: y, vx: 0, vy: 0, ang: 0, va: 0, state: state || "fly", t: 0, seed: Math.random() * 100 };
  }
  // where a carried thing can be dropped: above the table, not over the cup
  function zone(x, y, kind) {
    var g = game;
    if (!g || g.rise !== 1) return false;
    var bag = kind === "bag", c = g.cup, b = bagAt(x, y), cx = bag ? b.x : x + HOLD.x, w = bag ? BW / 2 : CUBE / 2;
    if (cx < g.L + w || cx > g.wall - w) return false;
    if (cx + w > c.l - 10 && cx - w < c.r + 34) return false;
    return (bag ? b.y + BH / 2 : y + HOLD.y + CUBE / 2) < surface(cx, w) - 6;
  }
  // the highest thing under something 2w wide at cx
  function surface(cx, w) {
    var g = game, q = g.pivot, t = floorAt(cx), s;
    if (Math.abs(cx - q.x) < CUBE / 2 + w) t = Math.min(t, q.y);
    for (var e = -w; e <= w; e += w) { s = spoonAt(cx + e, g.arm.a, g.arm.load); if (s !== null && s < t) t = s; }
    g.cubes.forEach(function (k) {
      if ((k.state === "rest" || k.state === "fly") && Math.abs(k.x - cx) < wide(k) + w) t = Math.min(t, k.y - half(k));
    });
    return t;
  }
  function drop(x, y, kind, ang, quiet) {
    var k = thing(kind, x, y);
    k.ang = ang || 0;
    if (!quiet) k.va = (Math.random() - 0.5) * 2;
    game.cubes.push(k);
    return k;
  }
  // the steeping bag bobs in the tea, its tag hanging outside the cup
  function steep(k, c) {
    var dip = 8 * Math.exp(-k.t * 3) * Math.cos(k.t * 7);
    k.x = c.cx - 18; k.y = c.bottom - 14 - BH / 2 + dip; k.ang = 0.03 + Math.sin(k.t * 1.3) * 0.03;
    k.tag = { x: c.l - 9, y: c.top + 46, ang: 0.08 };
  }
  // how far a thing reaches down (half) and sideways (wide) from its centre at its angle
  function half(k) {
    var c = Math.abs(Math.cos(k.ang)), s = Math.abs(Math.sin(k.ang));
    return k.kind === "bag" ? BH / 2 * c + BW / 2 * s : CUBE / 2 * (c + s);
  }
  function wide(k) {
    var c = Math.abs(Math.cos(k.ang)), s = Math.abs(Math.sin(k.ang));
    return k.kind === "bag" ? BW / 2 * c + BH / 2 * s : CUBE / 2 * (c + s);
  }
  // a carried bag hangs by its top under the pointer
  function bagAt(x, y) { var d = BH / 2 + 4, a = game.sway; return { x: x - Math.sin(a) * d, y: y + Math.cos(a) * d, ang: a }; }
  function floorAt(x) { var c = game.cup; return x > c.l - 24 && x < c.l ? c.dish : game.ground; }
  // on the floor: bounce, slide and tip onto a flat side, then rest once still
  function settle(k, floor, dt) {
    var bag = k.kind === "bag";
    k.y = floor - half(k);
    if (k.vy > 0) {
      if (k.vy > 90) { k.vy = -k.vy * (bag ? 0.1 : 0.3); k.va += k.vx / (bag ? 150 : 30); }
      else k.vy = 0;
    }
    k.vx *= Math.exp(-dt * (bag ? 8 : 3));
    k.va += (k.vx * (bag ? 0.003 : 0.03) - (bag ? 30 : 70) * Math.sin(4 * k.ang) - k.va * (bag ? 14 : 4.5)) * dt;
    if (Math.abs(k.vx) < 4 && Math.abs(k.vy) < 4 && Math.abs(k.va) < 0.15 && Math.abs(Math.sin(4 * k.ang)) < 0.05) {
      k.state = "rest"; k.t = 0; k.vx = k.vy = k.va = 0;
      k.ang = Math.round(k.ang / (Math.PI / 2)) * (Math.PI / 2);
      k.y = floor - half(k);
    }
  }
  function overCup(x, y) { var c = game.cup; return x > c.l - 10 && x < c.r + 10 && y < c.bottom && y > c.top - 160; }
  // a new spot for the cup, clear of anything on the table
  function place() {
    var g = game, s = g.span;
    for (var n = 0; n < 16; n++) {
      var at = s[0] + Math.random() * (s[1] - s[0]), mid = g.L + at + 3;
      if (Math.abs(at - g.cupAt) < 30 && s[1] - s[0] > 60) continue;
      if (!g.cubes.some(function (k) { return k.state === "rest" && Math.abs(k.x - mid) < 99 + wide(k); })) return at;
    }
    return g.cupTo;
  }
  // what the pointer would pick up: a cube index, "bowl", "spoon" or null
  function under(x, y) {
    var g = game, best = -1;
    if (g.roll) return null;
    g.cubes.forEach(function (k, i) {
      var slow = k.state === "fly" && Math.abs(k.vx) + Math.abs(k.vy) < 40;
      if ((k.state === "rest" || slow) && Math.abs(k.x - x) < wide(k) + 4 && Math.abs(k.y - y) < half(k) + 4 &&
        (best < 0 || k.y < g.cubes[best].y)) best = i;
    });
    if (best >= 0) return best;
    var inBowl = g.arm.load === "bag" && still(g.arm);
    if (g.tag) {
      var tx = (g.tag[KN].x + g.tag[KN + 1].x) / 2, ty = (g.tag[KN].y + g.tag[KN + 1].y) / 2;
      if (Math.abs(tx - x) < TW / 2 && Math.abs(ty - y) < TW / 2) {
        if (inBowl) return "bowl";
        for (var j = 0; j < g.cubes.length; j++) {
          if (g.cubes[j].kind === "bag" && (g.cubes[j].state === "rest" || g.cubes[j].state === "fly")) return j;
        }
      }
    }
    for (var i = 0; i < g.cubes.length; i++) {
      var k = g.cubes[i];
      if (k.state === "steep" && k.tag && ((Math.abs(k.tag.x - x) < TW / 2 + 2 && Math.abs(k.tag.y - y) < TH / 2 + 2) ||
        (Math.abs(k.x - x) < BW / 2 && Math.abs(k.y - y) < BH / 2))) return i;
    }
    if (g.arm.load && still(g.arm)) {
      var a = g.arm.a, b = bowl(a);
      if (Math.abs(b.x - x) < CUBE && Math.abs(b.y - CUBE / 2 - y) < CUBE) return "bowl";
      if (inBowl) { // anywhere on the bag, as drawn
        var up = BH / 2 + 2, dx = x - (b.x - Math.sin(a) * up), dy = y - (b.y + Math.cos(a) * up);
        var u = dx * Math.cos(a) + dy * Math.sin(a), v = -dx * Math.sin(a) + dy * Math.cos(a);
        if (Math.abs(u) < BW / 2 + 4 && Math.abs(v) < BH / 2 + 4) return "bowl";
      }
    }
    // the empty spoon, once every cube is in
    if (!g.arm.load && !g.arm.gone && still(g.arm) && !cubesLeft()) {
      var e = bowl(g.arm.a), t = tail(g.arm.a), vx = t.x - e.x, vy = t.y - e.y;
      var f = clamp(((x - e.x) * vx + (y - e.y) * vy) / (vx * vx + vy * vy), 0, 1);
      if (Math.hypot(e.x + vx * f - x, e.y + vy * f - y) < (f < 0.15 ? 14 : 8)) return "spoon";
    }
    return null;
  }
  function pick(x, y) {
    var g = game, i = under(x, y);
    if (i === null) return false;
    if (i === "spoon") {
      var b = bowl(g.arm.a);
      g.carry = { kind: "spoon" }; g.arm.gone = true;
      g.spoon = { bx: b.x, by: b.y, inCup: false, sgn: 0, turns: 0 };
      return true;
    }
    if (i === "bowl") { g.carry = { kind: g.arm.load, from: "bowl", seed: g.arm.seed }; g.arm.load = null; return true; }
    var k = g.cubes.splice(i, 1)[0];
    g.carry = { kind: k.kind, from: k.state === "steep" ? "cup" : { x: k.x, y: k.y }, seed: k.seed };
    return true;
  }
  // dropped above the table, otherwise back where it came from
  function release(x, y) {
    var g = game, c = g.carry, b = bagAt(x, y), k;
    if (!c) return;
    g.carry = null;
    if (c.kind === "spoon") return putSpoon();
    if (zone(x, y, c.kind)) {
      k = c.kind === "bag" ? drop(b.x, b.y, "bag", b.ang) : drop(x + HOLD.x, y + HOLD.y, "cube", g.sway * 0.5);
    } else if (c.kind === "bag" && (c.from === "cup" || overCup(b.x, b.y))) {
      k = thing("bag", 0, 0, "steep"); g.cubes.push(k);
    } else if (c.from === "bowl" && !g.arm.load && still(g.arm)) {
      g.arm.load = c.kind; g.arm.seed = c.seed; return;
    } else if (c.from === "bowl" || c.from === "cup") { // its place is taken
      k = drop(c.from === "bowl" ? g.pivot.x + TAIL + 30 : g.cup.l - 40, g.ground - 80, c.kind, 0, true);
    } else k = drop(c.from.x, c.from.y, c.kind, 0, true);
    k.seed = c.seed;
  }

  // the top of the spoon (or its load) at x, null past either end
  function loadTop(load) { return load === "bag" ? BH + 2 : load ? 22 : 3; }
  function spoonAt(x, a, load) {
    if (game.arm.gone) return null;
    var b = bowl(a), t = tail(a);
    if (x < b.x - 14 || x > t.x + 4) return null;
    var y = b.y + (t.y - b.y) * clamp((x - b.x) / (t.x - b.x), 0, 1);
    return y - (x < b.x + 12 ? loadTop(load) : 3);
  }

  // spoonAt across 2w, so a wide bag rests on the load instead of slipping off
  function spoonUnder(x, w, a, load) {
    var t = null;
    for (var e = -w; e <= w; e += w) { var s = spoonAt(x + e, a, load); if (s !== null && (t === null || s < t)) t = s; }
    return t;
  }

  // The spoon is a rigid lever: angle a, spin w (+ = bowl up and over). The load
  // flies only when the handle hits bottom and the spoon stops dead.
  var M = { bowl: 0.3, handle: 0.1, load: 0.6, slam: 3 };
  function inertia(arm) { return M.bowl * ARM * ARM + M.handle * TAIL * TAIL / 4 + (arm.load ? M.load * ARM * ARM : 0); }
  function torque(arm) {
    var c = Math.cos(arm.a);
    return G * ((M.bowl + (arm.load ? M.load : 0)) * c * ARM - M.handle * c * TAIL / 2);
  }
  // how far things lying under the spoon let it swing: [bowl limit, handle limit, thing under the handle]
  function limits(a) {
    var q = game.pivot, lo = REST, hi = STOP, under = null;
    game.cubes.forEach(function (k) {
      if (k.state !== "rest" && k.state !== "fly") return;
      var w = wide(k), dy = k.y - half(k) - q.y;
      for (var e = -1; e <= 1; e += 2) {
        var dx = k.x + e * w - q.x, d = Math.sqrt(dx * dx + dy * dy), f = Math.atan2(dy, dx), th;
        if (dx < 0 && d < ARM + 19) {
          th = Math.abs(d - ARM) < 19 ? Math.max(2.5, 8 * Math.sqrt(1 - Math.pow((d - ARM) / 19, 2))) : 2.5;
          f = (f < 0 ? f + 2 * Math.PI : f) + Math.asin(Math.min(1, th / d));
          if (f <= a + 0.02 && f > lo) lo = f;
        } else if (dx > 0 && d < TAIL + 3) {
          f = Math.PI + f - Math.asin(Math.min(1, 2.5 / d));
          if (f >= a - 0.02 && f < hi) { hi = f; under = k; }
        }
      }
    });
    return [lo, Math.max(lo, hi), under];
  }
  function lever(dt) {
    if (game.arm.gone) { game.arm.pa = game.arm.a; return; }
    var arm = game.arm, lim = limits(arm.a);
    arm.pa = arm.a; arm.lo = lim[0]; arm.hi = lim[1];
    arm.w += torque(arm) / inertia(arm) * dt;
    arm.a += arm.w * dt;
    if (arm.a < arm.lo) { // the bowl lands on the table
      arm.a = arm.lo;
      arm.w = arm.w < -0.6 ? -arm.w * 0.3 : 0;
    }
    if (arm.a > arm.hi) { // the handle hits: the spoon stops dead
      arm.a = arm.hi;
      if (arm.load && arm.w > 0) fling(arm);
      var k = lim[2];
      if (k && arm.w > 1) { // and swats what's under it
        k.state = "fly"; k.vx += 60 + arm.w * 25; k.vy = -60 - arm.w * 15; k.va += 6;
      }
      arm.w = -arm.w * 0.2;
    }
  }
  function fling(arm) {
    var b = bowl(arm.a), v = arm.w * ARM, s = Math.sin(arm.a), c = Math.cos(arm.a);
    var up = arm.load === "bag" ? BH / 2 + 2 : CUBE / 2 + 2;
    var k = thing(arm.load, b.x - s * up, b.y + c * up);
    k.vx = -s * v; k.vy = c * v; k.ang = arm.a - Math.PI; k.va = arm.w * (0.5 + Math.random()); k.seed = arm.seed;
    arm.load = null;
    game.cubes.push(k);
  }
  // a thing lands on the spoon rx from the hinge; slow ones just lie on it
  function hit(k, rx) {
    var arm = game.arm, I = inertia(arm), vs = arm.w * rx, vrel = k.vy - vs;
    if (vrel <= 0) return;
    var soft = k.kind === "bag" ? 150 : 60;
    if (vrel < soft) { k.vy = vs; return; }
    var J = 1.3 * vrel / (1 / M.slam + rx * rx / I);
    arm.w += J * rx / I;
    if ((arm.a <= arm.lo + 1e-3 && arm.w < 0) || (arm.a >= arm.hi - 1e-3 && arm.w > 0)) {
      arm.w = 0; k.vy = -0.3 * vrel; // against a stop: the table takes it
    } else k.vy -= J / M.slam;
    var kick = Math.min(1, (vrel - soft) / 180) * (rx > 0 ? 1 : -1);
    k.vx += kick * 50; k.va += kick * 6;
  }
  function still(arm) { return !arm.gone && arm.a <= arm.lo + 0.001 && Math.abs(arm.w) < 0.01; }

  function splash(x, n) {
    var c = game.cup;
    game.splash = { x: x, t: 0 };
    for (var i = 0; i < n; i++) {
      game.drops.push({ x: x + (Math.random() - 0.5) * 10, y: c.surf - 2, vx: (Math.random() - 0.5) * 150,
        vy: -150 - Math.random() * 170, r: 0.9 + Math.random() * 0.9, t: 0 });
    }
  }

  // boxes pushed apart along their shallower overlap; a lying thing only moves for a real knock
  var MASS = { cube: 1, bag: 2 };
  function bump(a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var ox = wide(a) + wide(b) - 1 - Math.abs(dx), oy = half(a) + half(b) - 1 - Math.abs(dy);
    if (ox <= 0 || oy <= 0 || ((a.lob || b.lob) && b.state === "fly")) return;
    var ma = MASS[a.kind], mb = MASS[b.kind], im = 1 / ma + 1 / mb, lying = b.state === "rest", n, vrel, J;
    if (ox < oy) { // side by side
      n = dx < 0 ? -1 : 1; vrel = (a.vx - b.vx) * n;
      if (lying) a.x -= n * ox; else { a.x -= n * ox / ma / im; b.x += n * ox / mb / im; }
      if (vrel <= 0) return;
      J = 1.3 * vrel / im;
      if (lying && J / mb < 25) { a.vx = -n * Math.abs(a.vx) * 0.3; return; } // too soft to shift it
      a.vx -= n * J / ma; b.vx += n * J / mb;
      var rub = clamp((a.vy - b.vy) * 0.02, -4, 4);
      a.va -= n * rub; b.va += n * rub;
      if (lying) { b.state = "fly"; b.t = 0; b.vy = -Math.min(60, J / mb * 0.15); }
    } else if (!lying) { // stacked, both moving
      n = dy < 0 ? -1 : 1; vrel = (a.vy - b.vy) * n;
      if (n > 0) a.y -= oy; else b.y -= oy;
      if (vrel <= 0) return;
      if (vrel < 80) { a.vy = b.vy = (ma * a.vy + mb * b.vy) / (ma + mb); return; } // gently: it just lies on it
      J = 1.2 * vrel / im;
      a.vy -= n * J / ma; b.vy += n * J / mb;
      var slip = clamp((a.vx - b.vx) * 0.02, -4, 4);
      a.va += n * slip; b.va -= n * slip;
    }
  }
  // landing hard on things lying there shoves them aside
  function knock(k, under) {
    var w = wide(k), m = MASS[k.kind];
    under.forEach(function (r) {
      var s = clamp((r.x - k.x) / (wide(r) + w), -1, 1), push = s * k.vy * 0.3 * m / MASS[r.kind];
      if (Math.abs(push) < 25) return;
      r.state = "fly"; r.t = 0; r.vx += push; r.vy = -Math.min(80, k.vy * 0.08); r.va += s * 5;
      k.vx -= push * 0.5 * MASS[r.kind] / m;
    });
  }
  // which way k tips off what's under it (-1 left, 1 right), 0 if held up
  function overhang(k, under) {
    if (!under.length) return 0;
    var lo = Infinity, hi = -Infinity;
    under.forEach(function (r) { lo = Math.min(lo, r.x - wide(r)); hi = Math.max(hi, r.x + wide(r)); });
    return k.x < lo - 0.5 ? -1 : k.x > hi + 0.5 ? 1 : 0;
  }

  // false once it has gone into the bowl
  function fly(k, dt) {
    var g = game, arm = g.arm, q = g.pivot, px = k.x, py = k.y, h, w;
    k.vy += G * dt; k.x += k.vx * dt; k.y += k.vy * dt; k.ang += k.va * dt;
    h = half(k); w = wide(k);
    if (k.pop && k.vy >= 0) { k.pop = false; slap(k); } // flicked up by the hand: slapped at the top
    // the load in the bowl stops things sliding down the spoon
    if (arm.load) {
      var b = bowl(arm.a), lt = spoonAt(b.x, arm.a, arm.load);
      if (k.x - w < b.x + 12 && px - w >= b.x + 11 && k.y + h > lt + 2 && k.y - h < b.y + 10) {
        k.x = b.x + 12 + w; k.vx = Math.abs(k.vx) * 0.3;
      }
    }
    // checked before and after the swing, so a fast one can't pass through
    var sy = spoonUnder(k.x, w, arm.a, arm.load), sy0 = spoonUnder(px, w, arm.pa, arm.load);
    if (sy0 === null) sy0 = sy;
    if (sy !== null && py + h <= sy0 + 3 && k.y + h >= sy) {
      var rx = k.x - q.x, s = Math.tan(arm.a);
      if (!arm.load && rx < -ARM + 26 && Math.abs(arm.w) < 2) { // into the bowl
        arm.load = k.kind; arm.seed = k.seed; arm.w += M.load * k.vy * rx / inertia(arm) * 0.5;
        if (arm.a <= arm.lo && arm.w < 0) arm.w = 0;
        return false;
      }
      k.y = sy - h;
      hit(k, rx);
      // slide down the slope, turning flat onto it
      k.vx += G * s / (1 + s * s) * dt; k.vx *= Math.exp(-dt * 1.5);
      var lie = Math.atan(s), flat = lie + Math.round((k.ang - lie) / (Math.PI / 2)) * (Math.PI / 2);
      k.va += ((flat - k.ang) * 60 - k.va * 10) * dt;
    } else if (k.x !== px && !arm.gone) { // into the spoon from the side
      var b0 = bowl(arm.a), t0 = tail(arm.a);
      if (k.x + w > b0.x - 19 && k.x - w < t0.x + 3) {
        var ly = b0.y + (t0.y - b0.y) * clamp((k.x - b0.x) / (t0.x - b0.x), 0, 1);
        if (k.y + h > ly - 2 && k.y - h < ly + 6) { k.x = px; k.vx = -k.vx * 0.3; }
      }
    }
    cup(k, px, py);
    if (k.state !== "fly") return true;
    // the hinge
    if (k.y + h > q.y + 2 && Math.abs(k.x - q.x) < CUBE / 2 + w) {
      var side = px < q.x ? -1 : 1;
      k.x = q.x + side * (CUBE / 2 + w); k.vx = side * Math.abs(k.vx) * 0.35;
    }
    var floor = floorAt(k.x), under = [];
    g.cubes.forEach(function (r) {
      if (r === k || (r.state !== "rest" && r.state !== "fly")) return;
      var top = r.y - half(r);
      if (r.state === "rest" && Math.abs(k.x - r.x) < wide(r) + w - 2 && py + h <= top + 4) {
        if (top < floor - 0.5) { floor = top; under = [r]; } else if (top < floor + 0.5) under.push(r);
      } else bump(k, r);
    });
    if (k.y + h >= floor) {
      k.lob = k.pop = k.popped = false;
      if (under.length && k.vy > 260) knock(k, under);
      settle(k, floor, dt);
      var tip = overhang(k, under);
      if (tip && (tip < 0 ? k.x - w > g.L + 0.5 : k.x + w < g.wall - 0.5)) {
        k.state = "fly"; k.vx += tip * 260 * dt; k.va += tip * 12 * dt;
      }
    }
    // the table's ends; on the right the hand slaps it back
    if (k.x < g.L + w) { k.x = g.L + w; k.vx = Math.abs(k.vx) * 0.4; }
    if (k.x > g.wall - w) { k.x = g.wall - w; if (k.vx > 40) slap(k); else k.vx = Math.min(k.vx, 0); }
    if (k.y - h > g.ground) k.y = g.ground - h;
    return true;
  }
  // in at the top, off the rim and handle, not through the sides
  function cup(k, px, py) {
    var g = game, c = g.cup, h = half(k), w = wide(k), open = k.x > c.l + 4 && k.x < c.r - 4, hr = c.r + 30;
    if (open && py < c.top && k.y >= c.top) {
      if (k.kind === "bag") {
        k.state = "steep"; k.t = 0; steep(k, c);
        g.ripple = Math.min(6, g.ripple + 3); splash(k.x, 3);
      } else {
        k.state = "in"; k.t = 0; k.vy = 40; k.vx *= 0.1;
        g.ripple = Math.min(6, g.ripple + 4); splash(k.x, 6);
        g.shuffle = 0.6;
      }
      g.stir = 1;
      return;
    }
    if (!open && py + h <= c.top && k.y + h > c.top && k.x + w > c.l && k.x - w < c.r) { // the rim
      var out = k.x < c.cx ? -1 : 1;
      k.y = c.top - h; k.vy = -Math.abs(k.vy) * 0.35; k.vx = out * Math.max(out * k.vx, 40); k.va = out * 4;
    } else if (py + h <= c.top + 10 && k.y + h > c.top + 10 && k.x > c.r && k.x - w < hr) { // the handle
      k.y = c.top + 10 - h; k.vy = -Math.abs(k.vy) * 0.3; k.vx = Math.max(k.vx, 0) + 40;
    }
    var right = k.y + h > c.top + 10 ? hr : c.r;
    if (k.y + h > c.top + 2 && k.x + w > c.l && k.x - w < right && !(open && py < c.top)) {
      if (px < c.cx) { k.x = c.l - w; k.vx = -Math.abs(k.vx) * 0.35; }
      else { k.x = right + w; k.vx = Math.abs(k.vx) * 0.35; }
    }
  }

  // --- stirring --------------------------------------------------------------
  // the carried spoon's bowl gets into the cup only over the rim, then stays inside
  function spoonCarry(dt) {
    var g = game, c = g.cup, s = g.spoon, L = ARM + TAIL - GRIP;
    var f = Math.min(1, dt * 30), px = s.bx, py = s.by;
    var bx = px + (m.x - Math.sin(g.sway) * L - px) * f, by = py + (m.y + Math.cos(g.sway) * L - py) * f;
    if (s.inCup && by < c.top) s.inCup = false;
    else if (!s.inCup && py <= c.top && by > c.top && bx > c.l + 12 && bx < c.r - 12) s.inCup = true;
    if (s.inCup) {
      // the whole bowl (19 by 8, turned) stays inside, clear of the rounded corners
      var a = spoonAng(bx, by, c), ca = Math.abs(Math.cos(a)), sa = Math.abs(Math.sin(a));
      var ex = 19 * ca + 8 * sa + 4, ey = 19 * sa + 8 * ca + 3;
      bx = clamp(bx, c.l + ex, c.r - ex);
      var corner = Math.max(0, 30 - Math.min(bx - ex - c.l, c.r - bx - ex));
      by = Math.min(by, c.bottom - ey - corner * 0.6);
    }
    else if (by > c.top && bx > c.l - 20 && bx < c.r + 40) bx = px < c.cx ? c.l - 20 : c.r + 40;
    s.bx = clamp(bx, g.L + 10, g.wall - 10); s.by = Math.min(by, floorAt(s.bx) - 5);
    s.a = spoonAng(s.bx, s.by, s.inCup ? c : null);
    if (!s.inCup || s.by < c.surf + 2) return;
    var dx = s.bx - px;
    g.stirred += Math.abs(dx);
    if (Math.abs(dx) > 0.5) {
      var sg = dx > 0 ? 1 : -1;
      if (s.sgn && sg !== s.sgn) s.turns++;
      s.sgn = sg;
    }
    g.ripple = Math.min(6, g.ripple + Math.abs(dx) * 0.08); g.stir = 1;
    if (g.stirred > STIR && s.turns >= TURNS) roll();
  }
  // handle to bowl: towards the pointer, never upside down, and out over the rim of cup c
  function spoonAng(bx, by, c) {
    var a = Math.atan2(Math.max(by - m.y, 60), bx - m.x);
    if (!c || by <= c.top) return a;
    var d = by - c.top, xr = clamp(bx - d * Math.cos(a) / Math.sin(a), c.l + 6, c.r - 6);
    return Math.atan2(d, bx - xr);
  }
  function putSpoon() {
    var arm = game.arm;
    arm.gone = false; arm.a = arm.pa = REST; arm.w = 0;
    game.spoon = null;
  }
  // stirred enough: the table fades and a video takes its place
  function roll() {
    var g = game, c = g.cup;
    g.carry = null; putSpoon(); g.roll = 1e-3;
    var v = document.createElement("iframe"), w = 313, left = clamp(c.cx - g.L - w / 2, 0, Math.max(0, g.R - g.L - w));
    v.className = "cup-roll"; v.src = ROLL; v.title = "a surprise";
    v.allow = "autoplay; encrypted-media; picture-in-picture"; v.allowFullscreen = true;
    v.style.left = left + "px";
    g.spot.appendChild(v);
    setTimeout(function () { v.classList.add("on"); }, 500);
  }

  // --- the hand --------------------------------------------------------------
  // Slaps back whatever flies past the cup and moves the cup by its handle (only
  // while nothing is flying). A pose: wrist x, y and direction a to the fingertips.
  function norm(a) { return a - 2 * Math.PI * Math.round(a / (2 * Math.PI)); }
  function restPose() { var g = game; return { x: g.wall + 58 * HS, y: g.ground - 12.5 * HS, a: Math.PI }; }
  // standing at the table's end for a thing at height y; lean > 0 drawn back, < 0 follow-through
  function chop(y, lean) {
    var g = game;
    return { x: g.wall + 12 * HS + lean * 18, y: Math.min(y + 30 * HS, g.ground - 13 * HS) + Math.min(0, lean) * 10,
      a: -Math.PI / 2 + (lean > 0 ? lean * 0.3 : lean) };
  }
  // fingertips flicked up, for something sliding in
  function flick() { var r = restPose(); return { x: r.x - 4, y: r.y - 2, a: Math.PI + 0.35 }; }
  // holding the cup by its handle
  function grip() { var g = game; return { x: g.L + g.cupAt + 136, y: g.ground - 67, a: Math.PI }; }

  // when and how high the first flying thing will reach the table's end
  function threat() {
    var g = game, c = g.cup, best = null;
    g.cubes.forEach(function (k) {
      if (k.state !== "fly" || k.vx < 30) return;
      var x = k.x, y = k.y, vy = k.vy, h = half(k), w = wide(k), dt = 1 / 60;
      for (var t = 0; t < 1.2; t += dt) {
        if (x + w >= g.wall) { if (!best || t < best.t) best = { y: y, t: t }; return; }
        if (y + h > g.ground) return;
        if (x + w > c.l && x - w < c.r + 30 && y + h > c.top) return;
        vy += G * dt; x += k.vx * dt; y += vy * dt;
      }
    });
    return best;
  }
  // whether a throw stays clear of the cup until it lands (h: the thing's reach)
  function clears(x, y, vx, vy, h) {
    var g = game, c = g.cup, dt = 1 / 120;
    for (var t = 0; t < 3; t += dt) {
      vy += G * dt; x += vx * dt; y += vy * dt;
      if (x + h > c.l - 6 && x - h < c.r + 36 && y + h > c.top - 6) return false;
      if (y + h > g.ground) return true;
    }
    return true;
  }
  // back over the cup: between spoon and cup (not on the spoon, that would throw
  // its load), else into the empty bowl, else the table's left end
  function lob(k) {
    var g = game, c = g.cup, bag = k.kind === "bag";
    var h = bag ? Math.hypot(BW, BH) / 2 : 15, land = g.ground - (bag ? BW / 2 : CUBE / 2);
    var lo = g.pivot.x + TAIL + 15, hi = c.l - h - 8, b = bowl(REST).x, aims = [];
    if (hi >= lo) aims.push(function () { return lo + (hi - lo) * Math.random(); });
    if (!g.arm.load && still(g.arm)) aims.push(function () { return b + 4; });
    aims.push(function () { return g.L + 12; });
    for (var i = 0; i < aims.length; i++) {
      for (var n = 0; n < 12; n++) {
        var xt = aims[i](), top = Math.min(k.y, c.top - h) - 20 - n * 15;
        var up = Math.sqrt(2 * (k.y - top) / G), T = up + Math.sqrt(2 * (land - top) / G);
        var vx = (xt - k.x) / T, vy = -G * up;
        if (clears(k.x, k.y, vx, vy, h)) { k.vx = vx; k.vy = vy; return true; }
      }
    }
    return false;
  }
  function slap(k) {
    var g = game, hd = g.hand;
    hd.flick = hd.state !== "ready" && k.y > g.ground - 40;
    // a lobbed thing passes through other flying things (see bump())
    k.lob = lob(k);
    if (!k.lob && !k.popped) { // too low to clear the cup: flicked straight up first
      k.pop = k.popped = true; k.vx = -5;
      k.vy = -Math.sqrt(2 * G * Math.max(20, k.y - (g.cup.top - half(k) - 60)));
      hd.flick = false;
    } else if (!k.lob) { k.vx = -15; k.vy = Math.max(k.vy, 0) * 0.3; } // no way over: it drops
    k.va = -(3 + Math.random() * 6);
    hd.hy = k.y; hd.state = "follow"; hd.t = 0;
  }
  function hand(dt) {
    var g = game, hd = g.hand, th = g.rise === 1 ? threat() : null, goal, rate = 8, curl = 0;
    // anything that could still come down by the cup ("fly" includes things just rocking)
    var flying = g.cubes.some(function (k) {
      return k.state === "fly" && (Math.abs(k.vx) > 60 || k.vy < -60 || k.y + half(k) < g.cup.top);
    });
    function to(s) { hd.state = s; hd.t = 0; }
    hd.t += dt;
    if (hd.state === "follow") { if (hd.t > 0.2) to("rest"); }
    else if (th) { if (hd.state !== "ready") to("ready"); }
    else if (hd.state === "ready") to("rest");
    if (hd.state === "rest" && Math.abs(g.cupTo - g.cupAt) > 0.5) to("fetch");
    if (hd.state === "ready") {
      var wind = th.t > 0.07; // drawn back, then the swing
      goal = chop(th.y, wind ? 0.5 : -0.15); rate = wind ? 22 : 60;
    } else if (hd.state === "follow") {
      goal = hd.flick ? flick() : chop(hd.hy, -0.6); rate = 30;
    } else if (hd.state === "fetch") {
      goal = grip(); rate = 10;
      if (Math.abs(hd.x - goal.x) + Math.abs(hd.y - goal.y) < 6) curl = 1;
      if (curl && hd.curl > 0.9) to("carry");
    } else if (hd.state === "carry") {
      var d = g.cupTo - g.cupAt, v = Math.max(20, Math.min(160, Math.abs(d) * 5)) * Math.min(1, hd.t * 3);
      if (!flying) g.cupAt += clamp(d, -v * dt, v * dt);
      if (Math.abs(g.cupTo - g.cupAt) < 0.3) { g.cupAt = g.cupTo; to("rest"); }
      else curl = 1;
      goal = grip(); rate = 1 / dt;
    } else { // stays a moment, then goes
      goal = restPose();
      if (hd.t > 0.8) goal.x += 90;
    }
    var need = hd.state !== "rest" || hd.t < 0.8;
    hd.show += ((need ? 1 : 0) - hd.show) * Math.min(1, dt * (need ? 12 : 4));
    var f = Math.min(1, rate * dt);
    hd.x += (goal.x - hd.x) * f; hd.y += (goal.y - hd.y) * f;
    hd.a = norm(hd.a + unwrap(norm(goal.a - hd.a)) * f);
    hd.curl += (curl - hd.curl) * Math.min(1, dt * 12);
  }

  function play(dt) {
    var g = game, c = g.cup;
    if (g.roll) g.roll += dt;
    if (g.carry && g.carry.kind === "spoon") spoonCarry(dt);
    g.ripple *= Math.exp(-dt * 3);
    g.stir = Math.max(0, g.stir - dt);
    if (g.splash) g.splash.t += dt;
    if (g.cubes.some(function (k) { return k.state === "steep"; })) g.brew = Math.min(1, g.brew + dt / 90);
    // after a cube dissolves the cup moves, carrying what's on its saucer, pushing aside the rest
    if (g.shuffle > 0 && (g.shuffle -= dt) <= 0) g.cupTo = place();
    var dish = g.cubes.filter(function (k) {
      return k.state === "rest" && k.x > c.l - 24 && k.x < c.l && Math.abs(k.y + half(k) - c.dish) < 2;
    });
    hand(dt);
    cupPlace();
    var moved = g.cup.cx - c.cx;
    c = g.cup;
    if (moved) {
      g.cubes.forEach(function (k) {
        if (k.state === "in" || dish.indexOf(k) >= 0) { k.x += moved; return; }
        var w = wide(k), mid = c.cx + 3;
        if (k.state === "rest" && Math.abs(k.x - mid) < 97 + w && k.y + half(k) > g.ground - 16)
          k.x = mid + (k.x < mid ? -1 : 1) * (97 + w);
      });
      g.drops.forEach(function (d) { if (d.bub) d.x += moved; });
    }
    lever(dt);
    g.drops = g.drops.filter(function (d) {
      d.t += dt;
      if (d.bub) { d.y += d.vy * dt; d.x += Math.sin(d.t * 9) * 0.1; return d.y > c.surf + 2; }
      d.vy += G * dt; d.x += d.vx * dt; d.y += d.vy * dt;
      if (d.vy > 0 && d.y > c.surf && d.x > c.l + 4 && d.x < c.r - 4) return false; // back in
      return d.t < 1.5 && d.y < floorAt(d.x);
    });
    g.cubes = g.cubes.filter(function (k) {
      k.t += dt;
      if (k.state === "steep") { steep(k, c); return true; }
      if (k.state === "fly") return fly(k, dt);
      if (k.state === "in") { // dissolving
        k.y = Math.min(k.y + k.vy * dt, c.bottom - 12); k.x = clamp(k.x, c.l + 14, c.r - 14);
        if (k.t < 1.4 && Math.random() < dt * 6) g.drops.push({ bub: true, x: k.x + (Math.random() - 0.5) * 12, y: k.y - 4, vy: -30 - Math.random() * 20, t: 0 });
        return k.t < 1.8;
      }
      // resting; falls if its support is gone
      var h = half(k), fl = floorAt(k.x);
      if (k.y + h > fl + 1) k.y = fl - h; // the saucer slid under it
      else if (k.y + h < fl - 1) {
        var under = g.cubes.filter(function (r) {
          return r !== k && r.state === "rest" && Math.abs(r.x - k.x) < wide(r) + wide(k) - 2 &&
            Math.abs(r.y - half(r) - k.y - h) < 3;
        });
        if (!under.length || overhang(k, under)) { k.state = "fly"; k.vy = 0; }
      }
      return true;
    });
    tagStep(dt);
  }

  // the bag's string and tag, a rope off the bag: 0 the bag's top, 1..KN-1 string,
  // KN and KN+1 the tag's two ends (a stiff card). Not used while steeping.
  function knot(x, y) { return { x: x, y: y, px: x, py: y, w: 1 }; }
  function tagStep(dt) {
    var g = game, top = null, bag = null, r, i;
    if (g.carry && g.carry.kind === "bag") bag = bagAt(m.x, m.y);
    else g.cubes.forEach(function (k) { if (k.kind === "bag" && (k.state === "fly" || k.state === "rest")) bag = k; });
    if (!bag && g.arm.load === "bag") {
      var a = g.arm.a, b = bowl(a), up = BH / 2 + 2;
      bag = { x: b.x - Math.sin(a) * up, y: b.y + Math.cos(a) * up, ang: a - Math.PI };
    }
    if (bag) top = bagTop(bag.x, bag.y, bag.ang);
    if (!top) { g.tag = null; return; }
    r = g.tag;
    if (!r) {
      r = g.tag = [];
      for (i = 0; i <= KN + 1; i++) r.push(knot(top[0] + i * 0.3, top[1] + Math.min(i, KN) * KL + (i > KN ? TH : 0)));
      r[0].w = 0;
    }
    r[0].x = r[0].px = top[0]; r[0].y = r[0].py = top[1];
    var gg = G * dt * dt;
    for (i = 1; i <= KN + 1; i++) {
      var q = r[i], vx = (q.x - q.px) * 0.985, vy = (q.y - q.py) * 0.985;
      q.px = q.x; q.py = q.y;
      q.x += vx; q.y += vy + gg;
    }
    for (var n = 0; n < 10; n++) {
      for (i = 0; i < KN; i++) link(r[i], r[i + 1], KL, false);
      link(r[KN], r[KN + 1], TH, true);
      // the tag's corners stick out TW/2: down when it lies flat, sideways when it hangs
      var ux = Math.min(1, Math.abs(r[KN + 1].x - r[KN].x) / TH), uy = Math.min(1, Math.abs(r[KN + 1].y - r[KN].y) / TH);
      for (i = 1; i <= KN + 1; i++) lie(r[i], i >= KN ? 1 + TW / 2 * ux : 1, i >= KN ? 1 + TW / 2 * uy : 1, bag);
    }
  }
  // the string and tag lie on things, and stay out of the bag and the cup's sides
  function lie(q, rad, side, bag) {
    var g = game, c = g.cup, fl = floorAt(q.x), s = spoonAt(q.x, g.arm.a, null);
    var co = Math.cos(bag.ang), si = Math.sin(bag.ang), dx = q.x - bag.x, dy = q.y - bag.y;
    var lx = co * dx + si * dy, ly = co * dy - si * dx, hx = BW / 2 + side, hy = BH / 2 + rad;
    if (Math.abs(lx) < hx && Math.abs(ly) < hy) {
      if (hx - Math.abs(lx) < hy - Math.abs(ly)) lx = lx < 0 ? -hx : hx; else ly = ly < 0 ? -hy : hy;
      q.x = bag.x + co * lx - si * ly; q.y = bag.y + si * lx + co * ly;
    }
    if (s !== null && q.py + rad <= s + 3 && s < fl) fl = s;
    g.cubes.forEach(function (k) {
      if (k.state !== "rest" || k.kind === "bag") return;
      var h = half(k), top = k.y - h;
      if (Math.abs(q.x - k.x) < h + 1 && q.py + rad <= top + 3 && top < fl) fl = top;
    });
    if (q.x > c.l - side && q.x < c.r + 30 + side) {
      if (q.py + rad <= c.top + 3) fl = Math.min(fl, c.top);
      else q.x = q.px < c.cx ? c.l - side : c.r + 30 + side;
    }
    if (q.y + rad > fl) {
      q.y = q.py = fl - rad;
      q.px = q.x - (q.x - q.px) * 0.5;
    }
    q.x = clamp(q.x, g.L + side, g.wall - side);
  }

  function swing(dt) {
    var g = game, vx = dt > 0 && g.mx !== undefined ? (m.x - g.mx) / dt : 0;
    g.mx = m.x;
    g.sway += (clamp(vx * 0.0015, -0.7, 0.7) - g.sway) * Math.min(1, dt * 8);
  }
  function cubesLeft() {
    var g = game, n = (g.arm.load === "cube" ? 1 : 0) + (g.carry && g.carry.kind === "cube" ? 1 : 0);
    g.cubes.forEach(function (k) { if (k.kind === "cube" && k.state !== "in") n++; });
    return n;
  }
  function cursor() {
    var g = game, on = g.rise === 1 && m.on;
    g.againButton.hidden = cubesLeft() > 0;
    root.classList.toggle("grabbing", !!g.carry);
    root.classList.toggle("grab", on && !g.carry && under(m.x, m.y) !== null);
  }

  // --- drawing ---------------------------------------------------------------

  function colors() {
    var s = getComputedStyle(root), d = dark.matches;
    function v(n) { return s.getPropertyValue(n).trim(); }
    col = { fg: v("--fg"), muted: v("--muted"), bg: v("--bg"), amber: v("--amber"),
      paper: d ? "#4a4034" : "#efe4d2",   // the tea bag
      silver: d ? "#34363a" : "#e7e9ec",  // the spoon
      sugar: d ? "#26262a" : "#ffffff" };
  }
  // "#rrggbb" + alpha to rgba(); anything else is returned as is
  function rgba(hex, a) {
    var r = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex || "");
    if (!r) return hex;
    var n = parseInt(r[1].length === 3 ? r[1].replace(/./g, "$&$&") : r[1], 16);
    return "rgba(" + (n >> 16) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")";
  }
  function ink(path, fill) {
    path(); ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = col.fg; ctx.lineWidth = 1; ctx.lineJoin = ctx.lineCap = "round";
    ctx.stroke();
  }
  function drawBag() {
    var a = p[ROPE], b = p[ROPE + 1];
    ctx.save();
    ctx.globalAlpha *= 0.55; ctx.strokeStyle = col.fg; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y);
    for (var i = 1; i <= ROPE; i++) ctx.lineTo(p[i].x, p[i].y);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2);
    ink(function () {
      ctx.beginPath();
      ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.lineTo(8, 5); ctx.lineTo(8, BAG);
      ctx.lineTo(-8, BAG); ctx.lineTo(-8, 5); ctx.closePath();
    }, col.paper);
    ctx.beginPath(); ctx.moveTo(-8, 5); ctx.lineTo(8, 5); ctx.lineWidth = 0.6; ctx.stroke();
    ctx.restore();
  }

  function drawTag() {
    ink(function () { ctx.beginPath(); ctx.rect(m.x - 6, m.y - 4.5, 12, 9); },
      m.down || m.link ? col.amber : col.bg);
  }

  // --- shapes as points ------------------------------------------------------

  function trace(pts, closed) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (closed) ctx.closePath();
  }
  function bez(out, a, b, c, d, n) {
    for (var i = out.length ? 1 : 0; i <= n; i++) {
      var t = i / n, u = 1 - t;
      out.push([u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
        u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]);
    }
    return out;
  }

  function quad(out, a, c, b, n) {
    for (var i = out.length ? 1 : 0; i <= n; i++) {
      var t = i / n, u = 1 - t;
      out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
    }
    return out;
  }
  // a rounded rectangle w by h around 0,0
  function box(w, h, r) {
    var x = w / 2 - r, y = h / 2 - r, pts = [];
    [[x, -y, -Math.PI / 2], [x, y, 0], [-x, y, Math.PI / 2], [-x, -y, Math.PI]].forEach(function (c) {
      for (var i = 0; i <= 3; i++) { var a = c[2] + i / 3 * Math.PI / 2; pts.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]); }
    });
    return pts;
  }
  function oval(rx, ry, n, from, to) {
    var pts = [];
    from = from || 0; to = to === undefined ? 2 * Math.PI * (1 - 1 / n) : to;
    for (var i = 0; i < n; i++) { var a = from + (to - from) * i / (n - 1); pts.push([Math.cos(a) * rx, Math.sin(a) * ry]); }
    return pts;
  }
  // every corner nudged a little, per seed
  function crooked(pts, seed, by) {
    return pts.map(function (q, i) { var c = Math.floor(i / 4); return [q[0] + noise(seed * 3 + c * 1.7) * by, q[1] + noise(seed * 5 + c * 2.3 + 9) * by]; });
  }
  function shift(pts, x, y) { return pts.map(function (q) { return [q[0] + x, q[1] + y]; }); }

  // --- the pen ---------------------------------------------------------------
  // Outlines wobble with noise along the line, so the wobble moves with the shape
  // instead of boiling frame to frame.

  var LW = 1.4;
  function hash(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function noise(s) { var i = Math.floor(s), f = s - i; f = f * f * (3 - 2 * f); return (hash(i) * (1 - f) + hash(i + 1) * f) * 2 - 1; }
  function wobble(pts, closed, seed, amp) {
    var n = pts.length, segs = closed ? n : n - 1, base = [], i, j;
    for (i = 0; i < segs; i++) {
      var a = pts[i], b = pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.sqrt(dx * dx + dy * dy);
      if (L < 1e-6) continue;
      var steps = Math.ceil(L / 5);
      for (j = 0; j < steps; j++) base.push([a[0] + dx * j / steps, a[1] + dy * j / steps, -dy / L, dx / L, L / steps]);
    }
    if (!base.length) return pts;
    var end = pts[closed ? 0 : n - 1], lb = base[base.length - 1];
    base.push([end[0], end[1], lb[2], lb[3], 5]);
    if (closed) for (j = 1; j < 3 && j < base.length - 1; j++) base.push(base[j]); // a little past the start
    var out = [], s = 0;
    for (i = 0; i < base.length; i++) {
      var q = base[i], d = amp * (0.75 * noise(s * 0.05 + seed) + 0.25 * noise(s * 0.3 + seed * 7));
      out.push([q[0] + q[2] * d, q[1] + q[3] * d]);
      s += q[4];
    }
    return out;
  }
  // short strokes, each pressed a little differently
  function scribble(q, w, color, seed) {
    ctx.strokeStyle = color; ctx.lineCap = ctx.lineJoin = "round";
    for (var i = 0; i < q.length - 1; i += 3) {
      ctx.beginPath(); ctx.moveTo(q[i][0], q[i][1]);
      for (var j = i + 1; j <= i + 3 && j < q.length; j++) ctx.lineTo(q[j][0], q[j][1]);
      ctx.lineWidth = w * (1 + 0.22 * noise(i * 0.4 + seed * 3));
      ctx.stroke();
    }
  }
  // o: seed, amp, fill (colour or list), w, color, open (a line), line: false (fill only)
  function pen(pts, o) {
    var seed = o.seed || 0, amp = o.amp === undefined ? 1 : o.amp;
    if (o.fill) {
      ctx.save(); ctx.translate(0.7, 0.9);
      trace(wobble(pts, true, seed + 0.37, amp), true);
      [].concat(o.fill).forEach(function (c) { ctx.fillStyle = c; ctx.fill(); });
      ctx.restore();
    }
    if (o.line !== false) scribble(wobble(pts, !o.open, seed, amp), o.w || LW, o.color || col.fg, seed);
  }
  function stroke(w, color) {
    ctx.strokeStyle = color || col.fg; ctx.lineWidth = w || LW;
    ctx.lineCap = ctx.lineJoin = "round"; ctx.stroke();
  }

  // --- the scene -------------------------------------------------------------

  var CUBE_BOX = box(CUBE, CUBE, 3), BAG_BOX = box(BW, BH, 6), TAG_BOX = box(TW, TH, 2.5), BOWL = oval(19, 8, 26);

  function table(g) {
    var w = g.R - g.L, a = g.L + w * 0.31, b = g.L + w * 0.74;
    [[g.L, a - 3], [a + 3, b - 2], [b + 4, g.R]].forEach(function (s, i) {
      pen([[s[0], g.ground], [s[1], g.ground]], { open: true, seed: 50 + i * 3, w: 0.9, color: col.muted, amp: 0.7 });
    });
  }

  // wrist at 0,0, fingers along +x (shorter as they curl), thumb towards +y
  function handPts(curl) {
    var f = 1 - 0.45 * curl, notch = 26 + 10 * f, pts = [[-6, -11], [14, -12.2]];
    [[-12, -6.2, 46], [-6.2, -0.2, 54], [-0.2, 5.8, 57], [5.8, 11.8, 53]].forEach(function (d, i) {
      var r = (d[1] - d[0]) / 2, my = (d[0] + d[1]) / 2, tip = 26 + (d[2] - 26) * f;
      for (var j = 0; j <= 4; j++) {
        var t = -Math.PI / 2 + j / 4 * Math.PI;
        pts.push([tip - r + Math.cos(t) * r, my + Math.sin(t) * r]);
      }
      if (i < 3) pts.push([notch, d[1]]);
    });
    return pts.concat([[28, 12.4], [24, 12.6], [31, 15.5], [35, 18.5], [34, 21.5], // the thumb
      [30, 22.8], [22, 20.5], [12, 16], [2, 13], [-6, 12.5]]);
  }
  function drawHand() {
    var g = game, hd = g.hand, back = hd.a + Math.PI;
    if (hd.show < 0.01) return;
    ctx.save(); ctx.globalAlpha *= hd.show;
    // the arm goes down-right, bent at the wrist, never through the table
    var toS = Math.atan2(g.ground + 40 - hd.y, g.wall + 260 - hd.x), b = back + clamp(unwrap(norm(toS - back)), -1.75, 1.75);
    b = Math.min(norm(b), Math.asin(clamp((g.ground - 6 - hd.y) / (120 * HS), -1, 1)));
    ctx.save(); ctx.translate(hd.x, hd.y); ctx.scale(HS, HS); ctx.rotate(hd.a);
    pen(handPts(hd.curl), { seed: 131, fill: col.bg, open: true, w: 1.3 / HS });
    pen([[10, -3], [19, -1.5]], { open: true, seed: 133, w: 0.8 / HS, color: col.muted, amp: 0.3 });
    ctx.restore();
    // the sleeve, fading up the arm
    ctx.save(); ctx.translate(hd.x, hd.y); ctx.scale(HS, HS); ctx.rotate(b);
    var ink = ctx.createLinearGradient(0, 0, 120, 0), paper = ctx.createLinearGradient(0, 0, 120, 0);
    ink.addColorStop(0.3, col.fg); ink.addColorStop(1, rgba(col.fg, 0));
    paper.addColorStop(0.5, col.bg); paper.addColorStop(1, rgba(col.bg, 0));
    pen([[-3, -13.5], [120, -15], [120, 15], [-3, 13.5]], { seed: 141, fill: paper, line: false });
    pen([[120, -15], [-3, -13.5], [-3, 13.5], [120, 15]], { open: true, seed: 141, color: ink, w: 1.3 / HS });
    pen([[8, -14], [8, 14]], { open: true, seed: 143, w: 0.9 / HS, color: col.muted, amp: 0.5 });
    ctx.restore();
    ctx.restore();
  }

  function body(c) {
    var l = c.l, r = c.r, t = c.top, b = c.bottom, pts = [];
    bez(pts, [l, t], [l + 2, t + 44], [l + 6, b - 4], [l + 30, b], 18);
    bez(pts, [l + 30, b], [l + 60, b], [r - 60, b], [r - 30, b], 4);
    bez(pts, [r - 30, b], [r - 6, b - 4], [r - 2, t + 44], [r, t], 18);
    return pts;
  }
  function handle(c) {
    var r = c.r, t = c.top, pts = [];
    bez(pts, [r - 8, t + 16], [r + 34, t + 8], [r + 34, t + 68], [r - 8, t + 64], 20);
    bez(pts, [r - 8, t + 56], [r + 20, t + 58], [r + 20, t + 22], [r - 8, t + 26], 16);
    return pts;
  }
  function saucer(c, ground) {
    var p = [];
    quad(p, [c.l - 26, c.dish - 1], [c.cx, c.dish + 6], [c.r + 26, c.dish - 1], 16);
    quad(p, [c.r + 26, c.dish - 1], [c.r + 12, ground - 5], [c.r - 28, ground - 4], 6);
    p.push([c.r - 32, ground], [c.l + 32, ground], [c.l + 28, ground - 4]);
    quad(p, [c.l + 28, ground - 4], [c.l - 12, ground - 5], [c.l - 26, c.dish - 1], 6);
    p.pop();
    return p;
  }

  function drawCupBack(c, ground) {
    pen(saucer(c, ground), { seed: 103, fill: col.bg, w: 1.3 });
    pen(handle(c), { seed: 102, fill: col.bg });
    pen(body(c), { seed: 101, fill: col.bg, line: false });
  }

  function drawCupFront(c, t) {
    var g = game, x, i, shape = body(c), surf = [];
    function level(x) { return c.surf + g.ripple * Math.sin(x * 0.12 - t * 9) * 0.6; }
    for (x = c.l + 2; x <= c.r - 2; x += 4) surf.push([x, level(x)]);
    // the tea, darker the longer the bag has steeped
    ctx.save();
    trace(wobble(shape, true, 101, 0.8), true); ctx.clip();
    trace([[c.l - 4, c.bottom + 4]].concat(surf, [[c.r + 4, c.bottom + 4]]), true);
    ctx.fillStyle = rgba(col.amber, 0.22 + 0.33 * g.brew); ctx.fill();
    for (i = 0; i < 6; i++) {
      var hx = c.r - 8 - i * 6;
      pen([[hx + 4, c.surf + 12 + i * 5], [hx - 4, c.bottom - 6 - i * 2]], { open: true, seed: 120 + i * 2, w: 0.8, color: col.amber, amp: 0.5 });
    }
    pen(surf, { open: true, seed: 105, w: 1, color: col.amber, amp: 0.4 });
    ctx.restore();
    if (g.splash && g.splash.t < 0.7) {
      var sp = g.splash, w = 6 + sp.t * 40;
      ctx.save(); ctx.globalAlpha *= 1 - sp.t / 0.7;
      pen([[Math.max(c.l + 6, sp.x - w), c.surf - 1], [Math.min(c.r - 6, sp.x + w), c.surf - 1]], { open: true, seed: 107, w: 1, color: col.amber });
      ctx.restore();
    }
    // steam
    var puff = 0.3 + 0.35 * g.stir + 0.1 * g.brew;
    for (var j = 0; j < 3; j++) {
      var x0 = c.cx + (j - 1) * 16, ph = j * 2.3, len = 30 + 8 * Math.sin(t * 0.7 + ph) + 10 * g.stir;
      ctx.beginPath();
      for (var k = 0; k <= 12; k++) {
        var f = k / 12, sx = x0 + Math.sin(f * 4.5 - t * 1.8 + ph) * (1.5 + f * 4) + noise(k * 0.7 + j * 9) * 0.6, sy = c.top - 10 - f * len;
        k ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy);
      }
      stroke(1.2, rgba(col.muted, puff));
    }
    pen(shape, { open: true, seed: 101 });
    pen(shift(oval((c.r - c.l) / 2, 3, 30), c.cx, c.top), { seed: 104, w: 1.2, amp: 0.5 });
  }


  function cube(x, y, ang, seed, s) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang);
    if (s) ctx.scale(s, s);
    pen(crooked(CUBE_BOX, seed, 0.9), { seed: seed, fill: col.sugar, w: 1.3 });
    for (var i = 0; i < 2; i++) {
      var o = 3.5 + i * 3.5;
      pen([[CUBE / 2 - 2.5, CUBE / 2 - o - 2.5], [CUBE / 2 - o - 2.5, CUBE / 2 - 2.5]], { open: true, seed: seed + i * 4, w: 0.8, color: col.muted, amp: 0.3 });
    }
    ctx.restore();
  }

  // the string and tag come from game.tag (see tagStep)
  function bagTop(x, y, ang) { return [x + Math.sin(ang) * BH / 2, y - Math.cos(ang) * BH / 2]; }
  function bagBody(x, y, ang, seed) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang);
    pen(crooked(BAG_BOX, seed, 1.2), { seed: seed, fill: [col.paper, rgba(col.amber, 0.35)], w: 1.3 });
    pen([[-BW / 2 + 3, -BH / 2 + 11], [BW / 2 - 3, -BH / 2 + 11]], { open: true, seed: seed + 2, w: 0.9, amp: 0.5 });
    pen([[-2.5, -BH / 2 + 3], [2.5, -BH / 2 + 3]], { open: true, seed: seed + 3, w: 1.2, color: col.muted, amp: 0.2 });
    ctx.restore();
  }
  function bagTag(x, y, ang, seed) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang);
    pen(crooked(TAG_BOX, seed + 5, 0.6), { seed: seed + 5, fill: col.bg, w: 1.1, amp: 0.5 });
    pen([[-9, 3], [-4.5, 0], [0, 3], [4.5, 0], [9, 2.5]], { open: true, seed: seed + 6, w: 1, color: col.amber, amp: 0.4 });
    ctx.restore();
  }
  function string(pts, seed) { pen(pts, { open: true, seed: seed + 9, w: 0.9, color: col.muted, amp: 0.3 }); }
  function teabag(x, y, ang, seed) {
    var r = game.tag;
    if (r) string([bagTop(x, y, ang)].concat(r.slice(1, KN + 1).map(function (q) { return [q.x, q.y]; })), seed);
    bagBody(x, y, ang, seed);
    if (!r) return;
    var a = r[KN], b = r[KN + 1];
    bagTag((a.x + b.x) / 2, (a.y + b.y) / 2, Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2, seed);
  }

  function drawCatapult() {
    var g = game, q = g.pivot, a = g.arm.a, b = bowl(a), t = tail(a);
    var nx = -Math.sin(a), ny = Math.cos(a); // n: "up" off the spoon
    cube(q.x, g.ground - CUBE / 2, 0, 7);
    cube(q.x, g.ground - CUBE * 1.5, 0, 13);
    if (!g.arm.gone) drawSpoon(b, t, a);
    if (g.arm.load === "bag") teabag(b.x + nx * (BH / 2 + 2), b.y + ny * (BH / 2 + 2), a - Math.PI, g.arm.seed);
    else if (g.arm.load) cube(b.x + nx * (CUBE / 2 + 2), b.y + ny * (CUBE / 2 + 2), a, g.arm.seed);
  }
  // b: the bowl, t: the handle's end, a: handle to bowl
  function drawSpoon(b, t, a) {
    var dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
    var neck = [b.x - dx * 17, b.y - dy * 17];
    pen([[t.x + nx * 2.5, t.y + ny * 2.5], [neck[0] + nx * 1.5, neck[1] + ny * 1.5],
      [neck[0] - nx * 1.5, neck[1] - ny * 1.5], [t.x - nx * 2.5, t.y - ny * 2.5],
      [t.x - dx * 2 - nx * 1.5, t.y - dy * 2 - ny * 1.5], [t.x - dx * 2.5, t.y - dy * 2.5],
      [t.x - dx * 2 + nx * 1.5, t.y - dy * 2 + ny * 1.5]], { seed: 23, fill: col.silver, w: 1.2, amp: 0.35 });
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a);
    pen(BOWL, { seed: 29, fill: col.silver, w: 1.3, amp: 0.6 });
    pen(oval(12, 4, 8, Math.PI * 0.25, Math.PI * 0.7), { open: true, seed: 31, w: 0.8, color: col.muted, amp: 0.3 });
    ctx.restore();
  }

  // faint where it can't be dropped
  function drawCarry() {
    var g = game, c = g.carry;
    if (c.kind === "spoon") return drawCarriedSpoon();
    var bag = c.kind === "bag", b = bagAt(m.x, m.y);
    ctx.save();
    if (!zone(m.x, m.y, c.kind) && !(bag && overCup(b.x, b.y))) ctx.globalAlpha *= 0.4;
    if (bag) teabag(b.x, b.y, b.ang, c.seed);
    else cube(m.x + HOLD.x, m.y + HOLD.y, g.sway * 0.5, c.seed);
    ctx.restore();
  }

  // in the cup, clipped so the cup hides the bowl
  function drawCarriedSpoon() {
    var g = game, s = g.spoon, c = g.cup, a = s.a === undefined ? Math.PI / 2 : s.a, n = ARM + TAIL;
    ctx.save();
    if (s.inCup) {
      ctx.beginPath(); ctx.rect(0, 0, W, H);
      var outline = wobble(body(c), true, 101, 0.8);
      ctx.moveTo(c.l, c.top);
      for (var i = 0; i < outline.length; i++) ctx.lineTo(outline[i][0], outline[i][1]);
      ctx.closePath(); ctx.clip("evenodd");
    }
    drawSpoon({ x: s.bx, y: s.by }, { x: s.bx - Math.cos(a) * n, y: s.by - Math.sin(a) * n }, a);
    ctx.restore();
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    if (!held) return;
    if (game) {
      var g = game, c = g.cup, e = ease(g.rise);
      ctx.save();
      ctx.globalAlpha = e * (1 - clamp((g.roll - 0.2) / 0.5, 0, 1)); ctx.translate(0, (1 - e) * 8);
      table(g);
      drawCupBack(c, g.ground);
      g.cubes.forEach(function (k) { // the steeping bag, behind the tea
        if (k.state !== "steep" || !k.tag) return;
        string([bagTop(k.x, k.y, k.ang), [c.l + 8, c.top]], k.seed);
        bagBody(k.x, k.y, k.ang, k.seed);
      });
      g.cubes.forEach(function (k) { // dissolving
        if (k.state !== "in") return;
        ctx.save(); ctx.globalAlpha *= Math.max(0, 1 - k.t / 1.8); cube(k.x, k.y, k.ang, k.seed, 1 - 0.45 * k.t / 1.8); ctx.restore();
      });
      g.drops.forEach(function (d) {
        if (!d.bub) return;
        ctx.beginPath(); ctx.arc(d.x, d.y, 1.4, 0, 7); stroke(1, rgba(col.amber, 0.8));
      });
      drawCupFront(c, t);
      g.cubes.forEach(function (k) { // its string and tag, in front of the cup
        if (k.state !== "steep" || !k.tag) return;
        var ta = k.tag.ang, tt = [k.tag.x + Math.sin(ta) * TH / 2, k.tag.y - Math.cos(ta) * TH / 2];
        string(quad([], [c.l + 8, c.top], [c.l - 6, c.top - 7], tt, 8), k.seed);
        bagTag(k.tag.x, k.tag.y, ta, k.seed);
      });
      drawCatapult();
      g.cubes.forEach(function (k) {
        if (k.state === "in" || k.state === "steep") return;
        if (k.kind === "bag") teabag(k.x, k.y, k.ang, k.seed); else cube(k.x, k.y, k.ang, k.seed);
      });
      drawHand();
      ctx.fillStyle = col.amber;
      g.drops.forEach(function (d) {
        if (d.bub) return;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7); ctx.fill();
      });
      if (m.on && g.carry) drawCarry();
      ctx.restore();
    }
    if (m.on && !game) { drawBag(); drawTag(); }
  }

  // --- loop ------------------------------------------------------------------

  function busy() {
    if (!held) return false;
    if (game || performance.now() - m.moved < 2000) return true;
    for (var i = 1; i < p.length; i++) if (Math.abs(p[i].x - p[i].px) + Math.abs(p[i].y - p[i].py) > 0.01) return true;
    return false;
  }

  function frame(t) {
    raf = 0;
    var dt = clamp((t - last) / 1000, 0, 0.05);
    last = t;
    if (game) {
      game.rise = clamp(game.rise + game.dir * dt / 0.45, 0, 1);
      if (game.dir < 0 && game.rise === 0) gone();
      else { lay(); swing(dt); }
    }
    var rope = held && p.length;
    for (acc += dt; acc >= STEP; acc -= STEP) {
      if (game) play(STEP);
      if (rope) step(STEP);
    }
    if (rope && !game) track(dt);
    if (game) cursor();
    draw(t / 1000);
    if (busy()) raf = requestAnimationFrame(frame);
  }

  function wake() {
    if (raf || !cv) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function size() {
    var d = devicePixelRatio || 1;
    W = innerWidth; H = innerHeight;
    cv.width = W * d; cv.height = H * d;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    wake();
  }

  function init() {
    cv = document.createElement("canvas");
    cv.setAttribute("aria-hidden", "true");
    cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483647";
    document.body.appendChild(cv);
    ctx = cv.getContext("2d");
    colors(); size();
    if (held) document.querySelectorAll(".bag").forEach(function (b) { b.classList.add("taken"); });
    addEventListener("resize", size);
    dark.addEventListener("change", function () { colors(); wake(); });
  }
  if (document.body) init(); else addEventListener("DOMContentLoaded", init);

  // the "_" in the name is the bag
  document.addEventListener("click", function (e) {
    if (!(e.target.closest && e.target.closest(".bag"))) return;
    e.preventDefault(); e.stopPropagation();
    m.x = e.clientX; m.y = e.clientY; m.on = true;
    hold(!held);
  }, true);

  // a carried thing goes back if the pointer leaves or the window loses focus
  function putBack() { if (game && game.carry) release(-1e4, -1e4); }

  addEventListener("mousemove", function (e) {
    m.x = e.clientX; m.y = e.clientY; m.moved = performance.now();
    if (!held) return;
    if (!m.on) { m.on = true; if (!game) root.classList.add("teabag"); hang(); }
    if (game) cursor();
    wake();
  }, { passive: true });
  document.addEventListener("mouseout", function (e) {
    if (e.relatedTarget) return;
    putBack();
    m.on = false; root.classList.remove("teabag"); wake();
  });
  addEventListener("blur", function () { putBack(); m.down = false; wake(); });
  addEventListener("scroll", wake, { passive: true });
  addEventListener("mouseover", function (e) {
    m.link = !!(e.target.closest && e.target.closest("a, button, summary, label, [role=button]"));
  }, { passive: true });
  addEventListener("mousedown", function (e) {
    m.down = true;
    var ui = e.target.closest && e.target.closest(".cup-ui");
    if (e.button === 0 && held && game && game.rise === 1 && !ui && !game.carry && pick(e.clientX, e.clientY)) {
      e.preventDefault(); // no text selection
      game.mx = e.clientX; game.sway = 0;
      cursor();
    }
    wake();
  });
  addEventListener("mouseup", function (e) {
    m.down = false;
    if (game && game.carry) release(e.clientX, e.clientY);
    if (game) cursor();
    wake();
  });

  addEventListener("keydown", function (e) {
    if (e.key === "Escape" && held) return game ? leave() : hold(false);
    if (!held || e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
    if (/^(input|textarea|select)$/i.test(e.target.tagName) || e.target.isContentEditable) return;
    typed = (typed + e.key.toLowerCase()).slice(-3);
    if (typed === "tea") start();
  });
})();
