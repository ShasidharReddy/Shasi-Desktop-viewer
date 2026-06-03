// app.js — Desktop Viewer renderer (screen share + remote control + file transfer)
;(async () => {

  // ── Settings ──────────────────────────────────────────────────────────────
  const settings = {
    get serverUrl() {
      const ip   = localStorage.getItem('sv_ip')   || 'localhost';
      const port = localStorage.getItem('sv_port')  || '3000';
      return `http://${ip}:${port}`;
    }
  };

  const $ = id => document.getElementById(id);

  // ── Nav ───────────────────────────────────────────────────────────────────
  document.querySelectorAll('.nav-item[data-view]').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      item.classList.add('active');
      $(`view-${item.dataset.view}`).classList.add('active');
    });
  });

  // Settings persistence
  const savedIp = localStorage.getItem('sv_ip');
  const savedPort = localStorage.getItem('sv_port');
  if (savedIp)   $('server-ip').value   = savedIp;
  if (savedPort) $('server-port').value = savedPort;

  $('save-settings-btn').addEventListener('click', () => {
    const ip   = $('server-ip').value.trim();
    const port = $('server-port').value.trim() || '3000';
    if (!ip) { showMsg('settings-msg', 'Enter the server IP first.', 'error'); return; }
    localStorage.setItem('sv_ip', ip);
    localStorage.setItem('sv_port', port);
    showMsg('settings-msg', `Saved. Server: http://${ip}:${port}`, 'success');
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const caps = await window.electronAPI.getCapabilities();
  if (caps.platform !== 'darwin') {
    const tb = document.querySelector('.titlebar');
    if (tb) tb.style.display = 'none';
  }

  function showMsg(id, text, type = 'info') {
    const el = $(id);
    if (!el) return;
    el.textContent = text;
    el.className = `msg msg-${type}`;
    el.style.display = '';
  }
  function hideMsg(id) { const el = $(id); if (el) el.style.display = 'none'; }

  function setDot(dotId, color) {
    const d = $(dotId);
    if (!d) return;
    d.className = `dot${color ? ' ' + color : ''}`;
  }

  function formatBytes(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
    return (b / 1073741824).toFixed(2) + ' GB';
  }

  function fileIcon(name) {
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (['jpg','jpeg','png','gif','webp','svg','bmp','ico'].includes(ext)) return '🖼';
    if (['mp4','mov','avi','mkv','webm','m4v'].includes(ext)) return '🎬';
    if (['mp3','wav','aac','flac','ogg','m4a'].includes(ext)) return '🎵';
    if (['pdf'].includes(ext)) return '📄';
    if (['zip','rar','tar','gz','7z'].includes(ext)) return '🗜';
    if (['js','ts','py','go','java','c','cpp','rs','rb','sh'].includes(ext)) return '📝';
    if (['doc','docx','xls','xlsx','ppt','pptx'].includes(ext)) return '📊';
    return '📎';
  }

  // Load socket.io from signaling server
  let ioLoaded = false;
  async function ensureSocket() {
    if (ioLoaded) return true;
    return new Promise(resolve => {
      const s = document.createElement('script');
      s.src = `${settings.serverUrl}/socket.io/socket.io.js`;
      s.onload  = () => { ioLoaded = true; resolve(true); };
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }

  // ── File Transfer State ───────────────────────────────────────────────────
  const CHUNK_SIZE = 256 * 1024; // 256 KB
  let hostFileChannel   = null;
  let viewerFileChannel = null;
  let activeFileQueue   = [];
  let isSending         = false;
  let incomingFile      = null; // { meta, chunks, receivedBytes }
  let receivedFiles     = [];   // accumulated list

  function getActiveChannel() {
    if (hostFileChannel   && hostFileChannel.readyState   === 'open') return hostFileChannel;
    if (viewerFileChannel && viewerFileChannel.readyState === 'open') return viewerFileChannel;
    return null;
  }

  function setupFileChannel(channel) {
    channel.binaryType = 'arraybuffer';

    channel.onopen = () => {
      console.log('[FileTransfer] channel open');
      onSessionStarted();
    };

    channel.onclose = () => {
      console.log('[FileTransfer] channel closed');
      onSessionEnded();
    };

    channel.onerror = (err) => {
      console.warn('[FileTransfer] channel error', err);
    };

    channel.onmessage = ({ data }) => {
      if (typeof data === 'string') {
        const msg = JSON.parse(data);
        if (msg.type === 'file-meta') {
          incomingFile = { meta: msg, chunks: [], receivedBytes: 0 };
          showReceiveProgress(msg.name, 0);
        } else if (msg.type === 'file-done' && incomingFile) {
          const blob = new Blob(incomingFile.chunks, { type: incomingFile.meta.mimeType });
          addReceivedFile(incomingFile.meta.name, incomingFile.meta.size, blob);
          hideReceiveProgress();
          incomingFile = null;
        }
      } else if (data instanceof ArrayBuffer && incomingFile) {
        incomingFile.chunks.push(data);
        incomingFile.receivedBytes += data.byteLength;
        const pct = Math.min(100, Math.round((incomingFile.receivedBytes / incomingFile.meta.size) * 100));
        showReceiveProgress(incomingFile.meta.name, pct);
      }
    };
  }

  function onSessionStarted() {
    $('files-no-session').style.display = 'none';
    $('files-session').style.display = '';
    updateFilesBadge();
  }

  function onSessionEnded() {
    $('files-no-session').style.display = '';
    $('files-session').style.display = 'none';
    hostFileChannel   = null;
    viewerFileChannel = null;
    activeFileQueue   = [];
    isSending         = false;
    incomingFile      = null;
    updateQueueUI();
    hideSendProgress();
    hideReceiveProgress();
  }

  // ── File queue UI ─────────────────────────────────────────────────────────
  function addFilesToQueue(files) {
    Array.from(files).forEach(f => activeFileQueue.push(f));
    updateQueueUI();
  }

  function updateQueueUI() {
    ['file-queue', 'sv-file-queue'].forEach(qid => {
      const el = $(qid);
      if (!el) return;
      el.innerHTML = '';
      activeFileQueue.forEach((f, i) => {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.innerHTML = `
          <span class="file-item-icon">${fileIcon(f.name)}</span>
          <div class="file-item-info">
            <div class="file-item-name">${f.name}</div>
            <div class="file-item-size">${formatBytes(f.size)}</div>
          </div>
          <span class="file-item-remove" data-idx="${i}">✕</span>`;
        el.appendChild(div);
      });
      el.querySelectorAll('.file-item-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          activeFileQueue.splice(parseInt(btn.dataset.idx), 1);
          updateQueueUI();
        });
      });
    });

    const hasFiles = activeFileQueue.length > 0;
    ['send-files-btn', 'sv-send-files-btn'].forEach(bid => {
      const b = $(bid); if (b) b.disabled = !hasFiles || !getActiveChannel();
    });
    const cq = $('clear-queue-btn');
    if (cq) cq.classList.toggle('hidden', !hasFiles);
  }

  function clearQueue() {
    activeFileQueue = [];
    updateQueueUI();
  }

  // ── Send files ────────────────────────────────────────────────────────────
  async function sendNextFile() {
    if (isSending || activeFileQueue.length === 0) return;
    const channel = getActiveChannel();
    if (!channel) { showFilesMsg('No active connection.', 'error'); return; }

    isSending = true;
    const file = activeFileQueue.shift();
    updateQueueUI();

    try {
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      channel.send(JSON.stringify({
        type: 'file-meta',
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        totalChunks
      }));

      let offset = 0;
      let chunkIndex = 0;
      while (offset < file.size) {
        // Back-pressure: wait if buffer is too full
        while (channel.bufferedAmount > 8 * 1024 * 1024) {
          await new Promise(r => setTimeout(r, 30));
        }
        const slice = file.slice(offset, offset + CHUNK_SIZE);
        const buffer = await slice.arrayBuffer();
        channel.send(buffer);
        offset += CHUNK_SIZE;
        chunkIndex++;
        const pct = Math.min(100, Math.round((chunkIndex / totalChunks) * 100));
        showSendProgress(file.name, pct);
      }

      channel.send(JSON.stringify({ type: 'file-done', name: file.name }));
      hideSendProgress();
      showFilesMsg(`✅ Sent: ${file.name}`, 'success');
    } catch (err) {
      hideSendProgress();
      showFilesMsg(`❌ Failed: ${err.message}`, 'error');
    }

    isSending = false;
    if (activeFileQueue.length > 0) sendNextFile();
  }

  // ── Progress UI ───────────────────────────────────────────────────────────
  function showSendProgress(name, pct) {
    const short = name.length > 32 ? name.slice(0, 29) + '…' : name;
    [['transfer-progress','progress-filename','progress-pct','progress-fill'],
     ['sv-transfer-progress','sv-progress-filename','sv-progress-pct','sv-progress-fill']
    ].forEach(([wrap,fn,pp,pf]) => {
      const w = $(wrap); if (!w) return;
      w.style.display = '';
      $(fn).textContent = short;
      $(pp).textContent = pct + '%';
      $(pf).style.width  = pct + '%';
    });
  }
  function hideSendProgress() {
    [$('transfer-progress'), $('sv-transfer-progress')].forEach(el => { if (el) el.style.display = 'none'; });
  }
  function showReceiveProgress(name, pct) { showSendProgress(name + ' (receiving)', pct); }
  function hideReceiveProgress() { hideSendProgress(); }

  function showFilesMsg(text, type = 'info') {
    ['files-msg','sv-files-msg'].forEach(id => showMsg(id, text, type));
    setTimeout(() => { ['files-msg','sv-files-msg'].forEach(id => hideMsg(id)); }, 4000);
  }

  function updateFilesBadge() {
    const b = $('files-badge');
    if (!b) return;
    if (receivedFiles.length > 0) {
      b.textContent = receivedFiles.length;
      b.classList.remove('hidden');
    } else {
      b.classList.add('hidden');
    }
  }

  // ── Received files ────────────────────────────────────────────────────────
  function addReceivedFile(name, size, blob) {
    receivedFiles.push({ name, size, blob });
    updateFilesBadge();
    showFilesMsg(`📥 Received: ${name}`, 'success');

    ['received-section','sv-received-section'].forEach(id => {
      const sec = $(id); if (sec) sec.style.display = '';
    });

    const item = (listId) => {
      const el = $(listId); if (!el) return;
      const div = document.createElement('div');
      div.className = 'received-item';
      div.innerHTML = `
        <span style="font-size:18px;flex-shrink:0">${fileIcon(name)}</span>
        <div class="received-item-info">
          <div class="received-item-name">${name}</div>
          <div class="received-item-meta">${formatBytes(size)}</div>
        </div>
        <button class="btn-primary save-btn" style="padding:6px 12px;font-size:12px;flex-shrink:0">💾 Save</button>`;
      div.querySelector('.save-btn').addEventListener('click', async () => {
        const buf = await blob.arrayBuffer();
        const result = await window.electronAPI.saveFile(name, buf);
        if (result && result.saved) showFilesMsg(`✅ Saved to ${result.filePath}`, 'success');
        else if (result && !result.saved && !result.error) { /* user cancelled */ }
        else showFilesMsg('❌ Save failed', 'error');
      });
      el.insertBefore(div, el.firstChild);
    };
    item('received-list');
    item('sv-received-list');
  }

  // ── Wire up drop zones ────────────────────────────────────────────────────
  function wireDropZone(zoneId, inputId, sendBtnId) {
    const zone  = $(zoneId);
    const input = $(inputId);
    const btn   = $(sendBtnId);
    if (!zone || !input) return;

    zone.addEventListener('click', () => input.click());
    input.addEventListener('change', () => { addFilesToQueue(input.files); input.value = ''; });

    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      addFilesToQueue(e.dataTransfer.files);
    });

    if (btn) btn.addEventListener('click', sendNextFile);
  }

  wireDropZone('drop-zone',    'file-input',    'send-files-btn');
  wireDropZone('sv-drop-zone', 'sv-file-input', 'sv-send-files-btn');

  const cqBtn = $('clear-queue-btn');
  if (cqBtn) cqBtn.addEventListener('click', clearQueue);

  // ── sv Files side panel ───────────────────────────────────────────────────
  function openSvFilesPanel()  { $('sv-files-panel').style.display = 'flex'; }
  function closeSvFilesPanel() { $('sv-files-panel').style.display = 'none'; }

  $('sv-files-btn')      && $('sv-files-btn').addEventListener('click', openSvFilesPanel);
  $('sv-files-close-btn') && $('sv-files-close-btn').addEventListener('click', closeSvFilesPanel);

  // ── HOST (Share My Screen) ────────────────────────────────────────────────
  let hostSocket = null;
  let hostPeer   = null;
  let hostStream = null;
  let isSharing  = false;

  $('start-share-btn').addEventListener('click', startHostSession);
  $('stop-share-btn').addEventListener('click',  stopHostSession);
  $('open-prefs-btn').addEventListener('click', () => window.electronAPI.openScreenPermission());
  $('restart-btn').addEventListener('click', () => window.electronAPI.promptRestart());

  function showPermBanner(msg, showRestart = false) {
    $('perm-banner-msg').textContent = msg;
    $('perm-banner').style.display = '';
    $('restart-btn').style.display = showRestart ? '' : 'none';
  }
  function hidePermBanner() { $('perm-banner').style.display = 'none'; }

  async function startHostSession() {
    if (!localStorage.getItem('sv_ip')) {
      showMsg('share-msg', 'Go to Settings and enter the server IP first.', 'error');
      return;
    }

    if (caps.platform === 'darwin') {
      let status = await window.electronAPI.checkScreenPermission();
      if (status === 'not-determined') {
        $('start-share-btn').textContent = 'Requesting permission…';
        $('start-share-btn').disabled = true;
        status = await window.electronAPI.requestScreenPermission();
      }
      if (status !== 'granted') {
        $('start-share-btn').disabled = false;
        $('start-share-btn').textContent = '▶ Start Sharing';
        showPermBanner(
          status === 'denied'
            ? 'Screen Recording denied. Open System Settings → Privacy → Screen Recording, enable Desktop Viewer, then restart.'
            : 'Screen Recording permission is required to share your screen.',
          status === 'denied'
        );
        window.electronAPI.openScreenPermission();
        return;
      }
      hidePermBanner();
    }

    $('start-share-btn').disabled = true;
    $('start-share-btn').textContent = 'Connecting…';
    hideMsg('share-msg');

    const ok = await ensureSocket();
    if (!ok) {
      showMsg('share-msg', `Cannot reach server at ${settings.serverUrl}. Is it running?`, 'error');
      $('start-share-btn').disabled = false;
      $('start-share-btn').textContent = '▶ Start Sharing';
      return;
    }

    hostSocket = io(settings.serverUrl, { transports: ['websocket', 'polling'] });

    hostSocket.on('connect_error', () => {
      showMsg('share-msg', `Cannot connect to ${settings.serverUrl}`, 'error');
      $('start-share-btn').disabled = false;
      $('start-share-btn').textContent = '▶ Start Sharing';
      setDot('share-dot', 'red');
      $('share-status-text').textContent = 'Server unreachable';
    });

    hostSocket.on('connect', () => {
      hostSocket.emit('create-room', res => {
        if (!res.code) return;
        $('share-code').textContent = res.code;
        $('share-hint').textContent = 'Share this code with the viewer';
        $('share-status-text').textContent = 'Waiting for viewer…';
        setDot('share-dot', 'yellow');
        $('start-share-btn').classList.add('hidden');
        $('stop-share-btn').classList.remove('hidden');
        isSharing = true;
        showMsg('share-msg', `Server: ${settings.serverUrl}`, 'info');
      });
    });

    hostSocket.on('viewer-joined', async ({ viewerId }) => {
      // Close any stale peer from a previous viewer connection
      if (hostPeer) { hostPeer.close(); hostPeer = null; }
      if (hostStream) { hostStream.getTracks().forEach(t => t.stop()); hostStream = null; }
      $('share-status-text').textContent = 'Viewer connected — starting stream…';
      setDot('share-dot', 'green');
      await beginScreenShare(viewerId);
    });

    hostSocket.on('viewer-left', () => {
      $('share-status-text').textContent = 'Viewer disconnected. Waiting…';
      setDot('share-dot', 'yellow');
      if (hostPeer)   { hostPeer.close(); hostPeer = null; }
      if (hostStream) { hostStream.getTracks().forEach(t => t.stop()); hostStream = null; }
      onSessionEnded();
    });

    hostSocket.on('signal', async ({ from, data }) => {
      if (!hostPeer) return;
      try {
        if (data.type === 'answer') {
          await hostPeer.setRemoteDescription(new RTCSessionDescription(data));
          $('share-status-text').textContent = 'Viewer is watching';
          setDot('share-dot', 'green');
        } else if (data.candidate !== undefined) {
          await hostPeer.addIceCandidate(new RTCIceCandidate(data));
        }
      } catch (_) {}
    });

    hostSocket.on('control', ({ event }) => {
      window.electronAPI.sendControlEvent(event);
    });
  }

  async function beginScreenShare(viewerId) {
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    } catch (err) {
      $('share-status-text').textContent = 'Screen capture error';
      setDot('share-dot', 'red');
      if (caps.platform === 'darwin') {
        showPermBanner('Screen Recording permission was revoked. Enable in System Settings, then restart.', true);
        window.electronAPI.openScreenPermission();
      } else {
        showMsg('share-msg', `Screen capture failed: ${err.message}`, 'error');
      }
      return;
    }
    hostStream = stream;

    hostPeer = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // ── File transfer data channel (host creates it) ──────────────────────
    hostFileChannel = hostPeer.createDataChannel('file-transfer', { ordered: true });
    setupFileChannel(hostFileChannel);

    stream.getTracks().forEach(t => hostPeer.addTrack(t, stream));

    hostPeer.onicecandidate = ({ candidate }) => {
      if (candidate) hostSocket.emit('signal', { to: viewerId, data: candidate.toJSON() });
    };

    hostPeer.onconnectionstatechange = () => {
      if (hostPeer && hostPeer.connectionState === 'failed') {
        $('share-status-text').textContent = 'Connection failed';
        setDot('share-dot', 'red');
      }
    };

    const offer = await hostPeer.createOffer();
    await hostPeer.setLocalDescription(offer);
    hostSocket.emit('signal', { to: viewerId, data: { type: offer.type, sdp: offer.sdp } });
  }

  function stopHostSession() {
    if (hostPeer)   { hostPeer.close();        hostPeer   = null; }
    if (hostStream) { hostStream.getTracks().forEach(t => t.stop()); hostStream = null; }
    if (hostSocket) { hostSocket.disconnect(); hostSocket = null; }
    isSharing = false;
    $('share-code').textContent       = '——————';
    $('share-hint').textContent       = 'Click "Start Sharing" to generate a code';
    $('share-status-text').textContent = 'Not sharing';
    setDot('share-dot', '');
    $('start-share-btn').textContent   = '▶ Start Sharing';
    $('start-share-btn').disabled      = false;
    $('start-share-btn').classList.remove('hidden');
    $('stop-share-btn').classList.add('hidden');
    hideMsg('share-msg');
    onSessionEnded();
  }

  // ── VIEWER (Connect to Remote) ────────────────────────────────────────────
  let viewerSocket = null;
  let viewerPeer   = null;
  let hostSocketId = null;
  let remoteControl = false;

  $('connect-btn').addEventListener('click', startViewerSession);
  $('room-code-input').addEventListener('keydown', e => { if (e.key === 'Enter') startViewerSession(); });
  $('disconnect-btn').addEventListener('click', stopViewerSession);
  $('sv-disconnect-btn').addEventListener('click', stopViewerSession);

  async function startViewerSession() {
    const code = $('room-code-input').value.trim().toUpperCase();
    if (code.length !== 6) { showMsg('connect-msg', 'Enter the 6-character room code.', 'error'); return; }

    if (!localStorage.getItem('sv_ip')) {
      showMsg('connect-msg', 'Go to Settings and enter the server IP first.', 'error');
      return;
    }

    $('connect-btn').disabled = true;
    $('connect-btn').textContent = 'Connecting…';
    hideMsg('connect-msg');

    const ok = await ensureSocket();
    if (!ok) {
      showMsg('connect-msg', `Cannot reach server at ${settings.serverUrl}`, 'error');
      $('connect-btn').disabled = false;
      $('connect-btn').textContent = '🔗 Connect';
      return;
    }

    viewerSocket = io(settings.serverUrl, { transports: ['websocket', 'polling'] });

    viewerSocket.on('connect_error', () => {
      showMsg('connect-msg', `Cannot connect to ${settings.serverUrl}`, 'error');
      $('connect-btn').disabled = false;
      $('connect-btn').textContent = '🔗 Connect';
    });

    viewerSocket.on('connect', () => {
      viewerSocket.emit('join-room', { code }, res => {
        if (res.error) {
          showMsg('connect-msg', res.error, 'error');
          $('connect-btn').disabled = false;
          $('connect-btn').textContent = '🔗 Connect';
          viewerSocket.disconnect();
          return;
        }
        hostSocketId = res.hostId;
        $('connect-btn').classList.add('hidden');
        $('disconnect-btn').classList.remove('hidden');
        showMsg('connect-msg', 'Joined room. Waiting for stream from host…', 'info');
      });
    });

    viewerSocket.on('signal', async ({ from, data }) => {
      if (data.type === 'offer') {
        await handleViewerOffer(from, data);
      } else if (data.candidate !== undefined && viewerPeer) {
        try { await viewerPeer.addIceCandidate(new RTCIceCandidate(data)); } catch (_) {}
      }
    });

    viewerSocket.on('host-disconnected', () => {
      $('sv-status').textContent = 'Host disconnected';
      $('sv-badge').className = 'badge badge-error';
      if (viewerPeer) { viewerPeer.close(); viewerPeer = null; }
      onSessionEnded();
    });
  }

  async function handleViewerOffer(from, offer) {
    viewerPeer = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // ── File transfer data channel (viewer receives it) ───────────────────
    viewerPeer.ondatachannel = ({ channel }) => {
      viewerFileChannel = channel;
      setupFileChannel(viewerFileChannel);
    };

    viewerPeer.ontrack = ({ streams }) => {
      if (!streams || !streams[0]) return;
      $('remote-video').srcObject = streams[0];
      showScreenView();
    };

    viewerPeer.onicecandidate = ({ candidate }) => {
      if (candidate) viewerSocket.emit('signal', { to: from, data: candidate.toJSON() });
    };

    viewerPeer.onconnectionstatechange = () => {
      const s = viewerPeer.connectionState;
      if (s === 'connected') {
        $('sv-status').textContent = 'Connected';
        $('sv-badge').className = 'badge badge-connected';
      } else if (s === 'disconnected' || s === 'failed') {
        $('sv-status').textContent = 'Connection lost';
        $('sv-badge').className = 'badge badge-error';
      }
    };

    await viewerPeer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await viewerPeer.createAnswer();
    await viewerPeer.setLocalDescription(answer);
    viewerSocket.emit('signal', { to: from, data: { type: answer.type, sdp: answer.sdp } });

    if (caps.remoteControl) {
      $('sv-control-wrap').classList.remove('hidden');
    }
  }

  function showScreenView() {
    $('screen-view').classList.add('show');
    $('sv-files-btn').classList.remove('hidden');
  }

  function hideScreenView() {
    $('screen-view').classList.remove('show');
    $('remote-video').srcObject = null;
    $('sv-files-btn').classList.add('hidden');
    closeSvFilesPanel();
  }

  function stopViewerSession() {
    if (viewerPeer)   { viewerPeer.close();       viewerPeer   = null; }
    if (viewerSocket) { viewerSocket.disconnect(); viewerSocket = null; }
    hideScreenView();
    $('connect-btn').disabled = false;
    $('connect-btn').textContent = '🔗 Connect';
    $('connect-btn').classList.remove('hidden');
    $('disconnect-btn').classList.add('hidden');
    $('sv-control-wrap').classList.add('hidden');
    $('sv-control-chk').checked = false;
    remoteControl = false;
    $('remote-video').classList.remove('control-mode');
    hideMsg('connect-msg');
    onSessionEnded();
  }

  // ── Remote control ────────────────────────────────────────────────────────
  $('sv-control-chk').addEventListener('change', e => {
    remoteControl = e.target.checked;
    $('remote-video').classList.toggle('control-mode', remoteControl);
  });

  function sendCtrl(type, extra = {}) {
    if (!remoteControl || !viewerSocket || !hostSocketId) return;
    viewerSocket.emit('control', { to: hostSocketId, event: { type, ...extra } });
  }

  const vid = $('remote-video');
  vid.addEventListener('mousemove', e => {
    const r = vid.getBoundingClientRect();
    sendCtrl('mousemove', { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
  });
  vid.addEventListener('mousedown', e => {
    e.preventDefault();
    const r = vid.getBoundingClientRect();
    sendCtrl('mousedown', { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, button: e.button });
  });
  vid.addEventListener('mouseup', e => {
    const r = vid.getBoundingClientRect();
    sendCtrl('mouseup', { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, button: e.button });
  });
  vid.addEventListener('dblclick', e => {
    const r = vid.getBoundingClientRect();
    sendCtrl('dblclick', { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, button: e.button });
  });
  vid.addEventListener('contextmenu', e => e.preventDefault());
  vid.addEventListener('wheel', e => {
    e.preventDefault();
    sendCtrl('scroll', { deltaX: Math.round(e.deltaX / 8), deltaY: Math.round(e.deltaY / 8) });
  }, { passive: false });
  window.addEventListener('keydown', e => {
    if (!remoteControl) return;
    e.preventDefault();
    const mods = [];
    if (e.ctrlKey)  mods.push('ctrl');
    if (e.altKey)   mods.push('alt');
    if (e.shiftKey) mods.push('shift');
    if (e.metaKey)  mods.push('meta');
    sendCtrl('keydown', { key: e.key, modifiers: mods });
  });
  window.addEventListener('keyup', e => {
    if (!remoteControl) return;
    sendCtrl('keyup', { key: e.key, modifiers: [] });
  });

})();
