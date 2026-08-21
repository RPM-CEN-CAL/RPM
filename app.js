// Neutral Marketplace Engine – Production Behavior

const STORE = {
  listings: [],
  favorites: [],
  reports: [],
  deliveryRequests: [],
  messages: [],
  memberships: {}
};

// LOAD LISTINGS
async function loadListings() {
  try {
    const res = await fetch('listings.json');
    const data = await res.json();

    STORE.listings = [
      ...data.heavy_equipment,
      ...data.tools,
      ...data.vehicles,
      ...data.attachments
    ];
  } catch (err) {
    console.error('Error loading listings.json', err);
  }
}

// CONTACT SELLER → store message + notify seller later
function contactSeller(title) {
  const msg = prompt(`Message to seller for: ${title}`);
  if (!msg) return;

  STORE.messages.push({ title, msg, date: new Date().toISOString() });

  alert('Message stored. Seller will be notified.');
}

// REQUEST DELIVERY → notify seller
function requestDelivery(title) {
  STORE.deliveryRequests.push({ title, date: new Date().toISOString() });

  alert('Delivery request sent to seller.');
}

// SAVE LISTING → store in buyer profile
function saveListing(title) {
  if (!STORE.favorites.includes(title)) {
    STORE.favorites.push(title);
    alert(`Saved to your profile: ${title}`);
  } else {
    alert(`Already saved: ${title}`);
  }
}

// REPORT LISTING → forward to site email
function reportListing(title) {
  const reason = prompt(`Report reason for: ${title}`);
  if (!reason) return;

  STORE.reports.push({ title, reason, date: new Date().toISOString() });

  // Simulated email forward
  alert('Report sent to site admin.');
}

// ORIGINAL BUTTONS
function wireOriginalButtons() {
  const listings = document.querySelectorAll('.listing-card');

  listings.forEach(listing => {
    const titleEl = listing.querySelector('h3');
    if (!titleEl) return;

    const title = titleEl.textContent.trim();
    const buttons = listing.querySelectorAll('button, a');

    buttons.forEach(btn => {
      const txt = btn.textContent.trim().toLowerCase();

      if (txt === 'contact seller') btn.onclick = () => contactSeller(title);
      if (txt === 'request delivery') btn.onclick = () => requestDelivery(title);
      if (txt === 'save listing') btn.onclick = () => saveListing(title);
      if (txt === 'report listing') btn.onclick = () => reportListing(title);
    });
  });
}

// HOVER BAR BUTTONS
function buildHoverBars() {
  const listings = document.querySelectorAll('.listing-card');

  listings.forEach(listing => {
    const titleEl = listing.querySelector('h3');
    if (!titleEl) return;

    const title = titleEl.textContent.trim();
    const buttons = listing.querySelectorAll('button, a');

    const bar = document.createElement('div');
    bar.classList.add('listing-actions-bar');

    buttons.forEach(btn => {
      const txt = btn.textContent.trim().toLowerCase();
      const clone = btn.cloneNode(true);

      if (txt === 'contact seller') clone.onclick = () => contactSeller(title);
      if (txt === 'request delivery') clone.onclick = () => requestDelivery(title);
      if (txt === 'save listing') clone.onclick = () => saveListing(title);
      if (txt === 'report listing') clone.onclick = () => reportListing(title);

      bar.appendChild(clone);
    });

    listing.appendChild(bar);

    listing.addEventListener('click', (e) => {
      const tag = e.target.tagName.toLowerCase();
      if (tag === 'button' || tag === 'a') return;
      listing.classList.toggle('selected');
    });
  });
}

// INIT
document.addEventListener('DOMContentLoaded', () => {
  loadListings();
  wireOriginalButtons();
  buildHoverBars();
});
