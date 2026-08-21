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

// Config Endpoint for Square Web SDK
app.get('/api/square-config', (req, res) => {
  res.json({
    appId: process.env.SQUARE_APPLICATION_ID || process.env.SQUARE_APP_ID || '',
    locationId: process.env.SQUARE_LOCATION_ID || ''
  });
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
    const price = parseFloat(basePrice) || 5;
    const total = price + (price * 0.03);

    // Your active, accessible Square Checkout link
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
      console.warn('Square API Fallback mode active. Using live link:', squareErr.message);
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