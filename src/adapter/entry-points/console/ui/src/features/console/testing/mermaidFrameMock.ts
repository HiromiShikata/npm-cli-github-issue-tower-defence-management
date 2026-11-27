const MOCK_FRAME_SCRIPT = `
window.addEventListener('message', function (event) {
  if (event.source !== window.parent) { return; }
  var request = event.data;
  document.body.innerHTML = '';
  var pre = document.createElement('pre');
  pre.textContent = request.code;
  document.body.appendChild(pre);
  window.parent.postMessage({ type: 'size', requestId: request.requestId, height: 160 }, '*');
});
`;

export const MERMAID_FRAME_MOCK_SOURCE = `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><body><script>${MOCK_FRAME_SCRIPT}</script></body></html>`)}`;
