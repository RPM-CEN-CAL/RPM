const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.options('*', cors()); // Enable preflight options across all routes
app.use(express.json());

let equipmentListings = [];
let b2bListings = [];

// VIP & Checkout Route
app.post('/api/create-square-checkout', async (req, res) => {
  try {
    const { email, tier } = req.body;
    const cleanEmail = (email || '').toLowerCase().trim();

    const VIP_EMAILS = ['rpm.cen.cal@gmail.com', 'rpm_cen_cal@gmail.com', 'pezziracen23@gmail.com'];
    if (VIP_EMAILS.includes(cleanEmail)) {
      return res.json({ success: true, isVip: true, message: 'VIP Access Granted' });
    }

    const checkoutUrl = process.env.SQUARE_CHECKOUT_URL || 'https://square.link/u/8GfS8D3F';
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

// Equipment Marketplace Endpoints
app.get('/api/listings', (req, res) => {
  res.status(200).json(equipmentListings);
});

// Primary POST endpoint and backwards-compatible alias
const createEquipmentListing = (req, res) => {
  const newListing = { id: Date.now().toString(), ...req.body };
  equipmentListings.push(newListing);
  res.status(201).json({ success: true, listing: newListing });
};

app.post('/api/listings', createEquipmentListing);
app.post('/api/listings/create', createEquipmentListing);

// B2B Directory Endpoints
app.get('/api/b2b-listings', (req, res) => {
  res.status(200).json(b2bListings);
});

// Primary POST endpoint and backwards-compatible alias
const createB2BListing = (req, res) => {
  const newB2B = { id: Date.now().toString(), ...req.body };
  b2bListings.push(newB2B);
  res.status(201).json({ success: true, listing: newB2B });
};

app.post('/api/b2b-listings', createB2BListing);
app.post('/api/b2b-listings/create', createB2BListing);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});