const db = require('../config/db');

exports.updateFCMToken = async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token is required' });

  try {
    await db.query('UPDATE users SET fcm_token = $1, updated_at = NOW() WHERE id = $2', [token, req.user.id]);
    res.status(200).json({ message: 'FCM token updated' });
  } catch (err) {
    console.error('Error updating FCM token:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deleteFCMToken = async (req, res) => {
  try {
    await db.query('UPDATE users SET fcm_token = NULL, updated_at = NOW() WHERE id = $1', [req.user.id]);
    res.status(200).json({ message: 'FCM token deleted' });
  } catch (err) {
    console.error('Error deleting FCM token:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
