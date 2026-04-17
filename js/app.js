/*Brow beige : img1, img3, img5, img9, img13, img15*/

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
    images: ['images/img1.jpg', 'images/img3.jpg', 'images/img5.jpg', 'images/img9.jpg', 'images/img13.jpg', 'images/img15.jpg']
  },
  'brow-gray': {
    title: "L'Essentiel Brow",
    color: 'Version Gris',
    price: '8,95 €',
    category: 'brow',
    hover: 'images/placeholder.svg',
    images: ['images/img2.jpg', 'images/img4.jpg', 'images/img8.jpg', 'images/img11.jpg', 'images/img14.jpg', 'images/img15.jpg']
  },
  'lash-beige': {
    title: "L'Essentiel Lash",
    color: 'Version Beige',
    price: '8,95 €',
    category: 'lash',
    hover: 'images/placeholder.svg',
    images: ['images/img1.jpg', 'images/img3.jpg', 'images/img6.jpg', 'images/img10.jpg', 'images/img13.jpg', 'images/img15.jpg']
  },
  'lash-gray': {
    title: "L'Essentiel Lash",
    color: 'Version Gris',
    price: '8,95 €',
    category: 'lash',
    hover: 'images/placeholder.svg',
    images: ['images/img2.jpg', 'images/img4.jpg', 'images/img7.jpg', 'images/img12.jpg', 'images/img14.jpg', 'images/img15.jpg']
  }
};

const SLUG_TO_PAGE = {
  'brow-beige': 'product-brow-beige.html',
  'brow-gray':  'product-brow-gray.html',
  'lash-beige': 'product-lash-beige.html',
  'lash-gray':  'product-lash-gray.html'
};

const STORAGE_USERS   = 'sob_users';
const STORAGE_SESSION = 'sob_current_user';
const STORAGE_REVIEWS = 'sob_reviews';
const STORAGE_CART    = 'sob_cart';
const STORAGE_ORDERS  = 'sob_orders';
const API_URL = '';

let productSliderIntervals = {};
let homeReviewsInterval = null;

// ── PANIER ────────────────────────────────────────────────────────────────────
function getCart() {
  return JSON.parse(localStorage.getItem(STORAGE_CART) || '[]');
}

function saveCart(cart) {
  localStorage.setItem(STORAGE_CART, JSON.stringify(cart));
  updateCartBadge();
}

function updateCartBadge() {
  const badge = document.querySelector('.cart-badge');
  if (!badge) return;
  const count = getCart().reduce((sum, item) => sum + item.quantity, 0);
  badge.textContent = count;
}

// ── TOAST NOTIFICATION ────────────────────────────────────────────────────────
function showToast(message) {
  const existing = document.querySelector('.sob-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'sob-toast';
  toast.innerHTML = `
    <span class="sob-toast-text">${message}</span>
    <a href="cart.html" class="sob-toast-btn">Voir le panier →</a>
  `;
  document.body.appendChild(toast);

  const cartLink = document.querySelector('.cart-link');
  if (cartLink) {
    cartLink.classList.add('cart-bounce');
    setTimeout(() => cartLink.classList.remove('cart-bounce'), 700);
  }

  setTimeout(() => {
    toast.classList.add('sob-toast-hide');
    setTimeout(() => toast.remove(), 400);
  }, 3200);
}

// ── COMMANDES ─────────────────────────────────────────────────────────────────
function getOrders() {
  return JSON.parse(localStorage.getItem(STORAGE_ORDERS) || '[]');
}

function saveOrder(items, total) {
  const orders = getOrders();
  orders.unshift({ id: Date.now(), items, total, createdAt: new Date().toISOString() });
  localStorage.setItem(STORAGE_ORDERS, JSON.stringify(orders));
}

// ── API ───────────────────────────────────────────────────────────────────────
async function apiPost(path, body) {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Erreur réseau');
  return data;
}

async function apiPut(path, body) {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Erreur réseau');
  return data;
}

function isLoggedIn() {
  return Boolean(getCurrentUser());
}

// ── AJOUTER AU PANIER ─────────────────────────────────────────────────────────
function addToCart(slug) {
  if (!isLoggedIn()) {
    alert('Vous devez créer un compte pour ajouter un produit au panier.');
    location.href = 'signup.html';
    return;
  }
  const product = PRODUCTS[slug];
  if (!product) return;
  const cart = getCart();
  const item = cart.find(entry => entry.slug === slug);
  if (item) {
    item.quantity += 1;
  } else {
    cart.push({ slug, title: `${product.title} ${product.color}`, price: product.price, quantity: 1, image: product.images[0] });
  }
  saveCart(cart);
  showToast('Produit ajouté au panier !');
}

function buyNow(slug) {
  if (!isLoggedIn()) {
    alert('Vous devez créer un compte pour ajouter un produit au panier.');
    location.href = 'signup.html';
    return;
  }
  const product = PRODUCTS[slug];
  if (!product) return;
  const cart = getCart();
  const item = cart.find(entry => entry.slug === slug);
  if (item) {
    item.quantity += 1;
  } else {
    cart.push({ slug, title: `${product.title} ${product.color}`, price: product.price, quantity: 1, image: product.images[0] });
  }
  saveCart(cart);
  location.href = 'cart.html';
}

function removeFromCart(slug) {
  const cart = getCart().filter(item => item.slug !== slug);
  saveCart(cart);
  buildCartPage();
}

function formatPrice(priceString) {
  return priceString.replace(',', '.').replace(/[^0-9.]/g, '');
}

// ── PANIER PAGE ───────────────────────────────────────────────────────────────
function buildCartPage() {
  const page = document.querySelector('.cart-page-template');
  if (!page) return;
  const cart = getCart();

  const params = new URLSearchParams(window.location.search);
  if (params.get('payment') === 'success') {
    const cartToSave = getCart();
    if (cartToSave.length) {
      const total = cartToSave.reduce((sum, item) => sum + parseFloat(formatPrice(item.price)) * item.quantity, 0);
      saveOrder(cartToSave, total);
    }
    localStorage.removeItem(STORAGE_CART);
    page.innerHTML = '<div class="cart-empty">Merci pour votre achat ! Vous recevrez votre carnet par e-mail.</div><a href="index.html" class="back-to-home">Retour à l\'accueil</a>';
    return;
  }

  if (params.get('payment') === 'cancel') {
    const msg = document.createElement('div');
    msg.className = 'auth-message error';
    msg.textContent = 'Paiement annulé.';
    page.prepend(msg);
  }

  if (!cart.length) {
    page.innerHTML = '<div class="cart-empty">Rien dans votre panier</div><a href="index.html" class="back-to-home">Retour à l\'accueil</a>';
    return;
  }

  const total = cart.reduce((sum, item) => sum + parseFloat(formatPrice(item.price)) * item.quantity, 0);
  page.innerHTML = `
    <div class="cart-page">
      <h1>Votre panier</h1>
      <div class="cart-list">
        ${cart.map(item => `
          <div class="cart-item">
            <img src="${item.image || 'images/placeholder.svg'}" alt="${item.title}">
            <div class="cart-item-info">
              <div class="cart-item-title">${item.title}</div>
              <div class="cart-item-qty">Quantité : ${item.quantity}</div>
              <div class="cart-item-price">Prix unitaire : ${item.price}</div>
            </div>
            <div class="cart-item-actions">
              <button class="cart-item-remove" type="button" data-slug="${item.slug}">Supprimer</button>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="cart-summary">
        <div>Total</div>
        <div>${total.toFixed(2).replace('.', ',')} €</div>
      </div>
      <div class="cart-checkout-buttons">
        <button class="btn-checkout btn-checkout-card" type="button" onclick="checkoutStripe()">
          <div class="btn-checkout-inner">
            <div class="btn-checkout-title">Payer par carte</div>
            <div class="btn-checkout-cards">
              <span class="pay-badge pay-badge-cb">CB</span>
              <span class="pay-badge pay-badge-visa">VISA</span>
              <span class="pay-badge pay-badge-mc">
                <span class="mc-left"></span><span class="mc-right"></span>
              </span>
            </div>
          </div>
        </button>
        <button class="btn-checkout btn-checkout-sepa" type="button" onclick="checkoutSepa()">
          <div class="btn-checkout-inner">
            <div class="btn-checkout-title">Payer par virement</div>
            <div class="sepa-label">SEPA Direct Debit</div>
          </div>
        </button>
        <button class="btn-checkout btn-checkout-paypal" type="button" onclick="checkoutPaypal()">
          <div class="btn-checkout-inner">
            <div class="btn-checkout-title" style="color:#003087;">Payer avec</div>
            <div class="paypal-logo">
              <span class="pp-pay">Pay</span><span class="pp-pal">Pal</span>
            </div>
          </div>
        </button>
      </div>
      <a href="index.html" class="back-to-home">Retour à l'accueil</a>
    </div>
  `;
  page.querySelectorAll('.cart-item-remove').forEach(btn => {
    btn.addEventListener('click', () => removeFromCart(btn.dataset.slug));
  });
}

async function checkoutStripe() {
  const cart = getCart();
  if (!cart.length) return;
  const user = getCurrentUser();

  const total = cart.reduce((sum, i) => sum + parseFloat(formatPrice(i.price)) * i.quantity, 0);
  const totalStr = total.toFixed(2).replace('.', ',') + ' €';

  // Modale paiement
  const overlay = document.createElement('div');
  overlay.className = 'stripe-overlay';
  overlay.innerHTML = `
    <div class="stripe-modal">
      <button class="stripe-modal-close" id="stripeClose">×</button>
      <div class="stripe-modal-header">
        <div class="stripe-modal-title">Paiement sécurisé</div>
        <div class="stripe-modal-amount">${totalStr}</div>
      </div>
      <div id="stripeCardEl" class="stripe-card-el"></div>
      <div class="stripe-error" id="stripeError"></div>
      <button class="stripe-pay-btn" id="stripePayBtn">Payer ${totalStr}</button>
      <div class="stripe-secure">🔒 Sécurisé par Stripe</div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('stripeClose').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  try {
    const data = await apiPost('/api/checkout/stripe/intent', { items: cart, userEmail: user?.email || '' });
    const stripe = Stripe(data.publishableKey);
    const elements = stripe.elements();
    const card = elements.create('card', {
      style: {
        base: {
          fontFamily: "'Jost', sans-serif",
          fontSize: '15px',
          color: '#2a2826',
          '::placeholder': { color: '#aaa9a7' }
        },
        invalid: { color: '#c0392b' }
      }
    });
    card.mount('#stripeCardEl');

    document.getElementById('stripePayBtn').addEventListener('click', async () => {
      const btn = document.getElementById('stripePayBtn');
      const errEl = document.getElementById('stripeError');
      btn.disabled = true;
      btn.textContent = 'Traitement…';
      errEl.textContent = '';

      const { error, paymentIntent } = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: { card, billing_details: { email: user?.email || '' } }
      });

      if (error) {
        errEl.textContent = error.message;
        btn.disabled = false;
        btn.textContent = `Payer ${totalStr}`;
        return;
      }

      if (paymentIntent.status === 'succeeded') {
        await apiPost('/api/checkout/stripe/after-payment', { paymentIntentId: paymentIntent.id });
        overlay.remove();
        saveOrder(cart, total);
        localStorage.removeItem(STORAGE_CART);
        window.location.href = 'cart.html?payment=success';
      }
    });
  } catch (err) {
    overlay.remove();
    alert(err.message);
  }
}

async function checkoutSepa() {
  const cart = getCart();
  if (!cart.length) return;
  const user = getCurrentUser();

  const total = cart.reduce((sum, i) => sum + parseFloat(formatPrice(i.price)) * i.quantity, 0);
  const totalStr = total.toFixed(2).replace('.', ',') + ' €';

  const overlay = document.createElement('div');
  overlay.className = 'stripe-overlay';
  overlay.innerHTML = `
    <div class="stripe-modal">
      <button class="stripe-modal-close" id="sepaClose">×</button>
      <div class="stripe-modal-header">
        <div class="stripe-modal-title">Paiement par virement SEPA</div>
        <div class="stripe-modal-amount">${totalStr}</div>
      </div>
      <div class="sepa-info">Le montant sera prélevé sur votre compte sous <strong>3 à 5 jours ouvrables</strong>. Vous recevrez votre carnet par email dès confirmation.</div>
      <div class="form-row">
        <label>Nom complet</label>
        <input type="text" id="sepaName" placeholder="Votre nom et prénom" value="${user ? user.firstName + ' ' + user.lastName : ''}">
      </div>
      <div class="form-row">
        <label>Email</label>
        <input type="email" id="sepaEmail" placeholder="votre@email.com" value="${user?.email || ''}">
      </div>
      <div class="form-row">
        <label>IBAN</label>
        <div id="sepaIbanEl" class="stripe-card-el"></div>
      </div>
      <label class="sepa-mandate">
        <input type="checkbox" id="sepaMandate">
        <span>J'autorise Studio of Beauty à prélever ce montant sur mon compte. Ce mandat est soumis aux règles SEPA.</span>
      </label>
      <div class="stripe-error" id="sepaError"></div>
      <button class="stripe-pay-btn" id="sepaPayBtn">Autoriser le prélèvement — ${totalStr}</button>
      <div class="stripe-secure">🔒 Sécurisé par Stripe · SEPA Direct Debit</div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('sepaClose').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  try {
    const data = await apiPost('/api/checkout/stripe/sepa-intent', { items: cart, userEmail: user?.email || '' });
    const stripe = Stripe(data.publishableKey);
    const elements = stripe.elements();
    const iban = elements.create('iban', {
      supportedCountries: ['SEPA'],
      style: {
        base: {
          fontFamily: "'Jost', sans-serif",
          fontSize: '15px',
          color: '#2a2826',
          '::placeholder': { color: '#aaa9a7' }
        },
        invalid: { color: '#c0392b' }
      }
    });
    iban.mount('#sepaIbanEl');

    document.getElementById('sepaPayBtn').addEventListener('click', async () => {
      const btn = document.getElementById('sepaPayBtn');
      const errEl = document.getElementById('sepaError');
      const name = document.getElementById('sepaName').value.trim();
      const email = document.getElementById('sepaEmail').value.trim();
      const mandate = document.getElementById('sepaMandate').checked;

      if (!name) { errEl.textContent = 'Veuillez entrer votre nom complet.'; return; }
      if (!email || !email.includes('@')) { errEl.textContent = 'Veuillez entrer une adresse email valide.'; return; }
      if (!mandate) { errEl.textContent = 'Veuillez accepter le mandat de prélèvement.'; return; }

      btn.disabled = true;
      btn.textContent = 'Traitement…';
      errEl.textContent = '';

      const { error, paymentIntent } = await stripe.confirmSepaDebitPayment(data.clientSecret, {
        payment_method: {
          sepa_debit: iban,
          billing_details: { name, email }
        }
      });

      if (error) {
        errEl.textContent = error.message;
        btn.disabled = false;
        btn.textContent = `Autoriser le prélèvement — ${totalStr}`;
        return;
      }

      if (paymentIntent.status === 'processing' || paymentIntent.status === 'succeeded') {
        try {
          await apiPost('/api/checkout/stripe/after-payment', { paymentIntentId: paymentIntent.id });
        } catch (e) { /* email non bloquant */ }
        overlay.remove();
        saveOrder(cart, total);
        localStorage.removeItem(STORAGE_CART);
        window.location.href = 'cart.html?payment=success';
      } else {
        errEl.textContent = 'Statut inattendu : ' + paymentIntent.status;
        btn.disabled = false;
        btn.textContent = `Autoriser le prélèvement — ${totalStr}`;
      }
    });
  } catch (err) {
    overlay.remove();
    alert(err.message);
  }
}

async function checkoutPaypal() {
  const cart = getCart();
  if (!cart.length) return;
  const user = getCurrentUser();
  try {
    const data = await apiPost('/api/checkout/paypal', { items: cart, userEmail: user?.email || '' });
    window.location.href = data.url;
  } catch (err) {
    alert(err.message);
  }
}

// ── AVIS ──────────────────────────────────────────────────────────────────────
function formatReviewDate(dateString) {
  return new Date(dateString).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
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

// ── BOUTIQUE ──────────────────────────────────────────────────────────────────
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
      interval = setInterval(() => show((current + 1) % slides.length), 1200);
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

// ── PAGE PRODUIT ──────────────────────────────────────────────────────────────
function navigateToProduct(slug) {
  if (SLUG_TO_PAGE[slug]) location.href = SLUG_TO_PAGE[slug];
}

function buildProductPage() {
  const page = document.querySelector('.product-page-template');
  if (!page) return;
  const slug = page.dataset.product;
  const product = PRODUCTS[slug];
  if (!product) return;

  const category = product.category;
  const isBeige = slug.includes('beige');
  const altSlug = isBeige ? `${category}-gray` : `${category}-beige`;

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
            <div class="color-switcher">
              <button class="color-btn ${isBeige ? 'active' : ''}" onclick="navigateToProduct('${category}-beige')">Beige</button>
              <button class="color-btn ${!isBeige ? 'active' : ''}" onclick="navigateToProduct('${category}-gray')">Gris</button>
            </div>
            <div class="product-price-box">${product.price}</div>
            <div class="product-description">${PRODUCT_DESCRIPTION}</div>
            <div class="product-actions">
              <button class="btn btn-primary" type="button" onclick="buyNow('${slug}')">Acheter</button>
              <button class="btn btn-secondary" type="button" onclick="addToCart('${slug}')">Ajouter au panier</button>
            </div>
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
      btn.addEventListener('click', () => btn.dataset.dir === 'next' ? next() : prev());
    });

    dots.forEach(dot => dot.addEventListener('click', () => update(Number(dot.dataset.index))));
    thumbs.forEach(thumb => thumb.addEventListener('click', () => update(Number(thumb.dataset.index))));

    slider.addEventListener('wheel', e => {
      e.preventDefault();
      if (Math.abs(e.deltaY) < 8) return;
      e.deltaY > 0 ? next() : prev();
    }, { passive: false });

    slider.addEventListener('touchstart', e => { touchStartY = e.changedTouches[0].clientY; }, { passive: true });
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

// ── MENU ──────────────────────────────────────────────────────────────────────
function openMenu() { document.getElementById('menuOverlay').classList.add('open'); }
function closeMenu() { document.getElementById('menuOverlay').classList.remove('open'); }

// ── AUTH ──────────────────────────────────────────────────────────────────────
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

// ── HEADER LOGO ───────────────────────────────────────────────────────────────
function injectLogo() {
  const headerLeft = document.querySelector('.header-left');
  if (!headerLeft) return;
  headerLeft.innerHTML = `
    <a href="index.html" class="header-logo-link">
      <img src="images/logo.svg" alt="Studio of Beauty" class="header-logo-img">
    </a>
  `;
}

// ── SPLASH SCREEN ─────────────────────────────────────────────────────────────
function showSplash(duration = 600) {
  const existing = document.querySelector('.sob-splash');
  if (existing) return;
  const splash = document.createElement('div');
  splash.className = 'sob-splash';
  splash.innerHTML = `<img src="images/logo.svg" alt="Studio of Beauty" class="sob-splash-logo">`;
  document.body.appendChild(splash);
  setTimeout(() => {
    splash.classList.add('sob-splash-out');
    setTimeout(() => splash.remove(), 500);
  }, duration);
}

function initSplashScreen() {
  // Splash rapide à l'arrivée sur la page (continuité visuelle)
  showSplash(350);
}

function initPageTransitions() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('javascript') || href.startsWith('mailto') || href.startsWith('tel')) return;
    if (link.target === '_blank') return;
    e.preventDefault();
    showSplash(600);
    setTimeout(() => { window.location.href = href; }, 400);
  });
}

// ── MENU DÉROULANT PROFIL ─────────────────────────────────────────────────────
function toggleProfileDropdown() {
  const existing = document.querySelector('.profile-dropdown');
  if (existing) { existing.remove(); return; }

  const user = getCurrentUser();
  const accountIcon = document.getElementById('accountIcon');
  if (!accountIcon) return;

  const dropdown = document.createElement('div');
  dropdown.className = 'profile-dropdown';
  dropdown.innerHTML = `
    <div class="profile-dd-header">
      <div class="profile-dd-avatar">${user ? getUserLetters(user) : '?'}</div>
      <div>
        <div class="profile-dd-name">${user ? `${user.firstName} ${user.lastName}` : ''}</div>
        <div class="profile-dd-email">${user ? user.email : ''}</div>
      </div>
    </div>
    <a href="mes-commandes.html" class="profile-dd-item">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
      Mes commandes
    </a>
    <a href="mon-profil.html" class="profile-dd-item">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.58-7 8-7s8 3 8 7"/></svg>
      Mon profil
    </a>
    <a href="mes-carnets.html" class="profile-dd-item">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
      Mes carnets
    </a>
    <button class="profile-dd-item profile-dd-logout" onclick="logout()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      Se déconnecter
    </button>
  `;

  accountIcon.style.position = 'relative';
  accountIcon.appendChild(dropdown);

  setTimeout(() => {
    document.addEventListener('click', function closeDD(e) {
      if (!accountIcon.contains(e.target)) {
        dropdown.remove();
        document.removeEventListener('click', closeDD);
      }
    });
  }, 0);
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
  const user = getCurrentUser();
  if (user) {
    toggleProfileDropdown();
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

// ── FAQ / CONTACT ─────────────────────────────────────────────────────────────
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

// ── PAGE MES COMMANDES ────────────────────────────────────────────────────────
function buildMesCommandesPage() {
  const page = document.querySelector('.mes-commandes-template');
  if (!page) return;
  const orders = getOrders();

  if (!orders.length) {
    page.innerHTML = `
      <div class="account-page">
        <h1>Mes commandes</h1>
        <p class="account-empty">Vous n'avez pas encore passé de commande.</p>
        <a href="shop.html" class="back-to-home">Voir la boutique</a>
      </div>`;
    return;
  }

  page.innerHTML = `
    <div class="account-page">
      <h1>Mes commandes</h1>
      <div class="orders-list">
        ${orders.map(order => `
          <div class="order-card">
            <div class="order-card-header">
              <span class="order-card-date">${formatReviewDate(order.createdAt)}</span>
              <span class="order-card-total">${order.total.toFixed(2).replace('.', ',')} €</span>
            </div>
            <div class="order-card-items">
              ${order.items.map(item => `
                <div class="order-card-item">
                  <img src="${item.image || 'images/placeholder.svg'}" alt="${item.title}">
                  <div>
                    <div class="order-item-title">${item.title}</div>
                    <div class="order-item-qty">x${item.quantity} — ${item.price}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>`;
}

// ── PAGE MES CARNETS ──────────────────────────────────────────────────────────
function buildMesCarnetsPage() {
  const page = document.querySelector('.mes-carnets-template');
  if (!page) return;
  const user = getCurrentUser();
  const orders = getOrders();

  const slugsSeen = new Set();
  const uniqueItems = [];
  orders.forEach(order => {
    order.items.forEach(item => {
      if (!slugsSeen.has(item.slug)) {
        slugsSeen.add(item.slug);
        uniqueItems.push(item);
      }
    });
  });

  if (!uniqueItems.length) {
    page.innerHTML = `
      <div class="account-page">
        <h1>Mes carnets</h1>
        <p class="account-empty">Vous n'avez pas encore acheté de carnet.</p>
        <a href="shop.html" class="back-to-home">Voir la boutique</a>
      </div>`;
    return;
  }

  page.innerHTML = `
    <div class="account-page">
      <h1>Mes carnets</h1>
      <p class="account-sub">Vos carnets ont été envoyés par email lors de l'achat. Vous pouvez les renvoyer ci-dessous.</p>
      <div class="carnets-list">
        ${uniqueItems.map(item => `
          <div class="carnet-card">
            <img src="${item.image || 'images/placeholder.svg'}" alt="${item.title}">
            <div class="carnet-card-info">
              <div class="carnet-card-title">${item.title}</div>
              <button class="carnet-resend-btn" data-slug="${item.slug}">Renvoyer par email</button>
              <span class="carnet-resend-status" id="status-${item.slug}"></span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>`;

  page.querySelectorAll('.carnet-resend-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const slug = btn.dataset.slug;
      const status = document.getElementById(`status-${slug}`);
      btn.disabled = true;
      btn.textContent = 'Envoi...';
      try {
        await apiPost('/api/resend-carnet', { email: user.email, slug });
        btn.textContent = 'Envoyé !';
        if (status) status.textContent = `✓ Envoyé à ${user.email}`;
      } catch (err) {
        btn.textContent = 'Renvoyer par email';
        btn.disabled = false;
        if (status) status.textContent = 'Erreur, réessayez.';
      }
    });
  });
}

// ── PAGE MON PROFIL ───────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  '#f5f0ea', '#e8ddd0', '#d4c8b8', '#c4a882',
  '#2a2826', '#8a8680', '#b5b2ac', '#dcdad6',
  '#8f7c91', '#6b8f71', '#8f6b6b', '#6b7a8f'
];

function buildMonProfilPage() {
  const page = document.querySelector('.mon-profil-template');
  if (!page) return;
  const user = getCurrentUser();
  if (!user) { location.href = 'signup.html'; return; }

  const avatarColor = user.avatarColor || '#2a2826';

  page.innerHTML = `
    <div class="account-page">
      <h1>Mon profil</h1>
      <div class="profil-grid">
        <div class="profil-avatar-section">
          <div class="profil-avatar" id="profilAvatar" style="background:${avatarColor}">
            ${getUserLetters(user)}
          </div>
          <p class="profil-avatar-label">Couleur de l'avatar</p>
          <div class="avatar-palette">
            ${AVATAR_COLORS.map(color => `
              <button class="avatar-color-btn ${color === avatarColor ? 'selected' : ''}"
                style="background:${color};"
                data-color="${color}"
                title="${color}">
              </button>
            `).join('')}
          </div>
        </div>
        <div class="profil-forms">
          <form class="profil-form" id="profilInfoForm">
            <h2>Informations</h2>
            <div class="form-row">
              <label>Prénom</label>
              <input type="text" id="profilFirstName" value="${user.firstName}" required>
            </div>
            <div class="form-row">
              <label>Nom</label>
              <input type="text" id="profilLastName" value="${user.lastName}" required>
            </div>
            <div class="form-row">
              <label>Email</label>
              <input type="email" id="profilEmail" value="${user.email}" required>
            </div>
            <div class="auth-message" id="profilInfoMsg"></div>
            <button type="submit" class="btn btn-primary">Enregistrer</button>
          </form>
          <form class="profil-form" id="profilPasswordForm">
            <h2>Changer le mot de passe</h2>
            <div class="form-row">
              <label>Mot de passe actuel</label>
              <input type="password" id="profilCurrentPwd" required>
            </div>
            <div class="form-row">
              <label>Nouveau mot de passe</label>
              <input type="password" id="profilNewPwd" required>
            </div>
            <div class="auth-message" id="profilPwdMsg"></div>
            <button type="submit" class="btn btn-primary">Changer</button>
          </form>
        </div>
      </div>
    </div>`;

  // Avatar color picker
  page.querySelectorAll('.avatar-color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      page.querySelectorAll('.avatar-color-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const color = btn.dataset.color;
      document.getElementById('profilAvatar').style.background = color;
      const updated = { ...getCurrentUser(), avatarColor: color };
      saveCurrentUser(updated);
      updateHeaderAvatarColor(color);
    });
  });

  // Info form
  document.getElementById('profilInfoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const firstName = document.getElementById('profilFirstName').value.trim();
    const lastName = document.getElementById('profilLastName').value.trim();
    const email = document.getElementById('profilEmail').value.trim().toLowerCase();
    try {
      await apiPut('/api/profile', { userId: user.id, firstName, lastName, email });
      const updated = { ...getCurrentUser(), firstName, lastName, email };
      saveCurrentUser(updated);
      showMessage('profilInfoMsg', 'Profil mis à jour.', 'success');
      updateHeaderAccount();
    } catch (err) {
      showMessage('profilInfoMsg', err.message, 'error');
    }
  });

  // Password form
  document.getElementById('profilPasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPwd = document.getElementById('profilCurrentPwd').value;
    const newPwd = document.getElementById('profilNewPwd').value;
    if (newPwd.length < 6) {
      showMessage('profilPwdMsg', 'Le mot de passe doit contenir au moins 6 caractères.', 'error');
      return;
    }
    try {
      await apiPut('/api/profile/password', { userId: user.id, currentPassword: currentPwd, newPassword: newPwd });
      showMessage('profilPwdMsg', 'Mot de passe modifié.', 'success');
      document.getElementById('profilPasswordForm').reset();
    } catch (err) {
      showMessage('profilPwdMsg', err.message, 'error');
    }
  });
}

function updateHeaderAvatarColor(color) {
  const avatar = document.getElementById('avatarBadge');
  if (avatar) avatar.style.background = color;
}

// ── ÉVÉNEMENTS GLOBAUX ────────────────────────────────────────────────────────
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
  signupForm.addEventListener('submit', async function(e) {
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
    try {
      const data = await apiPost('/api/signup', { firstName, lastName, email, password });
      saveCurrentUser(data.user);
      updateHeaderAccount();
      showMessage('signupMessage', 'Compte créé avec succès.', 'success');
      this.reset();
      setTimeout(() => { location.href = 'index.html'; }, 900);
    } catch (error) {
      showMessage('signupMessage', error.message, 'error');
    }
  });
}

const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;
    if (!email || !password) {
      showMessage('loginMessage', 'Merci de remplir tous les champs.', 'error');
      return;
    }
    try {
      const data = await apiPost('/api/login', { email, password });
      saveCurrentUser(data.user);
      updateHeaderAccount();
      showMessage('loginMessage', `Bienvenue ${data.user.firstName}.`, 'success');
      this.reset();
      setTimeout(() => { location.href = 'account.html'; }, 600);
    } catch (error) {
      showMessage('loginMessage', error.message, 'error');
    }
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
    setTimeout(() => closeReviewModal(), 700);
  });
}

// ── INIT ──────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  initPageTransitions();
  injectLogo();
  buildProductPage();
  buildShopCards();
  initProductSliders();
  renderReviewsPage();
  renderHomeReviews();
  updateCartBadge();
  buildCartPage();
  buildMesCommandesPage();
  buildMesCarnetsPage();
  buildMonProfilPage();

  const prefillEmail = localStorage.getItem('sob_prefill_email');
  if (prefillEmail) {
    const signupEmail = document.getElementById('signupEmail');
    if (signupEmail) signupEmail.value = prefillEmail;
    localStorage.removeItem('sob_prefill_email');
  }

  updateHeaderAccount();

  const user = getCurrentUser();
  if (user?.avatarColor) updateHeaderAvatarColor(user.avatarColor);
});
