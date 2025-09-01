// components/PopularRoutesCarousel.tsx
import React from "react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { ArrowRight, Clock, MapPin, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EnhancedSchedule } from "@/types/";

const PopularRoutesCarousel: React.FC<{ routes: EnhancedSchedule[] }> = ({ routes = [] }) => {
  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
  };

  return (
    <section aria-labelledby="popular-routes-heading" className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 id="popular-routes-heading" className="text-2xl sm:text-3xl font-bold text-gray-900">Popular Routes</h2>
            <p className="text-gray-600">Top journeys travelers are booking right now</p>
          </div>
        </div>

        <Carousel opts={{ align: "start" }}>
          <CarouselContent>
            {routes.map((route, idx) => (
              <CarouselItem key={`${route.origin}-${route.destination}-${idx}`} className="basis-full sm:basis-1/2 lg:basis-1/3">
                <article className="card-elevated card-glow h-full">
                  <div className="p-6 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center">
                          <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">From</div>
                          <div className="font-semibold text-gray-900">{route.origin}</div>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-blue-600" />
                      <div className="text-right">
                        <div className="text-sm text-gray-600">To</div>
                        <div className="font-semibold text-gray-900">{route.destination}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
                        <Clock className="w-4 h-4 text-blue-600" />
                        <span className="text-sm text-gray-900">{formatDuration(route.duration)}</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
                        <Star className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm text-gray-900">4.6</span>
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between">
                      <div>
                        <div className="text-xs text-gray-600">from</div>
                        <div className="text-xl font-bold text-blue-600">MWK {(route.price * 1700).toLocaleString()}</div>
                      </div>
                      <Button
                        onClick={() => router.push(`/book/${route.id}?passengers=1`)}
                        className="btn-hero"
                      >
                        Book now
                      </Button>
                    </div>
                  </div>
                </article>
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className="mt-4 flex md:hidden justify-end gap-2">
            <CarouselPrevious className="border-blue-200 hover:bg-blue-50" />
            <CarouselNext className="border-blue-200 hover:bg-blue-50" />
          </div>
        </Carousel>
      </div>
    </section>
  );
};

export default PopularRoutesCarousel;