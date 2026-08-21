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
    const base = parseFloat(basePrice) || 5;
    const fee = base * 0.03;
    const totalCents = Math.round((base + fee) * 100);

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

// Dynamic Square Checkout with Itemized Fee
app.post('/api/create-square-checkout', async (req, res) => {
  try {
    const { basePrice, tierName, email } = req.body;
    const base = parseFloat(basePrice) || 5;
    const baseCents = Math.round(base * 100);
    const feeCents = Math.round((base * 0.03) * 100);
    const totalCents = baseCents + feeCents;
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

    let dynamicUrl = null;

    if (checkoutApi) {
      const createMethod = checkoutApi.createPaymentLink || checkoutApi.createCheckout;
      if (typeof createMethod === 'function') {
        const response = await createMethod.call(checkoutApi, {
          idempotencyKey: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
          order: {
            locationId: process.env.SQUARE_LOCATION_ID,
            lineItems: [
              {
                name: `RPM Membership: ${tierName || 'Seller Plan'}`,
                quantity: '1',
                basePriceMoney: {
                  amount: BigInt(baseCents),
                  currency: 'USD'
                }
              },
              {
                name: '3% Card Processing Fee',
                quantity: '1',
                basePriceMoney: {
                  amount: BigInt(feeCents),
                  currency: 'USD'
                }
              }
            ]
          },
          checkoutOptions: {
            redirectUrl: 'https://rpm-equipment.netlify.app/dashboard.html',
            askForShippingAddress: false
          },
          prePopulateBuyerEmail: email || ''
        });

        dynamicUrl = response.result?.paymentLink?.url || response.paymentLink?.url;
      }
    }

    if (!dynamicUrl) {
      throw new Error("Failed to generate payment link from Square.");
    }

    return res.json({
      success: true,
      url: dynamicUrl,
      totalFormatted: totalFormatted,
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(dynamicUrl)}`
    });

  } catch (error) {
    console.error('Checkout API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`RPM Server active on port ${PORT}`);
});