// autogit.js
const chokidar = require('chokidar');
const simpleGit = require('simple-git');
const debounce = require('debounce');
const path = require('path');

const repoPath = process.argv[2] || '.';
const branch = process.env.AUTOGIT_BRANCH || 'main';
const commitPrefix = process.env.AUTOGIT_PREFIX || '[auto]';

const git = simpleGit(repoPath);

// ignore .git and node_modules by passing ignored pattern
const watcher = chokidar.watch(repoPath, {
  ignored: /(^|[\/\\])\.(git|idea|vscode)|node_modules|Backup/,
  ignoreInitial: true,
  persistent: true,
  followSymlinks: true
});

const doCommitAndPush = async () => {
  try {
    console.log(new Date().toISOString(), 'Staging changes...');
    await git.add('.');
    const status = await git.status();
    if (status.staged.length === 0) {
      console.log('Nothing staged.');
      return;
    }
    const time = new Date().toISOString();
    const message = `${commitPrefix}${time}`;
    console.log('Committing:', message);
    await git.commit(message);
    console.log('Pushing to origin/' + branch);
    await git.push('origin', branch);
    console.log('Pushed OK.');
  } catch (err) {
    console.error('Auto-git error:', err.message);
  }
};

// Debounce rapid change bursts (3 seconds)
const debounced = debounce(doCommitAndPush, 3000);

watcher
  .on('add', path => { console.log('add', path); debounced(); })
  .on('change', path => { console.log('change', path); debounced(); })
  .on('unlink', path => { console.log('unlink', path); debounced(); })
  .on('addDir', path => { console.log('addDir', path); debounced(); })
  .on('unlinkDir', path => { console.log('unlinkDir', path); debounced(); })
  .on('error', error => console.error('Watcher error', error));

console.log('Auto-git watcher running at', path.resolve(repoPath));
