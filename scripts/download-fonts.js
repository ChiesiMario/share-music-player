const fs = require('fs');
const path = require('path');
const https = require('https');

const fontsDir = path.join(__dirname, 'fonts');
if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir);
}

const cssUrl = 'https://fonts.googleapis.com/css2?family=DotGothic16&family=Inter:wght@400;600;700&display=swap';

https.get(cssUrl, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
  }
}, (res) => {
  let css = '';
  res.on('data', d => css += d);
  res.on('end', async () => {
    const urls = [];
    css = css.replace(/url\((https:\/\/[^)]+)\)/g, (match, url) => {
      urls.push(url);
      const filename = url.split('/').pop();
      return `url('./fonts/${filename}')`;
    });
    
    for (const url of urls) {
      const filename = url.split('/').pop();
      const dest = path.join(fontsDir, filename);
      await new Promise((resolve, reject) => {
        https.get(url, (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`Failed to get '${url}' (${res.statusCode})`));
            return;
          }
          const file = fs.createWriteStream(dest);
          res.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        }).on('error', reject);
      });
      console.log('Downloaded', filename);
    }
    
    fs.writeFileSync(path.join(__dirname, 'fonts.css'), css);
    console.log('fonts.css created successfully.');
  });
}).on('error', err => {
  console.error(err);
});
