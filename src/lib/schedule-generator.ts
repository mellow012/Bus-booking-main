import { prisma } from './prisma';

let isRolling = false;
let lastCheckTime = 0;
const CHECK_COOLDOWN = 5 * 60 * 1000; // 5 minutes

/**
 * Checks if there are enough active future schedules in the database.
 * If the number of future active schedules is low (< 20) or if forced,
 * it will automatically roll all existing schedules forward to the next 7 days,
 * resetting booking states and seat counts to keep the app populated and dynamic.
 */
export async function checkAndRollSchedules(force = false) {
  if (isRolling) {
    return { success: true, rolled: false, message: 'Rolling already in progress' };
  }

  const nowTime = Date.now();
  if (nowTime - lastCheckTime < CHECK_COOLDOWN && !force) {
    return { success: true, rolled: false, message: 'Check skipped (within cooldown)' };
  }

  try {
    const now = new Date();
    lastCheckTime = nowTime;

    // Check if there are active schedules from now onwards
    const activeFutureCount = await prisma.schedule.count({
      where: {
        status: 'active',
        isActive: true,
        departureDateTime: { gte: now },
      },
    });

    // If we have at least 20 future active schedules, we don't need to roll
    if (activeFutureCount >= 20 && !force) {
      return { success: true, rolled: false, count: activeFutureCount };
    }

    isRolling = true;
    console.log(`[schedule-generator] Low future schedules (${activeFutureCount}). Rolling schedules forward...`);

    // Fetch all schedules to roll them forward
    const schedules = await prisma.schedule.findMany({
      orderBy: { departureDateTime: 'asc' },
    });

    if (schedules.length === 0) {
      console.log('[schedule-generator] No schedules found in database to roll forward.');
      isRolling = false;
      return { success: true, rolled: false, count: 0 };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate target range: Today until June 30, 2024 (Month 5 is June)
    const targetEndDate = new Date(2024, 5, 30);
    const diffTime = Math.max(0, targetEndDate.getTime() - today.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

    // Update in parallel transaction chunks to be extremely fast and efficient
    const chunkSize = 10; // Reduced chunk size to prevent driver timeouts
    let updatedCount = 0;

    console.log(`[schedule-generator] Spreading ${schedules.length} schedules over ${diffDays} days until end of June.`);

    for (let i = 0; i < schedules.length; i += chunkSize) {
      const chunk = schedules.slice(i, i + chunkSize);

      await prisma.$transaction(
        async (tx) => {
          const promises = chunk.map((s, idx) => {
            const globalIdx = i + idx;
            const departure = new Date(today);

            // Spread schedules over the entire range until end of June
            const daysOffset = globalIdx % diffDays;
            departure.setDate(today.getDate() + daysOffset);

            // Spread hours: 6:00, 8:00, 10:00, 12:00, 14:00, 16:00, 18:00
            const hourOffset = 6 + ((globalIdx * 2) % 14);
            departure.setHours(hourOffset, 0, 0, 0);

            // Preserve the original duration if possible, otherwise default to 4 hours
            const originalDuration = s.arrivalDateTime.getTime() - s.departureDateTime.getTime();
            const duration = originalDuration > 0 ? originalDuration : 4 * 60 * 60 * 1000;
            const arrival = new Date(departure.getTime() + duration);

            return tx.schedule.update({
              where: { id: s.id },
              data: {
                status: 'active',
                isActive: true,
                departureDateTime: departure,
                arrivalDateTime: arrival,
                availableSeats: 30, // Reset seats to default capacity
                bookedSeats: [],    // Reset booked seats
                isArchived: false,
                isCompleted: false,
                tripStatus: 'scheduled',
                currentStopIndex: 0,
                currentStopId: null,
                departedStops: [],
                tripStartedAt: null,
                tripCompletedAt: null,
                delayMinutes: 0,
                actualDepartureTime: null,
                actualArrivalTime: null,
              },
            });
          });
          await Promise.all(promises);
        },
        {
          timeout: 15000 // Reduced timeout to fail faster and allow retries
        }
      );

      updatedCount += chunk.length;
      
      // Small throttle delay (100ms) to prevent EAUTHTIMEOUT on remote connections
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`[schedule-generator] Successfully rolled ${updatedCount} schedules forward to the future.`);
    return { success: true, rolled: true, count: updatedCount };
  } catch (error) {
    console.error('[schedule-generator] Error rolling schedules forward:', error);
    return { success: false, error: (error as Error).message };
  } finally {
    isRolling = false;
  }
}
