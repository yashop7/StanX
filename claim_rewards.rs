use crate::constants::*;
use crate::error::*;
use crate::events::*;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::{
    token::{self, Burn, Transfer},
    token_interface::{Mint, TokenAccount, TokenInterface},
};

#[derive(Accounts)]
#[instruction(market_id:u32)]
pub struct ClaimRewards<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [MARKET_SEED, market.market_id.to_le_bytes().as_ref()],
        bump = market.bump,
        constraint = market.market_id == market_id
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [USER_STATS_SEED, market_id.to_le_bytes().as_ref(), user.key().as_ref()],
        bump = user_stats.bump,
        constraint = user_stats.user == user.key()
    )]
    pub user_stats: Account<'info, UserStats>,

    #[account(constraint = collateral_mint.key() == market.collateral_mint)]
    pub collateral_mint: InterfaceAccount<'info, Mint>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = collateral_mint,
        associated_token::authority = user,
        associated_token::token_program = token_program,
    )]
    pub user_collateral: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = collateral_vault.key() == market.collateral_vault
    )]
    pub collateral_vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = outcome_yes_mint.key() == market.outcome_yes_mint
    )]
    pub outcome_yes_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        constraint = outcome_no_mint.key() == market.outcome_no_mint
    )]
    pub outcome_no_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        constraint = user_outcome_yes.mint == market.outcome_yes_mint,
        constraint = user_outcome_yes.owner == user.key()
    )]
    pub user_outcome_yes: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_outcome_no.mint == market.outcome_no_mint,
        constraint = user_outcome_no.owner == user.key()
    )]
    pub user_outcome_no: InterfaceAccount<'info, TokenAccount>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> ClaimRewards<'info> {
    pub fn handler(&mut self, _market_id: u32) -> Result<()> {
        require!(
            self.market.is_settled,
            PredictionMarketError::MarketNotSettled
        );

        // check against double-claiming
        require!(
            !self.user_stats.reward_claimed,
            PredictionMarketError::NothingToClaim
        );

        let winner = self
            .market
            .winning_outcome
            .ok_or(PredictionMarketError::WinningOutcomeNotSet)?;

        // If the result is a draw (Neither), nobody gets to claim
        require!(
            winner != WinningOutcome::Neither,
            PredictionMarketError::NoWinnersInDraw
        );

        let is_yes_winner = matches!(winner, WinningOutcome::OutcomeA);

        let winner_mint = if is_yes_winner {
            self.outcome_yes_mint.to_account_info()
        } else {
            self.outcome_no_mint.to_account_info()
        };

        let amount = if is_yes_winner {
            self.user_outcome_yes.amount
        } else {
            self.user_outcome_no.amount
        };

        let winner_ata_info = if is_yes_winner {
            self.user_outcome_yes.to_account_info()
        } else {
            self.user_outcome_no.to_account_info()
        };

        require!(amount > 0, PredictionMarketError::InvalidAmount);

        token::burn(
            CpiContext::new(
                self.token_program.to_account_info(),
                Burn {
                    mint: winner_mint,
                    from: winner_ata_info,
                    authority: self.user.to_account_info(),
                },
            ),
            amount,
        )?;

        let market_id_bytes = self.market.market_id.to_le_bytes();
        let bump = self.market.bump;
        let signer_seeds = &[MARKET_SEED, market_id_bytes.as_ref(), &[bump]];

        token::transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                Transfer {
                    from: self.collateral_vault.to_account_info(),
                    to: self.user_collateral.to_account_info(),
                    authority: self.market.to_account_info(),
                },
                &[signer_seeds],
            ),
            amount,
        )?;

        self.market.total_collateral_locked = self
            .market
            .total_collateral_locked
            .checked_sub(amount)
            .ok_or(PredictionMarketError::MathOverflow)?;

        // Rewards claimed set to true
        self.user_stats.reward_claimed = true;

        let market_id_val = self.market.market_id;
        let user_key = self.user.key();

        msg!(
            "User {} claimed {} collateral (burned {} winning tokens)",
            user_key,
            amount,
            amount
        );

        emit!(RewardsClaimed {
            market_id: market_id_val,
            user: user_key,
            collateral_amount: amount,
            yes_tokens_burned: if is_yes_winner { amount } else { 0 },
            no_tokens_burned: if !is_yes_winner { amount } else { 0 },
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}
