const { expect } = require('chai');
const { ethers } = require('hardhat');
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

    beforeEach(async function(){
        // Deploy and set NFT Collection for testing

        AppNFT = await ethers.getContractFactory('PixelSonicToken');
        appNFT = await AppNFT.deploy();
        [owner, _] = await ethers.getSigners()

        await appNFT.connect(owner).startSales();
        await appNFT.connect(owner).setMinter(owner.address, true);
        await appNFT.connect(owner).mintBatchByMinter(sellerSigner._address, [1, 2], [4, 4]);
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

        it('TokensAvailables: should fail if the seller has not the tokens', async () => {
            const blockNumBefore = await ethers.provider.getBlockNumber();
            const blockBefore = await ethers.provider.getBlock(blockNumBefore);
            const deadline = blockBefore.timestamp + 86400; // 86400 = 1 day in seconds
            const price = 60*(10**18); // 60$ with 18 zeros as decimals
            const id = 1;
            const amount = 4;
            await app.connect(sellerSigner).createOffer(appNFT.address, id, amount, deadline, price.toString());
            await appNFT.connect(sellerSigner).burn(id, 2);
            await expect(app.connect(buyerSigner).buyWithETH(0)).to.be.revertedWith("The seller no longer has the tokens.");
        });
    });

    describe('Tests for functions', () => {
        describe('Tests for createOffer', () => {
            it('Should fail if pass address 0', async () => {
                const blockNumBefore = await ethers.provider.getBlockNumber();
                const blockBefore = await ethers.provider.getBlock(blockNumBefore);
                const deadline = blockBefore.timestamp + 86400; // 86400 = 1 day in seconds
                const price = 60*(10**18); // 6000$ with 18 zeros as decimals
                const tokenAddress = '0x0000000000000000000000000000000000000000'; 
                const id = 1;
                const amount = 1;
                await expect(app.connect(sellerSigner).createOffer(tokenAddress, id, amount, deadline, price.toString()))
                .to.be.revertedWith("Invalid token address.");
            });

            it('Should fail if pass 0 in amount', async () => {
                const blockNumBefore = await ethers.provider.getBlockNumber();
                const blockBefore = await ethers.provider.getBlock(blockNumBefore);
                const deadline = blockBefore.timestamp + 86400; // 86400 = 1 day in seconds
                const price = 60*(10**18); // 6000$ with 18 zeros as decimals
                const tokenAddress = appNFT.address; 
                const id = 1;
                const amount = 0;
                await expect(app.connect(sellerSigner).createOffer(tokenAddress, id, amount, deadline, price.toString()))
                .to.be.revertedWith("Invalid amount.");
            });

            it('Should fail if pass an amount bigger than the tokens that the seller has', async () => {
                const blockNumBefore = await ethers.provider.getBlockNumber();
                const blockBefore = await ethers.provider.getBlock(blockNumBefore);
                const deadline = blockBefore.timestamp + 86400; // 86400 = 1 day in seconds
                const price = 60*(10**18); // 6000$ with 18 zeros as decimals
                const tokenAddress = appNFT.address; 
                const id = 1;
                const amount = 10;
                await expect(app.connect(sellerSigner).createOffer(tokenAddress, id, amount, deadline, price.toString()))
                .to.be.revertedWith("Insufficient tokens");
            });

            it('Should fail if pass a deadline that is lower than de timestamp', async () => {
                const blockNumBefore = await ethers.provider.getBlockNumber();
                const blockBefore = await ethers.provider.getBlock(blockNumBefore);
                const deadline = blockBefore.timestamp; // 86400 = 1 day in seconds
                const price = 60*(10**18); // 6000$ with 18 zeros as decimals
                const tokenAddress = appNFT.address; 
                const id = 1;
                const amount = 1;

                await expect(app.connect(sellerSigner).createOffer(tokenAddress, id, amount, deadline, price.toString()))
                .to.be.revertedWith("Invalid deadline.");
            });

            it('Should pass in other case', async () => {
                let offerID = parseInt(await app.offerCount(), 10);
                const blockNumBefore = await ethers.provider.getBlockNumber();
                const blockBefore = await ethers.provider.getBlock(blockNumBefore);
                const deadline = blockBefore.timestamp + 86400; // 86400 = 1 day in seconds
                const price = 60*(10**18); // 6000$ with 18 zeros as decimals
                const tokenAddress = appNFT.address; 
                const id = 1;
                const amount = 1;
                
                expect(await app.connect(sellerSigner).createOffer(tokenAddress, id, amount, deadline, price.toString()))
                .to.emit(app, 'newOffer')
                .withArgs(sellerSigner._address, tokenAddress, id, amount, deadline, price.toString(), offerID+1);
                const expected = await app.connect(sellerSigner).getOffer(offerID);
                expect(await expected.sellerAddress).to.be.equal(sellerSigner._address);
                expect(await expected.tokenAddress).to.be.equal(tokenAddress);
                expect(await expected.tokenID).to.be.equal(id);
                expect(await expected.amount).to.be.equal(amount);
                expect(await expected.deadline).to.be.equal(deadline);
                expect(await expected.price).to.be.equal(price.toString());
                expect(await expected.status).to.be.equal("ACTIVE");
                expect(parseInt(await app.offerCount(), 10)).to.be.equal(offerID+1);
            });
        });

        describe('Tests for cancelOffer', () => {
            it('Should fail if try cancel a offer that does not exist', async () => {
                const offerID = 10; // This offer does not exist because are 0 offers at the moment
                                    // and the offerID init in 0 and increase 1 per each offer created
                await expect(app.connect(sellerSigner).cancelOffer(offerID))
                .to.be.revertedWith("Only the seller can cancel his offer");
            });

            it('Should fail if try cancel a offer that exist but is not the seller', async () => {
                let offerID = parseInt(await app.offerCount(), 10);
                const blockNumBefore = await ethers.provider.getBlockNumber();
                const blockBefore = await ethers.provider.getBlock(blockNumBefore);
                const deadline = blockBefore.timestamp + 86400; // 86400 = 1 day in seconds
                const price = 60*(10**18); // 60$ with 18 zeros as decimals
                const tokenAddress = appNFT.address; 
                const id = 1;
                const amount = 1;
                await app.connect(sellerSigner).createOffer(tokenAddress, id, amount, deadline, price.toString());
                await expect(app.connect(buyerSigner).cancelOffer(offerID)).to.be.revertedWith("Only the seller can cancel his offer");
            });

            it('Should cancel the offer if the seller try cancel', async () => {
                let offerID = parseInt(await app.offerCount(), 10);
                const blockNumBefore = await ethers.provider.getBlockNumber();
                const blockBefore = await ethers.provider.getBlock(blockNumBefore);
                const deadline = blockBefore.timestamp + 86400; // 86400 = 1 day in seconds
                const price = 60*(10**18); // 60$ with 18 zeros as decimals
                const tokenAddress = appNFT.address; 
                const id = 1;
                const amount = 1;
                await app.connect(sellerSigner).createOffer(tokenAddress, id, amount, deadline, price.toString());
                expect(await app.connect(sellerSigner).cancelOffer(offerID))
                .to.emit(app, 'offerCancelled').withArgs(offerID, sellerSigner._address);
                const expected = await app.connect(sellerSigner).getOffer(offerID);
                expect(await expected.status).to.be.equal("CANCELLED");
            });
        });

        describe('Tests for buyWithETH', () => {
            beforeEach(async function(){
                let offerID = parseInt(await app.offerCount(), 10);
                const blockNumBefore = await ethers.provider.getBlockNumber();
                const blockBefore = await ethers.provider.getBlock(blockNumBefore);
                const deadline = blockBefore.timestamp + 86400; // 86400 = 1 day in seconds
                const price = 6000*(10**18); // 6000$ with 18 zeros as decimals
                const tokenAddress = appNFT.address; 
                const id = 1;
                const amount = 1;
                
                expect(await app.connect(sellerSigner).createOffer(tokenAddress, id, amount, deadline, price.toString()));
            });

            // tests for buyWithETH

        })

        describe('Tests for setRecipient', () => {
            it('Should fail if who try set recipient is not the owner', async () => {
                await expect(app.connect(sellerSigner).setRecipient(sellerSigner._address))
                .to.be.revertedWith("Ownable: caller is not the owner");
            });

            it('Should work correctly if owner try set recipient', async () => {
                await app.connect(deployerSigner).setRecipient(feeRecipientSigner._address);
                expect(await app.recipient()).to.be.equal(feeRecipientSigner._address);
            });
        });

        describe('Tests for setFee', () => {
            it('Should fail if who try set recipient is not the owner', async () => {
                await expect(app.connect(sellerSigner).setFee(2))
                .to.be.revertedWith("Ownable: caller is not the owner");
            });

            it('Should work correctly if owner try set recipient', async () => {
                await app.connect(deployerSigner).setFee(2);
                expect(await app.fee()).to.be.equal(2);
            });
        });

        describe('Tests for getOffer', () => {
            it('Should return a offer with default values if the offer does not exist', async () => {
                const deadline = 0;
                const price = 0;
                const sellerAddress = '0x0000000000000000000000000000000000000000';
                const tokenAddress = '0x0000000000000000000000000000000000000000'; 
                const id = 0;
                const amount = 0;
                const status = "";
                const offerResult = await app.connect(sellerSigner).getOffer(10);
                const sellerAddressResult = offerResult[0];
                const tokenAddressResult = offerResult[1];
                const idResult = offerResult[2];
                const amountResult = offerResult[3];
                const deadlineResult = offerResult[4];
                const priceResult = offerResult[5];
                const statusResult = offerResult[6];
                expect(sellerAddressResult).to.be.equal(sellerAddress);
                expect(tokenAddressResult).to.be.equal(tokenAddress);
                expect(idResult).to.be.equal(id);
                expect(amountResult).to.be.equal(amount);
                expect(deadlineResult).to.be.equal(deadline);
                expect(priceResult).to.be.equal(price);
                expect(statusResult).to.be.equal(status);
            });

            it('Should return the values of the offer in case that exist', async () => {
                let offerID = parseInt(await app.offerCount(), 10);
                const blockNumBefore = await ethers.provider.getBlockNumber();
                const blockBefore = await ethers.provider.getBlock(blockNumBefore);
                const deadline = blockBefore.timestamp + 86400; // 86400 = 1 day in seconds
                const price = 60*(10**18); // 60$ with 18 zeros as decimals
                const tokenAddress = appNFT.address; 
                const id = 1;
                const amount = 1;
                await app.connect(sellerSigner).createOffer(tokenAddress, id, amount, deadline, price.toString());
            });
        });
    });
});