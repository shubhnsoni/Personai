export function AuthLoading() {
  return (
    <div className="au-loading" role="status" aria-live="polite">
      <span>Loading your account form…</span>
      <span className="au-loading-line" aria-hidden="true" />
      <span className="au-loading-line" aria-hidden="true" />
      <span className="au-loading-line" aria-hidden="true" />
    </div>
  );
}
