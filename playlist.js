const fs = require('fs').promises;
const http = require('http');
const url = require('url');
const path = require('path');

const videoExtensions = ['mp4', 'mkv', 'flv', 'avi', 'mov', 'wmv', "webm"];  // common video file extensions
const m3uFile = 'playlist.m3u';

// Get port from command-line arguments or use 2222 as default
const port = process.argv.includes('-p') ? process.argv[process.argv.indexOf('-p') + 1] : 2222;
// Check if '-r' flag is present
const isRecursive = process.argv.includes('-r');

console.log(`Running server with options:
- Port: ${port}
- Recursive search: ${isRecursive ? 'Enabled' : 'Disabled'}
`);

async function findVideos(dir, recursive) {
  let videoFiles = [];
  const files = await fs.readdir(dir);
  for (let file of files) {
    const filePath = path.join(dir, file);
    const stat = await fs.stat(filePath);
    if (stat.isDirectory() && recursive) {
      videoFiles = videoFiles.concat(await findVideos(filePath, recursive));
    } else if (videoExtensions.includes(file.split('.').pop())) {
      videoFiles.push(filePath);
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
    }

    // build .m3u file
    const m3uContent = '#EXTM3U\n' + videoFiles.map(file => '#EXTINF:-1,' + file + '\n' + file).join('\n');
    await fs.writeFile(m3uFile, m3uContent);
    console.log('.m3u file has been created.');

    // start web server
    http.createServer(async (req, res) => {
      const reqUrl = url.parse(req.url, true);
      const filePath = '.' + reqUrl.pathname;
      try {
        const data = await fs.readFile(filePath);
        res.writeHead(200);
        res.end(data);
      } catch (err) {
        res.writeHead(404);
        res.end(JSON.stringify(err));
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