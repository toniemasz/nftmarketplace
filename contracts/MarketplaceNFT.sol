// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MarketplaceNFT is ERC721, Ownable {
    uint256 public tokenIdCounter;
    mapping(uint256 => bool) public forSale;
    mapping(uint256 => uint256) public price;

    constructor(address initialOwner) ERC721("MarketplaceNFT", "MNFT") Ownable(initialOwner) {}

    function mint(address to) external onlyOwner returns (uint256) {
        uint256 tokenId = ++tokenIdCounter;
        _mint(to, tokenId);
        return tokenId;
    }

    function listForSale(uint256 tokenId, uint256 _price) external {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        forSale[tokenId] = true;
        price[tokenId] = _price;
    }

    function cancelSale(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        forSale[tokenId] = false;
        price[tokenId] = 0;
    }

    function purchase(uint256 tokenId) external payable {
        require(forSale[tokenId], "Not for sale");
        uint256 nftPrice = price[tokenId];
        require(msg.value >= nftPrice, "Insufficient");
        address ownerAddr = ownerOf(tokenId);
        _transfer(ownerAddr, msg.sender, tokenId);
        forSale[tokenId] = false;
        price[tokenId] = 0;
        payable(ownerAddr).transfer(nftPrice);
        if (msg.value > nftPrice) {
            payable(msg.sender).transfer(msg.value - nftPrice);
        }
    }
}
