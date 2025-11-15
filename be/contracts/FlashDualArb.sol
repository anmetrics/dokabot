// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/* ======================================================
   IMPORTS
   ====================================================== */
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

/* ======================================================
   UNISWAP INTERFACES
   ====================================================== */
interface IUniswapV2Pair {
    function swap(
        uint amount0Out,
        uint amount1Out,
        address to,
        bytes calldata data
    ) external;

    function token0() external view returns (address);
    function token1() external view returns (address);
}

interface IUniswapV2Router02 {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
}

/* ======================================================
   FLASHDUALARB – SECURE MAINNET VERSION (FIXED)
   ====================================================== */
contract FlashDualArb is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable owner;
    bytes32 public immutable uniswapPairCodeHash;

    /* ---------- SECURITY: WHITELISTED ROUTERS ---------- */
    mapping(address => bool) public allowedRouters;

    modifier onlyOwner() {
        require(msg.sender == owner, 'Not owner');
        _;
    }

    constructor(bytes32 _pairCodeHash) {
        owner = msg.sender;
        uniswapPairCodeHash = _pairCodeHash;
    }

    /* ======================================================
       STRUCTS
       ====================================================== */
    struct ArbitrageRoute {
        address[] path;
        uint amountOutMin;
    }

    /* ======================================================
       ADMIN FUNCTIONS
       ====================================================== */
    function setRouter(address router, bool allowed) external onlyOwner {
        allowedRouters[router] = allowed;
        emit RouterUpdated(router, allowed);
    }

    function withdraw(IERC20 token) external onlyOwner {
        uint bal = token.balanceOf(address(this));
        if (bal > 0) token.safeTransfer(owner, bal);
    }

    /* ======================================================
       INTERNAL SECURITY VALIDATION
       ====================================================== */
    function _validateRealPair(address pair) internal view {
        uint size;
        assembly {
            size := extcodesize(pair)
        }
        require(size > 0, 'Pair has no code');

        bytes32 hash;
        assembly {
            hash := extcodehash(pair)
        }
        require(hash == uniswapPairCodeHash, 'Invalid pair codehash');
    }

    function _safeApprove(IERC20 token, address spender, uint amount) internal {
        uint current = token.allowance(address(this), spender);

        if (current > 0) {
            SafeERC20.safeDecreaseAllowance(token, spender, current);
        }

        SafeERC20.safeIncreaseAllowance(token, spender, amount);
    }

    function _validateBorrow(uint a0, uint a1) internal pure {
        require(a0 > 0 || a1 > 0, 'No borrow amount');
    }

    /* ======================================================
       ENTRY – SINGLE ROUTE
       ====================================================== */
    function start(
        address pair,
        uint amount0Out,
        uint amount1Out,
        address[] calldata route,
        address repayToken,
        address router,
        uint minProfit
    ) external onlyOwner {
        require(allowedRouters[router], 'Router blocked');
        _validateBorrow(amount0Out, amount1Out);
        _validateRealPair(pair);

        address borrowedToken = amount0Out > 0
            ? IUniswapV2Pair(pair).token0()
            : IUniswapV2Pair(pair).token1();

        require(route.length >= 2, 'Route too short');
        require(route[0] == borrowedToken, 'Wrong route start');
        require(route[route.length - 1] == repayToken, 'Wrong route end');

        bytes memory data = abi.encode(
            msg.sender,
            repayToken,
            router,
            minProfit,
            route,
            uint8(0) // mode=0 → single
        );

        IUniswapV2Pair(pair).swap(amount0Out, amount1Out, address(this), data);
    }

    /* ======================================================
       ENTRY – MULTI ROUTE
       ====================================================== */
    function startMulti(
        address pair,
        uint amount0Out,
        uint amount1Out,
        ArbitrageRoute[] calldata routes,
        address repayToken,
        address router,
        uint minProfit
    ) external onlyOwner {
        require(routes.length >= 2, 'Need >=2 routes');
        require(allowedRouters[router], 'Router blocked');
        _validateBorrow(amount0Out, amount1Out);
        _validateRealPair(pair);

        address borrowedToken = amount0Out > 0
            ? IUniswapV2Pair(pair).token0()
            : IUniswapV2Pair(pair).token1();

        require(routes[0].path[0] == borrowedToken, 'First route mismatch');
        for (uint i = 0; i < routes.length - 1; i++) {
            require(
                routes[i].path[routes[i].path.length - 1] ==
                    routes[i + 1].path[0],
                'Broken route'
            );
        }
        require(
            routes[routes.length - 1].path[
                routes[routes.length - 1].path.length - 1
            ] == repayToken,
            'Last route output mismatch'
        );

        bytes memory routesBytes = abi.encode(routes);
        bytes memory data = abi.encode(
            msg.sender,
            repayToken,
            router,
            minProfit,
            routesBytes,
            uint8(1) // mode=1 → multi
        );

        IUniswapV2Pair(pair).swap(amount0Out, amount1Out, address(this), data);
    }

    /* ======================================================
       CALLBACK – SECURE UNISWAP V2 FLASHLOAN
       ====================================================== */
    function uniswapV2Call(
        address sender,
        uint amount0,
        uint amount1,
        bytes calldata data
    ) external nonReentrant {
        require(sender == address(this), 'Invalid callback sender');

        (
            address user,
            address repayToken,
            address router,
            uint minProfit,
            bytes memory extra,
            uint8 mode
        ) = abi.decode(data, (address, address, address, uint, bytes, uint8));

        require(allowedRouters[router], 'Router blocked');

        address pair = msg.sender;
        _validateRealPair(pair);

        address borrowedToken = amount0 > 0
            ? IUniswapV2Pair(pair).token0()
            : IUniswapV2Pair(pair).token1();
        uint borrowedAmount = amount0 > 0 ? amount0 : amount1;

        // Ensure repayToken is one of the pair tokens
        address token0 = IUniswapV2Pair(pair).token0();
        address token1 = IUniswapV2Pair(pair).token1();
        require(
            repayToken == token0 || repayToken == token1,
            'Repay token invalid'
        );

        /* ---------- Calculate debt (Uniswap 0.3%) ---------- */
        uint fee = (borrowedAmount * 3) / 997 + 1;
        uint repayAmount = borrowedAmount + fee;

        uint preBal = IERC20(repayToken).balanceOf(address(this));

        /* ---------- Execute arbitrage ---------- */
        if (mode == 0) {
            _executeSingle(
                borrowedToken,
                borrowedAmount,
                repayToken,
                router,
                extra
            );
        } else {
            _executeMulti(
                borrowedToken,
                borrowedAmount,
                repayToken,
                router,
                extra
            );
        }

        /* ---------- Profit & Repay ---------- */
        uint postBal = IERC20(repayToken).balanceOf(address(this));
        require(postBal >= repayAmount, 'Not enough to repay');

        uint netGain = postBal - preBal - fee;
        require(netGain >= minProfit, 'Profit < minProfit');

        IERC20(repayToken).safeTransfer(pair, repayAmount);
        if (netGain > 0) IERC20(repayToken).safeTransfer(user, netGain);

        emit ArbitrageExecuted(user, repayToken, repayAmount, netGain);
    }

    /* ======================================================
       INTERNAL EXECUTION
       ====================================================== */
    function _executeSingle(
        address borrowedToken,
        uint amountIn,
        address repayToken,
        address router,
        bytes memory extra
    ) internal {
        address[] memory path = abi.decode(extra, (address[]));

        _safeApprove(IERC20(borrowedToken), router, amountIn);

        IUniswapV2Router02(router).swapExactTokensForTokens(
            amountIn,
            1, // MIN AMOUNT > 0 to avoid MEV attack
            path,
            address(this),
            block.timestamp + 180
        );
    }

    function _executeMulti(
        address borrowedToken,
        uint amountIn,
        address repayToken,
        address router,
        bytes memory extra
    ) internal {
        ArbitrageRoute[] memory routes = abi.decode(extra, (ArbitrageRoute[]));

        uint amount = amountIn;
        address currentToken = borrowedToken;

        for (uint i = 0; i < routes.length; i++) {
            ArbitrageRoute memory r = routes[i];
            require(r.path[0] == currentToken, 'Path mismatch');

            _safeApprove(IERC20(currentToken), router, amount);

            uint[] memory out = IUniswapV2Router02(router)
                .swapExactTokensForTokens(
                    amount,
                    r.amountOutMin,
                    r.path,
                    address(this),
                    block.timestamp + 180
                );

            amount = out[out.length - 1];
            currentToken = r.path[r.path.length - 1];
        }
    }

    /* ======================================================
       EVENTS
       ====================================================== */
    event RouterUpdated(address router, bool allowed);

    event ArbitrageExecuted(
        address indexed user,
        address indexed repayToken,
        uint repayTotal,
        uint profit
    );
}
