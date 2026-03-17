use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::*;
use crate::error::*;
use crate::events::*;
use crate::state::{Market, OrderBook};

#[derive(Accounts)]
#[instruction(market_id: u32)]
pub struct InitializeMarket<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Market::INIT_SPACE,
        seeds = [MARKET_SEED, market_id.to_le_bytes().as_ref()],
        bump
    )]
    pub market: Box<Account<'info, Market>>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub collateral_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        init,
        payer = authority,
        token::mint = collateral_mint,
        token::authority = market,
        token::token_program = token_program,
        seeds = [VAULT_SEED, market_id.to_le_bytes().as_ref()],
        bump
    )]
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init,
        payer = authority,
        mint::decimals = 6,
        mint::authority = market,
        mint::token_program = token_program,
        seeds = [OUTCOME_YES_SEED, market_id.to_le_bytes().as_ref()],
        bump
    )]
    pub outcome_yes_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        init,
        payer = authority,
        mint::decimals = 6,
        mint::authority = market,
        mint::token_program = token_program,
        seeds = [OUTCOME_NO_SEED, market_id.to_le_bytes().as_ref()],
        bump
    )]
    pub outcome_no_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        init,
        payer = authority,
        token::authority = market,
        token::mint = outcome_yes_mint,
        token::token_program = token_program,
        seeds = [ESCROW_SEED, market_id.to_le_bytes().as_ref(), outcome_yes_mint.key().as_ref()],
        bump
    )]
    pub yes_escrow: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init,
        payer = authority,
        token::authority = market,
        token::mint = outcome_no_mint,
        token::token_program = token_program,
        seeds = [ESCROW_SEED, market_id.to_le_bytes().as_ref(), outcome_no_mint.key().as_ref()],
        bump
    )]
    pub no_escrow: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init,
        payer = authority,
        seeds = [ORDERBOOK_SEED, market_id.to_le_bytes().as_ref()],
        space = OrderBook::space(MAX_ORDERS_PER_SIDE),
        bump
    )]
    pub orderbook: Box<Account<'info, OrderBook>>,

    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> InitializeMarket<'info> {
    pub fn initialise(
        &mut self,
        market_id: u32,
        settlement_deadline: i64,
        bumps: &InitializeMarketBumps,
        meta_data_url: String,
    ) -> Result<()> {
        require!(
            settlement_deadline > Clock::get()?.unix_timestamp,
            PredictionMarketError::InvalidSettlementDeadline
        );
        self.market.set_inner(Market {
            authority: self.authority.key(),
            market_id,
            settlement_deadline,
            collateral_mint: self.collateral_mint.key(),
            collateral_vault: self.collateral_vault.key(),
            outcome_yes_mint: self.outcome_yes_mint.key(),
            outcome_no_mint: self.outcome_no_mint.key(),
            yes_escrow: self.yes_escrow.key(),
            no_escrow: self.no_escrow.key(),
            meta_data_url,
            is_settled: false,
            winning_outcome: None,
            total_collateral_locked: 0,
            bump: bumps.market,
        });

        self.orderbook.set_inner(OrderBook {
            bump: bumps.orderbook,
            market_id,
            next_order_id: 0,
            yes_buy_orders: Vec::new(),
            yes_sell_orders: Vec::new(),
            no_buy_orders: Vec::new(),
            no_sell_orders: Vec::new(),
        });

        msg!("Market initialized: {}", market_id);

        emit!(MarketInitialized {
            market_id,
            authority: self.authority.key(),
            settlement_deadline,
            collateral_mint: self.collateral_mint.key(),
            outcome_yes_mint: self.outcome_yes_mint.key(),
            outcome_no_mint: self.outcome_no_mint.key(),
            meta_data_url: self.market.meta_data_url.clone(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}
