const { requirePlatformAuth } = require('../../../lib/auth');

module.exports = requirePlatformAuth(async (req, res, admin) => {
  res.status(200).json({ admin });
});
