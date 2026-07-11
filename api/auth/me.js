const { requireAuth } = require('../../lib/auth');

module.exports = requireAuth(async (req, res, usuario) => {
  res.status(200).json({ usuario });
});
