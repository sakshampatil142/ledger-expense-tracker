// api/audit.js
// Vercel serverless function — runs on Vercel's servers, never in the browser.
// The Dify API key lives only here, read from an environment variable.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const DIFY_ENDPOINT = process.env.DIFY_ENDPOINT || 'https://api.dify.ai/v1/workflows/run';
  const DIFY_API_KEY = process.env.DIFY_API_KEY;

  if (!DIFY_API_KEY) {
    // No key configured on the server -> tell the frontend to fall back locally.
    return res.status(200).json({ fallback: true, reason: 'no_server_key' });
  }

  try {
    const { ledger } = req.body || {};

    const difyRes = await fetch(DIFY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DIFY_API_KEY}`,
      },
      body: JSON.stringify({
        inputs: { input_text: JSON.stringify(ledger) },
        response_mode: 'blocking',
        user: 'ledger-app-user',
      }),
      signal: AbortSignal.timeout(15000), // 15s timeout so a slow agent can't hang the request
    });

    if (!difyRes.ok) {
      return res.status(200).json({ fallback: true, reason: 'upstream_error' });
    }

    const data = await difyRes.json();
    // Dify workflow output shape: data.data.outputs.summary
    const summary =
      data?.data?.outputs?.summary ??
      data?.outputs?.summary ??
      null;

    if (!summary) {
      return res.status(200).json({ fallback: true, reason: 'no_summary_field' });
    }

    return res.status(200).json({ fallback: false, summary });
  } catch (err) {
    return res.status(200).json({ fallback: true, reason: 'exception' });
  }
}
