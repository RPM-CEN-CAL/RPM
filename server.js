require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Enable CORS for all incoming connections with Credentials Support
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Configure Cloudflare R2 Client (S3 Compatible API)
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const upload = multer({ storage: multer.memoryStorage() });

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
  res.send('RPM Backend API Live (Supabase Connected).');
});

// Config Endpoint for Square Web SDK
app.get('/api/square-config', (req, res) => {
  res.json({
    appId: process.env.SQUARE_APPLICATION_ID || process.env.SQUARE_APP_ID || '',
    locationId: process.env.SQUARE_LOCATION_ID || ''
  });
});

// Image Upload Endpoint -> Cloudflare R2
app.post('/api/upload', upload.array('photos', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No image files provided.' });
    }

    const uploadedUrls = [];

    for (const file of req.files) {
      const fileKey = `equipment/${Date.now()}-${Math.random().toString(36).substring(7)}-${file.originalname}`;
      
      await s3.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      }));

      const publicUrl = `${process.env.R2_PUBLIC_URL}/${fileKey}`;
      uploadedUrls.push(publicUrl);
    }

    return res.status(200).json({ success: true, urls: uploadedUrls });
  } catch (err) {
    console.error('R2 Upload Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to upload image to R2: ' + err.message });
  }
});

// Secure Password Registration (Supabase Database)
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, fullName, plan } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check existing user
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User account already exists.' });
    }

    // Hash raw password
    const hashedPassword = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from('users')
      .insert([{
        email: cleanEmail,
        password: hashedPassword,
        full_name: fullName || '',
        plan: plan || 'standard',
        is_vip: isVIP(cleanEmail)
      }])
      .select();

    if (error) throw error;

    return res.status(201).json({ 
      success: true, 
      message: 'Account created and saved permanently!', 
      user: { id: data[0].id, email: data[0].email, fullName: data[0].full_name } 
    });
  } catch (err) {
    console.error('Registration Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Secure Password Login (Supabase Verification)
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (error || !user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Login successful!', 
      user: { id: user.id, email: user.email, fullName: user.full_name, isVip: user.is_vip } 
    });
  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// Equipment Listings Endpoint (Get All - Supabase)
app.get('/api/listings', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.status(200).json(data || []);
  } catch (err) {
    console.error('Fetch Listings Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Equipment Listings Endpoint (Create New Listing - Supabase)
app.post('/api/listings', async (req, res) => {
  try {
    const { title, category, price, year, hours, condition, location, vin, email, images, description } = req.body;

    if (!title || !price || !email) {
      return res.status(400).json({ error: 'Title, price, and email are required.' });
    }

    const cleanEmail = String(email).toLowerCase().trim();

    const { data, error } = await supabase
      .from('listings')
      .insert([{
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
        description: description || ''
      }])
      .select();

    if (error) throw error;
    return res.status(201).json({ success: true, listing: data[0] });
  } catch (err) {
    console.error('Create Listing Error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// B2B Directory Endpoint (Get All - Supabase)
app.get('/api/b2b-listings', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('b2b_listings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.status(200).json(data || []);
  } catch (err) {
    console.error('Fetch B2B Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Lookup existing B2B listing by email (Supabase)
app.get('/api/b2b-listings/lookup', async (req, res) => {
  try {
    const email = req.query.email ? req.query.email.toLowerCase().trim() : '';
    if (!email) return res.status(400).json({ error: 'Email required' });

    const { data, error } = await supabase
      .from('b2b_listings')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      return res.status(200).json({ found: true, listing: data });
    }
    return res.status(200).json({ found: false });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Create or Update B2B Promo Listing (Supabase)
app.post('/api/b2b-listings/create', async (req, res) => {
  try {
    const { companyName, email, phone, category, customCategory, website, location, imageUrl, description } = req.body;
    if (!companyName || !email) return res.status(400).json({ error: 'Missing required fields' });

    const formattedCategory = category === 'OTHER' ? (customCategory || 'COMMERCIAL SERVICE') : (category || 'COMMERCIAL SERVICE').toUpperCase();
    const cleanEmail = email.toLowerCase().trim();

    const { data: existing } = await supabase
      .from('b2b_listings')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from('b2b_listings')
        .update({
          company_name: companyName,
          phone: phone || '',
          category: formattedCategory,
          website: website || '',
          location: location || 'Central Valley',
          image_url: imageUrl || '',
          description: description || '',
          updated_at: new Date().toISOString()
        })
        .eq('email', cleanEmail)
        .select();

      if (error) throw error;
      return res.status(200).json({ success: true, updated: true, listing: data[0] });
    }

    const { data, error } = await supabase
      .from('b2b_listings')
      .insert([{
        company_name: companyName,
        email: cleanEmail,
        phone: phone || '',
        category: formattedCategory,
        website: website || '',
        location: location || 'Central Valley',
        image_url: imageUrl || 'https://via.placeholder.com/150',
        description: description || ''
      }])
      .select();

    if (error) throw error;
    return res.status(201).json({ success: true, updated: false, listing: data[0] });
  } catch (err) {
    console.error('B2B Listing Error:', err);
    return res.status(500).json({ error: 'Failed to process B2B listing: ' + err.message });
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

    const response = await squareClient.paymentsApi.createPayment({
      sourceId: sourceId,
      idempotencyKey: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      amountMoney: {
        amount: BigInt(totalCents),
        currency: 'USD'
      },
      buyerEmailAddress: email
    });

    const rawPayment = response.result?.payment || response.payment;
    // Convert BigInt values to string before returning JSON to prevent serialization crashes
    const payment = JSON.parse(JSON.stringify(rawPayment, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));

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
