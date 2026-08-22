const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

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
    imageUrl: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80",
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
    imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
    description: "RPM-Media & Creator Flow AI combine full-service commercial video and visual production with an advanced AI content-orchestration engine tailored for B2B brands, real estate pros, and high-growth operations.",
    createdAt: new Date().toISOString()
  }
];

let equipmentListings = [];

const VIP_EMAILS = [
  'rpm_cen_cal@gmail.com',
  'rpm.cen.cal@gmail.com',
  'pezziracen23@gmail.com'
];

function isVIP(email) {
  if (!email) return false;
  return VIP_EMAILS.includes(email.toLowerCase().trim());
}

app.get('/', (req, res) => res.send('RPM Backend API Live.'));

// B2B Directory Endpoints
app.get('/api/b2b-listings', (req, res) => res.status(200).json(b2bListings));

app.post('/api/b2b-listings/create', (req, res) => {
  try {
    const { companyName, email, phone, category, customCategory, website, location, imageUrl, description } = req.body;
    if (!companyName || !email) return res.status(400).json({ error: 'Missing required fields' });

    const newListing = {
      id: Date.now().toString(),
      companyName,
      email,
      phone: phone || '',
      category: category === 'OTHER' ? (customCategory || 'COMMERCIAL SERVICE') : (category || 'COMMERCIAL SERVICE').toUpperCase(),
      website: website || '',
      location: location || 'Central Valley',
      imageUrl: imageUrl || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
      description: description || '',
      createdAt: new Date().toISOString()
    };

    b2bListings.unshift(newListing);
    res.status(201).json({ success: true, listing: newListing });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create B2B listing' });
  }
});

// Equipment Marketplace Endpoints
app.get('/api/listings', (req, res) => res.status(200).json(equipmentListings));

app.post('/api/listings/create', (req, res) => {
  try {
    const { title, description, price, location, condition, category, imageUrl, email, delivery, photo } = req.body;
    if (!title || !email) return res.status(400).json({ error: 'Missing required fields' });

    const newEquipment = {
      id: Date.now().toString(),
      title,
      description: description || '',
      price: price || 0,
      location: location || '',
      condition: condition || 'Used',
      category: category || 'General',
      imageUrl: imageUrl || photo || '',
      email,
      delivery: delivery || false,
      createdAt: new Date().toISOString()
    };

    equipmentListings.unshift(newEquipment);
    res.status(201).json({ success: true, listing: newEquipment });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create equipment listing' });
  }
});

// Square Checkout Endpoint
app.post('/api/create-square-checkout', (req, res) => {
  try {
    const { basePrice, email } = req.body;
    if (isVIP(email)) {
      return res.status(200).json({ success: true, isVip: true });
    }

    const isB2B = basePrice === '2' || basePrice === '2.00' || basePrice === 2;
    const redirectUrl = isB2B 
      ? 'https://rpm-equipment.netlify.app/b2b.html?status=success'
      : 'https://rpm-equipment.netlify.app/index.html?status=success';

    res.status(200).json({ success: true, url: redirectUrl });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Checkout failed' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));