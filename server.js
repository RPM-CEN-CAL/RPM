const express = require('express');
const cors = require('cors');
const { Client, Environment } = require('square');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN || '',
  environment: process.env.SQUARE_ENVIRONMENT === 'production' ? Environment.Production : Environment.Sandbox,
});

const VIP_EMAILS = [
  'rpm.cen.cal@gmail.com',
  'rpm_cen_cal@gmail.com',
  'pezziracen23@gmail.com'
];

let listings = [
  {
    id: '1',
    title: 'Caterpillar 320 Hydraulic Excavator',
    price: '125000',
    category: 'Heavy Equipment',
    condition: 'Excellent',
    email: 'rpm.cen.cal@gmail.com',
    description: '2020 CAT 320 with quick coupler, auxiliary hydraulics, and 2,100 hours. Fully serviced.',
    imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
    createdAt: new Date().toISOString()
  }
];

let b2bListings = [];

app.get('/', (req, res) => {
  res.send('RPM Equipment Backend API is live and operational.');
});

// SQUARE CONFIG ENDPOINT
app.get('/api/square-config', (req, res) => {
  res.status(200).json({
    appId: process.env.SQUARE_APPLICATION_ID || '',
    locationId: process.env.SQUARE_LOCATION_ID || ''
  });
});

app.get('/api/listings', (req, res) => {
  try {
    res.status(200).json(listings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch marketplace listings' });
  }
});

app.post('/api/listings/create', (req, res) => {
  try {
    const { title, price, category, condition, description, imageUrl, email, year, hours } = req.body;

    if (!title || !price || !description) {
      return res.status(400).json({ error: 'Missing required title, price, or description' });
    }

    const newListing = {
      id: Date.now().toString(),
      title,
      price: String(price),
      category: category || 'General Equipment',
      condition: condition || 'Used',
      email: email || 'rpm.cen.cal@gmail.com',
      imageUrl: imageUrl || '',
      description: `${description}${year ? ` | Year: ${year}` : ''}${hours ? ` | Hours/Mileage: ${hours}` : ''}`,
      createdAt: new Date().toISOString()
    };

    listings.unshift(newListing);
    res.status(201).json({ success: true, message: 'Listing published successfully!', listing: newListing });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create listing on server' });
  }
});

// B2B DIRECTORY ENDPOINTS
app.get('/api/b2b-listings', (req, res) => {
  try {
    res.status(200).json(b2bListings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve B2B listings' });
  }
});

app.get('/api/b2b-listings/lookup', (req, res) => {
  try {
    const email = (req.query.email || '').toLowerCase().trim();
    const existing = b2bListings.find(item => item.email.toLowerCase() === email);
    if (existing) {
      res.status(200).json({ found: true, listing: existing });
    } else {
      res.status(200).json({ found: false });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to perform account lookup' });
  }
});

app.post('/api/b2b-listings/create', (req, res) => {
  try {
    const { companyName, email, phone, category, website, location, imageUrl, description, isUpdate } = req.body;

    if (!companyName || !email || !description) {
      return res.status(400).json({ error: 'Missing required B2B fields' });
    }

    const listingData = {
      id: Date.now().toString(),
      companyName,
      email: email.toLowerCase().trim(),
      phone: phone || '',
      category: category || 'COMMERCIAL',
      website: website || '',
      location: location || '',
      imageUrl: imageUrl || '',
      description,
      createdAt: new Date().toISOString()
    };

    if (isUpdate) {
      const idx = b2bListings.findIndex(i => i.email.toLowerCase() === listingData.email);
      if (idx !== -1) {
        b2bListings[idx] = { ...b2bListings[idx], ...listingData };
        return res.status(200).json({ success: true, message: 'Updated successfully', listing: b2bListings[idx] });
      }
    }

    b2bListings.unshift(listingData);
    res.status(201).json({ success: true, message: 'B2B listing created successfully', listing: listingData });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create B2B listing' });
  }
});

// SQUARE CHECKOUT & PAYMENT HANDLERS
app.post('/api/create-square-checkout', async (req, res) => {
    try {
      const { email, tier } = req.body;
      const cleanEmail = (email || '').toLowerCase().trim();

      // 1. VIP Bypass Check
      const VIP_EMAILS = ['rpm.cen.cal@gmail.com', 'rpm_cen_cal@gmail.com', 'pezziracen23@gmail.com'];
      if (VIP_EMAILS.includes(cleanEmail)) {
        return res.json({ success: true, isVip: true, message: 'VIP Access Granted' });
      }

      // 2. Square Checkout Link & QR Code Generation
      const checkoutUrl = process.env.SQUARE_CHECKOUT_URL || 'https://square.link/u/RPM_SUBSCRIPTION_FALLBACK';
      const qrCodeUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=' + encodeURIComponent(checkoutUrl);

      return res.json({
        success: true,
        isVip: false,
        checkoutUrl: checkoutUrl,
        url: checkoutUrl,
        qrCode: qrCodeUrl
      });
    } catch (err) {
      console.error('Checkout creation error:', err);
      res.status(500).json({ success: false, error: 'Failed to create checkout session' });
    }
});
