const fs = require('fs');
const path = require('path');

function readVersion(packageName) {
  const packagePath = require.resolve(path.join(packageName, 'package.json'), { paths: [process.cwd()] });
  return JSON.parse(fs.readFileSync(packagePath, 'utf8')).version;
}

const expected = {
  react: '19.0.0',
  'react-native': '0.79.0',
};

for (const [packageName, expectedVersion] of Object.entries(expected)) {
  const actualVersion = readVersion(packageName);
  if (actualVersion !== expectedVersion) {
    throw new Error(`${packageName} must be ${expectedVersion}, but ${actualVersion} is installed.`);
  }
}

console.log('React package versions match the Expo SDK 53 runtime pins.');
