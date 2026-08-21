require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

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

app.get('/', (req, res) => {
  res.send('RPM Backend is Live and Connected!');
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

    // VIP Bypass Check
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

// Checkout Endpoint with VIP Admin Authorization
app.post('/api/create-square-checkout', async (req, res) => {
  try {
    const { basePrice, tierName, email } = req.body;

    // VIP Bypass Check: Bypasses Square and sends directly to dashboard
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
              basePriceMoney: {
                amount: BigInt(totalCents),
                currency: 'USD'
              }
            }]
          },
          prePopulateBuyerEmail: email || ''
        });

        const link = response.result?.paymentLink?.url || response.paymentLink?.url;
        if (link) squareUrl = link;
      }
    } catch (squareErr) {
      console.warn('Square API link generation fallback active:', squareErr.message);
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