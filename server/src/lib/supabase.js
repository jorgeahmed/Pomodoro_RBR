import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default supabase;

// Helper: save OAuth token for a user+tool
export async function saveConnection(userId, tool, accessToken, extra = {}) {
    const { error } = await supabase.from('connections').upsert({
        user_id: userId,
        tool,
        access_token: accessToken,
        extra: extra,           // jsonb — pass object directly, not JSON.stringify
        connected_at: new Date().toISOString(),
    }, { onConflict: 'user_id,tool' });
    if (error) {
        console.error('[supabase] saveConnection error:', error);
        throw error;
    }
}

// Helper: get token for a user+tool
export async function getConnection(userId, tool) {
    const { data, error } = await supabase
        .from('connections')
        .select('*')
        .eq('user_id', userId)
        .eq('tool', tool)
        .single();
    if (error) return null;
    return data;
}

// Helper: get all subscriber emails
export async function getSubscribers() {
    const { data } = await supabase
        .from('subscribers')
        .select('email, name')
        .eq('active', true);
    return data || [];
}
