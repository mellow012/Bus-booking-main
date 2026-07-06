'use client';

interface PaginationProps {
  page: number;
  totalItems: number;
  pageSize: number;
  onPrevious: () => void;
  onNext: () => void;
}

export default function Pagination({ page, totalItems, pageSize, onPrevious, onNext }: PaginationProps) {
  if (totalItems <= pageSize) return null;
  const totalPages = Math.ceil(totalItems / pageSize);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <p className="text-xs text-gray-500">
        Showing page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={page === 1}
          className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={page * pageSize >= totalItems}
          className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}