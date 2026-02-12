import React from 'react';

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', ...props }, ref) => (
    <textarea
      ref={ref}
      className={`
        w-full px-4 py-3 rounded-lg border border-gray-200 
        bg-white text-gray-900 placeholder-gray-500
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
        disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
        transition-all duration-200 resize-none
        ${className}
      `}
      {...props}
    />
  )
);

Textarea.displayName = 'Textarea';

export { Textarea };