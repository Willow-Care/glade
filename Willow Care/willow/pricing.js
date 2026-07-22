/* ==========================================================================
   Willow pricing page — checkout + contact modal
   ========================================================================== */

(function () {
  'use strict';

  /* ---------------------------------------------------------------------
     Stripe Checkout
     Each button below carries data-price-id (the Stripe Price ID for that
     plan's monthly recurring price) and data-stripe-link (an optional
     Stripe Payment Link URL).

     If a Payment Link is set, we redirect straight to it, no backend
     required. Otherwise we call the /api/checkout route described in
     docs/stripe-integration.md, which creates a Checkout Session server
     side and returns its URL.
     ------------------------------------------------------------------ */

  var checkoutButtons = document.querySelectorAll('.price-cta[data-plan]');

  checkoutButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      var plan = button.getAttribute('data-plan');
      var priceId = button.getAttribute('data-price-id');
      var paymentLink = button.getAttribute('data-stripe-link');

      if (paymentLink) {
        window.location.href = paymentLink;
        return;
      }

      startCheckout(plan, priceId, button);
    });
  });

  function startCheckout(plan, priceId, button) {
    button.setAttribute('data-loading', 'true');
    var originalLabel = button.innerHTML;
    button.innerHTML = 'Redirecting…';

    fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: plan, priceId: priceId })
    })
      .then(function (res) {
        if (!res.ok) throw new Error('Checkout session request failed');
        return res.json();
      })
      .then(function (data) {
        if (data && data.url) {
          window.location.href = data.url;
        } else {
          throw new Error('Missing checkout URL in response');
        }
      })
      .catch(function () {
        button.removeAttribute('data-loading');
        button.innerHTML = originalLabel;
        window.alert(
          'Checkout isn\'t connected yet. Add a Stripe Payment Link to this button, ' +
          'or wire up /api/checkout — see docs/stripe-integration.md for the full guide.'
        );
      });
  }

  /* ---------------------------------------------------------------------
     Enterprise "Contact us" lead-gen modal
     ------------------------------------------------------------------ */

  var contactBtn = document.getElementById('enterpriseContactBtn');
  var overlay = document.getElementById('contactModalOverlay');
  var closeBtn = document.getElementById('contactModalClose');
  var form = document.getElementById('contactForm');
  var status = document.getElementById('contactFormStatus');

  function openModal() {
    if (!overlay) return;
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!overlay) return;
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  if (contactBtn) contactBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
  });

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = Object.fromEntries(new FormData(form).entries());

      status.textContent = 'Sending…';
      status.classList.remove('is-error');

      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Contact request failed');
          status.textContent = 'Thanks. Our team will follow up shortly.';
          form.reset();
        })
        .catch(function () {
          // No backend deployed yet: fall back to a pre-filled email so the
          // lead is never lost. Swap this out once /api/contact is live.
          var subject = encodeURIComponent('Willow Enterprise inquiry: ' + (data.organization || ''));
          var body = encodeURIComponent(
            'Name: ' + (data.name || '') + '\n' +
            'Email: ' + (data.email || '') + '\n' +
            'Organization: ' + (data.organization || '') + '\n' +
            'Approximate patients: ' + (data.patientCount || '') + '\n\n' +
            (data.message || '')
          );
          window.location.href = 'mailto:sales@willowcare.app?subject=' + subject + '&body=' + body;
          status.textContent = 'Opening your email client to send this to our team.';
        });
    });
  }
})();
