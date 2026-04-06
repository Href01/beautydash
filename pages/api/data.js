export default async function handler(req, res) {
  const URL = process.env.APPS_SCRIPT_URL;
  if (!URL) return res.status(500).json({ error: 'APPS_SCRIPT_URL not set' });
  try {
    const response = await fetch(URL, { redirect: 'follow' });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error });
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.status(200).json(data);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
}