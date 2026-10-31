process.env.NAKAMA_LOCAL_DB = "1";
import { getDb } from "../src/db/client";
import { closeLocalDatabase } from "../src/db/local-client";
import { ensureLocalSupervisor,seedCategories } from "../src/db/seed";

async function main(){const db=await getDb();await seedCategories(db);await ensureLocalSupervisor(db);console.log("Base local lista. Supervisor: "+(process.env.DEV_USER_EMAIL||"supervisor@nakama.local"));}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(closeLocalDatabase);
