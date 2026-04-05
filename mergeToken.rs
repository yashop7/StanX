use anchor_lang::prelude::*;
use anchor_spl::{
    token::{self, Burn, Transfer},
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::constants::*;
use crate::error::*;
use crate::events::*;
use crate::state::Market;

#[derive(Accounts)]
#[instruction(market_id: u32)]
pub struct MergeTokens<'info> {
    #[account(
        mut,
        seeds = [MARKET_SEED, market.market_id.to_le_bytes().as_ref()],
        bump = market.bump,
        constraint = market.market_id == market_id
    )]
    pub market: Box<Account<'info, Market>>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        constraint = user_collateral.mint == market.collateral_mint,
        constraint = user_collateral.owner == user.key()
    )]
    pub user_collateral: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = collateral_vault.key() == market.collateral_vault
    )]
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = outcome_yes_mint.key() == market.outcome_yes_mint
    )]
    pub outcome_yes_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        constraint = outcome_no_mint.key() == market.outcome_no_mint
    )]
    pub outcome_no_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        constraint = user_outcome_yes.owner == user.key(),
        constraint = user_outcome_yes.mint == market.outcome_yes_mint
    )]
    pub user_outcome_yes: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = user_outcome_no.owner == user.key(),
        constraint = user_outcome_no.mint == market.outcome_no_mint
    )]
    pub user_outcome_no: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> MergeTokens<'info> {
    pub fn merge_tokens(&mut self, _market_id: u32, amount: u64) -> Result<()> {
        // User specifies exactly how many YES+NO token pairs to merge back into collateral.
        // Both balances must be >= amount, since we burn equal quantities of each.
        require!(amount > 0, PredictionMarketError::InvalidAmount);
        require!(
            self.user_outcome_yes.amount >= amount,
            PredictionMarketError::NotEnoughBalance
        );
        require!(
            self.user_outcome_no.amount >= amount,
            PredictionMarketError::NotEnoughBalance
        );

        token::burn(
            CpiContext::new(
                self.token_program.to_account_info(),
                Burn {
                    mint: self.outcome_yes_mint.to_account_info(),
                    from: self.user_outcome_yes.to_account_info(),
                    authority: self.user.to_account_info(),
                },
            ),
            amount,
        )?;
        token::burn(
            CpiContext::new(
                self.token_program.to_account_info(),
                Burn {
                    mint: self.outcome_no_mint.to_account_info(),
                    from: self.user_outcome_no.to_account_info(),
                    authority: self.user.to_account_info(),
                },
            ),
            amount,
        )?;

        let market_id_bytes = self.market.market_id.to_le_bytes();
        let market_bump = self.market.bump;
        let seeds = &[MARKET_SEED, market_id_bytes.as_ref(), &[market_bump]];

        token::transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                Transfer {
                    from: self.collateral_vault.to_account_info(),
                    to: self.user_collateral.to_account_info(),
                    authority: self.market.to_account_info(),
                },
                &[seeds],
            ),
            amount,
        )?;

        self.market.total_collateral_locked = self
            .market
            .total_collateral_locked
            .checked_sub(amount)
            .ok_or(PredictionMarketError::MathOverflow)?;

        msg!(
            "Merged {} pairs of outcome tokens back to collateral",
            amount
        );

        emit!(TokensMerged {
            market_id: self.market.market_id,
            user: self.user.key(),
            amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}
