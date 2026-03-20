import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { role, identifier, phone } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (role === 'parent') {
      // Look up student by admission_no + parent_phone
      const { data: students, error: lookupErr } = await supabase
        .from('students')
        .select('id, full_name, parent_phone, parent_user_id, admission_no')
        .eq('admission_no', identifier)
        .eq('parent_phone', phone);

      if (lookupErr) throw lookupErr;
      if (!students || students.length === 0) {
        return new Response(JSON.stringify({ error: 'Invalid admission number or phone number' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Use deterministic email for this parent phone
      const email = `parent_${phone.replace(/\D/g, '')}@vantrack.local`;
      const password = `vt_${phone.replace(/\D/g, '')}_parent`;

      // Check if auth user exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === email);

      let userId: string;

      if (existingUser) {
        userId = existingUser.id;
      } else {
        // Create auth user
        const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: `Parent (${phone})` },
        });
        if (createErr) throw createErr;
        userId = newUser.user.id;

        // Assign parent role
        await supabase.from('user_roles').insert({ user_id: userId, role: 'parent' });
      }

      // Always link all students with this phone to this parent user
      await supabase
        .from('students')
        .update({ parent_user_id: userId })
        .eq('parent_phone', phone);

      // Sign in and return session
      const { data: session, error: signInErr } = await supabase.auth.signInWithPassword({
        email, password,
      });

      // If password changed by admin, try updating it
      if (signInErr) {
        await supabase.auth.admin.updateUserById(userId, { password });
        const { data: retrySession, error: retryErr } = await supabase.auth.signInWithPassword({
          email, password,
        });
        if (retryErr) throw retryErr;
        return new Response(JSON.stringify(retrySession), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(session), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (role === 'driver') {
      // Look up driver by license_no + phone
      const { data: driver, error: lookupErr } = await supabase
        .from('drivers')
        .select('id, full_name, phone, license_no, user_id')
        .eq('license_no', identifier)
        .eq('phone', phone)
        .maybeSingle();

      if (lookupErr) throw lookupErr;
      if (!driver) {
        return new Response(JSON.stringify({ error: 'Invalid license number or phone number' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const email = `driver_${phone.replace(/\D/g, '')}@vantrack.local`;
      const password = `vt_${phone.replace(/\D/g, '')}_driver`;

      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === email);

      let userId: string;

      if (existingUser) {
        userId = existingUser.id;
      } else {
        const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: driver.full_name },
        });
        if (createErr) throw createErr;
        userId = newUser.user.id;

        // Assign driver role
        await supabase.from('user_roles').insert({ user_id: userId, role: 'driver' });
      }

      // Always link driver record to auth user (in case user_id changed)
      await supabase.from('drivers').update({ user_id: userId }).eq('id', driver.id);

      const { data: session, error: signInErr } = await supabase.auth.signInWithPassword({
        email, password,
      });

      if (signInErr) {
        await supabase.auth.admin.updateUserById(userId, { password });
        const { data: retrySession, error: retryErr } = await supabase.auth.signInWithPassword({
          email, password,
        });
        if (retryErr) throw retryErr;
        return new Response(JSON.stringify(retrySession), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(session), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
      return new Response(JSON.stringify({ error: 'Invalid role' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
