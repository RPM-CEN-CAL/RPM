// RPM Equipment Marketplace & B2B Directory Handler

const RENDER_BACKEND_URL = 'https://rpm-qhrz.onrender.com';

// 1. Fetch & Render Marketplace Inventory
async function loadMarketplaceInventory() {
  const container = document.getElementById('featured-inventory') || document.querySelector('.listings-grid');
  if (!container) return;

  try {
    const response = await fetch(`${RENDER_BACKEND_URL}/api/listings`);
    
    if (!response.ok) throw new Error('Listings endpoint unreachable');
    
    const listings = await response.json();

    if (Array.isArray(listings) && listings.length > 0) {
      container.innerHTML = listings.map(item => `
        <div class="listing-card">
          <div class="card-header">
            <h3 class="card-title">${item.title || 'Equipment Item'}</h3>
            <span class="price-badge">$${item.price || '0'}</span>
          </div>
          <ul class="card-details">
            <li>Location <span>${item.location || 'Central Valley, CA'}</span></li>
            <li>Condition <span>${item.condition || 'Used'}</span></li>
          </ul>
          <div class="card-actions">
            <button class="btn-action primary">Contact Seller</button>
            <button class="btn-action">Request Delivery</button>
          </div>
        </div>
      `).join('');
    } else {
      renderFallbackInventory(container);
    }
  } catch (error) {
    console.warn('Backend fetch failed or no items returned. Rendering fallback inventory:', error.message);
    renderFallbackInventory(container);
  }
}

// Fallback Marketplace Inventory
function renderFallbackInventory(container) {
  container.innerHTML = `
    <div class="listing-card">
      <div class="card-header">
        <h3 class="card-title">2018 Caterpillar 320 Excavator</h3>
        <span class="price-badge">$68,500</span>
      </div>
      <ul class="card-details">
        <li>Location <span>Fresno, CA</span></li>
        <li>Condition <span>Excellent</span></li>
      </ul>
      <div class="card-actions">
        <button class="btn-action primary">Contact Seller</button>
        <button class="btn-action">Request Delivery</button>
      </div>
    </div>
    <div class="listing-card">
      <div class="card-header">
        <h3 class="card-title">Industrial Air Compressor</h3>
        <span class="price-badge">$1,200</span>
      </div>
      <ul class="card-details">
        <li>Location <span>Visalia, CA</span></li>
        <li>Condition <span>Used - Good</span></li>
      </ul>
      <div class="card-actions">
        <button class="btn-action primary">Contact Seller</button>
        <button class="btn-action">Request Delivery</button>
      </div>
    </div>
  `;
}

// 2. Fetch & Render B2B Directory
async function loadB2BDirectory() {
  const container = document.getElementById('b2b-directory') || document.querySelector('.b2b-grid');
  if (!container) return;

  try {
    const response = await fetch(`${RENDER_BACKEND_URL}/api/b2b-listings`);
    if (!response.ok) throw new Error('B2B directory endpoint unreachable');
    
    const businesses = await response.json();

    if (Array.isArray(businesses) && businesses.length > 0) {
      container.innerHTML = businesses.map(biz => `
        <div class="listing-card">
          <div class="card-header">
            <h3 class="card-title">${biz.companyName || 'Verified Contractor'}</h3>
            <span class="price-badge">${biz.category || 'B2B Service'}</span>
          </div>
          <ul class="card-details">
            <li>Location <span>${biz.location || 'Central Valley, CA'}</span></li>
            <li>Contact <span>${biz.phone || biz.email || 'Available via Inquiry'}</span></li>
          </ul>
          <div class="card-actions">
            <button class="btn-action primary">View Business Profile</button>
          </div>
        </div>
      `).join('');
    } else {
      renderFallbackB2B(container);
    }
  } catch (error) {
    console.warn('B2B directory fetch failed. Rendering fallback content:', error.message);
    renderFallbackB2B(container);
  }
}

// Real Business Directory Entries (RPM, Reliable Property Methods, Creator Flow AI)
function renderFallbackB2B(container) {
  container.innerHTML = `
    <div class="listing-card">
      <div class="card-header">
        <h3 class="card-title">RPM Equipment Marketplace</h3>
        <span class="price-badge">Equipment Exchange</span>
      </div>
      <ul class="card-details">
        <li>Coverage <span>Central Valley, CA</span></li>
        <li>Specialty <span>Heavy Equipment, Tools & Commercial Marketplace</span></li>
        <li>Contact <span>rpm.cen.cal@gmail.com</span></li>
      </ul>
      <div class="card-actions">
        <button class="btn-action primary" onclick="window.location.href='membership.html'">Browse Listings</button>
      </div>
    </div>

    <div class="listing-card">
      <div class="card-header">
        <h3 class="card-title">Reliable Property Methods</h3>
        <span class="price-badge">Property & Inspections</span>
      </div>
      <ul class="card-details">
        <li>Service Area <span>Tulare County & Surrounding Areas</span></li>
        <li>Specialty <span>Property Assessments & Field Inspections</span></li>
        <li>Website <span>rpm-inspections.com</span></li>
      </ul>
      <div class="card-actions">
        <button class="btn-action primary" onclick="window.open('https://rpm-inspections.com', '_blank')">Visit Website</button>
      </div>
    </div>
    
    <div class="listing-card">
      <div class="card-header">
        <h3 class="card-title">Creator Flow AI (RPM-Digital)</h3>
        <span class="price-badge">AI & Digital Solutions</span>
      </div>
      <ul class="card-details">
        <li>Service Area <span>Serving All U.S.</span></li>
        <li>Specialty <span>Automated Workflow & Commercial AI Software</span></li>
        <li>Website <span>creator-flow-ai.com</span></li>
      </ul>
      <div class="card-actions">
        <button class="btn-action primary" onclick="window.open('https://creator-flow-ai.com', '_blank')">Visit Website</button>
      </div>
    </div>
  `;
}

// Execute triggers when page loads
document.addEventListener('DOMContentLoaded', () => {
  loadMarketplaceInventory();
  loadB2BDirectory();
});