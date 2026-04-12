const Receipt = require('../models/Receipt');
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const pdf = require('html-pdf-node');

/* =========================
   HELPER FUNCTIONS
========================= */

const formatCurrency = (amount) => {
  return `NGN${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatNumber = (num) => {
  return num.toLocaleString('en-US');
};

// Read and compile HTML templates
const customerTemplatePath = path.join(__dirname, '../receipt-templates/customer-receipt.html');
const companyTemplatePath = path.join(__dirname, '../receipt-templates/company-receipt.html');

// Check if templates exist, if not create them
if (!fs.existsSync(path.join(__dirname, '../receipt-templates'))) {
  fs.mkdirSync(path.join(__dirname, '../receipt-templates'), { recursive: true });
}

// Customer Template
const customerTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gani Eleke Receipt</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; margin: 0; padding: 20px; }
        @media print {
            body { margin: 0; padding: 0; }
            .no-break { page-break-inside: avoid; }
        }
    </style>
</head>
<body>

    <div class="max-w-[800px] mx-auto bg-white shadow-lg p-10 relative overflow-hidden no-break" style="border: 1px solid #e5e7eb;">
        <div class="flex h-2 mb-8">
            <div class="w-1/2 bg-red-600"></div>
            <div class="w-2/3 bg-blue-900"></div>
        </div>
        
        <div class="flex justify-between items-start mb-6">
            <div class="w-1/2">
                <div class="flex items-center gap-3">
                    <div class="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 bg-gray-200">
                        <img src="{{logoUrl}}" alt="Logo" class="w-full h-full object-cover" onerror="this.style.display='none'">
                    </div>
                    <div>
                        <p class="text-xs font-bold text-gray-600">RC:2197931</p>
                        <h1 class="text-3xl font-extrabold text-blue-900 leading-none">GANI ELEKE</h1>
                        <p class="text-lg tracking-[0.2em] text-gray-500 font-light">ENTERPRISES</p>
                    </div>
                </div>
                <p class="text-[10px] text-red-600 font-bold mt-2 leading-tight">
                    Dealers and Suppliers of all kind of:<br>
                    <span class="text-black">Electric Motor, Pumping Machine,<br>Gear Motor and scrap etc.</span>
                </p>
            </div>

            <div class="w-1/3 text-left">
                <h2 class="text-4xl font-bold text-gray-800 mb-2">RECEIPT</h2>
                <div class="text-[10px] space-y-1">
                    <p><span class="text-red-600 font-bold">Office Address:</span><br>Line11, Shop 1, Owode Onirin, Ikorodu road, Lagos.</p>
                    <p><span class="text-red-600 font-bold">Telephone:</span><br>08033281397, 08052944592, 08062514308</p>
                    <p><span class="text-red-600 font-bold">E-mail:</span><br>ganiolaiya123@gmail.com</p>
                </div>
                
                <div class="flex justify-end gap-1 mt-3">
                    <div class="flex items-center border border-blue-900"><span class="bg-blue-900 text-white text-[10px] px-1 py-1">DD</span><span class="w-8 px-1 text-center">{{day}}</span></div>
                    <div class="flex items-center border border-blue-900"><span class="bg-blue-900 text-white text-[10px] px-1 py-1">MM</span><span class="w-8 px-1 text-center">{{month}}</span></div>
                    <div class="flex items-center border border-blue-900"><span class="bg-blue-900 text-white text-[10px] px-1 py-1">YY</span><span class="w-12 px-1 text-center">{{year}}</span></div>
                </div>
            </div>
        </div>

        <div class="mb-4">
            <p class="text-sm font-bold text-gray-700">Company: <span class="text-lg">{{companyName}}</span></p>
        </div>

        <div class="space-y-2 mb-6">
            <div class="flex border border-blue-900">
                <span class="bg-blue-900 text-white px-3 py-1 font-bold w-24">TO</span>
                <div class="flex-1 px-2">{{customerName}}</div>
            </div>
            <div class="flex border border-blue-900">
                <span class="bg-blue-900 text-white px-3 py-1 font-bold w-24">ADDRESS</span>
                <div class="flex-1 px-2">{{customerAddress}}</div>
            </div>
            <div class="flex gap-4">
                <div class="flex border border-blue-900 flex-1">
                    <span class="bg-blue-900 text-white px-3 py-1 font-bold">TEL:</span>
                    <div class="flex-1 px-2">{{customerPhone}}</div>
                </div>
                <div class="flex border border-blue-900 flex-1">
                    <span class="bg-blue-900 text-white px-3 py-1 font-bold uppercase">Vehicle No.</span>
                    <div class="flex-1 px-2">{{vehicleNo}}</div>
                </div>
            </div>
        </div>

        <table class="w-full text-left mb-6" style="border-collapse: collapse;">
            <thead>
                <tr class="bg-blue-900 text-white text-xs uppercase">
                    <th class="py-2 px-4 border-r border-white/20" style="border-right: 1px solid rgba(255,255,255,0.2);">Items Details</th>
                    <th class="py-2 px-4 border-r border-white/20" style="border-right: 1px solid rgba(255,255,255,0.2);">Dust</th>
                    <th class="py-2 px-4 border-r border-white/20 text-center" style="border-right: 1px solid rgba(255,255,255,0.2);">Qty</th>
                    <th class="py-2 px-4 border-r border-white/20 text-center" style="border-right: 1px solid rgba(255,255,255,0.2);">Rate</th>
                    <th class="py-2 px-4 text-right">Amount ₦</th>
                </tr>
            </thead>
            <tbody class="text-sm text-gray-700">
                {{#each items}}
                <tr class="{{#if @odd}}bg-gray-200{{else}}bg-gray-50{{/if}}">
                    <td class="py-2 px-4">{{this.description}}</td>
                    <td class="py-2 px-4">{{this.dust}}KG</td>
                    <td class="py-2 px-4 text-center">{{this.qty}}</td>
                    <td class="py-2 px-4 text-center">{{this.rate}}</td>
                    <td class="py-2 px-4 text-right">{{this.amount}}</td>
                </tr>
                {{/each}}
            </tbody>
        </table>

        <table class="w-full text-left mb-8" style="border-collapse: collapse;">
            <thead>
                <tr class="bg-blue-900 text-white text-xs uppercase">
                    <th class="py-2 px-4">Descriptions</th>
                    <th class="py-2 px-4 text-right">Amount ₦</th>
                </tr>
            </thead>
            <tbody class="text-sm text-gray-700">
                <tr class="bg-gray-50">
                    <td class="py-2 px-4">Offloading</td>
                    <td class="py-2 px-4 text-right">{{offloadingAmount}}</td>
                </tr>
                <tr class="bg-gray-200">
                    <td class="py-2 px-4">Debt</td>
                    <td class="py-2 px-4 text-right">{{debtAmount}}</td>
                </tr>
            </tbody>
        </table>

        <div class="flex justify-end mb-12">
            <div class="text-right">
                <p class="text-sm">Credit: <span class="font-bold">{{creditAmount}}</span></p>
                <p class="text-sm">Debit: <span class="font-bold">{{debitAmount}}</span></p>
                <div class="Total Balance">
                    <p class="text-xl font-black text-blue-900">Balance: {{balanceAmount}}</p>
                    <div class="mt-1 border-t-4 border-red-600 pt-1"></div>
                </div>
            </div>
        </div>

        <div class="mt-20">
            <p class="italic text-gray-800 font-bold text-sm">Thank you for doing business with us.</p>
        </div>

        <div class="absolute bottom-[-90px] right-[-90px] opacity-[0.1] pointer-events-none">
            <img src="{{logoUrl}}" alt="Watermark" class="w-[500px] h-[500px] object-contain" onerror="this.style.display='none'">
        </div>
    </div>

</body>
</html>`;

// Company Template
const companyTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gani Eleke Receipt</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; margin: 0; padding: 20px; }
        @media print {
            body { margin: 0; padding: 0; }
            .no-break { page-break-inside: avoid; }
        }
    </style>
</head>
<body>

    <div class="max-w-[800px] mx-auto bg-white shadow-lg p-10 relative overflow-hidden no-break" style="border: 1px solid #e5e7eb;">
        <div class="flex h-2 mb-8">
            <div class="w-1/2 bg-red-600"></div>
            <div class="w-2/3 bg-blue-900"></div>
        </div>
        
        <div class="flex justify-between items-start mb-6">
            <div class="w-1/2">
                <div class="flex items-center gap-3">
                    <div class="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 bg-gray-200">
                        <img src="{{logoUrl}}" alt="Logo" class="w-full h-full object-cover" onerror="this.style.display='none'">
                    </div>
                    <div>
                        <p class="text-xs font-bold text-gray-600">RC:2197931</p>
                        <h1 class="text-3xl font-extrabold text-blue-900 leading-none">GANI ELEKE</h1>
                        <p class="text-lg tracking-[0.2em] text-gray-500 font-light">ENTERPRISES</p>
                    </div>
                </div>
                <p class="text-[10px] text-red-600 font-bold mt-2 leading-tight">
                    Dealers and Suppliers of all kind of:<br>
                    <span class="text-black">Electric Motor, Pumping Machine,<br>Gear Motor and scrap etc.</span>
                </p>
            </div>

            <div class="w-1/3 text-left">
                <h2 class="text-4xl font-bold text-gray-800 mb-2">RECEIPT</h2>
                <div class="text-[10px] space-y-1">
                    <p><span class="text-red-600 font-bold">Office Address:</span><br>Line11, Shop 1, Owode Onirin, Ikorodu road, Lagos.</p>
                    <p><span class="text-red-600 font-bold">Telephone:</span><br>08033281397, 08052944592, 08062514308</p>
                    <p><span class="text-red-600 font-bold">E-mail:</span><br>ganiolaiya123@gmail.com</p>
                </div>
                
                <div class="flex justify-end gap-1 mt-3">
                    <div class="flex items-center border border-blue-900"><span class="bg-blue-900 text-white text-[10px] px-1 py-1">DD</span><span class="w-8 px-1 text-center">{{day}}</span></div>
                    <div class="flex items-center border border-blue-900"><span class="bg-blue-900 text-white text-[10px] px-1 py-1">MM</span><span class="w-8 px-1 text-center">{{month}}</span></div>
                    <div class="flex items-center border border-blue-900"><span class="bg-blue-900 text-white text-[10px] px-1 py-1">YY</span><span class="w-12 px-1 text-center">{{year}}</span></div>
                </div>
            </div>
        </div>

        <div class="mb-4">
            <p class="text-sm font-bold text-gray-700">Company: <span class="text-lg">{{companyName}}</span></p>
        </div>

        <div class="space-y-2 mb-6">
            <div class="flex border border-blue-900">
                <span class="bg-blue-900 text-white px-3 py-1 font-bold w-24">TO</span>
                <div class="flex-1 px-2">{{customerName}}</div>
            </div>
            <div class="flex border border-blue-900">
                <span class="bg-blue-900 text-white px-3 py-1 font-bold w-24">ADDRESS</span>
                <div class="flex-1 px-2">{{customerAddress}}</div>
            </div>
            <div class="flex gap-4">
                <div class="flex border border-blue-900 flex-1">
                    <span class="bg-blue-900 text-white px-3 py-1 font-bold">TEL:</span>
                    <div class="flex-1 px-2">{{customerPhone}}</div>
                </div>
                <div class="flex border border-blue-900 flex-1">
                    <span class="bg-blue-900 text-white px-3 py-1 font-bold uppercase">Vehicle No.</span>
                    <div class="flex-1 px-2">{{vehicleNo}}</div>
                </div>
            </div>
        </div>

        <table class="w-full text-left mb-6" style="border-collapse: collapse;">
            <thead>
                <tr class="bg-blue-900 text-white text-xs uppercase">
                    <th class="py-2 px-4 border-r border-white/20" style="border-right: 1px solid rgba(255,255,255,0.2);">Items Details</th>
                    <th class="py-2 px-4 border-r border-white/20" style="border-right: 1px solid rgba(255,255,255,0.2);">Dust</th>
                    <th class="py-2 px-4 border-r border-white/20 text-center" style="border-right: 1px solid rgba(255,255,255,0.2);">Qty</th>
                    <th class="py-2 px-4 border-r border-white/20 text-center" style="border-right: 1px solid rgba(255,255,255,0.2);">I-Rate</th>
                    <th class="py-2 px-4 border-r border-white/20 text-center" style="border-right: 1px solid rgba(255,255,255,0.2);">F-Rate</th>
                    <th class="py-2 px-4 text-right">I-Amount ₦</th>
                    <th class="py-2 px-4 text-right">F-Amount ₦</th>
                </tr>
            </thead>
            <tbody class="text-sm text-gray-700">
                {{#each items}}
                <tr class="{{#if @odd}}bg-gray-200{{else}}bg-gray-50{{/if}}">
                    <td class="py-2 px-4">{{this.description}}</td>
                    <td class="py-2 px-4">{{this.dust}}KG</td>
                    <td class="py-2 px-4 text-center">{{this.qty}}</td>
                    <td class="py-2 px-4 text-center">{{this.iRate}}</td>
                    <td class="py-2 px-4 text-center">{{this.fRate}}</td>
                    <td class="py-2 px-4 text-right">{{this.iAmount}}</td>
                    <td class="py-2 px-4 text-right">{{this.fAmount}}</td>
                </tr>
                {{/each}}
            </tbody>
        </table>

        <table class="w-full text-left mb-8" style="border-collapse: collapse;">
            <thead>
                <tr class="bg-blue-900 text-white text-xs uppercase">
                    <th class="py-2 px-4">Descriptions</th>
                    <th class="py-2 px-4 text-right">Amount ₦</th>
                </tr>
            </thead>
            <tbody class="text-sm text-gray-700">
                <tr class="bg-gray-50">
                    <td class="py-2 px-4">Offloading</td>
                    <td class="py-2 px-4 text-right">{{offloadingAmount}}</td>
                </tr>
                <tr class="bg-gray-200">
                    <td class="py-2 px-4">Debt</td>
                    <td class="py-2 px-4 text-right">{{debtAmount}}</td>
                </tr>
            </tbody>
        </table>

        <div class="flex justify-between items-start mb-6">
            <div class="text-left">
                {{#each profits}}
                <p class="text-sm">Profit {{this.name}}: <span class="font-bold">{{this.amount}}</span></p>
                {{/each}}
            </div>
            <div class="text-right">
                <p class="text-sm">Profit: <span class="font-bold">{{totalProfit}}</span></p>
                <p class="text-sm">Credit: <span class="font-bold">{{creditAmount}}</span></p>
                <p class="text-sm">Debit: <span class="font-bold">{{debitAmount}}</span></p>
                <div class="Total Balance">
                    <p class="text-xl font-black text-blue-900">Balance: {{balanceAmount}}</p>
                    <div class="mt-1 border-t-4 border-red-600 pt-1"></div>
                </div>
            </div>
        </div>

        <div class="mt-20">
            <p class="italic text-gray-800 font-bold text-sm">Thank you for doing business with us.</p>
        </div>

        <div class="absolute bottom-[-90px] right-[-90px] opacity-[0.1] pointer-events-none">
            <img src="{{logoUrl}}" alt="Watermark" class="w-[500px] h-[500px] object-contain" onerror="this.style.display='none'">
        </div>
    </div>

</body>
</html>`;

// Save templates to files
fs.writeFileSync(customerTemplatePath, customerTemplate);
fs.writeFileSync(companyTemplatePath, companyTemplate);

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
  const options = { format: 'A4', printBackground: true };
  const file = { content: htmlContent };
  const pdfBuffer = await pdf.generatePdf(file, options);
  return pdfBuffer;
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
  const debtAmount = receipt.less.find(l => l.description === 'Debt Deduction')?.amount || 0;
  const debitTotal = receipt.debitTotal || 0;
  const balance = receipt.balance || 0;
  
  const logoUrl = 'https://gani-eleke-project.vercel.app/frontend/img/image.jpg';
  
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
    debtAmount: formatNumber(debtAmount),
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
  const debtAmount = receipt.less.find(l => l.description === 'Debt Deduction')?.amount || 0;
  const debitTotal = receipt.debitTotal || 0;
  const balance = receipt.balance || 0;
  
  const logoUrl = 'https://gani-eleke-project.vercel.app/frontend/img/image.jpg';
  
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
    debtAmount: formatNumber(debtAmount),
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