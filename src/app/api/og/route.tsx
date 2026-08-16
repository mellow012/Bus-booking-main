import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const route = searchParams.get('route') || 'Group Bus Schedule';
    const dateStr = searchParams.get('date');
    const fare = searchParams.get('fare');
    const company = searchParams.get('company') || 'TibhukeBus';
    const busType = searchParams.get('busType') || 'Group Booking';

    let formattedDate = 'Date TBA';
    if (dateStr) {
      try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          formattedDate = d.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
        }
      } catch {}
    }

    const formattedFare = fare && !isNaN(parseInt(fare, 10))
      ? `MWK ${parseInt(fare, 10).toLocaleString()}`
      : '';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            backgroundColor: '#003738',
            backgroundImage: 'radial-gradient(circle at 90% 10%, #005A5B 0%, #002B2C 70%, #001E1F 100%)',
            padding: '60px 70px',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          {/* Top Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
            }}
          >
            {/* Logo + Tag */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  color: '#005A5B',
                  fontSize: 26,
                  fontWeight: 900,
                  padding: '10px 22px',
                  borderRadius: 14,
                  letterSpacing: '-0.5px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                }}
              >
                TibhukeBus
              </div>
              <div
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#E0F2F1',
                  fontSize: 18,
                  fontWeight: 700,
                  padding: '8px 18px',
                  borderRadius: 24,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}
              >
                {busType}
              </div>
            </div>

            {/* Operator / Representative Name */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                color: '#A7F3D0',
                fontSize: 22,
                fontWeight: 700,
              }}
            >
              ✦ {company}
            </div>
          </div>

          {/* Center / Route Block */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              margin: '20px 0',
            }}
          >
            <div
              style={{
                color: '#6EE7B7',
                fontSize: 20,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '2.5px',
              }}
            >
              Official Booking Schedule
            </div>
            <div
              style={{
                fontSize: 66,
                fontWeight: 900,
                color: '#FFFFFF',
                letterSpacing: '-1.5px',
                lineHeight: 1.15,
                maxWidth: 1060,
                textShadow: '0 4px 20px rgba(0,0,0,0.3)',
              }}
            >
              {route}
            </div>
          </div>

          {/* Bottom Card Summary */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 24,
              padding: '24px 36px',
            }}
          >
            {/* Travel Date */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: '#94A3B8',
                  letterSpacing: '1.5px',
                }}
              >
                Travel Date
              </span>
              <span style={{ fontSize: 30, fontWeight: 800, color: '#FFFFFF' }}>
                {formattedDate}
              </span>
            </div>

            {/* Fare badge */}
            {formattedFare ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: '#FF6B6B',
                  color: '#FFFFFF',
                  padding: '14px 30px',
                  borderRadius: 18,
                  boxShadow: '0 10px 30px rgba(255, 107, 107, 0.4)',
                }}
              >
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    opacity: 0.9,
                  }}
                >
                  Fare:
                </span>
                <span style={{ fontSize: 34, fontWeight: 900 }}>
                  {formattedFare}
                </span>
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: '#005A5B',
                  color: '#FFFFFF',
                  padding: '14px 28px',
                  borderRadius: 18,
                  fontSize: 22,
                  fontWeight: 800,
                }}
              >
                Book Online
              </div>
            )}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200',
        },
      }
    );
  } catch (e: any) {
    return new Response('Failed to generate image', { status: 500 });
  }
}

