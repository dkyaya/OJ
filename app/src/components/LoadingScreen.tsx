export function LoadingScreen() {
  return <div className="loading-screen" role="status" aria-live="polite" aria-atomic="true">
    <div className="loading-mark" aria-hidden="true">
      <span className="loading-liquid" />
      <span className="loading-bubble loading-bubble-one" />
      <span className="loading-bubble loading-bubble-two" />
      <span className="loading-bubble loading-bubble-three" />
      <img src={`${import.meta.env.BASE_URL}brand/oj-logo-mark-white.svg`} alt="" />
    </div>
    <span className="loading-copy">Preparing your journal<span className="loading-dots" aria-hidden="true"><i /><i /><i /></span></span>
  </div>;
}
