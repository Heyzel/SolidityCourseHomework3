const ETHFeeAddress = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";
const DAIFeeAddress = "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9";
const LINKFeeAddress = "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c";
const DAIAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const LINKAddress = "0x514910771AF9Ca656af840dff83E8264EcF986CA";
const _Decimals = 18;
const _Fee = 1;

const _args = [ETHFeeAddress, DAIFeeAddress, LINKFeeAddress, DAIAddress, LINKAddress, _Decimals, _Fee];

module.exports = async ({getNamedAccounts, deployments}) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    await deploy('TinyMarketplace', {
        from: deployer,
        proxy: {
            proxyContract: 'OpenZeppelinTransparentProxy',
            execute: {
                init: {
                    methodName: "initialize",
                    args: _args,
                },
            },
        },
        log: true
    });

};

module.exports.tags = ['TinyMarketplace'];