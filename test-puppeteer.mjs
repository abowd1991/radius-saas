import puppeteer from 'puppeteer';

async function test() {
  console.log('Testing Puppeteer...');
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
    console.log('Browser launched successfully');
    
    const page = await browser.newPage();
    await page.setContent('<html><body><h1>Test</h1></body></html>');
    
    const pdf = await page.pdf({ format: 'A4' });
    console.log('PDF generated, size:', pdf.length, 'bytes');
    
    await browser.close();
    console.log('Test passed!');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
