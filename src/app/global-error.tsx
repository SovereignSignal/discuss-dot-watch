'use client';

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, backgroundColor: '#09090b', color: '#e4e4e7', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
          <div style={{ textAlign: 'center', maxWidth: 400 }}>
            <div style={{ fontSize: 48, marginBottom: 24 }}>⚠️</div>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h1>
            <p style={{ color: '#71717a', marginBottom: 32 }}>
              An unexpected error occurred. Please try again.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <button
                onClick={reset}
                style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  backgroundColor: '#f4f4f5',
                  color: '#18181b',
                  fontSize: 14,
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Try again
              </button>
              <a
                href="/"
                style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  border: '1px solid #3f3f46',
                  color: '#d4d4d8',
                  fontSize: 14,
                  fontWeight: 500,
                  textDecoration: 'none',
                }}
              >
                Go home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
