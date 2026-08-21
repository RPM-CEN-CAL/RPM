require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// Enable CORS for all incoming connections
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Root Health Check
app.get('/', (req, res) => {
  res.send('RPM Backend is Live and Connected!');
});

// Config Endpoint
app.get('/api/square-config', (req, res) => {
  res.json({
    appId: process.env.SQUARE_APPLICATION_ID || '',
    locationId: process.env.SQUARE_LOCATION_ID || ''
  });
});

// Checkout Endpoint (Square SDK / Link Handler)
app.post('/api/create-square-checkout', async (req, res) => {
  try {
    const { basePrice, tierName, email } = req.body;
    const price = parseFloat(basePrice) || 5;
    const total = price + (price * 0.03);

    // Dynamic import to prevent crash if square SDK is missing or mismatched
    let squareUrl = `https://square.link/u/rpm-membership`;
    
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