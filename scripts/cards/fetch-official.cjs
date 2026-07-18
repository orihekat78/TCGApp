const { fetchAndWriteAllCards } = require("./official-api.cjs");

if (require.main === module) {
  fetchAndWriteAllCards()
    .then((result) => {
      process.stdout.write(`fetched ${result.total} cards across ${result.written.length} packages\n`);
    })
    .catch((error) => {
      process.stderr.write(`${error.stack ?? error}\n`);
      process.exitCode = 1;
    });
}

module.exports = { fetchAndWriteAllCards };
