const PDFDocument = require('pdfkit');
const Receipt = require('../models/Receipt');
const fs = require('fs');
const path = require('path');

const formatCurrency = (amount) => {
  return `₦${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatNumber = (num) => {
  return Number(num).toLocaleString('en-US');
};

const formatNumberNoComma = (num) => {
  return Number(num).toString();
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
      profit,
      iAmount: initialAmount,
      fAmount: finalAmount
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
   GET RECEIPT SUMMARY
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
   CLEAR ALL RECEIPTS
========================= */

const clearReceipts = async (req, res) => {
  await Receipt.deleteMany({});
  res.json({ message: 'All receipts and balances have been cleared.' });
};

/* =========================
   HELPER: Draw Company Header
========================= */

const drawCompanyHeader = (doc, receipt) => {
  const pageWidth = doc.page.width;
  const leftX = 50;
  const rightX = 350;
  
  let y = 40;
  
  // Top colored bars (matching the flex bars in HTML)
  doc.rect(leftX, y, (pageWidth - 100) / 2, 8).fill('#DC2626'); // Red bar
  doc.rect(leftX + (pageWidth - 100) / 2, y, ((pageWidth - 100) * 2/3), 8).fill('#1E3A8A'); // Blue bar
  
  y += 20;
  
  // Logo circle placeholder (if you want to add logo functionality later)
  // doc.circle(leftX + 32, y + 32, 32).fill('#E5E7EB');
  
  // RC Number
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#4B5563')
     .text('RC:2197931', leftX, y);
  
  y += 12;
  
  // Main title
  doc.fontSize(30).font('Helvetica-Bold').fillColor('#1E3A8A')
     .text('GANI ELEKE', leftX, y);
  
  // Subtitle with letter spacing effect
  y += 35;
  doc.fontSize(18).font('Helvetica').fillColor('#6B7280')
     .text('E N T E R P R I S E S', leftX, y, { characterSpacing: 3 });
  
  y += 30;
  
  // Description text
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#DC2626')
     .text('Dealers and Suppliers of all kind of:', leftX, y);
  
  y += 12;
  doc.font('Helvetica').fillColor('#000000')
     .text('Electric Motor, Pumping Machine,', leftX, y);
  
  y += 12;
  doc.text('Gear Motor and scrap etc.', leftX, y);
  
  // Right side - RECEIPT title
  doc.fontSize(36).font('Helvetica-Bold').fillColor('#1F2937')
     .text('RECEIPT', rightX + 20, 60);
  
  // Office info on right
  let infoY = 100;
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#DC2626')
     .text('Office Address:', rightX, infoY);
  
  infoY += 12;
  doc.font('Helvetica').fillColor('#000000')
     .text('Line11, Shop 1, Owode Onirin,', rightX, infoY);
  
  infoY += 12;
  doc.text('Ikorodu road, Lagos.', rightX, infoY);
  
  infoY += 16;
  doc.font('Helvetica-Bold').fillColor('#DC2626')
     .text('Telephone:', rightX, infoY);
  
  infoY += 12;
  doc.font('Helvetica').fillColor('#000000')
     .text('08033281397, 08052944592,', rightX, infoY);
  
  infoY += 12;
  doc.text('08062514308', rightX, infoY);
  
  infoY += 16;
  doc.font('Helvetica-Bold').fillColor('#DC2626')
     .text('E-mail:', rightX, infoY);
  
  infoY += 12;
  doc.font('Helvetica').fillColor('#000000')
     .text('ganiolaiya123@gmail.com', rightX, infoY);
  
  // Date boxes
  const date = receipt.date || new Date();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  
  let dateX = rightX + 80;
  let dateY = infoY + 30;
  
  // DD box
  doc.rect(dateX, dateY, 40, 20).stroke('#1E3A8A');
  doc.rect(dateX, dateY, 20, 20).fill('#1E3A8A');
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF')
     .text('DD', dateX + 4, dateY + 6);
  doc.fontSize(10).font('Helvetica').fillColor('#000000')
     .text(day, dateX + 24, dateY + 5);
  
  // MM box
  dateX += 45;
  doc.rect(dateX, dateY, 40, 20).stroke('#1E3A8A');
  doc.rect(dateX, dateY, 20, 20).fill('#1E3A8A');
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF')
     .text('MM', dateX + 3, dateY + 6);
  doc.fontSize(10).font('Helvetica').fillColor('#000000')
     .text(month, dateX + 24, dateY + 5);
  
  // YY box
  dateX += 45;
  doc.rect(dateX, dateY, 45, 20).stroke('#1E3A8A');
  doc.rect(dateX, dateY, 20, 20).fill('#1E3A8A');
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF')
     .text('YY', dateX + 4, dateY + 6);
  doc.fontSize(10).font('Helvetica').fillColor('#000000')
     .text(year, dateX + 24, dateY + 5);
  
  return 240; // Return Y position for next section
};

/* =========================
   HELPER: Draw Customer Info
========================= */

const drawCustomerInfo = (doc, receipt, startY) => {
  const leftX = 50;
  const pageWidth = doc.page.width;
  const fullWidth = pageWidth - 100;
  
  let y = startY;
  
  // Company line
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#374151')
     .text('Company: ', leftX, y, { continued: true })
     .font('Helvetica').fontSize(14)
     .text(receipt.companyInfo?.name || 'Africa Steel Ltd');
  
  y += 30;
  
  // TO box
  doc.rect(leftX, y, fullWidth, 30).stroke('#1E3A8A');
  doc.rect(leftX, y, 80, 30).fill('#1E3A8A');
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#FFFFFF')
     .text('TO', leftX + 30, y + 8);
  doc.fontSize(12).font('Helvetica').fillColor('#000000')
     .text(receipt.customerName || '', leftX + 95, y + 8);
  
  y += 35;
  
  // ADDRESS box
  doc.rect(leftX, y, fullWidth, 30).stroke('#1E3A8A');
  doc.rect(leftX, y, 80, 30).fill('#1E3A8A');
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#FFFFFF')
     .text('ADDRESS', leftX + 12, y + 8);
  doc.fontSize(12).font('Helvetica').fillColor('#000000')
     .text(receipt.customerAddress || '', leftX + 95, y + 8);
  
  y += 40;
  
  // TEL and VEHICLE boxes
  const halfWidth = (fullWidth - 15) / 2;
  
  // TEL box
  doc.rect(leftX, y, halfWidth, 30).stroke('#1E3A8A');
  doc.rect(leftX, y, 50, 30).fill('#1E3A8A');
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#FFFFFF')
     .text('TEL:', leftX + 12, y + 8);
  doc.fontSize(12).font('Helvetica').fillColor('#000000')
     .text(receipt.customerPhone || '', leftX + 65, y + 8);
  
  // VEHICLE box
  doc.rect(leftX + halfWidth + 15, y, halfWidth, 30).stroke('#1E3A8A');
  doc.rect(leftX + halfWidth + 15, y, 80, 30).fill('#1E3A8A');
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#FFFFFF')
     .text('VEHICLE No.', leftX + halfWidth + 20, y + 8);
  doc.fontSize(12).font('Helvetica').fillColor('#000000')
     .text(receipt.vehicle || '', leftX + halfWidth + 105, y + 8);
  
  return y + 50;
};

/* =========================
   COMPANY COPY PDF
========================= */

const getReceiptPdfCompany = async (receipt, res) => {
  const doc = new PDFDocument({ 
    margin: 50,
    size: 'A4',
    bufferPages: true
  });
  
  doc.pipe(res);
  
  const pageWidth = doc.page.width;
  const leftX = 50;
  const rightX = 350;
  const fullWidth = pageWidth - 100;
  
  // Draw header
  let y = drawCompanyHeader(doc, receipt);
  
  // Draw customer info
  y = drawCustomerInfo(doc, receipt, y);
  
  y += 20;
  
  // ========== TABLE HEADER ==========
  const tableTop = y;
  const rowHeight = 25;
  
  // Table header background
  doc.rect(leftX, y, fullWidth, rowHeight).fill('#1E3A8A');
  
  // Column positions (adjust to match HTML template)
  const col1 = leftX + 5;        // Items Details
  const col2 = leftX + 160;      // Dust
  const col3 = leftX + 210;      // Qty
  const col4 = leftX + 255;      // I-Rate
  const col5 = leftX + 310;      // F-Rate
  const col6 = leftX + 375;      // I-Amount
  const col7 = leftX + 455;      // F-Amount
  
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
  doc.text('Items Details', col1, y + 8);
  doc.text('Dust', col2, y + 8);
  doc.text('Qty', col3, y + 8);
  doc.text('I-Rate', col4, y + 8);
  doc.text('F-Rate', col5, y + 8);
  doc.text('I-Amount ₦', col6, y + 8);
  doc.text('F-Amount ₦', col7, y + 8);
  
  y += rowHeight;
  
  // ========== TABLE ROWS ==========
  let totalProfit = 0;
  let totalCredit = 0;
  
  receipt.credits.forEach((item, index) => {
    // Alternating row colors
    if (index % 2 === 0) {
      doc.rect(leftX, y, fullWidth, rowHeight).fill('#F9FAFB');
    } else {
      doc.rect(leftX, y, fullWidth, rowHeight).fill('#E5E7EB');
    }
    
    const iAmount = item.qty * (item.initialRate || item.rate);
    const fAmount = (item.qty * item.rate) - (item.dust || 0);
    totalCredit += fAmount;
    totalProfit += (fAmount - iAmount);
    
    doc.fontSize(9).font('Helvetica').fillColor('#000000');
    doc.text(item.description || '', col1, y + 8, { width: 150 });
    doc.text(`${formatNumber(item.dust || 0)}KG`, col2, y + 8);
    doc.text(formatNumber(item.qty), col3, y + 8);
    doc.text(formatNumber(item.initialRate || item.rate), col4, y + 8);
    doc.text(formatNumber(item.rate), col5, y + 8);
    doc.text(formatNumber(iAmount), col6, y + 8);
    doc.text(formatNumber(fAmount), col7, y + 8);
    
    y += rowHeight;
  });
  
  y += 15;
  
  // ========== DEDUCTIONS TABLE ==========
  const deductionsTop = y;
  
  // Deductions header
  doc.rect(leftX, y, fullWidth, rowHeight).fill('#1E3A8A');
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF');
  doc.text('Descriptions', leftX + 10, y + 8);
  doc.text('Amount ₦', rightX + 100, y + 8);
  
  y += rowHeight;
  
  // Deductions rows
  receipt.less.forEach((item, index) => {
    if (index % 2 === 0) {
      doc.rect(leftX, y, fullWidth, rowHeight).fill('#F9FAFB');
    } else {
      doc.rect(leftX, y, fullWidth, rowHeight).fill('#E5E7EB');
    }
    
    doc.fontSize(10).font('Helvetica').fillColor('#000000');
    doc.text(item.description || '', leftX + 10, y + 8);
    doc.text(formatNumber(item.amount), rightX + 100, y + 8);
    
    y += rowHeight;
  });
  
  // Add Debt row if not present
  const hasDebt = receipt.less.some(l => l.description?.toLowerCase() === 'debt');
  if (!hasDebt) {
    if (receipt.less.length % 2 === 0) {
      doc.rect(leftX, y, fullWidth, rowHeight).fill('#F9FAFB');
    } else {
      doc.rect(leftX, y, fullWidth, rowHeight).fill('#E5E7EB');
    }
    doc.fontSize(10).font('Helvetica').fillColor('#000000');
    doc.text('Debt', leftX + 10, y + 8);
    y += rowHeight;
  }
  
  y += 20;
  
  // ========== TOTALS SECTION ==========
  const totalsX = rightX + 50;
  
  // Profit section (left side)
  doc.fontSize(10).font('Helvetica').fillColor('#000000');
  doc.text('Profit Total:', leftX, y);
  doc.font('Helvetica-Bold')
     .text(formatCurrency(totalProfit), leftX + 70, y);
  
  // Right side totals
  doc.font('Helvetica').fillColor('#000000');
  doc.text('Profit:', totalsX, y - 25);
  doc.font('Helvetica-Bold')
     .text(formatCurrency(totalProfit), totalsX + 50, y - 25);
  
  doc.font('Helvetica').fillColor('#000000');
  doc.text('Credit:', totalsX, y - 10);
  doc.font('Helvetica-Bold')
     .text(formatCurrency(totalCredit), totalsX + 50, y - 10);
  
  doc.font('Helvetica').fillColor('#000000');
  doc.text('Debit:', totalsX, y + 5);
  doc.font('Helvetica-Bold')
     .text(formatCurrency(receipt.debitTotal), totalsX + 50, y + 5);
  
  y += 35;
  
  // Balance with red underline
  doc.fontSize(14).font('Helvetica-Bold').fillColor('#1E3A8A');
  doc.text('Balance:', totalsX, y);
  doc.text(formatCurrency(receipt.balance), totalsX + 70, y);
  
  // Red underline
  y += 18;
  doc.moveTo(totalsX, y)
     .lineTo(totalsX + 200, y)
     .lineWidth(3)
     .stroke('#DC2626');
  
  y += 50;
  
  // Thank you message
  doc.fontSize(11).font('Helvetica-Oblique').fillColor('#1F2937')
     .text('Thank you for doing business with us.', leftX, y, { 
       align: 'center', 
       width: fullWidth 
     });
  
  // Add watermark if logo exists
  if (receipt.companyInfo?.logo) {
    // You can implement logo watermark here if needed
  }
  
  doc.end();
};

/* =========================
   CUSTOMER COPY PDF
========================= */

const getReceiptPdfCustomer = async (receipt, res) => {
  const doc = new PDFDocument({ 
    margin: 50,
    size: 'A4',
    bufferPages: true
  });
  
  doc.pipe(res);
  
  const pageWidth = doc.page.width;
  const leftX = 50;
  const rightX = 350;
  const fullWidth = pageWidth - 100;
  
  // Draw header
  let y = drawCompanyHeader(doc, receipt);
  
  // Draw customer info
  y = drawCustomerInfo(doc, receipt, y);
  
  y += 20;
  
  // ========== TABLE HEADER (Simpler for customer) ==========
  const rowHeight = 25;
  
  // Table header background
  doc.rect(leftX, y, fullWidth, rowHeight).fill('#1E3A8A');
  
  // Column positions for customer copy
  const col1 = leftX + 5;        // Items Details
  const col2 = leftX + 170;      // Dust
  const col3 = leftX + 230;      // Qty
  const col4 = leftX + 290;      // Rate
  const col5 = leftX + 420;      // Amount
  
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF');
  doc.text('Items Details', col1, y + 8);
  doc.text('Dust', col2, y + 8);
  doc.text('Qty', col3, y + 8);
  doc.text('Rate', col4, y + 8);
  doc.text('Amount ₦', col5, y + 8);
  
  y += rowHeight;
  
  // ========== TABLE ROWS ==========
  let totalCredit = 0;
  
  receipt.credits.forEach((item, index) => {
    // Alternating row colors
    if (index % 2 === 0) {
      doc.rect(leftX, y, fullWidth, rowHeight).fill('#F9FAFB');
    } else {
      doc.rect(leftX, y, fullWidth, rowHeight).fill('#E5E7EB');
    }
    
    const amount = (item.qty * item.rate) - (item.dust || 0);
    totalCredit += amount;
    
    doc.fontSize(10).font('Helvetica').fillColor('#000000');
    doc.text(item.description || '', col1, y + 8, { width: 160 });
    doc.text(`${formatNumber(item.dust || 0)}KG`, col2, y + 8);
    doc.text(formatNumber(item.qty), col3, y + 8);
    doc.text(formatNumber(item.rate), col4, y + 8);
    doc.text(formatNumber(amount), col5, y + 8);
    
    y += rowHeight;
  });
  
  y += 15;
  
  // ========== DEDUCTIONS TABLE ==========
  // Deductions header
  doc.rect(leftX, y, fullWidth, rowHeight).fill('#1E3A8A');
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF');
  doc.text('Descriptions', leftX + 10, y + 8);
  doc.text('Amount ₦', rightX + 100, y + 8);
  
  y += rowHeight;
  
  // Deductions rows
  receipt.less.forEach((item, index) => {
    if (index % 2 === 0) {
      doc.rect(leftX, y, fullWidth, rowHeight).fill('#F9FAFB');
    } else {
      doc.rect(leftX, y, fullWidth, rowHeight).fill('#E5E7EB');
    }
    
    doc.fontSize(10).font('Helvetica').fillColor('#000000');
    doc.text(item.description || '', leftX + 10, y + 8);
    doc.text(formatNumber(item.amount), rightX + 100, y + 8);
    
    y += rowHeight;
  });
  
  // Add Debt row if not present
  const hasDebt = receipt.less.some(l => l.description?.toLowerCase() === 'debt');
  if (!hasDebt) {
    if (receipt.less.length % 2 === 0) {
      doc.rect(leftX, y, fullWidth, rowHeight).fill('#F9FAFB');
    } else {
      doc.rect(leftX, y, fullWidth, rowHeight).fill('#E5E7EB');
    }
    doc.fontSize(10).font('Helvetica').fillColor('#000000');
    doc.text('Debt', leftX + 10, y + 8);
    y += rowHeight;
  }
  
  y += 20;
  
  // ========== TOTALS SECTION (Right-aligned) ==========
  const totalsX = rightX + 80;
  
  doc.fontSize(11).font('Helvetica').fillColor('#000000');
  doc.text('Credit:', totalsX, y);
  doc.font('Helvetica-Bold')
     .text(formatCurrency(totalCredit), totalsX + 60, y);
  
  y += 18;
  
  doc.font('Helvetica').fillColor('#000000');
  doc.text('Debit:', totalsX, y);
  doc.font('Helvetica-Bold')
     .text(formatCurrency(receipt.debitTotal), totalsX + 60, y);
  
  y += 25;
  
  // Balance with red underline
  doc.fontSize(14).font('Helvetica-Bold').fillColor('#1E3A8A');
  doc.text('Balance:', totalsX, y);
  doc.text(formatCurrency(receipt.balance), totalsX + 70, y);
  
  // Red underline
  y += 20;
  doc.moveTo(totalsX, y)
     .lineTo(totalsX + 200, y)
     .lineWidth(3)
     .stroke('#DC2626');
  
  y += 60;
  
  // Thank you message
  doc.fontSize(11).font('Helvetica-Oblique').fillColor('#1F2937')
     .text('Thank you for doing business with us.', leftX, y, { 
       align: 'center', 
       width: fullWidth 
     });
  
  doc.end();
};

/* =========================
   MAIN PDF ROUTE
========================= */

const getReceiptPdf = async (req, res) => {
  try {
    const receipt = await Receipt.findById(req.params.id);
    if (!receipt) return res.status(404).json({ message: 'Receipt not found' });

    const { type } = req.query;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${receipt.receiptNumber}.pdf"`);

    if (type === 'customer') {
      return getReceiptPdfCustomer(receipt, res);
    }

    return getReceiptPdfCompany(receipt, res);
    
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ 
      message: 'Error generating PDF', 
      error: error.message 
    });
  }
};

/* =========================
   EXPORTS
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