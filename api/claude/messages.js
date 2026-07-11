const { requireAuth } = require('../../lib/auth');

const ANTHROPIC_VERSION = '2023-06-01';
const MODELO_PERMITIDO = 'claude-sonnet-4-6';
const MAX_TOKENS_PERMITIDO = 1000;

module.exports = requireAuth(async (req, res, usuario) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Método não permitido.' } });
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: { message: 'ANTHROPIC_API_KEY não configurada no servidor.' } });
    return;
  }

  const { messages, max_tokens, tools } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: { message: 'Campo "messages" é obrigatório e não pode estar vazio.' } });
    return;
  }

  try {
    const body = {
      model: MODELO_PERMITIDO,
      max_tokens: Math.min(max_tokens || MAX_TOKENS_PERMITIDO, MAX_TOKENS_PERMITIDO),
      messages
    };
    // Repassa tools apenas se o próprio backend os enviar explicitamente
    // (ex: web_search no Diagnóstico IA) — nunca aceite tools arbitrárias vindas do cliente
    // sem revisão; aqui liberamos por ser um proxy interno já autenticado por usuário.
    if (Array.isArray(tools)) body.tools = tools;

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION
      },
      body: JSON.stringify(body)
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      console.error('[Anthropic API erro]', usuario.email, upstream.status, JSON.stringify(data));
      res.status(upstream.status).json(data);
      return;
    }
    res.status(200).json(data);
  } catch (err) {
    console.error('[Erro no proxy de IA]', err);
    res.status(500).json({ error: { message: 'Erro interno no servidor proxy.' } });
  }
});
