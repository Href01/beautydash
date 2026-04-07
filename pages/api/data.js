export default async function handler(req, res) {
  try {
    const url = process.env.APPS_SCRIPT_URL;
    if (!url) return res.status(500).json({ error: 'APPS_SCRIPT_URL env var not set' });

    const response = await fetch(url, { redirect: 'follow' });
    const text = await response.text();

    // Detect HTML response (login redirect or deployment error)
    if (text.trimStart().startsWith('<')) {
      console.error('Apps Script returned HTML — likely not deployed as "Anyone" or URL is wrong');
      return res.status(500).json({
        error: 'Apps Script returned HTML instead of JSON. Check: (1) deployment is set to "Anyone" access, (2) APPS_SCRIPT_URL is the /exec URL not /dev, (3) script is deployed.'
      });
    }

    const data = JSON.parse(text);
    if (data.error) return res.status(500).json({ error: `Apps Script error: ${data.error}` });

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.status(200).json(data);
  } catch (err) {
    console.error('Data API error:', err);
    res.status(500).json({ error: err.message });
  }
}
