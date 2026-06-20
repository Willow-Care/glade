/* ==========================================================================
   Willow Care — Home page interactions
   ========================================================================== */

(function () {
  'use strict';

  /* ---- Expanding "canopy" products panel ---- */
  var trigger = document.getElementById('navTrigger');
  var panel = document.getElementById('navPanel');

  if (trigger && panel) {
    var closePanel = function () {
      panel.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
    };

    var openPanel = function () {
      panel.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
    };

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = panel.classList.contains('is-open');
      isOpen ? closePanel() : openPanel();
    });

    document.addEventListener('click', function (e) {
      if (!panel.contains(e.target) && e.target !== trigger) {
        closePanel();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closePanel();
    });

    // Close when navigating via a link inside the panel
    panel.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closePanel);
    });
  }

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
