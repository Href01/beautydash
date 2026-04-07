export default async function handler(req, res) {
  try {
    const url = process.env.APPS_SCRIPT_URL;
    if (!url) return res.status(500).json({ error: 'APPS_SCRIPT_URL env var not set' });

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Apps Script returned ${response.status}`);

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error });

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.status(200).json(data);
  } catch (err) {
    console.error('Data API error:', err);
    res.status(500).json({ error: err.message });
  }
}
