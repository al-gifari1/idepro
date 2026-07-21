import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rjegmurqhkglyethgauq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqZWdtdXJxaGtnbHlldGhnYXVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5OTIxMzYsImV4cCI6MjA5OTU2ODEzNn0.6Qf0ZDlU_bSBPCXG_4lvs5rZFBYndjfDJh3_k3K6tYw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSupabase() {
  console.log('--- SUPABASE CONNECTIVITY & STATUS CHECK ---');
  console.log('Supabase Endpoint:', supabaseUrl);

  try {
    // Test auth service health
    const { data: authData, error: authError } = await supabase.auth.getSession();
    if (authError) {
      console.log('❌ Supabase Auth check failed:', authError.message);
    } else {
      console.log('✅ Supabase Auth connection: OK');
    }

    // Try a simple system catalog query to see if connection works
    const { data: dbData, error: dbError } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);

    if (dbError) {
      if (dbError.code === 'PGRST205') {
        console.log('✅ API Connection: OK');
        console.log('⚠️  Database Status: Connected, but tables (profiles) have not been created yet.');
        console.log('💡 Tip: Run your migration scripts (supabase/schema.sql) in your Supabase SQL Editor.');
      } else {
        console.log('❌ Database query failed:', dbError.message);
      }
    } else {
      console.log('✅ Database Connection & Tables: OK');
      console.log('📝 Profiles table is ready and accessible.');
    }
  } catch (e) {
    console.error('❌ Connectivity test exception:', e.message);
  }
  console.log('--------------------------------------------');
}

checkSupabase();
