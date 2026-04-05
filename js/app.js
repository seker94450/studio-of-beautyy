const PRODUCT_DESCRIPTION = `Un carnet digital complet permettant de gérer jusqu'à 1040 clientes avec 2 pages détaillées par cliente, soit 1086 pages au total.

Entièrement interactif, il offre une navigation fluide via liens internes : chaque fiche est accessible en un clic, directement depuis une organisation alphabétique structurée, regroupant jusqu'à 40 noms par section.

Compatible avec les applications PDF et optimisé pour une utilisation au stylet, il a été conçu pour être rapide, intuitif et facile à parcourir.

Il inclut également un suivi complet de l'activité avec un bilan annuel, un suivi mensuel et un résumé mensuel.

Des instructions et tutoriels sont fournis après l'achat pour guider l'utilisation du carnet.`;

const PRODUCTS = {
  'brow-beige': {
    title: "L'Essentiel Brow",
    color: 'Version Beige',
    price: '8,95 €',
    category: 'brow',
    hover: 'images/placeholder.svg',
    images: ['images/placeholder.svg', 'images/placeholder.svg', 'images/placeholder.svg', 'images/placeholder.svg', 'images/placeholder.svg', 'images/placeholder.svg']
  },
  'brow-gray': {
    title: "L'Essentiel Brow",
    color: 'Version Gris',
    price: '8,95 €',
    category: 'brow',
    hover: 'images/placeholder.svg',
    images: ['images/placeholder.svg', 'images/placeholder.svg', 'images/placeholder.svg', 'images/placeholder.svg', 'images/placeholder.svg', 'images/placeholder.svg']
  },
  'lash-beige': {
    title: "L'Essentiel Lash",
    color: 'Version Beige',
    price: '8,95 €',
    category: 'lash',
    hover: 'images/placeholder.svg',
    images: ['images/placeholder.svg', 'images/placeholder.svg', 'images/placeholder.svg', 'images/placeholder.svg', 'images/placeholder.svg', 'images/placeholder.svg']
  },
  'lash-gray': {
    title: "L'Essentiel Lash",
    color: 'Version Gris',
    price: '8,95 €',
    category: 'lash',
    hover: 'images/placeholder.svg',
    images: ['images/placeholder.svg', 'images/placeholder.svg', 'images/placeholder.svg', 'images/placeholder.svg', 'images/placeholder.svg', 'images/placeholder.svg']
  }
};

const STORAGE_USERS = 'sob_users';
const STORAGE_SESSION = 'sob_current_user';
const STORAGE_REVIEWS = 'sob_reviews';

let productSliderIntervals = {};
let homeReviewsInterval = null;

function formatReviewDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function stars(rating) {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

function getReviews() {
  return JSON.parse(localStorage.getItem(STORAGE_REVIEWS) || '[]');
}

function saveReviews(reviews) {
  localStorage.setItem(STORAGE_REVIEWS, JSON.stringify(reviews));
}

function renderReviewsPage() {
  const wrap = document.getElementById('reviewsList');
  if (!wrap) return;
  const reviews = getReviews().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (!reviews.length) {
    wrap.innerHTML = '<div class="reviews-empty">Aucun avis pour le moment. Soyez la première à laisser un commentaire.</div>';
    return;
  }
  wrap.innerHTML = `<div class="reviews-grid">${reviews.map(review => `
    <article class="review-card">
      <div class="review-card-name">${review.name}</div>
      <div class="review-card-date">${formatReviewDate(review.createdAt)}</div>
      <div class="review-card-stars">${stars(review.rating)}</div>
      <div class="review-card-text">${review.text}</div>
    </article>
  `).join('')}</div>`;
}

function renderHomeReviews() {
  const slider = document.getElementById('homeReviewsSlider');
  const empty = document.getElementById('homeReviewsEmpty');
  if (!slider) return;
  const reviews = getReviews().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3);

  slider.querySelectorAll('.home-review-slide').forEach(el => el.remove());
  if (homeReviewsInterval) clearInterval(homeReviewsInterval);

  if (!reviews.length) {
    if (empty) empty.style.display = 'flex';
    return;
  }

  if (empty) empty.style.display = 'none';
  reviews.forEach((review, index) => {
    const article = document.createElement('article');
    article.className = `home-review-slide ${index === 0 ? 'active' : ''}`;
    article.innerHTML = `
      <div class="home-review-head">
        <div class="home-review-name">${review.name}</div>
        <div class="home-review-date">${formatReviewDate(review.createdAt)}</div>
      </div>
      <div class="home-review-stars">${stars(review.rating)}</div>
      <div class="home-review-text">${review.text}</div>
    `;
    slider.appendChild(article);
  });

  const slides = slider.querySelectorAll('.home-review-slide');
  let current = 0;
  homeReviewsInterval = setInterval(() => {
    slides[current].classList.remove('active');
    current = (current + 1) % slides.length;
    slides[current].classList.add('active');
  }, 5000);
}

function openReviewModal() {
  document.getElementById('reviewModal').classList.add('visible');
}

function closeReviewModal() {
  document.getElementById('reviewModal').classList.remove('visible');
  showMessage('reviewMessage', '', 'success');
}

function buildShopCards() {
  document.querySelectorAll('.shop-card').forEach(card => {
    const productKey = card.dataset.product;
    const product = PRODUCTS[productKey];
    const media = card.querySelector('.shop-card-media');
    if (!product || !media) return;
    media.innerHTML = product.images.slice(0, 3).map((img, index) => `
      <div class="shop-slide ${index === 0 ? 'is-visible' : ''}">
        <img src="${img}" alt="${product.title} ${product.color}">
      </div>
    `).join('');

    const slides = media.querySelectorAll('.shop-slide');
    let current = 0;
    let interval = null;

    function show(index) {
      slides.forEach((slide, i) => slide.classList.toggle('is-visible', i === index));
      current = index;
    }

    function start() {
      if (slides.length <= 1 || interval) return;
      interval = setInterval(() => {
        show((current + 1) % slides.length);
      }, 1200);
    }

    function stop() {
      if (!interval) return;
      clearInterval(interval);
      interval = null;
      show(0);
    }

    card.addEventListener('mouseenter', start);
    card.addEventListener('mouseleave', stop);
    card.addEventListener('touchstart', start, { passive: true });
  });
}

function buildProductPage() {
  const page = document.querySelector('.product-page-template');
  if (!page) return;
  const slug = page.dataset.product;
  const product = PRODUCTS[slug];
  if (!product) return;
  page.innerHTML = `
    <div class="product-page">
      <div class="product-wrap">
        <div class="product-eyebrow">Fiche produit</div>
        <div class="product-grid">
          <div class="product-gallery-shell">
            <div class="product-gallery">
              <div class="product-slider" id="slider-${slug}">
                ${product.images.map((img, index) => `
                  <div class="product-slide ${index === 0 ? 'active' : ''}">
                    <img src="${img}" alt="${product.title} ${product.color} ${index + 1}">
                  </div>
                `).join('')}
                <div class="product-slider-controls">
                  <button class="product-arrow" type="button" data-dir="prev" data-slider="${slug}">↑</button>
                  <button class="product-arrow" type="button" data-dir="next" data-slider="${slug}">↓</button>
                </div>
              </div>
              <div class="product-dots" id="dots-${slug}">
                ${product.images.map((_, index) => `
                  <button class="product-dot ${index === 0 ? 'active' : ''}" type="button" data-slider="${slug}" data-index="${index}"></button>
                `).join('')}
              </div>
              <div class="product-thumbs">
                ${product.images.slice(0, 6).map((img, index) => `
                  <button class="product-thumb ${index === 0 ? 'active' : ''}" type="button" data-slider="${slug}" data-index="${index}">
                    <img src="${img}" alt="Miniature ${index + 1}">
                  </button>
                `).join('')}
              </div>
            </div>
          </div>
          <div class="product-info-box">
            <h1 class="product-title">${product.title}</h1>
            <div class="product-color">${product.color}</div>
            <div class="product-price-box">${product.price}</div>
            <div class="product-description">${PRODUCT_DESCRIPTION}</div>
            <a class="back-link" href="shop.html">Retour à la boutique</a>
          </div>
        </div>
      </div>
    </div>
  `;
}

function initProductSliders() {
  Object.keys(PRODUCTS).forEach(slug => {
    const slider = document.getElementById(`slider-${slug}`);
    if (!slider) return;
    const slides = slider.querySelectorAll('.product-slide');
    const dots = document.querySelectorAll(`.product-dot[data-slider="${slug}"]`);
    const thumbs = document.querySelectorAll(`.product-thumb[data-slider="${slug}"]`);
    let current = 0;
    let touchStartY = 0;

    function update(index) {
      slides.forEach((slide, i) => slide.classList.toggle('active', i === index));
      dots.forEach((dot, i) => dot.classList.toggle('active', i === index));
      thumbs.forEach((thumb, i) => thumb.classList.toggle('active', i === index));
      current = index;
    }

    function next() { update((current + 1) % slides.length); }
    function prev() { update((current - 1 + slides.length) % slides.length); }

    slider.querySelectorAll('.product-arrow').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.dataset.dir === 'next' ? next() : prev();
      });
    });

    dots.forEach(dot => dot.addEventListener('click', () => update(Number(dot.dataset.index))));
    thumbs.forEach(thumb => thumb.addEventListener('click', () => update(Number(thumb.dataset.index))));

    slider.addEventListener('wheel', e => {
      e.preventDefault();
      if (Math.abs(e.deltaY) < 8) return;
      e.deltaY > 0 ? next() : prev();
    }, { passive: false });

    slider.addEventListener('touchstart', e => {
      touchStartY = e.changedTouches[0].clientY;
    }, { passive: true });
    slider.addEventListener('touchend', e => {
      const delta = touchStartY - e.changedTouches[0].clientY;
      if (Math.abs(delta) < 30) return;
      delta > 0 ? next() : prev();
    }, { passive: true });

    productSliderIntervals[slug] = setInterval(next, 2600);
    slider.addEventListener('mouseenter', () => clearInterval(productSliderIntervals[slug]));
    slider.addEventListener('mouseleave', () => {
      clearInterval(productSliderIntervals[slug]);
      productSliderIntervals[slug] = setInterval(next, 2600);
    });
  });
}

function openMenu() { document.getElementById('menuOverlay').classList.add('open'); }
function closeMenu() { document.getElementById('menuOverlay').classList.remove('open'); }

function getUsers() { return JSON.parse(localStorage.getItem(STORAGE_USERS) || '[]'); }
function saveUsers(users) { localStorage.setItem(STORAGE_USERS, JSON.stringify(users)); }
function getCurrentUser() { return JSON.parse(localStorage.getItem(STORAGE_SESSION) || 'null'); }
function saveCurrentUser(user) { localStorage.setItem(STORAGE_SESSION, JSON.stringify(user)); }
function getInitial(value) { return value && value.trim() ? value.trim().charAt(0).toUpperCase() : ''; }
function getUserLetters(user) { return `${getInitial(user.firstName)} ${getInitial(user.lastName)}`.trim(); }
function showMessage(elementId, text, type) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = text;
  el.className = `auth-message ${type}`;
}

function updateHeaderAccount() {
  const currentUser = getCurrentUser();
  const avatar = document.getElementById('avatarBadge');
  const svg = document.getElementById('accountSvg');
  if (!avatar || !svg) return;
  if (currentUser) {
    avatar.textContent = getUserLetters(currentUser);
    avatar.classList.add('visible');
    svg.style.display = 'none';
  } else {
    avatar.textContent = '';
    avatar.classList.remove('visible');
    svg.style.display = 'block';
  }
  updateAccountPanel();
}

function updateAccountPanel() {
  const currentUser = getCurrentUser();
  const panel = document.getElementById('accountPanel');
  const name = document.getElementById('accountName');
  const email = document.getElementById('accountEmail');
  const fullName = document.getElementById('accountFullName');
  const loginSubmitBtn = document.getElementById('loginSubmitBtn');
  const loginSwitchText = document.getElementById('loginSwitchText');
  if (!panel) return;

  if (currentUser) {
    panel.classList.add('visible');
    if (name) name.textContent = `${currentUser.firstName} ${currentUser.lastName}`;
    if (email) email.textContent = currentUser.email;
    if (fullName) fullName.textContent = `${currentUser.firstName} ${currentUser.lastName}`;
    if (loginSubmitBtn) loginSubmitBtn.style.display = 'none';
    if (loginSwitchText) loginSwitchText.style.display = 'none';
  } else {
    panel.classList.remove('visible');
    if (name) name.textContent = '';
    if (email) email.textContent = '';
    if (fullName) fullName.textContent = 'Mon compte';
    if (loginSubmitBtn) loginSubmitBtn.style.display = 'block';
    if (loginSwitchText) loginSwitchText.style.display = 'block';
  }
}

function goToAccount() {
  if (getCurrentUser()) {
    location.href = 'account.html';
  } else {
    location.href = 'signup.html';
  }
}

function logout() {
  localStorage.removeItem(STORAGE_SESSION);
  updateHeaderAccount();
  location.href = 'index.html';
}

function togglePassword(inputId, button) {
  const input = document.getElementById(inputId);
  const hidden = input.type === 'password';
  input.type = hidden ? 'text' : 'password';
  button.textContent = hidden ? '🙈' : '👁';
}

function toggleFaq() { document.getElementById('faqPanel').classList.toggle('visible'); }
function closeFaq() { document.getElementById('faqPanel').classList.remove('visible'); }
function toggleContactBubble() {
  const el = document.getElementById('contactPopover');
  if (el) el.classList.toggle('visible');
}
function closeContactBubble() {
  const el = document.getElementById('contactPopover');
  if (el) el.classList.remove('visible');
}

document.addEventListener('click', function(e) {
  const faq = document.getElementById('faqPanel');
  const faqBtn = e.target.closest('footer button');
  if (faq && !faq.contains(e.target) && !(faqBtn && faqBtn.textContent.trim() === 'FAQ')) closeFaq();

  const contactPopover = document.getElementById('contactPopover');
  const contactBtn = document.getElementById('contactBtn');
  if (contactPopover && !contactPopover.contains(e.target) && e.target !== contactBtn) closeContactBubble();

  const modal = document.getElementById('reviewModal');
  if (e.target === modal) closeReviewModal();
});

const menuOverlay = document.getElementById('menuOverlay');
if (menuOverlay) {
  menuOverlay.addEventListener('click', function(e) {
    if (e.target === this) closeMenu();
  });
}

const newsletterForm = document.getElementById('newsletterForm');
if (newsletterForm) {
  newsletterForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const email = document.getElementById('newsletterEmail').value.trim();
    if (!email) return;
    localStorage.setItem('sob_prefill_email', email);
    location.href = 'signup.html';
  });
}

const signupForm = document.getElementById('signupForm');
if (signupForm) {
  signupForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const firstName = document.getElementById('signupFirstName').value.trim();
    const lastName = document.getElementById('signupLastName').value.trim();
    const email = document.getElementById('signupEmail').value.trim().toLowerCase();
    const password = document.getElementById('signupPassword').value;
    if (!firstName || !lastName || !email || !password) {
      showMessage('signupMessage', 'Merci de remplir tous les champs.', 'error');
      return;
    }
    if (password.length < 6) {
      showMessage('signupMessage', 'Le mot de passe doit contenir au moins 6 caractères.', 'error');
      return;
    }
    const users = getUsers();
    const existing = users.find(user => user.email === email);
    if (existing) {
      showMessage('signupMessage', 'Un compte existe déjà avec cette adresse e-mail.', 'error');
      return;
    }
    const newUser = { firstName, lastName, email, password };
    users.push(newUser);
    saveUsers(users);
    saveCurrentUser(newUser);
    updateHeaderAccount();
    showMessage('signupMessage', 'Compte créé avec succès.', 'success');
    this.reset();
    setTimeout(() => { location.href = 'index.html'; }, 900);
  });
}

const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;
    const users = getUsers();
    const user = users.find(item => item.email === email && item.password === password);
    if (!user) {
      showMessage('loginMessage', 'E-mail ou mot de passe incorrect.', 'error');
      return;
    }
    saveCurrentUser(user);
    updateHeaderAccount();
    showMessage('loginMessage', `Bienvenue ${user.firstName}.`, 'success');
    this.reset();
    setTimeout(() => { location.href = 'account.html'; }, 600);
  });
}

const reviewForm = document.getElementById('reviewForm');
if (reviewForm) {
  reviewForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const name = document.getElementById('reviewName').value.trim();
    const rating = Number(document.getElementById('reviewRating').value);
    const text = document.getElementById('reviewText').value.trim();
    if (!name || !rating || !text) {
      showMessage('reviewMessage', 'Merci de remplir tous les champs.', 'error');
      return;
    }
    const reviews = getReviews();
    reviews.push({ name, rating, text, createdAt: new Date().toISOString() });
    saveReviews(reviews);
    renderReviewsPage();
    renderHomeReviews();
    showMessage('reviewMessage', 'Merci pour votre avis.', 'success');
    this.reset();
    setTimeout(() => {
      closeReviewModal();
    }, 700);
  });
}

window.addEventListener('DOMContentLoaded', () => {
  buildProductPage();
  buildShopCards();
  initProductSliders();
  renderReviewsPage();
  renderHomeReviews();

  const prefillEmail = localStorage.getItem('sob_prefill_email');
  if (prefillEmail) {
    const signupEmail = document.getElementById('signupEmail');
    if (signupEmail) signupEmail.value = prefillEmail;
    localStorage.removeItem('sob_prefill_email');
  }
  updateHeaderAccount();
});
