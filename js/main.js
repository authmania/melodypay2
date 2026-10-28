// MelodyPay landing page interactions
(function () {
  const PAYMENT_URL = 'https://flutterwave.com/pay/zvgrdkvcjznc';

  const naira = (n) => '₦' + Math.round(n).toLocaleString('en-NG');

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('year').textContent = new Date().getFullYear();

    /* ---------- Mobile nav ---------- */
    const nav = document.getElementById('nav');
    const toggle = document.getElementById('navToggle');
    function setMenu(open) {
      nav.classList.toggle('open', open);
      document.body.classList.toggle('menu-open', open);
      toggle.setAttribute('aria-expanded', open);
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      toggle.innerHTML = icon(open ? 'x' : 'menu');
    }
    toggle.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
    document.querySelectorAll('#navLinks a, #navLinks button').forEach((el) =>
      el.addEventListener('click', () => setMenu(false))
    );
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
    window.matchMedia('(min-width: 1025px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

    /* ---------- Auth modal ---------- */
    const modal = document.getElementById('authModal');
    const form = document.getElementById('authForm');
    const nameField = document.getElementById('nameField');
    const confirmField = document.getElementById('confirmField');
    const formError = document.getElementById('authFormError');
    const title = document.getElementById('authTitle');
    const sub = document.getElementById('authSub');
    const submit = document.getElementById('authSubmit');
    let mode = 'signup';

    function setMode(m) {
      mode = m;
      document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === m));
      nameField.hidden = m === 'login';
      confirmField.hidden = m === 'login';
      form.password.autocomplete = m === 'login' ? 'current-password' : 'new-password';
      title.textContent = m === 'signup' ? 'Create your account' : 'Welcome back';
      sub.textContent = m === 'signup'
        ? 'Start turning your music time into real money.'
        : 'Log in to keep listening, tapping and earning.';
      submit.textContent = m === 'signup' ? 'Create account' : 'Log in';
      form.querySelectorAll('.field-error').forEach((e) => (e.textContent = ''));
    }

    function openModal(m) {
      setMode(m);
      modal.classList.add('open');
      setTimeout(() => form.querySelector(m === 'signup' ? '#authName' : '#authEmail').focus(), 50);
    }
    function closeModal() { modal.classList.remove('open'); }

    document.querySelectorAll('[data-auth]').forEach((b) =>
      b.addEventListener('click', () => openModal(b.dataset.auth))
    );
    document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => setMode(t.dataset.tab)));
    modal.addEventListener('click', (e) => { if (e.target === modal || e.target.closest('[data-close]')) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

    const setError = (field, msg) => {
      form[field].closest('.field').querySelector('.field-error').textContent = msg;
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const signup = mode === 'signup';
      const name = form.name.value.trim();
      const email = form.email.value.trim();
      const pass = form.password.value;
      const errs = {
        name: signup && name.length < 2 ? 'Please enter your name.' : '',
        email: /^\S+@\S+\.\S+$/.test(email) ? '' : 'Enter a valid email address.',
        password: pass.length >= 6 ? '' : 'Password must be at least 6 characters.',
        confirm: signup && form.confirm.value !== pass ? 'Passwords do not match.' : ''
      };
      Object.entries(errs).forEach(([k, msg]) => setError(k, msg));
      formError.textContent = '';
      if (Object.values(errs).some(Boolean)) return;

      submit.disabled = true;
      submit.textContent = 'Please wait…';
      const res = signup ? await Auth.register({ name, email, password: pass }) : await Auth.login(email, pass);
      if (!res.ok) {
        setError(res.field, res.error);
        submit.disabled = false;
        submit.textContent = signup ? 'Create account' : 'Log in';
        return;
      }
      // After register / login, always send to payment (never the dashboard).
      // usePaymentLink ON -> external payment link; OFF -> internal payment page.
      try { await window.MelodyConfigReady; } catch { /* ignore */ }
      const cfg = window.MelodyConfig || {};
      const usePaymentLink = cfg.usePaymentLink !== false;
      const link = cfg.paymentLink1 || cfg.paymentLink || PAYMENT_URL;
      window.location.href = (usePaymentLink && link) ? link : 'payment.html';
    });

    // Open the login/signup modal when arriving via #login / #signup
    if (location.hash === '#login' || location.hash === '#signup') {
      openModal(location.hash.slice(1));
      history.replaceState(null, '', location.pathname);
    }

    /* ---------- Count-up stats ---------- */
    function countUp(el) {
      const target = +el.dataset.count;
      const prefix = el.dataset.prefix || '';
      const suffix = el.dataset.suffix || '';
      const start = performance.now();
      const dur = 1400;
      (function tick(now) {
        const p = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = prefix + Math.round(target * eased).toLocaleString('en-NG') + suffix;
        if (p < 1) requestAnimationFrame(tick);
      })(start);
    }
    document.querySelectorAll('[data-count]').forEach(countUp);

    /* ---------- Earnings calculator ---------- */
    const sliders = ['songs', 'tasks', 'refs'].map((id) => document.getElementById(id));
    function calc() {
      const [songs, tasks, refs] = sliders.map((s) => +s.value);
      sliders.forEach((s) => (document.getElementById(s.id + 'Val').textContent = s.value));
      const monthly = (songs * 2000 + tasks * 2000) * 30 + refs * 1000;
      document.getElementById('calcTotal').textContent = naira(monthly);
    }
    sliders.forEach((s) => s.addEventListener('input', calc));
    calc();

    /* ---------- Reveal on scroll ---------- */
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.15 });
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  });
})();
