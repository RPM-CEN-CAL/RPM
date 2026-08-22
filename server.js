const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.post('/api/create-square-checkout', async (req, res) => {
  try {
    const { email, tier } = req.body;
    const cleanEmail = (email || '').toLowerCase().trim();

    const VIP_EMAILS = ['rpm.cen.cal@gmail.com', 'rpm_cen_cal@gmail.com', 'pezziracen23@gmail.com'];
    if (VIP_EMAILS.includes(cleanEmail)) {
      return res.json({ success: true, isVip: true, message: 'VIP Access Granted' });
    }

    const checkoutUrl = process.env.SQUARE_CHECKOUT_URL || 'https://square.link/u/RPM_SUBSCRIPTION_FALLBACK';
    const qrCodeUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=' + encodeURIComponent(checkoutUrl);

    return res.json({
      success: true,
      isVip: false,
      checkoutUrl: checkoutUrl,
      url: checkoutUrl,
      qrCode: qrCodeUrl
    });
  } catch (err) {
    console.error('Checkout creation error:', err);
    res.status(500).json({ success: false, error: 'Failed to create checkout session' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(Server running on port ));
