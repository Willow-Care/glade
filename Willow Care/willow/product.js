/* ==========================================================================
   Willow product page — interactions
   ========================================================================== */

(function () {
  'use strict';

  /* ---- Mobile drawer ---- */
  var menuBtn = document.getElementById('mobileMenuBtn');
  var closeBtn = document.getElementById('mobileMenuClose');
  var drawer = document.getElementById('mobileDrawer');

  function openDrawer() {
    document.body.classList.add('nav-open');
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'true');
  }

  function closeDrawer() {
    document.body.classList.remove('nav-open');
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
  }

  if (menuBtn) menuBtn.addEventListener('click', openDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (drawer) {
    drawer.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeDrawer);
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDrawer();
  });

  /* ---- Scroll reveal ---- */
  var revealEls = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window && revealEls.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
    );

    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ---- Feature showcase: swap the sticky screenshot as steps scroll ---- */
  var steps = document.querySelectorAll('.showcase-step');
  var shots = document.querySelectorAll('.shot');

  if (steps.length && shots.length) {
    function setActive(i) {
      steps.forEach(function (s) { s.classList.toggle('is-active', Number(s.dataset.i) === i); });
      shots.forEach(function (s) { s.classList.toggle('is-active', Number(s.dataset.i) === i); });
    }

    if ('IntersectionObserver' in window) {
      // A step becomes active when it crosses a thin band at the viewport's
      // vertical center (top/bottom margins pulled in by 45% each).
      var stepObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) setActive(Number(entry.target.dataset.i));
          });
        },
        { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
      );
      steps.forEach(function (s) { stepObserver.observe(s); });
    }
    // If IO is unavailable the CSS default (first shot active) still shows a
    // screenshot, and the mobile layout reveals every shot regardless.
  }

  /* ---- Lightbox: click a screenshot to enlarge ---- */
  var shotImgs = document.querySelectorAll('.shot-canvas img');
  if (shotImgs.length) {
    var lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Screenshot preview');
    lb.innerHTML =
      '<button class="lightbox-close" type="button" aria-label="Close preview">' +
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
      '</button>' +
      '<img alt="">';
    document.body.appendChild(lb);

    var lbImg = lb.querySelector('img');
    var lbClose = lb.querySelector('.lightbox-close');
    var lastFocused = null;

    function openLightbox(src, alt) {
      lastFocused = document.activeElement;
      lbImg.src = src;
      lbImg.alt = alt || 'Screenshot preview';
      lb.classList.add('is-open');
      document.body.classList.add('lightbox-open');
      lbClose.focus();
    }
    function closeLightbox() {
      if (!lb.classList.contains('is-open')) return;
      lb.classList.remove('is-open');
      document.body.classList.remove('lightbox-open');
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

    shotImgs.forEach(function (img) {
      img.addEventListener('click', function () {
        openLightbox(img.currentSrc || img.src, img.alt);
      });
    });
    lbImg.addEventListener('click', closeLightbox);          // click the big image to close
    lbClose.addEventListener('click', closeLightbox);
    lb.addEventListener('click', function (e) {              // click the backdrop to close
      if (e.target === lb) closeLightbox();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeLightbox();
    });
  }

  /* ---- Sticky nav shadow on scroll ---- */
  var siteNav = document.querySelector('.site-nav');
  if (siteNav) {
    var lastScrolled = false;
    window.addEventListener('scroll', function () {
      var scrolled = window.scrollY > 8;
      if (scrolled !== lastScrolled) {
        siteNav.style.boxShadow = scrolled ? 'var(--shadow-sm)' : 'none';
        lastScrolled = scrolled;
      }
    }, { passive: true });
  }
})();
