const Receipt = require('../models/Receipt');
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const puppeteer = require('puppeteer-core');

const formatCurrency = (amount) => {
  return `NGN${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatNumber = (num) => {
  return num.toLocaleString('en-US');
};

// Dynamic logo URL function
const getLogoUrl = () => {
    if (process.env.RENDER) {
        return 'https://gani-eleke-project.vercel.app/frontend/img/image.jpg';
    }
    return 'file:///' + path.join(__dirname, '../public/img/image.jpg').replace(/\\/g, '/');
};

// Read HTML templates
const customerTemplatePath = path.join(__dirname, '../receipt-templates/customer-receipt.html');
const companyTemplatePath = path.join(__dirname, '../receipt-templates/company-receipt.html');

if (!fs.existsSync(customerTemplatePath)) {
  console.error('Customer template not found at:', customerTemplatePath);
}
if (!fs.existsSync(companyTemplatePath)) {
  console.error('Company template not found at:', companyTemplatePath);
}

const customerTemplate = fs.readFileSync(customerTemplatePath, 'utf8');
const companyTemplate = fs.readFileSync(companyTemplatePath, 'utf8');

const compiledCustomerTemplate = handlebars.compile(customerTemplate);
const compiledCompanyTemplate = handlebars.compile(companyTemplate);

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
   GENERATE PDF FROM HTML
========================= */

const generatePDFFromHTML = async (htmlContent) => {
  let executablePath;
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.CHROME_PATH
  ];
  
  for (const path of possiblePaths) {
    if (path && fs.existsSync(path)) {
      executablePath = path;
      break;
    }
  }
  
  const browser = await puppeteer.launch({
    executablePath: executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();
  return pdf;
};

/* =========================
   COMPANY COPY PDF
========================= */

const getReceiptPdfCompany = async (receipt, res) => {
  const date = new Date(receipt.date || Date.now());
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString().slice(-2);
  
  let totalCredit = 0;
  let totalProfit = 0;
  const profits = [];
  
  const items = receipt.credits.map((item, index) => {
    const iAmount = item.qty * (item.initialRate || item.rate);
    const fAmount = (item.qty * item.rate) - (item.dust || 0);
    const profit = fAmount - iAmount;
    totalCredit += fAmount;
    totalProfit += profit;
    if (profit !== 0) {
      profits.push({ name: item.description, amount: formatCurrency(profit) });
    }
    return {
      description: item.description,
      dust: item.dust || 0,
      qty: item.qty,
      iRate: item.initialRate || item.rate,
      fRate: item.rate,
      iAmount: formatNumber(iAmount),
      fAmount: formatNumber(fAmount),
      odd: index % 2 === 1
    };
  });
  
  const offloadingAmount = receipt.less.find(l => l.description === 'Offloading')?.amount || 0;
  const debitTotal = receipt.debitTotal || 0;
  const balance = receipt.balance || 0;
  
  const logoUrl = getLogoUrl();
  
  const html = compiledCompanyTemplate({
    logoUrl,
    day,
    month,
    year,
    companyName: receipt.companyInfo?.name || 'Africa Steel Ltd',
    customerName: receipt.customerName || '',
    customerAddress: receipt.customerAddress || '',
    customerPhone: receipt.customerPhone || '',
    vehicleNo: receipt.vehicle || '',
    items,
    offloadingAmount: formatNumber(offloadingAmount),
    debtAmount: '',  // Empty - won't show amount
    profits,
    totalProfit: formatCurrency(totalProfit),
    creditAmount: formatCurrency(totalCredit),
    debitAmount: formatCurrency(debitTotal),
    balanceAmount: formatCurrency(balance)
  });
  
  const pdf = await generatePDFFromHTML(html);
  res.end(pdf);
};

/* =========================
   CUSTOMER COPY PDF
========================= */

const getReceiptPdfCustomer = async (receipt, res) => {
  const date = new Date(receipt.date || Date.now());
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString().slice(-2);
  
  let totalCredit = 0;
  
  const items = receipt.credits.map((item, index) => {
    const amount = (item.qty * item.rate) - (item.dust || 0);
    totalCredit += amount;
    return {
      description: item.description,
      dust: item.dust || 0,
      qty: item.qty,
      rate: item.rate,
      amount: formatNumber(amount),
      odd: index % 2 === 1
    };
  });
  
  const offloadingAmount = receipt.less.find(l => l.description === 'Offloading')?.amount || 0;
  const debitTotal = receipt.debitTotal || 0;
  const balance = receipt.balance || 0;
  
  const logoUrl = getLogoUrl();
  
  const html = compiledCustomerTemplate({
    logoUrl,
    day,
    month,
    year,
    companyName: receipt.companyInfo?.name || 'Africa Steel Ltd',
    customerName: receipt.customerName || '',
    customerAddress: receipt.customerAddress || '',
    customerPhone: receipt.customerPhone || '',
    vehicleNo: receipt.vehicle || '',
    items,
    offloadingAmount: formatNumber(offloadingAmount),
    debtAmount: '',  // Empty - won't show amount
    creditAmount: formatCurrency(totalCredit),
    debitAmount: formatCurrency(debitTotal),
    balanceAmount: formatCurrency(balance)
  });
  
  const pdf = await generatePDFFromHTML(html);
  res.end(pdf);
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