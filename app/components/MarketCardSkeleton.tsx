export default function MarketCardSkeleton() {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e8ecf0',
      borderRadius: 12, overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 14px 12px' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <div className="skeleton" style={{ width: 72, height: 18, borderRadius: 5 }} />
          <div className="skeleton" style={{ width: 50, height: 18, borderRadius: 5 }} />
        </div>
        <div className="skeleton" style={{ width: '100%', height: 13, marginBottom: 6, borderRadius: 4 }} />
        <div className="skeleton" style={{ width: '85%',  height: 13, marginBottom: 6, borderRadius: 4 }} />
        <div className="skeleton" style={{ width: '60%',  height: 13, marginBottom: 16, borderRadius: 4 }} />
        <div className="skeleton" style={{ width: 80, height: 28, marginBottom: 8, borderRadius: 6 }} />
        <div className="skeleton" style={{ width: '100%', height: 3, borderRadius: 2 }} />
      </div>
      <div style={{
        padding: '9px 14px', background: '#fafbfc',
        borderTop: '1px solid #f1f5f9',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div className="skeleton" style={{ width: 60, height: 13, borderRadius: 4 }} />
        <div className="skeleton" style={{ width: 70, height: 26, borderRadius: 6 }} />
      </div>
    </div>
  )
}