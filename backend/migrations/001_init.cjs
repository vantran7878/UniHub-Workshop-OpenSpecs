/* eslint-disable */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createExtension("pgcrypto", { ifNotExists: true });

  pgm.createTable("users", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    email: { type: "varchar(255)", notNull: true, unique: true },
    password_hash: { type: "varchar(255)" },
    role: { type: "varchar(20)", notNull: true },
    student_id: { type: "varchar(50)", unique: true },
    full_name: { type: "varchar(255)", notNull: true },
    fcm_token: { type: "varchar(512)" },
    is_active: { type: "boolean", notNull: true, default: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
  });

  pgm.addConstraint("users", "users_role_check", {
    check: "role in ('student','admin','staff')"
  });

  pgm.createTable("workshops", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    title: { type: "varchar(255)", notNull: true },
    description: { type: "text" },
    speaker: { type: "varchar(255)" },
    room: { type: "varchar(255)" },
    capacity: { type: "integer", notNull: true },
    confirmed_count: { type: "integer", notNull: true, default: 0 },
    is_paid: { type: "boolean", notNull: true, default: false },
    price: { type: "numeric(12,2)", notNull: true, default: 0 },
    status: { type: "varchar(20)", notNull: true, default: "active" },
    registration_open_at: { type: "timestamptz", notNull: true },
    registration_close_at: { type: "timestamptz", notNull: true },
    start_time: { type: "timestamptz", notNull: true },
    end_time: { type: "timestamptz", notNull: true },
    created_by: { type: "uuid", references: "users", onDelete: "set null" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
  });

  pgm.addConstraint("workshops", "workshops_status_check", {
    check: "status in ('active','cancelled','completed')"
  });

  pgm.createIndex("workshops", ["status"]);
  pgm.createIndex("workshops", ["registration_open_at"]);
  pgm.createIndex("workshops", ["registration_close_at"]);
  pgm.createIndex("workshops", ["start_time"]);

  pgm.createTable("registrations", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    user_id: { type: "uuid", notNull: true, references: "users", onDelete: "cascade" },
    workshop_id: { type: "uuid", notNull: true, references: "workshops", onDelete: "cascade" },
    status: { type: "varchar(20)", notNull: true },
    qr_code: { type: "uuid", unique: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
  });
  pgm.addConstraint("registrations", "registrations_status_check", {
    check: "status in ('pending','confirmed','cancelled','attended','failed')"
  });
  pgm.addConstraint("registrations", "registrations_user_workshop_unique", {
    unique: ["user_id", "workshop_id"]
  });
  pgm.createIndex("registrations", ["workshop_id", "status"]);

  pgm.createTable("payments", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    user_id: { type: "uuid", notNull: true, references: "users", onDelete: "cascade" },
    workshop_id: { type: "uuid", notNull: true, references: "workshops", onDelete: "cascade" },
    registration_id: { type: "uuid", notNull: true, references: "registrations", onDelete: "cascade" },
    idempotency_key: { type: "varchar(200)", notNull: true },
    amount: { type: "numeric(12,2)", notNull: true },
    status: { type: "varchar(20)", notNull: true },
    transaction_id: { type: "varchar(255)" },
    gateway_response: { type: "jsonb" },
    attempted_at: { type: "timestamptz" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
  });
  pgm.addConstraint("payments", "payments_status_check", {
    check: "status in ('processing','success','failed','pending')"
  });
  pgm.addConstraint("payments", "payments_idempotency_unique", {
    unique: ["idempotency_key"]
  });
  pgm.createIndex("payments", ["status"]);
  pgm.createIndex("payments", ["registration_id"]);

  pgm.createTable("audit_logs", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    actor_id: { type: "uuid", references: "users", onDelete: "set null" },
    action: { type: "varchar(50)", notNull: true },
    resource_type: { type: "varchar(50)", notNull: true },
    resource_id: { type: "uuid", notNull: true },
    old_values: { type: "jsonb" },
    new_values: { type: "jsonb" },
    ip_address: { type: "varchar(64)" },
    user_agent: { type: "text" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
  });
  pgm.createIndex("audit_logs", ["resource_type", "resource_id"]);

  pgm.createTable("checkins", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    registration_id: { type: "uuid", notNull: true, references: "registrations", onDelete: "cascade", unique: true },
    user_id: { type: "uuid", notNull: true, references: "users", onDelete: "cascade" },
    workshop_id: { type: "uuid", notNull: true, references: "workshops", onDelete: "cascade" },
    checkin_time: { type: "timestamptz", notNull: true },
    device_id: { type: "varchar(255)" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
  });
  pgm.createIndex("checkins", ["workshop_id"]);

  pgm.createTable("notification_logs", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    event_id: { type: "uuid", notNull: true },
    event_type: { type: "varchar(100)", notNull: true },
    user_id: { type: "uuid", references: "users", onDelete: "set null" },
    channel: { type: "varchar(50)", notNull: true },
    status: { type: "varchar(20)", notNull: true },
    reason: { type: "text" },
    payload: { type: "jsonb" },
    retry_count: { type: "integer", notNull: true, default: 0 },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    sent_at: { type: "timestamptz" }
  });
  pgm.createIndex("notification_logs", ["event_id"]);
  pgm.createIndex("notification_logs", ["user_id"]);

  pgm.createTable("student_import_logs", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    file_hash: { type: "varchar(64)", notNull: true },
    total_rows: { type: "integer", notNull: true, default: 0 },
    inserted: { type: "integer", notNull: true, default: 0 },
    updated: { type: "integer", notNull: true, default: 0 },
    skipped: { type: "integer", notNull: true, default: 0 },
    errors: { type: "integer", notNull: true, default: 0 },
    status: { type: "varchar(50)", notNull: true },
    error_details: { type: "jsonb" },
    imported_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
  });
  pgm.addConstraint("student_import_logs", "student_import_logs_file_hash_unique", {
    unique: ["file_hash"]
  });

  pgm.createTable("workshop_summaries", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    workshop_id: { type: "uuid", notNull: true, references: "workshops", onDelete: "cascade", unique: true },
    status: { type: "varchar(20)", notNull: true, default: "pending" },
    pdf_file_path: { type: "text" },
    summary: { type: "text" },
    ai_model_used: { type: "varchar(100)" },
    error_message: { type: "text" },
    processing_started_at: { type: "timestamptz" },
    completed_at: { type: "timestamptz" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
  });
  pgm.addConstraint("workshop_summaries", "workshop_summaries_status_check", {
    check: "status in ('pending','processing','done','failed')"
  });
};

exports.down = (pgm) => {
  pgm.dropTable("workshop_summaries");
  pgm.dropTable("student_import_logs");
  pgm.dropTable("notification_logs");
  pgm.dropTable("checkins");
  pgm.dropTable("audit_logs");
  pgm.dropTable("payments");
  pgm.dropTable("registrations");
  pgm.dropTable("workshops");
  pgm.dropTable("users");
};

