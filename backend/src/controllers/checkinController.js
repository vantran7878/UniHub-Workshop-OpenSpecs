const db = require('../config/db');

/**
 * Preload confirmed registrations for a workshop to support offline scan.
 */
async function preload(req, res) {
  const { workshop_id } = req.query;

  if (!workshop_id) {
    return res.status(400).json({ code: 'MISSING_WORKSHOP_ID' });
  }

  try {
    const result = await db.query(
      `SELECT 
        r.qr_code, 
        u.fullName as studentName, 
        u.id as studentId
      FROM registrations r
      JOIN users u ON u.id = r.user_id
      WHERE r.workshop_id = $1 AND r.status = 'confirmed'`,
      [workshop_id]
    );

    res.json({
      workshopId: workshop_id,
      preloadedAt: new Date().toISOString(),
      records: result.rows
    });
  } catch (err) {
    console.error('Preload error:', err);
    res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
}

/**
 * Process a real-time online check-in.
 */
async function processCheckin(req, res) {
  const { qr_code, workshop_id, device_id } = req.body;

  if (!qr_code || !workshop_id) {
    return res.status(400).json({ code: 'INVALID_REQUEST' });
  }

  try {
    // 1. Lookup registration and workshop details
    const regResult = await db.query(
      `SELECT r.id, r.status, u.fullName
       FROM registrations r
       JOIN users u ON u.id = r.user_id
       WHERE r.qr_code = $1 AND r.workshop_id = $2`,
      [qr_code, workshop_id]
    );

    const registration = regResult.rows[0];
    if (!registration) {
      return res.status(404).json({ code: 'QR_NOT_FOUND' });
    }

    if (registration.status !== 'confirmed') {
      return res.status(400).json({ 
        code: 'REGISTRATION_NOT_CONFIRMED', 
        currentStatus: registration.status 
      });
    }

    // 2. Check for duplicate
    const checkinCheck = await db.query(
      'SELECT checkin_time FROM checkins WHERE registration_id = $1',
      [registration.id]
    );

    if (checkinCheck.rows.length > 0) {
      return res.status(409).json({ 
        code: 'ALREADY_CHECKED_IN', 
        checkedInAt: checkinCheck.rows[0].checkin_time 
      });
    }

    // 3. Transactional update
    // Note: In a real app, we'd use a transaction helper or pool.connect()
    // For this demonstration, we'll use a simple sequential flow or a BEGIN block
    await db.query('BEGIN');
    
    await db.query(
      `INSERT INTO checkins (registration_id, user_id, workshop_id, checkin_time, device_id)
       SELECT id, user_id, workshop_id, NOW(), $2
       FROM registrations WHERE id = $1`,
      [registration.id, device_id]
    );

    await db.query(
      "UPDATE registrations SET status = 'attended' WHERE id = $1",
      [registration.id]
    );

    await db.query('COMMIT');

    res.json({
      status: 'success',
      studentName: registration.fullName,
      checkedInAt: new Date().toISOString()
    });
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    console.error('Check-in error:', err);
    res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
}

/**
 * Sync offline check-in records in batches.
 */
async function syncOffline(req, res) {
  const { records } = req.body;

  if (!records || !Array.isArray(records)) {
    return res.status(400).json({ code: 'INVALID_RECORDS' });
  }

  const summary = {
    processed: records.length,
    success: 0,
    conflicts: [],
    errors: 0
  };

  try {
    for (const record of records) {
      const { qr_code, workshop_id, checked_in_at, device_id, localId } = record;

      try {
        // 1. Lookup registration
        const regResult = await db.query(
          'SELECT id FROM registrations WHERE qr_code = $1 AND workshop_id = $2',
          [qr_code, workshop_id]
        );

        const registration = regResult.rows[0];
        if (!registration) {
          summary.conflicts.push({ localId, reason: 'QR_NOT_FOUND' });
          continue;
        }

        // 2. Idempotent Insert
        // ON CONFLICT DO NOTHING handles records already synced or online check-ins
        const insertResult = await db.query(
          `INSERT INTO checkins (registration_id, user_id, workshop_id, checkin_time, device_id)
           SELECT id, user_id, workshop_id, $2, $3
           FROM registrations WHERE id = $1
           ON CONFLICT (registration_id) DO NOTHING
           RETURNING id`,
          [registration.id, checked_in_at, device_id]
        );

        if (insertResult.rows.length === 0) {
          // If no row was inserted, it's either already there or registration_id didn't match (not possible here)
          summary.conflicts.push({ localId, reason: 'ALREADY_SYNCED_OR_CHECKED_IN' });
        } else {
          // 3. Update registration status
          await db.query(
            "UPDATE registrations SET status = 'attended' WHERE id = $1",
            [registration.id]
          );
          summary.success++;
        }
      } catch (innerErr) {
        console.error(`Sync error for localId ${localId}:`, innerErr);
        summary.errors++;
      }
    }

    res.json(summary);
  } catch (err) {
    console.error('Batch sync error:', err);
    res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
}

module.exports = {
  preload,
  processCheckin,
  syncOffline
};
