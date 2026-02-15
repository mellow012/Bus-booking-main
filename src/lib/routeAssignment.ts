/**
 * SCRIPT TO FIX ROUTE ASSIGNMENTS
 * Run this once to fix all routes that have Firestore doc IDs instead of Auth UIDs
 */

import { collection, getDocs, query, where, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';

export async function fixRouteAssignments(companyId: string) {
  console.log('🔧 FIXING ROUTE ASSIGNMENTS');
  console.log('=====================================');
  
  try {
    // 1. Get all operators for the company
    const operatorsQuery = query(
      collection(db, 'operators'),
      where('companyId', '==', companyId)
    );
    const operatorsSnap = await getDocs(operatorsQuery);
    
    // Create a map: Firestore doc ID → Auth UID
    const docIdToAuthUid = new Map();
    operatorsSnap.forEach(doc => {
      const data = doc.data();
      docIdToAuthUid.set(doc.id, data.uid); // doc.id (Firestore) → data.uid (Auth)
      console.log(`Operator: ${data.email}`);
      console.log(`  Firestore ID: ${doc.id}`);
      console.log(`  Auth UID: ${data.uid}`);
      console.log('');
    });

    // 2. Get all routes
    const routesQuery = query(
      collection(db, 'routes'),
      where('companyId', '==', companyId)
    );
    const routesSnap = await getDocs(routesQuery);
    
    console.log(`Found ${routesSnap.size} routes to check`);
    console.log('');

    let fixedCount = 0;
    let skippedCount = 0;

    // 3. Fix each route
    for (const routeDoc of routesSnap.docs) {
      const routeData = routeDoc.data();
      const assignedOperatorIds = routeData.assignedOperatorIds || [];
      
      console.log(`Checking route: ${routeData.name}`);
      console.log(`  Current assignedOperatorIds:`, assignedOperatorIds);
      
      // Convert Firestore IDs to Auth UIDs
      const fixedIds = assignedOperatorIds.map(id => {
        if (docIdToAuthUid.has(id)) {
          const authUid = docIdToAuthUid.get(id);
          console.log(`  ✓ Converting: ${id} → ${authUid}`);
          return authUid;
        } else {
          console.log(`  ⚠️  Keeping (already Auth UID or not found): ${id}`);
          return id; // Keep as-is if not found (might already be correct)
        }
      });

      // Check if changes needed
      const needsUpdate = JSON.stringify(assignedOperatorIds) !== JSON.stringify(fixedIds);
      
      if (needsUpdate) {
        console.log(`  📝 Updating route...`);
        await updateDoc(doc(db, 'routes', routeDoc.id), {
          assignedOperatorIds: fixedIds,
          updatedAt: new Date()
        });
        console.log(`  ✓ Fixed!`);
        fixedCount++;
      } else {
        console.log(`  ✓ Already correct, skipping`);
        skippedCount++;
      }
      console.log('');
    }

    console.log('=====================================');
    console.log('📊 SUMMARY:');
    console.log(`  Total routes checked: ${routesSnap.size}`);
    console.log(`  Routes fixed: ${fixedCount}`);
    console.log(`  Routes skipped (already correct): ${skippedCount}`);
    console.log('✓ Done!');

    return { fixedCount, skippedCount, total: routesSnap.size };

  } catch (error) {
    console.error('❌ ERROR:', error);
    throw error;
  }
}

// Usage in a component or admin panel:
/*
<button onClick={() => fixRouteAssignments(companyId)}>
  Fix Route Assignments
</button>
*/