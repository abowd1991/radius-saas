import { storagePut } from "../storage";
import { nanoid } from "nanoid";
import QRCode from "qrcode";

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

// Template settings interface
interface TemplateSettings {
  imageUrl: string;
  cardWidth: number;
  cardHeight: number;
  // Username settings
  usernameX: number;
  usernameY: number;
  usernameFontSize: number;
  usernameFontFamily: "normal" | "clear" | "digital";
  usernameFontColor: string;
  usernameAlign: "left" | "center" | "right";
  // Password settings
  passwordX: number;
  passwordY: number;
  passwordFontSize: number;
  passwordFontFamily: "normal" | "clear" | "digital";
  passwordFontColor: string;
  passwordAlign: "left" | "center" | "right";
  // QR Code settings
  qrCodeEnabled: boolean;
  qrCodeX: number;
  qrCodeY: number;
  qrCodeSize: number;
  qrCodeDomain: string | null;
  // Print settings
  cardsPerPage: number;
  marginTop: string;
  marginHorizontal: string;
  columnsPerPage: number;
}

// Enhanced print settings interface
interface PrintSettings {
  columns: number;           // Number of columns (3-10)
  cardsPerPage: number;      // Total cards per page
  marginTop: number;         // Top margin in mm
  marginBottom: number;      // Bottom margin in mm
  marginLeft: number;        // Left margin in mm
  marginRight: number;       // Right margin in mm
  spacingH: number;          // Horizontal spacing between cards in mm
  spacingV: number;          // Vertical spacing between cards in mm
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

// Batch data with template
interface BatchDataWithTemplate extends BatchData {
  template?: TemplateSettings;
  printSettings?: PrintSettings;
}

// Font family CSS mapping
const FONT_FAMILY_MAP: Record<string, string> = {
  normal: "Arial, 'Segoe UI', sans-serif",
  clear: "'Courier New', 'Consolas', monospace",
  digital: "'DSEG7 Classic', 'Courier New', monospace",
};

// A4 page dimensions in mm
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

// Default print settings
const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  columns: 5,
  cardsPerPage: 50,
  marginTop: 5,
  marginBottom: 5,
  marginLeft: 5,
  marginRight: 5,
  spacingH: 2,
  spacingV: 2,
};

// Generate QR Code as data URL
async function generateQRCodeDataURL(data: string, size: number = 100): Promise<string> {
  try {
    return await QRCode.toDataURL(data, {
      width: size,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });
  } catch (error) {
    console.error("QR Code generation error:", error);
    return `data:image/svg+xml,${encodeURIComponent(`
      <svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" fill="white" stroke="#000" stroke-width="2"/>
        <text x="50" y="55" font-size="12" text-anchor="middle" fill="#666">QR</text>
      </svg>
    `)}`;
  }
}

// Calculate card dimensions to fit A4 page
function calculateCardDimensions(settings: PrintSettings): { cardWidth: number; cardHeight: number; rows: number } {
  const availableWidth = A4_WIDTH_MM - settings.marginLeft - settings.marginRight;
  const availableHeight = A4_HEIGHT_MM - settings.marginTop - settings.marginBottom;
  
  // Calculate card width based on columns and horizontal spacing
  const totalHSpacing = (settings.columns - 1) * settings.spacingH;
  const cardWidth = (availableWidth - totalHSpacing) / settings.columns;
  
  // Calculate rows based on cards per page
  const rows = Math.ceil(settings.cardsPerPage / settings.columns);
  
  // Calculate card height based on rows and vertical spacing
  const totalVSpacing = (rows - 1) * settings.spacingV;
  const cardHeight = (availableHeight - totalVSpacing) / rows;
  
  return { cardWidth, cardHeight, rows };
}

// Generate single card HTML with template (scaled to fit)
async function generateTemplateCardHTML(
  card: CardData,
  template: TemplateSettings,
  cardWidth: number,
  cardHeight: number,
  qrDataUrl?: string
): Promise<string> {
  const usernameFontFamily = FONT_FAMILY_MAP[template.usernameFontFamily] || FONT_FAMILY_MAP.normal;
  const passwordFontFamily = FONT_FAMILY_MAP[template.passwordFontFamily] || FONT_FAMILY_MAP.normal;

  // Calculate scale factor to fit template into card dimensions
  const scaleX = cardWidth / template.cardWidth;
  const scaleY = cardHeight / template.cardHeight;
  const scale = Math.min(scaleX, scaleY);

  // Scale positions and font sizes
  const scaledUsernameX = template.usernameX * scale;
  const scaledUsernameY = template.usernameY * scale;
  const scaledUsernameFontSize = template.usernameFontSize * scale;
  const scaledPasswordX = template.passwordX * scale;
  const scaledPasswordY = template.passwordY * scale;
  const scaledPasswordFontSize = template.passwordFontSize * scale;
  const scaledQrCodeX = template.qrCodeX * scale;
  const scaledQrCodeY = template.qrCodeY * scale;
  const scaledQrCodeSize = template.qrCodeSize * scale;

  return `
    <div class="card" style="
      width: ${cardWidth}mm;
      height: ${cardHeight}mm;
      position: relative;
      background-image: url('${template.imageUrl}');
      background-size: 100% 100%;
      background-position: center;
      overflow: hidden;
      box-sizing: border-box;
    ">
      <!-- Username -->
      <div style="
        position: absolute;
        left: ${scaledUsernameX}mm;
        top: ${scaledUsernameY}mm;
        font-size: ${scaledUsernameFontSize}pt;
        font-family: ${usernameFontFamily};
        color: ${template.usernameFontColor};
        text-align: ${template.usernameAlign};
        white-space: nowrap;
        transform-origin: left top;
      ">${card.username}</div>
      
      <!-- Password -->
      <div style="
        position: absolute;
        left: ${scaledPasswordX}mm;
        top: ${scaledPasswordY}mm;
        font-size: ${scaledPasswordFontSize}pt;
        font-family: ${passwordFontFamily};
        color: ${template.passwordFontColor};
        text-align: ${template.passwordAlign};
        white-space: nowrap;
        transform-origin: left top;
      ">${card.password}</div>
      
      ${template.qrCodeEnabled && qrDataUrl ? `
        <!-- QR Code -->
        <img src="${qrDataUrl}" style="
          position: absolute;
          left: ${scaledQrCodeX}mm;
          top: ${scaledQrCodeY}mm;
          width: ${scaledQrCodeSize}mm;
          height: ${scaledQrCodeSize}mm;
        " />
      ` : ""}
    </div>
  `;
}

// Generate single card HTML (legacy - default design)
function generateCardHTML(
  card: CardData, 
  cardWidth: number, 
  cardHeight: number,
  hotspotUrl?: string, 
  companyName?: string
): string {
  // Calculate font sizes based on card dimensions
  const baseFontSize = Math.min(cardWidth, cardHeight) * 0.08;
  const smallFontSize = baseFontSize * 0.7;
  const qrSize = Math.min(cardWidth, cardHeight) * 0.3;
  
  return `
    <div class="card" style="
      width: ${cardWidth}mm;
      height: ${cardHeight}mm;
      border: 0.3mm solid #ddd;
      border-radius: 1mm;
      padding: 1mm;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      overflow: hidden;
    ">
      <div style="text-align: center; border-bottom: 0.2mm solid #dee2e6; padding-bottom: 0.5mm;">
        <div style="font-size: ${baseFontSize}pt; font-weight: bold; color: #1a5f7a;">${companyName || 'RADIUS'}</div>
        <div style="font-size: ${smallFontSize}pt; color: #666;">${card.planNameAr || card.planName}</div>
      </div>
      
      <div style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 1mm;">
        <div style="text-align: center;">
          <div style="font-size: ${smallFontSize}pt; color: #666;">اسم المستخدم</div>
          <div style="font-size: ${baseFontSize * 1.1}pt; font-weight: bold; color: #0066cc; font-family: 'Courier New', monospace;">${card.username}</div>
          <div style="font-size: ${smallFontSize}pt; color: #666; margin-top: 0.5mm;">كلمة المرور</div>
          <div style="font-size: ${baseFontSize * 1.1}pt; font-weight: bold; color: #cc0000; font-family: 'Courier New', monospace;">${card.password}</div>
        </div>
      </div>
      
      <div style="text-align: center; border-top: 0.2mm solid #dee2e6; padding-top: 0.5mm;">
        <div style="font-size: ${smallFontSize * 0.8}pt; color: #888;">${card.serialNumber}</div>
      </div>
    </div>
  `;
}

// Generate full PDF HTML with template and enhanced print settings
export async function generateCardsPDFHTMLWithTemplate(batch: BatchDataWithTemplate): Promise<string> {
  const template = batch.template;
  const printSettings = batch.printSettings || DEFAULT_PRINT_SETTINGS;
  
  // Calculate card dimensions based on print settings
  const { cardWidth, cardHeight, rows } = calculateCardDimensions(printSettings);
  const cardsPerPage = printSettings.columns * rows;
  const cards = batch.cards;
  const pages: string[] = [];
  
  // Generate QR codes for all cards if template has QR enabled
  const qrDataUrls: string[] = [];
  if (template?.qrCodeEnabled) {
    for (const card of cards) {
      const qrData = template.qrCodeDomain 
        ? `${template.qrCodeDomain}?username=${card.username}&password=${card.password}`
        : card.serialNumber;
      const qrDataUrl = await generateQRCodeDataURL(qrData, template.qrCodeSize);
      qrDataUrls.push(qrDataUrl);
    }
  }

  // Split cards into pages
  for (let i = 0; i < cards.length; i += cardsPerPage) {
    const pageCards = cards.slice(i, i + cardsPerPage);
    const pageQrUrls = qrDataUrls.slice(i, i + cardsPerPage);
    
    let cardsHTML: string[];
    
    if (template) {
      cardsHTML = await Promise.all(
        pageCards.map((card, idx) => 
          generateTemplateCardHTML(card, template, cardWidth, cardHeight, pageQrUrls[idx])
        )
      );
    } else {
      cardsHTML = pageCards.map(card => 
        generateCardHTML(card, cardWidth, cardHeight, batch.hotspotUrl, batch.companyName)
      );
    }
    
    pages.push(`
      <div class="page">
        <div class="cards-grid">
          ${cardsHTML.join('\n')}
        </div>
      </div>
    `);
  }

  // Digital font CSS
  const digitalFontCSS = `
    @font-face {
      font-family: 'DSEG7 Classic';
      src: url('https://cdn.jsdelivr.net/npm/dseg@0.46.0/fonts/DSEG7-Classic/DSEG7Classic-Regular.woff2') format('woff2');
    }
  `;

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>بطاقات RADIUS - ${batch.batchName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
    ${digitalFontCSS}
    
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
      width: ${A4_WIDTH_MM}mm;
      height: ${A4_HEIGHT_MM}mm;
      margin: 0 auto;
      background: white;
      page-break-after: always;
      overflow: hidden;
      position: relative;
    }
    
    .page:last-child {
      page-break-after: auto;
    }
    
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(${printSettings.columns}, ${cardWidth}mm);
      grid-template-rows: repeat(${rows}, ${cardHeight}mm);
      gap: ${printSettings.spacingV}mm ${printSettings.spacingH}mm;
      padding: ${printSettings.marginTop}mm ${printSettings.marginRight}mm ${printSettings.marginBottom}mm ${printSettings.marginLeft}mm;
      justify-content: center;
      align-content: start;
    }
    
    .card {
      break-inside: avoid;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    
    @media print {
      body {
        background: white;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      
      .page {
        margin: 0;
        box-shadow: none;
        page-break-after: always;
      }
      
      .page:last-child {
        page-break-after: auto;
      }
      
      @page {
        size: A4;
        margin: 0;
      }
    }
    
    @media screen {
      .page {
        box-shadow: 0 0 10px rgba(0,0,0,0.1);
        margin: 10mm auto;
      }
    }
  </style>
</head>
<body>
  ${pages.join('\n')}
  
  <script>
    // Auto-print when opened
    // window.onload = function() { window.print(); }
  </script>
</body>
</html>
  `;
}

// Legacy function for backward compatibility
export async function generateCardsPDFHTML(batch: BatchData): Promise<string> {
  return generateCardsPDFHTMLWithTemplate({
    ...batch,
    printSettings: DEFAULT_PRINT_SETTINGS,
  });
}

// Generate and save PDF HTML to S3
export async function saveBatchPDFWithTemplate(batch: BatchDataWithTemplate): Promise<{ pdfUrl: string; pdfKey: string }> {
  const html = await generateCardsPDFHTMLWithTemplate(batch);
  const fileName = `batch-${batch.batchId}-${nanoid(6)}.html`;
  const fileKey = `pdf/${fileName}`;
  
  const { url } = await storagePut(fileKey, html, "text/html");
  
  return { pdfUrl: url, pdfKey: fileKey };
}

// Legacy save function
export async function saveBatchPDF(batch: BatchData): Promise<{ pdfUrl: string; pdfKey: string }> {
  return saveBatchPDFWithTemplate(batch);
}

// Generate CSV content
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
    card.price,
  ]);
  
  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

// Save CSV to S3
export async function saveBatchCSV(batchId: string, cards: CardData[]): Promise<{ csvUrl: string; csvKey: string }> {
  const csv = generateCardsCSV(cards);
  const fileName = `batch-${batchId}-${nanoid(6)}.csv`;
  const fileKey = `csv/${fileName}`;
  
  const { url } = await storagePut(fileKey, csv, "text/csv");
  
  return { csvUrl: url, csvKey: fileKey };
}

export { CardData, TemplateSettings, PrintSettings, BatchData, BatchDataWithTemplate, DEFAULT_PRINT_SETTINGS };
