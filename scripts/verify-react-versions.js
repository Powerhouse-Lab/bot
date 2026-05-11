const fs = require('fs');
const path = require('path');

function readVersion(packageName) {
  const packagePath = require.resolve(path.join(packageName, 'package.json'), { paths: [process.cwd()] });
  return JSON.parse(fs.readFileSync(packagePath, 'utf8')).version;
}

const expected = {
  react: '19.0.0',
  'react-native': '0.79.0',
  expo: '53.0.0',
  'expo-asset': '11.1.3',
  'expo-constants': '17.1.3',
  'expo-file-system': '18.1.7',
  'expo-font': '13.2.2',
  'expo-keep-awake': '14.1.3',
  'expo-modules-autolinking': '2.1.8',
  'expo-modules-core': '2.3.10',
  'expo-video': '2.2.2',
};

for (const [packageName, expectedVersion] of Object.entries(expected)) {
  const actualVersion = readVersion(packageName);
  if (actualVersion !== expectedVersion) {
    throw new Error(`${packageName} must be ${expectedVersion}, but ${actualVersion} is installed.`);
  }
}

console.log('React and Expo native module package versions match the Expo SDK 53 runtime pins.');
