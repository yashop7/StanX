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
pub struct CancelOrder<'info> {
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
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = user_collateral.mint == market.collateral_mint,
        constraint = user_collateral.owner == user.key()
    )]
    pub user_collateral: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [USER_STATS_SEED, market_id.to_le_bytes().as_ref(), user.key().as_ref()],
        bump = user_stats_account.bump
    )]
    pub user_stats_account: Box<Account<'info, UserStats>>,

    // At the time of Buy, not require this
    #[account(mut)]
    pub user_outcome_yes: Option<Box<InterfaceAccount<'info, TokenAccount>>>,

    #[account(mut)]
    pub user_outcome_no: Option<Box<InterfaceAccount<'info, TokenAccount>>>,

    #[account(
        mut,
        constraint = yes_escrow.mint == market.outcome_yes_mint,
        constraint = yes_escrow.key() == market.yes_escrow
    )]
    pub yes_escrow: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = no_escrow.mint == market.outcome_no_mint,
        constraint = no_escrow.key() == market.no_escrow
    )]
    pub no_escrow: Box<InterfaceAccount<'info, TokenAccount>>,

    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> CancelOrder<'info> {
    pub fn handler(&mut self, market_id: u32, order_id: u64) -> Result<()> {
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

        // Search for the order across all order books sequentially
        let mut found_order: Option<Order> = None;
        let mut order_side = OrderSide::Buy;
        let mut order_token_type = TokenType::Yes;

        // Check each order book one at a time
        if let Some(idx) = orderbook
            .yes_buy_orders
            .iter()
            .position(|o| o.id == order_id)
        {
            found_order = Some(orderbook.yes_buy_orders.remove(idx));
            order_side = OrderSide::Buy;
            order_token_type = TokenType::Yes;
        } else if let Some(idx) = orderbook
            .yes_sell_orders
            .iter()
            .position(|o| o.id == order_id)
        {
            found_order = Some(orderbook.yes_sell_orders.remove(idx));
            order_side = OrderSide::Sell;
            order_token_type = TokenType::Yes;
        } else if let Some(idx) = orderbook
            .no_buy_orders
            .iter()
            .position(|o| o.id == order_id)
        {
            found_order = Some(orderbook.no_buy_orders.remove(idx));
            order_side = OrderSide::Buy;
            order_token_type = TokenType::No;
        } else if let Some(idx) = orderbook
            .no_sell_orders
            .iter()
            .position(|o| o.id == order_id)
        {
            found_order = Some(orderbook.no_sell_orders.remove(idx));
            order_side = OrderSide::Sell;
            order_token_type = TokenType::No;
        }

        let order_found = found_order.ok_or(PredictionMarketError::OrdernotFound)?;
        require!(
            self.user.key() == order_found.user_key,
            PredictionMarketError::NotAuthorized
        );

        // Calculate the unfilled portion to refund
        let unfilled_quantity = order_found
            .quantity
            .checked_sub(order_found.filledquantity)
            .ok_or(PredictionMarketError::MathOverflow)?;

        require!(
            unfilled_quantity > 0,
            PredictionMarketError::OrderFullyFilled
        );

        if order_side == OrderSide::Buy {
            // For buy orders, unlock collateral for the unfilled portion only
            let refund_amount = unfilled_quantity
                .checked_mul(order_found.price)
                .ok_or(PredictionMarketError::MathOverflow)?
                .checked_div(TOKEN_DECIMALS_SCALE)
                .ok_or(PredictionMarketError::MathOverflow)?;

            self.user_stats_account.locked_collateral = self
                .user_stats_account
                .locked_collateral
                .checked_sub(refund_amount)
                .ok_or(PredictionMarketError::MathOverflow)?;

            // Transfer collateral back to user
            let market_id_bytes = market.market_id.to_le_bytes();
            let seeds = &[MARKET_SEED, market_id_bytes.as_ref(), &[market.bump]];

            token::transfer(
                CpiContext::new_with_signer(
                    self.token_program.to_account_info(),
                    Transfer {
                        from: self.collateral_vault.to_account_info(),
                        to: self.user_collateral.to_account_info(),
                        authority: market.to_account_info(),
                    },
                    &[seeds],
                ),
                refund_amount,
            )?;

            // Track vault-level collateral leaving
            market.total_collateral_locked = market
                .total_collateral_locked
                .checked_sub(refund_amount)
                .ok_or(PredictionMarketError::MathOverflow)?;
        } else {
            // For sell orders, unlock tokens for the unfilled portion only
            let (user_token_account, token_escrow) = match order_token_type {
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

            match order_token_type {
                TokenType::Yes => {
                    self.user_stats_account.locked_yes = self
                        .user_stats_account
                        .locked_yes
                        .checked_sub(unfilled_quantity)
                        .ok_or(PredictionMarketError::MathOverflow)?;
                }
                TokenType::No => {
                    self.user_stats_account.locked_no = self
                        .user_stats_account
                        .locked_no
                        .checked_sub(unfilled_quantity)
                        .ok_or(PredictionMarketError::MathOverflow)?;
                }
            }

            // Transfer unfilled tokens back from escrow to user
            let market_id_bytes = market.market_id.to_le_bytes();
            let seeds = &[MARKET_SEED, market_id_bytes.as_ref(), &[market.bump]];

            token::transfer(
                CpiContext::new_with_signer(
                    self.token_program.to_account_info(),
                    Transfer {
                        from: token_escrow.to_account_info(),
                        to: user_token_account.to_account_info(),
                        authority: market.to_account_info(),
                    },
                    &[seeds],
                ),
                unfilled_quantity,
            )?;
        }

        msg!("Order {} cancelled successfully", order_id);

        emit!(OrderCancelled {
            market_id,
            order_id,
            user: self.user.key(),
            side: order_found.side,
            token_type: order_found.token_type,
            remaining_quantity: order_found.quantity - order_found.filledquantity,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}
