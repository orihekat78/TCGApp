// data: URI SVG — モックの .silhouette 相当 (60×84px 想定)
const PLACEHOLDER_DATA_URI =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 84" preserveAspectRatio="xMidYMid slice">' +
      '<defs>' +
        '<radialGradient id="g" cx="50%" cy="30%" r="60%">' +
          '<stop offset="0%" stop-color="rgba(255,255,255,0.18)"/>' +
          '<stop offset="100%" stop-color="rgba(0,0,0,0.6)"/>' +
        '</radialGradient>' +
      '</defs>' +
      '<rect width="60" height="84" fill="#0a1320"/>' +
      '<ellipse cx="30" cy="44" rx="20" ry="22" fill="url(#g)"/>' +
    '</svg>',
  );

export function getCardImagePlaceholder(): string {
  return PLACEHOLDER_DATA_URI;
}
