// The tea bag. Mouse only, and off with reduced motion.
// Click the "_" in the name to pick the bag up: it becomes the cursor until you
// click the "_" again (or press Esc). Remembered for the tab (sessionStorage).
// The paper tag is the pointer (its centre is where you click). The string and
// the bag hang off it: a small verlet rope whose links only pull (so it goes
// slack like real string), the bag itself is one stiff segment at the end.
//
// Hidden further: holding the bag, circle the mouse quickly (or type "tea") and
// a little table opens up above the footer: a cup of tea on its saucer, and a
// spoon balanced on two sugar cubes like a seesaw, bowl down on the near side,
// handle end up towards the cup. While playing the pointer is the normal one.
// There are six sugar cubes: one in the spoon, five in a little pile. Press on
// one to pick it up, carry it, let go above the spoon to drop it (anywhere
// else, it goes back where it was). One that lands in the empty bowl stays
// there, and one that lands on the spoon slides down it into the bowl; one that lands hard on the handle slams the spoon
// round (real lever physics, see lever()) and the bowl throws its load over
// the hinge towards the cup. Misses stay on the table to be picked up again;
// things lying under the spoon hold it up. Cubes in the tea dissolve, and the
// cup shuffles somewhere else, clear of whatever lies on the table.
// A teabag steeps in the cup (the tea gets darker while it does), its tag
// hanging over the rim (out of the cup, its string and tag dangle and flop
// about like real ones): pull it out by the tag and drop it on the spoon like a
// cube, so even the last cube can be thrown, or let it slide into the bowl and
// throw the bag itself. It never dissolves; let go of it over the cup (or
// throw it in) and it goes back to steeping.
// No score, no rounds, just that. [ again ] resets the table, [ close ] (or
// Esc, or the "_") puts it all away, bag included: the normal cursor comes back.
//
// Look: drawn by hand with a fine pen, slightly imperfect, in the site's own
// colours (see "the pen" below).
(function () {
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var STEP = 1 / 120, G = 1300, AIR = 0.988, ITER = 8, SEG = 6, ROPE = 6, BAG = 20;
  // the spoon's angle is the direction from the pivot to the bowl: it rests
  // pointing down-left (bowl on the table) and swings clockwise, up and over,
  // until it stops at STOP, where the load leaves along the arc's tangent
  // sizes in rough real proportion: a teaspoon is about eight sugar cubes long
  // (bowl arm + handle), a cup about seven cubes across
  var CUBE = 20, ARM = 100, TAIL = 55, REST = Math.PI - 0.3, STOP = Math.PI + 0.78;
  var PIV = 140; // the hinge, from the table's left end: room for a cube left of the bowl
  var HOLD = { x: 4, y: 16 }; // where a carried cube hangs off the pointer
  // colours come from the site's CSS (see colors()): ink in --fg, paper in --bg,
  // tea in --amber, the table in --line

  var root = document.documentElement, dark = matchMedia("(prefers-color-scheme: dark)");
  var cv, ctx, W = 0, H = 0, col = {}, held = false;
  var m = { x: 0, y: 0, on: false, link: false, down: false, moved: 0 };
  var p = [], spin = 0, lastAng = null, typed = "";
  var game = null, raf = 0, last = 0, acc = 0;
  try { held = sessionStorage.getItem("teabag") === "1"; } catch (e) {}

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // --- the bag on a string -----------------------------------------------------
  // points: 0 = the tag (follows the mouse), 1..ROPE-1 string, ROPE = top of
  // the bag (staple), ROPE+1 = bottom of the bag. w = inverse mass.

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

  // Opening the table takes circles: the mouse has to draw 3.5 quick loops one
  // way (its direction of travel keeps turning), and the bag has to swing
  // round with it. Shaking or wiggling turns both ways and cancels out.
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

  // --- the table: a cup and a sugar-cube catapult -----------------------------------
  // It opens up in the page, in a gap just above the footer. Everything on it
  // lives in window coordinates and is moved along when the page scrolls.
  // Time runs in fixed steps (STEP), so a throw goes the same on any screen.

  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function lay() {
    var g = game, r = g.spot.getBoundingClientRect();
    if (g.ox !== undefined && (r.left !== g.ox || r.top !== g.oy)) {
      var dx = r.left - g.ox, dy = r.top - g.oy;
      g.cubes.concat(g.drops).forEach(function (k) { k.x += dx; k.y += dy; });
      if (g.carry && g.carry.from.x !== undefined) { g.carry.from.x += dx; g.carry.from.y += dy; }
    }
    g.ox = r.left; g.oy = r.top;
    g.L = r.left; g.R = r.right; g.ground = r.top + 176;
    g.pivot = { x: g.L + PIV, y: g.ground - 2 * CUBE };
    // the cup keeps right of the pile when it can, its handle on the table
    var hi = Math.max(PIV + 160, r.width - 104);
    g.span = [Math.min(300, hi), hi];
    g.cupTo = clamp(g.cupTo, g.span[0], g.span[1]);
    g.cupAt = clamp(g.cupAt, g.span[0], g.span[1]);
    cupPlace();
  }
  // the cup stands on a saucer (dish: its top, left of the cup)
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
    root.classList.remove("teabag"); // the normal pointer while playing
    game = { spot: spot, rise: 0, dir: 1, cubes: [], drops: [], cupAt: 0, cupTo: 0, sway: 0 };
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
    g.arm = { a: REST, pa: REST, w: 0, lo: REST, hi: STOP, load: "cube", seed: Math.random() * 100 };
    // the five spare cubes, in a little pyramid on the table
    var x0 = g.pivot.x + TAIL + 20;
    [[0, 0], [1, 0], [2, 0], [0.5, 1], [1.5, 1]].forEach(function (o) {
      g.cubes.push(thing("cube", x0 + o[0] * (CUBE + 1), g.ground - CUBE / 2 - o[1] * CUBE, "rest"));
    });
  }
  function leave() {
    if (!game || game.dir < 0) return;
    game.dir = -1; wake();
  }
  function gone() {
    var spot = game.spot;
    spot.classList.remove("on");
    setTimeout(function () { spot.remove(); }, 600);
    game = null;
    root.classList.remove("grab", "grabbing");
    hold(false); // closing the table puts the bag back too: normal cursor again
  }

  // seed: its own wobble in the drawing, kept wherever it goes
  function thing(kind, x, y, state) {
    return { kind: kind, x: x, y: y, vx: 0, vy: 0, ang: 0, va: 0, state: state || "fly", t: 0, seed: Math.random() * 100 };
  }
  // where a carried thing can be let go: above the spoon, clear of it
  function zone(x, y, kind) {
    var g = game;
    if (!g || g.rise !== 1) return false;
    var bag = kind === "bag", q = g.pivot, cx = bag ? x : x + HOLD.x;
    if (cx < q.x - ARM - 20 || cx > q.x + TAIL + 10) return false;
    var s = spoonAt(cx, g.arm.a, g.arm.load);
    return (bag ? y + 61 : y + HOLD.y + CUBE / 2) < (s === null ? g.ground : s) - 6;
  }
  function drop(x, y, kind, ang, quiet) {
    var k = thing(kind, x, y);
    k.ang = ang || 0;
    if (!quiet) k.va = (Math.random() - 0.5) * 2;
    game.cubes.push(k);
    return k;
  }
  // the steeping bag hangs in the tea, bobbing a little (with a dip when it
  // has just gone in); its tag hangs outside, over the rim
  function steep(k, c) {
    var dip = 12 * Math.exp(-k.t * 3) * Math.cos(k.t * 7);
    k.x = c.l + 34; k.y = c.surf + 34 + dip; k.ang = 0.05 + Math.sin(k.t * 1.3) * 0.04;
    k.tag = { x: c.l - 11, y: c.top + 30 };
  }
  // how far a thing reaches down from its centre at its current angle: a cube
  // on its corner stands taller than one on its face; a bag lying on its side
  // is lower than a standing one (a bag is about three cubes)
  function half(k) {
    var c = Math.abs(Math.cos(k.ang)), s = Math.abs(Math.sin(k.ang));
    return k.kind === "bag" ? 15 * c + 13 * s : CUBE / 2 * (c + s);
  }
  // what something falling at x lands on, if not on something else: the
  // saucer left of the cup, or the table
  function floorAt(x) { var c = game.cup; return x > c.l - 24 && x < c.l ? c.dish : game.ground; }
  // touching the table (or something lying on it) at height floor: bounce a
  // little, slide with friction, roll with the slide, and tip over onto the
  // nearest flat side. Only once it has really stopped does it rest.
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
  // somewhere new for the cup: a real move, clear of anything on the table
  function place() {
    var g = game, s = g.span;
    for (var n = 0; n < 16; n++) {
      var at = s[0] + Math.random() * (s[1] - s[0]), mid = g.L + at + 3;
      if (Math.abs(at - g.cupAt) < 30 && s[1] - s[0] > 60) continue;
      if (!g.cubes.some(function (k) { return k.state === "rest" && Math.abs(k.x - mid) < 99 + half(k); })) return at;
    }
    return g.cupTo;
  }
  // the thing under the pointer: the topmost one lying about (or barely
  // moving), the steeping bag, or the bowl's load
  function under(x, y) {
    var g = game, best = -1;
    g.cubes.forEach(function (k, i) {
      var h = half(k) + 4, slow = k.state === "fly" && Math.abs(k.vx) + Math.abs(k.vy) < 40;
      if ((k.state === "rest" || slow) && Math.abs(k.x - x) < h && Math.abs(k.y - y) < h &&
        (best < 0 || k.y < g.cubes[best].y)) best = i;
    });
    if (best >= 0) return best;
    if (g.tag) { // or by its tag
      var tx = (g.tag[3].x + g.tag[4].x) / 2, ty = (g.tag[3].y + g.tag[4].y) / 2;
      for (var j = 0; j < g.cubes.length; j++) {
        if (g.cubes[j].kind === "bag" && (g.cubes[j].state === "rest" || g.cubes[j].state === "fly") &&
          Math.abs(tx - x) < 10 && Math.abs(ty - y) < 10) return j;
      }
    }
    for (var i = 0; i < g.cubes.length; i++) {
      var k = g.cubes[i];
      if (k.state === "steep" && k.tag && ((Math.abs(k.tag.x - x) < 12 && Math.abs(k.tag.y - y) < 12) ||
        (Math.abs(k.x - x) < 16 && Math.abs(k.y - y) < 20))) return i;
    }
    if (g.arm.load && still(g.arm)) {
      var b = bowl(g.arm.a);
      if (Math.abs(b.x - x) < CUBE && Math.abs(b.y - CUBE / 2 - y) < CUBE) return "bowl";
    }
    return null;
  }
  // press on a thing to pick it up
  function pick(x, y) {
    var g = game, i = under(x, y);
    if (i === null) return false;
    if (i === "bowl") { g.carry = { kind: g.arm.load, from: "bowl", seed: g.arm.seed }; g.arm.load = null; return true; }
    var k = g.cubes.splice(i, 1)[0];
    g.carry = { kind: k.kind, from: k.state === "steep" ? "cup" : { x: k.x, y: k.y }, seed: k.seed };
    return true;
  }
  // let go: above the spoon it drops, anywhere else it goes back
  function release(x, y) {
    var g = game, c = g.carry, k;
    if (!c) return;
    g.carry = null;
    if (zone(x, y, c.kind)) {
      k = c.kind === "bag" ? drop(x - Math.sin(g.sway) * 38, y + 8 + Math.cos(g.sway) * 38, "bag", g.sway)
        : drop(x + HOLD.x, y + HOLD.y, "cube", g.sway * 0.5);
    } else if (c.kind === "bag" && (c.from === "cup" || overCup(x, y))) {
      k = thing("bag", 0, 0, "steep"); g.cubes.push(k);
    } else if (c.from === "bowl" && !g.arm.load && still(g.arm)) {
      g.arm.load = c.kind; g.arm.seed = c.seed; return;
    } else if (c.from === "bowl" || c.from === "cup") { // its place is taken: onto the table
      k = drop(c.from === "bowl" ? g.pivot.x + TAIL + 30 : g.cup.l - 40, g.ground - 80, c.kind, 0, true);
    } else k = drop(c.from.x, c.from.y, c.kind, 0, true); // falls into place, or onto whatever is there now
    k.seed = c.seed;
  }

  // the top of the spoon at x (or of what lies in its bowl), null past either end
  function loadTop(load) { return load === "bag" ? 32 : load ? 22 : 3; }
  function spoonAt(x, a, load) {
    var b = bowl(a), t = tail(a);
    if (x < b.x - 14 || x > t.x + 4) return null;
    var y = b.y + (t.y - b.y) * clamp((x - b.x) / (t.x - b.x), 0, 1);
    return y - (x < b.x + 12 ? loadTop(load) : 3);
  }

  // The spoon is a rigid lever on the hinge: angle a, spin w (positive = the
  // bowl going up and over). Weights: the bowl end, the light handle, and the
  // load in the bowl. Gravity pulls the bowl back down onto the table; a thing
  // landing on it gives it a kick (an impulse) that depends on how fast it
  // lands and how far from the hinge. The load only flies when the handle
  // hits the table (or something lying there) and the spoon stops dead: then
  // it carries on with the bowl's speed. A soft drop just rocks the spoon.
  var M = { bowl: 0.3, handle: 0.1, load: 0.6, slam: 3 };
  function inertia(arm) { return M.bowl * ARM * ARM + M.handle * TAIL * TAIL / 4 + (arm.load ? M.load * ARM * ARM : 0); }
  function torque(arm) {
    var c = Math.cos(arm.a);
    return G * ((M.bowl + (arm.load ? M.load : 0)) * c * ARM - M.handle * c * TAIL / 2);
  }
  // things lying under the spoon hold it up: how low the bowl can come (lo)
  // and how far down the handle can (hi, and what's in its way). Each top
  // corner of each thing is checked against the arc swept by the bowl arm or
  // by the handle.
  function limits(a) {
    var q = game.pivot, lo = REST, hi = STOP, under = null;
    game.cubes.forEach(function (k) {
      if (k.state !== "rest" && k.state !== "fly") return;
      var h = half(k), dy = k.y - h - q.y;
      for (var e = -1; e <= 1; e += 2) {
        var dx = k.x + e * h - q.x, d = Math.sqrt(dx * dx + dy * dy), f = Math.atan2(dy, dx), th;
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
    var arm = game.arm, lim = limits(arm.a);
    arm.pa = arm.a; arm.lo = lim[0]; arm.hi = lim[1];
    arm.w += torque(arm) / inertia(arm) * dt;
    arm.a += arm.w * dt;
    if (arm.a < arm.lo) { // the bowl lands on the table
      arm.a = arm.lo;
      arm.w = arm.w < -0.6 ? -arm.w * 0.3 : 0;
    }
    if (arm.a > arm.hi) { // the handle hits the table: the spoon stops dead
      arm.a = arm.hi;
      if (arm.load && arm.w > 0) fling(arm);
      var k = lim[2];
      if (k && arm.w > 1) { // ... on something lying there, and swats it out of the way
        k.state = "fly"; k.vx += 60 + arm.w * 25; k.vy = -60 - arm.w * 15; k.va += 6;
      }
      arm.w = -arm.w * 0.2;
    }
  }
  function fling(arm) {
    var b = bowl(arm.a), v = arm.w * ARM, up = arm.load === "bag" ? 17 : CUBE / 2 + 2, s = Math.sin(arm.a), c = Math.cos(arm.a);
    var k = thing(arm.load, b.x - s * up, b.y + c * up);
    k.vx = -s * v; k.vy = c * v; k.ang = arm.a - Math.PI; k.va = arm.w * (0.5 + Math.random()); k.seed = arm.seed;
    arm.load = null;
    game.cubes.push(k);
  }
  // a thing hits the spoon rx from the hinge: push the spoon round, bounce
  // the thing, a little away from the hinge. Slow ones just lie on it.
  function hit(k, rx) {
    var arm = game.arm, I = inertia(arm), vs = arm.w * rx, vrel = k.vy - vs;
    if (vrel <= 0) return;
    if (vrel < 60) { k.vy = vs; return; }
    var J = 1.3 * vrel / (1 / M.slam + rx * rx / I);
    arm.w += J * rx / I;
    if ((arm.a <= arm.lo + 1e-3 && arm.w < 0) || (arm.a >= arm.hi - 1e-3 && arm.w > 0)) {
      arm.w = 0; k.vy = -0.3 * vrel; // the table takes it
    } else k.vy -= J / M.slam;
    k.vx += rx > 0 ? 50 : -50; k.va += rx > 0 ? 6 : -6;
  }
  function still(arm) { return arm.a <= arm.lo + 0.001 && Math.abs(arm.w) < 0.01; }

  // a splash out of the cup at x
  function splash(x, n) {
    var c = game.cup;
    game.splash = { x: x, t: 0 };
    for (var i = 0; i < n; i++) {
      game.drops.push({ x: x + (Math.random() - 0.5) * 10, y: c.surf - 2, vx: (Math.random() - 0.5) * 150,
        vy: -150 - Math.random() * 170, r: 0.9 + Math.random() * 0.9, t: 0 });
    }
  }

  // something flying: the spoon, the cup, the hinge, the table and the
  // things lying on it. Returns false when it is gone (into the bowl).
  function fly(k, dt) {
    var g = game, arm = g.arm, q = g.pivot, px = k.x, py = k.y, h;
    k.vy += G * dt; k.x += k.vx * dt; k.y += k.vy * dt; k.ang += k.va * dt;
    h = half(k);
    // the load in the bowl stops things sliding down the spoon
    if (arm.load) {
      var b = bowl(arm.a), lt = spoonAt(b.x, arm.a, arm.load);
      if (k.x - h < b.x + 12 && px - h >= b.x + 11 && k.y + h > lt + 2 && k.y - h < b.y + 10) {
        k.x = b.x + 12 + h; k.vx = Math.abs(k.vx) * 0.3;
      }
    }
    // the spoon: measured where it was and where it is, so a fast swing
    // can't pass through what lies on it
    var sy = spoonAt(k.x, arm.a, arm.load), sy0 = spoonAt(px, arm.pa, arm.load);
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
      // lying on it: slide down the slope, turning flat onto it
      k.vx += G * s / (1 + s * s) * dt; k.vx *= Math.exp(-dt * 1.5);
      var lie = Math.atan(s), flat = lie + Math.round((k.ang - lie) / (Math.PI / 2)) * (Math.PI / 2);
      k.va += ((flat - k.ang) * 60 - k.va * 10) * dt;
    } else if (k.x !== px) { // slid into the spoon from the side: stopped
      var b0 = bowl(arm.a), t0 = tail(arm.a);
      if (k.x + h > b0.x - 19 && k.x - h < t0.x + 3) {
        var ly = b0.y + (t0.y - b0.y) * clamp((k.x - b0.x) / (t0.x - b0.x), 0, 1);
        if (k.y + h > ly - 2 && k.y - h < ly + 6) { k.x = px; k.vx = -k.vx * 0.3; }
      }
    }
    cup(k, px, py);
    if (k.state !== "fly") return true;
    // the two cubes under the hinge
    if (k.y + h > q.y + 2 && Math.abs(k.x - q.x) < CUBE / 2 + h) {
      var side = px < q.x ? -1 : 1;
      k.x = q.x + side * (CUBE / 2 + h); k.vx = side * Math.abs(k.vx) * 0.35;
    }
    // the table, or the top of something lying on it; side by side, pushed apart
    var floor = floorAt(k.x);
    g.cubes.forEach(function (r) {
      if (r === k || r.state !== "rest") return;
      var hr = half(r), top = r.y - hr, dx = k.x - r.x;
      if (Math.abs(dx) < (hr + h) * 0.8 && py + h <= top + 4) { if (top < floor) floor = top; }
      else if (Math.abs(dx) < hr + h - 1 && k.y + h > top + 3 && k.y - h < r.y + hr) {
        var away = dx < 0 ? -1 : 1;
        k.x = r.x + away * (hr + h); k.vx = away * Math.abs(k.vx) * 0.3;
      }
    });
    if (k.y + h >= floor) settle(k, floor, dt);
    // the ends of the table: nothing gets lost
    if (k.x < g.L + h) { k.x = g.L + h; k.vx = Math.abs(k.vx) * 0.4; }
    if (k.x > g.R - h) { k.x = g.R - h; k.vx = -Math.abs(k.vx) * 0.4; }
    if (k.y - h > g.ground) k.y = g.ground - h;
    return true;
  }
  // the cup is solid: in at the top, off the rim, off the handle, not
  // through the sides
  function cup(k, px, py) {
    var g = game, c = g.cup, h = half(k), open = k.x > c.l + 4 && k.x < c.r - 4, hr = c.r + 30;
    if (open && py < c.top && k.y >= c.top) {
      if (k.kind === "bag") { // the bag, back in the tea
        k.state = "steep"; k.t = 0; steep(k, c);
        g.ripple = Math.min(6, g.ripple + 3); splash(k.x, 3);
      } else { // plop
        k.state = "in"; k.t = 0; k.vy = 40; k.vx *= 0.1;
        g.ripple = Math.min(6, g.ripple + 4); splash(k.x, 6);
        g.shuffle = 0.6;
      }
      g.stir = 1;
      return;
    }
    if (!open && py + h <= c.top && k.y + h > c.top && k.x + h > c.l && k.x - h < c.r) { // the rim: it tips off
      var out = k.x < c.cx ? -1 : 1;
      k.y = c.top - h; k.vy = -Math.abs(k.vy) * 0.35; k.vx = out * Math.max(out * k.vx, 40); k.va = out * 4;
    } else if (py + h <= c.top + 10 && k.y + h > c.top + 10 && k.x > c.r && k.x - h < hr) { // the handle
      k.y = c.top + 10 - h; k.vy = -Math.abs(k.vy) * 0.3; k.vx = Math.max(k.vx, 0) + 40;
    }
    var right = k.y + h > c.top + 10 ? hr : c.r;
    if (k.y + h > c.top + 2 && k.x + h > c.l && k.x - h < right && !(open && py < c.top)) {
      if (px < c.cx) { k.x = c.l - h; k.vx = -Math.abs(k.vx) * 0.35; }
      else { k.x = right + h; k.vx = Math.abs(k.vx) * 0.35; }
    }
  }

  function play(dt) {
    var g = game, c = g.cup;
    g.ripple *= Math.exp(-dt * 3);
    g.stir = Math.max(0, g.stir - dt);
    if (g.splash) g.splash.t += dt;
    if (g.cubes.some(function (k) { return k.state === "steep"; })) g.brew = Math.min(1, g.brew + dt / 90);
    // the cup shuffles somewhere else once something dissolved in it, taking
    // along what sits on its saucer and pushing aside what's in the way
    if (g.shuffle > 0 && (g.shuffle -= dt) <= 0) g.cupTo = place();
    var dish = g.cubes.filter(function (k) {
      return k.state === "rest" && k.x > c.l - 24 && k.x < c.l && Math.abs(k.y + half(k) - c.dish) < 2;
    });
    g.cupAt += (g.cupTo - g.cupAt) * Math.min(1, dt * 3);
    cupPlace();
    var moved = g.cup.cx - c.cx;
    c = g.cup;
    if (moved) {
      g.cubes.forEach(function (k) {
        if (k.state === "in" || dish.indexOf(k) >= 0) { k.x += moved; return; }
        var h = half(k), mid = c.cx + 3;
        if (k.state === "rest" && Math.abs(k.x - mid) < 97 + h && k.y + h > g.ground - 16)
          k.x = mid + (k.x < mid ? -1 : 1) * (97 + h);
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
      if (k.state === "in") { // sinking and dissolving, a few bubbles coming up
        k.y = Math.min(k.y + k.vy * dt, c.bottom - 12); k.x = clamp(k.x, c.l + 14, c.r - 14);
        if (k.t < 1.4 && Math.random() < dt * 6) g.drops.push({ bub: true, x: k.x + (Math.random() - 0.5) * 12, y: k.y - 4, vy: -30 - Math.random() * 20, t: 0 });
        return k.t < 1.8;
      }
      // resting until picked up again; one whose support was taken away falls
      var h = half(k), fl = floorAt(k.x);
      if (k.y + h > fl + 1) k.y = fl - h; // the saucer slid under it
      else if (k.y + h < fl - 1 && !g.cubes.some(function (r) {
        return r !== k && r.state === "rest" && Math.abs(r.x - k.x) < (half(r) + h) * 0.85 && Math.abs(r.y - half(r) - k.y - h) < 3;
      })) { k.state = "fly"; k.vy = 0; }
      return true;
    });
    tagStep(dt);
  }

  // The bag's string and tag: a little rope like the cursor bag's (0 = the
  // top of the bag, 1-2 string, 3 = where the string meets the tag, 4 = the
  // far edge of the tag: the tag is a stiff card between 3 and 4), hanging
  // off the bag wherever it is: lying about, flying, in the bowl. So the tag
  // trails behind a throw, swings, topples over onto one of its sides and
  // lies on whatever is under it. While the bag is carried the hand holds the
  // tag; while it steeps, the rim does.
  function knot(x, y) { return { x: x, y: y, px: x, py: y, w: 1 }; }
  function tagStep(dt) {
    var g = game, top = null, bag = null, r, i;
    if (g.carry && g.carry.kind === "bag") {
      top = bagTop(m.x - Math.sin(g.sway) * 38, m.y + 8 + Math.cos(g.sway) * 38, g.sway);
      r = g.tag = [];
      for (i = 0; i < 4; i++) r.push(knot(top[0] + (m.x - top[0]) * i / 3, top[1] + (m.y + 13 - top[1]) * i / 3));
      r.push(knot(m.x, m.y + 3));
      r[0].w = 0;
      return;
    }
    g.cubes.forEach(function (k) { if (k.kind === "bag" && (k.state === "fly" || k.state === "rest")) bag = k; });
    if (!bag && g.arm.load === "bag") {
      var a = g.arm.a, b = bowl(a);
      bag = { x: b.x - Math.sin(a) * 17, y: b.y + Math.cos(a) * 17, ang: a - Math.PI };
    }
    if (bag) top = bagTop(bag.x, bag.y, bag.ang);
    if (!top) { g.tag = null; return; }
    r = g.tag;
    if (!r) { // starts out standing up, and falls over
      r = g.tag = [];
      for (i = 0; i < 5; i++) r.push(knot(top[0], top[1] - Math.min(i, 3) * 6 - (i > 3 ? 10 : 0)));
      r[0].w = 0;
    }
    r[0].x = r[0].px = top[0]; r[0].y = r[0].py = top[1];
    var gg = G * dt * dt;
    for (i = 1; i < 5; i++) {
      var q = r[i], vx = (q.x - q.px) * 0.985, vy = (q.y - q.py) * 0.985;
      q.px = q.x; q.py = q.y;
      q.x += vx; q.y += vy + gg;
    }
    for (var n = 0; n < 6; n++) {
      for (i = 0; i < 3; i++) link(r[i], r[i + 1], 6, false);
      link(r[3], r[4], 10, true);
      // the tag's corners reach 6 either side of its middle line: down when
      // it lies on its side, sideways when it hangs
      var ux = Math.min(1, Math.abs(r[4].x - r[3].x) / 10), uy = Math.min(1, Math.abs(r[4].y - r[3].y) / 10);
      for (i = 1; i < 5; i++) lie(r[i], i >= 3 ? 1 + 6 * ux : 1, i >= 3 ? 1 + 6 * uy : 1, bag);
    }
  }
  // what the string and tag come to lie on: the table or the saucer, the
  // spoon, the cup's rim, cubes lying about; the cup's sides and the bag
  // itself keep them out (so they fall over its side, not through it)
  function lie(q, rad, side, bag) {
    var g = game, c = g.cup, fl = floorAt(q.x), s = spoonAt(q.x, g.arm.a, null);
    var co = Math.cos(bag.ang), si = Math.sin(bag.ang), dx = q.x - bag.x, dy = q.y - bag.y;
    var lx = co * dx + si * dy, ly = co * dy - si * dx, hx = 13 + side, hy = 15 + rad;
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
    if (q.y + rad > fl) { // lands: stops falling, and drags along
      q.y = q.py = fl - rad;
      q.px = q.x - (q.x - q.px) * 0.5;
    }
    q.x = clamp(q.x, g.L + side, g.R - side);
  }

  // the carried thing swings a little as it's moved
  function swing(dt) {
    var g = game, vx = dt > 0 && g.mx !== undefined ? (m.x - g.mx) / dt : 0;
    g.mx = m.x;
    g.sway += (clamp(vx * 0.0015, -0.7, 0.7) - g.sway) * Math.min(1, dt * 8);
  }
  function cursor() {
    var g = game, on = g.rise === 1 && m.on;
    root.classList.toggle("grabbing", !!g.carry);
    root.classList.toggle("grab", on && !g.carry && under(m.x, m.y) !== null);
  }

  // --- drawing ---------------------------------------------------------------

  function colors() {
    var s = getComputedStyle(root), d = dark.matches;
    function v(n) { return s.getPropertyValue(n).trim(); }
    col = { fg: v("--fg"), muted: v("--muted"), bg: v("--bg"), amber: v("--amber"), line: v("--line"),
      paper: d ? "#4a4034" : "#efe4d2",   // the tea bag
      silver: d ? "#34363a" : "#e7e9ec",  // the spoon
      sugar: d ? "#26262a" : "#ffffff" };
  }
  // "#a8722f" and an alpha to an rgba() colour (anything else is left as it is)
  function rgba(hex, a) {
    var r = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex || "");
    if (!r) return hex;
    var n = parseInt(r[1].length === 3 ? r[1].replace(/./g, "$&$&") : r[1], 16);
    return "rgba(" + (n >> 16) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")";
  }
  // the cursor bag: a filled shape with a fine ink line round it
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

  // --- shapes as points ---------------------------------------------------------

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
  // the same shape, every corner a little off, differently for each seed
  function crooked(pts, seed, by) {
    return pts.map(function (q, i) { var c = Math.floor(i / 4); return [q[0] + noise(seed * 3 + c * 1.7) * by, q[1] + noise(seed * 5 + c * 2.3 + 9) * by]; });
  }
  function shift(pts, x, y) { return pts.map(function (q) { return [q[0] + x, q[1] + y]; }); }

  // --- the pen ----------------------------------------------------------------
  // The table is drawn by hand with a fine pen. Every outline is a list of
  // points, redrawn a little wobbly: each point is pushed sideways by smooth
  // noise along the line (so the wobble belongs to the shape and travels and
  // turns with it), a closed line runs a little past where it started, the
  // pen presses harder here and there, and the colour is printed a touch off
  // the line. Shading is a few hatched strokes. Nothing boils: a cube looks
  // the same however it tumbles.

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
  // a line of points in short strokes, each pressed a little differently
  function scribble(q, w, color, seed) {
    ctx.strokeStyle = color; ctx.lineCap = ctx.lineJoin = "round";
    for (var i = 0; i < q.length - 1; i += 3) {
      ctx.beginPath(); ctx.moveTo(q[i][0], q[i][1]);
      for (var j = i + 1; j <= i + 3 && j < q.length; j++) ctx.lineTo(q[j][0], q[j][1]);
      ctx.lineWidth = w * (1 + 0.22 * noise(i * 0.4 + seed * 3));
      ctx.stroke();
    }
  }
  // o: seed, amp (how shaky), fill (a colour or a list of them, printed a
  // touch off), w, color, open (a line, not a shape), line: false (fill only)
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

  // --- the scene: a still life seen from the side -----------------------------

  var CUBE_BOX = box(CUBE, CUBE, 3), BAG_BOX = box(26, 30, 4), TAG_BOX = box(12, 10, 1.5), BOWL = oval(19, 8, 26);

  // the table: a pencil line, lifted off the paper twice
  function table(g) {
    var w = g.R - g.L, a = g.L + w * 0.31, b = g.L + w * 0.74;
    [[g.L, a - 3], [a + 3, b - 2], [b + 4, g.R]].forEach(function (s, i) {
      pen([[s[0], g.ground], [s[1], g.ground]], { open: true, seed: 50 + i * 3, w: 0.9, color: col.muted, amp: 0.7 });
    });
  }

  // a tulip-shaped teacup, straight sides curving into a flat foot
  function body(c) {
    var l = c.l, r = c.r, t = c.top, b = c.bottom, pts = [];
    bez(pts, [l, t], [l + 2, t + 44], [l + 6, b - 4], [l + 30, b], 18);
    bez(pts, [l + 30, b], [l + 60, b], [r - 60, b], [r - 30, b], 4);
    bez(pts, [r - 30, b], [r - 6, b - 4], [r - 2, t + 44], [r, t], 18);
    return pts;
  }
  // a D-shaped handle: a closed ring, its ends tucked behind the cup
  function handle(c) {
    var r = c.r, t = c.top, pts = [];
    bez(pts, [r - 8, t + 16], [r + 34, t + 8], [r + 34, t + 68], [r - 8, t + 64], 20);
    bez(pts, [r - 8, t + 56], [r + 20, t + 58], [r + 20, t + 22], [r - 8, t + 26], 16);
    return pts;
  }
  // the saucer: a thin plate, its rim turned up a little, on a low foot
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
    // tea: a flat wash, stronger the longer the bag has steeped, hatched
    // darker down the far side
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
    // a ring where something went in
    if (g.splash && g.splash.t < 0.7) {
      var sp = g.splash, w = 6 + sp.t * 40;
      ctx.save(); ctx.globalAlpha *= 1 - sp.t / 0.7;
      pen([[Math.max(c.l + 6, sp.x - w), c.surf - 1], [Math.min(c.r - 6, sp.x + w), c.surf - 1]], { open: true, seed: 107, w: 1, color: col.amber });
      ctx.restore();
    }
    // steam: three wavy strokes drifting up, more of it just after a splash
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
    // the cup itself, and its rim
    pen(shape, { open: true, seed: 101 });
    pen(shift(oval((c.r - c.l) / 2, 3, 30), c.cx, c.top), { seed: 104, w: 1.2, amp: 0.5 });
  }

  // --- sugar, the spoon, the tea bag ------------------------------------------------

  function cube(x, y, ang, seed, s) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang);
    if (s) ctx.scale(s, s);
    pen(crooked(CUBE_BOX, seed, 0.9), { seed: seed, fill: col.sugar, w: 1.3 });
    // two short strokes of shade in one corner
    for (var i = 0; i < 2; i++) {
      var o = 3.5 + i * 3.5;
      pen([[CUBE / 2 - 2.5, CUBE / 2 - o - 2.5], [CUBE / 2 - o - 2.5, CUBE / 2 - 2.5]], { open: true, seed: seed + i * 4, w: 0.8, color: col.muted, amp: 0.3 });
    }
    ctx.restore();
  }

  // a tea bag: a paper pouch folded over at the top, its string and tag
  // hanging off it (the rope, see tagStep)
  function bagTop(x, y, ang) { return [x + Math.sin(ang) * 15, y - Math.cos(ang) * 15]; }
  function bagBody(x, y, ang, seed) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang);
    pen(crooked(BAG_BOX, seed, 1.2), { seed: seed, fill: [col.paper, rgba(col.amber, 0.35)], w: 1.3 });
    pen([[-12, -9], [12, -9]], { open: true, seed: seed + 2, w: 0.9, amp: 0.5 }); // the fold
    ctx.restore();
  }
  function bagTag(x, y, ang, seed) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang);
    pen(crooked(TAG_BOX, seed + 5, 0.6), { seed: seed + 5, fill: col.bg, w: 1.1, amp: 0.5 });
    pen([[-3.5, 1.5], [-1.5, 0], [0.5, 1.5], [2.5, 0], [3.5, 1]], { open: true, seed: seed + 6, w: 0.9, color: col.amber, amp: 0.3 }); // printed on it
    ctx.restore();
  }
  function string(pts, seed) { pen(pts, { open: true, seed: seed + 9, w: 0.9, color: col.muted, amp: 0.3 }); }
  function teabag(x, y, ang, seed) {
    var r = game.tag;
    if (r) string([bagTop(x, y, ang)].concat(r.slice(1, 4).map(function (q) { return [q.x, q.y]; })), seed);
    bagBody(x, y, ang, seed);
    if (r) bagTag((r[3].x + r[4].x) / 2, (r[3].y + r[4].y) / 2, Math.atan2(r[4].y - r[3].y, r[4].x - r[3].x) - Math.PI / 2, seed);
  }

  function drawCatapult() {
    var g = game, q = g.pivot, a = g.arm.a, b = bowl(a), t = tail(a), dx = Math.cos(a), dy = Math.sin(a);
    var nx = -dy, ny = dx; // n: "up" off the spoon
    // two cubes underneath for the hinge
    cube(q.x, g.ground - CUBE / 2, 0, 7);
    cube(q.x, g.ground - CUBE * 1.5, 0, 13);
    // the spoon: a slim handle with a rounded end, then the bowl
    var neck = [b.x - dx * 17, b.y - dy * 17];
    pen([[t.x + nx * 2.5, t.y + ny * 2.5], [neck[0] + nx * 1.5, neck[1] + ny * 1.5],
      [neck[0] - nx * 1.5, neck[1] - ny * 1.5], [t.x - nx * 2.5, t.y - ny * 2.5],
      [t.x - dx * 2 - nx * 1.5, t.y - dy * 2 - ny * 1.5], [t.x - dx * 2.5, t.y - dy * 2.5],
      [t.x - dx * 2 + nx * 1.5, t.y - dy * 2 + ny * 1.5]], { seed: 23, fill: col.silver, w: 1.2, amp: 0.35 });
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a);
    pen(BOWL, { seed: 29, fill: col.silver, w: 1.3, amp: 0.6 });
    pen(oval(12, 4, 8, Math.PI * 0.25, Math.PI * 0.7), { open: true, seed: 31, w: 0.8, color: col.muted, amp: 0.3 }); // its hollow
    ctx.restore();
    if (g.arm.load === "bag") teabag(b.x + nx * 17, b.y + ny * 17, a - Math.PI, g.arm.seed);
    else if (g.arm.load) cube(b.x + nx * (CUBE / 2 + 2), b.y + ny * (CUBE / 2 + 2), a, g.arm.seed);
  }

  // what's being carried hangs under the pointer, faint where it can't go
  function drawCarry() {
    var g = game, c = g.carry, bag = c.kind === "bag";
    ctx.save();
    if (!zone(m.x, m.y, c.kind) && !(bag && overCup(m.x, m.y))) ctx.globalAlpha *= 0.4;
    if (bag) teabag(m.x - Math.sin(g.sway) * 38, m.y + 8 + Math.cos(g.sway) * 38, g.sway, c.seed);
    else cube(m.x + HOLD.x, m.y + HOLD.y, g.sway * 0.5, c.seed);
    ctx.restore();
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    if (!held) return;
    if (game) {
      var g = game, c = g.cup, e = ease(g.rise);
      ctx.save();
      ctx.globalAlpha = e; ctx.translate(0, (1 - e) * 8); // settles onto the table
      table(g);
      drawCupBack(c, g.ground);
      g.cubes.forEach(function (k) { // the steeping bag hangs in the tea, the tea in front of it
        if (k.state !== "steep" || !k.tag) return;
        string([bagTop(k.x, k.y, k.ang), [c.l + 8, c.top]], k.seed);
        bagBody(k.x, k.y, k.ang, k.seed);
      });
      g.cubes.forEach(function (k) { // dissolving: smaller and fainter
        if (k.state !== "in") return;
        ctx.save(); ctx.globalAlpha *= Math.max(0, 1 - k.t / 1.8); cube(k.x, k.y, k.ang, k.seed, 1 - 0.45 * k.t / 1.8); ctx.restore();
      });
      g.drops.forEach(function (d) {
        if (!d.bub) return;
        ctx.beginPath(); ctx.arc(d.x, d.y, 1.4, 0, 7); stroke(1, rgba(col.amber, 0.8));
      });
      drawCupFront(c, t);
      g.cubes.forEach(function (k) { // its string over the rim, the tag hanging outside
        if (k.state !== "steep" || !k.tag) return;
        string(quad([], [c.l + 8, c.top], [c.l - 2, c.top - 6], [k.tag.x, k.tag.y - 5], 6), k.seed);
        bagTag(k.tag.x, k.tag.y, 0, k.seed);
      });
      drawCatapult();
      g.cubes.forEach(function (k) {
        if (k.state === "in" || k.state === "steep") return;
        if (k.kind === "bag") teabag(k.x, k.y, k.ang, k.seed); else cube(k.x, k.y, k.ang, k.seed);
      });
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

  // the "_" in the name is the bag: click it to pick it up or put it back
  document.addEventListener("click", function (e) {
    if (!(e.target.closest && e.target.closest(".bag"))) return;
    e.preventDefault(); e.stopPropagation();
    m.x = e.clientX; m.y = e.clientY; m.on = true;
    hold(!held);
  }, true);

  // whatever is carried goes back when the pointer leaves the window or the
  // window loses focus mid-drag
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
