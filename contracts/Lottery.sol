// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";

// TODO
// 1 Enter the lottery (mke payment)
// 2 Pick random winner (verifiable)
// 3 Winner to be selected every x minute -> automatic

// Chainlink oracles -> Randomness, automated execution

// Errors

error Lottery__InvalidEntranceFee();

// Interfaces

// Libraries

// Contracts

contract Lottery is VRFConsumerBaseV2 {
    // Type declarations and usings

    // Constants/Immutables
    uint256 private immutable i_entranceFeeWei;

    // State variables
    address payable[] private s_players;

    // Modifiers

    // Events

    event LotteryJoined(address indexed player);

    // Constructor
    constructor(
        uint256 entranceFee,
        address vrfCoordinator
    ) VRFConsumerBaseV2(vrfCoordinator) {
        i_entranceFeeWei = entranceFee;
    }

    // Receive and fallback

    // External
    function pickWinner() external {}

    // Public
    function joinLottery() public payable {
        if (msg.value < i_entranceFeeWei) {
            revert Lottery__InvalidEntranceFee();
        }

        s_players.push(payable(msg.sender));
        emit LotteryJoined(msg.sender);
    }

    // Internal
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] memory randomness
    ) internal override {}

    // Private

    // Pure/view
}
