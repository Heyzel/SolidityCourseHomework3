require("@nomiclabs/hardhat-waffle");
require("hardhat-deploy-ethers");
//require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("@openzeppelin/hardhat-upgrades");
require("hardhat-deploy");
require("solidity-coverage");
require("dotenv").config();

module.exports = {
  solidity: "0.8.3",
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      forking: {
        url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
        blockNumber: 11589707,
      },
      chainId: 31337,
    },
    localhost: {
      chainId: 31337,
    },
    rinkeby: {
      forking: {
        url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
      },
      url: `https://eth-rinkeby.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
      accounts:  [`0x${process.env.PRIVATE_KEY}`],
      saveDeployments: true,
      chainId: 4,
    }
  },
  etherscan: {
    apiKey:{
      rinkeby: process.env.API_KEY,
    }
  },
  namedAccounts: {
    deployer: 0,
    feeRecipient: 1,
    buyer: 2,
    seller: 3,
  },
  paths:{
    deploy: 'deploy',
    deployments: 'deployments',
  }
};
