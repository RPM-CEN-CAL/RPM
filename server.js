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
    const price = parseFloat(basePrice) || 5;
    const totalCents = Math.round((price + (price * 0.03)) * 100);

    const Square = require('square');
    const Client = Square.Client || Square.SquareClient;
    const Environment = Square.Environment || Square.SquareEnvironment;

    const squareClient = new Client({
      accessToken: process.env.SQUARE_ACCESS_TOKEN || process.env.SQUARE_TOKEN,
      token: process.env.SQUARE_ACCESS_TOKEN || process.env.SQUARE_TOKEN,
      environment: process.env.SQUARE_ENVIRONMENT === 'production' 
        ? (Environment.Production || 'production')
        : (Environment.Sandbox || 'sandbox'),
    });

    const paymentsApi = squareClient.paymentsApi || squareClient.payments;

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

// Robust Dynamic Checkout Endpoint
app.post('/api/create-square-checkout', async (req, res) => {
  try {
    const { basePrice, tierName, email } = req.body;
    const price = parseFloat(basePrice) || 5;
    const totalCents = Math.round((price + (price * 0.03)) * 100);
    const totalFormatted = (totalCents / 100).toFixed(2);

    const Square = require('square');
    const Client = Square.Client || Square.SquareClient;
    const Environment = Square.Environment || Square.SquareEnvironment;

    const squareClient = new Client({
      accessToken: process.env.SQUARE_ACCESS_TOKEN || process.env.SQUARE_TOKEN,
      token: process.env.SQUARE_ACCESS_TOKEN || process.env.SQUARE_TOKEN,
      environment: process.env.SQUARE_ENVIRONMENT === 'production' 
        ? (Environment.Production || 'production')
        : (Environment.Sandbox || 'sandbox'),
    });

    const checkoutApi = squareClient.checkoutApi || squareClient.checkout;

    // Fallback static link if API call fails
    let dynamicUrl = `https://square.link/u/9OGHfW18`;

    if (checkoutApi) {
      const createMethod = checkoutApi.createPaymentLink || checkoutApi.createCheckout;
      if (typeof createMethod === 'function') {
        const response = await createMethod.call(checkoutApi, {
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
          checkoutOptions: {
            redirectUrl: 'https://rpm-equipment.netlify.app/dashboard.html',
            askForShippingAddress: false
          },
          prePopulateBuyerEmail: email || ''
        });

        const link = response.result?.paymentLink?.url || response.paymentLink?.url || response.result?.checkout?.checkoutPageUrl;
        if (link) dynamicUrl = link;
      }
    }

    return res.json({
      success: true,
      url: dynamicUrl,
      totalFormatted: totalFormatted,
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(dynamicUrl)}`
    });

  } catch (error) {
    console.error('Checkout API Error:', error);
    // If Square API fails, gracefully fallback to the live square link instead of crashing
    const price = parseFloat(req.body.basePrice) || 5;
    const totalFormatted = (price * 1.03).toFixed(2);
    const fallbackLink = `https://square.link/u/9OGHfW18`;

    return res.json({
      success: true,
      url: fallbackLink,
      totalFormatted: totalFormatted,
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(fallbackLink)}`
    });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`RPM Server active on port ${PORT}`);
});