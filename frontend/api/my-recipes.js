import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('user_id', process.env.WILSON_USER_ID)
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch recipes' });
  }

  return res.status(200).json(data);
}