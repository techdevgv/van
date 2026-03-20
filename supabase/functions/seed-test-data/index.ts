import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const results: string[] = [];

    // 1. Create test users
    const users = [
      { email: "admin@gyanoday.edu", password: "admin123", full_name: "Om Prakash", role: "admin" },
      { email: "driver@gyanoday.edu", password: "driver123", full_name: "Rakesh Kumar", role: "driver" },
      { email: "parent@gyanoday.edu", password: "parent123", full_name: "Aman's Parent", role: "parent" },
    ];

    const userIds: Record<string, string> = {};

    for (const u of users) {
      // Check if user exists
      const { data: existing } = await supabase.auth.admin.listUsers();
      const found = existing?.users?.find((x: any) => x.email === u.email);
      
      if (found) {
        userIds[u.role] = found.id;
        results.push(`User ${u.email} already exists (${found.id})`);
      } else {
        const { data, error } = await supabase.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
          user_metadata: { full_name: u.full_name },
        });
        if (error) {
          results.push(`Failed to create ${u.email}: ${error.message}`);
          continue;
        }
        userIds[u.role] = data.user.id;
        results.push(`Created user ${u.email} (${data.user.id})`);
      }

      // Assign role
      const { error: roleErr } = await supabase.from("user_roles").upsert(
        { user_id: userIds[u.role], role: u.role },
        { onConflict: "user_id,role" }
      );
      if (roleErr) results.push(`Role assign error for ${u.role}: ${roleErr.message}`);
      else results.push(`Assigned role '${u.role}' to ${u.email}`);
    }

    // 2. Seed vans
    const { data: van1 } = await supabase.from("vans").upsert(
      { van_code: "VAN-01", vehicle_number: "BR27PA4589", route_name: "Tilak Nagar Route", capacity: 18, status: "active" },
      { onConflict: "van_code" }
    ).select().single();

    const { data: van2 } = await supabase.from("vans").upsert(
      { van_code: "VAN-02", vehicle_number: "BR27PB1234", route_name: "Gandhi Chowk Route", capacity: 15, status: "active" },
      { onConflict: "van_code" }
    ).select().single();

    results.push(`Seeded vans: VAN-01 (${van1?.id}), VAN-02 (${van2?.id})`);

    // 3. Seed driver
    if (userIds.driver && van1) {
      const { error } = await supabase.from("drivers").upsert(
        { user_id: userIds.driver, full_name: "Rakesh Kumar", phone: "9876543210", license_no: "BR01-2022-8899", van_id: van1.id },
        { onConflict: "user_id" }
      );
      results.push(error ? `Driver seed error: ${error.message}` : "Seeded driver Rakesh Kumar");
    }

    // 4. Seed students
    if (van1 && userIds.parent) {
      const studentData = [
        { full_name: "Aman Kumar", class: "5", pickup_point: "Tilak Nagar Chowk", parent_phone: "9123456780", van_id: van1.id, parent_user_id: userIds.parent, status: "waiting" },
        { full_name: "Neha Singh", class: "7", pickup_point: "Station Road", parent_phone: "9345678120", van_id: van1.id, status: "waiting" },
        { full_name: "Rahul Raj", class: "3", pickup_point: "Main Market", parent_phone: "9876123450", van_id: van1.id, status: "waiting" },
      ];
      
      for (const s of studentData) {
        const { error } = await supabase.from("students").insert(s);
        results.push(error ? `Student ${s.full_name} error: ${error.message}` : `Seeded student ${s.full_name}`);
      }
    }

    if (van2) {
      const studentData2 = [
        { full_name: "Priya Sharma", class: "6", pickup_point: "Gandhi Chowk", parent_phone: "9012345678", van_id: van2.id, status: "waiting" },
        { full_name: "Vikram Patel", class: "4", pickup_point: "Bus Stand", parent_phone: "9234567890", van_id: van2.id, status: "waiting" },
      ];
      for (const s of studentData2) {
        const { error } = await supabase.from("students").insert(s);
        results.push(error ? `Student ${s.full_name} error: ${error.message}` : `Seeded student ${s.full_name}`);
      }
    }

    // 5. Seed route points
    if (van1) {
      const points = [
        { van_id: van1.id, name: "Gyanoday Vidyalay", lat: 24.88, lng: 85.53, point_order: 0, point_type: "school" },
        { van_id: van1.id, name: "Tilak Nagar Chowk", lat: 24.876, lng: 85.525, point_order: 1, point_type: "pickup" },
        { van_id: van1.id, name: "Station Road", lat: 24.872, lng: 85.52, point_order: 2, point_type: "pickup" },
        { van_id: van1.id, name: "Main Market", lat: 24.868, lng: 85.515, point_order: 3, point_type: "pickup" },
      ];
      for (const p of points) {
        await supabase.from("route_points").insert(p);
      }
      results.push("Seeded route points for VAN-01");
    }

    if (van2) {
      const points2 = [
        { van_id: van2.id, name: "Gyanoday Vidyalay", lat: 24.88, lng: 85.53, point_order: 0, point_type: "school" },
        { van_id: van2.id, name: "Gandhi Chowk", lat: 24.884, lng: 85.535, point_order: 1, point_type: "pickup" },
        { van_id: van2.id, name: "Bus Stand", lat: 24.888, lng: 85.54, point_order: 2, point_type: "pickup" },
      ];
      for (const p of points2) {
        await supabase.from("route_points").insert(p);
      }
      results.push("Seeded route points for VAN-02");
    }

    return new Response(JSON.stringify({
      success: true,
      results,
      credentials: {
        admin: { email: "admin@gyanoday.edu", password: "admin123" },
        driver: { email: "driver@gyanoday.edu", password: "driver123" },
        parent: { email: "parent@gyanoday.edu", password: "parent123" },
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
