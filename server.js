require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
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
  'rpm.cen.cal@gmail.com',
  'pezziracen23@gmail.com'
];

function isVIP(email) {
  if (!email) return false;
  return VIP_EMAILS.includes(email.toLowerCase().trim());
}

const SESSION_COOKIE = 'rpm_session';
const SESSION_DAYS = 7;

function getCookie(req, name) {
  const cookies = (req.headers.cookie || '').split(';');
  for (const cookie of cookies) {
    const separator = cookie.indexOf('=');
    if (separator === -1) continue;
    const key = cookie.slice(0, separator).trim();
    if (key === name) return decodeURIComponent(cookie.slice(separator + 1).trim());
  }
  return null;
}

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function sessionCookieOptions() {
  const production = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: production,
    sameSite: production ? 'none' : 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60
  };
}

function setSessionCookie(res, token) {
  const options = sessionCookieOptions();
  res.setHeader('Set-Cookie', [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'HttpOnly',
    `Max-Age=${options.maxAge}`,
    `Path=${options.path}`,
    `SameSite=${options.sameSite}`,
    options.secure ? 'Secure' : ''
  ].filter(Boolean).join('; '));
}

function clearSessionCookie(res) {
  const options = sessionCookieOptions();
  res.setHeader('Set-Cookie', [
    `${SESSION_COOKIE}=`,
    'HttpOnly',
    'Max-Age=0',
    `Path=${options.path}`,
    `SameSite=${options.sameSite}`,
    options.secure ? 'Secure' : ''
  ].filter(Boolean).join('; '));
}

async function requireSession(req, res, next) {
  try {
    const token = getCookie(req, SESSION_COOKIE);
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const { data: session, error } = await supabase
      .from('auth_sessions')
      .select('id, user_id, expires_at, users(id, email, full_name, is_vip, payment_status, listing_limit, membership_tier, plan)')
      .eq('token_hash', hashSessionToken(token))
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error || !session || !session.users) {
      clearSessionCookie(res);
      return res.status(401).json({ success: false, message: 'Session expired. Please sign in again.' });
    }

    req.authSessionId = session.id;
    req.user = session.users;
    return next();
  } catch (err) {
    console.error('Session Verification Error:', err);
    return res.status(500).json({ success: false, message: 'Unable to verify session.' });
  }
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
app.post('/api/upload', requireSession, upload.array('photos', 10), async (req, res) => {
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

      const publicUrl = `${(process.env.R2_PUBLIC_URL || 'https://pub-r2.rpm-equipment.com')}/${fileKey}`;
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
    const { email, password, fullName, plan, membershipTier, listingLimit } = req.body;

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
        plan: plan || membershipTier || 'Starter Seller',
        membership_tier: membershipTier || plan || 'Starter Seller',
        listing_limit: isVIP(cleanEmail)
          ? null
          : (Number.isInteger(Number(listingLimit)) && Number(listingLimit) > 0
              ? Number(listingLimit)
              : 1),
        is_vip: isVIP(cleanEmail),
        payment_status: isVIP(cleanEmail) ? 'active' : 'pending'
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
console.log('LOGIN ATTEMPT:', cleanEmail);

const isMatch = await bcrypt.compare(password, user.password);

console.log('PASSWORD MATCH:', isMatch);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (!user.is_vip && user.payment_status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Payment required before account access is granted.'
      });
    }

    const sessionToken = crypto.randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + (SESSION_DAYS * 24 * 60 * 60 * 1000)).toISOString();

    const { error: sessionError } = await supabase
      .from('auth_sessions')
      .insert([{
        user_id: user.id,
        token_hash: hashSessionToken(sessionToken),
        expires_at: expiresAt
      }]);

    if (sessionError) throw sessionError;

    setSessionCookie(res, sessionToken);

    return res.status(200).json({
      success: true,
      message: 'Login successful!',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        isVip: user.is_vip,
        paymentStatus: user.payment_status
      }
    });
  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// Current Cloud Session
app.get('/api/session', requireSession, async (req, res) => {
  return res.status(200).json({
    success: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      fullName: req.user.full_name,
      isVip: req.user.is_vip,
      paymentStatus: req.user.payment_status
    }
  });
});

// Secure Logout
app.post('/api/logout', requireSession, async (req, res) => {
  try {
    await supabase
      .from('auth_sessions')
      .delete()
      .eq('id', req.authSessionId);

    clearSessionCookie(res);
    return res.status(200).json({ success: true, message: 'Signed out successfully.' });
  } catch (err) {
    console.error('Logout Error:', err);
    return res.status(500).json({ success: false, message: 'Unable to sign out.' });
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


// Equipment Listing Endpoint (Get One - Supabase)
app.get('/api/listings/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        error: 'Equipment listing not found.'
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('Fetch Listing Detail Error:', err);
    return res.status(500).json({
      error: err.message
    });
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

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, is_vip, payment_status, listing_limit, membership_tier, plan')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (userError) throw userError;

    if (!user) {
      return res.status(403).json({
        success: false,
        error: 'A registered client account is required before publishing listings.'
      });
    }

    if (!user.is_vip && user.payment_status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Payment activation is required before publishing listings.'
      });
    }

    if (!user.is_vip) {
      const listingLimit = Number(user.listing_limit);

      if (!Number.isInteger(listingLimit) || listingLimit < 1) {
        return res.status(403).json({
          success: false,
          error: 'No valid listing limit is assigned to this account.'
        });
      }

      const { count, error: countError } = await supabase
        .from('listings')
        .select('id', { count: 'exact', head: true })
        .eq('email', cleanEmail);

      if (countError) throw countError;

      if ((count || 0) >= listingLimit) {
        return res.status(403).json({
          success: false,
          error: `Listing limit reached. Your ${user.membership_tier || user.plan || 'seller'} package allows ${listingLimit} active listing${listingLimit === 1 ? '' : 's'}.`,
          listingLimit,
          listingsUsed: count || 0
        });
      }
    }

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

    const createFn = (paymentsApi.createPayment || paymentsApi.create).bind(paymentsApi);
    const response = await createFn({
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

    let squareUrl = 'https://square.link/u/9OGHfW18';

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
      isVip: false,
      checkoutUrl: squareUrl,
      url: squareUrl,
      totalFormatted: total.toFixed(2),
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(squareUrl)}`
    });
  } catch (error) {
    console.error('Checkout Endpoint Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});
// Admin Account Activation Endpoint
app.post('/api/activate-account', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email required.'
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    const { error } = await supabase
      .from('users')
      .update({
        payment_status: 'active'
      })
      .eq('email', cleanEmail);

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: 'Account activated successfully.',
      email: cleanEmail
    });

  } catch (err) {
    console.error('Activation Error:', err);

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// Password Reset Email Request
app.post('/api/request-password-reset', async (req, res) => {
  const genericMessage = 'If the account exists, a password reset email has been sent.';

  try {
    const cleanEmail = String(req.body.email || '').toLowerCase().trim();
    if (!cleanEmail) return res.status(200).json({ success: true, message: genericMessage });

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (userError) throw userError;
    if (!user) return res.status(200).json({ success: true, message: genericMessage });

    await supabase
      .from('password_reset_tokens')
      .delete()
      .eq('user_id', user.id)
      .is('used_at', null);

    const rawToken = crypto.randomBytes(48).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { error: tokenError } = await supabase
      .from('password_reset_tokens')
      .insert([{ user_id: user.id, token_hash: tokenHash, expires_at: expiresAt }]);

    if (tokenError) throw tokenError;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_SECURE || 'true').toLowerCase() === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });

    const resetBaseUrl = process.env.PASSWORD_RESET_URL;
    if (!resetBaseUrl) throw new Error('PASSWORD_RESET_URL is not configured.');
    const resetUrl = `${resetBaseUrl}?token=${encodeURIComponent(rawToken)}`;

    await transporter.sendMail({
      from: `RPM Equipment <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: 'Reset your RPM Equipment password',
      text: `Use this secure link to reset your RPM Equipment password: ${resetUrl}\n\nThis link expires in 1 hour. If you did not request this change, ignore this email.`,
      html: `<p>A password reset was requested for your RPM Equipment account.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This secure link expires in 1 hour. If you did not request this change, ignore this email.</p>`
    });

    return res.status(200).json({ success: true, message: genericMessage });
  } catch (error) {
    console.error('Password Reset Request Error:', error);
    return res.status(500).json({ success: false, message: 'Unable to send the password reset email.' });
  }
});

// Apply New Password
app.post('/api/reset-password', async (req, res) => {
  try {
    const token = String(req.body.token || '');
    const password = String(req.body.password || '');

    if (!token || password.length < 8) {
      return res.status(400).json({ success: false, message: 'A valid reset link and an 8-character password are required.' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const { data: resetRecord, error: resetError } = await supabase
      .from('password_reset_tokens')
      .select('id, user_id, expires_at, used_at')
      .eq('token_hash', tokenHash)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (resetError) throw resetError;
    if (!resetRecord) return res.status(400).json({ success: false, message: 'This password reset link is invalid or expired.' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('id', resetRecord.user_id);

    if (updateError) throw updateError;

    await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', resetRecord.id);

    await supabase
      .from('auth_sessions')
      .delete()
      .eq('user_id', resetRecord.user_id);

    return res.status(200).json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Password Reset Error:', error);
    return res.status(500).json({ success: false, message: 'Unable to reset the password.' });
  }
});
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`RPM Server active on port ${PORT}`);
});


