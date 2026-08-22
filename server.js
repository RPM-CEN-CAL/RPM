const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Allows Base64 image payload handling

// In-Memory Database (Replace with your database connection if needed)
let b2bListings = [
  {
    id: "1",
    companyName: "RPM Inspections",
    email: "rpm.cen.cal@gmail.com",
    phone: "(555) 000-0000",
    category: "RPM Commercial Inspections",
    website: "https://rpm-equipment.netlify.app",
    location: "Visalia, CA",
    imageUrl: "",
    description: "Certified commercial and residential property assessments, pre-purchase home inspections, heavy equipment site evaluations, and structural checks throughout the Central Valley.",
    createdAt: new Date().toISOString()
  }
];

// Health Check Endpoint
app.get('/', (req, res) => {
  res.send('RPM B2B Backend API is live.');
});

// GET: Retrieve all directory listings
app.get('/api/b2b-listings', (req, res) => {
  try {
    res.status(200).json(b2bListings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve listings' });
  }
});

// POST: Create a new directory listing
app.post('/api/b2b-listings/create', (req, res) => {
  try {
    const { companyName, email, phone, category, customCategory, website, location, imageUrl, description } = req.body;

    if (!companyName || !email || !description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const newListing = {
      id: Date.now().toString(),
      companyName,
      email,
      phone: phone || '',
      category: category === 'OTHER' ? customCategory : category,
      website: website || '',
      location: location || '',
      imageUrl: imageUrl || '',
      description,
      createdAt: new Date().toISOString()
    };

    b2bListings.unshift(newListing);
    res.status(201).json({ message: 'Listing created successfully', listing: newListing });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});