// api/audit.js
// Vercel serverless function — runs on Vercel's servers, never in the browser.
// The Dify API key lives only here, read from an environment variable.
// NOTE: uses CommonJS (module.exports), not ES module (export default),
// because this repo has no package.json declaring "type": "module".

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const DIFY_ENDPOINT = process.env.DIFY_ENDPOINT || 'https://api.dify.ai/v1/workflows/run';
  const DIFY_API_KEY = process.env.DIFY_API_KEY;

  if (!DIFY_API_KEY) {
    // No key configured on the server -> tell the frontend to fall back locally.
    console.log('AUDIT_FALLBACK reason=no_server_key');
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
      const bodyText = await difyRes.text();
      console.log('AUDIT_FALLBACK reason=upstream_error status=' + difyRes.status + ' body=' + bodyText.slice(0, 500));
      return res.status(200).json({ fallback: true, reason: 'upstream_error' });
    }

    const data = await difyRes.json();
    // Dify workflow output shape: data.data.outputs.summary
    const summary =
      (data && data.data && data.data.outputs && data.data.outputs.summary) ??
      (data && data.outputs && data.outputs.summary) ??
      null;

    if (!summary) {
      console.log('AUDIT_FALLBACK reason=no_summary_field data=' + JSON.stringify(data).slice(0, 500));
      return res.status(200).json({ fallback: true, reason: 'no_summary_field' });
    }

    console.log('AUDIT_SUCCESS');
    return res.status(200).json({ fallback: false, summary });
  } catch (err) {
    console.log('AUDIT_FALLBACK reason=exception message=' + (err && err.message));
    return res.status(200).json({ fallback: true, reason: 'exception' });
  }
};
