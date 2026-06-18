const image = document.getElementById("cover");
const title = document.getElementById("title");
const artistLink = document.getElementById("artist-link");
const albumLink = document.getElementById("album-link");
const year = document.getElementById("year");
const fetchProgressContainer = document.getElementById("fetch-progress-container");
const fetchProgressBar = document.getElementById("fetch-progress-bar");
const progressArea = document.getElementById("progress-area");
const controls = document.getElementById("controls");
const background = document.getElementById("background");
const artworkContainer = document.querySelector(".artwork-container");

const music = document.getElementById("audio");


const progressContainer = document.getElementById("progress-container");
const progress = document.getElementById("progress");
const currentTimeEle = document.getElementById("current-time");
const durationEle = document.getElementById("duration");

const playBtn = document.getElementById("play");

// Audio Analyzer setup
let audioCtx;
let analyserNode;
let mediaSourceNode;
let visualizerDataArray;
let isAnalyzerSetup = false;
let animationFrameId;

function setupAudioAnalyzer() {
  if (isAnalyzerSetup) return;

  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  try {
    mediaSourceNode = audioCtx.createMediaElementSource(music);
    analyserNode = audioCtx.createAnalyser();
    analyserNode.fftSize = 128; // 64 frequency bins

    mediaSourceNode.connect(analyserNode);
    analyserNode.connect(audioCtx.destination);

    const bufferLength = analyserNode.frequencyBinCount;
    visualizerDataArray = new Uint8Array(bufferLength);

    isAnalyzerSetup = true;
  } catch (err) {
    console.warn("Could not setup audio analyzer:", err);
  }
}

// Visualizer is now hardcoded in HTML, so we don't need to generate it.

function updateVisualizer() {
  if (!isPlaying) return;

  const bars = document.querySelectorAll(".lcd-bar");
  if (bars.length > 0) {
    let useFake = true;

    if (isAnalyzerSetup && analyserNode) {
      useFake = false; // Always trust the analyzer if it's setup (even for silence)
      analyserNode.getByteFrequencyData(visualizerDataArray);
    }

    bars.forEach((bar, index) => {
      let val = 0;
      if (useFake) {
        // Fake frequency bounce if CORS blocks Web Audio API
        val = Math.random() * 200 + 20; // Random value between 20 and 220
      } else {
        // Use bins 0 to 31 (skip higher frequencies for better visuals)
        val = visualizerDataArray[index] || 0;
      }
      // Normalize 0-255 to 0.05-1.0
      const scale = Math.max(0.05, val / 255);
      bar.style.transform = `scaleY(${scale})`;
    });
  }

  // Throttle animation to make it look like a chunky LCD screen update (~15fps)
  setTimeout(() => {
    animationFrameId = requestAnimationFrame(updateVisualizer);
  }, 60);
}


var getUrlString = location.href;
var url = new URL(getUrlString);

const songs = [
  {
    mp3link: url.searchParams.get('link'),
    cover: url.searchParams.get('cover') || './img/logo.png',
    displayName: url.searchParams.get('name') || '',
    artist: url.searchParams.get('artist') || '',
    album: '',
    year: ''
  }
];

let songIndex = 0;
let isPlaying = false;

function togglePlay() {
  if (isPlaying) {
    pauseSong();
  } else {
    playSong();
  }
}

function prevSong() {
  songIndex--;
  if (songIndex < 0) songIndex = songs.length - 1;
  loadSong(songs[songIndex]);
  if (isPlaying) playSong();
}

function nextSong() {
  songIndex++;
  if (songIndex > songs.length - 1) songIndex = 0;
  loadSong(songs[songIndex]);
  if (isPlaying) playSong();
}

let playTimeout;

function playSong() {
  isPlaying = true;
  playBtn.classList.replace("fa-play", "fa-pause");
  playBtn.classList.add("pressed");
  playBtn.setAttribute("title", "Pause");
  controls.classList.add("playing");

  clearTimeout(playTimeout);
  playTimeout = setTimeout(() => {
    if (isPlaying) {
      music.play().then(() => {
        setupAudioAnalyzer();
        cancelAnimationFrame(animationFrameId);
        updateVisualizer();
      }).catch(e => console.error("Playback failed:", e));
      const lcdEq = document.getElementById("lcd-eq");
      if (lcdEq) lcdEq.classList.add("playing");
    }
  }, 1000);
}

function pauseSong() {
  isPlaying = false;
  playBtn.classList.replace("fa-pause", "fa-play");
  playBtn.classList.remove("pressed");
  playBtn.setAttribute("title", "Play");
  controls.classList.remove("playing");

  const lcdEq = document.getElementById("lcd-eq");
  if (lcdEq) lcdEq.classList.remove("playing");
  cancelAnimationFrame(animationFrameId);

  clearTimeout(playTimeout);
  music.pause();
}

playBtn.addEventListener("click", () => (isPlaying ? pauseSong() : playSong()));

function loadSong(song) {
  title.classList.remove('loading-text');
  title.textContent = song.displayName;

  if (artistLink) {
    artistLink.textContent = song.artist || "";
    if (song.displayName === '未找到歌曲') {
      artistLink.removeAttribute("href");
      artistLink.style.pointerEvents = "none";
    } else {
      artistLink.href = song.artist ? `https://www.google.com/search?q=${encodeURIComponent(song.artist)}` : "#";
      artistLink.style.pointerEvents = "auto";
    }
  }

  if (albumLink) {
    albumLink.textContent = song.album || "";
    if (song.displayName === '未找到歌曲') {
      albumLink.removeAttribute("href");
      albumLink.style.pointerEvents = "none";
    } else {
      const albumQuery = [song.artist, song.album, song.year].filter(Boolean).join(" ");
      albumLink.href = albumQuery ? `https://www.google.com/search?q=${encodeURIComponent(albumQuery)}` : "#";
      albumLink.style.pointerEvents = "auto";
    }
  }

  if (year) year.textContent = song.year || "";

  // Only set the src if it has changed to prevent interrupting playback
  if (music.getAttribute("src") !== song.mp3link) {
    music.src = `${song.mp3link}`;
  }

  if (song.cover && song.cover !== './img/logo.png') {
    image.src = `${song.cover}`;
    image.style.display = 'block';
    document.getElementById('default-cover').style.display = 'none';
    document.querySelector('.artwork-container').classList.add('has-cover');
    if (background) background.style.backgroundImage = `url(${song.cover})`;
  } else {
    artistLink.style.pointerEvents = 'none';
  }

  // Default Cover Handling
  const defaultCover = document.getElementById('default-cover');
  if (!(song.cover && song.cover !== './img/logo.png')) {
    image.style.display = 'none';
    defaultCover.style.display = 'flex';
    document.querySelector('.artwork-container').classList.remove('has-cover');
    if (background) background.style.backgroundImage = 'none';
  }

  // Update OS Media Session (Lock screen controls on iOS/Android)
  if ('mediaSession' in navigator && window.MediaMetadata) {
    try {
      let coverUrl = song.cover && song.cover !== './img/logo.png' ? song.cover : '';

      // Create an absolute URL if it's a relative logo path, otherwise use the data URI
      if (!coverUrl) {
        coverUrl = new URL('./img/logo.png', window.location.href).href;
      }

      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.displayName === '未找到歌曲' ? 'Music Share' : song.displayName,
        artist: song.artist === '請在網址後方加上 ?link=音檔網址' ? '' : song.artist,
        album: song.album || 'Music Share',
        artwork: coverUrl ? [
          { src: coverUrl, sizes: '512x512', type: 'image/png' },
          { src: coverUrl, sizes: '512x512', type: 'image/jpeg' }
        ] : []
      });
    } catch (e) {
      console.warn('MediaSession error:', e);
    }
  }
}



loadSong(songs[songIndex]);

function showControls() {
  if (fetchProgressContainer) {
    fetchProgressContainer.style.display = 'none';
  }
  const bottomSection = document.getElementById("bottom-section");
  if (bottomSection) {
    setTimeout(() => {
      bottomSection.style.gridTemplateRows = '1fr';
      bottomSection.style.opacity = '1';
      bottomSection.style.pointerEvents = 'auto';
      if (background) background.classList.add('expanded');

      const topNav = document.getElementById("top-nav");
      if (topNav) {
        topNav.classList.add('show');
      }
    }, 50);
  }
}

// Fetch Metadata via jsmediatags with fetch fallback
if (songs[0].mp3link) {
  title.classList.add('loading-text');
  title.textContent = '歌曲加載中 ……';
  if (fetchProgressContainer) {
    fetchProgressContainer.style.display = 'block';
  }

  const jsmediatags = window.jsmediatags;

  const processTag = function (tag) {
    const tags = tag.tags;

    songs[0].displayName = tags.title || (songs[0].displayName === '' ? '未找到歌曲' : songs[0].displayName);
    songs[0].artist = tags.artist || (songs[0].artist === '' ? '未知歌手' : songs[0].artist);
    songs[0].album = tags.album || '';
    songs[0].year = tags.year || '';

    if (tags.picture) {
      const data = tags.picture.data;
      const format = tags.picture.format;
      const byteArray = new Uint8Array(data);
      const blob = new Blob([byteArray], { type: format });

      const reader = new FileReader();
      reader.onload = function (e) {
        songs[0].cover = e.target.result;
        if (songIndex === 0) {
          showControls();
          loadSong(songs[0]);
        }
      };
      reader.readAsDataURL(blob);
    } else {
      if (songIndex === 0) {
        showControls();
        loadSong(songs[0]);
      }
    }
  };

  const processError = function (error) {
    console.log('Error reading tags:', error);
    title.classList.remove('loading-text');
    if (songs[0].displayName === '') {
      songs[0].displayName = '無法解析歌曲資訊';
      songs[0].artist = '系統無法讀取該音檔的標籤';
      if (songIndex === 0) {
        showControls();
        loadSong(songs[0]);
      }
    } else {
      if (songIndex === 0) showControls();
    }
  };

  async function fetchWithResume(url, maxRetries) {
    let chunks = [];
    let downloadedBytes = 0;
    let totalBytes = 0;
    let retries = 0;

    while (retries <= maxRetries) {
      try {
        const headers = {};
        if (downloadedBytes > 0) {
          headers['Range'] = `bytes=${downloadedBytes}-`;
          title.textContent = `網路不穩，重新連線中...`;
        }

        const response = await fetch(url, { headers });

        if (!response.ok && response.status !== 206 && response.status !== 416) {
          throw new Error(`HTTP Error: ${response.status}`);
        }

        if (response.status === 416) {
          // Range not satisfiable, meaning we probably downloaded everything already
          return new Blob(chunks);
        }

        if (totalBytes === 0) {
          const contentRange = response.headers.get('content-range');
          if (contentRange) {
            totalBytes = parseInt(contentRange.split('/')[1], 10);
          } else {
            const contentLength = response.headers.get('content-length');
            totalBytes = contentLength ? parseInt(contentLength, 10) + downloadedBytes : 0;
          }
        }

        // If server doesn't support range requests and it's a retry, we must restart
        if (retries > 0 && response.status === 200 && downloadedBytes > 0) {
          console.warn("Server doesn't support Range requests. Restarting download.");
          chunks = [];
          downloadedBytes = 0;
        }

        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          if (title.textContent.includes('網路不穩')) {
            title.textContent = '歌曲加載中 ……'; // restore text on success
          }
          chunks.push(value);
          downloadedBytes += value.length;

          if (totalBytes && fetchProgressBar) {
            const percent = (downloadedBytes / totalBytes) * 100;
            fetchProgressBar.style.width = `${percent}%`;
          }
        }

        return new Blob(chunks);

      } catch (error) {
        retries++;
        console.warn(`Download interrupted. Retrying (${retries}/${maxRetries})...`, error);
        if (retries > maxRetries) throw error;

        title.textContent = `網路不穩，等待重連 (${retries}/${maxRetries})...`;
        await new Promise(r => setTimeout(r, 1000 * retries)); // Exponential backoff
      }
    }
  }

  const loadAndParseMetadata = async () => {
    // 1. Initial attempt using direct URL (Skip for GitHub raw due to lack of OPTIONS support)
    const isGitHubRaw = songs[0].mp3link.includes('raw.githubusercontent.com');
    if (!isGitHubRaw) {
      try {
        await new Promise((resolve, reject) => {
          jsmediatags.read(songs[0].mp3link, {
            onSuccess: (tag) => {
              processTag(tag);
              resolve();
            },
            onError: reject
          });
        });
        return; // Success!
      } catch (error) {
        console.log('Range request failed, falling back to robust fetch...', error);
      }
    }

    // 2. Fallback to robust resumable download
    if (fetchProgressContainer) {
      fetchProgressContainer.style.display = 'block';
      title.textContent = '歌曲加載中 ……';
    }

    const cacheBusterUrl = songs[0].mp3link + (songs[0].mp3link.includes('?') ? '&' : '?') + 'cors=' + Date.now();
    let blob = null;

    try {
      blob = await fetchWithResume(cacheBusterUrl, 3); // 3 retries
      
      // FIX: Since we already downloaded the full file into memory to parse ID3 tags,
      // we can convert it into a Blob URL. This prevents the <audio> element from 
      // making a second network request to stream the file again!
      songs[0].mp3link = URL.createObjectURL(blob);
      
    } catch (err) {
      console.error('All fetch retries failed:', err);
      if (fetchProgressContainer) fetchProgressContainer.style.display = 'none';
      processError(err);
      return;
    }

    // 3. Retry parsing on the downloaded blob
    title.textContent = '歌曲信息解析中 ……';

    let parsed = false;
    for (let parseAttempt = 1; parseAttempt <= 2; parseAttempt++) {
      try {
        await new Promise((resolve, reject) => {
          jsmediatags.read(blob, {
            onSuccess: (tag) => {
              processTag(tag);
              parsed = true;
              resolve();
            },
            onError: reject
          });
        });
        if (parsed) break;
      } catch (err) {
        console.warn(`Blob parse attempt ${parseAttempt} failed:`, err);
        if (parseAttempt === 2) {
          processError(err);
        } else {
          title.textContent = '解析失敗，重試中...';
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
  };

  loadAndParseMetadata();
} else {
  if (songs[0].displayName === '') {
    songs[0].displayName = '請輸入歌曲來源';
    songs[0].artist = '';
    loadSong(songs[0]);
    const inputContainer = document.getElementById("url-input-container");
    if (inputContainer) {
      inputContainer.style.display = "flex";
    }
    const playBtnWrapper = document.getElementById("url-play-btn-wrapper");
    if (playBtnWrapper) {
      playBtnWrapper.style.display = "flex";
    }
  }
}

let isDragging = false;

function updateProgressBar(e) {
  if (isDragging) return;
  const { duration, currentTime } = e.srcElement;
  if (isNaN(duration)) return;

  const progressPercent = (currentTime / duration) * 100;
  progress.style.width = `${progressPercent}%`;

  const durationMinutes = Math.floor(duration / 60);
  let durationSeconds = Math.floor(duration % 60);
  if (durationSeconds < 10) {
    durationSeconds = `0${durationSeconds}`;
  }
  if (durationSeconds) {
    durationEle.textContent = `${durationMinutes}:${durationSeconds}`;
  }

  const currentMinutes = Math.floor(currentTime / 60);
  let currentSeconds = Math.floor(currentTime % 60);
  if (currentSeconds < 10) {
    currentSeconds = `0${currentSeconds}`;
  }
  currentTimeEle.textContent = `${currentMinutes}:${currentSeconds}`;
}

function updateProgressFromEvent(e) {
  const rect = progressContainer.getBoundingClientRect();
  let clientX;
  if (e.touches && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
  } else if (e.changedTouches && e.changedTouches.length > 0) {
    clientX = e.changedTouches[0].clientX;
  } else {
    clientX = e.clientX;
  }

  let offsetX = clientX - rect.left;
  offsetX = Math.max(0, Math.min(offsetX, rect.width));

  const width = rect.width;
  const { duration } = music;

  if (!isNaN(duration)) {
    const progressPercent = (offsetX / width) * 100;
    progress.style.width = `${progressPercent}%`;

    const seekTime = (offsetX / width) * duration;
    const currentMinutes = Math.floor(seekTime / 60);
    let currentSeconds = Math.floor(seekTime % 60);
    if (currentSeconds < 10) currentSeconds = `0${currentSeconds}`;
    currentTimeEle.textContent = `${currentMinutes}:${currentSeconds}`;

    return seekTime;
  }
  return null;
}

progressContainer.addEventListener("mousedown", (e) => {
  isDragging = true;
  updateProgressFromEvent(e);
});

progressContainer.addEventListener("touchstart", (e) => {
  isDragging = true;
  updateProgressFromEvent(e);
}, { passive: true });

document.addEventListener("mousemove", (e) => {
  if (isDragging) {
    e.preventDefault();
    updateProgressFromEvent(e);
  }
}, { passive: false });

document.addEventListener("touchmove", (e) => {
  if (isDragging) {
    updateProgressFromEvent(e);
  }
}, { passive: true });

const stopDragging = (e) => {
  if (isDragging) {
    const seekTime = updateProgressFromEvent(e);
    if (seekTime !== null) music.currentTime = seekTime;
    isDragging = false;
  }
};

document.addEventListener("mouseup", stopDragging);
document.addEventListener("touchend", stopDragging);

// event listeners for buttons

music.addEventListener("timeupdate", updateProgressBar);
music.addEventListener("ended", nextSong);

// Tab Switching & Upload Logic
const mainActionBtn = document.getElementById("main-action-btn");
const localUploadInput = document.getElementById("local-upload-input");
const fakeFileInputWrapper = document.getElementById("fake-file-input-wrapper");
const fakeFileInput = document.getElementById("fake-file-input");
const urlInputEl = document.getElementById("song-url-input");

const tabUrl = document.getElementById("tab-url");
const tabLocal = document.getElementById("tab-local");
const modeUrl = document.getElementById("mode-url");
const modeLocal = document.getElementById("mode-local");
let currentMode = 'url';

if (mainActionBtn && localUploadInput) {
  if (tabUrl && tabLocal) {
    tabUrl.addEventListener("click", () => {
      currentMode = 'url';
      tabUrl.classList.add("active");
      tabLocal.classList.remove("active");
      modeUrl.classList.add("active");
      modeLocal.classList.remove("active");
    });

    tabLocal.addEventListener("click", () => {
      currentMode = 'local';
      tabLocal.classList.add("active");
      tabUrl.classList.remove("active");
      modeLocal.classList.add("active");
      modeUrl.classList.remove("active");
    });
  }

  if (fakeFileInputWrapper) {
    fakeFileInputWrapper.addEventListener("click", () => {
      localUploadInput.click();
    });
  }

  // Main Action Button Handler
  mainActionBtn.addEventListener("click", () => {
    if (currentMode === 'url') {
      const urlInput = urlInputEl ? urlInputEl.value.trim() : "";
      if (urlInput) {
        processUrl(urlInput);
      } else {
        showToast("請輸入音頻網址！");
      }
    } else {
      if (localUploadInput.files && localUploadInput.files.length > 0) {
        processLocalFile(localUploadInput.files[0]);
      } else {
        showToast("請點擊上方選擇本機檔案！");
      }
    }
  });

  function processUrl(urlInput) {
    try {
      new URL(urlInput);
    } catch (e) {
      showToast("無效的網址！請確認包含 http:// 或 https://");
      return;
    }

    mainActionBtn.classList.add("active-led", "pressed");
    mainActionBtn.disabled = true;
    const span = mainActionBtn.querySelector('span');
    if (span) {
      span.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> 讀取中...';
    }
    setTimeout(() => {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('link', urlInput);
      window.location.href = newUrl.href;
    }, 2000);
  }

  function processLocalFile(file) {
    const passwordInput = document.getElementById('upload-password-input');
    const password = passwordInput ? passwordInput.value : '';

    mainActionBtn.classList.add("active-led", "pressed");
    mainActionBtn.disabled = true;
    const span = mainActionBtn.querySelector('span');
    if (span) {
      span.innerHTML = '<i class="fa-solid fa-cloud-arrow-up fa-bounce"></i> 上傳中...';
    }

    const formData = new FormData();
    formData.append('musicFile', file);
    formData.append('password', password);

    fetch('/upload', {
      method: 'POST',
      body: formData
    })
    .then(response => {
      if (response.status === 401) {
        throw new Error('UNAUTHORIZED');
      }
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      return response.json();
    })
    .then(data => {
      if (data.url) {
        // Construct the full URL for sharing
        const serverUrl = new URL(data.url, window.location.origin).href;
        
        // Append it to the query string and reload so it's shareable
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('link', serverUrl);
        newUrl.searchParams.set('name', file.name.replace(/\.[^/.]+$/, ""));
        window.location.href = newUrl.href;
      }
    })
    .catch(error => {
      console.error('Error uploading file:', error);
      if (error.message === 'UNAUTHORIZED') {
        showToast('密碼錯誤，拒絕上傳！');
      } else {
        showToast('上傳失敗，請確認伺服器已啟動！');
      }
      mainActionBtn.classList.remove("active-led", "pressed");
      mainActionBtn.disabled = false;
      if (span) {
        span.innerHTML = '<i class="fa-solid fa-play"></i> 播放';
      }
    });
  }

  // Local file input change handler: only update the fake input text
  if (localUploadInput) {
    localUploadInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file && fakeFileInput) {
        fakeFileInput.value = file.name;
      }
    });
  }

  // Add enter key support for URL input
  if (urlInputEl) {
    urlInputEl.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        mainActionBtn.click();
      }
    });
  }
}

// Global Toast Logic
const toast = document.getElementById("toast");
let toastTimeout;

function showToast(message) {
  if (!toast) return;
  if (typeof message === 'string') {
    toast.textContent = message;
  } else {
    toast.textContent = "已複製網址到剪貼簿！";
  }
  toast.classList.add("show");
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

// Share Button Handler
const shareBtn = document.getElementById("share-btn");

if (shareBtn && toast) {

  const fallbackCopyTextToClipboard = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      if (document.execCommand('copy')) showToast();
    } catch (err) {
      console.error('Fallback: Oops, unable to copy', err);
    }
    document.body.removeChild(textArea);
  };

  shareBtn.addEventListener("click", () => {
    const urlToCopy = window.location.href;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(urlToCopy)
        .then(showToast)
        .catch((err) => {
          console.warn('Clipboard API failed, using fallback: ', err);
          fallbackCopyTextToClipboard(urlToCopy);
        });
    } else {
      fallbackCopyTextToClipboard(urlToCopy);
    }
  });
}

// Home Button Handler
const homeBtn = document.getElementById("home-btn");
if (homeBtn) {
  homeBtn.addEventListener("click", () => {
    window.location.href = window.location.pathname;
  });
}

// --- Physical Button Click Sound Synthesis ---

function playClickSound() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const t = audioCtx.currentTime;

  // 1. High frequency noise burst for the mechanical "click" contact
  const bufferSize = audioCtx.sampleRate * 0.02; // 20ms of noise
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noiseSource = audioCtx.createBufferSource();
  noiseSource.buffer = buffer;

  const noiseFilter = audioCtx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = 5000;
  noiseFilter.Q.value = 1;

  const noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(1.5, t);
  noiseGain.gain.setTargetAtTime(0, t, 0.005); // extremely rapid decay

  noiseSource.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(audioCtx.destination);
  noiseSource.start(t);

  // 2. Low frequency thud for the plastic/metal body resonance
  const osc = audioCtx.createOscillator();
  const oscGain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(80, t); // constant low pitch

  oscGain.gain.setValueAtTime(0.4, t);
  oscGain.gain.setTargetAtTime(0, t, 0.01); // fast decay

  const oscFilter = audioCtx.createBiquadFilter();
  oscFilter.type = 'lowpass';
  oscFilter.frequency.value = 600;

  osc.connect(oscFilter);
  oscFilter.connect(oscGain);
  oscGain.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + 0.05);
}

// --- Touch Screen Sound Synthesis (LCD Screen) ---
function playTouchSound() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const t = audioCtx.currentTime;

  // Short electronic "tick" for touch screen
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(1000, t); // High pitch beep
  osc.frequency.exponentialRampToValueAtTime(300, t + 0.05); // Quick pitch drop

  // Very short, snappy envelope
  gainNode.gain.setValueAtTime(0, t);
  gainNode.gain.linearRampToValueAtTime(0.15, t + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  osc.start(t);
  osc.stop(t + 0.06);
}

// Attach physical sound to all buttons
document.addEventListener('mousedown', (e) => {
  // LCD Touch Screen elements
  const touchElem = e.target.closest('.tab-btn, #fake-file-input-wrapper, #fake-file-input');
  if (touchElem) {
    playTouchSound();
    return; // Prevent physical sound
  }

  // Physical buttons
  const btn = e.target.closest('button, .nav-btn, .url-play-btn-physical, .btn-play');
  if (btn && !btn.disabled && !btn.classList.contains('active-led')) {
    playClickSound();
  }
});

// --- Volume Control ---
const volumeSlider = document.getElementById('volume-slider');

if (volumeSlider) {
  music.volume = volumeSlider.value;

  volumeSlider.addEventListener('input', (e) => {
    music.volume = e.target.value;

    // Play a lighter click sound for the slider detents
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const oscGain = audioCtx.createGain();
    const oscFilter = audioCtx.createBiquadFilter();

    osc.type = 'square';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.02);

    oscFilter.type = 'bandpass';
    oscFilter.frequency.value = 1500;

    oscGain.gain.setValueAtTime(0.3, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.02);

    osc.connect(oscFilter);
    oscFilter.connect(oscGain);
    oscGain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.03);
  });
}
