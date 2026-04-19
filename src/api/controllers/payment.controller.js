import PaymentSession from '../../models/paymentSession.model.js';
import stripe from '../../services/stripe.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  finalizeListingSubscriptionPaymentSession,
  finalizeSponsorshipPaymentSession,
} from './monetisation.controller.js';
import { finalizeGymMembershipPaymentSession } from './gymMembership.controller.js';

const getPaymentFlow = (paymentSession) =>
  String(paymentSession?.metadata?.flow || '').trim().toLowerCase();

const canAccessPaymentSession = (user, paymentSession) =>
  Boolean(user?._id)
  && (
    user.role === 'admin'
    || String(user._id) === String(paymentSession?.user)
  );

const finalizePaymentFlow = async ({
  flow,
  paymentSessionId,
  stripeSessionId,
  paymentIntentId,
}) => {
  if (flow === 'listing-subscription') {
    const subscription = await finalizeListingSubscriptionPaymentSession({
      paymentSessionId,
      stripeSessionId,
      paymentIntentId,
    });

    return { flow, subscription };
  }

  if (flow === 'gym-sponsorship') {
    const sponsorship = await finalizeSponsorshipPaymentSession({
      paymentSessionId,
      stripeSessionId,
      paymentIntentId,
    });

    return { flow, sponsorship };
  }

  if (flow === 'gym-membership') {
    const membership = await finalizeGymMembershipPaymentSession({
      paymentSessionId,
      stripeSessionId,
      paymentIntentId,
    });

    return { flow, membership };
  }

  throw new ApiError(400, 'This payment flow is not supported by the generic payment resolver.');
};

export const getPaymentCheckoutSessionResult = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  if (!sessionId) {
    throw new ApiError(400, 'Session ID is required.');
  }

  let paymentSession = await PaymentSession.findOne({
    'stripe.checkoutSessionId': sessionId,
  }).lean();

  if (!paymentSession) {
    throw new ApiError(404, 'Payment session not found.');
  }

  if (!canAccessPaymentSession(req.user, paymentSession)) {
    throw new ApiError(403, 'You are not allowed to access this payment session.');
  }

  const flow = getPaymentFlow(paymentSession);

  if (!flow) {
    throw new ApiError(400, 'Unsupported payment session.');
  }

  if (paymentSession.stripe?.status === 'expired') {
    throw new ApiError(400, 'This checkout session has expired.');
  }

  let resolvedResult;

  if (!paymentSession.processed) {
    const stripeSession = await stripe.checkout.sessions.retrieve(sessionId);
    const isPaid = stripeSession?.payment_status === 'paid';
    const isComplete = stripeSession?.status === 'complete';
    const isExpired = stripeSession?.status === 'expired';

    if (isExpired) {
      await PaymentSession.findByIdAndUpdate(paymentSession._id, {
        'stripe.status': 'expired',
        processed: true,
      });
      throw new ApiError(400, 'This checkout session has expired.');
    }

    if (!isPaid || !isComplete) {
      throw new ApiError(202, 'Payment is still being processed. Please wait a moment.');
    }

    resolvedResult = await finalizePaymentFlow({
      flow,
      paymentSessionId: paymentSession._id,
      stripeSessionId: stripeSession.id,
      paymentIntentId: stripeSession.payment_intent,
    });
  } else {
    resolvedResult = await finalizePaymentFlow({
      flow,
      paymentSessionId: paymentSession._id,
      stripeSessionId: paymentSession.stripe?.checkoutSessionId,
      paymentIntentId: paymentSession.stripe?.paymentIntentId,
    });
  }

  paymentSession = await PaymentSession.findOne({
    'stripe.checkoutSessionId': sessionId,
  }).lean();

  return res
    .status(200)
    .json(new ApiResponse(200, {
      ...resolvedResult,
      paymentReference: paymentSession?.metadata?.paymentReference || '',
    }, 'Payment resolved successfully.'));
});
