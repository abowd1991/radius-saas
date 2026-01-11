import { db } from './server/db.ts';
import { nas } from './drizzle/schema.ts';
import { desc } from 'drizzle-orm';

async function main() {
  const allNas = await db.select().from(nas).orderBy(desc(nas.createdAt)).limit(5);
  console.log('Latest NAS devices:');
  allNas.forEach(n => {
    console.log('---');
    console.log('Name:', n.name);
    console.log('NAS IP:', n.nasIp);
    console.log('Secret:', n.secret);
    console.log('Connection Type:', n.connectionType);
    console.log('VPN Username:', n.vpnUsername);
  });
  process.exit(0);
}

main();
