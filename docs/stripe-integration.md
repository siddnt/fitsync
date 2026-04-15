# Stripe Payment Integration Guide

This document explains how to set up and use the Stripe payment integration for marketplace orders in FitSync.

## Overview

The Stripe integration allows customers to pay for marketplace orders using credit/debit cards through Stripe's secure checkout flow. The system supports two payment methods:

1. **Cash on Delivery (COD)** - Traditional payment method
2. **Credit / Debit Card** - Secure online payment via Stripe Checkout

## Architecture

### Backend Components

1. **Stripe Service** (`src/services/stripe.service.js`)
   - Initializes the Stripe SDK with your secret key
   - Provides Stripe instance for creating checkout sessions

2. **Checkout Session Creation** (`src/api/controllers/marketplace.controller.js`)
   - Endpoint: `POST /api/marketplace/checkout/create-session`
   - Validates cart items and shipping address
   - Reserves inventory temporarily
   - Creates a PaymentSession record in MongoDB
   - Creates a Stripe Checkout Session
   - Returns the checkout URL for redirect

3. **Webhook Handler** (`src/api/controllers/marketplace.controller.js`)
   - Endpoint: `POST /api/marketplace/webhook/stripe`
   - Receives events from Stripe (payment completion, expiration)
   - Verifies webhook signature for security
   - Creates the actual order after successful payment
   - Updates PaymentSession status

4. **PaymentSession Model** (`src/models/paymentSession.model.js`)
   - Stores payment session metadata
   - Tracks Stripe checkout session ID and payment intent ID
   - Maintains order snapshot before payment completion
   - Prevents duplicate order creation

### Frontend Components

1. **Checkout Page** (`client/src/pages/marketplace/CheckoutPage.jsx`)
   - Allows users to select payment method (COD or Card)
   - For card payments: redirects to Stripe Checkout
   - For COD: creates order directly

2. **Success Page** (`client/src/pages/marketplace/CheckoutSuccessPage.jsx`)
   - Displays confirmation after successful payment
   - Clears the shopping cart
   - Provides links to continue shopping or view orders

3. **Cancel Page** (`client/src/pages/marketplace/CheckoutCancelPage.jsx`)
   - Handles cancelled payments
   - Allows users to retry checkout or continue shopping

## Setup Instructions

### 1. Stripe Account Setup

1. Create a Stripe account at [stripe.com](https://stripe.com)
2. Get your API keys from the Stripe Dashboard:
   - Publishable Key (starts with `pk_test_` or `pk_live_`)
   - Secret Key (starts with `sk_test_` or `sk_live_`)
   - Webhook Signing Secret (starts with `whsec_`)

### 2. Environment Configuration

Add the following variables to your `.env` file:

```env
# Stripe Configuration
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
STRIPE_SECRET_KEY=sk_test_your_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Application URLs
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:4000
```

For Docker deployment, these are already configured in `docker-compose.yml`.

### 3. Configure Stripe Webhook

#### Local Development

Use the Stripe CLI to forward webhooks to your local server:

```bash
# Install Stripe CLI
stripe login

# Forward webhooks to your local endpoint
stripe listen --forward-to http://localhost:4000/api/marketplace/webhook/stripe
```

The CLI will output a webhook signing secret. Use this as your `STRIPE_WEBHOOK_SECRET` in `.env`.

#### Production

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. Set endpoint URL: `https://your-domain.com/api/marketplace/webhook/stripe`
4. Select events to receive:
   - `checkout.session.completed`
   - `checkout.session.expired`
5. Copy the signing secret and add it to your production environment variables

### 4. Test the Integration

#### Test Card Numbers

Stripe provides test card numbers for different scenarios:

- **Successful payment**: `4242 4242 4242 4242`
- **Requires authentication**: `4000 0025 0000 3155`
- **Insufficient funds**: `4000 0000 0000 9995`
- **Card declined**: `4000 0000 0000 0002`

Use any future expiry date (e.g., 12/34), any 3-digit CVC, and any postal code.

## Payment Flow

### Credit/Debit Card Payment

1. User selects "Credit / Debit Card" at checkout
2. Frontend calls `POST /api/marketplace/checkout/create-session`
3. Backend validates cart and creates PaymentSession
4. Backend creates Stripe Checkout Session
5. User is redirected to Stripe's hosted checkout page
6. User enters card details and completes payment
7. Stripe sends webhook to backend on success
8. Backend creates Order from PaymentSession snapshot
9. User is redirected to success page
10. Cart is cleared

### Cash on Delivery Payment

1. User selects "Cash on Delivery" at checkout
2. Frontend calls `POST /api/marketplace/orders`
3. Backend validates cart and creates Order immediately
4. Inventory is reserved
5. User sees order confirmation

## Database Schema

### PaymentSession Collection

```javascript
{
  user: ObjectId,              // Reference to User
  type: "shop",                // Payment type
  orderSnapshot: {             // Snapshot of order before payment
    items: [...],
    subtotal: Number,
    tax: Number,
    shippingCost: Number,
    total: Number,
    shippingAddress: {...}
  },
  currency: "inr",
  amount: Number,              // Total amount in INR
  stripe: {
    checkoutSessionId: String, // Stripe session ID
    paymentIntentId: String,   // Stripe payment intent ID
    status: "open|completed|expired|canceled"
  },
  processed: Boolean,          // Prevents duplicate processing
  createdAt: Date,
  updatedAt: Date
}
```

## Security Considerations

1. **Webhook Signature Verification**: All webhooks are verified using Stripe's signature to prevent unauthorized requests
2. **Raw Body Handling**: Webhook endpoint receives raw request body for signature verification
3. **Transaction Safety**: Order creation happens within MongoDB transactions to ensure data consistency
4. **Inventory Reservation**: Inventory is reserved during checkout session creation to prevent overselling
5. **Duplicate Prevention**: PaymentSession.processed flag prevents double-ordering from webhook retries

## Error Handling

- Failed checkout session creation returns appropriate error messages
- Webhook failures are logged for investigation
- Expired sessions update PaymentSession status but don't create orders
- Already-processed webhooks are safely ignored

## Monitoring

Monitor these metrics in your Stripe Dashboard:

- Successful checkout sessions
- Failed payments
- Webhook delivery status
- Payment disputes/refunds

## Troubleshooting

### Webhook Not Receiving Events

1. Verify webhook URL is correct in Stripe Dashboard
2. Check webhook signing secret matches your environment variable
3. Ensure your server is accessible from the internet (for production)
4. Use Stripe CLI for local development testing

### Orders Not Created After Payment

1. Check server logs for webhook processing errors
2. Verify PaymentSession exists and is not already processed
3. Check MongoDB connection and transaction logs
4. Ensure webhook signature verification passes

### Checkout Session Creation Fails

1. Verify Stripe API keys are correct
2. Check that all required fields are provided (items, shipping address)
3. Ensure products exist and have valid prices
4. Check inventory availability

## API Endpoints

### Create Checkout Session

```http
POST /api/marketplace/checkout/create-session
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "items": [
    {
      "productId": "product_id_here",
      "quantity": 2
    }
  ],
  "shippingAddress": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "9876543210",
    "address": "123 Main St",
    "city": "Bangalore",
    "state": "Karnataka",
    "zipCode": "560001"
  }
}
```

Response:
```json
{
  "success": true,
  "data": {
    "checkoutUrl": "https://checkout.stripe.com/...",
    "sessionId": "cs_test_..."
  },
  "message": "Checkout session created"
}
```

### Webhook Endpoint

```http
POST /api/marketplace/webhook/stripe
Content-Type: application/json
Stripe-Signature: <signature_header>

{
  "id": "evt_...",
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_test_...",
      "metadata": {
        "paymentSessionId": "...",
        "userId": "...",
        "type": "marketplace-order"
      }
    }
  }
}
```

## Future Enhancements

Potential improvements to consider:

1. Add support for multiple currencies
2. Implement refund functionality
3. Add payment method storage for returning customers
4. Support subscription payments
5. Add detailed payment analytics dashboard
6. Implement partial refunds
7. Add support for promotional codes/coupons
