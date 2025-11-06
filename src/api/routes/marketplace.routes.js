import { Router } from 'express';
import { verifyJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';
import {
  listMarketplaceCatalogue,
  createMarketplaceOrder,
  listSellerProducts,
  createSellerProduct,
  updateSellerProduct,
  deleteSellerProduct,
  listSellerOrders,
  updateSellerOrderStatus,
  settleSellerOrder,
} from '../controllers/marketplace.controller.js';

const router = Router();

router.get('/products', listMarketplaceCatalogue);
router.post('/orders', verifyJWT, createMarketplaceOrder);

router.use(verifyJWT, authorizeRoles('seller', 'admin'));

router.get('/seller/products', listSellerProducts);
router.post('/seller/products', createSellerProduct);
router.put('/seller/products/:productId', updateSellerProduct);
router.delete('/seller/products/:productId', deleteSellerProduct);

router.get('/seller/orders', listSellerOrders);
router.patch('/seller/orders/:orderId/items/:itemId/status', updateSellerOrderStatus);
router.patch('/seller/orders/:orderId/settle', settleSellerOrder);

export default router;
