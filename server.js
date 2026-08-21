require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// Free Lifetime VIP / Admin Accounts
const VIP_EMAILS = [
  'rpm_cen_cal@gmail.com',
  'rpm.cen.cal@gmail.com',
  'pezziracen23@gmail.com'
];

function isVIPUser(email) {
  if (!email) return false;
  return VIP_EMAILS.includes(email.toLowerCase().trim());
}

// Automatic Category Filter Engine
function autoFilterCategory(title = '', description = '', requestedCategory = '') {
  const text = `${title} ${description} ${requestedCategory}`.toLowerCase();

  if (text.includes('excavator') || text.includes('tractor') || text.includes('loader') || text.includes('dozer') || text.includes('backhoe')) {
    return 'Heavy Equipment';
  }
  if (text.includes('truck') || text.includes('trailer') || text.includes('van') || text.includes('hauler')) {
    return 'Vehicles & Transport';
  }
  if (text.includes('compressor') || text.includes('generator') || text.includes('saw') || text.includes('drill') || text.includes('welder')) {
    return 'Tools & Industrial';
  }
  if (text.includes('bucket') || text.includes('augur') || text.includes('blade') || text.includes('attachment')) {
    return 'Attachments & Parts';
  }

  return requestedCategory || 'General Merchandise';
}

app.get('/', (req, res) => {
  res.send('RPM Backend with Supabase Auto-Filtering is Live!');
});

// Endpoint: Client Submits New Listing (With Automated Filter & Supabase Save)
app.post('/api/listings/create', async (req, res) => {
  try {
    const { title, description, price, location, condition, category, imageUrl, email } = req.body;

    // Run Automatic Category Filtering
    const verifiedCategory = autoFilterCategory(title, description, category);

    const listingData = {
      title,
      description,
      price: parseFloat(price) || 0,
      location: location || 'Central Valley, CA',
      condition: condition || 'Used',
      category: verifiedCategory,
      image_url: imageUrl || '',
      seller_email: email,
      created_at: new Date().toISOString()
    };

    if (supabase) {
      const { data, error } = await supabase
        .from('listings')
        .insert([listingData]);

      if (error) throw error;
      return res.json({ success: true, category: verifiedCategory, data });
    } else {
      console.warn('Supabase not connected. Payload processed in fallback mode.');
      return res.json({ success: true, category: verifiedCategory, data: listingData });
    }

  } catch (error) {
    console.error('Listing creation error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint: Fetch Live Listings (Optionally Filtered by Category)
app.get('/api/listings', async (req, res) => {
  try {
    const { category } = req.query;

    if (supabase) {
      let query = supabase.from('listings').select('*').order('created_at', { ascending: false });
      if (category) query = query.eq('category', category);

      const { data, error } = await query;
      if (error) throw error;
      return res.json(data || []);
    }

    return res.json([]);
  } catch (error) {
    console.error('Fetch listings error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/square-config', (req, res) => {
  res.json({
    appId: process.env.SQUARE_APPLICATION_ID || process.env.SQUARE_APP_ID || '',
    locationId: process.env.SQUARE_LOCATION_ID || ''
  });
});

app.post('/api/process-payment', async (req, res) => {
  try {
    const { sourceId, basePrice, email } = req.body;

    if (isVIPUser(email)) {
      return res.json({ 
        success: true, 
        vipAccess: true,
        message: 'VIP Admin Access Granted',
        payment: { status: 'COMPLETED', id: 'VIP_FREE_PASS' }
      });
    }

    const price = parseFloat(basePrice) || 5;
    const totalCents = Math.round((price * 1.03) * 100);

    const { SquareClient, SquareEnvironment } = require('square');
    const squareClient = new SquareClient({
      token: process.env.SQUARE_ACCESS_TOKEN,
      environment: process.env.SQUARE_ENVIRONMENT === 'production' 
        ? SquareEnvironment.Production 
        : SquareEnvironment.Sandbox,
    });

    const paymentsApi = squareClient.paymentsApi || squareClient.payments;
    
    if (!paymentsApi) throw new Error('Square Payments API unavailable');

    const response = await paymentsApi.createPayment({
      sourceId: sourceId,
      idempotencyKey: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      amountMoney: { amount: BigInt(totalCents), currency: 'USD' },
      buyerEmailAddress: email
    });

    return res.json({ success: true, payment: response.result?.payment || response.payment });

  } catch (error) {
    console.error('Payment Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/create-square-checkout', async (req, res) => {
  try {
    const { basePrice, tierName, email } = req.body;

    if (isVIPUser(email)) {
      return res.json({
        success: true,
        vipAccess: true,
        url: 'https://rpm-equipment.netlify.app/dashboard.html',
        totalFormatted: '0.00',
        qrCodeUrl: ''
      });
    }

    const price = parseFloat(basePrice) || 5;
    const totalCents = Math.round((price * 1.03) * 100);
    const totalFormatted = (totalCents / 100).toFixed(2);

    let squareUrl = `https://square.link/u/9OGHfW18`;
    
    try {
      const { SquareClient, SquareEnvironment } = require('square');
      const squareClient = new SquareClient({
        token: process.env.SQUARE_ACCESS_TOKEN,
        environment: process.env.SQUARE_ENVIRONMENT === 'production' 
          ? SquareEnvironment.Production 
          : SquareEnvironment.Sandbox,
      });

      const checkoutApi = squareClient.checkoutApi || squareClient.checkout;
      if (checkoutApi && checkoutApi.createPaymentLink) {
        const response = await checkoutApi.createPaymentLink({
          idempotencyKey: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
          order: {
            locationId: process.env.SQUARE_LOCATION_ID,
            lineItems: [{
              name: `RPM Membership: ${tierName || 'Seller Plan'}`,
              quantity: '1',
              basePriceMoney: { amount: BigInt(totalCents), currency: 'USD' }
            }]
          },
          prePopulateBuyerEmail: email || ''
        });

        const link = response.result?.paymentLink?.url || response.paymentLink?.url;
        if (link) squareUrl = link;
      }
    } catch (squareErr) {
      console.warn('Square API link fallback:', squareErr.message);
    }

    return res.json({
      success: true,
      url: squareUrl,
      totalFormatted: totalFormatted,
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(squareUrl)}`
    });

  } catch (error) {
    console.error('Checkout Endpoint Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`RPM Server active on port ${PORT}`);
});