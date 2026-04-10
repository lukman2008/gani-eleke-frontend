const PDFDocument = require('pdfkit');
const Receipt = require('../models/Receipt');

/* =========================
   HELPER FUNCTIONS
========================= */

const formatCurrency = (amount) => {
  return `NGN${Number(amount).toLocaleString()}`;
};

/* =========================
   COMPUTATION LOGIC
========================= */

const computeReceipt = ({ customerName, credits = [], less = [], note }) => {
  const normalizedCredits = credits.map((item) => {
    const qty = Number(item.qty || 0);
    const rate = Number(item.rate || 0);
    const dust = Number(item.dust || 0);

    const initialRate = Number(item.initialRate) || rate;
    const initialAmount = qty * initialRate;
    const finalAmount = (qty * rate) - dust;
    const profit = finalAmount - initialAmount;

    return {
      description: item.description || '',
      qty,
      rate,
      dust,
      initialRate,
      amount: Math.max(finalAmount, 0),
      profit
    };
  });

  const normalizedLess = less.map((item) => ({
    description: item.description || '',
    amount: Number(item.amount || 0),
  }));

  const subTotal = normalizedCredits.reduce((sum, i) => sum + i.amount, 0);
  const debitTotal = normalizedLess.reduce((sum, i) => sum + i.amount, 0);
  const balance = subTotal - debitTotal;

  return {
    customerName,
    credits: normalizedCredits,
    less: normalizedLess,
    subTotal,
    debitTotal,
    balance,
    note,
  };
};

/* =========================
   CREATE RECEIPT
========================= */

const createReceipt = async (req, res) => {
  const { customerName, credits, less, note, ...rest } = req.body;

  if (!customerName || !credits?.length) {
    return res.status(400).json({ message: 'Customer name and credits required' });
  }

  const data = computeReceipt({ customerName, credits, less, note });

  const receipt = await Receipt.create({
    ...rest,
    ...data,
    receiptNumber: `RCPT-${Date.now()}`,
    createdBy: req.user._id
  });

  res.status(201).json(receipt);
};

/* =========================
   GET ALL RECEIPTS
========================= */

const getReceipts = async (req, res) => {
  const receipts = await Receipt.find().populate('createdBy', 'name email role').sort({ createdAt: -1 });
  res.json(receipts);
};

/* =========================
   GET ONE RECEIPT
========================= */

const getReceiptById = async (req, res) => {
  const receipt = await Receipt.findById(req.params.id).populate('createdBy', 'name email role');
  if (!receipt) return res.status(404).json({ message: 'Not found' });
  res.json(receipt);
};

/* =========================
   UPDATE RECEIPT
========================= */

const updateReceipt = async (req, res) => {
  const receipt = await Receipt.findById(req.params.id);
  if (!receipt) {
    return res.status(404).json({ message: 'Receipt not found.' });
  }

  const { companyInfo, receiptTitle, customerName, customerPhone, customerAddress, vehicle, creditorName, creditorPhone, credits, less, note, date } = req.body;
  
  const data = computeReceipt({
    customerName: customerName || receipt.customerName,
    credits: credits || receipt.credits,
    less: less || receipt.less,
    note: note ?? receipt.note,
  });

  if (date) receipt.date = new Date(date);
  if (receiptTitle) receipt.receiptTitle = receiptTitle;
  if (companyInfo) receipt.companyInfo = companyInfo;
  if (vehicle) receipt.vehicle = vehicle;
  if (customerAddress) receipt.customerAddress = customerAddress;
  if (creditorName) receipt.creditorName = creditorName;
  if (creditorPhone) receipt.creditorPhone = creditorPhone;
  if (customerName) receipt.customerName = data.customerName;
  if (customerPhone) receipt.customerPhone = customerPhone;
  
  receipt.credits = data.credits;
  receipt.less = data.less;
  receipt.subTotal = data.subTotal;
  receipt.debitTotal = data.debitTotal;
  receipt.balance = data.balance;
  if (note !== undefined) receipt.note = data.note;

  await receipt.save();
  res.json(receipt);
};

/* =========================
   DELETE RECEIPT
========================= */

const deleteReceipt = async (req, res) => {
  const receipt = await Receipt.findById(req.params.id);
  if (!receipt) {
    return res.status(404).json({ message: 'Receipt not found.' });
  }
  await receipt.deleteOne();
  res.json({ message: 'Receipt deleted.' });
};

/* =========================
   GET RECEIPT SUMMARY (for dashboard)
========================= */

const getReceiptSummary = async (req, res) => {
  const receipts = await Receipt.find();
  const totalReceipts = receipts.length;
  const totalCreditAmount = receipts.reduce((sum, receipt) => sum + (receipt.subTotal || 0), 0);
  const totalDebitAmount = receipts.reduce((sum, receipt) => sum + (receipt.debitTotal || 0), 0);
  const totalBalance = receipts.reduce((sum, receipt) => sum + (receipt.balance || 0), 0);
  
  res.json({
    totalReceipts,
    totalCreditAmount,
    totalDebitAmount,
    totalBalance,
  });
};

/* =========================
   CLEAR ALL RECEIPTS (admin only)
========================= */

const clearReceipts = async (req, res) => {
  await Receipt.deleteMany({});
  res.json({ message: 'All receipts and balances have been cleared.' });
};

/* =========================
   HEADER DESIGN (UPDATED with subtitle)
========================= */

const drawHeader = (doc) => {
  // Top bars
  doc.rect(0, 0, 250, 10).fill('#E53935');
  doc.rect(250, 0, 350, 10).fill('#1E3A8A');

  // Logo / Company Name
  doc.fillColor('#1E3A8A')
    .fontSize(22)
    .font('Helvetica-Bold')
    .text('GANI ELEKE', 50, 40);

  doc.fontSize(10)
    .fillColor('#555')
    .text('ENTERPRISES', 50, 65);
  
  // Subtitle line - Dealers and suppliers text
  doc.fontSize(8)
    .fillColor('#777')
    .text('Dealers and suppliers of all kinds of electric motors, pumps,', 50, 80)
    .text('generators, industrial machines, and building materials.', 50, 92);

  // Right side - RECEIPT
  doc.fontSize(24)
    .fillColor('#000')
    .text('RECEIPT', 350, 40);

  // Office details
  doc.fontSize(9)
    .fillColor('#555')
    .text('Office Address:', 350, 85)
    .text('Line11, Shop 1, Owode Onirin, Ikorodu road, Lagos.', 350, 100)
    .text('Telephone:', 350, 120)
    .text('08033281397, 08052944592, 08062514308', 350, 135)
    .text('E-mail:', 350, 155)
    .text('ganiolaiya123@gmail.com', 350, 170);
};

/* =========================
   DRAW TABLE ROW HELPER
========================= */

const drawTableRow = (doc, y, columns, isEven) => {
  if (isEven) {
    doc.rect(50, y, 500, 20).fill('#f5f5f5');
  }
  return y;
};

/* =========================
   COMPANY PDF
========================= */

const getReceiptPdfCompany = async (receipt, res) => {
  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(res);

  drawHeader(doc);

  let y = 230;

  doc.text(`Company: ${receipt.companyInfo?.name || ''}`, 50, y);
  y += 20;

  // TO
  doc.rect(50, y, 500, 50).stroke('#1E3A8A');
  doc.text('TO', 55, y + 5);
  doc.text(receipt.customerName, 55, y + 20);

  y += 50;

  // ADDRESS
  doc.rect(50, y, 500, 50).stroke('#1E3A8A');
  doc.text('ADDRESS', 55, y + 5);
  doc.text(receipt.customerAddress, 55, y + 20);

  y += 70;

  doc.text(`TEL: ${receipt.customerPhone}`, 50, y);
  doc.text(`VEHICLE NO: ${receipt.vehicle}`, 300, y);

  y += 30;

  // ============ ITEMS TABLE ============
  // Table Header
  doc.rect(50, y, 500, 20).fill('#1E3A8A');
  doc.fillColor('#fff');
  doc.text('ITEMS DETAILS', 55, y + 5);
  doc.text('DUST', 150, y + 5);
  doc.text('QTY', 200, y + 5);
  doc.text('I-RATE', 240, y + 5);
  doc.text('F-RATE', 290, y + 5);
  doc.text('I-AMOUNT', 340, y + 5);
  doc.text('F-AMOUNT', 430, y + 5);
  y += 20;

  let totalProfit = 0;

  receipt.credits.forEach((item, i) => {
    if (i % 2 === 1) {
      doc.rect(50, y, 500, 20).fill('#f5f5f5');
    }

    doc.fillColor('#000');

    const initial = item.qty * (item.initialRate || item.rate);
    const final = (item.qty * item.rate) - (item.dust || 0);
    const profit = final - initial;
    totalProfit += profit;

    doc.text(item.description, 55, y + 5);
    doc.text(item.dust + 'KG', 150, y + 5);
    doc.text(item.qty.toString(), 200, y + 5);
    doc.text((item.initialRate || item.rate).toString(), 240, y + 5);
    doc.text(item.rate.toString(), 290, y + 5);
    doc.text(initial.toLocaleString(), 340, y + 5);
    doc.text(final.toLocaleString(), 430, y + 5);

    y += 20;
  });

  y += 10;

  // ============ DEDUCTIONS TABLE (Styled like Items Table) ============
  if (receipt.less && receipt.less.length > 0) {
    // Deductions Table Header
    doc.rect(50, y, 500, 20).fill('#1E3A8A');
    doc.fillColor('#fff');
    doc.text('DESCRIPTIONS', 55, y + 5);
    doc.text('AMOUNT (₦)', 450, y + 5);
    y += 20;

    receipt.less.forEach((item, i) => {
      if (i % 2 === 1) {
        doc.rect(50, y, 500, 20).fill('#f5f5f5');
      }
      doc.fillColor('#000');
      doc.text(item.description, 55, y + 5);
      doc.text(item.amount.toLocaleString(), 450, y + 5);
      y += 20;
    });
  } else {
    // Show Offloading row even if empty
    doc.rect(50, y, 500, 20).fill('#1E3A8A');
    doc.fillColor('#fff');
    doc.text('DESCRIPTIONS', 55, y + 5);
    doc.text('AMOUNT (₦)', 450, y + 5);
    y += 20;
    
    doc.rect(50, y, 500, 20).fill('#f5f5f5');
    doc.fillColor('#000');
    doc.text('Offloading', 55, y + 5);
    doc.text('0', 450, y + 5);
    y += 20;
  }

  y += 10;

  // Debt row (standalone)
  doc.fillColor('#000').fontSize(9).font('Helvetica');
  doc.text('Debt', 55, y);
  y += 20;

  // Profit Section
  doc.text(`Profit: ${formatCurrency(totalProfit)}`, 50, y);
  y += 20;

  // Totals
  doc.text(`Credit: ${formatCurrency(receipt.subTotal)}`, 50, y);
  y += 15;
  doc.text(`Debit: ${formatCurrency(receipt.debitTotal)}`, 50, y);
  y += 15;

  doc.fillColor('#1E3A8A')
    .fontSize(12)
    .text(`Balance: ${formatCurrency(receipt.balance)}`, 50, y);

  doc.moveTo(50, y + 15).lineTo(250, y + 15).stroke('#E53935');

  y += 40;

  doc.fillColor('#000').text('Thank you for doing business with us.', 150, y);

  doc.end();
};

/* =========================
   CUSTOMER PDF (UPDATED with styled Offloading table)
========================= */

const getReceiptPdfCustomer = async (receipt, res) => {
  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(res);

  drawHeader(doc);

  let y = 230;

  doc.text(`Company: ${receipt.companyInfo?.name || ''}`, 50, y);
  y += 20;

  // TO
  doc.rect(50, y, 500, 50).stroke('#1E3A8A');
  doc.text('TO', 55, y + 5);
  doc.text(receipt.customerName, 55, y + 20);

  y += 50;

  // ADDRESS
  doc.rect(50, y, 500, 50).stroke('#1E3A8A');
  doc.text('ADDRESS', 55, y + 5);
  doc.text(receipt.customerAddress, 55, y + 20);

  y += 70;

  doc.text(`TEL: ${receipt.customerPhone}`, 50, y);
  doc.text(`VEHICLE NO: ${receipt.vehicle}`, 300, y);

  y += 30;

  // ============ ITEMS TABLE ============
  doc.rect(50, y, 500, 20).fill('#1E3A8A');
  doc.fillColor('#fff');
  doc.text('ITEMS DETAILS', 55, y + 5);
  doc.text('DUST', 150, y + 5);
  doc.text('QTY', 200, y + 5);
  doc.text('RATE', 260, y + 5);
  doc.text('AMOUNT ₦', 400, y + 5);
  y += 20;

  receipt.credits.forEach((item, i) => {
    if (i % 2 === 1) {
      doc.rect(50, y, 500, 20).fill('#f5f5f5');
    }

    const amount = (item.qty * item.rate) - (item.dust || 0);

    doc.fillColor('#000');
    doc.text(item.description, 55, y + 5);
    doc.text(item.dust + 'KG', 150, y + 5);
    doc.text(item.qty.toString(), 200, y + 5);
    doc.text(item.rate.toString(), 260, y + 5);
    doc.text(amount.toLocaleString(), 400, y + 5);

    y += 20;
  });

  y += 10;

  // ============ DEDUCTIONS TABLE (Styled like Items Table) ============
  if (receipt.less && receipt.less.length > 0) {
    // Deductions Table Header
    doc.rect(50, y, 500, 20).fill('#1E3A8A');
    doc.fillColor('#fff');
    doc.text('DESCRIPTIONS', 55, y + 5);
    doc.text('AMOUNT (₦)', 450, y + 5);
    y += 20;

    receipt.less.forEach((item, i) => {
      if (i % 2 === 1) {
        doc.rect(50, y, 500, 20).fill('#f5f5f5');
      }
      doc.fillColor('#000');
      doc.text(item.description, 55, y + 5);
      doc.text(item.amount.toLocaleString(), 450, y + 5);
      y += 20;
    });
  } else {
    // Show Offloading row even if empty
    doc.rect(50, y, 500, 20).fill('#1E3A8A');
    doc.fillColor('#fff');
    doc.text('DESCRIPTIONS', 55, y + 5);
    doc.text('AMOUNT (₦)', 450, y + 5);
    y += 20;
    
    doc.rect(50, y, 500, 20).fill('#f5f5f5');
    doc.fillColor('#000');
    doc.text('Offloading', 55, y + 5);
    doc.text('0', 450, y + 5);
    y += 20;
  }

  y += 10;

  // Debt row
  doc.fillColor('#000').fontSize(9).font('Helvetica');
  doc.text('Debt', 55, y);
  y += 25;

  // Totals
  doc.text(`Credit: ${formatCurrency(receipt.subTotal)}`, 50, y);
  y += 15;
  doc.text(`Debit: ${formatCurrency(receipt.debitTotal)}`, 50, y);
  y += 15;

  doc.fillColor('#1E3A8A')
    .fontSize(12)
    .text(`Balance: ${formatCurrency(receipt.balance)}`, 50, y);

  doc.moveTo(50, y + 15).lineTo(250, y + 15).stroke('#E53935');

  y += 40;

  doc.fillColor('#000').text('Thank you for doing business with us.', 150, y);

  doc.end();
};

/* =========================
   MAIN PDF ROUTE
========================= */

const getReceiptPdf = async (req, res) => {
  const receipt = await Receipt.findById(req.params.id);
  if (!receipt) return res.status(404).json({ message: 'Not found' });

  const { type } = req.query;

  res.setHeader('Content-Type', 'application/pdf');

  if (type === 'customer') {
    return getReceiptPdfCustomer(receipt, res);
  }

  return getReceiptPdfCompany(receipt, res);
};

/* =========================
   EXPORTS - ALL FUNCTIONS
========================= */

module.exports = {
  createReceipt,
  getReceipts,
  getReceiptById,
  updateReceipt,
  deleteReceipt,
  getReceiptSummary,
  clearReceipts,
  getReceiptPdf
};