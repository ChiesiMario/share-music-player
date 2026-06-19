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
    analyserNode.fftSize = 256; // 128 frequency bins
    analyserNode.smoothingTimeConstant = 0.8; // Smoother visual bouncing

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

    const numBars = bars.length;

    bars.forEach((bar, index) => {
      let val = 0;
      if (useFake) {
        // Fake frequency bounce if CORS blocks Web Audio API
        val = Math.random() * 200 + 20; // Random value between 20 and 220
      } else {
        // Logarithmic mapping: concentrate more bars on the low end (bass/kick)
        const minBin = 1;
        const maxBin = 80;
        
        const ratio = index / (numBars - 1);
        const logMin = Math.log(minBin);
        const logMax = Math.log(maxBin);
        const binIndex = Math.floor(Math.exp(logMin + ratio * (logMax - logMin)));
        
        val = visualizerDataArray[binIndex] || 0;
        
        // Dynamic Energy Boost: Increase contrast for stronger beats
        val = Math.pow(val / 255, 1.5) * 255;
      }
      // Normalize 0-255 to 0.05-1.0
      const scale = Math.max(0.05, val / 255);
      bar.style.transform = `scaleY(${scale})`;
    });
  }

  // Fluid 60fps rendering
  animationFrameId = requestAnimationFrame(updateVisualizer);
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
let currentSongDuration = 0;

// Utility to lazy load external scripts
const loadScript = (url) => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${url}"]`)) return resolve();
    const script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

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

  // reset animation
  title.style.animation = 'none';
  title.style.transform = 'translateX(0)';
  
  // wait for DOM to render the new text to get accurate widths
  setTimeout(() => {
    const wrapper = document.getElementById('title-wrapper');
    if (wrapper && title.scrollWidth > wrapper.clientWidth) {
      // scroll width is the text length, plus 15px extra buffer
      const distance = title.scrollWidth - wrapper.clientWidth + 15;
      title.style.setProperty('--scroll-dist', `-${distance}px`);
      // force reflow
      void title.offsetWidth;
      title.style.animation = ''; // restore animation
      title.classList.add('marquee');
    } else {
      title.style.animation = '';
      title.classList.remove('marquee');
    }
  }, 50);

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

  // Dynamic Theme Extraction
  function extractDominantColor(imgEl) {
    if (!imgEl || !imgEl.complete || !imgEl.naturalWidth) return '84, 200, 250';
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 50; canvas.height = 50;
      ctx.drawImage(imgEl, 0, 0, 50, 50);
      const data = ctx.getImageData(0, 0, 50, 50).data;
      
      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < data.length; i += 16) {
        if (data[i+3] < 128) continue;
        const brightness = (data[i] + data[i+1] + data[i+2]) / 3;
        if (brightness < 20 || brightness > 240) continue;
        r += data[i]; g += data[i+1]; b += data[i+2]; count++;
      }
      
      if (count === 0) return '84, 200, 250';
      r = Math.floor(r / count); g = Math.floor(g / count); b = Math.floor(b / count);
      
      const max = Math.max(r, g, b);
      if (max > 0 && max < 255) {
        const boost = 255 / max;
        r = Math.min(255, Math.floor(r * (1 + (boost - 1) * 0.6)));
        g = Math.min(255, Math.floor(g * (1 + (boost - 1) * 0.6)));
        b = Math.min(255, Math.floor(b * (1 + (boost - 1) * 0.6)));
      }
      return `${r}, ${g}, ${b}`;
    } catch (e) {
      return '84, 200, 250';
    }
  }

  // Clear previous onload
  image.onload = null;

  if (song.cover && song.cover !== './img/logo.png') {
    image.crossOrigin = "Anonymous"; // Ensure we can read pixels if possible
    image.onload = () => {
      const rgbStr = extractDominantColor(image);
      document.documentElement.style.setProperty('--theme-color-rgb', rgbStr);
      const metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) metaTheme.setAttribute('content', `rgb(${rgbStr})`);
    };
    image.src = `${song.cover}`;
    image.style.display = 'block';
    
    // Force a browser reflow so the CSS fade-in animation triggers correctly
    void image.offsetWidth;
    
    document.getElementById('default-cover').style.display = 'none';
    document.querySelector('.artwork-container').classList.add('has-cover');
    if (background) background.style.backgroundImage = `url(${song.cover})`;
  } else {
    // Reset to default theme
    document.documentElement.style.setProperty('--theme-color-rgb', '84, 200, 250');
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', '#2b3138');
    
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



const isLinkMode = !!url.searchParams.get('link');
if (!isLinkMode) {
  loadSong(songs[songIndex]);
} else {
  // Show default cover (vinyl logo) while metadata is loading
  const defaultCover = document.getElementById('default-cover');
  if (defaultCover) defaultCover.style.display = 'flex';
}

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

      const controlsDiv = document.getElementById("controls");
      if (controlsDiv) {
        setTimeout(() => {
          controlsDiv.style.opacity = '1';
        }, 1100);
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

  const processTag = function (tag) {
    const tags = tag.tags;

    songs[0].displayName = tags.title || (songs[0].displayName === '' ? '未找到歌曲' : songs[0].displayName);
    songs[0].artist = tags.artist || (songs[0].artist === '' ? '未知歌手' : songs[0].artist);
    songs[0].album = tags.album || '';
    // Robust year extraction for various formats (ID3, Vorbis, etc.)
    let extractedYear = '';
    const possibleYearKeys = ['year', 'date', 'DATE', 'Date', 'YEAR', 'Year', 'TYER', 'TDRC', 'originalyear', 'ORIGINALYEAR'];
    for (const key of possibleYearKeys) {
      if (tags[key]) {
        extractedYear = typeof tags[key] === 'string' ? tags[key] : (tags[key].data || tags[key][0] || '');
        if (extractedYear) break;
      }
    }
    
    // Fallback: search all keys
    if (!extractedYear) {
      for (const key in tags) {
        if (key.toLowerCase().includes('year') || key.toLowerCase().includes('date')) {
          const val = tags[key];
          extractedYear = typeof val === 'string' ? val : (val && val.data ? val.data : (Array.isArray(val) ? val[0] : ''));
          if (extractedYear) break;
        }
      }
    }
    songs[0].year = typeof extractedYear === 'string' ? extractedYear : String(extractedYear || '');

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
    // 1a. Try fetching metadata from our own server API (fastest and most reliable for all files now!)
    try {
      const response = await fetch(`/metadata?url=${encodeURIComponent(songs[0].mp3link)}`);
      if (response.ok) {
        const common = await response.json();
        if (common && common.title) {
          songs[0].displayName = common.title || (songs[0].displayName === '' ? '未找到歌曲' : songs[0].displayName);
          songs[0].artist = common.artist || (songs[0].artist === '' ? '未知歌手' : songs[0].artist);
          songs[0].album = common.album || '';
          songs[0].year = common.year || '';

          if (common.coverData) {
            songs[0].cover = common.coverData;
          }
          if (songIndex === 0) { showControls(); loadSong(songs[0]); }
          return; // Success!
        }
      }
    } catch (err) {
      console.log('Server /metadata fetch failed:', err);
    }

    // 1b. Try music-metadata-browser using Range requests (superior for FLAC, etc.)
    const isGitHubRaw = songs[0].mp3link.includes('raw.githubusercontent.com');
    if (!isGitHubRaw) {
      try {
        await loadScript('https://unpkg.com/music-metadata-browser@2.5.10/dist/index.min.js');
        const metadata = await musicMetadata.fetchFromUrl(songs[0].mp3link);
        const common = metadata.common;
        if (common) {
          songs[0].displayName = common.title || (songs[0].displayName === '' ? '未找到歌曲' : songs[0].displayName);
          songs[0].artist = common.artist || (songs[0].artist === '' ? '未知歌手' : songs[0].artist);
          songs[0].album = common.album || '';
          songs[0].year = common.year || common.date || common.originalyear || '';

          if (common.picture && common.picture.length > 0) {
            const pic = common.picture[0];
            const picBlob = new Blob([pic.data], { type: pic.format });
            const reader = new FileReader();
            reader.onload = function (e) {
              songs[0].cover = e.target.result;
              if (songIndex === 0) { showControls(); loadSong(songs[0]); }
            };
            reader.readAsDataURL(picBlob);
          } else {
            if (songIndex === 0) { showControls(); loadSong(songs[0]); }
          }
          return; // Success!
        }
      } catch (err) {
        console.log('musicMetadata URL fetch failed, falling back to jsmediatags...', err);
      }
      
      // 1b. Fallback to jsmediatags Range request
      try {
        await loadScript('https://unpkg.com/jsmediatags@3.9.5/dist/jsmediatags.min.js');
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
    
    // 3a. Try music-metadata-browser first (superior for FLAC, M4A, etc.)
    try {
      if (window.musicMetadata) {
        const metadata = await window.musicMetadata.parseBlob(blob);
        const common = metadata.common;
        if (common) {
          songs[0].displayName = common.title || (songs[0].displayName === '' ? '未找到歌曲' : songs[0].displayName);
          songs[0].artist = common.artist || (songs[0].artist === '' ? '未知歌手' : songs[0].artist);
          songs[0].album = common.album || '';
          // Try year, date, originalyear
          songs[0].year = common.year || common.date || common.originalyear || '';

          if (common.picture && common.picture.length > 0) {
            const pic = common.picture[0];
            const picBlob = new Blob([pic.data], { type: pic.format });
            const reader = new FileReader();
            reader.onload = function (e) {
              songs[0].cover = e.target.result;
              if (songIndex === 0) { showControls(); loadSong(songs[0]); }
            };
            reader.readAsDataURL(picBlob);
          } else {
            if (songIndex === 0) { showControls(); loadSong(songs[0]); }
          }
          parsed = true;
        }
      }
    } catch (err) {
      console.warn('musicMetadata parse failed, falling back to jsmediatags:', err);
    }

    // 3b. Fallback to jsmediatags
    if (!parsed) {
      for (let parseAttempt = 1; parseAttempt <= 2; parseAttempt++) {
        try {
          await loadScript('https://unpkg.com/jsmediatags@3.9.5/dist/jsmediatags.min.js');
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

  async function processLocalFile(file) {
    const passwordInput = document.getElementById('upload-password-input');
    const password = passwordInput ? passwordInput.value : '';

    mainActionBtn.classList.add("pressed"); // 剛點擊時不亮燈
    mainActionBtn.disabled = true;
    const span = mainActionBtn.querySelector('span');
    // Button text remains fixed

    const progressContainer = document.getElementById('lcd-upload-progress-container');
    const progressTrack = document.getElementById('lcd-upload-progress-track');
    const progressBar = document.getElementById('lcd-upload-progress-bar');
    const progressText = document.getElementById('lcd-upload-progress-text');

    // 等待 1s 後驗證密碼
    setTimeout(() => {
      // Button text remains fixed
      fetch('/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
      .then(res => {
        if (res.status === 401) throw new Error('UNAUTHORIZED');
        if (!res.ok) throw new Error('VERIFY_FAILED');
        return res.json();
      })
      .then(async () => {
        // 驗證成功：顯示進度條、點亮紅色呼吸燈，開始上傳
        if (progressContainer) {
          progressContainer.classList.add('active');
        }
        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.textContent = '分析中...';

        mainActionBtn.classList.add("uploading-led");
        // Button text remains fixed as "Play"

        const ext = file.name.substring(file.name.lastIndexOf('.'));
        
        await loadScript('https://unpkg.com/spark-md5@3.0.2/spark-md5.min.js');
        function calculateMD5(file) {
          return new Promise((resolve, reject) => {
            const blobSlice = File.prototype.slice || File.prototype.mozSlice || File.prototype.webkitSlice;
            const chunkSize = 2097152;
            const chunks = Math.ceil(file.size / chunkSize);
            let currentChunk = 0;
            const spark = new SparkMD5.ArrayBuffer();
            const fileReader = new FileReader();
            fileReader.onload = e => {
              spark.append(e.target.result);
              currentChunk++;
              if (currentChunk < chunks) loadNext();
              else resolve(spark.end());
            };
            fileReader.onerror = () => reject('Error reading file');
            function loadNext() {
              const start = currentChunk * chunkSize;
              const end = ((start + chunkSize) >= file.size) ? file.size : start + chunkSize;
              fileReader.readAsArrayBuffer(blobSlice.call(file, start, end));
            }
            loadNext();
          });
        }

        return calculateMD5(file).then(md5Hex => {
          return fetch('/check-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ md5: md5Hex, ext: ext, password })
          });
        })
        .then(res => {
          if (!res.ok) throw new Error('CHECK_FAILED');
          return res.json();
        })
        .then(data => {
          if (data.exists) {
            // 秒傳成功
            mainActionBtn.classList.remove("uploading-led");
            mainActionBtn.classList.add("active-led");
            // Button text remains fixed
            if (progressBar) {
              progressBar.style.width = '100%';
            }
            if (progressText) progressText.textContent = '100%';

            const serverUrl = new URL(data.url, window.location.origin).href;
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('link', serverUrl);
            newUrl.searchParams.set('name', file.name.replace(/\.[^/.]+$/, ""));
            
            setTimeout(() => {
              window.location.href = newUrl.href;
            }, 1000);
          } else {
            if (progressText) progressText.textContent = '0%';
            
            const formData = new FormData();
            formData.append('musicFile', file);
            formData.append('password', password);

            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener('progress', (e) => {
              if (e.lengthComputable) {
                const percentComplete = Math.round((e.loaded / e.total) * 100);
                if (progressBar) {
                  progressBar.style.width = percentComplete + '%';
                }
                if (progressText) progressText.textContent = percentComplete + '%';
              }
            });

            xhr.addEventListener('load', () => {
              if (xhr.status === 401) {
                showToast('密碼錯誤，拒絕上傳！');
                resetUploadUI();
              } else if (xhr.status >= 200 && xhr.status < 300) {
                try {
                  const data = JSON.parse(xhr.responseText);
                  if (data.url) {
                    const serverUrl = new URL(data.url, window.location.origin).href;
                    const newUrl = new URL(window.location.href);
                    newUrl.searchParams.set('link', serverUrl);
                    newUrl.searchParams.set('name', file.name.replace(/\.[^/.]+$/, ""));
                    
                    // 上傳完成：切換為綠色 LED
                    mainActionBtn.classList.remove("uploading-led");
                    mainActionBtn.classList.add("active-led");
                    // Button text remains fixed
                    if (progressBar) progressBar.style.width = '100%';
                    if (progressText) progressText.textContent = '100%';

                    // 等待 1s 後進入播放
                    setTimeout(() => {
                      window.location.href = newUrl.href;
                    }, 1000);
                  }
                } catch (e) {
                  console.error('Error parsing response:', e);
                  showToast('上傳失敗，伺服器回應錯誤！');
                  resetUploadUI();
                }
              } else {
                showToast('上傳失敗，請確認伺服器已啟動！');
                resetUploadUI();
              }
            });

            xhr.addEventListener('error', () => {
              console.error('Error uploading file');
              showToast('上傳失敗，網路連線錯誤！');
              resetUploadUI();
            });

            xhr.open('POST', '/upload', true);
            xhr.send(formData);
          }
        });
      })
      .catch(error => {
        if (error.message === 'UNAUTHORIZED') {
          showToast('密碼錯誤，拒絕上傳！');
        } else {
          console.error(error);
          showToast('伺服器連線錯誤！');
        }
        resetUploadUI();
      });
    }, 1000);

    function resetUploadUI() {
      if (progressContainer) {
        progressContainer.classList.remove('active');
      }
      if (progressBar) progressBar.classList.remove('flash-effect');
      mainActionBtn.classList.remove("uploading-led", "active-led", "pressed");
      mainActionBtn.disabled = false;
      if (span) {
        span.innerHTML = '<i class="fa-solid fa-play"></i> 播放';
      }
    }
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
