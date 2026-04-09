const PDFDocument = require('pdfkit');
const Receipt = require('../models/Receipt');

const computeReceipt = ({ customerName, credits = [], less = [], note }) => {
  const normalizedCredits = credits.map((item) => {
    const qty = Number(item.qty || 0);
    const rate = Number(item.rate || 0);
    const dust = Number(item.dust || 0);
    const amount = (qty * rate) - dust;
    return {
      description: String(item.description || '').trim(),
      qty,
      rate,
      dust: dust || 0,
      amount: Math.max(amount, 0),
      initialRate: Number(item.initialRate) || rate,
      profit: ((qty * rate) - dust) - (qty * (Number(item.initialRate) || rate))
    };
  });

  const normalizedLess = less.map((item) => ({
    description: String(item.description || '').trim(),
    amount: Number(item.amount || 0),
    date: item.date ? new Date(item.date) : new Date(),
  }));

  const subTotal = normalizedCredits.reduce((sum, item) => sum + item.amount, 0);
  const debitTotal = normalizedLess.reduce((sum, item) => sum + item.amount, 0);
  const balance = Math.max(subTotal - debitTotal, 0);

  return {
    customerName: String(customerName || '').trim(),
    credits: normalizedCredits,
    less: normalizedLess,
    subTotal,
    debitTotal,
    balance,
    note: note ? String(note).trim() : '',
  };
};

const buildReceiptPreview = (receipt) => ({
  receiptNumber: receipt.receiptNumber,
  date: receipt.date,
  receiptTitle: receipt.receiptTitle,
  companyInfo: receipt.companyInfo,
  vehicle: receipt.vehicle,
  creditorName: receipt.creditorName,
  creditorPhone: receipt.creditorPhone,
  customerName: receipt.customerName,
  credits: receipt.credits,
  less: receipt.less,
  subTotal: receipt.subTotal,
  debitTotal: receipt.debitTotal,
  balance: receipt.balance,
  note: receipt.note,
});

const createReceipt = async (req, res) => {
  const { companyInfo, receiptTitle, customerName, customerPhone, customerAddress, vehicle, creditorName, creditorPhone, credits, less, note, date } = req.body;

  if (!customerName || !Array.isArray(credits) || credits.length === 0) {
    return res.status(400).json({ message: 'Customer name and at least one credit item are required.' });
  }

  const data = computeReceipt({ customerName, credits, less, note });
  const receiptNumber = `RCPT-${Date.now()}`;

  const receipt = await Receipt.create({
    receiptNumber,
    date: date ? new Date(date) : new Date(),
    receiptTitle: receiptTitle ? String(receiptTitle).trim() : 'Receipt',
    companyInfo: companyInfo || {},
    vehicle: vehicle ? String(vehicle).trim() : '',
    customerAddress: customerAddress ? String(customerAddress).trim() : '',
    creditorName: creditorName ? String(creditorName).trim() : '',
    creditorPhone: creditorPhone ? String(creditorPhone).trim() : '',
    customerPhone: customerPhone ? String(customerPhone).trim() : '',
    ...data,
    createdBy: req.user._id,
  });

  const receiptObject = receipt.toObject();
  res.status(201).json({ ...receiptObject, preview: buildReceiptPreview(receiptObject) });
};

const getReceipts = async (req, res) => {
  const receipts = await Receipt.find()
    .populate('createdBy', 'name email role')
    .sort({ createdAt: -1 });

  const receiptsWithPreview = receipts.map((receipt) => {
    const receiptObject = receipt.toObject();
    return { ...receiptObject, preview: buildReceiptPreview(receiptObject) };
  });

  res.json(receiptsWithPreview);
};

const getReceiptById = async (req, res) => {
  const receipt = await Receipt.findById(req.params.id).populate('createdBy', 'name email role');
  if (!receipt) {
    return res.status(404).json({ message: 'Receipt not found.' });
  }
  const receiptObject = receipt.toObject();
  res.json({ ...receiptObject, preview: buildReceiptPreview(receiptObject) });
};

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

  receipt.date = date ? new Date(date) : receipt.date;
  receipt.receiptTitle = receiptTitle ? String(receiptTitle).trim() : receipt.receiptTitle;
  receipt.companyInfo = companyInfo || receipt.companyInfo;
  receipt.vehicle = vehicle ? String(vehicle).trim() : receipt.vehicle;
  receipt.customerAddress = customerAddress ? String(customerAddress).trim() : receipt.customerAddress;
  receipt.creditorName = creditorName ? String(creditorName).trim() : receipt.creditorName;
  receipt.creditorPhone = creditorPhone ? String(creditorPhone).trim() : receipt.creditorPhone;
  receipt.customerName = data.customerName;
  receipt.customerPhone = customerPhone ? String(customerPhone).trim() : receipt.customerPhone;
  receipt.credits = data.credits;
  receipt.less = data.less;
  receipt.subTotal = data.subTotal;
  receipt.debitTotal = data.debitTotal;
  receipt.balance = data.balance;
  receipt.note = data.note;

  await receipt.save();
  const receiptObject = receipt.toObject();
  res.json({ ...receiptObject, preview: buildReceiptPreview(receiptObject) });
};

const deleteReceipt = async (req, res) => {
  const receipt = await Receipt.findById(req.params.id);
  if (!receipt) {
    return res.status(404).json({ message: 'Receipt not found.' });
  }
  await receipt.deleteOne();
  res.json({ message: 'Receipt deleted.' });
};

const getReceiptSummary = async (req, res) => {
  const receipts = await Receipt.find();
  const totalReceipts = receipts.length;
  const totalCreditAmount = receipts.reduce((sum, receipt) => sum + receipt.subTotal, 0);
  const totalDebitAmount = receipts.reduce((sum, receipt) => sum + receipt.debitTotal, 0);
  const totalBalance = receipts.reduce((sum, receipt) => sum + receipt.balance, 0);
  res.json({ totalReceipts, totalCreditAmount, totalDebitAmount, totalBalance });
};

const clearReceipts = async (req, res) => {
  await Receipt.deleteMany({});
  res.json({ message: 'All receipts and balances have been cleared.' });
};

const formatCurrency = (amount) => {
  return `NGN${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatNumber = (num) => {
  return num.toLocaleString('en-US');
};

// COMPANY COPY PDF - Exactly like first image
const getReceiptPdfCompany = async (receipt, res) => {
  const doc = new PDFDocument({ size: 'A4', margin: 50, layout: 'portrait' });
  doc.pipe(res);

  let y = 50;
  const leftX = 50;
  const rightX = 350;
  const fullWidth = 515;

  // ============ HEADER SECTION ============
  // Company Name
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#000000');
  doc.text('GANI ELEKE ENT', leftX, y, { align: 'center', width: fullWidth });
  y += 25;
  
  // Address
  doc.fontSize(9).font('Helvetica').fillColor('#333333');
  doc.text('Office Address:', leftX, y);
  doc.text('Line11, Shop 1, Owode Onirin, Ikorodu road, Lagos.', leftX + 70, y);
  y += 15;
  
  // Telephone
  doc.text('Telephone:', leftX, y);
  doc.text('08033281397, 08052944592, 08062514308', leftX + 70, y);
  y += 15;
  
  // Email
  doc.text('E-mail:', leftX, y);
  doc.text('ganiolaiya123@gmail.com', leftX + 70, y);
  y += 20;
  
  // Company line
  doc.text(`Company: ${receipt.companyInfo?.name || 'Africa Steel Ltd'}`, leftX, y);
  y += 25;
  
  // Divider line
  doc.moveTo(leftX, y).lineTo(leftX + fullWidth, y).stroke();
  y += 15;
  
  // ============ CUSTOMER INFO SECTION ============
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('TO', leftX, y);
  doc.text('ADDRESS', leftX + 150, y);
  doc.text('TEL:', leftX + 300, y);
  doc.text('VEHICLE NO.', leftX + 400, y);
  y += 18;
  
  doc.fontSize(10).font('Helvetica');
  doc.text(receipt.customerName || '', leftX, y);
  doc.text(receipt.customerAddress || '', leftX + 150, y);
  doc.text(receipt.customerPhone || '', leftX + 300, y);
  doc.text(receipt.vehicle || '', leftX + 400, y);
  y += 25;
  
  // ============ TABLE HEADERS ============
  // Draw table header background
  doc.rect(leftX, y, fullWidth, 22).fill('#f0f0f0');
  doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold');
  
  const col1 = leftX + 5;
  const col2 = leftX + 130;
  const col3 = leftX + 180;
  const col4 = leftX + 230;
  const col5 = leftX + 285;
  const col6 = leftX + 340;
  const col7 = leftX + 420;
  
  doc.text('ITEMS DETAILS', col1, y + 7);
  doc.text('DUST', col2, y + 7);
  doc.text('QTY', col3, y + 7);
  doc.text('I-RATE', col4, y + 7);
  doc.text('F-RATE', col5, y + 7);
  doc.text('I-AMOUNT #', col6, y + 7);
  doc.text('F-AMOUNT #', col7, y + 7);
  y += 22;
  
  // ============ TABLE ROWS ============
  let totalInitialAmount = 0;
  let totalFinalAmount = 0;
  const profits = [];
  
  receipt.credits.forEach((item, idx) => {
    const initialAmount = item.qty * (item.initialRate || item.rate);
    const finalAmount = (item.qty * item.rate) - (item.dust || 0);
    const profit = finalAmount - initialAmount;
    
    totalInitialAmount += initialAmount;
    totalFinalAmount += finalAmount;
    if (profit > 0) profits.push({ name: item.description, profit });
    
    // Alternate row background
    if (idx % 2 === 1) {
      doc.rect(leftX, y, fullWidth, 20).fill('#fafafa');
    }
    
    doc.fillColor('#000000').fontSize(9).font('Helvetica');
    doc.text(item.description, col1, y + 5);
    doc.text(`${item.dust || 0}KG`, col2, y + 5);
    doc.text(item.qty.toString(), col3, y + 5);
    doc.text((item.initialRate || item.rate).toString(), col4, y + 5);
    doc.text(item.rate.toString(), col5, y + 5);
    doc.text(formatNumber(initialAmount), col6, y + 5);
    doc.text(formatNumber(finalAmount), col7, y + 5);
    
    y += 20;
  });
  
  y += 5;
  
  // ============ DESCRIPTIONS SECTION ============
  doc.fontSize(9).font('Helvetica-Bold');
  doc.text('Descriptions', leftX, y);
  y += 18;
  
  if (receipt.less.length > 0) {
    doc.font('Helvetica');
    receipt.less.forEach((item) => {
      doc.text(`${item.description}`, leftX, y);
      doc.text(formatCurrency(item.amount), rightX, y);
      y += 15;
    });
  }
  
  doc.text('Debt', leftX, y);
  y += 20;
  
  // ============ PROFIT SECTION (Company Only) ============
  if (profits.length > 0) {
    doc.fontSize(9).font('Helvetica');
    profits.forEach(p => {
      doc.text(`${p.name} Profit: ${formatCurrency(p.profit)}`, leftX, y);
      y += 15;
    });
    const totalProfit = profits.reduce((sum, p) => sum + p.profit, 0);
    doc.text(`Profit: ${formatCurrency(totalProfit)}`, leftX, y);
    y += 20;
  }
  
  // ============ TOTALS SECTION ============
  doc.text(`Credit: ${formatCurrency(totalFinalAmount)}`, leftX, y);
  y += 15;
  doc.text(`Debit: ${formatCurrency(receipt.debitTotal)}`, leftX, y);
  y += 15;
  doc.text(`Balance: ${formatCurrency(receipt.balance)}`, leftX, y);
  y += 30;
  
  // ============ FOOTER ============
  doc.fontSize(9).font('Helvetica');
  doc.text('Thank you for doing business with us.', leftX, y, { align: 'center', width: fullWidth });
  
  doc.end();
};

// CUSTOMER COPY PDF - Exactly like second image
const getReceiptPdfCustomer = async (receipt, res) => {
  const doc = new PDFDocument({ size: 'A4', margin: 50, layout: 'portrait' });
  doc.pipe(res);

  let y = 50;
  const leftX = 50;
  const rightX = 350;
  const fullWidth = 515;

  // ============ HEADER SECTION ============
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#000000');
  doc.text('GANI ELEKE ENT', leftX, y, { align: 'center', width: fullWidth });
  y += 25;
  
  doc.fontSize(9).font('Helvetica').fillColor('#333333');
  doc.text('Office Address:', leftX, y);
  doc.text('Line11, Shop 1, Owode Onirin, Ikorodu road, Lagos.', leftX + 70, y);
  y += 15;
  
  doc.text('Telephone:', leftX, y);
  doc.text('08033281397, 08052944592, 08062514308', leftX + 70, y);
  y += 15;
  
  doc.text('E-mail:', leftX, y);
  doc.text('ganiolaiya123@gmail.com', leftX + 70, y);
  y += 20;
  
  doc.text(`Company: ${receipt.companyInfo?.name || 'Africa Steel Ltd'}`, leftX, y);
  y += 25;
  
  doc.moveTo(leftX, y).lineTo(leftX + fullWidth, y).stroke();
  y += 15;
  
  // ============ CUSTOMER INFO SECTION ============
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('TO', leftX, y);
  doc.text('ADDRESS', leftX + 150, y);
  doc.text('TEL:', leftX + 300, y);
  doc.text('VEHICLE NO.', leftX + 400, y);
  y += 18;
  
  doc.fontSize(10).font('Helvetica');
  doc.text(receipt.customerName || '', leftX, y);
  doc.text(receipt.customerAddress || '', leftX + 150, y);
  doc.text(receipt.customerPhone || '', leftX + 300, y);
  doc.text(receipt.vehicle || '', leftX + 400, y);
  y += 25;
  
  // ============ TABLE HEADERS (Customer - Simpler) ============
  doc.rect(leftX, y, fullWidth, 22).fill('#f0f0f0');
  doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold');
  
  const col1 = leftX + 5;
  const col2 = leftX + 130;
  const col3 = leftX + 180;
  const col4 = leftX + 230;
  const col5 = leftX + 340;
  
  doc.text('ITEMS DETAILS', col1, y + 7);
  doc.text('DUST', col2, y + 7);
  doc.text('QTY', col3, y + 7);
  doc.text('RATE', col4, y + 7);
  doc.text('AMOUNT ₦', col5, y + 7);
  y += 22;
  
  // ============ TABLE ROWS ============
  let totalAmount = 0;
  
  receipt.credits.forEach((item, idx) => {
    const amount = (item.qty * item.rate) - (item.dust || 0);
    totalAmount += amount;
    
    if (idx % 2 === 1) {
      doc.rect(leftX, y, fullWidth, 20).fill('#fafafa');
    }
    
    doc.fillColor('#000000').fontSize(9).font('Helvetica');
    doc.text(item.description, col1, y + 5);
    doc.text(`${item.dust || 0}KG`, col2, y + 5);
    doc.text(item.qty.toString(), col3, y + 5);
    doc.text(item.rate.toString(), col4, y + 5);
    doc.text(formatNumber(amount), col5, y + 5);
    
    y += 20;
  });
  
  y += 5;
  
  // ============ DESCRIPTIONS SECTION ============
  doc.fontSize(9).font('Helvetica-Bold');
  doc.text('Descriptions', leftX, y);
  doc.text('Amount ₦', rightX, y);
  y += 18;
  
  if (receipt.less.length > 0) {
    doc.font('Helvetica');
    receipt.less.forEach((item) => {
      doc.text(item.description, leftX, y);
      doc.text(formatNumber(item.amount), rightX, y);
      y += 15;
    });
  }
  
  doc.text('Debt', leftX, y);
  y += 20;
  
  // ============ TOTALS SECTION ============
  doc.text(`Credit: ${formatCurrency(totalAmount)}`, leftX, y);
  y += 15;
  doc.text(`Debit: ${formatCurrency(receipt.debitTotal)}`, leftX, y);
  y += 15;
  doc.text(`Balance: ${formatCurrency(receipt.balance)}`, leftX, y);
  y += 30;
  
  // ============ FOOTER ============
  doc.fontSize(9).font('Helvetica');
  doc.text('Thank you for doing business with us.', leftX, y, { align: 'center', width: fullWidth });
  
  doc.end();
};

// Main PDF handler
const getReceiptPdf = async (req, res) => {
  const receipt = await Receipt.findById(req.params.id);
  if (!receipt) {
    return res.status(404).json({ message: 'Receipt not found.' });
  }

  const { type } = req.query;
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${receipt.receiptNumber}-${type || 'receipt'}.pdf"`);

  if (type === 'customer') {
    await getReceiptPdfCustomer(receipt, res);
  } else {
    await getReceiptPdfCompany(receipt, res);
  }
};

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