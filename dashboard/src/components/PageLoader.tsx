export default function PageLoader() {
  return (
    <div
      role="status"
      aria-label="Loading page"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-base, #000000)',
        color: 'var(--text-muted, #737373)',
        zIndex: 9999,
        gap: '16px',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          border: '2px solid rgba(255, 255, 255, 0.1)',
          borderTopColor: 'var(--accent, #ffffff)',
          animation: 'page-loader-spin 0.8s linear infinite',
        }}
      />
      <style>{`
        @keyframes page-loader-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <span
        style={{
          fontFamily: 'var(--mono, monospace)',
          fontSize: '12px',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: 'var(--text-muted, #737373)',
        }}
      >
        Loading...
      </span>
    </div>
  );
}
