import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("=== CLEANING UP SUPABASE AUTH USERS ===");
  
  // List all users. Note: listUsers is paginated, but we likely have few enough users to just grab the first page
  // We'll iterate through pages to be safe
  let page = 1;
  let deletedCount = 0;
  
  while (true) {
    const { data: { users }, error } = await supabase.auth.admin.listUsers({
      page: page,
      perPage: 100
    });
    
    if (error) {
      console.error("Error listing users:", error.message);
      break;
    }
    
    if (users.length === 0) break;
    
    for (const user of users) {
      if (user.email && user.email.includes("@test.local")) {
        const delRes = await supabase.auth.admin.deleteUser(user.id);
        if (delRes.error) {
          console.error(`Failed to delete ${user.email} (ID: ${user.id}):`, delRes.error.message);
        } else {
          console.log(`Deleted Auth user: ${user.email}`);
          deletedCount++;
        }
      }
    }
    
    if (users.length < 100) break;
    page++;
  }

  console.log(`\n✅ Successfully deleted ${deletedCount} @test.local users from Supabase Auth.`);
}

main().catch(console.error);
