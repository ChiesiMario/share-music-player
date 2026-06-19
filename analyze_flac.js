const mm = require('music-metadata');

async function analyze() {
  try {
    const metadata = await mm.parseFile('C:\\Users\\Noah\\Desktop\\02 - 何韻詩 - 未來.flac');
    console.log('common.title:', metadata.common.title);
    console.log('Is common.title truthy?', !!metadata.common.title);
  } catch (error) {
    console.error('Error analyzing file:', error);
  }
}

analyze();
