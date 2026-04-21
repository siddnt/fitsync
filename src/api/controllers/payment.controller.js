import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import Order from '../../models/order.model.js';
import GymMembership from '../../models/gymMembership.model.js';
import GymListingSubscription from '../../models/gymListingSubscription.model.js';
import { fulfillMarketplaceOrder } from './marketplace.controller.js';
import { fulfillGymMembership } from './gymMembership.controller.js';
import { fulfillListingSubscription, fulfillSponsorship } from './monetisation.controller.js';
import { retrieveStripeCheckoutSession } from '../../services/stripe.service.js';

/**
 * Validates a Stripe session and returns fulfillment status and receipt URL.
 * Does not re-fulfill an already fulfilled session (idempotency handled by consumer components or logic).
 */
export const verifySession = asyncHandler(async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    throw new ApiError(400, 'Session ID is required');
  }

  const session = await retrieveStripeCheckoutSession(sessionId, {
    expand: ['payment_intent', 'payment_intent.latest_charge'],
  });

  if (!session) {
    throw new ApiError(404, 'Invalid session ID');
  }

  const isPaid = session.payment_status === 'paid';

  let receiptUrl = null;
  if (isPaid && session.payment_intent && session.payment_intent.latest_charge) {
    receiptUrl = session.payment_intent.latest_charge.receipt_url;
  }
  
  if (isPaid && session.metadata) {
    const meta = session.metadata;
    
    if (meta.type === 'marketplace') {
      const order = await Order.findOne({ stripeSessionId: sessionId });
      if (order) await fulfillMarketplaceOrder(order._id);
    } else if (meta.type === 'gym_membership') {
      const membership = meta.membershipId
        ? await GymMembership.findById(meta.membershipId)
        : await GymMembership.findOne({ 'billing.paymentReference': sessionId });
      if (membership) {
        await fulfillGymMembership(membership._id, { sessionId, receiptUrl });
      }
    } else if (meta.type === 'listing_subscription') {
      const sub = meta.subscriptionId
        ? await GymListingSubscription.findById(meta.subscriptionId)
        : await GymListingSubscription.findOne({ 'invoices.paymentReference': sessionId });
      if (sub) {
        await fulfillListingSubscription(sub._id, { sessionId, receiptUrl });
      }
    } else if (meta.type === 'sponsorship') {
      await fulfillSponsorship(meta.gymId, meta.tier, sessionId, req.user?._id ?? meta.ownerId, receiptUrl);
    }
  }

  return res.status(200).json(
    new ApiResponse(200, {
      sessionId: session.id,
      status: session.payment_status,
      metadata: session.metadata,
      receiptUrl,
    }, 'Session verified successfully')
  );
});
