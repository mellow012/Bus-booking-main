import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import OperatorProfileClient from "./OperatorProfileClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ companyId: string }>;
}

const getCachedOperatorProfile = (companyId: string) =>
  unstable_cache(
    async () => {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        include: {
          regions: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              code: true,
              operators: {
                where: { status: "active" },
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                  uid: true,
                },
              },
            },
          },
          routes: {
            where: { isActive: true, status: "active" },
            select: {
              id: true,
              name: true,
              origin: true,
              destination: true,
              distance: true,
              duration: true,
              baseFare: true,
              stops: true,
            },
          },
          buses: {
            where: { isActive: true, status: "active" },
            select: {
              id: true,
              licensePlate: true,
              busType: true,
              capacity: true,
              amenities: true,
              images: true,
            },
          },
        },
      });

      if (!company || company.status !== "active") {
        return null;
      }

      const ratingAggregate = await prisma.booking.aggregate({
        where: {
          companyId,
          reviewRating: { not: null },
        },
        _avg: { reviewRating: true },
        _count: { reviewRating: true },
      });

      // Collect all operator uids/ids to query their phone numbers
      const operatorUids = company ? company.regions.flatMap(r => r.operators.map(o => o.uid).filter(Boolean)) : [];
      const operatorIds = company ? company.regions.flatMap(r => r.operators.map(o => o.id).filter(Boolean)) : [];

      let phoneMap: Record<string, string | null> = {};
      if (operatorUids.length > 0 || operatorIds.length > 0) {
        const users = await prisma.user.findMany({
          where: {
            OR: [
              { uid: { in: operatorUids } },
              { id: { in: operatorIds } },
            ],
          },
          select: { id: true, uid: true, phone: true },
        });

        users.forEach((u) => {
          if (u.uid) phoneMap[u.uid] = u.phone;
          if (u.id) phoneMap[u.id] = u.phone;
        });
      }

      return { company, ratingAggregate, phoneMap };
    },
    [`operator-profile-${companyId}`],
    { revalidate: 600, tags: [`operator-${companyId}`] }
  )();

export default async function OperatorProfilePage({ params }: PageProps) {
  const { companyId } = await params;
  const data = await getCachedOperatorProfile(companyId);

  if (!data) {
    notFound();
  }

  const { company, ratingAggregate, phoneMap } = data;
  const phones = phoneMap || {};

  const averageRating = ratingAggregate._avg.reviewRating
    ? Math.round(ratingAggregate._avg.reviewRating * 10) / 10
    : 4.5;
  const totalReviews = ratingAggregate._count.reviewRating || 0;

  // Formatting contactSettings safely
  const contact = (company.contactSettings as Record<string, any>) || {};

  return (
    <OperatorProfileClient
      company={{
        id: company.id,
        name: company.name,
        logo: company.logo,
        description: company.description || "",
        email: company.email,
        phone: company.phone || "",
        address: company.address || "",
        operatingHours: company.operatingHours as any,
        contactSettings: {
          supportEmail: contact.supportEmail || company.email || "",
          supportPhone: contact.supportPhone || company.phone || "",
          whatsappNumber: contact.whatsappNumber || contact.whatsapp || "",
          officeAddress: contact.officeAddress || company.address || "",
          website: contact.website || "",
        },
        regions: company.regions.map((r) => ({
          id: r.id,
          name: r.name,
          code: r.code,
          operators: r.operators.map((op) => ({
            id: op.id,
            name: op.name,
            email: op.email,
            role: op.role,
            phone: phones[op.uid] || phones[op.id] || null,
          })),
        })),
        routes: company.routes.map((r) => ({
          id: r.id,
          name: r.name,
          origin: r.origin,
          destination: r.destination,
          distance: r.distance,
          duration: r.duration,
          baseFare: r.baseFare,
          stopsCount: Array.isArray(r.stops) ? r.stops.length : 0,
          stops: Array.isArray(r.stops)
            ? (r.stops as any[]).slice().sort((a, b) => (a.order || 0) - (b.order || 0))
            : [],
        })),
        buses: company.buses.map((b) => ({
          id: b.id,
          licensePlate: b.licensePlate,
          busType: b.busType,
          capacity: b.capacity,
          amenities: Array.isArray(b.amenities)
            ? (b.amenities as string[])
            : typeof b.amenities === "string"
            ? JSON.parse(b.amenities)
            : [],
          images: b.images,
        })),
        averageRating,
        totalReviews,
      }}
    />
  );
}
