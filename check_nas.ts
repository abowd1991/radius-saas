import { getDb } from "./server/db";
import { nasDevices, radcheck } from "./drizzle/schema";

async function main() {
  const db = await getDb();
  
  console.log("=== NAS Devices ===");
  const allNas = await db.select().from(nasDevices);
  console.log(JSON.stringify(allNas, null, 2));
  
  console.log("\n=== RADIUS Users (radcheck) ===");
  const users = await db.select().from(radcheck).limit(10);
  console.log(JSON.stringify(users, null, 2));
  
  process.exit(0);
}

main();
