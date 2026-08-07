// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * Recurring subscription charges on BSC.
 *
 * WHY A CONTRACT AT ALL
 * ---------------------
 * A plain `approve(ourEOA)` plus a backend `transferFrom` would work, and the
 * ERC20 `Transfer` event would even be enough to detect payment. The reason not
 * to do that is blast radius: an unlimited approval to an externally owned
 * account means one leaked private key drains every subscriber's entire USDT
 * balance, immediately and irreversibly.
 *
 * This contract bounds that. Even with full control of the charger key an
 * attacker can take at most `maxChargeAmount` per subscriber per `period`, and
 * only to the treasury address, which is set by the owner and not by the charger.
 *
 * WHY NOT PERMIT
 * --------------
 * BSC-USD (0x55d3...7955), the USDT everyone actually holds on BSC, does not
 * implement EIP-2612. Neither does Binance-Peg USDC. `permit` would restrict the
 * product to tokens almost nobody uses, so the flow is a one-time `approve` on
 * the token followed by pulls from here.
 */
contract SubscriptionManager {
    struct Subscription {
        uint64 startedAt;
        uint64 lastChargedAt;
        uint32 chargeCount;
        bool active;
    }

    IERC20 public immutable token;
    uint8 public immutable tokenDecimals;

    address public owner;
    address public treasury;
    /// Backend key allowed to trigger charges. Separate from `owner` so it can be
    /// rotated without touching who controls the money.
    address public charger;

    /// Hard ceiling per charge, in token units. Set once at deploy.
    uint256 public immutable maxChargeAmount;
    /// Minimum seconds between two charges of the same subscriber.
    uint256 public immutable period;

    bool public paused;

    mapping(address => Subscription) public subscriptions;

    event Subscribed(address indexed user, uint64 timestamp);
    event Unsubscribed(address indexed user, uint64 timestamp);
    event Charged(
        address indexed user,
        uint256 amount,
        uint32 indexed chargeCount,
        uint64 timestamp
    );
    event ChargeFailed(address indexed user, string reason, uint64 timestamp);
    event ChargerChanged(address indexed previous, address indexed next);
    event TreasuryChanged(address indexed previous, address indexed next);
    event PausedSet(bool paused);

    error NotOwner();
    error NotCharger();
    error Paused();
    error ZeroAddress();
    error AmountTooHigh();
    error NotSubscribed();
    error TooSoon();
    error InsufficientAllowance();
    error InsufficientBalance();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyCharger() {
        if (msg.sender != charger) revert NotCharger();
        _;
    }

    constructor(
        address token_,
        address treasury_,
        address charger_,
        uint256 maxChargeAmount_,
        uint256 period_,
        uint8 tokenDecimals_
    ) {
        if (token_ == address(0) || treasury_ == address(0) || charger_ == address(0)) {
            revert ZeroAddress();
        }
        token = IERC20(token_);
        treasury = treasury_;
        charger = charger_;
        maxChargeAmount = maxChargeAmount_;
        period = period_;
        tokenDecimals = tokenDecimals_;
        owner = msg.sender;
    }

    /**
     * Opts the caller in.
     *
     * Called by the user's own wallet, so the address that appears in the event is
     * proven to be theirs — the backend never has to trust a client-supplied
     * address. The token approval is a separate transaction on the token itself.
     */
    function subscribe() external {
        if (paused) revert Paused();

        Subscription storage sub = subscriptions[msg.sender];
        sub.active = true;
        if (sub.startedAt == 0) {
            sub.startedAt = uint64(block.timestamp);
        }

        emit Subscribed(msg.sender, uint64(block.timestamp));
    }

    /**
     * Opts the caller out.
     *
     * Cancelling here stops future pulls even if the token approval is still in
     * place, so a user is never forced to send a second transaction to be safe.
     */
    function unsubscribe() external {
        subscriptions[msg.sender].active = false;
        emit Unsubscribed(msg.sender, uint64(block.timestamp));
    }

    /**
     * Pulls one period's fee from a subscriber.
     *
     * Every guard here exists to make a compromised charger key survivable: it
     * cannot exceed the cap, cannot charge early, cannot charge a non-subscriber,
     * and cannot redirect the funds.
     */
    function charge(address user, uint256 amount) external onlyCharger {
        if (paused) revert Paused();
        if (amount > maxChargeAmount) revert AmountTooHigh();

        Subscription storage sub = subscriptions[user];
        if (!sub.active) revert NotSubscribed();
        if (sub.lastChargedAt != 0 && block.timestamp < sub.lastChargedAt + period) {
            revert TooSoon();
        }

        if (token.allowance(user, address(this)) < amount) revert InsufficientAllowance();
        if (token.balanceOf(user) < amount) revert InsufficientBalance();

        // State first, transfer second: even though `token` is fixed at deploy and
        // the caller is trusted, ordering it this way means no token can ever
        // re-enter and charge twice within one period.
        sub.lastChargedAt = uint64(block.timestamp);
        sub.chargeCount += 1;

        if (!token.transferFrom(user, treasury, amount)) revert TransferFailed();

        emit Charged(user, amount, sub.chargeCount, uint64(block.timestamp));
    }

    /**
     * Charges many subscribers in one transaction.
     *
     * A failure for one user must not revert the batch, or a single subscriber
     * with an empty wallet would block billing for everyone else.
     */
    function chargeBatch(address[] calldata users, uint256 amount) external onlyCharger {
        for (uint256 i = 0; i < users.length; i++) {
            try this.charge(users[i], amount) {
                // charge() emits its own event.
            } catch Error(string memory reason) {
                emit ChargeFailed(users[i], reason, uint64(block.timestamp));
            } catch {
                emit ChargeFailed(users[i], "unknown", uint64(block.timestamp));
            }
        }
    }

    /** True when a charge would succeed right now. Lets the backend skip doomed calls. */
    function chargeable(address user, uint256 amount) external view returns (bool) {
        Subscription memory sub = subscriptions[user];
        return
            !paused &&
            sub.active &&
            amount <= maxChargeAmount &&
            (sub.lastChargedAt == 0 || block.timestamp >= sub.lastChargedAt + period) &&
            token.allowance(user, address(this)) >= amount &&
            token.balanceOf(user) >= amount;
    }

    function setCharger(address next) external onlyOwner {
        if (next == address(0)) revert ZeroAddress();
        emit ChargerChanged(charger, next);
        charger = next;
    }

    function setTreasury(address next) external onlyOwner {
        if (next == address(0)) revert ZeroAddress();
        emit TreasuryChanged(treasury, next);
        treasury = next;
    }

    /** Stops all charging. The switch to reach for when something looks wrong. */
    function setPaused(bool value) external onlyOwner {
        paused = value;
        emit PausedSet(value);
    }

    function transferOwnership(address next) external onlyOwner {
        if (next == address(0)) revert ZeroAddress();
        owner = next;
    }
}
