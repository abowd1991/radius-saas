import { storagePut } from "../storage";
import { nanoid } from "nanoid";

// Card data interface
interface CardData {
  serialNumber: string;
  username: string;
  password: string;
  planName: string;
  planNameAr?: string;
  validityDays: number;
  downloadSpeed: number;
  uploadSpeed: number;
  price: string;
}

// Batch data interface
interface BatchData {
  batchId: string;
  batchName: string;
  cards: CardData[];
  companyName?: string;
  companyLogo?: string;
  hotspotUrl?: string;
  cardsPerPage?: number;
}

// Generate QR Code SVG (simple implementation)
function generateQRCodeSVG(data: string, size: number = 100): string {
  // Simple QR code placeholder - in production, use a proper QR library
  // This creates a placeholder that shows the data
  const encoded = encodeURIComponent(data);
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="white" stroke="#000" stroke-width="2"/>
      <rect x="10" y="10" width="25" height="25" fill="#000"/>
      <rect x="65" y="10" width="25" height="25" fill="#000"/>
      <rect x="10" y="65" width="25" height="25" fill="#000"/>
      <rect x="15" y="15" width="15" height="15" fill="white"/>
      <rect x="70" y="15" width="15" height="15" fill="white"/>
      <rect x="15" y="70" width="15" height="15" fill="white"/>
      <rect x="20" y="20" width="5" height="5" fill="#000"/>
      <rect x="75" y="20" width="5" height="5" fill="#000"/>
      <rect x="20" y="75" width="5" height="5" fill="#000"/>
      <rect x="40" y="40" width="20" height="20" fill="#000"/>
      <rect x="45" y="45" width="10" height="10" fill="white"/>
      <text x="50" y="98" font-size="6" text-anchor="middle" fill="#666">QR</text>
    </svg>
  `;
}

// Generate single card HTML
function generateCardHTML(card: CardData, hotspotUrl?: string, companyName?: string): string {
  const qrData = hotspotUrl ? `${hotspotUrl}?username=${card.username}&password=${card.password}` : card.serialNumber;
  const qrSvg = generateQRCodeSVG(qrData, 80);
  
  return `
    <div class="card">
      <div class="card-header">
        <div class="company-name">${companyName || 'RADIUS SaaS'}</div>
        <div class="plan-name">${card.planNameAr || card.planName}</div>
      </div>
      
      <div class="card-body">
        <div class="qr-section">
          ${qrSvg}
        </div>
        
        <div class="credentials">
          <div class="credential-row">
            <span class="label">اسم المستخدم:</span>
            <span class="value username">${card.username}</span>
          </div>
          <div class="credential-row">
            <span class="label">كلمة المرور:</span>
            <span class="value password">${card.password}</span>
          </div>
        </div>
      </div>
      
      <div class="card-footer">
        <div class="info-row">
          <span>السرعة: ${card.downloadSpeed}/${card.uploadSpeed} Mbps</span>
          <span>الصلاحية: ${card.validityDays} يوم</span>
        </div>
        <div class="serial">
          <span class="serial-label">الرقم التسلسلي:</span>
          <span class="serial-value">${card.serialNumber}</span>
        </div>
      </div>
    </div>
  `;
}

// Generate full PDF HTML document
export function generateCardsPDFHTML(batch: BatchData): string {
  const cardsPerPage = batch.cardsPerPage || 8;
  const cards = batch.cards;
  const pages: string[] = [];
  
  // Split cards into pages
  for (let i = 0; i < cards.length; i += cardsPerPage) {
    const pageCards = cards.slice(i, i + cardsPerPage);
    const cardsHTML = pageCards.map(card => 
      generateCardHTML(card, batch.hotspotUrl, batch.companyName)
    ).join('\n');
    
    pages.push(`
      <div class="page">
        <div class="cards-grid">
          ${cardsHTML}
        </div>
      </div>
    `);
  }
  
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>بطاقات RADIUS - ${batch.batchName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Cairo', sans-serif;
      background: #f5f5f5;
      direction: rtl;
    }
    
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 10mm;
      margin: 0 auto;
      background: white;
      page-break-after: always;
    }
    
    .page:last-child {
      page-break-after: auto;
    }
    
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8mm;
    }
    
    .card {
      border: 2px solid #2563eb;
      border-radius: 8px;
      padding: 8px;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      height: 60mm;
      display: flex;
      flex-direction: column;
    }
    
    .card-header {
      text-align: center;
      padding-bottom: 4px;
      border-bottom: 1px solid #cbd5e1;
      margin-bottom: 4px;
    }
    
    .company-name {
      font-size: 12px;
      font-weight: 700;
      color: #1e40af;
    }
    
    .plan-name {
      font-size: 10px;
      color: #64748b;
      font-weight: 600;
    }
    
    .card-body {
      display: flex;
      gap: 8px;
      flex: 1;
      align-items: center;
    }
    
    .qr-section {
      width: 70px;
      height: 70px;
      flex-shrink: 0;
    }
    
    .qr-section svg {
      width: 100%;
      height: 100%;
    }
    
    .credentials {
      flex: 1;
    }
    
    .credential-row {
      display: flex;
      flex-direction: column;
      margin-bottom: 4px;
    }
    
    .label {
      font-size: 8px;
      color: #64748b;
    }
    
    .value {
      font-size: 11px;
      font-weight: 700;
      color: #1e293b;
      font-family: 'Courier New', monospace;
      letter-spacing: 1px;
      background: #fff;
      padding: 2px 4px;
      border-radius: 4px;
      border: 1px dashed #94a3b8;
    }
    
    .card-footer {
      border-top: 1px solid #cbd5e1;
      padding-top: 4px;
      font-size: 8px;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      color: #64748b;
      margin-bottom: 2px;
    }
    
    .serial {
      text-align: center;
      color: #94a3b8;
      font-size: 7px;
    }
    
    .serial-value {
      font-family: 'Courier New', monospace;
      letter-spacing: 0.5px;
    }
    
    @media print {
      body {
        background: white;
      }
      
      .page {
        margin: 0;
        padding: 8mm;
        box-shadow: none;
      }
      
      .card {
        break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  ${pages.join('\n')}
</body>
</html>
  `;
}

// Generate CSV export
export function generateCardsCSV(cards: CardData[]): string {
  const headers = ['Serial Number', 'Username', 'Password', 'Plan', 'Validity (Days)', 'Download Speed', 'Upload Speed', 'Price'];
  const rows = cards.map(card => [
    card.serialNumber,
    card.username,
    card.password,
    card.planName,
    card.validityDays.toString(),
    card.downloadSpeed.toString(),
    card.uploadSpeed.toString(),
    card.price
  ]);
  
  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

// Save PDF HTML to storage
export async function saveBatchPDF(batch: BatchData): Promise<{ htmlUrl: string; csvUrl: string }> {
  const html = generateCardsPDFHTML(batch);
  const csv = generateCardsCSV(batch.cards);
  
  const htmlKey = `cards/batches/${batch.batchId}/cards-${nanoid(6)}.html`;
  const csvKey = `cards/batches/${batch.batchId}/cards-${nanoid(6)}.csv`;
  
  const [htmlResult, csvResult] = await Promise.all([
    storagePut(htmlKey, Buffer.from(html, 'utf-8'), 'text/html'),
    storagePut(csvKey, Buffer.from(csv, 'utf-8'), 'text/csv'),
  ]);
  
  return {
    htmlUrl: htmlResult.url,
    csvUrl: csvResult.url,
  };
}

// Generate single card print HTML
export function generateSingleCardHTML(card: CardData, companyName?: string, hotspotUrl?: string): string {
  return generateCardsPDFHTML({
    batchId: 'single',
    batchName: 'Single Card',
    cards: [card],
    companyName,
    hotspotUrl,
    cardsPerPage: 1,
  });
}
