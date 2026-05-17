// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * ROYALE COIN ($RYL) — ERC-20 Sovereign Token
 *
 * The currency of the Royale Kingdom.
 * Deployed on Ethereum mainnet + Algorand (via ARC-20 bridge).
 *
 * Tokenomics:
 *   Total Supply:  1,000,000,000 $RYL (1 Billion)
 *   Creator Pool:  40% (400M) — distributed to creators via content revenue
 *   Platform:      20% (200M) — Royale treasury
 *   Community:     20% (200M) — staking rewards, DAO governance
 *   Team:          10% (100M) — 4-year vest, 1-year cliff
 *   Reserve:       10% (100M) — emergency + ecosystem growth
 *
 * Revenue Model:
 *   - 5% of every transaction goes to Royale treasury
 *   - Creators keep 95% — paid instantly in $RYL or ALGO
 *   - Stakers earn yield from platform revenue
 */

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract RoyaleCoin is ERC20, ERC20Burnable, ERC20Permit, Ownable, ReentrancyGuard {

    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18;
    uint256 public constant ROYALE_TAX_BPS = 500; // 5%
    uint256 public constant MAX_BPS = 10_000;

    address public treasuryWallet;
    address public creatorPool;

    mapping(address => bool) public isSovereign;  // exempt from tax
    mapping(address => uint256) public creatorRevenue;

    event SovereignTaxCollected(address indexed from, address indexed to, uint256 amount, uint256 tax);
    event CreatorPaid(address indexed creator, uint256 amount);

    constructor(
        address _treasury,
        address _creatorPool
    ) ERC20("Royale Coin", "RYL") ERC20Permit("Royale Coin") Ownable(msg.sender) {
        treasuryWallet = _treasury;
        creatorPool = _creatorPool;
        isSovereign[_treasury] = true;
        isSovereign[_creatorPool] = true;

        // Mint to sovereign allocations
        _mint(_treasury, TOTAL_SUPPLY * 20 / 100);         // Platform 20%
        _mint(_creatorPool, TOTAL_SUPPLY * 40 / 100);      // Creator pool 40%
        _mint(msg.sender, TOTAL_SUPPLY * 40 / 100);        // Remaining (community + team + reserve)
    }

    /**
     * Override transfer to collect Royale sovereign tax
     * Tax only applied to non-sovereign addresses
     */
    function _update(address from, address to, uint256 amount) internal override {
        if (from == address(0) || to == address(0) || isSovereign[from] || isSovereign[to]) {
            super._update(from, to, amount);
            return;
        }

        uint256 tax = (amount * ROYALE_TAX_BPS) / MAX_BPS;
        uint256 netAmount = amount - tax;

        super._update(from, treasuryWallet, tax);
        super._update(from, to, netAmount);

        emit SovereignTaxCollected(from, to, netAmount, tax);
    }

    function setSovereign(address account, bool status) external onlyOwner {
        isSovereign[account] = status;
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasuryWallet = _treasury;
        isSovereign[_treasury] = true;
    }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * ROYALE CONTENT — ERC-1155 Multi-Token Standard
 *
 * Every piece of content in the Ark is tokenized:
 *   - Token ID = content ID (mapped to IPFS CID)
 *   - Creators mint tokens for their content
 *   - Buyers receive access tokens
 *   - Royalties auto-paid on secondary sales
 *
 * The "Unlock" Model:
 *   - Creator sets price (e.g., 0.99 ALGO / 0.001 ETH / 1 RYL)
 *   - Buyer pays → instant 95% to creator, 5% to treasury
 *   - Buyer receives access token → can stream/download
 */

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";

contract RoyaleContent is ERC1155, ERC1155Supply, IERC2981, Ownable, ReentrancyGuard {

    RoyaleCoin public royaleCoin;
    address public treasury;
    uint256 public constant TAX_BPS = 500; // 5%
    uint256 public constant ROYALTY_BPS = 1000; // 10% secondary royalty to creator
    uint256 public constant MAX_BPS = 10_000;

    struct ContentToken {
        string ipfsCid;
        string manifestCid;
        address creator;
        uint256 priceWei;       // price in ETH (0 = free)
        uint256 priceRyl;       // price in $RYL
        uint256 maxSupply;      // 0 = unlimited
        bool isActive;
        uint256 totalRevenue;
        bytes32 quantumSigHash; // keccak256 of Dilithium-3 signature
    }

    mapping(uint256 => ContentToken) public tokens;
    mapping(uint256 => mapping(address => bool)) public hasAccess;
    mapping(address => uint256[]) public creatorTokens;
    uint256 private _nextTokenId = 1;

    event ContentMinted(
        uint256 indexed tokenId,
        address indexed creator,
        string ipfsCid,
        uint256 priceWei,
        uint256 priceRyl
    );
    event ContentPurchased(
        uint256 indexed tokenId,
        address indexed buyer,
        uint256 pricePaid,
        uint256 creatorRevenue,
        uint256 tax
    );
    event ContentUnlocked(uint256 indexed tokenId, address indexed user);

    constructor(
        address _royaleCoin,
        address _treasury
    ) ERC1155("https://gateway.pinata.cloud/ipfs/{id}") Ownable(msg.sender) {
        royaleCoin = RoyaleCoin(_royaleCoin);
        treasury = _treasury;
    }

    /**
     * Creator mints their content as a token
     * Links to IPFS CID — the actual content never touches the chain
     */
    function mintContent(
        string memory ipfsCid,
        string memory manifestCid,
        uint256 priceWei,
        uint256 priceRyl,
        uint256 maxSupply,
        bytes32 quantumSigHash
    ) external returns (uint256 tokenId) {
        tokenId = _nextTokenId++;

        tokens[tokenId] = ContentToken({
            ipfsCid: ipfsCid,
            manifestCid: manifestCid,
            creator: msg.sender,
            priceWei: priceWei,
            priceRyl: priceRyl,
            maxSupply: maxSupply,
            isActive: true,
            totalRevenue: 0,
            quantumSigHash: quantumSigHash,
        });

        creatorTokens[msg.sender].push(tokenId);
        hasAccess[tokenId][msg.sender] = true; // Creator always has access

        // Mint 1 token to creator as proof of ownership
        _mint(msg.sender, tokenId, 1, "");

        emit ContentMinted(tokenId, msg.sender, ipfsCid, priceWei, priceRyl);
    }

    /**
     * Purchase content with ETH
     * 95% → creator, 5% → treasury, instantly
     */
    function purchaseWithETH(uint256 tokenId) external payable nonReentrant {
        ContentToken storage token = tokens[tokenId];
        require(token.isActive, "Content not active");
        require(token.priceWei > 0, "Not for ETH sale");
        require(msg.value >= token.priceWei, "Insufficient payment");
        require(!hasAccess[tokenId][msg.sender], "Already purchased");

        if (token.maxSupply > 0) {
            require(totalSupply(tokenId) < token.maxSupply, "Sold out");
        }

        uint256 tax = (msg.value * TAX_BPS) / MAX_BPS;
        uint256 creatorCut = msg.value - tax;

        // Instant payments — no escrow, no delay
        (bool sentCreator,) = payable(token.creator).call{value: creatorCut}("");
        require(sentCreator, "Creator payment failed");

        (bool sentTax,) = payable(treasury).call{value: tax}("");
        require(sentTax, "Tax payment failed");

        hasAccess[tokenId][msg.sender] = true;
        tokens[tokenId].totalRevenue += msg.value;
        _mint(msg.sender, tokenId, 1, "");

        emit ContentPurchased(tokenId, msg.sender, msg.value, creatorCut, tax);
        emit ContentUnlocked(tokenId, msg.sender);
    }

    /**
     * Purchase content with $RYL tokens
     */
    function purchaseWithRYL(uint256 tokenId) external nonReentrant {
        ContentToken storage token = tokens[tokenId];
        require(token.isActive, "Content not active");
        require(token.priceRyl > 0, "Not for RYL sale");
        require(!hasAccess[tokenId][msg.sender], "Already purchased");

        uint256 tax = (token.priceRyl * TAX_BPS) / MAX_BPS;
        uint256 creatorCut = token.priceRyl - tax;

        // Transfer $RYL: buyer → creator + treasury
        royaleCoin.transferFrom(msg.sender, token.creator, creatorCut);
        royaleCoin.transferFrom(msg.sender, treasury, tax);

        hasAccess[tokenId][msg.sender] = true;
        _mint(msg.sender, tokenId, 1, "");

        emit ContentPurchased(tokenId, msg.sender, token.priceRyl, creatorCut, tax);
    }

    /**
     * EIP-2981 Royalty standard — 10% to creator on secondary sales
     */
    function royaltyInfo(
        uint256 tokenId,
        uint256 salePrice
    ) external view override returns (address receiver, uint256 royaltyAmount) {
        receiver = tokens[tokenId].creator;
        royaltyAmount = (salePrice * ROYALTY_BPS) / MAX_BPS;
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        return string(abi.encodePacked(
            "https://gateway.pinata.cloud/ipfs/",
            tokens[tokenId].manifestCid
        ));
    }

    function _update(
        address from, address to, uint256[] memory ids, uint256[] memory values
    ) internal override(ERC1155, ERC1155Supply) {
        super._update(from, to, ids, values);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC1155, IERC165) returns (bool)
    {
        return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
    }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * ROYALE SUBSCRIPTION — On-chain tier management
 *
 * Tiers:
 *   0 = Citizen  (free)
 *   1 = Ambassador ($9.99/mo in ALGO/ETH/RYL)
 *   2 = Royalty   ($29.99/mo)
 *
 * Auto-renewal via Chainlink Automation (or manual renewal)
 */

contract RoyaleSubscription is Ownable, ReentrancyGuard {
    RoyaleCoin public royaleCoin;
    address public treasury;

    enum Tier { Citizen, Ambassador, Royalty }

    struct Subscription {
        Tier tier;
        uint256 expiresAt;
        bool autoRenew;
        uint256 totalPaid;
    }

    // Prices in wei (ETH) — adjust for current rates
    mapping(Tier => uint256) public priceWei;
    mapping(Tier => uint256) public priceRyl;
    mapping(address => Subscription) public subscriptions;

    event Subscribed(address indexed user, Tier tier, uint256 expiresAt, uint256 amount);
    event Renewed(address indexed user, Tier tier, uint256 newExpiry);
    event TierUpgraded(address indexed user, Tier from, Tier to);

    constructor(address _royaleCoin, address _treasury) Ownable(msg.sender) {
        royaleCoin = RoyaleCoin(_royaleCoin);
        treasury = _treasury;

        // ~$9.99 and ~$29.99 in ETH at deploy time (update via setPrices)
        priceWei[Tier.Ambassador] = 0.003 ether;
        priceWei[Tier.Royalty] = 0.01 ether;

        priceRyl[Tier.Ambassador] = 100 * 10**18;  // 100 $RYL
        priceRyl[Tier.Royalty] = 300 * 10**18;     // 300 $RYL
    }

    function subscribeWithETH(Tier tier, bool autoRenew) external payable nonReentrant {
        require(tier != Tier.Citizen, "Citizen tier is free");
        uint256 price = priceWei[tier];
        require(msg.value >= price, "Insufficient payment");

        (bool sent,) = payable(treasury).call{value: msg.value}("");
        require(sent, "Payment failed");

        uint256 expiresAt = block.timestamp + 30 days;
        subscriptions[msg.sender] = Subscription({
            tier: tier,
            expiresAt: expiresAt,
            autoRenew: autoRenew,
            totalPaid: msg.value,
        });

        emit Subscribed(msg.sender, tier, expiresAt, msg.value);
    }

    function subscribeWithRYL(Tier tier, bool autoRenew) external nonReentrant {
        require(tier != Tier.Citizen, "Citizen tier is free");
        uint256 price = priceRyl[tier];

        royaleCoin.transferFrom(msg.sender, treasury, price);

        uint256 expiresAt = block.timestamp + 30 days;
        subscriptions[msg.sender] = Subscription({
            tier: tier,
            expiresAt: expiresAt,
            autoRenew: autoRenew,
            totalPaid: price,
        });

        emit Subscribed(msg.sender, tier, expiresAt, price);
    }

    function isActive(address user) external view returns (bool) {
        Subscription memory sub = subscriptions[user];
        if (sub.tier == Tier.Citizen) return true; // Free forever
        return sub.expiresAt > block.timestamp;
    }

    function getTier(address user) external view returns (Tier) {
        if (subscriptions[user].expiresAt > block.timestamp) {
            return subscriptions[user].tier;
        }
        return Tier.Citizen;
    }

    function setPrices(
        uint256 ambassadorWei, uint256 royaltyWei,
        uint256 ambassadorRyl, uint256 royaltyRyl
    ) external onlyOwner {
        priceWei[Tier.Ambassador] = ambassadorWei;
        priceWei[Tier.Royalty] = royaltyWei;
        priceRyl[Tier.Ambassador] = ambassadorRyl;
        priceRyl[Tier.Royalty] = royaltyRyl;
    }
}
