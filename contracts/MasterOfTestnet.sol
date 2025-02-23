// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";

contract MasterOfTestnet is Ownable {

    address public masterAddress;
    string public masterName;
    uint256 public masterLevel;

    mapping(address => string) public names;
    mapping(address => uint256) public levels;

    constructor(address initialOwner) Ownable(initialOwner) {
      reset();
    }

    // read

    function getInfo(address addr) view public returns (address, string memory, uint256) {
        return (addr, names[addr], levels[addr]);
    }
    function getMasterInfo() view external returns (address, string memory, uint256) {
        return getInfo(masterAddress);
    }

    // write

    function setName(string calldata _newName) external {
        names[msg.sender] = _newName;
    }
    function levelUp() external {
        uint256 newLevel = levels[msg.sender] + 1;
        levels[msg.sender] = newLevel;

        if (newLevel > masterLevel) {
          masterAddress = msg.sender;
          masterName = names[msg.sender];
          masterLevel = newLevel;
        }
    }

    // owner

    function reset() public onlyOwner {
      masterAddress = 0x0000000000000000000000000000000000000000;
      masterName = "Genesis";
      masterLevel = 0;
    }

}
