import { storagePut } from "../storage";
import { nanoid } from "nanoid";
import QRCode from "qrcode";
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);
const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);
const unlinkAsync = promisify(fs.unlink);

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
  usernameFontFamily: string;
  usernameFontColor: string;
  usernameAlign: "left" | "center" | "right";
  // Password settings
  passwordX: number;
  passwordY: number;
  passwordFontSize: number;
  passwordFontFamily: string;
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
  columns: number;
  cardsPerPage: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  spacingH: number;
  spacingV: number;
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
  Arial: "Arial, 'Segoe UI', sans-serif",
  Tahoma: "Tahoma, 'Segoe UI', sans-serif",
  "Courier New": "'Courier New', 'Consolas', monospace",
  Verdana: "Verdana, Geneva, sans-serif",
  Georgia: "Georgia, 'Times New Roman', serif",
  Impact: "Impact, 'Arial Black', sans-serif",
};

function getFontFamilyCSS(fontFamily: string): string {
  if (FONT_FAMILY_MAP[fontFamily]) {
    return FONT_FAMILY_MAP[fontFamily];
  }
  return `'${fontFamily}', Arial, sans-serif`;
}

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

// PDF Cache
const pdfCache = new Map<string, { url: string; key: string; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function generateCacheKey(batch: BatchDataWithTemplate): string {
  const keyData = {
    batchId: batch.batchId,
    templateUrl: batch.template?.imageUrl,
    usernameX: batch.template?.usernameX,
    usernameY: batch.template?.usernameY,
    passwordX: batch.template?.passwordX,
    passwordY: batch.template?.passwordY,
    qrEnabled: batch.template?.qrCodeEnabled,
    columns: batch.printSettings?.columns,
    cardsPerPage: batch.printSettings?.cardsPerPage,
  };
  return JSON.stringify(keyData);
}

// Generate QR Code as data URL
async function generateQRCodeDataURL(data: string, size: number = 100): Promise<string> {
  try {
    return await QRCode.toDataURL(data, {
      width: size,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    });
  } catch (error) {
    console.error("QR Code generation error:", error);
    return `data:image/svg+xml,${encodeURIComponent(`<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="white" stroke="#000" stroke-width="2"/><text x="50" y="55" font-size="12" text-anchor="middle" fill="#666">QR</text></svg>`)}`;
  }
}

// Calculate card dimensions
function calculateCardDimensions(settings: PrintSettings): { cardWidth: number; cardHeight: number; rows: number } {
  const availableWidth = A4_WIDTH_MM - settings.marginLeft - settings.marginRight;
  const availableHeight = A4_HEIGHT_MM - settings.marginTop - settings.marginBottom;
  const totalHSpacing = (settings.columns - 1) * settings.spacingH;
  const cardWidth = (availableWidth - totalHSpacing) / settings.columns;
  const rows = Math.ceil(settings.cardsPerPage / settings.columns);
  const totalVSpacing = (rows - 1) * settings.spacingV;
  const cardHeight = (availableHeight - totalVSpacing) / rows;
  return { cardWidth, cardHeight, rows };
}

// Generate single card HTML with template
async function generateTemplateCardHTML(
  card: CardData,
  template: TemplateSettings,
  cardWidth: number,
  cardHeight: number,
  qrDataUrl?: string
): Promise<string> {
  const usernameFontFamily = getFontFamilyCSS(template.usernameFontFamily);
  const passwordFontFamily = getFontFamilyCSS(template.passwordFontFamily);
  const scaledUsernameFontSize = Math.max(8, template.usernameFontSize);
  const scaledPasswordFontSize = Math.max(8, template.passwordFontSize);
  const qrSizePercent = (template.qrCodeSize / 400) * 100;
  const scaledQrSize = (qrSizePercent / 100) * cardWidth;

  const getAlignTransform = (align: string) => {
    switch (align) {
      case 'left': return 'translate(0, -50%)';
      case 'right': return 'translate(-100%, -50%)';
      default: return 'translate(-50%, -50%)';
    }
  };

  return `
    <div class="card" style="width:${cardWidth}mm;height:${cardHeight}mm;position:relative;background-image:url('${template.imageUrl}');background-size:100% 100%;background-position:center;overflow:hidden;box-sizing:border-box;">
      <div style="position:absolute;left:${template.usernameX}%;top:${template.usernameY}%;transform:${getAlignTransform(template.usernameAlign)};font-size:${scaledUsernameFontSize}pt;font-family:${usernameFontFamily};color:${template.usernameFontColor};text-align:${template.usernameAlign};white-space:nowrap;">${card.username}</div>
      <div style="position:absolute;left:${template.passwordX}%;top:${template.passwordY}%;transform:${getAlignTransform(template.passwordAlign)};font-size:${scaledPasswordFontSize}pt;font-family:${passwordFontFamily};color:${template.passwordFontColor};text-align:${template.passwordAlign};white-space:nowrap;">${card.password}</div>
      ${template.qrCodeEnabled && qrDataUrl ? `<img src="${qrDataUrl}" style="position:absolute;left:${template.qrCodeX}%;top:${template.qrCodeY}%;transform:translate(-50%,-50%);width:${scaledQrSize}mm;height:${scaledQrSize}mm;" />` : ""}
    </div>
  `;
}

// Generate single card HTML (legacy)
function generateCardHTML(card: CardData, cardWidth: number, cardHeight: number, hotspotUrl?: string, companyName?: string): string {
  const baseFontSize = Math.min(cardWidth, cardHeight) * 0.08;
  const smallFontSize = baseFontSize * 0.7;
  
  return `
    <div class="card" style="width:${cardWidth}mm;height:${cardHeight}mm;border:0.3mm solid #ddd;border-radius:1mm;padding:1mm;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;background:linear-gradient(135deg,#f8f9fa 0%,#e9ecef 100%);overflow:hidden;">
      <div style="text-align:center;border-bottom:0.2mm solid #dee2e6;padding-bottom:0.5mm;">
        <div style="font-size:${baseFontSize}pt;font-weight:bold;color:#1a5f7a;">${companyName || 'RADIUS'}</div>
        <div style="font-size:${smallFontSize}pt;color:#666;">${card.planNameAr || card.planName}</div>
      </div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center;">
        <div style="text-align:center;">
          <div style="font-size:${smallFontSize}pt;color:#666;">اسم المستخدم</div>
          <div style="font-size:${baseFontSize}pt;font-weight:bold;color:#333;">${card.username}</div>
          <div style="font-size:${smallFontSize}pt;color:#666;margin-top:1mm;">كلمة المرور</div>
          <div style="font-size:${baseFontSize}pt;font-weight:bold;color:#c0392b;">${card.password}</div>
        </div>
      </div>
      <div style="text-align:center;font-size:${smallFontSize * 0.8}pt;color:#888;">صلاحية الكرت ${card.validityDays} ساعة</div>
    </div>
  `;
}

// Generate PDF HTML with template
export async function generateCardsPDFHTMLWithTemplate(batch: BatchDataWithTemplate): Promise<string> {
  const printSettings = batch.printSettings || DEFAULT_PRINT_SETTINGS;
  const { cardWidth, cardHeight, rows } = calculateCardDimensions(printSettings);
  const template = batch.template;
  
  // Generate QR codes if enabled
  let qrUrls: string[] = [];
  if (template?.qrCodeEnabled && template?.qrCodeDomain) {
    const qrPromises = batch.cards.map(card => {
      const loginUrl = `${template.qrCodeDomain}?username=${card.username}&password=${card.password}`;
      return generateQRCodeDataURL(loginUrl, template.qrCodeSize * 2);
    });
    qrUrls = await Promise.all(qrPromises);
  }
  
  // Split cards into pages
  const cardsPerPage = printSettings.cardsPerPage;
  const pages: string[] = [];
  
  for (let i = 0; i < batch.cards.length; i += cardsPerPage) {
    const pageCards = batch.cards.slice(i, i + cardsPerPage);
    const pageQrUrls = qrUrls.slice(i, i + cardsPerPage);
    
    const cardHtmlPromises = pageCards.map(async (card, idx) => {
      if (template) {
        return generateTemplateCardHTML(card, template, cardWidth, cardHeight, pageQrUrls[idx]);
      } else {
        return generateCardHTML(card, cardWidth, cardHeight, batch.hotspotUrl, batch.companyName);
      }
    });
    
    const cardHtmls = await Promise.all(cardHtmlPromises);
    
    pages.push(`
      <div class="page">
        <div class="cards-grid">
          ${cardHtmls.join('')}
        </div>
      </div>
    `);
  }

  const digitalFontCSS = `@font-face{font-family:'DSEG7 Classic';src:url('https://cdn.jsdelivr.net/npm/dseg@0.46.0/fonts/DSEG7-Classic/DSEG7Classic-Regular.woff2') format('woff2');}`;

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>بطاقات RADIUS - ${batch.batchName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
    ${digitalFontCSS}
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Cairo',sans-serif;background:#f5f5f5;direction:rtl;}
    .page{width:${A4_WIDTH_MM}mm;height:${A4_HEIGHT_MM}mm;margin:0 auto;background:white;page-break-after:always;overflow:hidden;position:relative;}
    .page:last-child{page-break-after:auto;}
    .cards-grid{display:grid;grid-template-columns:repeat(${printSettings.columns},${cardWidth}mm);grid-template-rows:repeat(${rows},${cardHeight}mm);gap:${printSettings.spacingV}mm ${printSettings.spacingH}mm;padding:${printSettings.marginTop}mm ${printSettings.marginRight}mm ${printSettings.marginBottom}mm ${printSettings.marginLeft}mm;justify-content:center;align-content:start;}
    .card{break-inside:avoid;print-color-adjust:exact;-webkit-print-color-adjust:exact;}
    @media print{body{background:white;-webkit-print-color-adjust:exact;print-color-adjust:exact;}.page{margin:0;box-shadow:none;page-break-after:always;}.page:last-child{page-break-after:auto;}@page{size:A4;margin:0;}}
    @media screen{.page{box-shadow:0 0 10px rgba(0,0,0,0.1);margin:10mm auto;}}
  </style>
</head>
<body>
  ${pages.join('\n')}
</body>
</html>`;
}

// Legacy function
export async function generateCardsPDFHTML(batch: BatchData): Promise<string> {
  return generateCardsPDFHTMLWithTemplate({ ...batch, printSettings: DEFAULT_PRINT_SETTINGS });
}

// Generate and save real PDF using wkhtmltopdf
export async function saveBatchPDFWithTemplate(batch: BatchDataWithTemplate, retryCount = 0): Promise<{ pdfUrl: string; pdfKey: string }> {
  // Check cache
  const cacheKey = generateCacheKey(batch);
  const cached = pdfCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('[PDF] Cache hit, returning cached PDF');
    return { pdfUrl: cached.url, pdfKey: cached.key };
  }
  
  const html = await generateCardsPDFHTMLWithTemplate(batch);
  const tempDir = os.tmpdir();
  const htmlFile = path.join(tempDir, `cards-${batch.batchId}-${nanoid(6)}.html`);
  const pdfFile = path.join(tempDir, `cards-${batch.batchId}-${nanoid(6)}.pdf`);
  
  try {
    console.log('[PDF] Starting PDF generation with wkhtmltopdf...');
    
    await writeFileAsync(htmlFile, html, 'utf8');
    
    const cmd = `wkhtmltopdf --encoding UTF-8 --page-size A4 --margin-top 0 --margin-bottom 0 --margin-left 0 --margin-right 0 --enable-local-file-access --print-media-type --no-stop-slow-scripts --javascript-delay 500 "${htmlFile}" "${pdfFile}"`;
    
    await execAsync(cmd, { timeout: 60000 });
    
    const pdfBuffer = await readFileAsync(pdfFile);
    
    const fileName = `cards-${batch.batchId}-${nanoid(6)}.pdf`;
    const fileKey = `pdf/${fileName}`;
    const { url } = await storagePut(fileKey, pdfBuffer, 'application/pdf');
    
    console.log('[PDF] Real PDF generated and saved:', url);
    
    pdfCache.set(cacheKey, { url, key: fileKey, timestamp: Date.now() });
    
    try {
      await unlinkAsync(htmlFile);
      await unlinkAsync(pdfFile);
    } catch (e) { /* ignore */ }
    
    return { pdfUrl: url, pdfKey: fileKey };
  } catch (error) {
    console.error('[PDF] wkhtmltopdf error:', error);
    
    try {
      await unlinkAsync(htmlFile).catch(() => {});
      await unlinkAsync(pdfFile).catch(() => {});
    } catch (e) { /* ignore */ }
    
    if (retryCount < 1) {
      console.log('[PDF] Retrying PDF generation...');
      return saveBatchPDFWithTemplate(batch, retryCount + 1);
    }
    
    console.log('[PDF] Falling back to HTML after retry failed');
    const htmlFileName = `cards-${batch.batchId}-${nanoid(6)}.html`;
    const htmlFileKey = `pdf/${htmlFileName}`;
    const { url: htmlUrl } = await storagePut(htmlFileKey, html, 'text/html');
    return { pdfUrl: htmlUrl, pdfKey: htmlFileKey };
  }
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
