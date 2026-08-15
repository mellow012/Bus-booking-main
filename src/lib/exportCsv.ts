import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toDate } from '@/lib/chatterHelpers';

export interface ManifestBookingRow {
  bookingReference: string;
  passengerName: string;
  contactPhone: string;
  seat: string;
  paymentStatus: string;
  createdAt: string | Date;
}

export function exportBookingsAsCsv(bookings: ManifestBookingRow[], filename: string): void {
  const headers = ['Booking Ref', 'Passenger Name', 'Contact Phone', 'Seat', 'Payment Status', 'Booked At'];
  
  const escapeCsvValue = (val: string | number | Date | null | undefined): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = bookings.map((b) => [
    escapeCsvValue(b.bookingReference),
    escapeCsvValue(b.passengerName),
    escapeCsvValue(b.contactPhone),
    escapeCsvValue(b.seat),
    escapeCsvValue(b.paymentStatus),
    escapeCsvValue(b.createdAt instanceof Date ? b.createdAt.toLocaleString() : new Date(b.createdAt).toLocaleString()),
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export interface ManifestPdfOptions {
  busName: string;
  origin: string;
  destination: string;
  travelDate: string;
  totalSeats: number;
  fare: number;
}

export function exportBookingsAsPdf(
  bookings: ManifestBookingRow[],
  schedule: ManifestPdfOptions,
  filename: string,
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // ── Brand teal color ──────────────────────────────────────────────────
  const TEAL  = [0,  90,  91] as [number, number, number]; // #005A5B brand-700
  const TEAL2 = [0,  61,  62] as [number, number, number]; // #003D3E brand-800
  const CORAL = [232, 96, 76] as [number, number, number]; // #E8604C coral-500
  const WHITE = [255, 255, 255] as [number, number, number];
  const GRAY  = [100, 116, 139] as [number, number, number]; // slate-500
  const DARK  = [15,  23,  42]  as [number, number, number]; // slate-900

  const W = doc.internal.pageSize.getWidth();

  // ── Header banner ─────────────────────────────────────────────────────
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, W, 34, 'F');

  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('TibhukeBus', 14, 13);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 240, 240);
  doc.text('PASSENGER MANIFEST', 14, 19);

  // Coral accent strip
  doc.setFillColor(...CORAL);
  doc.rect(0, 34, W, 2.5, 'F');

  // ── Trip Info block ───────────────────────────────────────────────────
  const sd = toDate(schedule.travelDate);
  const tDate = sd
    ? sd.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : 'N/A';

  const paidCount = bookings.filter((b) => b.paymentStatus === 'paid').length;
  const pendingCount = bookings.length - paidCount;

  // Info card background
  doc.setFillColor(240, 250, 250);
  doc.roundedRect(14, 42, W - 28, 32, 3, 3, 'F');
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, 42, W - 28, 32, 3, 3, 'S');

  doc.setTextColor(...TEAL2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(schedule.busName, 20, 51);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  doc.text(`${schedule.origin}  →  ${schedule.destination}`, 20, 58);
  doc.text(tDate, 20, 64);

  // Right side mini stats
  const statsX = W - 70;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...TEAL);
  doc.text('Total Bookings', statsX, 51);
  doc.setFontSize(14);
  doc.setTextColor(...DARK);
  doc.text(String(bookings.length), statsX, 59);

  doc.setFontSize(7.5);
  doc.setTextColor(5, 150, 105); // emerald-600
  doc.text(`${paidCount} paid`, statsX + 20, 59);
  doc.setTextColor(217, 119, 6); // amber-600
  doc.text(`${pendingCount} pending`, statsX + 20, 64.5);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text(`Fare: MWK ${schedule.fare.toLocaleString()} / seat`, statsX, 66.5);

  // ── Passenger table ───────────────────────────────────────────────────
  const tableRows = bookings.map((b, i) => [
    String(i + 1),
    b.seat || '—',
    b.passengerName || 'Passenger',
    b.contactPhone || '—',
    b.bookingReference,
    b.paymentStatus,
    (() => {
      const cd = toDate((b as any).createdAt);
      return cd ? cd.toLocaleDateString() : String(b.createdAt);
    })(),
  ]);

  autoTable(doc, {
    startY: 80,
    head: [['#', 'Seat', 'Passenger Name', 'Phone', 'Booking Ref', 'Status', 'Date']],
    body: tableRows,
    styles: {
      fontSize: 8,
      cellPadding: 3.5,
      textColor: DARK,
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: TEAL,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    alternateRowStyles: {
      fillColor: [248, 252, 252],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 14, fontStyle: 'bold', textColor: TEAL },
      5: { halign: 'center', cellWidth: 20 },
      6: { halign: 'center', cellWidth: 22 },
    },
    didDrawCell: (data: any) => {
      // Color the status cell text
      if (data.section === 'body' && data.column.index === 5) {
        const val = String(data.cell.raw).toLowerCase();
        const color = val === 'paid' ? [5, 150, 105] : [217, 119, 6];
        doc.setTextColor(...(color as [number, number, number]));
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        const x = data.cell.x + data.cell.width / 2;
        const y = data.cell.y + data.cell.height / 2 + 2;
        doc.text(val.toUpperCase(), x, y, { align: 'center' });
      }
    },
    margin: { left: 14, right: 14 },
  });

  // ── Footer ────────────────────────────────────────────────────────────
  const finalY = (doc as any).lastAutoTable?.finalY ?? 200;
  const footY = finalY + 10;

  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.3);
  doc.line(14, footY, W - 14, footY);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...GRAY);
  doc.text(
    `Generated by TibhukeBus on ${new Date().toLocaleString()} · ${bookings.length} passenger(s) · tibhukebus.com`,
    W / 2,
    footY + 5,
    { align: 'center' },
  );

  doc.save(filename);
}
