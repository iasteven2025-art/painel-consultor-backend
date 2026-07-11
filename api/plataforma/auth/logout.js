const { clearPlatformSessionCookie } = require('../../../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Método não permitido.' } });
    return;
  }
  clearPlatformSessionCookie(res);
  res.status(200).json({ ok: true });
};
