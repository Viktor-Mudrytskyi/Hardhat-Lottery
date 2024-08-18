// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";

// TODO
// 1 Enter the lottery (mke payment)
// 2 Pick random winner (verifiable)
// 3 Winner to be selected every x minute -> automatic

// Chainlink oracles -> Randomness, automated execution

// Errors

error Lottery__InvalidEntranceFee();
error Lottery__TransferFailed();
error Lottery__NotOpened();
error Lottery__LotteryUpkeepNotNeeded(
    uint256 balance,
    uint256 numPlayers,
    uint256 lotteryState
);

// Interfaces

// Libraries

// Contracts

contract Lottery is VRFConsumerBaseV2Plus, AutomationCompatibleInterface {
    // Type declarations and usings
    enum LotteryState {
        OPEN,
        CALCULATING
    }

    // Constants/Immutables
    uint256 private immutable i_entranceFeeWei;
    bytes32 private immutable i_keyHash;
    uint256 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGasLimit;
    uint256 private immutable i_interval;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;

    // State variables
    address payable[] private s_players;
    address private s_recentWinner;
    LotteryState private s_lotteryState;
    uint256 private s_lastTimestamp;

    // Modifiers

    // Events

    event LotteryJoined(address indexed player);
    event LotteryRandomId(uint256 indexed requestId);
    event LotteryWinnerPicked(address indexed winner);

    // Constructor
    constructor(
        uint256 entranceFee,
        address vrfCoordinator,
        bytes32 keyHash,
        uint256 subscriptionId,
        uint32 callbackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2Plus(vrfCoordinator) {
        i_entranceFeeWei = entranceFee;
        i_keyHash = keyHash;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_lotteryState = LotteryState.OPEN;
        s_lastTimestamp = block.timestamp;
        i_interval = interval;
    }

    // Receive and fallback

    // External
    function performUpkeep(bytes calldata /*performData*/) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (!upkeepNeeded) {
            revert Lottery__LotteryUpkeepNotNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_lotteryState)
            );
        }
        s_lotteryState = LotteryState.CALCULATING;
        uint256 requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: i_keyHash,
                subId: i_subscriptionId,
                requestConfirmations: REQUEST_CONFIRMATIONS,
                callbackGasLimit: i_callbackGasLimit,
                numWords: NUM_WORDS,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: false})
                )
            })
        );

        emit LotteryRandomId(requestId);
    }

    // Public
    function joinLottery() public payable {
        if (msg.value < i_entranceFeeWei) {
            revert Lottery__InvalidEntranceFee();
        }
        if (s_lotteryState != LotteryState.OPEN) {
            revert Lottery__NotOpened();
        }

        s_players.push(payable(msg.sender));
        emit LotteryJoined(msg.sender);
    }

    // Internal
    function fulfillRandomWords(
        uint256 /*requestId*/,
        uint256[] calldata randomWords
    ) internal override {
        uint256 winnerIndex = randomWords[0] % s_players.length;
        address payable winner = s_players[winnerIndex];
        s_recentWinner = winner;
        s_lotteryState = LotteryState.OPEN;
        s_players = new address payable[](0);
        s_lastTimestamp = block.timestamp;
        (bool success, ) = winner.call{value: address(this).balance}("");
        if (!success) {
            revert Lottery__TransferFailed();
        }
        emit LotteryWinnerPicked(winner);
    }

    // Private

    // Pure/view

    function checkUpkeep(
        bytes memory /*checkData*/
    )
        public
        view
        override
        returns (bool upkeepNeeded, bytes memory /*performData*/)
    {
        bool isOpen = s_lotteryState == LotteryState.OPEN;
        bool timePassed = (block.timestamp - s_lastTimestamp) >= i_interval;
        bool hasPlayers = s_players.length > 0;
        bool hasBalance = address(this).balance > 0;
        // apparantly this works ???
        upkeepNeeded = isOpen && timePassed && hasPlayers && hasBalance;

        return (upkeepNeeded, bytes(""));
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getEntranceFee() public view returns (uint256) {
        return i_entranceFeeWei;
    }

    function getLotteryState() public view returns (LotteryState) {
        return s_lotteryState;
    }

    function getNumberOfPlayers() public view returns (uint256) {
        return s_players.length;
    }

    function getRecentTimestamp() public view returns (uint256) {
        return s_lastTimestamp;
    }

    function getNumWords() public pure returns (uint32) {
        return NUM_WORDS;
    }

    function getLatestTimestamp() public view returns (uint256) {
        return s_lastTimestamp;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getPlayers() public view returns (address payable[] memory) {
        return s_players;
    }
}
