const RENDER_BACKEND_URL = 'https://rpm-qhrz.onrender.com';

const VIP_EMAILS = [
  'rpm_cen_cal@gmail.com',
  'rpm.cen.cal@gmail.com',
  'pezziracen23@gmail.com'
];

function isVIPUser(email) {
  if (!email) return false;
  const cleanEmail = email.toLowerCase().trim();
  return VIP_EMAILS.some(vip => vip.toLowerCase() === cleanEmail);
}

// ==========================================
// PATH 1: EQUIPMENT LISTINGS ($5 / $10)
// ==========================================
async function handleListingSubmit(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  const form = document.getElementById('new-listing-form') || (event && event.target);
  const submitBtn = form ? form.querySelector('button[type="submit"]') : null;

  const email = form?.querySelector('#email')?.value.trim() || '';
  const title = form?.querySelector('#title')?.value.trim() || 'Equipment Item';
  const price = form?.querySelector('#price')?.value || 0;
  const listingTierPrice = form?.querySelector('#equipmentTierPrice')?.value || '5';

  const payload = {
    title,
    description: form?.querySelector('#description')?.value || '',
    price,
    location: form?.querySelector('#location')?.value || 'Central Valley, CA',
    condition: form?.querySelector('#condition')?.value || 'Used',
    category: form?.querySelector('#category')?.value || 'General',
    imageUrl: form?.querySelector('#imageUrl')?.value || '',
    email
  };

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = `Connecting to Square ($${listingTierPrice}.00)...`;
  }

  try {
    if (isVIPUser(email)) {
      const vipRes = await fetch(`${RENDER_BACKEND_URL}/api/listings/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (vipRes.ok) {
        alert('VIP Approved! Equipment posted directly to marketplace.');
        window.location.href = 'index.html';
        return;
      }
    }

    localStorage.setItem('pending_equipment_listing', JSON.stringify(payload));

    const checkoutRes = await fetch(`${RENDER_BACKEND_URL}/api/create-square-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        basePrice: listingTierPrice, 
        tierName: `Equipment Listing ($${listingTierPrice})`, 
        email 
      })
    });

    const checkoutData = await checkoutRes.json();
    if (checkoutData.success && checkoutData.url) {
      window.location.href = checkoutData.url;
    } else {
      alert('Square checkout link creation failed.');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Pay & Post Item For Sale →';
      }
    }
  } catch (err) {
    console.error('Submit error:', err);
    alert('Server connection error. Please retry.');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Pay & Post Item For Sale →';
    }
  }
}

// ==========================================
// PATH 2: BUSINESS PROMOTION (FIXED $2.00)
// ==========================================
async function handleBusinessSubmit(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  const submitBtn = document.getElementById('payBtn');

  const email = document.getElementById('email')?.value.trim() || '';
  const companyName = document.getElementById('companyName')?.value.trim() || '';
  const description = document.getElementById('description')?.value.trim() || '';
  
  const selectCat = document.getElementById('categorySelect')?.value;
  const customCat = document.getElementById('customCategoryInput')?.value.trim();
  const category = (selectCat === 'OTHER' && customCat) ? customCat : selectCat;

  const selectedPrice = '2';

  const payload = { companyName, title: companyName, description, email, category };

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = `Connecting to Square ($2.00)...`;
  }

  try {
    if (isVIPUser(email)) {
      const vipRes = await fetch(`${RENDER_BACKEND_URL}/api/b2b-listings/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (vipRes.ok) {
        alert('VIP Approved! Business posted directly to B2B directory.');
        window.location.href = 'b2b.html';
        return;
      }
    }

    localStorage.setItem('pending_b2b_listing', JSON.stringify(payload));

    const checkoutRes = await fetch(`${RENDER_BACKEND_URL}/api/create-square-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        basePrice: selectedPrice, 
        tierName: `B2B Directory Listing ($2.00)`, 
        email 
      })
    });

    const checkoutData = await checkoutRes.json();
    if (checkoutData.success && checkoutData.url) {
      window.location.href = checkoutData.url;
    } else {
      alert('Square payment link creation failed.');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Pay $2.00 & Post Business →';
      }
    }
  } catch (err) {
    console.error('Submit error:', err);
    alert('Server connection error. Please retry.');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Pay $2.00 & Post Business →';
    }
  }
}

// Check for post-payment return on index.html
async function checkEquipmentPostPayment() {
  const urlParams = new URLSearchParams(window.location.search);
  const isSuccess = urlParams.get('status') === 'success';
  const rawData = localStorage.getItem('pending_equipment_listing');

  if (isSuccess && rawData) {
    localStorage.removeItem('pending_equipment_listing');
    window.history.replaceState({}, document.title, window.location.pathname);

    try {
      const payload = JSON.parse(rawData);
      await fetch(`${RENDER_BACKEND_URL}/api/listings/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      alert('Payment confirmed! Equipment listing is live.');
      window.location.reload();
    } catch (err) {
      console.error('Failed to auto-publish item:', err);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const marketplaceForm = document.getElementById('new-listing-form');
  if (marketplaceForm) {
    marketplaceForm.addEventListener('submit', handleListingSubmit);
  }

  const businessForm = document.getElementById('businessForm');
  if (businessForm) {
    businessForm.addEventListener('submit', handleBusinessSubmit);
  }

  checkEquipmentPostPayment();
});