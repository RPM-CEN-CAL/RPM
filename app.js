async function loadB2BDirectory() {
  const container = document.getElementById('b2b-directory') || document.querySelector('.b2b-grid');
  if (!container) return;

  try {
    const response = await fetch('https://rpm-qhrz.onrender.com/api/b2b-listings');
    if (!response.ok) throw new Error('Directory API unreachable');
    
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
            <li>Contact <span>${biz.phone || 'Available via Inquiry'}</span></li>
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

// Fallback B2B Directory entries when database is empty
function renderFallbackB2B(container) {
  container.innerHTML = `
    <div class="listing-card">
      <div class="card-header">
        <h3 class="card-title">Central Valley Fleet Logistics</h3>
        <span class="price-badge">Hauling & Logistics</span>
      </div>
      <ul class="card-details">
        <li>Location <span>Fresno, CA</span></li>
        <li>Specialty <span>Heavy Equipment Transport</span></li>
      </ul>
      <div class="card-actions">
        <button class="btn-action primary">Contact Business</button>
      </div>
    </div>
    <div class="listing-card">
      <div class="card-header">
        <h3 class="card-title">Apex Hydraulic & Machine Repairs</h3>
        <span class="price-badge">Maintenance</span>
      </div>
      <ul class="card-details">
        <li>Location <span>Visalia, CA</span></li>
        <li>Specialty <span>Commercial Machinery Service</span></li>
      </ul>
      <div class="card-actions">
        <button class="btn-action primary">Contact Business</button>
      </div>
    </div>
  `;
}

// Execute on DOM load
document.addEventListener('DOMContentLoaded', () => {
  loadMarketplaceInventory();
  loadB2BDirectory();
});