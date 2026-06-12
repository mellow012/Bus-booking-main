import React, { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <section className="admin-chief-of-growth-layout p-4">
      {children}
    </section>
  );
}
