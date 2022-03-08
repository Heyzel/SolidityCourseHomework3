const { expect } = require('chai');
//const { ethers } = require('ethers');
const { fixture } = deployments;

const { printGas, currentTime } = require('./utils');

describe('TinyMarketplace contract', () => {
    
    before(async function(){
        ({ deployer, feeRecipient, buyer, seller} = await getNamedAccounts());

        deployerSigner = await ethers.provider.getSigner(deployer);
        feeRecipientSigner = await ethers.provider.getSigner(feeRecipient);
        buyerSigner = await ethers.provider.getSigner(buyer);
        sellerSigner = await ethers.provider.getSigner(seller);

        // Deploy
        await fixture(["TinyMarketplace"]);
        app = await ethers.getContract("TinyMarketplace");

    });

    describe('Deployment', () => {
        it('Should set the right owner', async () => {
            expect(await app.owner()).to.equal(deployerSigner._address);
        });
    });
    
    describe('Tests for modifiers', () => {
        it('OfferAvailable: should fail if the status of the offer is not ACTIVE', async () => {
            await expect(app.connect(buyerSigner).buyWithETH(0, {value: ethers.utils.parseEther("0.001")}))
            .to.be.revertedWith("The offer is not available");
        });
        
    });
});