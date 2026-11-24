/* ==========================================================================
   首页全屏 Deck 交互
   --------------------------------------------------------------------------
   Stage 0（首屏）  ──向下滚动/上滑/↓────────▶  Stage 1（文章列表横向滑入）
   Stage 0（首屏）  ◀──向上滚动/下滑/↑─────────  Stage 1（且列表已滚到顶部）

   · 切换期间加锁，吞掉滑轨惯性产生的抖动
   · #wrap 成为内部滚动容器，原生滚动事件照常抛给 AOS / lazysizes
   ========================================================================== */
(function () {
  "use strict";

  var body = document.body;
  if (!body || !body.classList.contains("home-deck")) return;

  var wrap = document.getElementById("wrap");
  var hero = document.getElementById("home-hero");
  var content = document.getElementById("content");
  var footer = document.getElementById("footer");
  var nav = document.getElementById("header-nav");
  if (!wrap || !hero || !content) return;

  /* 与 static/css/home-deck.css 的 --deck-dur 保持一致 */
  var DUR = 900;
  /* 展开后再等这么久才允许收起，避免触控板惯性一路把页面顶回去 */
  var CLOSE_GUARD = 1100;
  var WHEEL_MIN = 0.5;
  var SWIPE_MIN = 58;
  var PULL_MIN = 64;

  var now =
    window.performance && performance.now
      ? function () {
          return performance.now();
        }
      : function () {
          return Date.now();
        };

  var state = {
    open: false,
    lockUntil: 0,
    closeGuardUntil: 0,
  };

  function moving(on) {
    [content, footer].forEach(function (el) {
      if (el) el.style.willChange = on ? "transform" : "";
    });
  }

  /* 滚动容器从 document 换成了 #wrap，两件事必须手动补：
     · AOS 的 scroll 监听挂在 window 上，而且它的 position 只在 refresh 时才算，
       直接派发 window scroll 只会用旧坐标判定（甚至把已出现的卡片重新隐藏），
       所以这里调 AOS.refresh()，让它按最新的 #wrap.scrollTop 重算。
     · lazySizes 在 document 的捕获阶段监听 scroll，原生事件本来就能收到；
       但「展开卡带」这一步没有滚动事件，需要手动补一发。
     注意：绝不能在 document 上派发 scroll —— 主题 main.ts 会误判方向并收起导航。 */
  var forwarding = false;
  function refreshAOS() {
    if (window.AOS && typeof window.AOS.refresh === "function") {
      window.AOS.refresh();
    }
  }
  function nudgeScroll() {
    if (forwarding) return;
    forwarding = true;
    wrap.dispatchEvent(new Event("scroll"));
    forwarding = false;
    refreshAOS();
  }

  function updateTopBtn() {
    var btn = document.querySelector(".sidebar-top");
    if (!btn) return;
    var show = state.open && wrap.scrollTop > 240;
    btn.style.opacity = show ? "1" : "0";
    btn.style.pointerEvents = show ? "auto" : "none";
  }

  function measureNav() {
    if (!nav) return;
    var h = nav.offsetHeight || 62;
    body.style.setProperty("--deck-nav-offset", h + 18 + "px");
  }

  function openDeck(silent) {
    if (state.open) return;
    state.open = true;
    wrap.scrollTop = 0;
    moving(true);
    body.classList.add("deck-open");
    hero.setAttribute("aria-hidden", "true");
    state.lockUntil = now() + DUR;
    state.closeGuardUntil = now() + DUR + CLOSE_GUARD;
    updateTopBtn();

    window.setTimeout(function () {
      moving(false);
      nudgeScroll();
      updateTopBtn();
    }, DUR + 80);

    if (!silent && window.history && history.replaceState) {
      // 不写历史记录，只保证刷新后不落在锚点乱跳的状态
      try {
        history.replaceState(null, "", location.pathname + location.search);
      } catch (err) {
        /* file:// 下会抛错，忽略 */
      }
    }
  }

  function closeDeck() {
    if (!state.open) return;
    state.open = false;
    wrap.scrollTop = 0;
    moving(true);
    body.classList.remove("deck-open");
    hero.setAttribute("aria-hidden", "false");
    state.lockUntil = now() + DUR;
    updateTopBtn();

    window.setTimeout(function () {
      moving(false);
    }, DUR + 80);
  }

  /* ---------------------------------------------------------------- 滚轮 */
  function onWheel(e) {
    if (e.ctrlKey) return; // 保留 ctrl + 滚轮缩放
    var dy = e.deltaY;
    if (!dy || Math.abs(dy) < WHEEL_MIN) return;
    var t = now();

    if (!state.open) {
      e.preventDefault();
      if (t < state.lockUntil) return;
      if (dy > 0) openDeck();
      return;
    }

    var top = wrap.scrollTop;

    // 切换动画进行中：列表还没到位时不让页面跟着滚
    if (t < state.lockUntil) {
      if (top <= 0) e.preventDefault();
      return;
    }

    if (top <= 0 && dy < 0 && t > state.closeGuardUntil) {
      e.preventDefault();
      closeDeck();
    }
  }

  /* ---------------------------------------------------------- 触屏：首屏 */
  var heroStart = { x: 0, y: 0, axis: 0, active: false };

  hero.addEventListener(
    "touchstart",
    function (e) {
      if (state.open || e.touches.length !== 1) return;
      heroStart.x = e.touches[0].clientX;
      heroStart.y = e.touches[0].clientY;
      heroStart.axis = 0;
      heroStart.active = true;
    },
    { passive: true },
  );

  hero.addEventListener(
    "touchmove",
    function (e) {
      if (!heroStart.active || state.open) return;
      var dx = e.touches[0].clientX - heroStart.x;
      var dy = e.touches[0].clientY - heroStart.y;

      if (!heroStart.axis) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        heroStart.axis = Math.abs(dy) > Math.abs(dx) * 1.2 ? 1 : 2;
      }
      if (heroStart.axis !== 1) return;

      e.preventDefault();
      if (dy < -SWIPE_MIN && now() > state.lockUntil) {
        heroStart.active = false;
        openDeck();
      }
    },
    { passive: false },
  );

  hero.addEventListener(
    "touchend",
    function () {
      heroStart.active = false;
    },
    { passive: true },
  );

  /* ------------------------------------------------------ 触屏：列表顶部 */
  var listStart = { x: 0, y: 0, base: 0, axis: 0, pull: false, active: false };

  wrap.addEventListener(
    "touchstart",
    function (e) {
      if (!state.open || e.touches.length !== 1) {
        listStart.active = false;
        return;
      }
      listStart.x = e.touches[0].clientX;
      listStart.y = e.touches[0].clientY;
      listStart.base = wrap.scrollTop;
      listStart.axis = 0;
      listStart.pull = false;
      listStart.active = true;
    },
    { passive: true },
  );

  wrap.addEventListener(
    "touchmove",
    function (e) {
      if (!listStart.active) return;
      var dx = e.touches[0].clientX - listStart.x;
      var dy = e.touches[0].clientY - listStart.y;

      if (!listStart.axis) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        listStart.axis = Math.abs(dy) > Math.abs(dx) * 1.2 ? 1 : 2;
        // 只有「已在顶部 + 向下拖」才由脚本接管，其余交给浏览器原生滚动
        listStart.pull =
          listStart.axis === 1 && listStart.base <= 0 && dy > 0;
      }
      if (!listStart.pull) return;
      if (now() < state.lockUntil) return;

      e.preventDefault();
      if (dy > PULL_MIN) {
        listStart.active = false;
        listStart.pull = false;
        closeDeck();
      }
    },
    { passive: false },
  );

  wrap.addEventListener(
    "touchend",
    function () {
      listStart.active = false;
      listStart.pull = false;
    },
    { passive: true },
  );

  /* ---------------------------------------------------------------- 键盘 */
  window.addEventListener("keydown", function (e) {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    var el = e.target;
    if (!el || typeof el.closest !== "function") return;
    if (el.closest("input, textarea, select, button, a, [contenteditable]")) return;

    if (!state.open) {
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        openDeck();
      }
      return;
    }

    if (wrap.scrollTop <= 0 && (e.key === "ArrowUp" || e.key === "PageUp")) {
      e.preventDefault();
      closeDeck();
    }
  });

  /* -------------------------------------------------- 滚动事件 / 头部按钮 */
  var ticking = false;
  wrap.addEventListener(
    "scroll",
    function () {
      if (forwarding) return;
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        refreshAOS();
        updateTopBtn();
      });
    },
    { passive: true },
  );

  // 主题的回到顶部按钮绑的是 window.scrollTo，在 deck 里无效；改为滚 #wrap
  document.addEventListener(
    "click",
    function (e) {
      var btn = e.target && e.target.closest && e.target.closest(".sidebar-top");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      wrap.scrollTo({ top: 0, behavior: "smooth" });
    },
    true,
  );

  /* ------------------------------------------------------------ 首屏按钮 */
  hero.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest(".home-hero__scroll");
    if (!btn) return;
    e.preventDefault();
    openDeck();
  });

  /* ---------------------------------------------------------- 笔迹兜底 */
  /* 有些环境会把动画跳过或截断：后台标签页节流、reduce-motion、
     pathLength 归一化实现有差异等。到最后一笔应该画完的时刻，
     强制把每一笔变成完整实线，保证标题最终一定是可读的整字。 */
  function settleHandwriting() {
    var strokes = hero.querySelectorAll(".home-hero__stroke");
    if (!strokes.length) return;
    var finish = 0;
    Array.prototype.forEach.call(strokes, function (p) {
      var cs = window.getComputedStyle(p);
      var delay = parseFloat(cs.getPropertyValue("--o")) || 0;
      var dur = parseFloat(cs.getPropertyValue("--dur")) || 0;
      finish = Math.max(finish, delay + dur);
    });
    window.setTimeout(function () {
      Array.prototype.forEach.call(strokes, function (p) {
        p.style.strokeDasharray = "none";
        p.style.strokeDashoffset = "0";
      });
    }, finish + 160);
  }

  /* ---------------------------------------------------------------- 初始化 */
  function init() {
    measureNav();
    updateTopBtn();
    settleHandwriting();

    // 带锚点进来时直接落到列表，避免首屏挡住目标位置
    if (location.hash && location.hash.length > 1) {
      openDeck(true);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.addEventListener(
    "resize",
    (function () {
      var timer = 0;
      return function () {
        window.clearTimeout(timer);
        timer = window.setTimeout(measureNav, 160);
      };
    })(),
  );

  window.addEventListener("wheel", onWheel, { passive: false });
})();
