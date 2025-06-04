require("@nomicfoundation/hardhat-toolbox");
const path = require("path");

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: { optimizer: { enabled: true, runs: 200 } },
        // use local solcjs
        compilerPath: path.join(__dirname, "node_modules", "solc", "soljson.js"),
      },
    ],
  },
  networks: {
    hardhat: {}
  }
};
