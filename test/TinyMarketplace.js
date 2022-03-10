const { expect } = require('chai');
const { ethers } = require('hardhat');
const { GetGas } = require('hardhat-gas-trackooor/dist/src/GetGas');
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

        it('OfferAvailable: must change the status if offer time expired', async () => {
            const blockNumBefore = await ethers.provider.getBlockNumber();
            const blockBefore = await ethers.provider.getBlock(blockNumBefore);
            const deadline = blockBefore.timestamp + 86400; // 86400 = 1 day in seconds
            const price = 60*(10**18); // 60$ with 18 zeros as decimals
            const id = 1;
            const amount = 4;
            await app.connect(sellerSigner).createOffer(appNFT.address, id, amount, deadline, price.toString());
            await ethers.provider.send("evm_increaseTime", [86402]);
            await expect(app.connect(buyerSigner).buyWithETH(1, {value: ethers.utils.parseEther("0.001")}))
            .to.be.revertedWith("The offer time expired");
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
            var offerID;
            const id = 1;
            const amount = 1;
            beforeEach(async function(){
                await app.connect(deployerSigner).setRecipient(feeRecipientSigner._address);
                offerID = (await app.offerCount());
                const blockNumBefore = await ethers.provider.getBlockNumber();
                const blockBefore = await ethers.provider.getBlock(blockNumBefore);
                const deadline = blockBefore.timestamp + 86400; // 86400 = 1 day in seconds
                const price = (900*(10**18)); // 900$ with 18 zeros as decimals
                const tokenAddress = appNFT.address; 
                await app.connect(sellerSigner).createOffer(tokenAddress, id, amount, deadline, price.toString());
            });

            it('Should fail if the buyer send less ETH than necessary', async () => {
                await expect(app.connect(buyerSigner).buyWithETH(offerID, {value: ethers.utils.parseEther("0.1")}))
                .to.be.revertedWith("Insufficient funds!");
            });

            it('Should fail if the tokens are not approved for transfer', async () => {
                await expect(app.connect(buyerSigner).buyWithETH(offerID, {value: ethers.utils.parseEther("0.35170092265658777")}))
                .to.be.revertedWith("ERC1155: caller is not owner nor approved");
            });

            it('Should work if the tokens are approveds by the sellers for transfer', async () => {
                await appNFT.connect(sellerSigner).setApprovalForAll(app.address, true);
                const tokensBuyerBefore = parseInt(await appNFT.connect(deployerSigner).balanceOf(buyerSigner._address, id));
                const tokensSignerBefore = parseInt(await appNFT.connect(deployerSigner).balanceOf(sellerSigner._address, id));
                const ethBuyerBalanceBefore = parseInt(await ethers.provider.getBalance(buyerSigner._address));
                const ethSellerBalanceBefore = parseInt(await ethers.provider.getBalance(sellerSigner._address));
                const ethFeeRecipientBalanceBefore = parseInt(await ethers.provider.getBalance(feeRecipientSigner._address));
                const gas = await GetGas(await app.connect(buyerSigner).buyWithETH(offerID, {value: ethers.utils.parseEther("0.35170092265658777")}));
                
                // Check that the values are updated correctly
                const statusResult = (await app.connect(buyerSigner).getOffer(offerID))[6]; // 6th position of the return value is the status
                expect(statusResult).to.equal("SOLD");
                
                // check the tokens were sent and received
                expect(parseInt(await appNFT.connect(deployerSigner).balanceOf(buyerSigner._address, id))).to.be.equal(tokensBuyerBefore + amount);
                expect(parseInt(await appNFT.connect(deployerSigner).balanceOf(sellerSigner._address, id))).to.be.equal(tokensSignerBefore - amount);

                // check the eth were sent and received
                // for reasons that javascript does not properly handle integer division with floats,
                // I will place the amount of `fee` directly. This is 0.99 for seller and 0.01 for recipient 
                const ethBuyerBalanceExpected = parseInt(await ethers.provider.getBalance(buyerSigner._address));
                const ethSellerBalanceExpected = parseInt(await ethers.provider.getBalance(sellerSigner._address));
                const ethFeeRecipientBalanceExpected = parseInt(await ethers.provider.getBalance(feeRecipientSigner._address));
                expect(ethBuyerBalanceExpected).to.be.equal(ethBuyerBalanceBefore - (351700922656587770 + gas));
                expect(ethSellerBalanceExpected).to.be.equal(ethSellerBalanceBefore + (351700922656587770 * (0.99)));
                expect(ethFeeRecipientBalanceExpected).to.be.equal(ethFeeRecipientBalanceBefore + (351700922656587770 * (0.01)));
            });

            it('Testing for event offerBought in buyWithETH', async () => {
                await appNFT.connect(sellerSigner).setApprovalForAll(app.address, true);
                expect(await app.connect(buyerSigner).buyWithETH(offerID, {value: ethers.utils.parseEther("0.35170092265658777")}))
                .to.emit(app, 'offerBought').withArgs(buyerSigner._address, offerID, 351700922656587770);
            });

            it('Should refund if buyer sent more than necessary', async () => {
                await appNFT.connect(sellerSigner).setApprovalForAll(app.address, true);
                const ethBuyerBalanceBefore = parseInt(await ethers.provider.getBalance(buyerSigner._address));
                const ethSellerBalanceBefore = parseInt(await ethers.provider.getBalance(sellerSigner._address));
                const ethFeeRecipientBalanceBefore = parseInt(await ethers.provider.getBalance(feeRecipientSigner._address));
                const gas = await GetGas(await app.connect(buyerSigner).buyWithETH(offerID, {value: ethers.utils.parseEther("1")}));
                const ethBuyerBalanceExpected = parseInt(await ethers.provider.getBalance(buyerSigner._address));
                const ethSellerBalanceExpected = parseInt(await ethers.provider.getBalance(sellerSigner._address));
                const ethFeeRecipientBalanceExpected = parseInt(await ethers.provider.getBalance(feeRecipientSigner._address));
                expect(ethBuyerBalanceExpected).to.be.equal(ethBuyerBalanceBefore - (351700922656587770 + gas) );
                expect(ethSellerBalanceExpected).to.be.equal(ethSellerBalanceBefore + (351700922656587770 * (0.99)));
                expect(ethFeeRecipientBalanceExpected).to.be.equal(ethFeeRecipientBalanceBefore + (351700922656587770 * (0.01)));
            });
        });

        describe('Tests for buyWithCrypto', () => {
            var offerID;
            const _id = 1;
            const _amount = 1;
            beforeEach(async function(){
                await app.connect(deployerSigner).setRecipient(feeRecipientSigner._address);
                offerID = (await app.offerCount());
                const _blockNumBefore = await ethers.provider.getBlockNumber();
                const _blockBefore = await ethers.provider.getBlock(_blockNumBefore);
                const _deadline = _blockBefore.timestamp + 86400; // 86400 = 1 day in seconds
                const _price = (90*(10**18)); // 90$ with 18 zeros as decimals
                const _tokenAddress = appNFT.address; 
                await app.connect(sellerSigner).createOffer(_tokenAddress, _id, _amount, _deadline, _price.toString());
                await appNFT.connect(sellerSigner).setApprovalForAll(app.address, true);
            });

            it('Should fail if send a crypto that is not DAI or LINK', async () => {
                await expect(app.connect(buyerSigner).buyWithCrypto("BTC", offerID))
                .to.be.revertedWith("That Token is not accepted in this marketplace");
            });

            it('Should fail if the buyer do not approve tokens to the market', async () => {
                await expect(app.connect(buyerSigner).buyWithCrypto("DAI", offerID))
                .to.be.revertedWith("Not enough tokens to buy");
            });

            it('Should fail if the buyer approve less than necessary', async () => {
                const DAI = require("../abi/ERC20ABI.json");
                await hre.network.provider.request({
                    method: "hardhat_impersonateAccount",
                    params: ["0x56178a0d5f301baf6cf3e1cd53d9863437345bf9"],
                });
                
                const buyerDAI = await ethers.getSigner("0x56178a0d5f301baf6cf3e1cd53d9863437345bf9");
                const dai = await hre.ethers.getContractAt(DAI, '0x6B175474E89094C44Da98b954EedeAC495271d0F');
                await dai.connect(buyerDAI).approve(app.address, 123123);

                await expect(app.connect(buyerSigner).buyWithCrypto("DAI", offerID))
                .to.be.revertedWith("Not enough tokens to buy");
            });

            it('Should send erc20tokens from the buyer to the seller and feeRecipient, should send erc1155tokens from seller to buyer', async () => {
                const DAI = require("../abi/ERC20ABI.json");
                await hre.network.provider.request({
                    method: "hardhat_impersonateAccount",
                    params: ["0x56178a0d5f301baf6cf3e1cd53d9863437345bf9"],
                });
                
                const buyerDAI = await ethers.getSigner("0x56178a0d5f301baf6cf3e1cd53d9863437345bf9");
                const dai = await hre.ethers.getContractAt(DAI, '0x6B175474E89094C44Da98b954EedeAC495271d0F');
                const tokenToTransfer = 91*(10**18); // The number of tokens to transfer for pay exactly the price
                const tokens20BuyerBefore = parseInt(await dai.connect(deployerSigner).balanceOf(buyerDAI.address));
                const tokens20SellerBefore = parseInt(await dai.connect(deployerSigner).balanceOf(sellerSigner._address));
                const tokens20FeeRecBefore = parseInt(await dai.connect(deployerSigner).balanceOf(feeRecipientSigner._address));
                const tokens1155BuyerBefore = parseInt(await appNFT.connect(deployerSigner).balanceOf(buyerDAI.address, _id));
                const tokens1155SellerBefore = parseInt(await appNFT.connect(deployerSigner).balanceOf(sellerSigner._address, _id));
                await dai.connect(buyerDAI).approve(app.address, tokenToTransfer.toString());
                expect(await app.connect(buyerDAI).buyWithCrypto("DAI", offerID))
                .to.emit(app, 'offerBought').withArgs(buyerDAI.address, offerID, tokenToTransfer);

                // check the status update correctly
                const statusResult = (await app.connect(buyerSigner).getOffer(offerID))[6];
                expect(statusResult).to.be.equal("SOLD");

                // check the 20tokens were sent and received
                const tokensBuyerAfter = parseInt(await dai.connect(deployerSigner).balanceOf(buyerDAI.address));
                const remainingTokens = parseInt(await dai.connect(deployerSigner).allowance(buyerDAI.address, app.address));
                const tokensSpents = tokenToTransfer - remainingTokens;
                const tokensSellerAfter = parseInt(await dai.connect(deployerSigner).balanceOf(sellerSigner._address));
                const tokensFeeRecAfter = parseInt(await dai.connect(deployerSigner).balanceOf(feeRecipientSigner._address));
                expect(tokensBuyerAfter).to.be.equal(tokens20BuyerBefore - tokensSpents);
                expect(tokensSellerAfter).to.be.equal(tokens20SellerBefore + tokensSpents * (0.99));
                expect(tokensFeeRecAfter).to.be.equal(tokens20FeeRecBefore + tokensSpents * (0.01));

                // check the 1155tokens were sent and received
                const tokens1155BuyerAfter = parseInt(await appNFT.connect(deployerSigner).balanceOf(buyerDAI.address, _id));
                const tokens1155SellerAfter = parseInt(await appNFT.connect(deployerSigner).balanceOf(sellerSigner._address, _id));
                expect(tokens1155BuyerAfter).to.be.equal(tokens1155BuyerBefore + _amount);
                expect(tokens1155SellerAfter).to.be.equal(tokens1155SellerBefore - _amount);
            });

            it('Should work as well with LINK', async () => {
                const LINK = require("../abi/ERC20ABI.json");
                await hre.network.provider.request({
                    method: "hardhat_impersonateAccount",
                    params: ["0x2db1d8cdf1abe8c70b531a790cdf2ff38aecf652"],
                });
                const buyerLINK = await ethers.getSigner("0x2db1d8cdf1abe8c70b531a790cdf2ff38aecf652");
                const link = await hre.ethers.getContractAt(LINK, '0x514910771AF9Ca656af840dff83E8264EcF986CA');
                const tokenToTransfer = 10*(10**18); // The number of tokens to transfer for pay exactly the price
                const tokens20BuyerBefore = parseInt(await link.connect(deployerSigner).balanceOf(buyerLINK.address));
                const tokens20SellerBefore = parseInt(await link.connect(deployerSigner).balanceOf(sellerSigner._address));
                const tokens20FeeRecBefore = parseInt(await link.connect(deployerSigner).balanceOf(feeRecipientSigner._address));
                const tokens1155BuyerBefore = parseInt(await appNFT.connect(deployerSigner).balanceOf(buyerLINK.address, _id));
                const tokens1155SellerBefore = parseInt(await appNFT.connect(deployerSigner).balanceOf(sellerSigner._address, _id));
                await link.connect(buyerLINK).approve(app.address, tokenToTransfer.toString());
                expect(await app.connect(buyerLINK).buyWithCrypto("LINK", offerID))
                .to.emit(app, 'offerBought').withArgs(buyerLINK.address, offerID, tokenToTransfer);

                // check the status update correctly
                const statusResult = (await app.connect(buyerSigner).getOffer(offerID))[6];
                expect(statusResult).to.be.equal("SOLD");

                // check the 20tokens were sent and received
                const tokensBuyerAfter = parseInt(await link.connect(deployerSigner).balanceOf(buyerLINK.address));
                const remainingTokens = parseInt(await link.connect(deployerSigner).allowance(buyerLINK.address, app.address));
                const tokensSpents = tokenToTransfer - remainingTokens;
                const tokensSellerAfter = parseInt(await link.connect(deployerSigner).balanceOf(sellerSigner._address));
                const tokensFeeRecAfter = parseInt(await link.connect(deployerSigner).balanceOf(feeRecipientSigner._address));
                expect(tokensBuyerAfter).to.be.equal(tokens20BuyerBefore - tokensSpents);
                expect(tokensSellerAfter).to.be.equal(tokens20SellerBefore + tokensSpents * (0.99));
                expect(tokensFeeRecAfter).to.be.equal(tokens20FeeRecBefore + tokensSpents * (0.01));

                // check the 1155tokens were sent and received
                const tokens1155BuyerAfter = parseInt(await appNFT.connect(deployerSigner).balanceOf(buyerLINK.address, _id));
                const tokens1155SellerAfter = parseInt(await appNFT.connect(deployerSigner).balanceOf(sellerSigner._address, _id));
                expect(tokens1155BuyerAfter).to.be.equal(tokens1155BuyerBefore + _amount);
                expect(tokens1155SellerAfter).to.be.equal(tokens1155SellerBefore - _amount);
            });
        });

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
                const offerResult = await app.connect(sellerSigner).getOffer(6000);
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