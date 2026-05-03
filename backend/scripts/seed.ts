import "dotenv/config";
import bcrypt from "bcryptjs";
import { getPool } from "../src/db/pool.js";

async function main() {
  const pool = getPool();

  const adminEmail = "admin@unihub.local";
  const staffEmail = "staff@unihub.local";
  const password = "ChangeMe123!";

  const passwordHash = await bcrypt.hash(password, 10);

  await pool.query(
    `
    insert into users (email, password_hash, role, full_name, is_active)
    values ($1, $2, 'admin', 'Admin', true)
    on conflict (email) do update
      set password_hash = excluded.password_hash,
          role = excluded.role,
          full_name = excluded.full_name,
          is_active = true,
          updated_at = now()
    `,
    [adminEmail, passwordHash]
  );

  await pool.query(
    `
    insert into users (email, password_hash, role, full_name, is_active)
    values ($1, $2, 'staff', 'Staff', true)
    on conflict (email) do update
      set password_hash = excluded.password_hash,
          role = excluded.role,
          full_name = excluded.full_name,
          is_active = true,
          updated_at = now()
    `,
    [staffEmail, passwordHash]
  );

  console.log("Seeded users:");
  console.log(`- admin: ${adminEmail} / ${password}`);
  console.log(`- staff: ${staffEmail} / ${password}`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

