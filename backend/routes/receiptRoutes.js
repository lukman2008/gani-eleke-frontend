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
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    createReceipt,
    getReceipts,
    getReceiptById,
    updateReceipt,
    deleteReceipt,
    getReceiptSummary,
    clearReceipts,
    getReceiptHTML
} = require('../controllers/receiptController');

router.use(protect);

router.post('/', createReceipt);
router.get('/', getReceipts);
router.get('/summary', getReceiptSummary);
router.get('/clear', clearReceipts);
router.delete('/clear', clearReceipts);
router.get('/:id', getReceiptById);
router.put('/:id', updateReceipt);
router.delete('/:id', deleteReceipt);
router.get('/:id/html', getReceiptHTML);  // New endpoint for HTML

module.exports = router;