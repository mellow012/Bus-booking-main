import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // ?route=Lilongwe to Blantyre&date=2026-08-09T06:00:00Z&fare=25000&company=Mellow Tours&busType=Luxury
    const route = searchParams.get('route') || 'Bus Schedule';
    const dateStr = searchParams.get('date');
    const fare = searchParams.get('fare');
    const company = searchParams.get('company') || 'TibhukeBus';
    const busType = searchParams.get('busType') || 'Standard';
    
    const formattedDate = dateStr 
      ? new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'Date TBA';

    const formattedFare = fare ? `MWK ${parseInt(fare).toLocaleString()}` : '';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#ffffff',
            backgroundImage: 'linear-gradient(to bottom right, #f8fafc, #eef2ff)',
            fontFamily: 'sans-serif',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', position: 'absolute', top: 40, left: 60 }}>
            <div style={{
              backgroundColor: '#4338ca',
              color: 'white',
              fontSize: 24,
              fontWeight: 800,
              padding: '8px 16px',
              borderRadius: 8,
              marginRight: 16,
              letterSpacing: '-1px'
            }}>
              TibhukeBus
            </div>
            <span style={{ fontSize: 24, color: '#64748b', fontWeight: 500 }}>| {company}</span>
          </div>

          {/* Main Content */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 40 }}>
            <div style={{
              fontSize: 64,
              fontWeight: 900,
              color: '#0f172a',
              letterSpacing: '-2px',
              textAlign: 'center',
              lineHeight: 1.1,
              marginBottom: 24,
              maxWidth: 900,
            }}>
              {route}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', fontSize: 32, color: '#334155', fontWeight: 600, marginBottom: 40 }}>
              <span style={{ backgroundColor: '#e2e8f0', padding: '6px 16px', borderRadius: 20, marginRight: 16, fontSize: 24, color: '#475569' }}>
                {busType}
              </span>
              {formattedDate}
            </div>

            {formattedFare && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#10b981',
                color: 'white',
                fontSize: 48,
                fontWeight: 800,
                padding: '16px 32px',
                borderRadius: 16,
                boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)',
              }}>
                {formattedFare}
              </div>
            )}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    return new Response('Failed to generate image', { status: 500 });
  }
}
