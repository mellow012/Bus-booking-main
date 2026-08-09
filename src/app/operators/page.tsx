import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import OperatorsClient from "./OperatorsClient";

export const dynamic = "force-dynamic";

const getCachedOperators = unstable_cache(
  async () => {
    const companies = await prisma.company.findMany({
      where: { status: "active" },
      select: {
        id: true,
        name: true,
        logo: true,
        description: true,
        email: true,
        phone: true,
        address: true,
        regions: {
          where: { isActive: true },
          select: { id: true, name: true },
        },
        routes: {
          where: { isActive: true },
          select: { id: true },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    const ratingAggregates = await prisma.booking.groupBy({
      by: ["companyId"],
      where: { reviewRating: { not: null } },
      _avg: { reviewRating: true },
      _count: { reviewRating: true },
    });

    return { companies, ratingAggregates };
  },
  ["operators-directory-cache"],
  { revalidate: 600, tags: ["operators"] }
);

export default async function OperatorsPage() {
  const { companies, ratingAggregates } = await getCachedOperators();

  // Map aggregates to a fast-lookup object
  const ratingsMap = ratingAggregates.reduce((acc, curr) => {
    acc[curr.companyId] = {
      averageRating: curr._avg.reviewRating
        ? Math.round(curr._avg.reviewRating * 10) / 10
        : 4.5,
      totalReviews: curr._count.reviewRating || 0,
    };
    return acc;
  }, {} as Record<string, { averageRating: number; totalReviews: number }>);

  const formattedCompanies = companies.map((c) => {
    const rating = ratingsMap[c.id] || { averageRating: 4.5, totalReviews: 0 };
    return {
      id: c.id,
      name: c.name,
      logo: c.logo,
      description: c.description || "",
      email: c.email,
      phone: c.phone || "",
      address: c.address || "",
      regions: c.regions.map((r) => r.name),
      activeRoutesCount: c.routes.length,
      averageRating: rating.averageRating,
      totalReviews: rating.totalReviews,
    };
  });

  return (
    <OperatorsClient initialCompanies={formattedCompanies} />
  );
}
