const RENDER_BACKEND_URL = 'https://rpm-qhrz.onrender.com';

const VIP_EMAILS = [
  'rpm_cen_cal@gmail.com',
  'rpm.cen.cal@gmail.com',
  'pezziracen23@gmail.com'
];

function isVIPUser(email) {
  if (!email) return false;
  return VIP_EMAILS.some(vip => vip.toLowerCase() === email.toLowerCase().trim());
}

async function fetchB2BDirectory() {
  const container = document.getElementById('b2b-container');
  if (!container) return;

  try {
    const response = await fetch(`${RENDER_BACKEND_URL}/api/b2b-listings`);
    if (!response.ok) throw new Error('Directory unreachable');

    const listings = await response.json();

    if (!listings || listings.length === 0) {
      container.innerHTML = `
        <div class="col-span-full p-8 bg-slate-900/50 rounded-xl border border-slate-800 text-center text-slate-400 text-sm">
          No business listings currently registered. <a href="promote-business.html" class="text-blue-400 underline">Add your business &rarr;</a>
        </div>`;
      return;
    }

    container.innerHTML = listings.map(item => {
      const defaultImg = 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80';
      const rawImg = item.imageUrl || item.image_url;
      const displayImg = (rawImg && (rawImg.startsWith('http') || rawImg.startsWith('data:image'))) 
        ? rawImg 
        : defaultImg;

      const companyName = item.companyName || 'Verified Business';
      const contactEmail = item.email || 'rpm.cen.cal@gmail.com';
      const categoryBadge = (item.category || 'COMMERCIAL').toUpperCase();
      const locationText = item.location ? `• ${item.location}` : '';

      return `
        <div class="bg-[#111827] border border-slate-800/80 rounded-2xl overflow-hidden hover:border-slate-700 transition-all flex flex-col justify-between shadow-xl">
          <div>
            <div class="h-48 bg-slate-950 overflow-hidden relative border-b border-slate-800/60">
              <img src="${displayImg}" class="w-full h-full object-cover">
              <span class="absolute top-3 right-3 bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow">
                ${categoryBadge}
              </span>
            </div>
            <div class="p-5 space-y-2">
              <h3 class="font-bold text-white text-xl tracking-tight">${companyName}</h3>
              ${locationText ? `<p class="text-xs text-slate-400 font-medium">${locationText}</p>` : ''}
              <p class="text-xs text-slate-300 leading-relaxed line-clamp-3 mt-2">${item.description || 'Verified commercial business.'}</p>
            </div>
          </div>

          <div class="p-5 pt-0 mt-4">
            <a href="mailto:${contactEmail}?subject=B2B Inquiry regarding ${encodeURIComponent(companyName)}" class="w-full block text-center bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-3 rounded-xl transition-colors">
              Contact Business &rarr;
            </a>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Directory fetch error:', err);
  }
}

async function handleBusinessSubmit(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  const submitBtn = document.getElementById('payBtn');

  const email = document.getElementById('email')?.value.trim() || '';
  const companyName = document.getElementById('companyName')?.value.trim() || '';
  const phone = document.getElementById('phone')?.value.trim() || '';
  const website = document.getElementById('website')?.value.trim() || '';
  const location = document.getElementById('location')?.value.trim() || '';
  const imageUrl = document.getElementById('imageUrl')?.value || '';
  const description = document.getElementById('description')?.value.trim() || '';
  
  const selectCat = document.getElementById('categorySelect')?.value;
  const customCat = document.getElementById('customCategoryInput')?.value.trim();
  const category = (selectCat === 'OTHER' && customCat) ? customCat : selectCat;

  const payload = { companyName, email, phone, website, location, imageUrl, category, description };

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
        alert('VIP Approved! Business posted directly.');
        window.location.href = 'b2b.html';
        return;
      }
    }

    localStorage.setItem('pending_b2b_listing', JSON.stringify(payload));

    const checkoutRes = await fetch(`${RENDER_BACKEND_URL}/api/create-square-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ basePrice: '2', email })
    });

    const checkoutData = await checkoutRes.json();
    if (checkoutData.success && checkoutData.url) {
      window.location.href = checkoutData.url;
    } else {
      alert('Square checkout failed.');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Pay $2.00 & Post Business →';
      }
    }
  } catch (err) {
    console.error('Submit error:', err);
    alert('Server connection error.');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Pay $2.00 & Post Business →';
    }
  }
}

async function checkB2BPostPayment() {
  const urlParams = new URLSearchParams(window.location.search);
  const isSuccess = urlParams.get('status') === 'success';
  const rawData = localStorage.getItem('pending_b2b_listing');

  if (isSuccess && rawData) {
    localStorage.removeItem('pending_b2b_listing');
    window.history.replaceState({}, document.title, window.location.pathname);

    try {
      const payload = JSON.parse(rawData);
      await fetch(`${RENDER_BACKEND_URL}/api/b2b-listings/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      fetchB2BDirectory();
    } catch (err) {
      console.error('Auto-publish failed:', err);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const businessForm = document.getElementById('businessForm');
  if (businessForm) {
    businessForm.addEventListener('submit', handleBusinessSubmit);
  }

  checkB2BPostPayment();
  fetchB2BDirectory();
});