use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::*;
use crate::events::*;
use crate::state::*;

#[derive(Accounts)]
#[instruction(market_id: u32)]
pub struct CloseMarket<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        close = authority,
        seeds = [MARKET_SEED, market.market_id.to_le_bytes().as_ref()],
        bump = market.bump,
        constraint = market.market_id == market_id,
        constraint = market.authority == authority.key()
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        close = authority,
        seeds = [ORDERBOOK_SEED, market.market_id.to_le_bytes().as_ref()],
        bump = orderbook.bump,
        constraint = orderbook.market_id == market_id
    )]
    pub orderbook: Account<'info, OrderBook>,
}

impl<'info> CloseMarket<'info> {
    /// Close the market and reclaim rent
    /// Can only be called after market is settled
    /// All orders must be cancelled or filled before closing
    pub fn handler(&self, _market_id: u32) -> Result<()> {
        let market = &self.market;
        let orderbook = &self.orderbook;

        // Ensure market is settled
        require!(market.is_settled, PredictionMarketError::MarketNotSettled);

        // Ensure all collateral has been claimed or withdrawn
        require!(
            market.total_collateral_locked == 0,
            PredictionMarketError::CollateralNotFullyClaimed
        );

        // Ensure all orders have been cancelled or completed
        require!(
            orderbook.yes_buy_orders.is_empty()
                && orderbook.yes_sell_orders.is_empty()
                && orderbook.no_buy_orders.is_empty()
                && orderbook.no_sell_orders.is_empty(),
            PredictionMarketError::OrdersStillPending
        );

        msg!("Market {} closed successfully", market.market_id);

        emit!(MarketClosed {
            market_id: market.market_id,
            authority: self.authority.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}
