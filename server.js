require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();

// Enable CORS for all incoming connections
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Pre-loaded B2B Listings (Permanent Seed Data)
let b2bListings = [
  {
    id: "seed-rpm-property",
    companyName: "RPM",
    email: "rpm.cen.cal@gmail.com",
    phone: "",
    category: "RESIDENTIAL INSPECTIONS",
    website: "",
    location: "Tulare County",
    imageUrl: "https://6a88f734b14d3a8201574315--rpm-equipment.netlify.app/assets/rpm-property-logo.png",
    description: "Professional home assessments across the Central Valley. We provide comprehensive pre-purchase, pre-listing, and routine structural evaluations to ensure safety, structural integrity, and confidence in your property investments.",
    createdAt: new Date().toISOString()
  },
  {
    id: "seed-rpm-media",
    companyName: "RPM-Media",
    email: "pezziracen23@gmail.com",
    phone: "",
    category: "FULL STACK DEVELOPMENT",
    website: "https://creatorflow.ai",
    location: "U.S.",
    imageUrl: "https://6a88f734b14d3a8201574315--rpm-equipment.netlify.app/assets/creatorflow-infinity.png",
    description: "RPM-Media & Creator Flow AI combine full-service commercial video and visual production with an advanced AI content-orchestration engine tailored for B2B brands, real estate pros, and high-growth operations.",
    createdAt: new Date().toISOString()
  }
];

let equipmentListings = [];
let users = [];

const VIP_EMAILS = [
  'rpm_cen_cal@gmail.com',
  'rpm.cen.cal@gmail.com',
  'pezziracen23@gmail.com'
];

function isVIP(email) {
  if (!email) return false;
  return VIP_EMAILS.includes(email.toLowerCase().trim());
}

// Root Health Check
app.get('/', (req, res) => {
  res.send('RPM Backend API Live.');
});

// Config Endpoint for Square Web SDK
app.get('/api/square-config', (req, res) => {
  res.json({
    appId: process.env.SQUARE_APPLICATION_ID || process.env.SQUARE_APP_ID || '',
    locationId: process.env.SQUARE_LOCATION_ID || ''
  });
});

// Secure Password Registration
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, fullName, plan } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = users.find(u => u.email === cleanEmail);
    if (existing) {
      return res.status(400).json({ success: false, message: 'User already exists.' });
    }

    // Hash the raw password before saving
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = {
      id: Date.now().toString(),
      email: cleanEmail,
      password: hashedPassword,
      fullName: fullName || '',
      plan: plan || 'standard',
      isVip: isVIP(cleanEmail),
      createdAt: new Date().toISOString()
    };

    users.push(newUser);

    return res.status(201).json({ 
      success: true, 
      message: 'Account registered successfully!', 
      user: { id: newUser.id, email: newUser.email, fullName: newUser.fullName } 
    });
  } catch (err) {
    console.error('Registration Error:', err);
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// Secure Password Verification Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = users.find(u => u.email === cleanEmail);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Compare entered plaintext password with stored hashed password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Login successful!', 
      user: { id: user.id, email: user.email, fullName: user.fullName, isVip: user.isVip } 
    });
  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// Direct User Registration Endpoint (Legacy)
app.post('/api/register-direct', (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    
    const cleanEmail = email.toLowerCase().trim();
    const user = { 
      id: Date.now().toString(), 
      email: cleanEmail, 
      name: name || '',
      isVip: isVIP(cleanEmail)
    };

    return res.status(201).json({ success: true, message: 'Account registered successfully', user });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

// B2B Directory Endpoints
app.get('/api/b2b-listings', (req, res) => res.status(200).json(b2bListings));

// Equipment Listings Endpoint (Get All)
app.get('/api/listings', (req, res) => res.status(200).json(equipmentListings));

// Equipment Listings Endpoint (Create New Listing - Repaired)
app.post('/api/listings', (req, res) => {
  try {
    const { title, category, price, year, hours, condition, location, vin, email, images, description } = req.body;

    if (!title || !price || !email) {
      return res.status(400).json({ error: 'Title, price, and email are required.' });
    }

    const cleanEmail = String(email).toLowerCase().trim();

    const newListing = {
      id: `equip-${Date.now()}`,
      title: String(title),
      category: category || 'General',
      price: parseFloat(price) || 0,
      year: year || '',
      hours: hours || '',
      condition: condition || 'Used',
      location: location || '',
      vin: vin || '',
      email: cleanEmail,
      images: Array.isArray(images) ? images : [],
      description: description || '',
      createdAt: new Date().toISOString()
    };

    equipmentListings.unshift(newListing);
    return res.status(201).json({ success: true, listing: newListing });
  } catch (err) {
    console.error('Create Listing Error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Lookup existing listing by email for returning business owners
app.get('/api/b2b-listings/lookup', (req, res) => {
  const email = req.query.email ? req.query.email.toLowerCase().trim() : '';
  if (!email) return res.status(400).json({ error: 'Email required' });

  const existing = b2bListings.find(item => item.email.toLowerCase() === email);
  if (existing) {
    return res.status(200).json({ found: true, listing: existing });
  }
  return res.status(200).json({ found: false });
});

// Create or Update B2B Listing
app.post('/api/b2b-listings/create', (req, res) => {
  try {
    const { companyName, email, phone, category, customCategory, website, location, imageUrl, description, isUpdate } = req.body;
    if (!companyName || !email) return res.status(400).json({ error: 'Missing required fields' });

    const formattedCategory = category === 'OTHER' ? (customCategory || 'COMMERCIAL SERVICE') : (category || 'COMMERCIAL SERVICE').toUpperCase();
    const cleanEmail = email.toLowerCase().trim();

    const existingIndex = b2bListings.findIndex(item => item.email.toLowerCase() === cleanEmail);

    if (existingIndex !== -1 || isUpdate) {
      b2bListings[existingIndex] = {
        ...b2bListings[existingIndex],
        companyName,
        phone: phone || '',
        category: formattedCategory,
        website: website || '',
        location: location || 'Central Valley',
        imageUrl: imageUrl || b2bListings[existingIndex].imageUrl,
        description: description || '',
        updatedAt: new Date().toISOString()
      };
      return res.status(200).json({ success: true, updated: true, listing: b2bListings[existingIndex] });
    }

    const newListing = {
      id: `b2b-${Date.now()}`,
      companyName,
      email: cleanEmail,
      phone: phone || '',
      category: formattedCategory,
      website: website || '',
      location: location || 'Central Valley',
      imageUrl: imageUrl || 'https://via.placeholder.com/150',
      description: description || '',
      createdAt: new Date().toISOString()
    };

    b2bListings.push(newListing);
    return res.status(201).json({ success: true, updated: false, listing: newListing });
  } catch (err) {
    console.error('B2B Listing Error:', err);
    return res.status(500).json({ error: 'Failed to process B2B listing' });
  }
});

// Direct On-Page Card Payment Endpoint
app.post('/api/process-payment', async (req, res) => {
  try {
    const { sourceId, basePrice, email } = req.body;
    const price = parseFloat(basePrice) || 5;
    const totalCents = Math.round((price + (price * 0.03)) * 100);

    const { SquareClient, SquareEnvironment } = require('square');
    const squareClient = new SquareClient({
      token: process.env.SQUARE_ACCESS_TOKEN,
      environment: process.env.SQUARE_ENVIRONMENT === 'production' 
        ? SquareEnvironment.Production 
        : SquareEnvironment.Sandbox,
    });

    const paymentsApi = squareClient.paymentsApi || squareClient.payments;
    
    if (!paymentsApi) {
      throw new Error('Square Payments API is unavailable.');
    }

    const response = await paymentsApi.createPayment({
      sourceId: sourceId,
      idempotencyKey: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      amountMoney: {
        amount: BigInt(totalCents),
        currency: 'USD'
      },
      buyerEmailAddress: email
    });

    const payment = response.result?.payment || response.payment;
    return res.json({ success: true, payment: payment });

  } catch (error) {
    console.error('Direct Payment Processing Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Checkout Endpoint (Square Link Handler)
app.post('/api/create-square-checkout', async (req, res) => {
  try {
    const { basePrice, tierName, email } = req.body;
    const cleanEmail = (email || '').toLowerCase().trim();

    if (isVIP(cleanEmail)) {
      return res.json({ success: true, isVip: true, message: 'VIP Access Granted' });
    }

    const price = parseFloat(basePrice) || 5;
    const total = price + (price * 0.03);

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
              name: `RPM Membership: ${tierName}`,
              quantity: '1',
              basePriceMoney: {
                amount: BigInt(Math.round(total * 100)),
                currency: 'USD'
              }
            }]
          },
          prePopulateBuyerEmail: email
        });

        const link = response.result?.paymentLink?.url || response.paymentLink?.url;
        if (link) squareUrl = link;
      }
    } catch (squareErr) {
      console.warn('Square API Fallback mode triggered:', squareErr.message);
    }

    return res.json({
      success: true,
      url: squareUrl,
      totalFormatted: total.toFixed(2),
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