import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh] px-4">
      <div className="text-center max-w-md w-full">
        <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-8 transform -rotate-6">
          <Search className="w-10 h-10 text-blue-500 transform rotate-6" />
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
          Page not found
        </h1>
        <p className="text-slate-500 text-lg mb-8 leading-relaxed">
          Sorry, we couldn't find the page you're looking for. It might have been moved or doesn't exist.
        </p>
        <Link href="/">
          <Button className="h-14 px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-lg font-semibold transition-colors shadow-lg shadow-blue-500/30">
            Return to homepage
          </Button>
        </Link>
      </div>
    </div>
  );
}
