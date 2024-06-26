#!/usr/bin/env node

const fs = require('fs').promises;
const http = require('http');
const url = require('url');
const path = require('path');
const stat = fs.stat;

const videoExtensions = ['mp4', 'mkv', 'flv', 'avi', 'mov', 'wmv', "webm"];  // common video file extensions
const m3uFile = 'playlist.m3u';

// Get port from command-line arguments or use 2222 as default
const port = process.argv.includes('-p') ? process.argv[process.argv.indexOf('-p') + 1] : 2222;
// Check if '-r' flag is present
const isRecursive = process.argv.includes('-r');
const isVerbose = process.argv.includes('-v');

console.log(`Running server with options:
-p > port: ${port}
-r > recursive search: ${isRecursive ? 'enabled' : 'disabled'}
-v > verbose logging: ${isVerbose ? 'enabled' : 'disabled'}
`);

async function findVideos(dir, recursive) {
  let videoFiles = [];
  const files = await fs.readdir(dir);
  for (let file of files) {
    try {
      const filePath = path.join(dir, file);
      if (!filePath) {
        isVerbose && console.log(`File "${file}" not found in dir "${dir}"`);
        continue;
      }
      const stats = await stat(filePath);
      const isDir = stats.isDirectory();
      if (isDir && recursive) {
        videoFiles = videoFiles.concat(await findVideos(filePath, recursive));
      } else if (videoExtensions.includes(file.split('.').pop())) {
        videoFiles.push(filePath);
      }
    } catch (error) {
      console.error(`Error reading files in dir: "${dir}", file: "${file}"`);
      console.error(`Error:`, error);
      console.error();
    }
  }
  return videoFiles;
}

async function main() {
  try {
    const videoFiles = await findVideos('.', isRecursive);

    if (videoFiles.length === 0) {
      console.log('No video files found.');
      return;
    } else {
      console.log(`Found video files: ${videoFiles.length}`);
    }

    // build .m3u file
    const m3uContent = '#EXTM3U\n' + videoFiles.map(file => '#EXTINF:-1,' + file + '\n' + file).join('\n');
    await fs.writeFile(m3uFile, m3uContent);
    console.log('.m3u file has been created.');

    // start web server
    http.createServer(async (req, res) => {
      const reqUrl = url.parse(req.url, true);
      const filePath = decodeURIComponent('.' + reqUrl.pathname).replace(/\\/g, "/");
      isVerbose && console.log(`REQ: "${filePath}"`);
      try {
        const data = await fs.readFile(filePath);
        res.writeHead(200);
        res.end(data);
      } catch (err) {
        res.writeHead(404);
        res.end(JSON.stringify(err));
        console.error(JSON.stringify(err));
        return;
      }
    }).listen(port, () => {
      console.log(`Server is running at http://localhost:${port}`);
      console.log(`Playlist available at http://localhost:${port}/playlist.m3u`);
    });

  } catch (err) {
    console.error(err);
  }
}

main();