// STANX					

// PART A
// Core User Personas (Prioritized for POC) :
// User 1: The "Stan"
// Sign Up/Connect: They connect their phantom wallet to log in.
// Deposit Cash: They send USDC or SOL into the app so they have a balance to bet with.
// View Markets: They scroll through a list of active predictions (e.g., "MrBeast vs T-Series").
// Place a "Taker" Bet: They see a price they like (e.g., "Yes at 60 cents") and buy it immediately. They want the bet to happen now.
// Check Portfolio: They look at a dashboard to see if they are winning or losing.
// Cash Out: If they win, they claim their earnings and withdraw the money back to their wallet.
// User 2: The Market Maker
// Place "Maker" Orders: They don't just buy, they post orders. The order sits on the book waiting for Stan to click it.
// Update Orders: If news changes, they quickly cancel their old order and put up a new price.
// Manage Risk: They check how much exposure they have.
// User 3: The Administrator
// Create Market: Have to fill out a form to launch a new question: "Will Video X get 1M views by Tuesday?"
// Set Rules: Have to define the deadline and the specific YouTube link to track.
// Resolve Market: When Tuesday comes, have to check YouTube, see the views & tell the system which of the side won (YES/NO)
// Most Critical POC Requirement :
// Top Critical User Interaction: The most important loop to prove is: "A Market Maker posts a price, and a Stan accepts that price (places a bet)." If this matching doesn't happen, the product doesn't exist.
// Technical Requirements for this Interaction:
// The Orderbook Engine (Smart Contract Logic):
// We need a data structure (like a list) stored on the blockchain that can hold "Bids" (Offers to Buy) and "Asks" (Offers to Sell).
// We need a "Matching Engine" in the code that checks: Does the Buyer's price match the Seller's price? If yes, it swaps their money automatically.
// Escrow System (Vault):
// When a user places an order, the system must "lock" their assets. We need a smart contract vault that holds the funds so users can't run away with the assets while a bet is open.
// User Accounts (State Management):
// The system needs to create a PDA for every user on the chain to track Locked Collateral/Tokens. If an asset is currently in a bet, then we can lock the token/collateral in Escrow/Vault.
// Frontend Interface:
// A simple website where the Market Maker can see the orderbook (spreadsheets of numbers) and Stan can see a simple "Buy Yes" button.
// Second Critical Interaction: "The Admin resolves the market." (Determining the winner).
// Technical Requirements for this Interaction:
// Admin Controls:
// The smart contract needs a rule that says "Only the wallet address that created this market is allowed to declare the winner."
// State Transition Logic:
// The code needs a "Switch": The market starts as OPEN. Once the Admin resolves it, the state must change to RESOLVED.
// Payout Logic:
// A calculation formula: If "YES" won, the people holding "NO" tickets lose their money, and that money is moved to the "YES" holders.


// Function Map :
// User
// Action
// Description
// Dependencies
// Admin
// InitializeMarket
// Creates the on-chain accounts for a specific prediction event (e.g., "MrBeast 50M Views").
// System Program
// User
// InitUserAccount
// Creates a personal PDA to track deposits, locked funds, and open orders.
// System Program
// User
// DepositFunds
// Transfers SOL/USDC from wallet to Protocol Vault.
// SPL Token Program
// User
// PlaceLimitOrder
// Submits an order to buy YES or NO at a specific price. Matches or rests on the book.
// Market State, User Account
// User
// CancelOrder
// Removes a resting order from the book and unlocks funds.
// Orderbook State
// Admin
// ResolveMarket
// Locks trading and sets the final outcome based on off-chain data.
// Market State
// User
// ClaimWinnings
// Withdraws funds if their position matches the winning outcome.
// Market State (Resolved)


// User Stories :
// Content :
// Admin initializes the market
// User initializes trading account
// User deposits funds (The Vault/Escrow logic)
// The user places an order (The Matching Logic)
// The user cancels an order
// Admin resolves the market
// User withdraws funds (The Claim logic)

// Story 1: Administrator initializes a new prediction market :
// User Story: As an admin, I want to create a new market for a specific YouTube video so that traders can begin placing bets.
// Potential On-Chain Requirements:
// Define a Market struct/account to store state.
// Store static metadata: Market ID, Description (e.g., video URL), End Timestamp.
// Initialize two Orderbook accounts (one for YES, one for NO) or a single Orderbook managing two outcomes.
// Store the Authority address (Admin) who is allowed to resolve this market.
// Set the Market Status to "Active."
// Story 2: User initializes their trading account :
// User Story: As a trader, I need to register my wallet with the StanX program so that the system can track my open orders and balances.
// Potential On-Chain Requirements:
// Create a UserAccount PDA (Program Derived Address) linked to the user's wallet address.
// Initialize counters for Locked Funds (funds in active orders) and Free Funds.
// Initialize an empty list or vector to track OpenOrder IDs associated with this user.
// Story 3: User deposits funds :
// User Story: As a trader, I want to move USDC into the StanX vault so that I have capital available to place orders.
// Potential On-Chain Requirements:
// Execute a CPI (Cross-Program Invocation) to the SPL Token Program to transfer USDC from the User's Wallet to the Market Vault.
// Update the user's balance in their on-chain UserAccount.
// Ensure the transfer amount is greater than zero.
// Story 4: User places a limit order (The "Bet") :
// User Story: As a trader, I want to set a price (odds) and amount for a specific outcome (YES or NO) so that I can take a position.
// Potential On-Chain Requirements:
// Check if the user has enough funds in their UserAccount to cover the order.
// Check if Market Status is "Active" and current time is before End Timestamp.
// Matching Logic: Check the Orderbook for a matching counter-order (e.g., if buying YES, look for someone selling YES).
// If Matched: Execute the trade, update balances immediately, and remove liquidity from the book.
// If Not Matched (Resting Order): Add the order to the Orderbook data structure (e.g., a B-Tree or Linked List on-chain).
// Move funds from Free Funds to Locked Funds.
// Story 5: User cancels an open order :
// User Story: As a trader, I want to remove an order that hasn't been filled yet so that I can get my liquidity back.
// Potential On-Chain Requirements:
// Verify the signer owns the order.
// Remove the order entry from the Orderbook data structure.
// Move the associated amount from Locked Funds back to Free Funds in the UserAccount.
// Story 6: Administrator resolves the market :
// User Story: As an admin, I want to input the final result (True/False) based on YouTube API data so that the market stops trading and winners can be determined.
// Potential On-Chain Requirements:
// Verify the signer is the Authority (Admin).
// Update Market Status to "Resolved."
// Store the Winning Outcome (YES or NO) in the Market account.
// Prevent any new orders from being placed.
// Cancel all open orders and return those funds to user Free Funds (optional clean-up step).
// Story 7: User claims winnings :
// User Story: As a winning trader, I want to withdraw my payout so that I can realize my profit.
// Potential On-Chain Requirements:
// Check if Market Status is "Resolved."
// Calculate the user's holdings of the Winning Outcome.
// Update the user's UserAccount balance (Credit the winnings).
// (Optional) Burn the "Position" tokens if using a tokenized model, or simply zero out the position ledger.
// Allow the user to withdraw from Free Funds back to their external wallet (SPL Transfer).


// PART B
// Refinement 1:
// Before: "User interacts with the orderbook."
// After: "User places a limit order."
// Rationale: "Interacting" is vague. "Placing a limit order" is a specific function call.
// Refinement 2:
// Before: "Admin connects YouTube API."
// After: "Administrator resolves the market."
// Rationale: The smart contract doesn't know what an API is. The Admin (me) performs the API check off-chain and sends the result to the contract. The story was updated to reflect the on-chain action.
// Refinement 3:
// Before: "User gets money."
// After: "User claims winnings."
// Rationale: In Solana programs, "pushing" money is dangerous (reentrancy/cost). It is safer to have a "Pull" pattern where the user actively claims their funds. I updated the story to reflect this "Claim" action.


// Technical Hurdles which I’m thinking about : 
// Concurrency: If two users try to take the same order at the exact same time, one transaction will fail. This is a classic CLOB challenge on high-speed chains.
// CU Hurdle on Iteration in Orderbook :  there should be a max_iteration Limit, where we can only match with the 10 Users, because every Interaction will consume CU on every interaction, If we don’t put a limit on the Iteration , if the order is big enough , soon we will run reach the CU Limit, in that case, order will fail, We can later put a Crank, If the order is partially completed
// Rent Exemption Hurdle in Orderbook Growth: An orderbook is a dynamic, large data structure, and storing it requires paying "Rent Exemption" (a SOL deposit) for the bytes used. If the orderbook grows by 100 bytes with every new order:
// if the User pays, trading becomes expensive for the User
// if the Admin pays, he would have to pre-allocate a fixed-size orderbook paid for once during initialization, ensuring predictable costs, but huge upfront cost for the Admin

// By AI: List of every potential user type who might interact with StanX
// Here is the complete list of everyone who might touch this system, from the main users to the people running it behind the scenes.
// Direct Users (The Daily Users):
// The "Stan" (Gen-Z Fan): The main user. They watch YouTube all day, know creator stats by heart, and want to bet small amounts ($10-$50) on outcomes.
// The "Hater": A user who bets against a creator’s success (e.g., betting "No" on a view count).
// The "Whale" Trader: A rich crypto user who wants to bet large amounts ($1,000+) to make a profit, not because they care about the creator.
// The Market Maker: A professional trader or bot that constantly places "Buy" and "Sell" orders so there is always liquidity (money) for others to trade against.
// Arbitrageur: A trader who looks for price differences between StanX and other platforms (like Polymarket) to make risk-free profit.

// Indirect Users (Beneficiaries):
// YouTube Creators (e.g., MrBeast): They don't bet, but they are the subject of the markets. They might look at the market to see what fans expect from their next video.
// Advertisers/Brands: Companies who want to see the market odds to decide if a video will be popular enough to sponsor.
// Data Aggregators: Websites that pull data from StanX to show "Trending Predictions" on their own news sites.

// Administrators/Moderators:
// The Operator (You): The person who creates the markets, sets the rules (e.g., "Does this video have 50M views?"), and resolves disputes.
// Community Moderators: Discord admins who help confused users and ban scammers.

// Stakeholders:
// Solana Token Holders: People invested in the Solana ecosystem who want to see high transaction volume.
// Investors: People who might fund your startup later if the Proof-of-Concept works.

// AI Prompt Used: "My project's value proposition is a YouTube prediction market called StanX that uses a high-speed Orderbook (CLOB) to allow fans to trade on creator stats. Here is my brainstormed list of users [list from Step 1 above]. Which 2-5 are most critical for a POC?"

// The "Stan" (Retail Trader):
// Why: You need to prove that normal people actually want to bet on this. If the fans don't show up, the product fails. The POC must prove the User Experience (UX) is simple enough for them.
// The Market Maker (Liquidity Provider):
// Why: You chose an "Orderbook" model (CLOB) instead of an Automated Market Maker (AMM). An Orderbook cannot work without someone placing resting orders. If there is no Market Maker, the "Stan" has nobody to bet against. Proving liquidity works is your biggest technical challenge.
// The Administrator (You):
// Why: In a full version, markets might close automatically. But for a POC, you need to manually open the market and manually tell the system who won. You are the "training wheels" for the system.

// My take:  I agree with the AI's logic. I am removing "Advertisers" and "Creators" because they are nice to have later, but right now they are not needed for POC

// Final Prioritized User List for POC:
// The Stan (Retail Trader) - To test demand and betting.
// The Market Maker - To test the technical orderbook system.
// The Administrator - To manage the system and input data.



// AI Prompt Used: "Review my core user functions and requirements for the StanX POC (Solana Orderbook Market). Considering my goal is to build a CLOB (Central Limit Order Book), are these stories granular enough to write Rust code for? What specific logic is missing or too vague?"
// AI Output : The AI identified three major weaknesses in my initial plan:
// Critique 1 (The "Betting" Ambiguity):
// The Issue: "You wrote 'User places a bet'. In a technical Orderbook, there is no such thing as a 'bet'. There are only Orders. Is it a 'Limit Order' (wait for a price) or a 'Market Order' (buy now at any price)? If a user tries to buy 100 shares but only 50 are available, does the order fail or partially fill?"
// Why it matters: I cannot write the matching engine code without knowing these rules.
// Critique 2 (The "Payout" Trap):
// The Issue: "You wrote 'System moves money to winners'. This implies a 'Push' payment (sending money to 1,000 users automatically). On Solana, this is impossible because of Compute Budget limits. You cannot loop through thousands of users in one transaction."
// Why it matters: The transaction would fail, and funds would be stuck. The logic must be a 'Pull' (Claim) pattern.
// Critique 3 (State Management):
// The Issue: "You mentioned 'User deposits cash'. Where is this cash stored? You need to define if this is a standard Token Account or a custom Program Derived Address (PDA) vault. The distinction matters for security."

// My Analysis : 
// Strict Order Types: The code must distinguish between "Takers" (Stans) and "Makers" (Pro Traders).
// New Technical Requirement: The smart contract must support two "Order Types":
// Market Order: For the "Stan" who wants to buy now or not at all.
// Limit Order: For the "Market Maker" who wants to ensure their order sits on the book and provides liquidity.
// Pull-Based Payouts: users must manually click "Claim" to get his reward or his asset back.
// PDA Architecture: User funds will be stored in individual PDA to ensure security and also so we can properly track the user Activity, It will contains the information about Locked Token & Collateral at the time of making an order or If his order is already present inside the Orderbook , We will keep the record of his locked Collateral in the User Account PDA which tells how much Tokens/Collateral is currently locked inside the Vault/Escrow

// Granularity & Clarity Refinement
// In this final refinement stage, the focus was to take the technically validated ideas from Part B and polish them into atomic, without Jargon, providing clarity at every step. I reviewed every story to ensure that if a non-technical person or developer read it, they both would understand the flow



// Before (Vague / Web2 Style)
// After (Precise / Solana Style)
// The Why (My Reasoning)
// Admin connects the YouTube API directly to the smart contract.
// Admin manually enters the final result.
// Smart contracts can't actually touch the internet or APIs. If I promised an API connection inside the contract, it wouldn't work. The Admin has to be the one to input the data.
// User signs up and deposits funds at the same time.
// User initializes their trading account first
// On Solana, you can't put money into an account that doesn't exist yet. You have to create the space (PDA) before you can actually transfer tokens into it. I split this so the code logic is clear.
// User bets $50 on MrBeast.
// User places a Limit Order with a specific price.
// "Betting" is too vague for an Orderbook. I need to know exactly what price they are buying at. "Limit Order" is the correct technical term for how the matching engine works.
// System automatically sends money to every winner.
// User clicks a button to claim their winnings.
// If 1,000 people win, the program can't loop through all of them in one transaction, it would run out of compute units (gas). It is much safer to let users pull their own money out.
// User updates their existing bet.
// User cancels their old order and makes a new one.
// You can't just edit a live order on the blockchain. Technically, you have to delete the old one and create a brand new one. The user story needs to be honest about that extra step.





// Github : Yashop7
// X: Yashtwt7
