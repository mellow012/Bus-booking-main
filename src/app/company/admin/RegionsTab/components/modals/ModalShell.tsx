import { Button } from '@/components/ui/button';

interface ModalShellProps {
  title: string;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  children: React.ReactNode;
}

export default function ModalShell({ title, saving, onClose, onSave, children }: ModalShellProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg font-semibold">
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">{children}</div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-50 bg-white">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-xl h-10">
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-10 min-w-[100px]"
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}