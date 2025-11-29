import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL as string | undefined
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined

export const supabaseServer = url && serviceKey ? createClient(url, serviceKey) : null
