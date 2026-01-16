import { db } from './server/db';
import { nas } from './drizzle/schema';

async function main() {
  const allNas = await db.select().from(nas);
  console.log('=== All NAS in database ===');
  console.log(JSON.stringify(allNas, null, 2));
  process.exit(0);
}
main();
