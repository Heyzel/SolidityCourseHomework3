// SPDX-License-Identifier: MIT
pragma solidity >=0.8.3;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/**
* @title A tiny marketplace for ERC1155 tokens
* @author Heyzel J. Moncada
*/

contract TinyMarketplace is OwnableUpgradeable{

    /**
    * @dev Structure to store offers, name of variables are self explanatory but status.
    * status will be used to indicate different states of the offer, these are ACTIVE,
    * CANCELLED, SOLD and OFFTIME
     */
    struct Offer {
        address sellerAddress;
        address tokenAddress;
        uint tokenID;
        uint amount;
        uint deadline;
        uint price;
        string status;
    }

    /**
    * @dev This modifier check the deadline and update it if deadline is over, 
    * the offer is only available to buy if the status is ACTIVE
    */
    modifier OfferAvailable(uint _offerID){
        _checkDeadline(_offerID);
        require(keccak256(abi.encodePacked(offers[_offerID].status)) == keccak256(abi.encodePacked("ACTIVE")), "The offer is not available");
        _;
    }

    /**
    * @dev offers: the uint will be the index of the offer
    * offerCount: will be the amount of offers
    */
    mapping(uint => Offer) offers;
    uint offerCount;
    address recipient;
    uint8 _decimals;
    uint8 fee;

    /**
    * Network: Mainnet
    * Token: DAI
    * Address: 0x6B175474E89094C44Da98b954EedeAC495271d0F
    */
    IERC20 public DAI;

    /**
    * Network: Mainnet
    * Token: LINK
    * Address: 0x514910771AF9Ca656af840dff83E8264EcF986CA
    */
    IERC20 public LINK;

    /**
    * Network: Mainnet
    * Aggregator: ETH/USD
    * Address: 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419
    */
    AggregatorV3Interface internal ETHFee;

    /**
    * Network: Mainnet
    * Aggregator: DAI/USD
    * Address: 0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9
    */
    AggregatorV3Interface internal DAIFee;

    /**
    * Network: Mainnet
    * Aggregator: LINK/USD
    * Address: 0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c
    */
    AggregatorV3Interface internal LINKFee;
    
    /**
    * @dev Required to allow proxy contract deployer to take ownership
    */
    function initialize() initializer public {
        OwnableUpgradeable.__Ownable_init();
        _decimals = 18;
        recipient = owner();
        fee = 1;
        ETHFee = AggregatorV3Interface(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419);
        DAIFee = AggregatorV3Interface(0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9);
        LINKFee = AggregatorV3Interface(0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c);
        DAI = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
        LINK = IERC20(0x514910771AF9Ca656af840dff83E8264EcF986CA);
    }

    /**
    * @notice buy an offer paying with ETH
    * @dev In case that don't send enough money: refund the money and revert.
    * In case that send the exact money: make the purchase and get the comission.
    * In case that send more than the necessary money: make the purchase, get the comission
    * and refund the exceed
    */
    function buyWithETH(uint _offerID) external payable OfferAvailable(_offerID) {
        uint refund;
        IERC1155 NFT;
        if(msg.value < offers[_offerID].price){
            // refund and revert
            refund = msg.value;
            payable(msg.sender).transfer(refund);
            revert("Insufficient funds!");
        }else if(msg.value == offers[_offerID].price){
            NFT = IERC1155(offers[_offerID].tokenAddress);

            // transfer the tokens
            NFT.safeTransferFrom(offers[_offerID].sellerAddress, msg.sender, offers[_offerID].tokenID, offers[_offerID].amount, "");

            // update the status of the offer to SOLD
            offers[_offerID].status = "SOLD";

            // getting the commission
            payable(recipient).transfer(offers[_offerID].price * fee / 100);
        }else if(msg.value > offers[_offerID].price){
            NFT = IERC1155(offers[_offerID].tokenAddress);

            // transfer the tokens
            NFT.safeTransferFrom(offers[_offerID].sellerAddress, msg.sender, offers[_offerID].tokenID, offers[_offerID].amount, "");

            // update the status of the offer to SOLD

            offers[_offerID].status = "SOLD";

            //getting the commission
            payable(recipient).transfer(offers[_offerID].price * fee / 100);

            //refund the exceed
            refund = msg.value - offers[_offerID].price;
            payable(msg.sender).transfer(refund);
        }
    }

    /**
    * @notice buy an offer paying with cryptocurrencies, in this version only accept DAI and LINK
    * @dev get the values of price, baseDecimals and token depending on the token with which the
    * buyer going to pay. Need scale the price to same base decimal that the ERC20 tokens to calculate
    * the price in tokens. No need to refund because only take the tokens needed to buy the offer.
    */
    function buyWithCrypto(string memory _crypto, uint _offerID) external OfferAvailable(_offerID) {
        uint256 tokenApproveds;
        int256 price;
        IERC20 token;
        IERC1155 NFT;
        uint8 baseDecimals;
        if(keccak256(abi.encodePacked(_crypto)) == keccak256(abi.encodePacked("DAI"))){
            (,price,,,) = DAIFee.latestRoundData();
            baseDecimals = DAIFee.decimals();
            token = DAI;
        }else if(keccak256(abi.encodePacked(_crypto)) == keccak256(abi.encodePacked("LINK"))){
            (,price,,,) = LINKFee.latestRoundData();
            baseDecimals = LINKFee.decimals();
            token = LINK;
        }
        // ERC20 tokens approveds by msg.sender to spend in order to buy the offer
        tokenApproveds = token.allowance(msg.sender, address(this));

        // ERC20 tokens needed to buy the offer
        uint tokenToSpend = offers[_offerID].price / scaleDecimals(uint(price), baseDecimals);

        // The number of the tokens approveds must be greater than or equal to the tokens needed for buy
        require(tokenApproveds >= tokenToSpend, "Not enough tokens to buy");
        NFT = IERC1155(offers[_offerID].tokenAddress);

        // transfer the corresponding ERC20 tokens
        uint sellerPart = tokenToSpend*(100 - fee)/100;
        uint recipientPart = tokenToSpend*(fee)/100;
        _safeTransferFrom20(token, msg.sender, offers[_offerID].sellerAddress , sellerPart);
        _safeTransferFrom20(token, msg.sender, recipient , recipientPart);

        // transfer the corresponding ERC1155 tokens
        NFT.safeTransferFrom(offers[_offerID].sellerAddress, msg.sender, offers[_offerID].tokenID, offers[_offerID].amount, "");
        
        // update the status of the offer to SOLD
        offers[_offerID].status = "SOLD";
    }

    function _safeTransferFrom20(IERC20 _token, address _sender, address _recipient, uint _amount) private {
        bool sent = _token.transferFrom(_sender, _recipient, _amount);
        require(sent, "Token transfer failed.");
    }

    /**
    * @notice scale a number with a _priceDecimals decimals precision to _decimals decimal precision
    */
    function scaleDecimals(uint256 _price, uint8 _priceDecimals) internal view returns (uint256) {
        if(_priceDecimals < _decimals) {
            return _price * uint256(10 ** uint256(_decimals - _priceDecimals));
        }else if(_priceDecimals > _decimals) {
            return _price / uint256(10 ** uint256(_priceDecimals - _decimals));
        }
        return _price;
    }

    /**
    * @dev Update the status if deadline is over and the state of the offer is ACTIVE
    */
    function _checkDeadline(uint _offerID) internal {
        if(keccak256(abi.encodePacked(offers[_offerID].status)) == keccak256(abi.encodePacked("ACTIVE")) 
        && offers[_offerID].deadline < block.timestamp){
            offers[_offerID].status = "OFFTIME";
        }
    }

    /**
    * @notice Update the recipient of the commissions
    * @dev Only the owner is able to change the recipient
    */
    function setRecipient(address _addr) external onlyOwner {
        recipient = _addr;
    }

    /**
    * @notice Update the fee of the sales
    * @dev Only the owner is able to change the fee
    */
    function setFee(uint8 _fee) external onlyOwner {
        fee = _fee;
    }

    /**
    * @notice Return an offer by his ID
    */
    function getOffer(uint _offerID) public view returns(Offer memory){
        return offers[_offerID];
    }

}