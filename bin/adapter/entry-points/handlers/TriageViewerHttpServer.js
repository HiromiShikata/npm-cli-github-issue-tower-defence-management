"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TriageViewerHttpServer = void 0;
const http_1 = __importDefault(require("http"));
const VALID_CLOSE_REASONS = [
    'completed',
    'not_planned',
    'duplicate',
];
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isValidCloseReason = (value) => value === 'completed' || value === 'not_planned' || value === 'duplicate';
const readBody = (req) => new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
});
const sendJson = (res, statusCode, body) => {
    const json = JSON.stringify(body);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(json),
    });
    res.end(json);
};
const sendError = (res, statusCode, message) => {
    sendJson(res, statusCode, { ok: false, error: message });
};
const sendHtml = (res, html) => {
    res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': Buffer.byteLength(html),
        'Referrer-Policy': 'no-referrer',
    });
    res.end(html);
};
const extractAccessKey = (req) => {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.slice('Bearer '.length);
    }
    const urlObj = new URL(req.url ?? '/', 'http://localhost');
    const queryKey = urlObj.searchParams.get('key');
    if (queryKey) {
        return queryKey;
    }
    return null;
};
class TriageViewerHttpServer {
    constructor(useCase, accessKey) {
        this.useCase = useCase;
        this.accessKey = accessKey;
        this.server = null;
        this.start = (host, port) => new Promise((resolve, reject) => {
            this.server = http_1.default.createServer((req, res) => {
                void this.handleRequest(req, res);
            });
            this.server.keepAliveTimeout = 0;
            this.server.on('error', reject);
            this.server.listen(port, host, () => {
                resolve();
            });
        });
        this.stop = () => new Promise((resolve, reject) => {
            if (!this.server) {
                resolve();
                return;
            }
            this.server.closeAllConnections();
            this.server.close((err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
        this.handleRequest = async (req, res) => {
            const rawUrl = req.url ?? '/';
            const rawPath = rawUrl.split('?')[0];
            if (rawPath.split('/').some((seg) => seg === '..' || seg === '.')) {
                sendError(res, 400, 'Invalid path');
                return;
            }
            const urlObj = new URL(rawUrl, 'http://localhost');
            const pathname = urlObj.pathname;
            if (pathname.split('/').some((seg) => seg === '..' || seg === '.')) {
                sendError(res, 400, 'Invalid path');
                return;
            }
            if (pathname === '/health') {
                sendJson(res, 200, { ok: true });
                return;
            }
            const keyInQuery = urlObj.searchParams.get('key');
            if (keyInQuery && keyInQuery === this.accessKey) {
                const cleanUrl = pathname;
                const redirectHtml = `<!DOCTYPE html>
<html>
<head>
<meta name="referrer" content="no-referrer">
<meta http-equiv="refresh" content="0;url=${cleanUrl}">
<script>
(function(){
  localStorage.setItem('triage-access-key','${keyInQuery.replace(/'/g, "\\'")}');
  window.location.replace('${cleanUrl}');
})();
</script>
</head>
<body></body>
</html>`;
                sendHtml(res, redirectHtml);
                return;
            }
            const key = extractAccessKey(req);
            if (!key || key !== this.accessKey) {
                sendError(res, 403, 'Unauthorized');
                return;
            }
            if (pathname === '/image-proxy') {
                await this.handleImageProxy(req, res, urlObj);
                return;
            }
            const triageDataMatch = pathname.match(/^\/projects\/([^/]+)\/triage\/data$/);
            if (triageDataMatch && req.method === 'GET') {
                const projectCode = decodeURIComponent(triageDataMatch[1]);
                await this.handleGetTriageData(res, projectCode);
                return;
            }
            const setStoryMatch = pathname.match(/^\/projects\/([^/]+)\/triage\/set-story$/);
            if (setStoryMatch && req.method === 'POST') {
                await this.handleSetStory(req, res);
                return;
            }
            const closeIssueMatch = pathname.match(/^\/projects\/([^/]+)\/triage\/close-issue$/);
            if (closeIssueMatch && req.method === 'POST') {
                await this.handleCloseIssue(req, res);
                return;
            }
            const triagePageMatch = pathname.match(/^\/projects\/([^/]+)\/triage$/);
            if (triagePageMatch) {
                const projectCode = decodeURIComponent(triagePageMatch[1]);
                await this.handleTriagePage(res, projectCode);
                return;
            }
            sendError(res, 404, 'Not found');
        };
        this.handleGetTriageData = async (res, projectUrl) => {
            try {
                const data = await this.useCase.getTriageData(projectUrl);
                sendJson(res, 200, data);
            }
            catch (_error) {
                void _error;
                sendError(res, 500, 'Internal server error');
            }
        };
        this.handleSetStory = async (req, res) => {
            try {
                const bodyText = await readBody(req);
                let parsed;
                try {
                    parsed = JSON.parse(bodyText);
                }
                catch {
                    sendError(res, 400, 'Invalid JSON body');
                    return;
                }
                if (!isRecord(parsed)) {
                    sendError(res, 400, 'Missing required fields: projectId, storyFieldId, itemId, storyOptionId');
                    return;
                }
                const { projectId, storyFieldId, itemId, storyOptionId } = parsed;
                if (typeof projectId !== 'string' ||
                    typeof storyFieldId !== 'string' ||
                    typeof itemId !== 'string' ||
                    typeof storyOptionId !== 'string') {
                    sendError(res, 400, 'Missing required fields: projectId, storyFieldId, itemId, storyOptionId');
                    return;
                }
                const result = await this.useCase.setStory({
                    projectId,
                    storyFieldId,
                    itemId,
                    storyOptionId,
                });
                if (result.ok) {
                    sendJson(res, 200, { ok: true });
                }
                else {
                    sendJson(res, 400, { ok: false, error: result.error });
                }
            }
            catch (_error) {
                void _error;
                sendJson(res, 500, { ok: false, error: 'Internal server error' });
            }
        };
        this.handleCloseIssue = async (req, res) => {
            try {
                const bodyText = await readBody(req);
                let parsed;
                try {
                    parsed = JSON.parse(bodyText);
                }
                catch {
                    sendError(res, 400, 'Invalid JSON body');
                    return;
                }
                if (!isRecord(parsed)) {
                    sendError(res, 400, 'Missing required fields: owner, repo, issueNumber, reason');
                    return;
                }
                const { owner, repo, issueNumber, reason } = parsed;
                if (typeof owner !== 'string' ||
                    typeof repo !== 'string' ||
                    typeof issueNumber !== 'number') {
                    sendError(res, 400, 'Missing required fields: owner, repo, issueNumber, reason');
                    return;
                }
                if (!isValidCloseReason(reason)) {
                    sendError(res, 400, `Invalid reason. Must be one of: ${VALID_CLOSE_REASONS.join(', ')}`);
                    return;
                }
                const result = await this.useCase.closeIssue({
                    owner,
                    repo,
                    issueNumber,
                    reason,
                });
                if (result.ok) {
                    sendJson(res, 200, { ok: true });
                }
                else {
                    sendJson(res, 400, { ok: false, error: result.error });
                }
            }
            catch (_error) {
                void _error;
                sendJson(res, 500, { ok: false, error: 'Internal server error' });
            }
        };
        this.handleImageProxy = async (req, res, urlObj) => {
            void req;
            try {
                const targetUrl = urlObj.searchParams.get('url');
                if (!targetUrl) {
                    sendError(res, 400, 'Missing url parameter');
                    return;
                }
                let decodedUrl;
                try {
                    decodedUrl = decodeURIComponent(targetUrl);
                }
                catch {
                    sendError(res, 400, 'Invalid url encoding');
                    return;
                }
                let parsedTarget;
                try {
                    parsedTarget = new URL(decodedUrl);
                }
                catch {
                    sendError(res, 400, 'Invalid target URL');
                    return;
                }
                const allowedHostnames = [
                    'private-user-images.githubusercontent.com',
                    'user-images.githubusercontent.com',
                    'github.com',
                ];
                if (!allowedHostnames.includes(parsedTarget.hostname)) {
                    sendError(res, 400, `Hostname not allowed: ${parsedTarget.hostname}`);
                    return;
                }
                const { content, contentType } = await this.useCase.fetchImageProxy(decodedUrl);
                res.writeHead(200, {
                    'Content-Type': contentType,
                    'Content-Length': content.length,
                });
                res.end(content);
            }
            catch (_error) {
                void _error;
                sendError(res, 500, 'Internal server error');
            }
        };
        this.handleTriagePage = async (res, projectCode) => {
            const html = buildTriagePageHtml(projectCode);
            sendHtml(res, html);
        };
    }
}
exports.TriageViewerHttpServer = TriageViewerHttpServer;
const escapeHtml = (text) => text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
const escapeJs = (text) => text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
const buildTriagePageHtml = (projectCode) => {
    const escapedProjectCode = escapeHtml(projectCode);
    const escapedProjectCodeJs = escapeJs(projectCode);
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="referrer" content="no-referrer">
<title>Triage - ${escapedProjectCode}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f6f8fa; color: #24292f; }
  header { background: #24292f; color: #fff; padding: 12px 16px; display: flex; align-items: center; gap: 16px; }
  header a { color: #fff; text-decoration: none; font-size: 14px; }
  header a:hover { text-decoration: underline; }
  header h1 { font-size: 16px; font-weight: 600; }
  .container { max-width: 900px; margin: 0 auto; padding: 16px; }
  .issue-card { background: #fff; border: 1px solid #d0d7de; border-radius: 6px; padding: 16px; margin-bottom: 16px; }
  .issue-title { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
  .issue-title a { color: #0969da; text-decoration: none; }
  .issue-title a:hover { text-decoration: underline; }
  .issue-body-toggle { background: none; border: 1px solid #d0d7de; border-radius: 4px; padding: 4px 8px; font-size: 12px; cursor: pointer; margin-bottom: 8px; }
  .issue-body { display: none; background: #f6f8fa; border-radius: 4px; padding: 12px; margin-bottom: 12px; font-size: 14px; line-height: 1.6; overflow-wrap: break-word; }
  .issue-body.visible { display: block; }
  .issue-body pre { background: #fff; border: 1px solid #d0d7de; border-radius: 4px; padding: 8px; overflow-x: auto; }
  .issue-body code { background: rgba(175,184,193,0.2); border-radius: 3px; padding: 0.2em 0.4em; font-size: 85%; }
  .issue-body pre code { background: none; padding: 0; }
  .actions { margin-top: 12px; }
  .story-filter { width: 100%; padding: 6px 10px; border: 1px solid #d0d7de; border-radius: 4px; font-size: 14px; margin-bottom: 8px; }
  .story-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
  .story-chip { display: flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 16px; border: 1px solid #d0d7de; background: #fff; font-size: 13px; cursor: pointer; transition: opacity 0.15s; }
  .story-chip:hover { opacity: 0.8; }
  .story-chip .color-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .color-GRAY { background: #8b949e; }
  .color-BLUE { background: #0969da; }
  .color-GREEN { background: #1a7f37; }
  .color-YELLOW { background: #9a6700; }
  .color-ORANGE { background: #bc4c00; }
  .color-RED { background: #cf222e; }
  .color-PINK { background: #bf3989; }
  .color-PURPLE { background: #8250df; }
  .close-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
  .close-btn { padding: 6px 14px; border-radius: 4px; border: 1px solid #d0d7de; background: #fff; font-size: 13px; cursor: pointer; }
  .close-btn:hover { background: #f6f8fa; }
  .close-btn.completed { border-color: #1a7f37; color: #1a7f37; }
  .close-btn.not-planned { border-color: #8b949e; color: #57606a; }
  .close-btn.duplicate { border-color: #9a6700; color: #9a6700; }
  .toast { position: fixed; bottom: 20px; right: 20px; padding: 12px 16px; border-radius: 6px; color: #fff; font-size: 14px; display: flex; align-items: center; gap: 10px; z-index: 100; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
  .toast.story { background: #0969da; }
  .toast.completed { background: #1a7f37; }
  .toast.not-planned { background: #57606a; }
  .toast.duplicate { background: #9a6700; }
  .toast-undo { background: none; border: 1px solid rgba(255,255,255,0.6); border-radius: 4px; padding: 2px 8px; color: #fff; cursor: pointer; font-size: 12px; }
  .empty-state { text-align: center; padding: 48px 16px; color: #57606a; }
  .loading { text-align: center; padding: 48px 16px; color: #57606a; }
  .hidden { display: none !important; }
</style>
</head>
<body>
<header>
  <a href="/">&larr; Project Issues</a>
  <h1>Triage</h1>
</header>
<div class="container">
  <div id="loading" class="loading">Loading triage data...</div>
  <div id="empty" class="empty-state hidden">No untriaged issues remaining.</div>
  <div id="issue-display" class="hidden">
    <div class="issue-card" id="current-issue-card">
      <div class="issue-title"><a id="issue-link" href="#" target="_blank"></a></div>
      <button class="issue-body-toggle" id="body-toggle">Show body</button>
      <div class="issue-body" id="issue-body-content"></div>
      <div class="actions">
        <input type="text" class="story-filter" id="story-filter" placeholder="Filter stories..." />
        <div class="story-chips" id="story-chips"></div>
        <div class="close-buttons">
          <button class="close-btn completed" id="btn-completed">Close as completed</button>
          <button class="close-btn not-planned" id="btn-not-planned">Close as not planned</button>
          <button class="close-btn duplicate" id="btn-duplicate">Close as duplicate</button>
        </div>
      </div>
    </div>
  </div>
</div>
<div id="undo-toast" class="toast hidden"></div>
<script>
(function() {
  var PROJECT_CODE = '${escapedProjectCodeJs}';
  var accessKey = localStorage.getItem('triage-access-key') || '';

  var issues = [];
  var storyOptions = [];
  var storyFieldId = '';
  var projectId = '';
  var currentIndex = 0;
  var actedIssueNumbers = JSON.parse(localStorage.getItem('triage-acted-' + PROJECT_CODE) || '[]');
  var undoTimer = null;
  var pendingUndo = null;

  function getAuthHeaders() {
    return { 'Authorization': 'Bearer ' + accessKey, 'Content-Type': 'application/json' };
  }

  function markActed(number) {
    if (!actedIssueNumbers.includes(number)) {
      actedIssueNumbers.push(number);
      localStorage.setItem('triage-acted-' + PROJECT_CODE, JSON.stringify(actedIssueNumbers));
    }
  }

  function unmarkActed(number) {
    actedIssueNumbers = actedIssueNumbers.filter(function(n) { return n !== number; });
    localStorage.setItem('triage-acted-' + PROJECT_CODE, JSON.stringify(actedIssueNumbers));
  }

  function getRemainingIssues() {
    return issues.filter(function(issue) { return !actedIssueNumbers.includes(issue.number); });
  }

  function renderIssue(issue) {
    document.getElementById('issue-link').textContent = issue.title;
    document.getElementById('issue-link').href = issue.url;
    var bodyEl = document.getElementById('issue-body-content');
    bodyEl.innerHTML = renderMarkdown(issue.body);
    bodyEl.classList.remove('visible');
    document.getElementById('body-toggle').textContent = 'Show body';
    renderStoryChips('');
    document.getElementById('story-filter').value = '';
  }

  function renderMarkdown(text) {
    if (!text) return '';
    var escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    escaped = escaped.replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, function(_, code) {
      return '<pre><code>' + code + '</code></pre>';
    });
    escaped = escaped.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
    escaped = escaped.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/\\*([^*]+)\\*/g, '<em>$1</em>');
    escaped = escaped.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    escaped = escaped.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    escaped = escaped.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    escaped = escaped.replace(/\\n/g, '<br>');
    return escaped;
  }

  function renderStoryChips(filter) {
    var container = document.getElementById('story-chips');
    container.innerHTML = '';
    var lowerFilter = filter.toLowerCase();
    storyOptions.forEach(function(story) {
      if (filter && !story.name.toLowerCase().includes(lowerFilter)) return;
      var chip = document.createElement('button');
      chip.className = 'story-chip';
      chip.dataset.storyId = story.id;
      var dot = document.createElement('span');
      dot.className = 'color-dot color-' + story.color;
      chip.appendChild(dot);
      chip.appendChild(document.createTextNode(story.name));
      chip.addEventListener('click', function() {
        onStoryChipClick(story.id, story.name);
      });
      container.appendChild(chip);
    });
  }

  function showToast(message, type, onUndo) {
    clearUndoTimer();
    var toast = document.getElementById('undo-toast');
    toast.className = 'toast ' + type;
    toast.innerHTML = '';
    toast.appendChild(document.createTextNode(message + ' '));
    var undoBtn = document.createElement('button');
    undoBtn.className = 'toast-undo';
    undoBtn.textContent = 'Undo';
    undoBtn.addEventListener('click', function() {
      clearUndoTimer();
      toast.classList.add('hidden');
      onUndo();
    });
    toast.appendChild(undoBtn);
    toast.classList.remove('hidden');
    pendingUndo = onUndo;
    undoTimer = setTimeout(function() {
      toast.classList.add('hidden');
      pendingUndo = null;
    }, 5000);
  }

  function clearUndoTimer() {
    if (undoTimer) { clearTimeout(undoTimer); undoTimer = null; }
  }

  function showNext() {
    var remaining = getRemainingIssues();
    if (remaining.length === 0) {
      document.getElementById('issue-display').classList.add('hidden');
      document.getElementById('empty').classList.remove('hidden');
      return;
    }
    if (currentIndex >= remaining.length) currentIndex = 0;
    renderIssue(remaining[currentIndex]);
    document.getElementById('issue-display').classList.remove('hidden');
    document.getElementById('empty').classList.add('hidden');
  }

  function onStoryChipClick(storyOptionId, storyName) {
    var remaining = getRemainingIssues();
    if (remaining.length === 0) return;
    var issue = remaining[currentIndex] || remaining[0];
    markActed(issue.number);
    showToast('Assigned: ' + storyName, 'story', function() {
      unmarkActed(issue.number);
      showNext();
    });
    fetch('/projects/' + encodeURIComponent(PROJECT_CODE) + '/triage/set-story', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ projectId: projectId, storyFieldId: storyFieldId, itemId: issue.itemId, storyOptionId: storyOptionId })
    }).catch(function(err) { console.error('set-story failed:', err); });
    showNext();
  }

  function onCloseClick(reason) {
    var remaining = getRemainingIssues();
    if (remaining.length === 0) return;
    var issue = remaining[currentIndex] || remaining[0];
    markActed(issue.number);
    var label = reason === 'completed' ? 'Closed as completed' : reason === 'not_planned' ? 'Closed as not planned' : 'Closed as duplicate';
    showToast(label, reason.replace('_', '-'), function() {
      unmarkActed(issue.number);
      showNext();
    });
    fetch('/projects/' + encodeURIComponent(PROJECT_CODE) + '/triage/close-issue', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ owner: issue.owner, repo: issue.repo, issueNumber: issue.number, reason: reason })
    }).catch(function(err) { console.error('close-issue failed:', err); });
    showNext();
  }

  document.getElementById('body-toggle').addEventListener('click', function() {
    var bodyEl = document.getElementById('issue-body-content');
    var visible = bodyEl.classList.toggle('visible');
    this.textContent = visible ? 'Hide body' : 'Show body';
  });

  document.getElementById('story-filter').addEventListener('input', function() {
    renderStoryChips(this.value);
  });

  document.getElementById('btn-completed').addEventListener('click', function() { onCloseClick('completed'); });
  document.getElementById('btn-not-planned').addEventListener('click', function() { onCloseClick('not_planned'); });
  document.getElementById('btn-duplicate').addEventListener('click', function() { onCloseClick('duplicate'); });

  fetch('/projects/' + encodeURIComponent(PROJECT_CODE) + '/triage/data', { headers: getAuthHeaders() })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      issues = data.issues || [];
      storyOptions = data.storyOptions || [];
      storyFieldId = data.storyFieldId || '';
      projectId = data.projectId || '';
      document.getElementById('loading').classList.add('hidden');
      showNext();
    })
    .catch(function(err) {
      document.getElementById('loading').textContent = 'Failed to load triage data: ' + err.message;
    });
})();
</script>
</body>
</html>`;
};
//# sourceMappingURL=TriageViewerHttpServer.js.map