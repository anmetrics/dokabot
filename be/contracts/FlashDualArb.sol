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
   FLASHDUALARB – SECURE MAINNET VERSION (MULTI-ROUTER)
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
        address router;
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
    event ArbitrageFailed(address indexed user, string reason);

    /* ======================================================
       ADMIN FUNCTIONS
       ====================================================== */
    function setRouter(address router, bool allowed) external onlyOwner {
        allowedRouters[router] = allowed;
        emit RouterUpdated(router, allowed);
    }

    function withdraw(IERC20 token) external onlyOwner {
        uint bal = token.balanceOf(address(this));
        if (bal > 0) SafeERC20.safeTransfer(token, owner, bal);
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
        if (amount > 0) {
            SafeERC20.safeIncreaseAllowance(token, spender, amount);
        }
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
        if (!allowedRouters[router]) {
            emit ArbitrageFailed(msg.sender, 'Router blocked');
            return;
        }

        if (amount0Out == 0 && amount1Out == 0) {
            emit ArbitrageFailed(msg.sender, 'No borrow amount');
            return;
        }

        _validateRealPair(pair);

        address borrowedToken = amount0Out > 0
            ? IUniswapV2Pair(pair).token0()
            : IUniswapV2Pair(pair).token1();

        if (
            route.length < 2 ||
            route[0] != borrowedToken ||
            route[route.length - 1] != repayToken
        ) {
            emit ArbitrageFailed(msg.sender, 'Invalid route');
            return;
        }

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
        uint minProfit
    ) external onlyOwner {
        if (routes.length < 2) {
            emit ArbitrageFailed(msg.sender, 'Need >=2 routes');
            return;
        }

        _validateBorrow(amount0Out, amount1Out);
        _validateRealPair(pair);

        address borrowedToken = amount0Out > 0
            ? IUniswapV2Pair(pair).token0()
            : IUniswapV2Pair(pair).token1();

        if (routes[0].path[0] != borrowedToken) {
            emit ArbitrageFailed(msg.sender, 'First route mismatch');
            return;
        }

        for (uint i = 0; i < routes.length; i++) {
            if (!allowedRouters[routes[i].router]) {
                emit ArbitrageFailed(msg.sender, 'Router blocked');
                return;
            }
            if (i < routes.length - 1) {
                if (
                    routes[i].path[routes[i].path.length - 1] !=
                    routes[i + 1].path[0]
                ) {
                    emit ArbitrageFailed(msg.sender, 'Broken route');
                    return;
                }
            } else {
                if (routes[i].path[routes[i].path.length - 1] != repayToken) {
                    emit ArbitrageFailed(
                        msg.sender,
                        'Last route output mismatch'
                    );
                    return;
                }
            }
        }

        bytes memory routesBytes = abi.encode(routes);
        bytes memory data = abi.encode(
            msg.sender,
            repayToken,
            address(0),
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
            address routerOrPlaceholder,
            uint minProfit,
            bytes memory extra,
            uint8 mode
        ) = abi.decode(data, (address, address, address, uint, bytes, uint8));

        address pair = msg.sender;
        _validateRealPair(pair);

        address borrowedToken = amount0 > 0
            ? IUniswapV2Pair(pair).token0()
            : IUniswapV2Pair(pair).token1();
        uint borrowedAmount = amount0 > 0 ? amount0 : amount1;

        address token0 = IUniswapV2Pair(pair).token0();
        address token1 = IUniswapV2Pair(pair).token1();
        require(
            repayToken == token0 || repayToken == token1,
            'Repay token invalid'
        );

        uint fee = (borrowedAmount * 3) / 997 + 1;
        uint repayAmount = borrowedAmount + fee;
        uint preBal = IERC20(repayToken).balanceOf(address(this));

        if (mode == 0) {
            _executeSingle(
                borrowedToken,
                borrowedAmount,
                repayToken,
                routerOrPlaceholder,
                extra,
                user
            );
        } else {
            _executeMulti(
                borrowedToken,
                borrowedAmount,
                repayToken,
                extra,
                user
            );
        }

        uint postBal = IERC20(repayToken).balanceOf(address(this));
        require(postBal >= repayAmount, 'Not enough to repay');

        uint netGain = postBal - preBal - fee;
        require(netGain >= minProfit, 'Profit < minProfit');

        SafeERC20.safeTransfer(IERC20(repayToken), pair, repayAmount);
        if (netGain > 0)
            SafeERC20.safeTransfer(IERC20(repayToken), user, netGain);

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
        bytes memory extra,
        address user
    ) internal {
        address[] memory path = abi.decode(extra, (address[]));
        _safeApprove(IERC20(borrowedToken), router, amountIn);

        try
            IUniswapV2Router02(router).swapExactTokensForTokens(
                amountIn,
                1,
                path,
                address(this),
                block.timestamp + 180
            )
        returns (uint[] memory out) {
            // success
        } catch {
            revert('Swap failed');
            emit ArbitrageFailed(user, 'Single swap failed');
        }
    }

    function _executeMulti(
        address borrowedToken,
        uint amountIn,
        address repayToken,
        bytes memory extra,
        address user
    ) internal {
        ArbitrageRoute[] memory routes = abi.decode(extra, (ArbitrageRoute[]));

        uint amount = amountIn;
        address currentToken = borrowedToken;

        for (uint i = 0; i < routes.length; i++) {
            ArbitrageRoute memory r = routes[i];
            if (r.path[0] != currentToken) {
                emit ArbitrageFailed(user, 'Path mismatch in multi swap');
                return;
            }
            if (!allowedRouters[r.router]) {
                emit ArbitrageFailed(user, 'Router blocked in multi swap');
                return;
            }

            _safeApprove(IERC20(currentToken), r.router, amount);

            try
                IUniswapV2Router02(r.router).swapExactTokensForTokens(
                    amount,
                    r.amountOutMin,
                    r.path,
                    address(this),
                    block.timestamp + 180
                )
            returns (uint[] memory out) {
                amount = out[out.length - 1];
                currentToken = r.path[r.path.length - 1];
            } catch {
                emit ArbitrageFailed(user, 'Multi swap failed');
                return;
            }
        }
    }
}
