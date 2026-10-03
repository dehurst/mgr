import "./env";
import { databasePath, openDb } from "../db";

const file = databasePath();
const db = openDb(file);
db.$client.close();
console.log(`Database ready: ${file}`);
