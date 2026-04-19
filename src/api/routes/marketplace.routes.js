import { Router } from 'express';
import { verifyJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';
import {
  listMarketplaceCatalogue,
  getMarketplaceProduct,
  createMarketplaceOrder,
  createMarketplaceCheckoutSession,
  getOrderByStripeSession,
  handleStripeWebhook,
  createMarketplaceProductReview,
  requestMarketplaceReturn,
  listSellerProducts,
  createSellerProduct,
  getSellerProduct,
  updateSellerProduct,
  deleteSellerProduct,
  listSellerOrders,
  updateSellerOrderStatus,
  updateSellerOrderTracking,
  reviewMarketplaceReturn,
  settleSellerOrder,
} from '../controllers/marketplace.controller.js';
import { upload } from '../../middlewares/multer.middleware.js';

const router = Router();

router.get('/products', listMarketplaceCatalogue);
router.get('/products/:productId', getMarketplaceProduct);
router.post('/orders', verifyJWT, authorizeRoles('user', 'trainee'), createMarketplaceOrder);
router.post('/checkout/create-session', verifyJWT, authorizeRoles('user', 'trainee'), createMarketplaceCheckoutSession);
router.get('/checkout/order/:sessionId', verifyJWT, authorizeRoles('user', 'trainee'), getOrderByStripeSession);
// Webhook endpoint - must use raw body for Stripe signature verification
router.post('/webhook/stripe', handleStripeWebhook);
router.post('/products/:productId/reviews', verifyJWT, authorizeRoles('user', 'trainee'), createMarketplaceProductReview);
router.post('/orders/:orderId/items/:itemId/return', verifyJWT, authorizeRoles('user', 'trainee'), requestMarketplaceReturn);

router.use(verifyJWT, authorizeRoles('seller', 'admin'));

router.get('/seller/products', listSellerProducts);
router.get('/seller/products/:productId', getSellerProduct);
router.post('/seller/products', upload.single('image'), createSellerProduct);
router.put('/seller/products/:productId', upload.single('image'), updateSellerProduct);
router.delete('/seller/products/:productId', deleteSellerProduct);

router.get('/seller/orders', listSellerOrders);
router.patch('/seller/orders/:orderId/items/:itemId/status', updateSellerOrderStatus);
router.patch('/seller/orders/:orderId/items/:itemId/tracking', updateSellerOrderTracking);
router.patch('/seller/orders/:orderId/items/:itemId/return', reviewMarketplaceReturn);
router.patch('/seller/orders/:orderId/settle', settleSellerOrder);

export default router;
