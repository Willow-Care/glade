/* ==========================================================================
   Willow pricing page — checkout + contact modal
   ========================================================================== */

(function () {
  'use strict';

  /* ---------------------------------------------------------------------
     Checkout hand-off to the Willow app
     This marketing site is static (no server), so it can never hold a
     Polar access token. Checkout itself has to happen inside the Willow
     app, where we know which signed-in user and which care profile is
     billing owner for the subscription (see docs/polar-integration.md).

     Each button carries data-plan ("core" | "premium"). Clicking it sends
     the visitor to the app's dashboard with ?plan=<plan>. The app:
       - redirects signed-out visitors through /login (preserving ?plan=
         across sign-in/sign-up), then
       - auto-starts Polar Checkout for the billing owner (or opens
         Settings > Billing if they're not the owner, or already subscribed).

     A data-checkout-link attribute is still honored if you'd rather point a
     button straight at a Polar Checkout Link instead (no app hop).
     ------------------------------------------------------------------ */

  var WILLOW_APP_URL = 'https://willow.willowcare.app';

  var checkoutButtons = document.querySelectorAll('.price-cta[data-plan]');

  checkoutButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      var plan = button.getAttribute('data-plan');
      var paymentLink = button.getAttribute('data-checkout-link');

      if (paymentLink) {
        window.location.href = paymentLink;
        return;
      }

      button.setAttribute('data-loading', 'true');
      button.innerHTML = 'Opening Willow…';
      window.location.href = WILLOW_APP_URL + '/dashboard?plan=' + encodeURIComponent(plan);
    });
  });

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
