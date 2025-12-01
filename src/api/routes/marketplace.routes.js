import { Router } from 'express';
import { verifyJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';
import {
  listMarketplaceCatalogue,
  getMarketplaceProduct,
  createMarketplaceOrder,
  listSellerProducts,
  createSellerProduct,
  updateSellerProduct,
  deleteSellerProduct,
  listSellerOrders,
  updateSellerOrderStatus,
  settleSellerOrder,
} from '../controllers/marketplace.controller.js';
import { upload } from '../../middlewares/multer.middleware.js';

const router = Router();

router.get('/products', listMarketplaceCatalogue);
router.get('/products/:productId', getMarketplaceProduct);
router.post('/orders', verifyJWT, authorizeRoles('user', 'trainee'), createMarketplaceOrder);

router.use(verifyJWT, authorizeRoles('seller', 'admin'));

router.get('/seller/products', listSellerProducts);
router.post('/seller/products', upload.single('image'), createSellerProduct);
router.put('/seller/products/:productId', upload.single('image'), updateSellerProduct);
router.delete('/seller/products/:productId', deleteSellerProduct);

router.get('/seller/orders', listSellerOrders);
router.patch('/seller/orders/:orderId/items/:itemId/status', updateSellerOrderStatus);
router.patch('/seller/orders/:orderId/settle', settleSellerOrder);

export default router;
