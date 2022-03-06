require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("@openzeppelin/hardhat-upgrades");
require("solidity-coverage");
require("dotenv").config();

module.exports = {
  solidity: "0.8.3",
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      forking: {
        url: `https://mainnet.infura.io/v3/${process.env.INFURA_URL}`,
        accounts: [`0x${process.env.PRIVATE_KEY}`],
      }
    },
    rinkeby: {
      forking: {
        url: `https://mainnet.infura.io/v3/${process.env.INFURA_URL}`,
        accounts: [`0x${process.env.PRIVATE_KEY}`],
      },
      url: `https://rinkeby.infura.io/v3/${process.env.INFURA_URL}`,
      accounts: [`0x${process.env.PRIVATE_KEY}`],
    }
  },
  etherscan: {
    apiKey:{
      rinkeby: process.env.API_KEY,
    }
  },
  paths:{
    deploy: 'deploy',
    deployments: 'deployments',
  }
};
