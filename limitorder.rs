use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Transfer},
    token_interface::{TokenAccount, TokenInterface},
};

use crate::constants::*;
use crate::error::*;
use crate::events::*;
use crate::state::*;

#[derive(Accounts)]
#[instruction(market_id:u32)]
pub struct PlaceOrder<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds=[MARKET_SEED, market.market_id.to_le_bytes().as_ref()],
        bump = market.bump,
        constraint = market.market_id == market_id,
    )]
    pub market: Box<Account<'info, Market>>,

    #[account(
        mut,
        seeds = [ORDERBOOK_SEED, market.market_id.to_le_bytes().as_ref()],
        bump = orderbook.bump,
        constraint = orderbook.market_id == market_id
    )]
    pub orderbook: Account<'info, OrderBook>,

    #[account(
        mut,
        constraint = collateral_vault.key() == market.collateral_vault
    )]
    pub collateral_vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_collateral.mint == market.collateral_mint,
        constraint = user_collateral.owner == user.key()
    )]
    pub user_collateral: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = user,
        space = UserStats::DISCRIMINATOR.len() + UserStats::INIT_SPACE,
        seeds = [USER_STATS_SEED, market_id.to_le_bytes().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_stats_account: Box<Account<'info, UserStats>>,

    // Declaring them Optional because we don't need them in case of Buy Order, we are only dealing with collateral account &
    // UserStats Account
    #[account(mut)]
    pub user_outcome_yes: Option<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut)]
    pub user_outcome_no: Option<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = yes_escrow.mint == market.outcome_yes_mint,
        constraint = yes_escrow.key() == market.yes_escrow
    )]
    pub yes_escrow: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = no_escrow.mint == market.outcome_no_mint,
        constraint = no_escrow.key() == market.no_escrow
    )]
    pub no_escrow: InterfaceAccount<'info, TokenAccount>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> PlaceOrder<'info> {
    /// Place an order to buy or sell outcome tokens
    ///
    /// Flow:
    /// - On placing Order
    ///   - SELL order: Seller's YES/NO tokens locked in escrow immediately
    ///   - BUY order: Buyer's collateral locked in vault immediately
    /// - When matched:
    ///   - Buyer's & Sellers claimable amount will be incremented in their UserStats Account (user can claim later from dashboard)
    ///   - If the qty left after all the matching, there are 2 cases, Orderbook Exceeded => remaning Qty is deposited in the claimable assest or
    ///     in the other case, the order is just simply appended to the orderbook
    ///   - Person whose order is on the orderbook first can withdraw collateral from vault separately
    pub fn handler(
        &mut self,
        market_id: u32,
        side: OrderSide,
        token_type: TokenType,
        quantity: u64,
        price: u64,
        max_iteration: u64,
        bumps: &PlaceOrderBumps,
        remaining_accounts: &[AccountInfo<'info>],
        program_id: &Pubkey,
    ) -> Result<()> {
        let market = &mut self.market;
        let orderbook = &mut self.orderbook;

        require!(
            Clock::get()?.unix_timestamp < market.settlement_deadline,
            PredictionMarketError::MarketExpired
        );

        require!(
            !market.is_settled,
            PredictionMarketError::MarketAlreadySettled
        );

        require!(
            max_iteration > 0,
            PredictionMarketError::InvalidIterationLimit
        );

        require!(quantity > 0, PredictionMarketError::InvalidOrderQuantity);
        require!(price > 0, PredictionMarketError::InvalidOrderPrice);
        require!(
            quantity >= MIN_ORDER_QUANTITY,
            PredictionMarketError::OrderTooSmall
        );

        // Initialising the user stats account
        let user_stats = &mut self.user_stats_account;
        if user_stats.user == Pubkey::default() {
            user_stats.user = self.user.key();
            user_stats.market_id = market_id;
            user_stats.locked_yes = 0;
            user_stats.claimable_yes = 0;
            user_stats.locked_no = 0;
            user_stats.claimable_no = 0;
            user_stats.locked_collateral = 0;
            user_stats.claimable_collateral = 0;
            user_stats.bump = bumps.user_stats_account;
        }

        // quantity is in base units (10^6 per display token).
        // Dividing by TOKEN_DECIMALS_SCALE converts the product to micro USDC.
        let amount = quantity
            .checked_mul(price)
            .ok_or(PredictionMarketError::MathOverflow)?
            .checked_div(TOKEN_DECIMALS_SCALE)
            .ok_or(PredictionMarketError::MathOverflow)?;

        require!(
            amount > 0,
            PredictionMarketError::OrderTooSmall
        );

        // Lock funds immediately when placing order
        // For Buyer: lock collateral in Vault, no outcome ATAs needed
        // For Seller: lock YES/NO tokens in Escrow, outcome ATAs must exist
        if side == OrderSide::Sell {
            // Unwrap the relevant outcome account — SELL callers must provide it
            let (user_token_account, token_escrow) = match token_type {
                TokenType::Yes => (
                    self.user_outcome_yes
                        .as_ref()
                        .ok_or(PredictionMarketError::OutcomeAccountRequired)?,
                    &self.yes_escrow,
                ),
                TokenType::No => (
                    self.user_outcome_no
                        .as_ref()
                        .ok_or(PredictionMarketError::OutcomeAccountRequired)?,
                    &self.no_escrow,
                ),
            };

            require!(
                user_token_account.owner == self.user.key(),
                PredictionMarketError::InvalidAccountOwner
            );
            require!(
                user_token_account.mint
                    == match token_type {
                        TokenType::Yes => market.outcome_yes_mint,
                        TokenType::No => market.outcome_no_mint,
                    },
                PredictionMarketError::InvalidMint
            );

            require!(
                user_token_account.amount >= quantity,
                PredictionMarketError::NotEnoughBalance
            );

            token::transfer(
                CpiContext::new(
                    self.token_program.to_account_info(),
                    Transfer {
                        from: user_token_account.to_account_info(),
                        to: token_escrow.to_account_info(),
                        authority: self.user.to_account_info(),
                    },
                ),
                quantity,
            )?;

            let user_stats = &mut self.user_stats_account;

            match token_type {
                TokenType::Yes => {
                    user_stats.locked_yes = user_stats
                        .locked_yes
                        .checked_add(quantity)
                        .ok_or(PredictionMarketError::MathOverflow)?;
                }
                TokenType::No => {
                    user_stats.locked_no = user_stats
                        .locked_no
                        .checked_add(quantity)
                        .ok_or(PredictionMarketError::MathOverflow)?;
                }
            }
        } else {
            require!(
                self.user_collateral.amount >= amount,
                PredictionMarketError::NotEnoughBalance
            );

            token::transfer(
                CpiContext::new(
                    self.token_program.to_account_info(),
                    Transfer {
                        from: self.user_collateral.to_account_info(),
                        to: self.collateral_vault.to_account_info(),
                        authority: self.user.to_account_info(),
                    },
                ),
                amount,
            )?;

            // Locking the collateral
            let user_stats = &mut self.user_stats_account;
            user_stats.locked_collateral = user_stats
                .locked_collateral
                .checked_add(amount)
                .ok_or(PredictionMarketError::MathOverflow)?;

            // Track vault-level collateral for close_market safety check
            market.total_collateral_locked = market
                .total_collateral_locked
                .checked_add(amount)
                .ok_or(PredictionMarketError::MathOverflow)?;
        }

        let mut order = Order {
            id: orderbook.next_order_id,
            market_id: market.market_id,
            user_key: self.user.key(),
            side,
            token_type,
            price,
            quantity,
            filledquantity: 0,
            timestamp: Clock::get()?.unix_timestamp,
        };

        emit!(OrderPlaced {
            market_id,
            order_id: order.id,
            user: self.user.key(),
            side,
            token_type,
            price,
            quantity,
            timestamp: order.timestamp,
        });

        orderbook.next_order_id = orderbook
            .next_order_id
            .checked_add(1)
            .ok_or(PredictionMarketError::MathOverflow)?;

        let mut idx = 0;
        let mut iteration = 0;

        // Get the appropriate order vectors based on token type and side
        let (matching_orders, is_buy_order) = match (token_type, side) {
            (TokenType::Yes, OrderSide::Buy) => (&mut orderbook.yes_sell_orders, true),
            (TokenType::Yes, OrderSide::Sell) => (&mut orderbook.yes_buy_orders, false),
            (TokenType::No, OrderSide::Buy) => (&mut orderbook.no_sell_orders, true),
            (TokenType::No, OrderSide::Sell) => (&mut orderbook.no_buy_orders, false),
        };

        // Iterating through all order to find matching order
        while idx < matching_orders.len() && iteration < max_iteration {
            let (book_price, book_qty, book_filled_qty, maker_order_id, maker_pubkey) = {
                let book_order = &matching_orders[idx];
                (
                    book_order.price,
                    book_order.quantity,
                    book_order.filledquantity,
                    book_order.id,
                    book_order.user_key,
                )
            };

            // Price matching logic:
            let price_matches = if is_buy_order {
                order.price >= book_price // Buyer matches with lower or equal sell prices
            } else {
                order.price <= book_price // Seller matches with higher or equal buy prices
            };

            if price_matches {
                // user cannot match their own orders
                if matching_orders[idx].user_key == self.user.key() {
                    idx += 1;
                    continue;
                }

                // Calculate remaining quantities
                let our_left_qty = order
                    .quantity
                    .checked_sub(order.filledquantity)
                    .ok_or(PredictionMarketError::MathOverflow)?;
                let book_left_qty = book_qty
                    .checked_sub(book_filled_qty)
                    .ok_or(PredictionMarketError::MathOverflow)?;

                // If our order is fully filled, we're done
                if our_left_qty == 0 {
                    break;
                }

                // If book order is empty, remove it and continue
                if book_left_qty == 0 {
                    matching_orders.remove(idx);
                    continue;
                }

                let min_qty = our_left_qty.min(book_left_qty);

                let collateral_amount = min_qty
                    .checked_mul(book_price)
                    .ok_or(PredictionMarketError::MathOverflow)?
                    .checked_div(TOKEN_DECIMALS_SCALE)
                    .ok_or(PredictionMarketError::MathOverflow)?;

                // Skip if rounding yields zero collateral (prevents free-token exploit)
                if collateral_amount == 0 {
                    idx += 1;
                    continue;
                }

                // Update filled quantities
                matching_orders[idx].filledquantity = book_filled_qty
                    .checked_add(min_qty)
                    .ok_or(PredictionMarketError::MathOverflow)?;

                order.filledquantity = order
                    .filledquantity
                    .checked_add(min_qty)
                    .ok_or(PredictionMarketError::MathOverflow)?;

                // Credit the appropriate user stats based on whether this is a buy or sell order
                if is_buy_order {
                    // collateral the buyer locked for min_qty tokens at their bid price
                    let locked_at_our_price = min_qty
                        .checked_mul(order.price)
                        .ok_or(PredictionMarketError::MathOverflow)?
                        .checked_div(TOKEN_DECIMALS_SCALE)
                        .ok_or(PredictionMarketError::MathOverflow)?;

                    // Price improvement surplus: buyer offered more than the fill price
                    let surplus = locked_at_our_price
                        .checked_sub(collateral_amount)
                        .ok_or(PredictionMarketError::MathOverflow)?;

                    match token_type {
                        TokenType::Yes => {
                            self.user_stats_account.claimable_yes = self
                                .user_stats_account
                                .claimable_yes
                                .checked_add(min_qty)
                                .ok_or(PredictionMarketError::MathOverflow)?;
                        }
                        TokenType::No => {
                            self.user_stats_account.claimable_no = self
                                .user_stats_account
                                .claimable_no
                                .checked_add(min_qty)
                                .ok_or(PredictionMarketError::MathOverflow)?;
                        }
                    }

                    // Releasing the full locked collateral from UserStats account
                    self.user_stats_account.locked_collateral = self
                        .user_stats_account
                        .locked_collateral
                        .checked_sub(locked_at_our_price)
                        .ok_or(PredictionMarketError::MathOverflow)?;

                    // Refund the surplus as claimable collateral
                    if surplus > 0 {
                        self.user_stats_account.claimable_collateral = self
                            .user_stats_account
                            .claimable_collateral
                            .checked_add(surplus)
                            .ok_or(PredictionMarketError::MathOverflow)?;
                    }

                    // Credit SELLER (from matching order) with collateral
                    // This is a very expensive task,
                    // to find the PDA, find_program_address (PDA calc) →  ~1,500 CU  ← expensive !
                    let seller_pubkey = matching_orders[idx].user_key;
                    let seller_stats_pda = Pubkey::find_program_address(
                        &[
                            USER_STATS_SEED,
                            market.market_id.to_le_bytes().as_ref(),
                            seller_pubkey.as_ref(),
                        ],
                        program_id,
                    )
                    .0;

                    let mut seller_credited = false;
                    for account_info in remaining_accounts.iter() {
                        if account_info.key == &seller_stats_pda {
                            require!(
                                account_info.owner == program_id,
                                PredictionMarketError::InvalidAccountOwner
                            );
                            let mut data = account_info.try_borrow_mut_data()?;
                            let mut seller_stats = UserStats::try_deserialize(&mut &data[..])?;

                            seller_stats.claimable_collateral = seller_stats
                                .claimable_collateral
                                .checked_add(collateral_amount)
                                .ok_or(PredictionMarketError::MathOverflow)?;

                            // Reduce seller's locked tokens since order was filled
                            match token_type {
                                TokenType::Yes => {
                                    seller_stats.locked_yes = seller_stats
                                        .locked_yes
                                        .checked_sub(min_qty)
                                        .ok_or(PredictionMarketError::MathOverflow)?;
                                }
                                TokenType::No => {
                                    seller_stats.locked_no = seller_stats
                                        .locked_no
                                        .checked_sub(min_qty)
                                        .ok_or(PredictionMarketError::MathOverflow)?;
                                }
                            }

                            let mut writer = &mut data[..];
                            seller_stats.try_serialize(&mut writer)?;

                            seller_credited = true;
                            break;
                        }
                    }

                    require!(
                        seller_credited,
                        PredictionMarketError::SellerStatsAccountNotProvided
                    );

                    msg!(
                        "Trade: Buyer +{} claimable {:?}, Seller +{} claimable collateral",
                        min_qty,
                        token_type,
                        collateral_amount
                    );
                } else {
                    // When user is SELLER - credit collateral and reduce locked tokens
                    self.user_stats_account.claimable_collateral = self
                        .user_stats_account
                        .claimable_collateral
                        .checked_add(collateral_amount)
                        .ok_or(PredictionMarketError::MathOverflow)?;

                    // Reduce seller's locked tokens since order was filled
                    match token_type {
                        TokenType::Yes => {
                            self.user_stats_account.locked_yes = self
                                .user_stats_account
                                .locked_yes
                                .checked_sub(min_qty)
                                .ok_or(PredictionMarketError::MathOverflow)?;
                        }
                        TokenType::No => {
                            self.user_stats_account.locked_no = self
                                .user_stats_account
                                .locked_no
                                .checked_sub(min_qty)
                                .ok_or(PredictionMarketError::MathOverflow)?;
                        }
                    }

                    // Credit BUYER (from matching order) with YES/NO tokens
                    let buyer_pubkey = matching_orders[idx].user_key;
                    let buyer_stats_pda = Pubkey::find_program_address(
                        &[
                            USER_STATS_SEED,
                            market.market_id.to_le_bytes().as_ref(),
                            buyer_pubkey.as_ref(),
                        ],
                        program_id,
                    )
                    .0;

                    let mut buyer_credited = false;
                    for account_info in remaining_accounts.iter() {
                        if account_info.key == &buyer_stats_pda {
                            require!(
                                account_info.owner == program_id,
                                PredictionMarketError::InvalidAccountOwner
                            );
                            let mut data = account_info.try_borrow_mut_data()?;
                            let mut buyer_stats = UserStats::try_deserialize(&mut &data[..])?;

                            match token_type {
                                TokenType::Yes => {
                                    buyer_stats.claimable_yes = buyer_stats
                                        .claimable_yes
                                        .checked_add(min_qty)
                                        .ok_or(PredictionMarketError::MathOverflow)?;
                                }
                                TokenType::No => {
                                    buyer_stats.claimable_no = buyer_stats
                                        .claimable_no
                                        .checked_add(min_qty)
                                        .ok_or(PredictionMarketError::MathOverflow)?;
                                }
                            }

                            // collateral_amount = min_qty * book_price = what the buyer locked per token.
                            // The buyer IS the book order, so book_price == their bid price.
                            buyer_stats.locked_collateral = buyer_stats
                                .locked_collateral
                                .checked_sub(collateral_amount)
                                .ok_or(PredictionMarketError::MathOverflow)?;

                            let mut writer = &mut data[..];
                            buyer_stats.try_serialize(&mut writer)?;

                            buyer_credited = true;
                            break;
                        }
                    }

                    require!(
                        buyer_credited,
                        PredictionMarketError::BuyerStatsAccountNotProvided
                    );

                    msg!(
                        "Trade: Seller +{} claimable collateral, Buyer +{} claimable {:?}",
                        collateral_amount,
                        min_qty,
                        token_type
                    );
                }

                emit!(OrderMatched {
                    market_id,
                    maker_order_id,
                    taker_order_id: order.id,
                    taker_side: order.side,
                    taker: self.user.key(),
                    maker: maker_pubkey,
                    token_type,
                    price: book_price,
                    quantity: min_qty,
                    timestamp: Clock::get()?.unix_timestamp,
                });

                // Remove completed orders or advance to next
                if matching_orders[idx].filledquantity >= matching_orders[idx].quantity {
                    matching_orders.remove(idx);
                    // Don't increment idx since we removed the element
                } else {
                    idx += 1;
                }

                iteration += 1;
            } else {
                // No more matching orders
                idx += 1;
                continue;
            }
        }

        // If order is not fully filled
        // 1. If orderbook side is full, Transfer unfilled quantity to claimable
        // 2. If orderbook side is not full, append the unfilled quantity on the book
        if order.filledquantity < order.quantity {
            let unfilled_qty = order
                .quantity
                .checked_sub(order.filledquantity)
                .ok_or(PredictionMarketError::MathOverflow)?;

            let order_vec = match (token_type, side) {
                (TokenType::Yes, OrderSide::Buy) => &mut orderbook.yes_buy_orders,
                (TokenType::Yes, OrderSide::Sell) => &mut orderbook.yes_sell_orders,
                (TokenType::No, OrderSide::Buy) => &mut orderbook.no_buy_orders,
                (TokenType::No, OrderSide::Sell) => &mut orderbook.no_sell_orders,
            };

            // Transfer the assets to claimable if orderbook side is full
            if order_vec.len() >= MAX_ORDERS_PER_SIDE {
                if side == OrderSide::Buy {
                    let unfilled_collateral = unfilled_qty
                        .checked_mul(order.price)
                        .ok_or(PredictionMarketError::MathOverflow)?
                        .checked_div(TOKEN_DECIMALS_SCALE)
                        .ok_or(PredictionMarketError::MathOverflow)?;

                    self.user_stats_account.locked_collateral = self
                        .user_stats_account
                        .locked_collateral
                        .checked_sub(unfilled_collateral)
                        .ok_or(PredictionMarketError::MathOverflow)?;

                    self.user_stats_account.claimable_collateral = self
                        .user_stats_account
                        .claimable_collateral
                        .checked_add(unfilled_collateral)
                        .ok_or(PredictionMarketError::MathOverflow)?;
                } else {
                    match token_type {
                        TokenType::Yes => {
                            self.user_stats_account.locked_yes = self
                                .user_stats_account
                                .locked_yes
                                .checked_sub(unfilled_qty)
                                .ok_or(PredictionMarketError::MathOverflow)?;

                            self.user_stats_account.claimable_yes = self
                                .user_stats_account
                                .claimable_yes
                                .checked_add(unfilled_qty)
                                .ok_or(PredictionMarketError::MathOverflow)?;
                        }
                        TokenType::No => {
                            self.user_stats_account.locked_no = self
                                .user_stats_account
                                .locked_no
                                .checked_sub(unfilled_qty)
                                .ok_or(PredictionMarketError::MathOverflow)?;

                            self.user_stats_account.claimable_no = self
                                .user_stats_account
                                .claimable_no
                                .checked_add(unfilled_qty)
                                .ok_or(PredictionMarketError::MathOverflow)?;
                        }
                    }
                }

                msg!(
                    "Orderbook full: {} unfilled quantity moved to claimable (IOC cancelled)",
                    unfilled_qty
                );
            } else {
                order_vec.push(order);

                // Keeping buy orders sorted highest price first, sell orders lowest price first
                if side == OrderSide::Buy {
                    order_vec.sort_by(|a, b| b.price.cmp(&a.price));
                } else {
                    order_vec.sort_by(|a, b| a.price.cmp(&b.price));
                }
            }
        }

        msg!(
            "Order processed: {} filled, {} remaining",
            order.filledquantity,
            order.quantity - order.filledquantity
        );

        Ok(())
    }
}
