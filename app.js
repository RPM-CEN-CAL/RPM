require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));

// VIP Email Registry
const VIP_EMAILS = [
  'rpm.cen.cal@gmail.com',
  'rpm_cen_cal@gmail.com',
  'pezziracen23@gmail.com'
];

function isVIP(email) {
  if (!email) return false;
  return VIP_EMAILS.includes(email.toLowerCase().trim());
}

// Complete Checkout Endpoint (Preserving All Payload Parameters)
app.post('/api/create-square-checkout', async (req, res) => {
  try {
    const { email, tier, basePrice, tierName } = req.body;
    const cleanEmail = (email || '').toLowerCase().trim();

    // 1. VIP Bypass Check
    if (isVIP(cleanEmail)) {
      return res.json({ 
        success: true, 
        isVip: true, 
        message: 'VIP Access Granted' 
      });
    }

    // 2. Base Price Calculation (3% fee addition)
    const price = parseFloat(basePrice) || 5;
    const total = price + (price * 0.03);

    // 3. Fallback Checkout URL
    let squareUrl = process.env.SQUARE_CHECKOUT_URL || 'https://square.link/u/8GfS8D3F';

    // 4. Square Web SDK / Payment Link Generation
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
              name: `RPM Membership: ${tierName || tier || 'Standard'}`,
              quantity: '1',
              basePriceMoney: {
                amount: BigInt(Math.round(total * 100)),
                currency: 'USD'
              }
            }]
          },
          prePopulateBuyerEmail: cleanEmail
        });

        const link = response.result?.paymentLink?.url || response.paymentLink?.url;
        if (link) squareUrl = link;
      }
    } catch (squareErr) {
      console.warn('Square API Fallback mode triggered:', squareErr.message);
    }

    // 5. Consolidated Response Output (Combines all front-end payload properties)
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(squareUrl)}`;

    return res.json({
      success: true,
      isVip: false,
      checkoutUrl: squareUrl,
      url: squareUrl,
      qrCode: qrCodeUrl,
      qrCodeUrl: qrCodeUrl,
      totalFormatted: total.toFixed(2)
    });

  } catch (err) {
    console.error('Checkout creation error:', err);
    return res.status(500).json({ success: false, error: 'Failed to create checkout session' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});