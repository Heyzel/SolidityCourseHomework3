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

contract TinyMarketplace is OwnableUpgradeable {

    event newOffer(address _seller, address _token,
    uint _tokenID, uint _amount, uint _deadline,
    uint _price, uint _offerID);

    event offerCancelled(uint _offerID, address canceledBy);

    event offerBought(address _buyer, uint _offerID,
     uint tokensSpents, uint dateOfPurchase);

    /**
    * @dev Structure to store offers, name of variables are self explanatory but status.
    * status will be used to indicate different states of the offer, these are ACTIVE,
    * CANCELLED, SOLD and OFFTIME in order to know the current state of the offer.
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
    * @dev This modifier check the tokens in the offer are availables
    */
    modifier TokensAvailables(uint _offerID){
        Offer memory _offer = offers[_offerID];
        IERC1155 NFT = IERC1155(_offer.tokenAddress);
        require(NFT.balanceOf(_offer.sellerAddress, _offer.tokenID) >= _offer.amount, "The seller no longer has the tokens.");
        _;
    }

    /**
    * @dev offers: the uint will be the index of the offer
    * offerCount: will be the amount of offers
    */
    mapping(uint => Offer) offers;
    uint public offerCount;
    address public recipient;
    uint8 public _decimals;
    uint8 public fee;

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

    /** @dev 
    * Network: Mainnet
    * Aggregator: ETH/USD
    * Address: 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419
    */
    AggregatorV3Interface public ETHFee;

    /** @dev 
    * Network: Mainnet
    * Aggregator: DAI/USD
    * Address: 0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9
    */
    AggregatorV3Interface public DAIFee;

    /** @dev
    * Network: Mainnet
    * Aggregator: LINK/USD
    * Address: 0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c
    */
    AggregatorV3Interface public LINKFee;
    
    /**
    * @dev Required to allow proxy contract deployer to take ownership
    */
    function initialize(
        address ETHFeeAddress,
        address DAIFeeAddress,
        address LINKFeeAddress,
        address DAIAddress,
        address LINKAddress,
        uint8 _Decimals,
        uint8 _Fee) initializer public {
        __Ownable_init();

        _decimals = _Decimals;
        recipient = _msgSender();
        fee = _Fee;
        ETHFee = AggregatorV3Interface(ETHFeeAddress);
        DAIFee = AggregatorV3Interface(DAIFeeAddress);
        LINKFee = AggregatorV3Interface(LINKFeeAddress);
        DAI = IERC20(DAIAddress);
        LINK = IERC20(LINKAddress);
    }

    /**
    * @notice create a new Offer
    * @param _tokenAddress is the address of the ERC1155 contract and cannot be the address 0
    * @param _tokenID is the id of the token within the ERC1155 contract
    * @param _amount is the amount to sell in the offer and cannot be 0 or less than the seller's tokens
    * @param _deadline is the deadline of the offer and cannot be less than or equal to the timestamp
    * @param _price is the price of the whole offer and there are no restriction for it
    * @dev I'm assuming `_price` comes in a precision of `_decimals` decimals, e.g. If I want sell my 
    * offer for 500 USD I have to send 500 * 10 ** (_decimals) i.e. 500000000000000000000
    * because `_decimals` is 18
    */
    function createOffer(address _tokenAddress, uint _tokenID, uint _amount, uint _deadline, uint _price) external {
        offers[offerCount].sellerAddress = msg.sender;

        require(_tokenAddress != address(0), "Invalid token address.");
        offers[offerCount].tokenAddress = _tokenAddress;

        offers[offerCount].tokenID = _tokenID;

        IERC1155 NFT = IERC1155(_tokenAddress);
        require(_amount > 0, "Invalid amount.");
        require(NFT.balanceOf(msg.sender, _tokenID) >= _amount, "Insufficient tokens");
        offers[offerCount].amount = _amount;

        require(_deadline > block.timestamp, "Invalid deadline.");
        offers[offerCount].deadline = _deadline;

        offers[offerCount].price = _price;

        offers[offerCount].status = "ACTIVE";

        emit newOffer(msg.sender, _tokenAddress, _tokenID, _amount, _deadline, _price, offerCount);

        offerCount++;
    }

    function cancelOffer(uint _offerID) external {
        require(offers[_offerID].sellerAddress == msg.sender, "Only the seller can cancel his offer");
        offers[_offerID].status = "CANCELLED";
        emit offerCancelled(_offerID, msg.sender);
    }

    /**
    * @notice buy an offer paying with ETH
    * @dev In case that don't send enough money: refund the money and revert.
    * In case that send the exact money: make the purchase and get the comission.
    * In case that send more than the necessary money: make the purchase, get the comission
    * and refund the exceed
    */
    function buyWithETH(uint _offerID) 
    external 
    payable 
    OfferAvailable(_offerID) 
    TokensAvailables(_offerID) {
        Offer memory _offer = offers[_offerID];
        uint refund;
        bool isPaid;
        (,int price,,,) = ETHFee.latestRoundData();
        uint8 baseDecimals = ETHFee.decimals();
        uint priceInETH = (_offer.price*(10**_decimals)) / scaleDecimals(uint(price), baseDecimals);
        IERC1155 NFT;
        require(msg.value >= priceInETH, "Insufficient funds!");
        if(msg.value == priceInETH){
            NFT = IERC1155(_offer.tokenAddress);

            // getting the commission and paying to the seller
            (isPaid, ) = payable(_offer.sellerAddress).call{value: priceInETH * (100 - fee) / 100}("");
            require(isPaid, "An error occurred in the payment to seller");
            (isPaid, ) = payable(recipient).call{value: priceInETH * fee / 100}("");
            require(isPaid, "An error occurred in the payment to contract");

            // transfer the tokens
            NFT.safeTransferFrom(_offer.sellerAddress, msg.sender, _offer.tokenID, _offer.amount, "");

            // update the status of the offer to SOLD and emit the bought
            _offer.status = "SOLD";
            emit offerBought(msg.sender, _offerID, priceInETH, block.timestamp);

           
        }else if(msg.value > priceInETH){
            NFT = IERC1155(_offer.tokenAddress);

            //refund the exceed
            refund = msg.value - priceInETH;
            (isPaid, ) = payable(msg.sender).call{value: refund}("");
            require(isPaid, "An error occurred in the refund");

             // getting the commission and paying to the seller
            (isPaid, ) = payable(_offer.sellerAddress).call{value: priceInETH * (100 - fee) / 100}("");
            require(isPaid, "An error occurred in the payment to seller");
            (isPaid, ) = payable(recipient).call{value: priceInETH * fee / 100}("");
            require(isPaid, "An error occurred in the payment to contract");

            // transfer the tokens
            NFT.safeTransferFrom(_offer.sellerAddress, msg.sender, _offer.tokenID, _offer.amount, "");

            // update the status of the offer to SOLD and emit the bought
            _offer.status = "SOLD";
            emit offerBought(msg.sender, _offerID, priceInETH, block.timestamp);

           

            
        }
    }

    /**
    * @notice buy an offer paying with cryptocurrencies, in this version only accept DAI and LINK
    * @dev get the values of price, baseDecimals and token depending on the token with which the
    * buyer going to pay. Need scale the price to same base decimal that the ERC20 tokens to calculate
    * the price in tokens. No need to refund because only take the tokens needed to buy the offer.
    */
    function buyWithCrypto(string memory _crypto, uint _offerID) 
    external 
    OfferAvailable(_offerID) 
    TokensAvailables(_offerID) {
        uint256 tokenApproveds;
        Offer memory _offer = offers[_offerID];
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
        uint tokenToSpend = _offer.price*(10**baseDecimals) / scaleDecimals(uint(price), baseDecimals);

        // The number of the tokens approveds must be greater than or equal to the tokens needed for buy
        require(tokenApproveds >= tokenToSpend, "Not enough tokens to buy");
        NFT = IERC1155(_offer.tokenAddress);

        // transfer the corresponding ERC20 tokens
        uint sellerPart = tokenToSpend*(100 - fee)/100;
        uint recipientPart = tokenToSpend*(fee)/100;
        _safeTransferFrom20(token, msg.sender, _offer.sellerAddress , sellerPart);
        _safeTransferFrom20(token, msg.sender, recipient , recipientPart);

        // transfer the corresponding ERC1155 tokens
        NFT.safeTransferFrom(_offer.sellerAddress, msg.sender, _offer.tokenID, _offer.amount, "");
        
        // update the status of the offer to SOLD and emit the bought
        _offer.status = "SOLD";
        emit offerBought(msg.sender, _offerID, tokenToSpend, block.timestamp);
    }

    /**
    * @dev try to do the transfer and return a bool indicating whether it was successful or failed
    */
    function _safeTransferFrom20(IERC20 _token, address _sender, address _recipient, uint _amount) private {
        bool sent = _token.transferFrom(_sender, _recipient, _amount);
        require(sent, "Token transfer failed.");
    }

    /**
    * @notice scale a number with a `_priceDecimals` decimals precision to a number 
    * with '_decimals' decimal precision
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