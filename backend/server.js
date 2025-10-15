const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_YOUR_KEY_HERE');
const app = express();
const studentVerification = require('./student_verification'); // Import the new module

// --- Configuration ---

// Serve static files from the 'public' directory
app.use(express.static('../public'));
app.use(express.json());

// --- Endpoints ---

// Mount the student verification router
app.use('/student', studentVerification);

// Price IDs from your Stripe Dashboard
const priceIds = {
    monthly: 'price_1Lq2gZ2eZvKYlo2CUa3gQp4a', // Replace with actual Price ID
    yearly: 'price_1Lq2gZ2eZvKYlo2CUa3gQp4b',   // Replace with actual Price ID
    // The student price ID is now handled in the student_verification.js module
};

// Endpoint for standard (non-student) Stripe checkout sessions
app.post('/create-checkout-session', async (req, res) => {
  const { plan } = req.body;
  const priceId = priceIds[plan];

  if (!priceId) {
    return res.status(400).json({ error: 'Invalid plan selected.' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://example.com/cancel',
    });
    res.json({ id: session.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// --- Server Start ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
