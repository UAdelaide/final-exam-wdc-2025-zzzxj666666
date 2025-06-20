const express = require('express');
const router = express.Router();
const db = require('../models/db');

// Load the dogs of current user
router.get('/mine', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  const owner_id = req.session.user.user_id;

  try {
    const [dogs] = await db.query(
      'SELECT dog_id, name FROM dogs WHERE owner_id = ?',
      [owner_id]
    );
    res.json(dogs); // Back to the dogs list
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch dogs' });
  }
});

module.exports = router;