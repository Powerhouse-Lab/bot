module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: './android',
        packageImportPath: 'import com.jellyfinmobile.libmpv.JellyfinLibMpvPackage;',
        packageInstance: 'new JellyfinLibMpvPackage()',
      },
    },
  },
};
