// SPDX-License-Identifier: MIT
pragma solidity >=0.8.3;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

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
    uint fee;

    /**
    * @dev Required to allow proxy contract deployer to take ownership
    */
    function initialize() initializer public {
        OwnableUpgradeable.__Ownable_init();
        recipient = owner();
        fee = 1;
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
        if(msg.value < offers[_offerID].price){
            // refund and revert
            refund = msg.value;
            payable(msg.sender).transfer(refund);
            revert("Insufficient funds!");
        }else if(msg.value == offers[_offerID].price){
            // make the purchase

            // getting the commission
            payable(recipient).transfer(offers[_offerID].price * fee / 100);
        }else if(msg.value > offers[_offerID].price){
            // make the purchase

            //getting the commission
            payable(recipient).transfer(offers[_offerID].price * fee / 100);

            //refund the exceed
            refund = msg.value - offers[_offerID].price;
            payable(msg.sender).transfer(refund);
        }
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
    function setFee(uint _fee) external onlyOwner {
        fee = _fee;
    }

    /**
    * @notice Return an offer by his ID
    */
    function getOffer(uint _offerID) public view returns(Offer memory){
        return offers[_offerID];
    }

}