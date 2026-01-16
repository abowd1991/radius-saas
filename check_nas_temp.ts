import { db } from './server/_core/db';
import { nas } from './drizzle/schema';

async function checkNas() {
  const allNas = await db.select().from(nas);
  console.log('=== NAS Devices in Database ===');
  console.log(`Total: ${allNas.length}`);
  console.log('');
  allNas.forEach((n, i) => {
    console.log(`${i+1}. ${n.shortname || n.nasname}`);
    console.log(`   IP: ${n.nasname}`);
    console.log(`   Type: ${n.type}`);
    console.log(`   Status: ${n.status}`);
    console.log(`   VPN IP: ${n.vpnIp || 'N/A'}`);
    console.log('');
  });
}

checkNas().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
