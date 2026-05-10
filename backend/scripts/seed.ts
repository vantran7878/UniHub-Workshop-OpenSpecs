import "dotenv/config";
import bcrypt from "bcryptjs";
import { getPool } from "../src/db/pool.js";

async function main() {
  const pool = getPool();

  const adminEmail = "admin@unihub.local";
  const staffEmail = "staff@unihub.local";
  const studentEmail = "student1@unihub.local";
  const password = "ChangeMe123!";

  const passwordHash = await bcrypt.hash(password, 10);

  const users = [
    { email: adminEmail, role: 'admin', name: 'Admin' },
    { email: staffEmail, role: 'staff', name: 'Staff' },
    { email: studentEmail, role: 'student', name: 'Student' }
  ];

  for (const user of users) {
    await pool.query(
      `
      insert into users (email, password_hash, role, full_name, is_active)
      values ($1, $2, $3, $4, true)
      on conflict (email) do update
        set password_hash = excluded.password_hash,
            role = excluded.role,
            full_name = excluded.full_name,
            is_active = true,
            updated_at = now()
      `,
      [user.email, passwordHash, user.role, user.name]
    );
  }

  console.log("Seeded users:");
  users.forEach(u => console.log(`- ${u.role}: ${u.email} / ${password}`));

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
