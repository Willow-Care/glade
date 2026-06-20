/* ==========================================================================
   Willow Care — Genesis page interactions (scroll-spy TOC)
   ========================================================================== */

(function () {
  'use strict';

  var sections = document.querySelectorAll('.story-section[id]');
  var tocLinks = document.querySelectorAll('.story-toc a');

  if (!sections.length || !tocLinks.length) return;

  var linkFor = {};
  tocLinks.forEach(function (link) {
    var id = link.getAttribute('href').replace('#', '');
    linkFor[id] = link;
  });

  function setActive(id) {
    tocLinks.forEach(function (link) { link.classList.remove('is-active'); });
    if (linkFor[id]) linkFor[id].classList.add('is-active');
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: 0 }
    );

    sections.forEach(function (section) { io.observe(section); });
  }

  /* Reveal for the closing CTA on this page */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    var revealIo = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealIo.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealEls.forEach(function (el) { revealIo.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }
})();
