/**
 * userProfile routes
 * ------------------
 * CRUD + search endpoints for user survey / profile data.
 * Mounted at base path /userprofile (see src/app.js).
 */
const express = require('express');
const router  = express.Router();
const UserData = require('../models/UserProfile');

// (1) CREATE
router.post('/', async (req, res) => {
  try {
    const newUser = new UserData(req.body);
    await newUser.save();
    return res.status(201).json({ message: '✅ Data saved successfully' });
  } catch (err) {
    console.error('❌ Error saving data:', err);
    if (err.code === 11000 && err.keyPattern?.idName)
      return res.status(409).json({ error: 'Duplicate key: idName already exists' });
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// (2) READ-ALL
router.get('/', async (_req, res) => {
  try { res.json(await UserData.find({})); }
  catch (e) { console.error(e); res.status(500).json({ error: 'Failed to fetch surveys' }); }
});

// (3) SEARCH
router.get('/search', async (req, res) => {
  try {
    const q = req.query.q;
    if (!q?.trim()) return res.status(400).json({ error: "Query parameter 'q' is required" });
    const regex = new RegExp(q, 'i');
    res.json(await UserData.find({ $or: [{ idName: regex }, { email: regex }] }));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to search surveys' });
  }
});

// (4) EXISTS (FAST)
router.get('/exists', async (req, res) => {
  const { email, withCount } = req.query;
  if (!email) return res.status(400).json({ error: 'Email query parameter is required' });
  try {
    const exists = await UserData.exists({ email });
    if (!withCount) {
      return exists ? res.status(204).end() : res.status(404).end();
    }
    const count = exists ? await UserData.countDocuments({ email }) : 0;
    return res.status(exists ? 200 : 404).json({ exists: !!exists, count });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// (5) READ-ONE
router.get('/:idName', async (req, res) => {
  const { idName } = req.params;
  if (!idName) return res.status(400).json({ error: 'idName parameter is required' });
  try {
    const user = await UserData.findOne({ idName });
    return user ? res.json(user) : res.status(404).json({ error: 'User profile not found' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// (6) UPDATE
router.put('/:idName', async (req, res) => {
  const { idName } = req.params;
  const { newIdName, newEmail } = req.body;
  if (!idName) return res.status(400).json({ error: 'idName parameter is required' });
  try {
    const user = await UserData.findOne({ idName });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const upd = {};
    if (newIdName) upd.idName = newIdName;
    if (newEmail)  upd.email  = newEmail;
    if (!Object.keys(upd).length) return res.status(400).json({ error: 'No update data provided' });

    if (newIdName && newIdName !== idName) {
      if (await UserData.findOne({ idName: newIdName }))
        return res.status(409).json({ error: 'Username already taken' });
    }

    const updated = await UserData.findOneAndUpdate({ idName }, upd, { new: true });
    return res.json({ message: '✅ User profile updated successfully', user: updated });
  } catch (e) {
    console.error(e);
    if (e.code === 11000 && e.keyPattern?.idName)
      return res.status(409).json({ error: 'Username already taken' });
    res.status(500).json({ error: 'Failed to update user profile' });
  }
});

// (7) DELETE
router.delete('/:idName', async (req, res) => {
  const { idName } = req.params;
  if (!idName) return res.status(400).json({ error: 'idName parameter is required' });
  try {
    const del = await UserData.findOneAndDelete({ idName });
    return del ? res.json({ message: '✅ User profile deleted successfully' })
               : res.status(404).json({ error: 'User not found' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete user profile' });
  }
});

module.exports = router; 