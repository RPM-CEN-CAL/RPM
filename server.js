$serverContent = @'
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const LISTINGS_FILE = path.join(__dirname, 'listings.json');
const B2B_FILE = path.join(__dirname, 'b2b.json');

const defaultListings = [
  {
    id: 'concrete-saw',
    title: '[EXEMPLARY DEMO] Commercial Heavy-Duty Concrete Saw',
    category: 'Medium Equipment',
    price: 650,
    description: 'FOR DEMO / EXEMPLARY PURPOSES ONLY - Will be removed once live client listings start coming in. Gas-powered, high torque motor with water attachment hookup.',
    imageUrl: 'Tools.jpg',
    specs: 'Engine: 2-Stroke Gas | Blade Capacity: 14 in | Cutting Depth: 5 in'
  },
  {
    id: 'ford-f350',
    title: '[EXEMPLARY DEMO] Ford F-350 Utility Body Work Truck',
    category: 'Vehicles',
    price: 18900,
    description: 'FOR DEMO / EXEMPLARY PURPOSES ONLY - 6.7L PowerStroke V8 Turbo Diesel, dual rear wheels, locking tool storage bed.',
    imageUrl: 'Vehicles.jpg',
    specs: 'Year: 2018 | Mileage: 112,000 | Transmission: Automatic 6-Speed'
  },
  {
    id: 'cat-excavator-320',
    title: '[EXEMPLARY DEMO] Caterpillar 320 Hydraulic Excavator',
    category: 'Heavy Equipment',
    price: 85000,
    description: 'FOR DEMO / EXEMPLARY PURPOSES ONLY - Full hydraulic thumb attachment, quick coupler, enclosed cab with AC.',
    imageUrl: 'Vehicles.jpg',
    specs: 'Operating Weight: 49,600 lbs | Max Dig Depth: 22 ft | Horsepower: 172 HP'
  },
  {
    id: 'bobcat-t770',
    title: '[EXEMPLARY DEMO] Bobcat T770 Compact Track Loader',
    category: 'Medium Equipment',
    price: 34500,
    description: 'FOR DEMO / EXEMPLARY PURPOSES ONLY - High-flow hydraulics, 2-speed travel, enclosed cab, selectable joystick controls.',
    imageUrl: 'Tools.jpg',
    specs: 'Operating Capacity: 3,475 lbs | Engine: 92 HP Diesel | Tracks: 18 in Rubber'
  }
];

function loadData(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return parsed.length > 0 ? parsed : fallback;
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
  }
  return fallback;
}

function saveData(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
  }
}

let equipmentListings = loadData(LISTINGS_FILE, defaultListings);
let b2bListings = loadData(B2B_FILE, []);

app.get('/', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'RPM API Server Running' });
});

app.post('/api/create-square-checkout', async (req, res) => {
  try {
    const { email } = req.body;
    const cleanEmail = (email || '').toLowerCase().trim();

    const VIP_EMAILS = [
      'rpm.cen.cal@gmail.com', 
      'rpm_cen_cal@gmail.com', 
      'pezziracen23@gmail.com',
      'ricky@example.com'
    ];

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

app.get('/api/listings', (req, res) => {
  res.status(200).json(equipmentListings);
});

app.get('/api/listings/:id', (req, res) => {
  const item = equipmentListings.find(l => String(l.id) === String(req.params.id));
  if (!item) return res.status(404).json({ success: false, message: 'Listing not found' });
  res.status(200).json(item);
});

app.post('/api/listings', (req, res) => {
  const { title, category, price, description, imageUrl, specs, location, contactInfo } = req.body;
  const newListing = {
    id: Date.now().toString(),
    title: title || 'Untitled Listing',
    category: category || 'General',
    price: price || 0,
    description: description || '',
    imageUrl: imageUrl || 'Tools.jpg',
    specs: specs || '',
    location: location || '',
    contactInfo: contactInfo || ''
  };
  equipmentListings.push(newListing);
  saveData(LISTINGS_FILE, equipmentListings);
  res.status(201).json({ success: true, listing: newListing });
});

app.get('/api/b2b-listings', (req, res) => {
  res.status(200).json(b2bListings);
});

app.get('/api/b2b-listings/:id', (req, res) => {
  const item = b2bListings.find(b => String(b.id) === String(req.params.id));
  if (!item) return res.status(404).json({ success: false, message: 'B2B listing not found' });
  res.status(200).json(item);
});

app.post('/api/b2b-listings', (req, res) => {
  const newB2B = { id: Date.now().toString(), ...req.body };
  b2bListings.push(newB2B);
  saveData(B2B_FILE, b2bListings);
  res.status(201).json({ success: true, listing: newB2B });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
'@

Set-Content -Path .\server.js -Value $serverContent -Encoding UTF8