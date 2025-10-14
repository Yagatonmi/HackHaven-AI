const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_YOUR_KEY_HERE'); // Use environment variable or a placeholder
const app = express();

// Serve static files from the 'public' directory, which is one level up
app.use(express.static('../public'));
app.use(express.json());

const priceIds = {
    monthly: 'price_monthly_placeholder', // Replace with your actual Price ID
    yearly: 'price_yearly_placeholder',   // Replace with your actual Price ID
    student: 'price_student_placeholder'  // Replace with your actual Price ID
};

app.post('/create-checkout-session', async (req, res) => {
  const { plan } = req.body;
  const priceId = priceIds[plan];

  if (!priceId) {
    return res.status(400).send({ error: 'Invalid plan selected.' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}', // Replace with your actual success URL
      cancel_url: 'https://example.com/cancel', // Replace with your actual cancel URL
    });

    res.json({ id: session.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
