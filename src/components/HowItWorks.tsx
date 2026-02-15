import { Search, Calendar, CreditCard, MapPin } from 'lucide-react';

const HowItWorks = () => {
  const steps = [
    {
      icon: Search,
      step: "01",
      title: "Search Routes",
      description: "Enter your departure and destination cities to find available bus routes",
      color: "from-blue-600 to-blue-800", // Defined colors
      bgColor: "bg-blue-100",
    },
    {
      icon: Calendar,
      step: "02",
      title: "Choose Schedule",
      description: "Select your preferred departure time and bus company from available options",
      color: "from-amber-500 to-amber-700",
      bgColor: "bg-amber-100",
    },
    {
      icon: CreditCard,
      step: "03",
      title: "Secure Payment",
      description: "Pay safely using mobile money, bank transfer, or credit card",
      color: "from-green-600 to-green-800",
      bgColor: "bg-green-100",
    },
    {
      icon: MapPin,
      step: "04",
      title: "Travel Comfort",
      description: "Show your e-ticket and enjoy your comfortable journey across Malawi",
      color: "from-purple-600 to-purple-800",
      bgColor: "bg-purple-100",
    },
  ];

  return (
    <section className="py-16 bg-gray-50" aria-label="How BooknPay Works">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            How <span className="text-blue-600">TibhukeBus</span> Works
          </h2>
          <p className="text-gray-600 text-base md:text-lg max-w-xl mx-auto">
            Book your bus ticket in 4 simple steps and travel with confidence
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, index) => (
            <div key={index} className="relative group">
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-16 left-full w-full h-0.5 bg-gradient-to-r from-gray-200 to-transparent" />
              )}
              <div className="flex flex-col items-center p-6 bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-300">
                <div className="w-12 h-12 rounded-full bg-opacity-75 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <step.icon className={`w-6 h-6 text-${step.color.split(' ')[0]}`} />
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-500 mb-2">{step.step}</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-gray-600 text-sm">{step.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <div className="inline-flex items-center px-4 py-2 bg-green-50 rounded-full text-green-700 font-medium text-sm mb-4">
            <MapPin className="w-4 h-4 mr-2" />
            Ready to travel? Start your journey now!
          </div>
          <button
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-300"
            aria-label="Book your ticket now"
          >
            Book Your Ticket Now
          </button>
        </div>
      </div>
    </section>
  );
};
export default HowItWorks;