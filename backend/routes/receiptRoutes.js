const express = require('express');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { 
  createReceipt, 
  getReceipts, 
  getReceiptById, 
  updateReceipt,
  deleteReceipt, 
  getReceiptSummary,
  clearReceipts,
  getReceiptHTML,
  getReceiptHistory
} = require('../controllers/receiptController');

const router = express.Router();

router.use(protect);

// Summary and clear routes
router.route('/summary').get(getReceiptSummary);
router.route('/clear').delete(adminOnly, clearReceipts);
router.route('/history').get(getReceiptHistory);  // NEW ROUTE

// Main CRUD routes
router.route('/')
  .get(getReceipts)
  .post(createReceipt);

// HTML receipt route
router.route('/:id/html').get(getReceiptHTML);

// Single receipt routes
router.route('/:id')
  .get(getReceiptById)
  .put(updateReceipt)
  .delete(deleteReceipt);

module.exports = router;