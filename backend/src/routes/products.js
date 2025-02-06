const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public routes
router.get('/', productController.getProducts);
router.get('/:id', productController.getProduct);

// Protected routes
router.post('/',
  authenticate,
  authorize(['seller', 'admin']),
  upload.array('images', 5),
  productController.createProduct
);

router.put('/:id',
  authenticate,
  authorize(['seller', 'admin']),
  upload.array('images', 5),
  productController.updateProduct
);

router.delete('/:id',
  authenticate,
  authorize(['seller', 'admin']),
  productController.deleteProduct
);

router.post('/:id/reviews',
  authenticate,
  upload.array('images', 3),
  productController.addReview
);

module.exports = router;
