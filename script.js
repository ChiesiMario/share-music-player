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

const prevBtn = document.getElementById("prev");
const playBtn = document.getElementById("play");
const nextBtn = document.getElementById("next");


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

function playSong() {
  isPlaying = true;
  playBtn.classList.replace("fa-play", "fa-pause");
  playBtn.setAttribute("title", "Pause");
  music.play();
}

function pauseSong() {
  isPlaying = false;
  playBtn.classList.replace("fa-pause", "fa-play");
  playBtn.setAttribute("title", "Play");
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
    if (background) background.style.backgroundImage = `url(${song.cover})`;
  } else {
    artistLink.style.pointerEvents = 'none';
  }

  // Default Cover Handling
  const defaultCover = document.getElementById('default-cover');
  if (!(song.cover && song.cover !== './img/logo.png')) {
    image.style.display = 'none';
    defaultCover.style.display = 'flex';
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
    // 1. Initial attempt using direct URL
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
    
    // 2. Fallback to robust resumable download
    if (fetchProgressContainer) {
      fetchProgressContainer.style.display = 'block';
      title.textContent = '歌曲加載中 ……';
    }
    
    const cacheBusterUrl = songs[0].mp3link + (songs[0].mp3link.includes('?') ? '&' : '?') + 'cors=' + Date.now();
    let blob = null;
    
    try {
      blob = await fetchWithResume(cacheBusterUrl, 3); // 3 retries
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
    songs[0].displayName = '請輸入歌曲 URL';
    songs[0].artist = '';
    loadSong(songs[0]);
    const inputContainer = document.getElementById("url-input-container");
    if (inputContainer) {
      inputContainer.style.display = "flex";
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
prevBtn.addEventListener("click", prevSong);
nextBtn.addEventListener("click", nextSong);

music.addEventListener("timeupdate", updateProgressBar);
music.addEventListener("ended", nextSong);

// URL input handler
const urlPlayBtn = document.getElementById("song-url-play-btn");
if (urlPlayBtn) {
  urlPlayBtn.addEventListener("click", () => {
    const urlInput = document.getElementById("song-url-input").value.trim();
    if (urlInput) {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('link', urlInput);
      window.location.href = newUrl.href;
    }
  });
  
  // Add enter key support
  const urlInputEl = document.getElementById("song-url-input");
  if (urlInputEl) {
    urlInputEl.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        urlPlayBtn.click();
      }
    });
  }
}
