require('dotenv').config();
const express = require('express');
const cors = require('cors');
// Updated import names for the new Square SDK
const { SquareClient, SquareEnvironment } = require('square');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

// Updated initialization syntax
const squareClient = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN,
  environment: process.env.SQUARE_ENVIRONMENT === 'production' 
    ? SquareEnvironment.Production 
    : SquareEnvironment.Sandbox,
});

// Endpoint 1: Send Square Public Keys to Frontend
app.get('/api/square-config', (req, res) => {
  res.json({
    appId: process.env.SQUARE_APPLICATION_ID,
    locationId: process.env.SQUARE_LOCATION_ID,
  });
});

// Endpoint 2: Process Tokenized Payment Directly via Square API
app.post('/api/process-payment', async (req, res) => {
  try {
    const { sourceId, basePrice, tierName, email } = req.body;

    const processingFee = basePrice * 0.03;
    const totalAmountDollars = basePrice + processingFee;
    const amountInCents = Math.round(totalAmountDollars * 100);

    const response = await squareClient.payments.create({
      sourceId: sourceId,
      idempotencyKey: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      amountMoney: {
        amount: BigInt(amountInCents),
        currency: 'USD',
      },
      buyerEmailAddress: email,
      note: `RPM Membership: ${tierName}`,
    });

    if (response.payment.status === 'COMPLETED') {
      res.json({
        success: true,
        paymentId: response.payment.id,
        tier: tierName,
        email: email,
      });
    } else {
      res.status(400).json({ success: false, error: 'Payment failed to complete.' });
    }
  } catch (error) {
    console.error('Square Payment Processing Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`RPM Server running at http://localhost:${PORT}`);
});